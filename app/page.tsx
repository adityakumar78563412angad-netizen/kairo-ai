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
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
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
    shouldAutoScrollRef.current = true;
    setShowJumpToLatest(false);
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
    if (!shouldAutoScrollRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, loading, activeChatId]);

  const handleMessagesScroll = () => {
    const element = messagesContainerRef.current;
    if (!element) return;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    const atBottom = distanceFromBottom < 140;
    shouldAutoScrollRef.current = atBottom;
    setShowJumpToLatest(!atBottom && messages.length > 0);
  };

  const jumpToLatest = () => {
    shouldAutoScrollRef.current = true;
    setShowJumpToLatest(false);
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
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
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box}
        html,body{margin:0;padding:0;min-height:100%;background:#101713}
        button,input,textarea{font:inherit}button{border:0}
        .zuqen-app{
          --bg:#101713;--panel:rgba(25,35,29,.88);--panel-2:rgba(33,45,37,.92);--panel-3:rgba(44,58,47,.88);
          --border:rgba(229,241,220,.105);--border-strong:rgba(229,241,220,.18);--text:#f1f4ec;--muted:#a1aea1;--muted-2:#748276;
          --accent:#d4f36a;--accent-text:#182017;--danger:#ff8c82;--shadow:0 24px 80px rgba(0,0,0,.32);
          min-height:100dvh;height:100dvh;display:flex;color:var(--text);overflow:hidden;font-family:'DM Sans',sans-serif;
          background:radial-gradient(ellipse at 72% -12%,rgba(118,155,85,.18),transparent 38%),radial-gradient(ellipse at 10% 100%,rgba(54,111,83,.13),transparent 40%),#101713;
        }
        .zuqen-app.light{--bg:#edf0e8;--panel:rgba(255,255,251,.88);--panel-2:rgba(247,249,241,.96);--panel-3:#e8ede0;--border:rgba(27,48,31,.11);--border-strong:rgba(27,48,31,.18);--text:#17231a;--muted:#657568;--muted-2:#849187;--accent:#315e3b;--accent-text:#f8fff3;--shadow:0 24px 80px rgba(33,49,34,.12);background:radial-gradient(ellipse at 80% 0%,rgba(194,220,158,.3),transparent 38%),#edf0e8}
        .zuqen-sidebar{width:278px;flex:0 0 278px;height:100dvh;display:flex;flex-direction:column;background:rgba(14,21,17,.84);border-right:1px solid var(--border);backdrop-filter:blur(26px);transition:width .25s ease,flex-basis .25s ease;z-index:30;overflow:hidden}
        .light .zuqen-sidebar{background:rgba(248,250,244,.88)}.zuqen-sidebar.closed{width:0;flex-basis:0;border:0}
        .zuqen-brand{height:88px;min-height:88px;display:flex;align-items:center;padding:0 22px;gap:13px;border-bottom:1px solid var(--border)}
        .zuqen-logo{width:42px;height:42px;border-radius:15px;display:grid;place-items:center;background:linear-gradient(145deg,#e3ff91,#a9d747 58%,#6c9b3f);box-shadow:0 8px 30px rgba(176,220,87,.17);position:relative;overflow:hidden}
        .zuqen-logo:before{content:"";width:19px;height:19px;border:2px solid #1d2b17;border-radius:50%;position:absolute}.zuqen-logo:after{content:"";width:7px;height:7px;border-radius:50%;background:#1d2b17;position:absolute}
        .zuqen-brand-name{font-family:Manrope,sans-serif;font-size:15px;font-weight:800;letter-spacing:1.6px}.zuqen-brand-sub{margin-top:4px;color:var(--muted-2);font-size:10px;letter-spacing:.35px}
        .zuqen-sidebar-content{flex:1;min-height:0;overflow-y:auto;padding:18px 13px 14px;display:flex;flex-direction:column;gap:22px}
        .zuqen-new-chat{width:100%;height:47px;padding:0 15px;display:flex;align-items:center;gap:11px;border-radius:13px;background:var(--accent);color:var(--accent-text);font-size:12px;font-weight:800;cursor:pointer;box-shadow:0 8px 24px rgba(151,197,77,.1);transition:transform .18s,filter .18s}
        .zuqen-new-chat:hover{transform:translateY(-1px);filter:brightness(1.05)}
        .zuqen-sidebar-section{min-height:0}.zuqen-sidebar-heading{height:32px;display:flex;align-items:center;justify-content:space-between;padding:0 9px;color:var(--muted-2);font-size:9px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase}
        .zuqen-sidebar-heading button{width:27px;height:27px;border-radius:8px;display:grid;place-items:center;color:var(--muted);background:transparent;cursor:pointer}.zuqen-sidebar-heading button:hover{background:var(--panel-3);color:var(--text)}
        .zuqen-chat-list{display:flex;flex-direction:column;gap:4px;margin-top:5px}.zuqen-chat-item{position:relative;display:flex;align-items:center;min-height:43px;padding:0 9px 0 12px;border:1px solid transparent;border-radius:11px;cursor:pointer;color:var(--muted);transition:.18s}
        .zuqen-chat-item:hover{background:rgba(255,255,255,.035);color:var(--text)}.zuqen-chat-item.active{background:rgba(196,235,121,.095);border-color:rgba(196,235,121,.16);color:var(--text)}.zuqen-chat-item.active:before{content:"";position:absolute;left:0;top:11px;bottom:11px;width:3px;border-radius:0 4px 4px 0;background:var(--accent)}
        .zuqen-chat-main{min-width:0;flex:1}.zuqen-chat-title{font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.zuqen-chat-date{font-size:9px;color:var(--muted-2);margin-top:4px}.zuqen-chat-menu-button{opacity:0;color:var(--muted);background:transparent;cursor:pointer}.zuqen-chat-item:hover .zuqen-chat-menu-button,.zuqen-chat-item.active .zuqen-chat-menu-button{opacity:1}
        .zuqen-chat-menu,.zuqen-agent-dropdown,.zuqen-credit-dropdown{background:#1b261e;border:1px solid var(--border-strong);border-radius:14px;box-shadow:var(--shadow);backdrop-filter:blur(24px);z-index:80}.light .zuqen-chat-menu,.light .zuqen-agent-dropdown,.light .zuqen-credit-dropdown{background:#fff}
        .zuqen-chat-menu{position:absolute;right:8px;top:34px;width:155px;padding:5px}.zuqen-chat-menu button{width:100%;display:flex;align-items:center;gap:8px;padding:9px;border-radius:8px;text-align:left;background:transparent;color:var(--text);font-size:11px;cursor:pointer}.zuqen-chat-menu button:hover{background:var(--panel-3)}
        .zuqen-rename{width:100%;min-width:0;padding:5px;border:1px solid var(--accent);border-radius:6px;background:var(--panel-2);color:var(--text);outline:0;font-size:11px}
        .zuqen-sidebar-bottom{padding:14px;border-top:1px solid var(--border)}.zuqen-sidebar-user{display:flex;align-items:center;gap:10px;padding:10px;border:1px solid var(--border);background:rgba(255,255,255,.025);border-radius:13px}
        .zuqen-user-avatar{width:34px;height:34px;display:grid;place-items:center;flex:0 0 34px;border-radius:11px;background:var(--panel-3);color:var(--accent);font-weight:800;font-size:12px}.zuqen-user-info{flex:1;min-width:0}.zuqen-user-name{font-size:11px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.zuqen-user-status{margin-top:3px;color:var(--muted-2);font-size:9px}.zuqen-signout{background:transparent;color:var(--muted);cursor:pointer}
        .zuqen-sidebar-link{width:100%;min-height:40px;display:flex;align-items:center;gap:10px;padding:0 11px;border-radius:10px;color:var(--muted);background:transparent;text-align:left;font-size:11px;cursor:pointer}.zuqen-sidebar-link:hover{background:var(--panel-3);color:var(--text)}
        .zuqen-main{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;position:relative}.zuqen-topbar{height:74px;min-height:74px;padding:0 27px;display:flex;align-items:center;justify-content:space-between;gap:14px;border-bottom:1px solid var(--border);background:rgba(17,25,19,.28);backdrop-filter:blur(18px);z-index:20}.light .zuqen-topbar{background:rgba(255,255,255,.32)}
        .zuqen-top-left,.zuqen-top-right{display:flex;align-items:center;gap:11px;min-width:0}.zuqen-icon-button{width:38px;height:38px;display:grid;place-items:center;border:1px solid var(--border);border-radius:12px;background:rgba(255,255,255,.035);color:var(--muted);cursor:pointer;transition:.18s}.zuqen-icon-button:hover{color:var(--text);border-color:var(--border-strong);background:var(--panel-3)}
        .zuqen-agent-selector,.zuqen-credit-wrap{position:relative}.zuqen-agent-button{display:flex;align-items:center;gap:10px;padding:7px 12px;border:1px solid var(--border);border-radius:13px;background:rgba(255,255,255,.025);color:var(--text);cursor:pointer;text-align:left}.zuqen-agent-button-icon{width:31px;height:31px;display:grid;place-items:center;border-radius:10px;background:rgba(204,240,117,.12);color:var(--accent);font-size:17px}.zuqen-agent-button-text{min-width:0}.zuqen-agent-button-name{font-size:11px;font-weight:800}.zuqen-agent-button-sub{margin-top:3px;color:var(--muted-2);font-size:9px}.zuqen-agent-dropdown{position:absolute;top:48px;left:0;width:275px;padding:7px}.zuqen-agent-option{width:100%;display:flex;align-items:center;gap:10px;padding:11px;border-radius:10px;background:transparent;color:var(--text);text-align:left;cursor:pointer}.zuqen-agent-option:hover,.zuqen-agent-option.selected{background:var(--panel-3)}.zuqen-agent-option-icon{width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:rgba(196,235,121,.1);color:var(--accent)}.zuqen-agent-option-content{flex:1}.zuqen-agent-option-name{font-size:11px;font-weight:700}.zuqen-agent-option-description{font-size:10px;color:var(--muted);margin-top:4px}.zuqen-agent-check{color:var(--accent)}
        .zuqen-credit-button{display:flex;align-items:center;gap:8px;padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:rgba(255,255,255,.025);color:var(--text);cursor:pointer}.zuqen-credit-icon{color:var(--accent)}.zuqen-credit-count{font-weight:800;font-size:12px}.zuqen-credit-label{font-size:10px;color:var(--muted)}.zuqen-credit-dropdown{position:absolute;right:0;top:48px;width:255px;padding:16px}.zuqen-credit-dropdown-title{font-size:11px;font-weight:800}.zuqen-credit-big{margin-top:8px;font:800 30px Manrope,sans-serif;letter-spacing:-1px}.zuqen-credit-small{margin-top:4px;color:var(--muted);font-size:10px}.zuqen-credit-line{height:1px;background:var(--border);margin:14px 0}.zuqen-credit-row{display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-top:8px}.zuqen-credit-row strong{color:var(--text)}
        .zuqen-search-overlay{position:absolute;top:64px;left:24px;right:24px;max-width:560px;margin-left:0;padding:10px;border:1px solid var(--border-strong);border-radius:14px;background:var(--panel);backdrop-filter:blur(24px);box-shadow:var(--shadow);z-index:50}.zuqen-search-input-wrap{display:flex;align-items:center;gap:10px;padding:5px 8px;color:var(--muted)}.zuqen-search-input-wrap input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:var(--text);font-size:12px}
        .zuqen-content{flex:1;min-height:0;display:flex;flex-direction:column;position:relative}.zuqen-home{flex:1;overflow-y:auto;padding:clamp(34px,7vh,82px) 30px 45px}.zuqen-home-inner{width:min(1040px,100%);margin:0 auto}.zuqen-welcome{text-align:left;max-width:850px;margin:0 auto;position:relative;padding:0 0 20px 4px}.zuqen-welcome:before{content:'YOUR CREATIVE INTELLIGENCE WORKSPACE';display:block;margin-bottom:22px;color:var(--accent);font-size:9px;font-weight:800;letter-spacing:2.7px}.zuqen-welcome-mark{width:48px;height:48px;margin:0 0 22px;display:none;place-items:center;border-radius:16px;color:var(--accent-text);background:var(--accent);box-shadow:0 12px 32px rgba(174,218,92,.15);position:relative}.zuqen-welcome h1{max-width:800px;margin:0;font:500 clamp(38px,5.7vw,70px)/1.02 Manrope,sans-serif;letter-spacing:-3.8px;color:var(--text)}.zuqen-welcome h1 em{color:var(--accent);font-style:normal}.zuqen-welcome p{margin:18px 0 0;max-width:560px;color:var(--muted);font-size:13px;line-height:1.85}
        .zuqen-search-card{margin:34px auto 0;width:min(850px,100%);min-height:84px;padding:15px 16px;display:flex;align-items:center;gap:13px;border:1px solid rgba(214,237,187,.18);border-radius:18px;background:linear-gradient(115deg,rgba(34,48,37,.92),rgba(23,33,27,.85));box-shadow:0 20px 60px rgba(0,0,0,.16),inset 0 1px rgba(255,255,255,.04);backdrop-filter:blur(22px)}.light .zuqen-search-card{background:rgba(255,255,255,.78)}.zuqen-search-card-icon{width:43px;height:43px;flex:0 0 43px;display:grid;place-items:center;border-radius:13px;background:rgba(202,238,121,.12);color:var(--accent)}.zuqen-search-card input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:var(--text);font-size:14px}.zuqen-search-card input::placeholder{color:var(--muted-2)}.zuqen-search-shortcut{padding:6px 9px;border:1px solid var(--border);border-radius:8px;color:var(--muted-2);font-size:9px}
        .zuqen-suggestion-grid{margin:16px auto 0;width:min(850px,100%);display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.zuqen-suggestion{position:relative;min-height:130px;padding:18px;text-align:left;border:1px solid var(--border);border-radius:15px;background:linear-gradient(145deg,rgba(37,50,40,.68),rgba(22,32,26,.55));color:var(--text);cursor:pointer;overflow:hidden;transition:transform .2s,border-color .2s,background .2s}.light .zuqen-suggestion{background:rgba(255,255,255,.65)}.zuqen-suggestion:before{content:"";position:absolute;left:18px;right:18px;top:0;height:2px;background:var(--card-accent,var(--accent));opacity:.8}.zuqen-suggestion:nth-child(2){--card-accent:#8bc9df}.zuqen-suggestion:nth-child(3){--card-accent:#d7b4ff}.zuqen-suggestion:nth-child(4){--card-accent:#f2b58e}.zuqen-suggestion:hover{transform:translateY(-3px);border-color:var(--border-strong);background:var(--panel-2)}.zuqen-suggestion-icon{color:var(--card-accent,var(--accent));font-size:17px}.zuqen-suggestion-title{margin-top:18px;font-size:12px;font-weight:800}.zuqen-suggestion-text{margin-top:7px;color:var(--muted);font-size:10px;line-height:1.6}
        .zuqen-agent-strip{width:min(850px,100%);margin:34px auto 0}.zuqen-strip-title{color:var(--muted-2);text-transform:uppercase;letter-spacing:1.8px;font-size:9px;font-weight:800}.zuqen-agent-cards{margin-top:13px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.zuqen-mini-agent{display:flex;align-items:center;gap:11px;min-width:0;padding:13px;border:1px solid var(--border);background:rgba(255,255,255,.025);border-radius:13px;cursor:pointer;color:var(--text);text-align:left;transition:.2s}.zuqen-mini-agent:hover{background:var(--panel-2);border-color:var(--border-strong);transform:translateY(-2px)}.zuqen-mini-agent-icon{width:34px;height:34px;flex:0 0 34px;display:grid;place-items:center;border-radius:11px;background:var(--panel-3);color:var(--accent);font-size:14px}.zuqen-mini-agent-name{font-size:10px;font-weight:800;line-height:1.4}.zuqen-mini-agent-desc{color:var(--muted-2);font-size:9px;margin-top:4px;line-height:1.4}
        .zuqen-chat-view{flex:1;min-height:0;display:flex;flex-direction:column;position:relative}.zuqen-messages{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:34px 28px 28px;scroll-behavior:smooth}.zuqen-message-list{width:min(880px,100%);margin:0 auto}.zuqen-message-row{display:flex;margin-bottom:30px;animation:message-in .24s ease both}.zuqen-message-row.user{justify-content:flex-end}.zuqen-message-row.assistant{justify-content:flex-start}.zuqen-message-block{width:fit-content;max-width:min(790px,92%);min-width:0}.zuqen-message-row.assistant .zuqen-message-block{width:min(790px,100%);max-width:100%}.zuqen-message-label{display:flex;align-items:center;gap:8px;margin:0 0 9px 2px;color:var(--muted-2);font-size:9px;font-weight:800;letter-spacing:1.3px;text-transform:uppercase}.zuqen-message-label-mark{width:20px;height:20px;display:grid;place-items:center;border-radius:7px;background:rgba(202,238,121,.14);color:var(--accent)}.zuqen-message-row.user .zuqen-message-label{justify-content:flex-end;margin-right:3px}.zuqen-message-bubble{max-width:100%;padding:16px 19px;border-radius:17px;font-size:13px;line-height:1.8;white-space:pre-wrap;overflow-wrap:anywhere;word-break:normal}.zuqen-message-row.user .zuqen-message-bubble{background:linear-gradient(140deg,#d6f184,#b7dc66);color:#1a2816;border:1px solid rgba(234,255,185,.35);border-bottom-right-radius:5px;box-shadow:0 10px 28px rgba(151,194,80,.08)}.zuqen-message-row.assistant .zuqen-message-bubble{background:rgba(255,255,255,.035);border:1px solid var(--border);border-bottom-left-radius:5px;color:var(--text)}.light .zuqen-message-row.assistant .zuqen-message-bubble{background:rgba(255,255,255,.7)}.zuqen-message-actions{display:flex;gap:5px;margin-top:8px;opacity:.68}.zuqen-message-row.user .zuqen-message-actions{justify-content:flex-end}.zuqen-action{width:29px;height:29px;display:grid;place-items:center;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--muted);cursor:pointer}.zuqen-action:hover{border-color:var(--border);background:var(--panel-3);color:var(--text)}.zuqen-typing{display:flex;align-items:center;gap:5px;padding:5px 0}.zuqen-typing span{width:6px;height:6px;border-radius:50%;background:var(--accent);animation:typing 1s infinite ease-in-out}.zuqen-typing span:nth-child(2){animation-delay:.15s}.zuqen-typing span:nth-child(3){animation-delay:.3s}.zuqen-attachment-list{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}.zuqen-attachment-chip{display:flex;align-items:center;gap:8px;max-width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:10px;background:var(--panel-2);color:var(--muted);font-size:10px}.zuqen-attachment-chip-name{max-width:210px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text)}.zuqen-attachment-remove{display:grid;place-items:center;background:transparent;color:var(--muted);cursor:pointer}.zuqen-edit-area{padding:12px;border:1px solid var(--border-strong);border-radius:14px;background:var(--panel)}.zuqen-edit-area textarea{width:100%;resize:vertical;min-height:110px;border:0;outline:0;background:transparent;color:var(--text);font-size:13px;line-height:1.7}.zuqen-edit-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:9px}.zuqen-small-button{padding:8px 11px;border-radius:8px;background:var(--panel-3);color:var(--text);font-size:10px;cursor:pointer}.zuqen-small-button.primary{background:var(--accent);color:var(--accent-text);font-weight:800}
        .zuqen-composer-area{position:relative;padding:12px 25px 19px;background:linear-gradient(0deg,var(--bg) 65%,transparent)}.zuqen-composer{width:min(880px,100%);margin:0 auto;padding:10px 11px 9px;border:1px solid rgba(212,243,106,.23);border-radius:19px;background:rgba(27,39,30,.93);box-shadow:0 18px 60px rgba(0,0,0,.18),inset 0 1px rgba(255,255,255,.04);backdrop-filter:blur(25px)}.light .zuqen-composer{background:rgba(255,255,255,.92)}.zuqen-composer-row{display:flex;align-items:flex-end;gap:10px}.zuqen-attach-label{width:39px;height:39px;flex:0 0 39px;display:grid;place-items:center;border-radius:12px;background:var(--panel-3);color:var(--muted);cursor:pointer}.zuqen-attach-label:hover{color:var(--accent)}.zuqen-attach-label input{display:none}.zuqen-composer textarea{flex:1;min-width:0;max-height:220px;min-height:39px;padding:10px 2px 7px;resize:none;border:0;outline:0;background:transparent;color:var(--text);font-size:13px;line-height:1.6}.zuqen-composer textarea::placeholder{color:var(--muted-2)}.zuqen-send{width:39px;height:39px;flex:0 0 39px;display:grid;place-items:center;border-radius:12px;background:var(--accent);color:var(--accent-text);cursor:pointer;transition:.18s}.zuqen-send:hover:not(:disabled){transform:translateY(-1px);filter:brightness(1.06)}.zuqen-send:disabled{opacity:.35;cursor:not-allowed}.zuqen-composer-footer{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 4px 0;color:var(--muted-2);font-size:9px}.zuqen-jump-latest{position:absolute;z-index:12;left:50%;bottom:112px;transform:translateX(-50%);display:flex;align-items:center;gap:8px;padding:10px 14px;border:1px solid var(--border-strong);border-radius:999px;background:rgba(35,49,38,.96);color:var(--text);box-shadow:0 10px 30px rgba(0,0,0,.2);backdrop-filter:blur(18px);font-size:10px;font-weight:700;cursor:pointer;animation:message-in .18s ease}.light .zuqen-jump-latest{background:rgba(255,255,255,.95)}
        .zuqen-error{display:flex;align-items:center;gap:10px;margin:12px 22px;padding:12px 14px;border:1px solid rgba(255,140,130,.28);border-radius:12px;background:rgba(255,100,90,.08);color:var(--danger);font-size:11px}.zuqen-empty-chat{flex:1;min-height:260px;display:flex;align-items:center;justify-content:center;padding:30px}.zuqen-empty-chat-inner{text-align:center;max-width:360px}.zuqen-empty-chat-icon{width:52px;height:52px;margin:0 auto 17px;display:grid;place-items:center;border:1px solid var(--border);border-radius:17px;background:var(--panel-2);color:var(--accent)}.zuqen-empty-chat h2{margin:0;font:700 19px Manrope,sans-serif;letter-spacing:-.5px}.zuqen-empty-chat p{margin:10px 0 0;color:var(--muted);font-size:12px;line-height:1.7}
        .zuqen-mobile-overlay{display:none}.zuqen-app ::-webkit-scrollbar{width:7px;height:7px}.zuqen-app ::-webkit-scrollbar-thumb{border:2px solid transparent;border-radius:10px;background:rgba(151,175,146,.25);background-clip:padding-box}.zuqen-app ::-webkit-scrollbar-thumb:hover{background:rgba(151,175,146,.42);background-clip:padding-box}
        @keyframes typing{0%,60%,100%{transform:translateY(0);opacity:.45}30%{transform:translateY(-4px);opacity:1}}@keyframes message-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @media(max-width:1100px){.zuqen-suggestion-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.zuqen-agent-cards{grid-template-columns:repeat(2,minmax(0,1fr))}.zuqen-welcome h1{letter-spacing:-2.7px}.zuqen-topbar{padding:0 18px}}
        @media(max-width:760px){.zuqen-mobile-overlay{display:block}.zuqen-sidebar{position:fixed;left:0;top:0;bottom:0;height:100dvh;width:min(300px,86vw);flex-basis:min(300px,86vw);box-shadow:var(--shadow)}.zuqen-sidebar.closed{width:0;flex-basis:0;box-shadow:none}.zuqen-mobile-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(3px);z-index:25}.zuqen-topbar{height:64px;min-height:64px;padding:0 12px}.zuqen-top-left,.zuqen-top-right{gap:7px}.zuqen-agent-button{padding:6px 8px;gap:7px}.zuqen-agent-button-icon{width:28px;height:28px}.zuqen-agent-button-sub,.zuqen-credit-label{display:none}.zuqen-credit-button{padding:9px}.zuqen-home{padding:44px 17px 30px}.zuqen-welcome h1{font-size:clamp(38px,10vw,58px);letter-spacing:-2.5px}.zuqen-welcome p{font-size:12px}.zuqen-search-card{margin-top:26px;min-height:72px;padding:10px;gap:9px}.zuqen-search-card input{font-size:12px}.zuqen-suggestion-grid{gap:8px}.zuqen-suggestion{min-height:118px;padding:14px}.zuqen-suggestion-title{font-size:11px}.zuqen-suggestion-text{font-size:9px}.zuqen-agent-cards{gap:8px}.zuqen-mini-agent{padding:10px;gap:8px}.zuqen-mini-agent-desc{font-size:8px}.zuqen-messages{padding:22px 13px 22px}.zuqen-message-block{max-width:96%}.zuqen-message-row.assistant .zuqen-message-block{width:100%}.zuqen-message-bubble{padding:13px 14px;font-size:12px}.zuqen-composer-area{padding:8px 10px 12px}.zuqen-composer{border-radius:16px}.zuqen-composer-footer{font-size:8px}.zuqen-jump-latest{bottom:105px}.zuqen-search-overlay{left:10px;right:10px;top:58px}}
        @media(max-width:420px){.zuqen-agent-button-name{max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.zuqen-topbar .zuqen-top-left>.zuqen-icon-button:nth-child(2){display:none}.zuqen-suggestion-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.zuqen-agent-cards{grid-template-columns:1fr}.zuqen-mini-agent{min-height:58px}.zuqen-welcome:before{font-size:8px;letter-spacing:1.8px}.zuqen-credit-count{font-size:11px}}
        @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}
      `}</style>

      {sidebarOpen && (
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
                <div ref={messagesEndRef} aria-hidden="true" />
              </div>

              {showJumpToLatest && (
                <button className="zuqen-jump-latest" onClick={jumpToLatest} type="button">
                  <span aria-hidden="true" style={{ fontSize: 15, lineHeight: 1 }}>↓</span>
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
                      placeholder="Write a thought, ask a question, start something…"
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
                    Make room for<br />
                    <em>better ideas.</em>
                  </h1>

                  <p>
                    One calm, capable workspace to think clearly, create boldly, and turn ambitious ideas into real work.
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
                    placeholder="What would you like to make happen?"
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