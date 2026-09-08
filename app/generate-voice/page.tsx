"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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

type VoicesResponse = {
  voices?: Voice[];
  hasMore?: boolean;
  totalCount?: number;
  nextPageToken?: string | null;
  error?: string;
};

type CreditsResponse = {
  balance?: number;
  error?: string;
  code?: string;
};

const MAX_TEXT_LENGTH = 40000;

/*
 * ElevenLabs Flash v2.5 approximate pricing.
 * 1 credit ≈ 2 characters.
 *
 * This is an estimate shown in the UI.
 * The backend remains the final authority.
 */
const ESTIMATED_CREDITS_PER_CHARACTER = 0.5;

export default function GenerateVoicePage() {
  /*
   * --------------------------------------------------
   * TEXT
   * --------------------------------------------------
   */

  const [text, setText] = useState("");

  /*
   * --------------------------------------------------
   * VOICES
   * --------------------------------------------------
   */

  const [voices, setVoices] = useState<
    Voice[]
  >([]);

  const [selectedVoice, setSelectedVoice] =
    useState<Voice | null>(null);

  /*
   * --------------------------------------------------
   * FILTERS
   * --------------------------------------------------
   */

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

  /*
   * --------------------------------------------------
   * SORT
   * --------------------------------------------------
   */

  const [sort, setSort] =
    useState("name");

  const [
    sortDirection,
    setSortDirection,
  ] = useState("asc");

  /*
   * --------------------------------------------------
   * LOADING STATES
   * --------------------------------------------------
   */

  const [
    loadingVoices,
    setLoadingVoices,
  ] = useState(true);

  const [
    loadingMore,
    setLoadingMore,
  ] = useState(false);

  const [
    generating,
    setGenerating,
  ] = useState(false);

  const [
    previewingVoiceId,
    setPreviewingVoiceId,
  ] = useState<string | null>(null);

  /*
   * --------------------------------------------------
   * CREDITS
   * --------------------------------------------------
   */

  const [
    creditBalance,
    setCreditBalance,
  ] = useState<number | null>(null);

  const [
    loadingCredits,
    setLoadingCredits,
  ] = useState(true);

  const [
    refreshingCredits,
    setRefreshingCredits,
  ] = useState(false);

  /*
   * --------------------------------------------------
   * AUDIO
   * --------------------------------------------------
   */

  const [
    audioUrl,
    setAudioUrl,
  ] = useState<string | null>(null);

  const audioRef =
    useRef<HTMLAudioElement | null>(
      null
    );

  /*
   * --------------------------------------------------
   * PAGINATION
   * --------------------------------------------------
   */

  const [
    hasMore,
    setHasMore,
  ] = useState(false);

  const [
    nextPageToken,
    setNextPageToken,
  ] = useState<string | null>(
    null
  );

  const [
    totalCount,
    setTotalCount,
  ] = useState(0);

  /*
   * --------------------------------------------------
   * ERROR
   * --------------------------------------------------
   */

  const [error, setError] =
    useState("");

  /*
   * --------------------------------------------------
   * SEARCH TIMER
   * --------------------------------------------------
   */

  const searchTimerRef =
    useRef<
      ReturnType<typeof setTimeout> | null
    >(null);

  /*
   * --------------------------------------------------
   * TEXT / CREDIT CALCULATIONS
   * --------------------------------------------------
   */

  const textLength =
    text.length;

  const estimatedCredits =
    Math.ceil(
      textLength *
        ESTIMATED_CREDITS_PER_CHARACTER
    );

  const textIsTooLong =
    textLength >
    MAX_TEXT_LENGTH;

  const remainingAfterGeneration =
    creditBalance === null
      ? null
      : creditBalance -
        estimatedCredits;

  const hasEnoughCredits =
    creditBalance !== null &&
    creditBalance >=
      estimatedCredits;

  const creditsNeeded =
    creditBalance === null
      ? 0
      : Math.max(
          estimatedCredits -
            creditBalance,
          0
        );

  const canGenerate =
    text.trim().length > 0 &&
    selectedVoice !== null &&
    !generating &&
    !textIsTooLong &&
    creditBalance !== null &&
    hasEnoughCredits;

  /*
   * --------------------------------------------------
   * LOAD CREDIT BALANCE
   * --------------------------------------------------
   */

  const loadCreditBalance =
    useCallback(
      async (
        silent = false
      ) => {
        try {
          if (silent) {
            setRefreshingCredits(
              true
            );
          } else {
            setLoadingCredits(
              true
            );
          }

          const response =
            await fetch(
              "/api/credits",
              {
                method: "GET",
                cache: "no-store",
              }
            );

          const data: CreditsResponse =
            await response.json();

          if (!response.ok) {
            throw new Error(
              data?.error ||
                "Failed to load credits."
            );
          }

          setCreditBalance(
            Number(
              data?.balance ?? 0
            )
          );
        } catch (error) {
          console.error(
            "Credit balance loading error:",
            error
          );

          setCreditBalance(
            null
          );
        } finally {
          setLoadingCredits(
            false
          );

          setRefreshingCredits(
            false
          );
        }
      },
      []
    );

  /*
   * --------------------------------------------------
   * INITIAL CREDIT LOAD
   * --------------------------------------------------
   */

  useEffect(() => {
    loadCreditBalance();
  }, [
    loadCreditBalance,
  ]);

  /*
   * --------------------------------------------------
   * LOAD VOICES
   * --------------------------------------------------
   */

  const loadVoices =
    useCallback(
      async (
        loadMore = false
      ) => {
        try {
          if (loadMore) {
            setLoadingMore(
              true
            );
          } else {
            setLoadingVoices(
              true
            );
            setError("");
          }

          const params =
            new URLSearchParams();

          params.set(
            "page_size",
            "50"
          );

          if (search.trim()) {
            params.set(
              "search",
              search.trim()
            );
          }

          if (
            gender !== "all"
          ) {
            params.set(
              "gender",
              gender
            );
          }

          if (age !== "all") {
            params.set(
              "age",
              age
            );
          }

          if (
            language !==
            "all"
          ) {
            params.set(
              "language",
              language
            );
          }

          if (
            accent !== "all"
          ) {
            params.set(
              "accent",
              accent
            );
          }

          if (
            category !==
            "all"
          ) {
            params.set(
              "category",
              category
            );
          }

          if (
            voiceType !==
            "all"
          ) {
            params.set(
              "voice_type",
              voiceType
            );
          }

          if (sort) {
            params.set(
              "sort",
              sort
            );
          }

          if (
            sortDirection
          ) {
            params.set(
              "sort_direction",
              sortDirection
            );
          }

          if (
            loadMore &&
            nextPageToken
          ) {
            params.set(
              "next_page_token",
              nextPageToken
            );
          }

          const response =
            await fetch(
              `/api/voices?${params.toString()}`,
              {
                method: "GET",
                cache: "no-store",
              }
            );

          const data: VoicesResponse =
            await response.json();

          if (!response.ok) {
            throw new Error(
              data?.error ||
                "Failed to load voices."
            );
          }

          const newVoices =
            data.voices ||
            [];

          setVoices(
            (current) =>
              loadMore
                ? [
                    ...current,
                    ...newVoices,
                  ]
                : newVoices
          );

          setHasMore(
            data.hasMore ??
              false
          );

          setNextPageToken(
            data.nextPageToken ??
              null
          );

          setTotalCount(
            data.totalCount ??
              newVoices.length
          );

          if (
            !loadMore &&
            newVoices.length >
              0
          ) {
            setSelectedVoice(
              (current) => {
                if (current) {
                  const stillExists =
                    newVoices.some(
                      (voice) =>
                        voice.id ===
                        current.id
                    );

                  if (
                    stillExists
                  ) {
                    return current;
                  }
                }

                return newVoices[0];
              }
            );
          }
        } catch (err) {
          console.error(
            "Voice loading error:",
            err
          );

          if (!loadMore) {
            setError(
              err instanceof Error
                ? err.message
                : "Failed to load voices."
            );
          }
        } finally {
          setLoadingVoices(
            false
          );

          setLoadingMore(
            false
          );
        }
      },
      [
        search,
        gender,
        age,
        language,
        accent,
        category,
        voiceType,
        sort,
        sortDirection,
        nextPageToken,
      ]
    );

  /*
   * --------------------------------------------------
   * VOICE FILTER EFFECT
   * --------------------------------------------------
   */

  useEffect(() => {
    loadVoices(false);
  }, [
    gender,
    age,
    language,
    accent,
    category,
    voiceType,
    sort,
    sortDirection,
  ]);

  /*
   * --------------------------------------------------
   * SEARCH EFFECT
   * --------------------------------------------------
   */

  useEffect(() => {
    if (
      searchTimerRef.current
    ) {
      clearTimeout(
        searchTimerRef.current
      );
    }

    searchTimerRef.current =
      setTimeout(() => {
        loadVoices(false);
      }, 500);

    return () => {
      if (
        searchTimerRef.current
      ) {
        clearTimeout(
          searchTimerRef.current
        );
      }
    };
  }, [search]);

  /*
   * --------------------------------------------------
   * AUDIO CLEANUP
   * --------------------------------------------------
   */

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(
          audioUrl
        );
      }
    };
  }, [audioUrl]);

  /*
   * --------------------------------------------------
   * CLEAR GENERATED AUDIO
   * --------------------------------------------------
   */

  const clearGeneratedAudio =
    () => {
      if (audioUrl) {
        URL.revokeObjectURL(
          audioUrl
        );
      }

      setAudioUrl(null);
    };

  /*
   * --------------------------------------------------
   * GENERATE VOICE
   * --------------------------------------------------
   */

  const handleGenerate =
    async () => {
      if (!canGenerate) {
        return;
      }

      try {
        setGenerating(true);
        setError("");

        clearGeneratedAudio();

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
                  selectedVoice.id,
              }),
            }
          );

        if (!response.ok) {
          let data: {
            error?: string;
            message?: string;
            code?: string;
            balance?: number;
            required?: number;
            missing?: number;
          } = {};

          try {
            data =
              await response.json();
          } catch {
            // Ignore invalid JSON.
          }

          /*
           * ZUQEN insufficient credits
           */

          if (
            data.code ===
            "insufficient_credits"
          ) {
            if (
              typeof data.balance ===
              "number"
            ) {
              setCreditBalance(
                data.balance
              );
            }

            const required =
              Number(
                data.required ??
                  estimatedCredits
              );

            const balance =
              Number(
                data.balance ??
                  creditBalance ??
                  0
              );

            const missing =
              Math.max(
                required -
                  balance,
                0
              );

            throw new Error(
              `Not enough ZUQEN credits. You need ${missing.toLocaleString()} more credits.`
            );
          }

          /*
           * ElevenLabs quota
           */

          if (
            data.code ===
            "elevenlabs_quota_exceeded"
          ) {
            throw new Error(
              "The ElevenLabs account does not have enough credits for this generation."
            );
          }

          /*
           * Generic error
           */

          throw new Error(
            data.message ||
              data.error ||
              "Failed to generate voice."
          );
        }

        /*
         * Get generated audio
         */

        const blob =
          await response.blob();

        if (
          !blob ||
          blob.size === 0
        ) {
          throw new Error(
            "The generated audio is empty."
          );
        }

        const url =
          URL.createObjectURL(
            blob
          );

        setAudioUrl(url);

        /*
         * Update ZUQEN balance
         * from response header.
         */

        const remainingHeader =
          response.headers.get(
            "X-Zuqen-Credits-Remaining"
          );

        if (
          remainingHeader
        ) {
          const newBalance =
            Number(
              remainingHeader
            );

          if (
            Number.isFinite(
              newBalance
            )
          ) {
            setCreditBalance(
              newBalance
            );
          } else {
            await loadCreditBalance(
              true
            );
          }
        } else {
          await loadCreditBalance(
            true
          );
        }
      } catch (err) {
        console.error(
          "Voice generation error:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Failed to generate voice."
        );
      } finally {
        setGenerating(
          false
        );
      }
    };

  /*
   * --------------------------------------------------
   * VOICE PREVIEW
   * --------------------------------------------------
   */

  const handlePreview = (
    voice: Voice
  ) => {
    if (
      !voice.previewUrl
    ) {
      return;
    }

    try {
      if (
        audioRef.current
      ) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const audio =
        new Audio(
          voice.previewUrl
        );

      audioRef.current =
        audio;

      setPreviewingVoiceId(
        voice.id
      );

      audio.onended = () => {
        setPreviewingVoiceId(
          null
        );
      };

      audio.onerror = () => {
        setPreviewingVoiceId(
          null
        );

        setError(
          "Unable to play this voice preview."
        );
      };

      audio
        .play()
        .catch(() => {
          setPreviewingVoiceId(
            null
          );
        });
    } catch {
      setPreviewingVoiceId(
        null
      );
    }
  };

  /*
   * --------------------------------------------------
   * RESET FILTERS
   * --------------------------------------------------
   */

  const resetFilters =
    () => {
      setSearch("");
      setGender("all");
      setAge("all");
      setLanguage("all");
      setAccent("all");
      setCategory("all");
      setVoiceType("all");
      setSort("name");
      setSortDirection(
        "asc"
      );
    };

  const filteredVoiceCount =
    useMemo(() => {
      return voices.length;
    }, [voices]);

  /*
   * --------------------------------------------------
   * UI
   * --------------------------------------------------
   */

  return (
    <main className="voice-page">
      <div className="background-glow glow-one" />
      <div className="background-glow glow-two" />

      {/* ============================================
          TOP BAR
      ============================================ */}

      <header className="topbar">
        <div>
          <div className="brand">
            ZUQEN AI
          </div>

          <div className="studio-label">
            Voice Studio
          </div>
        </div>

        <div className="topbar-right">
          <div className="top-credit-badge">
            <span className="top-credit-icon">
              ✦
            </span>

            <span>
              {loadingCredits
                ? "Loading..."
                : creditBalance ===
                  null
                ? "Credits unavailable"
                : `${creditBalance.toLocaleString()} credits`}
            </span>
          </div>

          <div className="model-badge">
            <span className="status-dot" />
            Eleven Flash v2.5
          </div>
        </div>
      </header>

      {/* ============================================
          HERO
      ============================================ */}

      <section className="hero">
        <div>
          <div className="eyebrow">
            AI VOICE GENERATOR
          </div>

          <h1>
            Turn your text into
            <span>
              {" "}
              natural speech.
            </span>
          </h1>

          <p>
            Write anything, choose a
            voice, and generate realistic
            speech using ElevenLabs.
          </p>
        </div>
      </section>

      {/* ============================================
          WORKSPACE
      ============================================ */}

      <section className="workspace">
        {/* ==========================================
            EDITOR
        ========================================== */}

        <div className="editor-card card">
          <div className="card-header">
            <div>
              <h2>
                Text to Speech
              </h2>

              <p>
                Enter the text you want
                to convert into audio.
              </p>
            </div>

            <div className="character-counter">
              {textLength.toLocaleString()}
              {" / "}
              {MAX_TEXT_LENGTH.toLocaleString()}
            </div>
          </div>

          <textarea
            value={text}
            maxLength={
              MAX_TEXT_LENGTH
            }
            onChange={(event) =>
              setText(
                event.target.value
              )
            }
            placeholder="Type or paste your text here..."
            className="text-editor"
          />

          <div className="editor-footer">
            <span>
              {textLength === 0
                ? "Ready to generate"
                : `${textLength.toLocaleString()} characters`}
            </span>

            {textLength > 0 && (
              <span>
                Estimated cost:{" "}
                <strong>
                  ~
                  {estimatedCredits.toLocaleString()}
                </strong>{" "}
                credits
              </span>
            )}
          </div>

          {/* ========================================
              WARNING
          ======================================== */}

          {textIsTooLong && (
            <div className="warning-box">
              <strong>
                Text is too long.
              </strong>

              <span>
                Please keep the text
                below{" "}
                {MAX_TEXT_LENGTH.toLocaleString()}{" "}
                characters.
              </span>
            </div>
          )}

          {/* ========================================
              ERROR
          ======================================== */}

          {error && (
            <div className="error-box">
              <div className="error-icon">
                !
              </div>

              <div>
                <strong>
                  Generation failed
                </strong>

                <p>
                  {error}
                </p>
              </div>
            </div>
          )}

          {/* ========================================
              CREDIT SUMMARY
          ======================================== */}

          <div className="credit-summary">
            <div className="credit-summary-header">
              <div>
                <span className="small-label">
                  ZUQEN CREDITS
                </span>

                <strong>
                  {loadingCredits
                    ? "Loading..."
                    : creditBalance ===
                      null
                    ? "Unavailable"
                    : creditBalance.toLocaleString()}
                </strong>
              </div>

              <button
                type="button"
                className="credit-refresh"
                onClick={() =>
                  loadCreditBalance(
                    true
                  )
                }
                disabled={
                  loadingCredits ||
                  refreshingCredits
                }
                title="Refresh credit balance"
              >
                {refreshingCredits
                  ? "↻"
                  : "⟳"}
              </button>
            </div>

            <div className="credit-divider" />

            <div className="credit-row">
              <span>
                Available credits
              </span>

              <strong>
                {loadingCredits
                  ? "—"
                  : creditBalance ===
                    null
                  ? "—"
                  : creditBalance.toLocaleString()}
              </strong>
            </div>

            <div className="credit-row">
              <span>
                This generation
              </span>

              <strong>
                {textLength === 0
                  ? "0"
                  : `~${estimatedCredits.toLocaleString()}`}
              </strong>
            </div>

            <div className="credit-row remaining-row">
              <span>
                Remaining after generation
              </span>

              <strong
                className={
                  remainingAfterGeneration !==
                    null &&
                  remainingAfterGeneration <
                    0
                    ? "credits-danger"
                    : ""
                }
              >
                {textLength ===
                0
                  ? creditBalance ===
                    null
                    ? "—"
                    : creditBalance.toLocaleString()
                  : remainingAfterGeneration ===
                    null
                  ? "—"
                  : remainingAfterGeneration >=
                    0
                  ? remainingAfterGeneration.toLocaleString()
                  : `-${Math.abs(
                      remainingAfterGeneration
                    ).toLocaleString()}`}
              </strong>
            </div>

            {/* ======================================
                INSUFFICIENT CREDIT WARNING
            ====================================== */}

            {textLength > 0 &&
              creditBalance !==
                null &&
              !hasEnoughCredits && (
                <div className="credit-warning">
                  <span className="credit-warning-icon">
                    !
                  </span>

                  <div>
                    <strong>
                      Not enough credits
                    </strong>

                    <p>
                      You need{" "}
                      <b>
                        {creditsNeeded.toLocaleString()}
                      </b>{" "}
                      more credits for
                      this generation.
                    </p>
                  </div>
                </div>
              )}

            {/* ======================================
                ESTIMATE NOTE
            ====================================== */}

            {textLength > 0 &&
              hasEnoughCredits && (
                <div className="credit-safe">
                  <span>
                    ✓
                  </span>

                  <p>
                    You have enough
                    credits for this
                    generation.
                  </p>
                </div>
              )}
          </div>

          {/* ========================================
              SELECTED VOICE
          ======================================== */}

          <div className="selected-voice">
            <div>
              <span className="small-label">
                SELECTED VOICE
              </span>

              <strong>
                {selectedVoice
                  ? selectedVoice.name
                  : "No voice selected"}
              </strong>

              {selectedVoice && (
                <span className="voice-meta">
                  {[
                    selectedVoice.gender,
                    selectedVoice.age,
                    selectedVoice.accent,
                  ]
                    .filter(Boolean)
                    .join(
                      " • "
                    )}
                </span>
              )}
            </div>

            <div className="selected-check">
              ✓
            </div>
          </div>

          {/* ========================================
              GENERATE BUTTON
          ======================================== */}

          <button
            className="generate-button"
            disabled={
              !canGenerate
            }
            onClick={
              handleGenerate
            }
          >
            {generating ? (
              <>
                <span className="spinner" />
                Generating voice...
              </>
            ) : (
              <>
                <span className="sparkle">
                  ✦
                </span>
                Generate Voice
              </>
            )}
          </button>

          {/* ========================================
              RESULT
          ======================================== */}

          {audioUrl && (
            <div className="result-card">
              <div className="result-title">
                <div>
                  <span className="small-label">
                    GENERATED AUDIO
                  </span>

                  <strong>
                    Your voice is ready
                  </strong>
                </div>

                <span className="success-badge">
                  ✓ Ready
                </span>
              </div>

              <audio
                controls
                src={audioUrl}
                className="audio-player"
              />

              <a
                href={audioUrl}
                download="zuqen-ai-voice.mp3"
                className="download-button"
              >
                ↓ Download MP3
              </a>
            </div>
          )}
        </div>

        {/* ==========================================
            VOICE LIBRARY
        ========================================== */}

        <aside className="library-card card">
          <div className="card-header library-header">
            <div>
              <h2>
                Voice Library
              </h2>

              <p>
                Choose the perfect voice
                for your content.
              </p>
            </div>

            <div className="voice-count">
              {totalCount > 0
                ? totalCount.toLocaleString()
                : filteredVoiceCount.toLocaleString()}
            </div>
          </div>

          {/* ========================================
              SEARCH
          ======================================== */}

          <div className="search-box">
            <span>
              ⌕
            </span>

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search voices..."
            />
          </div>

          {/* ========================================
              FILTERS
          ======================================== */}

          <div className="filters">
            <select
              value={gender}
              onChange={(event) =>
                setGender(
                  event.target.value
                )
              }
            >
              <option value="all">
                All genders
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
                setAge(
                  event.target.value
                )
              }
            >
              <option value="all">
                All ages
              </option>

              <option value="young">
                Young
              </option>

              <option value="middle-aged">
                Middle-aged
              </option>

              <option value="old">
                Old
              </option>
            </select>

            <select
              value={language}
              onChange={(event) =>
                setLanguage(
                  event.target.value
                )
              }
            >
              <option value="all">
                All languages
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
                setAccent(
                  event.target.value
                )
              }
            >
              <option value="all">
                All accents
              </option>

              <option value="american">
                American
              </option>

              <option value="british">
                British
              </option>

              <option value="australian">
                Australian
              </option>

              <option value="indian">
                Indian
              </option>

              <option value="canadian">
                Canadian
              </option>
            </select>

            <select
              value={category}
              onChange={(event) =>
                setCategory(
                  event.target.value
                )
              }
            >
              <option value="all">
                All categories
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
                setVoiceType(
                  event.target.value
                )
              }
            >
              <option value="all">
                All types
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

          {/* ========================================
              SORT
          ======================================== */}

          <div className="library-actions">
            <select
              value={sort}
              onChange={(event) =>
                setSort(
                  event.target.value
                )
              }
            >
              <option value="name">
                Sort by name
              </option>

              <option value="created_at">
                Sort by newest
              </option>
            </select>

            <button
              onClick={() =>
                setSortDirection(
                  (current) =>
                    current ===
                    "asc"
                      ? "desc"
                      : "asc"
                )
              }
              className="sort-button"
              title="Change sort direction"
            >
              {sortDirection ===
              "asc"
                ? "↑"
                : "↓"}
            </button>

            <button
              onClick={
                resetFilters
              }
              className="reset-button"
            >
              Reset
            </button>
          </div>

          {/* ========================================
              VOICE LIST
          ======================================== */}

          <div className="voices-list">
            {loadingVoices ? (
              <div className="loading-state">
                <span className="spinner large" />

                Loading voices...
              </div>
            ) : voices.length ===
              0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  ♪
                </div>

                <strong>
                  No voices found
                </strong>

                <p>
                  Try changing your
                  search or filters.
                </p>
              </div>
            ) : (
              voices.map(
                (voice) => {
                  const isSelected =
                    selectedVoice?.id ===
                    voice.id;

                  const isPreviewing =
                    previewingVoiceId ===
                    voice.id;

                  return (
                    <div
                      key={
                        voice.id
                      }
                      className={`voice-item ${
                        isSelected
                          ? "selected"
                          : ""
                      }`}
                      onClick={() =>
                        setSelectedVoice(
                          voice
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

                      <div className="voice-info">
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

                      {voice.previewUrl && (
                        <button
                          className="preview-button"
                          onClick={(
                            event
                          ) => {
                            event.stopPropagation();

                            handlePreview(
                              voice
                            );
                          }}
                          title={
                            isPreviewing
                              ? "Playing"
                              : "Preview"
                          }
                        >
                          {isPreviewing
                            ? "■"
                            : "▶"}
                        </button>
                      )}

                      {isSelected && (
                        <div className="voice-selected">
                          ✓
                        </div>
                      )}
                    </div>
                  );
                }
              )
            )}
          </div>

          {/* ========================================
              LOAD MORE
          ======================================== */}

          {hasMore && (
            <button
              className="load-more"
              disabled={
                loadingMore
              }
              onClick={() =>
                loadVoices(
                  true
                )
              }
            >
              {loadingMore ? (
                <>
                  <span className="spinner" />
                  Loading...
                </>
              ) : (
                "Load more voices"
              )}
            </button>
          )}
        </aside>
      </section>

      {/* ============================================
          FOOTER
      ============================================ */}

      <footer className="footer">
        <span>
          ZUQEN AI Voice Studio
        </span>

        <span>
          Powered by ElevenLabs
        </span>
      </footer>

      {/* ============================================
          STYLES
      ============================================ */}

      <style jsx>{`
        .voice-page {
          min-height: 100vh;
          background:
            radial-gradient(
              circle at 20% 10%,
              rgba(124, 92, 255, 0.12),
              transparent 35%
            ),
            radial-gradient(
              circle at 80% 30%,
              rgba(0, 210, 255, 0.08),
              transparent 30%
            ),
            #07070b;
          color: #f5f5f7;
          padding: 0 32px 50px;
          position: relative;
          overflow: hidden;
        }

        .background-glow {
          position: fixed;
          width: 500px;
          height: 500px;
          border-radius: 50%;
          filter: blur(120px);
          opacity: 0.08;
          pointer-events: none;
        }

        .glow-one {
          top: -250px;
          left: -200px;
          background: #7c5cff;
        }

        .glow-two {
          right: -250px;
          bottom: -250px;
          background: #00d2ff;
        }

        .topbar {
          max-width: 1450px;
          margin: 0 auto;
          min-height: 86px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          border-bottom: 1px solid
            rgba(255, 255, 255, 0.07);
        }

        .brand {
          font-size: 18px;
          font-weight: 900;
          letter-spacing: 0.12em;
        }

        .studio-label {
          color: #777783;
          font-size: 12px;
          margin-top: 4px;
        }

        .topbar-right {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .top-credit-badge {
          border: 1px solid
            rgba(137, 114, 255, 0.18);
          background: rgba(
            124,
            92,
            255,
            0.07
          );
          padding: 9px 13px;
          border-radius: 999px;
          font-size: 11px;
          color: #c5bbff;
          display: flex;
          align-items: center;
          gap: 7px;
          white-space: nowrap;
        }

        .top-credit-icon {
          color: #a995ff;
          font-size: 13px;
        }

        .model-badge {
          border: 1px solid
            rgba(255, 255, 255, 0.1);
          background: rgba(
            255,
            255,
            255,
            0.04
          );
          padding: 9px 13px;
          border-radius: 999px;
          font-size: 12px;
          color: #bcbcc7;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #56e39f;
          box-shadow: 0 0 12px
            rgba(86, 227, 159, 0.8);
        }

        .hero {
          max-width: 1450px;
          margin: 0 auto;
          padding: 55px 0 35px;
        }

        .eyebrow {
          color: #8f78ff;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.18em;
          margin-bottom: 14px;
        }

        .hero h1 {
          font-size: clamp(
            38px,
            5vw,
            70px
          );
          line-height: 0.98;
          letter-spacing: -0.055em;
          margin: 0;
          max-width: 900px;
        }

        .hero h1 span {
          color: #8872ff;
        }

        .hero p {
          color: #858591;
          max-width: 600px;
          line-height: 1.7;
          font-size: 15px;
          margin-top: 22px;
        }

        .workspace {
          max-width: 1450px;
          margin: 0 auto;
          display: grid;
          grid-template-columns:
            minmax(0, 1.1fr)
            minmax(380px, 0.9fr);
          gap: 22px;
          align-items: start;
        }

        .card {
          border: 1px solid
            rgba(255, 255, 255, 0.08);
          background: rgba(
            15,
            15,
            22,
            0.88
          );
          border-radius: 22px;
          box-shadow:
            0 20px 80px
              rgba(0, 0, 0, 0.28);
          backdrop-filter: blur(20px);
        }

        .editor-card {
          padding: 25px;
        }

        .library-card {
          padding: 25px;
          position: sticky;
          top: 20px;
        }

        .card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 18px;
        }

        .card-header h2 {
          margin: 0;
          font-size: 18px;
        }

        .card-header p {
          margin: 6px 0 0;
          color: #777783;
          font-size: 12px;
        }

        .character-counter {
          color: #898994;
          font-size: 12px;
          white-space: nowrap;
        }

        .text-editor {
          width: 100%;
          min-height: 390px;
          resize: vertical;
          box-sizing: border-box;
          border: 1px solid
            rgba(255, 255, 255, 0.08);
          background: rgba(
            255,
            255,
            255,
            0.025
          );
          border-radius: 15px;
          color: #f4f4f6;
          padding: 20px;
          outline: none;
          font-size: 15px;
          line-height: 1.8;
          font-family: inherit;
          transition: 0.2s ease;
        }

        .text-editor:focus {
          border-color: rgba(
            137,
            114,
            255,
            0.55
          );
          box-shadow: 0 0 0 3px
            rgba(137, 114, 255, 0.08);
        }

        .text-editor::placeholder {
          color: #50505b;
        }

        .editor-footer {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          margin: 10px 2px 18px;
          color: #686873;
          font-size: 11px;
        }

        .editor-footer strong {
          color: #a995ff;
        }

        .warning-box,
        .error-box {
          display: flex;
          gap: 12px;
          padding: 14px;
          border-radius: 13px;
          margin-bottom: 16px;
          font-size: 12px;
        }

        .warning-box {
          border: 1px solid
            rgba(255, 184, 77, 0.2);
          background: rgba(
            255,
            184,
            77,
            0.06
          );
          color: #ffcf87;
        }

        .warning-box span {
          color: #a89575;
        }

        .error-box {
          border: 1px solid
            rgba(255, 80, 100, 0.25);
          background: rgba(
            255,
            80,
            100,
            0.06
          );
          color: #ff9ba8;
        }

        .error-box p {
          margin: 5px 0 0;
          color: #c7848d;
          line-height: 1.5;
        }

        .error-icon {
          width: 22px;
          height: 22px;
          flex: 0 0 22px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: rgba(
            255,
            80,
            100,
            0.15
          );
          font-weight: 900;
        }

        /* ==========================================
           CREDIT SUMMARY
        ========================================== */

        .credit-summary {
          border: 1px solid
            rgba(137, 114, 255, 0.18);
          background:
            linear-gradient(
              135deg,
              rgba(124, 92, 255, 0.075),
              rgba(255, 255, 255, 0.025)
            );
          border-radius: 15px;
          padding: 16px;
          margin-bottom: 12px;
        }

        .credit-summary-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
        }

        .credit-summary-header > div:first-child {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .credit-summary-header strong {
          font-size: 24px;
          letter-spacing: -0.03em;
        }

        .credit-refresh {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          border: 1px solid
            rgba(255, 255, 255, 0.08);
          background: rgba(
            255,
            255,
            255,
            0.045
          );
          color: #aaaab5;
          cursor: pointer;
          font-size: 17px;
          transition: 0.2s ease;
        }

        .credit-refresh:hover:not(
            :disabled
          ) {
          background: rgba(
            255,
            255,
            255,
            0.08
          );
          color: white;
        }

        .credit-refresh:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .credit-divider {
          height: 1px;
          background: rgba(
            255,
            255,
            255,
            0.06
          );
          margin: 14px 0 10px;
        }

        .credit-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 7px 0;
          color: #777783;
          font-size: 11px;
        }

        .credit-row strong {
          color: #bdbdc7;
          font-size: 12px;
        }

        .remaining-row {
          padding-top: 10px;
          margin-top: 3px;
          border-top: 1px solid
            rgba(255, 255, 255, 0.04);
        }

        .remaining-row strong {
          color: #a995ff;
          font-size: 13px;
        }

        .credits-danger {
          color: #ff7f8e !important;
        }

        .credit-warning {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-top: 12px;
          padding: 11px;
          border-radius: 11px;
          border: 1px solid
            rgba(255, 80, 100, 0.18);
          background: rgba(
            255,
            80,
            100,
            0.055
          );
        }

        .credit-warning-icon {
          width: 20px;
          height: 20px;
          flex: 0 0 20px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: rgba(
            255,
            80,
            100,
            0.15
          );
          color: #ff9ba8;
          font-size: 11px;
          font-weight: 900;
        }

        .credit-warning strong {
          color: #ff9ba8;
          font-size: 11px;
        }

        .credit-warning p {
          margin: 4px 0 0;
          color: #b87983;
          font-size: 10px;
          line-height: 1.5;
        }

        .credit-warning b {
          color: #ff9ba8;
        }

        .credit-safe {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 11px;
          padding: 9px 10px;
          border-radius: 10px;
          background: rgba(
            86,
            227,
            159,
            0.045
          );
          border: 1px solid
            rgba(86, 227, 159, 0.1);
        }

        .credit-safe > span {
          color: #72e4ad;
          font-weight: 900;
          font-size: 11px;
        }

        .credit-safe p {
          margin: 0;
          color: #759986;
          font-size: 10px;
        }

        .selected-voice {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px 16px;
          border: 1px solid
            rgba(137, 114, 255, 0.2);
          background: rgba(
            137,
            114,
            255,
            0.055
          );
          border-radius: 14px;
          margin-bottom: 12px;
        }

        .selected-voice > div:first-child {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .small-label {
          color: #777783;
          font-size: 9px;
          letter-spacing: 0.14em;
          font-weight: 800;
        }

        .selected-voice strong {
          font-size: 14px;
        }

        .voice-meta {
          color: #7d7d88;
          font-size: 10px;
        }

        .selected-check,
        .voice-selected {
          width: 24px;
          height: 24px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #7c5cff;
          color: white;
          font-size: 12px;
          font-weight: 900;
        }

        .generate-button {
          width: 100%;
          border: 0;
          border-radius: 14px;
          padding: 15px 18px;
          background: linear-gradient(
            135deg,
            #8b72ff,
            #6b50ed
          );
          color: white;
          font-weight: 800;
          cursor: pointer;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          box-shadow: 0 12px 30px
            rgba(124, 92, 255, 0.2);
          transition: 0.2s ease;
        }

        .generate-button:hover:not(
            :disabled
          ) {
          transform: translateY(-1px);
          box-shadow: 0 15px 35px
            rgba(124, 92, 255, 0.3);
        }

        .generate-button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          box-shadow: none;
        }

        .sparkle {
          font-size: 17px;
        }

        .spinner {
          width: 14px;
          height: 14px;
          border: 2px solid
            rgba(255, 255, 255, 0.35);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        .spinner.large {
          width: 22px;
          height: 22px;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .result-card {
          margin-top: 15px;
          border: 1px solid
            rgba(86, 227, 159, 0.15);
          background: rgba(
            86,
            227,
            159,
            0.035
          );
          border-radius: 15px;
          padding: 16px;
        }

        .result-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 13px;
        }

        .result-title > div {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .success-badge {
          color: #72e4ad;
          font-size: 10px;
          font-weight: 800;
          padding: 6px 9px;
          border-radius: 999px;
          background: rgba(
            86,
            227,
            159,
            0.08
          );
        }

        .audio-player {
          width: 100%;
          height: 42px;
        }

        .download-button {
          margin-top: 12px;
          display: block;
          text-align: center;
          padding: 10px;
          border-radius: 10px;
          background: rgba(
            255,
            255,
            255,
            0.06
          );
          color: #dddde3;
          text-decoration: none;
          font-size: 11px;
          font-weight: 700;
        }

        .download-button:hover {
          background: rgba(
            255,
            255,
            255,
            0.1
          );
        }

        .search-box {
          height: 43px;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 0 13px;
          border-radius: 12px;
          border: 1px solid
            rgba(255, 255, 255, 0.08);
          background: rgba(
            255,
            255,
            255,
            0.025
          );
          margin-bottom: 10px;
        }

        .search-box span {
          color: #73737e;
          font-size: 20px;
        }

        .search-box input {
          flex: 1;
          min-width: 0;
          background: transparent;
          border: 0;
          outline: 0;
          color: white;
          font-family: inherit;
          font-size: 12px;
        }

        .search-box input::placeholder {
          color: #565661;
        }

        .filters {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 7px;
        }

        .filters select,
        .library-actions select {
          min-width: 0;
          height: 36px;
          border: 1px solid
            rgba(255, 255, 255, 0.07);
          border-radius: 9px;
          background: #15151d;
          color: #a9a9b3;
          padding: 0 9px;
          font-size: 10px;
          outline: none;
        }

        .library-actions {
          display: flex;
          gap: 7px;
          margin: 10px 0;
        }

        .library-actions select {
          flex: 1;
        }

        .sort-button,
        .reset-button {
          height: 36px;
          border-radius: 9px;
          border: 1px solid
            rgba(255, 255, 255, 0.07);
          background: rgba(
            255,
            255,
            255,
            0.04
          );
          color: #aaaab4;
          padding: 0 10px;
          cursor: pointer;
          font-size: 10px;
        }

        .voices-list {
          max-height: 590px;
          overflow-y: auto;
          padding-right: 3px;
        }

        .voices-list::-webkit-scrollbar {
          width: 5px;
        }

        .voices-list::-webkit-scrollbar-thumb {
          background: rgba(
            255,
            255,
            255,
            0.1
          );
          border-radius: 99px;
        }

        .voice-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px;
          border-radius: 12px;
          border: 1px solid transparent;
          cursor: pointer;
          transition: 0.15s ease;
        }

        .voice-item:hover {
          background: rgba(
            255,
            255,
            255,
            0.035
          );
        }

        .voice-item.selected {
          background: rgba(
            124,
            92,
            255,
            0.07
          );
          border-color: rgba(
            124,
            92,
            255,
            0.2
          );
        }

        .voice-avatar {
          width: 38px;
          height: 38px;
          flex: 0 0 38px;
          display: grid;
          place-items: center;
          border-radius: 11px;
          background: linear-gradient(
            135deg,
            rgba(124, 92, 255, 0.28),
            rgba(0, 210, 255, 0.12)
          );
          color: #c7bcff;
          font-size: 13px;
          font-weight: 800;
        }

        .voice-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .voice-info strong {
          font-size: 12px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .voice-info span {
          color: #696974;
          font-size: 9px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .preview-button {
          width: 29px;
          height: 29px;
          flex: 0 0 29px;
          border-radius: 9px;
          border: 1px solid
            rgba(255, 255, 255, 0.08);
          background: rgba(
            255,
            255,
            255,
            0.04
          );
          color: #aaaab5;
          cursor: pointer;
          font-size: 10px;
        }

        .voice-selected {
          width: 20px;
          height: 20px;
          font-size: 10px;
        }

        .loading-state,
        .empty-state {
          min-height: 240px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 10px;
          color: #777783;
          text-align: center;
        }

        .empty-icon {
          width: 45px;
          height: 45px;
          display: grid;
          place-items: center;
          border-radius: 14px;
          background: rgba(
            255,
            255,
            255,
            0.04
          );
          font-size: 20px;
        }

        .empty-state strong {
          color: #b4b4be;
          font-size: 13px;
        }

        .empty-state p {
          margin: 0;
          font-size: 11px;
        }

        .load-more {
          width: 100%;
          margin-top: 10px;
          height: 39px;
          border-radius: 10px;
          border: 1px solid
            rgba(255, 255, 255, 0.08);
          background: rgba(
            255,
            255,
            255,
            0.035
          );
          color: #aaaab5;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 11px;
        }

        .load-more:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .voice-count {
          color: #777783;
          font-size: 11px;
          white-space: nowrap;
        }

        .footer {
          max-width: 1450px;
          margin: 45px auto 0;
          padding-top: 20px;
          border-top: 1px solid
            rgba(255, 255, 255, 0.06);
          display: flex;
          justify-content: space-between;
          color: #4e4e58;
          font-size: 10px;
        }

        @media (max-width: 1050px) {
          .workspace {
            grid-template-columns: 1fr;
          }

          .library-card {
            position: static;
          }

          .voices-list {
            max-height: 500px;
          }
        }

        @media (max-width: 750px) {
          .topbar {
            align-items: flex-start;
            padding: 18px 0;
          }

          .topbar-right {
            flex-direction: column;
            align-items: flex-end;
          }

          .top-credit-badge {
            font-size: 10px;
          }
        }

        @media (max-width: 650px) {
          .voice-page {
            padding: 0 15px 35px;
          }

          .topbar {
            min-height: 72px;
          }

          .model-badge {
            display: none;
          }

          .hero {
            padding: 40px 0 28px;
          }

          .hero h1 {
            font-size: 42px;
          }

          .editor-card,
          .library-card {
            padding: 17px;
            border-radius: 17px;
          }

          .text-editor {
            min-height: 300px;
          }

          .filters {
            grid-template-columns: 1fr;
          }

          .library-actions {
            flex-wrap: wrap;
          }

          .library-actions select {
            min-width: 100%;
          }

          .footer {
            flex-direction: column;
            gap: 7px;
          }
        }
      `}</style>
    </main>
  );
}