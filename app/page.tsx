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
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);

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

    shouldAutoScrollRef.current = true;
    setShowJumpToLatest(false);
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
        shouldAutoScrollRef.current = true;
        setShowJumpToLatest(false);
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

      shouldAutoScrollRef.current = true;
      setShowJumpToLatest(false);
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

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || !shouldAutoScrollRef.current) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: loading ? "auto" : "smooth",
    });
  }, [messages, loading]);

  const handleMessagesScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const nearBottom = distanceFromBottom < 150;

    shouldAutoScrollRef.current = nearBottom;
    setShowJumpToLatest(!nearBottom && messages.length > 0);
  };

  const jumpToLatest = () => {
    const container = messagesContainerRef.current;
    shouldAutoScrollRef.current = true;
    setShowJumpToLatest(false);
    container?.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  };

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
/* ================================================================
   ZUQEN / AURORA ATELIER — a new visual system, not a recolour.
   Layered glass, editorial typography, deep ink, jade light, warm gold.
   ================================================================ */
:root {
  color-scheme: dark;
  --z-ink: #07110f;
  --z-ink-soft: #0b1714;
  --z-glass: rgba(12, 29, 25, .64);
  --z-glass-strong: rgba(11, 24, 21, .84);
  --z-glass-soft: rgba(226, 255, 239, .045);
  --z-line: rgba(204, 255, 226, .105);
  --z-line-strong: rgba(204, 255, 226, .19);
  --z-white: #f4fff8;
  --z-muted: #a2b8ad;
  --z-muted-soft: #6e897b;
  --z-jade: #a8ffcb;
  --z-jade-strong: #6ce8a4;
  --z-cyan: #8ee9f2;
  --z-gold: #ffd28b;
  --z-rose: #ff9eaa;
  --z-shadow: 0 28px 100px rgba(0, 0, 0, .36);
  --z-radius-xl: 30px;
  --z-radius-lg: 22px;
  --z-radius-md: 16px;
  --z-radius-sm: 12px;
  --z-motion: cubic-bezier(.2, .75, .25, 1);
}* {
  box-sizing: border-box;
}html, body {
  margin: 0;
  padding: 0;
  min-height: 100%;
}body {
  background: #07110f;
  color: var(--z-white);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
}button, input, textarea {
  font: inherit;
}button {
  border: 0;
}button:focus-visible, input:focus-visible, textarea:focus-visible {
  outline: 2px solid var(--z-jade);
  outline-offset: 3px;
}::selection {
  color: #06120d;
  background: var(--z-jade);
}.zuqen-app {
  --bg: var(--z-ink);
  --panel: rgba(9, 24, 20, .72);
  --panel-2: rgba(220, 255, 234, .055);
  --panel-3: rgba(220, 255, 234, .095);
  --border: var(--z-line);
  --border-strong: var(--z-line-strong);
  --text: var(--z-white);
  --muted: var(--z-muted);
  --muted-2: var(--z-muted-soft);
  --accent: var(--z-jade);
  --accent-text: #07140e;
  --danger: var(--z-rose);
  min-height: 100dvh;
  width: 100%;
  display: flex;
  position: relative;
  isolation: isolate;
  overflow: hidden;
  color: var(--text);
  background:
    radial-gradient(ellipse at 78% 8%, rgba(39, 141, 103, .2), transparent 31%),
    radial-gradient(ellipse at 5% 88%, rgba(32, 105, 99, .16), transparent 32%),
    radial-gradient(ellipse at 48% 48%, rgba(22, 67, 52, .14), transparent 48%),
    linear-gradient(138deg, #07110f 0%, #091713 48%, #081310 100%);
  transition: background .35s ease, color .25s ease;
}.zuqen-app::before,
.zuqen-app::after {
  content: "";
  position: fixed;
  pointer-events: none;
  z-index: -1;
  border-radius: 50%;
  filter: blur(1px);
}.zuqen-app::before {
  width: 42vw;
  height: 42vw;
  min-width: 360px;
  min-height: 360px;
  right: -15vw;
  top: -20vw;
  background: radial-gradient(circle, rgba(101, 239, 165, .11), rgba(101, 239, 165, 0) 68%);
  animation: auroraDrift 19s ease-in-out infinite alternate;
}.zuqen-app::after {
  width: 34vw;
  height: 34vw;
  min-width: 300px;
  min-height: 300px;
  left: 18vw;
  bottom: -22vw;
  background: radial-gradient(circle, rgba(255, 196, 117, .075), rgba(255, 196, 117, 0) 70%);
  animation: auroraDrift 24s ease-in-out infinite alternate-reverse;
}.zuqen-app.light {
  color-scheme: light;
  --bg: #f1f7f2;
  --panel: rgba(249, 255, 250, .82);
  --panel-2: rgba(20, 67, 44, .045);
  --panel-3: rgba(20, 67, 44, .085);
  --border: rgba(20, 67, 44, .105);
  --border-strong: rgba(20, 67, 44, .18);
  --text: #11271d;
  --muted: #536d5e;
  --muted-2: #819889;
  --accent: #176d45;
  --accent-text: #ffffff;
  --danger: #b83c55;
  background:
    radial-gradient(ellipse at 78% 8%, rgba(103, 226, 159, .24), transparent 32%),
    radial-gradient(ellipse at 4% 88%, rgba(130, 208, 200, .19), transparent 32%),
    linear-gradient(138deg, #edf6ef 0%, #f7fbf6 52%, #e8f3eb 100%);
}.zuqen-app.light::before {
  background: radial-gradient(circle, rgba(58, 184, 111, .15), transparent 68%);
}.zuqen-app.light::after {
  background: radial-gradient(circle, rgba(236, 178, 96, .12), transparent 70%);
}

/* The navigation is a floating glass object, not a flat rail. */
.zuqen-sidebar {
  width: 292px;
  flex: 0 0 292px;
  height: 100dvh;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 40;
  overflow: hidden;
  background: linear-gradient(160deg, rgba(17, 39, 31, .79), rgba(7, 19, 15, .74));
  border-right: 1px solid rgba(205, 255, 225, .1);
  backdrop-filter: blur(32px) saturate(145%);
  -webkit-backdrop-filter: blur(32px) saturate(145%);
  box-shadow: 14px 0 60px rgba(0, 0, 0, .09), inset -1px 0 0 rgba(255, 255, 255, .025);
  transition: width .42s var(--z-motion), flex-basis .42s var(--z-motion), transform .42s var(--z-motion);
}.light .zuqen-sidebar {
  background: linear-gradient(160deg, rgba(255,255,255,.82), rgba(236,247,239,.76));
  border-right-color: rgba(26, 82, 50, .1);
  box-shadow: 12px 0 48px rgba(25, 67, 43, .055);
}.zuqen-sidebar.closed {
  width: 0;
  flex-basis: 0;
  border-right: 0;
}.zuqen-brand {
  min-height: 92px;
  padding: 0 23px;
  display: flex;
  align-items: center;
  gap: 14px;
  position: relative;
}.zuqen-brand::after {
  content: "";
  position: absolute;
  left: 23px;
  right: 23px;
  bottom: 0;
  height: 1px;
  background: linear-gradient(90deg, rgba(168,255,203,.3), rgba(168,255,203,0));
}.zuqen-logo {
  width: 43px;
  height: 43px;
  flex: 0 0 43px;
  display: grid;
  place-items: center;
  position: relative;
  overflow: hidden;
  border-radius: 15px;
  background: linear-gradient(145deg, #c6ffda 0%, #69e5a1 42%, #1f8860 100%);
  box-shadow: 0 8px 28px rgba(76, 226, 142, .23), inset 0 1px 0 rgba(255,255,255,.75);
  animation: logoBreath 5s ease-in-out infinite;
}.zuqen-logo::before {
  content: "";
  width: 21px;
  height: 21px;
  border: 2px solid #092017;
  border-radius: 50% 50% 46% 50%;
  transform: rotate(-35deg);
  position: absolute;
  box-shadow: inset 0 0 0 4px rgba(9,32,23,.06);
}.zuqen-logo::after {
  content: "";
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #092017;
  position: absolute;
  box-shadow: 0 0 0 5px rgba(9,32,23,.08);
}.zuqen-brand-text {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}.zuqen-brand-name {
  font-size: 17px;
  line-height: 1;
  letter-spacing: 2.1px;
  font-weight: 850;
}.zuqen-brand-sub {
  color: var(--muted-2);
  font-size: 9px;
  letter-spacing: 2px;
  text-transform: uppercase;
  white-space: nowrap;
}.zuqen-sidebar-content {
  padding: 18px 14px 15px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}.zuqen-new-chat {
  width: 100%;
  min-height: 49px;
  padding: 0 15px;
  display: flex;
  align-items: center;
  gap: 11px;
  border: 1px solid rgba(168,255,203,.24);
  border-radius: 15px;
  color: #082017;
  background: linear-gradient(115deg, #c5ffda, #79edab 65%, #5bd28e);
  box-shadow: 0 8px 28px rgba(80, 214, 137, .12), inset 0 1px 0 rgba(255,255,255,.65);
  cursor: pointer;
  transition: transform .25s var(--z-motion), box-shadow .25s ease, filter .25s ease;
}.zuqen-new-chat:hover {
  transform: translateY(-2px);
  box-shadow: 0 13px 34px rgba(80,214,137,.21);
  filter: saturate(1.08);
}.zuqen-new-chat:active {
  transform: translateY(0) scale(.99);
}.zuqen-new-chat span:last-child {
  font-size: 12px;
  font-weight: 760;
  letter-spacing: .1px;
}.zuqen-quick-links {
  display: grid;
  gap: 7px;
  margin-top: 13px;
}.zuqen-quick-link {
  width: 100%;
  min-height: 43px;
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 13px;
  background: transparent;
  color: var(--muted);
  text-align: left;
  cursor: pointer;
  transition: color .22s ease, background .22s ease, border-color .22s ease, transform .22s ease;
}.zuqen-quick-link:hover {
  color: var(--text);
  background: rgba(216,255,231,.06);
  border-color: var(--border);
  transform: translateX(2px);
}.zuqen-quick-link .quick-icon {
  width: 29px;
  height: 29px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: rgba(216,255,231,.065);
  color: var(--z-jade);
}.zuqen-quick-link .quick-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}.zuqen-quick-link .quick-title {
  color: var(--text);
  font-size: 11px;
  font-weight: 690;
}.zuqen-quick-link .quick-subtitle {
  color: var(--muted-2);
  font-size: 9px;
}.zuqen-quick-link .quick-tag {
  padding: 4px 6px;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--muted-2);
  font-size: 8px;
  letter-spacing: .5px;
}.zuqen-sidebar-section {
  margin-top: 24px;
  min-height: 0;
  display: flex;
  flex-direction: column;
  flex: 1;
}.zuqen-sidebar-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px 11px;
  color: var(--muted-2);
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 1.8px;
  font-weight: 800;
}.zuqen-sidebar-heading button {
  width: 27px;
  height: 27px;
  display: grid;
  place-items: center;
  color: var(--muted);
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: background .2s ease, color .2s ease;
}.zuqen-sidebar-heading button:hover {
  color: var(--text);
  background: var(--panel-3);
}.zuqen-chat-list {
  overflow-y: auto;
  padding-right: 2px;
  scrollbar-width: thin;
  scrollbar-color: rgba(168,255,203,.15) transparent;
}.zuqen-chat-list::-webkit-scrollbar, .zuqen-messages::-webkit-scrollbar {
  width: 5px;
}.zuqen-chat-list::-webkit-scrollbar-thumb, .zuqen-messages::-webkit-scrollbar-thumb {
  background: rgba(168,255,203,.16);
  border-radius: 99px;
}.zuqen-chat-item {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 49px;
  padding: 8px 8px 8px 11px;
  border: 1px solid transparent;
  border-radius: 13px;
  color: var(--muted);
  background: transparent;
  cursor: pointer;
  text-align: left;
  margin-bottom: 3px;
  transition: background .2s ease, border-color .2s ease, color .2s ease;
}.zuqen-chat-item:hover {
  color: var(--text);
  background: rgba(220,255,235,.045);
}.zuqen-chat-item.active {
  color: var(--text);
  background: linear-gradient(110deg, rgba(168,255,203,.105), rgba(168,255,203,.025));
  border-color: rgba(168,255,203,.13);
  box-shadow: inset 3px 0 0 var(--z-jade);
}.zuqen-chat-main {
  min-width: 0;
  flex: 1;
}.zuqen-chat-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 590;
  letter-spacing: .05px;
}.zuqen-chat-date {
  margin-top: 4px;
  font-size: 9px;
  color: var(--muted-2);
}.zuqen-chat-menu-button {
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  display: grid;
  place-items: center;
  color: var(--muted-2);
  background: transparent;
  border-radius: 9px;
  cursor: pointer;
  opacity: 0;
  transition: opacity .2s ease, background .2s ease, color .2s ease;
}.zuqen-chat-item:hover .zuqen-chat-menu-button, .zuqen-chat-menu-button.open, .zuqen-chat-menu-button:focus-visible {
  opacity: 1;
}.zuqen-chat-menu-button:hover {
  color: var(--text);
  background: var(--panel-3);
}.zuqen-rename {
  width: 100%;
  padding: 8px;
  border-radius: 9px;
  border: 1px solid var(--border-strong);
  outline: none;
  background: var(--panel);
  color: var(--text);
  font-size: 11px;
}.zuqen-floating-menu {
  position: absolute;
  right: 8px;
  top: 42px;
  width: 176px;
  padding: 6px;
  border-radius: 15px;
  background: rgba(10,26,20,.96);
  border: 1px solid var(--border-strong);
  box-shadow: var(--z-shadow);
  backdrop-filter: blur(24px);
  z-index: 70;
  animation: popIn .18s var(--z-motion);
}.light .zuqen-floating-menu {
  background: rgba(250,255,251,.97);
}.zuqen-menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 10px;
  border-radius: 10px;
  background: transparent;
  color: var(--muted);
  text-align: left;
  cursor: pointer;
  font-size: 11px;
  transition: background .18s ease, color .18s ease;
}.zuqen-menu-item:hover {
  background: var(--panel-3);
  color: var(--text);
}.zuqen-menu-item.danger:hover {
  color: var(--danger);
}.zuqen-sidebar-bottom {
  padding-top: 13px;
  border-top: 1px solid var(--border);
  margin-top: auto;
}.zuqen-sidebar-user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px;
  border-radius: 13px;
}.zuqen-user-dot {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  flex: 0 0 34px;
  border-radius: 12px;
  background: linear-gradient(145deg, rgba(168,255,203,.24), rgba(168,255,203,.06));
  border: 1px solid rgba(168,255,203,.2);
  color: var(--z-jade);
  font-size: 11px;
  font-weight: 850;
}.zuqen-user-info {
  min-width: 0;
  flex: 1;
}.zuqen-user-name {
  font-size: 10px;
  font-weight: 720;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}.zuqen-user-status {
  color: var(--muted-2);
  font-size: 9px;
  margin-top: 4px;
}.zuqen-auth-button {
  width: 100%;
  min-height: 37px;
  margin-top: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border-radius: 11px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  color: var(--text);
  cursor: pointer;
  font-size: 10px;
  font-weight: 680;
  transition: background .2s ease, border-color .2s ease;
}.zuqen-auth-button:hover {
  background: var(--panel-3);
  border-color: var(--border-strong);
}.zuqen-auth-button.primary {
  color: #082017;
  background: var(--z-jade);
  border-color: transparent;
}.zuqen-auth-button:disabled {
  opacity: .55;
  cursor: wait;
}

