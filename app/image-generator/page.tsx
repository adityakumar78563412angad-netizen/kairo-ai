"use client";

import { useState } from "react";

export default function ImageGeneratorPage() {
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resultText, setResultText] = useState("");

  async function generateImage() {
    const trimmedPrompt = prompt.trim();

    if (!trimmedPrompt || loading) return;

    setLoading(true);
    setError("");
    setImage(null);
    setResultText("");

    try {
      const response = await fetch(
        "/api/image-generator",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: trimmedPrompt,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "Image generation failed."
        );
      }

      if (!result.image) {
        throw new Error(
          "No image was returned by the AI."
        );
      }

      setImage(result.image);
      setResultText(result.text || "");
    } catch (err) {
      console.error(
        "Image generation failed:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Image generation failed."
      );
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

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8">
        {/* Header */}
        <header className="mb-10 flex items-center justify-between">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
          >
            ← Back
          </button>

          <div className="text-center">
            <div className="text-xs font-medium uppercase tracking-[0.3em] text-white/40">
              ZUQEN
            </div>

            <h1 className="mt-1 text-xl font-semibold">
              Image Generator
            </h1>
          </div>

          <div className="w-[70px]" />
        </header>

        {/* Hero */}
        <section className="mx-auto w-full max-w-3xl text-center">
          <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-2xl shadow-2xl">
            ✦
          </div>

          <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Turn your ideas into
            <span className="ml-2 bg-gradient-to-r from-white via-white/80 to-white/40 bg-clip-text text-transparent">
              images.
            </span>
          </h2>

          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/50 sm:text-base">
            Describe anything you want to create and
            ZUQEN will transform your idea into an image.
          </p>
        </section>

        {/* Prompt */}
        <section className="mx-auto mt-12 w-full max-w-3xl">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4 shadow-2xl backdrop-blur-xl">
            <textarea
              value={prompt}
              onChange={(event) => {
                setPrompt(
                  event.target.value.slice(0, 1000)
                );
                setError("");
              }}
              placeholder="Describe the image you want to create..."
              rows={6}
              disabled={loading}
              className="w-full resize-none rounded-2xl border border-white/5 bg-black/30 p-5 text-sm leading-6 text-white outline-none placeholder:text-white/25 focus:border-white/15 disabled:opacity-50"
            />

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-white/30">
                {prompt.length}/1000 characters
              </div>

              <button
                type="button"
                onClick={generateImage}
                disabled={!prompt.trim() || loading}
                className="rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-30"
              >
                {loading
                  ? "✦ Generating..."
                  : "✦ Generate Image"}
              </button>
            </div>
          </div>
        </section>

        {/* Error */}
        {error && (
          <div className="mx-auto mt-5 w-full max-w-3xl rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-300">
            ⚠️ {error}
          </div>
        )}

        {/* Result */}
        <section className="mx-auto mt-8 w-full max-w-3xl">
          {loading ? (
            <div className="flex min-h-[360px] items-center justify-center rounded-3xl border border-white/10 bg-white/[0.02]">
              <div className="text-center">
                <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-white" />

                <h3 className="text-sm font-medium text-white/70">
                  Creating your image...
                </h3>

                <p className="mt-2 text-xs text-white/30">
                  ZUQEN is turning your prompt into an image.
                </p>
              </div>
            </div>
          ) : image ? (
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
              <div className="relative">
                <img
                  src={image}
                  alt={prompt}
                  className="block h-auto w-full"
                />
              </div>

              <div className="flex flex-col gap-4 border-t border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-wider text-white/30">
                    Generated by ZUQEN
                  </div>

                  <p className="mt-1 truncate text-sm text-white/60">
                    {prompt}
                  </p>

                  {resultText && (
                    <p className="mt-2 text-xs text-white/30">
                      {resultText}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={generateImage}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
                  >
                    ↻ Regenerate
                  </button>

                  <button
                    type="button"
                    onClick={downloadImage}
                    className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90"
                  >
                    ↓ Download
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[360px] items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02]">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-xl text-white/40">
                  ◇
                </div>

                <h3 className="text-sm font-medium text-white/60">
                  Your generated image will appear here
                </h3>

                <p className="mt-2 text-xs text-white/30">
                  Enter a prompt above to get started.
                </p>
              </div>
            </div>
          )}
        </section>

        <footer className="mt-auto pt-10 text-center text-xs text-white/20">
          ZUQEN · Create beyond the obvious
        </footer>
      </div>
    </main>
  );
}