"use client";

import {
  FormEvent,
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useParams,
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  FileCode2,
  FileText,
  Globe2,
  Info,
  Loader2,
  Save,
  ShieldCheck,
  Sparkles,
  Tag,
  Upload,
} from "lucide-react";

import { createClient } from "@/lib/supabase";
import TemplateFileUploader from "@/components/marketplace/template-file-uploader";

type SellerProfile = {
  id: string;
  user_id?: string | null;
  username?: string | null;
  display_name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  website_url?: string | null;
  status?: string | null;
  verification_status?: string | null;
};

type TemplateRecord = {
  id: string;
  seller_id: string | null;
  name: string;
  slug: string | null;
  category: string;
  short_description: string | null;
  description: string;
  price: number | null;
  currency: string | null;
  preview_image: string | null;
  requirements: string[] | null;
  tech_stack: string[] | null;
  features: string[] | null;
  license: string | null;
  status: string;
  review_status: string;
  created_at: string;
  updated_at: string;
};

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
  "Commercial License",
  "Personal Use",
  "Extended Commercial License",
  "Open Source",
];

function slugify(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

function parseList(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function MarketplaceCreatePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();

  const supabase = useMemo(() => createClient(), []);

  const queryTemplateId = searchParams.get("template");

  const routeTemplateId =
    typeof params?.template === "string"
      ? params.template
      : null;

  const templateId = queryTemplateId || routeTemplateId;

  const isEditing = Boolean(templateId);

  const [userId, setUserId] = useState<string | null>(null);

  const [sellerProfile, setSellerProfile] =
    useState<SellerProfile | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initializing, setInitializing] = useState(true);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] =
    useState(false);

  const [category, setCategory] = useState("");
  const [shortDescription, setShortDescription] =
    useState("");
  const [description, setDescription] = useState("");

  const [price, setPrice] = useState("0");
  const [currency, setCurrency] = useState("INR");

  const [features, setFeatures] = useState("");
  const [requirements, setRequirements] = useState("");
  const [techStack, setTechStack] = useState("");

  const [license, setLicense] = useState(
    "Commercial License"
  );

  const [previewImage, setPreviewImage] = useState("");

  const [originalTemplate, setOriginalTemplate] =
    useState<TemplateRecord | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPage() {
      setLoading(true);
      setError("");

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.replace("/login");
          return;
        }

        if (cancelled) return;

        setUserId(user.id);

        const {
          data: profile,
          error: profileError,
        } = await supabase
          .from("seller_profiles")
          .select(
            `
              id,
              user_id,
              username,
              display_name,
              bio,
              avatar_url,
              website_url,
              status,
              verification_status
            `
          )
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileError) {
          console.error(
            "Seller profile load error:",
            profileError
          );

          throw new Error(
            "Unable to load your seller profile."
          );
        }

        if (!profile) {
          throw new Error(
            "Create your seller profile before creating a marketplace template."
          );
        }

        if (cancelled) return;

        setSellerProfile(profile);

        if (templateId) {
          const {
            data: template,
            error: templateError,
          } = await supabase
            .from("templates")
            .select(
              `
                id,
                seller_id,
                name,
                slug,
                category,
                short_description,
                description,
                price,
                currency,
                preview_image,
                requirements,
                tech_stack,
                features,
                license,
                status,
                review_status,
                created_at,
                updated_at
              `
            )
            .eq("id", templateId)
            .eq("seller_id", user.id)
            .maybeSingle();

          if (templateError) {
            console.error(
              "Template load error:",
              templateError
            );

            throw new Error(
              "Unable to load this template."
            );
          }

          if (!template) {
            throw new Error(
              "Template not found or you do not own it."
            );
          }

          if (cancelled) return;

          setOriginalTemplate(template);

          setName(template.name || "");
          setSlug(template.slug || "");
          setSlugManuallyEdited(Boolean(template.slug));

          setCategory(template.category || "");

          setShortDescription(
            template.short_description || ""
          );

          setDescription(template.description || "");

          setPrice(
            template.price !== null &&
              template.price !== undefined
              ? String(template.price)
              : "0"
          );

          setCurrency(template.currency || "INR");

          setFeatures(
            Array.isArray(template.features)
              ? template.features.join("\n")
              : ""
          );

          setRequirements(
            Array.isArray(template.requirements)
              ? template.requirements.join("\n")
              : ""
          );

          setTechStack(
            Array.isArray(template.tech_stack)
              ? template.tech_stack.join("\n")
              : ""
          );

          setLicense(
            template.license || "Commercial License"
          );

          setPreviewImage(
            template.preview_image || ""
          );
        }
      } catch (err) {
        console.error(
          "Marketplace create page error:",
          err
        );

        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Something went wrong while loading the page."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setInitializing(false);
        }
      }
    }

    void loadPage();

    return () => {
      cancelled = true;
    };
  }, [router, supabase, templateId]);

  useEffect(() => {
    if (!slugManuallyEdited) {
      setSlug(slugify(name));
    }
  }, [name, slugManuallyEdited]);

  function validateForm() {
    const trimmedName = name.trim();
    const trimmedSlug = slug.trim();
    const trimmedShortDescription =
      shortDescription.trim();
    const trimmedDescription = description.trim();

    if (trimmedName.length < 3) {
      return "Template name must contain at least 3 characters.";
    }

    if (trimmedName.length > 120) {
      return "Template name cannot exceed 120 characters.";
    }

    if (!trimmedSlug) {
      return "A valid template slug is required.";
    }

    if (trimmedSlug.length < 3) {
      return "Template slug must contain at least 3 characters.";
    }

    if (!category) {
      return "Please select a template category.";
    }

    if (trimmedShortDescription.length > 250) {
      return "Short description cannot exceed 250 characters.";
    }

    if (trimmedDescription.length < 20) {
      return "Full description must contain at least 20 characters.";
    }

    if (trimmedDescription.length > 20000) {
      return "Full description cannot exceed 20,000 characters.";
    }

    const numericPrice = Number(price);

    if (!Number.isFinite(numericPrice)) {
      return "Enter a valid price.";
    }

    if (numericPrice < 0) {
      return "Price cannot be negative.";
    }

    if (numericPrice > 10000000) {
      return "Price cannot exceed ₹1,00,00,000.";
    }

    if (previewImage.trim()) {
      try {
        const url = new URL(
          previewImage.trim()
        );

        if (
          url.protocol !== "https:" &&
          url.protocol !== "http:"
        ) {
          return "Preview image must use a valid HTTP or HTTPS URL.";
        }
      } catch {
        return "Preview image URL is not valid.";
      }
    }

    return null;
  }

  async function ensureUniqueSlug(
    baseSlug: string,
    currentTemplateId?: string
  ) {
    const cleanBase =
      slugify(baseSlug) || "template";

    let candidate = cleanBase;
    let suffix = 1;

    while (true) {
      let query = supabase
        .from("templates")
        .select("id")
        .eq("slug", candidate)
        .limit(1);

      if (currentTemplateId) {
        query = query.neq(
          "id",
          currentTemplateId
        );
      }

      const {
        data,
        error: lookupError,
      } = await query;

      if (lookupError) {
        throw new Error(
          "Unable to verify template slug availability."
        );
      }

      if (!data || data.length === 0) {
        return candidate;
      }

      suffix += 1;

      candidate = `${cleanBase}-${suffix}`;

      if (candidate.length > 120) {
        const maxBaseLength =
          120 - String(suffix).length - 1;

        candidate = `${cleanBase.slice(
          0,
          maxBaseLength
        )}-${suffix}`;
      }
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!userId) {
      setError(
        "Authentication is required to save a template."
      );
      return;
    }

    setError("");
    setSuccess("");

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);

    try {
      const uniqueSlug =
        await ensureUniqueSlug(
          slug || name,
          templateId || undefined
        );

      const payload = {
        seller_id: userId,
        name: name.trim(),
        slug: uniqueSlug,
        category,
        short_description:
          shortDescription.trim(),
        description: description.trim(),
        price: Number(price),
        currency,
        features: parseList(features),
        requirements: parseList(requirements),
        tech_stack: parseList(techStack),
        license,
        preview_image:
          previewImage.trim() || null,

        /*
         * Saving this page only creates/updates a draft.
         * It does NOT publish the template and does NOT
         * claim that the template has passed verification.
         */
        status: "draft",
        review_status: "draft",
      };

      if (templateId) {
        const {
          data,
          error: updateError,
        } = await supabase
          .from("templates")
          .update(payload)
          .eq("id", templateId)
          .eq("seller_id", userId)
          .select("id, slug")
          .single();

        if (updateError) {
          console.error(
            "Template update error:",
            updateError
          );

          throw new Error(
            updateError.message ||
              "Unable to update the template."
          );
        }

        setSlug(data.slug || uniqueSlug);

        setSuccess(
          "Template draft updated successfully."
        );
      } else {
        const {
          data,
          error: insertError,
        } = await supabase
          .from("templates")
          .insert(payload)
          .select("id, slug")
          .single();

        if (insertError) {
          console.error(
            "Template insert error:",
            insertError
          );

          throw new Error(
            insertError.message ||
              "Unable to create the template draft."
          );
        }

        if (!data?.id) {
          throw new Error(
            "Template was created but its ID was not returned."
          );
        }

        setSlug(data.slug || uniqueSlug);

        setSuccess(
          "Template draft created successfully."
        );

        router.replace(
          `/marketplace/seller/create?template=${data.id}`
        );

        return;
      }
    } catch (err) {
      console.error(
        "Marketplace template save error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to save your template."
      );
    } finally {
      setSaving(false);
    }
  }

  function handleBack() {
    router.push(
      "/marketplace/seller/dashboard"
    );
  }

  if (loading || initializing) {
    return (
      <main className="min-h-screen bg-[#070707] text-white">
        <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6">
          <div className="flex items-center gap-3 text-sm text-white/60">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading marketplace editor...
          </div>
        </div>
      </main>
    );
  }

  if (error && !sellerProfile) {
    return (
      <main className="min-h-screen bg-[#070707] text-white">
        <div className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-6">
          <div className="w-full rounded-2xl border border-red-400/15 bg-red-400/[0.04] p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />

              <div>
                <h1 className="font-semibold text-white">
                  Unable to open template editor
                </h1>

                <p className="mt-2 text-sm leading-6 text-white/55">
                  {error}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleBack}
              className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.08]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </button>
          </div>
        </div>
      </main>
    );
  }

  const workflowSteps = [
    {
      number: "01",
      label: "Template information",
      active: true,
      icon: FileText,
    },
    {
      number: "02",
      label: "Template files",
      active: Boolean(templateId),
      icon: Upload,
    },
    {
      number: "03",
      label: "Screenshots & media",
      active: Boolean(templateId),
      icon: ImageIconSafe,
    },
    {
      number: "04",
      label: "Security validation",
      active: false,
      icon: ShieldCheck,
    },
    {
      number: "05",
      label: "ZUQEN AI verification",
      active: false,
      icon: Sparkles,
    },
    {
      number: "06",
      label: "Marketplace review",
      active: false,
      icon: CheckCircle2,
    },
  ];

  return (
    <main className="min-h-screen bg-[#070707] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <button
              type="button"
              onClick={handleBack}
              className="mb-4 inline-flex items-center gap-2 text-sm text-white/45 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Seller Dashboard
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
                <FileCode2 className="h-5 w-5 text-white/75" />
              </div>

              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  {isEditing
                    ? "Edit Template"
                    : "Create Template"}
                </h1>

                <p className="mt-1 text-sm text-white/45">
                  Build your marketplace listing and save it
                  as a draft.
                </p>
              </div>
            </div>
          </div>

          {isEditing && originalTemplate && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
                Last updated
              </div>

              <div className="mt-1 text-sm text-white/70">
                {formatDate(
                  originalTemplate.updated_at
                )}
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-400/15 bg-red-400/[0.04] p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />

              <div className="text-sm leading-6 text-red-200/80">
                {error}
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.04] p-4">
            <div className="flex items-center gap-3 text-sm text-emerald-200/80">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              {success}
            </div>
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-8">
            <form
              onSubmit={handleSubmit}
              className="space-y-8"
            >
              <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
                <div className="mb-6">
                  <h2 className="text-lg font-semibold">
                    Template Information
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-white/45">
                    Provide accurate information about what
                    the buyer will actually receive.
                  </p>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-white/80">
                      Template name
                    </label>

                    <input
                      value={name}
                      onChange={(event) =>
                        setName(event.target.value)
                      }
                      maxLength={120}
                      placeholder="e.g. AI SaaS Dashboard"
                      className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/25"
                    />

                    <div className="mt-2 text-xs text-white/30">
                      {name.length}/120
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-white/80">
                      URL slug
                    </label>

                    <div className="flex overflow-hidden rounded-xl border border-white/10 bg-black/20">
                      <div className="flex items-center border-r border-white/10 px-3 text-xs text-white/30">
                        /marketplace/template/
                      </div>

                      <input
                        value={slug}
                        onChange={(event) => {
                          setSlug(
                            slugify(
                              event.target.value
                            )
                          );

                          setSlugManuallyEdited(true);
                        }}
                        maxLength={120}
                        placeholder="ai-saas-dashboard"
                        className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-white outline-none placeholder:text-white/25"
                      />
                    </div>

                    <p className="mt-2 text-xs text-white/35">
                      The system will automatically make the
                      slug unique if necessary.
                    </p>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-white/80">
                      Category
                    </label>

                    <div className="relative">
                      <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />

                      <select
                        value={category}
                        onChange={(event) =>
                          setCategory(
                            event.target.value
                          )
                        }
                        className="w-full appearance-none rounded-xl border border-white/10 bg-black/20 px-10 py-3 text-sm text-white outline-none transition focus:border-white/25"
                      >
                        <option
                          value=""
                          className="bg-[#111]"
                        >
                          Select category
                        </option>

                        {CATEGORIES.map((item) => (
                          <option
                            key={item}
                            value={item}
                            className="bg-[#111]"
                          >
                            {item}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-white/80">
                      Short description
                    </label>

                    <textarea
                      value={shortDescription}
                      onChange={(event) =>
                        setShortDescription(
                          event.target.value
                        )
                      }
                      maxLength={250}
                      rows={3}
                      placeholder="A concise explanation of what this template is."
                      className="w-full resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/25 focus:border-white/25"
                    />

                    <div className="mt-2 text-xs text-white/30">
                      {shortDescription.length}/250
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-white/80">
                      Full description
                    </label>

                    <textarea
                      value={description}
                      onChange={(event) =>
                        setDescription(
                          event.target.value
                        )
                      }
                      maxLength={20000}
                      rows={10}
                      placeholder="Describe the template, its actual functionality, included modules, setup process, and important limitations."
                      className="w-full resize-y rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/25 focus:border-white/25"
                    />

                    <div className="mt-2 text-xs text-white/30">
                      {description.length}/20,000
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
                <div className="mb-6">
                  <h2 className="text-lg font-semibold">
                    Pricing & License
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-white/45">
                    Set the buyer price and the license that
                    applies to the template.
                  </p>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-white/80">
                      Price
                    </label>

                    <div className="flex overflow-hidden rounded-xl border border-white/10 bg-black/20">
                      <select
                        value={currency}
                        onChange={(event) =>
                          setCurrency(
                            event.target.value
                          )
                        }
                        className="border-r border-white/10 bg-transparent px-3 text-sm text-white outline-none"
                      >
                        <option
                          value="INR"
                          className="bg-[#111]"
                        >
                          ₹ INR
                        </option>

                        <option
                          value="USD"
                          className="bg-[#111]"
                        >
                          $ USD
                        </option>
                      </select>

                      <input
                        type="number"
                        min="0"
                        max="10000000"
                        step="0.01"
                        value={price}
                        onChange={(event) =>
                          setPrice(
                            event.target.value
                          )
                        }
                        className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm text-white outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-white/80">
                      License
                    </label>

                    <select
                      value={license}
                      onChange={(event) =>
                        setLicense(
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-white/25"
                    >
                      {LICENSES.map((item) => (
                        <option
                          key={item}
                          value={item}
                          className="bg-[#111]"
                        >
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.025] p-4">
                  <div className="flex items-start gap-3">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-white/45" />

                    <div className="text-xs leading-5 text-white/45">
                      ZUQEN marketplace commission is{" "}
                      <span className="font-medium text-white/75">
                        20%
                      </span>{" "}
                      of each successful sale. Payment
                      processing fees, taxes, refunds and
                      other applicable accounting items are
                      handled separately.
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
                <div className="mb-6">
                  <h2 className="text-lg font-semibold">
                    Technical Information
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-white/45">
                    These fields help buyers understand what
                    they need and what is included.
                  </p>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-white/80">
                      Features
                    </label>

                    <textarea
                      value={features}
                      onChange={(event) =>
                        setFeatures(
                          event.target.value
                        )
                      }
                      rows={6}
                      placeholder={`Authentication
Dashboard
Dark Mode
Responsive Design
Analytics`}
                      className="w-full resize-y rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-white/25 focus:border-white/25"
                    />

                    <p className="mt-2 text-xs text-white/30">
                      One feature per line. Claims should
                      match the actual uploaded template.
                    </p>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-white/80">
                      Requirements
                    </label>

                    <textarea
                      value={requirements}
                      onChange={(event) =>
                        setRequirements(
                          event.target.value
                        )
                      }
                      rows={5}
                      placeholder={`Node.js 20+
PostgreSQL
Environment variables
API keys`}
                      className="w-full resize-y rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-white/25"
                    />

                    <p className="mt-2 text-xs text-white/30">
                      One requirement per line.
                    </p>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-white/80">
                      Tech stack
                    </label>

                    <textarea
                      value={techStack}
                      onChange={(event) =>
                        setTechStack(
                          event.target.value
                        )
                      }
                      rows={5}
                      placeholder={`Next.js
React
TypeScript
Tailwind CSS
Supabase`}
                      className="w-full resize-y rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-white/25"
                    />

                    <p className="mt-2 text-xs text-white/30">
                      One technology per line.
                    </p>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
                <div className="mb-6">
                  <h2 className="text-lg font-semibold">
                    Marketplace Preview
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-white/45">
                    The external storage provider is already
                    configured for private marketplace files.
                    This field is currently for an existing
                    preview image URL.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-white/80">
                    Preview image URL
                  </label>

                  <div className="relative">
                    <Globe2 className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-white/30" />

                    <input
                      value={previewImage}
                      onChange={(event) =>
                        setPreviewImage(
                          event.target.value
                        )
                      }
                      placeholder="https://..."
                      className="w-full rounded-xl border border-white/10 bg-black/20 py-3 pl-10 pr-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/25"
                    />
                  </div>

                  <p className="mt-2 text-xs leading-5 text-white/30">
                    Actual thumbnail and screenshot uploads
                    are handled through the B2 upload system
                    below after the draft has been created.
                  </p>
                </div>
              </section>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white/70 transition hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving Draft...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Draft
                    </>
                  )}
                </button>
              </div>
            </form>

            {templateId && (
              <TemplateFileUploader
                templateId={templateId}
              />
            )}
          </div>

          <aside className="h-fit space-y-5 lg:sticky lg:top-6">
            <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <div className="mb-5">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/35">
                  Listing workflow
                </div>

                <p className="mt-2 text-sm leading-6 text-white/45">
                  A template is not published simply by
                  saving this form.
                </p>
              </div>

              <div className="space-y-2">
                {workflowSteps.map((step) => {
                  const StepIcon = step.icon;

                  return (
                    <div
                      key={step.number}
                      className={`flex items-center gap-3 rounded-xl border p-3 ${
                        step.active
                          ? "border-white/10 bg-white/[0.04]"
                          : "border-transparent bg-transparent opacity-45"
                      }`}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/20">
                        <StepIcon className="h-4 w-4 text-white/60" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-medium tracking-[0.15em] text-white/30">
                          {step.number}
                        </div>

                        <div className="mt-0.5 text-xs font-medium text-white/70">
                          {step.label}
                        </div>
                      </div>

                      {step.active && (
                        <ChevronRight className="h-4 w-4 text-white/25" />
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.03] p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400/80" />

                <div>
                  <h3 className="text-sm font-medium text-white">
                    Verification comes later
                  </h3>

                  <p className="mt-2 text-xs leading-5 text-white/45">
                    Uploaded templates will go through
                    security/file validation and ZUQEN AI
                    verification before marketplace
                    publication. Saving a draft does not
                    indicate approval.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/35">
                Seller
              </div>

              <div className="mt-4 flex items-center gap-3">
                {sellerProfile?.avatar_url ? (
                  <img
                    src={sellerProfile.avatar_url}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.07] text-sm font-semibold text-white/60">
                    {(
                      sellerProfile?.display_name ||
                      sellerProfile?.username ||
                      "S"
                    )
                      .slice(0, 1)
                      .toUpperCase()}
                  </div>
                )}

                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-white">
                    {sellerProfile?.display_name ||
                      sellerProfile?.username ||
                      "Seller"}
                  </div>

                  {sellerProfile?.username && (
                    <div className="truncate text-xs text-white/35">
                      @{sellerProfile.username}
                    </div>
                  )}
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function ImageIconSafe(props: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
      aria-hidden="true"
    >
      <rect
        width="18"
        height="18"
        x="3"
        y="3"
        rx="2"
      />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}

export default function CreateMarketplaceTemplatePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#070707] text-white">
          <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6">
            <div className="flex items-center gap-3 text-sm text-white/60">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading marketplace editor...
            </div>
          </div>
        </main>
      }
    >
      <MarketplaceCreatePageContent />
    </Suspense>
  );
}