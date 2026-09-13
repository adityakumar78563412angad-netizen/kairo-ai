"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const MAX_PROMPT_LENGTH = 10000;

// Temporary testing cost.
// Final Website Builder credit cost actual Gemini usage
// measure karne ke baad decide kiya jayega.
const ESTIMATED_CREDITS = 100;

type CreditsResponse = {
  balance?: number;
  error?: string;
  code?: string;
};

export default function WebsiteBuilderPage() {
  const router = useRouter();

  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [creditBalance, setCreditBalance] =
    useState<number | null>(null);

  const [loadingCredits, setLoadingCredits] =
    useState(true);

  const [refreshingCredits, setRefreshingCredits] =
    useState(false);

  const remainingCredits =
    creditBalance === null
      ? null
      : creditBalance - ESTIMATED_CREDITS;

  const hasEnoughCredits =
    creditBalance !== null &&
    creditBalance >= ESTIMATED_CREDITS;

  const creditsNeeded =
    creditBalance === null
      ? 0
      : Math.max(
          ESTIMATED_CREDITS - creditBalance,
          0
        );

  async function loadCredits(silent = false) {
    try {
      if (silent) {
        setRefreshingCredits(true);
      } else {
        setLoadingCredits(true);
      }

      const response = await fetch(
        "/api/credits?feature=website_builder",
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const data: CreditsResponse =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Credits load nahi ho paaye."
        );
      }

      const balance = Number(
        data.balance ?? 0
      );

      if (Number.isFinite(balance)) {
        setCreditBalance(balance);
      } else {
        setCreditBalance(0);
      }
    } catch (err) {
      console.error(
        "Website Builder credits error:",
        err
      );

      setCreditBalance(null);
    } finally {
      setLoadingCredits(false);
      setRefreshingCredits(false);
    }
  }

  useEffect(() => {
    loadCredits();
  }, []);

  async function generateWebsite(
    event?: FormEvent
  ) {
    event?.preventDefault();

    const finalPrompt = prompt.trim();

    if (!finalPrompt) {
      setError(
        "Pehle batao ki tum kis type ki website banana chahte ho."
      );
      return;
    }

    if (
      finalPrompt.length >
      MAX_PROMPT_LENGTH
    ) {
      setError(
        `Prompt ${MAX_PROMPT_LENGTH.toLocaleString()} characters se chhota rakho.`
      );
      return;
    }

    if (creditBalance === null) {
      setError(
        "Credit balance load nahi hua. Thodi der baad dobara try karo."
      );
      return;
    }

    if (!hasEnoughCredits) {
      setError(
        `Not enough ZUQEN credits. Tumhe ${creditsNeeded.toLocaleString()} aur credits chahiye.`
      );
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await fetch(
        "/api/website-builder",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "generate",
            prompt: finalPrompt,
          }),
        }
      );

      let data: {
        success?: boolean;
        html?: string;
        error?: string;
        message?: string;
        code?: string;
        balance?: number;
        required?: number;
        missing?: number;
        measurementMode?: boolean;
        creditsConsumed?: number;
      } = {};

      try {
        data = await response.json();
      } catch {
        throw new Error(
          "Server ne valid response nahi diya."
        );
      }

      if (!response.ok || !data.success) {
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
                ESTIMATED_CREDITS
            );

          const balance =
            Number(
              data.balance ??
                creditBalance ??
                0
            );

          const missing =
            Math.max(
              required - balance,
              0
            );

          throw new Error(
            `Not enough ZUQEN credits. Tumhe ${missing.toLocaleString()} aur credits chahiye.`
          );
        }

        if (
          data.code ===
          "SIGN_IN_REQUIRED"
        ) {
          throw new Error(
            "Please sign in to use Website Builder."
          );
        }

        throw new Error(
          data.error ||
            data.message ||
            "Website generate nahi ho payi."
        );
      }

      if (
        !data.html ||
        typeof data.html !==
          "string"
      ) {
        throw new Error(
          "AI ne valid website code return nahi kiya."
        );
      }

      const websiteName =
        createWebsiteName(
          finalPrompt
        );

      sessionStorage.setItem(
        "ZUQEN-website-builder-project",
        JSON.stringify({
          prompt: finalPrompt,
          html: data.html,
          name: websiteName,
          createdAt:
            new Date().toISOString(),
        })
      );

      // Measurement mode me credits consume nahi hote.
      // Normal mode me backend remaining balance bhej sakta hai.
      const remainingHeader =
        response.headers.get(
          "X-Zuqen-Credits-Remaining"
        );

      if (remainingHeader) {
        const newBalance =
          Number(remainingHeader);

        if (
          Number.isFinite(newBalance)
        ) {
          setCreditBalance(
            newBalance
          );
        } else {
          await loadCredits(true);
        }
      } else if (
        typeof data.balance ===
        "number"
      ) {
        setCreditBalance(
          data.balance
        );
      } else {
        await loadCredits(true);
      }

      router.push(
        "/website-builder/editor"
      );
    } catch (err) {
      console.error(
        "Website Builder generation error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Website generate karte waqt kuch galat ho gaya."
      );

      setLoading(false);
    }
  }

  function createWebsiteName(
    text: string
  ) {
    const cleaned = text
      .replace(
        /create|make|build|design|a|an|the|website|site/gi,
        " "
      )
      .replace(/\s+/g, " ")
      .trim();

    if (!cleaned) {
      return "My Website";
    }

    const words = cleaned
      .split(" ")
      .filter(Boolean)
      .slice(0, 4);

    const name = words
      .map(
        (word) =>
          word.charAt(0).toUpperCase() +
          word.slice(1)
      )
      .join(" ");

    return `${name} Website`;
  }

  function useExample(
    text: string
  ) {
    setPrompt(text);
    setError("");

    window.setTimeout(() => {
      document
        .getElementById(
          "website-prompt"
        )
        ?.focus();
    }, 50);
  }

  return (
    <main className="ZUQEN-builder-home">
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          padding: 0;
          background: #050505;
        }

        body {
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        button,
        textarea {
          font: inherit;
        }

        button {
          cursor: pointer;
        }

        .ZUQEN-builder-home {
          min-height: 100vh;
          color: #fff;
          background:
            radial-gradient(
              circle at 50% -15%,
              rgba(124, 92, 255, 0.18),
              transparent 35%
            ),
            radial-gradient(
              circle at 10% 45%,
              rgba(59, 130, 246, 0.07),
              transparent 25%
            ),
            radial-gradient(
              circle at 90% 55%,
              rgba(168, 85, 247, 0.06),
              transparent 25%
            ),
            #050505;
          overflow-x: hidden;
        }

        .builder-container {
          min-height: 100vh;
          width: min(1180px, 100%);
          margin: 0 auto;
          padding: 0 28px;
          display: flex;
          flex-direction: column;
        }

        .builder-navbar {
          height: 76px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid
            rgba(255, 255, 255, 0.06);
        }

        .builder-brand {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .builder-logo {
          width: 38px;
          height: 38px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 17px;
          font-weight: 900;
          background:
            linear-gradient(
              135deg,
              #8b6cff,
              #4f46e5
            );
          box-shadow:
            0 0 35px
              rgba(124, 92, 255, 0.3),
            inset 0 1px
              rgba(255, 255, 255, 0.25);
        }

        .builder-brand-name {
          font-size: 15px;
          font-weight: 800;
          letter-spacing: -0.3px;
        }

        .builder-brand-subtitle {
          color: #666;
          font-size: 10px;
          margin-top: 2px;
        }

        .navbar-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .credit-badge {
          height: 38px;
          padding: 0 13px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          border-radius: 10px;
          border: 1px solid
            rgba(124, 92, 255, 0.2);
          background: rgba(
            124,
            92,
            255,
            0.07
          );
          color: #bdb1ff;
          font-size: 10px;
          font-weight: 800;
          white-space: nowrap;
        }

        .credit-icon {
          color: #a995ff;
        }

        .refresh-credit {
          border: 0;
          background: transparent;
          color: #777;
          padding: 0 0 0 4px;
          font-size: 13px;
        }

        .refresh-credit:hover {
          color: white;
        }

        .refresh-credit:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .back-button {
          height: 38px;
          padding: 0 14px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          border: 1px solid
            rgba(255, 255, 255, 0.09);
          border-radius: 10px;
          background: rgba(
            255,
            255,
            255,
            0.035
          );
          color: #aaa;
          font-size: 12px;
          transition: 0.2s ease;
        }

        .back-button:hover {
          color: #fff;
          background: rgba(
            255,
            255,
            255,
            0.07
          );
          border-color: rgba(
            255,
            255,
            255,
            0.15
          );
          transform: translateX(-1px);
        }

        .builder-main {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 70px 0 90px;
        }

        .builder-content {
          width: min(900px, 100%);
          text-align: center;
          margin-top: -20px;
        }

        .ai-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 12px;
          border-radius: 999px;
          border: 1px solid
            rgba(124, 92, 255, 0.2);
          background: rgba(
            124,
            92,
            255,
            0.07
          );
          color: #b9adff;
          font-size: 11px;
          font-weight: 700;
          margin-bottom: 25px;
          box-shadow: 0 0 30px
            rgba(124, 92, 255, 0.08);
        }

        .ai-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #8b7cff;
          box-shadow: 0 0 12px
            #8b7cff;
        }

        .builder-heading {
          margin: 0;
          font-size: clamp(
            42px,
            7vw,
            76px
          );
          line-height: 0.98;
          letter-spacing: -4px;
          font-weight: 900;
        }

        .builder-heading-gradient {
          display: block;
          background:
            linear-gradient(
              110deg,
              #ffffff 5%,
              #c7bcff 45%,
              #8b7cff 75%,
              #6d5cff 100%
            );
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .builder-description {
          width: min(680px, 100%);
          margin: 25px auto 0;
          color: #888;
          font-size: 15px;
          line-height: 1.7;
        }

        .prompt-wrapper {
          width: min(820px, 100%);
          margin: 42px auto 0;
        }

        .prompt-card {
          position: relative;
          padding: 1px;
          border-radius: 20px;
          background:
            linear-gradient(
              135deg,
              rgba(124, 92, 255, 0.45),
              rgba(255, 255, 255, 0.08),
              rgba(59, 130, 246, 0.2)
            );
          box-shadow:
            0 35px 90px
              rgba(0, 0, 0, 0.45),
            0 0 80px
              rgba(124, 92, 255, 0.07);
        }

        .prompt-card-inner {
          border-radius: 19px;
          background:
            radial-gradient(
              circle at 50% 0%,
              rgba(124, 92, 255, 0.06),
              transparent 45%
            ),
            #0b0b0d;
          padding: 20px;
        }

        .prompt-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 4px 12px;
        }

        .prompt-label {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #aaa;
          font-size: 11px;
          font-weight: 700;
        }

        .prompt-spark {
          color: #9a8cff;
          font-size: 15px;
        }

        .prompt-status {
          color: #555;
          font-size: 10px;
        }

        .prompt-input {
          width: 100%;
          min-height: 145px;
          resize: none;
          border: 0;
          outline: 0;
          border-radius: 13px;
          padding: 15px;
          color: #f4f4f5;
          background: rgba(
            255,
            255,
            255,
            0.035
          );
          font-size: 14px;
          line-height: 1.7;
        }

        .prompt-input::placeholder {
          color: #555;
        }

        .prompt-input:focus {
          background: rgba(
            255,
            255,
            255,
            0.045
          );
        }

        .prompt-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 12px;
          padding: 0 2px;
        }

        .prompt-hint {
          color: #555;
          font-size: 10px;
          text-align: left;
        }

        .prompt-meta {
          display: flex;
          flex-direction: column;
          gap: 5px;
          align-items: flex-start;
        }

        .prompt-counter {
          color: #555;
          font-size: 9px;
        }

        .cost-text {
          color: #777;
          font-size: 9px;
        }

        .cost-text strong {
          color: #a995ff;
        }

        .generate-button {
          min-width: 175px;
          height: 46px;
          border: 0;
          border-radius: 11px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: white;
          font-size: 12px;
          font-weight: 800;
          background:
            linear-gradient(
              135deg,
              #8066ff,
              #5b4be7
            );
          box-shadow:
            0 12px 28px
              rgba(91, 75, 231, 0.3),
            inset 0 1px
              rgba(255, 255, 255, 0.2);
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease,
            opacity 0.2s ease;
        }

        .generate-button:hover:not(
            :disabled
          ) {
          transform: translateY(-2px);
          box-shadow:
            0 17px 35px
              rgba(91, 75, 231, 0.4),
            inset 0 1px
              rgba(255, 255, 255, 0.25);
        }

        .generate-button:active:not(
            :disabled
          ) {
          transform: translateY(0);
        }

        .generate-button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          box-shadow: none;
        }

        .credit-summary {
          width: min(820px, 100%);
          margin: 12px auto 0;
          padding: 13px 15px;
          border-radius: 12px;
          border: 1px solid
            rgba(124, 92, 255, 0.13);
          background: rgba(
            124,
            92,
            255,
            0.045
          );
          display: grid;
          grid-template-columns:
            1fr 1fr 1fr;
          gap: 1px;
          text-align: left;
        }

        .credit-item {
          padding: 3px 13px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .credit-item + .credit-item {
          border-left: 1px solid
            rgba(255, 255, 255, 0.06);
        }

        .credit-label {
          color: #555;
          font-size: 8px;
          letter-spacing: 0.12em;
          font-weight: 800;
        }

        .credit-value {
          color: #bbb;
          font-size: 13px;
          font-weight: 800;
        }

        .credit-value.highlight {
          color: #a995ff;
        }

        .credit-value.danger {
          color: #ff858f;
        }

        .credit-warning {
          width: min(820px, 100%);
          margin: 10px auto 0;
          padding: 11px 13px;
          border-radius: 10px;
          border: 1px solid
            rgba(255, 80, 100, 0.2);
          background: rgba(
            255,
            80,
            100,
            0.06
          );
          color: #ff9ba8;
          text-align: left;
          font-size: 10px;
        }

        .credit-warning strong {
          color: #ff8d9b;
        }

        .examples {
          margin-top: 27px;
        }

        .examples-label {
          color: #555;
          font-size: 10px;
          margin-bottom: 10px;
        }

        .example-list {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 7px;
        }

        .example-button {
          border: 1px solid
            rgba(255, 255, 255, 0.07);
          background: rgba(
            255,
            255,
            255,
            0.025
          );
          color: #777;
          border-radius: 999px;
          padding: 8px 11px;
          font-size: 10px;
          transition: 0.2s ease;
        }

        .example-button:hover {
          color: #bbb;
          background: rgba(
            255,
            255,
            255,
            0.055
          );
          border-color: rgba(
            124,
            92,
            255,
            0.25
          );
        }

        .error-message {
          width: min(820px, 100%);
          margin: 12px auto 0;
          padding: 10px 13px;
          border: 1px solid
            rgba(255, 75, 75, 0.2);
          border-radius: 10px;
          background: rgba(
            255,
            55,
            55,
            0.06
          );
          color: #ff9b9b;
          text-align: left;
          font-size: 11px;
        }

        .builder-features {
          margin-top: 55px;
          display: grid;
          grid-template-columns:
            repeat(3, 1fr);
          gap: 10px;
        }

        .feature {
          padding: 15px;
          border: 1px solid
            rgba(255, 255, 255, 0.055);
          border-radius: 12px;
          background: rgba(
            255,
            255,
            255,
            0.018
          );
          text-align: left;
        }

        .feature-icon {
          font-size: 15px;
          margin-bottom: 8px;
        }

        .feature-title {
          color: #bbb;
          font-size: 11px;
          font-weight: 800;
        }

        .feature-text {
          color: #555;
          font-size: 10px;
          line-height: 1.5;
          margin-top: 4px;
        }

        .builder-footer {
          padding: 22px 0;
          text-align: center;
          color: #444;
          font-size: 10px;
        }

        .loading-spinner {
          width: 15px;
          height: 15px;
          border: 2px solid
            rgba(255, 255, 255, 0.25);
          border-top-color: white;
          border-radius: 50%;
          animation:
            ZUQEN-spin
            0.7s linear infinite;
        }

        @keyframes ZUQEN-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 700px) {
          .builder-container {
            padding: 0 15px;
          }

          .builder-navbar {
            height: 66px;
          }

          .builder-brand-subtitle {
            display: none;
          }

          .builder-main {
            padding: 55px 0 60px;
          }

          .builder-content {
            margin-top: 0;
          }

          .builder-heading {
            font-size: clamp(
              38px,
              13vw,
              58px
            );
            letter-spacing: -2.5px;
          }

          .builder-description {
            font-size: 13px;
            margin-top: 19px;
          }

          .prompt-wrapper {
            margin-top: 30px;
          }

          .prompt-card-inner {
            padding: 13px;
          }

          .prompt-input {
            min-height: 170px;
            font-size: 13px;
          }

          .prompt-bottom {
            align-items: stretch;
            flex-direction: column;
          }

          .prompt-meta {
            align-items: center;
          }

          .prompt-hint {
            text-align: center;
          }

          .generate-button {
            width: 100%;
          }

          .credit-summary {
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .credit-item {
            padding: 8px;
          }

          .credit-item + .credit-item {
            border-left: 0;
            border-top: 1px solid
              rgba(255, 255, 255, 0.06);
          }

          .builder-features {
            grid-template-columns: 1fr;
            margin-top: 35px;
          }

          .feature {
            text-align: center;
          }

          .back-button {
            padding: 0 10px;
          }

          .credit-badge {
            padding: 0 9px;
          }

          .navbar-right {
            gap: 5px;
          }
        }

        @media (max-width: 520px) {
          .credit-badge {
            font-size: 9px;
          }

          .builder-brand-name {
            font-size: 13px;
          }
        }
      `}</style>

      <div className="builder-container">
        <nav className="builder-navbar">
          <div className="builder-brand">
            <div className="builder-logo">
              K
            </div>

            <div>
              <div className="builder-brand-name">
                ZUQEN AI
              </div>

              <div className="builder-brand-subtitle">
                Website Builder
              </div>
            </div>
          </div>

          <div className="navbar-right">
            <div className="credit-badge">
              <span className="credit-icon">
                ✦
              </span>

              <span>
                {loadingCredits
                  ? "Loading credits..."
                  : creditBalance ===
                    null
                  ? "Credits unavailable"
                  : `${creditBalance.toLocaleString()} credits`}
              </span>

              <button
                type="button"
                className="refresh-credit"
                onClick={() =>
                  loadCredits(true)
                }
                disabled={
                  loadingCredits ||
                  refreshingCredits
                }
                title="Refresh credits"
              >
                {refreshingCredits
                  ? "↻"
                  : "⟳"}
              </button>
            </div>

            <button
              type="button"
              className="back-button"
              onClick={() => router.back()}
            >
              ← Back
            </button>
          </div>
        </nav>

        <section className="builder-main">
          <div className="builder-content">
            <div className="ai-badge">
              <span className="ai-dot" />
              Powered by ZUQEN AI
            </div>

            <h1 className="builder-heading">
              Build your website
              <span className="builder-heading-gradient">
                with AI.
              </span>
            </h1>

            <p className="builder-description">
              Describe the website you have
              in mind. ZUQEN AI will turn
              your idea into a complete,
              responsive and professional
              website.
            </p>

            <form
              className="prompt-wrapper"
              onSubmit={generateWebsite}
            >
              <div className="prompt-card">
                <div className="prompt-card-inner">
                  <div className="prompt-top">
                    <div className="prompt-label">
                      <span className="prompt-spark">
                        ✦
                      </span>

                      Describe your website
                    </div>

                    <div className="prompt-status">
                      AI Website Generation
                    </div>
                  </div>

                  <textarea
                    id="website-prompt"
                    className="prompt-input"
                    value={prompt}
                    onChange={(event) =>
                      setPrompt(
                        event.target.value
                      )
                    }
                    disabled={loading}
                    placeholder="Example: Create a premium dark portfolio website for a full-stack developer. Include a hero section, projects, skills, experience, testimonials and a contact form with smooth animations..."
                    maxLength={
                      MAX_PROMPT_LENGTH
                    }
                  />

                  <div className="prompt-bottom">
                    <div className="prompt-meta">
                      <div className="prompt-hint">
                        Describe design,
                        sections, features
                        and style
                      </div>

                      <div className="prompt-counter">
                        {prompt.length.toLocaleString()}
                        {" / "}
                        {MAX_PROMPT_LENGTH.toLocaleString()}
                        {" characters"}
                      </div>

                      <div className="cost-text">
                        Estimated cost:{" "}
                        <strong>
                          ~
                          {ESTIMATED_CREDITS.toLocaleString()}
                          {" credits"}
                        </strong>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="generate-button"
                      disabled={
                        loading ||
                        loadingCredits ||
                        creditBalance ===
                          null ||
                        !hasEnoughCredits
                      }
                    >
                      {loading ? (
                        <>
                          <span className="loading-spinner" />
                          Building...
                        </>
                      ) : (
                        <>
                          ✦ Generate Website
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </form>

            <div className="credit-summary">
              <div className="credit-item">
                <span className="credit-label">
                  AVAILABLE CREDITS
                </span>

                <span className="credit-value">
                  {loadingCredits
                    ? "..."
                    : creditBalance ===
                      null
                    ? "—"
                    : creditBalance.toLocaleString()}
                </span>
              </div>

              <div className="credit-item">
                <span className="credit-label">
                  THIS GENERATION
                </span>

                <span className="credit-value highlight">
                  ~
                  {ESTIMATED_CREDITS.toLocaleString()}
                </span>
              </div>

              <div className="credit-item">
                <span className="credit-label">
                  REMAINING AFTER GENERATION
                </span>

                <span
                  className={`credit-value ${
                    remainingCredits !==
                      null &&
                    remainingCredits < 0
                      ? "danger"
                      : "highlight"
                  }`}
                >
                  {remainingCredits ===
                  null
                    ? "—"
                    : remainingCredits >=
                      0
                    ? remainingCredits.toLocaleString()
                    : `-${Math.abs(
                        remainingCredits
                      ).toLocaleString()}`}
                </span>
              </div>
            </div>

            {creditBalance !== null &&
              !hasEnoughCredits && (
                <div className="credit-warning">
                  <strong>
                    Not enough credits:
                  </strong>{" "}
                  Is website generation ke
                  liye{" "}
                  {creditsNeeded.toLocaleString()}{" "}
                  aur credits chahiye.
                </div>
              )}

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            <div className="examples">
              <div className="examples-label">
                Or start with an idea
              </div>

              <div className="example-list">
                <button
                  type="button"
                  className="example-button"
                  onClick={() =>
                    useExample(
                      "Create a premium dark portfolio website for a software developer with hero, about, skills, projects, experience, testimonials and contact section."
                    )
                  }
                >
                  Developer Portfolio
                </button>

                <button
                  type="button"
                  className="example-button"
                  onClick={() =>
                    useExample(
                      "Create a modern SaaS startup landing page with a hero section, features, pricing, testimonials, FAQ, CTA and footer."
                    )
                  }
                >
                  SaaS Startup
                </button>

                <button
                  type="button"
                  className="example-button"
                  onClick={() =>
                    useExample(
                      "Create an elegant premium restaurant website with menu, popular dishes, gallery, reviews, opening hours, reservation section and location."
                    )
                  }
                >
                  Restaurant
                </button>

                <button
                  type="button"
                  className="example-button"
                  onClick={() =>
                    useExample(
                      "Create a high-end creative agency website with bold hero, services, portfolio, team, statistics, testimonials, process and contact section."
                    )
                  }
                >
                  Creative Agency
                </button>
              </div>
            </div>

            <div className="builder-features">
              <div className="feature">
                <div className="feature-icon">
                  ✦
                </div>

                <div className="feature-title">
                  AI Generated
                </div>

                <div className="feature-text">
                  Turn a simple description
                  into a complete website.
                </div>
              </div>

              <div className="feature">
                <div className="feature-icon">
                  ◈
                </div>

                <div className="feature-title">
                  Fully Responsive
                </div>

                <div className="feature-text">
                  Websites are designed for
                  desktop, tablet and mobile.
                </div>
              </div>

              <div className="feature">
                <div className="feature-icon">
                  ⚡
                </div>

                <div className="feature-title">
                  Edit with AI
                </div>

                <div className="feature-text">
                  Continue editing your
                  website using natural
                  language.
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="builder-footer">
          ZUQEN AI Website Builder
        </footer>
      </div>

      {loading && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            pointerEvents: "none",
          }}
        />
      )}
    </main>
  );
}