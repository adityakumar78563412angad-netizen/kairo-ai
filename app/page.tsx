"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

type Role = "user" | "assistant";

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
  created_at: string;
  updated_at: string;
  messages?: Message[] | null;
};

type FeatureCredit = {
  feature_key: string;
  balance: number;
  total_granted: number;
  total_used: number;
  provider_features?: {
    feature_name?: string;
    provider?: string;
  } | null;
};

const supabase = createClient();

const makeId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const formatCredits = (value: number) => {
  if (!Number.isFinite(value)) return "0";

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }

  return Math.floor(value).toLocaleString();
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

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

    case "menu":
      return (
        <svg {...common}>
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      );

    case "more":
      return (
        <svg {...common}>
          <circle cx="5" cy="12" r="1" fill="currentColor" />
          <circle cx="12" cy="12" r="1" fill="currentColor" />
          <circle cx="19" cy="12" r="1" fill="currentColor" />
        </svg>
      );

    case "archive":
      return (
        <svg {...common}>
          <path d="M4 7h16v13H4z" />
          <path d="M3 4h18v3H3zM9 11h6" />
        </svg>
      );

    case "trash":
      return (
        <svg {...common}>
          <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
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
          <path d="M20 11a8 8 0 0 0-14.9-4L3 10" />
          <path d="M3 5v5h5" />
          <path d="M4 13a8 8 0 0 0 14.9 4L21 14" />
          <path d="M21 19v-5h-5" />
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
          <path d="m21.4 11.6-8.9 8.9a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7L9.7 17.7a2 2 0 1 1-2.8-2.8l8.5-8.5" />
        </svg>
      );

    case "x":
      return (
        <svg {...common}>
          <path d="m6 6 12 12M18 6 6 18" />
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
          <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.6 6.6 0 0 0 21 12.8Z" />
        </svg>
      );

    case "credit":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 10h18M7 15h4" />
        </svg>
      );

    case "bot":
      return (
        <svg {...common}>
          <rect x="4" y="7" width="16" height="13" rx="3" />
          <path d="M12 3v4M8 13h.01M16 13h.01M9 17h6" />
        </svg>
      );

    case "spark":
      return (
        <svg {...common}>
          <path d="m12 2 1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7Z" />
          <path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7Z" />
        </svg>
      );

    case "message":
      return (
        <svg {...common}>
          <path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.4 8.4 0 0 1-4-.9L3 20l1.9-4A7.2 7.2 0 0 1 4.5 12 7.5 7.5 0 0 1 12 4.5a7.5 7.5 0 0 1 8 7Z" />
        </svg>
      );

    case "check":
      return (
        <svg {...common}>
          <path d="m5 12 4 4L19 6" />
        </svg>
      );

    case "folder":
      return (
        <svg {...common}>
          <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
        </svg>
      );

    case "globe":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
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

