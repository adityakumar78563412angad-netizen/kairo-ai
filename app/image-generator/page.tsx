"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

const FEATURE_KEY = "image_generator";

export default function ImageGeneratorPage() {
  const supabase = createClient();

  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [credits, setCredits] = useState<number | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(true);

  async function loadCredits() {
    try {
      setCreditsLoading(true);

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        setCredits(0);
        return;
      }

      const { data, error: creditError } = await supabase
        .from("feature_credit_balances")
        .select("balance")
        .eq("user_id", user.id)
        .eq("feature_key", FEATURE_KEY)
        .maybeSingle();

      if (creditError) {
        console.error(
          "Failed to load Image Generator credits:",
          creditError
        );

        setCredits(null);
        return;
      }

      setCredits(
        typeof data?.balance === "number"
          ? data.balance
          : 0
      );
    } catch (err) {
      console.error(
        "Failed to load Image Generator credits:",
        err
      );

      setCredits(null);
    } finally {
      setCreditsLoading(false);
    }
  }

  useEffect(() => {
    loadCredits();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadCredits();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function generateImage() {
    const trimmedPrompt = prompt.trim();

    if (!trimmedPrompt || loading) return;

    setError("");

    /*
     * Do not allow generation when the balance is already known
     * to be empty.
     */
    if (credits !== null && credits < 1) {
      setError(
        "You don't have enough Image Generator credits. Please sign in or add more credits to continue."
      );
      return;
    }

    setLoading(true);
    setImage(null);

    try {
      const response = await fetch("/api/image-generator", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: trimmedPrompt,
        }),
      });

      let result: {
        success?: boolean;
        image?: string;
        error?: string;
        creditsConsumed?: number;
        creditsRemaining?: number;
        billing?: {
          creditsConsumed?: number;
          creditsRemaining?: number;
        };
      };

      try {
        result = await response.json();
      } catch {
        throw new Error(
          `Server returned an invalid response (${response.status}).`
        );
      }

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Image generation failed."
        );
      }

      if (!result.image) {
        throw new Error(
          "The AI did not return an image."
        );
      }

      setImage(result.image);

      /*
       * API returns the authoritative remaining balance
       * after successful generation.
       */
      if (
        typeof result.creditsRemaining === "number"
      ) {
        setCredits(result.creditsRemaining);
      } else if (
        typeof result.billing?.creditsRemaining ===
        "number"
      ) {
        setCredits(
          result.billing.creditsRemaining
        );
      } else {
        /*
         * Fallback: reload the real balance from Supabase.
         */
        await loadCredits();
      }
    } catch (err) {
      console.error(
        "Image generation failed:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while generating the image."
      );

      /*
       * Reload balance after any failed request so the UI
       * stays synchronized with the database.
       */
      await loadCredits();
    } finally {
      setLoading(false);
    }
  }

  function downloadImage() {
    if (!image) return;

    const link = document.createElement("a");

    link.href = image;
    link.download = "zuqen-generated-image.png";

    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function clearImage() {
    setImage(null);
    setError("");
  }

  const formattedCredits =
    credits === null
      ? "—"
      : credits.toFixed(2);

  const cannotGenerate =
    !prompt.trim() ||
    loading ||
    creditsLoading ||
    (credits !== null && credits < 1);

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-250px] h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-white/[0.035] blur-[120px]" />
        <div className="absolute bottom-[-250px] left-[-200px] h-[500px] w-[500px] rounded-full bg-white/[0.02] blur-[120px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-5 sm:px-8 sm:py-7">

        {/* Header */}
        <header className="flex items-center justify-between border-b border-white/[0.07] pb-5">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="group flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3.5 py-2 text-sm text-white/65 transition hover:border-white/15 hover:bg-white/[0.07] hover:text-white"
          >
            <span className="text-base transition-transform group-hover:-translate-x-0.5">
              ←
            </span>

            <span>Back</span>
          </button>

          <div className="absolute left-1/2 -translate-x-1/2 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/35">
              ZUQEN
            </div>

            <div className="mt-0.5 text-sm font-medium text-white/80">
              Image Generator
            </div>
          </div>

          {/* Credits */}
          <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-2">
            <span className="text-sm text-white/50">
              ✦
            </span>

            <div className="text-right">
              <div className="text-[9px] uppercase tracking-[0.16em] text-white/25">
                Image Credits
              </div>

              <div className="text-xs font-semibold text-white/80">
                {creditsLoading
                  ? "Loading..."
                  : formattedCredits}
              </div>
            </div>
          </div>
        </header>

        {/* Hero */}
        <section className="mx-auto w-full max-w-4xl pt-14 text-center sm:pt-20">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-[20px] border border-white/10 bg-white/[0.055] text-2xl shadow-[0_0_50px_rgba(255,255,255,0.04)]">
            ✦
          </div>

          <h1 className="text-4xl font-semibold tracking-[-0.04em] sm:text-6xl">
            Create images with
            <span className="ml-3 bg-gradient-to-r from-white via-white/70 to-white/30 bg-clip-text text-transparent">
              ZUQEN.
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-white/40 sm:text-base">
            Turn your imagination into visuals. Describe what
            you want to create and let ZUQEN generate it for you.
          </p>

          {/* Credit information */}
          <div className="mx-auto mt-7 flex w-fit items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.025] px-4 py-2">
            <span className="text-[10px] text-white/35">
              1.00 ZUQEN Image Credit
            </span>

            <span className="text-white/15">
              =
            </span>

            <span className="text-[10px] text-white/50">
              1 successfully generated image
            </span>
          </div>
        </section>

        {/* Main generator */}
        <section className="mx-auto mt-12 grid w-full max-w-6xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">

          {/* Prompt panel */}
          <div className="rounded-[28px] border border-white/[0.08] bg-white/[0.025] p-5 shadow-2xl backdrop-blur-xl sm:p-6">

            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white/80">
                  Describe your image
                </p>

                <p className="mt-1 text-xs text-white/30">
                  Be as creative as you want.
                </p>
              </div>

              <div className="rounded-lg border border-white/[0.07] bg-white/[0.035] px-2.5 py-1 text-[10px] text-white/30">
                FLUX
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-black/30 p-1.5 transition focus-within:border-white/15">
              <textarea
                value={prompt}
                onChange={(event) => {
                  setPrompt(
                    event.target.value.slice(0, 1000)
                  );
                  setError("");
                }}
                onKeyDown={(event) => {
                  if (
                    (event.ctrlKey || event.metaKey) &&
                    event.key === "Enter"
                  ) {
                    event.preventDefault();
                    generateImage();
                  }
                }}
                disabled={loading}
                rows={9}
                placeholder="A futuristic city floating above the clouds at sunset, cinematic lighting, ultra detailed..."
                className="w-full resize-none bg-transparent p-4 text-sm leading-7 text-white outline-none placeholder:text-white/20 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className="text-[11px] text-white/25">
                {prompt.length}/1000
              </span>

              <span className="hidden text-[11px] text-white/20 sm:block">
                Ctrl + Enter to generate
              </span>
            </div>

            {error && (
              <div className="mt-4 rounded-2xl border border-red-400/15 bg-red-400/[0.06] px-4 py-3">
                <div className="flex gap-3">
                  <span className="text-red-300/80">
                    !
                  </span>

                  <div>
                    <p className="text-xs font-medium text-red-200/90">
                      Generation failed
                    </p>

                    <p className="mt-1 break-words text-[11px] leading-5 text-red-200/50">
                      {error}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Credit status */}
            {!creditsLoading &&
              credits !== null &&
              credits < 1 && (
                <div className="mt-4 rounded-2xl border border-amber-300/10 bg-amber-300/[0.045] px-4 py-3">
                  <div className="flex gap-3">
                    <span className="text-amber-200/70">
                      ✦
                    </span>

                    <div>
                      <p className="text-xs font-medium text-amber-100/80">
                        No Image Credits Remaining
                      </p>

                      <p className="mt-1 text-[11px] leading-5 text-amber-100/40">
                        You need 1.00 Image Credit to
                        generate an image.
                      </p>
                    </div>
                  </div>
                </div>
              )}

            <button
              type="button"
              onClick={generateImage}
              disabled={cannotGenerate}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-25"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />
                  Creating image...
                </>
              ) : credits !== null &&
                credits < 1 ? (
                <>
                  <span>✦</span>
                  No Credits
                </>
              ) : (
                <>
                  <span>✦</span>
                  Generate Image
                </>
              )}
            </button>

            {/* Cost */}
            <div className="mt-3 text-center">
              <span className="text-[10px] text-white/20">
                This generation uses 1.00 Image Credit
              </span>
            </div>
          </div>

          {/* Preview panel */}
          <div className="relative min-h-[430px] overflow-hidden rounded-[28px] border border-white/[0.08] bg-white/[0.02]">

            {loading ? (
              <div className="flex h-full min-h-[430px] items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-white" />
                  </div>

                  <p className="text-sm font-medium text-white/70">
                    Creating your image
                  </p>

                  <p className="mx-auto mt-2 max-w-xs text-xs leading-5 text-white/30">
                    ZUQEN is transforming your prompt into a
                    visual. This may take a moment.
                  </p>
                </div>
              </div>
            ) : image ? (
              <div className="flex h-full flex-col">

                <div className="relative flex flex-1 items-center justify-center bg-black/20 p-3">
                  <img
                    src={image}
                    alt={prompt}
                    className="max-h-[650px] w-full rounded-2xl object-contain"
                  />
                </div>

                <div className="border-t border-white/[0.08] bg-black/20 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/25">
                        Generated by ZUQEN
                      </p>

                      <p className="mt-1 truncate text-xs text-white/45">
                        {prompt}
                      </p>

                      <p className="mt-1 text-[10px] text-white/20">
                        1.00 Image Credit used
                        {credits !== null
                          ? ` · ${credits.toFixed(2)} remaining`
                          : ""}
                      </p>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={clearImage}
                        className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2 text-xs text-white/60 transition hover:bg-white/[0.08] hover:text-white"
                      >
                        New
                      </button>

                      <button
                        type="button"
                        onClick={generateImage}
                        disabled={
                          loading ||
                          (credits !== null &&
                            credits < 1)
                        }
                        className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2 text-xs text-white/60 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        ↻ Regenerate
                      </button>

                      <button
                        type="button"
                        onClick={downloadImage}
                        className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black transition hover:bg-white/90"
                      >
                        ↓ Download
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[430px] items-center justify-center">
                <div className="px-6 text-center">
                  <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[24px] border border-white/[0.07] bg-white/[0.025] text-2xl text-white/20">
                    ◇
                  </div>

                  <h3 className="text-sm font-medium text-white/55">
                    Your creation will appear here
                  </h3>

                  <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-white/25">
                    Write a prompt on the left and generate
                    your first image with ZUQEN.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-auto pt-14 text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/15">
            ZUQEN · Create beyond the obvious
          </p>
        </footer>
      </div>
    </main>
  );
}