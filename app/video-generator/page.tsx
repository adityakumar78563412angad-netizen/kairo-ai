
"use client";

import { useEffect, useMemo, useState } from "react";
import puter from "@heyputer/puter.js";
import { createClient } from "@/lib/supabase";

type ModelOption = {
  id: string;
  name: string;
  description: string;
  durations: number[];
  sizes: string[];
};

const MODELS: ModelOption[] = [
  {
    id: "google/veo-3.1-lite",
    name: "Veo 3.1 Lite",
    description: "Fast cinematic video generation with native audio.",
    durations: [4, 6, 8],
    sizes: ["1280x720", "720x1280", "1920x1080", "1080x1920"],
  },
  {
    id: "vidu/vidu-q3-turbo",
    name: "Vidu Q3 Turbo",
    description: "Fast video generation with optional synchronized audio.",
    durations: [5, 8, 10, 12, 16],
    sizes: ["1280x720", "720x1280", "1920x1080", "1080x1920"],
  },
];

const VIDEO_CREDIT_COST = 1;

export default function VideoGeneratorPage() {
  const supabase = useMemo(() => createClient(), []);

  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState(MODELS[0].id);
  const [seconds, setSeconds] = useState(4);
  const [size, setSize] = useState("1280x720");

  const [videoUrl, setVideoUrl] = useState("");
  const [videoBlobUrl, setVideoBlobUrl] = useState("");

  const [credits, setCredits] = useState<number | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedModel =
    MODELS.find((item) => item.id === model) ?? MODELS[0];

  const characterCount = prompt.length;
  const canGenerate =
    prompt.trim().length >= 10 && !loading && credits !== null && credits >= VIDEO_CREDIT_COST;

  useEffect(() => {
    loadUserAndCredits();

    return () => {
      if (videoBlobUrl) {
        URL.revokeObjectURL(videoBlobUrl);
      }
    };
  }, []);

  useEffect(() => {
    const validDuration = selectedModel.durations.includes(seconds);

    if (!validDuration) {
      setSeconds(selectedModel.durations[0]);
    }

    const validSize = selectedModel.sizes.includes(size);

    if (!validSize) {
      setSize(selectedModel.sizes[0]);
    }
  }, [selectedModel, seconds, size]);

  async function loadUserAndCredits() {
    try {
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        setError("Please sign in to use Text-to-Video.");
        return;
      }

      setUserId(user.id);
      setIsAnonymous(Boolean(user.is_anonymous));

      if (user.is_anonymous) {
        setCredits(0);
        setError("Please sign in to generate videos.");
        return;
      }

      await loadCredits(user.id);
    } catch (err: any) {
      console.error("Auth/Credit loading error:", err);

      setError(
        err?.message || "Unable to load your ZUQEN Video Credits."
      );
    }
  }

  async function loadCredits(currentUserId = userId) {
    if (!currentUserId) return;

    const { data, error: creditError } = await supabase
      .from("feature_credit_balances")
      .select("balance")
      .eq("user_id", currentUserId)
      .eq("feature_key", "video_generator")
      .maybeSingle();

    if (creditError) {
      throw creditError;
    }

    setCredits(Number(data?.balance ?? 0));
  }

  async function reserveCredit() {
    if (!userId) {
      throw new Error("Please sign in to generate videos.");
    }

    const { data, error: rpcError } = await supabase.rpc(
      "reserve_feature_credits",
      {
        p_user_id: userId,
        p_feature_key: "video_generator",
        p_amount: VIDEO_CREDIT_COST,
        p_provider_request_id: null,
        p_reference_id: `video-generation:${crypto.randomUUID()}`,
        p_metadata: {
          model,
          seconds,
          size,
          source: "puter",
        },
      }
    );

    if (rpcError) {
      throw rpcError;
    }

    if (!data?.success) {
      throw new Error(
        data?.message ||
          data?.error ||
          "You do not have enough ZUQEN Video Credits."
      );
    }

    return data.reservation_id as string;
  }

  async function settleCredit(reservationId: string) {
    const { data, error: rpcError } = await supabase.rpc(
      "settle_feature_credit_reservation",
      {
        p_reservation_id: reservationId,
        p_actual_amount: VIDEO_CREDIT_COST,
        p_provider_request_id: null,
        p_description: "Puter Text-to-Video generation",
        p_reference_id: `video:${crypto.randomUUID()}`,
        p_metadata: {
          provider: "puter",
          model,
          seconds,
          size,
        },
      }
    );

    if (rpcError) {
      throw rpcError;
    }

    if (!data?.success) {
      throw new Error(
        data?.message ||
          data?.error ||
          "Video was generated, but credit settlement failed."
      );
    }
  }

  async function refundCredit(reservationId: string) {
    try {
      const { error: rpcError } = await supabase.rpc(
        "refund_feature_credit_reservation",
        {
          p_reservation_id: reservationId,
          p_provider_request_id: null,
          p_description: "Puter Text-to-Video generation failed",
          p_reference_id: `video-refund:${crypto.randomUUID()}`,
          p_metadata: {
            provider: "puter",
            model,
            seconds,
            size,
          },
        }
      );

      if (rpcError) {
        console.error("Credit refund error:", rpcError);
      }
    } catch (refundError) {
      console.error("Credit refund exception:", refundError);
    }
  }

  function getErrorMessage(err: any) {
    const message =
      err?.message ||
      err?.error?.message ||
      err?.error ||
      "Something went wrong while generating your video.";

    const lower = String(message).toLowerCase();

    if (
      lower.includes("insufficient funds") ||
      lower.includes("remaining") ||
      lower.includes("not enough")
    ) {
      return "Puter does not have enough available AI balance for this model. Your ZUQEN Video Credit is not charged when the provider rejects the generation.";
    }

    if (lower.includes("sign in")) {
      return "Please sign in to your Puter account before generating a real video.";
    }

    return String(message);
  }

  async function generateVideo() {
    if (!userId) {
      setError("Please sign in to use Text-to-Video.");
      return;
    }

    if (isAnonymous) {
      setError("Please sign in to generate videos.");
      return;
    }

    if (!prompt.trim()) {
      setError("Please describe the video you want to create.");
      return;
    }

    if (prompt.trim().length < 10) {
      setError("Please enter a more detailed video prompt.");
      return;
    }

    if (credits === null || credits < VIDEO_CREDIT_COST) {
      setError(
        `You need ${VIDEO_CREDIT_COST.toFixed(
          2
        )} ZUQEN Video Credit to generate a video.`
      );
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    setVideoUrl("");

    if (videoBlobUrl) {
      URL.revokeObjectURL(videoBlobUrl);
      setVideoBlobUrl("");
    }

    let reservationId: string | null = null;

    try {
      setLoadingStage("Reserving ZUQEN Video Credit...");

      reservationId = await reserveCredit();

      setLoadingStage("Connecting to Puter AI...");

      const video = await puter.ai.txt2vid(prompt.trim(), {
        model,
        seconds,
        size,
      });

      if (!video || !video.src) {
        throw new Error("Puter did not return a generated video.");
      }

      setLoadingStage("Preparing your video...");

      const sourceUrl = video.src;

      setVideoUrl(sourceUrl);

      setLoadingStage("Finalizing ZUQEN Credit...");

      await settleCredit(reservationId);
      reservationId = null;

      await loadCredits();

      setSuccess("Video generated successfully.");
      setLoadingStage("");
    } catch (err: any) {
      console.error("Text-to-Video error:", err);

      if (reservationId) {
        await refundCredit(reservationId);
      }

      setLoadingStage("");
      setError(getErrorMessage(err));

      await loadCredits().catch(() => {});
    } finally {
      setLoading(false);
    }
  }

  async function runTestVideo() {
    setLoading(true);
    setError("");
    setSuccess("");
    setVideoUrl("");

    if (videoBlobUrl) {
      URL.revokeObjectURL(videoBlobUrl);
      setVideoBlobUrl("");
    }

    try {
      setLoadingStage("Creating a free Puter test video...");

      const video = await puter.ai.txt2vid(
        prompt.trim() ||
          "A cinematic aerial shot of a futuristic city at sunset",
        {
          model,
          seconds,
          size,
          test_mode: true,
        }
      );

      if (!video || !video.src) {
        throw new Error("Puter did not return the test video.");
      }

      setVideoUrl(video.src);
      setSuccess("Test video generated. No ZUQEN Video Credit was used.");
      setLoadingStage("");
    } catch (err: any) {
      console.error("Puter test error:", err);

      setLoadingStage("");
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function resetGenerator() {
    setPrompt("");
    setVideoUrl("");
    setSuccess("");
    setError("");

    if (videoBlobUrl) {
      URL.revokeObjectURL(videoBlobUrl);
      setVideoBlobUrl("");
    }

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function downloadVideo() {
    if (!videoUrl) return;

    try {
      const response = await fetch(videoUrl);

      if (!response.ok) {
        throw new Error("Unable to download the video.");
      }

      const blob = await response.blob();
      const localUrl = URL.createObjectURL(blob);

      const anchor = document.createElement("a");
      anchor.href = localUrl;
      anchor.download = "zuqen-generated-video.mp4";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      URL.revokeObjectURL(localUrl);
    } catch (err) {
      console.error("Download error:", err);

      const anchor = document.createElement("a");
      anchor.href = videoUrl;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.download = "zuqen-generated-video.mp4";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    }
  }

  return (
    <main className="video-page">
      <div className="video-shell">
        <header className="video-header">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              ZUQEN AI
            </div>

            <h1>Text to Video</h1>

            <p>
              Turn your ideas into cinematic AI videos with natural motion,
              camera direction and sound.
            </p>
          </div>

          <div className="credit-pill">
            <span className="credit-icon">✦</span>
            <span>
              {credits === null ? "—" : credits.toFixed(2)} Video Credits
            </span>
          </div>
        </header>

        <section className="generator-grid">
          <div className="control-card">
            <div className="card-heading">
              <div>
                <span className="section-kicker">CREATE</span>
                <h2>Describe your video</h2>
              </div>

              <span className="credit-cost">
                − {VIDEO_CREDIT_COST.toFixed(2)} credit
              </span>
            </div>

            <div className="field">
              <div className="field-top">
                <label htmlFor="video-prompt">Prompt</label>
                <span>{characterCount}/2000</span>
              </div>

              <textarea
                id="video-prompt"
                maxLength={2000}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Example: A cinematic drone shot flying above a futuristic city at golden hour, flying cars moving between glass skyscrapers, soft atmospheric haze, realistic lighting, smooth camera movement..."
                disabled={loading}
              />
            </div>

            <div className="settings-title">
              <span>Generation settings</span>
            </div>

            <div className="settings-grid">
              <div className="setting">
                <label>Model</label>

                <select
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  disabled={loading}
                >
                  {MODELS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>

                <small>{selectedModel.description}</small>
              </div>

              <div className="setting">
                <label>Duration</label>

                <select
                  value={seconds}
                  onChange={(event) => setSeconds(Number(event.target.value))}
                  disabled={loading}
                >
                  {selectedModel.durations.map((value) => (
                    <option key={value} value={value}>
                      {value} seconds
                    </option>
                  ))}
                </select>
              </div>

              <div className="setting setting-wide">
                <label>Aspect ratio & resolution</label>

                <select
                  value={size}
                  onChange={(event) => setSize(event.target.value)}
                  disabled={loading}
                >
                  {selectedModel.sizes.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error && (
              <div className="message error">
                <div className="message-icon">!</div>
                <div>
                  <strong>Generation failed</strong>
                  <p>{error}</p>
                </div>
              </div>
            )}

            {success && (
              <div className="message success">
                <div className="message-icon">✓</div>
                <div>
                  <strong>Ready</strong>
                  <p>{success}</p>
                </div>
              </div>
            )}

            <div className="action-row">
              <button
                className="test-button"
                onClick={runTestVideo}
                disabled={loading}
              >
                {loading ? "Working..." : "Test for free"}
              </button>

              <button
                className="generate-button"
                onClick={generateVideo}
                disabled={!canGenerate}
              >
                {loading ? (
                  <>
                    <span className="spinner" />
                    {loadingStage || "Generating..."}
                  </>
                ) : (
                  <>
                    Generate video
                    <span>→</span>
                  </>
                )}
              </button>
            </div>

            <div className="credit-note">
              <span>✦</span>
              <p>
                Real generation uses <strong>1.00 ZUQEN Video Credit</strong>.
                Failed provider generations are automatically refunded.
              </p>
            </div>
          </div>

          <div className="preview-card">
            <div className="preview-top">
              <div>
                <span className="section-kicker">PREVIEW</span>
                <h2>Your video</h2>
              </div>

              {videoUrl && (
                <button className="new-button" onClick={resetGenerator}>
                  New video
                </button>
              )}
            </div>

            <div className={`video-preview ${!videoUrl ? "empty" : ""}`}>
              {videoUrl ? (
                <video
                  key={videoUrl}
                  src={videoUrl}
                  controls
                  playsInline
                  autoPlay
                  loop
                />
              ) : loading ? (
                <div className="generating-state">
                  <div className="loader-ring" />
                  <strong>Creating your video</strong>
                  <span>{loadingStage || "Please wait..."}</span>
                </div>
              ) : (
                <div className="empty-state">
                  <div className="video-symbol">
                    <span />
                  </div>

                  <strong>Your generated video will appear here</strong>

                  <p>
                    Enter a prompt and generate a video to see the result.
                  </p>
                </div>
              )}
            </div>

            {videoUrl && (
              <div className="preview-actions">
                <button className="download-button" onClick={downloadVideo}>
                  <span>↓</span>
                  Download video
                </button>

                <button className="secondary-button" onClick={generateVideo}>
                  Regenerate
                </button>
              </div>
            )}
          </div>
        </section>

        <footer className="video-footer">
          <span>Powered by Puter AI</span>
          <span>•</span>
          <span>Credits managed by ZUQEN</span>
        </footer>
      </div>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .video-page {
          min-height: 100vh;
          background:
            radial-gradient(
              circle at 15% 0%,
              rgba(115, 86, 255, 0.13),
              transparent 32%
            ),
            radial-gradient(
              circle at 90% 15%,
              rgba(45, 180, 255, 0.08),
              transparent 30%
            ),
            #07070a;
          color: #f5f5f7;
          padding: 42px 24px 70px;
        }

        .video-shell {
          width: min(1240px, 100%);
          margin: 0 auto;
        }

        .video-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 30px;
          margin-bottom: 34px;
        }

        .eyebrow {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #a8a4b8;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.18em;
          margin-bottom: 13px;
        }

        .eyebrow-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #9b7cff;
          box-shadow: 0 0 14px rgba(155, 124, 255, 0.8);
        }

        .video-header h1 {
          margin: 0;
          font-size: clamp(34px, 5vw, 58px);
          line-height: 1;
          letter-spacing: -0.045em;
          font-weight: 750;
        }

        .video-header p {
          max-width: 640px;
          color: #94939e;
          font-size: 15px;
          line-height: 1.7;
          margin: 15px 0 0;
        }

        .credit-pill {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 11px 15px;
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.045);
          color: #dedbe8;
          font-size: 13px;
          font-weight: 650;
          backdrop-filter: blur(16px);
        }

        .credit-icon {
          color: #ad92ff;
          font-size: 16px;
        }

        .generator-grid {
          display: grid;
          grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
          gap: 20px;
        }

        .control-card,
        .preview-card {
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(15, 15, 20, 0.82);
          border-radius: 22px;
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.28);
          backdrop-filter: blur(20px);
        }

        .control-card {
          padding: 25px;
        }

        .preview-card {
          padding: 18px;
          min-width: 0;
        }

        .card-heading,
        .preview-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 15px;
        }

        .section-kicker {
          display: block;
          color: #8d879f;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.16em;
          margin-bottom: 7px;
        }

        .card-heading h2,
        .preview-top h2 {
          margin: 0;
          font-size: 20px;
          letter-spacing: -0.025em;
        }

        .credit-cost {
          padding: 7px 10px;
          border-radius: 8px;
          background: rgba(155, 124, 255, 0.1);
          color: #b8a3ff;
          font-size: 11px;
          font-weight: 700;
        }

        .field {
          margin-top: 25px;
        }

        .field-top {
          display: flex;
          justify-content: space-between;
          margin-bottom: 9px;
        }

        .field label,
        .setting label {
          color: #d9d6e1;
          font-size: 12px;
          font-weight: 650;
        }

        .field-top span {
          color: #65636e;
          font-size: 11px;
        }

        textarea {
          width: 100%;
          min-height: 190px;
          resize: vertical;
          padding: 16px;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(5, 5, 8, 0.76);
          color: #f4f2f7;
          outline: none;
          font: inherit;
          font-size: 14px;
          line-height: 1.65;
          transition: 0.2s ease;
        }

        textarea:focus {
          border-color: rgba(155, 124, 255, 0.55);
          box-shadow: 0 0 0 3px rgba(155, 124, 255, 0.08);
        }

        textarea::placeholder {
          color: #575660;
        }

        .settings-title {
          margin: 23px 0 12px;
          color: #8f8d98;
          font-size: 11px;
          font-weight: 750;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .settings-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .setting {
          min-width: 0;
        }

        .setting-wide {
          grid-column: 1 / -1;
        }

        .setting label {
          display: block;
          margin-bottom: 7px;
        }

        select {
          width: 100%;
          height: 43px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 11px;
          padding: 0 12px;
          background: #0b0b0f;
          color: #e9e7ee;
          outline: none;
          font: inherit;
          font-size: 12px;
        }

        select:focus {
          border-color: rgba(155, 124, 255, 0.45);
        }

        .setting small {
          display: block;
          color: #686671;
          font-size: 10px;
          line-height: 1.45;
          margin-top: 6px;
        }

        .message {
          display: flex;
          align-items: flex-start;
          gap: 11px;
          margin-top: 18px;
          padding: 12px 13px;
          border-radius: 12px;
          font-size: 12px;
        }

        .message.error {
          border: 1px solid rgba(255, 91, 91, 0.16);
          background: rgba(255, 70, 70, 0.055);
          color: #ffb1b1;
        }

        .message.success {
          border: 1px solid rgba(74, 220, 147, 0.16);
          background: rgba(74, 220, 147, 0.05);
          color: #a8eac9;
        }

        .message-icon {
          display: grid;
          place-items: center;
          flex: 0 0 21px;
          width: 21px;
          height: 21px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.07);
          font-weight: 800;
        }

        .message strong {
          display: block;
          margin-bottom: 3px;
        }

        .message p {
          margin: 0;
          opacity: 0.78;
          line-height: 1.5;
        }

        .action-row {
          display: grid;
          grid-template-columns: 0.72fr 1.28fr;
          gap: 10px;
          margin-top: 20px;
        }

        .test-button,
        .generate-button,
        .download-button,
        .secondary-button,
        .new-button {
          border: 0;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .test-button {
          min-height: 49px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.045);
          color: #d5d2dc;
        }

        .test-button:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.08);
        }

        .generate-button {
          min-height: 49px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          border-radius: 12px;
          background: #f5f3fa;
          color: #09090c;
          padding: 0 18px;
        }

        .generate-button:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 10px 28px rgba(255, 255, 255, 0.1);
        }

        .generate-button:disabled,
        .test-button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          transform: none;
        }

        .spinner {
          width: 15px;
          height: 15px;
          border-radius: 50%;
          border: 2px solid rgba(0, 0, 0, 0.2);
          border-top-color: #111;
          animation: spin 0.7s linear infinite;
        }

        .credit-note {
          display: flex;
          gap: 8px;
          margin-top: 13px;
          color: #686671;
          font-size: 10px;
          line-height: 1.5;
        }

        .credit-note span {
          color: #a78cff;
        }

        .credit-note p {
          margin: 0;
        }

        .credit-note strong {
          color: #8d8997;
        }

        .new-button {
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 9px;
          background: rgba(255, 255, 255, 0.045);
          color: #aaa7b2;
          padding: 8px 11px;
          font-size: 11px;
        }

        .new-button:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
        }

        .video-preview {
          position: relative;
          overflow: hidden;
          min-height: 515px;
          margin-top: 16px;
          border-radius: 16px;
          background: #030304;
          border: 1px solid rgba(255, 255, 255, 0.06);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .video-preview video {
          width: 100%;
          height: 100%;
          min-height: 515px;
          max-height: 650px;
          object-fit: contain;
          background: #000;
        }

        .video-preview.empty {
          background:
            radial-gradient(
              circle at center,
              rgba(155, 124, 255, 0.08),
              transparent 40%
            ),
            #050507;
        }

        .empty-state,
        .generating-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 30px;
        }

        .empty-state strong,
        .generating-state strong {
          margin-top: 18px;
          color: #cbc8d2;
          font-size: 13px;
        }

        .empty-state p,
        .generating-state span {
          max-width: 330px;
          margin: 8px 0 0;
          color: #65636e;
          font-size: 11px;
          line-height: 1.6;
        }

        .video-symbol {
          position: relative;
          width: 58px;
          height: 58px;
          display: grid;
          place-items: center;
          border-radius: 17px;
          border: 1px solid rgba(155, 124, 255, 0.18);
          background: rgba(155, 124, 255, 0.06);
        }

        .video-symbol span {
          width: 0;
          height: 0;
          margin-left: 4px;
          border-top: 8px solid transparent;
          border-bottom: 8px solid transparent;
          border-left: 12px solid #a98dff;
        }

        .loader-ring {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.08);
          border-top-color: #a88bff;
          animation: spin 0.9s linear infinite;
        }

        .preview-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 9px;
          margin-top: 12px;
        }

        .download-button {
          min-height: 44px;
          border-radius: 11px;
          background: #f5f3fa;
          color: #09090c;
        }

        .download-button span {
          margin-right: 7px;
        }

        .secondary-button {
          min-height: 44px;
          border-radius: 11px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.04);
          color: #d0cdd6;
        }

        .download-button:hover,
        .secondary-button:hover {
          transform: translateY(-1px);
        }

        .video-footer {
          display: flex;
          justify-content: center;
          gap: 9px;
          color: #51505a;
          font-size: 10px;
          margin-top: 24px;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 900px) {
          .generator-grid {
            grid-template-columns: 1fr;
          }

          .video-preview,
          .video-preview video {
            min-height: 430px;
          }
        }

        @media (max-width: 640px) {
          .video-page {
            padding: 25px 14px 45px;
          }

          .video-header {
            flex-direction: column;
          }

          .credit-pill {
            width: 100%;
            justify-content: center;
          }

          .control-card {
            padding: 18px;
          }

          .settings-grid,
          .action-row,
          .preview-actions {
            grid-template-columns: 1fr;
          }

          .setting-wide {
            grid-column: auto;
          }

          .video-preview,
          .video-preview video {
            min-height: 320px;
          }

          .video-footer {
            flex-wrap: wrap;
          }
        }
      `}</style>
    </main>
  );
}