export default function HomePage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [sidebar, setSidebar] = useState(true);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [lightMode, setLightMode] = useState(false);

  const [agentOpen, setAgentOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);

  const [featureCredits, setFeatureCredits] = useState<FeatureCredit[]>([]);
  const [creditsLoading, setCreditsLoading] = useState(false);

  const [searchValue, setSearchValue] = useState("");

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState("");

  const fileInput = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const activeChats = useMemo(
    () =>
      chats.filter(
        (chat) =>
          !chat.archived &&
          chat.title.toLowerCase().includes(searchValue.toLowerCase())
      ),
    [chats, searchValue]
  );

  const archivedChats = useMemo(
    () =>
      chats.filter((chat) =>
        chat.title.toLowerCase().includes(searchValue.toLowerCase())
      ),
    [chats, searchValue]
  );

  const chatCredits = useMemo(() => {
    const chat = featureCredits.find((item) => item.feature_key === "chat");
    return Number(chat?.balance || 0);
  }, [featureCredits]);

  const totalCredits = useMemo(
    () =>
      featureCredits.reduce(
        (total, item) => total + Number(item.balance || 0),
        0
      ),
    [featureCredits]
  );

  const totalGranted = useMemo(
    () =>
      featureCredits.reduce(
        (total, item) => total + Number(item.total_granted || 0),
        0
      ),
    [featureCredits]
  );

  const totalUsed = useMemo(
    () =>
      featureCredits.reduce(
        (total, item) => total + Number(item.total_used || 0),
        0
      ),
    [featureCredits]
  );

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("light", lightMode);
  }, [lightMode]);

  const loadFeatureCredits = useCallback(async (userId: string) => {
    try {
      setCreditsLoading(true);

      const { data, error } = await supabase
        .from("feature_credit_balances")
        .select(
          `
          feature_key,
          balance,
          total_granted,
          total_used,
          provider_features (
            feature_name,
            provider
          )
        `
        )
        .eq("user_id", userId);

      if (error) {
        console.error("Failed to load feature credits:", error);
        return;
      }

      if (mountedRef.current) {
        setFeatureCredits((data || []) as FeatureCredit[]);
      }
    } catch (error) {
      console.error("loadFeatureCredits error:", error);
    } finally {
      if (mountedRef.current) {
        setCreditsLoading(false);
      }
    }
  }, []);

  const loadChats = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("chats")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("Failed to load chats:", error);
        setErrorMessage(error.message);
        return;
      }

      if (mountedRef.current) {
        setChats((data || []) as Chat[]);
      }
    } catch (error) {
      console.error("loadChats error:", error);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function initializeUser() {
      try {
        const {
          data: { user: currentUser },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          console.error("Failed to get current user:", userError);
        }

        let finalUser = currentUser;

        if (!finalUser) {
          const { data, error } =
            await supabase.auth.signInAnonymously();

          if (error || !data.user) {
            console.error("Anonymous auth failed:", error);
            setErrorMessage(
              "Authentication failed. Please check Supabase Anonymous Auth."
            );
            return;
          }

          finalUser = data.user;
        }

        if (!active) return;

        setUser(finalUser);

        const userId = finalUser.id;

        await Promise.all([
          loadChats(userId),
          loadFeatureCredits(userId),
        ]);
      } catch (error) {
        console.error("initializeUser error:", error);
        setErrorMessage("Unable to initialize ZUQEN AI.");
      } finally {
        if (active) {
          setAuthReady(true);
        }
      }
    }

    initializeUser();

    return () => {
      active = false;
    };
  }, [loadChats, loadFeatureCredits]);

  useEffect(() => {
    const closeMenus = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      if (!target.closest(".chat-menu-wrapper")) {
        setOpenMenuId(null);
      }

      if (!target.closest(".agent-wrapper")) {
        setAgentOpen(false);
      }

      if (!target.closest(".credits-wrapper")) {
        setCreditsOpen(false);
      }
    };

    document.addEventListener("click", closeMenus);

    return () => {
      document.removeEventListener("click", closeMenus);
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, loading]);

  const autoResize = () => {
    const textarea = textareaRef.current;

    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 220)}px`;
  };

  const saveChatMessages = async (
    chatId: string,
    userId: string,
    nextMessages: Message[]
  ) => {
    const { error } = await supabase
      .from("chats")
      .update({
        messages: nextMessages,
        updated_at: new Date().toISOString(),
      })
      .eq("id", chatId)
      .eq("user_id", userId);

    if (error) {
      console.error("Failed to save messages:", error);
      throw error;
    }
  };

  const createChat = async (firstMessage = "") => {
    if (!user) return null;

    const title =
      firstMessage.trim().slice(0, 55) || "New conversation";

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("chats")
      .insert({
        user_id: user.id,
        title,
        archived: false,
        messages: [],
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();

    if (error) {
      console.error("Failed to create chat:", error);
      setErrorMessage(error.message);
      return null;
    }

    const newChat = data as Chat;

    setChats((previous) => [newChat, ...previous]);
    setActiveChat(newChat);
    setMessages([]);

    return newChat;
  };

  const openChat = async (chat: Chat) => {
    setOpenMenuId(null);
    setRenameId(null);
    setEditingId(null);
    setErrorMessage("");

    setActiveChat(chat);

    const storedMessages = Array.isArray(chat.messages)
      ? chat.messages
      : [];

    setMessages(storedMessages);
    setInput("");
  };

  const archiveChat = async (chatId: string) => {
    if (!user) return;

    const { error } = await supabase
      .from("chats")
      .update({
        archived: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", chatId)
      .eq("user_id", user.id);

    if (error) {
      console.error(error);
      return;
    }

    setChats((previous) =>
      previous.map((chat) =>
        chat.id === chatId
          ? { ...chat, archived: true }
          : chat
      )
    );

    setOpenMenuId(null);
  };

  const restoreChat = async (chatId: string) => {
    if (!user) return;

    const { error } = await supabase
      .from("chats")
      .update({
        archived: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", chatId)
      .eq("user_id", user.id);

    if (error) {
      console.error(error);
      return;
    }

    setChats((previous) =>
      previous.map((chat) =>
        chat.id === chatId
          ? { ...chat, archived: false }
          : chat
      )
    );

    setOpenMenuId(null);
  };

  const deleteChat = async (chatId: string) => {
    if (!user) return;

    const confirmed = window.confirm(
      "Delete this conversation permanently?"
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("chats")
      .delete()
      .eq("id", chatId)
      .eq("user_id", user.id);

    if (error) {
      console.error(error);
      setErrorMessage(error.message);
      return;
    }

    setChats((previous) =>
      previous.filter((chat) => chat.id !== chatId)
    );

    if (activeChat?.id === chatId) {
      setActiveChat(null);
      setMessages([]);
    }

    setOpenMenuId(null);
  };

  const startRename = (chat: Chat) => {
    setRenameId(chat.id);
    setRenameValue(chat.title);
    setOpenMenuId(null);
  };

  const saveRename = async () => {
    if (!user || !renameId) return;

    const title = renameValue.trim();

    if (!title) return;

    const { error } = await supabase
      .from("chats")
      .update({
        title,
        updated_at: new Date().toISOString(),
      })
      .eq("id", renameId)
      .eq("user_id", user.id);

    if (error) {
      console.error(error);
      setErrorMessage(error.message);
      return;
    }

    setChats((previous) =>
      previous.map((chat) =>
        chat.id === renameId
          ? { ...chat, title }
          : chat
      )
    );

    if (activeChat?.id === renameId) {
      setActiveChat((previous) =>
        previous ? { ...previous, title } : previous
      );
    }

    setRenameId(null);
    setRenameValue("");
  };

  const handleFileChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files || []);

    const newAttachments: Attachment[] = files.map((file) => ({
      id: makeId(),
      name: file.name,
      type: file.type,
      size: file.size,
    }));

    setAttachments((previous) => [
      ...previous,
      ...newAttachments,
    ]);

    event.target.value = "";
  };

  const removeAttachment = (id: string) => {
    setAttachments((previous) =>
      previous.filter((item) => item.id !== id)
    );
  };

  const extractStreamText = (parsed: any): string => {
    if (!parsed) return "";

    if (typeof parsed.content === "string") {
      return parsed.content;
    }

    if (typeof parsed.delta === "string") {
      return parsed.delta;
    }

    if (typeof parsed.text === "string") {
      return parsed.text;
    }

    if (
      typeof parsed.message?.content === "string"
    ) {
      return parsed.message.content;
    }

    if (
      typeof parsed.choices?.[0]?.delta?.content ===
      "string"
    ) {
      return parsed.choices[0].delta.content;
    }

    if (
      typeof parsed.choices?.[0]?.message?.content ===
      "string"
    ) {
      return parsed.choices[0].message.content;
    }

    return "";
  };

  const readStreamingResponse = async (
    response: Response,
    onText: (text: string) => void
  ) => {
    if (!response.body) {
      throw new Error("Streaming response is unavailable.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, {
        stream: true,
      });

      const lines = buffer.split("\n");

      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed.startsWith("data:")) {
          continue;
        }

        const raw = trimmed.slice(5).trim();

        if (!raw || raw === "[DONE]") {
          continue;
        }

        try {
          const parsed = JSON.parse(raw);

          const text = extractStreamText(parsed);

          if (text) {
            onText(text);
          }
        } catch {
          // Ignore incomplete/non-JSON SSE lines.
        }
      }
    }

    if (buffer.trim().startsWith("data:")) {
      const raw = buffer.trim().slice(5).trim();

      if (raw && raw !== "[DONE]") {
        try {
          const parsed = JSON.parse(raw);
          const text = extractStreamText(parsed);

          if (text) {
            onText(text);
          }
        } catch {
          // Ignore final malformed SSE fragment.
        }
      }
    }
  };

  const sendToAI = async (
    chat: Chat,
    conversation: Message[]
  ) => {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chatId: chat.id,
        messages: conversation.map((message) => ({
          role: message.role,
          content: message.content,
          attachments: message.attachments || [],
        })),
      }),
    });

    if (!response.ok) {
      let message = "ZUQEN AI request failed.";

      try {
        const json = await response.json();

        if (json?.error) {
          message = json.error;
        }
      } catch {
        // Keep default error.
      }

      throw new Error(message);
    }

    let assistantText = "";

    const assistantId = makeId();

    const initialAssistant: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
    };

    setMessages((previous) => [
      ...previous,
      initialAssistant,
    ]);

    await readStreamingResponse(response, (text) => {
      assistantText += text;

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
    });

    if (!assistantText.trim()) {
      throw new Error(
        "ZUQEN AI returned an empty response."
      );
    }

    return {
      ...initialAssistant,
      content: assistantText,
    };
  };

  const sendMessage = async () => {
    const text = input.trim();

    if (!text || loading || !user) return;

    setErrorMessage("");
    setLoading(true);

    try {
      let chat = activeChat;

      if (!chat) {
        chat = await createChat(text);

        if (!chat) {
          throw new Error(
            "Unable to create a conversation."
          );
        }
      }

      const userMessage: Message = {
        id: makeId(),
        role: "user",
        content: text,
        created_at: new Date().toISOString(),
        attachments:
          attachments.length > 0
            ? attachments
            : undefined,
      };

      const conversation = [
        ...messages,
        userMessage,
      ];

      setMessages(conversation);
      setInput("");
      setAttachments([]);

      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      // Save user's message immediately.
      // This prevents the prompt from disappearing
      // if the AI request fails.
      await saveChatMessages(
        chat.id,
        user.id,
        conversation
      );

      if (
        chat.title === "New conversation" ||
        !chat.title.trim()
      ) {
        const newTitle =
          text.slice(0, 55) || "New conversation";

        await supabase
          .from("chats")
          .update({
            title: newTitle,
            updated_at: new Date().toISOString(),
          })
          .eq("id", chat.id)
          .eq("user_id", user.id);

        chat = {
          ...chat,
          title: newTitle,
        };

        setActiveChat(chat);

        setChats((previous) =>
          previous.map((item) =>
            item.id === chat!.id
              ? { ...item, title: newTitle }
              : item
          )
        );
      }

      const assistantMessage = await sendToAI(
        chat,
        conversation
      );

      const finalMessages = [
        ...conversation,
        assistantMessage,
      ];

      setMessages(finalMessages);

      // Save BOTH user + AI message together.
      await saveChatMessages(
        chat.id,
        user.id,
        finalMessages
      );

      await Promise.all([
        loadChats(user.id),
        loadFeatureCredits(user.id),
      ]);
    } catch (error) {
      console.error("sendMessage error:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong.";

      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  const copyMessage = async (message: Message) => {
    try {
      await navigator.clipboard.writeText(
        message.content
      );

      setCopiedId(message.id);

      window.setTimeout(() => {
        setCopiedId(null);
      }, 1500);
    } catch (error) {
      console.error("Copy failed:", error);
    }
  };

  const startEditMessage = (message: Message) => {
    if (message.role !== "user") return;

    setEditingId(message.id);
    setEditingValue(message.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingValue("");
  };

  const saveEdit = async () => {
    if (
      !editingId ||
      !user ||
      !activeChat ||
      loading
    ) {
      return;
    }

    const editedText = editingValue.trim();

    if (!editedText) return;

    const index = messages.findIndex(
      (message) => message.id === editingId
    );

    if (index === -1) return;

    setLoading(true);
    setErrorMessage("");

    try {
      const editedMessage = {
        ...messages[index],
        content: editedText,
      };

      const conversation = [
        ...messages.slice(0, index),
        editedMessage,
      ];

      setMessages(conversation);
      setEditingId(null);
      setEditingValue("");

      await saveChatMessages(
        activeChat.id,
        user.id,
        conversation
      );

      const assistant = await sendToAI(
        activeChat,
        conversation
      );

      const finalMessages = [
        ...conversation,
        assistant,
      ];

      setMessages(finalMessages);

      await saveChatMessages(
        activeChat.id,
        user.id,
        finalMessages
      );

      await loadFeatureCredits(user.id);
      await loadChats(user.id);
    } catch (error) {
      console.error("saveEdit error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to edit message."
      );
    } finally {
      setLoading(false);
    }
  };

  const regenerate = async () => {
    if (!activeChat || !user || loading) return;

    const lastUserIndex = [...messages]
      .map((message, index) => ({
        message,
        index,
      }))
      .reverse()
      .find(
        ({ message }) => message.role === "user"
      )?.index;

    if (lastUserIndex === undefined) return;

    const conversation = messages.slice(
      0,
      lastUserIndex + 1
    );

    setLoading(true);
    setErrorMessage("");

    try {
      setMessages(conversation);

      await saveChatMessages(
        activeChat.id,
        user.id,
        conversation
      );

      const assistant = await sendToAI(
        activeChat,
        conversation
      );

      const finalMessages = [
        ...conversation,
        assistant,
      ];

      setMessages(finalMessages);

      await saveChatMessages(
        activeChat.id,
        user.id,
        finalMessages
      );

      await loadFeatureCredits(user.id);
      await loadChats(user.id);
    } catch (error) {
      console.error("regenerate error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to regenerate response."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  const selectAgent = (agent: string) => {
    setAgentOpen(false);

    if (agent === "Website Builder") {
      router.push("/website-builder");
      return;
    }

    if (agent === "Image Generator") {
      router.push("/image-generator");
      return;
    }

    if (agent === "Video Generator") {
      router.push("/video-generator");
      return;
    }

    if (agent === "Voice Generator") {
      router.push("/generate-voice");
      return;
    }
  };

  const newConversation = () => {
    setActiveChat(null);
    setMessages([]);
    setInput("");
    setAttachments([]);
    setEditingId(null);
    setErrorMessage("");
  };

  if (!authReady) {
    return (
      <>
        <style>{globalStyles}</style>

        <div className="zuqen-loading-screen">
          <div className="zuqen-logo loading-logo">
            Z
          </div>

          <div className="loading-title">
            ZUQEN AI
          </div>

          <div className="loading-subtitle">
            Preparing your workspace...
          </div>

          <div className="loading-dots">
            <span />
            <span />
            <span />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{globalStyles}</style>

      <div className="zuqen-app">
        <aside
          className={`zuqen-sidebar ${
            sidebar ? "" : "closed"
          }`}
        >
          <div className="sidebar-top">
            <div className="brand">
              <div className="brand-mark">
                Z
              </div>

              <div className="brand-text">
                <strong>ZUQEN</strong>
                <span>AI</span>
              </div>
            </div>

            <button
              className="icon-button sidebar-close"
              onClick={() => setSidebar(false)}
              title="Close sidebar"
            >
              <Icon name="menu" size={20} />
            </button>
          </div>

          <button
            className="new-chat-button"
            onClick={newConversation}
          >
            <Icon name="plus" size={19} />
            <span>New conversation</span>
          </button>

          <div className="sidebar-search">
            <Icon name="search" size={18} />

            <input
              value={searchValue}
              onChange={(event) =>
                setSearchValue(event.target.value)
              }
              placeholder="Search conversations..."
            />
          </div>

          <div className="sidebar-section-title">
            <span>
              {archiveOpen
                ? "Archived"
                : "Conversations"}
            </span>

            <span className="chat-count">
              {archiveOpen
                ? archivedChats.filter(
                    (chat) => chat.archived
                  ).length
                : activeChats.length}
            </span>
          </div>

          <div className="chat-list">
            {(archiveOpen
              ? archivedChats.filter(
                  (chat) => chat.archived
                )
              : activeChats
            ).map((chat) => (
              <div
                key={chat.id}
                className={`chat-item ${
                  activeChat?.id === chat.id
                    ? "active"
                    : ""
                }`}
                onClick={() => void openChat(chat)}
              >
                <div className="chat-item-icon">
                  <Icon name="message" size={17} />
                </div>

                {renameId === chat.id ? (
                  <input
                    autoFocus
                    className="rename-input"
                    value={renameValue}
                    onChange={(event) =>
                      setRenameValue(
                        event.target.value
                      )
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void saveRename();
                      }

                      if (event.key === "Escape") {
                        setRenameId(null);
                      }
                    }}
                    onClick={(event) =>
                      event.stopPropagation()
                    }
                    onBlur={() => {
                      window.setTimeout(
                        () => void saveRename(),
                        100
                      );
                    }}
                  />
                ) : (
                  <div className="chat-item-content">
                    <div className="chat-item-title">
                      {chat.title ||
                        "New conversation"}
                    </div>

                    <div className="chat-item-time">
                      {new Date(
                        chat.updated_at
                      ).toLocaleDateString()}
                    </div>
                  </div>
                )}

                <div className="chat-menu-wrapper">
                  <button
                    className="chat-more"
                    onClick={(event) => {
                      event.stopPropagation();

                      setOpenMenuId(
                        openMenuId === chat.id
                          ? null
                          : chat.id
                      );
                    }}
                  >
                    <Icon name="more" size={19} />
                  </button>

                  {openMenuId === chat.id && (
                    <div
                      className="chat-context-menu"
                      onClick={(event) =>
                        event.stopPropagation()
                      }
                    >
                      <button
                        onClick={() =>
                          startRename(chat)
                        }
                      >
                        <Icon
                          name="edit"
                          size={16}
                        />
                        Rename
                      </button>

                      {chat.archived ? (
                        <button
                          onClick={() =>
                            void restoreChat(
                              chat.id
                            )
                          }
                        >
                          <Icon
                            name="refresh"
                            size={16}
                          />
                          Restore
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            void archiveChat(
                              chat.id
                            )
                          }
                        >
                          <Icon
                            name="archive"
                            size={16}
                          />
                          Archive
                        </button>
                      )}

                      <button
                        className="danger-menu"
                        onClick={() =>
                          void deleteChat(
                            chat.id
                          )
                        }
                      >
                        <Icon
                          name="trash"
                          size={16}
                        />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {(
              archiveOpen
                ? archivedChats.filter(
                    (chat) => chat.archived
                  )
                : activeChats
            ).length === 0 && (
              <div className="empty-chats">
                <Icon name="message" size={25} />
                <span>
                  {searchValue
                    ? "No conversations found"
                    : archiveOpen
                    ? "No archived conversations"
                    : "No conversations yet"}
                </span>
              </div>
            )}
          </div>

          <div className="sidebar-bottom">
            <button
              className={`sidebar-option ${
                archiveOpen ? "selected" : ""
              }`}
              onClick={() =>
                setArchiveOpen((value) => !value)
              }
            >
              <Icon name="archive" size={18} />
              <span>
                {archiveOpen
                  ? "All conversations"
                  : "Archived chats"}
              </span>
            </button>

            <div className="account-card">
              <div className="account-avatar">
                Z
              </div>

              <div className="account-info">
                <strong>
                  {user?.is_anonymous
                    ? "ZUQEN User"
                    : user?.email ||
                      "ZUQEN User"}
                </strong>

                <span>Free workspace</span>
              </div>
            </div>
          </div>
        </aside>

        <main className="zuqen-main">
          <header className="topbar">
            <div className="topbar-left">
              {!sidebar && (
                <button
                  className="icon-button"
                  onClick={() =>
                    setSidebar(true)
                  }
                >
                  <Icon name="menu" size={21} />
                </button>
              )}

              <div className="topbar-title">
                <div className="topbar-main-title">
                  {activeChat?.title ||
                    "ZUQEN AI"}
                </div>

                <div className="topbar-subtitle">
                  {activeChat
                    ? "AI conversation"
                    : "Your intelligent AI workspace"}
                </div>
              </div>
            </div>

            <div className="topbar-actions">
              <div className="credits-wrapper">
                <button
                  className="credits-button"
                  onClick={(event) => {
                    event.stopPropagation();

                    setCreditsOpen(
                      (value) => !value
                    );
                  }}
                >
                  <Icon
                    name="credit"
                    size={17}
                  />

                  <span>
                    {formatCredits(
                      chatCredits
                    )}
                  </span>

                  <small>
                    Chat Credits
                  </small>
                </button>

                {creditsOpen && (
                  <div
                    className="credits-dropdown"
                    onClick={(event) =>
                      event.stopPropagation()
                    }
                  >
                    <div className="dropdown-heading">
                      <div>
                        <strong>
                          ZUQEN Credits
                        </strong>

                        <span>
                          Feature balances
                        </span>
                      </div>

                      <Icon
                        name="credit"
                        size={22}
                      />
                    </div>

                    <div className="credit-total">
                      <span>
                        Total available
                      </span>

                      <strong>
                        {formatCredits(
                          totalCredits
                        )}
                      </strong>
                    </div>

                    <div className="credit-stats">
                      <div>
                        <span>
                          Granted
                        </span>
                        <strong>
                          {formatCredits(
                            totalGranted
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Used
                        </span>
                        <strong>
                          {formatCredits(
                            totalUsed
                          )}
                        </strong>
                      </div>
                    </div>

                    <div className="feature-credit-list">
                      {creditsLoading ? (
                        <div className="credit-loading">
                          Loading credits...
                        </div>
                      ) : featureCredits.length ===
                        0 ? (
                        <div className="credit-loading">
                          No feature credits found.
                        </div>
                      ) : (
                        featureCredits.map(
                          (feature) => (
                            <div
                              key={
                                feature.feature_key
                              }
                              className="feature-credit-row"
                            >
                              <div className="feature-credit-icon">
                                <Icon
                                  name={
                                    feature.feature_key ===
                                    "chat"
                                      ? "message"
                                      : "spark"
                                  }
                                  size={16}
                                />
                              </div>

                              <div>
                                <strong>
                                  {feature
                                    .provider_features
                                    ?.feature_name ||
                                    feature.feature_key}
                                </strong>

                                <span>
                                  {feature
                                    .provider_features
                                    ?.provider ||
                                    "provider"}
                                </span>
                              </div>

                              <b>
                                {formatCredits(
                                  Number(
                                    feature.balance ||
                                      0
                                  )
                                )}
                              </b>
                            </div>
                          )
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="agent-wrapper">
                <button
                  className="agent-button"
                  onClick={(event) => {
                    event.stopPropagation();

                    setAgentOpen(
                      (value) => !value
                    );
                  }}
                >
                  <Icon
                    name="spark"
                    size={17}
                  />
                  <span>AI Agents</span>
                </button>

                {agentOpen && (
                  <div
                    className="agent-dropdown"
                    onClick={(event) =>
                      event.stopPropagation()
                    }
                  >
                    <div className="dropdown-heading">
                      <div>
                        <strong>
                          AI Agents
                        </strong>
                        <span>
                          Choose a workspace
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() =>
                        setAgentOpen(false)
                      }
                    >
                      <span className="agent-icon">
                        <Icon
                          name="message"
                          size={17}
                        />
                      </span>

                      <span>
                        <strong>AI Chat</strong>
                        <small>
                          General intelligence
                        </small>
                      </span>
                    </button>

                    <button
                      onClick={() =>
                        selectAgent(
                          "Website Builder"
                        )
                      }
                    >
                      <span className="agent-icon">
                        <Icon
                          name="globe"
                          size={17}
                        />
                      </span>

                      <span>
                        <strong>
                          Website Builder
                        </strong>
                        <small>
                          Build websites
                        </small>
                      </span>
                    </button>

                    <button
                      onClick={() =>
                        selectAgent(
                          "Image Generator"
                        )
                      }
                    >
                      <span className="agent-icon">
                        <Icon
                          name="spark"
                          size={17}
                        />
                      </span>

                      <span>
                        <strong>
                          Image Generator
                        </strong>
                        <small>
                          Create images
                        </small>
                      </span>
                    </button>

                    <button
                      onClick={() =>
                        selectAgent(
                          "Video Generator"
                        )
                      }
                    >
                      <span className="agent-icon">
                        <Icon
                          name="refresh"
                          size={17}
                        />
                      </span>

                      <span>
                        <strong>
                          Video Generator
                        </strong>
                        <small>
                          Generate videos
                        </small>
                      </span>
                    </button>

                    <button
                      onClick={() =>
                        selectAgent(
                          "Voice Generator"
                        )
                      }
                    >
                      <span className="agent-icon">
                        <Icon
                          name="message"
                          size={17}
                        />
                      </span>

                      <span>
                        <strong>
                          Voice Generator
                        </strong>
                        <small>
                          Create voices
                        </small>
                      </span>
                    </button>
                  </div>
                )}
              </div>

              <button
                className="icon-button theme-button"
                onClick={() =>
                  setLightMode(
                    (value) => !value
                  )
                }
                title={
                  lightMode
                    ? "Dark mode"
                    : "Light mode"
                }
              >
                <Icon
                  name={
                    lightMode ? "moon" : "sun"
                  }
                  size={19}
                />
              </button>
            </div>
          </header>

          {errorMessage && (
            <div className="error-banner">
              <div>
                <Icon name="x" size={17} />
                <span>{errorMessage}</span>
              </div>

              <button
                onClick={() =>
                  setErrorMessage("")
                }
              >
                <Icon name="x" size={16} />
              </button>
            </div>
          )}

          <div className="chat-area">
            {messages.length === 0 ? (
              <div className="welcome-screen">
                <div className="welcome-orb">
                  <div className="welcome-z">
                    Z
                  </div>
                </div>

                <div className="welcome-badge">
                  <Icon
                    name="spark"
                    size={14}
                  />
                  ZUQEN AI
                </div>

                <h1>
                  What can I help
                  <br />
                  <span>you create?</span>
                </h1>

                <p>
                  Ask questions, generate ideas,
                  write content, analyze information,
                  or build something new.
                </p>

                <div className="home-search-card">
                  <div className="home-search-icon">
                    <Icon
                      name="search"
                      size={22}
                    />
                  </div>

                  <div className="home-search-content">
                    <strong>
                      Search your conversations
                    </strong>

                    <span>
                      Quickly find an earlier chat
                      from your workspace.
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setSidebar(true);

                      window.setTimeout(() => {
                        document
                          .querySelector<HTMLInputElement>(
                            ".sidebar-search input"
                          )
                          ?.focus();
                      }, 50);
                    }}
                  >
                    Search
                  </button>
                </div>

                <div className="suggestion-grid">
                  <button
                    onClick={() =>
                      setInput(
                        "Give me 5 creative ideas for a new project."
                      )
                    }
                  >
                    <Icon
                      name="spark"
                      size={19}
                    />
                    <span>
                      Brainstorm ideas
                    </span>
                  </button>

                  <button
                    onClick={() =>
                      setInput(
                        "Explain a difficult topic to me in simple language."
                      )
                    }
                  >
                    <Icon
                      name="bot"
                      size={19}
                    />
                    <span>
                      Explain something
                    </span>
                  </button>

                  <button
                    onClick={() =>
                      setInput(
                        "Help me write a professional message."
                      )
                    }
                  >
                    <Icon
                      name="edit"
                      size={19}
                    />
                    <span>
                      Write something
                    </span>
                  </button>

                  <button
                    onClick={() =>
                      setInput(
                        "Help me plan a project step by step."
                      )
                    }
                  >
                    <Icon
                      name="folder"
                      size={19}
                    />
                    <span>
                      Plan a project
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="messages-container">
                {messages.map((message, index) => {
                  const isUser =
                    message.role === "user";

                  const isEditing =
                    editingId === message.id;

                  const isLastAssistant =
                    message.role ===
                      "assistant" &&
                    index === messages.length - 1;

                  return (
                    <div
                      key={message.id}
                      className={`message-row ${
                        isUser
                          ? "user-row"
                          : "assistant-row"
                      }`}
                    >
                      <div className="message-block">
                        <div className="message-label">
                          {isUser ? (
                            <span>You</span>
                          ) : (
                            <span>
                              ZUQEN AI
                            </span>
                          )}
                        </div>

                        <div
                          className={`message-box ${
                            isUser
                              ? "user-message"
                              : "assistant-message"
                          }`}
                        >
                          {isEditing ? (
                            <div className="edit-box">
                              <textarea
                                value={
                                  editingValue
                                }
                                onChange={(
                                  event
                                ) =>
                                  setEditingValue(
                                    event.target
                                      .value
                                  )
                                }
                                autoFocus
                              />

                              <div className="edit-actions">
                                <button
                                  onClick={
                                    cancelEdit
                                  }
                                >
                                  Cancel
                                </button>

                                <button
                                  className="primary-small"
                                  onClick={() =>
                                    void saveEdit()
                                  }
                                >
                                  Save & regenerate
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="message-text">
                                {message.content
                                  .split("\n")
                                  .map(
                                    (
                                      line,
                                      lineIndex
                                    ) => (
                                      <span
                                        key={
                                          lineIndex
                                        }
                                      >
                                        {line}

                                        {lineIndex <
                                          message
                                            .content
                                            .split(
                                              "\n"
                                            ).length -
                                            1 && (
                                          <br />
                                        )}
                                      </span>
                                    )
                                  )}

                                {!isUser &&
                                  loading &&
                                  isLastAssistant &&
                                  !message
                                    .content && (
                                    <span className="typing-indicator">
                                      <i />
                                      <i />
                                      <i />
                                    </span>
                                  )}
                              </div>

                              {message.attachments &&
                                message.attachments
                                  .length >
                                  0 && (
                                  <div className="message-attachments">
                                    {message.attachments.map(
                                      (
                                        attachment
                                      ) => (
                                        <div
                                          key={
                                            attachment.id
                                          }
                                          className="message-attachment"
                                        >
                                          <Icon
                                            name="paperclip"
                                            size={15}
                                          />

                                          <span>
                                            {
                                              attachment.name
                                            }
                                          </span>

                                          <small>
                                            {formatFileSize(
                                              attachment.size
                                            )}
                                          </small>
                                        </div>
                                      )
                                    )}
                                  </div>
                                )}
                            </>
                          )}
                        </div>

                        {!isEditing && (
                          <div className="message-actions">
                            <button
                              title="Copy"
                              onClick={() =>
                                void copyMessage(
                                  message
                                )
                              }
                            >
                              <Icon
                                name={
                                  copiedId ===
                                  message.id
                                    ? "check"
                                    : "copy"
                                }
                                size={15}
                              />

                              {copiedId ===
                                message.id &&
                                "Copied"}
                            </button>

                            {isUser && (
                              <button
                                title="Edit"
                                onClick={() =>
                                  startEditMessage(
                                    message
                                  )
                                }
                              >
                                <Icon
                                  name="edit"
                                  size={15}
                                />
                              </button>
                            )}

                            {!isUser &&
                              isLastAssistant && (
                                <button
                                  title="Regenerate"
                                  onClick={() =>
                                    void regenerate()
                                  }
                                >
                                  <Icon
                                    name="refresh"
                                    size={15}
                                  />
                                  Regenerate
                                </button>
                              )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {loading &&
                  messages.length > 0 &&
                  messages[
                    messages.length - 1
                  ]?.role === "user" && (
                    <div className="message-row assistant-row">
                      <div className="message-block">
                        <div className="message-label">
                          ZUQEN AI
                        </div>

                        <div className="message-box assistant-message">
                          <div className="thinking-state">
                            <span>
                              Thinking
                            </span>

                            <div className="typing-indicator">
                              <i />
                              <i />
                              <i />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                <div ref={bottomRef} />
              </div>
            )}
          </div>

          <div className="composer-area">
            {attachments.length > 0 && (
              <div className="attachment-preview">
                {attachments.map(
                  (attachment) => (
                    <div
                      key={attachment.id}
                      className="attachment-chip"
                    >
                      <Icon
                        name="paperclip"
                        size={15}
                      />

                      <span>
                        {attachment.name}
                      </span>

                      <small>
                        {formatFileSize(
                          attachment.size
                        )}
                      </small>

                      <button
                        onClick={() =>
                          removeAttachment(
                            attachment.id
                          )
                        }
                      >
                        <Icon
                          name="x"
                          size={13}
                        />
                      </button>
                    </div>
                  )
                )}
              </div>
            )}

            <div className="composer">
              <div className="composer-top">
                <button
                  className="composer-icon"
                  onClick={() =>
                    fileInput.current?.click()
                  }
                  title="Attach file"
                >
                  <Icon
                    name="paperclip"
                    size={20}
                  />
                </button>

                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(event) => {
                    setInput(event.target.value);
                    autoResize();
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Message ZUQEN AI..."
                  rows={1}
                  disabled={loading}
                />

                <button
                  className={`send-button ${
                    input.trim() && !loading
                      ? "ready"
                      : ""
                  }`}
                  onClick={() =>
                    void sendMessage()
                  }
                  disabled={
                    !input.trim() || loading
                  }
                  title="Send message"
                >
                  {loading ? (
                    <span className="send-spinner" />
                  ) : (
                    <Icon
                      name="send"
                      size={19}
                    />
                  )}
                </button>
              </div>

              <div className="composer-bottom">
                <span>
                  <Icon
                    name="spark"
                    size={13}
                  />
                  ZUQEN AI can make mistakes.
                  Verify important information.
                </span>

                <span>
                  Enter to send · Shift + Enter
                  for new line
                </span>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

const globalStyles = `
:root {
  --bg: #08090c;
  --panel: #0d0f13;
  --panel-2: #11141a;
  --panel-3: #171a21;
  --border: rgba(255,255,255,.09);
  --border-strong: rgba(255,255,255,.14);
  --text: #f4f5f7;
  --muted: #8d94a3;
  --muted-2: #666d7b;
  --accent: #8b7cff;
  --accent-2: #b49cff;
  --danger: #ff6868;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  min-height: 100%;
  background: var(--bg);
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
  color: var(--text);
}

