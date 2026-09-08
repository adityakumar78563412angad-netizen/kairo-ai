"use client";

import { useEffect, useRef, useState } from "react";

type Voice = {
  id: string;
  name: string;
  description: string;
  previewUrl: string | null;
  gender: string | null;
  age: string | null;
  accent: string | null;
  language: string | null;
  locale: string | null;
  category: string | null;
  voiceType: string | null;
};

export default function GenerateVoicePage() {
  const [text, setText] = useState("");
  const [voices, setVoices] = useState<Voice[]>([]);

  const [selectedVoice, setSelectedVoice] =
    useState("");

  const [loadingVoices, setLoadingVoices] =
    useState(true);

  const [loadingMore, setLoadingMore] =
    useState(false);

  const [generating, setGenerating] =
    useState(false);

  const [error, setError] =
    useState("");

  const [audioUrl, setAudioUrl] =
    useState("");

  const [playingPreview, setPlayingPreview] =
    useState<string | null>(null);

  const [search, setSearch] =
    useState("");

  const [gender, setGender] =
    useState("all");

  const [age, setAge] =
    useState("all");

  const [language, setLanguage] =
    useState("all");

  const [accent, setAccent] =
    useState("all");

  const [category, setCategory] =
    useState("all");

  const [voiceType, setVoiceType] =
    useState("all");

  const [sort, setSort] =
    useState("name");

  const [sortDirection, setSortDirection] =
    useState("asc");

  const [hasMore, setHasMore] =
    useState(false);

  const [nextPageToken, setNextPageToken] =
    useState<string | null>(null);

  const [totalCount, setTotalCount] =
    useState(0);

  const previewAudioRef =
    useRef<HTMLAudioElement | null>(null);

  const searchTimerRef =
    useRef<NodeJS.Timeout | null>(null);

  const maxCharacters = 5000;

  useEffect(() => {
    loadVoices(false);

    return () => {
      previewAudioRef.current?.pause();

      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }

      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, []);

  async function loadVoices(
    loadMore = false
  ) {
    try {
      if (loadMore) {
        setLoadingMore(true);
      } else {
        setLoadingVoices(true);
        setError("");
      }

      const params = new URLSearchParams();

      params.set("page_size", "50");

      if (search.trim()) {
        params.set(
          "search",
          search.trim()
        );
      }

      if (gender !== "all") {
        params.set("gender", gender);
      }

      if (age !== "all") {
        params.set("age", age);
      }

      if (language !== "all") {
        params.set(
          "language",
          language
        );
      }

      if (accent !== "all") {
        params.set(
          "accent",
          accent
        );
      }

      if (category !== "all") {
        params.set(
          "category",
          category
        );
      }

      if (voiceType !== "all") {
        params.set(
          "voice_type",
          voiceType
        );
      }

      params.set("sort", sort);
      params.set(
        "sort_direction",
        sortDirection
      );

      if (
        loadMore &&
        nextPageToken
      ) {
        params.set(
          "next_page_token",
          nextPageToken
        );
      }

      const response = await fetch(
        `/api/voices?${params.toString()}`,
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Failed to load voices."
        );
      }

      const loadedVoices =
        data.voices || [];

      if (loadMore) {
        setVoices((current) => [
          ...current,
          ...loadedVoices,
        ]);
      } else {
        setVoices(loadedVoices);

        if (
          loadedVoices.length > 0 &&
          !selectedVoice
        ) {
          setSelectedVoice(
            loadedVoices[0].id
          );
        }
      }

      setHasMore(
        data.hasMore ?? false
      );

      setNextPageToken(
        data.nextPageToken ?? null
      );

      setTotalCount(
        data.totalCount ??
          loadedVoices.length
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load voices."
      );
    } finally {
      setLoadingVoices(false);
      setLoadingMore(false);
    }
  }

  function applyFilters() {
    setNextPageToken(null);
    setHasMore(false);
    loadVoices(false);
  }

  function handleSearchChange(
    value: string
  ) {
    setSearch(value);

    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    searchTimerRef.current =
      setTimeout(() => {
        setNextPageToken(null);
        loadVoices(false);
      }, 500);
  }

  function handleFilterChange(
    setter: (
      value: string
    ) => void,
    value: string
  ) {
    setter(value);

    setNextPageToken(null);

    setTimeout(() => {
      loadVoices(false);
    }, 0);
  }

  function resetFilters() {
    setSearch("");
    setGender("all");
    setAge("all");
    setLanguage("all");
    setAccent("all");
    setCategory("all");
    setVoiceType("all");
    setSort("name");
    setSortDirection("asc");
    setNextPageToken(null);
    setHasMore(false);

    setTimeout(() => {
      loadVoices(false);
    }, 0);
  }

  function handlePreview(
    voice: Voice
  ) {
    if (!voice.previewUrl) {
      return;
    }

    if (
      playingPreview === voice.id
    ) {
      previewAudioRef.current?.pause();

      previewAudioRef.current = null;

      setPlayingPreview(null);

      return;
    }

    previewAudioRef.current?.pause();

    const audio = new Audio(
      voice.previewUrl
    );

    previewAudioRef.current = audio;

    audio.onended = () => {
      setPlayingPreview(null);
      previewAudioRef.current = null;
    };

    audio.onerror = () => {
      setPlayingPreview(null);
      previewAudioRef.current = null;

      setError(
        "Unable to play this voice preview."
      );
    };

    audio.play();

    setPlayingPreview(
      voice.id
    );
  }

  async function generateVoice() {
    if (!text.trim()) {
      setError(
        "Please enter some text first."
      );
      return;
    }

    if (!selectedVoice) {
      setError(
        "Please select a voice."
      );
      return;
    }

    try {
      setGenerating(true);
      setError("");

      if (audioUrl) {
        URL.revokeObjectURL(
          audioUrl
        );

        setAudioUrl("");
      }

      const response =
        await fetch(
          "/api/generate-voice",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              text: text.trim(),
              voiceId:
                selectedVoice,
            }),
          }
        );

      if (!response.ok) {
        let message =
          "Failed to generate voice.";

        try {
          const data =
            await response.json();

          if (data?.error) {
            message = data.error;
          }
        } catch {
          // Ignore
        }

        throw new Error(message);
      }

      const blob =
        await response.blob();

      const url =
        URL.createObjectURL(
          blob
        );

      setAudioUrl(url);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setGenerating(false);
    }
  }

  function downloadAudio() {
    if (!audioUrl) {
      return;
    }

    const link =
      document.createElement(
        "a"
      );

    link.href = audioUrl;
    link.download =
      "zuqen-ai-voice.mp3";

    document.body.appendChild(
      link
    );

    link.click();

    document.body.removeChild(
      link
    );
  }

  const selectedVoiceData =
    voices.find(
      (voice) =>
        voice.id ===
        selectedVoice
    );

  return (
    <main className="voice-page">
      <div className="background-glow glow-one" />
      <div className="background-glow glow-two" />

      <div className="voice-container">
        {/* HEADER */}

        <header className="voice-header">
          <div>
            <div className="voice-badge">
              <span className="badge-dot" />
              ZUQEN AI STUDIO
            </div>

            <h1>
              AI Voice{" "}
              <span>Generator</span>
            </h1>

            <p>
              Create natural, expressive
              AI voices with ZUQEN.
            </p>
          </div>

          <div className="header-mic">
            🎙️
          </div>
        </header>

        {/* MAIN */}

        <div className="voice-grid">
          {/* EDITOR */}

          <section className="editor-panel glass-panel">
            <div className="panel-top">
              <div>
                <h2>
                  Write your script
                </h2>

                <p>
                  Enter the text you
                  want ZUQEN to speak.
                </p>
              </div>

              <div className="character-count">
                {text.length.toLocaleString()}
                {" / "}
                {maxCharacters.toLocaleString()}
              </div>
            </div>

            <div className="text-editor">
              <textarea
                value={text}
                maxLength={
                  maxCharacters
                }
                onChange={(event) =>
                  setText(
                    event.target.value
                  )
                }
                placeholder="Type or paste your text here..."
              />

              <div className="editor-footer">
                <span>
                  {text.length
                    ? "Ready to generate"
                    : "Start writing your script"}
                </span>

                <span>
                  AI Voice
                </span>
              </div>
            </div>

            {selectedVoiceData && (
              <div className="selected-voice">
                <div className="selected-avatar">
                  🎙️
                </div>

                <div className="selected-info">
                  <span>
                    Selected voice
                  </span>

                  <strong>
                    {
                      selectedVoiceData.name
                    }
                  </strong>
                </div>

                <button
                  type="button"
                  className="change-voice"
                  onClick={() =>
                    document
                      .getElementById(
                        "voice-library"
                      )
                      ?.scrollIntoView({
                        behavior:
                          "smooth",
                        block: "center",
                      })
                  }
                >
                  Change
                </button>
              </div>
            )}

            {error && (
              <div className="error-box">
                <span>!</span>

                <p>{error}</p>
              </div>
            )}

            <button
              type="button"
              className="generate-button"
              onClick={
                generateVoice
              }
              disabled={
                generating ||
                !text.trim() ||
                !selectedVoice
              }
            >
              {generating ? (
                <>
                  <span className="spinner" />
                  Generating voice...
                </>
              ) : (
                <>
                  <span>✦</span>
                  Generate Voice
                  <span>→</span>
                </>
              )}
            </button>

            <p className="secure-note">
              🔒 Your ElevenLabs API
              key stays securely on
              the server.
            </p>
          </section>

          {/* VOICE LIBRARY */}

          <section
            className="voices-panel glass-panel"
            id="voice-library"
          >
            <div className="panel-top">
              <div>
                <h2>
                  Voice Library
                </h2>

                <p>
                  Search and filter
                  available voices.
                </p>
              </div>

              <div className="voice-count">
                {totalCount || voices.length}
              </div>
            </div>

            {/* SEARCH */}

            <div className="search-box">
              <span>⌕</span>

              <input
                value={search}
                onChange={(event) =>
                  handleSearchChange(
                    event.target.value
                  )
                }
                placeholder="Search voices..."
              />

              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setTimeout(
                      () =>
                        loadVoices(
                          false
                        ),
                      0
                    );
                  }}
                >
                  ×
                </button>
              )}
            </div>

            {/* FILTERS */}

            <div className="filters">
              <select
                value={gender}
                onChange={(event) =>
                  handleFilterChange(
                    setGender,
                    event.target.value
                  )
                }
              >
                <option value="all">
                  Gender: All
                </option>

                <option value="female">
                  Female
                </option>

                <option value="male">
                  Male
                </option>

                <option value="neutral">
                  Neutral
                </option>
              </select>

              <select
                value={age}
                onChange={(event) =>
                  handleFilterChange(
                    setAge,
                    event.target.value
                  )
                }
              >
                <option value="all">
                  Age: All
                </option>

                <option value="young">
                  Young
                </option>

                <option value="middle-aged">
                  Middle Aged
                </option>

                <option value="old">
                  Old
                </option>
              </select>

              <select
                value={language}
                onChange={(event) =>
                  handleFilterChange(
                    setLanguage,
                    event.target.value
                  )
                }
              >
                <option value="all">
                  Language: All
                </option>

                <option value="en">
                  English
                </option>

                <option value="hi">
                  Hindi
                </option>

                <option value="es">
                  Spanish
                </option>

                <option value="fr">
                  French
                </option>

                <option value="de">
                  German
                </option>

                <option value="it">
                  Italian
                </option>

                <option value="pt">
                  Portuguese
                </option>

                <option value="ja">
                  Japanese
                </option>

                <option value="ko">
                  Korean
                </option>

                <option value="zh">
                  Chinese
                </option>

                <option value="ar">
                  Arabic
                </option>
              </select>

              <select
                value={accent}
                onChange={(event) =>
                  handleFilterChange(
                    setAccent,
                    event.target.value
                  )
                }
              >
                <option value="all">
                  Accent: All
                </option>

                <option value="American">
                  American
                </option>

                <option value="British">
                  British
                </option>

                <option value="Australian">
                  Australian
                </option>

                <option value="Indian">
                  Indian
                </option>

                <option value="Canadian">
                  Canadian
                </option>
              </select>

              <select
                value={category}
                onChange={(event) =>
                  handleFilterChange(
                    setCategory,
                    event.target.value
                  )
                }
              >
                <option value="all">
                  Category: All
                </option>

                <option value="premade">
                  Premade
                </option>

                <option value="professional">
                  Professional
                </option>

                <option value="cloned">
                  Cloned
                </option>

                <option value="generated">
                  Generated
                </option>
              </select>

              <select
                value={voiceType}
                onChange={(event) =>
                  handleFilterChange(
                    setVoiceType,
                    event.target.value
                  )
                }
              >
                <option value="all">
                  Type: All
                </option>

                <option value="default">
                  Default
                </option>

                <option value="personal">
                  Personal
                </option>

                <option value="community">
                  Community
                </option>

                <option value="workspace">
                  Workspace
                </option>

                <option value="saved">
                  Saved
                </option>
              </select>
            </div>

            {/* SORT */}

            <div className="library-tools">
              <button
                type="button"
                className="reset-button"
                onClick={
                  resetFilters
                }
              >
                Reset filters
              </button>

              <div className="sort-box">
                <span>
                  Sort:
                </span>

                <select
                  value={sort}
                  onChange={(event) => {
                    setSort(
                      event.target.value
                    );

                    setTimeout(
                      () =>
                        loadVoices(
                          false
                        ),
                      0
                    );
                  }}
                >
                  <option value="name">
                    Name
                  </option>

                  <option value="created_at_unix">
                    Newest
                  </option>
                </select>

                <button
                  type="button"
                  onClick={() => {
                    const next =
                      sortDirection ===
                      "asc"
                        ? "desc"
                        : "asc";

                    setSortDirection(
                      next
                    );

                    setTimeout(
                      () =>
                        loadVoices(
                          false
                        ),
                      0
                    );
                  }}
                >
                  {sortDirection ===
                  "asc"
                    ? "↑"
                    : "↓"}
                </button>
              </div>
            </div>

            {/* VOICE LIST */}

            <div className="voice-list">
              {loadingVoices ? (
                <>
                  <div className="voice-skeleton" />
                  <div className="voice-skeleton" />
                  <div className="voice-skeleton" />
                  <div className="voice-skeleton" />
                </>
              ) : voices.length ===
                0 ? (
                <div className="empty-voices">
                  <div>
                    🔎
                  </div>

                  <strong>
                    No voices found
                  </strong>

                  <p>
                    Try changing your
                    search or filters.
                  </p>

                  <button
                    type="button"
                    onClick={
                      resetFilters
                    }
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                voices.map(
                  (voice) => {
                    const isSelected =
                      selectedVoice ===
                      voice.id;

                    const isPlaying =
                      playingPreview ===
                      voice.id;

                    return (
                      <div
                        key={
                          voice.id
                        }
                        className={`voice-card ${
                          isSelected
                            ? "active"
                            : ""
                        }`}
                        onClick={() =>
                          setSelectedVoice(
                            voice.id
                          )
                        }
                      >
                        <div className="voice-avatar">
                          {voice.name
                            .charAt(
                              0
                            )
                            .toUpperCase()}
                        </div>

                        <div className="voice-details">
                          <strong>
                            {
                              voice.name
                            }
                          </strong>

                          <span>
                            {[
                              voice.gender,
                              voice.age,
                              voice.accent,
                            ]
                              .filter(
                                Boolean
                              )
                              .join(
                                " • "
                              ) ||
                              "AI Voice"}
                          </span>
                        </div>

                        <button
                          type="button"
                          className={`preview-button ${
                            isPlaying
                              ? "playing"
                              : ""
                          }`}
                          onClick={(
                            event
                          ) => {
                            event.stopPropagation();

                            handlePreview(
                              voice
                            );
                          }}
                          disabled={
                            !voice.previewUrl
                          }
                        >
                          {isPlaying
                            ? "Ⅱ"
                            : "▶"}
                        </button>

                        <div className="voice-check">
                          {isSelected
                            ? "✓"
                            : ""}
                        </div>
                      </div>
                    );
                  }
                )
              )}
            </div>

            {/* LOAD MORE */}

            {hasMore &&
              !loadingVoices && (
                <button
                  type="button"
                  className="load-more"
                  onClick={() =>
                    loadVoices(
                      true
                    )
                  }
                  disabled={
                    loadingMore
                  }
                >
                  {loadingMore ? (
                    <>
                      <span className="small-spinner" />
                      Loading more...
                    </>
                  ) : (
                    <>
                      Load more voices
                      <span>
                        ↓
                      </span>
                    </>
                  )}
                </button>
              )}

            <div className="voice-tip">
              <span>💡</span>

              <div>
                <strong>
                  Preview before
                  generating
                </strong>

                <p>
                  Listen to a voice
                  before using it in
                  your generation.
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* RESULT */}

        {audioUrl && (
          <section className="result-panel glass-panel">
            <div className="result-icon">
              🎵
            </div>

            <div className="result-info">
              <span>
                VOICE GENERATED
              </span>

              <strong>
                Your AI voice is ready
              </strong>

              <audio
                className="audio-player"
                src={audioUrl}
                controls
              />
            </div>

            <button
              type="button"
              className="download-button"
              onClick={
                downloadAudio
              }
            >
              ↓ Download MP3
            </button>
          </section>
        )}

        <footer className="voice-footer">
          Powered by{" "}
          <strong>
            ZUQEN AI
          </strong>{" "}
          × ElevenLabs
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
          color: white;
        }

        .background-glow {
          position: absolute;
          width: 500px;
          height: 500px;
          border-radius: 50%;
          filter: blur(130px);
          opacity: 0.12;
          pointer-events: none;
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
          width: min(1200px, 100%);
          margin: auto;
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
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 999px;
          background: rgba(255,255,255,.04);
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
          font-size: clamp(36px,5vw,58px);
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
        }

        .header-mic {
          width: 74px;
          height: 74px;
          display: grid;
          place-items: center;
          border-radius: 22px;
          border: 1px solid rgba(255,255,255,.1);
          background: rgba(139,92,246,.12);
          font-size: 31px;
        }

        .voice-grid {
          display: grid;
          grid-template-columns: minmax(0,1.05fr) minmax(400px,.95fr);
          gap: 20px;
        }

        .glass-panel {
          border: 1px solid rgba(255,255,255,.09);
          background: rgba(14,14,20,.78);
          border-radius: 24px;
          box-shadow:
            inset 0 1px rgba(255,255,255,.04),
            0 25px 80px rgba(0,0,0,.25);
          backdrop-filter: blur(20px);
        }

        .editor-panel,
        .voices-panel {
          padding: 24px;
        }

        .panel-top {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 18px;
        }

        .panel-top h2 {
          margin: 0 0 5px;
          font-size: 17px;
        }

        .panel-top p {
          margin: 0;
          color: #777781;
          font-size: 12px;
        }

        .character-count,
        .voice-count {
          color: #71717a;
          font-size: 11px;
          white-space: nowrap;
        }

        .text-editor {
          overflow: hidden;
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 18px;
          background: rgba(5,5,9,.65);
        }

        .text-editor textarea {
          display: block;
          width: 100%;
          height: 270px;
          resize: none;
          outline: none;
          border: 0;
          padding: 20px;
          background: transparent;
          color: white;
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
          border-top: 1px solid rgba(255,255,255,.06);
          color: #55555e;
          font-size: 10px;
        }

        .selected-voice {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 14px;
          padding: 12px;
          border: 1px solid rgba(139,92,246,.18);
          border-radius: 15px;
          background: rgba(139,92,246,.06);
        }

        .selected-avatar {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 11px;
          background: rgba(255,255,255,.06);
        }

        .selected-info {
          flex: 1;
        }

        .selected-info span {
          display: block;
          color: #666671;
          font-size: 9px;
          text-transform: uppercase;
        }

        .selected-info strong {
          color: #ddd;
          font-size: 13px;
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
          border: 1px solid rgba(239,68,68,.2);
          border-radius: 12px;
          background: rgba(239,68,68,.06);
          color: #fca5a5;
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
        }

        .generate-button:disabled {
          opacity: .45;
          cursor: not-allowed;
        }

        .spinner,
        .small-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin .8s linear infinite;
        }

        .small-spinner {
          width: 13px;
          height: 13px;
        }

        .secure-note {
          margin: 11px 0 0;
          text-align: center;
          color: #50505a;
          font-size: 9px;
        }

        /* SEARCH */

        .search-box {
          display: flex;
          align-items: center;
          gap: 10px;
          height: 44px;
          padding: 0 13px;
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 13px;
          background: rgba(5,5,9,.6);
        }

        .search-box > span {
          color: #777;
          font-size: 22px;
        }

        .search-box input {
          flex: 1;
          min-width: 0;
          outline: none;
          border: 0;
          background: transparent;
          color: white;
          font-size: 12px;
        }

        .search-box input::placeholder {
          color: #55555e;
        }

        .search-box button {
          border: 0;
          background: transparent;
          color: #777;
          cursor: pointer;
          font-size: 18px;
        }

        /* FILTERS */

        .filters {
          display: grid;
          grid-template-columns: repeat(2,1fr);
          gap: 8px;
          margin-top: 10px;
        }

        .filters select,
        .sort-box select {
          width: 100%;
          min-width: 0;
          height: 36px;
          padding: 0 9px;
          outline: none;
          border: 1px solid rgba(255,255,255,.07);
          border-radius: 10px;
          background: #111118;
          color: #aaa;
          cursor: pointer;
          font-size: 10px;
        }

        .library-tools {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin: 13px 0;
        }

        .reset-button {
          border: 0;
          background: transparent;
          color: #777;
          cursor: pointer;
          font-size: 10px;
        }

        .reset-button:hover {
          color: #a78bfa;
        }

        .sort-box {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #666;
          font-size: 10px;
        }

        .sort-box select {
          width: 90px;
          height: 30px;
        }

        .sort-box button {
          width: 30px;
          height: 30px;
          border: 1px solid rgba(255,255,255,.07);
          border-radius: 8px;
          background: #111118;
          color: #aaa;
          cursor: pointer;
        }

        /* VOICES */

        .voice-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 440px;
          overflow-y: auto;
          padding-right: 3px;
        }

        .voice-list::-webkit-scrollbar {
          width: 4px;
        }

        .voice-list::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,.1);
          border-radius: 10px;
        }

        .voice-card {
          min-height: 64px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px;
          border: 1px solid rgba(255,255,255,.06);
          border-radius: 14px;
          background: rgba(255,255,255,.025);
          cursor: pointer;
          transition: .2s;
        }

        .voice-card:hover {
          background: rgba(255,255,255,.045);
          border-color: rgba(255,255,255,.12);
        }

        .voice-card.active {
          border-color: rgba(139,92,246,.45);
          background: rgba(139,92,246,.08);
        }

        .voice-avatar {
          width: 40px;
          height: 40px;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          border-radius: 11px;
          background: linear-gradient(
            145deg,
            rgba(139,92,246,.24),
            rgba(59,130,246,.15)
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
          font-size: 9px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .preview-button {
          width: 31px;
          height: 31px;
          flex-shrink: 0;
          border: 1px solid rgba(255,255,255,.09);
          border-radius: 10px;
          background: rgba(255,255,255,.04);
          color: #aaa;
          cursor: pointer;
        }

        .preview-button:hover:not(:disabled) {
          background: rgba(139,92,246,.12);
          color: #c4b5fd;
        }

        .preview-button.playing {
          background: rgba(139,92,246,.15);
          color: #c4b5fd;
        }

        .preview-button:disabled {
          opacity: .25;
          cursor: not-allowed;
        }

        .voice-check {
          width: 20px;
          color: #a78bfa;
          font-size: 13px;
          font-weight: 900;
          text-align: center;
        }

        /* LOAD MORE */

        .load-more {
          width: 100%;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          margin-top: 12px;
          border: 1px solid rgba(139,92,246,.2);
          border-radius: 12px;
          background: rgba(139,92,246,.06);
          color: #a78bfa;
          cursor: pointer;
          font-size: 11px;
          font-weight: 700;
        }

        .load-more:disabled {
          opacity: .5;
          cursor: not-allowed;
        }

        .voice-skeleton {
          height: 64px;
          border-radius: 14px;
          background: linear-gradient(
            90deg,
            rgba(255,255,255,.025),
            rgba(255,255,255,.06),
            rgba(255,255,255,.025)
          );
          background-size: 200% 100%;
          animation: skeleton 1.4s infinite;
        }

        .empty-voices {
          padding: 45px 20px;
          text-align: center;
          border: 1px dashed rgba(255,255,255,.1);
          border-radius: 15px;
        }

        .empty-voices > div {
          font-size: 28px;
          margin-bottom: 10px;
        }

        .empty-voices strong {
          display: block;
          color: #ddd;
          font-size: 13px;
        }

        .empty-voices p {
          color: #666;
          font-size: 10px;
        }

        .empty-voices button {
          padding: 8px 14px;
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 9px;
          background: rgba(255,255,255,.04);
          color: #aaa;
          cursor: pointer;
          font-size: 10px;
        }

        .voice-tip {
          display: flex;
          gap: 10px;
          margin-top: 14px;
          padding: 11px;
          border-radius: 13px;
          background: rgba(255,255,255,.025);
        }

        .voice-tip strong {
          color: #9999a3;
          font-size: 10px;
        }

        .voice-tip p {
          margin: 3px 0 0;
          color: #5e5e68;
          font-size: 9px;
        }

        /* RESULT */

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
          border-radius: 14px;
          background: rgba(139,92,246,.12);
          font-size: 21px;
        }

        .result-info {
          flex: 1;
        }

        .result-info span {
          display: block;
          color: #8b5cf6;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 1px;
        }

        .result-info strong {
          display: block;
          margin: 3px 0 9px;
          color: #ddd;
          font-size: 13px;
        }

        .audio-player {
          width: 100%;
          max-width: 600px;
          height: 35px;
        }

        .download-button {
          padding: 11px 14px;
          border: 1px solid rgba(255,255,255,.09);
          border-radius: 11px;
          background: rgba(255,255,255,.04);
          color: #ddd;
          cursor: pointer;
          font-size: 10px;
          font-weight: 700;
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

        @media (max-width: 900px) {
          .voice-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 600px) {
          .voice-page {
            padding: 25px 12px;
          }

          .voice-header h1 {
            font-size: 38px;
          }

          .header-mic {
            width: 55px;
            height: 55px;
            font-size: 23px;
          }

          .editor-panel,
          .voices-panel {
            padding: 16px;
            border-radius: 19px;
          }

          .filters {
            grid-template-columns: 1fr 1fr;
          }

          .result-panel {
            flex-wrap: wrap;
          }

          .result-info {
            width: calc(100% - 63px);
          }

          .download-button {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}