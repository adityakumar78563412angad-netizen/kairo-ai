"use client";

import React, {
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
  size: number;
  contentType: string;
  storageKey?: string;
  storagePath?: string;
  url?: string;
};

type Message = {
  id: string;
  role: Role;
  content: string;
  attachments?: Attachment[];
  created_at?: string;
};

type Chat = {
  id: string;
  user_id: string;
  title: string;
  messages: Message[];
  archived?: boolean;
  created_at?: string;
  updated_at?: string;
};

type CreditRow = {
  balance?: number | null;
  credits?: number | null;
  remaining?: number | null;
};

type Agent = {
  id: string;
  name: string;
  description: string;
  route: string | null;
  color: string;
  icon: IconName;
};

type IconName =
  | "plus"
  | "search"
  | "archive"
  | "trash"
  | "edit"
  | "copy"
  | "refresh"
  | "menu"
  | "send"
  | "paperclip"
  | "sun"
  | "moon"
  | "chevron"
  | "arrow"
  | "close"
  | "check"
  | "restore"
  | "spark"
  | "user"
  | "logout"
  | "sidebar"
  | "more"
  | "stop"
  | "code"
  | "play"
  | "download"
  | "folder"
  | "bot"
  | "file"
  | "external"
  | "command"
  | "info";

const supabase = createClient();

const AGENTS: Agent[] = [
  {
    id: "zuqen",
    name: "ZUQEN AI",
    description: "Your intelligent general-purpose AI",
    route: null,
    color: "violet",
    icon: "spark",
  },
  {
    id: "website-builder",
    name: "Website Builder",
    description: "Build complete websites with AI",
    route: "/website-builder",
    color: "blue",
    icon: "code",
  },
  {
    id: "image-generator",
    name: "Text to Image",
    description: "Create images from your ideas",
    route: "/image-generator",
    color: "pink",
    icon: "spark",
  },
  {
    id: "video-generator",
    name: "Text to Video",
    description: "Turn prompts into videos",
    route: "/video-generator",
    color: "orange",
    icon: "play",
  },
  {
    id: "voice-generator",
    name: "Voice Generator",
    description: "Generate natural AI voices",
    route: "/generate-voice",
    color: "green",
    icon: "bot",
  },
];

const WEB_PREVIEW_LANGUAGES = new Set([
  "html",
  "htm",
  "css",
  "javascript",
  "js",
  "jsx",
  "tsx",
  "typescript",
  "ts",
]);

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatDate(value?: string) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) {
    return `${Math.floor(diff / 60_000)}m ago`;
  }

  if (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  ) {
    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );

  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${
    units[index]
  }`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function extractText(data: unknown): string {
  if (typeof data === "string") return data;

  if (!data || typeof data !== "object") return "";

  const obj = data as Record<string, unknown>;

  if (typeof obj.content === "string") return obj.content;
  if (typeof obj.text === "string") return obj.text;
  if (typeof obj.delta === "string") return obj.delta;

  if (obj.delta && typeof obj.delta === "object") {
    const delta = obj.delta as Record<string, unknown>;
    if (typeof delta.content === "string") return delta.content;
    if (typeof delta.text === "string") return delta.text;
  }

  if (obj.choices && Array.isArray(obj.choices)) {
    const choice = obj.choices[0] as Record<string, unknown> | undefined;

    if (choice) {
      if (typeof choice.text === "string") return choice.text;

      if (choice.delta && typeof choice.delta === "object") {
        const delta = choice.delta as Record<string, unknown>;
        if (typeof delta.content === "string") return delta.content;
        if (typeof delta.text === "string") return delta.text;
      }

      if (choice.message && typeof choice.message === "object") {
        const message = choice.message as Record<string, unknown>;
        if (typeof message.content === "string") {
          return message.content;
        }
      }
    }
  }

  return "";
}

function parseStreamLine(line: string) {
  const trimmed = line.trim();

  if (!trimmed) return "";
  if (trimmed.startsWith(":")) return "";

  const payload = trimmed.startsWith("data:")
    ? trimmed.slice(5).trim()
    : trimmed;

  if (!payload || payload === "[DONE]") return "";

  try {
    return extractText(JSON.parse(payload));
  } catch {
    return payload;
  }
}

function generateChatTitle(content: string) {
  const cleaned = content.replace(/\s+/g, " ").trim();

  if (!cleaned) return "New conversation";

  if (cleaned.length <= 45) return cleaned;

  return `${cleaned.slice(0, 45).trim()}…`;
}

function normalizeMessages(value: unknown): Message[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const row = item as Record<string, unknown>;

      const role = row.role === "user" ? "user" : "assistant";
      const content = typeof row.content === "string" ? row.content : "";

      if (!content && !row.attachments) return null;

      return {
        id:
          typeof row.id === "string"
            ? row.id
            : makeId(),
        role,
        content,
        attachments: Array.isArray(row.attachments)
          ? (row.attachments as Attachment[])
          : [],
        created_at:
          typeof row.created_at === "string"
            ? row.created_at
            : new Date().toISOString(),
      };
    })
    .filter(Boolean) as Message[];
}

function getCreditBalance(row?: CreditRow | null) {
  if (!row) return 0;

  if (typeof row.balance === "number") return row.balance;
  if (typeof row.credits === "number") return row.credits;
  if (typeof row.remaining === "number") return row.remaining;

  return 0;
}

function splitMarkdownCode(content: string) {
  const parts: Array<
    | { type: "text"; value: string }
    | { type: "code"; value: string; language: string }
  > = [];

  const regex = /```([^\n`]*)\n([\s\S]*?)```/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        value: content.slice(lastIndex, match.index),
      });
    }

    parts.push({
      type: "code",
      language: match[1].trim().toLowerCase() || "text",
      value: match[2].replace(/\n$/, ""),
    });

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    parts.push({
      type: "text",
      value: content.slice(lastIndex),
    });
  }

  if (!parts.length) {
    return [{ type: "text" as const, value: content }];
  }

  return parts;
}

function Icon({
  name,
  size = 20,
  strokeWidth = 1.9,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );

    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>
      );

    case "archive":
      return (
        <svg {...common}>
          <path d="M4 7h16" />
          <path d="M5 7v11h14V7" />
          <path d="M3 4h18v3H3z" />
          <path d="M9 11h6" />
        </svg>
      );

    case "trash":
      return (
        <svg {...common}>
          <path d="M4 7h16" />
          <path d="M10 11v6M14 11v6" />
          <path d="M6 7l1 13h10l1-13" />
          <path d="M9 7V4h6v3" />
        </svg>
      );

    case "edit":
      return (
        <svg {...common}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
        </svg>
      );

    case "copy":
      return (
        <svg {...common}>
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      );

    case "refresh":
      return (
        <svg {...common}>
          <path d="M20 11a8.1 8.1 0 0 0-14.9-4L3 10" />
          <path d="M3 5v5h5" />
          <path d="M4 13a8.1 8.1 0 0 0 14.9 4L21 14" />
          <path d="M21 19v-5h-5" />
        </svg>
      );

    case "menu":
    case "more":
      return (
        <svg {...common}>
          <circle cx="5" cy="12" r="1" fill="currentColor" />
          <circle cx="12" cy="12" r="1" fill="currentColor" />
          <circle cx="19" cy="12" r="1" fill="currentColor" />
        </svg>
      );

    case "send":
      return (
        <svg {...common}>
          <path d="m22 2-7 20-4-9-9-4Z" />
          <path d="M22 2 11 13" />
        </svg>
      );

    case "paperclip":
      return (
        <svg {...common}>
          <path d="m20.5 11.5-8.6 8.6a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" />
        </svg>
      );

    case "sun":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      );

    case "moon":
      return (
        <svg {...common}>
          <path d="M21 15.5A9 9 0 1 1 8.5 3 7 7 0 0 0 21 15.5Z" />
        </svg>
      );

    case "chevron":
      return (
        <svg {...common}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      );

    case "arrow":
      return (
        <svg {...common}>
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
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

    case "restore":
      return (
        <svg {...common}>
          <path d="M3 12a9 9 0 1 0 3-6.7" />
          <path d="M3 4v6h6" />
        </svg>
      );

    case "spark":
      return (
        <svg {...common}>
          <path d="m12 3-1.5 5.5L5 10l5.5 1.5L12 17l1.5-5.5L19 10l-5.5-1.5Z" />
          <path d="m19 16-.7 2.3L16 19l2.3.7L19 22l.7-2.3L22 19l-2.3-.7Z" />
        </svg>
      );

    case "user":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
      );

    case "logout":
      return (
        <svg {...common}>
          <path d="M10 17l5-5-5-5" />
          <path d="M15 12H3" />
          <path d="M21 19V5a2 2 0 0 0-2-2h-6" />
        </svg>
      );

    case "sidebar":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="3" />
          <path d="M9 4v16" />
        </svg>
      );

    case "stop":
      return (
        <svg {...common}>
          <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" stroke="none" />
        </svg>
      );

    case "code":
      return (
        <svg {...common}>
          <path d="m8 9-4 3 4 3M16 9l4 3-4 3M14 5l-4 14" />
        </svg>
      );

    case "play":
      return (
        <svg {...common}>
          <path d="m8 5 11 7-11 7Z" />
        </svg>
      );

    case "download":
      return (
        <svg {...common}>
          <path d="M12 3v12" />
          <path d="m7 10 5 5 5-5" />
          <path d="M5 21h14" />
        </svg>
      );

    case "folder":
      return (
        <svg {...common}>
          <path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
        </svg>
      );

    case "bot":
      return (
        <svg {...common}>
          <rect x="5" y="7" width="14" height="12" rx="3" />
          <path d="M12 3v4M8 12h.01M16 12h.01M9 16h6" />
        </svg>
      );

    case "file":
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
          <path d="M14 2v6h6" />
        </svg>
      );

    case "external":
      return (
        <svg {...common}>
          <path d="M14 3h7v7" />
          <path d="M10 14 21 3" />
          <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
        </svg>
      );

    case "command":
      return (
        <svg {...common}>
          <path d="M18 8a3 3 0 1 0-3-3v14a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V5a3 3 0 1 0-3 3Z" />
        </svg>
      );

    case "info":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" />
        </svg>
      );

    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
  }
}