button,
input,
textarea {
  font: inherit;
}

button {
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
}

.zuqen-app {
  min-height: 100vh;
  display: flex;
  background:
    radial-gradient(
      circle at 50% -20%,
      rgba(112,92,255,.10),
      transparent 36%
    ),
    var(--bg);
  overflow: hidden;
}

.zuqen-sidebar {
  width: 292px;
  min-width: 292px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border);
  background: rgba(11,13,17,.94);
  backdrop-filter: blur(22px);
  transition:
    width .25s ease,
    min-width .25s ease,
    transform .25s ease;
  z-index: 20;
}

.zuqen-sidebar.closed {
  width: 0;
  min-width: 0;
  overflow: hidden;
  border: 0;
}

.sidebar-top {
  height: 76px;
  padding: 0 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border);
}

.brand {
  display: flex;
  align-items: center;
  gap: 11px;
}

.brand-mark,
.zuqen-logo {
  width: 39px;
  height: 39px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  font-size: 23px;
  font-weight: 900;
  color: white;
  background:
    linear-gradient(145deg,#a796ff,#6555e9);
  box-shadow:
    0 10px 28px rgba(113,94,255,.28),
    inset 0 1px 1px rgba(255,255,255,.25);
}

.brand-text {
  display: flex;
  align-items: baseline;
  gap: 5px;
}

.brand-text strong {
  font-size: 18px;
  letter-spacing: .06em;
}

.brand-text span {
  color: var(--accent-2);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: .12em;
}

.icon-button {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border: 1px solid transparent;
  border-radius: 10px;
  color: var(--muted);
  background: transparent;
  transition: .18s ease;
}

.icon-button:hover {
  color: var(--text);
  background: rgba(255,255,255,.06);
  border-color: var(--border);
}

.sidebar-close {
  width: 34px;
  height: 34px;
}

.new-chat-button {
  margin: 18px;
  height: 48px;
  border: 0;
  border-radius: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  color: white;
  font-weight: 700;
  background:
    linear-gradient(
      135deg,
      #8978ff,
      #6453e7
    );
  box-shadow:
    0 12px 26px rgba(101,83,231,.20);
  transition: .18s ease;
}

.new-chat-button:hover {
  transform: translateY(-1px);
  box-shadow:
    0 15px 30px rgba(101,83,231,.28);
}

.sidebar-search {
  height: 42px;
  margin: 0 18px 18px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  gap: 9px;
  border: 1px solid var(--border);
  border-radius: 11px;
  color: var(--muted);
  background: rgba(255,255,255,.025);
}

.sidebar-search input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  color: var(--text);
  background: transparent;
  font-size: 13px;
}

