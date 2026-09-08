
"use client";

import { useEffect, useRef, useState } from "react";

type Voice = {
  id: string;
  name: string;
  description: string;
  previewUrl: string | null;
};

export default function GenerateVoicePage() {
  const [text, setText] = useState("");
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState("");
  const [loadingVoices, setLoadingVoices] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [playingPreview, setPlayingPreview] = useState<string | null>(null);

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const maxCharacters = 5000;

  useEffect(() => {
    loadVoices();

    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, []);

  async function loadVoices() {
    try {
      setLoadingVoices(true);
      setError("");

      const response = await fetch("/api/voices");

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to load voices.");
      }

      const loadedVoices: Voice[] = data.voices || [];

      setVoices(loadedVoices);

      if (loadedVoices.length > 0) {
        setSelectedVoice(loadedVoices[0].id);
      }
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
  }

  function handlePreview(voice: Voice) {
    if (!voice.previewUrl) {
      return;
    }

    if (playingPreview === voice.id) {
      previewAudioRef.current?.pause();
      previewAudioRef.current = null;
      setPlayingPreview(null);
      return;
    }

    previewAudioRef.current?.pause();

    const audio = new Audio(voice.previewUrl);

    previewAudioRef.current = audio;

    audio.onended = () => {
      setPlayingPreview(null);
      previewAudioRef.current = null;
    };

    audio.onerror = () => {
      setPlayingPreview(null);
      previewAudioRef.current = null;
      setError("Unable to play this voice preview.");
    };

    audio.play();

    setPlayingPreview(voice.id);
  }

  async function generateVoice() {
    if (!text.trim()) {
      setError("Please enter some text first.");
      return;
    }

    if (!selectedVoice) {
      setError("Please select a voice.");
      return;
    }

    try {
      setGenerating(true);
      setError("");

      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl("");
      }

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
          // Ignore JSON parsing errors.
        }

        throw new Error(message);
      }

      const blob = await response.blob();

      const url = URL.createObjectURL(blob);

      setAudioUrl(url);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while generating the voice."
      );
    } finally {
      setGenerating(false);
    }
  }

  function downloadAudio() {
    if (!audioUrl) {
      return;
    }

    const link = document.createElement("a");

    link.href = audioUrl;
    link.download = "zuqen-ai-voice.mp3";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const selectedVoiceData = voices.find(
    (voice) => voice.id === selectedVoice
  );

  return (
    <main className="voice-page">
      <div className="voice-background-glow glow-one" />
      <div className="voice-background-glow glow-two" />

      <div className="voice-container">
        {/* Header */}
        <header className="voice-header">
          <div>
            <div className="voice-badge">
              <span className="badge-dot" />
              ZUQEN AI STUDIO
            </div>

            <h1>
              AI Voice
              <span> Generator</span>
            </h1>

            <p>
              Turn your text into natural, expressive AI speech with
              high-quality voices.
            </p>
          </div>

          <div className="header-mic">
            <span>🎙️</span>
          </div>
        </header>

        {/* Main Grid */}
        <div className="voice-grid">
          {/* Left */}
          <section className="editor-panel glass-panel">
            <div className="panel-top">
              <div>
                <h2>Write your script</h2>
                <p>Enter the text you want ZUQEN AI to speak.</p>
              </div>

              <div className="character-count">
                {text.length.toLocaleString()} /{" "}
                {maxCharacters.toLocaleString()}
              </div>
            </div>

            <div className="text-editor">
              <textarea
                value={text}
                onChange={(event) => {
                  if (event.target.value.length <= maxCharacters) {
                    setText(event.target.value);
                  }
                }}
                placeholder="Type or paste your text here..."
                spellCheck={false}
              />

              <div className="editor-footer">
                <span>
                  {text.length === 0
                    ? "Start writing your script"
                    : "Ready to generate"}
                </span>

                <span>AI Voice</span>
              </div>
            </div>

            {/* Selected voice */}
            {selectedVoiceData && (
              <div className="selected-voice">
                <div className="selected-avatar">
                  🎙️
                </div>

                <div className="selected-info">
                  <span>Selected voice</span>
                  <strong>{selectedVoiceData.name}</strong>
                </div>

                <button
                  type="button"
                  className="change-voice"
                  onClick={() => {
                    document
                      .getElementById("voice-library")
                      ?.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                      });
                  }}
                >
                  Change
                </button>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="error-box">
                <span>!</span>
                <p>{error}</p>
              </div>
            )}

            {/* Generate */}
            <button
              type="button"
              className="generate-button"
              onClick={generateVoice}
              disabled={
                generating ||
                !text.trim() ||
                !selectedVoice ||
                loadingVoices
              }
            >
              {generating ? (
                <>
                  <span className="spinner" />
                  Generating voice...
                </>
              ) : (
                <>
                  <span className="sparkle">✦</span>
                  Generate Voice
                  <span className="arrow">→</span>
                </>
              )}
            </button>

            <p className="secure-note">
              🔒 Your ElevenLabs API key stays securely on the server.
            </p>
          </section>

          {/* Right */}
          <section
            className="voices-panel glass-panel"
            id="voice-library"
          >
            <div className="panel-top">
              <div>
                <h2>Choose a voice</h2>
                <p>Select the voice that fits your content.</p>
              </div>

              <div className="voice-count">
                {loadingVoices ? "..." : voices.length}
              </div>
            </div>

            <div className="voice-list">
              {loadingVoices ? (
                <>
                  <div className="voice-skeleton" />
                  <div className="voice-skeleton" />
                  <div className="voice-skeleton" />
                  <div className="voice-skeleton" />
                </>
              ) : voices.length === 0 ? (
                <div className="empty-voices">
                  <div>🎙️</div>
                  <strong>No voices found</strong>
                  <p>
                    We couldn't load your ElevenLabs voices.
                  </p>

                  <button
                    type="button"
                    onClick={loadVoices}
                  >
                    Try again
                  </button>
                </div>
              ) : (
                voices.map((voice) => {
                  const isSelected =
                    selectedVoice === voice.id;

                  const isPlaying =
                    playingPreview === voice.id;

                  return (
                    <div
                      key={voice.id}
                      className={`voice-card ${
                        isSelected ? "active" : ""
                      }`}
                      onClick={() =>
                        setSelectedVoice(voice.id)
                      }
                    >
                      <div className="voice-avatar">
                        {voice.name
                          ?.charAt(0)
                          ?.toUpperCase() || "V"}
                      </div>

                      <div className="voice-details">
                        <strong>{voice.name}</strong>

                        <span>
                          {voice.description ||
                            "ElevenLabs AI voice"}
                        </span>
                      </div>

                      <button
                        type="button"
                        className={`preview-button ${
                          isPlaying ? "playing" : ""
                        }`}
                        onClick={(event) => {
                          event.stopPropagation();
                          handlePreview(voice);
                        }}
                        disabled={!voice.previewUrl}
                        title={
                          voice.previewUrl
                            ? "Preview voice"
                            : "Preview unavailable"
                        }
                      >
                        {isPlaying ? "Ⅱ" : "▶"}
                      </button>

                      <div className="voice-check">
                        {isSelected ? "✓" : ""}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="voice-tip">
              <span>💡</span>
              <div>
                <strong>Preview before generating</strong>
                <p>
                  Tap the play button to hear how a voice sounds.
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Generated Audio */}
        {audioUrl && (
          <section className="result-panel glass-panel">
            <div className="result-icon">
              🎵
            </div>

            <div className="result-info">
              <span>VOICE GENERATED</span>
              <strong>Your AI voice is ready</strong>

              <audio
                className="audio-player"
                src={audioUrl}
                controls
              />
            </div>

            <button
              type="button"
              className="download-button"
              onClick={downloadAudio}
            >
              <span>↓</span>
              Download MP3
            </button>
          </section>
        )}

        {/* Footer */}
        <footer className="voice-footer">
          <span>Powered by</span>
          <strong> ZUQEN AI</strong>
          <span> × ElevenLabs</span>
        </footer>
      </div>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .voice-page {
          min-height: 100vh;
          position: relative;
          overflow: hidden;
          padding: 48px 24px 36px;
          background:
            radial-gradient(
              circle at 15% 10%,
              rgba(99, 102, 241, 0.13),
              transparent 32%
            ),
            radial-gradient(
              circle at 90% 30%,
              rgba(168, 85, 247, 0.12),
              transparent 30%
            ),
            #07070b;
          color: #fff;
        }

        .voice-background-glow {
          position: absolute;
          width: 500px;
          height: 500px;
          border-radius: 50%;
          filter: blur(130px);
          pointer-events: none;
          opacity: 0.14;
        }

        .glow-one {
          top: -300px;
          left: -180px;
          background: #7c3aed;
        }

        .glow-two {
          right: -200px;
          bottom: -250px;
          background: #2563eb;
        }

        .voice-container {
          width: min(1180px, 100%);
          margin: 0 auto;
          position: relative;
          z-index: 2;
        }

        .voice-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 30px;
          margin-bottom: 34px;
        }

        .voice-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.04);
          color: #aaa;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1.5px;
        }

        .badge-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #8b5cf6;
          box-shadow: 0 0 12px #8b5cf6;
        }

        .voice-header h1 {
          margin: 15px 0 8px;
          font-size: clamp(36px, 5vw, 58px);
          line-height: 1;
          letter-spacing: -2.5px;
          font-weight: 800;
        }

        .voice-header h1 span {
          background: linear-gradient(
            100deg,
            #a78bfa,
            #60a5fa
          );
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .voice-header p {
          margin: 0;
          color: #8f8f99;
          font-size: 15px;
          line-height: 1.6;
        }

        .header-mic {
          width: 74px;
          height: 74px;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          border-radius: 22px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: linear-gradient(
            145deg,
            rgba(139, 92, 246, 0.18),
            rgba(59, 130, 246, 0.08)
          );
          box-shadow:
            inset 0 1px rgba(255, 255, 255, 0.08),
            0 20px 60px rgba(0, 0, 0, 0.3);
        }

        .header-mic span {
          font-size: 31px;
        }

        .voice-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(350px, 0.8fr);
          gap: 20px;
          align-items: stretch;
        }

        .glass-panel {
          border: 1px solid rgba(255, 255, 255, 0.09);
          background: rgba(14, 14, 20, 0.78);
          border-radius: 24px;
          box-shadow:
            inset 0 1px rgba(255, 255, 255, 0.04),
            0 25px 80px rgba(0, 0, 0, 0.25);
          backdrop-filter: blur(20px);
        }

        .editor-panel,
        .voices-panel {
          padding: 24px;
        }

        .panel-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 18px;
        }

        .panel-top h2 {
          margin: 0 0 5px;
          font-size: 17px;
          font-weight: 700;
        }

        .panel-top p {
          margin: 0;
          color: #777781;
          font-size: 12px;
          line-height: 1.5;
        }

        .character-count,
        .voice-count {
          color: #71717a;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
        }

        .text-editor {
          min-height: 310px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 18px;
          background: rgba(5, 5, 9, 0.65);
          transition: border-color 0.2s ease;
        }

        .text-editor:focus-within {
          border-color: rgba(139, 92, 246, 0.45);
          box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.06);
        }

        .text-editor textarea {
          display: block;
          width: 100%;
          height: 270px;
          resize: none;
          border: 0;
          outline: 0;
          padding: 20px;
          background: transparent;
          color: #f5f5f5;
          font: inherit;
          font-size: 15px;
          line-height: 1.7;
        }

        .text-editor textarea::placeholder {
          color: #50505a;
        }

        .editor-footer {
          display: flex;
          justify-content: space-between;
          padding: 10px 15px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          color: #55555e;
          font-size: 10px;
        }

        .selected-voice {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 14px;
          padding: 12px;
          border: 1px solid rgba(139, 92, 246, 0.18);
          border-radius: 15px;
          background: rgba(139, 92, 246, 0.06);
        }

        .selected-avatar {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 11px;
          background: rgba(255, 255, 255, 0.06);
          font-size: 18px;
        }

        .selected-info {
          flex: 1;
          min-width: 0;
        }

        .selected-info span {
          display: block;
          margin-bottom: 2px;
          color: #666671;
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.8px;
        }

        .selected-info strong {
          display: block;
          overflow: hidden;
          color: #ddd;
          font-size: 13px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .change-voice {
          border: 0;
          background: transparent;
          color: #a78bfa;
          cursor: pointer;
          font-size: 11px;
          font-weight: 700;
        }

        .error-box {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 14px;
          padding: 11px 13px;
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 12px;
          background: rgba(239, 68, 68, 0.06);
          color: #fca5a5;
        }

        .error-box span {
          width: 20px;
          height: 20px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: rgba(239, 68, 68, 0.18);
          font-size: 11px;
          font-weight: 800;
        }

        .error-box p {
          margin: 0;
          font-size: 11px;
        }

        .generate-button {
          width: 100%;
          min-height: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-top: 16px;
          border: 0;
          border-radius: 15px;
          background: linear-gradient(
            100deg,
            #7c3aed,
            #6366f1,
            #3b82f6
          );
          color: white;
          cursor: pointer;
          font-size: 13px;
          font-weight: 800;
          box-shadow:
            0 12px 35px rgba(99, 102, 241, 0.2),
            inset 0 1px rgba(255, 255, 255, 0.2);
          transition:
            transform 0.2s ease,
            opacity 0.2s ease,
            box-shadow 0.2s ease;
        }

        .generate-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow:
            0 18px 40px rgba(99, 102, 241, 0.3),
            inset 0 1px rgba(255, 255, 255, 0.25);
        }

        .generate-button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .sparkle {
          font-size: 17px;
        }

        .arrow {
          margin-left: 5px;
          font-size: 17px;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .secure-note {
          margin: 11px 0 0;
          text-align: center;
          color: #50505a;
          font-size: 9px;
        }

        .voice-list {
          display: flex;
          flex-direction: column;
          gap: 9px;
          max-height: 440px;
          overflow-y: auto;
          padding-right: 3px;
        }

        .voice-list::-webkit-scrollbar {
          width: 4px;
        }

        .voice-list::-webkit-scrollbar-thumb {
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.1);
        }

        .voice-card {
          min-height: 66px;
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 10px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 15px;
          background: rgba(255, 255, 255, 0.025);
          cursor: pointer;
          transition:
            border-color 0.2s ease,
            background 0.2s ease,
            transform 0.2s ease;
        }

        .voice-card:hover {
          transform: translateY(-1px);
          border-color: rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.045);
        }

        .voice-card.active {
          border-color: rgba(139, 92, 246, 0.45);
          background: rgba(139, 92, 246, 0.08);
        }

        .voice-avatar {
          width: 40px;
          height: 40px;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          border-radius: 12px;
          background: linear-gradient(
            145deg,
            rgba(139, 92, 246, 0.24),
            rgba(59, 130, 246, 0.15)
          );
          color: #c4b5fd;
          font-size: 14px;
          font-weight: 800;
        }

        .voice-details {
          flex: 1;
          min-width: 0;
        }

        .voice-details strong {
          display: block;
          overflow: hidden;
          color: #e7e7eb;
          font-size: 12px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .voice-details span {
          display: block;
          margin-top: 3px;
          overflow: hidden;
          color: #666671;
          font-size: 10px;
          line-height: 1.4;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .preview-button {
          width: 31px;
          height: 31px;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.04);
          color: #aaa;
          cursor: pointer;
          font-size: 10px;
          transition: all 0.2s ease;
        }

        .preview-button:hover:not(:disabled) {
          border-color: rgba(139, 92, 246, 0.4);
          background: rgba(139, 92, 246, 0.12);
          color: #c4b5fd;
        }

        .preview-button.playing {
          border-color: rgba(139, 92, 246, 0.4);
          background: rgba(139, 92, 246, 0.15);
          color: #c4b5fd;
        }

        .preview-button:disabled {
          opacity: 0.25;
          cursor: not-allowed;
        }

        .voice-check {
          width: 20px;
          color: #a78bfa;
          font-size: 13px;
          font-weight: 900;
          text-align: center;
        }

        .voice-tip {
          display: flex;
          gap: 10px;
          margin-top: 15px;
          padding: 12px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.025);
        }

        .voice-tip > span {
          font-size: 16px;
        }

        .voice-tip strong {
          display: block;
          margin-bottom: 2px;
          color: #9999a3;
          font-size: 10px;
        }

        .voice-tip p {
          margin: 0;
          color: #5e5e68;
          font-size: 9px;
          line-height: 1.5;
        }

        .voice-skeleton {
          height: 66px;
          border-radius: 15px;
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0.025),
            rgba(255, 255, 255, 0.06),
            rgba(255, 255, 255, 0.025)
          );
          background-size: 200% 100%;
          animation: skeleton 1.4s infinite;
        }

        .empty-voices {
          padding: 50px 20px;
          text-align: center;
          border: 1px dashed rgba(255, 255, 255, 0.1);
          border-radius: 16px;
        }

        .empty-voices > div {
          margin-bottom: 12px;
          font-size: 28px;
        }

        .empty-voices strong {
          display: block;
          color: #ddd;
          font-size: 13px;
        }

        .empty-voices p {
          margin: 7px 0 15px;
          color: #666;
          font-size: 10px;
        }

        .empty-voices button {
          padding: 8px 14px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 9px;
          background: rgba(255, 255, 255, 0.04);
          color: #aaa;
          cursor: pointer;
          font-size: 10px;
        }

        .result-panel {
          display: flex;
          align-items: center;
          gap: 15px;
          margin-top: 20px;
          padding: 18px 20px;
        }

        .result-icon {
          width: 48px;
          height: 48px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
          border-radius: 14px;
          background: rgba(139, 92, 246, 0.12);
          font-size: 21px;
        }

        .result-info {
          flex: 1;
          min-width: 0;
        }

        .result-info > span {
          display: block;
          margin-bottom: 3px;
          color: #8b5cf6;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 1px;
        }

        .result-info > strong {
          display: block;
          margin-bottom: 9px;
          color: #ddd;
          font-size: 13px;
        }

        .audio-player {
          width: 100%;
          max-width: 580px;
          height: 35px;
        }

        .download-button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 11px 14px;
          flex-shrink: 0;
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 11px;
          background: rgba(255, 255, 255, 0.04);
          color: #ddd;
          cursor: pointer;
          font-size: 10px;
          font-weight: 700;
          transition: all 0.2s ease;
        }

        .download-button:hover {
          border-color: rgba(139, 92, 246, 0.35);
          background: rgba(139, 92, 246, 0.1);
        }

        .download-button span {
          font-size: 16px;
        }

        .voice-footer {
          padding-top: 28px;
          text-align: center;
          color: #44444d;
          font-size: 9px;
        }

        .voice-footer strong {
          color: #777781;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes skeleton {
          0% {
            background-position: 200% 0;
          }

          100% {
            background-position: -200% 0;
          }
        }

        @media (max-width: 850px) {
          .voice-page {
            padding: 30px 16px;
          }

          .voice-grid {
            grid-template-columns: 1fr;
          }

          .voices-panel {
            order: 2;
          }

          .voice-list {
            max-height: 420px;
          }
        }

        @media (max-width: 600px) {
          .voice-page {
            padding: 22px 12px 28px;
          }

          .voice-header {
            margin-bottom: 25px;
          }

          .voice-header h1 {
            font-size: 38px;
            letter-spacing: -1.8px;
          }

          .voice-header p {
            max-width: 310px;
            font-size: 12px;
          }

          .header-mic {
            width: 55px;
            height: 55px;
            border-radius: 16px;
          }

          .header-mic span {
            font-size: 23px;
          }

          .editor-panel,
          .voices-panel {
            padding: 16px;
            border-radius: 19px;
          }

          .text-editor {
            min-height: 270px;
          }

          .text-editor textarea {
            height: 230px;
            padding: 16px;
          }

          .selected-voice {
            margin-top: 11px;
          }

          .voice-card {
            min-height: 62px;
          }

          .result-panel {
            align-items: flex-start;
            flex-wrap: wrap;
          }

          .result-info {
            width: calc(100% - 63px);
          }

          .download-button {
            width: 100%;
            justify-content: center;
          }

          .audio-player {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}

