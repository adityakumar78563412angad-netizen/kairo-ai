"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "ZUQEN-website-builder-project";

const TOKENS_PER_CREDIT = 20000;

type Project = {
  html: string;
  prompt?: string;
  createdAt?: string;
  updatedAt?: string;
  creditsConsumed?: number;
  creditsRemaining?: number;
};

type PreviewMode = "desktop" | "tablet" | "mobile";

type Usage = {
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
  thoughtsTokens?: number;
  cachedTokens?: number;
};

function cleanHtml(value: string) {
  let html = value.trim();

  html = html.replace(/^```html\s*/i, "");
  html = html.replace(/^```HTML\s*/i, "");
  html = html.replace(/^```\s*/i, "");
  html = html.replace(/\s*```$/i, "");

  const doctypeIndex = html.toLowerCase().indexOf("<!doctype html>");
  const htmlIndex = html.toLowerCase().indexOf("<html");

  if (doctypeIndex >= 0) {
    html = html.slice(doctypeIndex);
  } else if (htmlIndex >= 0) {
    html = html.slice(htmlIndex);
  }

  const closingIndex = html.toLowerCase().lastIndexOf("</html>");

  if (closingIndex >= 0) {
    html = html.slice(0, closingIndex + "</html>".length);
  }

  return html.trim();
}

