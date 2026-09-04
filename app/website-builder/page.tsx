"use client";

import { useEffect, useMemo, useState } from "react";

type Device = "desktop" | "tablet" | "mobile";
type Tab = "preview" | "code";

type Project = {
  id: string;
  name: string;
  prompt: string;
  html: string;
  createdAt: string;
};

const STORAGE_KEY = "kairo-website-builder-projects";

const templates = [
  {
    id: "portfolio",
    name: "Portfolio",
    icon: "✦",
    description: "Personal portfolio website",
    prompt:
      "Create a modern premium personal portfolio website for a creative developer. Include a hero section, about section, skills, projects, experience, contact section, smooth animations, responsive design and a dark futuristic visual style.",
  },
  {
    id: "startup",
    name: "Startup",
    icon: "🚀",
    description: "SaaS startup landing page",
    prompt:
      "Create a premium SaaS startup landing page. Include navbar, hero section with CTA buttons, trusted companies, features, product showcase, pricing cards, testimonials, FAQ, final CTA and footer. Make it modern, responsive and conversion focused.",
  },
  {
    id: "agency",
    name: "Agency",
    icon: "◈",
    description: "Creative digital agency",
    prompt:
      "Create a high-end creative digital agency website. Include a bold hero, services, selected work/projects, statistics, team, testimonials, process section, contact CTA and footer. Use premium typography, smooth animations and responsive layouts.",
  },
  {
    id: "restaurant",
    name: "Restaurant",
    icon: "🍽",
    description: "Restaurant website",
    prompt:
      "Create a beautiful premium restaurant website. Include hero, navigation, menu categories, popular dishes, about the restaurant, gallery, customer reviews, opening hours, reservation CTA, location and footer. Make it elegant and fully responsive.",
  },
];