/* Main canvas and floating command bar. */
.zuqen-main { min-width: 0; flex: 1; height: 100dvh; display: flex; flex-direction: column; position: relative; overflow: hidden; }.zuqen-topbar {
  min-height: 78px;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  padding: 13px 25px;
  position: relative;
  z-index: 25;
  background: linear-gradient(180deg, rgba(11,28,22,.54), rgba(11,28,22,.23));
  border-bottom: 1px solid rgba(204,255,226,.075);
  backdrop-filter: blur(26px);
  -webkit-backdrop-filter: blur(26px);
}.light .zuqen-topbar {
  background: linear-gradient(180deg, rgba(250,255,251,.72), rgba(250,255,251,.3));
}.zuqen-top-left, .zuqen-top-right {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}.zuqen-icon-button {
  width: 39px;
  height: 39px;
  flex: 0 0 39px;
  display: grid;
  place-items: center;
  border: 1px solid var(--border);
  border-radius: 13px;
  background: rgba(220,255,235,.035);
  color: var(--muted);
  cursor: pointer;
  transition: color .2s ease, background .2s ease, border-color .2s ease, transform .2s ease;
}.zuqen-icon-button:hover {
  color: var(--text);
  background: rgba(220,255,235,.085);
  border-color: var(--border-strong);
  transform: translateY(-1px);
}.zuqen-agent-selector {
  position: relative;
  min-width: 0;
}.zuqen-agent-button {
  min-height: 43px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 11px;
  border: 1px solid var(--border);
  border-radius: 14px;
  color: var(--text);
  background: rgba(220,255,235,.045);
  cursor: pointer;
  transition: background .2s ease, border-color .2s ease;
}.zuqen-agent-button:hover {
  background: rgba(220,255,235,.08);
  border-color: var(--border-strong);
}.zuqen-agent-button-icon {
  width: 31px;
  height: 31px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  color: #082017;
  background: linear-gradient(145deg, #c6ffda, #61dc98);
  box-shadow: 0 5px 18px rgba(95,220,152,.13);
}.zuqen-agent-button-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  text-align: left;
}.zuqen-agent-button-name {
  font-size: 11px;
  font-weight: 760;
  white-space: nowrap;
}.zuqen-agent-button-sub {
  color: var(--muted-2);
  font-size: 8px;
  letter-spacing: .6px;
  text-transform: uppercase;
}.zuqen-agent-dropdown {
  position: absolute;
  top: calc(100% + 10px);
  left: 0;
  width: min(320px, calc(100vw - 32px));
  padding: 8px;
  border: 1px solid var(--border-strong);
  border-radius: 19px;
  background: rgba(8,24,18,.96);
  box-shadow: var(--z-shadow);
  backdrop-filter: blur(28px);
  z-index: 80;
  animation: popIn .2s var(--z-motion);
}.light .zuqen-agent-dropdown {
  background: rgba(250,255,251,.97);
}.zuqen-agent-option {
  width: 100%;
  min-height: 57px;
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 13px;
  background: transparent;
  color: var(--muted);
  text-align: left;
  cursor: pointer;
  transition: background .18s ease, border-color .18s ease;
}.zuqen-agent-option:hover, .zuqen-agent-option.selected {
  background: var(--panel-2);
  border-color: var(--border);
}.zuqen-agent-option-icon {
  width: 35px;
  height: 35px;
  display: grid;
  place-items: center;
  flex: 0 0 35px;
  border-radius: 11px;
  background: rgba(168,255,203,.08);
  color: var(--z-jade);
  font-size: 16px;
}.zuqen-agent-option-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}.zuqen-agent-option-name {
  color: var(--text);
  font-size: 11px;
  font-weight: 750;
}.zuqen-agent-option-description {
  color: var(--muted-2);
  font-size: 9px;
}.zuqen-agent-check {
  color: var(--z-jade);
}.zuqen-top-right {
  gap: 8px;
}.zuqen-top-action {
  min-height: 39px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: rgba(220,255,235,.035);
  color: var(--muted);
  cursor: pointer;
  white-space: nowrap;
  font-size: 10px;
  font-weight: 730;
  transition: color .2s ease, background .2s ease, border-color .2s ease, transform .2s ease;
}.zuqen-top-action:hover {
  color: var(--text);
  background: rgba(220,255,235,.085);
  border-color: var(--border-strong);
  transform: translateY(-1px);
}.zuqen-top-action.automation-action .action-symbol {
  color: var(--z-cyan);
}.zuqen-top-action.templates-action .action-symbol {
  color: var(--z-gold);
}.zuqen-credit-wrap {
  position: relative;
}.zuqen-credit-button {
  min-height: 39px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border: 1px solid rgba(168,255,203,.16);
  border-radius: 12px;
  color: var(--text);
  background: rgba(168,255,203,.06);
  cursor: pointer;
  transition: background .2s ease, border-color .2s ease;
}.zuqen-credit-button:hover {
  background: rgba(168,255,203,.11);
  border-color: rgba(168,255,203,.3);
}.zuqen-credit-icon {
  color: var(--z-jade);
  font-size: 16px;
}.zuqen-credit-count {
  font-size: 11px;
  font-weight: 820;
  font-variant-numeric: tabular-nums;
}.zuqen-credit-label {
  color: var(--muted);
  font-size: 9px;
}.zuqen-credit-dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + 10px);
  width: 240px;
  padding: 18px;
  border: 1px solid var(--border-strong);
  border-radius: 19px;
  background: rgba(8,24,18,.96);
  box-shadow: var(--z-shadow);
  backdrop-filter: blur(28px);
  z-index: 80;
  animation: popIn .2s var(--z-motion);
}.light .zuqen-credit-dropdown {
  background: rgba(250,255,251,.97);
}.zuqen-credit-dropdown-title {
  font-size: 11px;
  font-weight: 800;
}.zuqen-credit-big {
  margin-top: 15px;
  color: var(--z-jade);
  font-size: 38px;
  line-height: 1;
  font-weight: 800;
  letter-spacing: -2px;
}.zuqen-credit-small {
  margin-top: 7px;
  color: var(--muted);
  font-size: 10px;
}.zuqen-credit-line {
  height: 1px;
  margin: 16px 0 10px;
  background: var(--border);
}.zuqen-credit-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 7px 0;
  color: var(--muted);
  font-size: 10px;
}.zuqen-credit-row strong {
  color: var(--text);
  font-weight: 700;
}.zuqen-search-overlay {
  position: absolute;
  top: 72px;
  left: 50%;
  width: min(570px, calc(100% - 32px));
  transform: translateX(-50%);
  z-index: 60;
  padding: 10px;
  border: 1px solid var(--border-strong);
  border-radius: 18px;
  background: rgba(8,24,18,.95);
  box-shadow: var(--z-shadow);
  backdrop-filter: blur(28px);
  animation: popIn .18s var(--z-motion);
}.light .zuqen-search-overlay {
  background: rgba(250,255,251,.97);
}.zuqen-search-input-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 11px;
}.zuqen-search-input-wrap > svg {
  color: var(--muted);
  flex: 0 0 auto;
}.zuqen-search-input-wrap input {
  width: 100%;
  height: 43px;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text);
  font-size: 12px;
}.zuqen-search-input-wrap input::placeholder {
  color: var(--muted-2);
}

