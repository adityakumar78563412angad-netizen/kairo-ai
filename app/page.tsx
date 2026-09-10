"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  type: string;
  size: number;
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

const supabase = createClient();

const AGENTS = [
  {
    name: "ZUQEN AI",
    description: "General AI assistant",
    icon: "✦",
    route: null,
  },
  {
    name: "Website Builder",
    description: "Build complete websites",
    icon: "⌘",
    route: "/website-builder",
  },
  {
    name: "Text to Image",
    description: "Create images from text",
    icon: "◈",
    route: "/image-generator",
  },
  {
    name: "Text to Video",
    description: "Create videos with AI",
    icon: "▶",
    route: "/video-generator",
  },
  {
    name: "Voice Generator",
    description: "Turn text into natural voice",
    icon: "◉",
    route: "/generate-voice",
  },
];

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatDate(date: string) {
  const d = new Date(date);
  const now = new Date();

  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  if (sameDay) {
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return d.toLocaleDateString([], {
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

function Icon({
  name,
  size = 20,
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
          <path d="M5 7v12h14V7" />
          <path d="M3 4h18v3H3z" />
          <path d="M9 11h6" />
        </svg>
      );

    case "trash":
      return (
        <svg {...common}>
          <path d="M4 7h16" />
          <path d="M10 11v6M14 11v6" />
          <path d="M6 7l1 14h10l1-14" />
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
          <path d="M20 11a8 8 0 0 0-14.9-4" />
          <path d="M4 4v5h5" />
          <path d="M4 13a8 8 0 0 0 14.9 4" />
          <path d="M20 20v-5h-5" />
        </svg>
      );

    case "menu":
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
          <path d="m21.4 11.6-8.9 8.9a6 6 0 0 1-8.5-8.5l9.6-9.6a4 4 0 0 1 5.7 5.7l-9.7 9.6a2 2 0 0 1-2.8-2.8l8.8-8.8" />
        </svg>
      );

    case "sun":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" />
        </svg>
      );

    case "moon":
      return (
        <svg {...common}>
          <path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z" />
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
          <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          <path d="M3 21v-5h5" />
        </svg>
      );

    case "spark":
      return (
        <svg {...common}>
          <path d="m12 3-1.4 5.6L5 10l5.6 1.4L12 17l1.4-5.6L19 10l-5.6-1.4Z" />
          <path d="m19 16-.7 2.3L16 19l2.3.7L19 22l.7-2.3L22 19l-2.3-.7Z" />
        </svg>
      );

    case "user":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20a7 7 0 0 1 14 0" />
        </svg>
      );

    case "logout":
      return (
        <svg {...common}>
          <path d="M10 17l5-5-5-5" />
          <path d="M15 12H3" />
          <path d="M21 3v18" />
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

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");

  const [agentOpen, setAgentOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState("ZUQEN AI");

  const [creditsOpen, setCreditsOpen] = useState(false);
  const [chatCredits, setChatCredits] = useState<number | null>(null);

  const [archivedOpen, setArchivedOpen] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  const [lightMode, setLightMode] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId) ?? null,
    [chats, activeChatId]
  );

  const visibleChats = useMemo(() => {
    const query = search.trim().toLowerCase();

    return chats.filter((chat) => {
      if (archivedOpen) {
        if (!chat.archived) return false;
      } else {
        if (chat.archived) return false;
      }

      if (!query) return true;

      return chat.title.toLowerCase().includes(query);
    });
  }, [chats, search, archivedOpen]);

  const resetTextarea = useCallback(() => {
    if (!textareaRef.current) return;

    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = `${Math.min(
      textareaRef.current.scrollHeight,
      220
    )}px`;
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

  /*
   * Restore an existing session first.
   * Anonymous sign-in happens only when there is genuinely
   * no existing Supabase session.
   */
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

      /*
       * Guest mode:
       * Create anonymous user only when absolutely no
       * existing session/user exists.
       */
    if (!currentUser) {
  const {
    data: anonymousData,
    error: anonymousError,
  } = await supabase.auth.signInAnonymously();

  if (anonymousError) {
    console.error("Anonymous sign-in:", anonymousError);

    setErrorMessage(
      "Unable to authenticate with Supabase."
    );

    return;
  }

  if (!anonymousData.user) {
    console.error("Anonymous sign-in returned no user.");

    setErrorMessage(
      "Unable to create a guest account."
    );

    return;
  }

  const guestUser = anonymousData.user;

  const { error: creditError } = await supabase.rpc(
    "setup_guest_chat_credits"
  );

  if (creditError) {
    console.error(
      "Guest credit setup error:",
      creditError
    );
  }

  currentUser = guestUser;
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
  }, [loadChats, loadChatCredits]);

  useEffect(() => {
    let mounted = true;

    const start = async () => {
      if (!mounted) return;

      await initializeAuth();
    };

    start();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;

        if (session?.user) {
          const nextUser: User = {
            id: session.user.id,
            email: session.user.email,
            is_anonymous: session.user.is_anonymous,
          };

          setUser(nextUser);

          await Promise.all([
            loadChats(session.user.id),
            loadChatCredits(session.user.id),
          ]);

          return;
        }

        /*
         * When there is no session we don't automatically
         * create another anonymous user here.
         *
         * This is important for explicit sign-out:
         * the user should go to /auth instead of instantly
         * receiving a brand-new anonymous account.
         */
        setUser(null);
        setChats([]);
        setMessages([]);
        setActiveChatId(null);
        setChatCredits(null);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
      streamAbortRef.current?.abort();
    };
  }, [initializeAuth, loadChats, loadChatCredits]);

  const handleAuthNavigation = useCallback(() => {
    window.location.href = "/auth";
  }, []);

  const handleSignOut = useCallback(async () => {
    if (signingOut) return;

    try {
      setSigningOut(true);
      setErrorMessage("");

      streamAbortRef.current?.abort();

      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error("signOut:", error);

        setErrorMessage(
          error.message || "Unable to sign out."
        );

        setSigningOut(false);
        return;
      }

      /*
       * Explicitly send the user to authentication page.
       * We do NOT call signInAnonymously here.
       */
      window.location.href = "/auth";
    } catch (error) {
      console.error("handleSignOut:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to sign out."
      );

      setSigningOut(false);
    }
  }, [signingOut]);

  const selectChat = useCallback((chat: Chat) => {
    setActiveChatId(chat.id);

    const storedMessages = Array.isArray(chat.messages)
      ? chat.messages
      : [];

    setMessages(storedMessages);
    setMenuId(null);
    setRenamingId(null);
    setEditingId(null);
    setErrorMessage("");
  }, []);

  const createConversation = useCallback(
    async (firstMessage?: string) => {
      if (!user?.id) {
        setErrorMessage(
          "Your session is still loading. Please try again."
        );
        return null;
      }

      const now = new Date().toISOString();

      const title =
        firstMessage?.trim().slice(0, 55) ||
        "New conversation";

      const payload = {
        user_id: user.id,
        title,
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

        setErrorMessage(
          error?.message ||
            "Unable to create a conversation."
        );

        return null;
      }

      const newChat = data as Chat;

      setChats((previous) => [newChat, ...previous]);
      setActiveChatId(newChat.id);
      setMessages([]);

      return newChat;
    },
    [user]
  );

  const saveMessages = useCallback(
    async (chatId: string, nextMessages: Message[]) => {
      if (!user?.id) {
        setErrorMessage(
          "Your session is not available."
        );
        return false;
      }

      const { error } = await supabase
        .from("chats")
        .update({
          messages: nextMessages,
          updated_at: new Date().toISOString(),
        })
        .eq("id", chatId)
        .eq("user_id", user.id);

      if (error) {
        console.error("saveMessages:", error);

        setErrorMessage(
          `Unable to save conversation: ${error.message}`
        );

        return false;
      }

      setChats((previous) =>
        previous.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                messages: nextMessages,
                updated_at: new Date().toISOString(),
              }
            : chat
        )
      );

      return true;
    },
    [user]
  );

  const renameChat = useCallback(
    async (chatId: string, title: string) => {
      const cleanTitle = title.trim();

      if (!cleanTitle || !user?.id) return;

      const { error } = await supabase
        .from("chats")
        .update({
          title: cleanTitle.slice(0, 100),
          updated_at: new Date().toISOString(),
        })
        .eq("id", chatId)
        .eq("user_id", user.id);

      if (error) {
        setErrorMessage(
          `Unable to rename chat: ${error.message}`
        );
        return;
      }

      setChats((previous) =>
        previous.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                title: cleanTitle.slice(0, 100),
              }
            : chat
        )
      );

      setRenamingId(null);
      setRenameValue("");
      setMenuId(null);
    },
    [user]
  );

  const archiveChat = useCallback(
    async (chatId: string, archived: boolean) => {
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
          `Unable to ${
            archived ? "archive" : "restore"
          } chat: ${error.message}`
        );
        return;
      }

      setChats((previous) =>
        previous.map((chat) =>
          chat.id === chatId
            ? { ...chat, archived }
            : chat
        )
      );

      if (activeChatId === chatId && archived) {
        setActiveChatId(null);
        setMessages([]);
      }

      setMenuId(null);
    },
    [user, activeChatId]
  );

  const deleteChat = useCallback(
    async (chatId: string) => {
      if (!user?.id) return;

      const { error } = await supabase
        .from("chats")
        .delete()
        .eq("id", chatId)
        .eq("user_id", user.id);

      if (error) {
        setErrorMessage(
          `Unable to delete chat: ${error.message}`
        );
        return;
      }

      setChats((previous) =>
        previous.filter((chat) => chat.id !== chatId)
      );

      if (activeChatId === chatId) {
        setActiveChatId(null);
        setMessages([]);
      }

      setMenuId(null);
    },
    [user, activeChatId]
  );

  const parseStreamLine = (line: string) => {
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

    if (typeof payload.content === "string") {
      return payload.content;
    }

    if (typeof payload.delta === "string") {
      return payload.delta;
    }

    if (typeof payload.text === "string") {
      return payload.text;
    }

    if (
      payload.message &&
      typeof payload.message.content === "string"
    ) {
      return payload.message.content;
    }

    if (
      payload.choices?.[0]?.delta &&
      typeof payload.choices[0].delta.content ===
        "string"
    ) {
      return payload.choices[0].delta.content;
    }

    if (
      payload.choices?.[0]?.message &&
      typeof payload.choices[0].message.content ===
        "string"
    ) {
      return payload.choices[0].message.content;
    }

    return "";
  };

  const sendMessage = useCallback(
    async (forcedMessages?: Message[]) => {
      const text = input.trim();

      if (loading) return;

      if (!text && !forcedMessages?.length) return;

      if (!user?.id) {
        setErrorMessage(
          "Your session is not ready yet. Please try again."
        );
        return;
      }

      setErrorMessage("");

      let chatId = activeChatId;

      let workingMessages = forcedMessages
        ? [...forcedMessages]
        : [...messages];

      if (!chatId) {
        const newChat = await createConversation(text);

        if (!newChat) return;

        chatId = newChat.id;
        workingMessages = [];
      }

      const userMessage: Message = {
        id: makeId(),
        role: "user",
        content: text,
        created_at: new Date().toISOString(),
        attachments:
          attachments.length > 0
            ? [...attachments]
            : undefined,
      };

      if (!forcedMessages) {
        workingMessages = [
          ...workingMessages,
          userMessage,
        ];

        setMessages(workingMessages);
        setInput("");
        setAttachments([]);
        resetTextarea();
      }

      const savedUserMessage = await saveMessages(
        chatId,
        workingMessages
      );

      if (!savedUserMessage) return;

      setLoading(true);

      const assistantId = makeId();

      const initialAssistant: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
        created_at: new Date().toISOString(),
      };

      const withAssistant = [
        ...workingMessages,
        initialAssistant,
      ];

      setMessages(withAssistant);

      const controller = new AbortController();

      streamAbortRef.current = controller;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: workingMessages.map(
              (message) => ({
                role: message.role,
                content: message.content,
              })
            ),
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          let message =
            `Chat request failed (${response.status})`;

          try {
            const data = await response.json();

            if (data?.error) {
              message = data.error;
            }
          } catch {}

          throw new Error(message);
        }

        if (!response.body) {
          throw new Error(
            "The AI response stream is unavailable."
          );
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let buffer = "";
        let assistantText = "";

        while (true) {
          const { value, done } =
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

            if (payload.error) {
              throw new Error(payload.error);
            }

            const chunk = extractText(payload);

            if (!chunk) continue;

            assistantText += chunk;

            setMessages((previous) =>
              previous.map((message) =>
                message.id === assistantId
                  ? {
                      ...message,
                      content: assistantText,
                    }
                  : message
              )
            );
          }
        }

        if (!assistantText.trim()) {
          throw new Error(
            "ZUQEN AI returned an empty response."
          );
        }

        const finalAssistant: Message = {
          ...initialAssistant,
          content: assistantText,
        };

        const finalMessages = [
          ...workingMessages,
          finalAssistant,
        ];

        setMessages(finalMessages);

        await saveMessages(
          chatId,
          finalMessages
        );

        await loadChatCredits(user.id);
        await loadChats(user.id);
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        console.error("sendMessage:", error);

        const message =
          error instanceof Error
            ? error.message
            : "Something went wrong while chatting.";

        setErrorMessage(message);

        setMessages((previous) =>
          previous.filter(
            (message) =>
              message.id !== assistantId
          )
        );
      } finally {
        streamAbortRef.current = null;
        setLoading(false);
      }
    },
    [
      input,
      loading,
      user,
      activeChatId,
      messages,
      attachments,
      createConversation,
      saveMessages,
      resetTextarea,
      loadChatCredits,
      loadChats,
    ]
  );

  const handleSubmit = async () => {
    await sendMessage();
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const handleAttachment = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(
      event.target.files ?? []
    );

    const mapped = files.map((file) => ({
      id: makeId(),
      name: file.name,
      type: file.type,
      size: file.size,
    }));

    setAttachments((previous) => [
      ...previous,
      ...mapped,
    ]);

    event.target.value = "";
  };

  const removeAttachment = (id: string) => {
    setAttachments((previous) =>
      previous.filter((item) => item.id !== id)
    );
  };

  const copyMessage = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      setErrorMessage(
        "Unable to copy message."
      );
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
    const clean = editingValue.trim();

    if (!clean || !activeChatId) return;

    const index = messages.findIndex(
      (message) => message.id === messageId
    );

    if (index === -1) return;

    const message = messages[index];

    if (message.role !== "user") return;

    const nextMessages = messages
      .slice(0, index)
      .map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              content: clean,
            }
          : item
      );

    setMessages(nextMessages);
    setEditingId(null);
    setEditingValue("");

    await saveMessages(
      activeChatId,
      nextMessages
    );

    setInput(clean);

    setTimeout(() => {
      sendMessage(nextMessages);
    }, 0);
  };

  const regenerate = async () => {
    if (!activeChatId || loading) return;

    let lastUserIndex = -1;

    for (
      let i = messages.length - 1;
      i >= 0;
      i--
    ) {
      if (messages[i].role === "user") {
        lastUserIndex = i;
        break;
      }
    }

    if (lastUserIndex === -1) return;

    const baseMessages = messages.slice(
      0,
      lastUserIndex
    );

    const lastUserMessage =
      messages[lastUserIndex];

    const text = lastUserMessage.content;

    setMessages(baseMessages);

    await saveMessages(
      activeChatId,
      baseMessages
    );

    setInput(text);

    setTimeout(() => {
      sendMessage(baseMessages);
    }, 0);
  };

  const startRename = (chat: Chat) => {
    setRenamingId(chat.id);
    setRenameValue(chat.title);
    setMenuId(null);
  };

  const startNewChat = () => {
    setActiveChatId(null);
    setMessages([]);
    setInput("");
    setAttachments([]);
    setErrorMessage("");
    setEditingId(null);
    setRenamingId(null);
    resetTextarea();
  };

  const navigateAgent = (
    agent: (typeof AGENTS)[number]
  ) => {
    setSelectedAgent(agent.name);
    setAgentOpen(false);

    if (agent.route) {
      window.location.href = agent.route;
    }
  };

  const toggleTheme = () => {
    setLightMode((previous) => {
      const next = !previous;

      if (typeof window !== "undefined") {
        localStorage.setItem(
          "zuqen-theme",
          next ? "light" : "dark"
        );
      }

      return next;
    });
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedTheme =
      localStorage.getItem("zuqen-theme");

    if (savedTheme === "light") {
      setLightMode(true);
    }
  }, []);

  const homeSuggestions = [
    {
      title: "Write something",
      text: "Help me write a professional email",
      icon: "✎",
    },
    {
      title: "Learn anything",
      text: "Explain a difficult topic simply",
      icon: "◎",
    },
    {
      title: "Brainstorm ideas",
      text: "Give me creative ideas for my project",
      icon: "✦",
    },
    {
      title: "Solve a problem",
      text: "Help me solve a technical problem",
      icon: "⌁",
    },
  ];

  const accountLabel =
    user?.is_anonymous
      ? "Guest User"
      : user?.email || "ZUQEN Account";

  const accountStatus =
    user?.is_anonymous
      ? "Guest mode"
      : "Signed in";

  return (
    <main
      className={
        lightMode
          ? "zuqen-app light"
          : "zuqen-app"
      }
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
          background: #07080c;
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
          --bg: #07080c;
          --panel: #0c0e13;
          --panel-2: #11141b;
          --panel-3: #161a22;
          --border: rgba(255,255,255,.075);
          --border-strong: rgba(255,255,255,.12);
          --text: #f5f7fb;
          --muted: #8d94a3;
          --muted-2: #646b79;
          --accent: #ffffff;
          --accent-text: #08090b;
          --danger: #ff6f78;
          --shadow: 0 24px 80px rgba(0,0,0,.35);

          min-height: 100vh;
          display: flex;
          background:
            radial-gradient(
              circle at 60% 10%,
              rgba(91,105,255,.07),
              transparent 32%
            ),
            var(--bg);
          color: var(--text);
          overflow: hidden;
        }

        .zuqen-app.light {
          --bg: #f5f6f8;
          --panel: #ffffff;
          --panel-2: #f0f2f5;
          --panel-3: #e8ebef;
          --border: rgba(10,15,25,.08);
          --border-strong: rgba(10,15,25,.14);
          --text: #111318;
          --muted: #69707d;
          --muted-2: #8b919d;
          --accent: #111318;
          --accent-text: #ffffff;
          --shadow: 0 24px 80px rgba(25,35,50,.12);
        }

        .zuqen-sidebar {
          width: 285px;
          flex: 0 0 285px;
          height: 100vh;
          display: flex;
          flex-direction: column;
          background: rgba(10,12,17,.94);
          border-right: 1px solid var(--border);
          backdrop-filter: blur(24px);
          transition: width .25s ease, flex-basis .25s ease;
          z-index: 30;
        }

        .light .zuqen-sidebar {
          background: rgba(255,255,255,.94);
        }

        .zuqen-sidebar.closed {
          width: 0;
          flex-basis: 0;
          overflow: hidden;
          border-right: 0;
        }

        .zuqen-brand {
          height: 76px;
          display: flex;
          align-items: center;
          padding: 0 20px;
          gap: 12px;
        }

        .zuqen-logo {
          width: 38px;
          height: 38px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          color: #fff;
          background:
            linear-gradient(145deg, #ffffff, #7e8490);
          box-shadow:
            0 8px 30px rgba(255,255,255,.1),
            inset 0 1px 1px rgba(255,255,255,.6);
          position: relative;
          overflow: hidden;
        }

        .zuqen-logo::before {
          content: "";
          width: 17px;
          height: 17px;
          border: 2px solid #101216;
          border-radius: 50%;
          position: absolute;
        }

        .zuqen-logo::after {
          content: "";
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #101216;
          position: absolute;
        }

        .zuqen-brand-text {
          display: flex;
          flex-direction: column;
          line-height: 1.05;
        }

        .zuqen-brand-name {
          font-size: 18px;
          font-weight: 800;
          letter-spacing: -.5px;
        }

        .zuqen-brand-sub {
          color: var(--muted);
          font-size: 10px;
          margin-top: 5px;
          letter-spacing: 1.5px;
          text-transform: uppercase;
        }

        .zuqen-sidebar-content {
          padding: 4px 13px 15px;
          display: flex;
          flex-direction: column;
          min-height: 0;
          flex: 1;
        }

        .zuqen-new-chat {
          width: 100%;
          height: 46px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 14px;
          border-radius: 13px;
          color: var(--text);
          background: var(--panel-2);
          border: 1px solid var(--border);
          cursor: pointer;
          transition: .2s ease;
        }

        .zuqen-new-chat:hover {
          background: var(--panel-3);
          border-color: var(--border-strong);
          transform: translateY(-1px);
        }

        .zuqen-new-chat span:last-child {
          font-weight: 600;
          font-size: 13px;
        }

        .zuqen-sidebar-section {
          margin-top: 22px;
          min-height: 0;
          display: flex;
          flex-direction: column;
          flex: 1;
        }

        .zuqen-sidebar-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 7px 9px;
          color: var(--muted-2);
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1.3px;
          font-weight: 700;
        }

        .zuqen-sidebar-heading button {
          color: var(--muted);
          background: transparent;
          cursor: pointer;
          padding: 4px;
        }

        .zuqen-chat-list {
          overflow-y: auto;
          padding-right: 2px;
        }

        .zuqen-chat-list::-webkit-scrollbar,
        .zuqen-messages::-webkit-scrollbar {
          width: 5px;
        }

        .zuqen-chat-list::-webkit-scrollbar-thumb,
        .zuqen-messages::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,.08);
          border-radius: 99px;
        }

        .zuqen-chat-item {
          position: relative;
          display: flex;
          align-items: center;
          width: 100%;
          min-height: 46px;
          padding: 7px 8px 7px 11px;
          border-radius: 11px;
          color: var(--muted);
          background: transparent;
          cursor: pointer;
          text-align: left;
          margin-bottom: 2px;
          transition: .18s ease;
        }

        .zuqen-chat-item:hover {
          color: var(--text);
          background: var(--panel-2);
        }

        .zuqen-chat-item.active {
          color: var(--text);
          background: var(--panel-2);
          box-shadow: inset 2px 0 0 rgba(255,255,255,.8);
        }

        .zuqen-chat-main {
          min-width: 0;
          flex: 1;
        }

        .zuqen-chat-title {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 12.5px;
          font-weight: 500;
        }

        .zuqen-chat-date {
          margin-top: 3px;
          font-size: 9.5px;
          color: var(--muted-2);
        }

        .zuqen-chat-menu-button {
          width: 28px;
          height: 28px;
          flex: 0 0 28px;
          display: grid;
          place-items: center;
          color: var(--muted-2);
          background: transparent;
          border-radius: 8px;
          cursor: pointer;
          opacity: 0;
        }

        .zuqen-chat-item:hover .zuqen-chat-menu-button,
        .zuqen-chat-menu-button.open {
          opacity: 1;
        }

        .zuqen-chat-menu-button:hover {
          color: var(--text);
          background: var(--panel-3);
        }

        .zuqen-rename {
          width: 100%;
          padding: 7px 8px;
          border-radius: 8px;
          border: 1px solid var(--border-strong);
          outline: none;
          background: var(--panel);
          color: var(--text);
          font-size: 12px;
        }

        .zuqen-floating-menu {
          position: absolute;
          right: 8px;
          top: 40px;
          width: 178px;
          padding: 5px;
          border-radius: 13px;
          background: #14171e;
          border: 1px solid var(--border-strong);
          box-shadow: var(--shadow);
          z-index: 50;
        }

        .light .zuqen-floating-menu {
          background: #fff;
        }

        .zuqen-menu-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 9px 10px;
          border-radius: 9px;
          background: transparent;
          color: var(--muted);
          text-align: left;
          cursor: pointer;
          font-size: 12px;
        }

        .zuqen-menu-item:hover {
          background: var(--panel-3);
          color: var(--text);
        }

        .zuqen-menu-item.danger:hover {
          color: var(--danger);
        }

        .zuqen-sidebar-bottom {
          padding-top: 12px;
          border-top: 1px solid var(--border);
          margin-top: auto;
        }

        .zuqen-sidebar-user {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px;
          border-radius: 12px;
        }

        .zuqen-user-dot {
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          flex: 0 0 30px;
          border-radius: 10px;
          background: var(--panel-3);
          color: var(--text);
          font-size: 12px;
          font-weight: 800;
        }

        .zuqen-user-info {
          min-width: 0;
          flex: 1;
        }

        .zuqen-user-name {
          font-size: 11px;
          font-weight: 700;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .zuqen-user-status {
          color: var(--muted-2);
          font-size: 9px;
          margin-top: 3px;
        }

        .zuqen-auth-button {
          width: 100%;
          min-height: 36px;
          margin-top: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border-radius: 10px;
          background: var(--panel-2);
          border: 1px solid var(--border);
          color: var(--text);
          cursor: pointer;
          font-size: 10px;
          font-weight: 700;
          transition: .2s ease;
        }

        .zuqen-auth-button:hover {
          background: var(--panel-3);
          border-color: var(--border-strong);
        }

        .zuqen-auth-button.primary {
          background: var(--accent);
          color: var(--accent-text);
          border-color: transparent;
        }

        .zuqen-auth-button.primary:hover {
          opacity: .9;
          transform: translateY(-1px);
        }

        .zuqen-auth-button:disabled {
          opacity: .5;
          cursor: not-allowed;
        }

        .zuqen-main {
          flex: 1;
          min-width: 0;
          height: 100vh;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        .zuqen-topbar {
          height: 76px;
          flex: 0 0 76px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
          border-bottom: 1px solid var(--border);
          background: rgba(7,8,12,.55);
          backdrop-filter: blur(22px);
          z-index: 20;
        }

        .light .zuqen-topbar {
          background: rgba(245,246,248,.7);
        }

        .zuqen-top-left,
        .zuqen-top-right {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .zuqen-icon-button {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 11px;
          color: var(--muted);
          background: transparent;
          border: 1px solid transparent;
          cursor: pointer;
          transition: .2s ease;
        }

        .zuqen-icon-button:hover {
          color: var(--text);
          background: var(--panel-2);
          border-color: var(--border);
        }

        .zuqen-agent-selector {
          position: relative;
        }

        .zuqen-agent-button {
          min-width: 174px;
          height: 40px;
          padding: 0 11px;
          display: flex;
          align-items: center;
          gap: 9px;
          border: 1px solid var(--border);
          background: var(--panel-2);
          color: var(--text);
          border-radius: 12px;
          cursor: pointer;
        }

        .zuqen-agent-button-icon {
          width: 25px;
          height: 25px;
          display: grid;
          place-items: center;
          border-radius: 8px;
          background: var(--panel-3);
          font-size: 11px;
        }

        .zuqen-agent-button-text {
          min-width: 0;
          flex: 1;
          text-align: left;
        }

        .zuqen-agent-button-name {
          font-size: 11px;
          font-weight: 700;
        }

        .zuqen-agent-button-sub {
          margin-top: 2px;
          color: var(--muted-2);
          font-size: 8px;
        }

        .zuqen-agent-dropdown {
          position: absolute;
          top: 47px;
          left: 0;
          width: 285px;
          padding: 7px;
          border-radius: 15px;
          background: #11141a;
          border: 1px solid var(--border-strong);
          box-shadow: var(--shadow);
          z-index: 60;
        }

        .light .zuqen-agent-dropdown {
          background: #fff;
        }

        .zuqen-agent-option {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 10px;
          border-radius: 11px;
          background: transparent;
          color: var(--muted);
          cursor: pointer;
          text-align: left;
        }

        .zuqen-agent-option:hover,
        .zuqen-agent-option.selected {
          color: var(--text);
          background: var(--panel-2);
        }

        .zuqen-agent-option-icon {
          width: 33px;
          height: 33px;
          display: grid;
          place-items: center;
          flex: 0 0 33px;
          border-radius: 10px;
          background: var(--panel-3);
          font-size: 13px;
        }

        .zuqen-agent-option-content {
          flex: 1;
          min-width: 0;
        }

        .zuqen-agent-option-name {
          font-size: 12px;
          font-weight: 700;
        }

        .zuqen-agent-option-description {
          color: var(--muted-2);
          margin-top: 3px;
          font-size: 9px;
        }

        .zuqen-agent-check {
          width: 22px;
          height: 22px;
          display: grid;
          place-items: center;
          color: var(--text);
        }

        .zuqen-credit-wrap {
          position: relative;
        }

        .zuqen-credit-button {
          height: 40px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 12px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--panel-2);
          color: var(--text);
          cursor: pointer;
        }

        .zuqen-credit-icon {
          width: 23px;
          height: 23px;
          display: grid;
          place-items: center;
          border-radius: 7px;
          background: var(--panel-3);
          font-size: 11px;
        }

        .zuqen-credit-count {
          font-size: 11px;
          font-weight: 800;
        }

        .zuqen-credit-label {
          color: var(--muted);
          font-size: 9px;
        }

        .zuqen-credit-dropdown {
          position: absolute;
          right: 0;
          top: 47px;
          width: 255px;
          padding: 15px;
          border-radius: 15px;
          background: #11141a;
          border: 1px solid var(--border-strong);
          box-shadow: var(--shadow);
          z-index: 60;
        }

        .light .zuqen-credit-dropdown {
          background: #fff;
        }

        .zuqen-credit-dropdown-title {
          font-size: 11px;
          font-weight: 800;
        }

        .zuqen-credit-big {
          margin-top: 8px;
          font-size: 29px;
          font-weight: 850;
          letter-spacing: -1.5px;
        }

        .zuqen-credit-small {
          margin-top: 4px;
          color: var(--muted);
          font-size: 9px;
        }

        .zuqen-credit-line {
          height: 1px;
          background: var(--border);
          margin: 14px 0;
        }

        .zuqen-credit-row {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          color: var(--muted);
          margin-top: 8px;
        }

        .zuqen-credit-row strong {
          color: var(--text);
        }

        .zuqen-content {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        .zuqen-home {
          flex: 1;
          overflow-y: auto;
          padding: 64px 28px 45px;
        }

        .zuqen-home-inner {
          width: min(950px, 100%);
          margin: 0 auto;
        }

        .zuqen-welcome {
          text-align: center;
          max-width: 700px;
          margin: 0 auto;
        }

        .zuqen-welcome-mark {
          width: 58px;
          height: 58px;
          margin: 0 auto 21px;
          display: grid;
          place-items: center;
          border-radius: 19px;
          color: #0a0b0e;
          background: linear-gradient(145deg, #fff, #9ea4ae);
          box-shadow: 0 18px 60px rgba(255,255,255,.08);
          position: relative;
        }

        .zuqen-welcome-mark::before {
          content: "";
          width: 24px;
          height: 24px;
          border: 3px solid #101217;
          border-radius: 50%;
        }

        .zuqen-welcome-mark::after {
          content: "";
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #101217;
          position: absolute;
        }

        .zuqen-welcome h1 {
          margin: 0;
          font-size: clamp(32px, 5vw, 52px);
          line-height: 1;
          letter-spacing: -2.8px;
          font-weight: 850;
        }

        .zuqen-welcome p {
          margin: 17px auto 0;
          max-width: 570px;
          color: var(--muted);
          font-size: 14px;
          line-height: 1.7;
        }

        .zuqen-search-card {
          margin: 42px auto 0;
          width: min(700px, 100%);
          display: flex;
          align-items: center;
          gap: 12px;
          min-height: 66px;
          padding: 10px 12px;
          border-radius: 18px;
          background: var(--panel);
          border: 1px solid var(--border-strong);
          box-shadow: 0 20px 70px rgba(0,0,0,.18);
        }

        .zuqen-search-card-icon {
          width: 43px;
          height: 43px;
          flex: 0 0 43px;
          display: grid;
          place-items: center;
          border-radius: 13px;
          background: var(--panel-3);
          color: var(--muted);
        }

        .zuqen-search-card input {
          flex: 1;
          min-width: 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: var(--text);
          font-size: 13px;
        }

        .zuqen-search-card input::placeholder {
          color: var(--muted-2);
        }

        .zuqen-search-shortcut {
          color: var(--muted-2);
          border: 1px solid var(--border);
          background: var(--panel-2);
          border-radius: 7px;
          padding: 4px 7px;
          font-size: 9px;
        }

        .zuqen-suggestion-grid {
          margin-top: 18px;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }

        .zuqen-suggestion {
          min-height: 106px;
          padding: 15px;
          text-align: left;
          border-radius: 15px;
          border: 1px solid var(--border);
          background: var(--panel);
          color: var(--text);
          cursor: pointer;
          transition: .2s ease;
        }

        .zuqen-suggestion:hover {
          transform: translateY(-2px);
          border-color: var(--border-strong);
          background: var(--panel-2);
        }

        .zuqen-suggestion-icon {
          color: var(--muted);
          font-size: 15px;
        }

        .zuqen-suggestion-title {
          margin-top: 16px;
          font-size: 11px;
          font-weight: 800;
        }

        .zuqen-suggestion-text {
          margin-top: 5px;
          color: var(--muted-2);
          font-size: 9px;
          line-height: 1.4;
        }

        .zuqen-agent-strip {
          margin-top: 42px;
        }

        .zuqen-strip-title {
          color: var(--muted-2);
          text-transform: uppercase;
          letter-spacing: 1.2px;
          font-size: 9px;
          font-weight: 800;
          text-align: center;
        }

        .zuqen-agent-cards {
          margin-top: 12px;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }

        .zuqen-mini-agent {
          padding: 14px;
          border: 1px solid var(--border);
          background: var(--panel);
          border-radius: 14px;
          cursor: pointer;
          color: var(--text);
          text-align: left;
          transition: .2s ease;
        }

        .zuqen-mini-agent:hover {
          background: var(--panel-2);
          transform: translateY(-2px);
        }

        .zuqen-mini-agent-icon {
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: var(--panel-3);
          color: var(--muted);
          font-size: 12px;
        }

        .zuqen-mini-agent-name {
          margin-top: 12px;
          font-size: 10px;
          font-weight: 750;
        }

        .zuqen-mini-agent-desc {
          color: var(--muted-2);
          font-size: 8px;
          margin-top: 4px;
        }

        .zuqen-chat-view {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }

        .zuqen-messages {
          flex: 1;
          overflow-y: auto;
          padding: 40px 25px 28px;
        }

        .zuqen-message-list {
          width: min(930px, 100%);
          margin: 0 auto;
        }

        .zuqen-message-row {
          display: flex;
          margin-bottom: 31px;
        }

        .zuqen-message-row.user {
          justify-content: flex-start;
        }

        .zuqen-message-row.assistant {
          justify-content: flex-end;
        }

        .zuqen-message-block {
          width: min(760px, 90%);
        }

        .zuqen-message-label {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .2px;
        }

        .user .zuqen-message-label {
          justify-content: flex-start;
          color: var(--muted);
        }

        .assistant .zuqen-message-label {
          justify-content: flex-end;
          color: var(--muted);
        }

        .zuqen-message-label-mark {
          width: 22px;
          height: 22px;
          display: grid;
          place-items: center;
          border-radius: 7px;
          background: var(--panel-3);
          color: var(--text);
          font-size: 9px;
        }

        .zuqen-message-bubble {
          padding: 17px 19px;
          border: 1px solid var(--border);
          border-radius: 17px;
          font-size: 14px;
          line-height: 1.75;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .user .zuqen-message-bubble {
          background: var(--panel-2);
          border-top-left-radius: 6px;
        }

        .assistant .zuqen-message-bubble {
          background: rgba(255,255,255,.025);
          border-color: var(--border-strong);
          border-top-right-radius: 6px;
        }

        .light .assistant .zuqen-message-bubble {
          background: rgba(0,0,0,.025);
        }

        .zuqen-message-actions {
          display: flex;
          align-items: center;
          gap: 3px;
          margin-top: 7px;
        }

        .user .zuqen-message-actions {
          justify-content: flex-start;
        }

        .assistant .zuqen-message-actions {
          justify-content: flex-end;
        }

        .zuqen-action {
          width: 29px;
          height: 29px;
          display: grid;
          place-items: center;
          color: var(--muted-2);
          background: transparent;
          border-radius: 8px;
          cursor: pointer;
        }

        .zuqen-action:hover {
          color: var(--text);
          background: var(--panel-2);
        }

        .zuqen-edit-box {
          width: 100%;
          padding: 12px;
          border: 1px solid var(--border-strong);
          border-radius: 15px;
          background: var(--panel);
        }

        .zuqen-edit-box textarea {
          width: 100%;
          min-height: 100px;
          resize: vertical;
          border: 0;
          outline: 0;
          background: transparent;
          color: var(--text);
          line-height: 1.6;
          font-size: 14px;
        }

        .zuqen-edit-actions {
          display: flex;
          justify-content: flex-end;
          gap: 7px;
          margin-top: 8px;
        }

        .zuqen-small-button {
          height: 32px;
          padding: 0 11px;
          border-radius: 9px;
          background: var(--panel-3);
          color: var(--muted);
          cursor: pointer;
          font-size: 10px;
          font-weight: 700;
        }

        .zuqen-small-button.primary {
          color: var(--accent-text);
          background: var(--accent);
        }

        .zuqen-typing {
          display: inline-flex;
          gap: 4px;
          align-items: center;
          min-height: 24px;
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
            transform: translateY(0);
            opacity: .4;
          }

          30% {
            transform: translateY(-4px);
            opacity: 1;
          }
        }

        .zuqen-attachment-list {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 9px;
        }

        .zuqen-attachment-chip {
          display: flex;
          align-items: center;
          gap: 7px;
          max-width: 240px;
          padding: 6px 8px 6px 10px;
          border: 1px solid var(--border);
          background: var(--panel-3);
          border-radius: 9px;
          font-size: 9px;
          color: var(--muted);
        }

        .zuqen-attachment-chip-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .zuqen-attachment-remove {
          display: grid;
          place-items: center;
          color: var(--muted-2);
          background: transparent;
          cursor: pointer;
        }

        .zuqen-composer-area {
          padding: 12px 24px 20px;
          background: linear-gradient(
            to top,
            var(--bg) 75%,
            transparent
          );
        }

        .zuqen-composer {
          width: min(900px, 100%);
          margin: 0 auto;
          padding: 9px;
          border-radius: 19px;
          background: var(--panel);
          border: 1px solid var(--border-strong);
          box-shadow: 0 15px 55px rgba(0,0,0,.2);
        }

        .zuqen-composer-row {
          display: flex;
          align-items: flex-end;
          gap: 8px;
        }

        .zuqen-attach-label {
          width: 39px;
          height: 39px;
          display: grid;
          place-items: center;
          flex: 0 0 39px;
          color: var(--muted);
          background: var(--panel-2);
          border-radius: 11px;
          cursor: pointer;
        }

        .zuqen-attach-label:hover {
          color: var(--text);
        }

        .zuqen-attach-label input {
          display: none;
        }

        .zuqen-composer textarea {
          flex: 1;
          min-width: 0;
          max-height: 220px;
          min-height: 39px;
          resize: none;
          outline: none;
          border: 0;
          background: transparent;
          color: var(--text);
          padding: 9px 5px;
          line-height: 1.5;
          font-size: 13px;
        }

        .zuqen-composer textarea::placeholder {
          color: var(--muted-2);
        }

        .zuqen-send {
          width: 39px;
          height: 39px;
          display: grid;
          place-items: center;
          flex: 0 0 39px;
          border-radius: 11px;
          background: var(--accent);
          color: var(--accent-text);
          cursor: pointer;
          transition: .18s ease;
        }

        .zuqen-send:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .zuqen-send:disabled {
          opacity: .35;
          cursor: not-allowed;
        }

        .zuqen-composer-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 6px 1px 49px;
          color: var(--muted-2);
          font-size: 8px;
        }

        .zuqen-error {
          width: min(900px, calc(100% - 48px));
          margin: 0 auto 10px;
          padding: 10px 12px;
          display: flex;
          align-items: flex-start;
          gap: 8px;
          border-radius: 11px;
          color: #ffb4b8;
          background: rgba(255,75,85,.08);
          border: 1px solid rgba(255,75,85,.18);
          font-size: 10px;
          line-height: 1.5;
        }

        .light .zuqen-error {
          color: #a91e2b;
          background: rgba(255,75,85,.07);
        }

        .zuqen-empty-chat {
          height: 100%;
          display: grid;
          place-items: center;
          text-align: center;
          color: var(--muted);
        }

        .zuqen-empty-chat-inner {
          max-width: 440px;
          padding: 30px;
        }

        .zuqen-empty-chat-icon {
          width: 52px;
          height: 52px;
          margin: 0 auto 16px;
          display: grid;
          place-items: center;
          border-radius: 17px;
          background: var(--panel-2);
          color: var(--text);
        }

        .zuqen-empty-chat h2 {
          color: var(--text);
          font-size: 22px;
          margin: 0;
          letter-spacing: -.7px;
        }

        .zuqen-empty-chat p {
          margin: 9px 0 0;
          font-size: 12px;
          line-height: 1.6;
        }

        .zuqen-search-overlay {
          position: absolute;
          left: 24px;
          top: 76px;
          width: min(430px, calc(100% - 48px));
          padding: 10px;
          border: 1px solid var(--border-strong);
          background: #11141a;
          border-radius: 15px;
          box-shadow: var(--shadow);
          z-index: 70;
        }

        .light .zuqen-search-overlay {
          background: #fff;
        }

        .zuqen-search-input-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border-radius: 10px;
          background: var(--panel-2);
        }

        .zuqen-search-input-wrap input {
          flex: 1;
          border: 0;
          outline: 0;
          background: transparent;
          color: var(--text);
          font-size: 11px;
        }

        .zuqen-mobile-overlay {
          display: none;
        }

        @media (max-width: 900px) {
          .zuqen-sidebar {
            position: fixed;
            left: 0;
            top: 0;
            bottom: 0;
            box-shadow: 30px 0 80px rgba(0,0,0,.25);
          }

          .zuqen-sidebar.closed {
            transform: translateX(-100%);
            width: 285px;
            flex-basis: 285px;
          }

          .zuqen-mobile-overlay {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,.45);
            z-index: 25;
          }

          .zuqen-topbar {
            padding: 0 14px;
          }

          .zuqen-home {
            padding: 45px 17px 35px;
          }

          .zuqen-suggestion-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .zuqen-agent-cards {
            grid-template-columns: repeat(2, 1fr);
          }

          .zuqen-messages {
            padding: 25px 14px;
          }

          .zuqen-composer-area {
            padding: 10px 12px 15px;
          }

          .zuqen-credit-label {
            display: none;
          }
        }

        @media (max-width: 560px) {
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
            width: 42px;
            padding: 0;
            justify-content: center;
          }

          .zuqen-credit-count {
            display: none;
          }

          .zuqen-suggestion-grid {
            grid-template-columns: 1fr;
          }

          .zuqen-agent-cards {
            grid-template-columns: 1fr 1fr;
          }

          .zuqen-welcome h1 {
            letter-spacing: -1.8px;
          }

          .zuqen-message-block {
            width: 94%;
          }

          .zuqen-message-bubble {
            font-size: 13px;
          }

          .zuqen-composer-footer {
            padding-left: 6px;
          }

          .zuqen-composer-footer span:first-child {
            display: none;
          }
        }
      `}</style>

      {!sidebarOpen && (
        <div
          className="zuqen-mobile-overlay"
          onClick={() =>
            setSidebarOpen(true)
          }
        />
      )}

      <aside
        className={`zuqen-sidebar ${
          sidebarOpen ? "" : "closed"
        }`}
      >
        <div className="zuqen-brand">
          <div className="zuqen-logo" />

          <div className="zuqen-brand-text">
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
            <Icon name="plus" size={17} />
            <span>New conversation</span>
          </button>

          <div className="zuqen-sidebar-section">
            <div className="zuqen-sidebar-heading">
              <span>
                {archivedOpen
                  ? "Archived"
                  : "Conversations"}
              </span>

              <button
                title="Toggle archived"
                onClick={() =>
                  setArchivedOpen(
                    (previous) => !previous
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
                    padding: "18px 9px",
                    color: "var(--muted-2)",
                    fontSize: 10,
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
                              setRenamingId(
                                null
                              );
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
                      onClick={(event) => {
                        event.stopPropagation();

                        setMenuId(
                          (previous) =>
                            previous === chat.id
                              ? null
                              : chat.id
                        );
                      }}
                    >
                      <Icon
                        name="menu"
                        size={17}
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
                  size={14}
                />
                Sign in / Create account
              </button>
            ) : (
              <button
                className="zuqen-auth-button"
                onClick={handleSignOut}
                disabled={signingOut}
              >
                <Icon
                  name="logout"
                  size={14}
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
              onClick={() =>
                setSidebarOpen(
                  (previous) => !previous
                )
              }
              title="Toggle sidebar"
            >
              <Icon
                name="menu"
                size={19}
              />
            </button>

            <button
              className="zuqen-icon-button"
              onClick={() =>
                setSearchOpen(
                  (previous) => !previous
                )
              }
              title="Search conversations"
            >
              <Icon
                name="search"
                size={18}
              />
            </button>

            <div className="zuqen-agent-selector">
              <button
                className="zuqen-agent-button"
                onClick={() =>
                  setAgentOpen(
                    (previous) => !previous
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
                  size={13}
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
                            size={14}
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
            <div className="zuqen-credit-wrap">
              <button
                className="zuqen-credit-button"
                onClick={() =>
                  setCreditsOpen(
                    (previous) => !previous
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
                  Chat credits
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
                    Available for AI conversations
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
              title="Toggle theme"
            >
              <Icon
                name={
                  lightMode
                    ? "moon"
                    : "sun"
                }
                size={18}
              />
            </button>
          </div>
        </header>

        {searchOpen && (
          <div className="zuqen-search-overlay">
            <div className="zuqen-search-input-wrap">
              <Icon
                name="search"
                size={15}
              />

              <input
                autoFocus
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search conversations..."
              />

              {search && (
                <button
                  onClick={() =>
                    setSearch("")
                  }
                  style={{
                    background:
                      "transparent",
                    color:
                      "var(--muted)",
                    cursor:
                      "pointer",
                  }}
                >
                  <Icon
                    name="close"
                    size={14}
                  />
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

              <span>
                {errorMessage}
              </span>

              <button
                onClick={() =>
                  setErrorMessage("")
                }
                style={{
                  marginLeft:
                    "auto",
                  background:
                    "transparent",
                  color:
                    "inherit",
                  cursor:
                    "pointer",
                }}
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
                  session and workspace...
                </p>
              </div>
            </div>
          ) : activeChatId &&
            activeChat ? (
            <div className="zuqen-chat-view">
              <div className="zuqen-messages">
                <div className="zuqen-message-list">
                  {messages.length ===
                  0 ? (
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
                          Start the
                          conversation below.
                        </p>
                      </div>
                    </div>
                  ) : (
                    messages.map(
                      (message) => {
                        const isEditing =
                          editingId ===
                          message.id;

                        return (
                          <div
                            key={
                              message.id
                            }
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
                                    {message.content || (
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
                                                <span>
                                                  ◇
                                                </span>

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
                                      title="Copy"
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
                                        title="Edit"
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
                                          title="Regenerate"
                                          onClick={
                                            regenerate
                                          }
                                          disabled={
                                            loading
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
                      }
                    )
                  )}
                </div>
              </div>

              <div className="zuqen-composer-area">
                {attachments.length >
                  0 && (
                  <div
                    style={{
                      width:
                        "min(900px,100%)",
                      margin:
                        "0 auto 7px",
                    }}
                  >
                    <div className="zuqen-attachment-list">
                      {attachments.map(
                        (file) => (
                          <div
                            className="zuqen-attachment-chip"
                            key={file.id}
                          >
                            <span>
                              ◇
                            </span>

                            <span className="zuqen-attachment-chip-name">
                              {file.name}
                            </span>

                            <button
                              className="zuqen-attachment-remove"
                              onClick={() =>
                                removeAttachment(
                                  file.id
                                )
                              }
                            >
                              <Icon
                                name="close"
                                size={11}
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
                    <label className="zuqen-attach-label">
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
                      value={input}
                      onChange={(event) => {
                        setInput(
                          event.currentTarget
                            .value
                        );

                        event.currentTarget.style.height =
                          "auto";

                        event.currentTarget.style.height = `${Math.min(
                          event.currentTarget
                            .scrollHeight,
                          220
                        )}px`;
                      }}
                      onKeyDown={
                        handleKeyDown
                      }
                      placeholder="Message ZUQEN AI..."
                      rows={1}
                      disabled={loading}
                    />

                    <button
                      className="zuqen-send"
                      disabled={
                        loading ||
                        !input.trim()
                      }
                      onClick={
                        handleSubmit
                      }
                      title="Send message"
                    >
                      <Icon
                        name="send"
                        size={16}
                      />
                    </button>
                  </div>

                  <div className="zuqen-composer-footer">
                    <span>
                      ZUQEN AI can make
                      mistakes. Check
                      important information.
                    </span>

                    <span>
                      Enter to send ·
                      Shift + Enter for
                      newline
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
                    Meet ZUQEN AI —
                    your intelligent
                    workspace for
                    thinking, creating,
                    building and
                    getting things done.
                  </p>
                </div>

                <div className="zuqen-search-card">
                  <div className="zuqen-search-card-icon">
                    <Icon
                      name="search"
                      size={18}
                    />
                  </div>

                  <input
                    value={input}
                    onChange={(event) => {
                      setInput(
                        event.target.value
                      );

                      if (
                        textareaRef.current
                      ) {
                        textareaRef.current.value =
                          event.target.value;
                      }
                    }}
                    onKeyDown={(event) => {
                      if (
                        event.key ===
                          "Enter" &&
                        !event.shiftKey
                      ) {
                        event.preventDefault();
                        handleSubmit();
                      }
                    }}
                    placeholder="Ask anything..."
                  />

                  <span className="zuqen-search-shortcut">
                    Enter
                  </span>
                </div>

                <div className="zuqen-suggestion-grid">
                  {homeSuggestions.map(
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
                    {AGENTS.slice(
                      1
                    ).map((agent) => (
                      <button
                        key={
                          agent.name
                        }
                        className="zuqen-mini-agent"
                        onClick={() =>
                          navigateAgent(
                            agent
                          )
                        }
                      >
                        <div className="zuqen-mini-agent-icon">
                          {
                            agent.icon
                          }
                        </div>

                        <div className="zuqen-mini-agent-name">
                          {
                            agent.name
                          }
                        </div>

                        <div className="zuqen-mini-agent-desc">
                          {
                            agent.description
                          }
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 38,
                    textAlign: "center",
                    color:
                      "var(--muted-2)",
                    fontSize: 9,
                  }}
                >
                  {chatCredits ===
                  null
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