"use client";

import { useState } from "react";

const voices = [
  {
    id: "21m00Tcm4TlvDq8ikWAM",
    name: "Rachel",
    description: "Calm & professional",
  },
  {
    id: "EXAVITQu4vr4xnSDxMaL",
    name: "Bella",
    description: "Warm & friendly",
  },
  {
    id: "ErXwobaYiN019PkySvjV",
    name: "Antoni",
    description: "Deep & confident",
  },
  {
    id: "MF3mGyEYCl7XYWbV9V6O",
    name: "Elli",
    description: "Soft & natural",
  },
];

export default function GenerateVoicePage() {
  const [text, setText] = useState("");
  const [selectedVoice, setSelectedVoice] = useState(voices[0].id);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generateVoice = async () => {
    if (!text.trim()) {
      setError("Please enter some text first.");
      return;
    }

    setLoading(true);
    setError("");
    setAudioUrl(null);

    try {
      const response = await fetch("/api/generate-voice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: text.trim(),
          voiceId: selectedVoice,
        }),
      });

      if (!response.ok) {
        let message = "Failed to generate voice.";

        try {
          const data = await response.json();

          if (data?.error) {
            message = data.error;
          }
        } catch {
          // Ignore JSON parsing errors
        }

        throw new Error(message);
      }

      const audioBlob = await response.blob();

      if (!audioBlob.size) {
        throw new Error("No audio was returned.");
      }

      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while generating the voice."
      );
    } finally {
      setLoading(false);
    }
  };

  const downloadAudio = () => {
    if (!audioUrl) return;

    const link = document.createElement("a");
    link.href = audioUrl;
    link.download = "zuqen-ai-voice.mp3";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto w-full max-w-5xl px-6 py-12">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-3xl shadow-2xl">
            🎙️
          </div>

          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            ZUQEN AI Voice Generator
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-white/50 sm:text-base">
            Turn your text into natural-sounding AI speech with ZUQEN AI.
          </p>
        </div>

        {/* Main Card */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl backdrop-blur-xl sm:p-8">
          {/* Text Input */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <label
                htmlFor="voice-text"
                className="text-sm font-semibold text-white"
              >
                Text to speak
              </label>

              <span className="text-xs text-white/40">
                {text.length} characters
              </span>
            </div>

            <textarea
              id="voice-text"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setError("");
              }}
              placeholder="Type or paste the text you want ZUQEN AI to speak..."
              rows={8}
              maxLength={5000}
              className="w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-sm leading-7 text-white outline-none transition placeholder:text-white/25 focus:border-white/25 focus:bg-black/40"
            />
          </div>

          {/* Voice Selection */}
          <div className="mt-8">
            <div className="mb-4">
              <h2 className="text-sm font-semibold">Choose a voice</h2>
              <p className="mt-1 text-xs text-white/40">
                Select the voice you want to use for your generated audio.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {voices.map((voice) => {
                const active = selectedVoice === voice.id;

                return (
                  <button
                    key={voice.id}
                    type="button"
                    onClick={() => setSelectedVoice(voice.id)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      active
                        ? "border-white/30 bg-white/[0.10]"
                        : "border-white/10 bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.05]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg ${
                          active
                            ? "bg-white text-black"
                            : "bg-white/10 text-white"
                        }`}
                      >
                        🔊
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{voice.name}</p>
                        <p className="mt-1 text-xs text-white/40">
                          {voice.description}
                        </p>
                      </div>

                      <div className="ml-auto">
                        <div
                          className={`h-4 w-4 rounded-full border ${
                            active
                              ? "border-white bg-white"
                              : "border-white/25"
                          }`}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Generate Button */}
          <button
            type="button"
            onClick={generateVoice}
            disabled={loading || !text.trim()}
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-sm font-bold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                Generating voice...
              </>
            ) : (
              <>
                ✨ Generate Voice
              </>
            )}
          </button>

          {/* Audio Result */}
          {audioUrl && (
            <div className="mt-8 rounded-2xl border border-white/10 bg-black/30 p-5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold">Generated Voice</h2>
                  <p className="mt-1 text-xs text-white/40">
                    Your AI-generated audio is ready.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={downloadAudio}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold transition hover:bg-white/10"
                >
                  ⬇️ Download
                </button>
              </div>

              <audio
                src={audioUrl}
                controls
                className="w-full"
              />
            </div>
          )}
        </section>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-white/25">
            Powered by ZUQEN AI
          </p>
        </div>
      </div>
    </main>
  );
}