/* Workspace body. */
.zuqen-content { min-height: 0; flex: 1; display: flex; flex-direction: column; position: relative; overflow: hidden; }.zuqen-error {
  width: min(920px, calc(100% - 36px));
  margin: 12px auto 0;
  padding: 12px 15px;
  border: 1px solid rgba(255,158,170,.25);
  border-radius: 13px;
  background: rgba(117,28,47,.18);
  color: #ffc2ca;
  font-size: 11px;
  line-height: 1.5;
}.light .zuqen-error {
  color: #9b2f46;
  background: rgba(255,158,170,.16);
}.zuqen-empty-chat {
  min-height: 0;
  flex: 1;
  display: grid;
  place-items: center;
  padding: 36px 22px;
}.zuqen-empty-chat-inner {
  max-width: 410px;
  text-align: center;
  animation: riseIn .7s var(--z-motion) both;
}.zuqen-empty-chat-icon {
  width: 62px;
  height: 62px;
  display: grid;
  place-items: center;
  margin: 0 auto 20px;
  border: 1px solid rgba(168,255,203,.25);
  border-radius: 22px;
  background: linear-gradient(145deg, rgba(168,255,203,.16), rgba(168,255,203,.025));
  color: var(--z-jade);
  box-shadow: 0 14px 45px rgba(68,210,132,.09);
}.zuqen-empty-chat h2 {
  margin: 0;
  color: var(--text);
  font-size: clamp(23px, 3vw, 31px);
  font-weight: 650;
  letter-spacing: -1.2px;
}.zuqen-empty-chat p {
  margin: 11px auto 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.8;
}.zuqen-chat-view {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}.zuqen-messages {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  scroll-behavior: smooth;
  padding: 29px 24px 30px;
  scrollbar-width: thin;
  scrollbar-color: rgba(168,255,203,.16) transparent;
}.zuqen-message-list {
  width: min(920px, 100%);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 25px;
}.zuqen-message-row {
  width: 100%;
  display: flex;
  animation: messageIn .32s var(--z-motion) both;
}.zuqen-message-row.user {
  justify-content: flex-end;
}.zuqen-message-row.assistant {
  justify-content: flex-start;
}.zuqen-message-block {
  width: fit-content;
  max-width: min(78%, 780px);
  min-width: 0;
}.zuqen-message-row.assistant .zuqen-message-block {
  width: 100%;
  max-width: 100%;
}.zuqen-message-label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 9px;
  color: var(--muted-2);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 1.4px;
  text-transform: uppercase;
}.zuqen-message-row.user .zuqen-message-label {
  justify-content: flex-end;
}.zuqen-message-label-mark {
  width: 23px;
  height: 23px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(168,255,203,.22);
  border-radius: 8px;
  background: rgba(168,255,203,.1);
  color: var(--z-jade);
}.zuqen-message-bubble {
  width: 100%;
  min-width: 0;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 13px;
  line-height: 1.85;
  letter-spacing: .005em;
  color: var(--text);
}.user .zuqen-message-bubble {
  padding: 13px 17px;
  border: 1px solid rgba(168,255,203,.18);
  border-radius: 21px 21px 7px 21px;
  background: linear-gradient(135deg, rgba(96,190,133,.2), rgba(42,112,80,.12));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.035), 0 12px 30px rgba(0,0,0,.06);
}.assistant .zuqen-message-bubble {
  padding: 0 0 1px;
  background: transparent;
}.light .user .zuqen-message-bubble {
  background: linear-gradient(135deg, rgba(88,191,126,.18), rgba(50,135,92,.09));
}.zuqen-message-bubble p {
  margin: 0 0 12px;
}.zuqen-message-bubble p:last-child {
  margin-bottom: 0;
}.zuqen-message-bubble h1, .zuqen-message-bubble h2, .zuqen-message-bubble h3 {
  margin: 20px 0 9px;
  line-height: 1.3;
  letter-spacing: -.5px;
}.zuqen-message-bubble h1 {
  font-size: 23px;
}.zuqen-message-bubble h2 {
  font-size: 19px;
}.zuqen-message-bubble h3 {
  font-size: 15px;
}.zuqen-message-bubble ul, .zuqen-message-bubble ol {
  padding-left: 23px;
  margin: 10px 0 15px;
}.zuqen-message-bubble li {
  padding-left: 4px;
  margin: 5px 0;
}.zuqen-message-bubble blockquote {
  margin: 14px 0;
  padding: 5px 0 5px 15px;
  border-left: 2px solid var(--z-jade-strong);
  color: var(--muted);
}.zuqen-message-bubble a {
  color: var(--z-cyan);
  text-decoration: underline;
  text-decoration-color: rgba(142,233,242,.35);
  text-underline-offset: 3px;
}.zuqen-message-bubble code {
  padding: 2px 5px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: rgba(0,0,0,.17);
  color: var(--z-jade);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: .9em;
}.zuqen-message-bubble pre {
  max-width: 100%;
  overflow: auto;
  margin: 14px 0;
  padding: 17px;
  border: 1px solid var(--border);
  border-radius: 15px;
  background: rgba(2,11,8,.62);
  color: #d8f6e3;
  line-height: 1.65;
}.zuqen-message-bubble pre code {
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
}.zuqen-message-bubble table {
  width: 100%;
  border-collapse: collapse;
  margin: 14px 0;
  font-size: 11px;
}.zuqen-message-bubble th, .zuqen-message-bubble td {
  padding: 9px 10px;
  border: 1px solid var(--border);
  text-align: left;
}.zuqen-message-bubble th {
  background: rgba(168,255,203,.07);
}.zuqen-typing {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 26px;
  padding: 3px 0;
}.zuqen-typing span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--z-jade);
  animation: typingPulse 1.15s infinite ease-in-out;
}.zuqen-typing span:nth-child(2) {
  animation-delay: .15s;
}.zuqen-typing span:nth-child(3) {
  animation-delay: .3s;
}.zuqen-attachment-list {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin: 10px 0;
}.zuqen-attachment-chip {
  max-width: 100%;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 9px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: rgba(220,255,235,.045);
  color: var(--muted);
  font-size: 10px;
}.zuqen-attachment-chip-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}.zuqen-attachment-remove {
  width: 23px;
  height: 23px;
  display: grid;
  place-items: center;
  border-radius: 7px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
}.zuqen-attachment-remove:hover {
  background: var(--panel-3);
  color: var(--text);
}.zuqen-message-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 10px;
  opacity: .76;
  transition: opacity .2s ease;
}.zuqen-message-block:hover .zuqen-message-actions {
  opacity: 1;
}.user .zuqen-message-actions {
  justify-content: flex-end;
}.assistant .zuqen-message-actions {
  justify-content: flex-start;
}.zuqen-action {
  width: 31px;
  height: 29px;
  display: grid;
  place-items: center;
  color: var(--muted-2);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 9px;
  cursor: pointer;
  transition: color .18s ease, background .18s ease, border-color .18s ease;
}.zuqen-action:hover {
  color: var(--z-jade);
  background: rgba(168,255,203,.07);
  border-color: var(--border);
}.zuqen-action:disabled {
  opacity: .35;
  cursor: not-allowed;
}.zuqen-edit-box {
  width: 100%;
  padding: 13px;
  border: 1px solid var(--border-strong);
  border-radius: 17px;
  background: rgba(8,24,18,.75);
  backdrop-filter: blur(20px);
}.light .zuqen-edit-box {
  background: rgba(250,255,251,.9);
}.zuqen-edit-box textarea {
  width: 100%;
  min-height: 100px;
  resize: vertical;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text);
  line-height: 1.65;
  font-size: 13px;
}.zuqen-edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 7px;
  margin-top: 8px;
}.zuqen-small-button {
  min-height: 34px;
  padding: 0 13px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--panel-2);
  color: var(--muted);
  cursor: pointer;
  font-size: 10px;
  font-weight: 750;
}.zuqen-small-button:hover {
  color: var(--text);
  background: var(--panel-3);
}.zuqen-small-button.primary {
  color: var(--accent-text);
  background: var(--accent);
  border-color: transparent;
}.zuqen-jump-latest {
  position: absolute;
  z-index: 18;
  bottom: 143px;
  left: 50%;
  transform: translateX(-50%);
  min-height: 39px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 15px;
  border: 1px solid rgba(168,255,203,.25);
  border-radius: 999px;
  background: rgba(9,28,20,.83);
  color: var(--z-jade);
  box-shadow: 0 12px 35px rgba(0,0,0,.24);
  backdrop-filter: blur(22px);
  cursor: pointer;
  font-size: 10px;
  font-weight: 800;
  animation: riseIn .22s var(--z-motion);
  transition: background .2s ease, transform .2s ease;
}.zuqen-jump-latest:hover {
  background: rgba(26,68,45,.92);
  transform: translate(-50%, -2px);
}.light .zuqen-jump-latest {
  background: rgba(249,255,250,.9);
  color: #176d45;
}

