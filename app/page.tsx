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
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    if (shouldAutoScrollRef.current) {
      container.scrollTo({ top: container.scrollHeight, behavior: loading ? "auto" : "smooth" });
      setShowJumpToLatest(false);
    } else {
      const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
      setShowJumpToLatest(distance > 180);
    }
  }, [messages, loading, activeChatId]);

  const handleMessagesScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
    const nearBottom = distance < 120;
    shouldAutoScrollRef.current = nearBottom;
    setShowJumpToLatest(!nearBottom && distance > 180);
  }, []);

  const jumpToLatest = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    shouldAutoScrollRef.current = true;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    setShowJumpToLatest(false);
  }, []);

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
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap');
        :root { color-scheme: dark; }
        * { box-sizing: border-box; }
        html, body { margin:0; padding:0; min-height:100%; }
        body { background:#080a12; }
        button,input,textarea { font:inherit; }
        button { border:0; }
        .zuqen-app {
          --bg:#080a12; --panel:rgba(20,24,39,.60); --panel-2:rgba(35,40,62,.58);
          --panel-3:rgba(58,64,94,.48); --border:rgba(222,230,255,.12);
          --border-strong:rgba(222,230,255,.21); --text:#f7f8ff; --muted:#b2bad2;
          --muted-2:#7e89a8; --accent:#a9a5ff; --accent-text:#111326;
          --danger:#ff8caa; --shadow:0 24px 90px rgba(0,0,0,.32);
          position:relative; isolation:isolate; display:flex; width:100%; height:100dvh; min-height:560px;
          overflow:hidden; color:var(--text); font-family:'DM Sans',sans-serif;
          background:radial-gradient(ellipse at 65% -8%,rgba(120,105,255,.24),transparent 37%),
            radial-gradient(ellipse at 4% 100%,rgba(26,185,205,.13),transparent 34%),
            linear-gradient(135deg,#080a12 0%,#0c1020 48%,#0b0d18 100%);
        }
        .zuqen-app::before { content:""; position:absolute; inset:0; z-index:-1; pointer-events:none; opacity:.25;
          background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);
          background-size:44px 44px; mask-image:linear-gradient(to bottom,black,transparent 85%); }
        .zuqen-app::after { content:""; position:absolute; width:480px;height:480px;right:-180px;top:30%;z-index:-1;pointer-events:none;
          background:rgba(105,95,255,.11);filter:blur(90px);border-radius:50%; }
        .zuqen-app.light { --bg:#edf0ff;--panel:rgba(255,255,255,.63);--panel-2:rgba(246,247,255,.68);--panel-3:rgba(230,234,255,.66);
          --border:rgba(54,62,110,.12);--border-strong:rgba(54,62,110,.2);--text:#171a2d;--muted:#646b87;--muted-2:#8b91aa;--accent:#5d55d9;--accent-text:#fff;--shadow:0 24px 80px rgba(53,60,110,.12);
          background:radial-gradient(ellipse at 70% -10%,rgba(142,133,255,.26),transparent 40%),radial-gradient(ellipse at 0% 100%,rgba(63,209,213,.18),transparent 34%),linear-gradient(135deg,#f5f6ff,#e9edfa); color:var(--text); }
        .zuqen-app.light::before { opacity:.3;background-image:linear-gradient(rgba(60,70,120,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(60,70,120,.055) 1px,transparent 1px); }
        .zuqen-sidebar { width:272px;flex:0 0 272px;height:100%;display:flex;flex-direction:column;position:relative;z-index:30;
          background:rgba(15,18,32,.48);border-right:1px solid var(--border);backdrop-filter:blur(32px) saturate(155%);-webkit-backdrop-filter:blur(32px) saturate(155%);
          transition:width .28s ease,flex-basis .28s ease,transform .28s ease; }
        .light .zuqen-sidebar { background:rgba(255,255,255,.48); }
        .zuqen-sidebar.closed { width:0;flex-basis:0;overflow:hidden;border-right:0; }
        .zuqen-brand { min-height:82px;display:flex;align-items:center;padding:0 21px;gap:13px;border-bottom:1px solid var(--border); }
        .zuqen-logo { width:39px;height:39px;flex:0 0 39px;position:relative;display:grid;place-items:center;border-radius:14px;
          background:conic-gradient(from 210deg,#66e5f5,#8985ff,#ff9ccf,#66e5f5);box-shadow:0 0 28px rgba(132,126,255,.35); }
        .zuqen-logo::before { content:"";position:absolute;inset:3px;border-radius:11px;background:#111528; }
        .zuqen-logo::after { content:"✦";position:relative;color:#fff;font-size:22px;line-height:1;text-shadow:0 0 15px rgba(151,211,255,.8); }
        .light .zuqen-logo::before { background:#25274b; }
        .zuqen-brand-text { min-width:0; }
        .zuqen-brand-name { font:800 15px 'Manrope',sans-serif;letter-spacing:1.8px;background:linear-gradient(90deg,#fff,#b7b5ff 60%,#8ce9f2);color:transparent;background-clip:text; }
        .light .zuqen-brand-name { background-image:linear-gradient(90deg,#24254c,#665fdb 60%,#148b9a); }
        .zuqen-brand-sub { margin-top:4px;color:var(--muted-2);font-size:10px;letter-spacing:.25px; }
        .zuqen-sidebar-content { display:flex;flex-direction:column;gap:23px;min-height:0;flex:1;padding:19px 13px 12px; }
        .zuqen-new-chat { min-height:46px;display:flex;align-items:center;justify-content:flex-start;gap:11px;padding:0 14px;border:1px solid rgba(174,168,255,.32);border-radius:14px;
          background:linear-gradient(110deg,rgba(132,123,255,.23),rgba(71,200,220,.10));color:var(--text);cursor:pointer;font-size:12px;font-weight:700;box-shadow:inset 0 1px rgba(255,255,255,.09);transition:.2s; }
        .zuqen-new-chat:hover { transform:translateY(-1px);border-color:rgba(178,174,255,.65);box-shadow:0 8px 28px rgba(99,94,220,.18); }
        .zuqen-new-chat span:last-child { font-size:12px; }
        .zuqen-sidebar-section { display:flex;flex-direction:column;gap:10px;min-height:0;flex:1; }
        .zuqen-sidebar-heading { display:flex;align-items:center;justify-content:space-between;padding:0 9px;color:var(--muted-2);font-size:10px;font-weight:800;letter-spacing:1.15px;text-transform:uppercase; }
        .zuqen-sidebar-heading button { width:28px;height:28px;display:grid;place-items:center;border-radius:9px;color:var(--muted);background:transparent;cursor:pointer; }
        .zuqen-sidebar-heading button:hover { background:var(--panel-2);color:var(--text); }
        .zuqen-chat-list { min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:4px;padding-right:2px; }
        .zuqen-chat-list::-webkit-scrollbar,.zuqen-messages::-webkit-scrollbar { width:5px; }
        .zuqen-chat-list::-webkit-scrollbar-thumb,.zuqen-messages::-webkit-scrollbar-thumb { background:rgba(150,160,200,.25);border-radius:10px; }
        .zuqen-chat-item { position:relative;display:flex;align-items:center;gap:4px;padding:10px 8px 10px 12px;min-height:47px;border:1px solid transparent;border-radius:12px;cursor:pointer;transition:background .18s,border-color .18s; }
        .zuqen-chat-item:hover,.zuqen-chat-item.active { background:var(--panel-2);border-color:var(--border); }
        .zuqen-chat-item.active { box-shadow:inset 2px 0 #a7a2ff; }
        .zuqen-chat-main { min-width:0;flex:1; }
        .zuqen-chat-title { overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text);font-size:11px;font-weight:600; }
        .zuqen-chat-date { margin-top:4px;color:var(--muted-2);font-size:9px; }
        .zuqen-chat-menu-button { width:25px;height:25px;display:grid;place-items:center;flex:0 0 25px;border-radius:8px;color:var(--muted-2);background:transparent;opacity:0;cursor:pointer; }
        .zuqen-chat-item:hover .zuqen-chat-menu-button,.zuqen-chat-menu-button.open { opacity:1; }
        .zuqen-chat-menu-button:hover { background:var(--panel-3);color:var(--text); }
        .zuqen-rename { width:100%;padding:6px;border:1px solid var(--border-strong);border-radius:7px;background:var(--panel-2);color:var(--text);outline:none; }
        .zuqen-floating-menu,.zuqen-agent-dropdown,.zuqen-credit-dropdown { position:absolute;z-index:90;padding:7px;border:1px solid var(--border-strong);border-radius:15px;background:rgba(22,25,43,.88);backdrop-filter:blur(28px);box-shadow:var(--shadow); }
        .light .zuqen-floating-menu,.light .zuqen-agent-dropdown,.light .zuqen-credit-dropdown { background:rgba(255,255,255,.88); }
        .zuqen-floating-menu { right:4px;top:calc(100% - 2px);width:155px; }
        .zuqen-menu-item { width:100%;display:flex;align-items:center;gap:9px;padding:10px;border-radius:9px;background:transparent;color:var(--muted);text-align:left;font-size:11px;cursor:pointer; }
        .zuqen-menu-item:hover { background:var(--panel-2);color:var(--text); }
        .zuqen-menu-item.danger:hover { color:var(--danger);background:rgba(255,90,125,.1); }
        .zuqen-sidebar-bottom { padding:13px;border-top:1px solid var(--border); }
        .zuqen-sidebar-user { display:flex;align-items:center;gap:10px;min-width:0;padding:10px;border-radius:13px;background:rgba(255,255,255,.035); }
        .zuqen-user-dot { width:33px;height:33px;flex:0 0 33px;display:grid;place-items:center;border-radius:12px;background:linear-gradient(140deg,#8a83ff,#59cddd);color:#101325;font-size:12px;font-weight:800; }
        .zuqen-user-info { min-width:0;flex:1; }
        .zuqen-user-name { overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text);font-size:10px;font-weight:700; }
        .zuqen-user-status { margin-top:4px;color:var(--muted-2);font-size:9px; }
        .zuqen-auth-button { padding:7px 10px;border-radius:9px;background:var(--panel-2);color:var(--muted);font-size:10px;cursor:pointer; }
        .zuqen-auth-button:hover { color:var(--text);background:var(--panel-3); }
        .zuqen-auth-button.primary { background:linear-gradient(120deg,#a8a3ff,#82e2ee);color:#111326;font-weight:800; }
        .zuqen-auth-button.primary:hover { filter:brightness(1.08); }
        .zuqen-auth-button:disabled { opacity:.5;cursor:not-allowed; }
        .zuqen-main { min-width:0;flex:1;display:flex;flex-direction:column;position:relative; }
        .zuqen-topbar { min-height:76px;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:0 28px;border-bottom:1px solid var(--border);background:rgba(9,12,24,.24);backdrop-filter:blur(22px);position:relative;z-index:20; }
        .light .zuqen-topbar { background:rgba(255,255,255,.25); }
        .zuqen-top-left,.zuqen-top-right { display:flex;align-items:center;gap:11px;min-width:0; }
        .zuqen-icon-button { width:39px;height:39px;display:grid;place-items:center;border:1px solid var(--border);border-radius:13px;color:var(--muted);background:var(--panel);backdrop-filter:blur(18px);cursor:pointer;transition:.2s; }
        .zuqen-icon-button:hover { border-color:var(--border-strong);color:var(--text);background:var(--panel-2);transform:translateY(-1px); }
        .zuqen-agent-selector,.zuqen-credit-wrap { position:relative; }
        .zuqen-agent-button { min-height:43px;display:flex;align-items:center;gap:10px;padding:5px 12px 5px 7px;border:1px solid var(--border);border-radius:14px;background:var(--panel);color:var(--text);cursor:pointer;backdrop-filter:blur(18px); }
        .zuqen-agent-button-icon { width:30px;height:30px;display:grid;place-items:center;border-radius:10px;background:linear-gradient(140deg,rgba(151,137,255,.32),rgba(75,207,225,.18));color:#c9c3ff;font-size:16px; }
        .zuqen-agent-button-text { text-align:left; }
        .zuqen-agent-button-name { font-size:11px;font-weight:800; }
        .zuqen-agent-button-sub { margin-top:3px;color:var(--muted-2);font-size:9px; }
        .zuqen-agent-dropdown { top:calc(100% + 10px);left:0;width:min(320px,calc(100vw - 32px)); }
        .zuqen-agent-option { width:100%;display:flex;align-items:center;gap:10px;padding:11px;border-radius:11px;background:transparent;color:var(--text);text-align:left;cursor:pointer; }
        .zuqen-agent-option:hover,.zuqen-agent-option.selected { background:var(--panel-2); }
        .zuqen-agent-option-icon { width:33px;height:33px;display:grid;place-items:center;border-radius:11px;background:var(--panel-3);font-size:15px; }
        .zuqen-agent-option-content { flex:1;min-width:0; }
        .zuqen-agent-option-name { font-size:11px;font-weight:700; }
        .zuqen-agent-option-description { margin-top:4px;color:var(--muted-2);font-size:9px;line-height:1.4; }
        .zuqen-agent-check { color:#a8a2ff; }
        .zuqen-credit-button { display:flex;align-items:center;gap:8px;min-height:39px;padding:0 12px;border:1px solid var(--border);border-radius:12px;background:var(--panel);color:var(--text);cursor:pointer; }
        .zuqen-credit-icon { color:#b8b0ff;font-size:17px; }
        .zuqen-credit-count { font-size:11px;font-weight:800; }
        .zuqen-credit-label { color:var(--muted-2);font-size:10px; }
        .zuqen-credit-dropdown { top:calc(100% + 10px);right:0;width:235px;padding:17px; }
        .zuqen-credit-dropdown-title { color:var(--muted);font-size:10px;font-weight:800;letter-spacing:.5px; }
        .zuqen-credit-big { margin-top:9px;font:800 28px 'Manrope',sans-serif;letter-spacing:-1px; }
        .zuqen-credit-small { margin-top:4px;color:var(--muted-2);font-size:10px; }
        .zuqen-credit-line { height:1px;margin:14px 0;background:var(--border); }
        .zuqen-credit-row { display:flex;justify-content:space-between;margin-top:9px;color:var(--muted-2);font-size:10px; }
        .zuqen-credit-row strong { color:var(--text);font-weight:700; }
        .zuqen-content { flex:1;min-height:0;display:flex;flex-direction:column;position:relative; }
        .zuqen-home { flex:1;overflow-y:auto;padding:clamp(28px,5vh,65px) 28px 42px; }
        .zuqen-home-inner { width:min(1000px,100%);margin:0 auto; }
        .zuqen-welcome { max-width:760px;margin:0 auto;text-align:center;position:relative; }
        .zuqen-welcome-mark { width:76px;height:76px;display:grid;place-items:center;position:relative;margin:0 auto 24px;border-radius:26px;
          background:radial-gradient(circle at 30% 22%,rgba(255,255,255,.95),rgba(175,166,255,.45) 23%,rgba(93,86,214,.15) 55%,rgba(49,197,216,.14));
          border:1px solid rgba(197,190,255,.42);box-shadow:0 0 0 9px rgba(132,123,255,.045),0 0 70px rgba(120,110,255,.24),inset 0 1px rgba(255,255,255,.55);animation:orbFloat 5s ease-in-out infinite; }
        .zuqen-welcome-mark::before { content:"";position:absolute;inset:7px;border:1px solid rgba(167,219,255,.4);border-radius:21px;transform:rotate(22deg); }
        .zuqen-welcome-mark::after { content:"✦";position:relative;font-size:37px;color:#f6f3ff;text-shadow:0 0 22px #9d9aff,0 0 42px #61dbe9; }
        .zuqen-welcome-mark span { position:absolute;inset:-9px;border:1px solid rgba(140,209,255,.2);border-radius:31px;transform:rotate(-18deg); }
        .light .zuqen-welcome-mark::after { color:#5f56cc; }
        .zuqen-welcome h1 { margin:0;font:800 clamp(34px,5.1vw,61px)/1.07 'Manrope',sans-serif;letter-spacing:-2.8px;background:linear-gradient(100deg,var(--text) 6%,#b8b3ff 51%,#87e5ee 94%);color:transparent;background-clip:text; }
        .light .zuqen-welcome h1 { background-image:linear-gradient(100deg,#222440 6%,#625bd0 51%,#168e9e 94%); }
        .zuqen-welcome p { max-width:570px;margin:18px auto 0;color:var(--muted);font-size:14px;line-height:1.8; }
        .zuqen-search-card { width:min(760px,100%);min-height:76px;display:flex;align-items:center;gap:13px;margin:34px auto 0;padding:12px 15px;border:1px solid rgba(184,178,255,.32);border-radius:24px;
          background:linear-gradient(120deg,rgba(255,255,255,.095),rgba(255,255,255,.035)),rgba(20,24,43,.42);backdrop-filter:blur(32px) saturate(165%);box-shadow:0 18px 70px rgba(0,0,0,.16),inset 0 1px rgba(255,255,255,.11);transition:.25s; }
        .zuqen-search-card:focus-within { border-color:rgba(167,162,255,.72);box-shadow:0 0 0 4px rgba(133,124,255,.09),0 20px 80px rgba(0,0,0,.18); }
        .light .zuqen-search-card { background:rgba(255,255,255,.58); }
        .zuqen-search-card-icon { width:44px;height:44px;flex:0 0 44px;display:grid;place-items:center;border-radius:15px;background:linear-gradient(140deg,rgba(151,137,255,.24),rgba(75,207,225,.14));color:#c4c0ff; }
        .zuqen-search-card input { flex:1;min-width:0;border:0;outline:0;background:transparent;color:var(--text);font-size:14px; }
        .zuqen-search-card input::placeholder { color:var(--muted-2); }
        .zuqen-search-shortcut { padding:6px 9px;border:1px solid var(--border);border-radius:9px;background:rgba(255,255,255,.04);color:var(--muted-2);font-size:10px; }
        .zuqen-suggestion-grid { display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:17px; }
        .zuqen-suggestion { min-height:126px;padding:17px 16px;text-align:left;border:1px solid var(--border);border-radius:19px;background:linear-gradient(145deg,rgba(255,255,255,.075),rgba(255,255,255,.018));backdrop-filter:blur(20px);color:var(--text);cursor:pointer;transition:transform .22s,border-color .22s,background .22s; }
        .zuqen-suggestion:hover { transform:translateY(-4px);border-color:rgba(167,162,255,.48);background:linear-gradient(145deg,rgba(151,137,255,.16),rgba(75,207,225,.055)); }
        .zuqen-suggestion-icon { color:#aaa5ff;font-size:19px; }
        .zuqen-suggestion-title { margin-top:16px;font-size:12px;font-weight:800; }
        .zuqen-suggestion-text { margin-top:6px;color:var(--muted-2);font-size:10px;line-height:1.55; }
        .zuqen-agent-strip { margin-top:38px; }
        .zuqen-strip-title { color:var(--muted-2);text-transform:uppercase;letter-spacing:1.6px;font-size:10px;font-weight:800;text-align:center; }
        .zuqen-agent-cards { display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:14px; }
        .zuqen-mini-agent { min-width:0;padding:16px;border:1px solid var(--border);border-radius:18px;background:rgba(255,255,255,.035);backdrop-filter:blur(18px);color:var(--text);text-align:left;cursor:pointer;transition:.22s; }
        .zuqen-mini-agent:hover { transform:translateY(-3px);border-color:rgba(167,162,255,.45);background:rgba(135,126,255,.10); }
        .zuqen-mini-agent-icon { width:36px;height:36px;display:grid;place-items:center;border-radius:13px;background:linear-gradient(140deg,rgba(151,137,255,.24),rgba(75,207,225,.14));color:#c5c0ff;font-size:14px; }
        .zuqen-mini-agent-name { margin-top:13px;font-size:11px;font-weight:800; }
        .zuqen-mini-agent-desc { margin-top:5px;color:var(--muted-2);font-size:9px;line-height:1.5; }
        .zuqen-chat-view { flex:1;min-height:0;display:flex;flex-direction:column;position:relative; }
        .zuqen-messages { flex:1;min-height:0;overflow-y:auto;padding:32px 28px 24px;scroll-behavior:smooth;overscroll-behavior:contain; }
        .zuqen-message-list { width:min(830px,100%);margin:0 auto; }
        .zuqen-message-row { display:flex;margin-bottom:30px;animation:messageRise .28s ease both; }
        .zuqen-message-row.user { justify-content:flex-end; }
        .zuqen-message-row.assistant { justify-content:flex-start; }
        .zuqen-message-block { width:fit-content;max-width:min(760px,94%);min-width:0; }
        .zuqen-message-label { display:flex;align-items:center;gap:8px;margin:0 0 9px;color:var(--muted-2);font-size:10px;font-weight:800;letter-spacing:.3px; }
        .user .zuqen-message-label { justify-content:flex-end; }
        .assistant .zuqen-message-label { justify-content:flex-start; }
        .zuqen-message-label-mark { width:24px;height:24px;display:grid;place-items:center;border-radius:9px;background:linear-gradient(140deg,rgba(151,137,255,.3),rgba(75,207,225,.2));color:#d0ccff;font-size:10px; }
        .zuqen-message-bubble { padding:15px 18px;border:1px solid var(--border);border-radius:21px;font-size:14px;line-height:1.8;white-space:pre-wrap;overflow-wrap:anywhere;word-break:normal; }
        .user .zuqen-message-bubble { background:linear-gradient(130deg,rgba(119,108,255,.25),rgba(65,183,205,.13)),rgba(25,29,51,.48);border-color:rgba(168,160,255,.25);border-bottom-right-radius:7px;backdrop-filter:blur(28px); }
        .assistant .zuqen-message-bubble { padding:2px 0;border:0;border-radius:0;background:transparent;box-shadow:none; }
        .light .user .zuqen-message-bubble { background:rgba(108,99,226,.11); }
        .zuqen-message-actions { display:flex;align-items:center;gap:4px;margin-top:9px;opacity:.72;transition:opacity .2s; }
        .zuqen-message-row:hover .zuqen-message-actions { opacity:1; }
        .user .zuqen-message-actions { justify-content:flex-end; }
        .assistant .zuqen-message-actions { justify-content:flex-start; }
        .zuqen-action { width:30px;height:30px;display:grid;place-items:center;color:var(--muted-2);background:transparent;border-radius:9px;cursor:pointer; }
        .zuqen-action:hover { color:var(--text);background:var(--panel-2); }
        .zuqen-edit-box { width:100%;padding:13px;border:1px solid var(--border-strong);border-radius:17px;background:var(--panel);backdrop-filter:blur(24px); }
        .zuqen-edit-box textarea { width:100%;min-height:100px;resize:vertical;border:0;outline:0;background:transparent;color:var(--text);line-height:1.7;font-size:14px; }
        .zuqen-edit-actions { display:flex;justify-content:flex-end;gap:8px;margin-top:9px; }
        .zuqen-small-button { min-height:34px;padding:0 12px;border-radius:10px;background:var(--panel-3);color:var(--muted);cursor:pointer;font-size:10px;font-weight:700; }
        .zuqen-small-button.primary { color:var(--accent-text);background:linear-gradient(120deg,#b5afff,#8ce5ee); }
        .zuqen-typing { display:inline-flex;gap:5px;align-items:center;min-height:27px;padding:0 2px; }
        .zuqen-typing span { width:6px;height:6px;border-radius:50%;background:#aaa5ff;animation:zuqenTyping 1.1s infinite ease-in-out; }
        .zuqen-typing span:nth-child(2) { animation-delay:.15s; }.zuqen-typing span:nth-child(3) { animation-delay:.3s; }
        @keyframes zuqenTyping { 0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-5px);opacity:1} }
        @keyframes orbFloat { 0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-6px) rotate(2deg)} }
        @keyframes messageRise { from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)} }
        .zuqen-attachment-list { display:flex;flex-wrap:wrap;gap:8px;margin-top:10px; }
        .zuqen-attachment-chip { display:flex;align-items:center;gap:8px;max-width:250px;padding:8px 10px;border:1px solid var(--border);background:var(--panel);backdrop-filter:blur(20px);border-radius:12px;font-size:10px;color:var(--muted); }
        .zuqen-attachment-chip-name { overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
        .zuqen-attachment-remove { display:grid;place-items:center;color:var(--muted-2);background:transparent;cursor:pointer; }
        .zuqen-composer-area { position:relative;z-index:10;padding:16px 25px 18px;background:linear-gradient(to top,rgba(8,10,18,.62),rgba(8,10,18,.22) 70%,transparent);backdrop-filter:blur(5px); }
        .light .zuqen-composer-area { background:linear-gradient(to top,rgba(237,240,255,.76),rgba(237,240,255,.28) 70%,transparent); }
        .zuqen-composer { width:min(850px,100%);margin:0 auto;padding:10px 11px 8px;border:1px solid rgba(185,179,255,.32);border-radius:25px;background:rgba(22,26,45,.67);backdrop-filter:blur(35px) saturate(165%);-webkit-backdrop-filter:blur(35px) saturate(165%);box-shadow:0 18px 60px rgba(0,0,0,.22),inset 0 1px rgba(255,255,255,.10);transition:border-color .2s,box-shadow .2s; }
        .zuqen-composer:focus-within { border-color:rgba(168,162,255,.68);box-shadow:0 0 0 4px rgba(132,123,255,.075),0 20px 70px rgba(0,0,0,.25),inset 0 1px rgba(255,255,255,.12); }
        .light .zuqen-composer { background:rgba(255,255,255,.72); }
        .zuqen-composer-row { display:flex;align-items:flex-end;gap:9px; }
        .zuqen-attach-label { width:41px;height:41px;display:grid;place-items:center;flex:0 0 41px;color:var(--muted);background:rgba(255,255,255,.055);border:1px solid var(--border);border-radius:14px;cursor:pointer;transition:.2s; }
        .zuqen-attach-label:hover { color:var(--text);background:var(--panel-3); }
        .zuqen-attach-label input { display:none; }
        .zuqen-composer textarea { flex:1;min-width:0;max-height:220px;min-height:41px;resize:none;outline:none;border:0;background:transparent;color:var(--text);padding:10px 5px;line-height:1.6;font-size:14px; }
        .zuqen-composer textarea::placeholder { color:var(--muted-2); }
        .zuqen-send { width:42px;height:42px;display:grid;place-items:center;flex:0 0 42px;border-radius:15px;background:linear-gradient(135deg,#b6adff,#84e4ee);color:#17172e;cursor:pointer;box-shadow:0 5px 20px rgba(126,119,255,.22);transition:transform .18s,filter .18s; }
        .zuqen-send:hover:not(:disabled) { transform:translateY(-2px) scale(1.02);filter:brightness(1.08); }
        .zuqen-send:disabled { opacity:.36;cursor:not-allowed;box-shadow:none; }
        .zuqen-composer-footer { display:flex;justify-content:space-between;align-items:center;gap:12px;padding:9px 5px 1px 52px;color:var(--muted-2);font-size:9px; }
        .zuqen-error { width:min(850px,calc(100% - 40px));margin:12px auto 0;padding:11px 14px;display:flex;align-items:flex-start;gap:9px;border-radius:13px;color:#ffb4c1;background:rgba(255,75,110,.09);border:1px solid rgba(255,100,135,.22);font-size:11px;line-height:1.5; }
        .light .zuqen-error { color:#a91e42;background:rgba(255,75,110,.07); }
        .zuqen-empty-chat { flex:1;min-height:260px;display:grid;place-items:center;text-align:center;color:var(--muted); }
        .zuqen-empty-chat-inner { max-width:440px;padding:30px; }
        .zuqen-empty-chat-icon { width:57px;height:57px;display:grid;place-items:center;margin:0 auto 18px;border-radius:19px;background:linear-gradient(140deg,rgba(151,137,255,.22),rgba(75,207,225,.13));border:1px solid var(--border);color:#c4c0ff; }
        .zuqen-empty-chat h2 { color:var(--text);font:800 23px 'Manrope',sans-serif;margin:0;letter-spacing:-.7px; }
        .zuqen-empty-chat p { margin:10px 0 0;font-size:12px;line-height:1.7; }
        .zuqen-search-overlay { position:absolute;left:26px;top:68px;width:min(430px,calc(100% - 52px));padding:10px;border:1px solid var(--border-strong);background:rgba(19,23,42,.86);backdrop-filter:blur(30px);border-radius:17px;box-shadow:var(--shadow);z-index:70; }
        .light .zuqen-search-overlay { background:rgba(255,255,255,.88); }
        .zuqen-search-input-wrap { display:flex;align-items:center;gap:9px;padding:10px 11px;border-radius:11px;background:var(--panel-2);color:var(--muted); }
        .zuqen-search-input-wrap input { flex:1;min-width:0;border:0;outline:0;background:transparent;color:var(--text);font-size:12px; }
        .zuqen-mobile-overlay { display:none; }
        .zuqen-jump-latest { position:absolute;z-index:15;left:50%;bottom:136px;transform:translateX(-50%);display:flex;align-items:center;gap:8px;padding:10px 15px;border:1px solid rgba(183,177,255,.38);border-radius:999px;background:rgba(24,28,49,.8);backdrop-filter:blur(25px);box-shadow:0 8px 30px rgba(0,0,0,.22);color:var(--text);font-size:11px;font-weight:700;cursor:pointer;animation:messageRise .2s ease; }
        .light .zuqen-jump-latest { background:rgba(255,255,255,.85); }
        .zuqen-jump-latest:hover { border-color:rgba(183,177,255,.8);background:var(--panel-2); }
        @media (max-width:1100px) { .zuqen-sidebar{width:250px;flex-basis:250px}.zuqen-topbar{padding:0 20px}.zuqen-suggestion-grid,.zuqen-agent-cards{grid-template-columns:repeat(2,minmax(0,1fr))}.zuqen-home{padding-top:35px} }
        @media (max-width:760px) {
          .zuqen-app{min-height:100dvh;height:100dvh}.zuqen-sidebar{position:fixed;left:0;top:0;bottom:0;width:min(300px,86vw);flex-basis:min(300px,86vw);box-shadow:25px 0 90px rgba(0,0,0,.3)}
          .zuqen-sidebar.closed{width:min(300px,86vw);flex-basis:min(300px,86vw);transform:translateX(-105%);overflow:visible}.zuqen-mobile-overlay{display:block;position:fixed;inset:0;z-index:25;background:rgba(3,5,14,.5);backdrop-filter:blur(4px)}
          .zuqen-topbar{min-height:66px;padding:0 13px;gap:8px}.zuqen-top-left,.zuqen-top-right{gap:7px}.zuqen-icon-button{width:36px;height:36px;border-radius:12px}.zuqen-agent-button{min-height:38px;padding:4px 8px;gap:7px}.zuqen-agent-button-icon{width:28px;height:28px}.zuqen-agent-button-sub{display:none}.zuqen-agent-button-name{font-size:10px}.zuqen-credit-button{width:37px;min-height:37px;justify-content:center;padding:0}.zuqen-credit-label{display:none}.zuqen-credit-count{font-size:10px}.zuqen-credit-icon{font-size:14px}
          .zuqen-home{padding:32px 15px 30px}.zuqen-home-inner{max-width:560px}.zuqen-welcome-mark{width:64px;height:64px;border-radius:22px;margin-bottom:20px}.zuqen-welcome h1{font-size:clamp(32px,9vw,48px);letter-spacing:-1.8px}.zuqen-welcome p{font-size:12px;line-height:1.7;margin-top:13px}.zuqen-search-card{min-height:64px;margin-top:25px;padding:8px 10px;border-radius:20px}.zuqen-search-card-icon{width:38px;height:38px;flex-basis:38px}.zuqen-search-card input{font-size:12px}.zuqen-search-shortcut{display:none}.zuqen-suggestion-grid{gap:8px;margin-top:11px}.zuqen-suggestion{min-height:105px;padding:12px;border-radius:15px}.zuqen-suggestion-title{margin-top:11px;font-size:11px}.zuqen-suggestion-text{font-size:9px}.zuqen-agent-strip{margin-top:28px}.zuqen-agent-cards{gap:8px}.zuqen-mini-agent{padding:12px;border-radius:15px}.zuqen-mini-agent-icon{width:31px;height:31px}.zuqen-mini-agent-name{font-size:10px}.zuqen-mini-agent-desc{font-size:8px}
          .zuqen-messages{padding:22px 14px 18px}.zuqen-message-list{width:100%}.zuqen-message-row{margin-bottom:25px}.zuqen-message-block{max-width:96%}.zuqen-message-bubble{font-size:13px;line-height:1.75;padding:12px 14px}.assistant .zuqen-message-bubble{padding:2px 0}.zuqen-composer-area{padding:10px 10px max(12px,env(safe-area-inset-bottom))}.zuqen-composer{padding:8px;border-radius:21px}.zuqen-composer-row{gap:6px}.zuqen-attach-label,.zuqen-send{width:37px;height:37px;flex-basis:37px;border-radius:12px}.zuqen-composer textarea{font-size:13px;min-height:37px;padding:8px 3px}.zuqen-composer-footer{padding:7px 2px 1px;gap:6px;font-size:8px}.zuqen-composer-footer span:first-child{max-width:55%}.zuqen-jump-latest{bottom:126px;padding:9px 13px}.zuqen-error{width:calc(100% - 24px)}
        }
        @media (max-width:390px) { .zuqen-agent-button-text{max-width:82px;overflow:hidden}.zuqen-topbar{padding:0 9px}.zuqen-suggestion-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.zuqen-credit-button{width:33px}.zuqen-composer-footer span:first-child{display:none} }
        @media (prefers-reduced-motion:reduce) { *,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important;transition-duration:.01ms!important} }
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
              <div className="zuqen-messages" ref={messagesContainerRef} onScroll={handleMessagesScroll}>
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

              {showJumpToLatest && (
                <button className="zuqen-jump-latest" onClick={jumpToLatest} aria-label="Jump to latest message">
                  <Icon name="chevron" size={14} />
                  <span>Jump to latest</span>
                </button>
              )}

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