.sidebar-search input::placeholder {
  color: var(--muted-2);
}

.sidebar-section-title {
  padding: 0 20px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--muted);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: .12em;
  font-weight: 800;
}

.chat-count {
  min-width: 22px;
  padding: 2px 6px;
  text-align: center;
  border-radius: 20px;
  background: rgba(255,255,255,.06);
  color: var(--muted);
  font-size: 10px;
}

.chat-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 10px;
}

.chat-list::-webkit-scrollbar {
  width: 4px;
}

.chat-list::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,.08);
  border-radius: 20px;
}

.chat-item {
  min-height: 59px;
  margin-bottom: 3px;
  padding: 9px 8px;
  display: flex;
  align-items: center;
  gap: 10px;
  position: relative;
  border: 1px solid transparent;
  border-radius: 11px;
  color: var(--muted);
  transition: .16s ease;
}

.chat-item:hover {
  background: rgba(255,255,255,.035);
  color: var(--text);
}

.chat-item.active {
  background: rgba(139,124,255,.10);
  border-color: rgba(139,124,255,.16);
  color: var(--text);
}

.chat-item-icon {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 9px;
  background: rgba(255,255,255,.045);
}

.chat-item.active .chat-item-icon {
  color: var(--accent-2);
  background: rgba(139,124,255,.12);
}

