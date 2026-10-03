"use client";

import { useEffect, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase";

import {
  ArrowRight,
  Check,
  Clock3,
  Code2,
  Grid3X3,
  Heart,
  Layers3,
  LayoutTemplate,
  Menu,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
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
  average_rating: number;
  review_count: number;
  sales_count: number;
  view_count: number;
  wishlist_count: number;
  tech_stack: string[] | null;
  features: string[] | null;
  created_at: string;
};

type Category = {
  name: string;
  icon: typeof LayoutTemplate;
};

const CATEGORIES: Category[] = [
  { name: "All Templates", icon: Grid3X3 },
  { name: "Website", icon: LayoutTemplate },
  { name: "Landing Page", icon: Layers3 },
  { name: "SaaS", icon: Zap },
  { name: "Dashboard", icon: TrendingUp },
  { name: "E-commerce", icon: Code2 },
  { name: "Portfolio", icon: Sparkles },
  { name: "AI", icon: Sparkles },
  { name: "Admin Panel", icon: Grid3X3 },
  { name: "Mobile", icon: Layers3 },
  { name: "UI Kit", icon: LayoutTemplate },
  { name: "Components", icon: Code2 },
];

const CATEGORY_GRADIENTS = [
  "from-violet-500/25 via-fuchsia-500/10 to-transparent",
  "from-blue-500/25 via-cyan-500/10 to-transparent",
  "from-emerald-500/25 via-teal-500/10 to-transparent",
  "from-orange-500/25 via-amber-500/10 to-transparent",
];

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

function getTemplateImage(template: Template) {
  return template.preview_image || null;
}

function normalizeCategory(value: string) {
  return value.trim().toLowerCase();
}

function matchesCategory(template: Template, selectedCategory: string) {
  if (selectedCategory === "All Templates") return true;

  return (
    normalizeCategory(template.category) ===
    normalizeCategory(selectedCategory)
  );
}

function TemplateCard({
  template,
  onWishlist,
}: {
  template: Template;
  onWishlist: (id: string) => void;
}) {
  const image = getTemplateImage(template);

  return (
    <article
      onClick={() => {
        window.location.href = `/marketplace/template/${
          template.slug || template.id
        }`;
      }}
      className="group cursor-pointer overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.035] transition-all duration-300 hover:-translate-y-1 hover:border-white/[0.16] hover:bg-white/[0.055] hover:shadow-2xl hover:shadow-black/30"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-white/[0.06] to-white/[0.015]">
        {image ? (
          <img
            src={image}
            alt={template.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div
            className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${
              CATEGORY_GRADIENTS[
                Math.abs(template.name.length) % CATEGORY_GRADIENTS.length
              ]
            }`}
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-black/20 backdrop-blur-xl">
              <LayoutTemplate className="h-7 w-7 text-white/70" />
            </div>
          </div>
        )}

        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
          <div className="flex items-center gap-2">
            {template.featured && (
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-300/20 bg-violet-500/80 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
                <Sparkles className="h-3 w-3" />
                Featured
              </span>
            )}

            {template.is_new && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/20 bg-emerald-500/80 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
                <Zap className="h-3 w-3" />
                New
              </span>
            )}
          </div>

          <button
            onClick={(event) => {
              event.stopPropagation();
              onWishlist(template.id);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white/80 backdrop-blur-md transition hover:bg-black/60 hover:text-white"
            aria-label="Add to wishlist"
          >
            <Heart className="h-4 w-4" />
          </button>
        </div>

        <div className="absolute bottom-3 left-3">
          {template.review_status === "approved" && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              ZUQEN Verified
            </span>
          )}
        </div>
      </div>

      <div className="p-4">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-semibold text-white">
              {template.name}
            </h3>

            <p className="mt-1 truncate text-xs text-white/45">
              {template.category}
            </p>
          </div>

          <div className="shrink-0 rounded-lg border border-white/[0.08] bg-white/[0.045] px-2.5 py-1.5 text-sm font-semibold text-white">
            {formatPrice(template.price, template.currency)}
          </div>
        </div>

        <p className="mb-4 line-clamp-2 min-h-[34px] text-xs leading-5 text-white/50">
          {template.short_description ||
            template.description ||
            "Professional template ready to use."}
        </p>

        <div className="flex items-center justify-between border-t border-white/[0.07] pt-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-white/65">
              <Star className="h-3.5 w-3.5 fill-current text-amber-400" />
              {Number(template.average_rating || 0).toFixed(1)}
            </span>

            <span className="text-white/35">
              {template.review_count || 0} reviews
            </span>
          </div>

          <span className="text-white/35">
            {template.sales_count || 0} sales
          </span>
        </div>
      </div>
    </article>
  );
}

function Section({
  title,
  subtitle,
  icon,
  templates,
  onWishlist,
  onViewAll,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  templates: Template[];
  onWishlist: (id: string) => void;
  onViewAll?: () => void;
}) {
  if (!templates.length) return null;

  return (
    <section className="mb-14">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04]">
              {icon}
            </span>

            <h2 className="text-xl font-semibold tracking-tight">
              {title}
            </h2>
          </div>

          <p className="text-sm text-white/40">{subtitle}</p>
        </div>

        {onViewAll && (
          <button
            onClick={onViewAll}
            className="hidden items-center gap-1.5 text-sm font-medium text-white/55 transition hover:text-white sm:flex"
          >
            View all
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {templates.slice(0, 4).map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onWishlist={onWishlist}
          />
        ))}
      </div>
    </section>
  );
}

export default function MarketplacePage() {
  const supabase = useMemo(() => createClient(), []);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedCategory, setSelectedCategory] =
    useState("All Templates");
  const [search, setSearch] = useState("");
  const [mobileCategoriesOpen, setMobileCategoriesOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadTemplates() {
      setLoading(true);
      setError("");

      const { data, error: queryError } = await supabase
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
            average_rating,
            review_count,
            sales_count,
            view_count,
            wishlist_count,
            tech_stack,
            features,
            created_at
          `
        )
        .eq("status", "published")
        .eq("review_status", "approved")
        .order("featured", { ascending: false })
        .order("created_at", { ascending: false });

      if (!mounted) return;

      if (queryError) {
        console.error("Marketplace templates error:", queryError);
        setError("Templates load nahi ho paaye. Please try again.");
        setTemplates([]);
      } else {
        setTemplates((data || []) as Template[]);
      }

      setLoading(false);
    }

    loadTemplates();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  const filteredTemplates = useMemo(() => {
    const query = search.trim().toLowerCase();

    return templates.filter((template) => {
      const categoryMatch = matchesCategory(
        template,
        selectedCategory
      );

      if (!categoryMatch) return false;

      if (!query) return true;

      const searchable = [
        template.name,
        template.category,
        template.description,
        template.short_description || "",
        ...(template.tech_stack || []),
        ...(template.features || []),
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [templates, search, selectedCategory]);

  const featured = filteredTemplates.filter((t) => t.featured);

  const popular = [...filteredTemplates]
    .sort(
      (a, b) =>
        Number(b.sales_count || 0) - Number(a.sales_count || 0)
    )
    .slice(0, 4);

  const newest = [...filteredTemplates]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
    )
    .slice(0, 4);

  const free = filteredTemplates
    .filter((t) => Number(t.price || 0) <= 0)
    .slice(0, 4);

  const paid = filteredTemplates
    .filter((t) => Number(t.price || 0) > 0)
    .slice(0, 4);

  function handleWishlist(id: string) {
    window.location.href = `/marketplace/template/${id}?wishlist=true`;
  }

  function clearFilters() {
    setSearch("");
    setSelectedCategory("All Templates");
  }

  function handleStartSelling() {
    window.location.href = "/marketplace/seller";
  }

  return (
    <main className="min-h-screen bg-[#07070a] text-white">
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute left-1/2 top-[-240px] h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-violet-600/[0.10] blur-[140px]" />

        <div className="absolute right-[-180px] top-[520px] h-[420px] w-[420px] rounded-full bg-blue-500/[0.06] blur-[130px]" />

        <div className="absolute left-[-180px] top-[900px] h-[420px] w-[420px] rounded-full bg-fuchsia-500/[0.05] blur-[130px]" />
      </div>

      <div className="mx-auto max-w-[1500px] px-4 pb-20 sm:px-6 lg:px-8">
        <header className="pt-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => (window.location.href = "/")}
              className="group flex items-center gap-2.5"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] shadow-lg shadow-violet-950/20">
                <Sparkles className="h-4.5 w-4.5 text-violet-300" />
              </div>

              <span className="text-lg font-bold tracking-tight">
                ZUQEN
              </span>
            </button>

            <div className="hidden items-center gap-3 sm:flex">
              <button
                onClick={() => (window.location.href = "/profile")}
                className="rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/[0.07] hover:text-white"
              >
                My Purchases
              </button>

              <button
                onClick={handleStartSelling}
                className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
              >
                Sell a Template
              </button>
            </div>

            <button
              onClick={() =>
                setMobileCategoriesOpen((value) => !value)
              }
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] sm:hidden"
            >
              {mobileCategoriesOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </header>

        <section className="mx-auto max-w-4xl pb-12 pt-20 text-center sm:pt-24">
          <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-violet-400/15 bg-violet-500/[0.08] px-3.5 py-1.5 text-xs font-medium text-violet-200">
            <Sparkles className="h-3.5 w-3.5" />
            The ZUQEN Template Marketplace
          </div>

          <h1 className="text-4xl font-bold tracking-[-0.04em] text-white sm:text-6xl lg:text-7xl">
            Build faster.
            <br />
            <span className="bg-gradient-to-r from-white via-white/90 to-white/45 bg-clip-text text-transparent">
              Start with something great.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-sm leading-6 text-white/45 sm:text-base">
            Discover premium templates, production-ready interfaces,
            dashboards, websites and digital products created for
            builders who want to move faster.
          </p>

          <div className="mx-auto mt-8 max-w-2xl">
            <div className="group flex items-center rounded-2xl border border-white/[0.10] bg-white/[0.055] p-1.5 shadow-2xl shadow-black/30 backdrop-blur-xl transition focus-within:border-violet-400/30 focus-within:bg-white/[0.07]">
              <Search className="ml-3.5 h-5 w-5 shrink-0 text-white/35 transition group-focus-within:text-violet-300" />

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search templates, dashboards, SaaS, AI..."
                className="min-w-0 flex-1 bg-transparent px-3 py-3.5 text-sm text-white outline-none placeholder:text-white/30 sm:text-base"
              />

              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="mr-1 flex h-8 w-8 items-center justify-center rounded-lg text-white/35 hover:bg-white/[0.07] hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}

              <button
                onClick={() => {
                  const element =
                    document.getElementById(
                      "marketplace-content"
                    );

                  element?.scrollIntoView({
                    behavior: "smooth",
                  });
                }}
                className="hidden rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90 sm:block"
              >
                Search
              </button>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white/80">
                Explore categories
              </h2>

              <p className="mt-1 text-xs text-white/35">
                Find the right starting point for your next project.
              </p>
            </div>

            <button
              onClick={() =>
                setMobileCategoriesOpen((value) => !value)
              }
              className="text-xs text-white/40 hover:text-white sm:hidden"
            >
              {mobileCategoriesOpen ? "Hide" : "View all"}
            </button>
          </div>

          <div
            className={`${
              mobileCategoriesOpen ? "flex" : "hidden"
            } flex-wrap gap-2 sm:flex`}
          >
            {CATEGORIES.map((category) => {
              const Icon = category.icon;
              const active = selectedCategory === category.name;

              return (
                <button
                  key={category.name}
                  onClick={() => {
                    setSelectedCategory(category.name);
                    setMobileCategoriesOpen(false);

                    setTimeout(() => {
                      document
                        .getElementById("marketplace-content")
                        ?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                    }, 50);
                  }}
                  className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-medium transition ${
                    active
                      ? "border-white/15 bg-white text-black shadow-lg shadow-white/5"
                      : "border-white/[0.07] bg-white/[0.025] text-white/50 hover:border-white/[0.13] hover:bg-white/[0.05] hover:text-white"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {category.name}
                </button>
              );
            })}
          </div>
        </section>

        <div id="marketplace-content">
          {loading ? (
            <div className="space-y-12">
              {[1, 2].map((section) => (
                <section key={section}>
                  <div className="mb-5">
                    <div className="h-5 w-40 animate-pulse rounded bg-white/[0.06]" />
                    <div className="mt-2 h-3 w-64 animate-pulse rounded bg-white/[0.04]" />
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {[1, 2, 3, 4].map((card) => (
                      <div
                        key={card}
                        className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.025]"
                      >
                        <div className="aspect-[16/10] animate-pulse bg-white/[0.045]" />

                        <div className="space-y-3 p-4">
                          <div className="h-4 w-2/3 animate-pulse rounded bg-white/[0.06]" />
                          <div className="h-3 w-full animate-pulse rounded bg-white/[0.04]" />
                          <div className="h-3 w-1/2 animate-pulse rounded bg-white/[0.04]" />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : error ? (
            <div className="rounded-3xl border border-red-400/10 bg-red-500/[0.04] px-6 py-16 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-red-400/10 bg-red-500/[0.08]">
                <X className="h-5 w-5 text-red-300" />
              </div>

              <h2 className="text-lg font-semibold text-white">
                Something went wrong
              </h2>

              <p className="mt-2 text-sm text-white/40">
                {error}
              </p>

              <button
                onClick={() => window.location.reload()}
                className="mt-6 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black"
              >
                Try again
              </button>
            </div>
          ) : !filteredTemplates.length ? (
            <div className="rounded-3xl border border-white/[0.07] bg-white/[0.025] px-6 py-20 text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04]">
                <Search className="h-6 w-6 text-white/40" />
              </div>

              <h2 className="text-xl font-semibold text-white">
                No templates found
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/40">
                Try another search or choose a different category.
                New templates will appear here once they are approved
                for the marketplace.
              </p>

              <button
                onClick={clearFilters}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black"
              >
                Clear filters
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              {search || selectedCategory !== "All Templates" ? (
                <section className="mb-14">
                  <div className="mb-5 flex items-end justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-semibold">
                          Search results
                        </h2>

                        <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[11px] text-white/45">
                          {filteredTemplates.length}
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-white/40">
                        {selectedCategory !== "All Templates"
                          ? selectedCategory
                          : "All marketplace templates"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {filteredTemplates.map((template) => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        onWishlist={handleWishlist}
                      />
                    ))}
                  </div>
                </section>
              ) : (
                <>
                  <Section
                    title="Featured templates"
                    subtitle="Hand-picked marketplace templates worth exploring."
                    icon={
                      <Sparkles className="h-4 w-4 text-violet-300" />
                    }
                    templates={featured}
                    onWishlist={handleWishlist}
                  />

                  <Section
                    title="Popular right now"
                    subtitle="Templates getting the most attention from builders."
                    icon={
                      <TrendingUp className="h-4 w-4 text-orange-300" />
                    }
                    templates={popular}
                    onWishlist={handleWishlist}
                  />

                  <Section
                    title="Fresh arrivals"
                    subtitle="Recently published templates on ZUQEN."
                    icon={
                      <Clock3 className="h-4 w-4 text-blue-300" />
                    }
                    templates={newest}
                    onWishlist={handleWishlist}
                  />

                  <Section
                    title="Free templates"
                    subtitle="Start building without spending anything."
                    icon={
                      <Check className="h-4 w-4 text-emerald-300" />
                    }
                    templates={free}
                    onWishlist={handleWishlist}
                  />

                  <Section
                    title="Premium templates"
                    subtitle="Production-ready templates from creators."
                    icon={
                      <Zap className="h-4 w-4 text-amber-300" />
                    }
                    templates={paid}
                    onWishlist={handleWishlist}
                  />
                </>
              )}
            </>
          )}
        </div>

        <section className="mt-20 overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-white/[0.06] via-white/[0.025] to-violet-500/[0.05]">
          <div className="relative px-6 py-12 sm:px-10 sm:py-16">
            <div className="absolute right-[-100px] top-[-120px] h-72 w-72 rounded-full bg-violet-500/[0.12] blur-[100px]" />

            <div className="relative max-w-2xl">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05]">
                <Code2 className="h-5 w-5 text-violet-300" />
              </div>

              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Have something worth building?
              </h2>

              <p className="mt-3 max-w-xl text-sm leading-6 text-white/45">
                Turn your templates into products and reach builders
                through the ZUQEN marketplace.
              </p>

              <button
                onClick={handleStartSelling}
                className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
              >
                Start selling
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        <footer className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/[0.06] pt-7 text-xs text-white/30 sm:flex-row">
          <div>© {new Date().getFullYear()} ZUQEN AI</div>

          <div className="flex items-center gap-5">
            <button
              onClick={() => (window.location.href = "/")}
              className="transition hover:text-white/60"
            >
              ZUQEN AI
            </button>

            <button
              onClick={handleStartSelling}
              className="transition hover:text-white/60"
            >
              Sell Templates
            </button>

            <button
              onClick={() => (window.location.href = "/profile")}
              className="transition hover:text-white/60"
            >
              My Purchases
            </button>
          </div>
        </footer>
      </div>
    </main>
  );
}