/* The message field is a suspended glass object with its own lighting. */
.zuqen-composer-area { position: relative; z-index: 15; flex: 0 0 auto; padding: 12px 24px 20px; background: linear-gradient(180deg, rgba(7,17,15,0), rgba(7,17,15,.54) 28%, rgba(7,17,15,.72)); }.light .zuqen-composer-area {
  background: linear-gradient(180deg, rgba(237,246,239,0), rgba(237,246,239,.68) 28%, rgba(237,246,239,.84));
}.zuqen-composer {
  width: min(920px, 100%);
  margin: 0 auto;
  padding: 12px 13px 9px;
  position: relative;
  border: 1px solid rgba(207,255,226,.17);
  border-radius: 24px;
  background: linear-gradient(135deg, rgba(20,45,34,.79), rgba(9,26,20,.75));
  box-shadow: 0 20px 70px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.055), 0 0 0 5px rgba(168,255,203,.018);
  backdrop-filter: blur(30px) saturate(145%);
  -webkit-backdrop-filter: blur(30px) saturate(145%);
  transition: border-color .25s ease, box-shadow .25s ease, transform .25s ease;
}.zuqen-composer:focus-within {
  border-color: rgba(168,255,203,.36);
  box-shadow: 0 24px 78px rgba(0,0,0,.27), inset 0 1px 0 rgba(255,255,255,.065), 0 0 0 5px rgba(168,255,203,.035);
}.light .zuqen-composer {
  background: linear-gradient(135deg, rgba(255,255,255,.88), rgba(242,251,244,.8));
  border-color: rgba(30,105,64,.16);
  box-shadow: 0 18px 55px rgba(28,78,47,.1), inset 0 1px 0 rgba(255,255,255,.85);
}.zuqen-composer-row {
  display: flex;
  align-items: flex-end;
  gap: 10px;
}.zuqen-attach-label {
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  display: grid;
  place-items: center;
  margin-bottom: 1px;
  border: 1px solid var(--border);
  border-radius: 12px;
  color: var(--muted);
  background: rgba(220,255,235,.04);
  cursor: pointer;
  transition: color .2s ease, background .2s ease, border-color .2s ease;
}.zuqen-attach-label:hover {
  color: var(--z-jade);
  background: rgba(168,255,203,.08);
  border-color: rgba(168,255,203,.25);
}.zuqen-attach-label input {
  display: none;
}.zuqen-composer-row textarea {
  min-width: 0;
  flex: 1;
  max-height: 220px;
  min-height: 39px;
  padding: 10px 2px 8px;
  resize: none;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text);
  font-size: 13px;
  line-height: 1.6;
  scrollbar-width: thin;
}.zuqen-composer-row textarea::placeholder {
  color: var(--muted-2);
}.zuqen-composer-row textarea:disabled {
  opacity: .65;
}.zuqen-send {
  width: 39px;
  height: 39px;
  flex: 0 0 39px;
  display: grid;
  place-items: center;
  margin-bottom: 1px;
  border: 1px solid rgba(168,255,203,.28);
  border-radius: 13px;
  background: linear-gradient(145deg, #c5ffda, #64df9a);
  color: #071b11;
  cursor: pointer;
  box-shadow: 0 6px 22px rgba(82,219,139,.16);
  transition: transform .2s ease, box-shadow .2s ease, filter .2s ease;
}.zuqen-send:hover:not(:disabled) {
  transform: translateY(-2px) rotate(-3deg);
  box-shadow: 0 10px 28px rgba(82,219,139,.25);
  filter: saturate(1.1);
}.zuqen-send:active:not(:disabled) {
  transform: scale(.95);
}.zuqen-send:disabled {
  color: rgba(8,32,23,.5);
  background: rgba(168,255,203,.25);
  border-color: transparent;
  box-shadow: none;
  cursor: not-allowed;
}.zuqen-composer-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 3px 0;
  color: var(--muted-2);
  font-size: 8px;
  letter-spacing: .15px;
}.zuqen-composer-footer span:last-child {
  white-space: nowrap;
}