.chat-item-content {
  min-width: 0;
  flex: 1;
}

.chat-item-title {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: inherit;
  font-size: 13px;
  font-weight: 600;
}

.chat-item-time {
  margin-top: 3px;
  color: var(--muted-2);
  font-size: 10px;
}

.chat-more {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 8px;
  color: var(--muted);
  background: transparent;
  opacity: 0;
  transition: .15s ease;
}

.chat-item:hover .chat-more,
.chat-more:focus {
  opacity: 1;
}

.chat-more:hover {
  color: var(--text);
  background: rgba(255,255,255,.07);
}

.chat-menu-wrapper {
  position: relative;
}

.chat-context-menu {
  width: 168px;
  position: absolute;
  top: 34px;
  right: 0;
  z-index: 80;
  padding: 6px;
  border: 1px solid var(--border-strong);
  border-radius: 12px;
  background: #14171d;
  box-shadow:
    0 18px 45px rgba(0,0,0,.42);
}

.chat-context-menu button {
  width: 100%;
  height: 36px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  gap: 9px;
  border: 0;
  border-radius: 8px;
  color: #d5d9e1;
  background: transparent;
  font-size: 12px;
  text-align: left;
}

.chat-context-menu button:hover {
  background: rgba(255,255,255,.07);
  color: white;
}

