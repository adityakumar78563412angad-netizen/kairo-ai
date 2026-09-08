"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type Device = "desktop" | "tablet" | "mobile";
type ViewMode = "preview" | "code";

type WebsiteProject = {
  prompt: string;
  html: string;
  name: string;
  createdAt: string;
};

const PROJECT_KEY =
  "ZUQEN-website-builder-project";

const DRIVE_PROJECTS_KEY =
  "ZUQEN-website-builder-drive-projects";

const AI_EDIT_CREDITS = 50;

export default function WebsiteBuilderEditorPage() {
  const router = useRouter();

  const [project, setProject] =
    useState<WebsiteProject | null>(null);

  const [html, setHtml] = useState("");
  const [codeValue, setCodeValue] =
    useState("");

  const [viewMode, setViewMode] =
    useState<ViewMode>("preview");

  const [device, setDevice] =
    useState<Device>("desktop");

  const [loading, setLoading] =
    useState(true);

  const [aiLoading, setAiLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [aiInstruction, setAiInstruction] =
    useState("");

  const [showAiPanel, setShowAiPanel] =
    useState(true);

  const [showCodePanel, setShowCodePanel] =
    useState(false);

  const [fullscreen, setFullscreen] =
    useState(false);

  const [previewKey, setPreviewKey] =
    useState(0);

  const [history, setHistory] =
    useState<string[]>([]);

  const [historyIndex, setHistoryIndex] =
    useState(-1);

  const [saved, setSaved] =
    useState(false);

  const [creditBalance, setCreditBalance] =
    useState<number | null>(null);

  const iframeRef =
    useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    try {
      const raw =
        sessionStorage.getItem(
          PROJECT_KEY
        );

      if (!raw) {
        router.replace(
          "/website-builder"
        );
        return;
      }

      const parsed =
        JSON.parse(raw) as WebsiteProject;

      if (
        !parsed ||
        typeof parsed.html !==
          "string" ||
        !parsed.html.trim()
      ) {
        router.replace(
          "/website-builder"
        );
        return;
      }

      setProject(parsed);
      setHtml(parsed.html);
      setCodeValue(parsed.html);
      setHistory([parsed.html]);
      setHistoryIndex(0);

      loadCredits();
    } catch (err) {
      console.error(
        "Editor project load error:",
        err
      );

      router.replace(
        "/website-builder"
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  async function loadCredits() {
    try {
      const response = await fetch(
        "/api/credits",
        {
          method: "GET",
          cache: "no-store",
        }
      );

      if (!response.ok) {
        return;
      }

      const data =
        await response.json();

      if (
        typeof data.balance ===
        "number"
      ) {
        setCreditBalance(
          data.balance
        );
      }
    } catch (err) {
      console.error(
        "Editor credits error:",
        err
      );
    }
  }

  function updateProjectHtml(
    nextHtml: string,
    addHistory = true
  ) {
    setHtml(nextHtml);
    setCodeValue(nextHtml);
    setPreviewKey(
      (value) => value + 1
    );

    if (addHistory) {
      setHistory((previous) => {
        const current =
          previous[historyIndex];

        if (current === nextHtml) {
          return previous;
        }

        const trimmed =
          previous.slice(
            0,
            historyIndex + 1
          );

        return [
          ...trimmed,
          nextHtml,
        ];
      });

      setHistoryIndex(
        (previousIndex) =>
          previousIndex + 1
      );
    }

    setProject((previous) =>
      previous
        ? {
            ...previous,
            html: nextHtml,
          }
        : previous
    );

    try {
      const raw =
        sessionStorage.getItem(
          PROJECT_KEY
        );

      if (raw) {
        const stored =
          JSON.parse(raw);

        sessionStorage.setItem(
          PROJECT_KEY,
          JSON.stringify({
            ...stored,
            html: nextHtml,
          })
        );
      }
    } catch (err) {
      console.error(
        "Project session update error:",
        err
      );
    }
  }

  function undo() {
    if (historyIndex <= 0) {
      return;
    }

    const nextIndex =
      historyIndex - 1;

    const nextHtml =
      history[nextIndex];

    setHistoryIndex(nextIndex);
    setHtml(nextHtml);
    setCodeValue(nextHtml);
    setPreviewKey(
      (value) => value + 1
    );
  }

  function redo() {
    if (
      historyIndex >=
      history.length - 1
    ) {
      return;
    }

    const nextIndex =
      historyIndex + 1;

    const nextHtml =
      history[nextIndex];

    setHistoryIndex(nextIndex);
    setHtml(nextHtml);
    setCodeValue(nextHtml);
    setPreviewKey(
      (value) => value + 1
    );
  }

  function applyCodeChanges() {
    if (!codeValue.trim()) {
      setError(
        "Website code empty nahi ho sakta."
      );
      return;
    }

    setError("");

    if (codeValue === html) {
      return;
    }

    const nextHistory =
      history
        .slice(0, historyIndex + 1)
        .concat(codeValue);

    setHistory(nextHistory);
    setHistoryIndex(
      nextHistory.length - 1
    );

    setHtml(codeValue);
    setPreviewKey(
      (value) => value + 1
    );

    setProject((previous) =>
      previous
        ? {
            ...previous,
            html: codeValue,
          }
        : previous
    );

    saveCurrentProject(
      codeValue
    );
  }

  function resetCode() {
    setCodeValue(html);
    setError("");
  }

  async function handleAiEdit(
    instruction?: string
  ) {
    const finalInstruction =
      (
        instruction ??
        aiInstruction
      ).trim();

    if (!finalInstruction) {
      setError(
        "AI ko batane ke liye instruction likho."
      );
      return;
    }

    if (finalInstruction.length > 5000) {
      setError(
        "AI instruction 5,000 characters se chhota rakho."
      );
      return;
    }

    if (
      creditBalance !== null &&
      creditBalance < AI_EDIT_CREDITS
    ) {
      setError(
        `AI Edit ke liye ${AI_EDIT_CREDITS} credits chahiye. Tumhare paas ${creditBalance} credits hain.`
      );
      return;
    }

    setError("");
    setAiLoading(true);

    try {
      const response = await fetch(
        "/api/website-builder",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            action: "edit",
            prompt:
              finalInstruction,
            html,
          }),
        }
      );

      let data: {
        success?: boolean;
        html?: string;
        error?: string;
        code?: string;
        balance?: number;
      } = {};

      try {
        data = await response.json();
      } catch {
        throw new Error(
          "Server ne valid response nahi diya."
        );
      }

      if (
        !response.ok ||
        !data.success
      ) {
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

          throw new Error(
            "AI Edit ke liye enough credits nahi hain."
          );
        }

        throw new Error(
          data.error ||
            "AI website edit nahi kar payi."
        );
      }

      if (
        !data.html ||
        typeof data.html !==
          "string"
      ) {
        throw new Error(
          "AI ne valid HTML return nahi kiya."
        );
      }

      updateProjectHtml(
        data.html,
        true
      );

      if (
        typeof data.balance ===
        "number"
      ) {
        setCreditBalance(
          data.balance
        );
      } else {
        const header =
          response.headers.get(
            "X-Zuqen-Credits-Remaining"
          );

        if (header) {
          const remaining =
            Number(header);

          if (
            Number.isFinite(
              remaining
            )
          ) {
            setCreditBalance(
              remaining
            );
          }
        } else {
          await loadCredits();
        }
      }

      setAiInstruction("");
    } catch (err) {
      console.error(
        "AI website edit error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "AI edit karte waqt kuch galat ho gaya."
      );
    } finally {
      setAiLoading(false);
    }
  }

  function saveCurrentProject(
    htmlToSave = html
  ) {
    if (!project) {
      return;
    }

    try {
      const raw =
        localStorage.getItem(
          DRIVE_PROJECTS_KEY
        );

      const existing =
        raw ? JSON.parse(raw) : [];

      const projects =
        Array.isArray(existing)
          ? existing
          : [];

      const updatedProject = {
        ...project,
        html: htmlToSave,
        updatedAt:
          new Date().toISOString(),
      };

      const index =
        projects.findIndex(
          (item: WebsiteProject) =>
            item.name === project.name &&
            item.createdAt ===
              project.createdAt
        );

      if (index >= 0) {
        projects[index] =
          updatedProject;
      } else {
        projects.unshift(
          updatedProject
        );
      }

      localStorage.setItem(
        DRIVE_PROJECTS_KEY,
        JSON.stringify(
          projects
        )
      );

      setSaved(true);

      window.setTimeout(() => {
        setSaved(false);
      }, 1800);
    } catch (err) {
      console.error(
        "Save project error:",
        err
      );

      setError(
        "Project save nahi ho paya."
      );
    }
  }

  function downloadWebsite() {
    const blob =
      new Blob([html], {
        type: "text/html",
      });

    const url =
      URL.createObjectURL(blob);

    const anchor =
      document.createElement("a");

    anchor.href = url;
    anchor.download =
      `${safeFileName(
        project?.name ||
          "ZUQEN-website"
      )}.html`;

    document.body.appendChild(
      anchor
    );

    anchor.click();

    anchor.remove();

    URL.revokeObjectURL(url);
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(
        html
      );

      setSaved(true);

      window.setTimeout(() => {
        setSaved(false);
      }, 1500);
    } catch {
      setError(
        "Code copy nahi ho paya."
      );
    }
  }

  function safeFileName(
    value: string
  ) {
    return value
      .replace(
        /[^a-z0-9-_ ]/gi,
        ""
      )
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 80);
  }

  function goBack() {
    try {
      if (project) {
        sessionStorage.setItem(
          PROJECT_KEY,
          JSON.stringify({
            ...project,
            html,
          })
        );
      }
    } catch (err) {
      console.error(
        "Back save error:",
        err
      );
    }

    router.push(
      "/website-builder"
    );
  }

  function setSuggestion(
    suggestion: string
  ) {
    setAiInstruction(
      suggestion
    );
  }

  const deviceWidth =
    useMemo(() => {
      if (device === "mobile") {
        return 390;
      }

      if (device === "tablet") {
        return 768;
      }

      return 1440;
    }, [device]);

  const previewContainerStyle =
    useMemo(
      () => ({
        width:
          deviceWidth === 1440
            ? "100%"
            : `${deviceWidth}px`,
        maxWidth:
          "100%",
      }),
      [deviceWidth]
    );

  if (loading) {
    return (
      <main className="editor-loading">
        <style jsx>{`
          .editor-loading {
            min-height: 100vh;
            background: #050505;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family:
              Inter,
              system-ui,
              sans-serif;
          }

          .loading-box {
            text-align: center;
          }

          .spinner {
            width: 30px;
            height: 30px;
            margin: 0 auto 15px;
            border: 3px solid
              rgba(255, 255, 255, 0.1);
            border-top-color: #8066ff;
            border-radius: 50%;
            animation:
              spin 0.7s linear infinite;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }

          .loading-text {
            color: #777;
            font-size: 12px;
          }
        `}</style>

        <div className="loading-box">
          <div className="spinner" />
          <div className="loading-text">
            Loading website editor...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className={`website-editor ${
        fullscreen
          ? "is-fullscreen"
          : ""
      }`}
    >
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

        .website-editor {
          min-height: 100vh;
          height: 100vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          background: #050505;
          color: white;
        }

        .website-editor.is-fullscreen
          .editor-sidebar,
        .website-editor.is-fullscreen
          .editor-topbar {
          display: none;
        }

        .editor-topbar {
          height: 64px;
          flex: 0 0 64px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 0 18px;
          border-bottom: 1px solid
            rgba(255, 255, 255, 0.07);
          background: #08080a;
          z-index: 20;
        }

        .topbar-left {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .brand-mini {
          width: 34px;
          height: 34px;
          flex: 0 0 34px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 14px;
          background:
            linear-gradient(
              135deg,
              #8066ff,
              #4f46e5
            );
          box-shadow:
            0 0 25px
              rgba(124, 92, 255, 0.25);
        }

        .project-title-wrap {
          min-width: 0;
        }

        .project-title {
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .project-subtitle {
          color: #555;
          font-size: 9px;
          margin-top: 2px;
        }

        .topbar-center {
          display: flex;
          align-items: center;
          gap: 3px;
          padding: 3px;
          border: 1px solid
            rgba(255, 255, 255, 0.07);
          border-radius: 9px;
          background: rgba(
            255,
            255,
            255,
            0.025
          );
        }

        .mode-button {
          height: 30px;
          padding: 0 11px;
          border: 0;
          border-radius: 7px;
          background: transparent;
          color: #666;
          font-size: 10px;
          font-weight: 700;
        }

        .mode-button.active {
          background: rgba(
            255,
            255,
            255,
            0.08
          );
          color: white;
        }

        .topbar-actions {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .credit-pill {
          height: 32px;
          padding: 0 10px;
          display: flex;
          align-items: center;
          gap: 5px;
          border-radius: 8px;
          border: 1px solid
            rgba(124, 92, 255, 0.2);
          background: rgba(
            124,
            92,
            255,
            0.06
          );
          color: #afa3ff;
          font-size: 9px;
          font-weight: 800;
        }

        .toolbar-button {
          height: 32px;
          padding: 0 10px;
          border: 1px solid
            rgba(255, 255, 255, 0.07);
          border-radius: 8px;
          background: rgba(
            255,
            255,
            255,
            0.03
          );
          color: #999;
          font-size: 10px;
          font-weight: 700;
          transition: 0.2s ease;
        }

        .toolbar-button:hover:not(
            :disabled
          ) {
          color: white;
          background: rgba(
            255,
            255,
            255,
            0.07
          );
        }

        .toolbar-button:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .toolbar-button.primary {
          color: white;
          border-color: transparent;
          background:
            linear-gradient(
              135deg,
              #8066ff,
              #5b4be7
            );
        }

        .editor-body {
          flex: 1;
          min-height: 0;
          display: flex;
          overflow: hidden;
        }

        .editor-sidebar {
          width: 310px;
          flex: 0 0 310px;
          min-height: 0;
          border-right: 1px solid
            rgba(255, 255, 255, 0.07);
          background: #08080a;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
        }

        .sidebar-section {
          padding: 17px;
          border-bottom: 1px solid
            rgba(255, 255, 255, 0.055);
        }

        .sidebar-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 11px;
          color: #aaa;
          font-size: 10px;
          font-weight: 800;
        }

        .sidebar-label {
          color: #555;
          font-size: 8px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          font-weight: 800;
        }

        .ai-credit-note {
          color: #555;
          font-size: 8px;
          font-weight: 600;
        }

        .ai-input {
          width: 100%;
          min-height: 112px;
          resize: vertical;
          border: 1px solid
            rgba(255, 255, 255, 0.07);
          outline: none;
          border-radius: 10px;
          padding: 11px;
          background: rgba(
            255,
            255,
            255,
            0.035
          );
          color: #eee;
          font-size: 10px;
          line-height: 1.6;
        }

        .ai-input:focus {
          border-color: rgba(
            124,
            92,
            255,
            0.35
          );
        }

        .ai-input::placeholder {
          color: #4d4d4d;
        }

        .ai-button {
          width: 100%;
          height: 38px;
          margin-top: 8px;
          border: 0;
          border-radius: 9px;
          color: white;
          font-size: 10px;
          font-weight: 800;
          background:
            linear-gradient(
              135deg,
              #8066ff,
              #5b4be7
            );
          box-shadow:
            0 8px 25px
              rgba(91, 75, 231, 0.2);
        }

        .ai-button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .suggestions {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 10px;
        }

        .suggestion {
          border: 1px solid
            rgba(255, 255, 255, 0.06);
          border-radius: 999px;
          padding: 6px 8px;
          background: rgba(
            255,
            255,
            255,
            0.025
          );
          color: #666;
          font-size: 8px;
        }

        .suggestion:hover {
          color: #bbb;
          border-color: rgba(
            124,
            92,
            255,
            0.25
          );
        }

        .device-grid {
          display: grid;
          grid-template-columns:
            repeat(3, 1fr);
          gap: 6px;
        }

        .device-button {
          height: 52px;
          border: 1px solid
            rgba(255, 255, 255, 0.06);
          border-radius: 9px;
          background: rgba(
            255,
            255,
            255,
            0.025
          );
          color: #666;
          font-size: 9px;
          font-weight: 700;
        }

        .device-button.active {
          color: #c5bdff;
          border-color: rgba(
            124,
            92,
            255,
            0.3
          );
          background: rgba(
            124,
            92,
            255,
            0.08
          );
        }

        .history-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
        }

        .history-button {
          height: 34px;
          border: 1px solid
            rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          background: rgba(
            255,
            255,
            255,
            0.025
          );
          color: #777;
          font-size: 9px;
          font-weight: 700;
        }

        .history-button:disabled {
          opacity: 0.25;
          cursor: not-allowed;
        }

        .sidebar-footer {
          margin-top: auto;
          padding: 15px 17px;
          color: #444;
          font-size: 8px;
          line-height: 1.6;
        }

        .editor-workspace {
          flex: 1;
          min-width: 0;
          min-height: 0;
          display: flex;
          flex-direction: column;
          background: #111114;
        }

        .workspace-toolbar {
          height: 48px;
          flex: 0 0 48px;
          padding: 0 13px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid
            rgba(255, 255, 255, 0.06);
          background: #0c0c0f;
        }

        .workspace-left,
        .workspace-right {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .workspace-button {
          height: 29px;
          padding: 0 9px;
          border: 1px solid
            rgba(255, 255, 255, 0.06);
          border-radius: 7px;
          background: rgba(
            255,
            255,
            255,
            0.025
          );
          color: #777;
          font-size: 9px;
          font-weight: 700;
        }

        .workspace-button:hover {
          color: white;
        }

        .workspace-button.active {
          color: #c0b7ff;
          border-color: rgba(
            124,
            92,
            255,
            0.2
          );
          background: rgba(
            124,
            92,
            255,
            0.06
          );
        }

        .preview-area {
          flex: 1;
          min-height: 0;
          overflow: auto;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding: 25px;
          background:
            radial-gradient(
              circle at center,
              rgba(
                124,
                92,
                255,
                0.035
              ),
              transparent 40%
            ),
            #101012;
        }

        .preview-frame {
          min-height: 700px;
          flex-shrink: 0;
          overflow: hidden;
          background: white;
          border-radius: 8px;
          box-shadow:
            0 30px 80px
              rgba(0, 0, 0, 0.45),
            0 0 0 1px
              rgba(255, 255, 255, 0.08);
          transition:
            width 0.25s ease;
        }

        .preview-frame.full-width {
          width: 100%;
        }

        .preview-frame iframe {
          display: block;
          width: 100%;
          min-height: 700px;
          height: calc(
            100vh - 137px
          );
          border: 0;
          background: white;
        }

        .code-area {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          padding: 14px;
          background: #0d0d10;
        }

        .code-editor {
          flex: 1;
          min-height: 0;
          width: 100%;
          resize: none;
          outline: none;
          border: 1px solid
            rgba(255, 255, 255, 0.07);
          border-radius: 9px;
          padding: 15px;
          background: #08080a;
          color: #d7d7d9;
          font-family:
            "SFMono-Regular",
            Consolas,
            "Liberation Mono",
            monospace;
          font-size: 11px;
          line-height: 1.65;
          tab-size: 2;
        }

        .code-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 7px;
          margin-top: 9px;
        }

        .error-box {
          position: fixed;
          left: 330px;
          right: 20px;
          bottom: 20px;
          z-index: 100;
          padding: 11px 14px;
          border: 1px solid
            rgba(255, 75, 75, 0.2);
          border-radius: 9px;
          background: rgba(
            35,
            10,
            12,
            0.96
          );
          color: #ff9b9b;
          font-size: 10px;
          box-shadow:
            0 15px 40px
              rgba(0, 0, 0, 0.45);
        }

        .saved-indicator {
          color: #86dca2;
          font-size: 9px;
          font-weight: 700;
        }

        @media (max-width: 900px) {
          .editor-sidebar {
            width: 260px;
            flex-basis: 260px;
          }

          .topbar-center {
            display: none;
          }

          .credit-pill {
            display: none;
          }

          .error-box {
            left: 275px;
          }
        }

        @media (max-width: 700px) {
          .editor-topbar {
            padding: 0 10px;
          }

          .editor-sidebar {
            display: none;
          }

          .workspace-toolbar {
            padding: 0 8px;
          }

          .preview-area {
            padding: 10px;
          }

          .preview-frame {
            min-height: 600px;
          }

          .preview-frame iframe {
            min-height: 600px;
            height: calc(
              100vh - 112px
            );
          }

          .error-box {
            left: 10px;
            right: 10px;
            bottom: 10px;
          }

          .project-subtitle {
            display: none;
          }

          .toolbar-button span.hide-mobile {
            display: none;
          }
        }
      `}</style>

      <header className="editor-topbar">
        <div className="topbar-left">
          <button
            type="button"
            className="toolbar-button"
            onClick={goBack}
          >
            ←
          </button>

          <div className="brand-mini">
            K
          </div>

          <div className="project-title-wrap">
            <div className="project-title">
              {project?.name ||
                "ZUQEN Website"}
            </div>

            <div className="project-subtitle">
              Website Builder · AI Editor
            </div>
          </div>
        </div>

        <div className="topbar-center">
          <button
            type="button"
            className={`mode-button ${
              viewMode === "preview"
                ? "active"
                : ""
            }`}
            onClick={() => {
              setViewMode("preview");
              setShowCodePanel(false);
            }}
          >
            Preview
          </button>

          <button
            type="button"
            className={`mode-button ${
              viewMode === "code"
                ? "active"
                : ""
            }`}
            onClick={() => {
              setViewMode("code");
              setShowCodePanel(true);
              setCodeValue(html);
            }}
          >
            Code
          </button>
        </div>

        <div className="topbar-actions">
          <div className="credit-pill">
            ✦{" "}
            {creditBalance === null
              ? "Credits"
              : creditBalance.toLocaleString()}
          </div>

          {saved && (
            <span className="saved-indicator">
              Saved
            </span>
          )}

          <button
            type="button"
            className="toolbar-button"
            onClick={copyCode}
          >
            Copy
          </button>

          <button
            type="button"
            className="toolbar-button"
            onClick={downloadWebsite}
          >
            Download
          </button>

          <button
            type="button"
            className="toolbar-button primary"
            onClick={() =>
              saveCurrentProject()
            }
          >
            Save
          </button>
        </div>
      </header>

      <div className="editor-body">
        <aside className="editor-sidebar">
          <section className="sidebar-section">
            <div className="sidebar-heading">
              <span>
                ✦ AI Website Editor
              </span>

              <span className="ai-credit-note">
                ~{AI_EDIT_CREDITS} credits
              </span>
            </div>

            <textarea
              className="ai-input"
              value={aiInstruction}
              onChange={(event) =>
                setAiInstruction(
                  event.target.value
                )
              }
              disabled={aiLoading}
              placeholder="Example: Make the hero section more premium, add a glowing CTA button and improve the mobile layout..."
            />

            <button
              type="button"
              className="ai-button"
              onClick={() =>
                handleAiEdit()
              }
              disabled={
                aiLoading ||
                !aiInstruction.trim() ||
                (creditBalance !== null &&
                  creditBalance <
                    AI_EDIT_CREDITS)
              }
            >
              {aiLoading
                ? "AI is editing..."
                : `✦ Edit with AI · ~${AI_EDIT_CREDITS} credits`}
            </button>

            <div className="suggestions">
              <button
                type="button"
                className="suggestion"
                onClick={() =>
                  setSuggestion(
                    "Make the website more premium and modern without removing any existing sections."
                  )
                }
              >
                Make it premium
              </button>

              <button
                type="button"
                className="suggestion"
                onClick={() =>
                  setSuggestion(
                    "Improve the mobile responsive layout and make every section look perfect on small screens."
                  )
                }
              >
                Improve mobile
              </button>

              <button
                type="button"
                className="suggestion"
                onClick={() =>
                  setSuggestion(
                    "Improve typography, spacing, buttons and visual hierarchy while keeping the current overall design."
                  )
                }
              >
                Improve design
              </button>

              <button
                type="button"
                className="suggestion"
                onClick={() =>
                  setSuggestion(
                    "Add smooth professional animations and hover effects without making the website slow."
                  )
                }
              >
                Add animations
              </button>
            </div>
          </section>

          <section className="sidebar-section">
            <div className="sidebar-heading">
              <span>
                Device Preview
              </span>
            </div>

            <div className="device-grid">
              <button
                type="button"
                className={`device-button ${
                  device === "desktop"
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  setDevice("desktop")
                }
              >
                🖥
                <br />
                Desktop
              </button>

              <button
                type="button"
                className={`device-button ${
                  device === "tablet"
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  setDevice("tablet")
                }
              >
                ▣
                <br />
                Tablet
              </button>

              <button
                type="button"
                className={`device-button ${
                  device === "mobile"
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  setDevice("mobile")
                }
              >
                📱
                <br />
                Mobile
              </button>
            </div>
          </section>

          <section className="sidebar-section">
            <div className="sidebar-heading">
              <span>
                History
              </span>
            </div>

            <div className="history-actions">
              <button
                type="button"
                className="history-button"
                onClick={undo}
                disabled={
                  historyIndex <= 0
                }
              >
                ↶ Undo
              </button>

              <button
                type="button"
                className="history-button"
                onClick={redo}
                disabled={
                  historyIndex >=
                  history.length - 1
                }
              >
                ↷ Redo
              </button>
            </div>
          </section>

          <section className="sidebar-section">
            <div className="sidebar-heading">
              <span>
                Project
              </span>
            </div>

            <button
              type="button"
              className="workspace-button"
              style={{
                width: "100%",
              }}
              onClick={() =>
                saveCurrentProject()
              }
            >
              ◈ Save to My Drive
            </button>

            <button
              type="button"
              className="workspace-button"
              style={{
                width: "100%",
                marginTop: 6,
              }}
              onClick={() =>
                setError(
                  "Cloud Drive integration coming soon."
                )
              }
            >
              ☁ Save to ZUQEN AI
            </button>
          </section>

          <div className="sidebar-footer">
            ZUQEN AI Website Builder
            <br />
            AI edits use your ZUQEN credit
            balance.
          </div>
        </aside>

        <section className="editor-workspace">
          <div className="workspace-toolbar">
            <div className="workspace-left">
              <button
                type="button"
                className={`workspace-button ${
                  viewMode ===
                  "preview"
                    ? "active"
                    : ""
                }`}
                onClick={() => {
                  setViewMode(
                    "preview"
                  );
                  setShowCodePanel(
                    false
                  );
                }}
              >
                Preview
              </button>

              <button
                type="button"
                className={`workspace-button ${
                  viewMode === "code"
                    ? "active"
                    : ""
                }`}
                onClick={() => {
                  setViewMode("code");
                  setShowCodePanel(
                    true
                  );
                  setCodeValue(html);
                }}
              >
                &lt;/&gt; Code
              </button>
            </div>

            <div className="workspace-right">
              <button
                type="button"
                className="workspace-button"
                onClick={() =>
                  setFullscreen(
                    (value) => !value
                  )
                }
              >
                {fullscreen
                  ? "Exit Fullscreen"
                  : "Fullscreen"}
              </button>

              <button
                type="button"
                className="workspace-button"
                onClick={() =>
                  setPreviewKey(
                    (value) =>
                      value + 1
                  )
                }
              >
                ↻ Refresh
              </button>
            </div>
          </div>

          {viewMode === "preview" &&
          !showCodePanel ? (
            <div className="preview-area">
              <div
                className={`preview-frame ${
                  device === "desktop"
                    ? "full-width"
                    : ""
                }`}
                style={
                  previewContainerStyle
                }
              >
                <iframe
                  key={previewKey}
                  ref={iframeRef}
                  title="ZUQEN Website Preview"
                  srcDoc={html}
                  sandbox="allow-scripts allow-forms allow-modals allow-popups"
                />
              </div>
            </div>
          ) : (
            <div className="code-area">
              <textarea
                className="code-editor"
                value={codeValue}
                onChange={(event) =>
                  setCodeValue(
                    event.target.value
                  )
                }
                spellCheck={false}
              />

              <div className="code-actions">
                <button
                  type="button"
                  className="workspace-button"
                  onClick={resetCode}
                >
                  Reset
                </button>

                <button
                  type="button"
                  className="workspace-button primary"
                  onClick={
                    applyCodeChanges
                  }
                >
                  Apply Changes
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {error && (
        <div className="error-box">
          {error}
        </div>
      )}
    </main>
  );
}