function CodeBlock({
  language,
  code,
  lightMode,
}: {
  language: string;
  code: string;
  lightMode: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const normalizedLanguage = language.toLowerCase();
  const canPreview = WEB_PREVIEW_LANGUAGES.has(normalizedLanguage);

  const previewHtml = useMemo(() => {
    const escaped = escapeHtml(code);

    if (normalizedLanguage === "html" || normalizedLanguage === "htm") {
      return code;
    }

    if (normalizedLanguage === "css") {
      return `
        <!doctype html>
        <html>
          <head>
            <style>${code}</style>
          </head>
          <body>
            <div class="preview-card">
              <h2>CSS Preview</h2>
              <p>This is a safe browser preview for the supplied stylesheet.</p>
              <button>Example Button</button>
            </div>
          </body>
        </html>
      `;
    }

    if (
      normalizedLanguage === "javascript" ||
      normalizedLanguage === "js"
    ) {
      return `
        <!doctype html>
        <html>
          <body>
            <div id="root"></div>
            <script>
              try {
                ${code}
              } catch (error) {
                document.getElementById("root").innerHTML =
                  "<pre style='white-space:pre-wrap;color:#b91c1c'>" +
                  String(error) +
                  "</pre>";
              }
            </script>
          </body>
        </html>
      `;
    }

    return `
      <!doctype html>
      <html>
        <body>
          <pre>${escaped}</pre>
        </body>
      </html>
    `;
  }, [code, normalizedLanguage]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  function openPreview() {
    if (!canPreview) return;
    setPreviewOpen((value) => !value);
  }

  return (
    <div className="zuqen-code-shell">
      <div className="zuqen-code-header">
        <div className="zuqen-code-language">
          <Icon name="code" size={15} />
          <span>{language || "text"}</span>
        </div>

        <div className="zuqen-code-actions">
          {canPreview && (
            <button
              type="button"
              className="zuqen-code-action"
              onClick={openPreview}
              title="Preview in browser"
            >
              <Icon name={previewOpen ? "code" : "play"} size={14} />
              {previewOpen ? "Code" : "Preview"}
            </button>
          )}

          <button
            type="button"
            className="zuqen-code-action"
            onClick={copyCode}
          >
            {copied ? (
              <>
                <Icon name="check" size={14} />
                Copied
              </>
            ) : (
              <>
                <Icon name="copy" size={14} />
                Copy
              </>
            )}
          </button>
        </div>
      </div>

      {previewOpen && canPreview ? (
        <div className="zuqen-preview-wrap">
          <iframe
            title={`${language} preview`}
            className="zuqen-preview-frame"
            sandbox="allow-scripts"
            srcDoc={previewHtml}
          />
        </div>
      ) : (
        <pre className={`zuqen-code-content ${lightMode ? "light" : ""}`}>
          <code>{code}</code>
        </pre>
      )}

      {!canPreview && (
        <div className="zuqen-code-note">
          <Icon name="info" size={14} />
          Browser preview is available for web code. This language is shown as
          code only because it requires its own runtime/compiler.
        </div>
      )}
    </div>
  );
}

function MessageContent({
  content,
  lightMode,
}: {
  content: string;
  lightMode: boolean;
}) {
  const parts = useMemo(() => splitMarkdownCode(content), [content]);

  return (
    <div className="zuqen-message-content">
      {parts.map((part, index) => {
        if (part.type === "code") {
          return (
            <CodeBlock
              key={`code-${index}`}
              language={part.language}
              code={part.value}
              lightMode={lightMode}
            />
          );
        }

        const lines = part.value.split("\n");

        return (
          <React.Fragment key={`text-${index}`}>
            {lines.map((line, lineIndex) => {
              const trimmed = line.trim();

              if (!trimmed) {
                return <div key={lineIndex} className="zuqen-text-gap" />;
              }

              if (trimmed.startsWith("### ")) {
                return (
                  <h3 key={lineIndex} className="zuqen-md-h3">
                    {trimmed.slice(4)}
                  </h3>
                );
              }

              if (trimmed.startsWith("## ")) {
                return (
                  <h2 key={lineIndex} className="zuqen-md-h2">
                    {trimmed.slice(3)}
                  </h2>
                );
              }

              if (trimmed.startsWith("# ")) {
                return (
                  <h1 key={lineIndex} className="zuqen-md-h1">
                    {trimmed.slice(2)}
                  </h1>
                );
              }

              if (trimmed.startsWith("- ")) {
                return (
                  <div key={lineIndex} className="zuqen-md-list">
                    <span>•</span>
                    <span>{trimmed.slice(2)}</span>
                  </div>
                );
              }

              if (/^\d+\.\s/.test(trimmed)) {
                const match = trimmed.match(/^(\d+)\.\s(.*)$/);

                return (
                  <div key={lineIndex} className="zuqen-md-list">
                    <span>{match?.[1]}.</span>
                    <span>{match?.[2]}</span>
                  </div>
                );
              }

              return (
                <p key={lineIndex} className="zuqen-md-p">
                  {trimmed}
                </p>
              );
            })}
          </React.Fragment>
        );
      })}
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
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");

  const [agentOpen, setAgentOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(AGENTS[0]);

  const [credits, setCredits] = useState(0);
  const [creditsOpen, setCreditsOpen] = useState(false);

  const [lightMode, setLightMode] = useState(false);

  const [menuChatId, setMenuChatId] = useState<string | null>(null);
  const [renameChatId, setRenameChatId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [editingMessageId, setEditingMessageId] = useState<string | null>(
    null,
  );
  const [editValue, setEditValue] = useState("");

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

  const [error, setError] = useState("");

  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId) ?? null,
    [chats, activeChatId],
  );

  const visibleChats = useMemo(() => {
    const query = search.trim().toLowerCase();

    return chats.filter((chat) => {
      if (chat.archived) return false;
      if (!query) return true;

      return (
        chat.title.toLowerCase().includes(query) ||
        chat.messages.some((message) =>
          message.content.toLowerCase().includes(query),
        )
      );
    });
  }, [chats, search]);

  const archivedChats = useMemo(() => {
    const query = search.trim().toLowerCase();

    return chats.filter((chat) => {
      if (!chat.archived) return false;
      if (!query) return true;

      return chat.title.toLowerCase().includes(query);
    });
  }, [chats, search]);

  const isHome = !activeChatId;

  const loadChats = useCallback(async (userId: string) => {
    const { data, error: chatsError } = await supabase
      .from("chats")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (chatsError) {
      throw chatsError;
    }

    const normalized: Chat[] = (data ?? []).map((row) => ({
      id: row.id,
      user_id: row.user_id,
      title: row.title || "New conversation",
      messages: normalizeMessages(row.messages),
      archived: Boolean(row.archived),
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    setChats(normalized);

    if (activeChatId) {
      const selected = normalized.find(
        (chat) => chat.id === activeChatId,
      );

      if (selected) {
        setMessages(selected.messages);
      }
    }
  }, [activeChatId]);

  const loadChatCredits = useCallback(async (userId: string) => {
    const { data, error: creditError } = await supabase
      .from("feature_credit_balances")
      .select("*")
      .eq("user_id", userId)
      .eq("feature_key", "chat")
      .maybeSingle();

    if (creditError) {
      throw creditError;
    }

    setCredits(getCreditBalance(data as CreditRow | null));
  }, []);

  const initializeAuth = useCallback(async () => {
    try {
      setAuthReady(false);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      let currentSession = session;

      if (!currentSession) {
        const { data, error: anonymousError } =
          await supabase.auth.signInAnonymously();

        if (anonymousError) {
          throw anonymousError;
        }

        currentSession = data.session;
      }

      if (!currentSession?.user) {
        throw new Error("Unable to initialize authentication.");
      }

      const currentUser = currentSession.user;

      if (currentUser.is_anonymous) {
        await supabase.rpc("setup_guest_chat_credits");
      }

      const normalizedUser: User = {
        id: currentUser.id,
        email: currentUser.email,
        is_anonymous: currentUser.is_anonymous,
      };

      setUser(normalizedUser);

      await Promise.all([
        loadChats(currentUser.id),
        loadChatCredits(currentUser.id),
      ]);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to initialize ZUQEN.",
      );
    } finally {
      setAuthReady(true);
    }
  }, [loadChatCredits, loadChats]);

  useEffect(() => {
    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) return;

      const nextUser: User = {
        id: session.user.id,
        email: session.user.email,
        is_anonymous: session.user.is_anonymous,
      };

      setUser(nextUser);

      try {
        await Promise.all([
          loadChats(nextUser.id),
          loadChatCredits(nextUser.id),
        ]);
      } catch (err) {
        console.error(err);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [initializeAuth, loadChats, loadChatCredits]);

  useEffect(() => {
    const storedTheme = localStorage.getItem("zuqen-theme");

    if (storedTheme === "light") {
      setLightMode(true);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "zuqen-theme",
      lightMode ? "light" : "dark",
    );
  }, [lightMode]);

  useEffect(() => {
    function closeMenus(event: MouseEvent) {
      const target = event.target as HTMLElement;

      if (
        !target.closest(".zuqen-chat-menu-wrap") &&
        !target.closest(".zuqen-agent-wrap") &&
        !target.closest(".zuqen-credit-wrap")
      ) {
        setMenuChatId(null);
        setAgentOpen(false);
        setCreditsOpen(false);
      }
    }

    document.addEventListener("mousedown", closeMenus);

    return () => {
      document.removeEventListener("mousedown", closeMenus);
    };
  }, []);

  useEffect(() => {
    if (!textareaRef.current) return;

    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = `${Math.min(
      textareaRef.current.scrollHeight,
      220,
    )}px`;
  }, [input]);

  const scrollToBottom = useCallback(
    (smooth = true) => {
      const container = chatScrollRef.current;

      if (!container) return;

      container.scrollTo({
        top: container.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });

      setShowScrollToBottom(false);
    },
    [],
  );

  useEffect(() => {
    const container = chatScrollRef.current;

    if (!container) return;

    const onScroll = () => {
      const distance =
        container.scrollHeight -
        container.scrollTop -
        container.clientHeight;

      setShowScrollToBottom(distance > 280);
    };

    container.addEventListener("scroll", onScroll);

    return () => container.removeEventListener("scroll", onScroll);
  }, [activeChatId]);

  useEffect(() => {
    if (!loading) return;

    const container = chatScrollRef.current;

    if (!container) return;

    const distance =
      container.scrollHeight -
      container.scrollTop -
      container.clientHeight;

    if (distance < 500) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "auto",
      });
    }
  }, [messages, loading]);

  const saveMessages = useCallback(
    async (chatId: string, nextMessages: Message[], title?: string) => {
      if (!user) return;

      const update: Record<string, unknown> = {
        messages: nextMessages,
        updated_at: new Date().toISOString(),
      };

      if (title) {
        update.title = title;
      }

      const { error: updateError } = await supabase
        .from("chats")
        .update(update)
        .eq("id", chatId)
        .eq("user_id", user.id);

      if (updateError) {
        throw updateError;
      }

      setChats((previous) =>
        previous
          .map((chat) =>
            chat.id === chatId
              ? {
                  ...chat,
                  messages: nextMessages,
                  title: title || chat.title,
                  updated_at: update.updated_at as string,
                }
              : chat,
          )
          .sort(
            (a, b) =>
              new Date(b.updated_at || 0).getTime() -
              new Date(a.updated_at || 0).getTime(),
          ),
      );
    },
    [user],
  );

  async function createConversation() {
    if (!user) return;

    setError("");

    try {
      const now = new Date().toISOString();

      const { data, error: insertError } = await supabase
        .from("chats")
        .insert({
          user_id: user.id,
          title: "New conversation",
          messages: [],
          archived: false,
          created_at: now,
          updated_at: now,
        })
        .select("*")
        .single();

      if (insertError) throw insertError;

      const chat: Chat = {
        id: data.id,
        user_id: data.user_id,
        title: data.title || "New conversation",
        messages: [],
        archived: Boolean(data.archived),
        created_at: data.created_at,
        updated_at: data.updated_at,
      };

      setChats((previous) => [chat, ...previous]);
      setActiveChatId(chat.id);
      setMessages([]);
      setInput("");
      setMobileSidebarOpen(false);

      window.setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Could not create a conversation.",
      );
    }
  }

  async function selectChat(chat: Chat) {
    setActiveChatId(chat.id);
    setMessages(chat.messages);
    setInput("");
    setError("");
    setMenuChatId(null);
    setMobileSidebarOpen(false);

    window.setTimeout(() => {
      scrollToBottom(false);
    }, 50);
  }

  async function renameChat(chatId: string) {
    const title = renameValue.trim();

    if (!title || !user) return;

    try {
      const { error: updateError } = await supabase
        .from("chats")
        .update({
          title,
          updated_at: new Date().toISOString(),
        })
        .eq("id", chatId)
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      setChats((previous) =>
        previous.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                title,
                updated_at: new Date().toISOString(),
              }
            : chat,
        ),
      );

      setRenameChatId(null);
      setRenameValue("");
      setMenuChatId(null);
    } catch (err) {
      console.error(err);
      setError("Could not rename this conversation.");
    }
  }

  async function archiveChat(chatId: string, archived: boolean) {
    if (!user) return;

    try {
      const { error: updateError } = await supabase
        .from("chats")
        .update({
          archived,
          updated_at: new Date().toISOString(),
        })
        .eq("id", chatId)
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      setChats((previous) =>
        previous.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                archived,
                updated_at: new Date().toISOString(),
              }
            : chat,
        ),
      );

      if (activeChatId === chatId && archived) {
        setActiveChatId(null);
        setMessages([]);
      }

      setMenuChatId(null);
    } catch (err) {
      console.error(err);
      setError(
        archived
          ? "Could not archive this conversation."
          : "Could not restore this conversation.",
      );
    }
  }

  async function deleteChat(chatId: string) {
    if (!user) return;

    const confirmed = window.confirm(
      "Delete this conversation permanently?",
    );

    if (!confirmed) return;

    try {
      const { error: deleteError } = await supabase
        .from("chats")
        .delete()
        .eq("id", chatId)
        .eq("user_id", user.id);

      if (deleteError) throw deleteError;

      setChats((previous) =>
        previous.filter((chat) => chat.id !== chatId),
      );

      if (activeChatId === chatId) {
        setActiveChatId(null);
        setMessages([]);
      }

      setMenuChatId(null);
    } catch (err) {
      console.error(err);
      setError("Could not delete this conversation.");
    }
  }

  function navigateAgent(agent: Agent) {
    if (agent.route) {
      window.location.href = agent.route;
      return;
    }

    setSelectedAgent(agent);
    setAgentOpen(false);
  }

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();

      if (!loading) {
        void sendMessage();
      }
    }
  }

  async function handleAttachment(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(event.target.files || []);

    if (!files.length) return;

    setUploading(true);
    setError("");

    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/files/upload", {
          method: "POST",
          body: formData,
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(
            data?.error || `Could not upload ${file.name}.`,
          );
        }

        const uploaded: Attachment = {
          id: data.id || makeId(),
          name: data.name || file.name,
          size: data.size || file.size,
          contentType:
            data.contentType ||
            file.type ||
            "application/octet-stream",
          storageKey: data.storageKey,
          storagePath: data.storagePath,
          url: data.url,
        };

        setAttachments((previous) => [...previous, uploaded]);
      }
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Attachment upload failed.",
      );
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  function removeAttachment(id: string) {
    setAttachments((previous) =>
      previous.filter((item) => item.id !== id),
    );
  }

  async function copyMessage(message: Message) {
    try {
      await navigator.clipboard.writeText(message.content);

      setCopiedMessageId(message.id);

      window.setTimeout(() => {
        setCopiedMessageId((current) =>
          current === message.id ? null : current,
        );
      }, 1500);
    } catch {
      setError("Could not copy the message.");
    }
  }

  function startEditing(message: Message) {
    setEditingMessageId(message.id);
    setEditValue(message.content);

    window.setTimeout(() => {
      const element = document.querySelector(
        `[data-edit-message="${message.id}"]`,
      ) as HTMLTextAreaElement | null;

      element?.focus();
    }, 50);
  }

  async function saveEditedMessage(messageId: string) {
    const value = editValue.trim();

    if (!value || !activeChatId) return;

    const messageIndex = messages.findIndex(
      (message) => message.id === messageId,
    );

    if (messageIndex === -1) return;

    const nextMessages = messages
      .slice(0, messageIndex)
      .concat({
        ...messages[messageIndex],
        content: value,
      });

    setMessages(nextMessages);
    setEditingMessageId(null);
    setEditValue("");

    try {
      await saveMessages(activeChatId, nextMessages);

      await sendMessage({
        overrideMessages: nextMessages,
        userText: value,
        replaceExistingUserMessage: true,
      });
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Could not edit this message.",
      );
    }
  }

  async function regenerateMessage(messageId: string) {
    if (!activeChatId || loading) return;

    const assistantIndex = messages.findIndex(
      (message) => message.id === messageId,
    );

    if (assistantIndex === -1) return;

    const previousUserMessage = [...messages]
      .slice(0, assistantIndex)
      .reverse()
      .find((message) => message.role === "user");

    if (!previousUserMessage) return;

    const baseMessages = messages.slice(0, assistantIndex);

    setMessages(baseMessages);

    try {
      await saveMessages(activeChatId, baseMessages);

      await sendMessage({
        overrideMessages: baseMessages,
        userText: previousUserMessage.content,
        replaceExistingUserMessage: true,
      });
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Could not regenerate the response.",
      );
    }
  }

  async function sendMessage(options?: {
    overrideMessages?: Message[];
    userText?: string;
    replaceExistingUserMessage?: boolean;
  }) {
    if (loading || !user) return;

    const text = (options?.userText ?? input).trim();

    if (!text) return;

    if (credits <= 0) {
      setError(
        "You do not have enough ZUQEN Chat Credits for another message.",
      );
      return;
    }

    setError("");

    let chatId = activeChatId;
    let workingMessages = options?.overrideMessages ?? messages;

    try {
      if (!chatId) {
        const now = new Date().toISOString();

        const { data, error: insertError } = await supabase
          .from("chats")
          .insert({
            user_id: user.id,
            title: generateChatTitle(text),
            messages: [],
            archived: false,
            created_at: now,
            updated_at: now,
          })
          .select("*")
          .single();

        if (insertError) throw insertError;

        chatId = data.id;

        const newChat: Chat = {
          id: data.id,
          user_id: data.user_id,
          title: data.title || generateChatTitle(text),
          messages: [],
          archived: false,
          created_at: data.created_at,
          updated_at: data.updated_at,
        };

        setChats((previous) => [newChat, ...previous]);
        setActiveChatId(chatId);
      }

      const userMessage: Message = {
        id: makeId(),
        role: "user",
        content: text,
        attachments:
          options?.replaceExistingUserMessage
            ? workingMessages.find(
                (message) =>
                  message.role === "user" &&
                  message.content === text,
              )?.attachments || []
            : attachments,
        created_at: new Date().toISOString(),
      };

      if (!options?.replaceExistingUserMessage) {
        workingMessages = [...workingMessages, userMessage];
      }

      setMessages(workingMessages);

      if (!options?.replaceExistingUserMessage) {
        setInput("");
        setAttachments([]);
      }

      await saveMessages(
        chatId,
        workingMessages,
        activeChat?.title === "New conversation" || !activeChat
          ? generateChatTitle(text)
          : undefined,
      );

      const assistantMessageId = makeId();

      const assistantMessage: Message = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        created_at: new Date().toISOString(),
      };

      const messagesForRequest = [
        ...workingMessages,
        assistantMessage,
      ];

      setMessages(messagesForRequest);
      setLoading(true);

      abortRef.current = new AbortController();

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          chatId,
          message: text,
          messages: workingMessages,
          attachments: userMessage.attachments || [],
          agent: selectedAgent.id,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);

        throw new Error(
          data?.error ||
            `Chat request failed with status ${response.status}.`,
        );
      }

      if (!response.body) {
        throw new Error("The AI response stream was unavailable.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = "";
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";

        for (const line of lines) {
          const delta = parseStreamLine(line);

          if (!delta) continue;

          assistantText += delta;

          setMessages((previous) =>
            previous.map((message) =>
              message.id === assistantMessageId
                ? {
                    ...message,
                    content: assistantText,
                  }
                : message,
            ),
          );
        }
      }

      if (buffer.trim()) {
        const delta = parseStreamLine(buffer);

        if (delta) {
          assistantText += delta;

          setMessages((previous) =>
            previous.map((message) =>
              message.id === assistantMessageId
                ? {
                    ...message,
                    content: assistantText,
                  }
                : message,
            ),
          );
        }
      }

      const finalMessages: Message[] = [
        ...workingMessages,
        {
          ...assistantMessage,
          content:
            assistantText ||
            "I could not generate a response. Please try again.",
        },
      ];

      setMessages(finalMessages);

      await saveMessages(
        chatId,
        finalMessages,
        activeChat?.title === "New conversation" || !activeChat
          ? generateChatTitle(text)
          : undefined,
      );

      await loadChatCredits(user.id);
      await loadChats(user.id);
    } catch (err) {
      if (
        err instanceof DOMException &&
        err.name === "AbortError"
      ) {
        const partial = messages;

        if (chatId) {
          const current = partial.filter(
            (message) => message.content.trim() !== "",
          );

          if (current.length) {
            await saveMessages(chatId, current).catch(() => undefined);
          }
        }

        return;
      }

      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while generating the response.",
      );

      setMessages((previous) =>
        previous.filter(
          (message) =>
            message.role !== "assistant" ||
            message.content.trim() !== "",
        ),
      );
    } finally {
      setLoading(false);
      abortRef.current = null;

      window.setTimeout(() => {
        scrollToBottom(true);
      }, 50);
    }
  }

  function stopGeneration() {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
  }

  async function signOut() {
    try {
      await supabase.auth.signOut();

      setUser(null);
      setChats([]);
      setActiveChatId(null);
      setMessages([]);
      setCredits(0);

      window.location.href = "/";
    } catch (err) {
      console.error(err);
      setError("Could not sign out.");
    }
  }

  function goToAuth() {
    window.location.href = "/auth";
  }

  function renderAttachmentPreview(attachment: Attachment) {
    const isImage = attachment.contentType.startsWith("image/");
    const isPdf = attachment.contentType === "application/pdf";

    if (isImage && attachment.url) {
      return (
        <div className="zuqen-attachment-preview" key={attachment.id}>
          <img src={attachment.url} alt={attachment.name} />
          <div>
            <strong>{attachment.name}</strong>
            <span>{formatFileSize(attachment.size)}</span>
          </div>
        </div>
      );
    }

    return (
      <div className="zuqen-attachment-file" key={attachment.id}>
        <div className="zuqen-file-icon">
          <Icon name={isPdf ? "file" : "folder"} size={18} />
        </div>

        <div className="zuqen-file-meta">
          <strong>{attachment.name}</strong>
          <span>
            {isPdf ? "PDF" : attachment.contentType || "File"} ·{" "}
            {formatFileSize(attachment.size)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <main className={lightMode ? "zuqen-app light" : "zuqen-app"}>
      <style>{`
        :root {
          --z-bg: #08090f;
          --z-bg-2: #0c0e16;
          --z-sidebar: rgba(12, 14, 23, .94);
          --z-surface: rgba(255,255,255,.055);
          --z-surface-2: rgba(255,255,255,.075);
          --z-surface-3: rgba(255,255,255,.10);
          --z-border: rgba(255,255,255,.10);
          --z-border-strong: rgba(255,255,255,.16);
          --z-text: #f8f8fc;
          --z-text-2: #b7bac8;
          --z-text-3: #7d8191;
          --z-accent: #8b5cf6;
          --z-accent-2: #6366f1;
          --z-accent-3: #22d3ee;
          --z-danger: #fb7185;
          --z-success: #34d399;
          --z-shadow: 0 24px 70px rgba(0,0,0,.28);
          --z-radius: 18px;
        }

        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          padding: 0;
        }

        body {
          background: var(--z-bg);
        }

        button,
        textarea,
        input {
          font: inherit;
        }

        button {
          border: 0;
        }

        .zuqen-app {
          min-height: 100vh;
          height: 100vh;
          overflow: hidden;
          display: flex;
          color: var(--z-text);
          background:
            radial-gradient(circle at 12% 0%, rgba(124,58,237,.18), transparent 32%),
            radial-gradient(circle at 92% 4%, rgba(34,211,238,.10), transparent 26%),
            linear-gradient(135deg, #07080d 0%, #0a0c14 50%, #08090f 100%);
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        .zuqen-app.light {
          --z-bg: #f5f7fb;
          --z-bg-2: #ffffff;
          --z-sidebar: rgba(249,250,253,.96);
          --z-surface: rgba(20,24,40,.055);
          --z-surface-2: rgba(20,24,40,.075);
          --z-surface-3: rgba(20,24,40,.10);
          --z-border: rgba(20,24,40,.09);
          --z-border-strong: rgba(20,24,40,.14);
          --z-text: #161824;
          --z-text-2: #555a6d;
          --z-text-3: #7d8292;
          --z-shadow: 0 24px 70px rgba(28,35,55,.13);
          background:
            radial-gradient(circle at 12% 0%, rgba(124,58,237,.12), transparent 32%),
            radial-gradient(circle at 92% 4%, rgba(34,211,238,.10), transparent 26%),
            linear-gradient(135deg, #f8f9fd 0%, #f3f5fb 50%, #ffffff 100%);
        }

        .zuqen-shell {
          width: 100%;
          display: flex;
          min-width: 0;
        }

        .zuqen-sidebar {
          width: 292px;
          flex: 0 0 292px;
          height: 100vh;
          display: flex;
          flex-direction: column;
          background: var(--z-sidebar);
          border-right: 1px solid var(--z-border);
          backdrop-filter: blur(26px);
          transition: width .25s ease, transform .25s ease;
          position: relative;
          z-index: 50;
        }

        .zuqen-sidebar.closed {
          width: 0;
          flex-basis: 0;
          overflow: hidden;
          border-right: 0;
        }

        .zuqen-sidebar-inner {
          width: 292px;
          height: 100%;
          display: flex;
          flex-direction: column;
          padding: 15px;
        }

        .zuqen-brand {
          height: 52px;
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 0 8px;
          margin-bottom: 10px;
        }

        .zuqen-brand-mark {
          width: 34px;
          height: 34px;
          border-radius: 11px;
          display: grid;
          place-items: center;
          color: white;
          background:
            linear-gradient(135deg, #8b5cf6, #6366f1 55%, #22d3ee);
          box-shadow: 0 8px 25px rgba(99,102,241,.28);
        }

        .zuqen-brand-text {
          min-width: 0;
        }

        .zuqen-brand-title {
          font-size: 15px;
          font-weight: 800;
          letter-spacing: -.02em;
        }

        .zuqen-brand-subtitle {
          font-size: 11px;
          color: var(--z-text-3);
          margin-top: 1px;
        }

        .zuqen-sidebar-action {
          width: 100%;
          min-height: 45px;
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 0 13px;
          border-radius: 13px;
          color: var(--z-text);
          background: var(--z-surface);
          border: 1px solid var(--z-border);
          cursor: pointer;
          transition: .18s ease;
          margin-bottom: 8px;
          text-align: left;
        }

        .zuqen-sidebar-action:hover {
          background: var(--z-surface-2);
          border-color: var(--z-border-strong);
          transform: translateY(-1px);
        }

        .zuqen-sidebar-action.primary {
          background: linear-gradient(
            135deg,
            rgba(139,92,246,.18),
            rgba(99,102,241,.10)
          );
          border-color: rgba(139,92,246,.25);
        }

        .zuqen-sidebar-action .label {
          flex: 1;
          font-size: 13px;
          font-weight: 650;
        }

        .zuqen-sidebar-section {
          margin-top: 18px;
          min-height: 0;
          display: flex;
          flex-direction: column;
          flex: 1;
        }

        .zuqen-section-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 7px 8px;
          color: var(--z-text-3);
          font-size: 11px;
          font-weight: 750;
          text-transform: uppercase;
          letter-spacing: .08em;
        }

        .zuqen-chat-list {
          overflow-y: auto;
          padding-right: 3px;
          min-height: 0;
        }

        .zuqen-chat-list::-webkit-scrollbar,
        .zuqen-chat-scroll::-webkit-scrollbar {
          width: 7px;
        }

        .zuqen-chat-list::-webkit-scrollbar-thumb,
        .zuqen-chat-scroll::-webkit-scrollbar-thumb {
          background: var(--z-surface-3);
          border-radius: 999px;
        }

        .zuqen-chat-item {
          position: relative;
          width: 100%;
          display: flex;
          align-items: center;
          min-height: 47px;
          padding: 0 8px 0 11px;
          border-radius: 12px;
          color: var(--z-text-2);
          background: transparent;
          cursor: pointer;
          transition: .16s ease;
          text-align: left;
          margin-bottom: 2px;
        }

        .zuqen-chat-item:hover {
          background: var(--z-surface);
          color: var(--z-text);
        }

        .zuqen-chat-item.active {
          background:
            linear-gradient(
              90deg,
              rgba(139,92,246,.16),
              rgba(99,102,241,.07)
            );
          color: var(--z-text);
        }

        .zuqen-chat-item-main {
          min-width: 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .zuqen-chat-title {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 13px;
          font-weight: 600;
        }

        .zuqen-chat-time {
          font-size: 10px;
          color: var(--z-text-3);
        }

        .zuqen-chat-menu-wrap {
          position: relative;
        }

        .zuqen-icon-button {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: transparent;
          color: var(--z-text-3);
          cursor: pointer;
          transition: .16s ease;
        }

        .zuqen-icon-button:hover {
          color: var(--z-text);
          background: var(--z-surface-2);
        }

        .zuqen-floating-menu {
          position: absolute;
          right: 0;
          top: calc(100% + 6px);
          min-width: 170px;
          padding: 6px;
          border-radius: 14px;
          background: var(--z-bg-2);
          border: 1px solid var(--z-border-strong);
          box-shadow: var(--z-shadow);
          z-index: 100;
        }

        .zuqen-floating-menu button {
          width: 100%;
          min-height: 38px;
          padding: 0 10px;
          display: flex;
          align-items: center;
          gap: 9px;
          color: var(--z-text-2);
          background: transparent;
          border-radius: 9px;
          cursor: pointer;
          text-align: left;
          font-size: 12px;
        }

        .zuqen-floating-menu button:hover {
          background: var(--z-surface);
          color: var(--z-text);
        }

        .zuqen-floating-menu button.danger:hover {
          color: var(--z-danger);
          background: rgba(251,113,133,.08);
        }

        .zuqen-sidebar-bottom {
          border-top: 1px solid var(--z-border);
          padding-top: 11px;
          margin-top: 10px;
        }

        .zuqen-account {
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 50px;
          padding: 5px 7px;
          border-radius: 13px;
        }

        .zuqen-avatar {
          width: 34px;
          height: 34px;
          flex: 0 0 34px;
          border-radius: 11px;
          display: grid;
          place-items: center;
          background: linear-gradient(135deg, #7c3aed, #0891b2);
          color: white;
        }

        .zuqen-account-info {
          min-width: 0;
          flex: 1;
        }

        .zuqen-account-name {
          font-size: 12px;
          font-weight: 700;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .zuqen-account-status {
          font-size: 10px;
          color: var(--z-text-3);
          margin-top: 2px;
        }

        .zuqen-auth-button {
          width: 100%;
          min-height: 40px;
          display: flex;
          align-items: center;
          gap: 9px;
          border-radius: 11px;
          color: var(--z-text-2);
          background: var(--z-surface);
          cursor: pointer;
          padding: 0 11px;
          font-size: 12px;
          font-weight: 650;
          border: 1px solid var(--z-border);
        }

        .zuqen-auth-button:hover {
          color: var(--z-text);
          background: var(--z-surface-2);
        }

        .zuqen-main {
          min-width: 0;
          flex: 1;
          height: 100vh;
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
        }

        .zuqen-topbar {
          height: 68px;
          flex: 0 0 68px;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 0 20px;
          border-bottom: 1px solid var(--z-border);
          background: rgba(8,9,15,.48);
          backdrop-filter: blur(22px);
          position: relative;
          z-index: 30;
        }

        .light .zuqen-topbar {
          background: rgba(255,255,255,.62);
        }

        .zuqen-topbar-left,
        .zuqen-topbar-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .zuqen-topbar-left {
          min-width: 0;
          flex: 1;
        }

        .zuqen-topbar-right {
          flex-shrink: 0;
        }

        .zuqen-topbar-button {
          height: 39px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 0 11px;
          border-radius: 11px;
          color: var(--z-text-2);
          background: transparent;
          border: 1px solid transparent;
          cursor: pointer;
          font-size: 12px;
          font-weight: 650;
          transition: .16s ease;
          white-space: nowrap;
        }

        .zuqen-topbar-button:hover {
          color: var(--z-text);
          background: var(--z-surface);
          border-color: var(--z-border);
        }

        .zuqen-topbar-button.gradient {
          color: white;
          background:
            linear-gradient(135deg, #7c3aed, #4f46e5 55%, #0891b2);
          box-shadow: 0 7px 22px rgba(99,102,241,.20);
        }

        .zuqen-topbar-button.gradient:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 27px rgba(99,102,241,.27);
        }

        .zuqen-agent-wrap,
        .zuqen-credit-wrap {
          position: relative;
        }

        .zuqen-agent-button {
          height: 40px;
          min-width: 170px;
          max-width: 230px;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 0 10px;
          border-radius: 12px;
          background: var(--z-surface);
          border: 1px solid var(--z-border);
          color: var(--z-text);
          cursor: pointer;
          text-align: left;
        }

        .zuqen-agent-dot {
          width: 27px;
          height: 27px;
          border-radius: 9px;
          display: grid;
          place-items: center;
          color: white;
          background: linear-gradient(135deg, #8b5cf6, #06b6d4);
          flex: 0 0 27px;
        }

        .zuqen-agent-label {
          min-width: 0;
          flex: 1;
        }

        .zuqen-agent-label strong {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 12px;
        }

        .zuqen-agent-label span {
          display: block;
          color: var(--z-text-3);
          font-size: 9px;
          margin-top: 1px;
        }

        .zuqen-dropdown {
          position: absolute;
          right: 0;
          top: calc(100% + 8px);
          width: 310px;
          padding: 7px;
          border-radius: 17px;
          background: var(--z-bg-2);
          border: 1px solid var(--z-border-strong);
          box-shadow: var(--z-shadow);
          z-index: 100;
        }

        .zuqen-agent-option {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px;
          border-radius: 12px;
          background: transparent;
          color: var(--z-text);
          cursor: pointer;
          text-align: left;
        }

        .zuqen-agent-option:hover {
          background: var(--z-surface);
        }

        .zuqen-agent-option.active {
          background: rgba(139,92,246,.11);
        }

        .zuqen-agent-option-info {
          min-width: 0;
          flex: 1;
        }

        .zuqen-agent-option-info strong {
          display: block;
          font-size: 12px;
        }

        .zuqen-agent-option-info span {
          display: block;
          color: var(--z-text-3);
          font-size: 10px;
          margin-top: 3px;
        }

        .zuqen-credit-button {
          height: 40px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 11px;
          border-radius: 12px;
          background: var(--z-surface);
          border: 1px solid var(--z-border);
          color: var(--z-text);
          cursor: pointer;
        }

        .zuqen-credit-count {
          font-size: 12px;
          font-weight: 800;
        }

        .zuqen-credit-label {
          color: var(--z-text-3);
          font-size: 10px;
        }

        .zuqen-credit-dropdown {
          position: absolute;
          right: 0;
          top: calc(100% + 8px);
          width: 270px;
          padding: 15px;
          border-radius: 17px;
          background: var(--z-bg-2);
          border: 1px solid var(--z-border-strong);
          box-shadow: var(--z-shadow);
          z-index: 100;
        }

        .zuqen-credit-dropdown h4 {
          margin: 0 0 6px;
          font-size: 14px;
        }

        .zuqen-credit-dropdown p {
          margin: 0;
          color: var(--z-text-2);
          font-size: 11px;
          line-height: 1.55;
        }

        .zuqen-credit-number {
          margin: 13px 0;
          padding: 13px;
          border-radius: 13px;
          background:
            linear-gradient(
              135deg,
              rgba(139,92,246,.15),
              rgba(34,211,238,.08)
            );
          border: 1px solid var(--z-border);
        }

        .zuqen-credit-number strong {
          font-size: 25px;
          letter-spacing: -.04em;
        }

        .zuqen-content {
          min-height: 0;
          flex: 1;
          position: relative;
          overflow: hidden;
        }

        .zuqen-home {
          height: 100%;
          overflow-y: auto;
          padding: 50px 24px 80px;
        }

        .zuqen-home-inner {
          width: min(1050px, 100%);
          margin: 0 auto;
        }

        .zuqen-hero {
          text-align: center;
          padding: 28px 0 26px;
        }

        .zuqen-hero-badge {
          width: fit-content;
          margin: 0 auto 15px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 7px 11px;
          border-radius: 999px;
          background: rgba(139,92,246,.10);
          border: 1px solid rgba(139,92,246,.22);
          color: #a78bfa;
          font-size: 11px;
          font-weight: 750;
        }

        .light .zuqen-hero-badge {
          color: #6d28d9;
        }

        .zuqen-hero h1 {
          margin: 0;
          font-size: clamp(34px, 5vw, 58px);
          line-height: 1;
          letter-spacing: -.055em;
          font-weight: 850;
          background:
            linear-gradient(
              100deg,
              var(--z-text) 15%,
              #a78bfa 50%,
              #67e8f9 88%
            );
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .zuqen-hero p {
          width: min(610px, 100%);
          margin: 16px auto 0;
          color: var(--z-text-2);
          font-size: 14px;
          line-height: 1.65;
        }

        .zuqen-home-composer {
          width: min(820px, 100%);
          margin: 0 auto;
        }

        .zuqen-composer {
          position: relative;
          border: 1px solid var(--z-border-strong);
          background:
            linear-gradient(
              145deg,
              rgba(255,255,255,.075),
              rgba(255,255,255,.035)
            );
          border-radius: 24px;
          box-shadow:
            0 25px 65px rgba(0,0,0,.17),
            inset 0 1px rgba(255,255,255,.04);
          padding: 13px;
          backdrop-filter: blur(22px);
        }

        .light .zuqen-composer {
          background: rgba(255,255,255,.86);
          box-shadow: 0 25px 65px rgba(30,40,70,.10);
        }

        .zuqen-composer:focus-within {
          border-color: rgba(139,92,246,.48);
          box-shadow:
            0 25px 65px rgba(0,0,0,.17),
            0 0 0 3px rgba(139,92,246,.07);
        }

        .zuqen-composer-input {
          width: 100%;
          min-height: 70px;
          max-height: 220px;
          resize: none;
          border: 0;
          outline: 0;
          background: transparent;
          color: var(--z-text);
          padding: 7px 8px 8px;
          line-height: 1.55;
          font-size: 14px;
        }

        .zuqen-composer-input::placeholder {
          color: var(--z-text-3);
        }

        .zuqen-composer-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding-top: 6px;
        }

        .zuqen-composer-left,
        .zuqen-composer-right {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .zuqen-composer-icon {
          width: 37px;
          height: 37px;
          display: grid;
          place-items: center;
          border-radius: 11px;
          color: var(--z-text-3);
          background: transparent;
          cursor: pointer;
        }

        .zuqen-composer-icon:hover {
          color: var(--z-text);
          background: var(--z-surface);
        }

        .zuqen-send {
          width: 39px;
          height: 39px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          color: white;
          background:
            linear-gradient(135deg, #8b5cf6, #6366f1 55%, #0891b2);
          cursor: pointer;
          box-shadow: 0 7px 20px rgba(99,102,241,.25);
          transition: .16s ease;
        }

        .zuqen-send:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .zuqen-send:disabled {
          opacity: .35;
          cursor: not-allowed;
          box-shadow: none;
        }

        .zuqen-stop {
          width: 39px;
          height: 39px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          color: white;
          background: #ef4444;
          cursor: pointer;
          box-shadow: 0 7px 20px rgba(239,68,68,.20);
        }

        .zuqen-attachments {
          display: flex;
          gap: 7px;
          overflow-x: auto;
          padding: 0 3px 8px;
        }

        .zuqen-attachment-chip {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          max-width: 220px;
          padding: 7px 8px;
          border-radius: 10px;
          background: var(--z-surface);
          border: 1px solid var(--z-border);
          color: var(--z-text-2);
          font-size: 10px;
        }

        .zuqen-attachment-chip span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .zuqen-attachment-remove {
          width: 20px;
          height: 20px;
          display: grid;
          place-items: center;
          border-radius: 6px;
          background: transparent;
          color: var(--z-text-3);
          cursor: pointer;
        }

        .zuqen-attachment-remove:hover {
          color: var(--z-danger);
          background: rgba(251,113,133,.08);
        }

        .zuqen-suggestions {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          width: min(820px, 100%);
          margin: 15px auto 0;
        }

        .zuqen-suggestion {
          min-height: 78px;
          padding: 13px;
          text-align: left;
          border-radius: 15px;
          background: var(--z-surface);
          border: 1px solid var(--z-border);
          color: var(--z-text);
          cursor: pointer;
          transition: .18s ease;
        }

        .zuqen-suggestion:hover {
          transform: translateY(-2px);
          background: var(--z-surface-2);
          border-color: rgba(139,92,246,.28);
        }

        .zuqen-suggestion strong {
          display: block;
          font-size: 12px;
        }

        .zuqen-suggestion span {
          display: block;
          margin-top: 6px;
          color: var(--z-text-3);
          font-size: 10px;
          line-height: 1.4;
        }

        .zuqen-agents-title {
          margin: 48px 0 12px;
          font-size: 13px;
          font-weight: 800;
        }

        .zuqen-agent-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 11px;
        }

        .zuqen-agent-card {
          min-height: 132px;
          padding: 15px;
          border-radius: 17px;
          border: 1px solid var(--z-border);
          background: var(--z-surface);
          color: var(--z-text);
          cursor: pointer;
          text-align: left;
          transition: .18s ease;
        }

        .zuqen-agent-card:hover {
          transform: translateY(-2px);
          background: var(--z-surface-2);
          border-color: rgba(139,92,246,.25);
        }

        .zuqen-agent-card-icon {
          width: 35px;
          height: 35px;
          display: grid;
          place-items: center;
          border-radius: 11px;
          color: white;
          margin-bottom: 17px;
          background: linear-gradient(135deg, #8b5cf6, #06b6d4);
        }

        .zuqen-agent-card:nth-child(2) .zuqen-agent-card-icon {
          background: linear-gradient(135deg, #2563eb, #06b6d4);
        }

        .zuqen-agent-card:nth-child(3) .zuqen-agent-card-icon {
          background: linear-gradient(135deg, #db2777, #8b5cf6);
        }

        .zuqen-agent-card:nth-child(4) .zuqen-agent-card-icon {
          background: linear-gradient(135deg, #f97316, #ec4899);
        }

        .zuqen-agent-card strong {
          display: block;
          font-size: 12px;
        }

        .zuqen-agent-card span {
          display: block;
          color: var(--z-text-3);
          font-size: 10px;
          line-height: 1.45;
          margin-top: 5px;
        }

        .zuqen-chat-scroll {
          height: 100%;
          overflow-y: auto;
          padding: 28px 24px 150px;
          scroll-behavior: smooth;
        }

        .zuqen-chat-inner {
          width: min(900px, 100%);
          margin: 0 auto;
        }

        .zuqen-message-row {
          display: flex;
          width: 100%;
          margin-bottom: 27px;
        }

        .zuqen-message-row.user {
          justify-content: flex-end;
        }

        .zuqen-message-row.assistant {
          justify-content: flex-start;
        }

        .zuqen-message {
          max-width: 83%;
        }

        .zuqen-message-row.user .zuqen-message {
          max-width: min(720px, 83%);
        }

        .zuqen-message-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 7px;
          color: var(--z-text-3);
          font-size: 10px;
          font-weight: 700;
        }

        .zuqen-message-row.user .zuqen-message-header {
          justify-content: flex-end;
        }

        .zuqen-message-avatar {
          width: 25px;
          height: 25px;
          display: grid;
          place-items: center;
          border-radius: 8px;
          color: white;
          background: linear-gradient(135deg, #8b5cf6, #06b6d4);
        }

        .zuqen-user-avatar {
          background: linear-gradient(135deg, #334155, #64748b);
        }

        .zuqen-message-bubble {
          border-radius: 18px;
          border: 1px solid var(--z-border);
          padding: 13px 15px;
          background: var(--z-surface);
          box-shadow: 0 8px 30px rgba(0,0,0,.05);
        }

        .zuqen-message-row.user .zuqen-message-bubble {
          border-top-right-radius: 7px;
          background:
            linear-gradient(
              135deg,
              rgba(124,58,237,.22),
              rgba(79,70,229,.15)
            );
          border-color: rgba(139,92,246,.22);
        }

        .light .zuqen-message-row.user .zuqen-message-bubble {
          background:
            linear-gradient(
              135deg,
              rgba(124,58,237,.10),
              rgba(79,70,229,.07)
            );
        }

        .zuqen-message-row.assistant .zuqen-message-bubble {
          border-top-left-radius: 7px;
          background: rgba(255,255,255,.035);
        }

        .zuqen-message-content {
          font-size: 13px;
          line-height: 1.68;
          color: var(--z-text);
          min-width: 0;
        }

        .zuqen-md-p {
          margin: 0;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .zuqen-md-h1,
        .zuqen-md-h2,
        .zuqen-md-h3 {
          margin: 5px 0 10px;
          line-height: 1.25;
          letter-spacing: -.02em;
        }

        .zuqen-md-h1 {
          font-size: 22px;
        }

        .zuqen-md-h2 {
          font-size: 18px;
        }

        .zuqen-md-h3 {
          font-size: 15px;
        }

        .zuqen-md-list {
          display: flex;
          gap: 9px;
          margin: 5px 0;
          white-space: pre-wrap;
        }

        .zuqen-md-list > span:first-child {
          color: #a78bfa;
          flex: 0 0 auto;
        }

        .zuqen-text-gap {
          height: 6px;
        }

        .zuqen-message-actions {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: 7px;
          opacity: 0;
          transition: opacity .16s ease;
        }

        .zuqen-message:hover .zuqen-message-actions {
          opacity: 1;
        }

        .zuqen-message-row.user .zuqen-message-actions {
          justify-content: flex-end;
        }

        .zuqen-message-action {
          height: 29px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 0 8px;
          border-radius: 8px;
          color: var(--z-text-3);
          background: transparent;
          cursor: pointer;
          font-size: 10px;
        }

        .zuqen-message-action:hover {
          color: var(--z-text);
          background: var(--z-surface);
        }

        .zuqen-edit-area {
          width: 100%;
          min-height: 110px;
          resize: vertical;
          border: 1px solid rgba(139,92,246,.35);
          outline: none;
          border-radius: 12px;
          padding: 11px;
          background: rgba(0,0,0,.12);
          color: var(--z-text);
          line-height: 1.55;
          font-size: 13px;
        }

        .light .zuqen-edit-area {
          background: rgba(255,255,255,.6);
        }

        .zuqen-edit-actions {
          display: flex;
          justify-content: flex-end;
          gap: 7px;
          margin-top: 8px;
        }

        .zuqen-small-button {
          height: 31px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 0 10px;
          border-radius: 9px;
          background: var(--z-surface);
          color: var(--z-text-2);
          cursor: pointer;
          font-size: 10px;
          border: 1px solid var(--z-border);
        }

        .zuqen-small-button.primary {
          color: white;
          border-color: transparent;
          background: linear-gradient(135deg, #7c3aed, #4f46e5);
        }

        .zuqen-attachments-message {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-bottom: 9px;
        }

        .zuqen-attachment-preview {
          width: 180px;
          border: 1px solid var(--z-border);
          border-radius: 12px;
          overflow: hidden;
          background: var(--z-surface);
        }

        .zuqen-attachment-preview img {
          width: 100%;
          height: 115px;
          object-fit: cover;
          display: block;
        }

        .zuqen-attachment-preview > div {
          padding: 8px;
        }

        .zuqen-attachment-preview strong,
        .zuqen-attachment-preview span {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .zuqen-attachment-preview strong {
          font-size: 10px;
        }

        .zuqen-attachment-preview span {
          margin-top: 2px;
          color: var(--z-text-3);
          font-size: 9px;
        }

        .zuqen-attachment-file {
          min-width: 220px;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 9px;
          border-radius: 11px;
          border: 1px solid var(--z-border);
          background: var(--z-surface);
        }

        .zuqen-file-icon {
          width: 32px;
          height: 32px;
          border-radius: 9px;
          display: grid;
          place-items: center;
          color: #a78bfa;
          background: rgba(139,92,246,.11);
        }

        .zuqen-file-meta {
          min-width: 0;
        }

        .zuqen-file-meta strong,
        .zuqen-file-meta span {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .zuqen-file-meta strong {
          font-size: 10px;
        }

        .zuqen-file-meta span {
          color: var(--z-text-3);
          font-size: 9px;
          margin-top: 2px;
        }

        .zuqen-code-shell {
          margin: 12px 0;
          overflow: hidden;
          border-radius: 13px;
          border: 1px solid rgba(255,255,255,.10);
          background: #080a10;
        }

        .zuqen-code-header {
          min-height: 38px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 0 9px 0 12px;
          border-bottom: 1px solid rgba(255,255,255,.08);
          background: rgba(255,255,255,.035);
        }

        .zuqen-code-language {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #c4b5fd;
          font-size: 10px;
          font-weight: 700;
        }

        .zuqen-code-actions {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .zuqen-code-action {
          min-height: 27px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 0 7px;
          border-radius: 7px;
          color: #a1a1aa;
          background: transparent;
          cursor: pointer;
          font-size: 9px;
        }

        .zuqen-code-action:hover {
          color: white;
          background: rgba(255,255,255,.07);
        }

        .zuqen-code-content {
          overflow-x: auto;
          margin: 0;
          padding: 15px;
          color: #e4e4e7;
          font-size: 11px;
          line-height: 1.65;
          font-family:
            "SFMono-Regular",
            Consolas,
            "Liberation Mono",
            Menlo,
            monospace;
          white-space: pre;
        }

        .zuqen-code-content.light {
          color: #e4e4e7;
        }

        .zuqen-preview-wrap {
          padding: 8px;
          background: #0a0c12;
        }

        .zuqen-preview-frame {
          width: 100%;
          height: 390px;
          display: block;
          border: 0;
          border-radius: 9px;
          background: white;
        }

        .zuqen-code-note {
          display: flex;
          align-items: flex-start;
          gap: 6px;
          padding: 8px 12px 10px;
          color: #8f93a3;
          font-size: 9px;
          line-height: 1.45;
          border-top: 1px solid rgba(255,255,255,.06);
        }

        .zuqen-typing {
          display: flex;
          align-items: center;
          gap: 5px;
          min-height: 22px;
        }

        .zuqen-typing span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #a78bfa;
          animation: zuqenBounce 1.1s infinite ease-in-out;
        }

        .zuqen-typing span:nth-child(2) {
          animation-delay: .12s;
        }

        .zuqen-typing span:nth-child(3) {
          animation-delay: .24s;
        }

        @keyframes zuqenBounce {
          0%, 60%, 100% {
            transform: translateY(0);
            opacity: .45;
          }
          30% {
            transform: translateY(-4px);
            opacity: 1;
          }
        }

        .zuqen-chat-composer-area {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 20;
          padding: 20px 24px 17px;
          background:
            linear-gradient(
              to bottom,
              transparent,
              rgba(8,9,15,.90) 24%,
              rgba(8,9,15,.98)
            );
          pointer-events: none;
        }

        .light .zuqen-chat-composer-area {
          background:
            linear-gradient(
              to bottom,
              transparent,
              rgba(245,247,251,.88) 24%,
              rgba(245,247,251,.98)
            );
        }

        .zuqen-chat-composer-area > * {
          pointer-events: auto;
        }

        .zuqen-chat-composer-wrap {
          width: min(900px, 100%);
          margin: 0 auto;
        }

        .zuqen-composer-disclaimer {
          text-align: center;
          color: var(--z-text-3);
          font-size: 9px;
          margin-top: 8px;
        }

        .zuqen-scroll-latest {
          position: absolute;
          right: 30px;
          bottom: 147px;
          z-index: 25;
          height: 36px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 0 11px;
          border-radius: 999px;
          background: var(--z-bg-2);
          border: 1px solid var(--z-border-strong);
          color: var(--z-text-2);
          box-shadow: var(--z-shadow);
          cursor: pointer;
          font-size: 10px;
          font-weight: 700;
        }

        .zuqen-scroll-latest:hover {
          color: var(--z-text);
        }

        .zuqen-error {
          position: absolute;
          top: 80px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 60;
          width: min(650px, calc(100% - 30px));
          padding: 11px 13px;
          border-radius: 13px;
          display: flex;
          align-items: flex-start;
          gap: 9px;
          color: #fecdd3;
          background: rgba(127,29,29,.82);
          border: 1px solid rgba(251,113,133,.25);
          box-shadow: var(--z-shadow);
          font-size: 11px;
        }

        .zuqen-error button {
          margin-left: auto;
          color: #fecdd3;
          background: transparent;
          cursor: pointer;
        }

        .zuqen-loading-screen {
          height: 100%;
          display: grid;
          place-items: center;
          background: transparent;
        }

        .zuqen-loading-card {
          display: flex;
          align-items: center;
          gap: 11px;
          color: var(--z-text-2);
          font-size: 12px;
        }

        .zuqen-loading-orb {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          background: linear-gradient(135deg, #8b5cf6, #06b6d4);
          animation: zuqenPulse 1.3s infinite ease-in-out;
        }

        @keyframes zuqenPulse {
          0%, 100% {
            transform: scale(.9);
            opacity: .65;
          }
          50% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .zuqen-search-overlay {
          position: absolute;
          top: 70px;
          left: 18px;
          right: 18px;
          z-index: 45;
          display: flex;
          justify-content: center;
          pointer-events: none;
        }

        .zuqen-search-box {
          width: min(650px, 100%);
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 8px 10px;
          border-radius: 15px;
          background: var(--z-bg-2);
          border: 1px solid var(--z-border-strong);
          box-shadow: var(--z-shadow);
          pointer-events: auto;
        }

        .zuqen-search-box input {
          min-width: 0;
          flex: 1;
          border: 0;
          outline: 0;
          background: transparent;
          color: var(--z-text);
          font-size: 12px;
        }

        .zuqen-search-box input::placeholder {
          color: var(--z-text-3);
        }

        .zuqen-empty {
          padding: 30px 10px;
          text-align: center;
          color: var(--z-text-3);
          font-size: 11px;
        }

        .zuqen-overlay {
          display: none;
        }

        .zuqen-mobile-only {
          display: none;
        }

        @media (max-width: 1120px) {
          .zuqen-topbar-button span {
            display: none;
          }

          .zuqen-topbar-button {
            width: 40px;
            padding: 0;
            justify-content: center;
          }

          .zuqen-agent-button {
            min-width: 150px;
          }

          .zuqen-suggestions,
          .zuqen-agent-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 820px) {
          .zuqen-sidebar {
            position: fixed;
            left: 0;
            top: 0;
            bottom: 0;
            transform: translateX(-100%);
            width: 292px;
            flex-basis: 292px;
          }

          .zuqen-sidebar.open-mobile {
            transform: translateX(0);
          }

          .zuqen-sidebar.closed {
            width: 292px;
            flex-basis: 292px;
          }

          .zuqen-sidebar.closed .zuqen-sidebar-inner {
            visibility: hidden;
          }

          .zuqen-overlay {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,.42);
            z-index: 40;
          }

          .zuqen-mobile-only {
            display: grid;
          }

          .zuqen-topbar {
            padding: 0 11px;
            height: 60px;
            flex-basis: 60px;
          }

          .zuqen-topbar-right {
            margin-left: auto;
          }

          .zuqen-topbar-button {
            width: 38px;
            height: 38px;
          }

          .zuqen-agent-button {
            min-width: 38px;
            width: 38px;
            padding: 0;
            justify-content: center;
          }

          .zuqen-agent-label,
          .zuqen-agent-button > svg {
            display: none;
          }

          .zuqen-credit-label {
            display: none;
          }

          .zuqen-credit-button {
            padding: 0 9px;
          }

          .zuqen-home {
            padding: 28px 15px 60px;
          }

          .zuqen-hero {
            padding: 18px 0 23px;
          }

          .zuqen-hero h1 {
            font-size: 38px;
          }

          .zuqen-chat-scroll {
            padding: 20px 14px 145px;
          }

          .zuqen-chat-composer-area {
            padding: 14px 10px 11px;
          }

          .zuqen-scroll-latest {
            right: 15px;
            bottom: 142px;
          }

          .zuqen-message {
            max-width: 94%;
          }

          .zuqen-message-row.user .zuqen-message {
            max-width: 94%;
          }
        }

        @media (max-width: 560px) {
          .zuqen-suggestions,
          .zuqen-agent-grid {
            grid-template-columns: 1fr;
          }

          .zuqen-hero p {
            font-size: 12px;
          }

          .zuqen-topbar-right .zuqen-topbar-button:nth-child(1),
          .zuqen-topbar-right .zuqen-topbar-button:nth-child(2) {
            display: none;
          }

          .zuqen-composer {
            border-radius: 19px;
            padding: 9px;
          }

          .zuqen-composer-input {
            min-height: 58px;
          }

          .zuqen-message-bubble {
            padding: 11px 12px;
          }

          .zuqen-code-header {
            flex-wrap: wrap;
            padding: 7px 9px;
          }

          .zuqen-preview-frame {
            height: 300px;
          }
        }
      `}</style>

      {!authReady ? (
        <div className="zuqen-loading-screen">
          <div className="zuqen-loading-card">
            <div className="zuqen-loading-orb" />
            <span>Loading ZUQEN AI…</span>
          </div>
        </div>
      ) : (
        <div className="zuqen-shell">
          {mobileSidebarOpen && (
            <div
              className="zuqen-overlay"
              onClick={() => setMobileSidebarOpen(false)}
            />
          )}

          <aside
            className={[
              "zuqen-sidebar",
              sidebarOpen ? "" : "closed",
              mobileSidebarOpen ? "open-mobile" : "",
            ].join(" ")}
          >
            <div className="zuqen-sidebar-inner">
              <div className="zuqen-brand">
                <div className="zuqen-brand-mark">
                  <Icon name="spark" size={18} strokeWidth={2.2} />
                </div>

                <div className="zuqen-brand-text">
                  <div className="zuqen-brand-title">ZUQEN AI</div>
                  <div className="zuqen-brand-subtitle">
                    Intelligent workspace
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="zuqen-sidebar-action primary"
                onClick={createConversation}
              >
                <Icon name="plus" size={18} />
                <span className="label">New chat</span>
              </button>

              <button
                type="button"
                className="zuqen-sidebar-action"
                onClick={() => {
                  setSearchOpen(true);
                  setMobileSidebarOpen(false);
                }}
              >
                <Icon name="search" size={17} />
                <span className="label">Search conversations</span>
                <span style={{ opacity: 0.5 }}>⌘K</span>
              </button>

              <button
                type="button"
                className="zuqen-sidebar-action"
                onClick={() => {
                  window.location.href = "/automation";
                }}
              >
                <Icon name="spark" size={17} />
                <span className="label">Automation Mode</span>
              </button>

              <button
                type="button"
                className="zuqen-sidebar-action"
                onClick={() => {
                  window.location.href = "/marketplace";
                }}
              >
                <Icon name="folder" size={17} />
                <span className="label">Buy / Sell Templates</span>
              </button>

              <div className="zuqen-sidebar-section">
                <div className="zuqen-section-title">
                  <span>Conversations</span>
                  <span>{visibleChats.length}</span>
                </div>

                <div className="zuqen-chat-list">
                  {visibleChats.length === 0 ? (
                    <div className="zuqen-empty">
                      No conversations yet.
                    </div>
                  ) : (
                    visibleChats.map((chat) => (
                      <div
                        className={[
                          "zuqen-chat-item",
                          activeChatId === chat.id ? "active" : "",
                        ].join(" ")}
                        key={chat.id}
                        onClick={() => selectChat(chat)}
                      >
                        <div className="zuqen-chat-item-main">
                          <div className="zuqen-chat-title">
                            {chat.title}
                          </div>
                          <div className="zuqen-chat-time">
                            {formatDate(chat.updated_at)}
                          </div>
                        </div>

                        <div className="zuqen-chat-menu-wrap">
                          <button
                            type="button"
                            className="zuqen-icon-button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setMenuChatId((current) =>
                                current === chat.id
                                  ? null
                                  : chat.id,
                              );
                            }}
                            aria-label="Conversation options"
                          >
                            <Icon name="more" size={17} />
                          </button>

                          {menuChatId === chat.id && (
                            <div className="zuqen-floating-menu">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setRenameChatId(chat.id);
                                  setRenameValue(chat.title);
                                  setMenuChatId(null);
                                }}
                              >
                                <Icon name="edit" size={15} />
                                Rename
                              </button>

                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void archiveChat(
                                    chat.id,
                                    !chat.archived,
                                  );
                                }}
                              >
                                <Icon
                                  name={
                                    chat.archived
                                      ? "restore"
                                      : "archive"
                                  }
                                  size={15}
                                />
                                {chat.archived
                                  ? "Restore"
                                  : "Archive"}
                              </button>

                              <button
                                type="button"
                                className="danger"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void deleteChat(chat.id);
                                }}
                              >
                                <Icon name="trash" size={15} />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}

                  {archivedChats.length > 0 && (
                    <>
                      <div
                        className="zuqen-section-title"
                        style={{
                          marginTop: 18,
                          paddingTop: 12,
                          borderTop:
                            "1px solid var(--z-border)",
                        }}
                      >
                        <span>Archived</span>
                        <span>{archivedChats.length}</span>
                      </div>

                      {archivedChats.map((chat) => (
                        <div
                          className="zuqen-chat-item"
                          key={chat.id}
                          onClick={() => selectChat(chat)}
                        >
                          <div className="zuqen-chat-item-main">
                            <div className="zuqen-chat-title">
                              {chat.title}
                            </div>
                            <div className="zuqen-chat-time">
                              {formatDate(chat.updated_at)}
                            </div>
                          </div>

                          <button
                            type="button"
                            className="zuqen-icon-button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void archiveChat(chat.id, false);
                            }}
                            title="Restore"
                          >
                            <Icon name="restore" size={16} />
                          </button>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>

              <div className="zuqen-sidebar-bottom">
                {user?.is_anonymous ? (
                  <button
                    type="button"
                    className="zuqen-auth-button"
                    onClick={goToAuth}
                  >
                    <div className="zuqen-avatar">
                      <Icon name="user" size={16} />
                    </div>

                    <span style={{ flex: 1 }}>
                      Sign in / Create account
                    </span>

                    <Icon name="arrow" size={14} />
                  </button>
                ) : (
                  <div className="zuqen-account">
                    <div className="zuqen-avatar">
                      <Icon name="user" size={16} />
                    </div>

                    <div className="zuqen-account-info">
                      <div className="zuqen-account-name">
                        {user?.email || "ZUQEN account"}
                      </div>

                      <div className="zuqen-account-status">
                        Signed in
                      </div>
                    </div>

                    <button
                      type="button"
                      className="zuqen-icon-button"
                      onClick={signOut}
                      title="Sign out"
                    >
                      <Icon name="logout" size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </aside>

          <section className="zuqen-main">
            <header className="zuqen-topbar">
              <div className="zuqen-topbar-left">
                <button
                  type="button"
                  className="zuqen-topbar-button"
                  onClick={() => {
                    if (window.innerWidth <= 820) {
                      setMobileSidebarOpen(true);
                    } else {
                      setSidebarOpen((value) => !value);
                    }
                  }}
                  title="Toggle sidebar"
                >
                  <Icon name="sidebar" size={18} />
                </button>

                <button
                  type="button"
                  className="zuqen-topbar-button"
                  onClick={() => setSearchOpen(true)}
                  title="Search"
                >
                  <Icon name="search" size={17} />
                  <span>Search</span>
                </button>

                {!isHome && (
                  <div className="zuqen-agent-wrap">
                    <button
                      type="button"
                      className="zuqen-agent-button"
                      onClick={() =>
                        setAgentOpen((value) => !value)
                      }
                    >
                      <div className="zuqen-agent-dot">
                        <Icon
                          name={selectedAgent.icon}
                          size={15}
                        />
                      </div>

                      <div className="zuqen-agent-label">
                        <strong>{selectedAgent.name}</strong>
                        <span>{selectedAgent.description}</span>
                      </div>

                      <Icon name="chevron" size={14} />
                    </button>

                    {agentOpen && (
                      <div className="zuqen-dropdown">
                        {AGENTS.map((agent) => (
                          <button
                            type="button"
                            key={agent.id}
                            className={[
                              "zuqen-agent-option",
                              selectedAgent.id === agent.id
                                ? "active"
                                : "",
                            ].join(" ")}
                            onClick={() => navigateAgent(agent)}
                          >
                            <div className="zuqen-agent-dot">
                              <Icon
                                name={agent.icon}
                                size={14}
                              />
                            </div>

                            <div className="zuqen-agent-option-info">
                              <strong>{agent.name}</strong>
                              <span>{agent.description}</span>
                            </div>

                            {selectedAgent.id === agent.id && (
                              <Icon name="check" size={15} />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="zuqen-topbar-right">
                <button
                  type="button"
                  className="zuqen-topbar-button gradient"
                  onClick={() => {
                    window.location.href = "/automation";
                  }}
                  title="Automation Mode"
                >
                  <Icon name="spark" size={16} />
                  <span>Automation</span>
                </button>

                <button
                  type="button"
                  className="zuqen-topbar-button"
                  onClick={() => {
                    window.location.href = "/marketplace";
                  }}
                  title="Buy/Sell Templates"
                >
                  <Icon name="folder" size={16} />
                  <span>Templates</span>
                </button>

                <div className="zuqen-credit-wrap">
                  <button
                    type="button"
                    className="zuqen-credit-button"
                    onClick={() =>
                      setCreditsOpen((value) => !value)
                    }
                    title="Chat Credits"
                  >
                    <Icon name="spark" size={15} />
                    <span className="zuqen-credit-count">
                      {credits}
                    </span>
                    <span className="zuqen-credit-label">
                      credits
                    </span>
                  </button>

                  {creditsOpen && (
                    <div className="zuqen-credit-dropdown">
                      <h4>ZUQEN Chat Credits</h4>
                      <p>
                        Each successful AI chat message uses 1
                        Chat Credit.
                      </p>

                      <div className="zuqen-credit-number">
                        <strong>{credits}</strong>
                        <div
                          style={{
                            color: "var(--z-text-3)",
                            fontSize: 10,
                            marginTop: 2,
                          }}
                        >
                          credits remaining
                        </div>
                      </div>

                      <p>
                        Credits are managed by the ZUQEN backend
                        credit system.
                      </p>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="zuqen-topbar-button"
                  onClick={() => setLightMode((value) => !value)}
                  title={
                    lightMode
                      ? "Switch to dark mode"
                      : "Switch to light mode"
                  }
                >
                  <Icon
                    name={lightMode ? "moon" : "sun"}
                    size={17}
                  />
                </button>
              </div>
            </header>

            {searchOpen && (
              <div className="zuqen-search-overlay">
                <div className="zuqen-search-box">
                  <Icon name="search" size={17} />

                  <input
                    autoFocus
                    value={search}
                    onChange={(event) =>
                      setSearch(event.target.value)
                    }
                    placeholder="Search your conversations…"
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        setSearchOpen(false);
                      }
                    }}
                  />

                  <button
                    type="button"
                    className="zuqen-icon-button"
                    onClick={() => {
                      setSearch("");
                      setSearchOpen(false);
                    }}
                  >
                    <Icon name="close" size={16} />
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="zuqen-error">
                <Icon name="info" size={16} />

                <span>{error}</span>

                <button
                  type="button"
                  onClick={() => setError("")}
                  aria-label="Close error"
                >
                  <Icon name="close" size={15} />
                </button>
              </div>
            )}

            <div className="zuqen-content">
              {isHome ? (
                <div className="zuqen-home">
                  <div className="zuqen-home-inner">
                    <section className="zuqen-hero">
                      <div className="zuqen-hero-badge">
                        <Icon name="spark" size={13} />
                        <span>Powered by ZUQEN</span>
                      </div>

                      <h1>What can I help you with?</h1>

                      <p>
                        Think, create, learn and build with ZUQEN AI.
                        Start a conversation or explore the ZUQEN
                        workspace.
                      </p>
                    </section>

                    <div className="zuqen-home-composer">
                      <div className="zuqen-composer">
                        {attachments.length > 0 && (
                          <div className="zuqen-attachments">
                            {attachments.map((attachment) => (
                              <div
                                className="zuqen-attachment-chip"
                                key={attachment.id}
                              >
                                <Icon name="file" size={13} />

                                <span>
                                  {attachment.name}
                                </span>

                                <button
                                  type="button"
                                  className="zuqen-attachment-remove"
                                  onClick={() =>
                                    removeAttachment(
                                      attachment.id,
                                    )
                                  }
                                >
                                  <Icon
                                    name="close"
                                    size={11}
                                  />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <textarea
                          ref={textareaRef}
                          className="zuqen-composer-input"
                          value={input}
                          onChange={(event) =>
                            setInput(event.target.value)
                          }
                          onKeyDown={handleKeyDown}
                          placeholder="Message ZUQEN AI…"
                          rows={1}
                          disabled={loading}
                        />

                        <div className="zuqen-composer-bottom">
                          <div className="zuqen-composer-left">
                            <label
                              className="zuqen-composer-icon"
                              title="Add file"
                            >
                              <Icon
                                name="paperclip"
                                size={18}
                              />

                              <input
                                type="file"
                                multiple
                                hidden
                                onChange={handleAttachment}
                                disabled={uploading || loading}
                              />
                            </label>

                            <button
                              type="button"
                              className="zuqen-composer-icon"
                              onClick={() =>
                                setAgentOpen(
                                  (value) => !value,
                                )
                              }
                              title="Choose agent"
                            >
                              <Icon name="spark" size={17} />
                            </button>

                            {uploading && (
                              <span
                                style={{
                                  color:
                                    "var(--z-text-3)",
                                  fontSize: 10,
                                }}
                              >
                                Uploading…
                              </span>
                            )}
                          </div>

                          <div className="zuqen-composer-right">
                            {loading ? (
                              <button
                                type="button"
                                className="zuqen-stop"
                                onClick={stopGeneration}
                                title="Stop generating"
                              >
                                <Icon name="stop" size={17} />
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="zuqen-send"
                                onClick={() => void sendMessage()}
                                disabled={
                                  !input.trim() ||
                                  uploading ||
                                  credits <= 0
                                }
                                title={
                                  credits <= 0
                                    ? "No credits remaining"
                                    : "Send message"
                                }
                              >
                                <Icon
                                  name="send"
                                  size={17}
                                  strokeWidth={2.1}
                                />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="zuqen-composer-disclaimer">
                        ZUQEN AI can make mistakes. Check important
                        information.
                      </div>
                    </div>

                    <div className="zuqen-suggestions">
                      {[
                        {
                          title: "Write something",
                          text: "Help me write a professional message",
                        },
                        {
                          title: "Learn anything",
                          text: "Explain a difficult topic simply",
                        },
                        {
                          title: "Brainstorm ideas",
                          text: "Give me creative ideas for my project",
                        },
                        {
                          title: "Solve a problem",
                          text: "Help me solve this problem step by step",
                        },
                      ].map((suggestion) => (
                        <button
                          type="button"
                          className="zuqen-suggestion"
                          key={suggestion.title}
                          onClick={() => {
                            setInput(suggestion.text);

                            window.setTimeout(() => {
                              textareaRef.current?.focus();
                            }, 30);
                          }}
                        >
                          <strong>{suggestion.title}</strong>
                          <span>{suggestion.text}</span>
                        </button>
                      ))}
                    </div>

                    <div className="zuqen-agents-title">
                      Explore ZUQEN agents
                    </div>

                    <div className="zuqen-agent-grid">
                      {AGENTS.filter(
                        (agent) => agent.id !== "zuqen",
                      ).map((agent) => (
                        <button
                          type="button"
                          className="zuqen-agent-card"
                          key={agent.id}
                          onClick={() => navigateAgent(agent)}
                        >
                          <div className="zuqen-agent-card-icon">
                            <Icon
                              name={agent.icon}
                              size={17}
                            />
                          </div>

                          <strong>{agent.name}</strong>
                          <span>{agent.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    className="zuqen-chat-scroll"
                    ref={chatScrollRef}
                  >
                    <div className="zuqen-chat-inner">
                      {messages.length === 0 ? (
                        <div className="zuqen-empty">
                          Start your conversation with ZUQEN AI.
                        </div>
                      ) : (
                        messages.map((message) => {
                          const isEditing =
                            editingMessageId === message.id;

                          return (
                            <div
                              className={[
                                "zuqen-message-row",
                                message.role,
                              ].join(" ")}
                              key={message.id}
                            >
                              <div className="zuqen-message">
                                <div className="zuqen-message-header">
                                  {message.role === "assistant" ? (
                                    <>
                                      <div className="zuqen-message-avatar">
                                        <Icon
                                          name="spark"
                                          size={13}
                                        />
                                      </div>
                                      <span>ZUQEN AI</span>
                                    </>
                                  ) : (
                                    <>
                                      <span>You</span>
                                      <div className="zuqen-message-avatar zuqen-user-avatar">
                                        <Icon
                                          name="user"
                                          size={13}
                                        />
                                      </div>
                                    </>
                                  )}
                                </div>

                                <div className="zuqen-message-bubble">
                                  {message.attachments &&
                                    message.attachments.length >
                                      0 && (
                                      <div className="zuqen-attachments-message">
                                        {message.attachments.map(
                                          renderAttachmentPreview,
                                        )}
                                      </div>
                                    )}

                                  {isEditing ? (
                                    <>
                                      <textarea
                                        data-edit-message={
                                          message.id
                                        }
                                        className="zuqen-edit-area"
                                        value={editValue}
                                        onChange={(event) =>
                                          setEditValue(
                                            event.target.value,
                                          )
                                        }
                                      />

                                      <div className="zuqen-edit-actions">
                                        <button
                                          type="button"
                                          className="zuqen-small-button"
                                          onClick={() => {
                                            setEditingMessageId(
                                              null,
                                            );
                                            setEditValue("");
                                          }}
                                        >
                                          Cancel
                                        </button>

                                        <button
                                          type="button"
                                          className="zuqen-small-button primary"
                                          onClick={() =>
                                            void saveEditedMessage(
                                              message.id,
                                            )
                                          }
                                        >
                                          Save & regenerate
                                        </button>
                                      </div>
                                    </>
                                  ) : message.content ? (
                                    <MessageContent
                                      content={message.content}
                                      lightMode={lightMode}
                                    />
                                  ) : (
                                    <div className="zuqen-typing">
                                      <span />
                                      <span />
                                      <span />
                                    </div>
                                  )}
                                </div>

                                {!isEditing &&
                                  message.content && (
                                    <div className="zuqen-message-actions">
                                      <button
                                        type="button"
                                        className="zuqen-message-action"
                                        onClick={() =>
                                          void copyMessage(
                                            message,
                                          )
                                        }
                                      >
                                        <Icon
                                          name={
                                            copiedMessageId ===
                                            message.id
                                              ? "check"
                                              : "copy"
                                          }
                                          size={13}
                                        />
                                        {copiedMessageId ===
                                        message.id
                                          ? "Copied"
                                          : "Copy"}
                                      </button>

                                      {message.role === "user" && (
                                        <button
                                          type="button"
                                          className="zuqen-message-action"
                                          onClick={() =>
                                            startEditing(
                                              message,
                                            )
                                          }
                                        >
                                          <Icon
                                            name="edit"
                                            size={13}
                                          />
                                          Edit
                                        </button>
                                      )}

                                      {message.role ===
                                        "assistant" && (
                                        <button
                                          type="button"
                                          className="zuqen-message-action"
                                          onClick={() =>
                                            void regenerateMessage(
                                              message.id,
                                            )
                                          }
                                          disabled={loading}
                                        >
                                          <Icon
                                            name="refresh"
                                            size={13}
                                          />
                                          Regenerate
                                        </button>
                                      )}
                                    </div>
                                  )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {showScrollToBottom && (
                    <button
                      type="button"
                      className="zuqen-scroll-latest"
                      onClick={() => scrollToBottom(true)}
                    >
                      <Icon name="arrow" size={14} />
                      Latest
                    </button>
                  )}

                  <div className="zuqen-chat-composer-area">
                    <div className="zuqen-chat-composer-wrap">
                      <div className="zuqen-composer">
                        {attachments.length > 0 && (
                          <div className="zuqen-attachments">
                            {attachments.map((attachment) => (
                              <div
                                className="zuqen-attachment-chip"
                                key={attachment.id}
                              >
                                <Icon name="file" size={13} />

                                <span>
                                  {attachment.name}
                                </span>

                                <button
                                  type="button"
                                  className="zuqen-attachment-remove"
                                  onClick={() =>
                                    removeAttachment(
                                      attachment.id,
                                    )
                                  }
                                >
                                  <Icon
                                    name="close"
                                    size={11}
                                  />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <textarea
                          ref={textareaRef}
                          className="zuqen-composer-input"
                          value={input}
                          onChange={(event) =>
                            setInput(event.target.value)
                          }
                          onKeyDown={handleKeyDown}
                          placeholder="Message ZUQEN AI…"
                          rows={1}
                          disabled={loading}
                        />

                        <div className="zuqen-composer-bottom">
                          <div className="zuqen-composer-left">
                            <label
                              className="zuqen-composer-icon"
                              title="Add file"
                            >
                              <Icon
                                name="paperclip"
                                size={18}
                              />

                              <input
                                type="file"
                                multiple
                                hidden
                                onChange={handleAttachment}
                                disabled={uploading || loading}
                              />
                            </label>

                            <button
                              type="button"
                              className="zuqen-composer-icon"
                              onClick={() => {
                                setAgentOpen(
                                  (value) => !value,
                                );
                              }}
                              title="Choose agent"
                            >
                              <Icon name="spark" size={17} />
                            </button>

                            {uploading && (
                              <span
                                style={{
                                  color:
                                    "var(--z-text-3)",
                                  fontSize: 10,
                                }}
                              >
                                Uploading…
                              </span>
                            )}
                          </div>

                          <div className="zuqen-composer-right">
                            {loading ? (
                              <button
                                type="button"
                                className="zuqen-stop"
                                onClick={stopGeneration}
                                title="Stop generating"
                              >
                                <Icon name="stop" size={17} />
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="zuqen-send"
                                onClick={() => void sendMessage()}
                                disabled={
                                  !input.trim() ||
                                  uploading ||
                                  credits <= 0
                                }
                                title={
                                  credits <= 0
                                    ? "No credits remaining"
                                    : "Send message"
                                }
                              >
                                <Icon
                                  name="send"
                                  size={17}
                                  strokeWidth={2.1}
                                />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="zuqen-composer-disclaimer">
                        1 ZUQEN Chat Credit is used per AI message.
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>

          {renameChatId && (
            <div
              className="zuqen-overlay"
              style={{ display: "block" }}
              onClick={() => {
                setRenameChatId(null);
                setRenameValue("");
              }}
            >
              <div
                style={{
                  position: "fixed",
                  left: "50%",
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                  width: "min(420px, calc(100% - 30px))",
                  padding: 20,
                  borderRadius: 18,
                  background: "var(--z-bg-2)",
                  border: "1px solid var(--z-border-strong)",
                  boxShadow: "var(--z-shadow)",
                  zIndex: 1000,
                }}
                onClick={(event) => event.stopPropagation()}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 15,
                  }}
                >
                  <strong style={{ fontSize: 15 }}>
                    Rename conversation
                  </strong>

                  <button
                    type="button"
                    className="zuqen-icon-button"
                    onClick={() => {
                      setRenameChatId(null);
                      setRenameValue("");
                    }}
                  >
                    <Icon name="close" size={16} />
                  </button>
                </div>

                <input
                  autoFocus
                  value={renameValue}
                  onChange={(event) =>
                    setRenameValue(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void renameChat(renameChatId);
                    }
                  }}
                  style={{
                    width: "100%",
                    height: 43,
                    borderRadius: 11,
                    border: "1px solid var(--z-border-strong)",
                    outline: "none",
                    background: "var(--z-surface)",
                    color: "var(--z-text)",
                    padding: "0 12px",
                    fontSize: 12,
                  }}
                  placeholder="Conversation name"
                />

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 8,
                    marginTop: 12,
                  }}
                >
                  <button
                    type="button"
                    className="zuqen-small-button"
                    onClick={() => {
                      setRenameChatId(null);
                      setRenameValue("");
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="zuqen-small-button primary"
                    onClick={() => void renameChat(renameChatId)}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}