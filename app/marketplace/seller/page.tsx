
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
  Globe,
  Loader2,
  Save,
  Store,
  User,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";

type SellerProfile = {
  id: string;
  user_id: string;
  display_name: string | null;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  website_url: string | null;
  seller_status: string | null;
  is_verified: boolean | null;
  created_at: string;
  updated_at: string;
};

type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

const supabase = createClient();

function SellerProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const editMode = searchParams.get("edit") === "true";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [existingSeller, setExistingSeller] =
    useState<SellerProfile | null>(null);
  const [baseProfile, setBaseProfile] = useState<Profile | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const pageTitle = useMemo(
    () => (editMode ? "Edit Seller Profile" : "Become a Seller"),
    [editMode]
  );

  const pageDescription = useMemo(
    () =>
      editMode
        ? "Update the public profile customers see when they visit your templates."
        : "Create your seller profile before publishing templates on the ZUQEN Marketplace.",
    [editMode]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadSellerProfile() {
      setLoading(true);
      setError("");
      setSuccess("");

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
          throw authError;
        }

        if (!user) {
          const redirect = editMode
            ? "/marketplace/seller?edit=true"
            : "/marketplace/seller";

          router.replace(`/login?redirect=${encodeURIComponent(redirect)}`);
          return;
        }

        if (cancelled) return;

        setUserId(user.id);

        const [sellerResult, profileResult] = await Promise.all([
          supabase
            .from("seller_profiles")
            .select(
              `
                id,
                user_id,
                display_name,
                username,
                bio,
                avatar_url,
                website_url,
                seller_status,
                is_verified,
                created_at,
                updated_at
              `
            )
            .eq("user_id", user.id)
            .maybeSingle(),

          supabase
            .from("profiles")
            .select("id, display_name, avatar_url")
            .eq("id", user.id)
            .maybeSingle(),
        ]);

        if (sellerResult.error) {
          throw sellerResult.error;
        }

        if (profileResult.error) {
          throw profileResult.error;
        }

        if (cancelled) return;

        const seller = sellerResult.data as SellerProfile | null;
        const profile = profileResult.data as Profile | null;

        setExistingSeller(seller);
        setBaseProfile(profile);

        /*
         * If a seller already exists and this is NOT edit mode,
         * send them directly to their seller dashboard.
         *
         * Edit mode deliberately skips this redirect.
         */
        if (seller && !editMode) {
          router.replace("/marketplace/seller/dashboard");
          return;
        }

        /*
         * Existing seller profile:
         * load its values into the form.
         */
        if (seller) {
          setDisplayName(
            seller.display_name || profile?.display_name || ""
          );
          setUsername(seller.username || "");
          setBio(seller.bio || "");
          setAvatarUrl(
            seller.avatar_url || profile?.avatar_url || ""
          );
          setWebsiteUrl(seller.website_url || "");
        } else {
          /*
           * New seller:
           * prefill from the normal profile where possible.
           */
          setDisplayName(profile?.display_name || "");
          setAvatarUrl(profile?.avatar_url || "");
        }
      } catch (err) {
        console.error("Seller profile load error:", err);

        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load your seller profile."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadSellerProfile();

    return () => {
      cancelled = true;
    };
  }, [router, editMode]);

  async function checkUsernameAvailability(
    value: string,
    currentSellerId?: string
  ) {
    const cleanUsername = value.trim().toLowerCase();

    if (!cleanUsername) {
      return true;
    }

    const { data, error: usernameError } = await supabase
      .from("seller_profiles")
      .select("id")
      .eq("username", cleanUsername)
      .maybeSingle();

    if (usernameError) {
      /*
       * A duplicate result is the important case.
       * If RLS/API returns a normal database error, surface it.
       */
      throw usernameError;
    }

    if (!data) {
      return true;
    }

    if (currentSellerId && data.id === currentSellerId) {
      return true;
    }

    return false;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId) {
      setError("Your session has expired. Please log in again.");
      return;
    }

    setError("");
    setSuccess("");

    const cleanDisplayName = displayName.trim();
    const cleanUsername = username.trim().toLowerCase();
    const cleanBio = bio.trim();
    const cleanAvatarUrl = avatarUrl.trim();
    const cleanWebsiteUrl = websiteUrl.trim();

    if (!cleanDisplayName) {
      setError("Please enter your seller display name.");
      return;
    }

    if (cleanDisplayName.length > 80) {
      setError("Seller display name must be 80 characters or less.");
      return;
    }

    if (cleanUsername) {
      if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
        setError(
          "Username can contain only lowercase letters, numbers, and underscores."
        );
        return;
      }

      if (cleanUsername.length < 3 || cleanUsername.length > 30) {
        setError("Username must be between 3 and 30 characters.");
        return;
      }
    }

    if (cleanBio.length > 500) {
      setError("Bio must be 500 characters or less.");
      return;
    }

    if (cleanWebsiteUrl) {
      try {
        const parsed = new URL(cleanWebsiteUrl);

        if (!["http:", "https:"].includes(parsed.protocol)) {
          throw new Error();
        }
      } catch {
        setError("Please enter a valid website URL.");
        return;
      }
    }

    if (cleanAvatarUrl) {
      try {
        const parsed = new URL(cleanAvatarUrl);

        if (!["http:", "https:"].includes(parsed.protocol)) {
          throw new Error();
        }
      } catch {
        setError("Please enter a valid avatar URL.");
        return;
      }
    }

    setSaving(true);

    try {
      const usernameAvailable = await checkUsernameAvailability(
        cleanUsername,
        existingSeller?.id
      );

      if (!usernameAvailable) {
        setError("That username is already being used by another seller.");
        return;
      }

      /*
       * EDIT EXISTING SELLER
       */
      if (existingSeller) {
        const { data, error: updateError } = await supabase
          .from("seller_profiles")
          .update({
            display_name: cleanDisplayName,
            username: cleanUsername || null,
            bio: cleanBio || null,
            avatar_url: cleanAvatarUrl || null,
            website_url: cleanWebsiteUrl || null,
          })
          .eq("id", existingSeller.id)
          .eq("user_id", userId)
          .select(
            `
              id,
              user_id,
              display_name,
              username,
              bio,
              avatar_url,
              website_url,
              seller_status,
              is_verified,
              created_at,
              updated_at
            `
          )
          .single();

        if (updateError) {
          throw updateError;
        }

        setExistingSeller(data as SellerProfile);
        setSuccess("Seller profile updated successfully.");

        setTimeout(() => {
          router.replace("/marketplace/seller/dashboard");
        }, 500);

        return;
      }

      /*
       * CREATE NEW SELLER
       *
       * Double-check first so a duplicate seller profile
       * cannot be created because of a stale client state.
       */
      const { data: duplicateSeller, error: duplicateError } =
        await supabase
          .from("seller_profiles")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();

      if (duplicateError) {
        throw duplicateError;
      }

      if (duplicateSeller) {
        router.replace("/marketplace/seller/dashboard");
        return;
      }

      const { data, error: insertError } = await supabase
        .from("seller_profiles")
        .insert({
          user_id: userId,
          display_name: cleanDisplayName,
          username: cleanUsername || null,
          bio: cleanBio || null,
          avatar_url: cleanAvatarUrl || null,
          website_url: cleanWebsiteUrl || null,
          seller_status: "pending",
          is_verified: false,
        })
        .select(
          `
            id,
            user_id,
            display_name,
            username,
            bio,
            avatar_url,
            website_url,
            seller_status,
            is_verified,
            created_at,
            updated_at
          `
        )
        .single();

      if (insertError) {
        throw insertError;
      }

      setExistingSeller(data as SellerProfile);
      setSuccess("Seller profile created successfully.");

      setTimeout(() => {
        router.replace("/marketplace/seller/dashboard");
      }, 500);
    } catch (err) {
      console.error("Seller profile save error:", err);

      const message =
        err instanceof Error
          ? err.message
          : "Unable to save your seller profile.";

      /*
       * Give a cleaner message for common username conflicts.
       */
      if (
        message.toLowerCase().includes("duplicate") ||
        message.toLowerCase().includes("unique")
      ) {
        setError("That username is already being used by another seller.");
      } else {
        setError(message);
      }
    } finally {
      setSaving(false);
    }
  }

  function handleBack() {
    if (editMode || existingSeller) {
      router.push("/marketplace/seller/dashboard");
      return;
    }

    router.push("/marketplace");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050505] text-white">
        <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6">
          <div className="flex items-center gap-3 text-sm text-zinc-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading seller profile...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={handleBack}
          className="mb-8 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.07] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          {editMode ? "Back to Seller Dashboard" : "Back to Marketplace"}
        </button>

        <div className="mb-8">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-500/10">
            {editMode ? (
              <User className="h-7 w-7 text-violet-300" />
            ) : (
              <Store className="h-7 w-7 text-violet-300" />
            )}
          </div>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {pageTitle}
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
            {pageDescription}
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>{error}</div>
          </div>
        )}

        {success && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <div>{success}</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-7">
              <div className="mb-7">
                <h2 className="text-lg font-semibold">
                  Profile Information
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  These details will be shown on your seller profile and
                  marketplace listings.
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <label
                    htmlFor="displayName"
                    className="mb-2 block text-sm font-medium text-zinc-200"
                  >
                    Seller Display Name
                  </label>

                  <input
                    id="displayName"
                    type="text"
                    value={displayName}
                    onChange={(event) =>
                      setDisplayName(event.target.value)
                    }
                    placeholder="Your creator or brand name"
                    maxLength={80}
                    disabled={saving}
                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-violet-400/50 focus:ring-2 focus:ring-violet-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                  />

                  <p className="mt-2 text-xs text-zinc-600">
                    {displayName.length}/80
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="username"
                    className="mb-2 block text-sm font-medium text-zinc-200"
                  >
                    Username
                  </label>

                  <div className="flex items-center rounded-2xl border border-white/10 bg-black/30 px-4 focus-within:border-violet-400/50 focus-within:ring-2 focus-within:ring-violet-500/10">
                    <span className="text-sm text-zinc-600">@</span>
                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(event) =>
                        setUsername(
                          event.target.value
                            .toLowerCase()
                            .replace(/\s+/g, "")
                        )
                      }
                      placeholder="yourusername"
                      maxLength={30}
                      disabled={saving}
                      className="w-full bg-transparent px-2 py-3 text-sm text-white outline-none placeholder:text-zinc-600 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </div>

                  <p className="mt-2 text-xs text-zinc-600">
                    Lowercase letters, numbers and underscores only.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="bio"
                    className="mb-2 block text-sm font-medium text-zinc-200"
                  >
                    Bio
                  </label>

                  <textarea
                    id="bio"
                    value={bio}
                    onChange={(event) => setBio(event.target.value)}
                    placeholder="Tell buyers what you create..."
                    rows={5}
                    maxLength={500}
                    disabled={saving}
                    className="w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-600 focus:border-violet-400/50 focus:ring-2 focus:ring-violet-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                  />

                  <p className="mt-2 text-xs text-zinc-600">
                    {bio.length}/500
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="avatarUrl"
                    className="mb-2 block text-sm font-medium text-zinc-200"
                  >
                    Avatar URL
                  </label>

                  <input
                    id="avatarUrl"
                    type="url"
                    value={avatarUrl}
                    onChange={(event) =>
                      setAvatarUrl(event.target.value)
                    }
                    placeholder="https://..."
                    disabled={saving}
                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-violet-400/50 focus:ring-2 focus:ring-violet-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>

                <div>
                  <label
                    htmlFor="websiteUrl"
                    className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-200"
                  >
                    <Globe className="h-4 w-4 text-zinc-500" />
                    Website
                  </label>

                  <input
                    id="websiteUrl"
                    type="url"
                    value={websiteUrl}
                    onChange={(event) =>
                      setWebsiteUrl(event.target.value)
                    }
                    placeholder="https://yourwebsite.com"
                    disabled={saving}
                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-violet-400/50 focus:ring-2 focus:ring-violet-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
              </div>
            </section>

            <aside className="space-y-6">
              <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-5">
                <h3 className="font-semibold">Seller Status</h3>

                <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                      <Store className="h-5 w-5 text-amber-300" />
                    </div>

                    <div>
                      <p className="text-sm font-medium text-white">
                        {existingSeller?.seller_status
                          ? existingSeller.seller_status
                              .charAt(0)
                              .toUpperCase() +
                            existingSeller.seller_status.slice(1)
                          : "Pending"}
                      </p>

                      <p className="mt-0.5 text-xs text-zinc-500">
                        {existingSeller?.is_verified
                          ? "Verified seller"
                          : "Verification pending"}
                      </p>
                    </div>
                  </div>
                </div>

                <p className="mt-4 text-xs leading-5 text-zinc-600">
                  Seller verification and marketplace review are handled
                  separately from your profile information.
                </p>
              </div>

              <div className="rounded-3xl border border-violet-400/15 bg-violet-500/[0.06] p-5">
                <h3 className="font-semibold text-violet-100">
                  Marketplace Commission
                </h3>

                <p className="mt-2 text-sm leading-6 text-violet-100/60">
                  ZUQEN retains 20% of each successful template sale.
                  Sellers receive the remaining 80% through the marketplace
                  earnings system.
                </p>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    {editMode ? "Save Changes" : "Create Seller Profile"}
                  </>
                )}
              </button>
            </aside>
          </div>
        </form>
      </div>
    </main>
  );
}

export default function SellerProfilePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#050505] text-white">
          <div className="flex min-h-screen items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-zinc-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading seller profile...
            </div>
          </div>
        </main>
      }
    >
      <SellerProfileContent />
    </Suspense>
  );
}