export default function WebsiteBuilderPage() {
  const [prompt, setPrompt] = useState("");
  const [projectName, setProjectName] = useState("My Website");

  const [html, setHtml] = useState("");
  const [previousHtml, setPreviousHtml] = useState("");
  const [nextHtml, setNextHtml] = useState("");

  const [activeTab, setActiveTab] = useState<Tab>("preview");
  const [device, setDevice] = useState<Device>("desktop");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [savedProjects, setSavedProjects] = useState<Project[]>([]);
  const [showProjects, setShowProjects] = useState(false);

  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const currentTemplate = useMemo(() => {
    return templates.find((template) => prompt === template.prompt);
  }, [prompt]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved) {
        setSavedProjects(JSON.parse(saved));
      }
    } catch {
      console.error("Failed to load saved projects");
    }
  }, []);

  function updateHistory(newHtml: string) {
    if (!newHtml) return;

    setHistory((current) => {
      const trimmed = current.slice(0, historyIndex + 1);

      const updated = [...trimmed, newHtml];

      return updated.slice(-20);
    });

    setHistoryIndex((current) => {
      if (current < 0) return 0;
      return Math.min(current + 1, 19);
    });
  }

  async function generateWebsite(
    customPrompt?: string,
    templateName?: string
  ) {
    const finalPrompt = (customPrompt ?? prompt).trim();

    if (!finalPrompt) {
      setError("Pehle batao ki website kaisi chahiye.");
      return;
    }

    setError("");
    setLoading(true);
    setCopied(false);

    try {
      const response = await fetch("/api/website-builder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: finalPrompt,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Website generate nahi ho payi."
        );
      }

      if (!data.html || typeof data.html !== "string") {
        throw new Error("AI ne valid website code return nahi kiya.");
      }

      setPreviousHtml(html);
      setNextHtml("");
      setHtml(data.html);

      setHistory((current) => {
        const updated = [...current.slice(0, historyIndex + 1), data.html];
        return updated.slice(-20);
      });

      setHistoryIndex((current) => {
        if (current < 0) return 0;
        return Math.min(current + 1, 19);
      });

      if (templateName) {
        setProjectName(
          `${templateName.charAt(0).toUpperCase()}${templateName.slice(1)} Website`
        );
      }
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while generating the website."
      );
    } finally {
      setLoading(false);
    }
  }

  function selectTemplate(template: (typeof templates)[number]) {
    setPrompt(template.prompt);
    setProjectName(
      `${template.name} Website`
    );
    setError("");
  }

  function undo() {
    if (historyIndex <= 0) return;

    const newIndex = historyIndex - 1;

    setNextHtml(history[historyIndex]);
    setHtml(history[newIndex]);
    setHistoryIndex(newIndex);
  }

  function redo() {
    if (historyIndex >= history.length - 1) return;

    const newIndex = historyIndex + 1;

    setPreviousHtml(history[historyIndex]);
    setHtml(history[newIndex]);
    setHistoryIndex(newIndex);
  }

  function refreshPreview() {
    if (!html) return;

    setHtml((current) => {
      const refreshed = current;

      setTimeout(() => {
        setHtml(refreshed);
      }, 0);

      return refreshed;
    });
  }

  async function copyCode() {
    if (!html) return;

    try {
      await navigator.clipboard.writeText(html);

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      setError("Code copy nahi ho paya.");
    }
  }

  function saveProject() {
    if (!html) {
      setError("Save karne ke liye pehle website generate karo.");
      return;
    }

    const newProject: Project = {
      id: crypto.randomUUID(),
      name: projectName.trim() || "My Website",
      prompt,
      html,
      createdAt: new Date().toISOString(),
    };

    const updatedProjects = [newProject, ...savedProjects].slice(0, 20);

    setSavedProjects(updatedProjects);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(updatedProjects)
    );

    setError("");
  }

  function loadProject(project: Project) {
    setProjectName(project.name);
    setPrompt(project.prompt);
    setHtml(project.html);

    setHistory([project.html]);
    setHistoryIndex(0);

    setShowProjects(false);
    setActiveTab("preview");
    setError("");
  }

  function deleteProject(id: string) {
    const updated = savedProjects.filter(
      (project) => project.id !== id
    );

    setSavedProjects(updated);

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(updated)
    );
  }

  function exportHtml() {
    if (!html) {
      setError("Export karne ke liye pehle website generate karo.");
      return;
    }

    const blob = new Blob([html], {
      type: "text/html;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download =
      `${projectName.trim().replace(/\s+/g, "-").toLowerCase() || "kairo-website"}.html`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);
  }

  function openFullscreen() {
    setFullscreen(true);
  }

  function closeFullscreen() {
    setFullscreen(false);
  }

  const previewWidth =
    device === "desktop"
      ? "100%"
      : device === "tablet"
        ? "768px"
        : "390px";

  return (
    <main className="builder-page">
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          padding: 0;
          background: #050505;
          color: #fff;
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
        textarea,
        input {
          font: inherit;
        }

        button {
          cursor: pointer;
        }

        .builder-page {
          min-height: 100vh;
          background:
            radial-gradient(
              circle at 15% 0%,
              rgba(110, 75, 255, 0.13),
              transparent 28%
            ),
            radial-gradient(
              circle at 90% 10%,
              rgba(0, 200, 255, 0.08),
              transparent 25%
            ),
            #050505;
          color: #fff;
        }

        .builder-shell {
          width: 100%;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        .builder-header {
          height: 70px;
          padding: 0 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(5, 5, 5, 0.82);
          backdrop-filter: blur(18px);
          position: sticky;
          top: 0;
          z-index: 50;
        }

        .brand-area {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .brand-icon {
          width: 36px;
          height: 36px;
          border-radius: 11px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #7c5cff, #3b82f6);
          font-weight: 900;
          box-shadow: 0 0 30px rgba(124, 92, 255, 0.35);
        }

        .brand-title {
          font-weight: 800;
          font-size: 16px;
          letter-spacing: -0.3px;
        }

        .brand-subtitle {
          color: #777;
          font-size: 11px;
          margin-top: 2px;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .icon-button,
        .secondary-button {
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.045);
          color: #ddd;
          border-radius: 10px;
          height: 38px;
          padding: 0 13px;
          transition: 0.2s ease;
        }

        .icon-button {
          width: 38px;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .icon-button:hover,
        .secondary-button:hover {
          background: rgba(255, 255, 255, 0.09);
          border-color: rgba(255, 255, 255, 0.17);
          color: white;
        }

        .builder-layout {
          flex: 1;
          display: grid;
          grid-template-columns: 380px minmax(0, 1fr);
          min-height: calc(100vh - 70px);
        }

        .control-panel {
          border-right: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(8, 8, 8, 0.75);
          padding: 20px;
          overflow-y: auto;
        }

        .panel-section {
          margin-bottom: 22px;
        }

        .section-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1.2px;
          color: #777;
          font-weight: 700;
          margin-bottom: 9px;
        }

        .project-input {
          width: 100%;
          height: 43px;
          border-radius: 11px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.045);
          color: white;
          padding: 0 13px;
          outline: none;
        }

        .project-input:focus {
          border-color: rgba(124, 92, 255, 0.7);
          box-shadow: 0 0 0 3px rgba(124, 92, 255, 0.1);
        }

        .prompt-box {
          width: 100%;
          min-height: 155px;
          resize: vertical;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.04);
          color: white;
          padding: 13px;
          outline: none;
          line-height: 1.55;
          font-size: 13px;
        }

        .prompt-box::placeholder {
          color: #666;
        }

        .prompt-box:focus {
          border-color: rgba(124, 92, 255, 0.7);
          box-shadow: 0 0 0 3px rgba(124, 92, 255, 0.1);
        }

        .generate-button {
          width: 100%;
          height: 47px;
          border: 0;
          border-radius: 12px;
          color: white;
          font-weight: 800;
          background: linear-gradient(135deg, #7657ff, #4f46e5);
          box-shadow:
            0 12px 30px rgba(79, 70, 229, 0.25),
            inset 0 1px rgba(255, 255, 255, 0.2);
          transition: 0.2s ease;
        }

        .generate-button:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow:
            0 15px 35px rgba(79, 70, 229, 0.35),
            inset 0 1px rgba(255, 255, 255, 0.2);
        }

        .generate-button:disabled {
          opacity: 0.6;
          cursor: wait;
        }

        .templates-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .template-card {
          text-align: left;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.035);
          color: white;
          border-radius: 12px;
          padding: 12px;
          min-height: 92px;
          transition: 0.2s ease;
        }

        .template-card:hover {
          transform: translateY(-1px);
          background: rgba(255, 255, 255, 0.07);
          border-color: rgba(124, 92, 255, 0.35);
        }

        .template-icon {
          font-size: 20px;
          margin-bottom: 8px;
        }

        .template-name {
          font-size: 12px;
          font-weight: 800;
        }

        .template-description {
          margin-top: 4px;
          font-size: 10px;
          color: #777;
          line-height: 1.4;
        }

        .error-box {
          border: 1px solid rgba(255, 70, 70, 0.3);
          background: rgba(255, 50, 50, 0.07);
          color: #ff9d9d;
          border-radius: 11px;
          padding: 11px;
          font-size: 12px;
          line-height: 1.5;
          margin-bottom: 14px;
        }

        .saved-projects {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .saved-project {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.035);
          border-radius: 11px;
          padding: 10px;
        }

        .saved-project-info {
          min-width: 0;
          flex: 1;
          cursor: pointer;
        }

        .saved-project-name {
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .saved-project-date {
          color: #666;
          font-size: 10px;
          margin-top: 3px;
        }

        .delete-project {
          border: 0;
          background: transparent;
          color: #777;
          padding: 6px;
        }

        .delete-project:hover {
          color: #ff7373;
        }

        .workspace {
          min-width: 0;
          display: flex;
          flex-direction: column;
          background: #0a0a0a;
        }

        .workspace-toolbar {
          height: 58px;
          padding: 0 15px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          background: rgba(10, 10, 10, 0.8);
        }

        .toolbar-left,
        .toolbar-right {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .tab-button {
          height: 34px;
          padding: 0 12px;
          border-radius: 8px;
          border: 1px solid transparent;
          background: transparent;
          color: #777;
          font-size: 12px;
          font-weight: 700;
        }

        .tab-button.active {
          color: white;
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.08);
        }

        .device-button {
          width: 34px;
          height: 34px;
          border: 1px solid transparent;
          background: transparent;
          color: #666;
          border-radius: 8px;
        }

        .device-button:hover,
        .device-button.active {
          color: white;
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.08);
        }

        .divider {
          width: 1px;
          height: 22px;
          background: rgba(255, 255, 255, 0.08);
          margin: 0 4px;
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
              rgba(255, 255, 255, 0.025),
              transparent 50%
            ),
            #101010;
        }

        .preview-frame {
          width: var(--preview-width);
          max-width: 100%;
          height: calc(100vh - 180px);
          min-height: 500px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 13px;
          overflow: hidden;
          background: white;
          box-shadow: 0 25px 70px rgba(0, 0, 0, 0.45);
          transition: width 0.25s ease;
        }

        .preview-frame iframe {
          width: 100%;
          height: 100%;
          border: 0;
          display: block;
          background: white;
        }

        .empty-preview {
          width: 100%;
          height: 100%;
          min-height: 500px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          color: #666;
        }

        .empty-preview-inner {
          max-width: 450px;
        }

        .empty-icon {
          width: 62px;
          height: 62px;
          border-radius: 18px;
          margin: 0 auto 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(124, 92, 255, 0.1);
          border: 1px solid rgba(124, 92, 255, 0.2);
          font-size: 28px;
        }

        .empty-title {
          color: #ddd;
          font-size: 20px;
          font-weight: 800;
          margin-bottom: 8px;
        }

        .empty-description {
          color: #666;
          font-size: 13px;
          line-height: 1.6;
        }

        .code-container {
          flex: 1;
          min-height: 0;
          overflow: auto;
          padding: 20px;
          background: #080808;
        }

        .code-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }

        .code-title {
          color: #999;
          font-size: 12px;
          font-weight: 700;
        }

        .code-area {
          margin: 0;
          min-height: calc(100vh - 170px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          background: #050505;
          color: #d7d7d7;
          padding: 18px;
          overflow: auto;
          font-family:
            "SFMono-Regular",
            Consolas,
            "Liberation Mono",
            monospace;
          font-size: 12px;
          line-height: 1.6;
          white-space: pre;
        }

        .fullscreen-overlay {
          position: fixed;
          inset: 0;
          z-index: 999;
          background: #080808;
          display: flex;
          flex-direction: column;
        }

        .fullscreen-toolbar {
          height: 55px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .fullscreen-title {
          font-size: 13px;
          font-weight: 800;
        }

        .fullscreen-preview {
          flex: 1;
          background: white;
        }

        .fullscreen-preview iframe {
          width: 100%;
          height: 100%;
          border: 0;
        }

        .loading-overlay {
          position: fixed;
          inset: 0;
          z-index: 900;
          background: rgba(0, 0, 0, 0.55);
          backdrop-filter: blur(5px);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .loading-card {
          width: min(390px, calc(100vw - 30px));
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: #101010;
          border-radius: 18px;
          padding: 26px;
          text-align: center;
          box-shadow: 0 25px 80px rgba(0, 0, 0, 0.5);
        }

        .spinner {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          border: 3px solid rgba(255, 255, 255, 0.12);
          border-top-color: #7c5cff;
          margin: 0 auto 17px;
          animation: spin 0.8s linear infinite;
        }

        .loading-title {
          font-weight: 800;
          margin-bottom: 5px;
        }

        .loading-text {
          color: #777;
          font-size: 12px;
          line-height: 1.5;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 900px) {
          .builder-layout {
            grid-template-columns: 320px minmax(0, 1fr);
          }

          .control-panel {
            padding: 15px;
          }

          .preview-area {
            padding: 15px;
          }
        }

        @media (max-width: 720px) {
          .builder-header {
            padding: 0 12px;
          }

          .brand-subtitle {
            display: none;
          }

          .builder-layout {
            grid-template-columns: 1fr;
          }

          .control-panel {
            border-right: 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            max-height: none;
          }

          .workspace {
            min-height: 650px;
          }

          .preview-frame {
            height: 600px;
          }

          .header-actions .secondary-button {
            display: none;
          }

          .workspace-toolbar {
            overflow-x: auto;
          }

          .toolbar-right {
            flex-shrink: 0;
          }
        }
      `}</style>

      <div className="builder-shell">
        <header className="builder-header">
          <div className="brand-area">
            <div className="brand-icon">K</div>

            <div>
              <div className="brand-title">Kairo Website Builder</div>
              <div className="brand-subtitle">
                Build websites with Kairo AI
              </div>
            </div>
          </div>

          <div className="header-actions">
            <button
              className="secondary-button"
              onClick={() => setShowProjects((value) => !value)}
            >
              📁 Projects
            </button>

            <button
              className="secondary-button"
              onClick={saveProject}
              disabled={!html}
            >
              💾 Save
            </button>

            <button
              className="secondary-button"
              onClick={exportHtml}
              disabled={!html}
            >
              ↓ Export
            </button>
          </div>
        </header>

        <div className="builder-layout">
          <aside className="control-panel">
            {showProjects && (
              <section className="panel-section">
                <div className="section-label">
                  Saved Projects
                </div>

                {savedProjects.length === 0 ? (
                  <div
                    style={{
                      color: "#666",
                      fontSize: 12,
                      padding: "10px 0",
                    }}
                  >
                    Abhi koi saved project nahi hai.
                  </div>
                ) : (
                  <div className="saved-projects">
                    {savedProjects.map((project) => (
                      <div
                        className="saved-project"
                        key={project.id}
                      >
                        <div
                          className="saved-project-info"
                          onClick={() => loadProject(project)}
                        >
                          <div className="saved-project-name">
                            {project.name}
                          </div>

                          <div className="saved-project-date">
                            {new Date(
                              project.createdAt
                            ).toLocaleDateString()}
                          </div>
                        </div>

                        <button
                          className="delete-project"
                          onClick={() =>
                            deleteProject(project.id)
                          }
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            <section className="panel-section">
              <div className="section-label">
                Project Name
              </div>

              <input
                className="project-input"
                value={projectName}
                onChange={(event) =>
                  setProjectName(event.target.value)
                }
                placeholder="My Website"
              />
            </section>

            <section className="panel-section">
              <div className="section-label">
                Describe your website
              </div>

              <textarea
                className="prompt-box"
                value={prompt}
                onChange={(event) =>
                  setPrompt(event.target.value)
                }
                placeholder="Example: Create a modern dark portfolio website for a developer with hero, projects, skills, testimonials and contact section..."
              />

              <div style={{ height: 10 }} />

              {error && (
                <div className="error-box">
                  {error}
                </div>
              )}

              <button
                className="generate-button"
                onClick={() => generateWebsite()}
                disabled={loading}
              >
                {loading
                  ? "✨ Kairo is building..."
                  : "✨ Generate Website"}
              </button>
            </section>

            <section className="panel-section">
              <div className="section-label">
                Start with a template
              </div>

              <div className="templates-grid">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    className="template-card"
                    onClick={() => {
                      selectTemplate(template);
                    }}
                  >
                    <div className="template-icon">
                      {template.icon}
                    </div>

                    <div className="template-name">
                      {template.name}
                    </div>

                    <div className="template-description">
                      {template.description}
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section
              className="panel-section"
              style={{
                borderTop:
                  "1px solid rgba(255,255,255,0.07)",
                paddingTop: 18,
              }}
            >
              <div className="section-label">
                AI Builder
              </div>

              <div
                style={{
                  color: "#777",
                  fontSize: 11,
                  lineHeight: 1.6,
                }}
              >
                Gemini AI tumhare prompt ko complete
                responsive HTML, CSS aur JavaScript website
                mein convert karega.
              </div>
            </section>
          </aside>

          <section className="workspace">
            <div className="workspace-toolbar">
              <div className="toolbar-left">
                <button
                  className={`tab-button ${
                    activeTab === "preview" ? "active" : ""
                  }`}
                  onClick={() => setActiveTab("preview")}
                >
                  ◉ Preview
                </button>

                <button
                  className={`tab-button ${
                    activeTab === "code" ? "active" : ""
                  }`}
                  onClick={() => setActiveTab("code")}
                >
                  {"</>"} Code
                </button>
              </div>

              <div className="toolbar-right">
                {activeTab === "preview" && (
                  <>
                    <button
                      className={`device-button ${
                        device === "desktop"
                          ? "active"
                          : ""
                      }`}
                      onClick={() =>
                        setDevice("desktop")
                      }
                      title="Desktop"
                    >
                      🖥
                    </button>

                    <button
                      className={`device-button ${
                        device === "tablet"
                          ? "active"
                          : ""
                      }`}
                      onClick={() =>
                        setDevice("tablet")
                      }
                      title="Tablet"
                    >
                      ▣
                    </button>

                    <button
                      className={`device-button ${
                        device === "mobile"
                          ? "active"
                          : ""
                      }`}
                      onClick={() =>
                        setDevice("mobile")
                      }
                      title="Mobile"
                    >
                      📱
                    </button>

                    <div className="divider" />
                  </>
                )}

                <button
                  className="icon-button"
                  onClick={undo}
                  disabled={
                    historyIndex <= 0
                  }
                  title="Undo"
                >
                  ↶
                </button>

                <button
                  className="icon-button"
                  onClick={redo}
                  disabled={
                    historyIndex < 0 ||
                    historyIndex >=
                      history.length - 1
                  }
                  title="Redo"
                >
                  ↷
                </button>

                <button
                  className="icon-button"
                  onClick={refreshPreview}
                  disabled={!html}
                  title="Refresh"
                >
                  ↻
                </button>

                <div className="divider" />

                <button
                  className="icon-button"
                  onClick={copyCode}
                  disabled={!html}
                  title="Copy code"
                >
                  {copied ? "✓" : "⧉"}
                </button>

                <button
                  className="icon-button"
                  onClick={openFullscreen}
                  disabled={!html}
                  title="Fullscreen"
                >
                  ⛶
                </button>
              </div>
            </div>

            {activeTab === "preview" ? (
              <div className="preview-area">
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
                      title="Kairo Website Preview"
                      srcDoc={html}
                      sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin"
                    />
                  </div>
                ) : (
                  <div className="empty-preview">
                    <div className="empty-preview-inner">
                      <div className="empty-icon">
                        ✨
                      </div>

                      <div className="empty-title">
                        Your website starts here
                      </div>

                      <div className="empty-description">
                        Left side mein apna idea likho aur
                        <br />
                        <strong>
                          Generate Website
                        </strong>{" "}
                        par click karo.
                        <br />
                        Kairo AI tumhare liye complete
                        website generate karega.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="code-container">
                <div className="code-header">
                  <div className="code-title">
                    Generated HTML
                  </div>

                  <button
                    className="secondary-button"
                    onClick={copyCode}
                    disabled={!html}
                  >
                    {copied
                      ? "✓ Copied"
                      : "Copy Code"}
                  </button>
                </div>

                <pre className="code-area">
                  {html ||
                    "Generate a website to see the source code here..."}
                </pre>
              </div>
            )}
          </section>
        </div>
      </div>

      {fullscreen && html && (
        <div className="fullscreen-overlay">
          <div className="fullscreen-toolbar">
            <div className="fullscreen-title">
              {projectName}
            </div>

            <button
              className="secondary-button"
              onClick={closeFullscreen}
            >
              ✕ Close
            </button>
          </div>

          <div className="fullscreen-preview">
            <iframe
              title="Fullscreen Website Preview"
              srcDoc={html}
              sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin"
            />
          </div>
        </div>
      )}

      {loading && (
        <div className="loading-overlay">
          <div className="loading-card">
            <div className="spinner" />

            <div className="loading-title">
              Kairo AI is building your website
            </div>

            <div className="loading-text">
              Kairo Ai, HTML, CSS aur JavaScript
              generate kar raha hai. Thoda time lag sakta
              hai...
            </div>
          </div>
        </div>
      )}
    </main>
  );
}