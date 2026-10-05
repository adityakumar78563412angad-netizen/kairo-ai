"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Save,
  Store,
  User,
} from "lucide-react";
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

const SELLER_PROFILE_SELECT = `
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
`;

function getErrorMessage(error: unknown, fallback: string) {
  if (!error) return fallback;

  if (typeof error === "object" && error !== null) {
    const value = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };

    const parts = [
      value.message,
      value.details,
      value.hint,
      value.code ? `Code: ${value.code}` : null,
    ].filter(Boolean);

    if (parts.length > 0) {
      return parts.join(" — ");
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export default function SellerPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [userId, setUserId] = useState("");

  const [profile, setProfile] = useState<Profile | null>(null);
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(
    null
  );

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const sellerStatus = sellerProfile?.seller_status || "pending";
  const isVerified = sellerProfile?.is_verified === true;

  const statusLabel = useMemo(() => {
    switch (sellerStatus) {
      case "active":
        return "Active";
      case "suspended":
        return "Suspended";
      case "rejected":
        return "Rejected";
      case "pending":
      default:
        return "Pending";
    }
  }, [sellerStatus]);

  useEffect(() => {
    let mounted = true;

    async function loadSellerCenter() {
      setLoading(true);
      setError("");

      try {
        /*
         * =========================================================
         * 1. Check authentication
         * =========================================================
         */

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
          throw authError;
        }

        /*
         * User is not logged in.
         *
         * Do not show the seller profile form.
         * Send the user to authentication first.
         */
        if (!user) {
          router.replace("/login?redirect=/marketplace/seller");
          return;
        }

        if (!mounted) return;

        setUserId(user.id);

        /*
         * =========================================================
         * 2. Load normal profile + seller profile
         * =========================================================
         */

        const [profileResult, sellerResult] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, display_name, avatar_url")
            .eq("id", user.id)
            .maybeSingle(),

          supabase
            .from("seller_profiles")
            .select(SELLER_PROFILE_SELECT)
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);

        if (profileResult.error) {
          throw profileResult.error;
        }

        if (sellerResult.error) {
          throw sellerResult.error;
        }

        if (!mounted) return;

        const baseProfile = profileResult.data as Profile | null;
        const existingSeller = sellerResult.data as SellerProfile | null;

        setProfile(baseProfile);
        setSellerProfile(existingSeller);

        /*
         * =========================================================
         * 3. IMPORTANT:
         * Existing seller → dashboard
         * New seller → show profile form
         * =========================================================
         */

        if (existingSeller) {
          router.replace("/marketplace/seller/dashboard");
          return;
        }

        /*
         * No seller profile yet.
         * Pre-fill the form from the normal ZUQEN profile.
         */

        setDisplayName(baseProfile?.display_name || "");
        setAvatarUrl(baseProfile?.avatar_url || "");
      } catch (err) {
        console.error("Failed to load seller center:", err);

        if (mounted) {
          setError(
            getErrorMessage(err, "Unable to load your seller profile.")
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadSellerCenter();

    return () => {
      mounted = false;
    };
  }, [router]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId) {
      setError("Authentication is required.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const normalizedDisplayName = displayName.trim();
      const normalizedUsername = username.trim().toLowerCase();
      const normalizedBio = bio.trim();
      const normalizedWebsite = websiteUrl.trim();
      const normalizedAvatar = avatarUrl.trim();

      /*
       * =========================================================
       * Validation
       * =========================================================
       */

      if (!normalizedDisplayName) {
        throw new Error("Display name is required.");
      }

      if (normalizedDisplayName.length < 2) {
        throw new Error("Display name must contain at least 2 characters.");
      }

      if (normalizedDisplayName.length > 100) {
        throw new Error("Display name cannot exceed 100 characters.");
      }

      if (normalizedUsername) {
        const usernamePattern = /^[a-z0-9_]{3,30}$/;

        if (!usernamePattern.test(normalizedUsername)) {
          throw new Error(
            "Username must be 3–30 characters and contain only lowercase letters, numbers, and underscores."
          );
        }

        /*
         * Check whether another seller already owns this username.
         */
        const { data: usernameOwner, error: usernameCheckError } =
          await supabase
            .from("seller_profiles")
            .select("id, user_id")
            .eq("username", normalizedUsername)
            .neq("user_id", userId)
            .maybeSingle();

        if (usernameCheckError) {
          throw usernameCheckError;
        }

        if (usernameOwner) {
          throw new Error(
            `The username @${normalizedUsername} is already in use. Please choose another username.`
          );
        }
      }

      if (normalizedWebsite) {
        try {
          const url = new URL(normalizedWebsite);

          if (!["http:", "https:"].includes(url.protocol)) {
            throw new Error();
          }
        } catch {
          throw new Error(
            "Please enter a valid website URL starting with http:// or https://."
          );
        }
      }

      if (normalizedAvatar) {
        try {
          const url = new URL(normalizedAvatar);

          if (!["http:", "https:"].includes(url.protocol)) {
            throw new Error();
          }
        } catch {
          throw new Error(
            "Please enter a valid avatar URL starting with http:// or https://."
          );
        }
      }

      /*
       * =========================================================
       * 4. IMPORTANT DUPLICATE-PROFILE PROTECTION
       *
       * Before inserting, check again.
       * This prevents duplicate seller profiles if another request
       * created one while this page was open.
       * =========================================================
       */

      const { data: existingSeller, error: existingSellerError } =
        await supabase
          .from("seller_profiles")
          .select(SELLER_PROFILE_SELECT)
          .eq("user_id", userId)
          .maybeSingle();

      if (existingSellerError) {
        throw existingSellerError;
      }

      /*
       * If seller profile already exists, never create another one.
       * Send the user to the dashboard instead.
       */
      if (existingSeller) {
        setSellerProfile(existingSeller as SellerProfile);

        setSuccess("Your seller profile already exists.");

        window.setTimeout(() => {
          router.replace("/marketplace/seller/dashboard");
        }, 700);

        return;
      }

      /*
       * =========================================================
       * 5. Create seller profile
       * =========================================================
       */

      const payload = {
        user_id: userId,
        display_name: normalizedDisplayName,
        username: normalizedUsername || null,
        bio: normalizedBio || null,
        avatar_url: normalizedAvatar || null,
        website_url: normalizedWebsite || null,
        seller_status: "pending",
        is_verified: false,
      };

      const { data: createdSeller, error: insertError } = await supabase
        .from("seller_profiles")
        .insert(payload)
        .select(SELLER_PROFILE_SELECT)
        .single();

      if (insertError) {
        throw insertError;
      }

      if (!createdSeller) {
        throw new Error(
          "Seller profile was not returned after creation. Please try again."
        );
      }

      setSellerProfile(createdSeller as SellerProfile);

      /*
       * =========================================================
       * 6. Profile successfully created
       *
       * Go directly to seller dashboard.
       * =========================================================
       */

      setSuccess("Seller profile created successfully.");

      window.setTimeout(() => {
        router.replace("/marketplace/seller/dashboard");
      }, 700);
    } catch (err) {
      console.error("Failed to save seller profile:", err);

      setError(
        getErrorMessage(
          err,
          "Unable to save your seller profile. Please try again."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  /*
   * =========================================================
   * Loading
   * =========================================================
   */

  if (loading) {
    return (
      <main className="min-h-screen bg-[#07090d] text-white">
        <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6">
          <div className="flex items-center gap-3 text-sm text-zinc-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            Checking your seller account...
          </div>
        </div>
      </main>
    );
  }

  /*
   * =========================================================
   * Seller Profile creation screen
   *
   * This is shown ONLY when the authenticated user does not
   * already have a seller profile.
   * =========================================================
   */

  return (
    <main className="min-h-screen bg-[#07090d] text-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <button
              type="button"
              onClick={() => router.push("/marketplace")}
              className="mb-4 inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Marketplace
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05]">
                <Store className="h-5 w-5 text-zinc-200" />
              </div>

              <div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  Seller Center
                </h1>

                <p className="mt-1 text-sm text-zinc-400">
                  Create your ZUQEN marketplace seller profile.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <span className="text-sm text-zinc-300">New Seller</span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

            <div className="min-w-0 break-words">
              {error}
            </div>
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <div>{success}</div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* Profile form */}
          <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-7">
            <div className="mb-7">
              <h2 className="text-lg font-semibold">
                Create Seller Profile
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                You only need to create this seller profile once.
              </p>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
              {/* Avatar preview */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05]">
                  {avatarUrl.trim() ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarUrl.trim()}
                      alt="Seller avatar"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <User className="h-8 w-8 text-zinc-600" />
                  )}
                </div>

                <div>
                  <p className="text-sm font-medium text-zinc-200">
                    Profile image
                  </p>

                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    Optional. You can leave the avatar URL empty.
                  </p>
                </div>
              </div>

              {/* Display name */}
              <div>
                <label
                  htmlFor="displayName"
                  className="mb-2 block text-sm font-medium text-zinc-200"
                >
                  Display name
                </label>

                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  maxLength={100}
                  placeholder="Your seller name"
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-white/25 focus:bg-black/30"
                />
              </div>

              {/* Username */}
              <div>
                <label
                  htmlFor="username"
                  className="mb-2 block text-sm font-medium text-zinc-200"
                >
                  Seller username
                </label>

                <div className="flex items-center rounded-xl border border-white/10 bg-black/20 focus-within:border-white/25">
                  <span className="pl-4 text-sm text-zinc-600">@</span>

                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(event) =>
                      setUsername(event.target.value.toLowerCase())
                    }
                    maxLength={30}
                    placeholder="yourname"
                    className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm text-white outline-none placeholder:text-zinc-600"
                  />
                </div>

                <p className="mt-2 text-xs text-zinc-600">
                  Optional. 3–30 characters. Lowercase letters, numbers and
                  underscores.
                </p>
              </div>

              {/* Bio */}
              <div>
                <label
                  htmlFor="bio"
                  className="mb-2 block text-sm font-medium text-zinc-200"
                >
                  Seller bio
                </label>

                <textarea
                  id="bio"
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  maxLength={1000}
                  rows={6}
                  placeholder="Tell buyers about the templates you create..."
                  className="w-full resize-y rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-600 focus:border-white/25 focus:bg-black/30"
                />

                <div className="mt-2 text-right text-xs text-zinc-600">
                  {bio.length}/1000
                </div>
              </div>

              {/* Website */}
              <div>
                <label
                  htmlFor="website"
                  className="mb-2 block text-sm font-medium text-zinc-200"
                >
                  Website{" "}
                  <span className="font-normal text-zinc-600">
                    (optional)
                  </span>
                </label>

                <input
                  id="website"
                  type="url"
                  value={websiteUrl}
                  onChange={(event) => setWebsiteUrl(event.target.value)}
                  placeholder="https://example.com"
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-white/25 focus:bg-black/30"
                />

                <p className="mt-2 text-xs text-zinc-600">
                  Your personal, creator, or portfolio website.
                </p>
              </div>

              {/* Avatar URL */}
              <div>
                <label
                  htmlFor="avatarUrl"
                  className="mb-2 block text-sm font-medium text-zinc-200"
                >
                  Avatar URL{" "}
                  <span className="font-normal text-zinc-600">
                    (optional)
                  </span>
                </label>

                <input
                  id="avatarUrl"
                  type="url"
                  value={avatarUrl}
                  onChange={(event) => setAvatarUrl(event.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-white/25 focus:bg-black/30"
                />
              </div>

              {/* Save */}
              <div className="flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-zinc-600">
                  Your seller profile will remain connected to this account
                  after logout.
                </p>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}

                  {saving ? "Creating..." : "Create Seller Profile"}
                </button>
              </div>
            </form>
          </section>

          {/* Information */}
          <aside className="space-y-6">
            <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <h2 className="text-sm font-semibold text-zinc-200">
                How selling works
              </h2>

              <div className="mt-5 space-y-4">
                <div className="flex gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-xs font-semibold">
                    1
                  </div>

                  <div>
                    <p className="text-sm text-zinc-200">
                      Create your seller profile
                    </p>

                    <p className="mt-1 text-xs leading-5 text-zinc-500">
                      This is a one-time setup for your account.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-xs font-semibold">
                    2
                  </div>

                  <div>
                    <p className="text-sm text-zinc-200">
                      Create your template
                    </p>

                    <p className="mt-1 text-xs leading-5 text-zinc-500">
                      Add your package, screenshots, video and listing details.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-xs font-semibold">
                    3
                  </div>

                  <div>
                    <p className="text-sm text-zinc-200">
                      Submit for review
                    </p>

                    <p className="mt-1 text-xs leading-5 text-zinc-500">
                      Security and marketplace verification happen before
                      publishing.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05]">
                <Store className="h-5 w-5 text-zinc-300" />
              </div>

              <h2 className="mt-4 text-sm font-semibold text-zinc-200">
                One account, one seller profile
              </h2>

              <p className="mt-2 text-xs leading-5 text-zinc-500">
                Your seller profile is permanently associated with your ZUQEN
                account. Logging out does not remove it.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}