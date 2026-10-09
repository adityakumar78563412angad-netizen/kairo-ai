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

    case "grid":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="6" height="6" rx="1" />
          <rect x="14" y="4" width="6" height="6" rx="1" />
          <rect x="4" y="14" width="6" height="6" rx="1" />
          <rect x="14" y="14" width="6" height="6" rx="1" />
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

      /*
       * Restore an existing Supabase session first.
       */
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error("getSession:", sessionError);
      }

      let currentUser = session?.user ?? null;

      /*
       * If getSession() did not return a user, try getUser().
       */
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
       * No existing session: create a new anonymous Guest account.
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
          console.error(
            "Anonymous sign-in returned no user."
          );

          setErrorMessage(
            "Unable to create a guest account."
          );

          return;
        }

        /*
         * Explicitly make sure the returned anonymous session is
         * installed in the browser client before calling the RPC.
         * This prevents the RPC from running without auth context.
         */
        if (anonymousData.session) {
          const { error: setSessionError } =
            await supabase.auth.setSession({
              access_token: anonymousData.session.access_token,
              refresh_token: anonymousData.session.refresh_token,
            });

          if (setSessionError) {
            console.error(
              "Guest setSession:",
              setSessionError
            );

            setErrorMessage(
              "Guest authentication could not be established."
            );

            return;
          }
        }

        /*
         * Verify the authenticated session after anonymous sign-in.
         */
        const {
          data: { session: verifiedSession },
          error: verifiedSessionError,
        } = await supabase.auth.getSession();

        if (
          verifiedSessionError ||
          !verifiedSession?.user
        ) {
          console.error(
            "Guest session verification failed:",
            verifiedSessionError
          );

          setErrorMessage(
            "Guest authentication could not be verified."
          );

          return;
        }

        currentUser = verifiedSession.user;
      }

      /*
       * Guest users receive/setup the Guest Chat credit wallet.
       * Permanent signed-in users never call this RPC.
       */
      if (currentUser.is_anonymous) {
        const { error: creditError } =
          await supabase.rpc(
            "setup_guest_chat_credits"
          );

        if (creditError) {
          console.error(
            "Guest credit setup error:",
            creditError
          );

          setErrorMessage(
            "Guest Mode started, but Chat credits could not be set up. Please refresh and try again."
          );

          return;
        }
      }

      /*
       * Convert the Supabase user into the User type used by ZUQEN.
       */
      const normalizedUser: User = {
        id: currentUser.id,
        email: currentUser.email,
        is_anonymous: currentUser.is_anonymous,
      };

      setUser(normalizedUser);

      /*
       * Load conversations and Chat credits together.
       */
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
        /* ZUQEN AI — MIDNIGHT AURORA DESIGN SYSTEM */
        .zuqen-app {
          --bg: #090a11;
          --panel: #0d0f18;
          --panel-2: #131522;
          --panel-3: #1a1c2b;
          --border: rgba(188, 174, 255, .11);
          --border-strong: rgba(188, 174, 255, .20);
          --text: #f7f6ff;
          --muted: #a2a0b7;
          --muted-2: #77758e;
          --accent: #a78bfa;
          --accent-text: #fff;
          --shadow: 0 26px 80px rgba(0,0,0,.42);
          position: relative;
          isolation: isolate;
          background:
            radial-gradient(ellipse at 54% -12%, rgba(118, 76, 255, .20), transparent 43%),
            radial-gradient(ellipse at 100% 72%, rgba(49, 117, 255, .075), transparent 34%),
            #090a11;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          letter-spacing: -.01em;
        }

        .zuqen-app::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -1;
          pointer-events: none;
          background: linear-gradient(135deg, rgba(255,255,255,.012), transparent 42%, rgba(108,91,255,.025));
        }

        .zuqen-app.light {
          --bg: #f7f7fc;
          --panel: #fff;
          --panel-2: #f3f1fb;
          --panel-3: #eae7f7;
          --border: rgba(54, 46, 95, .11);
          --border-strong: rgba(93, 73, 166, .22);
          --text: #171625;
          --muted: #5e5b72;
          --muted-2: #858198;
          --accent: #7656dc;
          --accent-text: #fff;
          background: radial-gradient(ellipse at 52% -15%, rgba(139,92,246,.13), transparent 44%), #f7f7fc;
        }

        .zuqen-sidebar {
          width: 286px;
          flex: 0 0 286px;
          background: rgba(12, 13, 22, .96);
          border-right: 1px solid rgba(180, 159, 255, .12);
          box-shadow: 14px 0 60px rgba(0,0,0,.12);
          backdrop-filter: blur(26px);
        }
        .zuqen-app.light .zuqen-sidebar { background: rgba(251,250,255,.96); }

        .zuqen-logo {
          border-radius: 12px !important;
          background: linear-gradient(140deg, #c3a7ff 0%, #8b5cf6 42%, #4e8cff 78%, #59ddf8 100%) !important;
          box-shadow: 0 0 0 1px rgba(255,255,255,.15) inset, 0 7px 28px rgba(117,86,255,.35) !important;
        }
        .zuqen-brand-name { letter-spacing: -.045em; }

        .zuqen-utility-action {
          margin-top: 8px;
          background: rgba(255,255,255,.018);
          border: 1px solid var(--border);
        }
        .zuqen-utility-action:hover {
          background: rgba(139,92,246,.09);
          border-color: rgba(167,139,250,.24);
        }

        .zuqen-sidebar-action,
        .zuqen-chat-item,
        .zuqen-suggestion,
        .zuqen-agent-card,
        .zuqen-action,
        .zuqen-agent-button {
          transition: background .2s ease, border-color .2s ease, transform .2s ease, box-shadow .2s ease;
        }
        .zuqen-sidebar-action { border-radius: 13px; }
        .zuqen-sidebar-action.primary {
          background: linear-gradient(110deg, rgba(139,92,246,.20), rgba(79,70,229,.07));
          border-color: rgba(167,139,250,.27);
          box-shadow: inset 0 1px rgba(255,255,255,.035);
        }
        .zuqen-chat-item { border: 1px solid transparent; border-radius: 12px; }
        .zuqen-chat-item:hover,
        .zuqen-chat-item.active {
          background: rgba(139,92,246,.10);
          border-color: rgba(167,139,250,.15);
        }

        .zuqen-main { min-width: 0; background: transparent; }
        .zuqen-topbar {
          background: rgba(9,10,17,.70);
          border-bottom: 1px solid rgba(255,255,255,.065);
          backdrop-filter: blur(22px);
        }
        .zuqen-app.light .zuqen-topbar { background: rgba(250,249,255,.78); }
        .zuqen-content { min-width: 0; min-height: 0; }
        .zuqen-welcome { padding: 34px 24px 28px; }
        .zuqen-welcome-mark {
          border: 1px solid rgba(196,181,253,.28);
          background: radial-gradient(circle at 30% 20%, rgba(196,181,253,.28), transparent 48%), linear-gradient(145deg, rgba(139,92,246,.18), rgba(59,130,246,.10));
          box-shadow: 0 0 65px rgba(124,87,255,.14), inset 0 1px rgba(255,255,255,.10);
        }
        .zuqen-welcome h1 { letter-spacing: -.055em; text-wrap: balance; }
        .zuqen-welcome p { line-height: 1.7; }

        .zuqen-suggestion-grid { gap: 12px; }
        .zuqen-suggestion {
          border: 1px solid rgba(188,174,255,.13);
          background: linear-gradient(145deg, rgba(255,255,255,.045), rgba(255,255,255,.018));
          border-radius: 17px;
          box-shadow: 0 8px 28px rgba(0,0,0,.08);
        }
        .zuqen-suggestion:hover {
          border-color: rgba(167,139,250,.34);
          background: linear-gradient(145deg, rgba(139,92,246,.13), rgba(59,130,246,.045));
          transform: translateY(-2px);
          box-shadow: 0 12px 30px rgba(0,0,0,.16), 0 0 24px rgba(139,92,246,.06);
        }
        .zuqen-agent-card {
          border: 1px solid rgba(188,174,255,.12);
          background: rgba(255,255,255,.025);
          border-radius: 15px;
        }
        .zuqen-agent-card:hover { border-color: rgba(167,139,250,.30); transform: translateY(-2px); }

        .zuqen-chat-view { min-height: 0; }
        .zuqen-messages,
        .zuqen-message-list { scrollbar-width: thin; scrollbar-color: rgba(151,125,255,.32) transparent; }
        .zuqen-messages::-webkit-scrollbar { width: 7px; }
        .zuqen-messages::-webkit-scrollbar-thumb { background: rgba(151,125,255,.28); border-radius: 99px; }
        .zuqen-message-bubble { border-radius: 18px; }

        .zuqen-composer-area {
          flex-shrink: 0;
          padding: 17px 24px max(16px, env(safe-area-inset-bottom));
          background: linear-gradient(to top, #090a11 68%, rgba(9,10,17,.94) 84%, transparent);
        }
        .zuqen-app.light .zuqen-composer-area { background: linear-gradient(to top, #f7f7fc 68%, rgba(247,247,252,.94) 84%, transparent); }
        .zuqen-composer {
          width: min(100%, 850px);
          margin-inline: auto;
          border: 1px solid rgba(177,151,255,.24);
          border-radius: 23px;
          background: rgba(20,20,32,.94);
          box-shadow: 0 14px 46px rgba(0,0,0,.25), 0 0 34px rgba(105,76,220,.075);
          backdrop-filter: blur(22px);
          transition: border-color .2s ease, box-shadow .2s ease;
        }
        .zuqen-app.light .zuqen-composer { background: rgba(255,255,255,.96); }
        .zuqen-composer:focus-within {
          border-color: rgba(167,139,250,.54);
          box-shadow: 0 14px 46px rgba(0,0,0,.25), 0 0 0 3px rgba(139,92,246,.075), 0 0 38px rgba(105,76,220,.10);
        }
        .zuqen-composer textarea { color: var(--text); }
        .zuqen-composer textarea::placeholder { color: var(--muted-2); }
        .zuqen-send {
          background: linear-gradient(135deg, #b39aff, #8264ff 58%, #4e8cff);
          color: white;
          border-radius: 14px;
          box-shadow: 0 5px 20px rgba(117,87,255,.26);
          transition: filter .2s ease, transform .2s ease;
        }
        .zuqen-send:not(:disabled):hover { filter: brightness(1.1); transform: translateY(-1px); }
        .zuqen-send:disabled { opacity: .42; box-shadow: none; }
        .zuqen-composer-footer { color: var(--muted-2); }

        .zuqen-app button:focus-visible,
        .zuqen-app input:focus-visible,
        .zuqen-app textarea:focus-visible {
          outline: 2px solid rgba(167,139,250,.85);
          outline-offset: 3px;
        }
        @media (max-width: 760px) {
          .zuqen-sidebar { width: 286px; flex-basis: 286px; }
          .zuqen-composer-area { padding: 11px 12px max(11px, env(safe-area-inset-bottom)); }
          .zuqen-composer { border-radius: 19px; }
          .zuqen-welcome { padding: 24px 16px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .zuqen-app *, .zuqen-app *::before, .zuqen-app *::after {
            animation-duration: .01ms !important;
            transition-duration: .01ms !important;
          }
        }

        /* ZUQEN animated fire + water orb: visual-only enhancement */
        .zuqen-welcome-mark {
          width: 96px !important;
          height: 96px !important;
          margin: 0 auto 28px !important;
          position: relative !important;
          display: grid !important;
          place-items: center !important;
          overflow: visible !important;
          border-radius: 50% !important;
          isolation: isolate;
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
          color: transparent !important;
          animation: zuqen-orb-float 5s ease-in-out infinite;
        }
        .zuqen-welcome-mark::before {
          content: "" !important;
          position: absolute !important;
          inset: -5px !important;
          width: auto !important;
          height: auto !important;
          border: 0 !important;
          border-radius: 50% !important;
          background: conic-gradient(from 0deg, #22d3ee, #5267ff, #9b5cff, #ff8a32, #ffcf65, #ff4d36, #22d3ee) !important;
          filter: blur(7px);
          opacity: .82;
          animation: zuqen-orb-spin 8s linear infinite;
        }
        .zuqen-welcome-mark::after {
          content: "" !important;
          position: absolute !important;
          inset: 2px !important;
          width: auto !important;
          height: auto !important;
          border: 1px solid rgba(255,255,255,.22) !important;
          border-radius: 50% !important;
          background:
            radial-gradient(ellipse at 28% 24%, rgba(255,190,83,.96) 0%, rgba(255,91,42,.76) 19%, transparent 44%),
            radial-gradient(ellipse at 73% 73%, rgba(36,224,255,.98) 0%, rgba(43,107,255,.72) 25%, transparent 49%),
            radial-gradient(circle at 50% 48%, #17172a 0%, #090b15 72%);
          box-shadow: inset 0 0 18px rgba(255,255,255,.12), 0 0 34px rgba(74,113,255,.18);
          animation: zuqen-orb-breathe 4s ease-in-out infinite;
        }
        .zuqen-welcome-mark > span {
          display: block !important;
          position: absolute !important;
          inset: 10px !important;
          z-index: 2;
          border-radius: 50%;
          overflow: hidden;
          background: transparent;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.18);
        }
        .zuqen-welcome-mark > span::before,
        .zuqen-welcome-mark > span::after {
          content: "";
          position: absolute;
          width: 75%;
          height: 115%;
          top: -8%;
          border-radius: 48% 52% 45% 55%;
          filter: blur(.2px);
          mix-blend-mode: screen;
        }
        .zuqen-welcome-mark > span::before {
          left: -18%;
          background: linear-gradient(160deg, #ffe68b 3%, #ff9d38 26%, #ff4e35 52%, rgba(255,53,91,.08) 86%);
          clip-path: polygon(0 0, 100% 0, 76% 22%, 100% 39%, 64% 58%, 87% 75%, 48% 100%, 0 100%);
          animation: zuqen-fire-flow 3.6s ease-in-out infinite alternate;
        }
        .zuqen-welcome-mark > span::after {
          right: -18%;
          background: linear-gradient(205deg, #b4ffff 0%, #38e7ff 27%, #3479ff 58%, rgba(88,65,255,.10) 91%);
          clip-path: polygon(0 0, 100% 0, 100% 100%, 15% 100%, 36% 79%, 7% 61%, 34% 43%, 10% 25%);
          animation: zuqen-water-flow 3.2s ease-in-out infinite alternate;
        }
        @keyframes zuqen-orb-spin { to { transform: rotate(360deg); } }
        @keyframes zuqen-orb-float { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-5px) scale(1.025); } }
        @keyframes zuqen-orb-breathe { 0%,100% { filter: saturate(1); } 50% { filter: saturate(1.28) brightness(1.08); } }
        @keyframes zuqen-fire-flow { 0% { transform: rotate(-8deg) translateY(3px) scale(1); } 100% { transform: rotate(8deg) translateY(-4px) scale(1.12); } }
        @keyframes zuqen-water-flow { 0% { transform: rotate(7deg) translateY(-3px) scale(1.04); } 100% { transform: rotate(-8deg) translateY(4px) scale(1.14); } }
        @media (prefers-reduced-motion: reduce) {
          .zuqen-welcome-mark,
          .zuqen-welcome-mark::before,
          .zuqen-welcome-mark::after,
          .zuqen-welcome-mark > span::before,
          .zuqen-welcome-mark > span::after { animation: none !important; }
        }



        /* === ZUQEN / STUDIO REDESIGN: new layout language, existing functionality retained === */
        .zuqen-app {
          --bg: #080910;
          --panel: #10111b;
          --panel-2: #151725;
          --panel-3: #1b1e2d;
          --border: rgba(224,226,255,.085);
          --border-strong: rgba(224,226,255,.14);
          --text: #f6f6fc;
          --muted: #a0a2b7;
          --muted-2: #73768e;
          --accent: #a997ff;
          --accent-text: #fff;
          position: relative;
          isolation: isolate;
          background:
            radial-gradient(ellipse at 68% 4%, rgba(89,70,190,.12), transparent 36%),
            radial-gradient(ellipse at 20% 92%, rgba(27,139,172,.055), transparent 30%),
            #080910;
          color: var(--text);
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          letter-spacing: -.012em;
        }
        .zuqen-app::before {
          content: ""; position: fixed; inset: 0; z-index: -1; pointer-events: none; opacity: .16;
          background-image: radial-gradient(rgba(255,255,255,.22) .55px, transparent .55px);
          background-size: 5px 5px; mask-image: linear-gradient(to bottom, black, transparent 85%);
        }
        .zuqen-app.light { background: radial-gradient(ellipse at 70% 0%, rgba(124,100,255,.11), transparent 38%), #f6f6fb; }
        .zuqen-app.light::before { opacity: .07; }
        .zuqen-sidebar {
          width: 258px; flex: 0 0 258px; padding: 0 13px 13px;
          background: rgba(12,13,23,.93); border-right: 1px solid rgba(225,225,255,.075);
          box-shadow: 12px 0 60px rgba(0,0,0,.12); backdrop-filter: blur(28px);
        }
        .zuqen-app.light .zuqen-sidebar { background: rgba(249,249,253,.95); }
        .zuqen-brand { height: 83px; padding: 0 10px; gap: 12px; border-bottom: 1px solid var(--border); margin-bottom: 18px; }
        .zuqen-logo { width: 35px; height: 35px; flex: 0 0 35px; border-radius: 12px !important; position: relative; overflow: hidden; background: radial-gradient(circle at 28% 25%, #ffcf75, #ff653d 29%, transparent 46%), radial-gradient(circle at 75% 76%, #42eaff, #536bff 42%, #14152b 70%) !important; box-shadow: 0 0 25px rgba(106,111,255,.24), inset 0 0 0 1px rgba(255,255,255,.3) !important; }
        .zuqen-logo::after { content: ""; position: absolute; inset: -8px; border: 1px solid rgba(255,255,255,.5); border-radius: 50%; animation: zuqen-brand-spin 9s linear infinite; }
        .zuqen-brand-name { font-size: 14px; font-weight: 760; letter-spacing: .08em; }
        .zuqen-brand-sub { margin-top: 4px; font-size: 10px; letter-spacing: .015em; color: #81839a; }
        .zuqen-sidebar-content { gap: 8px; }
        .zuqen-new-chat, .zuqen-utility-action { min-height: 43px; margin: 0 0 5px; border-radius: 12px; padding: 0 12px; border: 1px solid transparent; background: transparent; color: #b8b9cc; font-size: 12px; font-weight: 550; transition: .2s ease; }
        .zuqen-new-chat:hover, .zuqen-utility-action:hover { color: white; background: rgba(255,255,255,.045); border-color: rgba(255,255,255,.07); transform: translateX(2px); }
        .zuqen-new-chat:first-child { color: #f7f5ff; border-color: rgba(161,139,255,.23); background: linear-gradient(105deg, rgba(130,105,255,.19), rgba(79,103,219,.07)); box-shadow: inset 0 1px rgba(255,255,255,.045); }
        .zuqen-new-chat:first-child svg { color: #b7a6ff; }
        .zuqen-utility-action { background: rgba(255,255,255,.018); border-color: rgba(255,255,255,.045); }
        .zuqen-sidebar-section { margin-top: 20px; }
        .zuqen-sidebar-heading { padding: 0 8px 10px; color: #777a91; font-size: 9px; font-weight: 750; text-transform: uppercase; letter-spacing: .15em; }
        .zuqen-sidebar-heading button { color: #8587a0; border-radius: 8px; }
        .zuqen-chat-list { gap: 3px; }
        .zuqen-chat-item { min-height: 48px; padding: 8px 8px 8px 11px; border-radius: 10px; border: 1px solid transparent; background: transparent; }
        .zuqen-chat-item:hover, .zuqen-chat-item.active { background: rgba(141,123,255,.085); border-color: rgba(164,147,255,.10); }
        .zuqen-chat-title { font-size: 11px; font-weight: 540; color: #c7c8d8; }
        .zuqen-chat-date { margin-top: 4px; font-size: 9px; color: #73758c; }
        .zuqen-chat-menu-button { opacity: .5; }
        .zuqen-sidebar-bottom { margin: auto -1px 0; padding: 12px 5px 3px; border-top: 1px solid var(--border); }
        .zuqen-sidebar-user { padding: 10px 5px; }
        .zuqen-user-dot { border-radius: 12px; background: linear-gradient(145deg, #514b83, #252943); box-shadow: inset 0 0 0 1px rgba(255,255,255,.12); }
        .zuqen-user-name { font-size: 11px; font-weight: 650; }
        .zuqen-user-status { font-size: 9px; }
        .zuqen-auth-button { min-height: 37px; border-radius: 10px; }
        .zuqen-main { background: transparent; min-width: 0; }
        .zuqen-topbar { height: 68px; flex-basis: 68px; padding: 0 26px; background: rgba(8,9,16,.42); border-bottom: 1px solid rgba(230,230,255,.06); backdrop-filter: blur(26px); }
        .zuqen-app.light .zuqen-topbar { background: rgba(248,248,253,.72); }
        .zuqen-icon-button { width: 36px; height: 36px; border-radius: 11px; background: rgba(255,255,255,.025); border: 1px solid rgba(255,255,255,.055); color: #a5a6bc; }
        .zuqen-icon-button:hover { background: rgba(153,130,255,.1); color: #fff; border-color: rgba(153,130,255,.23); }
        .zuqen-agent-button { min-height: 37px; border-radius: 11px; background: rgba(255,255,255,.035); border: 1px solid rgba(255,255,255,.07); }
        .zuqen-content { background: transparent; }
        .zuqen-home-redesign { padding: 36px clamp(18px, 4vw, 56px) 40px; overflow-y: auto; }
        .zuqen-home-inner-redesign { width: min(1050px, 100%); margin: 0 auto; }
        .zuqen-hero-kicker { display: flex; align-items: center; justify-content: center; gap: 9px; margin: 3px auto 20px; color: #8c8ba9; font-size: 9px; font-weight: 760; letter-spacing: .2em; text-align: center; }
        .zuqen-live-dot, .zuqen-credit-status-dot { width: 6px; height: 6px; display: inline-block; border-radius: 50%; background: #63e6c1; box-shadow: 0 0 12px rgba(99,230,193,.65); }
        .zuqen-welcome-redesign { max-width: 780px; padding: 0 12px 16px; margin: 0 auto; text-align: center; }
        .zuqen-orb-stage { width: 132px !important; height: 132px !important; margin: 0 auto 22px !important; transform: translateZ(0); }
        .zuqen-orb-stage::before { inset: -12px !important; filter: blur(15px) !important; opacity: .65 !important; }
        .zuqen-orb-stage::after { inset: 8px !important; background: radial-gradient(ellipse at 27% 25%, rgba(255,198,99,.98), rgba(255,90,47,.78) 18%, transparent 43%), radial-gradient(ellipse at 73% 72%, rgba(74,244,255,.98), rgba(59,112,255,.8) 25%, transparent 49%), radial-gradient(circle at 50% 50%, #151528 0%, #090a14 70%) !important; box-shadow: inset 0 0 24px rgba(255,255,255,.17), 0 0 52px rgba(78,103,255,.2) !important; }
        .zuqen-orb-stage > span { inset: 17px !important; }
        .zuqen-orb-ring { position: absolute; display: block; inset: -13px; z-index: 3; border: 1px solid rgba(161,166,255,.32); border-radius: 50%; pointer-events: none; }
        .zuqen-orb-ring-one { transform: rotateX(65deg) rotate(-24deg); animation: zuqen-ring-one 7s linear infinite; }
        .zuqen-orb-ring-two { inset: -21px; border-color: rgba(81,221,255,.23); transform: rotateX(69deg) rotate(28deg); animation: zuqen-ring-two 10s linear infinite; }
        .zuqen-orb-spark { position: absolute; z-index: 4; width: 5px; height: 5px; border-radius: 50%; background: #ffe4a3; box-shadow: 0 0 12px #ff9e57; }
        .zuqen-orb-spark-one { top: 5px; right: 20px; animation: zuqen-spark-drift 4s ease-in-out infinite; }
        .zuqen-orb-spark-two { bottom: 17px; left: 4px; background: #8df7ff; box-shadow: 0 0 12px #4ce9ff; animation: zuqen-spark-drift 5s ease-in-out infinite reverse; }
        .zuqen-welcome-redesign h1 { margin: 0; color: #f8f7ff; font-size: clamp(34px, 5vw, 58px); font-weight: 640; letter-spacing: -.065em; line-height: 1.06; text-wrap: balance; }
        .zuqen-welcome-redesign h1 span { color: transparent; background: linear-gradient(100deg, #f9f7ff 0%, #c6b6ff 42%, #7edcf5 100%); background-clip: text; -webkit-background-clip: text; }
        .zuqen-welcome-redesign p { max-width: 540px; margin: 16px auto 0; color: #9293ac; font-size: 13px; line-height: 1.85; }
        .zuqen-hero-composer { width: min(720px, 100%); min-height: 70px; margin: 19px auto 0; padding: 10px 11px 10px 17px; display: flex; align-items: center; gap: 12px; border: 1px solid rgba(177,164,255,.22); border-radius: 19px; background: linear-gradient(135deg, rgba(25,25,42,.97), rgba(15,17,28,.97)); box-shadow: 0 18px 60px rgba(0,0,0,.24), 0 0 44px rgba(119,94,255,.08), inset 0 1px rgba(255,255,255,.055); }
        .zuqen-hero-composer:focus-within { border-color: rgba(174,155,255,.52); box-shadow: 0 18px 60px rgba(0,0,0,.24), 0 0 0 3px rgba(139,117,255,.07), 0 0 44px rgba(119,94,255,.13); }
        .zuqen-hero-composer .zuqen-search-card-icon { width: 37px; height: 37px; flex: 0 0 37px; border-radius: 12px; display: grid; place-items: center; color: #b4a4ff; background: linear-gradient(140deg, rgba(147,117,255,.19), rgba(71,180,255,.08)); }
        .zuqen-hero-composer input { min-width: 0; flex: 1; height: 44px; padding: 0 4px; background: transparent; color: #f5f4ff; font-size: 13px; outline: none; }
        .zuqen-hero-composer input::placeholder { color: #777991; }
        .zuqen-hero-submit { width: 43px; height: 43px; flex: 0 0 43px; display: grid; place-items: center; border-radius: 13px; color: #fff; background: linear-gradient(145deg, #b8a3ff, #7963f7 65%, #5a91ff); box-shadow: 0 6px 22px rgba(117,94,255,.25); transition: transform .2s, filter .2s; }
        .zuqen-hero-submit:not(:disabled):hover { transform: translateY(-2px); filter: brightness(1.1); }
        .zuqen-hero-submit:disabled { opacity: .4; }
        .zuqen-hero-hint { text-align: center; margin: 11px 0 34px; color: #686b83; font-size: 9px; letter-spacing: .02em; }
        .zuqen-hero-hint span:first-child { display: inline-grid; place-items: center; width: 17px; height: 17px; margin-right: 4px; border: 1px solid rgba(255,255,255,.13); border-radius: 5px; color: #a4a5bb; }
        .zuqen-hint-divider { padding: 0 6px; color: #4f526a; }
        .zuqen-quick-section, .zuqen-agent-strip-redesign { max-width: 900px; margin: 0 auto; }
        .zuqen-section-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin: 0 0 14px; }
        .zuqen-section-eyebrow { color: #777b9b; font-size: 8px; font-weight: 780; letter-spacing: .16em; }
        .zuqen-section-head h2 { margin: 6px 0 0; color: #eeedfa; font-size: 17px; font-weight: 590; letter-spacing: -.035em; }
        .zuqen-section-count, .zuqen-agent-head-note { color: #6e7189; font-size: 9px; }
        .zuqen-suggestion-grid-redesign { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
        .zuqen-suggestion-redesign { min-height: 143px; padding: 14px 14px 15px; border: 1px solid rgba(209,208,255,.09); border-radius: 14px; text-align: left; background: linear-gradient(145deg, rgba(255,255,255,.035), rgba(255,255,255,.012)); box-shadow: none; }
        .zuqen-suggestion-redesign:hover { transform: translateY(-3px); border-color: rgba(165,147,255,.29); background: linear-gradient(145deg, rgba(134,111,255,.10), rgba(64,191,255,.025)); box-shadow: 0 12px 32px rgba(0,0,0,.13); }
        .zuqen-suggestion-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .zuqen-suggestion-redesign .zuqen-suggestion-icon { width: 31px; height: 31px; display: grid; place-items: center; border-radius: 10px; color: #bdb1ff; background: rgba(150,127,255,.11); font-size: 15px; }
        .zuqen-suggestion-redesign.suggestion-1 .zuqen-suggestion-icon { color: #79dcf4; background: rgba(73,194,238,.09); }
        .zuqen-suggestion-redesign.suggestion-2 .zuqen-suggestion-icon { color: #ffb38b; background: rgba(255,142,91,.09); }
        .zuqen-suggestion-arrow { color: #60627b; font-size: 15px; transition: transform .2s; }
        .zuqen-suggestion-redesign:hover .zuqen-suggestion-arrow { transform: translate(2px,-2px); color: #bdb1ff; }
        .zuqen-suggestion-redesign .zuqen-suggestion-title { color: #e6e5f5; font-size: 11px; font-weight: 650; }
        .zuqen-suggestion-redesign .zuqen-suggestion-text { margin-top: 6px; color: #85879e; font-size: 10px; line-height: 1.6; }
        .zuqen-agent-strip-redesign { margin-top: 32px; }
        .zuqen-agent-head { margin-bottom: 13px; }
        .zuqen-agent-cards-redesign { grid-template-columns: repeat(4, minmax(0,1fr)); gap: 9px; }
        .zuqen-mini-agent-redesign { min-width: 0; min-height: 63px; padding: 10px; display: flex; align-items: center; gap: 9px; border: 1px solid rgba(209,208,255,.08); border-radius: 12px; background: rgba(255,255,255,.018); text-align: left; transition: .2s ease; }
        .zuqen-mini-agent-redesign:hover { transform: translateY(-2px); border-color: rgba(160,143,255,.24); background: rgba(140,119,255,.06); }
        .zuqen-mini-agent-redesign .zuqen-mini-agent-icon { width: 31px; height: 31px; flex: 0 0 31px; display: grid; place-items: center; margin: 0; border-radius: 10px; background: rgba(148,126,255,.11); color: #b8a8ff; font-size: 14px; }
        .zuqen-mini-agent-redesign.agent-1 .zuqen-mini-agent-icon { color: #81e4f2; background: rgba(76,203,225,.09); }
        .zuqen-mini-agent-redesign.agent-2 .zuqen-mini-agent-icon { color: #ffb28b; background: rgba(255,145,92,.09); }
        .zuqen-mini-agent-copy { min-width: 0; flex: 1; }
        .zuqen-mini-agent-redesign .zuqen-mini-agent-name { color: #d9d8eb; font-size: 10px; font-weight: 650; }
        .zuqen-mini-agent-redesign .zuqen-mini-agent-desc { margin-top: 4px; color: #777a91; font-size: 8px; line-height: 1.4; }
        .zuqen-agent-arrow { color: #686a83; font-size: 12px; }
        .zuqen-credit-status { display: flex; align-items: center; justify-content: center; gap: 8px; margin: 25px 0 0; color: #6e7188; font-size: 9px; }
        .zuqen-credit-status-dot { width: 5px; height: 5px; }
        .zuqen-chat-view { min-height: 0; }
        .zuqen-messages { padding: 36px clamp(15px, 4vw, 48px) 25px; scrollbar-width: thin; scrollbar-color: rgba(151,125,255,.25) transparent; }
        .zuqen-message-list { width: min(850px,100%); }
        .zuqen-message-row { margin: 0 0 30px; }
        .zuqen-message-label { margin-bottom: 9px; color: #9293ad; font-size: 10px; font-weight: 650; letter-spacing: .02em; }
        .zuqen-message-label-mark { color: #b4a4ff; }
        .zuqen-message-bubble { border: 1px solid rgba(225,225,255,.075); border-radius: 4px 17px 17px 17px; background: rgba(255,255,255,.027); color: #e4e4f0; padding: 15px 18px; font-size: 13px; line-height: 1.8; }
        .zuqen-message-row.user .zuqen-message-bubble { border-radius: 17px 4px 17px 17px; border-color: rgba(157,139,255,.14); background: linear-gradient(135deg, rgba(132,111,255,.13), rgba(73,108,205,.07)); }
        .zuqen-composer-area { padding: 14px clamp(13px, 3vw, 36px) max(18px, env(safe-area-inset-bottom)); background: linear-gradient(to top, #080910 70%, rgba(8,9,16,.94) 86%, transparent); }
        .zuqen-app.light .zuqen-composer-area { background: linear-gradient(to top, #f6f6fb 70%, rgba(246,246,251,.94) 86%, transparent); }
        .zuqen-composer { width: min(850px,100%); padding: 10px; border: 1px solid rgba(177,164,255,.20); border-radius: 19px; background: rgba(18,19,31,.96); box-shadow: 0 16px 50px rgba(0,0,0,.2); }
        .zuqen-composer:focus-within { border-color: rgba(174,155,255,.48); box-shadow: 0 0 0 3px rgba(139,117,255,.06), 0 16px 50px rgba(0,0,0,.2); }
        .zuqen-composer-row { gap: 9px; }
        .zuqen-attach-label, .zuqen-send { border-radius: 11px; }
        .zuqen-attach-label { background: rgba(255,255,255,.035); }
        .zuqen-send { background: linear-gradient(145deg, #b8a3ff, #7963f7 65%, #5a91ff); }
        .zuqen-composer textarea { font-size: 13px; }
        .zuqen-composer-footer { padding: 8px 5px 1px; font-size: 9px; }
        .zuqen-empty-chat { min-height: 38vh; }
        .zuqen-empty-chat-inner { border: 1px solid var(--border); border-radius: 20px; background: rgba(255,255,255,.018); padding: 34px; }
        .zuqen-mobile-overlay { background: rgba(4,5,11,.68); backdrop-filter: blur(4px); }
        @keyframes zuqen-brand-spin { to { transform: rotate(360deg); } }
        @keyframes zuqen-ring-one { to { transform: rotateX(65deg) rotate(336deg); } }
        @keyframes zuqen-ring-two { to { transform: rotateX(69deg) rotate(388deg); } }
        @keyframes zuqen-spark-drift { 0%,100% { transform: translate3d(0,0,0); opacity: .6; } 50% { transform: translate3d(5px,-7px,0); opacity: 1; } }
        @media (max-width: 1000px) {
          .zuqen-suggestion-grid-redesign { grid-template-columns: repeat(2,minmax(0,1fr)); }
          .zuqen-agent-cards-redesign { grid-template-columns: repeat(2,minmax(0,1fr)); }
          .zuqen-agent-head-note { display: none; }
        }
        @media (max-width: 760px) {
          .zuqen-sidebar { width: min(290px, 86vw); flex-basis: min(290px, 86vw); padding-inline: 11px; }
          .zuqen-topbar { height: 60px; flex-basis: 60px; padding: 0 13px; gap: 7px; }
          .zuqen-home-redesign { padding: 26px 15px 28px; }
          .zuqen-hero-kicker { font-size: 8px; letter-spacing: .14em; margin-bottom: 14px; }
          .zuqen-orb-stage { width: 104px !important; height: 104px !important; margin-bottom: 20px !important; }
          .zuqen-orb-ring-two { inset: -16px; }
          .zuqen-welcome-redesign h1 { font-size: clamp(31px, 8vw, 43px); letter-spacing: -.06em; }
          .zuqen-welcome-redesign p { font-size: 12px; max-width: 420px; }
          .zuqen-hero-composer { min-height: 62px; margin-top: 16px; padding: 8px; gap: 8px; border-radius: 16px; }
          .zuqen-hero-composer .zuqen-search-card-icon { width: 33px; height: 33px; flex-basis: 33px; }
          .zuqen-hero-composer input { font-size: 12px; }
          .zuqen-hero-submit { width: 38px; height: 38px; flex-basis: 38px; }
          .zuqen-hero-hint { margin-bottom: 27px; }
          .zuqen-section-head h2 { font-size: 15px; }
          .zuqen-suggestion-redesign { min-height: 130px; padding: 12px; }
          .zuqen-agent-cards-redesign { grid-template-columns: 1fr 1fr; }
          .zuqen-mini-agent-redesign { padding: 9px; gap: 7px; }
          .zuqen-mini-agent-redesign .zuqen-mini-agent-icon { width: 28px; height: 28px; flex-basis: 28px; }
          .zuqen-mini-agent-redesign .zuqen-mini-agent-name { font-size: 9px; }
          .zuqen-mini-agent-redesign .zuqen-mini-agent-desc { font-size: 7px; }
          .zuqen-messages { padding: 24px 13px 20px; }
          .zuqen-message-bubble { padding: 12px 14px; font-size: 12px; }
          .zuqen-composer-area { padding: 10px 11px max(12px, env(safe-area-inset-bottom)); }
          .zuqen-composer-footer span:first-child { display: none; }
        }
        @media (max-width: 420px) {
          .zuqen-suggestion-grid-redesign { grid-template-columns: 1fr 1fr; gap: 8px; }
          .zuqen-suggestion-redesign { min-height: 124px; }
          .zuqen-agent-cards-redesign { grid-template-columns: 1fr; }
          .zuqen-agent-head { align-items: flex-start; }
          .zuqen-section-head { gap: 8px; }
          .zuqen-section-count { font-size: 8px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .zuqen-app *, .zuqen-app *::before, .zuqen-app *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
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

          <button
            className="zuqen-new-chat zuqen-utility-action"
            onClick={() => {
              window.location.href = "/automation";
            }}
            title="Open Automation Mode"
          >
            <Icon name="spark" size={17} />
            <span>Automation Mode</span>
          </button>

          <button
            className="zuqen-new-chat zuqen-utility-action"
            onClick={() => {
              window.location.href = "/templates";
            }}
            title="Open Buy/Sell Templates"
          >
            <Icon name="grid" size={17} />
            <span>Buy/Sell Templates</span>
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
            <div className="zuqen-home zuqen-home-redesign">
              <div className="zuqen-home-inner zuqen-home-inner-redesign">
                <div className="zuqen-hero-kicker">
                  <span className="zuqen-live-dot" />
                  YOUR CREATIVE INTELLIGENCE SPACE
                </div>

                <div className="zuqen-welcome zuqen-welcome-redesign">
                  <div className="zuqen-welcome-mark zuqen-orb-stage" aria-label="Animated ZUQEN fire and water orb">
                    <span />
                    <i className="zuqen-orb-ring zuqen-orb-ring-one" />
                    <i className="zuqen-orb-ring zuqen-orb-ring-two" />
                    <i className="zuqen-orb-spark zuqen-orb-spark-one" />
                    <i className="zuqen-orb-spark zuqen-orb-spark-two" />
                  </div>

                  <h1>Ideas become <span>extraordinary.</span></h1>
                  <p>Meet your all-in-one AI workspace to think clearly, create boldly, and turn your next idea into something real.</p>
                </div>

                <div className="zuqen-search-card zuqen-hero-composer">
                  <div className="zuqen-search-card-icon"><Icon name="spark" size={19} /></div>
                  <input
                    value={input}
                    onChange={(event) => {
                      setInput(event.target.value);
                      if (textareaRef.current) textareaRef.current.value = event.target.value;
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        handleSubmit();
                      }
                    }}
                    placeholder="What would you like to make today?"
                    aria-label="Ask ZUQEN AI"
                  />
                  <button className="zuqen-hero-submit" onClick={handleSubmit} disabled={!input.trim() || loading} title="Send message">
                    <Icon name="send" size={18} />
                  </button>
                </div>
                <div className="zuqen-hero-hint"><span>↵</span> to start <span className="zuqen-hint-divider">·</span> Shift + Enter for a new line</div>

                <div className="zuqen-quick-section">
                  <div className="zuqen-section-head">
                    <div><span className="zuqen-section-eyebrow">START WITH A SPARK</span><h2>What’s on your mind?</h2></div>
                    <span className="zuqen-section-count">0{homeSuggestions.length} ideas</span>
                  </div>
                  <div className="zuqen-suggestion-grid zuqen-suggestion-grid-redesign">
                    {homeSuggestions.map((suggestion, index) => (
                      <button key={suggestion.title} className={`zuqen-suggestion zuqen-suggestion-redesign suggestion-${index % 4}`} onClick={() => setInput(suggestion.text)}>
                        <div className="zuqen-suggestion-top"><div className="zuqen-suggestion-icon">{suggestion.icon}</div><span className="zuqen-suggestion-arrow">↗</span></div>
                        <div className="zuqen-suggestion-title">{suggestion.title}</div>
                        <div className="zuqen-suggestion-text">{suggestion.text}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="zuqen-agent-strip zuqen-agent-strip-redesign">
                  <div className="zuqen-section-head zuqen-agent-head">
                    <div><span className="zuqen-section-eyebrow">BUILT FOR YOUR WORKFLOW</span><h2>Meet your AI tools</h2></div>
                    <span className="zuqen-agent-head-note">One workspace. More possibilities.</span>
                  </div>
                  <div className="zuqen-agent-cards zuqen-agent-cards-redesign">
                    {AGENTS.slice(1).map((agent, index) => (
                      <button key={agent.name} className={`zuqen-mini-agent zuqen-mini-agent-redesign agent-${index}`} onClick={() => navigateAgent(agent)}>
                        <div className="zuqen-mini-agent-icon">{agent.icon}</div>
                        <div className="zuqen-mini-agent-copy"><div className="zuqen-mini-agent-name">{agent.name}</div><div className="zuqen-mini-agent-desc">{agent.description}</div></div>
                        <span className="zuqen-agent-arrow">↗</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="zuqen-credit-status">
                  <span className="zuqen-credit-status-dot" />
                  {chatCredits === null ? "Checking your workspace credits…" : `${chatCredits.toLocaleString()} Chat Credits available`}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}