.chat-context-menu .danger-menu {
  color: #ff8c8c;
}

.rename-input {
  width: 100%;
  min-width: 0;
  padding: 7px 8px;
  border: 1px solid rgba(139,124,255,.45);
  border-radius: 7px;
  outline: 0;
  color: white;
  background: #151821;
  font-size: 12px;
}

.empty-chats {
  min-height: 170px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 9px;
  color: var(--muted-2);
  font-size: 12px;
  text-align: center;
}

.sidebar-bottom {
  padding: 12px;
  border-top: 1px solid var(--border);
}

.sidebar-option {
  width: 100%;
  height: 42px;
  margin-bottom: 10px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 0;
  border-radius: 9px;
  color: var(--muted);
  background: transparent;
  font-size: 12px;
  text-align: left;
}

.sidebar-option:hover,
.sidebar-option.selected {
  color: var(--text);
  background: rgba(255,255,255,.05);
}

.account-card {
  padding: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: rgba(255,255,255,.025);
}

.account-avatar {
  width: 35px;
  height: 35px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border-radius: 10px;
  color: white;
  font-weight: 800;
  background: linear-gradient(
    135deg,
    #8575ff,
    #5443d3
  );
}

.account-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.account-info strong {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--text);
  font-size: 12px;
}

.account-info span {
  margin-top: 2px;
  color: var(--muted-2);
  font-size: 10px;
}

.zuqen-main {
  min-width: 0;
  flex: 1;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.topbar {
  height: 76px;
  flex-shrink: 0;
  padding: 0 25px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border);
  background: rgba(8,9,12,.72);
  backdrop-filter: blur(20px);
}

.topbar-left,
.topbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.topbar-title {
  margin-left: 3px;
}

.topbar-main-title {
  color: var(--text);
  font-size: 15px;
  font-weight: 750;
}

.topbar-subtitle {
  margin-top: 2px;
  color: var(--muted-2);
  font-size: 10px;
}

.credits-wrapper,
.agent-wrapper {
  position: relative;
}

.credits-button,
.agent-button {
  height: 38px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  gap: 7px;
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text);
  background: rgba(255,255,255,.035);
  font-size: 12px;
}

.credits-button:hover,
.agent-button:hover {
  border-color: var(--border-strong);
  background: rgba(255,255,255,.06);
}

.credits-button svg {
  color: var(--accent-2);
}

.credits-button small {
  color: var(--muted);
  font-size: 9px;
}

.agent-button svg {
  color: var(--accent-2);
}

.credits-dropdown,
.agent-dropdown {
  width: 315px;
  position: absolute;
  top: 47px;
  right: 0;
  z-index: 100;
  padding: 13px;
  border: 1px solid var(--border-strong);
  border-radius: 15px;
  background: #111419;
  box-shadow:
    0 25px 70px rgba(0,0,0,.48);
}

.agent-dropdown {
  width: 265px;
}

