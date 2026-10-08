"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase";

type Role = "user" | "assistant";

type User = {
  id: string;
  email?: string | null;
  is_anonymous?: boolean;
};

type Attachment = {
  id: string;
  name: string;
  path?: string;
  file_path?: string;
  size: number;
  content_type?: string;
  contentType?: string;
  url?: string;
};

type Message = {
  id: string;
  role: Role;
  content: string;
  attachments?: Attachment[];
};

type Chat = {
  id: string;
  title: string;
  messages: Message[];
  archived?: boolean;
  created_at?: string;
  updated_at?: string;
};

type CreditRow = {
  balance?: number | null;
  credits?: number | null;
  amount?: number | null;
};

const supabase = createClient();

const AGENTS = [
  {
    name: "ZUQEN AI",
    route: null,
    icon: "✦",
    description: "Your intelligent AI workspace",
  },
  {
    name: "Website Builder",
    route: "/website-builder",
    icon: "⌘",
    description: "Build complete websites",
  },
  {
    name: "Text to Image",
    route: "/image-generator",
    icon: "◈",
    description: "Create images from prompts",
  },
  {
    name: "Text to Video",
    route: "/video-generator",
    icon: "▶",
    description: "Create videos with AI",
  },
  {
    name: "Voice Generator",
    route: "/generate-voice",
    icon: "◉",
    description: "Generate natural AI voices",
  },
];

