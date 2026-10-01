"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Clock3,
  DollarSign,
  Eye,
  FileEdit,
  Loader2,
  Plus,
  ShoppingBag,
  Store,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase";

type Template = {
  id: string;
  name: string;
  slug: string | null;
  category: string;
  price: number;
  currency: string | null;
  preview_image: string | null;
  status: string;
  review_status: string | null;
  featured: boolean;
  is_new: boolean;
  average_rating: number | null;
  review_count: number | null;
  sales_count: number | null;
  view_count: number | null;
  created_at: string;
  updated_at: string;
};

type Purchase = {
  id: string;
  template_id: string;
  buyer_id: string;
  seller_id: string | null;
  amount: number;
  commission: number;
  seller_amount: number;
  payment_status: string;
  refunded_at: string | null;
  created_at: string;
};

type SellerProfile = {
  id: string;
  user_id: string;
  display_name: string | null;
  username: string | null;
  seller_status: string | null;
  is_verified: boolean | null;
};

type DashboardTemplate = Template & {
  buyerCount: number;
  successfulSales: number;
  grossRevenue: number;
  sellerRevenue: number;
};

const supabase = createClient();

function formatCurrency(amount: number, currency = "INR") {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `₹${amount.toLocaleString("en-IN", {
      maximumFractionDigits: 2,
    })}`;
  }
}

function normalizeStatus(status: string | null | undefined) {
  return (status || "").toLowerCase();
}

function isSuccessfulPurchase(purchase: Purchase) {
  const status = normalizeStatus(purchase.payment_status);

  return (
    ["paid", "completed", "succeeded", "success"].includes(status) &&
    !purchase.refunded_at
  );
}