function isValidHtml(value: string) {
  const html = cleanHtml(value).toLowerCase();

  return (
    html.length > 20 &&
    html.includes("<html") &&
    html.includes("</html>") &&
    html.includes("<head") &&
    html.includes("<body")
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatCredits(value: number) {
  return Number(value || 0).toFixed(2);
}

export default function WebsiteBuilderEditorPage() {
  const [project, setProject] = useState<Project | null>(null);
  const [html, setHtml] = useState("");
  const [editPrompt, setEditPrompt] = useState("");

  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [copied, setCopied] = useState(false);
  const [previewMode, setPreviewMode] =
    useState<PreviewMode>("desktop");

  const [showCode, setShowCode] = useState(false);
  const [showFullscreen, setShowFullscreen] =
    useState(false);

  const [credits, setCredits] = useState({
    balance: 0,
    totalGranted: 0,
    totalUsed: 0,
  });

  const [creditsLoading, setCreditsLoading] =
    useState(true);

  const [lastBilling, setLastBilling] = useState<{
    creditsConsumed: number;
    creditsRemaining: number;
  } | null>(null);

  const [usage, setUsage] = useState<Usage | null>(
    null
  );

  useEffect(() => {
    async function loadCredits() {
      try {
        setCreditsLoading(true);

        const response = await fetch(
          "/api/website-builder",
          {
            method: "GET",
            cache: "no-store",
          }
        );

        let data: any = null;

        try {
          data = await response.json();
        } catch {
          data = null;
        }

        if (!response.ok) {
          if (
            data?.code === "SIGN_IN_REQUIRED"
          ) {
            setError(
              "Please sign in to use Website Builder."
            );
          }

          return;
        }

        setCredits({
          balance:
            Number(data?.balance) || 0,
          totalGranted:
            Number(data?.totalGranted) || 0,
          totalUsed:
            Number(data?.totalUsed) || 0,
        });
      } catch (err) {
        console.error(
          "Failed to load Website Builder credits:",
          err
        );
      } finally {
        setCreditsLoading(false);
      }
    }

    async function loadProject() {
      try {
        const stored =
          sessionStorage.getItem(STORAGE_KEY);

        if (!stored) {
          setError(
            "No generated website was found. Please generate a website first."
          );
          setLoading(false);
          return;
        }

        const parsed = JSON.parse(
          stored
        ) as Project;

        if (
          !parsed?.html ||
          !isValidHtml(parsed.html)
        ) {
          setError(
            "The saved website project is invalid or incomplete."
          );
          setLoading(false);
          return;
        }

        const cleaned = cleanHtml(parsed.html);

        setProject(parsed);
        setHtml(cleaned);

        if (
          typeof parsed.creditsConsumed ===
            "number" &&
          typeof parsed.creditsRemaining ===
            "number"
        ) {
          setLastBilling({
            creditsConsumed:
              parsed.creditsConsumed,
            creditsRemaining:
              parsed.creditsRemaining,
          });
        }
      } catch (err) {
        console.error(
          "Failed to load website project:",
          err
        );

        setError(
          "Unable to load the website project."
        );
      } finally {
        setLoading(false);
      }
    }

    loadProject();
    loadCredits();
  }, []);

  function saveProject(
    nextHtml: string,
    billing?: {
      creditsConsumed: number;
      creditsRemaining: number;
    }
  ) {
    if (!project) return;

    const nextProject: Project = {
      ...project,
      html: nextHtml,
      updatedAt: new Date().toISOString(),
    };

    if (billing) {
      nextProject.creditsConsumed =
        billing.creditsConsumed;

      nextProject.creditsRemaining =
        billing.creditsRemaining;
    }

    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(nextProject)
    );

    setProject(nextProject);
  }

  async function refreshCredits() {
    try {
      const response = await fetch(
        "/api/website-builder",
        {
          method: "GET",
          cache: "no-store",
        }
      );

      let data: any = null;

      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) return;

      setCredits({
        balance:
          Number(data?.balance) || 0,
        totalGranted:
          Number(data?.totalGranted) || 0,
        totalUsed:
          Number(data?.totalUsed) || 0,
      });
    } catch (err) {
      console.error(
        "Failed to refresh credits:",
        err
      );
    }
  }

  async function handleEdit() {
    const instruction = editPrompt.trim();

    if (!instruction) {
      setError(
        "Please describe what you want to change."
      );
      return;
    }

    if (!html.trim()) {
      setError(
        "No website HTML is available to edit."
      );
      return;
    }

    if (editing) return;

    if (credits.balance <= 0) {
      setError(
        "You do not have enough Website Builder credits. Please add credits to continue."
      );
      return;
    }

    setError("");
    setSuccess("");
    setUsage(null);
    setLastBilling(null);
    setEditing(true);

    try {
      const response = await fetch(
        "/api/website-builder",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "edit",
            html,
            instruction,
          }),
        }
      );

      let data: any = null;

      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        if (
          data?.code ===
          "SIGN_IN_REQUIRED"
        ) {
          throw new Error(
            "Please sign in to use Website Builder."
          );
        }

        if (
          data?.code ===
          "INSUFFICIENT_CREDITS"
        ) {
          const available =
            Number(
              data?.balance ??
                data?.availableCredits ??
                credits.balance
            ) || 0;

          throw new Error(
            `Not enough Website Builder credits. Available: ${formatCredits(
              available
            )}.`
          );
        }

        const message =
          data?.message ||
          data?.error ||
          `Edit request failed with status ${response.status}.`;

        throw new Error(message);
      }

      const nextHtml = cleanHtml(
        typeof data?.html === "string"
          ? data.html
          : ""
      );

      if (!isValidHtml(nextHtml)) {
        throw new Error(
          "Gemini returned invalid website HTML."
        );
      }

      const creditsConsumed =
        Number(
          data?.creditsConsumed
        ) || 0;

      const creditsRemaining =
        Number(
          data?.creditsRemaining
        );

      const finalRemaining =
        Number.isFinite(
          creditsRemaining
        )
          ? creditsRemaining
          : Math.max(
              0,
              credits.balance -
                creditsConsumed
            );

      setHtml(nextHtml);

      saveProject(nextHtml, {
        creditsConsumed,
        creditsRemaining:
          finalRemaining,
      });

      if (data?.usage) {
        setUsage({
          promptTokens:
            Number(
              data.usage.promptTokens
            ) || 0,

          outputTokens:
            Number(
              data.usage.outputTokens
            ) || 0,

          totalTokens:
            Number(
              data.usage.totalTokens
            ) || 0,

          thoughtsTokens:
            Number(
              data.usage.thoughtsTokens
            ) || 0,

          cachedTokens:
            Number(
              data.usage.cachedTokens
            ) || 0,
        });
      }

      setCredits((previous) => ({
        ...previous,
        balance: finalRemaining,
        totalUsed:
          previous.totalUsed +
          creditsConsumed,
      }));

      setLastBilling({
        creditsConsumed,
        creditsRemaining:
          finalRemaining,
      });

      setEditPrompt("");

      setSuccess(
        `Website updated successfully. ${formatCredits(
          creditsConsumed
        )} ZUQEN Website Builder credits were used.`
      );

      await refreshCredits();
    } catch (err) {
      console.error(
        "Website edit error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to edit the website."
      );

      await refreshCredits();
    } finally {
      setEditing(false);
    }
  }

  async function copyCode() {
    if (!html) return;

    try {
      await navigator.clipboard.writeText(
        html
      );

      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1600);
    } catch (err) {
      console.error(
        "Copy failed:",
        err
      );
      setCopied(false);
    }
  }

  function downloadHtml() {
    if (!html) return;

    const blob = new Blob(
      [html],
      {
        type: "text/html;charset=utf-8",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const anchor =
      document.createElement("a");

    anchor.href = url;
    anchor.download =
      "zuqen-website.html";

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);
  }

  function getPreviewWidth() {
    switch (previewMode) {
      case "mobile":
        return "390px";

      case "tablet":
        return "768px";

      default:
        return "100%";
    }
  }

  function resetProject() {
    if (!project?.html) return;

    const cleaned =
      cleanHtml(project.html);

    setHtml(cleaned);
    setEditPrompt("");
    setError("");
    setSuccess("");
    setUsage(null);
    setLastBilling(null);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#07080c] text-white">
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
              <span className="animate-pulse text-xl">
                ✦
              </span>
            </div>

            <p className="text-sm text-white/60">
              Loading your website...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!html) {
    return (
      <main className="min-h-screen bg-[#07080c] text-white">
        <div className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-5">
          <div className="w-full rounded-3xl border border-red-400/10 bg-red-400/[0.04] p-7 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-red-400/10 bg-red-400/10 text-red-300">
              !
            </div>

            <h1 className="text-lg font-semibold">
              Website unavailable
            </h1>

            <p className="mt-2 text-sm leading-6 text-white/45">
              {error ||
                "No website project is available."}
            </p>

            <button
              onClick={() => {
                window.location.href =
                  "/website-builder";
              }}
              className="mt-6 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              Back to Website Builder
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#07080c] text-white">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[15%] top-[-300px] h-[650px] w-[650px] rounded-full bg-violet-600/10 blur-[150px]" />

        <div className="absolute right-[-250px] top-[25%] h-[600px] w-[600px] rounded-full bg-blue-600/10 blur-[160px]" />
      </div>

      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#07080c]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-[1500px] items-center justify-between gap-4 px-4 sm:px-6">
          {/* Brand */}
          <a
            href="/website-builder"
            className="flex min-w-0 items-center gap-3"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 text-sm font-bold">
              ◈
            </div>

            <div className="min-w-0">
              <div className="text-sm font-semibold">
                ZUQEN AI
              </div>

              <div className="text-[8px] uppercase tracking-[0.22em] text-white/25">
                Website Builder
              </div>
            </div>
          </a>

          {/* Project */}
          <div className="hidden min-w-0 items-center gap-2 md:flex">
            <span className="text-[10px] uppercase tracking-[0.15em] text-white/20">
              Project
            </span>

            <span className="max-w-[280px] truncate rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[10px] text-white/60">
              {project?.prompt?.slice(
                0,
                60
              ) ||
                "Generated Website"}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <div className="hidden rounded-lg border border-violet-400/10 bg-violet-400/[0.05] px-3 py-1.5 text-[9px] font-medium text-violet-300/80 sm:block">
              {creditsLoading
                ? "Loading Credits..."
                : `${formatCredits(
                    credits.balance
                  )} Credits`}
            </div>

            <button
              onClick={copyCode}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-medium text-white/70 transition hover:bg-white/[0.08] hover:text-white"
            >
              {copied
                ? "Copied ✓"
                : "Copy Code"}
            </button>

            <button
              onClick={downloadHtml}
              className="hidden rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-black transition hover:bg-white/90 sm:block"
            >
              Export
            </button>
          </div>
        </div>
      </header>

      {/* ALERTS */}
      <div className="relative z-30 mx-auto max-w-[1500px] px-4 pt-4 sm:px-6">
        {error && (
          <div className="mb-3 flex items-start gap-3 rounded-2xl border border-red-400/10 bg-red-400/[0.05] px-4 py-3 text-sm text-red-200">
            <span className="mt-0.5 shrink-0">
              !
            </span>

            <span className="flex-1 leading-6">
              {error}
            </span>

            <button
              onClick={() =>
                setError("")
              }
              className="text-white/35 hover:text-white"
            >
              ×
            </button>
          </div>
        )}

        {success && (
          <div className="mb-3 flex items-start gap-3 rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.05] px-4 py-3 text-sm text-emerald-200">
            <span className="mt-0.5 shrink-0">
              ✓
            </span>

            <span className="flex-1 leading-6">
              {success}
            </span>

            <button
              onClick={() =>
                setSuccess("")
              }
              className="text-white/35 hover:text-white"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* WORKSPACE */}
      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-68px)] max-w-[1500px] gap-0 px-4 pb-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* PREVIEW */}
        <section className="flex min-h-[620px] min-w-0 flex-col overflow-hidden rounded-3xl border border-white/[0.07] bg-white/[0.025] lg:mr-4">
          {/* Preview toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3 sm:px-5">
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/25">
                Live Preview
              </div>

              <div className="mt-1 text-xs text-white/45">
                {previewMode ===
                "desktop"
                  ? "Desktop"
                  : previewMode ===
                    "tablet"
                    ? "Tablet"
                    : "Mobile"}{" "}
                viewport
              </div>
            </div>

            <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/20 p-1">
              <button
                onClick={() =>
                  setPreviewMode(
                    "desktop"
                  )
                }
                className={`rounded-lg px-3 py-2 text-[10px] transition ${
                  previewMode ===
                  "desktop"
                    ? "bg-white text-black"
                    : "text-white/40 hover:text-white"
                }`}
              >
                Desktop
              </button>

              <button
                onClick={() =>
                  setPreviewMode(
                    "tablet"
                  )
                }
                className={`rounded-lg px-3 py-2 text-[10px] transition ${
                  previewMode ===
                  "tablet"
                    ? "bg-white text-black"
                    : "text-white/40 hover:text-white"
                }`}
              >
                Tablet
              </button>

              <button
                onClick={() =>
                  setPreviewMode(
                    "mobile"
                  )
                }
                className={`rounded-lg px-3 py-2 text-[10px] transition ${
                  previewMode ===
                  "mobile"
                    ? "bg-white text-black"
                    : "text-white/40 hover:text-white"
                }`}
              >
                Mobile
              </button>
            </div>

            <button
              onClick={() =>
                setShowFullscreen(
                  true
                )
              }
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] text-white/45 transition hover:bg-white/[0.07] hover:text-white"
            >
              Fullscreen
            </button>
          </div>

          {/* Preview area */}
          <div className="relative flex min-h-[560px] flex-1 items-start justify-center overflow-auto bg-[#0a0b0f] p-3 sm:p-6">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.07),transparent_55%)]" />

            <div
              className="relative min-h-[500px] overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl transition-all duration-300"
              style={{
                width:
                  getPreviewWidth(),
                maxWidth: "100%",
              }}
            >
              <iframe
                title="Generated Website Preview"
                srcDoc={html}
                sandbox="allow-scripts allow-forms allow-modals allow-popups"
                className="block h-[720px] w-full border-0 bg-white"
              />
            </div>
          </div>
        </section>

        {/* RIGHT PANEL */}
        <aside className="mt-4 flex min-h-0 flex-col gap-4 lg:mt-0">
          {/* AI EDIT */}
          <div className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-5">
            <div className="mb-5">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300">
                  ✦
                </div>

                <div>
                  <div className="text-sm font-semibold">
                    AI Edit
                  </div>

                  <div className="text-[10px] text-white/30">
                    Improve your website with natural language
                  </div>
                </div>
              </div>
            </div>

            {/* CREDIT BALANCE */}
            <div className="mb-4 rounded-2xl border border-violet-400/10 bg-violet-400/[0.04] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/30">
                    Website Builder Credits
                  </div>

                  <div className="mt-1 text-xl font-semibold text-violet-100">
                    {creditsLoading
                      ? "..."
                      : formatCredits(
                          credits.balance
                        )}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[8px] uppercase tracking-[0.12em] text-white/20">
                    Conversion
                  </div>

                  <div className="mt-1 text-[10px] text-white/45">
                    1.00 ={" "}
                    {formatNumber(
                      TOKENS_PER_CREDIT
                    )}{" "}
                    tokens
                  </div>
                </div>
              </div>

              {lastBilling && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-white/[0.06] bg-black/15 p-2.5">
                    <div className="text-[8px] text-white/25">
                      Last Used
                    </div>

                    <div className="mt-1 text-sm font-semibold text-white/75">
                      {formatCredits(
                        lastBilling.creditsConsumed
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-400/10 bg-emerald-400/[0.035] p-2.5">
                    <div className="text-[8px] text-white/25">
                      Remaining
                    </div>

                    <div className="mt-1 text-sm font-semibold text-emerald-200">
                      {formatCredits(
                        lastBilling.creditsRemaining
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <label className="mb-2 block text-[10px] font-medium uppercase tracking-[0.15em] text-white/30">
              What should change?
            </label>

            <textarea
              value={editPrompt}
              onChange={(event) =>
                setEditPrompt(
                  event.target.value
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key ===
                    "Enter" &&
                  (event.ctrlKey ||
                    event.metaKey)
                ) {
                  event.preventDefault();
                  handleEdit();
                }
              }}
              disabled={editing}
              rows={7}
              placeholder="Example: Add a dark mode toggle to the navbar and make the entire website support both light and dark themes."
              className="w-full resize-none rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-white outline-none placeholder:text-white/20 transition focus:border-violet-400/30 disabled:opacity-50"
            />

            <div className="mt-3 flex items-center justify-between">
              <span className="text-[9px] text-white/20">
                Ctrl + Enter to edit
              </span>

              <span className="text-[9px] text-violet-300/60">
                Charged by actual Gemini usage
              </span>
            </div>

            <button
              onClick={handleEdit}
              disabled={
                editing ||
                !editPrompt.trim() ||
                creditsLoading ||
                credits.balance <= 0
              }
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-blue-500 py-3.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {editing ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Editing Website...
                </>
              ) : (
                <>
                  <span>✦</span>
                  Apply AI Edit
                </>
              )}
            </button>
          </div>

          {/* USAGE */}
          <div className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/25">
                  Gemini Usage
                </div>

                <div className="mt-1 text-xs text-white/35">
                  Latest edit request
                </div>
              </div>

              <div className="rounded-lg border border-violet-400/10 bg-violet-400/[0.04] px-2 py-1 text-[8px] text-violet-300/60">
                REAL
              </div>
            </div>

            {usage ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-white/[0.06] bg-black/15 p-3">
                  <div className="text-[9px] text-white/25">
                    Input
                  </div>

                  <div className="mt-1 text-sm font-semibold">
                    {formatNumber(
                      usage.promptTokens
                    )}
                  </div>

                  <div className="mt-1 text-[8px] text-white/20">
                    tokens
                  </div>
                </div>

                <div className="rounded-xl border border-white/[0.06] bg-black/15 p-3">
                  <div className="text-[9px] text-white/25">
                    Output
                  </div>

                  <div className="mt-1 text-sm font-semibold">
                    {formatNumber(
                      usage.outputTokens
                    )}
                  </div>

                  <div className="mt-1 text-[8px] text-white/20">
                    tokens
                  </div>
                </div>

                <div className="col-span-2 rounded-xl border border-violet-400/10 bg-violet-400/[0.04] p-3">
                  <div className="text-[9px] text-white/30">
                    Total Gemini Tokens
                  </div>

                  <div className="mt-1 text-lg font-semibold text-violet-200">
                    {formatNumber(
                      usage.totalTokens
                    )}
                  </div>

                  <div className="mt-1 text-[8px] text-white/25">
                    Actual usage used for credit billing
                  </div>
                </div>

                {lastBilling && (
                  <div className="col-span-2 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-blue-400/10 bg-blue-400/[0.035] p-3">
                      <div className="text-[9px] text-white/25">
                        ZUQEN Credits Used
                      </div>

                      <div className="mt-1 text-lg font-semibold text-blue-200">
                        {formatCredits(
                          lastBilling.creditsConsumed
                        )}
                      </div>

                      <div className="mt-1 text-[8px] text-white/20">
                        {formatNumber(
                          TOKENS_PER_CREDIT
                        )}{" "}
                        Gemini tokens = 1 credit
                      </div>
                    </div>

                    <div className="rounded-xl border border-emerald-400/10 bg-emerald-400/[0.035] p-3">
                      <div className="text-[9px] text-white/25">
                        Credits Remaining
                      </div>

                      <div className="mt-1 text-lg font-semibold text-emerald-200">
                        {formatCredits(
                          lastBilling.creditsRemaining
                        )}
                      </div>

                      <div className="mt-1 text-[8px] text-white/20">
                        Available balance
                      </div>
                    </div>
                  </div>
                )}

                {(usage.thoughtsTokens ||
                  usage.cachedTokens) ? (
                  <div className="col-span-2 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-white/[0.06] bg-black/15 p-3">
                      <div className="text-[9px] text-white/25">
                        Thinking
                      </div>

                      <div className="mt-1 text-xs font-medium">
                        {formatNumber(
                          usage.thoughtsTokens ||
                            0
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/[0.06] bg-black/15 p-3">
                      <div className="text-[9px] text-white/25">
                        Cached
                      </div>

                      <div className="mt-1 text-xs font-medium">
                        {formatNumber(
                          usage.cachedTokens ||
                            0
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/[0.06] bg-black/15 p-4">
                <div className="text-xs text-white/35">
                  No edit usage recorded yet.
                </div>

                <div className="mt-2 text-[9px] leading-5 text-white/20">
                  After an edit, actual Gemini
                  total-token usage and the exact
                  ZUQEN credit deduction will appear here.
                </div>
              </div>
            )}
          </div>

          {/* PROJECT ACTIONS */}
          <div className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-5">
            <div className="mb-4 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/25">
              Project
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() =>
                  setShowCode(true)
                }
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-[10px] text-white/50 transition hover:bg-white/[0.07] hover:text-white"
              >
                View Code
              </button>

              <button
                onClick={resetProject}
                disabled={editing}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-[10px] text-white/50 transition hover:bg-white/[0.07] hover:text-white disabled:opacity-30"
              >
                Reset
              </button>

              <button
                onClick={downloadHtml}
                className="col-span-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-[10px] text-white/50 transition hover:bg-white/[0.07] hover:text-white"
              >
                Export HTML
              </button>
            </div>
          </div>

          {/* CREDIT INFORMATION */}
          <div className="rounded-3xl border border-violet-400/10 bg-violet-400/[0.035] p-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 text-violet-300">
                ◉
              </div>

              <div>
                <div className="text-xs font-medium text-violet-200/80">
                  Real Gemini billing
                </div>

                <p className="mt-2 text-[10px] leading-5 text-violet-100/40">
                  Website Builder credits are
                  calculated from the actual Gemini
                  total token usage. 1.00 ZUQEN credit
                  equals {formatNumber(
                    TOKENS_PER_CREDIT
                  )} Gemini tokens.
                </p>

                <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3">
                  <span className="text-[9px] text-white/25">
                    Total granted
                  </span>

                  <span className="text-[10px] font-medium text-white/55">
                    {formatCredits(
                      credits.totalGranted
                    )}
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[9px] text-white/25">
                    Total used
                  </span>

                  <span className="text-[10px] font-medium text-white/55">
                    {formatCredits(
                      credits.totalUsed
                    )}
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[9px] text-white/25">
                    Available
                  </span>

                  <span className="text-[10px] font-semibold text-emerald-300/80">
                    {formatCredits(
                      credits.balance
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </section>

      {/* CODE MODAL */}
      {showCode && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0c0d12] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
              <div>
                <div className="text-sm font-semibold">
                  Website HTML
                </div>

                <div className="mt-1 text-[9px] text-white/25">
                  {formatNumber(
                    html.length
                  )}{" "}
                  characters
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={copyCode}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] text-white/50 hover:text-white"
                >
                  {copied
                    ? "Copied ✓"
                    : "Copy"}
                </button>

                <button
                  onClick={() =>
                    setShowCode(false)
                  }
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/50 hover:text-white"
                >
                  ×
                </button>
              </div>
            </div>

            <pre className="min-h-0 flex-1 overflow-auto p-5 text-[10px] leading-5 text-white/50">
              <code>{html}</code>
            </pre>
          </div>
        </div>
      )}

      {/* FULLSCREEN PREVIEW */}
      {showFullscreen && (
        <div className="fixed inset-0 z-[110] flex flex-col bg-black">
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-[#090a0e] px-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 text-xs font-bold">
                ◈
              </div>

              <span className="text-xs font-medium text-white/70">
                Website Preview
              </span>
            </div>

            <button
              onClick={() =>
                setShowFullscreen(
                  false
                )
              }
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-white/60 hover:text-white"
            >
              Close
            </button>
          </div>

          <div className="min-h-0 flex-1 bg-white">
            <iframe
              title="Fullscreen Website Preview"
              srcDoc={html}
              sandbox="allow-scripts allow-forms allow-modals allow-popups"
              className="h-full w-full border-0"
            />
          </div>
        </div>
      )}
    </main>
  );
}