.dropdown-heading {
  padding: 5px 5px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dropdown-heading div {
  display: flex;
  flex-direction: column;
}

.dropdown-heading strong {
  color: var(--text);
  font-size: 13px;
}

.dropdown-heading span {
  margin-top: 3px;
  color: var(--muted);
  font-size: 10px;
}

.dropdown-heading > svg {
  color: var(--accent-2);
}

.credit-total {
  padding: 13px;
  border: 1px solid rgba(139,124,255,.16);
  border-radius: 11px;
  background: rgba(139,124,255,.07);
}

.credit-total span {
  color: var(--muted);
  font-size: 10px;
}

.credit-total strong {
  display: block;
  margin-top: 5px;
  color: white;
  font-size: 24px;
}

.credit-stats {
  margin: 8px 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.credit-stats div {
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: rgba(255,255,255,.025);
}

.credit-stats span {
  display: block;
  color: var(--muted-2);
  font-size: 9px;
}

.credit-stats strong {
  display: block;
  margin-top: 3px;
  color: var(--text);
  font-size: 13px;
}

.feature-credit-list {
  max-height: 235px;
  overflow-y: auto;
}

.feature-credit-row {
  min-height: 49px;
  display: flex;
  align-items: center;
  gap: 9px;
}

.feature-credit-icon {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 9px;
  color: var(--accent-2);
  background: rgba(139,124,255,.09);
}

.feature-credit-row > div:nth-child(2) {
  min-width: 0;
  flex: 1;
}

.feature-credit-row strong {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: #e8eaf0;
  font-size: 11px;
}

.feature-credit-row span {
  display: block;
  margin-top: 2px;
  color: var(--muted-2);
  font-size: 9px;
}

.feature-credit-row b {
  color: white;
  font-size: 11px;
}

.credit-loading {
  padding: 18px 5px;
  color: var(--muted);
  font-size: 11px;
  text-align: center;
}

.agent-dropdown > button {
  width: 100%;
  padding: 9px;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 0;
  border-radius: 9px;
  color: var(--text);
  background: transparent;
  text-align: left;
}

.agent-dropdown > button:hover {
  background: rgba(255,255,255,.06);
}

.agent-icon {
  width: 31px;
  height: 31px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border-radius: 9px;
  color: var(--accent-2);
  background: rgba(139,124,255,.09);
}

.agent-dropdown > button > span:last-child {
  display: flex;
  flex-direction: column;
}

.agent-dropdown strong {
  font-size: 11px;
}

.agent-dropdown small {
  margin-top: 2px;
  color: var(--muted-2);
  font-size: 9px;
}

.error-banner {
  min-height: 42px;
  padding: 7px 17px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(255,104,104,.16);
  color: #ffadad;
  background: rgba(255,75,75,.06);
}

.error-banner > div {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
}

.error-banner button {
  width: 29px;
  height: 29px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 7px;
  color: #ffadad;
  background: transparent;
}

.chat-area {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.chat-area::-webkit-scrollbar {
  width: 5px;
}

.chat-area::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,.08);
  border-radius: 20px;
}

.welcome-screen {
  width: min(900px, calc(100% - 40px));
  min-height: 100%;
  margin: auto;
  padding: 70px 0 45px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.welcome-orb {
  width: 76px;
  height: 76px;
  margin-bottom: 20px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(139,124,255,.28);
  border-radius: 23px;
  background:
    radial-gradient(
      circle at 30% 20%,
      rgba(186,169,255,.25),
      rgba(99,80,220,.08)
    );
  box-shadow:
    0 20px 60px rgba(100,80,220,.18);
}

.welcome-z {
  font-size: 38px;
  font-weight: 900;
  background: linear-gradient(
    135deg,
    #fff,
    #8d7cff
  );
  -webkit-background-clip: text;
  color: transparent;
}

.welcome-badge {
  height: 28px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  gap: 5px;
  border: 1px solid rgba(139,124,255,.18);
  border-radius: 20px;
  color: #b5aaff;
  background: rgba(139,124,255,.06);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: .13em;
}

.welcome-screen h1 {
  margin: 17px 0 8px;
  color: white;
  font-size: clamp(34px, 5vw, 55px);
  line-height: 1.05;
  text-align: center;
  letter-spacing: -.045em;
}

.welcome-screen h1 span {
  background: linear-gradient(
    90deg,
    #ffffff,
    #a193ff
  );
  -webkit-background-clip: text;
  color: transparent;
}

.welcome-screen > p {
  max-width: 570px;
  margin: 0 0 30px;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.7;
  text-align: center;
}

.home-search-card {
  width: min(720px, 100%);
  min-height: 82px;
  padding: 13px;
  display: flex;
  align-items: center;
  gap: 13px;
  border: 1px solid rgba(255,255,255,.09);
  border-radius: 17px;
  background:
    linear-gradient(
      135deg,
      rgba(255,255,255,.045),
      rgba(255,255,255,.018)
    );
  box-shadow:
    0 15px 55px rgba(0,0,0,.18);
}

.home-search-icon {
  width: 50px;
  height: 50px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border-radius: 13px;
  color: var(--accent-2);
  background: rgba(139,124,255,.09);
}

.home-search-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.home-search-content strong {
  color: var(--text);
  font-size: 13px;
}

.home-search-content span {
  margin-top: 4px;
  color: var(--muted-2);
  font-size: 10px;
}

.home-search-card button {
  height: 38px;
  padding: 0 15px;
  border: 1px solid rgba(139,124,255,.25);
  border-radius: 10px;
  color: #d8d3ff;
  background: rgba(139,124,255,.09);
  font-size: 11px;
  font-weight: 700;
}

.home-search-card button:hover {
  background: rgba(139,124,255,.16);
}

.suggestion-grid {
  width: min(720px, 100%);
  margin-top: 14px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 9px;
}

.suggestion-grid button {
  min-height: 74px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  border: 1px solid var(--border);
  border-radius: 13px;
  color: var(--muted);
  background: rgba(255,255,255,.02);
  text-align: left;
  transition: .16s ease;
}

.suggestion-grid button:hover {
  color: var(--text);
  border-color: rgba(139,124,255,.22);
  background: rgba(139,124,255,.055);
  transform: translateY(-1px);
}

.suggestion-grid svg {
  color: var(--accent-2);
}

.suggestion-grid span {
  font-size: 10px;
  font-weight: 600;
}

.messages-container {
  width: min(1000px, calc(100% - 50px));
  margin: 0 auto;
  padding: 35px 0 100px;
}

.message-row {
  width: 100%;
  display: flex;
  margin-bottom: 30px;
}

.user-row {
  justify-content: flex-start;
}

.assistant-row {
  justify-content: flex-end;
}

.message-block {
  width: min(82%, 820px);
}

.message-label {
  margin-bottom: 8px;
  color: var(--muted-2);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .09em;
  text-transform: uppercase;
}

.user-row .message-label {
  text-align: left;
}

.assistant-row .message-label {
  text-align: right;
  color: #aaa0ff;
}

.message-box {
  padding: 18px 20px;
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow:
    0 10px 35px rgba(0,0,0,.12);
}

.user-message {
  color: #f0f1f5;
  background: #15181e;
  border-top-left-radius: 6px;
}

.assistant-message {
  min-height: 76px;
  color: #e5e7ec;
  background:
    linear-gradient(
      145deg,
      rgba(139,124,255,.065),
      rgba(255,255,255,.018)
    );
  border-color: rgba(139,124,255,.13);
  border-top-right-radius: 6px;
}

.message-text {
  color: inherit;
  font-size: 15px;
  line-height: 1.8;
  white-space: normal;
  word-break: break-word;
}

.message-actions {
  min-height: 29px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  opacity: .6;
  transition: .16s ease;
}

.message-block:hover .message-actions {
  opacity: 1;
}

.user-row .message-actions {
  justify-content: flex-start;
}

.message-actions button {
  height: 27px;
  padding: 0 7px;
  display: flex;
  align-items: center;
  gap: 5px;
  border: 0;
  border-radius: 7px;
  color: var(--muted);
  background: transparent;
  font-size: 9px;
}

.message-actions button:hover {
  color: var(--text);
  background: rgba(255,255,255,.055);
}

.typing-indicator {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 7px;
  vertical-align: middle;
}

.typing-indicator i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #a498ff;
  animation:
    typing .9s infinite ease-in-out;
}

.typing-indicator i:nth-child(2) {
  animation-delay: .15s;
}

.typing-indicator i:nth-child(3) {
  animation-delay: .3s;
}

@keyframes typing {
  0%,
  100% {
    transform: translateY(0);
    opacity: .35;
  }

  50% {
    transform: translateY(-4px);
    opacity: 1;
  }
}

.thinking-state {
  display: flex;
  align-items: center;
  color: var(--muted);
  font-size: 12px;
}

.edit-box textarea {
  width: 100%;
  min-height: 110px;
  resize: vertical;
  padding: 12px;
  border: 1px solid rgba(139,124,255,.35);
  border-radius: 10px;
  outline: 0;
  color: white;
  background: #0d0f13;
  font-size: 14px;
  line-height: 1.6;
}

.edit-actions {
  margin-top: 9px;
  display: flex;
  justify-content: flex-end;
  gap: 7px;
}

.edit-actions button {
  height: 32px;
  padding: 0 11px;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--muted);
  background: transparent;
  font-size: 10px;
}