const SUGGESTIONS = [
  {
    icon: "✦",
    title: "Write",
    text: "Write something for me",
  },
  {
    icon: "⌁",
    title: "Learn",
    text: "Explain a difficult topic simply",
  },
  {
    icon: "◇",
    title: "Create",
    text: "Help me build a project",
  },
  {
    icon: "⌘",
    title: "Code",
    text: "Help me write and understand code",
  },
];

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatDate(value?: string) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60_000) return "now";
  if (diff < 3_600_000) {
    return `${Math.floor(diff / 60_000)}m`;
  }

  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString([], {
    day: "numeric",
    month: "short",
  });
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(size) / Math.log(1024)),
    units.length - 1
  );

  return `${(size / Math.pow(1024, index)).toFixed(
    index === 0 ? 0 : 1
  )} ${units[index]}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function detectLanguage(language: string, code: string) {
  const raw = language.toLowerCase().trim();

  if (raw) {
    if (raw === "js") return "javascript";
    if (raw === "ts") return "typescript";
    if (raw === "jsx") return "jsx";
    if (raw === "tsx") return "tsx";
    if (raw === "py") return "python";
    if (raw === "md") return "markdown";
    if (raw === "yml") return "yaml";
    return raw;
  }

  if (/^\s*<!doctype html/i.test(code) || /<html[\s>]/i.test(code)) {
    return "html";
  }

  if (/<(div|section|main|body|button|App)\b/i.test(code)) {
    return "jsx";
  }

  if (/^\s*(import|export)\b/m.test(code) && /:\s*(string|number|boolean)/.test(code)) {
    return "typescript";
  }

  if (/^\s*(import|from|def|print)\b/m.test(code)) {
    return "python";
  }

  if (/^\s*[{[]/.test(code)) {
    try {
      JSON.parse(code);
      return "json";
    } catch {
      // Not JSON.
    }
  }

  if (/<svg[\s>]/i.test(code)) return "svg";

  if (/^\s*#\s+/.test(code)) return "markdown";

  if (/\b(const|let|var|function)\b/.test(code)) {
    return "javascript";
  }

  if (/[.#][\w-]+\s*\{[\s\S]*\}/.test(code)) {
    return "css";
  }

  return "text";
}

function getLanguageLabel(language: string) {
  const labels: Record<string, string> = {
    html: "HTML",
    css: "CSS",
    javascript: "JavaScript",
    typescript: "TypeScript",
    jsx: "JSX",
    tsx: "TSX",
    python: "Python",
    json: "JSON",
    markdown: "Markdown",
    yaml: "YAML",
    sql: "SQL",
    java: "Java",
    c: "C",
    cpp: "C++",
    csharp: "C#",
    go: "Go",
    rust: "Rust",
    php: "PHP",
    ruby: "Ruby",
    swift: "Swift",
    kotlin: "Kotlin",
    bash: "Bash",
    shell: "Shell",
    xml: "XML",
    svg: "SVG",
    text: "Code",
  };

  return labels[language] || language.toUpperCase();
}

function buildBrowserPreview(code: string, language: string) {
  if (language === "html") {
    return code;
  }

  if (language === "svg") {
    return `
      <!doctype html>
      <html>
        <body style="margin:0;padding:24px;background:#fff;display:grid;place-items:center;min-height:100vh">
          ${code}
        </body>
      </html>
    `;
  }

  if (language === "css") {
    return `
      <!doctype html>
      <html>
        <head>
          <style>${code}</style>
        </head>
        <body>
          <main class="preview-demo">
            <h1>CSS Preview</h1>
            <p>Your stylesheet is being previewed here.</p>
            <button>Preview Button</button>
          </main>
        </body>
      </html>
    `;
  }

  if (
    language === "javascript" ||
    language === "js"
  ) {
    return `
      <!doctype html>
      <html>
        <body style="margin:0;background:#101218;color:#fff;font-family:system-ui;padding:24px">
          <div id="app"></div>
          <script>
            const originalLog = console.log;
            console.log = (...args) => {
              originalLog(...args);
              const el = document.createElement("pre");
              el.style.cssText = "white-space:pre-wrap;background:#171a22;padding:14px;border-radius:12px;margin-top:12px";
              el.textContent = args.map(x => typeof x === "object" ? JSON.stringify(x, null, 2) : String(x)).join(" ");
              document.body.appendChild(el);
            };

            try {
              ${code}
            } catch (error) {
              const el = document.createElement("pre");
              el.style.cssText = "white-space:pre-wrap;color:#ff9ea6;background:#28151a;padding:14px;border-radius:12px";
              el.textContent = error?.stack || String(error);
              document.body.appendChild(el);
            }
          </script>
        </body>
      </html>
    `;
  }

  return "";
}

function splitCodeBlocks(content: string) {
  const parts: Array<
    | { type: "text"; content: string }
    | {
        type: "code";
        language: string;
        code: string;
      }
  > = [];

  const regex = /```([^\n`]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        content: content.slice(lastIndex, match.index),
      });
    }

    parts.push({
      type: "code",
      language: detectLanguage(match[1], match[2]),
      code: match[2].replace(/\n$/, ""),
    });

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    parts.push({
      type: "text",
      content: content.slice(lastIndex),
    });
  }

  if (!parts.length) {
    parts.push({
      type: "text",
      content,
    });
  }

  return parts;
}

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
    "aria-hidden": true,
  };

  switch (name) {
    case "menu":
      return (
        <svg {...common}>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      );

    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );

    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </svg>
      );

    case "archive":
      return (
        <svg {...common}>
          <path d="M4 7h16v13H4z" />
          <path d="M3 4h18v3H3zM9 11h6" />
        </svg>
      );

    case "restore":
      return (
        <svg {...common}>
          <path d="M4 7v5h5" />
          <path d="M5 12a7 7 0 1 0 2-5" />
        </svg>
      );

    case "trash":
      return (
        <svg {...common}>
          <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
        </svg>
      );

    case "edit":
      return (
        <svg {...common}>
          <path d="m4 16-.8 4.8L8 20l11.2-11.2a2.2 2.2 0 0 0-3.1-3.1z" />
          <path d="m14.8 6.7 2.5 2.5" />
        </svg>
      );

    case "copy":
      return (
        <svg {...common}>
          <rect x="8" y="8" width="11" height="12" rx="2" />
          <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3" />
        </svg>
      );

    case "download":
      return (
        <svg {...common}>
          <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
        </svg>
      );

    case "refresh":
      return (
        <svg {...common}>
          <path d="M20 11a8 8 0 0 0-14.8-4L3 10" />
          <path d="M3 5v5h5M4 13a8 8 0 0 0 14.8 4L21 14" />
          <path d="M21 19v-5h-5" />
        </svg>
      );

    case "send":
      return (
        <svg {...common}>
          <path d="m4 4 16 8-16 8 3-8z" />
          <path d="M7 12h13" />
        </svg>
      );

    case "stop":
      return (
        <svg
          {...common}
          fill="currentColor"
          stroke="none"
        >
          <rect x="7" y="7" width="10" height="10" rx="2" />
        </svg>
      );

    case "paperclip":
      return (
        <svg {...common}>
          <path d="m9 12.5 6.7-6.7a3.1 3.1 0 0 1 4.4 4.4l-8.8 8.8a5 5 0 0 1-7.1-7.1l8.5-8.5" />
        </svg>
      );

    case "chevron":
      return (
        <svg {...common}>
          <path d="m7 10 5 5 5-5" />
        </svg>
      );

    case "sun":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      );

    case "moon":
      return (
        <svg {...common}>
          <path d="M20 15.5A8 8 0 0 1 8.5 4 8 8 0 1 0 20 15.5z" />
        </svg>
      );

    case "close":
      return (
        <svg {...common}>
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      );

    case "check":
      return (
        <svg {...common}>
          <path d="m5 12 4 4L19 6" />
        </svg>
      );

    case "user":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 21a7 7 0 0 1 14 0" />
        </svg>
      );

    case "logout":
      return (
        <svg {...common}>
          <path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9" />
        </svg>
      );

    case "code":
      return (
        <svg {...common}>
          <path d="m8 9-4 3 4 3M16 9l4 3-4 3M14 5l-4 14" />
        </svg>
      );

    case "eye":
      return (
        <svg {...common}>
          <path d="M2.5 12s3.3-6 9.5-6 9.5 6 9.5 6-3.3 6-9.5 6-9.5-6-9.5-6z" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      );

    case "more":
      return (
        <svg {...common}>
          <circle
            cx="5"
            cy="12"
            r="1.3"
            fill="currentColor"
            stroke="none"
          />
          <circle
            cx="12"
            cy="12"
            r="1.3"
            fill="currentColor"
            stroke="none"
          />
          <circle
            cx="19"
            cy="12"
            r="1.3"
            fill="currentColor"
            stroke="none"
          />
        </svg>
      );

    case "spark":
      return (
        <svg {...common}>
          <path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z" />
          <path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" />
        </svg>
      );

    case "external":
      return (
        <svg {...common}>
          <path d="M14 4h6v6M20 4l-9 9" />
          <path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
        </svg>
      );

    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}

function CodeBlock({
  language,
  code,
}: {
  language: string;
  code: string;
}) {
  const [preview, setPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  const canLivePreview = [
    "html",
    "css",
    "javascript",
    "js",
    "svg",
  ].includes(language);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard permissions may be unavailable.
    }
  };

  const download = () => {
    const extensionMap: Record<string, string> = {
      html: "html",
      css: "css",
      javascript: "js",
      js: "js",
      typescript: "ts",
      jsx: "jsx",
      tsx: "tsx",
      python: "py",
      json: "json",
      markdown: "md",
      yaml: "yaml",
      sql: "sql",
      java: "java",
      c: "c",
      cpp: "cpp",
      csharp: "cs",
      go: "go",
      rust: "rs",
      php: "php",
      ruby: "rb",
      swift: "swift",
      kotlin: "kt",
      bash: "sh",
      shell: "sh",
      svg: "svg",
      text: "txt",
    };

    const blob = new Blob([code], {
      type: "text/plain;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `zuqen-code.${extensionMap[language] || "txt"}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="zuqen-code-shell">
      <div className="zuqen-code-top">
        <div className="zuqen-code-language">
          <Icon name="code" size={14} />
          <span>{getLanguageLabel(language)}</span>
        </div>

        <div className="zuqen-code-tools">
          {canLivePreview && (
            <button
              type="button"
              onClick={() => setPreview((value) => !value)}
            >
              <Icon name="eye" size={13} />
              {preview ? "Code" : "Preview"}
            </button>
          )}

          <button type="button" onClick={copy}>
            {copied ? (
              <Icon name="check" size={13} />
            ) : (
              <Icon name="copy" size={13} />
            )}
            {copied ? "Copied" : "Copy"}
          </button>

          <button type="button" onClick={download}>
            <Icon name="download" size={13} />
            Download
          </button>
        </div>
      </div>

      {preview && canLivePreview ? (
        <div className="zuqen-code-preview">
          <div className="zuqen-preview-bar">
            <span />
            <span />
            <span />
            <label>Live preview</label>
          </div>

          <iframe
            title="ZUQEN code preview"
            sandbox="allow-scripts"
            srcDoc={buildBrowserPreview(code, language)}
          />
        </div>
      ) : (
        <pre className="zuqen-code-content">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}

function MessageContent({
  content,
}: {
  content: string;
}) {
  const parts = splitCodeBlocks(content);

  return (
    <div className="zuqen-rich-message">
      {parts.map((part, index) => {
        if (part.type === "code") {
          return (
            <CodeBlock
              key={`code-${index}`}
              language={part.language}
              code={part.code}
            />
          );
        }

        if (!part.content) return null;

        return (
          <div
            className="zuqen-message-text"
            key={`text-${index}`}
          >
            {part.content}
          </div>
        );
      })}
    </div>
  );
}

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] =
    useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [archivedOpen, setArchivedOpen] = useState(false);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [selectedAgent, setSelectedAgent] =
    useState("ZUQEN AI");
  const [agentOpen, setAgentOpen] = useState(false);

  const [creditsOpen, setCreditsOpen] = useState(false);
  const [chatCredits, setChatCredits] =
    useState<number | null>(null);

  const [menuId, setMenuId] =
    useState<string | null>(null);
  const [renamingId, setRenamingId] =
    useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [editingId, setEditingId] =
    useState<string | null>(null);
  const [editingValue, setEditingValue] =
    useState("");

  const [attachments, setAttachments] = useState<
    Attachment[]
  >([]);

  const [lightMode, setLightMode] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const [showScrollToBottom, setShowScrollToBottom] =
    useState(false);

  const messagesContainerRef =
    useRef<HTMLDivElement | null>(null);
  const messagesEndRef =
    useRef<HTMLDivElement | null>(null);
  const textareaRef =
    useRef<HTMLTextAreaElement | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const userHasScrolledRef = useRef(false);

  const activeChat = useMemo(
    () =>
      chats.find((chat) => chat.id === activeChatId) ||
      null,
    [chats, activeChatId]
  );

  const visibleChats = useMemo(() => {
    const query = search.trim().toLowerCase();

    return chats
      .filter((chat) =>
        archivedOpen ? chat.archived : !chat.archived
      )
      .filter((chat) =>
        query
          ? chat.title.toLowerCase().includes(query)
          : true
      );
  }, [chats, archivedOpen, search]);

  const accountLabel = user?.is_anonymous
    ? "Guest account"
    : user?.email || "ZUQEN account";

  const accountStatus = user?.is_anonymous
    ? "Guest session"
    : "Signed in";

  const resetComposer = useCallback(() => {
    setInput("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, []);

  const loadChats = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("chats")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", {
        ascending: false,
      });

    if (error) {
      throw error;
    }

    const normalized = ((data || []) as Chat[]).map(
      (chat) => ({
        ...chat,
        messages: Array.isArray(chat.messages)
          ? chat.messages
          : [],
      })
    );

    setChats(normalized);
  }, []);

  const loadCredits = useCallback(
    async (userId: string) => {
      const { data, error } = await supabase
        .from("feature_credit_balances")
        .select("*")
        .eq("user_id", userId)
        .eq("feature_key", "chat")
        .maybeSingle();

      if (error) {
        console.error("Credit load error:", error);
        return;
      }

      if (!data) {
        setChatCredits(0);
        return;
      }

      const row = data as CreditRow;

      const balance =
        row.balance ??
        row.credits ??
        row.amount ??
        0;

      setChatCredits(Number(balance));
    },
    []
  );

  const initializeAuth = useCallback(async () => {
    try {
      setAuthReady(false);

      let {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        const result =
          await supabase.auth.signInAnonymously();

        if (result.error) {
          throw result.error;
        }

        session = result.data.session;
      }

      if (!session?.user) {
        throw new Error(
          "Unable to establish a ZUQEN session."
        );
      }

      const normalizedUser: User = {
        id: session.user.id,
        email: session.user.email,
        is_anonymous:
          session.user.is_anonymous ?? false,
      };

      setUser(normalizedUser);

      if (normalizedUser.is_anonymous) {
        try {
          await supabase.rpc(
            "setup_guest_chat_credits"
          );
        } catch {
          // Existing backend may already initialize guest credits.
        }
      }

      await Promise.all([
        loadChats(normalizedUser.id),
        loadCredits(normalizedUser.id),
      ]);
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to initialize ZUQEN."
      );
    } finally {
      setAuthReady(true);
    }
  }, [loadChats, loadCredits]);

  useEffect(() => {
    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!session?.user) {
          return;
        }

        const nextUser: User = {
          id: session.user.id,
          email: session.user.email,
          is_anonymous:
            session.user.is_anonymous ?? false,
        };

        setUser(nextUser);

        try {
          await Promise.all([
            loadChats(nextUser.id),
            loadCredits(nextUser.id),
          ]);
        } catch (error) {
          console.error(error);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
      abortRef.current?.abort();
    };
  }, [initializeAuth, loadChats, loadCredits]);

  useEffect(() => {
    const saved =
      window.localStorage.getItem("zuqen-theme");

    setLightMode(saved === "light");
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme =
      lightMode ? "light" : "dark";
  }, [lightMode]);

  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      return;
    }

    const chat = chats.find(
      (item) => item.id === activeChatId
    );

    setMessages(chat?.messages || []);
  }, [activeChatId, chats]);

  const scrollToLatest = useCallback(
    (smooth = true) => {
      messagesEndRef.current?.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
        block: "end",
      });

      userHasScrolledRef.current = false;
      setShowScrollToBottom(false);
    },
    []
  );

  useEffect(() => {
    if (!loading || !messagesContainerRef.current) {
      return;
    }

    if (!userHasScrolledRef.current) {
      scrollToLatest(false);
    }
  }, [messages, loading, scrollToLatest]);

  const handleMessagesScroll = () => {
    const element = messagesContainerRef.current;

    if (!element) return;

    const distance =
      element.scrollHeight -
      element.scrollTop -
      element.clientHeight;

    const awayFromBottom = distance > 140;

    setShowScrollToBottom(awayFromBottom);

    if (awayFromBottom) {
      userHasScrolledRef.current = true;
    } else {
      userHasScrolledRef.current = false;
    }
  };

  const createConversation = useCallback(async () => {
    if (!user) return null;

    const id = makeId();

    const newChat: Chat = {
      id,
      title: "New conversation",
      messages: [],
      archived: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("chats").insert({
      id,
      user_id: user.id,
      title: newChat.title,
      messages: [],
      archived: false,
    });

    if (error) {
      throw error;
    }

    setChats((previous) => [
      newChat,
      ...previous,
    ]);

    setActiveChatId(id);
    setMessages([]);
    setErrorMessage("");

    return newChat;
  }, [user]);

  const startNewChat = async () => {
    try {
      setMenuId(null);
      setEditingId(null);
      setRenamingId(null);
      resetComposer();

      await createConversation();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to create conversation."
      );
    }
  };

  const selectChat = (chat: Chat) => {
    setActiveChatId(chat.id);
    setMessages(chat.messages || []);
    setMenuId(null);
    setEditingId(null);
    setSearchOpen(false);

    if (window.innerWidth <= 900) {
      setSidebarOpen(false);
    }
  };

  const saveMessages = async (
    chatId: string,
    nextMessages: Message[],
    title?: string
  ) => {
    if (!user) return;

    const payload: Record<string, unknown> = {
      messages: nextMessages,
      updated_at: new Date().toISOString(),
    };

    if (title) {
      payload.title = title;
    }

    const { error } = await supabase
      .from("chats")
      .update(payload)
      .eq("id", chatId)
      .eq("user_id", user.id);

    if (error) {
      throw error;
    }

    setChats((previous) =>
      previous.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              messages: nextMessages,
              ...(title ? { title } : {}),
              updated_at:
                new Date().toISOString(),
            }
          : chat
      )
    );
  };

  const generateChatTitle = (text: string) => {
    const cleaned = text
      .replace(/\s+/g, " ")
      .trim();

    if (!cleaned) return "New conversation";

    const words = cleaned.split(" ");
    const title = words
      .slice(0, 7)
      .join(" ")
      .replace(/[.!?,;:]+$/, "");

    return title.length > 48
      ? `${title.slice(0, 48)}…`
      : title;
  };

  const renameChat = async (
    chatId: string,
    title: string
  ) => {
    const cleaned = title.trim();

    if (!cleaned) {
      setRenamingId(null);
      return;
    }

    try {
      if (!user) return;

      const { error } = await supabase
        .from("chats")
        .update({
          title: cleaned,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", chatId)
        .eq("user_id", user.id);

      if (error) throw error;

      setChats((previous) =>
        previous.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                title: cleaned,
                updated_at:
                  new Date().toISOString(),
              }
            : chat
        )
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to rename conversation."
      );
    } finally {
      setRenamingId(null);
      setMenuId(null);
    }
  };

  const archiveChat = async (
    chatId: string,
    archived: boolean
  ) => {
    try {
      if (!user) return;

      const { error } = await supabase
        .from("chats")
        .update({
          archived,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", chatId)
        .eq("user_id", user.id);

      if (error) throw error;

      setChats((previous) =>
        previous.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                archived,
                updated_at:
                  new Date().toISOString(),
              }
            : chat
        )
      );

      setMenuId(null);

      if (activeChatId === chatId && archived) {
        setActiveChatId(null);
        setMessages([]);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to update archive."
      );
    }
  };

  const deleteChat = async (chatId: string) => {
    try {
      if (!user) return;

      const { error } = await supabase
        .from("chats")
        .delete()
        .eq("id", chatId)
        .eq("user_id", user.id);

      if (error) throw error;

      setChats((previous) =>
        previous.filter((chat) => chat.id !== chatId)
      );

      if (activeChatId === chatId) {
        setActiveChatId(null);
        setMessages([]);
      }

      setMenuId(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to delete conversation."
      );
    }
  };

  const startRename = (chat: Chat) => {
    setRenamingId(chat.id);
    setRenameValue(chat.title);
    setMenuId(null);
  };

  const parseStreamLine = (line: string) => {
    const trimmed = line.trim();

    if (!trimmed) return null;

    if (trimmed.startsWith("data:")) {
      const data = trimmed.slice(5).trim();

      if (!data || data === "[DONE]") {
        return null;
      }

      try {
        return JSON.parse(data);
      } catch {
        return {
          content: data,
        };
      }
    }

    try {
      return JSON.parse(trimmed);
    } catch {
      return {
        content: trimmed,
      };
    }
  };

  const extractText = (payload: unknown): string => {
    if (typeof payload === "string") {
      return payload;
    }

    if (!payload || typeof payload !== "object") {
      return "";
    }

    const object = payload as Record<
      string,
      unknown
    >;

    const candidates = [
      object.content,
      object.text,
      object.delta,
      object.message,
      (
        object.choices as
          | Array<Record<string, unknown>>
          | undefined
      )?.[0]?.delta &&
        (
          object.choices as Array<
            Record<string, unknown>
          >
        )[0].delta &&
        (
          (
            object.choices as Array<
              Record<string, unknown>
            >
          )[0].delta as Record<string, unknown>
        ).content,
      (
        object.choices as
          | Array<Record<string, unknown>>
          | undefined
      )?.[0]?.message &&
        (
          (
            object.choices as Array<
              Record<string, unknown>
            >
          )[0].message as Record<string, unknown>
        ).content,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === "string") {
        return candidate;
      }
    }

    return "";
  };

  const sendMessage = async (
    explicitText?: string
  ) => {
    if (loading) return;
    if (!user) return;

    const text =
      explicitText !== undefined
        ? explicitText.trim()
        : input.trim();

    if (!text && attachments.length === 0) {
      return;
    }

    let chatId = activeChatId;

    try {
      setErrorMessage("");

      if (!chatId) {
        const newChat = await createConversation();

        if (!newChat) {
          throw new Error(
            "Unable to create conversation."
          );
        }

        chatId = newChat.id;
      }

      const userMessage: Message = {
        id: makeId(),
        role: "user",
        content: text,
        attachments:
          attachments.length > 0
            ? attachments
            : undefined,
      };

      const assistantMessage: Message = {
        id: makeId(),
        role: "assistant",
        content: "",
      };

      const baseMessages = [
        ...messages,
        userMessage,
        assistantMessage,
      ];

      setMessages(baseMessages);
      resetComposer();
      setAttachments([]);
      setLoading(true);
      userHasScrolledRef.current = false;

      const existingChat = chats.find(
        (chat) => chat.id === chatId
      );

      const title =
        existingChat?.title ===
          "New conversation" ||
        !existingChat
          ? generateChatTitle(text)
          : existingChat.title;

      await saveMessages(
        chatId,
        [
          ...messages,
          userMessage,
        ],
        title
      );

      abortRef.current = new AbortController();

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          chatId,
          messages: [
            ...messages,
            userMessage,
          ],
          attachments:
            userMessage.attachments || [],
          agent: selectedAgent,
        }),
      });

      if (!response.ok) {
        const body = await response.text();

        throw new Error(
          body || `Chat request failed (${response.status}).`
        );
      }

      if (!response.body) {
        throw new Error(
          "The AI response stream was unavailable."
        );
      }

      const reader =
        response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = "";
      let assistantText = "";

      while (true) {
        const { done, value } =
          await reader.read();

        if (done) break;

        buffer += decoder.decode(value, {
          stream: true,
        });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const payload = parseStreamLine(line);

          if (!payload) continue;

          const chunk = extractText(payload);

          if (!chunk) continue;

          assistantText += chunk;

          setMessages((previous) =>
            previous.map((message) =>
              message.id ===
              assistantMessage.id
                ? {
                    ...message,
                    content: assistantText,
                  }
                : message
            )
          );
        }
      }

      if (buffer.trim()) {
        const payload = parseStreamLine(buffer);
        const chunk = extractText(payload);

        if (chunk) {
          assistantText += chunk;

          setMessages((previous) =>
            previous.map((message) =>
              message.id === assistantMessage.id
                ? {
                    ...message,
                    content: assistantText,
                  }
                : message
            )
          );
        }
      }

      const finalAssistant: Message = {
        ...assistantMessage,
        content: assistantText,
      };

      const finalMessages = [
        ...messages,
        userMessage,
        finalAssistant,
      ];

      await saveMessages(
        chatId,
        finalMessages,
        title
      );

      await Promise.all([
        loadChats(user.id),
        loadCredits(user.id),
      ]);
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        const partial = messages;

        setMessages(partial);

        if (chatId && partial.length) {
          try {
            await saveMessages(
              chatId,
              partial
            );
          } catch {
            // Best effort save after stopping.
          }
        }

        return;
      }

      console.error(error);

      setMessages((previous) =>
        previous.filter(
          (message) =>
            !(
              message.role === "assistant" &&
              !message.content
            )
        )
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while talking to ZUQEN AI."
      );
    } finally {
      abortRef.current = null;
      setLoading(false);

      await loadCredits(user.id).catch(
        () => undefined
      );
    }
  };

  const stopGeneration = () => {
    abortRef.current?.abort();
    setLoading(false);
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      sendMessage();
    }
  };

  const handleAttachment = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(
      event.target.files || []
    );

    if (!files.length) return;

    try {
      setErrorMessage("");

      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(
          "/api/files/upload",
          {
            method: "POST",
            body: formData,
          }
        );

        if (!response.ok) {
          throw new Error(
            await response.text()
          );
        }

        const result = await response.json();

        const attachment: Attachment = {
          id:
            result.id ||
            result.file_id ||
            makeId(),
          name:
            result.name ||
            file.name,
          path:
            result.path ||
            result.file_path,
          file_path:
            result.file_path ||
            result.path,
          size:
            Number(result.size) ||
            file.size,
          content_type:
            result.content_type ||
            file.type,
          contentType:
            result.contentType ||
            file.type,
          url: result.url,
        };

        setAttachments((previous) => [
          ...previous,
          attachment,
        ]);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to upload attachment."
      );
    } finally {
      event.target.value = "";
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((previous) =>
      previous.filter((file) => file.id !== id)
    );
  };

  const copyMessage = async (
    content: string
  ) => {
    if (!content) return;

    try {
      await navigator.clipboard.writeText(content);
    } catch {
      // Clipboard unavailable.
    }
  };

  const startEditMessage = (
    message: Message
  ) => {
    setEditingId(message.id);
    setEditingValue(message.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingValue("");
  };

  const saveEditedMessage = async (
    messageId: string
  ) => {
    const value = editingValue.trim();

    if (!value) return;

    const index = messages.findIndex(
      (message) => message.id === messageId
    );

    if (index < 0) return;

    const previousMessages =
      messages.slice(0, index);

    setEditingId(null);
    setEditingValue("");

    setMessages(previousMessages);

    if (activeChatId) {
      try {
        await saveMessages(
          activeChatId,
          previousMessages
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to save edited message."
        );
        return;
      }
    }

    await sendMessage(value);
  };

  const regenerate = async () => {
    if (loading || messages.length < 2) {
      return;
    }

    const lastUserIndex =
      [...messages]
        .map((message, index) => ({
          message,
          index,
        }))
        .reverse()
        .find(
          ({ message }) =>
            message.role === "user"
        )?.index;

    if (
      lastUserIndex === undefined
    ) {
      return;
    }

    const previousMessages =
      messages.slice(0, lastUserIndex);

    const userMessage =
      messages[lastUserIndex];

    setMessages(previousMessages);

    if (activeChatId) {
      await saveMessages(
        activeChatId,
        previousMessages
      );
    }

    await sendMessage(userMessage.content);
  };

  const handleAuthNavigation = () => {
    window.location.href = "/auth";
  };

  const handleSignOut = async () => {
    if (signingOut) return;

    try {
      setSigningOut(true);
      abortRef.current?.abort();

      const { error } =
        await supabase.auth.signOut();

      if (error) throw error;

      window.location.href = "/auth";
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to sign out."
      );
    } finally {
      setSigningOut(false);
    }
  };

  const navigateAgent = (
    agent: (typeof AGENTS)[number]
  ) => {
    setAgentOpen(false);

    if (!agent.route) {
      setSelectedAgent(agent.name);
      return;
    }

    window.location.href = agent.route;
  };

  const toggleTheme = () => {
    setLightMode((previous) => {
      const next = !previous;

      window.localStorage.setItem(
        "zuqen-theme",
        next ? "light" : "dark"
      );

      return next;
    });
  };

  return (
    <main
      className={`zuqen-app ${
        lightMode ? "light" : "dark"
      }`}
    >
      <style>{`
        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          padding: 0;
          min-height: 100%;
        }

        body {
          background: #0b0c0f;
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
          border: 0;
        }

        .zuqen-app {
          --bg: #0b0c0f;
          --sidebar: #101116;
          --panel: #15171d;
          --panel-2: #1b1e25;
          --panel-3: #20232b;
          --text: #f5f7fb;
          --muted: #a5a9b4;
          --muted-2: #707582;
          --border: rgba(255,255,255,.075);
          --border-strong: rgba(255,255,255,.12);
          --accent: #ffffff;
          --accent-text: #090a0d;
          --danger: #ff6d78;
          --shadow:
            0 25px 80px rgba(0,0,0,.42);

          width: 100%;
          height: 100vh;
          min-height: 620px;
          display: flex;
          overflow: hidden;
          color: var(--text);
          background: var(--bg);
        }

        .zuqen-app.light {
          --bg: #f7f7f8;
          --sidebar: #eeeeef;
          --panel: #ffffff;
          --panel-2: #f0f1f3;
          --panel-3: #e6e7ea;
          --text: #18191d;
          --muted: #656872;
          --muted-2: #92959e;
          --border: rgba(0,0,0,.075);
          --border-strong: rgba(0,0,0,.13);
          --accent: #18191d;
          --accent-text: #ffffff;
          --shadow:
            0 25px 80px rgba(0,0,0,.12);
        }

        .zuqen-sidebar {
          width: 285px;
          flex: 0 0 285px;
          height: 100vh;
          display: flex;
          flex-direction: column;
          background: var(--sidebar);
          border-right: 1px solid var(--border);
          transition:
            width .24s ease,
            flex-basis .24s ease,
            transform .24s ease;
          z-index: 50;
        }

        .zuqen-sidebar.closed {
          width: 0;
          flex-basis: 0;
          overflow: hidden;
          border-right: 0;
        }

        .zuqen-brand {
          height: 68px;
          padding: 0 18px;
          display: flex;
          align-items: center;
          gap: 11px;
          flex: 0 0 68px;
        }

        .zuqen-brand-logo {
          width: 35px;
          height: 35px;
          display: grid;
          place-items: center;
          border-radius: 11px;
          color: #fff;
          background:
            linear-gradient(
              135deg,
              #ffffff,
              #8e939e
            );
          box-shadow:
            0 8px 25px rgba(255,255,255,.08);
        }

        .zuqen-brand-logo::after {
          content: "Z";
          color: #0b0c0f;
          font-size: 17px;
          font-weight: 900;
        }

        .zuqen-brand-name {
          font-size: 13px;
          font-weight: 850;
          letter-spacing: .8px;
        }

        .zuqen-brand-sub {
          margin-top: 2px;
          color: var(--muted-2);
          font-size: 9px;
        }

        .zuqen-sidebar-content {
          min-height: 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 8px 10px 12px;
        }

        .zuqen-new-chat {
          height: 43px;
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 12px;
          border-radius: 11px;
          color: var(--text);
          background: var(--panel-2);
          cursor: pointer;
          font-size: 11px;
          font-weight: 700;
          transition: .16s ease;
        }

        .zuqen-new-chat:hover {
          background: var(--panel-3);
          transform: translateY(-1px);
        }

        .zuqen-sidebar-section {
          min-height: 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          margin-top: 22px;
        }

        .zuqen-sidebar-heading {
          height: 29px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 8px;
          color: var(--muted-2);
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .8px;
        }

        .zuqen-sidebar-heading button {
          width: 28px;
          height: 28px;
          display: grid;
          place-items: center;
          border-radius: 8px;
          color: var(--muted);
          background: transparent;
          cursor: pointer;
        }

        .zuqen-sidebar-heading button:hover {
          color: var(--text);
          background: var(--panel-2);
        }

        .zuqen-chat-list {
          min-height: 0;
          flex: 1;
          overflow-y: auto;
          padding-right: 2px;
        }

        .zuqen-chat-list::-webkit-scrollbar,
        .zuqen-messages::-webkit-scrollbar {
          width: 5px;
        }

        .zuqen-chat-list::-webkit-scrollbar-thumb,
        .zuqen-messages::-webkit-scrollbar-thumb {
          background: var(--panel-3);
          border-radius: 999px;
        }

        .zuqen-chat-item {
          position: relative;
          min-height: 52px;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 5px 6px 10px;
          margin-bottom: 2px;
          border-radius: 10px;
          cursor: pointer;
          transition: .15s ease;
        }

        .zuqen-chat-item:hover {
          background: var(--panel-2);
        }

        .zuqen-chat-item.active {
          background: var(--panel-2);
        }

        .zuqen-chat-main {
          min-width: 0;
          flex: 1;
        }

        .zuqen-chat-title {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--text);
          font-size: 11px;
          line-height: 1.4;
        }

        .zuqen-chat-date {
          margin-top: 3px;
          color: var(--muted-2);
          font-size: 8px;
        }

        .zuqen-chat-menu-button {
          width: 30px;
          height: 30px;
          flex: 0 0 30px;
          display: grid;
          place-items: center;
          border-radius: 8px;
          color: var(--muted-2);
          background: transparent;
          cursor: pointer;
          opacity: 0;
          transition: .15s ease;
        }

        .zuqen-chat-item:hover .zuqen-chat-menu-button,
        .zuqen-chat-menu-button.open {
          opacity: 1;
        }

        .zuqen-chat-menu-button:hover,
        .zuqen-chat-menu-button.open {
          color: var(--text);
          background: var(--panel-3);
        }

        .zuqen-rename {
          width: 100%;
          height: 31px;
          padding: 0 7px;
          border: 1px solid var(--border-strong);
          border-radius: 7px;
          outline: none;
          color: var(--text);
          background: var(--panel);
          font-size: 10px;
        }

        .zuqen-floating-menu {
          position: absolute;
          right: 8px;
          top: 43px;
          width: 155px;
          padding: 5px;
          border: 1px solid var(--border-strong);
          border-radius: 12px;
          background: var(--panel);
          box-shadow: var(--shadow);
          z-index: 100;
        }

        .zuqen-menu-item {
          width: 100%;
          height: 35px;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 0 9px;
          border-radius: 8px;
          color: var(--muted);
          background: transparent;
          text-align: left;
          cursor: pointer;
          font-size: 10px;
        }

        .zuqen-menu-item:hover {
          color: var(--text);
          background: var(--panel-2);
        }

        .zuqen-menu-item.danger {
          color: var(--danger);
        }

        .zuqen-sidebar-bottom {
          padding: 12px 3px 2px;
          border-top: 1px solid var(--border);
        }

        .zuqen-sidebar-user {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 8px;
          margin-bottom: 7px;
        }

        .zuqen-user-dot {
          width: 31px;
          height: 31px;
          flex: 0 0 31px;
          display: grid;
          place-items: center;
          border-radius: 9px;
          background: var(--panel-3);
          color: var(--text);
          font-size: 10px;
          font-weight: 800;
        }

        .zuqen-user-info {
          min-width: 0;
        }

        .zuqen-user-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 10px;
          font-weight: 700;
        }

        .zuqen-user-status {
          margin-top: 2px;
          color: var(--muted-2);
          font-size: 8px;
        }

        .zuqen-auth-button {
          width: 100%;
          height: 37px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border-radius: 9px;
          color: var(--muted);
          background: var(--panel-2);
          cursor: pointer;
          font-size: 9px;
          font-weight: 700;
        }

        .zuqen-auth-button:hover {
          color: var(--text);
          background: var(--panel-3);
        }

        .zuqen-auth-button.primary {
          color: var(--accent-text);
          background: var(--accent);
        }

        .zuqen-main {
          min-width: 0;
          min-height: 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          background: var(--bg);
        }

        .zuqen-topbar {
          position: relative;
          height: 68px;
          flex: 0 0 68px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 18px;
          border-bottom: 1px solid var(--border);
          background: color-mix(
            in srgb,
            var(--bg) 90%,
            transparent
          );
          z-index: 40;
        }

        .zuqen-top-left,
        .zuqen-top-right {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .zuqen-icon-button {
          width: 37px;
          height: 37px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          color: var(--muted);
          background: transparent;
          cursor: pointer;
          transition: .16s ease;
        }

        .zuqen-icon-button:hover {
          color: var(--text);
          background: var(--panel-2);
        }

        .zuqen-agent-selector,
        .zuqen-credit-wrap {
          position: relative;
        }

        .zuqen-agent-button {
          min-width: 185px;
          height: 43px;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 0 10px;
          border: 1px solid var(--border);
          border-radius: 12px;
          color: var(--text);
          background: var(--panel);
          cursor: pointer;
          text-align: left;
        }

        .zuqen-agent-button:hover {
          border-color: var(--border-strong);
          background: var(--panel-2);
        }

        .zuqen-agent-button-icon {
          width: 27px;
          height: 27px;
          display: grid;
          place-items: center;
          border-radius: 8px;
          color: var(--accent-text);
          background: var(--accent);
          font-size: 13px;
        }

        .zuqen-agent-button-text {
          min-width: 0;
          flex: 1;
        }

        .zuqen-agent-button-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 10px;
          font-weight: 800;
        }

        .zuqen-agent-button-sub {
          margin-top: 2px;
          color: var(--muted-2);
          font-size: 8px;
        }

        .zuqen-agent-dropdown {
          position: absolute;
          left: 0;
          top: calc(100% + 8px);
          width: 300px;
          padding: 7px;
          border: 1px solid var(--border-strong);
          border-radius: 15px;
          background: var(--panel);
          box-shadow: var(--shadow);
          z-index: 100;
        }

        .zuqen-agent-option {
          width: 100%;
          min-height: 57px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px;
          border-radius: 10px;
          color: var(--muted);
          background: transparent;
          cursor: pointer;
          text-align: left;
        }

        .zuqen-agent-option:hover,
        .zuqen-agent-option.selected {
          color: var(--text);
          background: var(--panel-2);
        }

        .zuqen-agent-option-icon {
          width: 31px;
          height: 31px;
          display: grid;
          place-items: center;
          border-radius: 9px;
          background: var(--panel-3);
          color: var(--text);
          font-size: 13px;
        }

        .zuqen-agent-option-content {
          min-width: 0;
          flex: 1;
        }

        .zuqen-agent-option-name {
          font-size: 10px;
          font-weight: 800;
        }

        .zuqen-agent-option-description {
          margin-top: 3px;
          color: var(--muted-2);
          font-size: 8px;
        }

        .zuqen-agent-check {
          color: var(--text);
        }

        .zuqen-top-action {
          height: 38px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 0 12px;
          border: 1px solid var(--border);
          border-radius: 10px;
          color: var(--muted);
          background: var(--panel);
          cursor: pointer;
          font-size: 9px;
          font-weight: 750;
          transition: .16s ease;
        }

        .zuqen-top-action:hover {
          color: var(--text);
          border-color: var(--border-strong);
          background: var(--panel-2);
          transform: translateY(-1px);
        }

        .automation-action span:first-child {
          font-size: 13px;
        }

        .templates-action span:first-child {
          font-size: 15px;
        }

        .zuqen-credit-button {
          height: 38px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 0 11px;
          border: 1px solid var(--border);
          border-radius: 10px;
          color: var(--muted);
          background: var(--panel);
          cursor: pointer;
        }

        .zuqen-credit-button:hover {
          color: var(--text);
          background: var(--panel-2);
        }

        .zuqen-credit-icon {
          font-size: 14px;
        }

        .zuqen-credit-count {
          color: var(--text);
          font-size: 10px;
          font-weight: 800;
        }

        .zuqen-credit-label {
          font-size: 8px;
        }

        .zuqen-credit-dropdown {
          position: absolute;
          right: 0;
          top: calc(100% + 8px);
          width: 245px;
          padding: 15px;
          border: 1px solid var(--border-strong);
          border-radius: 14px;
          background: var(--panel);
          box-shadow: var(--shadow);
          z-index: 100;
        }

        .zuqen-credit-dropdown-title {
          color: var(--muted);
          font-size: 9px;
          font-weight: 750;
        }

        .zuqen-credit-big {
          margin-top: 7px;
          color: var(--text);
          font-size: 27px;
          font-weight: 850;
          letter-spacing: -1px;
        }

        .zuqen-credit-small {
          margin-top: 2px;
          color: var(--muted-2);
          font-size: 8px;
        }

        .zuqen-credit-line {
          height: 1px;
          margin: 13px 0;
          background: var(--border);
        }

        .zuqen-credit-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 8px;
          color: var(--muted);
          font-size: 9px;
        }

        .zuqen-credit-row strong {
          color: var(--text);
          font-size: 9px;
        }

        .zuqen-search-overlay {
          position: absolute;
          top: 76px;
          left: 18px;
          width: min(430px, calc(100% - 36px));
          padding: 8px;
          border: 1px solid var(--border-strong);
          border-radius: 14px;
          background: var(--panel);
          box-shadow: var(--shadow);
          z-index: 80;
        }

        .zuqen-search-input-wrap {
          height: 40px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 10px;
          border-radius: 10px;
          background: var(--panel-2);
          color: var(--muted);
        }

        .zuqen-search-input-wrap input {
          min-width: 0;
          flex: 1;
          border: 0;
          outline: 0;
          color: var(--text);
          background: transparent;
          font-size: 10px;
        }

        .zuqen-search-input-wrap button {
          display: grid;
          place-items: center;
          color: var(--muted);
          background: transparent;
          cursor: pointer;
        }

        .zuqen-content {
          position: relative;
          min-height: 0;
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .zuqen-home {
          min-height: 100%;
          flex: 1;
          overflow-y: auto;
          display: flex;
          justify-content: center;
          padding: 70px 24px 60px;
        }

        .zuqen-home-inner {
          width: min(900px, 100%);
          margin: auto;
        }

        .zuqen-welcome {
          text-align: center;
        }

        .zuqen-welcome-mark {
          width: 54px;
          height: 54px;
          margin: 0 auto 19px;
          display: grid;
          place-items: center;
          border-radius: 17px;
          background: var(--panel);
          border: 1px solid var(--border);
          box-shadow: 0 20px 50px rgba(0,0,0,.16);
        }

        .zuqen-welcome-mark span {
          width: 18px;
          height: 18px;
          display: block;
          border-radius: 6px 10px 6px 10px;
          background: var(--accent);
          transform: rotate(45deg);
        }

        .zuqen-welcome h1 {
          margin: 0;
          color: var(--text);
          font-size: clamp(35px, 5vw, 58px);
          line-height: 1.02;
          letter-spacing: -3px;
          font-weight: 820;
        }

        .zuqen-welcome p {
          width: min(590px, 100%);
          margin: 18px auto 0;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.7;
        }

        .zuqen-search-card {
          height: 62px;
          margin-top: 35px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 14px;
          border: 1px solid var(--border-strong);
          border-radius: 18px;
          background: var(--panel);
          box-shadow: 0 20px 70px rgba(0,0,0,.16);
        }

        .zuqen-search-card-icon {
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          border-radius: 11px;
          color: var(--muted);
          background: var(--panel-2);
        }

        .zuqen-search-card input {
          min-width: 0;
          flex: 1;
          border: 0;
          outline: 0;
          color: var(--text);
          background: transparent;
          font-size: 12px;
        }

        .zuqen-search-card input::placeholder {
          color: var(--muted-2);
        }

        .zuqen-search-shortcut {
          padding: 6px 8px;
          border: 1px solid var(--border);
          border-radius: 7px;
          color: var(--muted-2);
          font-size: 8px;
        }

        .zuqen-suggestion-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 9px;
          margin-top: 12px;
        }

        .zuqen-suggestion {
          min-height: 116px;
          padding: 14px;
          border: 1px solid var(--border);
          border-radius: 14px;
          color: var(--text);
          background: var(--panel);
          cursor: pointer;
          text-align: left;
          transition: .18s ease;
        }

        .zuqen-suggestion:hover {
          border-color: var(--border-strong);
          transform: translateY(-2px);
          background: var(--panel-2);
        }

        .zuqen-suggestion-icon {
          width: 29px;
          height: 29px;
          display: grid;
          place-items: center;
          border-radius: 9px;
          color: var(--text);
          background: var(--panel-2);
          font-size: 12px;
        }

        .zuqen-suggestion-title {
          margin-top: 13px;
          font-size: 10px;
          font-weight: 800;
        }

        .zuqen-suggestion-text {
          margin-top: 5px;
          color: var(--muted-2);
          font-size: 8px;
          line-height: 1.45;
        }

        .zuqen-agent-strip {
          margin-top: 36px;
        }

        .zuqen-strip-title {
          margin-bottom: 10px;
          color: var(--muted-2);
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .8px;
        }

        .zuqen-agent-cards {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 9px;
        }

        .zuqen-mini-agent {
          min-width: 0;
          min-height: 105px;
          padding: 13px;
          border: 1px solid var(--border);
          border-radius: 13px;
          color: var(--text);
          background: var(--panel);
          text-align: left;
          cursor: pointer;
          transition: .18s ease;
        }

        .zuqen-mini-agent:hover {
          background: var(--panel-2);
          border-color: var(--border-strong);
          transform: translateY(-2px);
        }

        .zuqen-mini-agent-icon {
          width: 27px;
          height: 27px;
          display: grid;
          place-items: center;
          border-radius: 8px;
          background: var(--panel-2);
          font-size: 11px;
        }

        .zuqen-mini-agent-name {
          margin-top: 10px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 9px;
          font-weight: 800;
        }

        .zuqen-mini-agent-desc {
          margin-top: 4px;
          color: var(--muted-2);
          font-size: 7px;
          line-height: 1.45;
        }

        .zuqen-chat-view {
          min-height: 0;
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .zuqen-messages {
          position: relative;
          min-height: 0;
          flex: 1;
          overflow-y: auto;
          padding: 34px 24px 30px;
        }

        .zuqen-message-list {
          width: min(860px, 100%);
          margin: 0 auto;
        }

        .zuqen-message-row {
          display: flex;
          margin-bottom: 30px;
        }

        .zuqen-message-row.user {
          justify-content: flex-end;
        }

        .zuqen-message-row.assistant {
          justify-content: flex-start;
        }

        .zuqen-message-block {
          width: fit-content;
          max-width: min(820px, 92%);
          display: flex;
          flex-direction: column;
        }

        .zuqen-message-label {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 8px;
          color: var(--muted-2);
          font-size: 9px;
          font-weight: 800;
        }

        .user .zuqen-message-label {
          justify-content: flex-end;
        }

        .zuqen-message-label-mark {
          width: 23px;
          height: 23px;
          display: grid;
          place-items: center;
          border-radius: 8px;
          color: var(--text);
          background: var(--panel-2);
          font-size: 8px;
        }

        .assistant .zuqen-message-label-mark {
          color: var(--accent-text);
          background: var(--accent);
          font-size: 10px;
        }

        .zuqen-message-bubble {
          max-width: 100%;
          padding: 14px 16px;
          border: 1px solid var(--border);
          border-radius: 18px;
          color: var(--text);
          background: var(--panel);
          overflow-wrap: anywhere;
          box-shadow: 0 8px 35px rgba(0,0,0,.07);
        }

        .user .zuqen-message-bubble {
          border-top-right-radius: 6px;
          background: var(--panel-2);
        }

        .assistant .zuqen-message-bubble {
          border-top-left-radius: 6px;
        }

        .zuqen-rich-message {
          font-size: 13px;
          line-height: 1.65;
        }

        .zuqen-message-text {
          white-space: pre-wrap;
        }

        .zuqen-message-text + .zuqen-code-shell,
        .zuqen-code-shell + .zuqen-message-text,
        .zuqen-code-shell + .zuqen-code-shell {
          margin-top: 13px;
        }

        .zuqen-code-shell {
          overflow: hidden;
          border: 1px solid var(--border-strong);
          border-radius: 13px;
          background: #0a0b0e;
          box-shadow: 0 15px 45px rgba(0,0,0,.2);
        }

        .zuqen-code-top {
          min-height: 42px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 0 9px 0 13px;
          border-bottom: 1px solid rgba(255,255,255,.07);
          background: #111318;
        }

        .zuqen-code-language {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #dfe3eb;
          font-size: 9px;
          font-weight: 800;
        }

        .zuqen-code-tools {
          display: flex;
          align-items: center;
          gap: 3px;
        }

        .zuqen-code-tools button {
          height: 29px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 0 8px;
          border-radius: 7px;
          color: #a9aeb9;
          background: transparent;
          cursor: pointer;
          font-size: 8px;
          font-weight: 700;
        }

        .zuqen-code-tools button:hover {
          color: #fff;
          background: rgba(255,255,255,.07);
        }

        .zuqen-code-content {
          max-height: 480px;
          overflow: auto;
          margin: 0;
          padding: 17px;
          color: #e9ecf2;
          font-family:
            "SFMono-Regular",
            Consolas,
            "Liberation Mono",
            monospace;
          font-size: 11px;
          line-height: 1.65;
          white-space: pre;
        }

        .zuqen-code-content::-webkit-scrollbar,
        .zuqen-code-preview iframe::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }

        .zuqen-code-content::-webkit-scrollbar-thumb {
          background: #30343d;
          border-radius: 999px;
        }

        .zuqen-code-preview {
          background: #fff;
        }

        .zuqen-preview-bar {
          height: 31px;
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 0 10px;
          background: #eceef1;
        }

        .zuqen-preview-bar span {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #b7bbc2;
        }

        .zuqen-preview-bar label {
          margin-left: 5px;
          color: #70747d;
          font-size: 8px;
          font-weight: 700;
        }

        .zuqen-code-preview iframe {
          display: block;
          width: 100%;
          height: 390px;
          border: 0;
          background: #fff;
        }

        .zuqen-message-actions {
          display: flex;
          align-items: center;
          gap: 3px;
          margin-top: 6px;
        }

        .user .zuqen-message-actions {
          justify-content: flex-end;
        }

        .zuqen-action {
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          border-radius: 8px;
          color: var(--muted-2);
          background: transparent;
          cursor: pointer;
        }

        .zuqen-action:hover {
          color: var(--text);
          background: var(--panel-2);
        }

        .zuqen-action:disabled {
          opacity: .35;
          cursor: not-allowed;
        }

        .zuqen-typing {
          min-height: 24px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .zuqen-typing span {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--muted);
          animation: zuqenTyping 1.1s infinite ease-in-out;
        }

        .zuqen-typing span:nth-child(2) {
          animation-delay: .15s;
        }

        .zuqen-typing span:nth-child(3) {
          animation-delay: .3s;
        }

        @keyframes zuqenTyping {
          0%, 60%, 100% {
            opacity: .35;
            transform: translateY(0);
          }
          30% {
            opacity: 1;
            transform: translateY(-4px);
          }
        }

        .zuqen-edit-box {
          padding: 12px;
          border: 1px solid var(--border-strong);
          border-radius: 15px;
          background: var(--panel);
        }

        .zuqen-edit-box textarea {
          width: 100%;
          min-height: 110px;
          resize: vertical;
          border: 0;
          outline: 0;
          color: var(--text);
          background: transparent;
          font-size: 13px;
          line-height: 1.6;
        }

        .zuqen-edit-actions {
          display: flex;
          justify-content: flex-end;
          gap: 7px;
          margin-top: 8px;
        }

        .zuqen-small-button {
          height: 33px;
          padding: 0 12px;
          border-radius: 9px;
          color: var(--muted);
          background: var(--panel-2);
          cursor: pointer;
          font-size: 9px;
          font-weight: 750;
        }

        .zuqen-small-button:hover {
          color: var(--text);
          background: var(--panel-3);
        }

        .zuqen-small-button.primary {
          color: var(--accent-text);
          background: var(--accent);
        }

        .zuqen-attachment-list {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 9px;
        }

        .zuqen-attachment-chip {
          min-width: 0;
          max-width: 260px;
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 7px 8px 7px 10px;
          border: 1px solid var(--border);
          border-radius: 9px;
          color: var(--muted);
          background: var(--panel-3);
          font-size: 8px;
        }

        .zuqen-attachment-chip-name {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .zuqen-attachment-remove {
          width: 21px;
          height: 21px;
          display: grid;
          place-items: center;
          color: var(--muted-2);
          background: transparent;
          cursor: pointer;
        }

        .zuqen-composer-area {
          padding: 10px 20px 18px;
          background:
            linear-gradient(
              to top,
              var(--bg) 72%,
              transparent
            );
        }

        .zuqen-composer {
          width: min(900px, 100%);
          margin: 0 auto;
          overflow: hidden;
          border: 1px solid var(--border-strong);
          border-radius: 20px;
          background: var(--panel);
          box-shadow:
            0 18px 60px rgba(0,0,0,.18);
        }

        .zuqen-composer-row {
          min-height: 60px;
          display: flex;
          align-items: flex-end;
          gap: 7px;
          padding: 9px;
        }

        .zuqen-composer textarea {
          min-width: 0;
          min-height: 42px;
          max-height: 210px;
          flex: 1;
          resize: none;
          border: 0;
          outline: 0;
          padding: 11px 7px;
          color: var(--text);
          background: transparent;
          font-size: 12px;
          line-height: 1.55;
        }

        .zuqen-composer textarea::placeholder {
          color: var(--muted-2);
        }

        .zuqen-composer-button {
          width: 40px;
          height: 40px;
          flex: 0 0 40px;
          display: grid;
          place-items: center;
          border-radius: 11px;
          color: var(--muted);
          background: var(--panel-2);
          cursor: pointer;
          transition: .15s ease;
        }

        .zuqen-composer-button:hover {
          color: var(--text);
          background: var(--panel-3);
        }

        .zuqen-composer-button input {
          display: none;
        }

        .zuqen-send {
          color: var(--accent-text);
          background: var(--accent);
        }

        .zuqen-send:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .zuqen-send:disabled {
          opacity: .3;
          cursor: not-allowed;
          transform: none;
        }

        .zuqen-more-wrap {
          position: relative;
        }

        .zuqen-more-menu {
          position: absolute;
          left: 0;
          bottom: 48px;
          width: 185px;
          padding: 6px;
          border: 1px solid var(--border-strong);
          border-radius: 12px;
          background: var(--panel);
          box-shadow: var(--shadow);
          z-index: 100;
        }

        .zuqen-more-item {
          width: 100%;
          height: 36px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 9px;
          border-radius: 8px;
          color: var(--muted);
          background: transparent;
          text-align: left;
          cursor: pointer;
          font-size: 9px;
          font-weight: 700;
        }

        .zuqen-more-item:hover {
          color: var(--text);
          background: var(--panel-2);
        }

        .zuqen-composer-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 13px 9px 57px;
          color: var(--muted-2);
          font-size: 7px;
        }

        .zuqen-scroll-latest {
          position: absolute;
          left: 50%;
          bottom: 18px;
          transform: translateX(-50%);
          height: 35px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 0 12px;
          border: 1px solid var(--border-strong);
          border-radius: 999px;
          color: var(--text);
          background: var(--panel);
          box-shadow: 0 12px 35px rgba(0,0,0,.22);
          cursor: pointer;
          z-index: 20;
          font-size: 9px;
          font-weight: 800;
        }

        .zuqen-scroll-latest:hover {
          background: var(--panel-2);
        }

        .zuqen-empty-chat {
          min-height: 100%;
          display: grid;
          place-items: center;
          text-align: center;
          color: var(--muted);
        }

        .zuqen-empty-chat-inner {
          max-width: 420px;
          padding: 35px;
        }

        .zuqen-empty-chat-icon {
          width: 51px;
          height: 51px;
          margin: 0 auto 15px;
          display: grid;
          place-items: center;
          border-radius: 16px;
          color: var(--text);
          background: var(--panel-2);
        }

        .zuqen-empty-chat h2 {
          margin: 0;
          color: var(--text);
          font-size: 21px;
          letter-spacing: -.6px;
        }

        .zuqen-empty-chat p {
          margin: 8px 0 0;
          color: var(--muted);
          font-size: 11px;
          line-height: 1.6;
        }

        .zuqen-error {
          width: min(900px, calc(100% - 40px));
          margin: 10px auto 0;
          padding: 10px 12px;
          display: flex;
          align-items: flex-start;
          gap: 8px;
          border: 1px solid rgba(255,90,100,.2);
          border-radius: 11px;
          color: #ffabb2;
          background: rgba(255,75,85,.08);
          font-size: 9px;
          line-height: 1.5;
          z-index: 10;
        }

        .zuqen-error > button {
          margin-left: auto;
          color: inherit;
          background: transparent;
          cursor: pointer;
        }

        .zuqen-mobile-overlay {
          display: none;
        }

        @media (max-width: 1100px) {
          .zuqen-top-action span:last-child {
            display: none;
          }

          .zuqen-top-action {
            width: 38px;
            padding: 0;
            justify-content: center;
          }

          .zuqen-agent-button {
            min-width: 155px;
          }
        }

        @media (max-width: 900px) {
          .zuqen-sidebar {
            position: fixed;
            left: 0;
            top: 0;
            bottom: 0;
            width: 285px;
            flex-basis: 285px;
            box-shadow: 25px 0 80px rgba(0,0,0,.3);
          }

          .zuqen-sidebar.closed {
            width: 285px;
            flex-basis: 285px;
            transform: translateX(-105%);
          }

          .zuqen-mobile-overlay {
            position: fixed;
            inset: 0;
            display: block;
            background: rgba(0,0,0,.45);
            z-index: 45;
          }

          .zuqen-topbar {
            padding: 0 10px;
          }

          .zuqen-agent-button {
            min-width: 145px;
          }

          .zuqen-suggestion-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .zuqen-agent-cards {
            grid-template-columns: repeat(2, 1fr);
          }

          .zuqen-messages {
            padding: 24px 13px;
          }

          .zuqen-composer-area {
            padding: 8px 10px 13px;
          }

          .zuqen-credit-label {
            display: none;
          }
        }

        @media (max-width: 620px) {
          .zuqen-top-left {
            gap: 2px;
          }

          .zuqen-top-right {
            gap: 2px;
          }

          .zuqen-agent-button {
            min-width: 42px;
            width: 42px;
            padding: 0;
            justify-content: center;
          }

          .zuqen-agent-button-text,
          .zuqen-agent-button > svg {
            display: none;
          }

          .zuqen-credit-button {
            width: 40px;
            padding: 0;
            justify-content: center;
          }

          .zuqen-credit-count,
          .zuqen-credit-label {
            display: none;
          }

          .zuqen-top-action {
            display: none;
          }

          .zuqen-home {
            padding: 45px 14px 35px;
          }

          .zuqen-welcome h1 {
            font-size: 37px;
            letter-spacing: -2px;
          }

          .zuqen-welcome p {
            font-size: 10px;
          }

          .zuqen-search-card {
            height: 56px;
            margin-top: 27px;
          }

          .zuqen-suggestion-grid {
            grid-template-columns: 1fr 1fr;
          }

          .zuqen-suggestion {
            min-height: 105px;
          }

          .zuqen-agent-cards {
            grid-template-columns: 1fr 1fr;
          }

          .zuqen-message-block {
            max-width: 96%;
          }

          .zuqen-message-bubble {
            padding: 12px;
          }

          .zuqen-code-top {
            align-items: flex-start;
            flex-direction: column;
            padding: 8px;
          }

          .zuqen-code-tools {
            width: 100%;
            overflow-x: auto;
          }

          .zuqen-code-tools button {
            flex: 0 0 auto;
          }

          .zuqen-composer-footer span:first-child {
            display: none;
          }

          .zuqen-composer-footer {
            justify-content: flex-end;
            padding-left: 9px;
          }
        }
      `}</style>

      {!sidebarOpen && (
        <div
          className="zuqen-mobile-overlay"
          onClick={() => setSidebarOpen(true)}
        />
      )}

      <aside
        className={`zuqen-sidebar ${
          sidebarOpen ? "" : "closed"
        }`}
      >
        <div className="zuqen-brand">
          <div className="zuqen-brand-logo" />

          <div>
            <div className="zuqen-brand-name">
              ZUQEN AI
            </div>
            <div className="zuqen-brand-sub">
              Intelligent workspace
            </div>
          </div>
        </div>

        <div className="zuqen-sidebar-content">
          <button
            className="zuqen-new-chat"
            onClick={startNewChat}
          >
            <Icon name="plus" size={16} />
            <span>New chat</span>
          </button>

          <div className="zuqen-sidebar-section">
            <div className="zuqen-sidebar-heading">
              <span>
                {archivedOpen
                  ? "Archived"
                  : "Chats"}
              </span>

              <button
                title={
                  archivedOpen
                    ? "Back to chats"
                    : "Open archived chats"
                }
                onClick={() =>
                  setArchivedOpen(
                    (value) => !value
                  )
                }
              >
                <Icon
                  name={
                    archivedOpen
                      ? "restore"
                      : "archive"
                  }
                  size={14}
                />
              </button>
            </div>

            <div className="zuqen-chat-list">
              {visibleChats.length === 0 ? (
                <div
                  style={{
                    padding: "20px 9px",
                    color: "var(--muted-2)",
                    fontSize: 9,
                    lineHeight: 1.6,
                  }}
                >
                  {archivedOpen
                    ? "No archived conversations."
                    : search
                    ? "No conversations found."
                    : "Your conversations will appear here."}
                </div>
              ) : (
                visibleChats.map((chat) => (
                  <div
                    key={chat.id}
                    className={`zuqen-chat-item ${
                      activeChatId === chat.id
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      selectChat(chat)
                    }
                  >
                    <div className="zuqen-chat-main">
                      {renamingId === chat.id ? (
                        <input
                          className="zuqen-rename"
                          autoFocus
                          value={renameValue}
                          onChange={(event) =>
                            setRenameValue(
                              event.target.value
                            )
                          }
                          onClick={(event) =>
                            event.stopPropagation()
                          }
                          onKeyDown={(event) => {
                            if (
                              event.key ===
                              "Enter"
                            ) {
                              event.preventDefault();
                              renameChat(
                                chat.id,
                                renameValue
                              );
                            }

                            if (
                              event.key ===
                              "Escape"
                            ) {
                              setRenamingId(null);
                            }
                          }}
                          onBlur={() =>
                            renameChat(
                              chat.id,
                              renameValue
                            )
                          }
                        />
                      ) : (
                        <>
                          <div className="zuqen-chat-title">
                            {chat.title}
                          </div>

                          <div className="zuqen-chat-date">
                            {formatDate(
                              chat.updated_at
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    <button
                      className={`zuqen-chat-menu-button ${
                        menuId === chat.id
                          ? "open"
                          : ""
                      }`}
                      title="Chat options"
                      onClick={(event) => {
                        event.stopPropagation();

                        setMenuId((previous) =>
                          previous === chat.id
                            ? null
                            : chat.id
                        );
                      }}
                    >
                      <Icon
                        name="more"
                        size={16}
                      />
                    </button>

                    {menuId === chat.id && (
                      <div
                        className="zuqen-floating-menu"
                        onClick={(event) =>
                          event.stopPropagation()
                        }
                      >
                        <button
                          className="zuqen-menu-item"
                          onClick={() =>
                            startRename(chat)
                          }
                        >
                          <Icon
                            name="edit"
                            size={14}
                          />
                          Rename
                        </button>

                        <button
                          className="zuqen-menu-item"
                          onClick={() =>
                            archiveChat(
                              chat.id,
                              !chat.archived
                            )
                          }
                        >
                          <Icon
                            name={
                              chat.archived
                                ? "restore"
                                : "archive"
                            }
                            size={14}
                          />
                          {chat.archived
                            ? "Restore"
                            : "Archive"}
                        </button>

                        <button
                          className="zuqen-menu-item danger"
                          onClick={() =>
                            deleteChat(chat.id)
                          }
                        >
                          <Icon
                            name="trash"
                            size={14}
                          />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="zuqen-sidebar-bottom">
            <div className="zuqen-sidebar-user">
              <div className="zuqen-user-dot">
                {user?.is_anonymous
                  ? "G"
                  : user?.email
                  ? user.email
                      .charAt(0)
                      .toUpperCase()
                  : "Z"}
              </div>

              <div className="zuqen-user-info">
                <div className="zuqen-user-name">
                  {accountLabel}
                </div>

                <div className="zuqen-user-status">
                  {accountStatus}
                </div>
              </div>
            </div>

            {user?.is_anonymous ? (
              <button
                className="zuqen-auth-button primary"
                onClick={handleAuthNavigation}
              >
                <Icon
                  name="user"
                  size={13}
                />
                Sign in / Create account
              </button>
            ) : (
              <button
                className="zuqen-auth-button"
                disabled={signingOut}
                onClick={handleSignOut}
              >
                <Icon
                  name="logout"
                  size={13}
                />
                {signingOut
                  ? "Signing out..."
                  : "Sign out"}
              </button>
            )}
          </div>
        </div>
      </aside>

      <section className="zuqen-main">
        <header className="zuqen-topbar">
          <div className="zuqen-top-left">
            <button
              className="zuqen-icon-button"
              title={
                sidebarOpen
                  ? "Close sidebar"
                  : "Open sidebar"
              }
              onClick={() =>
                setSidebarOpen(
                  (value) => !value
                )
              }
            >
              <Icon name="menu" size={19} />
            </button>

            <button
              className="zuqen-icon-button"
              title="Search conversations"
              onClick={() =>
                setSearchOpen(
                  (value) => !value
                )
              }
            >
              <Icon name="search" size={17} />
            </button>

            <div className="zuqen-agent-selector">
              <button
                className="zuqen-agent-button"
                onClick={() =>
                  setAgentOpen(
                    (value) => !value
                  )
                }
              >
                <span className="zuqen-agent-button-icon">
                  ✦
                </span>

                <span className="zuqen-agent-button-text">
                  <div className="zuqen-agent-button-name">
                    {selectedAgent}
                  </div>

                  <div className="zuqen-agent-button-sub">
                    Active agent
                  </div>
                </span>

                <Icon
                  name="chevron"
                  size={12}
                />
              </button>

              {agentOpen && (
                <div className="zuqen-agent-dropdown">
                  {AGENTS.map((agent) => (
                    <button
                      key={agent.name}
                      className={`zuqen-agent-option ${
                        selectedAgent ===
                        agent.name
                          ? "selected"
                          : ""
                      }`}
                      onClick={() =>
                        navigateAgent(agent)
                      }
                    >
                      <span className="zuqen-agent-option-icon">
                        {agent.icon}
                      </span>

                      <span className="zuqen-agent-option-content">
                        <div className="zuqen-agent-option-name">
                          {agent.name}
                        </div>

                        <div className="zuqen-agent-option-description">
                          {agent.description}
                        </div>
                      </span>

                      {selectedAgent ===
                        agent.name && (
                        <span className="zuqen-agent-check">
                          <Icon
                            name="check"
                            size={13}
                          />
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
              className="zuqen-top-action automation-action"
              title="Automation Mode"
              onClick={() => {
                window.location.href =
                  "/automation";
              }}
            >
              <span>⚡</span>
              <span>Automation Mode</span>
            </button>

            <button
              className="zuqen-top-action templates-action"
              title="Buy/Sell Templates"
              onClick={() => {
                window.location.href =
                  "/marketplace";
              }}
            >
              <span>▦</span>
              <span>Buy/Sell Templates</span>
            </button>

            <div className="zuqen-credit-wrap">
              <button
                className="zuqen-credit-button"
                title="Chat credits"
                onClick={() =>
                  setCreditsOpen(
                    (value) => !value
                  )
                }
              >
                <span className="zuqen-credit-icon">
                  ◈
                </span>

                <span className="zuqen-credit-count">
                  {chatCredits === null
                    ? "..."
                    : chatCredits.toLocaleString()}
                </span>

                <span className="zuqen-credit-label">
                  credits
                </span>
              </button>

              {creditsOpen && (
                <div className="zuqen-credit-dropdown">
                  <div className="zuqen-credit-dropdown-title">
                    ZUQEN Chat Credits
                  </div>

                  <div className="zuqen-credit-big">
                    {chatCredits === null
                      ? "..."
                      : chatCredits.toLocaleString()}
                  </div>

                  <div className="zuqen-credit-small">
                    1 message uses 1 chat credit
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
              title={
                lightMode
                  ? "Switch to dark mode"
                  : "Switch to light mode"
              }
              onClick={toggleTheme}
            >
              <Icon
                name={
                  lightMode ? "moon" : "sun"
                }
                size={18}
              />
            </button>
          </div>
        </header>

        {searchOpen && (
          <div className="zuqen-search-overlay">
            <div className="zuqen-search-input-wrap">
              <Icon name="search" size={14} />

              <input
                autoFocus
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search your conversations..."
              />

              {search && (
                <button
                  onClick={() => setSearch("")}
                >
                  <Icon name="close" size={13} />
                </button>
              )}
            </div>
          </div>
        )}

        <div className="zuqen-content">
          {errorMessage && (
            <div
              className="zuqen-error"
              role="alert"
            >
              <span>!</span>

              <span>{errorMessage}</span>

              <button
                onClick={() =>
                  setErrorMessage("")
                }
              >
                <Icon
                  name="close"
                  size={13}
                />
              </button>
            </div>
          )}

          {!authReady ? (
            <div className="zuqen-empty-chat">
              <div className="zuqen-empty-chat-inner">
                <div className="zuqen-empty-chat-icon">
                  <Icon
                    name="spark"
                    size={22}
                  />
                </div>

                <h2>
                  Starting ZUQEN AI
                </h2>

                <p>
                  Restoring your secure
                  workspace...
                </p>
              </div>
            </div>
          ) : activeChatId &&
            activeChat ? (
            <div className="zuqen-chat-view">
              <div
                className="zuqen-messages"
                ref={messagesContainerRef}
                onScroll={
                  handleMessagesScroll
                }
              >
                <div className="zuqen-message-list">
                  {messages.length === 0 ? (
                    <div className="zuqen-empty-chat">
                      <div className="zuqen-empty-chat-inner">
                        <div className="zuqen-empty-chat-icon">
                          <Icon
                            name="spark"
                            size={22}
                          />
                        </div>

                        <h2>
                          Ready when you are
                        </h2>

                        <p>
                          Start a new
                          conversation with
                          ZUQEN AI.
                        </p>
                      </div>
                    </div>
                  ) : (
                    messages.map((message) => {
                      const isEditing =
                        editingId ===
                        message.id;

                      return (
                        <div
                          key={message.id}
                          className={`zuqen-message-row ${message.role}`}
                        >
                          <div className="zuqen-message-block">
                            <div className="zuqen-message-label">
                              {message.role ===
                              "assistant" ? (
                                <>
                                  <span>
                                    ZUQEN AI
                                  </span>

                                  <span className="zuqen-message-label-mark">
                                    ✦
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className="zuqen-message-label-mark">
                                    You
                                  </span>

                                  <span>
                                    You
                                  </span>
                                </>
                              )}
                            </div>

                            {isEditing ? (
                              <div className="zuqen-edit-box">
                                <textarea
                                  value={
                                    editingValue
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    setEditingValue(
                                      event
                                        .target
                                        .value
                                    )
                                  }
                                  autoFocus
                                />

                                <div className="zuqen-edit-actions">
                                  <button
                                    className="zuqen-small-button"
                                    onClick={
                                      cancelEdit
                                    }
                                  >
                                    Cancel
                                  </button>

                                  <button
                                    className="zuqen-small-button primary"
                                    onClick={() =>
                                      saveEditedMessage(
                                        message.id
                                      )
                                    }
                                  >
                                    Save &
                                    regenerate
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="zuqen-message-bubble">
                                  {message.content ? (
                                    <MessageContent
                                      content={
                                        message.content
                                      }
                                    />
                                  ) : (
                                    <div className="zuqen-typing">
                                      <span />
                                      <span />
                                      <span />
                                    </div>
                                  )}

                                  {message.attachments &&
                                    message
                                      .attachments
                                      .length >
                                      0 && (
                                      <div className="zuqen-attachment-list">
                                        {message.attachments.map(
                                          (
                                            file
                                          ) => (
                                            <div
                                              className="zuqen-attachment-chip"
                                              key={
                                                file.id
                                              }
                                            >
                                              <Icon
                                                name="paperclip"
                                                size={
                                                  11
                                                }
                                              />

                                              <span className="zuqen-attachment-chip-name">
                                                {
                                                  file.name
                                                }
                                              </span>

                                              <span>
                                                {formatFileSize(
                                                  file.size
                                                )}
                                              </span>
                                            </div>
                                          )
                                        )}
                                      </div>
                                    )}
                                </div>

                                <div className="zuqen-message-actions">
                                  <button
                                    className="zuqen-action"
                                    title="Copy message"
                                    onClick={() =>
                                      copyMessage(
                                        message.content
                                      )
                                    }
                                  >
                                    <Icon
                                      name="copy"
                                      size={14}
                                    />
                                  </button>

                                  {message.role ===
                                    "user" && (
                                    <button
                                      className="zuqen-action"
                                      title="Edit message"
                                      onClick={() =>
                                        startEditMessage(
                                          message
                                        )
                                      }
                                    >
                                      <Icon
                                        name="edit"
                                        size={14}
                                      />
                                    </button>
                                  )}

                                  {message.role ===
                                    "assistant" &&
                                    message.content && (
                                      <button
                                        className="zuqen-action"
                                        title="Regenerate response"
                                        disabled={
                                          loading
                                        }
                                        onClick={
                                          regenerate
                                        }
                                      >
                                        <Icon
                                          name="refresh"
                                          size={14}
                                        />
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

                  <div ref={messagesEndRef} />
                </div>

                {showScrollToBottom && (
                  <button
                    className="zuqen-scroll-latest"
                    type="button"
                    title="Jump to latest"
                    onClick={() =>
                      scrollToLatest(true)
                    }
                  >
                    ↓ Latest
                  </button>
                )}
              </div>

              <div className="zuqen-composer-area">
                {attachments.length > 0 && (
                  <div
                    style={{
                      width:
                        "min(900px,100%)",
                      margin: "0 auto 7px",
                    }}
                  >
                    <div className="zuqen-attachment-list">
                      {attachments.map(
                        (file) => (
                          <div
                            className="zuqen-attachment-chip"
                            key={file.id}
                          >
                            <Icon
                              name="paperclip"
                              size={11}
                            />

                            <span className="zuqen-attachment-chip-name">
                              {file.name}
                            </span>

                            <span>
                              {formatFileSize(
                                file.size
                              )}
                            </span>

                            <button
                              className="zuqen-attachment-remove"
                              title="Remove file"
                              onClick={() =>
                                removeAttachment(
                                  file.id
                                )
                              }
                            >
                              <Icon
                                name="close"
                                size={10}
                              />
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

                <div className="zuqen-composer">
                  <div className="zuqen-composer-row">
                    <label
                      className="zuqen-composer-button"
                      title="Add file"
                    >
                      <Icon
                        name="paperclip"
                        size={17}
                      />

                      <input
                        type="file"
                        multiple
                        onChange={
                          handleAttachment
                        }
                      />
                    </label>

                    <textarea
                      ref={textareaRef}
                      rows={1}
                      value={input}
                      disabled={loading}
                      placeholder="Message ZUQEN AI..."
                      onChange={(event) => {
                        setInput(
                          event.currentTarget
                            .value
                        );

                        event.currentTarget.style.height =
                          "auto";

                        event.currentTarget.style.height =
                          `${Math.min(
                            event.currentTarget
                              .scrollHeight,
                            210
                          )}px`;
                      }}
                      onKeyDown={
                        handleKeyDown
                      }
                    />

                    {loading ? (
                      <button
                        className="zuqen-composer-button zuqen-send"
                        title="Stop generating"
                        onClick={
                          stopGeneration
                        }
                      >
                        <Icon
                          name="stop"
                          size={15}
                        />
                      </button>
                    ) : (
                      <button
                        className="zuqen-composer-button zuqen-send"
                        title="Send message"
                        disabled={
                          !input.trim() &&
                          attachments.length ===
                            0
                        }
                        onClick={() =>
                          sendMessage()
                        }
                      >
                        <Icon
                          name="send"
                          size={16}
                        />
                      </button>
                    )}
                  </div>

                  <div className="zuqen-composer-footer">
                    <span>
                      ZUQEN AI can make
                      mistakes. Check
                      important information.
                    </span>

                    <span>
                      Enter to send · Shift +
                      Enter for newline
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="zuqen-home">
              <div className="zuqen-home-inner">
                <div className="zuqen-welcome">
                  <div className="zuqen-welcome-mark">
                    <span />
                  </div>

                  <h1>
                    What can I help
                    you
                    <br />
                    with today?
                  </h1>

                  <p>
                    Meet ZUQEN AI — your
                    intelligent workspace
                    for thinking, creating,
                    building and getting
                    things done.
                  </p>
                </div>

                <div className="zuqen-search-card">
                  <div className="zuqen-search-card-icon">
                    <Icon
                      name="spark"
                      size={17}
                    />
                  </div>

                  <input
                    value={input}
                    onChange={(event) =>
                      setInput(
                        event.target.value
                      )
                    }
                    onKeyDown={(event) => {
                      if (
                        event.key ===
                          "Enter" &&
                        !event.shiftKey
                      ) {
                        event.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Ask ZUQEN anything..."
                  />

                  <span className="zuqen-search-shortcut">
                    Enter
                  </span>
                </div>

                <div className="zuqen-suggestion-grid">
                  {SUGGESTIONS.map(
                    (suggestion) => (
                      <button
                        key={
                          suggestion.title
                        }
                        className="zuqen-suggestion"
                        onClick={() =>
                          setInput(
                            suggestion.text
                          )
                        }
                      >
                        <div className="zuqen-suggestion-icon">
                          {
                            suggestion.icon
                          }
                        </div>

                        <div className="zuqen-suggestion-title">
                          {
                            suggestion.title
                          }
                        </div>

                        <div className="zuqen-suggestion-text">
                          {
                            suggestion.text
                          }
                        </div>
                      </button>
                    )
                  )}
                </div>

                <div className="zuqen-agent-strip">
                  <div className="zuqen-strip-title">
                    Explore ZUQEN agents
                  </div>

                  <div className="zuqen-agent-cards">
                    {AGENTS.slice(1).map(
                      (agent) => (
                        <button
                          key={agent.name}
                          className="zuqen-mini-agent"
                          onClick={() =>
                            navigateAgent(
                              agent
                            )
                          }
                        >
                          <div className="zuqen-mini-agent-icon">
                            {agent.icon}
                          </div>

                          <div className="zuqen-mini-agent-name">
                            {agent.name}
                          </div>

                          <div className="zuqen-mini-agent-desc">
                            {
                              agent.description
                            }
                          </div>
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 35,
                    textAlign: "center",
                    color:
                      "var(--muted-2)",
                    fontSize: 8,
                  }}
                >
                  {chatCredits === null
                    ? "Loading your Chat Credits..."
                    : `${chatCredits.toLocaleString()} Chat Credits available`}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}