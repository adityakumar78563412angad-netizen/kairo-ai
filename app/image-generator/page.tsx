"use client";

import { useState } from "react";

export default function ImageGeneratorPage() {
  const [prompt, setPrompt] = useState("");

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
            Describe anything you want to create and ZUQEN will
            transform your idea into an image.
          </p>
        </section>

        {/* Generator Box */}
        <section className="mx-auto mt-12 w-full max-w-3xl">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4 shadow-2xl backdrop-blur-xl">
            <textarea
              value={prompt}
              onChange={(event) =>
                setPrompt(event.target.value)
              }
              placeholder="Describe the image you want to create..."
              rows={6}
              className="w-full resize-none rounded-2xl border border-white/5 bg-black/30 p-5 text-sm leading-6 text-white outline-none placeholder:text-white/25 focus:border-white/15"
            />

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-white/30">
                {prompt.length}/1000 characters
              </div>

              <button
                type="button"
                disabled={!prompt.trim()}
                className="rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-30"
              >
                ✦ Generate Image
              </button>
            </div>
          </div>
        </section>

        {/* Empty Preview */}
        <section className="mx-auto mt-8 w-full max-w-3xl">
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
        </section>

        <footer className="mt-auto pt-10 text-center text-xs text-white/20">
          ZUQEN · Create beyond the obvious
        </footer>
      </div>
    </main>
  );
}