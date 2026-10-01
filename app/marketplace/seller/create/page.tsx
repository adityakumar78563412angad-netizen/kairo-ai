"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronDown,
  FileText,
  Globe,
  Info,
  Loader2,
  Plus,
  Save,
  Store,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase";

type SellerProfile = {
  id: string;
  user_id: string;
  display_name: string | null;
  username: string | null;
  seller_status: string | null;
  is_verified: boolean | null;
};

type Template = {
  id: string;
  seller_id: string | null;
  name: string;
  slug: string | null;
  category: string;
  description: string;
  short_description: string | null;
  price: number;
  currency: string | null;
  requirements: string | null;
  tech_stack: string[] | null;
  features: string[] | null;
  license: string | null;
  status: string;
  review_status: string | null;
  preview_image: string | null;
  created_at: string;
  updated_at: string;
};

const supabase = createClient();

const CATEGORIES = [
  "Website",
  "Landing Page",
  "SaaS",
  "Dashboard",
  "E-commerce",
  "Portfolio",
  "AI",
  "Admin Panel",
  "Mobile",
  "UI Kit",
  "Components",
];

const LICENSES = [
  "Personal Use",
  "Commercial Use",
  "Extended Commercial Use",
  "MIT",
  "Apache 2.0",
  "GPL",
];

function createSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseList(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function listToText(value: string[] | null | undefined) {
  return Array.isArray(value) ? value.join("\n") : "";
}

export default function CreateTemplatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get("template");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  const [userId, setUserId] = useState("");
  const [sellerProfile, setSellerProfile] =
    useState<SellerProfile | null>(null);
  const [existingTemplate, setExistingTemplate] =
    useState<Template | null>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [category, setCategory] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("0");
  const [currency, setCurrency] = useState("INR");
  const [features, setFeatures] = useState("");
  const [requirements, setRequirements] = useState("");
  const [techStack, setTechStack] = useState("");
  const [license, setLicense] = useState("");
  const [previewImage, setPreviewImage] = useState("");

  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      setLoading(true);
      setError("");

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
          throw authError;
        }

        if (!user) {
          router.push("/login?redirect=/marketplace/seller/create");
          return;
        }

        if (!mounted) return;

        setUserId(user.id);

        const { data: seller, error: sellerError } = await supabase
          .from("seller_profiles")
          .select(
            `
              id,
              user_id,
              display_name,
              username,
              seller_status,
              is_verified
            `
          )
          .eq("user_id", user.id)
          .maybeSingle();

        if (sellerError) {
          throw sellerError;
        }

        if (!seller) {
          throw new Error(
            "Seller profile not found. Please complete your seller profile first."
          );
        }

        if (!mounted) return;

        setSellerProfile(seller as SellerProfile);

        if (templateId) {
          setLoadingTemplate(true);

          const { data: template, error: templateError } = await supabase
            .from("templates")
            .select(
              `
                id,
                seller_id,
                name,
                slug,
                category,
                description,
                short_description,
                price,
                currency,
                requirements,
                tech_stack,
                features,
                license,
                status,
                review_status,
                preview_image,
                created_at,
                updated_at
              `
            )
            .eq("id", templateId)
            .eq("seller_id", user.id)
            .maybeSingle();

          if (templateError) {
            throw templateError;
          }

          if (!template) {
            throw new Error(
              "This template was not found or you do not have permission to edit it."
            );
          }

          if (!mounted) return;

          const current = template as Template;

          setExistingTemplate(current);
          setName(current.name || "");
          setSlug(current.slug || "");
          setCategory(current.category || "");
          setShortDescription(current.short_description || "");
          setDescription(current.description || "");
          setPrice(String(current.price ?? 0));
          setCurrency(current.currency || "INR");
          setFeatures(listToText(current.features));
          setRequirements(current.requirements || "");
          setTechStack(listToText(current.tech_stack));
          setLicense(current.license || "");
          setPreviewImage(current.preview_image || "");

          setSlugManuallyEdited(true);
        }
      } catch (err) {
        console.error("Failed to initialize template editor:", err);

        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to open the template editor."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
          setLoadingTemplate(false);
        }
      }
    }

    initialize();

    return () => {
      mounted = false;
    };
  }, [router, templateId]);

  useEffect(() => {
    if (!slugManuallyEdited) {
      setSlug(createSlug(name));
    }
  }, [name, slugManuallyEdited]);

  async function ensureUniqueSlug(baseSlug: string, currentId?: string) {
    const cleanBase = createSlug(baseSlug);

    if (!cleanBase) {
      throw new Error("Please enter a valid template name.");
    }

    let candidate = cleanBase;

    for (let index = 0; index < 100; index += 1) {
      const { data, error: lookupError } = await supabase
        .from("templates")
        .select("id")
        .eq("slug", candidate)
        .maybeSingle();

      if (lookupError) {
        throw lookupError;
      }

      if (!data || data.id === currentId) {
        return candidate;
      }

      candidate = `${cleanBase}-${index + 2}`;
    }

    throw new Error("Unable to generate a unique template URL.");
  }

  function validateForm() {
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();

    if (trimmedName.length < 3) {
      throw new Error("Template name must contain at least 3 characters.");
    }

    if (trimmedName.length > 120) {
      throw new Error("Template name cannot exceed 120 characters.");
    }

    if (!category) {
      throw new Error("Please select a template category.");
    }

    if (shortDescription.trim().length > 250) {
      throw new Error(
        "Short description cannot exceed 250 characters."
      );
    }

    if (trimmedDescription.length < 20) {
      throw new Error(
        "Please provide a detailed description of at least 20 characters."
      );
    }

    if (trimmedDescription.length > 20000) {
      throw new Error(
        "Description cannot exceed 20,000 characters."
      );
    }

    const numericPrice = Number(price);

    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      throw new Error("Please enter a valid non-negative price.");
    }

    if (numericPrice > 10000000) {
      throw new Error("Price is too high.");
    }

    if (previewImage.trim()) {
      try {
        const url = new URL(previewImage.trim());

        if (!["http:", "https:"].includes(url.protocol)) {
          throw new Error();
        }
      } catch {
        throw new Error(
          "Preview image must be a valid HTTP or HTTPS URL."
        );
      }
    }

    return numericPrice;
  }

  async function saveTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      if (!userId) {
        throw new Error("Authentication is required.");
      }

      if (!sellerProfile) {
        throw new Error(
          "Seller profile is required before creating a template."
        );
      }

      const numericPrice = validateForm();

      const generatedSlug = await ensureUniqueSlug(
        slug || name,
        existingTemplate?.id
      );

      const payload = {
        seller_id: userId,
        name: name.trim(),
        slug: generatedSlug,
        category,
        description: description.trim(),
        short_description: shortDescription.trim() || null,
        price: numericPrice,
        currency: currency || "INR",
        requirements: requirements.trim() || null,
        tech_stack: parseList(techStack),
        features: parseList(features),
        license: license || null,
        preview_image: previewImage.trim() || null,
        status: "draft",
        review_status: "draft",
      };

      if (existingTemplate) {
        const { data, error: updateError } = await supabase
          .from("templates")
          .update(payload)
          .eq("id", existingTemplate.id)
          .eq("seller_id", userId)
          .select(
            `
              id,
              seller_id,
              name,
              slug,
              category,
              description,
              short_description,
              price,
              currency,
              requirements,
              tech_stack,
              features,
              license,
              status,
              review_status,
              preview_image,
              created_at,
              updated_at
            `
          )
          .single();

        if (updateError) {
          throw updateError;
        }

        setExistingTemplate(data as Template);
        setSlug(generatedSlug);
        setSlugManuallyEdited(true);
        setSuccess("Template draft updated successfully.");
      } else {
        const { data, error: insertError } = await supabase
          .from("templates")
          .insert(payload)
          .select(
            `
              id,
              seller_id,
              name,
              slug,
              category,
              description,
              short_description,
              price,
              currency,
              requirements,
              tech_stack,
              features,
              license,
              status,
              review_status,
              preview_image,
              created_at,
              updated_at
            `
          )
          .single();

        if (insertError) {
          throw insertError;
        }

        setExistingTemplate(data as Template);
        setSlug(generatedSlug);
        setSlugManuallyEdited(true);
        setSuccess("Template draft created successfully.");

        router.replace(
          `/marketplace/seller/create?template=${data.id}`
        );
      }

      window.setTimeout(() => {
        setSuccess("");
      }, 4000);
    } catch (err) {
      console.error("Failed to save template:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to save template."
      );
    } finally {
      setSaving(false);
    }
  }

  function goBack() {
    router.push("/marketplace/seller/dashboard");
  }

  if (loading || loadingTemplate) {
    return (
      <main className="min-h-screen bg-[#07090d] text-white">
        <div className="flex min-h-screen items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-zinc-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            {loadingTemplate
              ? "Loading template..."
              : "Loading seller workspace..."}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#07090d] text-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-8">
          <button
            type="button"
            onClick={goBack}
            className="mb-5 inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Seller Dashboard
          </button>

          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05]">
                  <FileText className="h-5 w-5 text-zinc-200" />
                </div>

                <div>
                  <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                    {existingTemplate
                      ? "Edit Template"
                      : "Create Template"}
                  </h1>

                  <p className="mt-1 text-sm text-zinc-500">
                    {existingTemplate
                      ? "Update your marketplace template draft."
                      : "Create a professional template listing draft."}
                  </p>
                </div>
              </div>
            </div>

            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              <FileText className="h-3.5 w-3.5" />
              Draft
            </div>
          </div>
        </header>

        {/* Alerts */}
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>{error}</div>
          </div>
        )}

        {success && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            <Check className="mt-0.5 h-5 w-5 shrink-0" />
            <div>{success}</div>
          </div>
        )}

        <form onSubmit={saveTemplate}>
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            {/* Main */}
            <div className="space-y-6">
              {/* Basic information */}
              <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-7">
                <SectionHeading
                  icon={<FileText className="h-4 w-4" />}
                  title="Basic Information"
                  description="Tell buyers exactly what this template is."
                />

                <div className="mt-7 space-y-6">
                  <Field
                    label="Template name"
                    required
                    htmlFor="template-name"
                  >
                    <input
                      id="template-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      maxLength={120}
                      placeholder="e.g. Modern SaaS Dashboard"
                      className={inputClass}
                    />

                    <CharacterCount
                      value={name.length}
                      max={120}
                    />
                  </Field>

                  <Field
                    label="URL slug"
                    required
                    htmlFor="template-slug"
                    hint="This becomes the public template URL."
                  >
                    <div className="flex items-center rounded-xl border border-white/10 bg-black/20 focus-within:border-white/25">
                      <span className="pl-4 text-xs text-zinc-600">
                        /marketplace/template/
                      </span>

                      <input
                        id="template-slug"
                        value={slug}
                        onChange={(event) => {
                          setSlugManuallyEdited(true);
                          setSlug(createSlug(event.target.value));
                        }}
                        maxLength={150}
                        placeholder="modern-saas-dashboard"
                        className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm text-white outline-none placeholder:text-zinc-700"
                      />
                    </div>
                  </Field>

                  <Field
                    label="Category"
                    required
                    htmlFor="template-category"
                  >
                    <div className="relative">
                      <select
                        id="template-category"
                        value={category}
                        onChange={(event) =>
                          setCategory(event.target.value)
                        }
                        className={`${inputClass} appearance-none pr-10`}
                      >
                        <option value="" className="bg-[#0b0d12]">
                          Select category
                        </option>

                        {CATEGORIES.map((item) => (
                          <option
                            key={item}
                            value={item}
                            className="bg-[#0b0d12]"
                          >
                            {item}
                          </option>
                        ))}
                      </select>

                      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                    </div>
                  </Field>

                  <Field
                    label="Short description"
                    htmlFor="short-description"
                    hint="A concise summary shown on marketplace cards."
                  >
                    <textarea
                      id="short-description"
                      value={shortDescription}
                      onChange={(event) =>
                        setShortDescription(event.target.value)
                      }
                      maxLength={250}
                      rows={3}
                      placeholder="A clean, production-ready SaaS dashboard template..."
                      className={textareaClass}
                    />

                    <CharacterCount
                      value={shortDescription.length}
                      max={250}
                    />
                  </Field>

                  <Field
                    label="Full description"
                    required
                    htmlFor="description"
                    hint="Explain what buyers actually receive."
                  >
                    <textarea
                      id="description"
                      value={description}
                      onChange={(event) =>
                        setDescription(event.target.value)
                      }
                      maxLength={20000}
                      rows={10}
                      placeholder="Describe the template, included functionality, structure, customization options, and anything buyers should know..."
                      className={textareaClass}
                    />

                    <CharacterCount
                      value={description.length}
                      max={20000}
                    />
                  </Field>
                </div>
              </section>

              {/* Features */}
              <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-7">
                <SectionHeading
                  icon={<Check className="h-4 w-4" />}
                  title="Features"
                  description="List the actual functionality included in the template."
                />

                <div className="mt-6">
                  <textarea
                    value={features}
                    onChange={(event) =>
                      setFeatures(event.target.value)
                    }
                    rows={8}
                    placeholder={`Authentication
Responsive dashboard
Dark mode
Analytics
User management`}
                    className={textareaClass}
                  />

                  <p className="mt-2 text-xs text-zinc-600">
                    Use one feature per line. These claims will later be
                    checked by ZUQEN's template verification system.
                  </p>
                </div>
              </section>

              {/* Technical details */}
              <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-7">
                <SectionHeading
                  icon={<Globe className="h-4 w-4" />}
                  title="Technical Details"
                  description="Give buyers the information needed before purchase."
                />

                <div className="mt-6 space-y-6">
                  <Field
                    label="Tech stack"
                    htmlFor="tech-stack"
                    hint="One technology per line."
                  >
                    <textarea
                      id="tech-stack"
                      value={techStack}
                      onChange={(event) =>
                        setTechStack(event.target.value)
                      }
                      rows={6}
                      placeholder={`Next.js
TypeScript
Tailwind CSS
Supabase`}
                      className={textareaClass}
                    />
                  </Field>

                  <Field
                    label="Requirements"
                    htmlFor="requirements"
                    hint="Mention prerequisites, accounts, software or services required."
                  >
                    <textarea
                      id="requirements"
                      value={requirements}
                      onChange={(event) =>
                        setRequirements(event.target.value)
                      }
                      rows={6}
                      placeholder="Node.js 20+, npm/pnpm, required environment variables, third-party services, etc."
                      className={textareaClass}
                    />
                  </Field>

                  <Field
                    label="License"
                    htmlFor="license"
                  >
                    <div className="relative">
                      <select
                        id="license"
                        value={license}
                        onChange={(event) =>
                          setLicense(event.target.value)
                        }
                        className={`${inputClass} appearance-none pr-10`}
                      >
                        <option value="" className="bg-[#0b0d12]">
                          Select license
                        </option>

                        {LICENSES.map((item) => (
                          <option
                            key={item}
                            value={item}
                            className="bg-[#0b0d12]"
                          >
                            {item}
                          </option>
                        ))}
                      </select>

                      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                    </div>
                  </Field>
                </div>
              </section>
            </div>

            {/* Sidebar */}
            <aside className="space-y-6">
              {/* Pricing */}
              <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                <SectionHeading
                  icon={<Store className="h-4 w-4" />}
                  title="Pricing"
                  description="Set the amount buyers will pay."
                />

                <div className="mt-6 space-y-5">
                  <Field
                    label="Currency"
                    htmlFor="currency"
                  >
                    <select
                      id="currency"
                      value={currency}
                      onChange={(event) =>
                        setCurrency(event.target.value)
                      }
                      className={inputClass}
                    >
                      <option value="INR" className="bg-[#0b0d12]">
                        INR — Indian Rupee
                      </option>
                      <option value="USD" className="bg-[#0b0d12]">
                        USD — US Dollar
                      </option>
                    </select>
                  </Field>

                  <Field
                    label="Price"
                    required
                    htmlFor="price"
                  >
                    <div className="flex items-center rounded-xl border border-white/10 bg-black/20 focus-within:border-white/25">
                      <span className="pl-4 text-sm text-zinc-500">
                        {currency === "USD" ? "$" : "₹"}
                      </span>

                      <input
                        id="price"
                        type="number"
                        min="0"
                        max="10000000"
                        step="0.01"
                        value={price}
                        onChange={(event) =>
                          setPrice(event.target.value)
                        }
                        className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm text-white outline-none"
                      />
                    </div>
                  </Field>

                  <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-start gap-3">
                      <Info className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />

                      <div>
                        <p className="text-xs font-medium text-zinc-300">
                          Marketplace commission
                        </p>

                        <p className="mt-1 text-xs leading-5 text-zinc-600">
                          ZUQEN takes 20% of each successful sale. The seller
                          receives 80%, subject to the marketplace's
                          settlement, refund and payout rules.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Preview */}
              <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                <SectionHeading
                  icon={<Globe className="h-4 w-4" />}
                  title="Preview Image"
                  description="Temporary image URL field until the marketplace media uploader is connected."
                />

                <div className="mt-5">
                  <input
                    type="url"
                    value={previewImage}
                    onChange={(event) =>
                      setPreviewImage(event.target.value)
                    }
                    placeholder="https://..."
                    className={inputClass}
                  />

                  <div className="mt-4 aspect-video overflow-hidden rounded-xl border border-white/10 bg-black/30">
                    {previewImage.trim() ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previewImage.trim()}
                        alt="Template preview"
                        className="h-full w-full object-cover"
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center text-center">
                        <Globe className="h-6 w-6 text-zinc-700" />
                        <p className="mt-2 text-xs text-zinc-700">
                          Preview will appear here
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* Next steps */}
              <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-5">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-600">
                  Listing workflow
                </p>

                <div className="mt-4 space-y-3">
                  <WorkflowItem
                    number="01"
                    label="Template information"
                    active
                  />

                  <WorkflowItem
                    number="02"
                    label="Template files"
                  />

                  <WorkflowItem
                    number="03"
                    label="Screenshots & media"
                  />

                  <WorkflowItem
                    number="04"
                    label="Security validation"
                  />

                  <WorkflowItem
                    number="05"
                    label="ZUQEN AI verification"
                  />

                  <WorkflowItem
                    number="06"
                    label="Marketplace review"
                  />
                </div>

                <p className="mt-5 text-xs leading-5 text-zinc-600">
                  Saving this page creates or updates a draft only. It does
                  not publish the template and does not claim that the
                  template has been verified.
                </p>
              </section>
            </aside>
          </div>

          {/* Bottom actions */}
          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <p className="text-sm font-medium text-zinc-300">
                {existingTemplate
                  ? "Continue editing your draft"
                  : "Save your template as a draft"}
              </p>

              <p className="mt-1 text-xs text-zinc-600">
                You can add files and media in the next stage.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={goBack}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-5 py-3 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : existingTemplate ? (
                  <Save className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}

                {saving
                  ? "Saving..."
                  : existingTemplate
                  ? "Save Draft"
                  : "Create Draft"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}

