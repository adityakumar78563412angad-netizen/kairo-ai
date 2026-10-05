
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock3,
  DollarSign,
  Edit3,
  Eye,
  FileText,
  Loader2,
  Plus,
  ShoppingBag,
  Store,
  Tag,
  Users,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
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
  seller_id: string;
  name: string;
  slug: string | null;
  category: string | null;
  price: number | null;
  currency: string | null;
  preview_image: string | null;
  status: string | null;
  review_status: string | null;
  sales_count: number | null;
  view_count: number | null;
  average_rating: number | null;
  review_count: number | null;
  created_at: string;
  updated_at: string;
};

type Purchase = {
  id: string;
  template_id: string;
  buyer_id: string;
  seller_id: string;
  amount: number | null;
  commission: number | null;
  seller_amount: number | null;
  payment_status: string | null;
  created_at: string;
};

const supabase = createClient();

function formatMoney(
  amount: number | null | undefined,
  currency = "INR"
) {
  const value = Number(amount || 0);

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function getStatusLabel(status: string | null) {
  if (!status) return "Draft";

  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getStatusClasses(status: string | null) {
  switch (status) {
    case "published":
    case "approved":
      return "border-emerald-400/20 bg-emerald-500/10 text-emerald-300";

    case "under_review":
    case "pending":
      return "border-amber-400/20 bg-amber-500/10 text-amber-300";

    case "rejected":
      return "border-red-400/20 bg-red-500/10 text-red-300";

    case "draft":
    default:
      return "border-white/10 bg-white/[0.04] text-zinc-400";
  }
}

export default function SellerDashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);

  const [filter, setFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
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
              "/marketplace/seller/dashboard"
            )}`
          );
          return;
        }

        const [sellerResult, templatesResult, purchasesResult] =
          await Promise.all([
            supabase
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
              .maybeSingle(),

            supabase
              .from("templates")
              .select(
                `
                  id,
                  seller_id,
                  name,
                  slug,
                  category,
                  price,
                  currency,
                  preview_image,
                  status,
                  review_status,
                  sales_count,
                  view_count,
                  average_rating,
                  review_count,
                  created_at,
                  updated_at
                `
              )
              .eq("seller_id", user.id)
              .order("updated_at", { ascending: false }),

            supabase
              .from("template_purchases")
              .select(
                `
                  id,
                  template_id,
                  buyer_id,
                  seller_id,
                  amount,
                  commission,
                  seller_amount,
                  payment_status,
                  created_at
                `
              )
              .eq("seller_id", user.id)
              .order("created_at", { ascending: false }),
          ]);

        if (sellerResult.error) throw sellerResult.error;
        if (templatesResult.error) throw templatesResult.error;
        if (purchasesResult.error) throw purchasesResult.error;

        if (cancelled) return;

        const sellerData = sellerResult.data as SellerProfile | null;

        if (!sellerData) {
          router.replace("/marketplace/seller");
          return;
        }

        setSeller(sellerData);
        setTemplates((templatesResult.data || []) as Template[]);
        setPurchases((purchasesResult.data || []) as Purchase[]);
      } catch (err) {
        console.error("Seller dashboard error:", err);

        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load your seller dashboard."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const successfulPurchases = useMemo(
    () =>
      purchases.filter((purchase) => {
        const status = (purchase.payment_status || "").toLowerCase();

        return [
          "paid",
          "completed",
          "succeeded",
          "success",
        ].includes(status);
      }),
    [purchases]
  );

  const stats = useMemo(() => {
    const totalSales = successfulPurchases.length;

    const uniqueBuyers = new Set(
      successfulPurchases.map((purchase) => purchase.buyer_id)
    ).size;

    const gross = successfulPurchases.reduce(
      (sum, purchase) => sum + Number(purchase.amount || 0),
      0
    );

    const commission = successfulPurchases.reduce(
      (sum, purchase) => sum + Number(purchase.commission || 0),
      0
    );

    const sellerRevenue = successfulPurchases.reduce(
      (sum, purchase) => sum + Number(purchase.seller_amount || 0),
      0
    );

    const totalViews = templates.reduce(
      (sum, template) => sum + Number(template.view_count || 0),
      0
    );

    const published = templates.filter(
      (template) =>
        template.status === "published" &&
        template.review_status === "approved"
    ).length;

    const drafts = templates.filter(
      (template) => template.status === "draft"
    ).length;

    const underReview = templates.filter(
      (template) =>
        template.status === "under_review" ||
        template.review_status === "pending"
    ).length;

    const rejected = templates.filter(
      (template) =>
        template.status === "rejected" ||
        template.review_status === "rejected"
    ).length;

    return {
      totalTemplates: templates.length,
      published,
      drafts,
      underReview,
      rejected,
      totalSales,
      uniqueBuyers,
      gross,
      commission,
      sellerRevenue,
      totalViews,
    };
  }, [templates, successfulPurchases]);

  const filteredTemplates = useMemo(() => {
    if (filter === "all") return templates;

    if (filter === "published") {
      return templates.filter(
        (template) =>
          template.status === "published" &&
          template.review_status === "approved"
      );
    }

    if (filter === "draft") {
      return templates.filter(
        (template) => template.status === "draft"
      );
    }

    if (filter === "under_review") {
      return templates.filter(
        (template) =>
          template.status === "under_review" ||
          template.review_status === "pending"
      );
    }

    if (filter === "rejected") {
      return templates.filter(
        (template) =>
          template.status === "rejected" ||
          template.review_status === "rejected"
      );
    }

    return templates;
  }, [filter, templates]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050505] text-white">
        <div className="flex min-h-screen items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-zinc-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading seller dashboard...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <button
              type="button"
              onClick={() =>
                router.push("/marketplace/seller?edit=true")
              }
              className="mb-4 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Seller Profile
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-500/10">
                <Store className="h-6 w-6 text-violet-300" />
              </div>

              <div>
                <h1 className="text-2xl font-bold sm:text-3xl">
                  Seller Dashboard
                </h1>

                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
                  <span>
                    {seller?.display_name || "Seller"}
                  </span>

                  {seller?.username && (
                    <>
                      <span>•</span>
                      <span>@{seller.username}</span>
                    </>
                  )}

                  {seller?.is_verified && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" />
                      Verified
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() =>
                router.push("/marketplace/seller?edit=true")
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.07] hover:text-white"
            >
              <Edit3 className="h-4 w-4" />
              Edit Seller Profile
            </button>

            <button
              type="button"
              onClick={() =>
                router.push("/marketplace/seller/create")
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200"
            >
              <Plus className="h-4 w-4" />
              Create Template
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm text-zinc-500">
                Templates
              </span>
              <FileText className="h-5 w-5 text-zinc-600" />
            </div>

            <p className="text-2xl font-bold">
              {stats.totalTemplates}
            </p>

            <p className="mt-1 text-xs text-zinc-600">
              {stats.published} published · {stats.drafts} drafts
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm text-zinc-500">
                Total Sales
              </span>
              <ShoppingBag className="h-5 w-5 text-zinc-600" />
            </div>

            <p className="text-2xl font-bold">
              {stats.totalSales}
            </p>

            <p className="mt-1 text-xs text-zinc-600">
              {stats.uniqueBuyers} unique buyers
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm text-zinc-500">
                Seller Revenue
              </span>
              <DollarSign className="h-5 w-5 text-zinc-600" />
            </div>

            <p className="text-2xl font-bold">
              {formatMoney(stats.sellerRevenue)}
            </p>

            <p className="mt-1 text-xs text-zinc-600">
              After 20% ZUQEN commission
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm text-zinc-500">
                Total Views
              </span>
              <Eye className="h-5 w-5 text-zinc-600" />
            </div>

            <p className="text-2xl font-bold">
              {stats.totalViews.toLocaleString("en-IN")}
            </p>

            <p className="mt-1 text-xs text-zinc-600">
              Across all your templates
            </p>
          </div>
        </section>

        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <div>
                <p className="text-xs text-zinc-600">Published</p>
                <p className="text-xl font-semibold">
                  {stats.published}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-center gap-3">
              <Clock3 className="h-5 w-5 text-amber-400" />
              <div>
                <p className="text-xs text-zinc-600">
                  Under Review
                </p>
                <p className="text-xl font-semibold">
                  {stats.underReview}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-zinc-400" />
              <div>
                <p className="text-xs text-zinc-600">Drafts</p>
                <p className="text-xl font-semibold">
                  {stats.drafts}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-center gap-3">
              <XCircle className="h-5 w-5 text-red-400" />
              <div>
                <p className="text-xs text-zinc-600">Rejected</p>
                <p className="text-xl font-semibold">
                  {stats.rejected}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025]">
          <div className="flex flex-col gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Your Templates
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Your templates remain listed here even after they receive
                purchases.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                ["all", "All"],
                ["published", "Published"],
                ["draft", "Drafts"],
                ["under_review", "Review"],
                ["rejected", "Rejected"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`rounded-xl px-3 py-2 text-xs font-medium transition ${
                    filter === value
                      ? "bg-white text-black"
                      : "border border-white/10 bg-white/[0.03] text-zinc-500 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {filteredTemplates.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04]">
                <FileText className="h-6 w-6 text-zinc-600" />
              </div>

              <h3 className="font-semibold">
                {templates.length === 0
                  ? "No templates yet"
                  : "No templates in this filter"}
              </h3>

              <p className="mt-2 max-w-md text-sm leading-6 text-zinc-600">
                {templates.length === 0
                  ? "Create your first template and start building your marketplace catalog."
                  : "Try another status filter."}
              </p>

              {templates.length === 0 && (
                <button
                  type="button"
                  onClick={() =>
                    router.push("/marketplace/seller/create")
                  }
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black"
                >
                  <Plus className="h-4 w-4" />
                  Create Template
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {filteredTemplates.map((template) => {
                const templateSales = successfulPurchases.filter(
                  (purchase) =>
                    purchase.template_id === template.id
                );

                const templateRevenue = templateSales.reduce(
                  (sum, purchase) =>
                    sum + Number(purchase.seller_amount || 0),
                  0
                );

                const uniqueTemplateBuyers = new Set(
                  templateSales.map((purchase) => purchase.buyer_id)
                ).size;

                return (
                  <div
                    key={template.id}
                    className="p-5 transition hover:bg-white/[0.02]"
                  >
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                      <div className="flex min-w-0 gap-4">
                        <div className="h-20 w-28 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/30">
                          {template.preview_image ? (
                            <img
                              src={template.preview_image}
                              alt={template.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <FileText className="h-6 w-6 text-zinc-700" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate font-semibold">
                              {template.name}
                            </h3>

                            <span
                              className={`rounded-full border px-2 py-0.5 text-[11px] ${getStatusClasses(
                                template.review_status === "approved"
                                  ? template.status
                                  : template.review_status
                              )}`}
                            >
                              {getStatusLabel(
                                template.review_status === "approved"
                                  ? template.status
                                  : template.review_status
                              )}
                            </span>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-600">
                            {template.category && (
                              <span className="inline-flex items-center gap-1">
                                <Tag className="h-3 w-3" />
                                {template.category}
                              </span>
                            )}

                            <span>
                              Updated {formatDate(template.updated_at)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[500px]">
                        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                          <p className="text-[11px] text-zinc-600">
                            Sales
                          </p>
                          <p className="mt-1 font-semibold">
                            {templateSales.length}
                          </p>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                          <p className="text-[11px] text-zinc-600">
                            Buyers
                          </p>
                          <p className="mt-1 font-semibold">
                            {uniqueTemplateBuyers}
                          </p>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                          <p className="text-[11px] text-zinc-600">
                            Views
                          </p>
                          <p className="mt-1 font-semibold">
                            {Number(
                              template.view_count || 0
                            ).toLocaleString("en-IN")}
                          </p>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                          <p className="text-[11px] text-zinc-600">
                            Revenue
                          </p>
                          <p className="mt-1 font-semibold">
                            {formatMoney(
                              templateRevenue,
                              template.currency || "INR"
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            router.push(
                              `/marketplace/seller/create?template=${encodeURIComponent(
                                template.id
                              )}`
                            )
                          }
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-white/[0.07] hover:text-white"
                        >
                          <Edit3 className="h-4 w-4" />
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            router.push(
                              `/marketplace/template/${
                                template.slug || template.id
                              }`
                            )
                          }
                          className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-zinc-400 transition hover:text-white"
                          aria-label={`View ${template.name}`}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.025]">
            <div className="border-b border-white/10 p-5">
              <div className="flex items-center gap-3">
                <ShoppingBag className="h-5 w-5 text-zinc-500" />
                <div>
                  <h2 className="font-semibold">Recent Sales</h2>
                  <p className="mt-1 text-xs text-zinc-600">
                    Successful purchases associated with your templates.
                  </p>
                </div>
              </div>
            </div>

            {successfulPurchases.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-600">
                No successful sales yet.
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {successfulPurchases
                  .slice(0, 8)
                  .map((purchase) => {
                    const template = templates.find(
                      (item) => item.id === purchase.template_id
                    );

                    return (
                      <div
                        key={purchase.id}
                        className="flex items-center justify-between gap-4 p-5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {template?.name || "Template"}
                          </p>

                          <p className="mt-1 text-xs text-zinc-600">
                            {formatDate(purchase.created_at)}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-sm font-semibold text-emerald-300">
                            +
                            {formatMoney(
                              purchase.seller_amount,
                              template?.currency || "INR"
                            )}
                          </p>

                          <p className="mt-1 text-[11px] text-zinc-600">
                            Seller share
                          </p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-5">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-5 w-5 text-zinc-500" />
                <h2 className="font-semibold">Revenue Summary</h2>
              </div>

              <div className="mt-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">
                    Gross sales
                  </span>
                  <span className="font-medium">
                    {formatMoney(stats.gross)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">
                    ZUQEN commission
                  </span>
                  <span className="font-medium text-zinc-400">
                    -{formatMoney(stats.commission)}
                  </span>
                </div>

                <div className="border-t border-white/10 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-400">
                      Seller revenue
                    </span>
                    <span className="text-lg font-bold text-emerald-300">
                      {formatMoney(stats.sellerRevenue)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-violet-400/15 bg-violet-500/[0.05] p-5">
              <h3 className="font-semibold text-violet-100">
                Keep building
              </h3>

              <p className="mt-2 text-sm leading-6 text-violet-100/50">
                Add more high-quality templates, complete your previews and
                media, and submit them for marketplace verification.
              </p>

              <button
                type="button"
                onClick={() =>
                  router.push("/marketplace/seller/create")
                }
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black"
              >
                <Plus className="h-4 w-4" />
                New Template
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