/* Landing experience: editorial, asymmetric and cinematic. */
.zuqen-home { min-height: 0; flex: 1; overflow-y: auto; display: flex; flex-direction: column; align-items: center; padding: clamp(22px, 4vh, 42px) 24px 36px; scrollbar-width: thin; scrollbar-color: rgba(168,255,203,.14) transparent; }.zuqen-home-inner {
  width: min(980px, 100%);
  margin: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 0 20px;
}.zuqen-welcome {
  width: 100%;
  text-align: center;
  position: relative;
  animation: riseIn .7s var(--z-motion) both;
}.zuqen-welcome::before {
  content: "";
  width: 420px;
  height: 250px;
  position: absolute;
  top: -100px;
  left: 50%;
  transform: translateX(-50%);
  background: radial-gradient(ellipse, rgba(98,225,151,.12), transparent 70%);
  pointer-events: none;
  z-index: -1;
}.zuqen-welcome-mark {
  width: 86px;
  height: 86px;
  display: grid;
  place-items: center;
  position: relative;
  margin: 0 auto 24px;
  border: 1px solid rgba(168,255,203,.21);
  border-radius: 29px;
  background: linear-gradient(145deg, rgba(168,255,203,.15), rgba(168,255,203,.025));
  box-shadow: 0 16px 65px rgba(49,186,111,.11), inset 0 1px 0 rgba(255,255,255,.06);
  backdrop-filter: blur(18px);
}.zuqen-welcome-mark::before, .zuqen-welcome-mark::after {
  content: "";
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}.zuqen-welcome-mark::before {
  inset: -11px;
  border: 1px solid rgba(168,255,203,.1);
  animation: orbitSpin 18s linear infinite;
}.zuqen-welcome-mark::after {
  width: 8px;
  height: 8px;
  right: -12px;
  top: 11px;
  background: var(--z-gold);
  box-shadow: 0 0 17px rgba(255,210,139,.55);
}.zuqen-welcome-mark span {
  width: 39px;
  height: 39px;
  display: block;
  position: relative;
  border-radius: 50%;
  background: conic-gradient(from 15deg, #c5ffda, #6ce8a4 27%, #62b9a3 48%, #ffd28b 69%, #c5ffda);
  box-shadow: 0 0 35px rgba(105,231,159,.28);
  animation: logoBreath 4.8s ease-in-out infinite;
}.zuqen-welcome-mark span::before {
  content: "";
  position: absolute;
  inset: 8px;
  border-radius: 50%;
  background: #0b1b14;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.2);
}.zuqen-welcome-mark span::after {
  content: "";
  position: absolute;
  width: 9px;
  height: 9px;
  left: 15px;
  top: 15px;
  border-radius: 50%;
  background: #d7ffe4;
  box-shadow: 0 0 14px #8cffb9;
}.zuqen-welcome h1 {
  max-width: 800px;
  margin: 0 auto;
  color: var(--text);
  font-family: ui-serif, Georgia, Cambria, "Times New Roman", serif;
  font-size: clamp(43px, 6.2vw, 76px);
  font-weight: 500;
  letter-spacing: -3.8px;
  line-height: .99;
}.zuqen-welcome h1 .gradient-word {
  color: var(--z-jade);
  font-style: italic;
  font-weight: 500;
}.zuqen-welcome p {
  max-width: 490px;
  margin: 19px auto 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.9;
  letter-spacing: .05px;
}.zuqen-search-card {
  width: min(740px, 100%);
  min-height: 67px;
  margin: 34px auto 0;
  padding: 9px 11px 9px 17px;
  display: flex;
  align-items: center;
  gap: 13px;
  border: 1px solid rgba(207,255,226,.19);
  border-radius: 20px;
  background: linear-gradient(120deg, rgba(19,44,33,.79), rgba(9,25,19,.72));
  box-shadow: 0 20px 65px rgba(0,0,0,.17), inset 0 1px 0 rgba(255,255,255,.055);
  backdrop-filter: blur(28px);
  transition: border-color .25s ease, box-shadow .25s ease, transform .25s ease;
}.zuqen-search-card:focus-within {
  border-color: rgba(168,255,203,.4);
  box-shadow: 0 23px 72px rgba(0,0,0,.22), 0 0 0 5px rgba(168,255,203,.035);
  transform: translateY(-2px);
}.light .zuqen-search-card {
  background: linear-gradient(120deg, rgba(255,255,255,.9), rgba(239,249,242,.83));
}.zuqen-search-card-icon {
  width: 37px;
  height: 37px;
  flex: 0 0 37px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: rgba(168,255,203,.1);
  color: var(--z-jade);
}.zuqen-search-card input {
  width: 100%;
  min-width: 0;
  height: 45px;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text);
  font-size: 13px;
}.zuqen-search-card input::placeholder {
  color: var(--muted-2);
}.zuqen-search-shortcut {
  padding: 7px 9px;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--muted-2);
  background: rgba(220,255,235,.035);
  font-size: 9px;
}.zuqen-suggestion-grid {
  width: min(740px, 100%);
  display: grid;
  grid-template-columns: repeat(4, minmax(0,1fr));
  gap: 9px;
  margin: 12px auto 0;
}.zuqen-suggestion {
  min-height: 126px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 17px;
  background: rgba(220,255,235,.035);
  color: var(--text);
  text-align: left;
  cursor: pointer;
  backdrop-filter: blur(15px);
  transition: transform .25s var(--z-motion), background .25s ease, border-color .25s ease, box-shadow .25s ease;
}.zuqen-suggestion:hover {
  transform: translateY(-4px);
  background: rgba(220,255,235,.07);
  border-color: rgba(168,255,203,.23);
  box-shadow: 0 15px 36px rgba(0,0,0,.1);
}.zuqen-suggestion-icon {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  margin-bottom: 15px;
  border: 1px solid rgba(168,255,203,.15);
  border-radius: 11px;
  background: rgba(168,255,203,.07);
  color: var(--z-jade);
  font-size: 16px;
}.zuqen-suggestion:nth-child(2) .zuqen-suggestion-icon {
  color: var(--z-cyan);
  border-color: rgba(142,233,242,.16);
  background: rgba(142,233,242,.06);
}.zuqen-suggestion:nth-child(3) .zuqen-suggestion-icon {
  color: var(--z-gold);
  border-color: rgba(255,210,139,.17);
  background: rgba(255,210,139,.06);
}.zuqen-suggestion:nth-child(4) .zuqen-suggestion-icon {
  color: #d5b6ff;
  border-color: rgba(213,182,255,.17);
  background: rgba(213,182,255,.06);
}.zuqen-suggestion-title {
  font-size: 10px;
  font-weight: 790;
  letter-spacing: .05px;
}.zuqen-suggestion-text {
  margin-top: 6px;
  color: var(--muted-2);
  font-size: 9px;
  line-height: 1.6;
}.zuqen-agent-strip {
  width: min(740px, 100%);
  margin: 30px auto 0;
}.zuqen-strip-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  color: var(--muted-2);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 1.8px;
  text-transform: uppercase;
}.zuqen-strip-title::after {
  content: "";
  height: 1px;
  flex: 1;
  background: linear-gradient(90deg, var(--border), transparent);
}.zuqen-agent-cards {
  display: grid;
  grid-template-columns: repeat(4, minmax(0,1fr));
  gap: 9px;
}.zuqen-mini-agent {
  min-width: 0;
  min-height: 120px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 13px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: linear-gradient(145deg, rgba(220,255,235,.045), rgba(220,255,235,.015));
  color: var(--text);
  text-align: left;
  cursor: pointer;
  transition: transform .24s var(--z-motion), background .24s ease, border-color .24s ease;
}.zuqen-mini-agent:hover {
  transform: translateY(-3px);
  background: rgba(220,255,235,.075);
  border-color: var(--border-strong);
}.zuqen-mini-agent-icon {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  margin-bottom: 13px;
  border-radius: 10px;
  background: rgba(168,255,203,.09);
  color: var(--z-jade);
  font-size: 15px;
}.zuqen-mini-agent:nth-child(2) .zuqen-mini-agent-icon {
  color: var(--z-cyan);
  background: rgba(142,233,242,.08);
}.zuqen-mini-agent:nth-child(3) .zuqen-mini-agent-icon {
  color: var(--z-gold);
  background: rgba(255,210,139,.08);
}.zuqen-mini-agent:nth-child(4) .zuqen-mini-agent-icon {
  color: #d5b6ff;
  background: rgba(213,182,255,.08);
}.zuqen-mini-agent-name {
  font-size: 10px;
  font-weight: 780;
  line-height: 1.35;
}.zuqen-mini-agent-desc {
  margin-top: 5px;
  color: var(--muted-2);
  font-size: 8px;
  line-height: 1.55;
}.zuqen-mobile-overlay {
  display: none;
}

