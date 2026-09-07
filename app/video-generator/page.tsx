"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

export default function VideoGeneratorPage() {
  const router = useRouter();

  const [prompt, setPrompt] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(
    null
  );

  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  async function generateVideo() {
    const cleanPrompt = prompt.trim();

    if (!cleanPrompt) {
      setError("Please describe the video you want to create.");
      return;
    }

    setLoading(true);
    setError("");

    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
      setVideoUrl("");
    }

    try {
      const response = await fetch(
        "/api/video-generator",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: cleanPrompt,
          }),
        }
      );

      if (!response.ok) {
        let message =
          "Video generation failed.";

        try {
          const data = await response.json();

          if (data?.error) {
            message = data.error;
          }
        } catch {
          // Ignore invalid JSON response.
        }

        throw new Error(message);
      }

      const blob = await response.blob();

      if (!blob.size) {
        throw new Error(
          "No video was returned by the AI model."
        );
      }

      const url = URL.createObjectURL(blob);

      setVideoUrl(url);
    } catch (err: unknown) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Video generation failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  function clearVideo() {
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }

    setVideoUrl("");
    setError("");
  }

  async function copyPrompt() {
    if (!prompt.trim()) return;

    try {
      await navigator.clipboard.writeText(
        prompt.trim()
      );

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch {
      // Clipboard unavailable.
    }
  }

  function downloadVideo() {
    if (!videoUrl) return;

    const link = document.createElement("a");

    link.href = videoUrl;
    link.download = "zuqen-ai-video.mp4";

    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto min-h-screen max-w-7xl px-4 py-5 sm:px-6 lg:px-8">

        {/* HEADER */}
        <header className="mb-8 flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="group flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-lg transition group-hover:bg-white/[0.1]">
              ←
            </div>

            <div className="text-left">
              <div className="text-lg font-bold tracking-tight">
                ZUQEN
              </div>

              <div className="text-xs text-white/40">
                AI Video Generator
              </div>
            </div>
          </button>

          <div className="hidden rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-white/50 sm:block">
            Powered by Hugging Face
          </div>
        </header>

        {/* HERO */}
        <section className="mb-10">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/60">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Text to Video
          </div>

          <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Turn your ideas into
            <span className="block bg-gradient-to-r from-white via-white/80 to-white/40 bg-clip-text text-transparent">
              AI-generated videos.
            </span>
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/45 sm:text-base">
            Describe a scene, character, cinematic shot,
            animation or story. ZUQEN will turn your prompt
            into a video.
          </p>
        </section>

        {/* MAIN GRID */}
        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">

          {/* PROMPT PANEL */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/30 sm:p-6">

            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  Create video
                </h2>

                <p className="mt-1 text-xs text-white/35">
                  Describe what you want to see.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/35">
                AI
              </div>
            </div>

            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) =>
                  setPrompt(e.target.value.slice(0, 1000))
                }
                placeholder="Example: A cinematic drone shot flying over a futuristic city at sunset, glowing buildings, flying cars, realistic lighting..."
                className="min-h-[250px] w-full resize-none rounded-2xl border border-white/10 bg-black/30 p-5 pr-12 text-sm leading-7 text-white outline-none placeholder:text-white/20 focus:border-white/20"
              />

              <button
                type="button"
                onClick={copyPrompt}
                disabled={!prompt.trim()}
                className="absolute right-3 top-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/45 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-30"
              >
                {copied ? "Copied" : "Copy"}
              </button>

              <div className="pointer-events-none absolute bottom-4 right-4 text-[11px] text-white/25">
                {prompt.length}/1000
              </div>
            </div>

            {/* EXAMPLES */}
            <div className="mt-4">
              <p className="mb-2 text-[11px] uppercase tracking-wider text-white/25">
                Try an idea
              </p>

              <div className="flex flex-wrap gap-2">
                {[
                  "A futuristic city at night",
                  "A dragon flying above mountains",
                  "Ocean waves during a storm",
                  "A cinematic space journey",
                ].map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() =>
                      setPrompt(example)
                    }
                    className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/45 transition hover:bg-white/[0.07] hover:text-white/70"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-500/[0.06] p-4 text-sm leading-6 text-red-300">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={generateVideo}
              disabled={loading || !prompt.trim()}
              className="mt-6 flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-5 py-4 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />
                  Generating video...
                </>
              ) : (
                <>
                  <span className="text-base">
                    ✦
                  </span>
                  Generate Video
                </>
              )}
            </button>

            <p className="mt-3 text-center text-[11px] text-white/25">
              Generation can take some time depending on
              model availability.
            </p>
          </div>

          {/* PREVIEW PANEL */}
          <div className="relative flex min-h-[560px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#090909]">

            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold">
                  Preview
                </h2>

                <p className="mt-0.5 text-[11px] text-white/30">
                  Your generated video
                </p>
              </div>

              {videoUrl && !loading && (
                <button
                  type="button"
                  onClick={clearVideo}
                  className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/40 hover:bg-white/[0.05] hover:text-white/70"
                >
                  New video
                </button>
              )}
            </div>

            <div className="relative flex flex-1 items-center justify-center p-5">

              {loading ? (
                <div className="flex flex-col items-center text-center">
                  <div className="relative mb-7 flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
                    <div className="absolute inset-2 animate-spin rounded-full border-2 border-transparent border-t-white/70" />

                    <span className="text-2xl">
                      ✦
                    </span>
                  </div>

                  <h3 className="text-base font-semibold">
                    Creating your video
                  </h3>

                  <p className="mt-2 max-w-sm text-xs leading-6 text-white/35">
                    ZUQEN is turning your prompt into
                    an AI-generated video. This can take
                    a little while.
                  </p>
                </div>
              ) : videoUrl ? (
                <div className="w-full max-w-2xl">
                  <div className="overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
                    <video
                      ref={videoRef}
                      src={videoUrl}
                      controls
                      playsInline
                      className="max-h-[520px] w-full object-contain"
                    />
                  </div>

                  <div className="mt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={downloadVideo}
                      className="flex-1 rounded-xl bg-white px-4 py-3 text-xs font-semibold text-black transition hover:bg-white/90"
                    >
                      Download Video
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPrompt("");
                        clearVideo();
                      }}
                      className="rounded-xl border border-white/10 px-5 py-3 text-xs text-white/50 transition hover:bg-white/[0.05] hover:text-white"
                    >
                      Create New
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex max-w-sm flex-col items-center text-center">

                  <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.025]">
                    <div className="text-4xl text-white/20">
                      ▶
                    </div>
                  </div>

                  <h3 className="text-base font-semibold text-white/75">
                    Your video will appear here
                  </h3>

                  <p className="mt-2 text-xs leading-6 text-white/30">
                    Write a prompt on the left and click
                    Generate Video to create your first
                    AI video.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* FOOTER INFO */}
        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            [
              "01",
              "Describe",
              "Tell ZUQEN what video you want.",
            ],
            [
              "02",
              "Generate",
              "The AI creates your video.",
            ],
            [
              "03",
              "Download",
              "Save your generated video.",
            ],
          ].map(([number, title, text]) => (
            <div
              key={number}
              className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"
            >
              <div className="mb-3 text-[10px] text-white/20">
                {number}
              </div>

              <div className="text-sm font-medium">
                {title}
              </div>

              <div className="mt-1 text-xs leading-5 text-white/30">
                {text}
              </div>
            </div>
          ))}
        </section>

      </div>
    </main>
  );
}