function getTemplateStatus(template: Template) {
  const status = normalizeStatus(template.status);
  const reviewStatus = normalizeStatus(template.review_status);

  if (status === "published" && reviewStatus === "approved") {
    return {
      label: "Published",
      icon: CheckCircle2,
      className:
        "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    };
  }

  if (
    reviewStatus === "pending" ||
    status === "pending_review" ||
    status === "under_review"
  ) {
    return {
      label: "Under Review",
      icon: Clock3,
      className: "border-amber-500/20 bg-amber-500/10 text-amber-300",
    };
  }

  if (reviewStatus === "rejected" || status === "rejected") {
    return {
      label: "Rejected",
      icon: XCircle,
      className: "border-red-500/20 bg-red-500/10 text-red-300",
    };
  }

  if (status === "draft") {
    return {
      label: "Draft",
      icon: FileEdit,
      className: "border-white/10 bg-white/[0.05] text-zinc-300",
    };
  }

  if (status === "unpublished") {
    return {
      label: "Unpublished",
      icon: Store,
      className: "border-zinc-500/20 bg-zinc-500/10 text-zinc-400",
    };
  }

  return {
    label: template.status || "Unknown",
    icon: Store,
    className: "border-white/10 bg-white/[0.05] text-zinc-300",
  };
}

export default function SellerDashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");

  const [sellerProfile, setSellerProfile] =
    useState<SellerProfile | null>(null);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);

  const [error, setError] = useState("");

  const [filter, setFilter] = useState<
    "all" | "published" | "draft" | "review" | "rejected"
  >("all");

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
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
          router.push("/login?redirect=/marketplace/seller/dashboard");
          return;
        }

        if (!mounted) return;

        setUserId(user.id);

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
                  name,
                  slug,
                  category,
                  price,
                  currency,
                  preview_image,
                  status,
                  review_status,
                  featured,
                  is_new,
                  average_rating,
                  review_count,
                  sales_count,
                  view_count,
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
                  refunded_at,
                  created_at
                `
              )
              .eq("seller_id", user.id)
              .order("created_at", { ascending: false }),
          ]);

        if (sellerResult.error) {
          throw sellerResult.error;
        }

        if (templatesResult.error) {
          throw templatesResult.error;
        }

        if (purchasesResult.error) {
          throw purchasesResult.error;
        }

        if (!mounted) return;

        setSellerProfile(sellerResult.data as SellerProfile | null);
        setTemplates((templatesResult.data || []) as Template[]);
        setPurchases((purchasesResult.data || []) as Purchase[]);
      } catch (err) {
        console.error("Failed to load seller dashboard:", err);

        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load seller dashboard."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      mounted = false;
    };
  }, [router]);

  const successfulPurchases = useMemo(
    () => purchases.filter(isSuccessfulPurchase),
    [purchases]
  );

  const dashboardTemplates = useMemo<DashboardTemplate[]>(() => {
    return templates.map((template) => {
      const templatePurchases = successfulPurchases.filter(
        (purchase) => purchase.template_id === template.id
      );

      const buyerIds = new Set(
        templatePurchases
          .map((purchase) => purchase.buyer_id)
          .filter(Boolean)
      );

      const grossRevenue = templatePurchases.reduce(
        (total, purchase) => total + Number(purchase.amount || 0),
        0
      );

      const sellerRevenue = templatePurchases.reduce(
        (total, purchase) => total + Number(purchase.seller_amount || 0),
        0
      );

      return {
        ...template,
        buyerCount: buyerIds.size,
        successfulSales: templatePurchases.length,
        grossRevenue,
        sellerRevenue,
      };
    });
  }, [templates, successfulPurchases]);

  const stats = useMemo(() => {
    const published = templates.filter(
      (template) =>
        normalizeStatus(template.status) === "published" &&
        normalizeStatus(template.review_status) === "approved"
    ).length;

    const drafts = templates.filter(
      (template) => normalizeStatus(template.status) === "draft"
    ).length;

    const underReview = templates.filter((template) => {
      const status = normalizeStatus(template.status);
      const review = normalizeStatus(template.review_status);

      return (
        status === "pending_review" ||
        status === "under_review" ||
        review === "pending"
      );
    }).length;

    const rejected = templates.filter((template) => {
      const status = normalizeStatus(template.status);
      const review = normalizeStatus(template.review_status);

      return status === "rejected" || review === "rejected";
    }).length;

    const grossRevenue = successfulPurchases.reduce(
      (total, purchase) => total + Number(purchase.amount || 0),
      0
    );

    const commission = successfulPurchases.reduce(
      (total, purchase) => total + Number(purchase.commission || 0),
      0
    );

    const sellerRevenue = successfulPurchases.reduce(
      (total, purchase) => total + Number(purchase.seller_amount || 0),
      0
    );

    const buyers = new Set(
      successfulPurchases
        .map((purchase) => purchase.buyer_id)
        .filter(Boolean)
    );

    const views = templates.reduce(
      (total, template) => total + Number(template.view_count || 0),
      0
    );

    return {
      totalTemplates: templates.length,
      published,
      drafts,
      underReview,
      rejected,
      sales: successfulPurchases.length,
      buyers: buyers.size,
      grossRevenue,
      commission,
      sellerRevenue,
      views,
    };
  }, [templates, successfulPurchases]);

  const filteredTemplates = useMemo(() => {
    if (filter === "all") {
      return dashboardTemplates;
    }

    return dashboardTemplates.filter((template) => {
      const status = normalizeStatus(template.status);
      const review = normalizeStatus(template.review_status);

      if (filter === "published") {
        return status === "published" && review === "approved";
      }

      if (filter === "draft") {
        return status === "draft";
      }

      if (filter === "review") {
        return (
          status === "pending_review" ||
          status === "under_review" ||
          review === "pending"
        );
      }

      if (filter === "rejected") {
        return status === "rejected" || review === "rejected";
      }

      return true;
    });
  }, [dashboardTemplates, filter]);

  const recentSales = useMemo(
    () => successfulPurchases.slice(0, 8),
    [successfulPurchases]
  );

  const templateNameById = useMemo(() => {
    return new Map(templates.map((template) => [template.id, template.name]));
  }, [templates]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#07090d] text-white">
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
    <main className="min-h-screen bg-[#07090d] text-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-8">
          <button
            type="button"
            onClick={() => router.push("/marketplace/seller")}
            className="mb-5 inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Seller Profile
          </button>

          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05]">
                  <BarChart3 className="h-5 w-5 text-zinc-200" />
                </div>

                <div>
                  <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                    Seller Dashboard
                  </h1>

                  <p className="mt-1 text-sm text-zinc-500">
                    {sellerProfile?.display_name ||
                      sellerProfile?.username ||
                      "Seller"}
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push("/marketplace/seller/create")}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
            >
              <Plus className="h-4 w-4" />
              Create Template
            </button>
          </div>
        </header>

        {/* Error */}
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>{error}</div>
          </div>
        )}

        {/* Seller status */}
        <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-600">
                Seller Account
              </p>

              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    sellerProfile?.seller_status === "active"
                      ? "bg-emerald-400"
                      : sellerProfile?.seller_status === "suspended"
                      ? "bg-red-400"
                      : "bg-amber-400"
                  }`}
                />

                <span className="text-sm font-medium text-zinc-200">
                  {sellerProfile?.seller_status === "active"
                    ? "Active"
                    : sellerProfile?.seller_status === "suspended"
                    ? "Suspended"
                    : "Pending"}
                </span>

                {sellerProfile?.is_verified && (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Verified
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push("/marketplace/seller")}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/[0.05] hover:text-white"
            >
              <Store className="h-4 w-4" />
              Edit Seller Profile
            </button>
          </div>
        </section>

        {/* Overview stats */}
        <section className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            icon={<Store className="h-5 w-5" />}
            label="Total Templates"
            value={stats.totalTemplates.toLocaleString("en-IN")}
          />

          <StatCard
            icon={<ShoppingBag className="h-5 w-5" />}
            label="Total Sales"
            value={stats.sales.toLocaleString("en-IN")}
          />

          <StatCard
            icon={<DollarSign className="h-5 w-5" />}
            label="Seller Revenue"
            value={formatCurrency(stats.sellerRevenue)}
          />

          <StatCard
            icon={<Eye className="h-5 w-5" />}
            label="Total Views"
            value={stats.views.toLocaleString("en-IN")}
          />
        </section>

        {/* Secondary stats */}
        <section className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          <SmallStat label="Published" value={stats.published} />
          <SmallStat label="Drafts" value={stats.drafts} />
          <SmallStat label="Under Review" value={stats.underReview} />
          <SmallStat label="Rejected" value={stats.rejected} />
        </section>

        {/* Earnings overview */}
        <section className="mb-8 rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Earnings Overview</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Calculated from successful, non-refunded marketplace
                purchases.
              </p>
            </div>

            <TrendingUp className="h-5 w-5 text-zinc-500" />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <MoneyCard
              label="Gross Sales"
              amount={stats.grossRevenue}
              description="Total amount paid by buyers"
            />

            <MoneyCard
              label="ZUQEN Commission"
              amount={stats.commission}
              description="20% marketplace commission"
            />

            <MoneyCard
              label="Seller Revenue"
              amount={stats.sellerRevenue}
              description="Seller share after commission"
            />
          </div>

          <p className="mt-5 text-xs leading-5 text-zinc-600">
            Seller revenue shown here is based on recorded purchase
            transactions. Withdrawal availability and settlement rules will
            be handled by the seller earnings and withdrawal system.
          </p>
        </section>

        {/* Templates */}
        <section className="mb-8 rounded-2xl border border-white/10 bg-white/[0.025]">
          <div className="border-b border-white/10 p-5 sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold">My Templates</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Your templates remain here after they are sold.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <FilterButton
                  active={filter === "all"}
                  onClick={() => setFilter("all")}
                >
                  All ({stats.totalTemplates})
                </FilterButton>

                <FilterButton
                  active={filter === "published"}
                  onClick={() => setFilter("published")}
                >
                  Published ({stats.published})
                </FilterButton>

                <FilterButton
                  active={filter === "draft"}
                  onClick={() => setFilter("draft")}
                >
                  Drafts ({stats.drafts})
                </FilterButton>

                <FilterButton
                  active={filter === "review"}
                  onClick={() => setFilter("review")}
                >
                  Review ({stats.underReview})
                </FilterButton>

                <FilterButton
                  active={filter === "rejected"}
                  onClick={() => setFilter("rejected")}
                >
                  Rejected ({stats.rejected})
                </FilterButton>
              </div>
            </div>
          </div>

          {filteredTemplates.length === 0 ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center px-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                <Store className="h-5 w-5 text-zinc-600" />
              </div>

              <h3 className="mt-4 text-sm font-medium text-zinc-300">
                {templates.length === 0
                  ? "No templates yet"
                  : "No templates in this filter"}
              </h3>

              <p className="mt-2 max-w-md text-sm text-zinc-600">
                {templates.length === 0
                  ? "Create your first template to start building your marketplace catalog."
                  : "Try another status filter to see your other templates."}
              </p>

              {templates.length === 0 && (
                <button
                  type="button"
                  onClick={() => router.push("/marketplace/seller/create")}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-zinc-200"
                >
                  <Plus className="h-4 w-4" />
                  Create Template
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {filteredTemplates.map((template) => {
                const status = getTemplateStatus(template);
                const StatusIcon = status.icon;

                return (
                  <div
                    key={template.id}
                    className="p-5 transition hover:bg-white/[0.015] sm:p-6"
                  >
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-center">
                      {/* Template identity */}
                      <div className="flex min-w-0 flex-1 gap-4">
                        <div className="h-20 w-28 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/30">
                          {template.preview_image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={template.preview_image}
                              alt={template.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Store className="h-6 w-6 text-zinc-700" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-sm font-semibold text-white">
                              {template.name}
                            </h3>

                            {template.featured && (
                              <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] text-zinc-400">
                                Featured
                              </span>
                            )}
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                            <span>{template.category}</span>
                            <span>•</span>
                            <span>
                              {formatCurrency(
                                Number(template.price || 0),
                                template.currency || "INR"
                              )}
                            </span>
                          </div>

                          <div
                            className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${status.className}`}
                          >
                            <StatusIcon className="h-3.5 w-3.5" />
                            {status.label}
                          </div>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:w-[500px]">
                        <Metric
                          label="Buyers"
                          value={template.buyerCount}
                        />

                        <Metric
                          label="Sales"
                          value={template.successfulSales}
                        />

                        <Metric
                          label="Views"
                          value={Number(template.view_count || 0)}
                        />

                        <Metric
                          label="Revenue"
                          value={formatCurrency(template.sellerRevenue)}
                        />
                      </div>

                      {/* Actions */}
                      <div className="flex shrink-0 gap-2 xl:w-[150px] xl:justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            router.push(
                              `/marketplace/template/${
                                template.slug || template.id
                              }`
                            )
                          }
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-white/[0.05] hover:text-white xl:flex-none"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            router.push(
                              `/marketplace/seller/create?template=${template.id}`
                            )
                          }
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-white/[0.05] hover:text-white xl:flex-none"
                        >
                          <FileEdit className="h-3.5 w-3.5" />
                          Edit
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/5 pt-4 text-xs text-zinc-600">
                      <span>
                        Updated{" "}
                        {new Date(template.updated_at).toLocaleDateString(
                          "en-IN"
                        )}
                      </span>

                      <span>
                        Rating{" "}
                        {template.review_count && template.average_rating
                          ? `${Number(template.average_rating).toFixed(1)} (${template.review_count})`
                          : "No reviews"}
                      </span>

                      <span>
                        Template ID{" "}
                        <span className="font-mono text-zinc-700">
                          {template.id}
                        </span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Recent sales */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.025]">
          <div className="border-b border-white/10 p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Recent Sales</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Actual successful purchases recorded for your templates.
                </p>
              </div>

              <ShoppingBag className="h-5 w-5 text-zinc-500" />
            </div>
          </div>

          {recentSales.length === 0 ? (
            <div className="flex min-h-[220px] items-center justify-center px-6 text-center">
              <div>
                <ShoppingBag className="mx-auto h-8 w-8 text-zinc-700" />
                <p className="mt-3 text-sm text-zinc-500">
                  No successful sales yet.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {recentSales.map((purchase) => (
                <div
                  key={purchase.id}
                  className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-200">
                      {templateNameById.get(purchase.template_id) ||
                        "Template"}
                    </p>

                    <p className="mt-1 text-xs text-zinc-600">
                      Purchased{" "}
                      {new Date(purchase.created_at).toLocaleDateString(
                        "en-IN"
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-5">
                    <div className="text-right">
                      <p className="text-xs text-zinc-600">Sale</p>
                      <p className="mt-1 text-sm text-zinc-300">
                        {formatCurrency(Number(purchase.amount || 0))}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-zinc-600">Seller</p>
                      <p className="mt-1 text-sm font-medium text-emerald-400">
                        {formatCurrency(
                          Number(purchase.seller_amount || 0)
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-400">
        {icon}
      </div>

      <p className="mt-4 text-xs text-zinc-600">{label}</p>

      <p className="mt-1 truncate text-lg font-semibold text-zinc-100 sm:text-xl">
        {value}
      </p>
    </div>
  );
}

function SmallStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
      <p className="text-xs text-zinc-600">{label}</p>
      <p className="mt-1 text-lg font-semibold text-zinc-300">
        {value.toLocaleString("en-IN")}
      </p>
    </div>
  );
}

function MoneyCard({
  label,
  amount,
  description,
}: {
  label: string;
  amount: number;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs text-zinc-600">{label}</p>

      <p className="mt-2 text-xl font-semibold text-zinc-100">
        {formatCurrency(amount)}
      </p>

      <p className="mt-2 text-xs text-zinc-600">{description}</p>
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-zinc-600">
        {label}
      </p>

      <p className="mt-1 truncate text-sm font-medium text-zinc-300">
        {typeof value === "number"
          ? value.toLocaleString("en-IN")
          : value}
      </p>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
        active
          ? "border-white/20 bg-white/[0.08] text-white"
          : "border-white/10 bg-transparent text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
      }`}
    >
      {children}
    </button>
  );
}