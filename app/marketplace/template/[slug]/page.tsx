"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Clock3,
  Code2,
  Download,
  ExternalLink,
  FileCode2,
  Heart,
  Image as ImageIcon,
  Layers3,
  Loader2,
  Play,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Star,
  User,
  X,
  Zap,
} from "lucide-react";

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
  preview_image: string | null;
  featured: boolean;
  is_new: boolean;
  status: string;
  review_status: string;
  published_at: string | null;
  average_rating: number;
  review_count: number;
  sales_count: number;
  view_count: number;
  wishlist_count: number;
  requirements: string[] | null;
  tech_stack: string[] | null;
  features: string[] | null;
  license: string | null;
  created_at: string;
};

type TemplateImage = {
  id: string;
  image_path: string;
  created_at: string;
};

type TemplateFile = {
  id: string;
  file_name: string;
  file_size: number | null;
  content_type: string | null;
  file_role: string | null;
};

type SellerProfile = {
  id: string;
  user_id: string;
  store_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  website_url: string | null;
  verified: boolean;
  total_sales: number;
};

function formatPrice(price: number, currency?: string | null) {
  if (!price || price <= 0) return "Free";

  const symbol =
    currency === "USD"
      ? "$"
      : currency === "EUR"
        ? "€"
        : currency === "GBP"
          ? "£"
          : "₹";

  return `${symbol}${Number(price).toLocaleString("en-IN")}`;
}