function SectionHeading({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-400">
        {icon}
      </div>

      <div>
        <h2 className="text-base font-semibold text-zinc-200">
          {title}
        </h2>

        <p className="mt-1 text-xs leading-5 text-zinc-600">
          {description}
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label
          htmlFor={htmlFor}
          className="text-sm font-medium text-zinc-300"
        >
          {label}
          {required && (
            <span className="ml-1 text-zinc-500">*</span>
          )}
        </label>

        {hint && (
          <span className="hidden text-xs text-zinc-700 sm:block">
            {hint}
          </span>
        )}
      </div>

      {children}

      {hint && (
        <p className="mt-2 text-xs leading-5 text-zinc-600 sm:hidden">
          {hint}
        </p>
      )}
    </div>
  );
}

function CharacterCount({
  value,
  max,
}: {
  value: number;
  max: number;
}) {
  return (
    <div className="mt-1 text-right text-[11px] text-zinc-700">
      {value}/{max}
    </div>
  );
}

function WorkflowItem({
  number,
  label,
  active = false,
}: {
  number: string;
  label: string;
  active?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-lg border text-[10px] font-medium ${
          active
            ? "border-white/20 bg-white/[0.08] text-zinc-200"
            : "border-white/5 bg-black/20 text-zinc-700"
        }`}
      >
        {number}
      </span>

      <span
        className={`text-xs ${
          active ? "text-zinc-300" : "text-zinc-600"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-white/25 focus:bg-black/30";

const textareaClass =
  "w-full resize-y rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-700 focus:border-white/25 focus:bg-black/30";