/* Motion is quiet by design: a little life, never distraction. */
@keyframes auroraDrift {0% {
  transform: translate3d(0,0,0) scale(1);
}100% {
  transform: translate3d(-5vw,4vh,0) scale(1.12);
} }
@keyframes logoBreath {0%,100% {
  filter: saturate(1);
  transform: scale(1);
}50% {
  filter: saturate(1.16);
  transform: scale(1.035);
} }
@keyframes orbitSpin {from {
  transform: rotate(0deg);
}to {
  transform: rotate(360deg);
} }
@keyframes typingPulse {0%,60%,100% {
  transform: translateY(0);
  opacity: .45;
}30% {
  transform: translateY(-4px);
  opacity: 1;
} }
@keyframes popIn {from {
  opacity: 0;
  transform: translateY(-5px) scale(.985);
}to {
  opacity: 1;
  transform: translateY(0) scale(1);
} }
@keyframes riseIn {from {
  opacity: 0;
  transform: translateY(12px);
}to {
  opacity: 1;
  transform: translateY(0);
} }
@keyframes messageIn {from {
  opacity: 0;
  transform: translateY(7px);
}to {
  opacity: 1;
  transform: translateY(0);
} }
@media (prefers-reduced-motion: reduce) {*, *::before, *::after {
  animation-duration: .01ms !important;
  animation-iteration-count: 1 !important;
  scroll-behavior: auto !important;
  transition-duration: .01ms !important;
}
}

