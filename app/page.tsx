"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  ChangeEvent,
  KeyboardEvent,
} from "react";
import { createClient } from "@/lib/supabase";

/* =========================================================
   ZUQEN AI — MAIN WORKSPACE
   Existing Supabase tables:
   - chats
   - feature_credit_balances
   Existing API:
   - POST /api/chat
========================================================= */

type Role = "user" | "assistant";

type User = {
  id: string;
  email?: string | null;
  is_anonymous?: boolean;
};

type Attachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
  extractedText?: string;
};

type Message = {
  id: string;
  role: Role;
  content: string;
  created_at: string;
  attachments?: Attachment[];
};

type Chat = {
  id: string;
  user_id: string;
  title: string;
  archived: boolean;
  messages?: Message[] | null;
  created_at: string;
  updated_at: string;
};

type CreditRow = {
  feature_key: string;
  balance: number;
  total_granted: number;
  total_used: number;
};

type Agent = {
  name: string;
  description: string;
  icon: string;
  route: string | null;
};

const supabase = createClient();

const AGENTS: Agent[] = [
  {
    name: "ZUQEN AI",
    description: "Think, explore and solve problems",
    icon: "✳",
    route: null,
  },
  {
    name: "Website Builder",
    description: "Build complete websites",
    icon: "⌘",
    route: "/website-builder",
  },
  {
    name: "Text to Video",
    description: "Bring ideas into motion",
    icon: "▶",
    route: "/video-generator",
  },
  {
    name: "Voice Generator",
    description: "Turn words into natural voice",
    icon: "◖",
    route: "/generate-voice",
  },
];

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  const now = new Date();

  if (Number.isNaN(date.getTime())) return "";

  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString([], {
    day: "numeric",
    month: "short",
  });
}

function formatFileSize(size: number) {
  if (!size) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(size) / Math.log(1024)),
    units.length - 1
  );

  return `${(size / Math.pow(1024, index)).toFixed(
    index === 0 ? 0 : 1
  )} ${units[index]}`;
}

/* Custom SVG icons avoid an extra icon-library dependency. */

function Icon({
  name,
  size = 18,
}: {
  name: string;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  const paths: Record<string, React.ReactNode> = {
    plus: <path d="M12 5v14M5 12h14" />,
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    menu: (
      <>
        <circle cx="5" cy="12" r="1" fill="currentColor" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
        <circle cx="19" cy="12" r="1" fill="currentColor" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    chevron: <path d="m6 9 6 6 6-6" />,
    send: (
      <>
        <path d="m22 2-7 20-4-9-9-4Z" />
        <path d="M22 2 11 13" />
      </>
    ),
    paperclip: (
      <path d="m21.4 11.6-8.9 8.9a6 6 0 0 1-8.5-8.5l9.6-9.6a4 4 0 0 1 5.7 5.7l-9.7 9.6a2 2 0 0 1-2.8-2.8l8.8-8.8" />
    ),
    copy: (
      <>
        <rect x="9" y="9" width="11" height="11" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </>
    ),
    edit: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
      </>
    ),
    archive: (
      <>
        <path d="M4 7h16M5 7v12h14V7" />
        <path d="M3 4h18v3H3zM9 11h6" />
      </>
    ),
    restore: (
      <>
        <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
        <path d="M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" />
      </>
    ),
    trash: (
      <>
        <path d="M4 7h16M10 11v6M14 11v6" />
        <path d="M6 7l1 14h10l1-14M9 7V4h6v3" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 11a8 8 0 0 0-14.9-4L4 9" />
        <path d="M4 4v5h5M4 13a8 8 0 0 0 14.9 4L20 15" />
        <path d="M20 20v-5h-5" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" />
      </>
    ),
    moon: (
      <path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z" />
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20a7 7 0 0 1 14 0" />
      </>
    ),
    logout: (
      <>
        <path d="M10 17l5-5-5-5M15 12H3M21 3v18" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    spark: (
      <>
        <path d="m12 3-1.4 5.6L5 10l5.6 1.4L12 17l1.4-5.6L19 10l-5.6-1.4Z" />
        <path d="m19 16-.7 2.3L16 19l2.3.7L19 22l.7-2.3L22 19l-2.3-.7Z" />
      </>
    ),
    volume: (
      <>
        <path d="M11 5 6 9H3v6h3l5 4Z" />
        <path d="M15 9a5 5 0 0 1 0 6" />
        <path d="M18 5.5a9 9 0 0 1 0 13" />
      </>
    ),
    stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
    share: (
      <>
        <path d="M12 16V4" />
        <path d="m7 9 5-5 5 5" />
        <path d="M5 12v7h14v-7" />
      </>
    ),
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  };

  return <svg {...common}>{paths[name] ?? paths.spark}</svg>;
}

/* A lightweight code renderer with a real HTML preview. */

function CodePanel({
  code,
  language,
}: {
  code: string;
  language: string;
}) {
  const [view, setView] = useState<"code" | "preview">("code");
  const [copied, setCopied] = useState(false);

  const normalizedLanguage = language.toLowerCase();
  const supportsPreview =
    normalizedLanguage === "html" ||
    normalizedLanguage === "htm" ||
    normalizedLanguage === "html5";

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="z-code-panel">
      <div className="z-code-head">
        <div className="z-code-file">
          <span className="z-code-file-dot" />
          <span>{language || "code"}</span>
        </div>

        <div className="z-code-controls">
          {supportsPreview && (
            <div className="z-code-tabs">
              <button
                type="button"
                className={view === "code" ? "active" : ""}
                onClick={() => setView("code")}
              >
                Code
              </button>
              <button
                type="button"
                className={view === "preview" ? "active" : ""}
                onClick={() => setView("preview")}
              >
                Preview
              </button>
            </div>
          )}

          <button
            type="button"
            className="z-code-copy"
            onClick={copyCode}
            title="Copy code"
          >
            <Icon name="copy" size={13} />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      {view === "preview" && supportsPreview ? (
        <iframe
          className="z-code-preview"
          title="HTML code preview"
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          srcDoc={code}
        />
      ) : (
        <pre className="z-code-body">
          <code>{code}</code>
        </pre>
      )}
    </section>
  );
}

/* Displays fenced code blocks without requiring a markdown package. */

function MessageContent({ content }: { content: string }) {
  const imageRegex =
    /!\[([^\]]*)\]\(((?:https?:\/\/[^\s)]+)|(?:data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+))\)/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let imageIndex = 0;
  let match: RegExpExecArray | null;

  const renderTextWithCode = (
    text: string,
    keyPrefix: string
  ) => {
    if (!text) return;

    const chunks = text.split(
      /```([^\n`]*)\n([\s\S]*?)```/g
    );

    for (let index = 0; index < chunks.length; ) {
      if (index % 3 === 0) {
        const plainText = chunks[index];

        if (plainText) {
          parts.push(
            <div
              className="z-message-text"
              key={`${keyPrefix}-text-${index}`}
            >
              {plainText}
            </div>
          );
        }

        index += 1;
      } else {
        const language = chunks[index] || "code";
        const code = chunks[index + 1] || "";

        parts.push(
          <CodePanel
            key={`${keyPrefix}-code-${index}`}
            code={code.replace(/\n$/, "")}
            language={language.trim()}
          />
        );

        index += 2;
      }
    }
  };

  while ((match = imageRegex.exec(content)) !== null) {
    const textBeforeImage = content.slice(
      lastIndex,
      match.index
    );

    renderTextWithCode(
      textBeforeImage,
      `before-image-${imageIndex}`
    );

    const alt = match[1] || "Generated image";
    const src = match[2];

    parts.push(
      <GeneratedImage
        key={`generated-image-${imageIndex}`}
        src={src}
        alt={alt}
      />
    );

    lastIndex = imageRegex.lastIndex;
    imageIndex += 1;
  }

  const remainingText = content.slice(lastIndex);

  renderTextWithCode(
    remainingText,
    `after-image-${imageIndex}`
  );

  if (parts.length === 0) {
    return (
      <div className="z-message-text">
        {content}
      </div>
    );
  }

  return (
    <div className="z-message-content">
      {parts}
    </div>
  );
}

   



function GeneratedImage({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  const [open, setOpen] = useState(false);

  const downloadImage = () => {
    const link = document.createElement("a");
    link.href = src;
    link.download = `zuqen-generated-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <>
      <div
        className="zuqen-generated-image"
        onClick={() => setOpen(true)}
        title="Open image"
      >
        <img src={src} alt={alt} loading="lazy" />
      </div>

      {open && (
        <div
          className="zuqen-image-viewer"
          role="dialog"
          aria-modal="true"
          aria-label="Generated image viewer"
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            className="zuqen-image-close"
            onClick={(event) => {
              event.stopPropagation();
              setOpen(false);
            }}
            aria-label="Close image"
          >
            ×
          </button>

          <img
            src={src}
            alt={alt}
            className="zuqen-image-viewer-image"
            onClick={(event) => event.stopPropagation()}
          />

          <button
            type="button"
            className="zuqen-image-download"
            onClick={(event) => {
              event.stopPropagation();
              downloadImage();
            }}
          >
            ↓ Download
          </button>
        </div>
      )}
    </>
  );
}