.edit-actions button:hover {
  color: white;
  background: rgba(255,255,255,.05);
}

.edit-actions .primary-small {
  border-color: rgba(139,124,255,.28);
  color: white;
  background: rgba(139,124,255,.13);
}

.message-attachments,
.attachment-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.message-attachments {
  margin-top: 12px;
}

.message-attachment,
.attachment-chip {
  min-height: 32px;
  padding: 0 8px;
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--muted);
  background: rgba(0,0,0,.15);
  font-size: 10px;
}

.message-attachment span,
.attachment-chip span {
  max-width: 180px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.message-attachment small,
.attachment-chip small {
  color: var(--muted-2);
}

.attachment-chip button {
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 6px;
  color: var(--muted);
  background: transparent;
}

.attachment-chip button:hover {
  color: #ff9a9a;
  background: rgba(255,100,100,.08);
}

.composer-area {
  width: min(1000px, calc(100% - 50px));
  margin: 0 auto;
  padding: 0 0 19px;
}

.attachment-preview {
  margin-bottom: 8px;
}

.composer {
  padding: 9px 10px 8px;
  border: 1px solid var(--border-strong);
  border-radius: 17px;
  background:
    linear-gradient(
      145deg,
      rgba(255,255,255,.045),
      rgba(255,255,255,.018)
    );
  box-shadow:
    0 15px 50px rgba(0,0,0,.24);
}

.composer-top {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.composer-icon {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border: 0;
  border-radius: 10px;
  color: var(--muted);
  background: transparent;
}

.composer-icon:hover {
  color: var(--text);
  background: rgba(255,255,255,.06);
}

.composer-top textarea {
  max-height: 220px;
  min-height: 40px;
  flex: 1;
  resize: none;
  overflow-y: auto;
  padding: 10px 4px;
  border: 0;
  outline: 0;
  color: white;
  background: transparent;
  font-size: 14px;
  line-height: 1.5;
}

.composer-top textarea::placeholder {
  color: var(--muted-2);
}

.send-button {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border: 0;
  border-radius: 11px;
  color: var(--muted-2);
  background: rgba(255,255,255,.055);
}

.send-button.ready {
  color: white;
  background:
    linear-gradient(
      135deg,
      #8b7cff,
      #6554e6
    );
  box-shadow:
    0 8px 20px rgba(101,84,230,.22);
}

.send-button.ready:hover {
  transform: translateY(-1px);
}

.send-spinner {
  width: 17px;
  height: 17px;
  border: 2px solid rgba(255,255,255,.28);
  border-top-color: white;
  border-radius: 50%;
  animation: spin .7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.composer-bottom {
  min-height: 19px;
  padding: 4px 3px 0;
  display: flex;
  justify-content: space-between;
  color: var(--muted-2);
  font-size: 9px;
}

.composer-bottom span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.composer-bottom svg {
  color: var(--accent-2);
}

.zuqen-loading-screen {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  background:
    radial-gradient(
      circle at 50% 35%,
      rgba(112,92,255,.14),
      transparent 30%
    ),
    #08090c;
}

.loading-logo {
  width: 58px;
  height: 58px;
  margin-bottom: 17px;
  font-size: 31px;
}

.loading-title {
  font-size: 18px;
  font-weight: 850;
  letter-spacing: .1em;
}

.loading-subtitle {
  margin-top: 6px;
  color: var(--muted);
  font-size: 11px;
}

.loading-dots {
  margin-top: 18px;
  display: flex;
  gap: 5px;
}

.loading-dots span {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #9487ff;
  animation: typing .9s infinite;
}

.loading-dots span:nth-child(2) {
  animation-delay: .15s;
}

.loading-dots span:nth-child(3) {
  animation-delay: .3s;
}

.light {
  --bg: #f5f6fa;
  --panel: #ffffff;
  --panel-2: #f8f9fc;
  --panel-3: #eef0f5;
  --border: rgba(20,24,32,.10);
  --border-strong: rgba(20,24,32,.16);
  --text: #161820;
  --muted: #656c79;
  --muted-2: #8a909b;
}

.light .zuqen-app {
  background: #f5f6fa;
}

.light .zuqen-sidebar {
  background: rgba(250,251,253,.94);
}

.light .topbar {
  background: rgba(248,249,252,.82);
}

.light .credits-dropdown,
.light .agent-dropdown,
.light .chat-context-menu {
  background: white;
  box-shadow:
    0 25px 70px rgba(20,24,32,.14);
}

.light .user-message {
  color: #242731;
  background: #ffffff;
}

.light .assistant-message {
  color: #252934;
  background: #faf9ff;
}

.light .composer,
.light .home-search-card,
.light .suggestion-grid button {
  background: white;
}

.light .composer-top textarea,
.light .rename-input,
.light .edit-box textarea {
  color: #20232c;
}

@media (max-width: 900px) {
  .zuqen-sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    box-shadow: 20px 0 60px rgba(0,0,0,.30);
  }

  .zuqen-sidebar.closed {
    transform: translateX(-100%);
    width: 292px;
    min-width: 292px;
  }

  .topbar {
    padding: 0 15px;
  }

  .topbar-subtitle {
    display: none;
  }

  .agent-button span {
    display: none;
  }

  .credits-button small {
    display: none;
  }

  .messages-container,
  .composer-area {
    width: calc(100% - 28px);
  }

  .message-block {
    width: 90%;
  }

  .suggestion-grid {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 600px) {
  .topbar {
    height: 65px;
  }

  .topbar-main-title {
    max-width: 180px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .credits-button {
    padding: 0 8px;
  }

  .credits-button span {
    font-size: 11px;
  }

  .theme-button {
    display: none;
  }

  .welcome-screen {
    width: calc(100% - 28px);
    padding: 40px 0 25px;
  }

  .welcome-screen h1 {
    font-size: 34px;
  }

  .welcome-screen > p {
    font-size: 12px;
  }

  .home-search-card {
    padding: 10px;
  }

  .home-search-content span {
    display: none;
  }

  .suggestion-grid {
    grid-template-columns: 1fr 1fr;
  }

  .suggestion-grid button {
    min-height: 68px;
  }

  .message-block {
    width: 94%;
  }

  .message-text {
    font-size: 14px;
  }

  .composer-bottom span:last-child {
    display: none;
  }

  .composer-area {
    padding-bottom: 9px;
  }
}
`;