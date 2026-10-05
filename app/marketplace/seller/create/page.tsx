
"use client";

import {
  FormEvent,
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileArchive,
  FileText,
  Image as ImageIcon,
  Info,
  Loader2,
  Lock,
  Save,
  ShieldCheck,
  Sparkles,
  Upload,
  Video,
} from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import TemplateFileUploader from "@/components/marketplace/template-file-uploader";

type SellerProfile = {
  id: string;
  user_id: string | null;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  website_url: string | null;
  seller_status: string | null;
  is_verified: boolean | null;
};

type Template = {
  id: string;
  seller_id: string;
  name: string;
  slug: string | null;
  category: string | null;
  short_description: string | null;
  description: string | null;
  price: number | null;
  currency: string | null;
  features: string[] | null;
  requirements: string[] | null;
  tech_stack: string[] | null;
  license: string | null;
  preview_image: string | null;
  status: string | null;
  review_status: string | null;
};

const supabase = createClient();

const SELLER_PROFILE_SELECT = `
  id,
  user_id,
  username,
  display_name,
  bio,
  avatar_url,
  website_url,
  seller_status,
  is_verified
`;

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

const CURRENCIES = ["INR", "USD"];

const LICENSES = [
  "Personal Use",
  "Commercial Use",
  "Extended Commercial Use",
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function splitLines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinLines(value: string[] | null | undefined) {
  return Array.isArray(value) ? value.join("\n") : "";
}

function formatCurrency(
  amount: number | null | undefined,
  currency = "INR"
) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

function SellerCreateContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const routeTemplateId =
    typeof params?.templateId === "string"
      ? params.templateId
      : undefined;

  const queryTemplateId = searchParams.get("template");

  const templateId = queryTemplateId || routeTemplateId || null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [userId, setUserId] = useState<string | null>(null);
  const [sellerProfile, setSellerProfile] =
    useState<SellerProfile | null>(null);

  const [template, setTemplate] = useState<Template | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] =
    useState(false);

  const [category, setCategory] = useState("");
  const [shortDescription, setShortDescription] =
    useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [features, setFeatures] = useState("");
  const [requirements, setRequirements] = useState("");
  const [techStack, setTechStack] = useState("");
  const [license, setLicense] = useState(LICENSES[0]);
  const [previewImage, setPreviewImage] = useState("");

  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      title: "Information",
      description: "Basic template information",
      icon: FileText,
    },
    {
      title: "Template Files",
      description: "Upload your template package",
      icon: FileArchive,
    },
    {
      title: "Screenshots & Media",
      description: "Add preview images and demo video",
      icon: ImageIcon,
    },
    {
      title: "Security",
      description: "File and package validation",
      icon: ShieldCheck,
    },
    {
      title: "AI Verification",
      description: "ZUQEN verification",
      icon: Sparkles,
    },
    {
      title: "Marketplace Review",
      description: "Final marketplace approval",
      icon: CheckCircle2,
    },
  ];

  useEffect(() => {
    if (!name || slugManuallyEdited) return;

    setSlug(slugify(name));
  }, [name, slugManuallyEdited]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) throw authError;

        if (!user) {
          router.replace(
            `/login?redirect=${encodeURIComponent(
              templateId
                ? `/marketplace/seller/create?template=${templateId}`
                : "/marketplace/seller/create"
            )}`
          );
          return;
        }

        if (cancelled) return;

        setUserId(user.id);

        /*
         * IMPORTANT:
         *
         * The real seller_profiles columns are:
         * seller_status
         * is_verified
         *
         * NOT:
         * status
         * verification_status
         */
        const { data: sellerData, error: sellerError } =
          await supabase
            .from("seller_profiles")
            .select(SELLER_PROFILE_SELECT)
            .eq("user_id", user.id)
            .maybeSingle();

        if (sellerError) {
          throw sellerError;
        }

        if (!sellerData) {
          setError(
            "You need to create your seller profile before creating a template."
          );
          setLoading(false);
          return;
        }

        if (cancelled) return;

        setSellerProfile(sellerData as SellerProfile);

        if (templateId) {
          const { data: templateData, error: templateError } =
            await supabase
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
                  features,
                  requirements,
                  tech_stack,
                  license,
                  preview_image,
                  status,
                  review_status
                `
              )
              .eq("id", templateId)
              .eq("seller_id", user.id)
              .maybeSingle();

          if (templateError) {
            throw templateError;
          }

          if (!templateData) {
            throw new Error(
              "Template not found or you do not have permission to edit it."
            );
          }

          if (cancelled) return;

          const loaded = templateData as Template;

          setTemplate(loaded);
          setName(loaded.name || "");
          setSlug(loaded.slug || slugify(loaded.name || ""));
          setSlugManuallyEdited(true);
          setCategory(loaded.category || "");
          setShortDescription(
            loaded.short_description || ""
          );
          setDescription(loaded.description || "");
          setPrice(
            loaded.price === null || loaded.price === undefined
              ? ""
              : String(loaded.price)
          );
          setCurrency(loaded.currency || "INR");
          setFeatures(joinLines(loaded.features));
          setRequirements(joinLines(loaded.requirements));
          setTechStack(joinLines(loaded.tech_stack));
          setLicense(
            loaded.license || LICENSES[0]
          );
          setPreviewImage(loaded.preview_image || "");
        }
      } catch (err) {
        console.error("Template editor load error:", err);

        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load the template editor."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [router, templateId]);

  const isEditing = Boolean(template);

  const currentStep = steps[activeStep];

  const canOpenUploadWorkflow = Boolean(template?.id);

  const commissionPreview = useMemo(() => {
    const numericPrice = Number(price || 0);

    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      return {
        gross: 0,
        commission: 0,
        seller: 0,
      };
    }

    const commission = numericPrice * 0.2;
    const seller = numericPrice - commission;

    return {
      gross: numericPrice,
      commission,
      seller,
    };
  }, [price]);

  async function ensureUniqueSlug(
    candidate: string,
    currentId?: string
  ) {
    const cleanSlug = slugify(candidate);

    if (!cleanSlug) {
      throw new Error("Please enter a valid template name.");
    }

    let query = supabase
      .from("templates")
      .select("id")
      .eq("slug", cleanSlug)
      .limit(1);

    if (currentId) {
      query = query.neq("id", currentId);
    }

    const { data, error: slugError } = await query.maybeSingle();

    if (slugError) {
      throw slugError;
    }

    if (data) {
      throw new Error(
        "That template slug is already in use. Please choose another."
      );
    }

    return cleanSlug;
  }

  async function handleSaveDraft(
    event?: FormEvent<HTMLFormElement>
  ) {
    event?.preventDefault();

    if (!userId) {
      setError("Your session has expired. Please log in again.");
      return;
    }

    if (!sellerProfile) {
      setError(
        "Unable to load your seller profile. Please create your seller profile first."
      );
      return;
    }

    setError("");
    setSuccess("");

    const cleanName = name.trim();
    const cleanShortDescription = shortDescription.trim();
    const cleanDescription = description.trim();
    const cleanPreviewImage = previewImage.trim();

    if (!cleanName) {
      setError("Template name is required.");
      setActiveStep(0);
      return;
    }

    if (cleanName.length > 120) {
      setError("Template name must be 120 characters or less.");
      setActiveStep(0);
      return;
    }

    if (!category) {
      setError("Please select a category.");
      setActiveStep(0);
      return;
    }

    if (!cleanShortDescription) {
      setError("Short description is required.");
      setActiveStep(0);
      return;
    }

    if (cleanShortDescription.length > 240) {
      setError(
        "Short description must be 240 characters or less."
      );
      setActiveStep(0);
      return;
    }

    if (!cleanDescription) {
      setError("Full description is required.");
      setActiveStep(0);
      return;
    }

    const numericPrice = Number(price || 0);

    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      setError("Please enter a valid template price.");
      setActiveStep(0);
      return;
    }

    if (numericPrice > 10000000) {
      setError("Template price is too high.");
      setActiveStep(0);
      return;
    }

    if (cleanPreviewImage) {
      try {
        const parsed = new URL(cleanPreviewImage);

        if (!["http:", "https:"].includes(parsed.protocol)) {
          throw new Error();
        }
      } catch {
        setError("Preview image must be a valid HTTP or HTTPS URL.");
        setActiveStep(0);
        return;
      }
    }

    setSaving(true);

    try {
      const cleanSlug = await ensureUniqueSlug(
        slug || cleanName,
        template?.id
      );

      const payload = {
        seller_id: userId,
        name: cleanName,
        slug: cleanSlug,
        category,
        short_description: cleanShortDescription,
        description: cleanDescription,
        price: numericPrice,
        currency,
        features: splitLines(features),
        requirements: splitLines(requirements),
        tech_stack: splitLines(techStack),
        license,
        preview_image: cleanPreviewImage || null,

        /*
         * Marketplace publishing is intentionally NOT performed
         * by saving the draft.
         */
        status: "draft",
        review_status: "draft",
      };

      if (template?.id) {
        const { data, error: updateError } = await supabase
          .from("templates")
          .update(payload)
          .eq("id", template.id)
          .eq("seller_id", userId)
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
              features,
              requirements,
              tech_stack,
              license,
              preview_image,
              status,
              review_status
            `
          )
          .single();

        if (updateError) {
          throw updateError;
        }

        setTemplate(data as Template);
        setSlug(cleanSlug);
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
              short_description,
              description,
              price,
              currency,
              features,
              requirements,
              tech_stack,
              license,
              preview_image,
              status,
              review_status
            `
          )
          .single();

        if (insertError) {
          throw insertError;
        }

        const created = data as Template;

        setTemplate(created);
        setSlug(cleanSlug);
        setSuccess(
          "Template draft created. You can now upload the template package and media."
        );

        router.replace(
          `/marketplace/seller/create?template=${encodeURIComponent(
            created.id
          )}`
        );
      }
    } catch (err) {
      console.error("Template draft save error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to save your template draft."
      );
    } finally {
      setSaving(false);
    }
  }

  function handleBack() {
    router.push("/marketplace/seller/dashboard");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050505] text-white">
        <div className="flex min-h-screen items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-zinc-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading template editor...
          </div>
        </div>
      </main>
    );
  }

  if (error && !sellerProfile) {
    return (
      <main className="min-h-screen bg-[#050505] text-white">
        <div className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-6">
          <div className="w-full rounded-3xl border border-white/10 bg-white/[0.025] p-7 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10">
              <AlertCircle className="h-7 w-7 text-red-300" />
            </div>

            <h1 className="text-xl font-semibold">
              Unable to open template editor
            </h1>

            <p className="mt-3 text-sm leading-6 text-zinc-500">
              {error}
            </p>

            <button
              type="button"
              onClick={handleBack}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-7">
          <button
            type="button"
            onClick={handleBack}
            className="mb-5 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Seller Dashboard
          </button>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-500/10">
                  <FileText className="h-6 w-6 text-violet-300" />
                </div>

                <div>
                  <h1 className="text-2xl font-bold sm:text-3xl">
                    {isEditing
                      ? "Edit Template"
                      : "Create Template"}
                  </h1>

                  <p className="mt-1 text-sm text-zinc-600">
                    {template?.name ||
                      "Create a professional template listing for the ZUQEN Marketplace."}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300">
                Draft
              </span>

              <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-500">
                20% ZUQEN commission
              </span>
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[250px_1fr]">
          <aside className="h-fit rounded-3xl border border-white/10 bg-white/[0.025] p-3 lg:sticky lg:top-6">
            <div className="mb-3 px-3 pt-2">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-600">
                Listing Workflow
              </p>
            </div>

            <div className="space-y-1">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const active = index === activeStep;
                const completed =
                  index < activeStep && canOpenUploadWorkflow;

                return (
                  <button
                    key={step.title}
                    type="button"
                    onClick={() => {
                      if (
                        index === 0 ||
                        canOpenUploadWorkflow
                      ) {
                        setActiveStep(index);
                      }
                    }}
                    disabled={
                      index > 0 && !canOpenUploadWorkflow
                    }
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                      active
                        ? "bg-white text-black"
                        : "text-zinc-500 hover:bg-white/[0.04] hover:text-white"
                    } ${
                      index > 0 && !canOpenUploadWorkflow
                        ? "cursor-not-allowed opacity-40"
                        : ""
                    }`}
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        active
                          ? "bg-black/10"
                          : completed
                          ? "bg-emerald-500/10"
                          : "bg-white/[0.04]"
                      }`}
                    >
                      {completed ? (
                        <CheckCircle2
                          className={`h-4 w-4 ${
                            active
                              ? "text-black"
                              : "text-emerald-300"
                          }`}
                        />
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {step.title}
                      </p>
                      <p
                        className={`mt-0.5 truncate text-[11px] ${
                          active
                            ? "text-black/50"
                            : "text-zinc-700"
                        }`}
                      >
                        {step.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="min-w-0">
            {activeStep === 0 && (
              <form
                onSubmit={handleSaveDraft}
                className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-7"
              >
                <div className="mb-7">
                  <h2 className="text-lg font-semibold">
                    Template Information
                  </h2>

                  <p className="mt-1 text-sm text-zinc-600">
                    Add the information buyers need to understand your
                    template.
                  </p>
                </div>

                <div className="grid gap-6">
                  <div>
                    <label
                      htmlFor="name"
                      className="mb-2 block text-sm font-medium text-zinc-200"
                    >
                      Template Name
                    </label>

                    <input
                      id="name"
                      value={name}
                      onChange={(event) =>
                        setName(event.target.value)
                      }
                      placeholder="e.g. Modern SaaS Dashboard"
                      maxLength={120}
                      disabled={saving}
                      className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-700 focus:border-violet-400/50 focus:ring-2 focus:ring-violet-500/10"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="slug"
                      className="mb-2 block text-sm font-medium text-zinc-200"
                    >
                      URL Slug
                    </label>

                    <input
                      id="slug"
                      value={slug}
                      onChange={(event) => {
                        setSlugManuallyEdited(true);
                        setSlug(slugify(event.target.value));
                      }}
                      placeholder="modern-saas-dashboard"
                      disabled={saving}
                      className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-700 focus:border-violet-400/50 focus:ring-2 focus:ring-violet-500/10"
                    />

                    <p className="mt-2 text-xs text-zinc-700">
                      Marketplace URL will use this slug.
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="category"
                      className="mb-2 block text-sm font-medium text-zinc-200"
                    >
                      Category
                    </label>

                    <select
                      id="category"
                      value={category}
                      onChange={(event) =>
                        setCategory(event.target.value)
                      }
                      disabled={saving}
                      className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-violet-400/50"
                    >
                      <option value="">
                        Select category
                      </option>

                      {CATEGORIES.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="shortDescription"
                      className="mb-2 block text-sm font-medium text-zinc-200"
                    >
                      Short Description
                    </label>

                    <textarea
                      id="shortDescription"
                      value={shortDescription}
                      onChange={(event) =>
                        setShortDescription(event.target.value)
                      }
                      rows={3}
                      maxLength={240}
                      placeholder="A concise description of what buyers get."
                      disabled={saving}
                      className="w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-zinc-700 focus:border-violet-400/50 focus:ring-2 focus:ring-violet-500/10"
                    />

                    <p className="mt-2 text-xs text-zinc-700">
                      {shortDescription.length}/240
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="description"
                      className="mb-2 block text-sm font-medium text-zinc-200"
                    >
                      Full Description
                    </label>

                    <textarea
                      id="description"
                      value={description}
                      onChange={(event) =>
                        setDescription(event.target.value)
                      }
                      rows={10}
                      placeholder="Explain the template, what is included, how it works, and who it is for."
                      disabled={saving}
                      className="w-full resize-y rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-zinc-700 focus:border-violet-400/50 focus:ring-2 focus:ring-violet-500/10"
                    />
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="price"
                        className="mb-2 block text-sm font-medium text-zinc-200"
                      >
                        Price
                      </label>

                      <input
                        id="price"
                        type="number"
                        min="0"
                        step="0.01"
                        value={price}
                        onChange={(event) =>
                          setPrice(event.target.value)
                        }
                        placeholder="0"
                        disabled={saving}
                        className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-700 focus:border-violet-400/50"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="currency"
                        className="mb-2 block text-sm font-medium text-zinc-200"
                      >
                        Currency
                      </label>

                      <select
                        id="currency"
                        value={currency}
                        onChange={(event) =>
                          setCurrency(event.target.value)
                        }
                        disabled={saving}
                        className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-violet-400/50"
                      >
                        {CURRENCIES.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="license"
                        className="mb-2 block text-sm font-medium text-zinc-200"
                      >
                        License
                      </label>

                      <select
                        id="license"
                        value={license}
                        onChange={(event) =>
                          setLicense(event.target.value)
                        }
                        disabled={saving}
                        className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-violet-400/50"
                      >
                        {LICENSES.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="previewImage"
                        className="mb-2 block text-sm font-medium text-zinc-200"
                      >
                        Preview Image URL
                      </label>

                      <input
                        id="previewImage"
                        type="url"
                        value={previewImage}
                        onChange={(event) =>
                          setPreviewImage(event.target.value)
                        }
                        placeholder="https://..."
                        disabled={saving}
                        className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-700 focus:border-violet-400/50"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="features"
                      className="mb-2 block text-sm font-medium text-zinc-200"
                    >
                      Features
                    </label>

                    <textarea
                      id="features"
                      value={features}
                      onChange={(event) =>
                        setFeatures(event.target.value)
                      }
                      rows={6}
                      placeholder={"Feature one\nFeature two\nFeature three"}
                      disabled={saving}
                      className="w-full resize-y rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-zinc-700 focus:border-violet-400/50"
                    />

                    <p className="mt-2 text-xs text-zinc-700">
                      One feature per line.
                    </p>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="requirements"
                        className="mb-2 block text-sm font-medium text-zinc-200"
                      >
                        Requirements
                      </label>

                      <textarea
                        id="requirements"
                        value={requirements}
                        onChange={(event) =>
                          setRequirements(event.target.value)
                        }
                        rows={6}
                        placeholder={
                          "Node.js 20+\nNext.js\nSupabase"
                        }
                        disabled={saving}
                        className="w-full resize-y rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-zinc-700 focus:border-violet-400/50"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="techStack"
                        className="mb-2 block text-sm font-medium text-zinc-200"
                      >
                        Tech Stack
                      </label>

                      <textarea
                        id="techStack"
                        value={techStack}
                        onChange={(event) =>
                          setTechStack(event.target.value)
                        }
                        rows={6}
                        placeholder={
                          "Next.js\nTypeScript\nTailwind CSS"
                        }
                        disabled={saving}
                        className="w-full resize-y rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-zinc-700 focus:border-violet-400/50"
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-violet-400/15 bg-violet-500/[0.05] p-5">
                    <div className="flex items-start gap-3">
                      <Info className="mt-0.5 h-5 w-5 shrink-0 text-violet-300" />

                      <div className="min-w-0">
                        <h3 className="font-medium text-violet-100">
                          Seller earnings
                        </h3>

                        <p className="mt-1 text-sm leading-6 text-violet-100/50">
                          ZUQEN keeps 20% commission from a successful sale.
                          The remaining 80% is attributed to your seller
                          earnings ledger.
                        </p>

                        {commissionPreview.gross > 0 && (
                          <div className="mt-4 grid gap-3 sm:grid-cols-3">
                            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                              <p className="text-[11px] text-zinc-600">
                                Price
                              </p>
                              <p className="mt-1 font-semibold">
                                {formatCurrency(
                                  commissionPreview.gross,
                                  currency
                                )}
                              </p>
                            </div>

                            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                              <p className="text-[11px] text-zinc-600">
                                ZUQEN 20%
                              </p>
                              <p className="mt-1 font-semibold text-zinc-400">
                                {formatCurrency(
                                  commissionPreview.commission,
                                  currency
                                )}
                              </p>
                            </div>

                            <div className="rounded-xl border border-emerald-400/10 bg-emerald-500/[0.05] p-3">
                              <p className="text-[11px] text-zinc-600">
                                Seller 80%
                              </p>
                              <p className="mt-1 font-semibold text-emerald-300">
                                {formatCurrency(
                                  commissionPreview.seller,
                                  currency
                                )}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={handleBack}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          {isEditing
                            ? "Save Draft"
                            : "Create Draft"}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {activeStep === 1 && (
              <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-7">
                <div className="mb-7">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10">
                    <FileArchive className="h-6 w-6 text-blue-300" />
                  </div>

                  <h2 className="text-lg font-semibold">
                    Template Package
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-zinc-600">
                    Upload the actual template package buyers will receive.
                    Files are stored privately in Backblaze B2.
                  </p>
                </div>

                {template?.id ? (
                  <TemplateFileUploader
                    templateId={template.id}
                    defaultRole="template"
                  />
                ) : (
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-5 text-sm text-amber-200">
                    Save the template information first. The upload workflow
                    becomes available after the draft has been created.
                  </div>
                )}

                <div className="mt-6 flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <Lock className="mt-0.5 h-5 w-5 shrink-0 text-zinc-500" />

                  <p className="text-sm leading-6 text-zinc-500">
                    Uploaded template files remain private. Buyers will
                    receive authorized download access only after a
                    successful purchase.
                  </p>
                </div>
              </div>
            )}

            {activeStep === 2 && (
              <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-7">
                <div className="mb-7">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-500/10">
                    <ImageIcon className="h-6 w-6 text-pink-300" />
                  </div>

                  <h2 className="text-lg font-semibold">
                    Screenshots & Media
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-zinc-600">
                    Add screenshots and a demo video so buyers can understand
                    exactly what they are purchasing.
                  </p>
                </div>

                {template?.id ? (
                  <div className="space-y-6">
                    <TemplateFileUploader
                      templateId={template.id}
                      defaultRole="screenshot"
                    />

                    <TemplateFileUploader
                      templateId={template.id}
                      defaultRole="demo_video"
                    />

                    <TemplateFileUploader
                      templateId={template.id}
                      defaultRole="documentation"
                    />
                  </div>
                ) : (
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-5 text-sm text-amber-200">
                    Create the template draft first.
                  </div>
                )}

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                    <ImageIcon className="h-5 w-5 text-zinc-500" />
                    <h3 className="mt-3 font-medium">
                      Screenshots
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-zinc-600">
                      Use screenshots that accurately represent the actual
                      template.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                    <Video className="h-5 w-5 text-zinc-500" />
                    <h3 className="mt-3 font-medium">
                      Demo Video
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-zinc-600">
                      The demo should show the real template and its claimed
                      functionality.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeStep === 3 && (
              <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-7">
                <div className="mb-7">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10">
                    <ShieldCheck className="h-6 w-6 text-emerald-300" />
                  </div>

                  <h2 className="text-lg font-semibold">
                    Security & Validation
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-zinc-600">
                    Your uploaded package will go through file and security
                    checks before marketplace review.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    {
                      title: "File validation",
                      text: "Validate file type, size and upload integrity.",
                    },
                    {
                      title: "Package checks",
                      text: "Inspect the uploaded template package for suspicious or invalid content.",
                    },
                    {
                      title: "Metadata checks",
                      text: "Compare template metadata with uploaded assets.",
                    },
                    {
                      title: "Security review",
                      text: "Flag suspicious files or patterns for further review.",
                    },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="rounded-2xl border border-white/10 bg-black/20 p-5"
                    >
                      <ShieldCheck className="h-5 w-5 text-zinc-500" />

                      <h3 className="mt-3 font-medium">
                        {item.title}
                      </h3>

                      <p className="mt-1 text-sm leading-6 text-zinc-600">
                        {item.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeStep === 4 && (
              <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-7">
                <div className="mb-7">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10">
                    <Sparkles className="h-6 w-6 text-violet-300" />
                  </div>

                  <h2 className="text-lg font-semibold">
                    ZUQEN AI Verification
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-zinc-600">
                    ZUQEN will compare your package, screenshots, demo video
                    and listing claims for consistency before final review.
                  </p>
                </div>

                <div className="space-y-3">
                  {[
                    "Package vs screenshots",
                    "Screenshots vs claimed features",
                    "Template vs demo video",
                    "Demonstrated features vs uploaded package",
                    "Description and feature claims",
                    "Cross-media consistency",
                  ].map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-4"
                    >
                      <Sparkles className="h-4 w-4 text-violet-300" />
                      <span className="text-sm text-zinc-400">
                        {item}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-2xl border border-violet-400/15 bg-violet-500/[0.05] p-5">
                  <p className="text-sm leading-6 text-violet-100/60">
                    AI verification does not guarantee that a template is
                    completely bug-free. It is a verification and risk
                    detection layer used alongside marketplace review.
                  </p>
                </div>
              </div>
            )}

            {activeStep === 5 && (
              <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-7">
                <div className="mb-7">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10">
                    <CheckCircle2 className="h-6 w-6 text-emerald-300" />
                  </div>

                  <h2 className="text-lg font-semibold">
                    Marketplace Review
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-zinc-600">
                    After your package, media and verification requirements
                    are complete, the template can move into marketplace
                    review.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-300" />
                      <div>
                        <h3 className="font-medium">
                          Seller profile
                        </h3>
                        <p className="mt-1 text-sm text-zinc-600">
                          {sellerProfile?.display_name ||
                            "Seller profile ready"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-300" />
                      <div>
                        <h3 className="font-medium">
                          Template draft
                        </h3>
                        <p className="mt-1 text-sm text-zinc-600">
                          {template?.name || "Template created"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-amber-400/15 bg-amber-500/[0.05] p-5">
                    <div className="flex items-start gap-3">
                      <Info className="mt-0.5 h-5 w-5 text-amber-300" />
                      <div>
                        <h3 className="font-medium text-amber-100">
                          Submission pipeline
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-amber-100/50">
                          Final submission, AI verification and marketplace
                          approval are handled as separate workflow stages.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-between">
              <button
                type="button"
                disabled={activeStep === 0}
                onClick={() =>
                  setActiveStep((current) =>
                    Math.max(0, current - 1)
                  )
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-zinc-400 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ArrowLeft className="h-4 w-4" />
                Previous
              </button>

              {activeStep < steps.length - 1 && (
                <button
                  type="button"
                  disabled={
                    activeStep === 0 && !template?.id
                  }
                  onClick={async () => {
                    if (activeStep === 0) {
                      await handleSaveDraft();
                      return;
                    }

                    setActiveStep((current) =>
                      Math.min(steps.length - 1, current + 1)
                    );
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {activeStep === 0 ? (
                    <>
                      <Save className="h-4 w-4" />
                      Save & Continue
                    </>
                  ) : (
                    <>
                      Continue
                      <ChevronRightIcon />
                    </>
                  )}
                </button>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M9 18L15 12L9 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function SellerCreatePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#050505] text-white">
          <div className="flex min-h-screen items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-zinc-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading template editor...
            </div>
          </div>
        </main>
      }
    >
      <SellerCreateContent />
    </Suspense>
  );
}