/* Large desktop composition. */
@media (min-width: 1500px) {.zuqen-sidebar {
  width: 310px;
  flex-basis: 310px;
}.zuqen-topbar {
  padding-left: 34px;
  padding-right: 34px;
}.zuqen-messages {
  padding-top: 38px;
}.zuqen-message-list {
  width: min(980px, 100%);
}.zuqen-home-inner {
  width: min(1080px, 100%);
}.zuqen-search-card, .zuqen-suggestion-grid, .zuqen-agent-strip {
  width: min(790px, 100%);
}.zuqen-welcome h1 {
  font-size: clamp(72px, 5.2vw, 90px);
}
}
@media (max-width: 1180px) {.zuqen-sidebar {
  width: 265px;
  flex-basis: 265px;
}.zuqen-topbar {
  padding-left: 17px;
  padding-right: 17px;
}.zuqen-top-action {
  padding: 0 9px;
  gap: 6px;
}.zuqen-top-action .action-label {
  font-size: 9px;
}.zuqen-credit-label {
  display: none;
}.zuqen-suggestion-grid, .zuqen-agent-cards {
  gap: 7px;
}.zuqen-suggestion, .zuqen-mini-agent {
  padding: 11px;
}
}
@media (max-width: 900px) {.zuqen-sidebar {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: min(310px, 86vw);
  flex-basis: auto;
  transform: translateX(0);
  box-shadow: 20px 0 80px rgba(0,0,0,.28);
}.zuqen-sidebar.closed {
  width: min(310px, 86vw);
  transform: translateX(-105%);
}.zuqen-mobile-overlay {
  display: block;
  position: fixed;
  inset: 0;
  z-index: 35;
  background: rgba(0,0,0,.38);
  backdrop-filter: blur(5px);
}.zuqen-main {
  width: 100%;
}.zuqen-topbar {
  min-height: 69px;
  padding: 11px 14px;
}.zuqen-top-right {
  gap: 6px;
}.zuqen-top-action {
  min-height: 37px;
  padding: 0 9px;
}.zuqen-top-action .action-label {
  display: none;
}.zuqen-top-action .action-symbol {
  font-size: 16px;
}.zuqen-messages {
  padding: 23px 20px 25px;
}.zuqen-composer-area {
  padding: 10px 18px 16px;
}.zuqen-message-block {
  max-width: 86%;
}.zuqen-message-row.assistant .zuqen-message-block {
  max-width: 100%;
}.zuqen-welcome h1 {
  font-size: clamp(48px, 7vw, 68px);
}
}
@media (max-width: 640px) {.zuqen-topbar {
  gap: 7px;
  padding: 9px 10px;
  min-height: 63px;
}.zuqen-top-left, .zuqen-top-right {
  gap: 5px;
}.zuqen-icon-button {
  width: 35px;
  height: 35px;
  flex-basis: 35px;
  border-radius: 11px;
}.zuqen-agent-button {
  min-height: 37px;
  gap: 6px;
  padding: 3px 7px;
  border-radius: 11px;
}.zuqen-agent-button-icon {
  width: 27px;
  height: 27px;
}.zuqen-agent-button-name {
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 10px;
}.zuqen-agent-button-sub, .zuqen-agent-button > svg {
  display: none;
}.zuqen-credit-button {
  min-height: 35px;
  padding: 0 8px;
  gap: 5px;
}.zuqen-credit-count {
  font-size: 10px;
}.zuqen-credit-icon {
  font-size: 13px;
}.zuqen-top-action {
  width: 35px;
  min-height: 35px;
  padding: 0;
  border-radius: 11px;
}.zuqen-top-action .action-label {
  display: none;
}.zuqen-top-action .action-symbol {
  font-size: 15px;
}.zuqen-home {
  padding: 22px 14px 25px;
}.zuqen-home-inner {
  padding-top: 8px;
}.zuqen-welcome-mark {
  width: 69px;
  height: 69px;
  margin-bottom: 22px;
  border-radius: 24px;
}.zuqen-welcome-mark span {
  width: 33px;
  height: 33px;
}.zuqen-welcome-mark span::before {
  inset: 7px;
}.zuqen-welcome-mark span::after {
  left: 12px;
  top: 12px;
}.zuqen-welcome h1 {
  font-size: clamp(41px, 11vw, 57px);
  letter-spacing: -2.6px;
  line-height: 1.02;
}.zuqen-welcome p {
  max-width: 340px;
  margin-top: 14px;
  font-size: 11px;
}.zuqen-search-card {
  min-height: 59px;
  margin-top: 25px;
  padding: 7px 8px 7px 11px;
  gap: 8px;
  border-radius: 17px;
}.zuqen-search-card-icon {
  width: 31px;
  height: 31px;
  flex-basis: 31px;
}.zuqen-search-card input {
  height: 40px;
  font-size: 12px;
}.zuqen-search-shortcut {
  display: none;
}.zuqen-suggestion-grid {
  grid-template-columns: repeat(2, minmax(0,1fr));
  gap: 8px;
  margin-top: 9px;
}.zuqen-suggestion {
  min-height: 112px;
  padding: 12px;
  border-radius: 15px;
}.zuqen-suggestion-icon {
  margin-bottom: 11px;
}.zuqen-suggestion-title {
  font-size: 10px;
}.zuqen-suggestion-text {
  font-size: 8px;
}.zuqen-agent-strip {
  margin-top: 24px;
}.zuqen-agent-cards {
  grid-template-columns: repeat(2, minmax(0,1fr));
  gap: 8px;
}.zuqen-mini-agent {
  min-height: 105px;
  padding: 11px;
}.zuqen-mini-agent-icon {
  margin-bottom: 9px;
}.zuqen-strip-title {
  font-size: 8px;
}.zuqen-messages {
  padding: 19px 13px 21px;
}.zuqen-message-list {
  gap: 22px;
}.zuqen-message-block {
  max-width: 92%;
}.zuqen-message-row.assistant .zuqen-message-block {
  max-width: 100%;
}.zuqen-message-bubble {
  font-size: 12px;
  line-height: 1.8;
}.user .zuqen-message-bubble {
  padding: 11px 13px;
  border-radius: 17px 17px 6px 17px;
}.zuqen-message-label {
  margin-bottom: 7px;
  font-size: 8px;
}.zuqen-composer-area {
  padding: 8px 10px 12px;
}.zuqen-composer {
  padding: 9px 9px 7px;
  border-radius: 19px;
}.zuqen-composer-row {
  gap: 7px;
}.zuqen-attach-label {
  width: 34px;
  height: 34px;
  flex-basis: 34px;
  border-radius: 11px;
}.zuqen-composer-row textarea {
  min-height: 35px;
  padding-top: 8px;
  font-size: 12px;
}.zuqen-send {
  width: 35px;
  height: 35px;
  flex-basis: 35px;
  border-radius: 11px;
}.zuqen-composer-footer {
  padding-top: 7px;
  font-size: 7px;
}.zuqen-composer-footer span:first-child {
  display: none;
}.zuqen-composer-footer span:last-child {
  margin-left: auto;
}.zuqen-jump-latest {
  bottom: 125px;
  min-height: 35px;
  font-size: 9px;
}.zuqen-error {
  width: calc(100% - 20px);
  padding: 10px 12px;
  font-size: 10px;
}
}
@media (max-width: 390px) {.zuqen-agent-button {
  max-width: 128px;
}.zuqen-agent-button-name {
  max-width: 78px;
}.zuqen-credit-button {
  padding: 0 6px;
}.zuqen-credit-count {
  display: none;
}.zuqen-top-action {
  width: 32px;
  min-height: 34px;
}.zuqen-topbar {
  padding-left: 7px;
  padding-right: 7px;
}.zuqen-welcome h1 {
  font-size: 39px;
  letter-spacing: -2px;
}.zuqen-suggestion {
  padding: 10px;
}.zuqen-message-block {
  max-width: 96%;
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
              Ideas into momentum
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

          <div className="zuqen-quick-links" aria-label="Workspace shortcuts">
            <button
              className="zuqen-quick-link"
              onClick={() => { window.location.href = "/automation"; }}
              title="Open independent Automation Mode"
            >
              <span className="quick-icon"><Icon name="spark" size={15} /></span>
              <span className="quick-copy">
                <span className="quick-title">Automation Mode</span>
                <span className="quick-subtitle">Build and run workflows</span>
              </span>
              <span className="quick-tag">BETA</span>
            </button>
            <button
              className="zuqen-quick-link"
              onClick={() => { window.location.href = "/marketplace"; }}
              title="Browse and sell templates"
            >
              <span className="quick-icon" aria-hidden="true">▦</span>
              <span className="quick-copy">
                <span className="quick-title">Buy / Sell Templates</span>
                <span className="quick-subtitle">Discover or sell templates</span>
              </span>
              <span className="quick-tag">SHOP</span>
            </button>
          </div>

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
            <button
              className="zuqen-top-action automation-action"
              onClick={() => { window.location.href = "/automation"; }}
              title="Open Automation Mode"
            >
              <span className="action-symbol">✳</span>
              <span className="action-label">Automation Mode</span>
            </button>
            <button
              className="zuqen-top-action templates-action"
              onClick={() => { window.location.href = "/marketplace"; }}
              title="Open Template Marketplace"
            >
              <span className="action-symbol">◈</span>
              <span className="action-label">Buy / Sell Templates</span>
            </button>
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
              <div
                className="zuqen-messages"
                ref={messagesContainerRef}
                onScroll={handleMessagesScroll}
              >
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
                <button
                  type="button"
                  className="zuqen-jump-latest"
                  onClick={jumpToLatest}
                  aria-label="Jump to latest message"
                >
                  <span aria-hidden="true">↓</span>
                  Jump to latest
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
                      placeholder="Write your next thought…"
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
                    Make room for
                    <br />
                    <span className="gradient-word">what&apos;s next.</span>
                  </h1>

                  <p>
                    One calm space for ambitious ideas, useful answers and work that moves forward.
                    Bring a question, a rough draft or your next big build.
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
                    placeholder="Describe what you want to make happen…"
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