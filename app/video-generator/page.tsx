
"use client";

import { useState } from "react";
import puter from "@heyputer/puter.js";

export default function VideoGeneratorPage() {
  const [prompt, setPrompt] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generateVideo = async () => {
    const trimmedPrompt = prompt.trim();

    if (!trimmedPrompt) {
      setError("Please enter a video prompt.");
      return;
    }

    setLoading(true);
    setError("");
    setVideoUrl("");

    try {
      const video = await puter.ai.txt2vid(trimmedPrompt, {
        model: "google/veo-3.1-lite",
        seconds: 8,
        size: "1280x720",
      });

      if (!video || !video.src) {
        throw new Error("Puter did not return a video.");
      }

      setVideoUrl(video.src);
    } catch (err: any) {
      console.error("Puter video generation error:", err);

      const message =
        err?.message ||
        err?.error?.message ||
        "Something went wrong while generating the video.";

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#050505",
        color: "#fff",
        padding: "40px 20px",
      }}
    >
      <div
        style={{
          maxWidth: "900px",
          margin: "0 auto",
        }}
      >
        <h1
          style={{
            fontSize: "36px",
            fontWeight: 700,
            marginBottom: "10px",
          }}
        >
          ZUQEN Text-to-Video
        </h1>

        <p
          style={{
            color: "#aaa",
            marginBottom: "30px",
          }}
        >
          Generate a video from your text prompt using Puter AI.
        </p>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the video you want to generate..."
          disabled={loading}
          style={{
            width: "100%",
            minHeight: "150px",
            resize: "vertical",
            padding: "16px",
            borderRadius: "12px",
            border: "1px solid #333",
            background: "#111",
            color: "#fff",
            fontSize: "16px",
            outline: "none",
            boxSizing: "border-box",
          }}
        />

        <button
          onClick={generateVideo}
          disabled={loading || !prompt.trim()}
          style={{
            marginTop: "16px",
            width: "100%",
            padding: "15px 20px",
            borderRadius: "12px",
            border: "none",
            background: loading ? "#333" : "#fff",
            color: loading ? "#aaa" : "#000",
            fontSize: "16px",
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Generating Video..." : "Generate Video"}
        </button>

        {error && (
          <div
            style={{
              marginTop: "20px",
              padding: "14px",
              borderRadius: "10px",
              background: "#1b0d0d",
              border: "1px solid #5a2222",
              color: "#ff8f8f",
            }}
          >
            {error}
          </div>
        )}

        {loading && (
          <div
            style={{
              marginTop: "30px",
              padding: "30px",
              textAlign: "center",
              borderRadius: "14px",
              background: "#111",
              border: "1px solid #222",
              color: "#aaa",
            }}
          >
            Your video is being generated. Please wait...
          </div>
        )}

        {videoUrl && !loading && (
          <section
            style={{
              marginTop: "30px",
            }}
          >
            <h2
              style={{
                fontSize: "22px",
                marginBottom: "15px",
              }}
            >
              Generated Video
            </h2>

            <video
              src={videoUrl}
              controls
              playsInline
              style={{
                width: "100%",
                borderRadius: "14px",
                display: "block",
                background: "#000",
              }}
            />

            <a
              href={videoUrl}
              download="zuqen-generated-video.mp4"
              style={{
                display: "block",
                marginTop: "16px",
                padding: "14px 20px",
                borderRadius: "12px",
                background: "#fff",
                color: "#000",
                textAlign: "center",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Download Video
            </a>
          </section>
        )}
      </div>
    </main>
  );
}