function formatFileSize(bytes: number | null) {
  if (!bytes || bytes <= 0) return "Unknown size";

  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${
    units[unitIndex]
  }`;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function normalizeArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0
  );
}

function GalleryPlaceholder({ name }: { name: string }) {
  return (
    <div className="flex h-full min-h-[360px] items-center justify-center bg-gradient-to-br from-violet-500/20 via-fuchsia-500/10 to-blue-500/10">
      <div className="text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-black/20 shadow-2xl backdrop-blur-xl">
          <Layers3 className="h-9 w-9 text-white/60" />
        </div>

        <p className="mt-5 max-w-xs text-sm font-medium text-white/50">
          {name}
        </p>
      </div>
    </div>
  );
}

export default function TemplateDetailPage() {
  const params = useParams();
  const slug = Array.isArray(params?.slug)
    ? params.slug[0]
    : params?.slug;

  const supabase = useMemo(() => createClient(), []);

  const [template, setTemplate] = useState<Template | null>(null);
  const [images, setImages] = useState<TemplateImage[]>([]);
  const [files, setFiles] = useState<TemplateFile[]>([]);
  const [seller, setSeller] = useState<SellerProfile | null>(null);

  const [selectedImage, setSelectedImage] = useState(0);
  const [wishlist, setWishlist] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [sellerLoading, setSellerLoading] = useState(false);

  useEffect(() => {
    if (!slug) return;

    let mounted = true;

    async function loadTemplate() {
      setLoading(true);
      setError("");
      setNotFound(false);

      const templateQuery = await supabase
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
            preview_image,
            featured,
            is_new,
            status,
            review_status,
            published_at,
            average_rating,
            review_count,
            sales_count,
            view_count,
            wishlist_count,
            requirements,
            tech_stack,
            features,
            license,
            created_at
          `
        )
        .eq("status", "published")
        .eq("review_status", "approved")
        .or(`slug.eq.${slug},id.eq.${slug}`)
        .maybeSingle();

      if (!mounted) return;

      if (templateQuery.error) {
        console.error(
          "Template detail query error:",
          templateQuery.error
        );
        setError("Template load nahi ho paaya.");
        setLoading(false);
        return;
      }

      if (!templateQuery.data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const currentTemplate = templateQuery.data as Template;
      setTemplate(currentTemplate);

      const [imagesQuery, filesQuery] = await Promise.all([
        supabase
          .from("template_images")
          .select("id, image_path, created_at")
          .eq("template_id", currentTemplate.id)
          .order("created_at", { ascending: true }),

        supabase
          .from("template_files")
          .select(
            "id, file_name, file_size, content_type, file_role"
          )
          .eq("template_id", currentTemplate.id)
          .order("created_at", { ascending: true }),
      ]);

      if (!mounted) return;

      if (!imagesQuery.error) {
        setImages((imagesQuery.data || []) as TemplateImage[]);
      }

      if (!filesQuery.error) {
        setFiles((filesQuery.data || []) as TemplateFile[]);
      }

      if (currentTemplate.seller_id) {
        setSellerLoading(true);

        const sellerQuery = await supabase
          .from("seller_profiles")
          .select(
            `
              id,
              user_id,
              store_name,
              bio,
              avatar_url,
              website_url,
              verified,
              total_sales
            `
          )
          .eq("user_id", currentTemplate.seller_id)
          .maybeSingle();

        if (mounted && !sellerQuery.error && sellerQuery.data) {
          setSeller(sellerQuery.data as SellerProfile);
        }

        if (mounted) {
          setSellerLoading(false);
        }
      }

      setLoading(false);
    }

    loadTemplate();

    return () => {
      mounted = false;
    };
  }, [slug, supabase]);

  useEffect(() => {
    if (!template) return;

    const title = `${template.name} — ZUQEN Marketplace`;
    document.title = title;
  }, [template]);

  const galleryImages = useMemo(() => {
    const result: string[] = [];

    if (template?.preview_image) {
      result.push(template.preview_image);
    }

    for (const image of images) {
      if (image.image_path && !result.includes(image.image_path)) {
        result.push(image.image_path);
      }
    }

    return result;
  }, [template, images]);

  const features = normalizeArray(template?.features);
  const requirements = normalizeArray(template?.requirements);
  const techStack = normalizeArray(template?.tech_stack);

  function goBack() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/marketplace";
    }
  }

  function handleBuy() {
    if (!template) return;

    /*
     * Payment/purchase flow will be connected in the marketplace
     * purchase phase. Keeping this route intentional prevents
     * accidental fake transactions.
     */
    window.location.href = `/marketplace/checkout/${template.slug || template.id}`;
  }

  function handleWishlist() {
    if (!template) return;

    setWishlist((current) => !current);

    /*
     * The permanent wishlist insert/delete flow will be connected
     * when the buyer marketplace account layer is implemented.
     */
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#07070a] text-white">
        <div className="mx-auto max-w-[1450px] px-4 py-6 sm:px-6 lg:px-8">
          <div className="h-10 w-32 animate-pulse rounded-xl bg-white/[0.05]" />

          <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_420px]">
            <div className="space-y-4">
              <div className="aspect-[16/10] animate-pulse rounded-3xl bg-white/[0.045]" />

              <div className="grid grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((item) => (
                  <div
                    key={item}
                    className="aspect-video animate-pulse rounded-xl bg-white/[0.04]"
                  />
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="h-6 w-32 animate-pulse rounded bg-white/[0.06]" />
              <div className="h-10 w-4/5 animate-pulse rounded bg-white/[0.06]" />
              <div className="h-20 animate-pulse rounded bg-white/[0.04]" />
              <div className="h-32 animate-pulse rounded-2xl bg-white/[0.05]" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (notFound || !template) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07070a] px-6 text-white">
        <div className="w-full max-w-lg rounded-3xl border border-white/[0.08] bg-white/[0.03] p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04]">
            <Layers3 className="h-6 w-6 text-white/40" />
          </div>

          <h1 className="mt-5 text-2xl font-bold">
            Template not found
          </h1>

          <p className="mt-2 text-sm leading-6 text-white/40">
            Ye template available nahi hai, unpublished hai, ya
            marketplace review pass nahi hua hai.
          </p>

          <button
            onClick={() => (window.location.href = "/marketplace")}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Marketplace
          </button>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07070a] px-6 text-white">
        <div className="w-full max-w-lg rounded-3xl border border-red-400/10 bg-red-500/[0.04] p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-red-400/10 bg-red-500/[0.08]">
            <X className="h-6 w-6 text-red-300" />
          </div>

          <h1 className="mt-5 text-xl font-semibold">
            Something went wrong
          </h1>

          <p className="mt-2 text-sm text-white/40">{error}</p>

          <button
            onClick={() => window.location.reload()}
            className="mt-6 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  const currentImage = galleryImages[selectedImage];

  return (
    <main className="min-h-screen bg-[#07070a] text-white">
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute left-[20%] top-[-260px] h-[600px] w-[700px] rounded-full bg-violet-600/[0.08] blur-[150px]" />
        <div className="absolute right-[-200px] top-[550px] h-[500px] w-[500px] rounded-full bg-blue-500/[0.05] blur-[140px]" />
      </div>

      <div className="mx-auto max-w-[1450px] px-4 pb-20 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between border-b border-white/[0.06] py-5">
          <button
            onClick={goBack}
            className="flex items-center gap-2 text-sm text-white/45 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Marketplace
          </button>

          <button
            onClick={() => (window.location.href = "/")}
            className="flex items-center gap-2.5"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06]">
              <Sparkles className="h-4 w-4 text-violet-300" />
            </div>
            <span className="font-bold tracking-tight">ZUQEN</span>
          </button>

          <button
            onClick={() => (window.location.href = "/profile")}
            className="hidden rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-2 text-sm text-white/60 transition hover:bg-white/[0.07] hover:text-white sm:block"
          >
            My Purchases
          </button>
        </header>

        <div className="py-7">
          <div className="mb-7 flex flex-wrap items-center gap-2 text-xs text-white/35">
            <button
              onClick={() => (window.location.href = "/marketplace")}
              className="transition hover:text-white"
            >
              Marketplace
            </button>

            <ChevronRight className="h-3.5 w-3.5" />

            <span>{template.category}</span>

            <ChevronRight className="h-3.5 w-3.5" />

            <span className="truncate text-white/55">
              {template.name}
            </span>
          </div>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_420px]">
            <div>
              <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.025] shadow-2xl shadow-black/30">
                <div className="relative aspect-[16/10] overflow-hidden bg-black/20">
                  {currentImage ? (
                    <img
                      src={currentImage}
                      alt={template.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <GalleryPlaceholder name={template.name} />
                  )}

                  <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                    {template.featured && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-300/20 bg-violet-500/80 px-3 py-1.5 text-xs font-semibold backdrop-blur-md">
                        <Sparkles className="h-3.5 w-3.5" />
                        Featured
                      </span>
                    )}

                    {template.is_new && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-500/80 px-3 py-1.5 text-xs font-semibold backdrop-blur-md">
                        <Zap className="h-3.5 w-3.5" />
                        New
                      </span>
                    )}
                  </div>

                  {template.review_status === "approved" && (
                    <div className="absolute bottom-4 left-4">
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 text-xs font-medium backdrop-blur-md">
                        <ShieldCheck className="h-4 w-4 text-emerald-400" />
                        ZUQEN Verified
                      </span>
                    </div>
                  )}

                  {currentImage && galleryImages.length > 1 && (
                    <div className="absolute bottom-4 right-4 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 text-xs text-white/65 backdrop-blur-md">
                      {selectedImage + 1} / {galleryImages.length}
                    </div>
                  )}
                </div>
              </div>

              {galleryImages.length > 1 && (
                <div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-6">
                  {galleryImages.map((image, index) => (
                    <button
                      key={`${image}-${index}`}
                      onClick={() => setSelectedImage(index)}
                      className={`aspect-video overflow-hidden rounded-xl border transition ${
                        selectedImage === index
                          ? "border-white/40 ring-1 ring-white/20"
                          : "border-white/[0.07] opacity-60 hover:opacity-100"
                      }`}
                    >
                      <img
                        src={image}
                        alt={`${template.name} preview ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-10">
                <div className="flex items-center gap-3 border-b border-white/[0.07] pb-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04]">
                    <FileCode2 className="h-4 w-4 text-violet-300" />
                  </div>

                  <h2 className="text-lg font-semibold">
                    About this template
                  </h2>
                </div>

                <div className="mt-6 whitespace-pre-wrap text-sm leading-7 text-white/55">
                  {template.description || "No description provided."}
                </div>
              </div>

              {features.length > 0 && (
                <div className="mt-10">
                  <div className="flex items-center gap-3 border-b border-white/[0.07] pb-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04]">
                      <Check className="h-4 w-4 text-emerald-300" />
                    </div>

                    <h2 className="text-lg font-semibold">
                      Features
                    </h2>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {features.map((feature, index) => (
                      <div
                        key={`${feature}-${index}`}
                        className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] p-3.5"
                      >
                        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                          <Check className="h-3 w-3 text-emerald-400" />
                        </div>

                        <span className="text-sm text-white/55">
                          {feature}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {techStack.length > 0 && (
                <div className="mt-10">
                  <div className="flex items-center gap-3 border-b border-white/[0.07] pb-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04]">
                      <Code2 className="h-4 w-4 text-blue-300" />
                    </div>

                    <h2 className="text-lg font-semibold">
                      Tech stack
                    </h2>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {techStack.map((tech, index) => (
                      <span
                        key={`${tech}-${index}`}
                        className="rounded-lg border border-white/[0.07] bg-white/[0.035] px-3 py-2 text-xs font-medium text-white/55"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {requirements.length > 0 && (
                <div className="mt-10">
                  <div className="flex items-center gap-3 border-b border-white/[0.07] pb-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04]">
                      <Zap className="h-4 w-4 text-amber-300" />
                    </div>

                    <h2 className="text-lg font-semibold">
                      Requirements
                    </h2>
                  </div>

                  <ul className="mt-5 space-y-3">
                    {requirements.map((requirement, index) => (
                      <li
                        key={`${requirement}-${index}`}
                        className="flex gap-3 text-sm leading-6 text-white/50"
                      >
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white/30" />
                        {requirement}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {files.length > 0 && (
                <div className="mt-10">
                  <div className="flex items-center gap-3 border-b border-white/[0.07] pb-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04]">
                      <Download className="h-4 w-4 text-cyan-300" />
                    </div>

                    <h2 className="text-lg font-semibold">
                      Included files
                    </h2>
                  </div>

                  <div className="mt-5 overflow-hidden rounded-2xl border border-white/[0.07]">
                    {files.map((file, index) => (
                      <div
                        key={file.id}
                        className={`flex items-center justify-between gap-4 px-4 py-3.5 ${
                          index !== files.length - 1
                            ? "border-b border-white/[0.06]"
                            : ""
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <FileCode2 className="h-4 w-4 shrink-0 text-white/35" />

                          <div className="min-w-0">
                            <p className="truncate text-sm text-white/65">
                              {file.file_name}
                            </p>

                            {file.file_role && (
                              <p className="mt-0.5 text-[11px] text-white/30">
                                {file.file_role}
                              </p>
                            )}
                          </div>
                        </div>

                        <span className="shrink-0 text-xs text-white/30">
                          {formatFileSize(file.file_size)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <aside className="lg:sticky lg:top-6 lg:h-fit">
              <div className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-5 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-white/50">
                    {template.category}
                  </span>

                  {template.review_status === "approved" && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/10 bg-emerald-500/[0.07] px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Verified
                    </span>
                  )}
                </div>

                <h1 className="mt-5 text-2xl font-bold leading-tight tracking-[-0.025em] sm:text-3xl">
                  {template.name}
                </h1>

                <p className="mt-3 text-sm leading-6 text-white/45">
                  {template.short_description ||
                    template.description ||
                    "Professional template for your next project."}
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                  <span className="flex items-center gap-1.5 text-white/70">
                    <Star className="h-4 w-4 fill-current text-amber-400" />
                    {Number(template.average_rating || 0).toFixed(1)}
                  </span>

                  <span className="text-white/35">
                    {template.review_count || 0} reviews
                  </span>

                  <span className="text-white/35">
                    {template.sales_count || 0} sales
                  </span>
                </div>

                <div className="my-6 border-t border-white/[0.07]" />

                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs text-white/35">
                      Template price
                    </p>
                    <p className="mt-1 text-3xl font-bold tracking-tight">
                      {formatPrice(template.price, template.currency)}
                    </p>
                  </div>

                  <button
                    onClick={handleWishlist}
                    className={`flex h-11 w-11 items-center justify-center rounded-xl border transition ${
                      wishlist
                        ? "border-pink-400/20 bg-pink-500/10 text-pink-300"
                        : "border-white/[0.08] bg-white/[0.035] text-white/50 hover:bg-white/[0.07] hover:text-white"
                    }`}
                    aria-label="Wishlist"
                  >
                    <Heart
                      className={`h-5 w-5 ${
                        wishlist ? "fill-current" : ""
                      }`}
                    />
                  </button>
                </div>

                <button
                  onClick={handleBuy}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3.5 text-sm font-semibold text-black transition hover:bg-white/90"
                >
                  {Number(template.price || 0) > 0 ? (
                    <>
                      <ShoppingCart className="h-4 w-4" />
                      Buy Template
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Get Template
                    </>
                  )}
                </button>

                <p className="mt-3 text-center text-[11px] leading-5 text-white/30">
                  Secure access will be provided after purchase.
                  Paid files are not exposed through public permanent
                  URLs.
                </p>

                <div className="mt-5 space-y-3">
                  <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    <div>
                      <p className="text-xs font-medium text-white/70">
                        ZUQEN Verified
                      </p>
                      <p className="mt-0.5 text-[11px] text-white/30">
                        Marketplace review approved
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                    <Clock3 className="h-4 w-4 text-blue-400" />
                    <div>
                      <p className="text-xs font-medium text-white/70">
                        Future updates
                      </p>
                      <p className="mt-0.5 text-[11px] text-white/30">
                        Purchased versions remain accessible
                      </p>
                    </div>
                  </div>

                  {template.license && (
                    <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                      <FileCode2 className="h-4 w-4 text-violet-400" />
                      <div>
                        <p className="text-xs font-medium text-white/70">
                          License
                        </p>
                        <p className="mt-0.5 text-[11px] text-white/30">
                          {template.license}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 border-t border-white/[0.07] pt-5">
                  <p className="mb-3 text-xs font-medium text-white/35">
                    Template statistics
                  </p>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3 text-center">
                      <p className="text-sm font-semibold text-white/75">
                        {template.sales_count || 0}
                      </p>
                      <p className="mt-1 text-[10px] text-white/30">
                        Sales
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3 text-center">
                      <p className="text-sm font-semibold text-white/75">
                        {template.view_count || 0}
                      </p>
                      <p className="mt-1 text-[10px] text-white/30">
                        Views
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3 text-center">
                      <p className="text-sm font-semibold text-white/75">
                        {template.wishlist_count || 0}
                      </p>
                      <p className="mt-1 text-[10px] text-white/30">
                        Saves
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-3xl border border-white/[0.08] bg-white/[0.025] p-5">
                <p className="text-xs font-medium text-white/35">
                  Created by
                </p>

                {sellerLoading ? (
                  <div className="mt-4 flex items-center gap-3">
                    <div className="h-11 w-11 animate-pulse rounded-full bg-white/[0.06]" />
                    <div className="space-y-2">
                      <div className="h-3 w-28 animate-pulse rounded bg-white/[0.06]" />
                      <div className="h-2 w-20 animate-pulse rounded bg-white/[0.04]" />
                    </div>
                  </div>
                ) : (
                  <div className="mt-4">
                    <div className="flex items-center gap-3">
                      {seller?.avatar_url ? (
                        <img
                          src={seller.avatar_url}
                          alt={
                            seller.store_name ||
                            "Template creator"
                          }
                          className="h-11 w-11 rounded-full border border-white/10 object-cover"
                        />
                      ) : (
                        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-xs font-semibold text-white/60">
                          {getInitials(
                            seller?.store_name || "Creator"
                          ) || <User className="h-4 w-4" />}
                        </div>
                      )}

                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white/80">
                          {seller?.store_name || "ZUQEN Creator"}
                        </p>

                        <p className="mt-0.5 text-xs text-white/35">
                          {seller?.total_sales || 0} marketplace sales
                        </p>
                      </div>

                      {seller?.verified && (
                        <ShieldCheck className="ml-auto h-4 w-4 shrink-0 text-emerald-400" />
                      )}
                    </div>

                    {seller?.bio && (
                      <p className="mt-4 line-clamp-3 text-xs leading-5 text-white/40">
                        {seller.bio}
                      </p>
                    )}

                    {seller?.website_url && (
                      <a
                        href={seller.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-flex items-center gap-1.5 text-xs text-white/45 transition hover:text-white"
                      >
                        Creator website
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </aside>
          </div>

          <section className="mt-16 rounded-3xl border border-white/[0.07] bg-gradient-to-br from-white/[0.045] to-white/[0.02] p-6 sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-violet-300" />
                  <h2 className="text-lg font-semibold">
                    Build with confidence
                  </h2>
                </div>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/40">
                  ZUQEN marketplace listings go through marketplace
                  review before becoming publicly available. Purchased
                  templates can later receive version updates.
                </p>
              </div>

              <button
                onClick={() => (window.location.href = "/marketplace")}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm font-medium text-white/65 transition hover:bg-white/[0.08] hover:text-white"
              >
                Explore more
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}