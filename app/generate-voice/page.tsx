"use client";

import { useEffect, useState } from "react";

type Voice = {
  id: string;
  name: string;
  description: string;
  previewUrl: string | null;
};

export default function GenerateVoicePage() {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState("");
  const [text, setText] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const [loadingVoices, setLoadingVoices] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadVoices = async () => {
      try {
        setLoadingVoices(true);
        setError("");

        const response = await fetch("/api/voices", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load voices.");
        }

        const data = await response.json();

        if (!data.voices || data.voices.length === 0) {
          throw new Error("No ElevenLabs voices were found.");
        }

        setVoices(data.voices);
        setSelectedVoice(data.voices[0].id);
      } catch (err) {
        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load ElevenLabs voices."
        );
      } finally {
        setLoadingVoices(false);
      }
    };

    loadVoices();
  }, []);

  const generateVoice = async () => {
    if (!text.trim()) {
      setError("Please enter some text first.");
      return;
    }

    if (!selectedVoice) {
      setError("Please select a voice.");
      return;
    }

    setLoading(true);
    setError("");

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }

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
          {/* Text */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <label
                htmlFor="voice-text"
                className="text-sm font-semibold"
              >
                Text to speak
              </label>

              <span className="text-xs text-white/40">
                {text.length} / 5000
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

          {/* Voices */}
          <div className="mt-8">
            <div className="mb-4">
              <h2 className="text-sm font-semibold">
                Choose a voice
              </h2>

              <p className="mt-1 text-xs text-white/40">
                Voices are loaded directly from your ElevenLabs account.
              </p>
            </div>

            {loadingVoices ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6 text-center">
                <div className="mx-auto mb-3 h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />

                <p className="text-sm text-white/50">
                  Loading ElevenLabs voices...
                </p>
              </div>
            ) : voices.length > 0 ? (
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

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">
                            {voice.name}
                          </p>

                          <p className="mt-1 truncate text-xs text-white/40">
                            {voice.description ||
                              "ElevenLabs voice"}
                          </p>
                        </div>

                        <div
                          className={`h-4 w-4 shrink-0 rounded-full border ${
                            active
                              ? "border-white bg-white"
                              : "border-white/25"
                          }`}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          {/* Error */}
          {error && (
            <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Generate */}
          <button
            type="button"
            onClick={generateVoice}
            disabled={
              loading ||
              loadingVoices ||
              !text.trim() ||
              !selectedVoice
            }
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-sm font-bold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                Generating voice...
              </>
            ) : (
              <>✨ Generate Voice</>
            )}
          </button>

          {/* Audio */}
          {audioUrl && (
            <div className="mt-8 rounded-2xl border border-white/10 bg-black/30 p-5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold">
                    Generated Voice
                  </h2>

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

        <div className="mt-8 text-center">
          <p className="text-xs text-white/25">
            Powered by ZUQEN AI
          </p>
        </div>
      </div>
    </main>
  );
}