function FlappyBirdGame({
  initialScore,
  onClose,
  onScoreChange,
}: {
  initialScore: number;
  onClose: () => void;
  onScoreChange: (score: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scoreRef = useRef(initialScore);
  const [score, setScore] = useState(initialScore);
  const [gameOver, setGameOver] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = 520;
    const height = 620;
    const ground = 555;
    canvas.width = width;
    canvas.height = height;

    let raf = 0;
    let running = true;
    let gameFinished = false;
    let last = performance.now();
    let birdY = 275;
    let velocity = 0;
    let spawnTimer = 0;
    let pipes: Array<{ x: number; gapY: number; passed: boolean }> = [];

    const flap = () => {
      if (!running || gameFinished) return;
      velocity = -430;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space" || event.code === "ArrowUp") {
        event.preventDefault();
        flap();
      }
      if (event.code === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    canvas.addEventListener("pointerdown", flap);

    const resetGame = () => {
      running = true;
      setGameOver(false);
      birdY = 275;
      velocity = 0;
      spawnTimer = 0;
      pipes = [];
      last = performance.now();
    };

    const draw = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.035);
      last = now;

      ctx.clearRect(0, 0, width, height);

      const sky = ctx.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, "#d9e9f4");
      sky.addColorStop(0.72, "#f6ead6");
      sky.addColorStop(0.72, "#d8bd8e");
      sky.addColorStop(1, "#b98d5f");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = "rgba(255,255,255,.55)";
      ctx.beginPath();
      ctx.arc(95, 105, 32, 0, Math.PI * 2);
      ctx.arc(125, 105, 24, 0, Math.PI * 2);
      ctx.arc(150, 105, 30, 0, Math.PI * 2);
      ctx.fill();

      if (running && !gameFinished) {
        velocity += 1050 * dt;
        birdY += velocity * dt;

        spawnTimer += dt;
        if (spawnTimer >= 1.55) {
          spawnTimer = 0;
          const gapY = 150 + Math.random() * 250;
          pipes.push({ x: width + 35, gapY, passed: false });
        }

        for (const pipe of pipes) {
          pipe.x -= 205 * dt;

          if (!pipe.passed && pipe.x + 58 < 86) {
            pipe.passed = true;
            scoreRef.current += 1;
            setScore(scoreRef.current);
            onScoreChange(scoreRef.current);
          }
        }

        pipes = pipes.filter((pipe) => pipe.x > -90);

        const birdLeft = 72;
        const birdRight = 100;
        const birdTop = birdY - 15;
        const birdBottom = birdY + 15;

        const hitPipe = pipes.some((pipe) => {
          const pipeLeft = pipe.x;
          const pipeRight = pipe.x + 58;
          const gapTop = pipe.gapY - 62;
          const gapBottom = pipe.gapY + 62;
          const horizontal = birdRight > pipeLeft && birdLeft < pipeRight;
          const vertical = birdTop < gapTop || birdBottom > gapBottom;
          return horizontal && vertical;
        });

        if (birdTop < 0 || birdBottom > ground || hitPipe) {
          running = false;
          gameFinished = true;
          setGameOver(true);
        }
      }

      for (const pipe of pipes) {
        const gapTop = pipe.gapY - 62;
        const gapBottom = pipe.gapY + 62;
        ctx.fillStyle = "#587b57";
        ctx.fillRect(pipe.x, 0, 58, gapTop);
        ctx.fillRect(pipe.x, gapBottom, 58, ground - gapBottom);
        ctx.fillStyle = "#78996c";
        ctx.fillRect(pipe.x - 6, gapTop - 18, 70, 18);
        ctx.fillRect(pipe.x - 6, gapBottom, 70, 18);
      }

      ctx.fillStyle = "#e2b84c";
      ctx.beginPath();
      ctx.ellipse(86, birdY, 17, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f4d46e";
      ctx.beginPath();
      ctx.ellipse(80, birdY + 5, 10, 7, -0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(92, birdY - 7, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#222";
      ctx.beginPath();
      ctx.arc(94, birdY - 7, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#d8794b";
      ctx.beginPath();
      ctx.moveTo(101, birdY);
      ctx.lineTo(116, birdY + 5);
      ctx.lineTo(101, birdY + 9);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#6e5339";
      ctx.fillRect(0, ground, width, height - ground);

      ctx.fillStyle = "rgba(255,255,255,.9)";
      ctx.font = "800 22px Manrope, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Score ${scoreRef.current}`, width / 2, 42);

      if (!gameOver) {
        ctx.fillStyle = "rgba(30,35,28,.58)";
        ctx.font = "600 12px DM Sans, sans-serif";
        ctx.fillText("Click / Space / ↑ to flap", width / 2, 70);
      } else {
        ctx.fillStyle = "rgba(25,28,24,.78)";
        ctx.fillRect(95, 220, 330, 145);
        ctx.fillStyle = "#fffaf3";
        ctx.font = "800 25px Manrope, sans-serif";
        ctx.fillText("Game over", width / 2, 262);
        ctx.font = "600 14px DM Sans, sans-serif";
        ctx.fillText(`Score: ${scoreRef.current}`, width / 2, 292);
        ctx.fillStyle = "#d8794b";
        ctx.fillText("Click Restart to play again", width / 2, 326);
      }

      if (running && !gameFinished) raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", flap);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div className="zuqen-game-overlay">
      <div className="zuqen-game-card">
        <div className="zuqen-game-head">
          <div>
            <div className="zuqen-game-eyebrow">ZUQEN ARCADE</div>
            <h2>Flappy Bird</h2>
            <p>Pass 10 pipes to earn 10 score. 10 score = 1 Chat credit.</p>
          </div>
          <button type="button" className="zuqen-game-close" onClick={onClose}>
            ×
          </button>
        </div>
        <canvas ref={canvasRef} className="zuqen-game-canvas" />
        {gameOver && (
          <button
            type="button"
            className="zuqen-game-restart"
            onClick={onClose}
          >
            Close game
          </button>
        )}
        <div className="zuqen-game-footer">
          <span>Current score: <strong>{score}</strong></span>
          <span>Exchange from the credit menu anytime.</span>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");

  const [agentOpen, setAgentOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState("ZUQEN AI");
  const [selectedMode, setSelectedMode] = useState("Create");
  const [selectedModel, setSelectedModel] = useState("qwen/qwen3.8-27b");
  const [voiceListening, setVoiceListening] = useState(false);

  const [creditsOpen, setCreditsOpen] = useState(false);
  const [chatCredits, setChatCredits] = useState<number | null>(null);
  const [flappyScore, setFlappyScore] = useState(0);
  const [flappyOpen, setFlappyOpen] = useState(false);
  const [flappyLoading, setFlappyLoading] = useState(false);

  const [archivedOpen, setArchivedOpen] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [lightMode, setLightMode] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const streamAbortRef = useRef<AbortController | null>(null);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId) ?? null,
    [chats, activeChatId]
  );

  const visibleChats = useMemo(() => {
    const query = search.trim().toLowerCase();

    return chats.filter((chat) => {
      if (archivedOpen ? !chat.archived : chat.archived) {
        return false;
      }

      if (!query) return true;

      const titleMatches = chat.title.toLowerCase().includes(query);
      const messageMatches = (chat.messages ?? []).some((message) =>
        message.content.toLowerCase().includes(query)
      );

      return titleMatches || messageMatches;
    });
  }, [chats, search, archivedOpen]);

  const resetTextarea = useCallback(() => {
    const element = textareaRef.current;
    if (!element) return;

    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 220)}px`;
  }, []);

  const loadChats = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("chats")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("loadChats:", error);
      setErrorMessage(`Unable to load conversations: ${error.message}`);
      return;
    }

    setChats((data ?? []) as Chat[]);
  }, []);

  const loadChatCredits = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("feature_credit_balances")
      .select("feature_key,balance,total_granted,total_used")
      .eq("user_id", userId)
      .eq("feature_key", "chat")
      .maybeSingle();

    if (error) {
      console.error("loadChatCredits:", error);
      setChatCredits(null);
      return;
    }

    const row = data as CreditRow | null;
    setChatCredits(row ? Number(row.balance) : 0);
  }, []);

  const loadFlappyScore = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("zuqen_flappy_scores")
      .select("score")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("loadFlappyScore:", error);
      setFlappyScore(0);
      return;
    }

    setFlappyScore(Number(data?.score ?? 0));
  }, []);

  const persistFlappyScore = useCallback(async (score: number) => {
    if (!user?.id || user.is_anonymous) return;

    const { error } = await supabase
      .from("zuqen_flappy_scores")
      .upsert({
        user_id: user.id,
        score: Math.max(0, Math.floor(score)),
        updated_at: new Date().toISOString(),
      });

    if (error) console.error("persistFlappyScore:", error);
  }, [user]);

  const exchangeFlappyScore = async () => {
    if (!user?.id || user.is_anonymous) {
      setErrorMessage("Please sign in before exchanging Flappy Bird score.");
      return;
    }

    setFlappyLoading(true);
    try {
      const { data, error } = await supabase.rpc("exchange_flappy_score");
      if (error) throw error;

      if (!data?.success) {
        if (data?.error === "NOT_ENOUGH_SCORE") {
          setErrorMessage("You need at least 10 score to exchange for 1 Chat credit.");
        } else {
          setErrorMessage("Your Flappy Bird score could not be exchanged.");
        }
        return;
      }

      setFlappyScore((previous) =>
        Math.max(0, previous - Number(data.scoreUsed ?? 0))
      );
      await Promise.all([loadChatCredits(user.id), loadFlappyScore(user.id)]);
      setErrorMessage("");
    } catch (error) {
      console.error("exchangeFlappyScore:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to exchange Flappy Bird score."
      );
    } finally {
      setFlappyLoading(false);
    }
  };

  const initializeAuth = useCallback(async () => {
    try {
      setAuthReady(false);
      setErrorMessage("");

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error("getSession:", sessionError);
      }

      let currentUser = session?.user ?? null;

      if (!currentUser) {
        const {
          data: { user: existingUser },
          error: userError,
        } = await supabase.auth.getUser();

        if (!userError && existingUser) {
          currentUser = existingUser;
        }
      }

      if (!currentUser) {
        const {
          data: anonymousData,
          error: anonymousError,
        } = await supabase.auth.signInAnonymously();

        if (anonymousError || !anonymousData.user) {
          console.error("Anonymous sign-in:", anonymousError);
          setErrorMessage(
            anonymousError?.message ||
              "Unable to create a guest account. Please refresh and try again."
          );
          return;
        }

        if (anonymousData.session) {
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: anonymousData.session.access_token,
            refresh_token: anonymousData.session.refresh_token,
          });

          if (setSessionError) {
            console.error("Guest setSession:", setSessionError);
            setErrorMessage("Guest authentication could not be established.");
            return;
          }
        }

        const {
          data: { session: verifiedSession },
          error: verifiedError,
        } = await supabase.auth.getSession();

        if (verifiedError || !verifiedSession?.user) {
          setErrorMessage("Guest authentication could not be verified.");
          return;
        }

        currentUser = verifiedSession.user;
      }

      if (currentUser.is_anonymous) {
        const { error: creditError } = await supabase.rpc(
          "setup_guest_chat_credits"
        );

        if (creditError) {
          console.error("Guest credit setup:", creditError);
          setErrorMessage(
            "Guest Mode started, but Chat credits could not be set up. Please refresh."
          );
          return;
        }
      }

      setUser({
        id: currentUser.id,
        email: currentUser.email,
        is_anonymous: currentUser.is_anonymous,
      });

      await Promise.all([
        loadChats(currentUser.id),
        loadChatCredits(currentUser.id),
        loadFlappyScore(currentUser.id),
      ]);
    } catch (error) {
      console.error("initializeAuth:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to initialize ZUQEN AI."
      );
    } finally {
      setAuthReady(true);
    }
  }, [loadChats, loadChatCredits, loadFlappyScore]);

  useEffect(() => {
    let mounted = true;

    const start = async () => {
      if (mounted) await initializeAuth();
    };

    void start();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;

      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email,
          is_anonymous: session.user.is_anonymous,
        });

        await Promise.all([
          loadChats(session.user.id),
          loadChatCredits(session.user.id),
          loadFlappyScore(session.user.id),
        ]);

        return;
      }

      setUser(null);
      setChats([]);
      setMessages([]);
      setActiveChatId(null);
      setChatCredits(null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      streamAbortRef.current?.abort();
    };
  }, [initializeAuth, loadChats, loadChatCredits, loadFlappyScore]);

  useEffect(() => {
    const savedTheme = localStorage.getItem("zuqen-theme");
    if (savedTheme === "dark") setLightMode(false);
    if (savedTheme === "light") setLightMode(true);
  }, []);

  useEffect(() => {
    if (!shouldAutoScrollRef.current) return;

    const frame = window.requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [messages, loading, activeChatId]);

  const handleMessagesScroll = () => {
    const element = messagesContainerRef.current;
    if (!element) return;

    const distance =
      element.scrollHeight - element.scrollTop - element.clientHeight;
    const atBottom = distance < 140;

    shouldAutoScrollRef.current = atBottom;
    setShowJumpToLatest(!atBottom && messages.length > 0);
  };

  const jumpToLatest = () => {
    shouldAutoScrollRef.current = true;
    setShowJumpToLatest(false);
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  };

  const handleAuthNavigation = () => {
    window.location.href = "/auth";
  };

  const handleSignOut = async () => {
    if (signingOut) return;

    try {
      setSigningOut(true);
      setErrorMessage("");
      streamAbortRef.current?.abort();

      const { error } = await supabase.auth.signOut();

      if (error) {
        setErrorMessage(error.message || "Unable to sign out.");
        setSigningOut(false);
        return;
      }

      window.location.href = "/auth";
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to sign out."
      );
      setSigningOut(false);
    }
  };

  const selectChat = (chat: Chat) => {
    shouldAutoScrollRef.current = true;
    setShowJumpToLatest(false);
    setActiveChatId(chat.id);
    setMessages(Array.isArray(chat.messages) ? chat.messages : []);
    setMenuId(null);
    setRenamingId(null);
    setEditingId(null);
    setErrorMessage("");
    setWorkspaceMenuOpen(false);
    setSidebarOpen(false);
  };

  const createConversation = async (firstMessage?: string) => {
    if (!user?.id) {
      setErrorMessage("Your session is still loading. Please try again.");
      return null;
    }

    const now = new Date().toISOString();

    const payload = {
      user_id: user.id,
      title: firstMessage?.trim().slice(0, 55) || "New conversation",
      archived: false,
      messages: [],
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from("chats")
      .insert(payload)
      .select("*")
      .single();

    if (error || !data) {
      console.error("createConversation:", error);
      setErrorMessage(error?.message || "Unable to create a conversation.");
      return null;
    }

    const chat = data as Chat;
    setChats((previous) => [chat, ...previous]);
    setActiveChatId(chat.id);
    setMessages([]);
    return chat;
  };

  const saveMessages = async (
    chatId: string,
    nextMessages: Message[]
  ): Promise<boolean> => {
    if (!user?.id) {
      setErrorMessage("Your session is not available.");
      return false;
    }

    const updatedAt = new Date().toISOString();

    const { error } = await supabase
      .from("chats")
      .update({
        messages: nextMessages,
        updated_at: updatedAt,
      })
      .eq("id", chatId)
      .eq("user_id", user.id);

    if (error) {
      console.error("saveMessages:", error);
      setErrorMessage(`Unable to save conversation: ${error.message}`);
      return false;
    }

    setChats((previous) =>
      previous.map((chat) =>
        chat.id === chatId
          ? { ...chat, messages: nextMessages, updated_at: updatedAt }
          : chat
      )
    );

    return true;
  };

  const renameChat = async (chatId: string, title: string) => {
    const cleanTitle = title.trim().slice(0, 100);
    if (!cleanTitle || !user?.id) return;

    const { error } = await supabase
      .from("chats")
      .update({
        title: cleanTitle,
        updated_at: new Date().toISOString(),
      })
      .eq("id", chatId)
      .eq("user_id", user.id);

    if (error) {
      setErrorMessage(`Unable to rename chat: ${error.message}`);
      return;
    }

    setChats((previous) =>
      previous.map((chat) =>
        chat.id === chatId ? { ...chat, title: cleanTitle } : chat
      )
    );

    setRenamingId(null);
    setRenameValue("");
    setMenuId(null);
  };

  const archiveChat = async (chatId: string, archived: boolean) => {
    if (!user?.id) return;

    const { error } = await supabase
      .from("chats")
      .update({
        archived,
        updated_at: new Date().toISOString(),
      })
      .eq("id", chatId)
      .eq("user_id", user.id);

    if (error) {
      setErrorMessage(
        `Unable to ${archived ? "archive" : "restore"} chat: ${error.message}`
      );
      return;
    }

    setChats((previous) =>
      previous.map((chat) =>
        chat.id === chatId ? { ...chat, archived } : chat
      )
    );

    if (activeChatId === chatId && archived) {
      setActiveChatId(null);
      setMessages([]);
    }

    setMenuId(null);
  };

  const deleteChat = async (chatId: string) => {
    if (!user?.id) return;

    const confirmed = window.confirm(
      "Delete this conversation permanently? This cannot be undone."
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("chats")
      .delete()
      .eq("id", chatId)
      .eq("user_id", user.id);

    if (error) {
      setErrorMessage(`Unable to delete chat: ${error.message}`);
      return;
    }

    setChats((previous) => previous.filter((chat) => chat.id !== chatId));

    if (activeChatId === chatId) {
      setActiveChatId(null);
      setMessages([]);
    }

    setMenuId(null);
  };

  const parseStreamLine = (line: string): unknown => {
    if (!line.startsWith("data:")) return null;

    const raw = line.slice(5).trim();
    if (!raw || raw === "[DONE]") return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const extractText = (payload: any): string => {
    if (!payload) return "";
    if (typeof payload === "string") return payload;
    if (typeof payload.content === "string") return payload.content;
    if (typeof payload.delta === "string") return payload.delta;
    if (typeof payload.text === "string") return payload.text;

    if (
      payload.message &&
      typeof payload.message.content === "string"
    ) {
      return payload.message.content;
    }

    if (
      payload.choices?.[0]?.delta &&
      typeof payload.choices[0].delta.content === "string"
    ) {
      return payload.choices[0].delta.content;
    }

    if (
      payload.choices?.[0]?.message &&
      typeof payload.choices[0].message.content === "string"
    ) {
      return payload.choices[0].message.content;
    }

    return "";
  };

  /*
   * When baseMessages is supplied, the text is still appended as
   * a new user message. This fixes the old edit/regenerate bug.
   */
  const sendMessage = async (
    baseMessages?: Message[],
    textOverride?: string
  ) => {
    const rawText = (textOverride ?? input).trim();

    if (loading) return;
    if (!rawText && attachments.length === 0) return;

    if (!user?.id) {
      setErrorMessage("Your session is not ready yet. Please try again.");
      return;
    }

    const text =
      selectedMode !== "Create" && !textOverride
        ? `${selectedMode} mode: ${rawText}`
        : rawText;

    let chatId = activeChatId;
    let workingMessages = baseMessages ? [...baseMessages] : [...messages];

    if (!chatId) {
      const newChat = await createConversation(text);
      if (!newChat) return;

      chatId = newChat.id;
      workingMessages = [];
    }

    const currentAttachments = [...attachments];
    const storedAttachments = currentAttachments.map(({ id, name, type, size }) => ({ id, name, type, size }));

    const userMessage: Message = {
      id: makeId(),
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
      attachments: storedAttachments.length ? storedAttachments : undefined,
    };

    workingMessages = [...workingMessages, userMessage];

    setMessages(workingMessages);
    setInput("");
    setAttachments([]);
    setErrorMessage("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    const saved = await saveMessages(chatId, workingMessages);
    if (!saved) return;

    setLoading(true);
    shouldAutoScrollRef.current = true;

    const assistantId = makeId();

    const initialAssistant: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
    };

    setMessages([...workingMessages, initialAssistant]);

    const controller = new AbortController();
    streamAbortRef.current = controller;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          messages: workingMessages.map((message, index) => {
            if (index !== workingMessages.length - 1 || message.role !== "user" || currentAttachments.length === 0) {
              return { role: message.role, content: message.content };
            }

            const parts: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string; detail: "auto" } }> = [
              { type: "text", text: message.content },
            ];

            for (const file of currentAttachments) {
              if (file.dataUrl && file.type.startsWith("image/")) {
                parts.push({ type: "image_url", image_url: { url: file.dataUrl, detail: "auto" } });
              } else if (file.extractedText) {
                parts.push({ type: "text", text: `\n\n--- Attached text file: ${file.name} ---\n${file.extractedText}\n--- End of ${file.name} ---` });
              }
            }

            return { role: message.role, content: parts };
          }),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let message = `Chat request failed (${response.status})`;

        try {
          const data = await response.json();
          if (data?.error) message = data.error;
        } catch {
          // Response may not contain JSON.
        }

        throw new Error(message);
      }

      if (!response.body) {
        throw new Error("The AI response stream is unavailable.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = "";
      let assistantText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const payload = parseStreamLine(line) as any;
          if (!payload) continue;

          if (payload.error) throw new Error(payload.error);

          const chunk = extractText(payload);
          if (!chunk) continue;

          assistantText += chunk;

          setMessages((previous) =>
            previous.map((message) =>
              message.id === assistantId
                ? { ...message, content: assistantText }
                : message
            )
          );
        }
      }

      if (buffer.trim()) {
        const payload = parseStreamLine(buffer) as any;
        if (payload?.error) throw new Error(payload.error);

        const finalChunk = extractText(payload);
        if (finalChunk) assistantText += finalChunk;
      }

      if (!assistantText.trim()) {
        throw new Error("ZUQEN AI returned an empty response.");
      }

      const finalAssistant: Message = {
        ...initialAssistant,
        content: assistantText,
      };

      const finalMessages = [...workingMessages, finalAssistant];

      setMessages(finalMessages);
      await saveMessages(chatId, finalMessages);

      await Promise.all([
        loadChatCredits(user.id),
        loadChats(user.id),
      ]);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      console.error("sendMessage:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while chatting."
      );

      setMessages((previous) =>
        previous.filter((message) => message.id !== assistantId)
      );
    } finally {
      streamAbortRef.current = null;
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    void sendMessage();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const handleAttachment = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;

    const accepted: Attachment[] = [];
    const rejected: string[] = [];
    const textExtensions = /\.(txt|md|markdown|json|csv|tsv|html|htm|xml|yaml|yml|js|jsx|ts|tsx|css|scss|py|java|c|cpp|h|sql|log|svg)$/i;

    for (const file of files) {
      if (file.size > 12 * 1024 * 1024) {
        rejected.push(`${file.name}: maximum supported size is 12 MB`);
        continue;
      }

      const attachment: Attachment = {
        id: makeId(), name: file.name, type: file.type || "application/octet-stream", size: file.size,
      };

      if (["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
        const existingImageCount =
          accepted.filter((item) => item.type.startsWith("image/")).length +
          attachments.filter((item) => item.type.startsWith("image/")).length;

        if (existingImageCount >= 3) {
          rejected.push(file.name + ": a maximum of 3 images can be sent at once");
          continue;
        }

        let bitmap: ImageBitmap | null = null;

        try {
          bitmap = await createImageBitmap(file);

          const dimensions = [1280, 1120, 960, 800, 700];
          const qualities = [0.78, 0.70, 0.62, 0.54, 0.46];
          let compressedBlob: Blob | null = null;

          for (let attempt = 0; attempt < dimensions.length; attempt++) {
            const scale = Math.min(
              1,
              dimensions[attempt] / Math.max(bitmap.width, bitmap.height)
            );

            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(bitmap.width * scale));
            canvas.height = Math.max(1, Math.round(bitmap.height * scale));

            const context = canvas.getContext("2d");
            if (!context) throw new Error("Image canvas is unavailable");

            context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

            compressedBlob = await new Promise<Blob>((resolve, reject) => {
              canvas.toBlob(
                (blob) => {
                  if (blob) resolve(blob);
                  else reject(new Error("Image compression failed"));
                },
                "image/webp",
                qualities[attempt]
              );
            });

            if (compressedBlob.size <= 450 * 1024) break;
          }

          if (!compressedBlob) {
            throw new Error("Image compression failed");
          }

          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => {
              if (typeof reader.result === "string") resolve(reader.result);
              else reject(new Error("Unable to read compressed image"));
            };

            reader.onerror = () => reject(new Error("Unable to read image"));
            reader.readAsDataURL(compressedBlob);
          });

          const attachment: Attachment = {
            id: makeId(),
            name: file.name,
            type: "image/webp",
            size: compressedBlob.size,
            dataUrl,
          };

          accepted.push(attachment);
        } catch {
          rejected.push(file.name + ": unable to compress or read image");
        } finally {
          bitmap?.close();
        }

        continue;
      }
            if (file.type.startsWith("text/") || /application\/(json|xml|javascript)/i.test(file.type) || textExtensions.test(file.name)) {
        try {
          const content = await file.text();
          if (content.length > 100_000) {
            rejected.push(`${file.name}: text content exceeds 100,000 characters`);
            continue;
          }
          attachment.extractedText = content;
          accepted.push(attachment);
        } catch {
          rejected.push(`${file.name}: unable to read text content`);
        }
        continue;
      }

      rejected.push(`${file.name}: this format is not yet supported for AI content analysis. Use JPG, PNG, WEBP, GIF, or a text/code file.`);
    }

    if (accepted.length) setAttachments((previous) => [...previous, ...accepted]);
    if (rejected.length) setErrorMessage(rejected.join("\n"));
  };

  const removeAttachment = (id: string) => {
    setAttachments((previous) => previous.filter((item) => item.id !== id));
  };

  const copyMessage = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      setErrorMessage("Unable to copy message. Check clipboard permissions.");
    }
  };

  const readMessage = (content: string, messageId: string) => {
    if (
      !("speechSynthesis" in window) ||
      !("SpeechSynthesisUtterance" in window)
    ) {
      setErrorMessage("Message reading is not supported in this browser.");
      return;
    }

    if (speakingMessageId === messageId) {
      speechRef.current = null;
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      return;
    }

    window.speechSynthesis.cancel();
    speechRef.current = null;

    const utterance = new SpeechSynthesisUtterance(content);
    utterance.lang = "en-IN";
    utterance.rate = 1;

    speechRef.current = utterance;
    setSpeakingMessageId(messageId);

    const clearPlayback = () => {
      if (speechRef.current === utterance) {
        speechRef.current = null;
        setSpeakingMessageId(null);
      }
    };

    utterance.onend = clearPlayback;
    utterance.onerror = clearPlayback;

    window.speechSynthesis.speak(utterance);
  };
  const shareMessage = async (content: string) => {
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "ZUQEN AI message", text: content });
      } else {
        await navigator.clipboard.writeText(content);
        setErrorMessage("Share is not available here, so the message was copied instead.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(content);
        setErrorMessage("The share sheet was unavailable; message copied instead.");
      } catch {
        setErrorMessage("Unable to share or copy this message in this browser.");
      }
    }
  };

  const startEditMessage = (message: Message) => {
    setEditingId(message.id);
    setEditingValue(message.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingValue("");
  };

  const saveEditedMessage = async (messageId: string) => {
    const clean = editingValue.trim();

    if (!clean || !activeChatId || loading) return;

    const index = messages.findIndex((message) => message.id === messageId);
    if (index === -1 || messages[index].role !== "user") return;

    const baseMessages = messages.slice(0, index);

    setEditingId(null);
    setEditingValue("");

    const saved = await saveMessages(activeChatId, baseMessages);
    if (!saved) return;

    setMessages(baseMessages);
    await sendMessage(baseMessages, clean);
  };

  const regenerate = async () => {
    if (!activeChatId || loading) return;

    let lastUserIndex = -1;

    for (let index = messages.length - 1; index >= 0; index--) {
      if (messages[index].role === "user") {
        lastUserIndex = index;
        break;
      }
    }

    if (lastUserIndex < 0) return;

    const baseMessages = messages.slice(0, lastUserIndex);
    const lastUserMessage = messages[lastUserIndex];

    const saved = await saveMessages(activeChatId, baseMessages);
    if (!saved) return;

    setMessages(baseMessages);
    await sendMessage(baseMessages, lastUserMessage.content);
  };

  const startRename = (chat: Chat) => {
    setRenamingId(chat.id);
    setRenameValue(chat.title);
    setMenuId(null);
  };

  const startNewChat = () => {
    shouldAutoScrollRef.current = true;
    setShowJumpToLatest(false);
    setActiveChatId(null);
    setMessages([]);
    setInput("");
    setAttachments([]);
    setErrorMessage("");
    setEditingId(null);
    setRenamingId(null);
    setMenuId(null);
    setSidebarOpen(false);

    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const navigateAgent = (agent: Agent) => {
    setSelectedAgent(agent.name);
    setAgentOpen(false);
    setWorkspaceMenuOpen(false);

    if (agent.route) {
      window.location.href = agent.route;
    }
  };

  const toggleTheme = () => {
    setLightMode((previous) => {
      const next = !previous;
      localStorage.setItem("zuqen-theme", next ? "light" : "dark");
      return next;
    });
  };

  const startVoiceInput = () => {
    if (voiceListening) return;

    const SpeechRecognitionCtor =
      typeof window !== "undefined"
        ? (window as any).SpeechRecognition ||
          (window as any).webkitSpeechRecognition
        : null;

    if (!SpeechRecognitionCtor) {
      setErrorMessage(
        "Voice input is not supported in this browser. Try Chrome or type your message."
      );
      return;
    }

    try {
      const recognition = new SpeechRecognitionCtor();

      recognition.lang = "en-IN";
      recognition.interimResults = true;
      recognition.continuous = false;

      setVoiceListening(true);

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results as ArrayLike<any>)
          .map((result: any) => result[0]?.transcript || "")
          .join(" ");

        if (transcript) {
          setInput((previous) =>
            `${previous}${previous ? " " : ""}${transcript}`
          );
        }
      };

      recognition.onerror = () => {
        setVoiceListening(false);
        setErrorMessage("Voice input could not be captured. Please try again.");
      };

      recognition.onend = () => setVoiceListening(false);
      recognition.start();
    } catch (error) {
      setVoiceListening(false);
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to start voice input."
      );
    }
  };

  const accountLabel = user?.is_anonymous
    ? "Guest User"
    : user?.email || "ZUQEN Account";

  const accountStatus = user?.is_anonymous ? "Guest mode" : "Signed in";

  const suggestions = [
    {
      icon: "✎",
      title: "Write something",
      prompt: "Help me write a professional email",
    },
    {
      icon: "◎",
      title: "Learn anything",
      prompt: "Explain a difficult topic simply",
    },
    {
      icon: "✳",
      title: "Brainstorm ideas",
      prompt: "Give me creative ideas for my project",
    },
    {
      icon: "⌁",
      title: "Solve a problem",
      prompt: "Help me solve a technical problem",
    },
  ];

  return (
    <main className={`zuqen-app ${lightMode ? "light" : "dark"}`}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap');

        :root{color-scheme:light}
        *{box-sizing:border-box}
        html,body{margin:0;padding:0;min-height:100%;background:#f4f0e9}
        button,input,textarea{font:inherit}
        button{border:0}
        button:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid #d8794b;outline-offset:3px}
        .zuqen-app{
          --bg:#f4f0e9;--surface:#fffaf3;--surface-2:#eee6da;--surface-3:#e5dbce;
          --text:#282923;--muted:#756f64;--muted-2:#958b7d;--border:#ded5c8;
          --accent:#d8794b;--accent-strong:#b9653c;--accent-ink:#fffaf5;
          min-height:100dvh;height:100dvh;display:flex;overflow:hidden;color:var(--text);
          background:radial-gradient(ellipse at 77% -8%,rgba(223,184,149,.27),transparent 35%),var(--bg);
          font-family:'DM Sans',sans-serif
        }
        .zuqen-app.dark{
          color-scheme:dark;--bg:#20231f;--surface:#282b25;--surface-2:#33372f;--surface-3:#3c4037;
          --text:#f4f0e9;--muted:#c0b9ac;--muted-2:#989183;--border:#494a40;
          --accent:#d8794b;--accent-strong:#ef9a6d;--accent-ink:#fffaf5;
          background:radial-gradient(ellipse at 77% -8%,rgba(184,103,64,.12),transparent 35%),var(--bg)
        }
        .zuqen-sidebar{width:278px;flex:0 0 278px;display:flex;flex-direction:column;height:100dvh;
          background:rgba(255,250,243,.88);border-right:1px solid var(--border);backdrop-filter:blur(24px);
          transition:width .22s ease,flex-basis .22s ease;overflow:hidden;z-index:40}
        .dark .zuqen-sidebar{background:rgba(35,38,32,.96)}
        .zuqen-sidebar.closed{width:0;flex-basis:0;border:0}
        .zuqen-brand{height:82px;min-height:82px;padding:0 18px;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--border)}
        .zuqen-logo{width:43px;height:43px;flex:0 0 43px;border-radius:15px;background:#292c26;display:grid;place-items:center;position:relative;overflow:hidden}
        .zuqen-logo svg{width:30px;height:30px}
        .zuqen-logo-mark{width:23px;height:23px;position:relative;display:block}
        .zuqen-logo-mark:before{content:"";position:absolute;inset:2px 0;border:2px solid #f4a16f;border-radius:50%;transform:rotate(-35deg) scaleX(.72)}
        .zuqen-logo-mark:after{content:"";position:absolute;width:7px;height:7px;top:8px;left:8px;background:#f4a16f;border-radius:50%;box-shadow:0 0 12px rgba(244,161,111,.8)}
        .zuqen-brand-name{font:800 15px Manrope,sans-serif;letter-spacing:1.7px}
        .zuqen-brand-sub{margin-top:4px;font-size:10px;color:var(--muted);letter-spacing:.25px}
        .zuqen-sidebar-content{flex:1;min-height:0;overflow-y:auto;padding:15px 12px;display:flex;flex-direction:column;gap:18px}
        .zuqen-new-chat{height:45px;width:100%;padding:0 13px;display:flex;align-items:center;gap:10px;border-radius:12px;
          color:var(--accent-ink);background:var(--accent);font-size:12px;font-weight:700;cursor:pointer;transition:transform .16s,filter .16s}
        .zuqen-new-chat:hover{transform:translateY(-1px);filter:brightness(1.04)}
        .zuqen-sidebar-heading{display:flex;align-items:center;justify-content:space-between;height:31px;padding:0 8px;color:var(--muted-2);font-size:9px;font-weight:800;letter-spacing:1.35px;text-transform:uppercase}
        .zuqen-heading-actions{display:flex;gap:4px}
        .zuqen-heading-actions button{width:28px;height:28px;border-radius:8px;background:transparent;color:var(--muted);display:grid;place-items:center;cursor:pointer}
        .zuqen-heading-actions button:hover{background:var(--surface-2);color:var(--text)}
        .zuqen-chat-list{display:flex;flex-direction:column;gap:4px;margin-top:4px}
        .zuqen-chat-item{position:relative;display:flex;align-items:center;gap:6px;min-height:48px;padding:6px 7px 6px 11px;border:1px solid transparent;border-radius:11px;cursor:pointer;color:var(--muted);transition:background .16s}
        .zuqen-chat-item:hover{background:var(--surface-2);color:var(--text)}
        .zuqen-chat-item.active{background:#f0e2d5;border-color:#e5c6ae;color:#342e27}
        .dark .zuqen-chat-item.active{background:#42352c;border-color:#72503c;color:#fff1e4}
        .zuqen-chat-main{min-width:0;flex:1}
        .zuqen-chat-title{font-size:11px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .zuqen-chat-date{font-size:9px;color:var(--muted-2);margin-top:4px}
        .zuqen-chat-menu-button{width:29px;height:29px;flex:0 0 29px;border-radius:8px;background:transparent;color:var(--muted);display:grid;place-items:center;cursor:pointer;opacity:.5}
        .zuqen-chat-item:hover .zuqen-chat-menu-button,.zuqen-chat-menu-button.open{opacity:1}
        .zuqen-chat-menu-button:hover{background:var(--surface-3)}
        .zuqen-floating-menu,.zuqen-agent-dropdown,.zuqen-credit-dropdown,.zuqen-workspace-menu{
          position:absolute;background:var(--surface);border:1px solid var(--border);border-radius:14px;
          box-shadow:0 20px 60px rgba(32,27,21,.17);z-index:100;padding:6px
        }
        .zuqen-floating-menu{right:5px;top:39px;width:160px}
        .zuqen-menu-item{width:100%;display:flex;align-items:center;gap:9px;padding:10px;border-radius:9px;background:transparent;color:var(--text);text-align:left;font-size:11px;cursor:pointer}
        .zuqen-menu-item:hover{background:var(--surface-2)}
        .zuqen-menu-item.danger{color:#b7473b}
        .zuqen-rename{width:100%;min-width:0;padding:6px;border:1px solid var(--accent);border-radius:7px;background:var(--surface);color:var(--text);outline:none;font-size:11px}
        .zuqen-sidebar-bottom{padding:12px;border-top:1px solid var(--border)}
        .zuqen-sidebar-user{display:flex;align-items:center;gap:9px;padding:10px;border:1px solid var(--border);background:var(--surface);border-radius:12px}
        .zuqen-user-dot{width:34px;height:34px;flex:0 0 34px;border-radius:11px;display:grid;place-items:center;background:#30352e;color:#f4a16f;font-weight:800;font-size:12px}
        .zuqen-user-info{flex:1;min-width:0}
        .zuqen-user-name{font-size:10px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .zuqen-user-status{margin-top:4px;color:var(--muted-2);font-size:9px}
        .zuqen-auth-button{margin-top:9px;width:100%;height:37px;border:1px solid var(--border);border-radius:10px;background:transparent;color:var(--muted);display:flex;align-items:center;justify-content:center;gap:8px;font-size:10px;font-weight:700;cursor:pointer}
        .zuqen-auth-button:hover{background:var(--surface-2);color:var(--text)}
        .zuqen-auth-button.primary{background:var(--accent);color:white;border-color:var(--accent)}
        .zuqen-auth-button:disabled{opacity:.6;cursor:wait}
        .zuqen-main{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;position:relative}
        .zuqen-topbar{height:70px;min-height:70px;padding:0 24px;display:flex;align-items:center;justify-content:space-between;gap:12px;
          border-bottom:1px solid var(--border);background:rgba(255,250,243,.45);backdrop-filter:blur(18px);z-index:20}
        .dark .zuqen-topbar{background:rgba(32,35,31,.72)}
        .zuqen-top-left,.zuqen-top-right{display:flex;align-items:center;gap:9px;min-width:0}
        .zuqen-icon-button{width:37px;height:37px;flex:0 0 37px;display:grid;place-items:center;border:1px solid var(--border);border-radius:11px;background:var(--surface);color:var(--muted);cursor:pointer;transition:.16s}
        .zuqen-icon-button:hover{color:var(--text);border-color:#d5b69d;background:var(--surface-2)}
        .zuqen-agent-selector,.zuqen-credit-wrap,.zuqen-workspace-menu-wrap{position:relative}
        .zuqen-agent-button{display:flex;align-items:center;gap:10px;padding:7px 11px;border:1px solid var(--border);border-radius:12px;background:var(--surface);color:var(--text);cursor:pointer;text-align:left}
        .zuqen-agent-button-icon{width:29px;height:29px;display:grid;place-items:center;background:#f0ded0;color:#a85634;border-radius:9px;font-size:17px}
        .zuqen-agent-button-name{font-size:11px;font-weight:800}
        .zuqen-agent-button-sub{font-size:9px;color:var(--muted);margin-top:3px}
        .zuqen-agent-dropdown{top:47px;left:0;width:285px}
        .zuqen-agent-option{width:100%;display:flex;align-items:center;gap:11px;padding:11px;border-radius:10px;background:transparent;text-align:left;cursor:pointer;color:var(--text)}
        .zuqen-agent-option:hover,.zuqen-agent-option.selected{background:var(--surface-2)}
        .zuqen-agent-option-icon{width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:#f0ded0;color:#a85634;font-size:17px}
        .zuqen-agent-option-content{flex:1;min-width:0}
        .zuqen-agent-option-name{font-size:11px;font-weight:800}
        .zuqen-agent-option-description{margin-top:4px;color:var(--muted);font-size:9px}
        .zuqen-agent-check{color:var(--accent-strong)}
        .zuqen-credit-button{display:flex;align-items:center;gap:8px;padding:9px 12px;border:1px solid var(--border);border-radius:11px;background:var(--surface);color:var(--text);cursor:pointer}
        .zuqen-credit-icon{color:var(--accent-strong);font-size:17px}
        .zuqen-credit-count{font-size:12px;font-weight:800;font-variant-numeric:tabular-nums}
        .zuqen-credit-label{font-size:10px;color:var(--muted)}
        .zuqen-flappy-button{display:flex;align-items:center;gap:7px;padding:8px 10px;border:1px solid var(--border);border-radius:11px;background:var(--surface);color:var(--text);cursor:pointer;transition:.16s}
        .zuqen-flappy-button:hover{border-color:#d5b69d;background:var(--surface-2);transform:translateY(-1px)}
        .zuqen-flappy-bird{width:22px;height:22px;display:grid;place-items:center;border-radius:8px;background:#e2b84c;color:#fff;font-size:10px;box-shadow:0 2px 8px rgba(120,90,30,.18)}
        .zuqen-flappy-score{font-size:12px;font-weight:800;font-variant-numeric:tabular-nums}
        .zuqen-flappy-label{font-size:9px;color:var(--muted)}
        .zuqen-exchange-button{width:100%;margin-top:13px;padding:9px 10px;border-radius:9px;background:var(--accent);color:#fff;font-size:10px;font-weight:800;cursor:pointer}
        .zuqen-exchange-button:disabled{opacity:.4;cursor:not-allowed}
        .zuqen-generated-image{margin:12px 0;width:100%;max-width:720px;overflow:hidden;border-radius:16px;border:1px solid rgba(120,120,140,.18);background:rgba(0,0,0,.03);cursor:zoom-in}
        .zuqen-generated-image img{display:block;width:100%;height:auto;max-height:720px;object-fit:contain}
        .zuqen-image-viewer{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;padding:24px}
        .zuqen-image-viewer-image{max-width:92vw;max-height:86vh;object-fit:contain;border-radius:14px}
        .zuqen-image-close{position:fixed;top:20px;right:20px;width:42px;height:42px;border:1px solid rgba(255,255,255,.2);border-radius:12px;background:rgba(20,20,20,.72);color:#fff;font-size:25px;cursor:pointer;z-index:2}
        .zuqen-image-download{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:11px 18px;border:1px solid rgba(255,255,255,.2);border-radius:12px;background:#fff;color:#111;font-weight:800;cursor:pointer;z-index:2}
        .zuqen-game-overlay{position:fixed;inset:0;z-index:99998;display:grid;place-items:center;padding:20px;background:rgba(18,20,17,.58);backdrop-filter:blur(12px)}
        .zuqen-game-card{width:min(580px,96vw);max-height:96vh;overflow:auto;border:1px solid var(--border);border-radius:22px;background:var(--surface);box-shadow:0 30px 90px rgba(20,20,16,.28);padding:16px}
        .zuqen-game-head{display:flex;justify-content:space-between;gap:15px;align-items:flex-start;padding:4px 4px 13px}
        .zuqen-game-eyebrow{font-size:8px;font-weight:800;letter-spacing:1.5px;color:var(--accent)}
        .zuqen-game-head h2{margin:5px 0 4px;font:800 23px Manrope,sans-serif}
        .zuqen-game-head p{margin:0;color:var(--muted);font-size:10px;line-height:1.5}
        .zuqen-game-close{width:35px;height:35px;border-radius:10px;background:var(--surface-2);color:var(--text);font-size:22px;cursor:pointer}
        .zuqen-game-canvas{display:block;width:100%;max-width:520px;height:auto;margin:0 auto;border-radius:16px;touch-action:none;cursor:pointer}
        .zuqen-game-restart{display:block;margin:-55px auto 18px;position:relative;z-index:2;padding:10px 16px;border-radius:10px;background:var(--accent);color:#fff;font-weight:800;cursor:pointer}
        .zuqen-game-footer{display:flex;justify-content:space-between;gap:10px;margin-top:12px;padding:10px 4px 2px;color:var(--muted);font-size:9px}
        .zuqen-game-footer strong{color:var(--text)}
        .zuqen-credit-dropdown{top:46px;right:0;width:235px;padding:16px}
        .zuqen-credit-dropdown-title{font-size:11px;font-weight:800}
        .zuqen-credit-big{margin-top:15px;font:800 30px Manrope,sans-serif}
        .zuqen-credit-small{margin-top:4px;font-size:10px;color:var(--muted)}
        .zuqen-credit-line{height:1px;background:var(--border);margin:15px 0}
        .zuqen-credit-row{display:flex;justify-content:space-between;gap:12px;margin-top:10px;font-size:10px;color:var(--muted)}
        .zuqen-credit-row strong{color:var(--text)}
        .zuqen-workspace-menu{top:45px;left:0;width:250px}
        .zuqen-workspace-menu-title{padding:8px 10px 10px;font-size:9px;font-weight:800;letter-spacing:1.4px;color:var(--muted-2)}
        .zuqen-workspace-menu button{width:100%;display:flex;align-items:center;gap:10px;padding:11px 10px;border-radius:9px;background:transparent;color:var(--text);font-size:11px;text-align:left;cursor:pointer}
        .zuqen-workspace-menu button:hover{background:var(--surface-2)}
        .zuqen-workspace-menu button span{flex:1}
        .zuqen-search-overlay{position:absolute;top:79px;left:24px;right:24px;z-index:30;max-width:650px;margin:auto}
        .zuqen-search-input-wrap{display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid var(--border);border-radius:14px;background:var(--surface);box-shadow:0 15px 45px rgba(32,27,21,.1)}
        .zuqen-search-input-wrap input{flex:1;min-width:0;border:0;outline:none;background:transparent;color:var(--text);font-size:12px}
        .zuqen-search-input-wrap button{background:transparent;color:var(--muted);cursor:pointer}
        .zuqen-content{flex:1;min-height:0;display:flex;flex-direction:column;position:relative}
        .zuqen-error{margin:12px 20px 0;padding:11px 13px;display:flex;align-items:center;gap:10px;border:1px solid #e4b7aa;border-radius:11px;background:#fff0eb;color:#9c3e2e;font-size:11px}
        .zuqen-error button{display:grid;place-items:center;background:transparent;color:inherit;cursor:pointer}
        .zuqen-home{flex:1;min-height:0;overflow-y:auto;padding:36px 25px 42px}
        .zuqen-home-inner{width:min(950px,100%);margin:0 auto}
        .zuqen-welcome{text-align:center;margin:5px auto 24px;max-width:740px}
        .zuqen-eyebrow{display:inline-flex;align-items:center;gap:8px;padding:7px 11px;border:1px solid var(--border);border-radius:99px;background:var(--surface);color:var(--muted);font-size:9px;font-weight:800;letter-spacing:1.5px}
        .zuqen-eyebrow-dot{width:6px;height:6px;border-radius:50%;background:#d8794b;box-shadow:0 0 0 4px #d8794b20}
        .zuqen-welcome h1{margin:18px 0 12px;font:800 clamp(39px,5.2vw,65px)/1.05 Manrope,sans-serif;letter-spacing:-3.5px;color:var(--text)}
        .zuqen-welcome h1 em{font-style:normal;color:#b9653c}
        .zuqen-welcome p{max-width:570px;margin:0 auto;color:var(--muted);font-size:12px;line-height:1.8}
        .zuqen-home-composer{width:min(800px,100%);margin:0 auto;border:1px solid #494a40;border-radius:19px;background:#252923;color:#f4f0e9;padding:16px 17px 13px;box-shadow:0 18px 48px rgba(43,38,31,.13)}
        .zuqen-home-composer-heading{display:flex;align-items:center;gap:10px;color:#f1a477;font-size:9px;font-weight:800;letter-spacing:1.25px}
        .zuqen-search-card-icon{width:34px;height:34px;flex:0 0 34px;display:grid;place-items:center;border-radius:11px;background:#34372f;color:#f1a477}
        .zuqen-composer-status{margin-left:auto;color:#aaa99e;font-size:8px;letter-spacing:.8px}
        .zuqen-home-composer>input{display:block;width:100%;min-height:55px;margin:5px 0 8px;padding:8px 2px;border:0;outline:none;background:transparent;color:#f4f0e9;font-size:14px}
        .zuqen-home-composer>input::placeholder{color:#aaa99e}
        .zuqen-mode-row{display:flex;flex-wrap:wrap;gap:7px;padding:0 0 11px;border-bottom:1px solid #494a40}
        .zuqen-mode-chip{padding:7px 12px;border-radius:999px;background:#34372f;color:#d9d4c9;font-size:10px;cursor:pointer}
        .zuqen-mode-chip.active{background:#d8794b;color:#fff}
        .zuqen-home-attachments{margin:0 0 10px}
        .zuqen-home-composer-toolbar{display:flex;align-items:center;gap:9px;padding-top:11px}
        .zuqen-model-select-wrap{display:flex;align-items:center;gap:6px;color:#aaa99e;font-size:8px;font-weight:800;letter-spacing:.7px;white-space:nowrap}
        .zuqen-model-select{max-width:126px;background:#30342d;color:#f4f0e9;border:1px solid #55594e;border-radius:9px;padding:8px 7px;font:600 10px Manrope,sans-serif;outline:none}
        .zuqen-model-select:focus{border-color:#f1a477}
        .zuqen-home-voice{display:grid;place-items:center;min-width:34px;height:34px;border-radius:11px;background:#373a32;color:#f4a16f;cursor:pointer;font-size:12px}
        .zuqen-home-voice.listening{background:#713f32;color:#fff}
        .zuqen-home-voice:disabled{opacity:.4;cursor:not-allowed}
        .zuqen-attach-label{width:37px;height:37px;flex:0 0 37px;display:grid;place-items:center;border-radius:11px;background:#34372f;color:#e5dfd3;cursor:pointer;position:relative;overflow:hidden}
        .zuqen-attach-label:hover{color:#f1a477}
        .zuqen-attach-label input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}
        .zuqen-home-selected-agent{font-size:10px;color:#e5dfd3;padding:9px 11px;border-radius:10px;background:#34372f;cursor:pointer}
        .zuqen-home-selected-agent:hover{background:#41443a}
        .zuqen-search-shortcut{margin-left:auto;color:#aaa99e;font-size:10px}
        .zuqen-home-voice{width:37px;height:37px;border:1px solid #494a40;border-radius:11px;background:#34372f;color:#e5dfd3;cursor:pointer}
        .zuqen-home-voice.listening{background:#d8794b;color:white}
        .zuqen-send{width:38px;height:38px;flex:0 0 38px;display:grid;place-items:center;border-radius:11px;background:#d8794b;color:white;cursor:pointer;transition:filter .16s,transform .16s}
        .zuqen-send:hover:not(:disabled){filter:brightness(1.08);transform:translateY(-1px)}
        .zuqen-send:disabled{opacity:.42;cursor:not-allowed}
        .zuqen-agent-strip{margin:29px auto 0;width:min(800px,100%)}
        .zuqen-strip-title{margin-bottom:12px;color:var(--muted-2);font-size:9px;font-weight:800;letter-spacing:1.5px}
        .zuqen-agent-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:11px}
        .zuqen-mini-agent{min-width:0;display:flex;flex-direction:column;align-items:stretch;gap:7px;padding:10px;text-align:left;border:1px solid var(--border);border-radius:15px;background:#e9e2d8;overflow:hidden;cursor:pointer;transition:transform .18s,border-color .18s,background .18s}
        .zuqen-mini-agent:hover{transform:translateY(-3px);border-color:#d6c7b7;background:#fffaf3}
        .zuqen-card-art{display:block;width:100%;aspect-ratio:2/1;object-fit:cover;border-radius:10px;margin-bottom:4px}
        .zuqen-card-meta{font-size:8px;letter-spacing:1.1px;font-weight:800;color:#b9653c}
        .zuqen-card-meta.purple{color:#8a619b}.zuqen-card-meta.green{color:#688064}
        .zuqen-mini-agent-name{font-size:12px;font-weight:800;color:#252923}
        .zuqen-mini-agent-desc{font-size:9px;line-height:1.5;color:#746c61}
        .zuqen-mini-agent:nth-child(1){background:#dce5e2}
        .zuqen-mini-agent:nth-child(2){background:#e6dceb}
        .zuqen-mini-agent:nth-child(3){background:#dde5d9}
        .zuqen-mini-agent:nth-child(4){background:#f0dccb}
        .zuqen-mini-agent:nth-child(4){grid-column:1/-1;display:grid;grid-template-columns:120px 1fr;grid-template-rows:auto auto auto;column-gap:14px;align-items:center;background:#e6ded0}
        .zuqen-mini-agent:nth-child(4) .zuqen-chat-card-art{grid-column:1;grid-row:1/4;position:relative;display:grid;place-items:center;min-height:85px;border-radius:11px;background:radial-gradient(circle at 50% 50%,#d8794b 0 8%,#b9653c 9% 18%,#303c35 19% 40%,#252923 41% 100%);color:#fffaf5;font-size:32px;overflow:hidden}
        .zuqen-chat-orbit{position:absolute;width:75px;height:75px;border:1px solid #fffaf580;border-radius:50%}
        .zuqen-chat-orbit.orbit-two{width:100px;height:55px;transform:rotate(-35deg)}
        .zuqen-mini-agent:nth-child(4) .zuqen-card-meta,.zuqen-mini-agent:nth-child(4) .zuqen-mini-agent-name,.zuqen-mini-agent:nth-child(4) .zuqen-mini-agent-desc{grid-column:2}
        .zuqen-mini-agent:nth-child(4) .zuqen-card-meta{grid-row:1}
        .zuqen-mini-agent:nth-child(4) .zuqen-mini-agent-name{grid-row:2}
        .zuqen-mini-agent:nth-child(4) .zuqen-mini-agent-desc{grid-row:3}
        .zuqen-home-tools{width:min(800px,100%);margin:26px auto 0}
        .zuqen-home-tools-title{font:800 15px Manrope,sans-serif;color:var(--text);margin:0 0 12px}
        .zuqen-home-tools-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .zuqen-home-tool{display:flex;align-items:center;gap:12px;width:100%;padding:15px;text-align:left;border:1px solid #ded5c8;border-radius:15px;background:#e8d5c2;color:#252923;cursor:pointer;transition:transform .18s,border-color .18s,background .18s}
        .zuqen-home-tool:hover{transform:translateY(-2px);background:#f7e9dc;border-color:#d6b9a2}
        .zuqen-home-tool.marketplace{background:#e3e4d9}
        .zuqen-home-tool.marketplace:hover{background:#f1f0e8}
        .zuqen-home-tool-icon{display:grid;place-items:center;flex:0 0 43px;width:43px;height:43px;border-radius:12px;background:#b9653c;color:white;font-size:22px}
        .zuqen-home-tool.marketplace .zuqen-home-tool-icon{background:#303c35}
        .zuqen-home-tool-copy{flex:1;min-width:0}
        .zuqen-home-tool-title{font-weight:800;font-size:12px}
        .zuqen-home-tool-desc{display:block;margin-top:5px;font-size:10px;line-height:1.5;color:#6d6257}
        .zuqen-home-tool-link{display:block;margin-top:8px;font-size:8px;letter-spacing:1px;font-weight:800;color:#8b4e32}
        .zuqen-home-footer{width:min(800px,100%);margin:16px auto 0;padding:18px 20px;border-radius:15px;background:#252923;color:#f7f2e9}
        .zuqen-home-footer-label{font-size:9px;font-weight:800;letter-spacing:1.7px;color:#d8794b}
        .zuqen-home-footer-title{margin-top:8px;font:700 19px/1.2 Manrope,sans-serif}
        .zuqen-home-footer-sub{margin-top:7px;font-size:10px;color:#c8c5b9}
        .zuqen-credit-footer{text-align:center;margin-top:15px;color:var(--muted-2);font-size:10px}
        .zuqen-chat-view{flex:1;min-height:0;display:flex;flex-direction:column;position:relative}
        .zuqen-messages{flex:1;min-height:0;overflow-y:auto;padding:26px 24px 16px;scrollbar-gutter:stable}
        .zuqen-message-list{width:min(850px,100%);margin:0 auto;display:flex;flex-direction:column;gap:24px}
        .zuqen-message-row{display:flex;width:100%;min-width:0}
        .zuqen-message-row.user{justify-content:flex-end}
        .zuqen-message-block{max-width:min(760px,94%);min-width:0}
        .zuqen-message-row.user .zuqen-message-block{max-width:min(700px,90%)}
        .zuqen-message-label{display:flex;align-items:center;gap:7px;margin-bottom:9px;color:var(--muted);font-size:10px;font-weight:800}
        .zuqen-message-label-mark{width:23px;height:23px;display:grid;place-items:center;border-radius:8px;background:#f0ded0;color:#a85634}
        .zuqen-message-row.user .zuqen-message-label{justify-content:flex-end}
        .zuqen-message-row.user .zuqen-message-label-mark{background:#303c35;color:#f4f0e9}
        .zuqen-message-bubble{border:1px solid var(--border);border-radius:4px 16px 16px 16px;padding:14px 16px;background:var(--surface);color:var(--text);font-size:13px;line-height:1.8;overflow-wrap:anywhere}
        .zuqen-message-row.user .zuqen-message-bubble{border-color:#e3c4ac;background:#f1e0d2;border-radius:16px 4px 16px 16px;color:#282923}
        .dark .zuqen-message-row.user .zuqen-message-bubble{border-color:#72503c;background:#43352b;color:#f4f0e9}
        .z-message-text{white-space:pre-wrap;overflow-wrap:anywhere}
        .z-message-content{display:flex;flex-direction:column;gap:10px}
        .z-code-panel{margin:10px 0;border:1px solid #41463d;border-radius:12px;overflow:hidden;background:#20231f;color:#f1f0e8}
        .z-code-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border-bottom:1px solid #41463d;background:#2b2e28}
        .z-code-file{display:flex;align-items:center;gap:8px;color:#d9d5ca;font-size:10px;text-transform:lowercase}
        .z-code-file-dot{width:7px;height:7px;border-radius:50%;background:#d8794b}
        .z-code-controls{display:flex;align-items:center;gap:8px}
        .z-code-tabs{display:flex;gap:3px;padding:3px;border-radius:8px;background:#20231f}
        .z-code-tabs button{padding:5px 8px;border-radius:6px;background:transparent;color:#aaa99e;font-size:10px;cursor:pointer}
        .z-code-tabs button.active{background:#45483e;color:#fffaf5}
        .z-code-copy{display:flex;align-items:center;gap:5px;padding:6px 8px;border-radius:7px;background:#41443a;color:#f1f0e8;font-size:10px;cursor:pointer}
        .z-code-copy:hover{background:#55584c}
        .z-code-body{margin:0;max-height:460px;overflow:auto;padding:14px;color:#f4f0e9;font:12px/1.75 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre}
        .z-code-body code{font:inherit}
        .z-code-preview{display:block;width:100%;height:390px;border:0;background:white}
        .zuqen-message-actions{display:flex;gap:5px;margin-top:7px;opacity:0;pointer-events:none;transition:opacity .16s ease}
        .zuqen-message-row.user .zuqen-message-actions{justify-content:flex-end}
        .zuqen-message-block:hover .zuqen-message-actions{opacity:1;pointer-events:auto}
        .zuqen-action{width:30px;height:29px;display:grid;place-items:center;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--muted);cursor:pointer}
        .zuqen-action:hover{background:var(--surface-2);border-color:var(--border);color:var(--text)}
        .zuqen-action:disabled{opacity:.4;cursor:not-allowed}
        .zuqen-typing{display:flex;gap:5px;padding:7px 2px}
        .zuqen-typing span{width:6px;height:6px;border-radius:50%;background:var(--accent);animation:z-pulse 1s infinite ease-in-out}
        .zuqen-typing span:nth-child(2){animation-delay:.15s}.zuqen-typing span:nth-child(3){animation-delay:.3s}
        @keyframes z-pulse{0%,70%,100%{opacity:.3;transform:translateY(0)}35%{opacity:1;transform:translateY(-3px)}}
        .zuqen-edit-box{border:1px solid var(--border);border-radius:13px;background:var(--surface);padding:10px}
        .zuqen-edit-box textarea{width:100%;min-height:100px;resize:vertical;border:0;outline:none;background:transparent;color:var(--text);font-size:12px;line-height:1.7}
        .zuqen-edit-actions{display:flex;justify-content:flex-end;gap:7px}
        .zuqen-small-button{padding:8px 11px;border:1px solid var(--border);border-radius:8px;background:var(--surface-2);color:var(--text);font-size:10px;cursor:pointer}
        .zuqen-small-button.primary{border-color:var(--accent);background:var(--accent);color:white}
        .zuqen-attachment-list{display:flex;flex-wrap:wrap;gap:7px}
        .zuqen-attachment-chip{max-width:100%;display:flex;align-items:center;gap:7px;padding:7px 9px;border:1px solid var(--border);border-radius:9px;background:var(--surface-2);color:var(--muted);font-size:10px}
        .zuqen-attachment-chip-name{max-width:230px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .zuqen-attachment-remove{width:20px;height:20px;display:grid;place-items:center;border-radius:6px;background:transparent;color:var(--muted);cursor:pointer}
        .zuqen-attachment-remove:hover{background:var(--surface-3);color:var(--text)}
        .zuqen-composer-area{padding:10px 24px 17px;background:linear-gradient(0deg,var(--bg) 76%,transparent)}
        .zuqen-composer{width:min(850px,100%);margin:0 auto;border:1px solid #494a40;border-radius:17px;background:#252923;box-shadow:0 16px 45px rgba(43,38,31,.12);padding:9px 10px 8px}
        .zuqen-composer-row{display:flex;align-items:flex-end;gap:9px}
        .zuqen-composer-row textarea{flex:1;min-width:0;max-height:220px;min-height:39px;resize:none;padding:10px 1px;border:0;outline:none;background:transparent;color:#f4f0e9;font-size:12px;line-height:1.6}
        .zuqen-composer-row textarea::placeholder{color:#aaa99e}
        .zuqen-composer-footer{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 3px 0;color:#aaa99e;font-size:9px}
        .zuqen-jump-latest{position:absolute;z-index:10;bottom:150px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:8px;padding:9px 13px;border:1px solid var(--border);border-radius:99px;background:var(--surface);color:var(--text);box-shadow:0 8px 25px rgba(30,25,20,.12);font-size:10px;font-weight:700;cursor:pointer}
        .zuqen-empty-chat{flex:1;min-height:0;display:grid;place-items:center;padding:30px}
        .zuqen-empty-chat-inner{text-align:center;max-width:340px}
        .zuqen-empty-chat-icon{width:51px;height:51px;margin:0 auto 17px;display:grid;place-items:center;border-radius:17px;background:#f6e2d5;color:#b9653c}
        .zuqen-empty-chat h2{margin:0;font:800 21px Manrope,sans-serif;color:var(--text)}
        .zuqen-empty-chat p{margin:9px 0 0;color:var(--muted);font-size:11px;line-height:1.7}
        .zuqen-mobile-overlay{display:none}
        @media(max-width:1050px){
          .zuqen-sidebar{width:250px;flex-basis:250px}
          .zuqen-agent-cards{grid-template-columns:repeat(2,minmax(0,1fr))}
          .zuqen-mini-agent:nth-child(4){grid-column:1/-1}
        }
        @media(max-width:760px){
          .zuqen-sidebar{position:absolute;left:0;top:0;bottom:0;width:min(300px,86vw);flex-basis:min(300px,86vw);box-shadow:12px 0 40px rgba(30,25,20,.12)}
          .zuqen-sidebar.closed{width:0;flex-basis:0}
          .zuqen-mobile-overlay{position:absolute;inset:0;background:rgba(24,24,20,.28);z-index:35}
          .zuqen-topbar{height:62px;min-height:62px;padding:0 12px}
          .zuqen-top-left,.zuqen-top-right{gap:6px}
          .zuqen-agent-button{padding:5px 7px;gap:6px}
          .zuqen-agent-button-sub{display:none}
          .zuqen-agent-button-icon{width:27px;height:27px}
          .zuqen-credit-label{display:none}
          .zuqen-credit-button{padding:8px;gap:5px}
          .zuqen-icon-button{width:34px;height:34px;flex-basis:34px}
          .zuqen-home{padding:28px 13px 30px}
          .zuqen-welcome h1{font-size:clamp(38px,10vw,53px);letter-spacing:-2.3px}
          .zuqen-welcome p{font-size:11px}
          .zuqen-home-composer{padding:13px}
          .zuqen-composer-status{font-size:7px;letter-spacing:.4px}
          .zuqen-home-selected-agent{display:none}
          .zuqen-home-tools-grid{grid-template-columns:1fr}
          .zuqen-agent-cards{grid-template-columns:repeat(2,minmax(0,1fr))}
          .zuqen-mini-agent:nth-child(4){grid-template-columns:85px 1fr}
          .zuqen-mini-agent:nth-child(4) .zuqen-chat-card-art{min-height:76px}
          .zuqen-messages{padding:20px 12px 12px}
          .zuqen-message-block,.zuqen-message-row.user .zuqen-message-block{max-width:97%}
          .zuqen-message-bubble{padding:12px;font-size:12px}
          .zuqen-composer-area{padding:8px 10px 12px}
          .zuqen-composer-footer{font-size:8px}
          .zuqen-composer-footer span:first-child{max-width:60%}
          .zuqen-search-overlay{top:68px;left:10px;right:10px}
          .zuqen-jump-latest{bottom:130px}
        }
        @media(max-width:430px){
          .zuqen-credit-button{border:0;background:transparent}
          .zuqen-credit-count{font-size:10px}
          .zuqen-agent-button-name{font-size:10px}
          .zuqen-home-composer-toolbar{gap:6px}
          .zuqen-home-voice{width:34px;height:34px}
          .zuqen-home-composer-toolbar .zuqen-send{width:34px;height:34px;flex-basis:34px}
          .zuqen-agent-cards{grid-template-columns:1fr}
          .zuqen-mini-agent:nth-child(4){grid-column:auto}
          .zuqen-mini-agent:nth-child(4){grid-template-columns:90px 1fr}
          .zuqen-composer-footer span:last-child{display:none}
          .zuqen-welcome h1{letter-spacing:-1.8px}
        }
      `}</style>

      {sidebarOpen && (
        <div
          className="zuqen-mobile-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`zuqen-sidebar ${sidebarOpen ? "" : "closed"}`}>
        <div className="zuqen-brand">
          <div className="zuqen-logo" aria-label="ZUQEN logo">
            <span className="zuqen-logo-mark" />
          </div>

          <div>
            <div className="zuqen-brand-name">ZUQEN AI</div>
            <div className="zuqen-brand-sub">Your creative workspace</div>
          </div>
        </div>

        <div className="zuqen-sidebar-content">
          <button className="zuqen-new-chat" onClick={startNewChat}>
            <Icon name="plus" size={17} />
            <span>New conversation</span>
          </button>

          <section>
            <div className="zuqen-sidebar-heading">
              <span>{archivedOpen ? "Archived" : "Conversations"}</span>

              <div className="zuqen-heading-actions">
                <button
                  title="Search conversations"
                  aria-label="Search conversations"
                  onClick={() => setSearchOpen((previous) => !previous)}
                >
                  <Icon name="search" size={14} />
                </button>
                <button
                  title={archivedOpen ? "Show conversations" : "Show archived"}
                  aria-label={archivedOpen ? "Show conversations" : "Show archived"}
                  onClick={() => setArchivedOpen((previous) => !previous)}
                >
                  <Icon name={archivedOpen ? "restore" : "archive"} size={14} />
                </button>
              </div>
            </div>

            <div className="zuqen-chat-list">
              {visibleChats.length === 0 ? (
                <div
                  style={{
                    padding: "18px 9px",
                    color: "var(--muted-2)",
                    fontSize: 10,
                    lineHeight: 1.7,
                  }}
                >
                  {archivedOpen
                    ? "No archived conversations."
                    : search
                      ? "No matching conversations."
                      : "Your conversations will appear here."}
                </div>
              ) : (
                visibleChats.map((chat) => (
                  <div
                    key={chat.id}
                    className={`zuqen-chat-item ${
                      activeChatId === chat.id ? "active" : ""
                    }`}
                    onClick={() => selectChat(chat)}
                  >
                    <div className="zuqen-chat-main">
                      {renamingId === chat.id ? (
                        <input
                          className="zuqen-rename"
                          autoFocus
                          value={renameValue}
                          onChange={(event) => setRenameValue(event.target.value)}
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void renameChat(chat.id, renameValue);
                            }
                            if (event.key === "Escape") {
                              setRenamingId(null);
                            }
                          }}
                          onBlur={() => void renameChat(chat.id, renameValue)}
                        />
                      ) : (
                        <>
                          <div className="zuqen-chat-title">{chat.title}</div>
                          <div className="zuqen-chat-date">
                            {formatDate(chat.updated_at)}
                          </div>
                        </>
                      )}
                    </div>

                    <button
                      className={`zuqen-chat-menu-button ${
                        menuId === chat.id ? "open" : ""
                      }`}
                      aria-label={`Actions for ${chat.title}`}
                      title="Conversation actions"
                      onClick={(event) => {
                        event.stopPropagation();
                        setMenuId((previous) =>
                          previous === chat.id ? null : chat.id
                        );
                      }}
                    >
                      <Icon name="menu" size={17} />
                    </button>

                    {menuId === chat.id && (
                      <div
                        className="zuqen-floating-menu"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          className="zuqen-menu-item"
                          onClick={() => startRename(chat)}
                        >
                          <Icon name="edit" size={14} />
                          Rename
                        </button>

                        <button
                          className="zuqen-menu-item"
                          onClick={() =>
                            void archiveChat(chat.id, !chat.archived)
                          }
                        >
                          <Icon
                            name={chat.archived ? "restore" : "archive"}
                            size={14}
                          />
                          {chat.archived ? "Restore" : "Archive"}
                        </button>

                        <button
                          className="zuqen-menu-item danger"
                          onClick={() => void deleteChat(chat.id)}
                        >
                          <Icon name="trash" size={14} />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="zuqen-sidebar-bottom">
          <div className="zuqen-sidebar-user">
            <div className="zuqen-user-dot">
              {user?.is_anonymous
                ? "G"
                : user?.email?.charAt(0).toUpperCase() || "Z"}
            </div>

            <div className="zuqen-user-info">
              <div className="zuqen-user-name">{accountLabel}</div>
              <div className="zuqen-user-status">{accountStatus}</div>
            </div>

            <button
              className="zuqen-signout zuqen-icon-button"
              title="Account options"
              aria-label="Account options"
              onClick={() => setWorkspaceMenuOpen((previous) => !previous)}
            >
              <Icon name="menu" size={15} />
            </button>
          </div>

          {workspaceMenuOpen && (
            <div
              className="zuqen-workspace-menu"
              style={{ position: "relative", width: "100%", marginTop: 7 }}
            >
              {user?.is_anonymous ? (
                <button onClick={handleAuthNavigation}>
                  <Icon name="user" size={15} />
                  <span>Sign in / Create account</span>
                </button>
              ) : (
                <button onClick={() => void handleSignOut()} disabled={signingOut}>
                  <Icon name="logout" size={15} />
                  <span>{signingOut ? "Signing out..." : "Sign out"}</span>
                </button>
              )}

              <button onClick={toggleTheme}>
                <Icon name={lightMode ? "moon" : "sun"} size={15} />
                <span>{lightMode ? "Switch to dark theme" : "Switch to light theme"}</span>
              </button>
            </div>
          )}

          {user?.is_anonymous ? (
            <button
              className="zuqen-auth-button primary"
              onClick={handleAuthNavigation}
            >
              <Icon name="user" size={14} />
              Sign in / Create account
            </button>
          ) : (
            <button
              className="zuqen-auth-button"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
            >
              <Icon name="logout" size={14} />
              {signingOut ? "Signing out..." : "Sign out"}
            </button>
          )}
        </div>
      </aside>

      <section className="zuqen-main">
        <header className="zuqen-topbar">
          <div className="zuqen-top-left">
            <div className="zuqen-workspace-menu-wrap">
              <button
                className="zuqen-icon-button"
                title="Workspace menu"
                aria-label="Workspace menu"
                onClick={() => setWorkspaceMenuOpen((previous) => !previous)}
              >
                <Icon name="menu" size={18} />
              </button>

              {workspaceMenuOpen && (
                <div className="zuqen-workspace-menu">
                  <div className="zuqen-workspace-menu-title">WORKSPACE</div>
                  <button
                    onClick={() => {
                      setSidebarOpen((previous) => !previous);
                      setWorkspaceMenuOpen(false);
                    }}
                  >
                    <Icon name="menu" size={15} />
                    <span>{sidebarOpen ? "Hide sidebar" : "Show sidebar"}</span>
                  </button>
                  <button
                    onClick={() => {
                      setSearchOpen((previous) => !previous);
                      setWorkspaceMenuOpen(false);
                    }}
                  >
                    <Icon name="search" size={15} />
                    <span>Search conversations</span>
                  </button>
                  <button
                    onClick={() => {
                      setAgentOpen((previous) => !previous);
                      setWorkspaceMenuOpen(false);
                    }}
                  >
                    <Icon name="spark" size={15} />
                    <span>Choose active agent</span>
                  </button>
                  <button
                    onClick={() => {
                      setArchivedOpen((previous) => !previous);
                      setWorkspaceMenuOpen(false);
                    }}
                  >
                    <Icon name="archive" size={15} />
                    <span>{archivedOpen ? "Show conversations" : "Show archived"}</span>
                  </button>
                  <button
                    onClick={() => {
                      toggleTheme();
                      setWorkspaceMenuOpen(false);
                    }}
                  >
                    <Icon name={lightMode ? "moon" : "sun"} size={15} />
                    <span>{lightMode ? "Dark theme" : "Light theme"}</span>
                  </button>
                </div>
              )}
            </div>

            <div className="zuqen-agent-selector">
              <button
                className="zuqen-agent-button"
                onClick={() => setAgentOpen((previous) => !previous)}
              >
                <span className="zuqen-agent-button-icon">
                  {AGENTS.find((agent) => agent.name === selectedAgent)?.icon || "✳"}
                </span>
                <span className="zuqen-agent-button-text">
                  <div className="zuqen-agent-button-name">{selectedAgent}</div>
                  <div className="zuqen-agent-button-sub">Active agent</div>
                </span>
                <Icon name="chevron" size={13} />
              </button>

              {agentOpen && (
                <div className="zuqen-agent-dropdown">
                  {AGENTS.map((agent) => (
                    <button
                      key={agent.name}
                      className={`zuqen-agent-option ${
                        selectedAgent === agent.name ? "selected" : ""
                      }`}
                      onClick={() => navigateAgent(agent)}
                    >
                      <span className="zuqen-agent-option-icon">
                        {agent.icon}
                      </span>
                      <span className="zuqen-agent-option-content">
                        <div className="zuqen-agent-option-name">{agent.name}</div>
                        <div className="zuqen-agent-option-description">
                          {agent.description}
                        </div>
                      </span>
                      {selectedAgent === agent.name && (
                        <span className="zuqen-agent-check">
                          <Icon name="check" size={14} />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="zuqen-top-right">
            <button
              type="button"
              className="zuqen-flappy-button"
              onClick={() => {
                if (user?.is_anonymous) {
                  setErrorMessage("Please sign in before entering Flappy Bird.");
                  return;
                }
                setFlappyOpen(true);
              }}
              title={user?.is_anonymous ? "Sign in to play" : "Play Flappy Bird"}
            >
              <span className="zuqen-flappy-bird">●</span>
              <span className="zuqen-flappy-score">{flappyScore}</span>
              <span className="zuqen-flappy-label">Flappy</span>
            </button>

            <div className="zuqen-credit-wrap">
              <button
                className="zuqen-credit-button"
                onClick={() => setCreditsOpen((previous) => !previous)}
              >
                <span className="zuqen-credit-icon">◈</span>
                <span className="zuqen-credit-count">
                  {chatCredits === null ? "..." : chatCredits.toLocaleString()}
                </span>
                <span className="zuqen-credit-label">Chat credits</span>
              </button>

              {creditsOpen && (
                <div className="zuqen-credit-dropdown">
                  <div className="zuqen-credit-dropdown-title">ZUQEN Chat Credits</div>
                  <div className="zuqen-credit-big">
                    {chatCredits === null ? "..." : chatCredits.toLocaleString()}
                  </div>
                  <div className="zuqen-credit-small">
                    Available for AI conversations
                  </div>
                  <div className="zuqen-credit-line" />
                  <div className="zuqen-credit-row">
                    <span>Flappy score</span>
                    <strong>{flappyScore}</strong>
                  </div>
                  <button
                    type="button"
                    className="zuqen-exchange-button"
                    onClick={exchangeFlappyScore}
                    disabled={
                      flappyLoading ||
                      !!user?.is_anonymous ||
                      flappyScore < 10
                    }
                  >
                    {flappyLoading
                      ? "Exchanging..."
                      : `Exchange ${Math.floor(flappyScore / 10)} credit${Math.floor(flappyScore / 10) === 1 ? "" : "s"}`}
                  </button>
                  <div className="zuqen-credit-small">
                    10 score = 1 Chat credit. Your remaining score stays saved.
                  </div>
                  <div className="zuqen-credit-line" />
                  <div className="zuqen-credit-row">
                    <span>Status</span>
                    <strong>
                      {chatCredits === null
                        ? "Loading"
                        : chatCredits > 0
                          ? "Available"
                          : "No credits"}
                    </strong>
                  </div>
                  <div className="zuqen-credit-row">
                    <span>Feature</span>
                    <strong>AI Chat</strong>
                  </div>
                  <div className="zuqen-credit-row">
                    <span>Provider</span>
                    <strong>Groq</strong>
                  </div>
                </div>
              )}
            </div>

            <button
              className="zuqen-icon-button"
              onClick={toggleTheme}
              title={lightMode ? "Switch to dark theme" : "Switch to light theme"}
              aria-label="Toggle theme"
            >
              <Icon name={lightMode ? "moon" : "sun"} size={17} />
            </button>
          </div>
        </header>

        {searchOpen && (
          <div className="zuqen-search-overlay">
            <div className="zuqen-search-input-wrap">
              <Icon name="search" size={15} />
              <input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search conversation titles and messages..."
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  title="Clear search"
                  aria-label="Clear search"
                >
                  <Icon name="close" size={14} />
                </button>
              )}
              <button
                onClick={() => setSearchOpen(false)}
                title="Close search"
                aria-label="Close search"
              >
                <Icon name="close" size={14} />
              </button>
            </div>
          </div>
        )}

        <div className="zuqen-content">
          {errorMessage && (
            <div className="zuqen-error" role="alert">
              <strong>!</strong>
              <span>{errorMessage}</span>
              <button
                onClick={() => setErrorMessage("")}
                aria-label="Dismiss error"
              >
                <Icon name="close" size={13} />
              </button>
            </div>
          )}

          {!authReady ? (
            <div className="zuqen-empty-chat">
              <div className="zuqen-empty-chat-inner">
                <div className="zuqen-empty-chat-icon">
                  <Icon name="spark" size={22} />
                </div>
                <h2>Starting ZUQEN AI</h2>
                <p>Restoring your secure session and workspace...</p>
              </div>
            </div>
          ) : activeChatId && activeChat ? (
            <div className="zuqen-chat-view">
              <div
                className="zuqen-messages"
                ref={messagesContainerRef}
                onScroll={handleMessagesScroll}
              >
                <div className="zuqen-message-list">
                  {messages.length === 0 ? (
                    <div className="zuqen-empty-chat">
                      <div className="zuqen-empty-chat-inner">
                        <div className="zuqen-empty-chat-icon">
                          <Icon name="spark" size={22} />
                        </div>
                        <h2>Ready when you are</h2>
                        <p>Start the conversation below.</p>
                      </div>
                    </div>
                  ) : (
                    messages.map((message) => {
                      const isEditing = editingId === message.id;

                      return (
                        <div
                          key={message.id}
                          className={`zuqen-message-row ${message.role}`}
                        >
                          <div className="zuqen-message-block">
                            <div className="zuqen-message-label">
                              <span className="zuqen-message-label-mark">
                                {message.role === "assistant" ? "✳" : "Y"}
                              </span>
                              <span>
                                {message.role === "assistant" ? "ZUQEN AI" : "You"}
                              </span>
                            </div>

                            {isEditing ? (
                              <div className="zuqen-edit-box">
                                <textarea
                                  value={editingValue}
                                  onChange={(event) =>
                                    setEditingValue(event.target.value)
                                  }
                                  autoFocus
                                />
                                <div className="zuqen-edit-actions">
                                  <button
                                    className="zuqen-small-button"
                                    onClick={cancelEdit}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    className="zuqen-small-button primary"
                                    onClick={() =>
                                      void saveEditedMessage(message.id)
                                    }
                                    disabled={loading}
                                  >
                                    Save & regenerate
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="zuqen-message-bubble">
                                  {message.content ? (
                                    <MessageContent content={message.content} />
                                  ) : (
                                    <div className="zuqen-typing">
                                      <span />
                                      <span />
                                      <span />
                                    </div>
                                  )}

                                  {message.attachments?.length ? (
                                    <div
                                      className="zuqen-attachment-list"
                                      style={{ marginTop: 12 }}
                                    >
                                      {message.attachments.map((file) => (
                                        <div
                                          className="zuqen-attachment-chip"
                                          key={file.id}
                                        >
                                          <span>◇</span>
                                          <span className="zuqen-attachment-chip-name">
                                            {file.name}
                                          </span>
                                          <span>{formatFileSize(file.size)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>

                                <div className="zuqen-message-actions">
                                  <button
                                    type="button"
                                    className="zuqen-action"
                                    title="Copy message"
                                    aria-label="Copy message"
                                    onClick={() => void copyMessage(message.content)}
                                    disabled={!message.content}
                                  >
                                    <Icon name="copy" size={15} />
                                  </button>

                                  {message.role === "assistant" && message.content && (
                                    <>
                                      <button
                                        type="button"
                                        className="zuqen-action"
                                        title={speakingMessageId === message.id ? "Stop reading" : "Read message aloud"}
                                        aria-label={speakingMessageId === message.id ? "Stop reading" : "Read message aloud"}
                                        onClick={() => readMessage(message.content, message.id)}
                                      >
                                        <Icon
                                          name={speakingMessageId === message.id ? "stop" : "volume"}
                                          size={15}
                                        />
                                      </button>

                                      <button
                                        type="button"
                                        className="zuqen-action"
                                        title="Share message"
                                        aria-label="Share message"
                                        onClick={() => void shareMessage(message.content)}
                                      >
                                        <Icon name="share" size={15} />
                                      </button>

                                      <button
                                        type="button"
                                        className="zuqen-action"
                                        title="Regenerate response"
                                        aria-label="Regenerate response"
                                        onClick={() => void regenerate()}
                                        disabled={loading}
                                      >
                                        <Icon name="refresh" size={15} />
                                      </button>
                                    </>
                                  )}

                                  {message.role === "user" && (
                                    <button
                                      type="button"
                                      className="zuqen-action"
                                      title="Edit message"
                                      aria-label="Edit message"
                                      onClick={() => startEditMessage(message)}
                                    >
                                      <Icon name="edit" size={15} />
                                    </button>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div ref={messagesEndRef} aria-hidden="true" />
              </div>

              {showJumpToLatest && (
                <button
                  className="zuqen-jump-latest"
                  onClick={jumpToLatest}
                  type="button"
                >
                  ↓ Jump to latest
                </button>
              )}

              <div className="zuqen-composer-area">
                {attachments.length > 0 && (
                  <div
                    style={{
                      width: "min(850px,100%)",
                      margin: "0 auto 8px",
                    }}
                  >
                    <div className="zuqen-attachment-list">
                      {attachments.map((file) => (
                        <div className="zuqen-attachment-chip" key={file.id}>
                          <span>◇</span>
                          <span className="zuqen-attachment-chip-name">
                            {file.name}
                          </span>
                          <button
                            className="zuqen-attachment-remove"
                            onClick={() => removeAttachment(file.id)}
                            title={`Remove ${file.name}`}
                            aria-label={`Remove ${file.name}`}
                          >
                            <Icon name="close" size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="zuqen-composer">
                  <div className="zuqen-composer-row">
                    <label className="zuqen-attach-label" title="Attach files">
                      <Icon name="paperclip" size={17} />
                      <input
                        type="file"
                        multiple
                        onChange={handleAttachment}
                        aria-label="Attach files"
                      />
                    </label>

                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={(event) => {
                        setInput(event.currentTarget.value);
                        event.currentTarget.style.height = "auto";
                        event.currentTarget.style.height = `${Math.min(
                          event.currentTarget.scrollHeight,
                          220
                        )}px`;
                      }}
                      onKeyDown={handleKeyDown}
                      placeholder="Write a thought, ask a question, start something..."
                      rows={1}
                      disabled={loading}
                      aria-label="Message ZUQEN AI"
                    />

                    <button
                      type="button"
                      className={`zuqen-home-voice ${voiceListening ? "listening" : ""}`}
                      onClick={startVoiceInput}
                      title={voiceListening ? "Listening" : "Voice input"}
                      aria-label={voiceListening ? "Stop voice input" : "Start voice input"}
                    >
                      {voiceListening ? "●" : "◖))"}
                    </button>
                    <button
                      className="zuqen-send"
                      disabled={loading || (!input.trim() && attachments.length === 0)}
                      onClick={handleSubmit}
                      title="Send message"
                      aria-label="Send message"
                    >
                      <Icon name="send" size={16} />
                    </button>
                  </div>

                  <div className="zuqen-composer-footer">
                    <span>Check important information; AI can make mistakes.</span>
                    <span>Enter to send · Shift + Enter for newline</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="zuqen-home">
              <div className="zuqen-home-inner">
                <div className="zuqen-welcome">
                  <div className="zuqen-eyebrow">
                    <span className="zuqen-eyebrow-dot" />
                    YOUR IDEAS, AMPLIFIED
                  </div>
                  <h1>
                    Imagine more.
                    <br />
                    <em>Create beyond.</em>
                  </h1>
                  <p>
                    One thoughtful workspace to create, build, explore and get
                    things done. Start with an idea and see where it takes you.
                  </p>
                </div>

                <div className="zuqen-home-composer">
                  <div className="zuqen-home-composer-heading">
                    <span className="zuqen-search-card-icon">
                      <Icon name="spark" size={19} />
                    </span>
                    <span>ZUQEN CREATIVE SPACE</span>
                    <span className="zuqen-composer-status">
                      {loading ? "WORKING..." : "READY TO CREATE"}
                    </span>
                  </div>

                  <input
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        handleSubmit();
                      }
                    }}
                    placeholder="Describe an idea, ask a question, or tell ZUQEN what to build..."
                    aria-label="Message ZUQEN AI"
                  />

                  {attachments.length > 0 && (
                    <div className="zuqen-attachment-list zuqen-home-attachments">
                      {attachments.map((file) => (
                        <div className="zuqen-attachment-chip" key={file.id}>
                          <span className="zuqen-attachment-chip-name">
                            {file.name}
                          </span>
                          <button
                            type="button"
                            className="zuqen-attachment-remove"
                            onClick={() => removeAttachment(file.id)}
                            aria-label={`Remove ${file.name}`}
                          >
                            <Icon name="close" size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="zuqen-mode-row" aria-label="Prompt mode">
                    {["Create", "Research", "Build"].map((mode) => (
                      <button
                        type="button"
                        key={mode}
                        className={`zuqen-mode-chip ${
                          selectedMode === mode ? "active" : ""
                        }`}
                        onClick={() => setSelectedMode(mode)}
                      >
                        {mode === "Create"
                          ? "✳  Create"
                          : mode === "Research"
                            ? "⌕  Research"
                            : "⌘  Build"}
                      </button>
                    ))}
                  </div>

                  <div className="zuqen-home-composer-toolbar">
                    <label
                      className="zuqen-attach-label"
                      title="Attach files"
                      aria-label="Attach files"
                    >
                      <Icon name="paperclip" size={17} />
                      <input type="file" multiple onChange={handleAttachment} />
                    </label>

                    <label className="zuqen-model-select-wrap" title="Choose the AI model">
                      <span>MODEL</span>
                      <select
                        className="zuqen-model-select"
                        value={selectedModel}
                        onChange={(event) => setSelectedModel(event.target.value)}
                        aria-label="Choose AI model"
                      >
                        <option value="qwen/qwen3.8-27b">ZUQEN AI</option>
                        <option value="openai/gpt-oss-120b">ZUQEN AI Pro</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      className="zuqen-home-selected-agent"
                      onClick={() => setAgentOpen((previous) => !previous)}
                      title="Choose an agent"
                    >
                      ✳ &nbsp; {selectedAgent}⌄
                    </button>

                    <span className="zuqen-search-shortcut">Enter ↵</span>

                    <button
                      type="button"
                      className={`zuqen-home-voice ${
                        voiceListening ? "listening" : ""
                      }`}
                      onClick={startVoiceInput}
                      title={voiceListening ? "Listening" : "Voice input"}
                      aria-label="Voice input"
                    >
                      {voiceListening ? "●" : "◖))"}
                    </button>

                    <button
                      type="button"
                      className="zuqen-send"
                      disabled={loading || (!input.trim() && attachments.length === 0)}
                      onClick={handleSubmit}
                      title="Send message"
                      aria-label="Send message"
                    >
                      <Icon name="send" size={17} />
                    </button>
                  </div>
                </div>

                <div className="zuqen-agent-strip">
                  <div className="zuqen-strip-title">
                    EXPLORE YOUR WORKSPACE · 4 AI AGENTS
                  </div>

                  <div className="zuqen-agent-cards">
                    <button
                      type="button"
                      className="zuqen-mini-agent"
                      onClick={() => navigateAgent(AGENTS[1])}
                    >
                      <svg
                        className="zuqen-card-art"
                        viewBox="0 0 300 150"
                        role="img"
                        aria-label="Website design artwork"
                      >
                        <rect width="300" height="150" rx="14" fill="#dce5e2" />
                        <rect
                          x="22"
                          y="13"
                          width="256"
                          height="124"
                          rx="9"
                          fill="#faf8f2"
                          stroke="#9bb2a8"
                        />
                        <path d="M22 37H278" stroke="#9bb2a8" />
                        <circle cx="35" cy="25" r="3" fill="#d8794b" />
                        <circle cx="46" cy="25" r="3" fill="#b9c9c2" />
                        <circle cx="57" cy="25" r="3" fill="#b9c9c2" />
                        <rect x="39" y="51" width="94" height="7" rx="3" fill="#293c38" />
                        <rect x="39" y="65" width="75" height="4" rx="2" fill="#9aada5" />
                        <rect x="39" y="76" width="48" height="15" rx="4" fill="#d8794b" />
                        <rect x="158" y="49" width="99" height="73" rx="6" fill="#bfd1ca" />
                        <circle cx="208" cy="69" r="15" fill="#e7c9a8" />
                        <path d="M166 115Q208 59 249 115" fill="#577a70" />
                      </svg>
                      <span className="zuqen-card-meta">01 / BUILD</span>
                      <span className="zuqen-mini-agent-name">Website Builder</span>
                      <span className="zuqen-mini-agent-desc">
                        Turn ideas into beautiful websites.
                      </span>
                    </button>

                    <button
                      type="button"
                      className="zuqen-mini-agent"
                      onClick={() => navigateAgent(AGENTS[2])}
                    >
                      <svg
                        className="zuqen-card-art"
                        viewBox="0 0 300 150"
                        role="img"
                        aria-label="Cinematic video artwork"
                      >
                        <rect width="300" height="150" rx="14" fill="#dce5d8" />
                        <circle cx="231" cy="34" r="16" fill="#f5d9b2" />
                        <path
                          d="M0 106L85 45L143 101L198 54L300 111V150H0Z"
                          fill="#82977c"
                        />
                        <path
                          d="M0 124L81 86L149 118L223 82L300 126V150H0Z"
                          fill="#344d43"
                        />
                        <circle cx="150" cy="75" r="23" fill="#faf7f1" fillOpacity=".94" />
                        <path d="M144 61L164 75L144 89Z" fill="#b9653c" />
                      </svg>
                      <span className="zuqen-card-meta green">03 / MOTION</span>
                      <span className="zuqen-mini-agent-name">Text to Video</span>
                      <span className="zuqen-mini-agent-desc">
                        Bring stories and concepts to life.
                      </span>
                    </button>

                    <button
                      type="button"
                      className="zuqen-mini-agent"
                      onClick={() => navigateAgent(AGENTS[3])}
                    >
                      <svg
                        className="zuqen-card-art"
                        viewBox="0 0 300 150"
                        role="img"
                        aria-label="Voice waveform artwork"
                      >
                        <rect width="300" height="150" rx="14" fill="#f0dccb" />
                        {[18, 28, 41, 54, 66, 79, 92, 105, 118, 131, 144, 157, 170, 183, 196, 209, 222, 235, 248, 261, 274, 286].map(
                          (x, i) => {
                            const heights = [
                              18, 32, 48, 26, 59, 39, 52, 24, 43, 30, 61,
                              35, 48, 26, 55, 34, 46, 20, 38, 29, 50, 22,
                            ];
                            const height = heights[i];

                            return (
                              <rect
                                key={x}
                                x={x}
                                y={75 - height / 2}
                                width="6"
                                height={height}
                                rx="3"
                                fill={i % 2 === 0 ? "#b9653c" : "#754a37"}
                              />
                            );
                          }
                        )}
                      </svg>
                      <span className="zuqen-card-meta">03 / SOUND</span>
                      <span className="zuqen-mini-agent-name">Voice Generator</span>
                      <span className="zuqen-mini-agent-desc">
                        Give words a natural voice.
                      </span>
                    </button>

                    <button
                      type="button"
                      className="zuqen-mini-agent"
                      onClick={() => navigateAgent(AGENTS[0])}
                    >
                      <span className="zuqen-chat-card-art">
                        <span>✳</span>
                        <span className="zuqen-chat-orbit" />
                        <span className="zuqen-chat-orbit orbit-two" />
                      </span>
                      <span className="zuqen-card-meta">04 / THINK</span>
                      <span className="zuqen-mini-agent-name">ZUQEN AI Chat</span>
                      <span className="zuqen-mini-agent-desc">
                        Ask questions, explore ideas and work through conversations.
                      </span>
                    </button>
                  </div>
                </div>

                <div className="zuqen-home-tools">
                  <h2 className="zuqen-home-tools-title">
                    More power for your ideas
                  </h2>

                  <div className="zuqen-home-tools-grid">
                    <button
                      type="button"
                      className="zuqen-home-tool"
                      onClick={() => {
                        window.location.href = "/automation";
                      }}
                    >
                      <span className="zuqen-home-tool-icon" aria-hidden="true">
                        ⤨
                      </span>
                      <span className="zuqen-home-tool-copy">
                        <span className="zuqen-home-tool-title">
                          Automation Mode
                        </span>
                        <span className="zuqen-home-tool-desc">
                          Plan tasks, use dedicated tools and automate workflows.
                        </span>
                        <span className="zuqen-home-tool-link">
                          OPEN AUTOMATION ↗
                        </span>
                      </span>
                      <span aria-hidden="true">↗</span>
                    </button>

                    <button
                      type="button"
                      className="zuqen-home-tool marketplace"
                      onClick={() => {
                        window.location.href = "/marketplace";
                      }}
                    >
                      <span className="zuqen-home-tool-icon" aria-hidden="true">
                        ▣
                      </span>
                      <span className="zuqen-home-tool-copy">
                        <span className="zuqen-home-tool-title">
                          Template Buy / Sell
                        </span>
                        <span className="zuqen-home-tool-desc">
                          Discover digital templates or list your own for sale.
                        </span>
                        <span className="zuqen-home-tool-link">
                          EXPLORE MARKETPLACE ↗
                        </span>
                      </span>
                      <span aria-hidden="true">↗</span>
                    </button>
                  </div>
                </div>

                <div className="zuqen-home-footer">
                  <div className="zuqen-home-footer-label">ZUQEN CORE</div>
                  <div className="zuqen-home-footer-title">
                    More than a tool. A creative advantage.
                  </div>
                  <div className="zuqen-home-footer-sub">
                    Think. Design. Build. Execute.
                  </div>
                </div>

                <div className="zuqen-credit-footer">
                  {!authReady
                    ? "Restoring your workspace..."
                    : chatCredits === null
                      ? "Chat credits are currently unavailable"
                      : `${chatCredits.toLocaleString()} Chat Credits available`}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
      {flappyOpen && user && !user.is_anonymous && (
        <FlappyBirdGame
          initialScore={flappyScore}
          onClose={() => setFlappyOpen(false)}
          onScoreChange={(nextScore) => {
            setFlappyScore(nextScore);
            void persistFlappyScore(nextScore);
          }}
        />
      )}
    </main>
  );
}