"use client";

import {
  useEffect,
  useMemo,
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
  "kairo-website-builder-project";

const DRIVE_PROJECTS_KEY =
  "kairo-website-builder-drive-projects";

export default function WebsiteEditorPage() {
  const router = useRouter();

  const [project, setProject] =
    useState<WebsiteProject | null>(null);

  const [html, setHtml] = useState("");
  const [websiteName, setWebsiteName] =
    useState("My Website");

  const [device, setDevice] =
    useState<Device>("desktop");

  const [viewMode, setViewMode] =
    useState<ViewMode>("preview");

  const [aiInstruction, setAiInstruction] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [history, setHistory] =
    useState<string[]>([]);

  const [historyIndex, setHistoryIndex] =
    useState(-1);

  const [showSaveMenu, setShowSaveMenu] =
    useState(false);

  const [showCodeEditor, setShowCodeEditor] =
    useState(false);

  const [copied, setCopied] =
    useState(false);

  const [fullscreen, setFullscreen] =
    useState(false);

  const [savedMessage, setSavedMessage] =
    useState("");

  const [previewKey, setPreviewKey] =
    useState(0);

  useEffect(() => {
    try {
      const stored =
        sessionStorage.getItem(
          PROJECT_KEY
        );

      if (!stored) {
        router.replace(
          "/website-builder"
        );
        return;
      }

      const parsed: WebsiteProject =
        JSON.parse(stored);

      if (
        !parsed ||
        typeof parsed.html !== "string"
      ) {
        router.replace(
          "/website-builder"
        );
        return;
      }

      setProject(parsed);
      setHtml(parsed.html);
      setWebsiteName(
        parsed.name || "My Website"
      );
      setHistory([parsed.html]);
      setHistoryIndex(0);
    } catch (err) {
      console.error(
        "Failed to load website project:",
        err
      );

      router.replace(
        "/website-builder"
      );
    }
  }, [router]);

  const canUndo =
    historyIndex > 0;

  const canRedo =
    historyIndex >= 0 &&
    historyIndex < history.length - 1;

  const previewWidth = useMemo(() => {
    if (device === "mobile") {
      return "390px";
    }

    if (device === "tablet") {
      return "768px";
    }

    return "100%";
  }, [device]);

  function addToHistory(
    newHtml: string
  ) {
    if (!newHtml) return;

    setHistory((current) => {
      const previous =
        current.slice(
          0,
          historyIndex + 1
        );

      const updated = [
        ...previous,
        newHtml,
      ];

      return updated.slice(-30);
    });

    setHistoryIndex((current) => {
      const currentLength =
        history.length;

      if (current < 0) {
        return 0;
      }

      return Math.min(
        current + 1,
        29
      );
    });
  }

  function applyHtml(
    newHtml: string,
    saveHistory = true
  ) {
    if (!newHtml) return;

    setHtml(newHtml);
    setPreviewKey(
      (current) => current + 1
    );

    if (saveHistory) {
      addToHistory(newHtml);
    }
  }

  async function editWebsite() {
    const instruction =
      aiInstruction.trim();

    if (!instruction) {
      setError(
        "Kairo ko batao ki website mein kya change karna hai."
      );
      return;
    }

    if (!html) {
      setError(
        "Website load nahi hui hai."
      );
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response =
        await fetch(
          "/api/website-builder",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              action: "edit",
              html,
              instruction,
            }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Website update nahi ho payi."
        );
      }

      if (
        !data.html ||
        typeof data.html !== "string"
      ) {
        throw new Error(
          "AI ne valid updated website return nahi ki."
        );
      }

      applyHtml(
        data.html,
        true
      );

      setAiInstruction("");
      setSavedMessage(
        "AI changes applied"
      );

      window.setTimeout(() => {
        setSavedMessage("");
      }, 2200);
    } catch (err) {
      console.error(
        "Website AI edit error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Website update karte waqt error aa gaya."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleCodeChange(
    value: string
  ) {
    setHtml(value);
    setPreviewKey(
      (current) => current + 1
    );
  }

  function applyCodeChanges() {
    if (!html.trim()) {
      setError(
        "Website code empty hai."
      );
      return;
    }

    addToHistory(html);
    setSavedMessage(
      "Code changes applied"
    );

    window.setTimeout(() => {
      setSavedMessage("");
    }, 1800);
  }

  function undo() {
    if (!canUndo) return;

    const newIndex =
      historyIndex - 1;

    const previous =
      history[newIndex];

    setHistoryIndex(
      newIndex
    );

    setHtml(previous);
    setPreviewKey(
      (current) => current + 1
    );
  }

  function redo() {
    if (!canRedo) return;

    const newIndex =
      historyIndex + 1;

    const next =
      history[newIndex];

    setHistoryIndex(
      newIndex
    );

    setHtml(next);
    setPreviewKey(
      (current) => current + 1
    );
  }

  function refreshPreview() {
    setPreviewKey(
      (current) => current + 1
    );
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
      }, 1800);
    } catch {
      setError(
        "Code copy nahi ho paya."
      );
    }
  }

  function downloadWebsite() {
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
      `${websiteName
        .trim()
        .replace(/\s+/g, "-")
        .toLowerCase() ||
        "kairo-website"}.html`;

    document.body.appendChild(
      anchor
    );

    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);
  }

  function saveToMyDrive() {
    if (!html) {
      setError(
        "Save karne ke liye website available nahi hai."
      );
      return;
    }

    /*
      Abhi browser ke local My Drive area
      mein project save ho raha hai.

      Real Google Drive integration ke liye
      baad mein Google OAuth + Drive API
      connect ki ja sakti hai.
    */

    try {
      const existing =
        localStorage.getItem(
          DRIVE_PROJECTS_KEY
        );

      const projects =
        existing
          ? JSON.parse(existing)
          : [];

      const newProject = {
        id:
          typeof crypto !==
          "undefined" &&
          crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}`,
        name:
          websiteName.trim() ||
          "My Website",
        prompt:
          project?.prompt || "",
        html,
        createdAt:
          new Date().toISOString(),
      };

      const updated = [
        newProject,
        ...projects,
      ].slice(0, 50);

      localStorage.setItem(
        DRIVE_PROJECTS_KEY,
        JSON.stringify(updated)
      );

      setShowSaveMenu(false);

      setSavedMessage(
        "Saved to My Drive"
      );

      window.setTimeout(() => {
        setSavedMessage("");
      }, 2500);
    } catch (err) {
      console.error(
        "Drive save error:",
        err
      );

      setError(
        "Website save nahi ho payi."
      );
    }
  }

  function saveToKairoAI() {
    setShowSaveMenu(false);

    setSavedMessage(
      "Save to Kairo AI — Coming soon"
    );

    window.setTimeout(() => {
      setSavedMessage("");
    }, 2500);
  }

  function closeSaveMenu() {
    setShowSaveMenu(false);
  }

  function goBack() {
    sessionStorage.setItem(
      PROJECT_KEY,
      JSON.stringify({
        prompt:
          project?.prompt || "",
        html,
        name:
          websiteName ||
          "My Website",
        createdAt:
          project?.createdAt ||
          new Date().toISOString(),
      })
    );

    router.push(
      "/website-builder"
    );
  }

  function openFullscreen() {
    setFullscreen(true);
  }

  function closeFullscreen() {
    setFullscreen(false);
  }

  function useSuggestion(
    suggestion: string
  ) {
    setAiInstruction(
      suggestion
    );
  }

  return (
    <main className="editor-page">
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
        input,
        textarea {
          font: inherit;
        }

        button {
          cursor: pointer;
        }

        .editor-page {
          min-height: 100vh;
          height: 100vh;
          overflow: hidden;
          background: #070707;
          color: white;
        }

        .editor-shell {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .editor-header {
          height: 64px;
          min-height: 64px;
          padding: 0 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          border-bottom: 1px solid
            rgba(255, 255, 255, 0.08);
          background:
            linear-gradient(
              180deg,
              rgba(16, 16, 17, 0.98),
              rgba(8, 8, 9, 0.98)
            );
          position: relative;
          z-index: 50;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .back-button {
          width: 36px;
          height: 36px;
          border-radius: 9px;
          border: 1px solid
            rgba(255, 255, 255, 0.09);
          background: rgba(
            255,
            255,
            255,
            0.035
          );
          color: #aaa;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: 0.2s ease;
          flex-shrink: 0;
        }

        .back-button:hover {
          color: white;
          background: rgba(
            255,
            255,
            255,
            0.08
          );
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 9px;
          min-width: 0;
        }

        .brand-logo {
          width: 30px;
          height: 30px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          background:
            linear-gradient(
              135deg,
              #8066ff,
              #4f46e5
            );
          font-size: 13px;
          font-weight: 900;
          box-shadow:
            0 0 25px
              rgba(
                124,
                92,
                255,
                0.25
              );
          flex-shrink: 0;
        }

        .brand-info {
          min-width: 0;
        }

        .brand-name {
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        .brand-label {
          color: #555;
          font-size: 9px;
          margin-top: 1px;
        }

        .name-editor {
          height: 35px;
          min-width: 130px;
          max-width: 260px;
          padding: 0 10px;
          border-radius: 8px;
          border: 1px solid
            transparent;
          outline: none;
          background: transparent;
          color: #aaa;
          font-size: 12px;
          font-weight: 700;
        }

        .name-editor:hover {
          background: rgba(
            255,
            255,
            255,
            0.03
          );
          border-color: rgba(
            255,
            255,
            255,
            0.06
          );
        }

        .name-editor:focus {
          color: white;
          background: rgba(
            255,
            255,
            255,
            0.045
          );
          border-color: rgba(
            124,
            92,
            255,
            0.35
          );
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .header-button {
          height: 36px;
          padding: 0 12px;
          border-radius: 9px;
          border: 1px solid
            rgba(255, 255, 255, 0.08);
          background: rgba(
            255,
            255,
            255,
            0.035
          );
          color: #aaa;
          font-size: 11px;
          font-weight: 700;
          transition: 0.2s ease;
        }

        .header-button:hover {
          color: white;
          background: rgba(
            255,
            255,
            255,
            0.08
          );
          border-color: rgba(
            255,
            255,
            255,
            0.14
          );
        }

        .save-wrapper {
          position: relative;
        }

        .save-button {
          color: white;
          border-color: rgba(
            124,
            92,
            255,
            0.35
          );
          background:
            linear-gradient(
              135deg,
              rgba(
                124,
                92,
                255,
                0.25
              ),
              rgba(
                79,
                70,
                229,
                0.18
              )
            );
        }

        .save-button:hover {
          border-color: rgba(
            124,
            92,
            255,
            0.6
          );
        }

        .save-menu {
          position: absolute;
          right: 0;
          top: calc(100% + 8px);
          width: 245px;
          padding: 7px;
          border: 1px solid
            rgba(255, 255, 255, 0.1);
          border-radius: 13px;
          background: #111113;
          box-shadow:
            0 25px 70px
              rgba(0, 0, 0, 0.55);
          z-index: 100;
        }

        .save-option {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 11px;
          text-align: left;
          border: 0;
          border-radius: 9px;
          padding: 11px;
          background: transparent;
          color: white;
          transition: 0.18s ease;
        }

        .save-option:hover {
          background: rgba(
            255,
            255,
            255,
            0.06
          );
        }

        .save-option-icon {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: rgba(
            255,
            255,
            255,
            0.06
          );
          font-size: 15px;
          flex-shrink: 0;
        }

        .save-option-title {
          font-size: 11px;
          font-weight: 800;
        }

        .save-option-text {
          margin-top: 2px;
          color: #666;
          font-size: 9px;
        }

        .editor-workspace {
          flex: 1;
          min-height: 0;
          display: grid;
          grid-template-columns:
            minmax(0, 1fr) 350px;
        }

        .preview-workspace {
          min-width: 0;
          min-height: 0;
          display: flex;
          flex-direction: column;
          background: #0d0d0e;
        }

        .preview-toolbar {
          height: 54px;
          min-height: 54px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 0 12px;
          border-bottom: 1px solid
            rgba(255, 255, 255, 0.07);
          background: rgba(
            12,
            12,
            13,
            0.96
          );
        }

        .toolbar-group {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .view-button {
          height: 33px;
          padding: 0 11px;
          border: 1px solid
            transparent;
          border-radius: 8px;
          background: transparent;
          color: #666;
          font-size: 11px;
          font-weight: 700;
        }

        .view-button:hover {
          color: #aaa;
          background: rgba(
            255,
            255,
            255,
            0.04
          );
        }

        .view-button.active {
          color: white;
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
            0.08
          );
        }

        .toolbar-divider {
          width: 1px;
          height: 22px;
          margin: 0 5px;
          background: rgba(
            255,
            255,
            255,
            0.08
          );
        }

        .device-button {
          width: 34px;
          height: 33px;
          border: 1px solid
            transparent;
          border-radius: 8px;
          background: transparent;
          color: #666;
          font-size: 14px;
        }

        .device-button:hover,
        .device-button.active {
          color: white;
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
            0.08
          );
        }

        .tool-icon {
          width: 33px;
          height: 33px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid
            transparent;
          border-radius: 8px;
          background: transparent;
          color: #666;
          font-size: 15px;
        }

        .tool-icon:hover:not(
            :disabled
          ) {
          color: white;
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
            0.08
          );
        }

        .tool-icon:disabled {
          opacity: 0.25;
          cursor: not-allowed;
        }

        .preview-canvas {
          flex: 1;
          min-height: 0;
          overflow: auto;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 25px;
          background:
            radial-gradient(
              circle at center,
              rgba(
                255,
                255,
                255,
                0.035
              ),
              transparent 50%
            ),
            #111113;
        }

        .preview-frame {
          width: var(
            --preview-width
          );
          max-width: 100%;
          height: 100%;
          min-height: 500px;
          border-radius: 12px;
          overflow: hidden;
          background: white;
          border: 1px solid
            rgba(255, 255, 255, 0.1);
          box-shadow:
            0 25px 70px
              rgba(0, 0, 0, 0.45);
          transition:
            width 0.25s ease;
        }

        .preview-frame iframe {
          display: block;
          width: 100%;
          height: 100%;
          min-height: 500px;
          border: 0;
          background: white;
        }

        .code-panel {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          padding: 16px;
          background: #080809;
          overflow: hidden;
        }

        .code-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }

        .code-heading-title {
          color: #aaa;
          font-size: 11px;
          font-weight: 800;
        }

        .code-heading-subtitle {
          color: #555;
          font-size: 9px;
          margin-top: 3px;
        }

        .code-textarea {
          flex: 1;
          width: 100%;
          min-height: 0;
          resize: none;
          outline: none;
          border-radius: 11px;
          border: 1px solid
            rgba(255, 255, 255, 0.08);
          background: #050506;
          color: #d4d4d8;
          padding: 15px;
          font-family:
            "SFMono-Regular",
            Consolas,
            "Liberation Mono",
            monospace;
          font-size: 11px;
          line-height: 1.65;
          tab-size: 2;
        }

        .code-textarea:focus {
          border-color: rgba(
            124,
            92,
            255,
            0.35
          );
        }

        .code-actions {
          display: flex;
          justify-content: flex-end;
          gap: 7px;
          margin-top: 9px;
        }

        .code-action {
          height: 34px;
          padding: 0 11px;
          border-radius: 8px;
          border: 1px solid
            rgba(255, 255, 255, 0.08);
          background: rgba(
            255,
            255,
            255,
            0.04
          );
          color: #aaa;
          font-size: 10px;
          font-weight: 700;
        }

        .code-action:hover {
          color: white;
          background: rgba(
            255,
            255,
            255,
            0.08
          );
        }

        .ai-panel {
          min-width: 0;
          min-height: 0;
          display: flex;
          flex-direction: column;
          border-left: 1px solid
            rgba(255, 255, 255, 0.08);
          background:
            radial-gradient(
              circle at 50% 0%,
              rgba(
                124,
                92,
                255,
                0.08
              ),
              transparent 35%
            ),
            #0a0a0b;
        }

        .ai-header {
          height: 54px;
          min-height: 54px;
          padding: 0 15px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid
            rgba(255, 255, 255, 0.07);
        }

        .ai-title-area {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .ai-avatar {
          width: 30px;
          height: 30px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          background:
            linear-gradient(
              135deg,
              #8066ff,
              #4f46e5
            );
          font-size: 13px;
          font-weight: 900;
          box-shadow:
            0 0 20px
              rgba(
                124,
                92,
                255,
                0.25
              );
        }

        .ai-title {
          font-size: 12px;
          font-weight: 800;
        }

        .ai-status {
          display: flex;
          align-items: center;
          gap: 5px;
          color: #666;
          font-size: 9px;
          margin-top: 2px;
        }

        .status-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #63d391;
          box-shadow:
            0 0 8px
              rgba(
                99,
                211,
                145,
                0.7
              );
        }

        .ai-content {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 16px;
        }

        .ai-welcome {
          padding: 15px;
          border-radius: 12px;
          border: 1px solid
            rgba(
              124,
              92,
              255,
              0.13
            );
          background:
            linear-gradient(
              135deg,
              rgba(
                124,
                92,
                255,
                0.08
              ),
              rgba(
                255,
                255,
                255,
                0.02
              )
            );
          margin-bottom: 18px;
        }

        .ai-welcome-title {
          font-size: 12px;
          font-weight: 800;
          margin-bottom: 6px;
        }

        .ai-welcome-text {
          color: #777;
          font-size: 10px;
          line-height: 1.6;
        }

        .suggestion-label {
          color: #555;
          text-transform: uppercase;
          letter-spacing: 0.9px;
          font-size: 9px;
          font-weight: 800;
          margin-bottom: 8px;
        }

        .suggestions {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .suggestion {
          width: 100%;
          padding: 9px 10px;
          text-align: left;
          border-radius: 9px;
          border: 1px solid
            rgba(255, 255, 255, 0.06);
          background: rgba(
            255,
            255,
            255,
            0.025
          );
          color: #888;
          font-size: 10px;
          line-height: 1.4;
          transition: 0.18s ease;
        }

        .suggestion:hover {
          color: #bbb;
          border-color: rgba(
            124,
            92,
            255,
            0.22
          );
          background: rgba(
            124,
            92,
            255,
            0.055
          );
        }

        .ai-input-area {
          padding: 12px;
          border-top: 1px solid
            rgba(255, 255, 255, 0.07);
          background: #0b0b0c;
        }

        .ai-input-wrapper {
          border: 1px solid
            rgba(255, 255, 255, 0.09);
          border-radius: 12px;
          background: #111113;
          overflow: hidden;
          transition: 0.2s ease;
        }

        .ai-input-wrapper:focus-within {
          border-color: rgba(
            124,
            92,
            255,
            0.45
          );
          box-shadow:
            0 0 0 3px
              rgba(
                124,
                92,
                255,
                0.07
              );
        }

        .ai-textarea {
          display: block;
          width: 100%;
          min-height: 78px;
          resize: none;
          border: 0;
          outline: 0;
          padding: 11px;
          background: transparent;
          color: white;
          font-size: 11px;
          line-height: 1.55;
        }

        .ai-textarea::placeholder {
          color: #555;
        }

        .ai-input-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 7px 7px 10px;
        }

        .ai-input-hint {
          color: #444;
          font-size: 8px;
        }

        .ai-send {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 8px;
          color: white;
          background:
            linear-gradient(
              135deg,
              #8066ff,
              #5947df
            );
          font-size: 13px;
          transition: 0.2s ease;
        }

        .ai-send:hover:not(
            :disabled
          ) {
          transform: translateY(-1px);
          box-shadow:
            0 7px 18px
              rgba(
                91,
                75,
                231,
                0.3
              );
        }

        .ai-send:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .ai-spinner {
          width: 13px;
          height: 13px;
          border-radius: 50%;
          border: 2px solid
            rgba(
              255,
              255,
              255,
              0.25
            );
          border-top-color: white;
          animation:
            editor-spin
            0.7s linear infinite;
        }

        .error-bar {
          position: fixed;
          left: 50%;
          bottom: 20px;
          transform: translateX(-50%);
          max-width: min(
            600px,
            calc(100vw - 30px)
          );
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid
            rgba(255, 70, 70, 0.25);
          background: #171011;
          color: #ff9d9d;
          font-size: 10px;
          line-height: 1.4;
          box-shadow:
            0 20px 50px
              rgba(0, 0, 0, 0.4);
          z-index: 500;
        }

        .success-toast {
          position: fixed;
          left: 50%;
          bottom: 20px;
          transform: translateX(-50%);
          padding: 9px 14px;
          border-radius: 999px;
          border: 1px solid
            rgba(99, 211, 145, 0.2);
          background: #0d1511;
          color: #8ee0ad;
          font-size: 10px;
          font-weight: 700;
          z-index: 501;
          box-shadow:
            0 15px 45px
              rgba(0, 0, 0, 0.4);
        }

        .loading-overlay {
          position: fixed;
          inset: 0;
          z-index: 900;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(
            0,
            0,
            0,
            0.52
          );
          backdrop-filter: blur(5px);
        }

        .loading-card {
          width: min(
            360px,
            calc(100vw - 30px)
          );
          padding: 25px;
          border-radius: 17px;
          border: 1px solid
            rgba(255, 255, 255, 0.1);
          background: #111113;
          text-align: center;
          box-shadow:
            0 30px 90px
              rgba(0, 0, 0, 0.6);
        }

        .loading-spinner {
          width: 35px;
          height: 35px;
          margin: 0 auto 15px;
          border-radius: 50%;
          border: 3px solid
            rgba(255, 255, 255, 0.1);
          border-top-color: #8066ff;
          animation:
            editor-spin
            0.8s linear infinite;
        }

        .loading-title {
          font-size: 13px;
          font-weight: 800;
        }

        .loading-text {
          color: #666;
          font-size: 10px;
          line-height: 1.6;
          margin-top: 6px;
        }

        .fullscreen {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          flex-direction: column;
          background: #080808;
        }

        .fullscreen-header {
          height: 54px;
          min-height: 54px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 14px;
          border-bottom: 1px solid
            rgba(255, 255, 255, 0.08);
          background: #0c0c0d;
        }

        .fullscreen-name {
          font-size: 12px;
          font-weight: 800;
        }

        .fullscreen-close {
          height: 34px;
          padding: 0 12px;
          border-radius: 8px;
          border: 1px solid
            rgba(255, 255, 255, 0.1);
          background: rgba(
            255,
            255,
            255,
            0.04
          );
          color: #aaa;
          font-size: 10px;
          font-weight: 700;
        }

        .fullscreen-close:hover {
          color: white;
          background: rgba(
            255,
            255,
            255,
            0.08
          );
        }

        .fullscreen-frame {
          flex: 1;
          background: white;
        }

        .fullscreen-frame iframe {
          width: 100%;
          height: 100%;
          border: 0;
        }

        @keyframes editor-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 950px) {
          .editor-workspace {
            grid-template-columns:
              minmax(0, 1fr) 300px;
          }

          .name-editor {
            max-width: 170px;
          }

          .ai-panel {
            width: 300px;
          }
        }

        @media (max-width: 760px) {
          .editor-header {
            padding: 0 10px;
          }

          .brand-info,
          .brand-label {
            display: none;
          }

          .name-editor {
            min-width: 100px;
            max-width: 130px;
          }

          .header-button {
            padding: 0 9px;
          }

          .editor-workspace {
            display: flex;
            flex-direction: column;
          }

          .preview-workspace {
            flex: 1;
            min-height: 0;
          }

          .ai-panel {
            width: 100%;
            height: 290px;
            min-height: 290px;
            border-left: 0;
            border-top: 1px solid
              rgba(255, 255, 255, 0.08);
          }

          .ai-content {
            padding: 10px 12px;
          }

          .ai-welcome {
            display: none;
          }

          .suggestions {
            flex-direction: row;
            overflow-x: auto;
          }

          .suggestion {
            min-width: 180px;
          }

          .preview-canvas {
            padding: 12px;
          }

          .preview-frame {
            min-height: 400px;
          }

          .preview-frame iframe {
            min-height: 400px;
          }

          .toolbar-divider {
            margin: 0 2px;
          }

          .view-button {
            padding: 0 8px;
          }
        }

        @media (max-width: 520px) {
          .header-left {
            gap: 6px;
          }

          .back-button {
            width: 32px;
            height: 32px;
          }

          .brand-logo {
            width: 29px;
            height: 29px;
          }

          .name-editor {
            font-size: 10px;
            max-width: 105px;
          }

          .header-actions
            .header-button:first-child {
            display: none;
          }

          .preview-toolbar {
            padding: 0 7px;
          }

          .device-button {
            width: 30px;
          }

          .tool-icon {
            width: 30px;
          }

          .preview-canvas {
            padding: 8px;
          }

          .ai-panel {
            height: 300px;
            min-height: 300px;
          }
        }
      `}</style>

      <div className="editor-shell">
        <header className="editor-header">
          <div className="header-left">
            <button
              type="button"
              className="back-button"
              onClick={goBack}
              title="Back"
            >
              ←
            </button>

            <div className="brand">
              <div className="brand-logo">
                K
              </div>

              <div className="brand-info">
                <div className="brand-name">
                  Kairo AI
                </div>

                <div className="brand-label">
                  Website Editor
                </div>
              </div>
            </div>

            <input
              className="name-editor"
              value={websiteName}
              onChange={(event) =>
                setWebsiteName(
                  event.target.value
                )
              }
              placeholder="Website name"
              aria-label="Website name"
            />
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="header-button"
              onClick={downloadWebsite}
              disabled={!html}
            >
              ↓ Export
            </button>

            <div className="save-wrapper">
              <button
                type="button"
                className="header-button save-button"
                onClick={() =>
                  setShowSaveMenu(
                    (current) =>
                      !current
                  )
                }
                disabled={!html}
              >
                💾 Save
              </button>

              {showSaveMenu && (
                <div className="save-menu">
                  <button
                    type="button"
                    className="save-option"
                    onClick={
                      saveToMyDrive
                    }
                  >
                    <div className="save-option-icon">
                      ☁
                    </div>

                    <div>
                      <div className="save-option-title">
                        Save to My Drive
                      </div>

                      <div className="save-option-text">
                        Save this website to
                        your projects.
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    className="save-option"
                    onClick={
                      saveToKairoAI
                    }
                  >
                    <div className="save-option-icon">
                      ✦
                    </div>

                    <div>
                      <div className="save-option-title">
                        Save to Kairo AI
                      </div>

                      <div className="save-option-text">
                        Keep it inside your
                        Kairo workspace.
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="editor-workspace">
          <section className="preview-workspace">
            <div className="preview-toolbar">
              <div className="toolbar-group">
                <button
                  type="button"
                  className={`view-button ${
                    viewMode ===
                    "preview"
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    setViewMode(
                      "preview"
                    )
                  }
                >
                  ◉ Preview
                </button>

                <button
                  type="button"
                  className={`view-button ${
                    viewMode === "code"
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    setViewMode("code")
                  }
                >
                  {"</>"} Code
                </button>
              </div>

              <div className="toolbar-group">
                {viewMode ===
                  "preview" && (
                  <>
                    <button
                      type="button"
                      className={`device-button ${
                        device ===
                        "desktop"
                          ? "active"
                          : ""
                      }`}
                      onClick={() =>
                        setDevice(
                          "desktop"
                        )
                      }
                      title="Desktop"
                    >
                      🖥
                    </button>

                    <button
                      type="button"
                      className={`device-button ${
                        device ===
                        "tablet"
                          ? "active"
                          : ""
                      }`}
                      onClick={() =>
                        setDevice(
                          "tablet"
                        )
                      }
                      title="Tablet"
                    >
                      ▣
                    </button>

                    <button
                      type="button"
                      className={`device-button ${
                        device ===
                        "mobile"
                          ? "active"
                          : ""
                      }`}
                      onClick={() =>
                        setDevice(
                          "mobile"
                        )
                      }
                      title="Mobile"
                    >
                      📱
                    </button>

                    <div className="toolbar-divider" />
                  </>
                )}

                <button
                  type="button"
                  className="tool-icon"
                  onClick={undo}
                  disabled={!canUndo}
                  title="Undo"
                >
                  ↶
                </button>

                <button
                  type="button"
                  className="tool-icon"
                  onClick={redo}
                  disabled={!canRedo}
                  title="Redo"
                >
                  ↷
                </button>

                <button
                  type="button"
                  className="tool-icon"
                  onClick={
                    refreshPreview
                  }
                  disabled={!html}
                  title="Refresh preview"
                >
                  ↻
                </button>

                <button
                  type="button"
                  className="tool-icon"
                  onClick={
                    copyCode
                  }
                  disabled={!html}
                  title="Copy code"
                >
                  {copied
                    ? "✓"
                    : "⧉"}
                </button>

                <button
                  type="button"
                  className="tool-icon"
                  onClick={
                    openFullscreen
                  }
                  disabled={!html}
                  title="Fullscreen"
                >
                  ⛶
                </button>
              </div>
            </div>

            {viewMode ===
            "preview" ? (
              <div className="preview-canvas">
                {html ? (
                  <div
                    className="preview-frame"
                    style={
                      {
                        "--preview-width":
                          previewWidth,
                      } as React.CSSProperties
                    }
                  >
                    <iframe
                      key={
                        previewKey
                      }
                      title="Kairo AI Website Preview"
                      srcDoc={html}
                      sandbox="allow-scripts allow-forms allow-modals allow-popups"
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      display:
                        "flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "center",
                      width: "100%",
                      color: "#555",
                      fontSize: 12,
                    }}
                  >
                    Loading website...
                  </div>
                )}
              </div>
            ) : (
              <div className="code-panel">
                <div className="code-heading">
                  <div>
                    <div className="code-heading-title">
                      Website Source
                    </div>

                    <div className="code-heading-subtitle">
                      Edit HTML, CSS and
                      JavaScript directly
                    </div>
                  </div>

                  <button
                    type="button"
                    className="code-action"
                    onClick={
                      copyCode
                    }
                  >
                    {copied
                      ? "✓ Copied"
                      : "Copy"}
                  </button>
                </div>

                <textarea
                  className="code-textarea"
                  value={html}
                  onChange={(event) =>
                    handleCodeChange(
                      event.target.value
                    )
                  }
                  spellCheck={false}
                />

                <div className="code-actions">
                  <button
                    type="button"
                    className="code-action"
                    onClick={() =>
                      setHtml(
                        history[
                          historyIndex
                        ] || html
                      )
                    }
                  >
                    Reset
                  </button>

                  <button
                    type="button"
                    className="code-action"
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

          <aside className="ai-panel">
            <div className="ai-header">
              <div className="ai-title-area">
                <div className="ai-avatar">
                  K
                </div>

                <div>
                  <div className="ai-title">
                    Kairo AI
                  </div>

                  <div className="ai-status">
                    <span className="status-dot" />
                    Ready to edit
                  </div>
                </div>
              </div>
            </div>

            <div className="ai-content">
              <div className="ai-welcome">
                <div className="ai-welcome-title">
                  What should I change?
                </div>

                <div className="ai-welcome-text">
                  Tell Kairo naturally what
                  you want to add, remove or
                  redesign. I'll update the
                  website while keeping the
                  rest intact.
                </div>
              </div>

              <div className="suggestion-label">
                Try asking
              </div>

              <div className="suggestions">
                <button
                  type="button"
                  className="suggestion"
                  onClick={() =>
                    useSuggestion(
                      "Add a beautiful pricing section with three premium pricing plans."
                    )
                  }
                >
                  Add a pricing section
                </button>

                <button
                  type="button"
                  className="suggestion"
                  onClick={() =>
                    useSuggestion(
                      "Change the website color scheme to a premium purple and black gradient."
                    )
                  }
                >
                  Change the color scheme
                </button>

                <button
                  type="button"
                  className="suggestion"
                  onClick={() =>
                    useSuggestion(
                      "Add a modern testimonials section with customer reviews."
                    )
                  }
                >
                  Add testimonials
                </button>

                <button
                  type="button"
                  className="suggestion"
                  onClick={() =>
                    useSuggestion(
                      "Make the website feel more premium, modern and visually polished."
                    )
                  }
                >
                  Make it more premium
                </button>

                <button
                  type="button"
                  className="suggestion"
                  onClick={() =>
                    useSuggestion(
                      "Improve the mobile responsive layout without changing the desktop design."
                    )
                  }
                >
                  Improve mobile layout
                </button>
              </div>
            </div>

            <div className="ai-input-area">
              <div className="ai-input-wrapper">
                <textarea
                  className="ai-textarea"
                  value={
                    aiInstruction
                  }
                  onChange={(
                    event
                  ) =>
                    setAiInstruction(
                      event.target
                        .value
                    )
                  }
                  onKeyDown={(
                    event
                  ) => {
                    if (
                      event.key ===
                        "Enter" &&
                      !event.shiftKey
                    ) {
                      event.preventDefault();

                      if (
                        !loading &&
                        aiInstruction.trim()
                      ) {
                        editWebsite();
                      }
                    }
                  }}
                  placeholder="Ask Kairo to change something..."
                  disabled={loading}
                />

                <div className="ai-input-bottom">
                  <div className="ai-input-hint">
                    Enter to send · Shift +
                    Enter for new line
                  </div>

                  <button
                    type="button"
                    className="ai-send"
                    onClick={
                      editWebsite
                    }
                    disabled={
                      loading ||
                      !aiInstruction.trim() ||
                      !html
                    }
                    title="Send to Kairo AI"
                  >
                    {loading ? (
                      <span className="ai-spinner" />
                    ) : (
                      "↑"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {error && (
        <div className="error-bar">
          {error}
        </div>
      )}

      {savedMessage && (
        <div className="success-toast">
          ✓ {savedMessage}
        </div>
      )}

      {fullscreen &&
        html && (
          <div className="fullscreen">
            <div className="fullscreen-header">
              <div className="fullscreen-name">
                {websiteName ||
                  "My Website"}
              </div>

              <button
                type="button"
                className="fullscreen-close"
                onClick={
                  closeFullscreen
                }
              >
                ✕ Close Fullscreen
              </button>
            </div>

            <div className="fullscreen-frame">
              <iframe
                title="Fullscreen Website Preview"
                srcDoc={html}
                sandbox="allow-scripts allow-forms allow-modals allow-popups"
              />
            </div>
          </div>
        )}

      {loading && (
        <div className="loading-overlay">
          <div className="loading-card">
            <div className="loading-spinner" />

            <div className="loading-title">
              Kairo is editing your
              website
            </div>

            <div className="loading-text">
              AI tumhari request ke
              according website ko update
              kar raha hai. Existing
              features ko preserve karne ki
              koshish ki ja rahi hai...
            </div>
          </div>
        </div>
      )}
    </main>
  );
}