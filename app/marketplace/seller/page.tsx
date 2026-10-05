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

function getSupabaseErrorMessage(error: unknown, fallback: string) {
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

    async function loadSeller() {
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
          router.push("/login?redirect=/marketplace/seller");
          return;
        }

        if (!mounted) return;

        setUserId(user.id);

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

        if (existingSeller) {
          setDisplayName(existingSeller.display_name || "");
          setUsername(existingSeller.username || "");
          setBio(existingSeller.bio || "");
          setWebsiteUrl(existingSeller.website_url || "");
          setAvatarUrl(existingSeller.avatar_url || "");
        } else {
          setDisplayName(baseProfile?.display_name || "");
          setAvatarUrl(baseProfile?.avatar_url || "");
        }
      } catch (err) {
        console.error("Failed to load seller profile:", err);

        if (mounted) {
          setError(
            getSupabaseErrorMessage(
              err,
              "Unable to load your seller profile."
            )
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadSeller();

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
         * Check username availability before saving.
         *
         * This prevents a database unique-constraint error from appearing
         * when another seller is already using the username.
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

      const payload = {
        user_id: userId,
        display_name: normalizedDisplayName,
        username: normalizedUsername || null,
        bio: normalizedBio || null,
        avatar_url: normalizedAvatar || null,
        website_url: normalizedWebsite || null,
      };

      let savedSeller: SellerProfile | null = null;

      /*
       * Existing seller profile
       */
      if (sellerProfile?.id) {
        const { data, error: updateError } = await supabase
          .from("seller_profiles")
          .update({
            display_name: payload.display_name,
            username: payload.username,
            bio: payload.bio,
            avatar_url: payload.avatar_url,
            website_url: payload.website_url,
          })
          .eq("id", sellerProfile.id)
          .eq("user_id", userId)
          .select(SELLER_PROFILE_SELECT)
          .single();

        if (updateError) {
          throw updateError;
        }

        if (!data) {
          throw new Error(
            "The seller profile could not be updated. Please refresh the page and try again."
          );
        }

        savedSeller = data as SellerProfile;
      } else {
        /*
         * No seller profile loaded.
         *
         * First check again by user_id. This protects against cases where
         * the profile was created elsewhere or a previous request created it.
         */
        const { data: existingByUser, error: existingCheckError } =
          await supabase
            .from("seller_profiles")
            .select(SELLER_PROFILE_SELECT)
            .eq("user_id", userId)
            .maybeSingle();

        if (existingCheckError) {
          throw existingCheckError;
        }

        if (existingByUser) {
          const { data, error: updateError } = await supabase
            .from("seller_profiles")
            .update({
              display_name: payload.display_name,
              username: payload.username,
              bio: payload.bio,
              avatar_url: payload.avatar_url,
              website_url: payload.website_url,
            })
            .eq("id", existingByUser.id)
            .eq("user_id", userId)
            .select(SELLER_PROFILE_SELECT)
            .single();

          if (updateError) {
            throw updateError;
          }

          savedSeller = data as SellerProfile;
        } else {
          /*
           * Create a new seller profile.
           */
          const { data, error: insertError } = await supabase
            .from("seller_profiles")
            .insert({
              ...payload,
              seller_status: "pending",
              is_verified: false,
            })
            .select(SELLER_PROFILE_SELECT)
            .single();

          if (insertError) {
            throw insertError;
          }

          if (!data) {
            throw new Error(
              "Seller profile creation returned no data. Please try again."
            );
          }

          savedSeller = data as SellerProfile;
        }
      }

      setSellerProfile(savedSeller);

      setSuccess("Seller profile saved successfully.");

      window.setTimeout(() => {
        setSuccess("");
      }, 3500);
    } catch (err) {
      console.error("Failed to save seller profile:", err);

      setError(
        getSupabaseErrorMessage(
          err,
          "Unable to save your seller profile. Please try again."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#07090d] text-white">
        <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6">
          <div className="flex items-center gap-3 text-sm text-zinc-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading seller profile...
          </div>
        </div>
      </main>
    );
  }

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
                  Manage your ZUQEN marketplace seller profile.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
            <span
              className={`h-2 w-2 rounded-full ${
                sellerStatus === "active"
                  ? "bg-emerald-400"
                  : sellerStatus === "suspended"
                  ? "bg-red-400"
                  : "bg-amber-400"
              }`}
            />

            <span className="text-sm text-zinc-300">{statusLabel}</span>

            {isVerified && (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

            <div className="min-w-0 break-words">
              <p>{error}</p>

              <p className="mt-2 text-xs text-red-300/60">
                If this is a database permission or policy error, the exact
                Supabase message above identifies the issue.
              </p>
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
              <h2 className="text-lg font-semibold">Seller Profile</h2>
              <p className="mt-1 text-sm text-zinc-500">
                These details will be used on your marketplace seller profile.
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
                  Website
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
                  Optional. This is your personal or portfolio website.
                </p>
              </div>

              {/* Avatar URL */}
              <div>
                <label
                  htmlFor="avatarUrl"
                  className="mb-2 block text-sm font-medium text-zinc-200"
                >
                  Avatar URL{" "}
                  <span className="font-normal text-zinc-600">(optional)</span>
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
                  Seller status and verification are controlled by the
                  marketplace system.
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

                  {saving ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </form>
          </section>

          {/* Seller status */}
          <aside className="space-y-6">
            <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <h2 className="text-sm font-semibold text-zinc-200">
                Seller status
              </h2>

              <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-zinc-400">Account</span>

                  <span className="text-sm font-medium text-zinc-200">
                    {statusLabel}
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between gap-4">
                  <span className="text-sm text-zinc-400">Verification</span>

                  {isVerified ? (
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" />
                      Verified
                    </span>
                  ) : (
                    <span className="text-sm text-zinc-500">
                      Not verified
                    </span>
                  )}
                </div>
              </div>

              {sellerStatus === "pending" && (
                <p className="mt-4 text-xs leading-5 text-zinc-500">
                  Your seller account is currently pending. Marketplace
                  approval and verification will be handled by the seller
                  review system.
                </p>
              )}

              {sellerStatus === "suspended" && (
                <p className="mt-4 text-xs leading-5 text-red-300/70">
                  Seller activity is currently restricted. Contact the
                  marketplace support/review system for further information.
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <h2 className="text-sm font-semibold text-zinc-200">
                Account information
              </h2>

              <div className="mt-5 space-y-4">
                <div>
                  <p className="text-xs text-zinc-600">Profile ID</p>
                  <p className="mt-1 break-all font-mono text-xs text-zinc-400">
                    {profile?.id || userId}
                  </p>
                </div>

                {sellerProfile?.created_at && (
                  <div>
                    <p className="text-xs text-zinc-600">
                      Seller profile created
                    </p>

                    <p className="mt-1 text-sm text-zinc-400">
                      {new Date(
                        sellerProfile.created_at
                      ).toLocaleDateString()}
                    </p>
                  </div>
                )}

                {sellerProfile?.updated_at && (
                  <div>
                    <p className="text-xs text-zinc-600">Last updated</p>

                    <p className="mt-1 text-sm text-zinc-400">
                      {new Date(
                        sellerProfile.updated_at
                      ).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05]">
                <Store className="h-5 w-5 text-zinc-300" />
              </div>

              <h2 className="mt-4 text-sm font-semibold text-zinc-200">
                Sell on ZUQEN
              </h2>

              <p className="mt-2 text-xs leading-5 text-zinc-500">
                Once your seller profile is ready, the seller dashboard will
                let you create templates, manage drafts, upload versions,
                submit listings for review and track marketplace activity.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}