"use client";

import {
  ChangeEvent,
  KeyboardEvent,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase";

/* =========================================================
   TYPES
========================================================= */

type Attachment = {
  name: string;
  type: string;
  size: number;
  url?: string;
  path?: string;
};

type Message = {
  id: string;
  chat_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  attachments?: Attachment[] | null;
  created_at: string;
};

type Chat = {
  id: string;
  user_id: string;
  title: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

type FeatureCredit = {
  feature_key: string;
  feature_name: string;
  provider: string;
  balance: number;
  total_granted: number;
  total_used: number;
};

/* =========================================================
   ICONS
========================================================= */

function Icon({
  name,
  size = 20,
  stroke = 1.8,
}: {
  name: string;
  size?: number;
  stroke?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: stroke,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  const icons: Record<string, ReactNode> = {
    plus: (
      <svg {...common}>
        <path d="M12 5v14M5 12h14" />
      </svg>
    ),

    search: (
      <svg {...common}>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </svg>
    ),

    menu: (
      <svg {...common}>
        <path d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    ),

    close: (
      <svg {...common}>
        <path d="m6 6 12 12M18 6 6 18" />
      </svg>
    ),

    chat: (
      <svg {...common}>
        <path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.4 8.4 0 0 1-3.6-.8L4 20l1.2-3.7A7.3 7.3 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5Z" />
      </svg>
    ),

    archive: (
      <svg {...common}>
        <path d="M4 7h16v13H4z" />
        <path d="M3 4h18v3H3zM9 11h6" />
      </svg>
    ),

    restore: (
      <svg {...common}>
        <path d="M4 7h16v13H4z" />
        <path d="M3 4h18v3H3zM9 13h6" />
        <path d="M12 10v6" />
      </svg>
    ),

    trash: (
      <svg {...common}>
        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
      </svg>
    ),

    edit: (
      <svg {...common}>
        <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17l-1 3Z" />
        <path d="m14 7 3 3" />
      </svg>
    ),

    copy: (
      <svg {...common}>
        <rect x="8" y="8" width="12" height="12" rx="2" />
        <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
      </svg>
    ),

    refresh: (
      <svg {...common}>
        <path d="M20 11a8 8 0 0 0-14.9-3M4 5v4h4M4 13a8 8 0 0 0 14.9 3M20 19v-4h-4" />
      </svg>
    ),

    send: (
      <svg {...common}>
        <path d="m4 4 17 8-17 8 3-8-3-8Z" />
        <path d="M7 12h14" />
      </svg>
    ),

    paperclip: (
      <svg {...common}>
        <path d="m21 11.5-8.7 8.7a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.3 9.3a2 2 0 0 1-2.8-2.8l8.4-8.4" />
      </svg>
    ),

    folder: (
      <svg {...common}>
        <path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      </svg>
    ),

    moon: (
      <svg {...common}>
        <path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z" />
      </svg>
    ),

    sun: (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    ),

    more: (
      <svg {...common}>
        <circle cx="5" cy="12" r="1" fill="currentColor" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
        <circle cx="19" cy="12" r="1" fill="currentColor" />
      </svg>
    ),

    user: (
      <svg {...common}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </svg>
    ),

    sparkles: (
      <svg {...common}>
        <path d="m12 3 1.3 4.7L18 9l-4.7 1.3L12 15l-1.3-4.7L6 9l4.7-1.3Z" />
        <path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7Z" />
      </svg>
    ),

    image: (
      <svg {...common}>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="m21 15-5-5L5 21" />
      </svg>
    ),

    globe: (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" />
      </svg>
    ),

    mic: (
      <svg {...common}>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" />
      </svg>
    ),

    video: (
      <svg {...common}>
        <rect x="3" y="5" width="13" height="14" rx="2" />
        <path d="m16 10 5-3v10l-5-3" />
      </svg>
    ),

    check: (
      <svg {...common}>
        <path d="m5 12 4 4L19 6" />
      </svg>
    ),

    chevron: (
      <svg {...common}>
        <path d="m6 9 6 6 6-6" />
      </svg>
    ),

    dollar: (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M15 8.5c-.8-.7-1.8-1-3-1-1.7 0-3 .9-3 2.2 0 3.4 6 1.7 6 5 0 1.3-1.2 2.3-3 2.3-1.3 0-2.5-.4-3.3-1.2M12 5v14" />
      </svg>
    ),

    zap: (
      <svg {...common}>
        <path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z" />
      </svg>
    ),
  };

  return icons[name] ?? null;
}

/* =========================================================
   HELPERS
========================================================= */

function formatCredits(value: number) {
  if (!Number.isFinite(value)) return "0";
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return Math.floor(value).toLocaleString();
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function featureIcon(feature: string) {
  switch (feature) {
    case "chat":
      return "chat";
    case "website_builder":
      return "globe";
    case "image_generator":
      return "image";
    case "video_generator":
      return "video";
    case "voice_generator":
      return "mic";
    default:
      return "sparkles";
  }
}

function getFeatureLabel(feature: string) {
  switch (feature) {
    case "chat":
      return "AI Chat";
    case "website_builder":
      return "Website Builder";
    case "image_generator":
      return "Image Generator";
    case "video_generator":
      return "Video Generator";
    case "voice_generator":
      return "Voice Generator";
    default:
      return feature;
  }
}

/* =========================================================
   COMPONENT
========================================================= */

export default function HomePage() {
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);

  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebar, setSidebar] = useState(true);

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

  const [lightMode, setLightMode] = useState(false);

  const [agentOpen, setAgentOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState("chat");

  const [creditsOpen, setCreditsOpen] = useState(false);
  const [featureCredits, setFeatureCredits] = useState<FeatureCredit[]>([]);
  const [creditsLoading, setCreditsLoading] = useState(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");

  const fileInput = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* =========================================================
     DERIVED
  ========================================================= */

  const activeChats = useMemo(() => {
    const filtered = chats.filter((chat) => !chat.archived);

    if (!searchText.trim()) return filtered;

    return filtered.filter((chat) =>
      chat.title.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [chats, searchText]);

  const archivedChats = useMemo(
    () => chats.filter((chat) => chat.archived),
    [chats]
  );

  const totalCredits = useMemo(
    () =>
      featureCredits.reduce(
        (sum, item) => sum + Number(item.balance || 0),
        0
      ),
    [featureCredits]
  );

  const allocatedCredits = useMemo(
    () =>
      featureCredits.reduce(
        (sum, item) => sum + Number(item.total_granted || 0),
        0
      ),
    [featureCredits]
  );

  const usedCredits = useMemo(
    () =>
      featureCredits.reduce(
        (sum, item) => sum + Number(item.total_used || 0),
        0
      ),
    [featureCredits]
  );

  const chatCredits =
    featureCredits.find((item) => item.feature_key === "chat")?.balance ?? 0;

  /* =========================================================
     THEME
  ========================================================= */

  useEffect(() => {
    document.documentElement.classList.toggle("zuqen-light", lightMode);
  }, [lightMode]);

  /* =========================================================
     LOAD CREDITS
  ========================================================= */

  async function loadFeatureCredits(userId: string) {
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
        console.error("Credits error:", error);
        return;
      }

      const normalized: FeatureCredit[] = (data ?? []).map((item: any) => ({
        feature_key: item.feature_key,
        feature_name:
          item.provider_features?.feature_name ??
          getFeatureLabel(item.feature_key),
        provider: item.provider_features?.provider ?? "",
        balance: Number(item.balance ?? 0),
        total_granted: Number(item.total_granted ?? 0),
        total_used: Number(item.total_used ?? 0),
      }));

      setFeatureCredits(normalized);
    } finally {
      setCreditsLoading(false);
    }
  }

  /* =========================================================
     LOAD CHATS
  ========================================================= */

  async function loadChats(userId: string) {
    const { data, error } = await supabase
      .from("ZUQEN_chats")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Chats error:", error);
      return;
    }

    setChats((data ?? []) as Chat[]);
  }

  /* =========================================================
     AUTH
  ========================================================= */

  useEffect(() => {
    let mounted = true;

   async function initializeUser() {
  try {
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    let finalUser = currentUser;

    if (!finalUser) {
      const { data, error } = await supabase.auth.signInAnonymously();

      if (error) {
        console.error("Anonymous auth failed:", error);
        return;
      }

      if (!data.user) {
        console.error("Anonymous user was not created.");
        return;
      }

      finalUser = data.user;
    }

    if (!finalUser) {
      console.error("No authenticated user found.");
      return;
    }

    if (!mounted) return;

    setUser(finalUser);

    await Promise.all([
      loadChats(finalUser.id),
      loadFeatureCredits(finalUser.id),
    ]);
  } catch (error) {
    console.error("User initialization failed:", error);
  } finally {
    if (mounted) {
      setAuthReady(true);
    }
  }
}

    initializeUser();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  /* =========================================================
     GLOBAL CLICK
  ========================================================= */

  useEffect(() => {
    function closeMenus() {
      setMenuOpen(null);
    }

    document.addEventListener("click", closeMenus);

    return () => {
      document.removeEventListener("click", closeMenus);
    };
  }, []);

  /* =========================================================
     SCROLL
  ========================================================= */

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, loading]);

  /* =========================================================
     AUTO RESIZE
  ========================================================= */

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 240)}px`;
  }, [input]);

  /* =========================================================
     CHAT FUNCTIONS
  ========================================================= */

  async function createChat() {
    if (!user) return null;

    const title = "New conversation";

    const { data, error } = await supabase
      .from("ZUQEN_chats")
      .insert({
        user_id: user.id,
        title,
        archived: false,
      })
      .select()
      .single();

    if (error) {
      console.error("Create chat error:", error);
      return null;
    }

    const newChat = data as Chat;

    setChats((prev) => [newChat, ...prev]);
    setActiveChat(newChat.id);
    setMessages([]);
    setInput("");
    setEditingId(null);
    setAttachments([]);
    setArchiveOpen(false);

    return newChat;
  }

  async function openChat(chatId: string) {
    setActiveChat(chatId);
    setMenuOpen(null);
    setEditingId(null);
    setInput("");
    setAttachments([]);

    const { data, error } = await supabase
      .from("ZUQEN_messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Messages error:", error);
      return;
    }

    setMessages((data ?? []) as Message[]);
  }

  async function archiveChat(chatId: string) {
    const { error } = await supabase
      .from("ZUQEN_chats")
      .update({
        archived: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", chatId);

    if (error) {
      console.error(error);
      return;
    }

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId ? { ...chat, archived: true } : chat
      )
    );

    if (activeChat === chatId) {
      setActiveChat(null);
      setMessages([]);
    }

    setMenuOpen(null);
  }

  async function restoreChat(chatId: string) {
    const { error } = await supabase
      .from("ZUQEN_chats")
      .update({
        archived: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", chatId);

    if (error) {
      console.error(error);
      return;
    }

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId ? { ...chat, archived: false } : chat
      )
    );

    setMenuOpen(null);
  }

  async function deleteChat(chatId: string) {
    const confirmed = window.confirm(
      "Delete this conversation permanently?"
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("ZUQEN_chats")
      .delete()
      .eq("id", chatId);

    if (error) {
      console.error(error);
      return;
    }

    setChats((prev) => prev.filter((chat) => chat.id !== chatId));

    if (activeChat === chatId) {
      setActiveChat(null);
      setMessages([]);
    }

    setMenuOpen(null);
  }

  async function renameChat(chatId: string) {
    const chat = chats.find((item) => item.id === chatId);
    if (!chat) return;

    const title = window.prompt(
      "Rename conversation",
      chat.title
    );

    if (!title?.trim()) return;

    const cleanTitle = title.trim();

    const { error } = await supabase
      .from("ZUQEN_chats")
      .update({
        title: cleanTitle,
        updated_at: new Date().toISOString(),
      })
      .eq("id", chatId);

    if (error) {
      console.error(error);
      return;
    }

    setChats((prev) =>
      prev.map((item) =>
        item.id === chatId
          ? {
              ...item,
              title: cleanTitle,
              updated_at: new Date().toISOString(),
            }
          : item
      )
    );

    setMenuOpen(null);
  }

  /* =========================================================
     FILES
  ========================================================= */

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);

    if (!files.length) return;

    const mapped: Attachment[] = files.map((file) => ({
      name: file.name,
      type: file.type,
      size: file.size,
      url: URL.createObjectURL(file),
    }));

    setAttachments((prev) => [...prev, ...mapped]);
    e.target.value = "";
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  /* =========================================================
     COPY
  ========================================================= */

  async function copyMessage(message: Message) {
    try {
      await navigator.clipboard.writeText(message.content);

      setCopiedId(message.id);

      setTimeout(() => {
        setCopiedId(null);
      }, 1500);
    } catch (error) {
      console.error(error);
    }
  }

  /* =========================================================
     EDIT
  ========================================================= */

  function editMessage(message: Message) {
    setEditingId(message.id);
    setInput(message.content);

    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  }

  function cancelEdit() {
    setEditingId(null);
    setInput("");
  }

  /* =========================================================
     STREAM AI
  ========================================================= */

  async function streamAI(
    chatId: string,
    conversationMessages: Message[],
    requestAttachments: Attachment[] = []
  ) {
    if (!user) return;

    const tempAssistantId = `assistant-${Date.now()}`;

    setLoading(true);

    const temporaryAssistant: Message = {
      id: tempAssistantId,
      chat_id: chatId,
      role: "assistant",
      content: "",
      attachments: null,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, temporaryAssistant]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chatId,
          messages: conversationMessages.map((message) => ({
            role: message.role,
            content: message.content,
            attachments: message.attachments ?? [],
          })),
          attachments: requestAttachments,
          agent: selectedAgent,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();

        throw new Error(
          errorText || `Request failed with ${response.status}`
        );
      }

      if (!response.body) {
        throw new Error("No response stream received.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = "";
      let assistantText = "";

      while (true) {
        const { value, done } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, {
          stream: true,
        });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();

          if (!trimmed.startsWith("data:")) continue;

          const payload = trimmed.replace(/^data:\s*/, "");

          if (!payload || payload === "[DONE]") continue;

          try {
            const parsed = JSON.parse(payload);

            const delta =
              parsed.content ??
              parsed.delta ??
              parsed.text ??
              parsed.message?.content ??
              "";

            if (typeof delta === "string" && delta.length) {
              assistantText += delta;

              setMessages((prev) =>
                prev.map((message) =>
                  message.id === tempAssistantId
                    ? {
                        ...message,
                        content: assistantText,
                      }
                    : message
                )
              );
            }
          } catch {
            /*
             Some providers may send non-JSON SSE lines.
             Ignore those safely.
            */
          }
        }
      }

      if (!assistantText.trim()) {
        throw new Error("ZUQEN AI returned an empty response.");
      }

      const { data: savedAssistant, error: saveError } =
        await supabase
          .from("ZUQEN_messages")
          .insert({
            chat_id: chatId,
            role: "assistant",
            content: assistantText,
            attachments: null,
          })
          .select()
          .single();

      if (saveError) {
        console.error("Save assistant message:", saveError);
      }

      setMessages((prev) =>
        prev.map((message) =>
          message.id === tempAssistantId
            ? savedAssistant
              ? (savedAssistant as Message)
              : {
                  ...message,
                  content: assistantText,
                }
            : message
        )
      );

      await supabase
        .from("ZUQEN_chats")
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq("id", chatId);

      await Promise.all([
        loadChats(user.id),
        loadFeatureCredits(user.id),
      ]);
    } catch (error: any) {
      console.error("ZUQEN AI error:", error);

      setMessages((prev) =>
        prev.map((message) =>
          message.id === tempAssistantId
            ? {
                ...message,
                content:
                  "Sorry, ZUQEN AI couldn't complete this request. Please try again.",
              }
            : message
        )
      );
    } finally {
      setLoading(false);
    }
  }

  /* =========================================================
     SEND MESSAGE
  ========================================================= */

  async function sendMessage() {
    const text = input.trim();

    if (!text || loading || !user) return;

    let chatId = activeChat;

    if (!chatId) {
      const created = await createChat();

      if (!created) return;

      chatId = created.id;
    }

    if (!chatId) return;

    /* -------------------------------------------------------
       EDIT MODE
    ------------------------------------------------------- */

    if (editingId) {
      const editedMessage = messages.find(
        (message) => message.id === editingId
      );

      if (!editedMessage) {
        cancelEdit();
        return;
      }

      const editedIndex = messages.findIndex(
        (message) => message.id === editingId
      );

      const updatedConversation = messages
        .slice(0, editedIndex + 1)
        .map((message) =>
          message.id === editingId
            ? {
                ...message,
                content: text,
              }
            : message
        );

      const { error: updateError } = await supabase
        .from("ZUQEN_messages")
        .update({
          content: text,
        })
        .eq("id", editingId);

      if (updateError) {
        console.error(updateError);
        return;
      }

      const messagesAfterEdit = messages.slice(
        editedIndex + 1
      );

      for (const message of messagesAfterEdit) {
        await supabase
          .from("ZUQEN_messages")
          .delete()
          .eq("id", message.id);
      }

      setMessages(updatedConversation);
      setInput("");
      setEditingId(null);

      await streamAI(
        chatId,
        updatedConversation,
        editedMessage.attachments ?? []
      );

      return;
    }

    /* -------------------------------------------------------
       NEW USER MESSAGE
    ------------------------------------------------------- */

    const { data: savedMessage, error } = await supabase
      .from("ZUQEN_messages")
      .insert({
        chat_id: chatId,
        role: "user",
        content: text,
        attachments,
      })
      .select()
      .single();

    if (error) {
      console.error("Save message error:", error);
      return;
    }

    const userMessage = savedMessage as Message;

    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput("");
    setAttachments([]);

    await supabase
      .from("ZUQEN_chats")
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq("id", chatId);

    const currentChat = chats.find(
      (chat) => chat.id === chatId
    );

    if (
      currentChat &&
      currentChat.title === "New conversation"
    ) {
      const generatedTitle =
        text.length > 45
          ? `${text.slice(0, 45)}…`
          : text;

      await supabase
        .from("ZUQEN_chats")
        .update({
          title: generatedTitle,
          updated_at: new Date().toISOString(),
        })
        .eq("id", chatId);

      setChats((prev) =>
        prev.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                title: generatedTitle,
              }
            : chat
        )
      );
    }

    await streamAI(chatId, nextMessages, attachments);
  }

  /* =========================================================
     REGENERATE
  ========================================================= */

  async function regenerate(message: Message) {
    if (loading || !activeChat || !user) return;

    const assistantIndex = messages.findIndex(
      (item) => item.id === message.id
    );

    if (assistantIndex < 0) return;

    const previousUserMessage = messages
      .slice(0, assistantIndex)
      .reverse()
      .find((item) => item.role === "user");

    if (!previousUserMessage) return;

    await supabase
      .from("ZUQEN_messages")
      .delete()
      .eq("id", message.id);

    const conversation = messages.slice(0, assistantIndex);

    setMessages(conversation);

    await streamAI(
      activeChat,
      conversation,
      previousUserMessage.attachments ?? []
    );
  }

  /* =========================================================
     KEYBOARD
  ========================================================= */

  function handleKeyDown(
    event: KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  /* =========================================================
     AGENT
  ========================================================= */

  function selectAgent(agent: string) {
    setSelectedAgent(agent);
    setAgentOpen(false);

    if (agent === "website_builder") {
      window.location.href = "/website-builder";
    }

    if (agent === "image_generator") {
      window.location.href = "/image-generator";
    }

    if (agent === "video_generator") {
      window.location.href = "/video-generator";
    }

    if (agent === "voice_generator") {
      window.location.href = "/generate-voice";
    }
  }

  /* =========================================================
     CHAT ITEM
  ========================================================= */

  function ChatItem({ chat }: { chat: Chat }) {
    return (
      <div
        className={`zuqen-chat-item ${
          activeChat === chat.id ? "active" : ""
        }`}
        onClick={() => openChat(chat.id)}
      >
        <div className="zuqen-chat-icon">
          <Icon name="chat" size={18} />
        </div>

        <div className="zuqen-chat-info">
          <div className="zuqen-chat-title">
            {chat.title || "New conversation"}
          </div>

          <div className="zuqen-chat-date">
            {new Date(chat.updated_at).toLocaleDateString()}
          </div>
        </div>

        <button
          className="zuqen-chat-more"
          onClick={(event) => {
            event.stopPropagation();

            setMenuOpen((current) =>
              current === chat.id ? null : chat.id
            );
          }}
        >
          <Icon name="more" size={19} />
        </button>

        {menuOpen === chat.id && (
          <div
            className="zuqen-chat-menu"
            onClick={(event) => event.stopPropagation()}
          >
            <button onClick={() => renameChat(chat.id)}>
              <Icon name="edit" size={17} />
              Rename
            </button>

            {chat.archived ? (
              <button onClick={() => restoreChat(chat.id)}>
                <Icon name="restore" size={17} />
                Restore
              </button>
            ) : (
              <button onClick={() => archiveChat(chat.id)}>
                <Icon name="archive" size={17} />
                Archive
              </button>
            )}

            <button
              className="danger"
              onClick={() => deleteChat(chat.id)}
            >
              <Icon name="trash" size={17} />
              Delete
            </button>
          </div>
        )}
      </div>
    );
  }

  /* =========================================================
     RENDER
  ========================================================= */

  if (!authReady) {
    return (
      <div className="zuqen-loading-screen">
        <div className="zuqen-loader-logo">
          <div className="zuqen-logo-mark large">
            <span>Z</span>
          </div>
        </div>

        <div className="zuqen-loading-title">
          ZUQEN AI
        </div>

        <div className="zuqen-loading-dots">
          <span />
          <span />
          <span />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`zuqen-app ${
        lightMode ? "light" : ""
      }`}
    >
      {/* =====================================================
          SIDEBAR OVERLAY
      ===================================================== */}

      {sidebar && (
        <div
          className="zuqen-mobile-overlay"
          onClick={() => setSidebar(false)}
        />
      )}

      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <aside
        className={`zuqen-sidebar ${
          sidebar ? "" : "closed"
        }`}
      >
        <div className="zuqen-sidebar-top">
          {/* BRAND */}

          <div className="zuqen-brand">
            <div className="zuqen-brand-logo">
              <span>Z</span>
              <i />
            </div>

            <div>
              <div className="zuqen-brand-name">
                ZUQEN
              </div>

              <div className="zuqen-brand-ai">
                ARTIFICIAL INTELLIGENCE
              </div>
            </div>
          </div>

          {/* NEW CHAT */}

          <button
            className="zuqen-new-chat"
            onClick={createChat}
          >
            <span className="new-chat-icon">
              <Icon name="plus" size={21} />
            </span>

            <span>New conversation</span>

            <kbd>⌘ K</kbd>
          </button>

          {/* SEARCH */}

          <div className="zuqen-search">
            <Icon name="search" size={18} />

            <input
              value={searchText}
              onChange={(event) =>
                setSearchText(event.target.value)
              }
              placeholder="Search conversations"
            />

            {searchText && (
              <button
                onClick={() => setSearchText("")}
              >
                <Icon name="close" size={15} />
              </button>
            )}
          </div>

          {/* NAV */}

          <div className="zuqen-sidebar-section-title">
            <span>WORKSPACE</span>
          </div>

          <div className="zuqen-side-nav">
            <button
              className="zuqen-side-nav-item active"
              onClick={() => {
                setArchiveOpen(false);
                setActiveChat(null);
                setMessages([]);
              }}
            >
              <Icon name="chat" size={20} />
              <span>Conversations</span>
              <b>{activeChats.length}</b>
            </button>

            <button
              className={`zuqen-side-nav-item ${
                archiveOpen ? "active" : ""
              }`}
              onClick={() =>
                setArchiveOpen((value) => !value)
              }
            >
              <Icon name="archive" size={20} />
              <span>Archived</span>
              <b>{archivedChats.length}</b>
            </button>
          </div>
        </div>

        {/* HISTORY */}

        <div className="zuqen-history">
          <div className="zuqen-history-heading">
            <span>
              {archiveOpen
                ? "ARCHIVED"
                : "CHAT HISTORY"}
            </span>

            <span>
              {archiveOpen
                ? archivedChats.length
                : activeChats.length}
            </span>
          </div>

          <div className="zuqen-chat-list">
            {(archiveOpen
              ? archivedChats
              : activeChats
            ).length === 0 ? (
              <div className="zuqen-empty-history">
                <div className="empty-history-icon">
                  <Icon
                    name={
                      archiveOpen
                        ? "archive"
                        : "chat"
                    }
                    size={25}
                  />
                </div>

                <strong>
                  {archiveOpen
                    ? "No archived chats"
                    : "No conversations yet"}
                </strong>

                <span>
                  {archiveOpen
                    ? "Archived conversations will appear here."
                    : "Start a new conversation with ZUQEN AI."}
                </span>
              </div>
            ) : (
              (archiveOpen
                ? archivedChats
                : activeChats
              ).map((chat) => (
                <ChatItem
                  key={chat.id}
                  chat={chat}
                />
              ))
            )}
          </div>
        </div>

        {/* ACCOUNT */}

        <div className="zuqen-sidebar-bottom">
          <div className="zuqen-account">
            <div className="zuqen-account-avatar">
              <Icon name="user" size={19} />
            </div>

            <div className="zuqen-account-info">
              <strong>You</strong>
              <span>
                {user?.is_anonymous
                  ? "Guest account"
                  : "ZUQEN member"}
              </span>
            </div>

            <button
              className="zuqen-account-more"
              title="Account"
            >
              <Icon name="more" size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* =====================================================
          MAIN
      ===================================================== */}

      <main className="zuqen-main">
        {/* TOPBAR */}

        <header className="zuqen-topbar">
          <div className="zuqen-topbar-left">
            <button
              className="zuqen-icon-button sidebar-toggle"
              onClick={() =>
                setSidebar((value) => !value)
              }
              title="Toggle sidebar"
            >
              <Icon
                name={sidebar ? "menu" : "menu"}
                size={22}
              />
            </button>

            <div className="zuqen-top-title">
              <div className="top-title-main">
                {activeChat
                  ? chats.find(
                      (chat) => chat.id === activeChat
                    )?.title || "Conversation"
                  : "ZUQEN AI"}
              </div>

              <div className="top-title-sub">
                <span className="online-dot" />
                AI workspace
              </div>
            </div>
          </div>

          <div className="zuqen-topbar-actions">
            {/* CREDITS */}

            <div className="zuqen-dropdown-wrap">
              <button
                className={`zuqen-credit-button ${
                  creditsOpen ? "active" : ""
                }`}
                onClick={(event) => {
                  event.stopPropagation();
                  setCreditsOpen((value) => !value);
                  setAgentOpen(false);
                }}
              >
                <span className="credit-icon">
                  <Icon name="zap" size={16} />
                </span>

                <span className="credit-button-label">
                  Credits
                </span>

                <strong>
                  {formatCredits(totalCredits)}
                </strong>

                <Icon name="chevron" size={15} />
              </button>

              {creditsOpen && (
                <div
                  className="zuqen-credits-panel"
                  onClick={(event) =>
                    event.stopPropagation()
                  }
                >
                  <div className="credits-panel-header">
                    <div>
                      <span>YOUR BALANCE</span>
                      <h3>
                        {formatCredits(totalCredits)}
                      </h3>
                    </div>

                    <div className="credits-large-icon">
                      <Icon name="zap" size={24} />
                    </div>
                  </div>

                  <div className="credits-stat-row">
                    <div>
                      <span>Allocated</span>
                      <strong>
                        {formatCredits(
                          allocatedCredits
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>Used</span>
                      <strong>
                        {formatCredits(usedCredits)}
                      </strong>
                    </div>
                  </div>

                  <div className="credits-progress">
                    <div
                      style={{
                        width: `${
                          allocatedCredits > 0
                            ? Math.min(
                                100,
                                Math.round(
                                  (usedCredits /
                                    allocatedCredits) *
                                    100
                                )
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>

                  <div className="credits-section-title">
                    FEATURE BALANCES
                  </div>

                  <div className="credits-features">
                    {creditsLoading ? (
                      <div className="credits-loading">
                        <span />
                        <span />
                        <span />
                      </div>
                    ) : (
                      featureCredits.map(
                        (feature) => {
                          const percentage =
                            feature.total_granted > 0
                              ? Math.min(
                                  100,
                                  (feature.balance /
                                    feature.total_granted) *
                                    100
                                )
                              : 0;

                          return (
                            <div
                              className="credit-feature"
                              key={feature.feature_key}
                            >
                              <div className="credit-feature-icon">
                                <Icon
                                  name={featureIcon(
                                    feature.feature_key
                                  )}
                                  size={17}
                                />
                              </div>

                              <div className="credit-feature-main">
                                <div>
                                  <span>
                                    {
                                      feature.feature_name
                                    }
                                  </span>

                                  <strong>
                                    {formatCredits(
                                      feature.balance
                                    )}
                                  </strong>
                                </div>

                                <div className="credit-feature-bar">
                                  <div
                                    style={{
                                      width: `${percentage}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        }
                      )
                    )}
                  </div>

                  {chatCredits <= 0 && (
                    <div className="credit-warning">
                      <Icon name="zap" size={17} />

                      <span>
                        Your AI Chat credits are
                        exhausted.
                      </span>
                    </div>
                  )}

                  <button
                    className="get-credit-button"
                    onClick={() =>
                      alert(
                        "Premium credits purchase will be available soon."
                      )
                    }
                  >
                    <Icon name="zap" size={18} />
                    Get more credits
                  </button>
                </div>
              )}
            </div>

            {/* AGENT */}

            <div className="zuqen-dropdown-wrap">
              <button
                className={`zuqen-agent-button ${
                  agentOpen ? "active" : ""
                }`}
                onClick={(event) => {
                  event.stopPropagation();
                  setAgentOpen((value) => !value);
                  setCreditsOpen(false);
                }}
              >
                <Icon
                  name={featureIcon(selectedAgent)}
                  size={18}
                />

                <span>
                  {getFeatureLabel(selectedAgent)}
                </span>

                <Icon name="chevron" size={15} />
              </button>

              {agentOpen && (
                <div
                  className="zuqen-agent-dropdown"
                  onClick={(event) =>
                    event.stopPropagation()
                  }
                >
                  {[
                    "chat",
                    "website_builder",
                    "image_generator",
                    "video_generator",
                    "voice_generator",
                  ].map((agent) => (
                    <button
                      key={agent}
                      className={
                        selectedAgent === agent
                          ? "selected"
                          : ""
                      }
                      onClick={() =>
                        selectAgent(agent)
                      }
                    >
                      <span className="agent-option-icon">
                        <Icon
                          name={featureIcon(agent)}
                          size={18}
                        />
                      </span>

                      <span>
                        {getFeatureLabel(agent)}
                      </span>

                      {selectedAgent === agent && (
                        <Icon
                          name="check"
                          size={17}
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* THEME */}

            <button
              className="zuqen-icon-button"
              onClick={() =>
                setLightMode((value) => !value)
              }
              title={
                lightMode
                  ? "Dark mode"
                  : "Light mode"
              }
            >
              <Icon
                name={lightMode ? "moon" : "sun"}
                size={20}
              />
            </button>
          </div>
        </header>

        {/* ===================================================
            CHAT AREA
        =================================================== */}

        <section className="zuqen-chat-area">
          <div className="zuqen-chat-scroll">
            {messages.length === 0 ? (
              <div className="zuqen-welcome">
                <div className="welcome-glow" />

                <div className="welcome-logo">
                  <div className="zuqen-logo-mark">
                    <span>Z</span>
                    <i />
                  </div>
                </div>

                <div className="welcome-eyebrow">
                  <span className="welcome-line" />
                  INTELLIGENCE, REFINED
                  <span className="welcome-line" />
                </div>

                <h1>
                  What can I help
                  <br />
                  you <em>create?</em>
                </h1>

                <p>
                  Ask ZUQEN AI anything. Write,
                  analyze, brainstorm, code, research,
                  and turn your ideas into reality.
                </p>

                <div className="welcome-suggestions">
                  <button
                    onClick={() =>
                      setInput(
                        "Help me plan and build a modern website."
                      )
                    }
                  >
                    <Icon name="globe" size={20} />
                    <span>
                      Build a website
                    </span>
                    <small>→</small>
                  </button>

                  <button
                    onClick={() =>
                      setInput(
                        "Give me a creative image prompt for a futuristic city."
                      )
                    }
                  >
                    <Icon name="image" size={20} />
                    <span>
                      Create an image idea
                    </span>
                    <small>→</small>
                  </button>

                  <button
                    onClick={() =>
                      setInput(
                        "Explain this topic to me in a simple way."
                      )
                    }
                  >
                    <Icon name="sparkles" size={20} />
                    <span>
                      Learn something
                    </span>
                    <small>→</small>
                  </button>
                </div>
              </div>
            ) : (
              <div className="zuqen-messages">
                {messages.map((message) => {
                  const isUser =
                    message.role === "user";

                  const isAssistant =
                    message.role === "assistant";

                  return (
                    <div
                      key={message.id}
                      className={`zuqen-message-row ${
                        isUser
                          ? "user-message"
                          : "ai-message"
                      }`}
                    >
                      <div className="zuqen-message-wrapper">
                        {/* LABEL */}

                        <div className="message-author">
                          {isUser ? (
                            <>
                              <div className="author-avatar user-avatar">
                                <span>Y</span>
                              </div>

                              <span>You</span>
                            </>
                          ) : (
                            <>
                              <div className="author-avatar ai-avatar">
                                <div className="mini-z-logo">
                                  <span>Z</span>
                                  <i />
                                </div>
                              </div>

                              <span>
                                ZUQEN AI
                              </span>

                              <span className="ai-status">
                                AI
                              </span>
                            </>
                          )}
                        </div>

                        {/* MESSAGE */}

                        <div
                          className={`zuqen-message-card ${
                            isUser
                              ? "user-card"
                              : "ai-card"
                          }`}
                        >
                          {isAssistant &&
                            !message.content &&
                            loading ? (
                            <div className="ai-thinking">
                              <div className="thinking-orb">
                                <span />
                                <span />
                                <span />
                              </div>

                              <div>
                                <strong>
                                  ZUQEN AI
                                </strong>

                                <p>
                                  Thinking and
                                  preparing your
                                  response
                                </p>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="message-content">
                                {message.content}
                              </div>

                              {message.attachments &&
                                message.attachments
                                  .length > 0 && (
                                  <div className="message-attachments">
                                    {message.attachments.map(
                                      (
                                        attachment,
                                        index
                                      ) => (
                                        <div
                                          key={`${attachment.name}-${index}`}
                                          className="message-attachment"
                                        >
                                          <Icon
                                            name={
                                              attachment.type.startsWith(
                                                "image/"
                                              )
                                                ? "image"
                                                : "paperclip"
                                            }
                                            size={18}
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

                        {/* ACTIONS */}

                        {(isUser || isAssistant) &&
                          message.content && (
                            <div className="message-actions">
                              <button
                                onClick={() =>
                                  copyMessage(
                                    message
                                  )
                                }
                                title="Copy"
                              >
                                <Icon
                                  name={
                                    copiedId ===
                                    message.id
                                      ? "check"
                                      : "copy"
                                  }
                                  size={16}
                                />
                                {copiedId ===
                                  message.id &&
                                  "Copied"}
                              </button>

                              {isUser && (
                                <button
                                  onClick={() =>
                                    editMessage(
                                      message
                                    )
                                  }
                                  title="Edit"
                                >
                                  <Icon
                                    name="edit"
                                    size={16}
                                  />
                                  Edit
                                </button>
                              )}

                              {isAssistant && (
                                <button
                                  onClick={() =>
                                    regenerate(
                                      message
                                    )
                                  }
                                  title="Regenerate"
                                  disabled={loading}
                                >
                                  <Icon
                                    name="refresh"
                                    size={16}
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

                {/* EXTRA THINKING INDICATOR */}

                {loading &&
                  messages.length > 0 &&
                  messages[messages.length - 1]
                    ?.role !== "assistant" && (
                    <div className="zuqen-ai-typing">
                      <div className="typing-avatar">
                        <div className="mini-z-logo">
                          <span>Z</span>
                          <i />
                        </div>
                      </div>

                      <div className="typing-content">
                        <strong>
                          ZUQEN AI
                        </strong>

                        <div className="typing-dots">
                          <span />
                          <span />
                          <span />
                        </div>
                      </div>
                    </div>
                  )}

                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* =================================================
              COMPOSER
          ================================================= */}

          <div className="zuqen-composer-area">
            <div className="zuqen-composer-container">
              {editingId && (
                <div className="editing-banner">
                  <div>
                    <Icon
                      name="edit"
                      size={17}
                    />

                    <span>
                      Editing your message
                    </span>
                  </div>

                  <button
                    onClick={cancelEdit}
                  >
                    <Icon
                      name="close"
                      size={16}
                    />
                    Cancel
                  </button>
                </div>
              )}

              {attachments.length > 0 && (
                <div className="attachment-preview-row">
                  {attachments.map(
                    (attachment, index) => (
                      <div
                        className="attachment-preview"
                        key={`${attachment.name}-${index}`}
                      >
                        <div className="attachment-preview-icon">
                          <Icon
                            name={
                              attachment.type.startsWith(
                                "image/"
                              )
                                ? "image"
                                : "paperclip"
                            }
                            size={17}
                          />
                        </div>

                        <div>
                          <strong>
                            {attachment.name}
                          </strong>

                          <small>
                            {formatFileSize(
                              attachment.size
                            )}
                          </small>
                        </div>

                        <button
                          onClick={() =>
                            removeAttachment(
                              index
                            )
                          }
                        >
                          <Icon
                            name="close"
                            size={15}
                          />
                        </button>
                      </div>
                    )
                  )}
                </div>
              )}

              <div className="zuqen-composer">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(event) =>
                    setInput(event.target.value)
                  }
                  onKeyDown={handleKeyDown}
                  placeholder="Message ZUQEN AI..."
                  rows={1}
                  disabled={loading}
                />

                <div className="composer-bottom">
                  <div className="composer-tools">
                    <input
                      ref={fileInput}
                      type="file"
                      multiple
                      hidden
                      onChange={
                        handleFileChange
                      }
                      accept="image/*,.pdf,.txt,.doc,.docx,.csv"
                    />

                    <button
                      onClick={() =>
                        fileInput.current?.click()
                      }
                      title="Attach files"
                    >
                      <Icon
                        name="paperclip"
                        size={19}
                      />

                      <span>
                        Attach
                      </span>
                    </button>

                    <button
                      onClick={() =>
                        alert(
                          "More tools coming soon."
                        )
                      }
                    >
                      <Icon
                        name="sparkles"
                        size={18}
                      />

                      <span>
                        Tools
                      </span>
                    </button>
                  </div>

                  <div className="composer-right">
                    <span className="composer-hint">
                      Shift + Enter for new line
                    </span>

                    <button
                      className={`zuqen-send ${
                        input.trim()
                          ? "ready"
                          : ""
                      }`}
                      onClick={sendMessage}
                      disabled={
                        !input.trim() ||
                        loading ||
                        uploading
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
                </div>
              </div>

              <div className="composer-footer">
                <span>
                  ZUQEN AI can make mistakes. Check
                  important information.
                </span>

                <span className="composer-security">
                  <Icon
                    name="check"
                    size={13}
                  />
                  Secure AI workspace
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* =====================================================
          GLOBAL CSS
      ===================================================== */}

      <style jsx global>{`
        :root {
          --zuqen-bg: #07090d;
          --zuqen-bg-2: #0b0e14;
          --zuqen-sidebar: #090b10;
          --zuqen-panel: #10131a;
          --zuqen-panel-2: #141821;
          --zuqen-border: rgba(255, 255, 255, 0.075);
          --zuqen-border-strong: rgba(
            255,
            255,
            255,
            0.12
          );
          --zuqen-text: #f4f6f8;
          --zuqen-muted: #8d95a3;
          --zuqen-soft: #626b79;
          --zuqen-accent: #ffffff;
          --zuqen-accent-text: #07090d;
          --zuqen-hover: rgba(
            255,
            255,
            255,
            0.055
          );
          --zuqen-green: #48d597;
          --zuqen-danger: #ff6b7a;
          --zuqen-shadow: 0 20px 60px
            rgba(0, 0, 0, 0.35);
        }

        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          background: var(--zuqen-bg);
          color: var(--zuqen-text);
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
          cursor: pointer;
        }

        .zuqen-app {
          width: 100%;
          height: 100vh;
          display: flex;
          overflow: hidden;
          background:
            radial-gradient(
              circle at 60% 10%,
              rgba(255, 255, 255, 0.025),
              transparent 28%
            ),
            var(--zuqen-bg);
          color: var(--zuqen-text);
        }

        /* =====================================================
           LIGHT
        ===================================================== */

        .zuqen-app.light {
          --zuqen-bg: #f5f6f8;
          --zuqen-bg-2: #ffffff;
          --zuqen-sidebar: #ffffff;
          --zuqen-panel: #ffffff;
          --zuqen-panel-2: #f2f4f7;
          --zuqen-border: rgba(
            15,
            23,
            42,
            0.09
          );
          --zuqen-border-strong: rgba(
            15,
            23,
            42,
            0.14
          );
          --zuqen-text: #12151c;
          --zuqen-muted: #667085;
          --zuqen-soft: #8b95a5;
          --zuqen-accent: #111318;
          --zuqen-accent-text: #ffffff;
          --zuqen-hover: rgba(15, 23, 42, 0.045);
          --zuqen-shadow: 0 20px 50px
            rgba(15, 23, 42, 0.1);
        }

        /* =====================================================
           LOADING
        ===================================================== */

        .zuqen-loading-screen {
          width: 100vw;
          height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 14px;
          background: #07090d;
        }

        .zuqen-logo-mark {
          position: relative;
          width: 58px;
          height: 58px;
          border-radius: 17px;
          display: flex;
          align-items: center;
          justify-content: center;
          background:
            linear-gradient(
              145deg,
              #ffffff,
              #bfc4cb
            );
          color: #080a0e;
          font-size: 27px;
          font-weight: 900;
          letter-spacing: -2px;
          box-shadow:
            0 12px 35px rgba(255, 255, 255, 0.14),
            inset 0 1px 0
              rgba(255, 255, 255, 0.9);
        }

        .zuqen-logo-mark span {
          transform: translateX(-1px);
        }

        .zuqen-logo-mark i {
          position: absolute;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          right: 10px;
          top: 9px;
          background: #07090d;
        }

        .zuqen-logo-mark.large {
          width: 72px;
          height: 72px;
          border-radius: 21px;
          font-size: 34px;
        }

        .zuqen-loading-title {
          font-size: 19px;
          font-weight: 800;
          letter-spacing: 4px;
        }

        .zuqen-loading-dots,
        .typing-dots,
        .credits-loading {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .zuqen-loading-dots span,
        .typing-dots span,
        .credits-loading span {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: currentColor;
          opacity: 0.35;
          animation: zuqenPulse 1.2s
            infinite ease-in-out;
        }

        .zuqen-loading-dots span:nth-child(2),
        .typing-dots span:nth-child(2),
        .credits-loading span:nth-child(2) {
          animation-delay: 0.15s;
        }

        .zuqen-loading-dots span:nth-child(3),
        .typing-dots span:nth-child(3),
        .credits-loading span:nth-child(3) {
          animation-delay: 0.3s;
        }

        @keyframes zuqenPulse {
          0%,
          70%,
          100% {
            transform: scale(0.7);
            opacity: 0.25;
          }

          35% {
            transform: scale(1);
            opacity: 1;
          }
        }

        /* =====================================================
           SIDEBAR
        ===================================================== */

        .zuqen-sidebar {
          width: 318px;
          min-width: 318px;
          height: 100vh;
          display: flex;
          flex-direction: column;
          border-right: 1px solid var(--zuqen-border);
          background: var(--zuqen-sidebar);
          transition:
            width 0.25s ease,
            min-width 0.25s ease,
            transform 0.25s ease;
          z-index: 50;
        }

        .zuqen-sidebar.closed {
          width: 0;
          min-width: 0;
          overflow: hidden;
        }

        .zuqen-sidebar-top {
          padding: 24px 18px 12px;
        }

        .zuqen-brand {
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 2px 8px 24px;
        }

        .zuqen-brand-logo {
          position: relative;
          width: 43px;
          height: 43px;
          flex: 0 0 43px;
          border-radius: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          background:
            linear-gradient(
              145deg,
              #ffffff,
              #c6cbd2
            );
          color: #07090d;
          font-weight: 950;
          font-size: 21px;
          letter-spacing: -2px;
          box-shadow:
            0 8px 24px
              rgba(255, 255, 255, 0.09),
            inset 0 1px 0
              rgba(255, 255, 255, 0.9);
        }

        .zuqen-brand-logo::after {
          content: "";
          position: absolute;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #07090d;
          top: 7px;
          right: 7px;
        }

        .zuqen-brand-name {
          font-size: 18px;
          font-weight: 850;
          letter-spacing: 3px;
          line-height: 1.1;
        }

        .zuqen-brand-ai {
          margin-top: 5px;
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 2px;
          color: var(--zuqen-muted);
        }

        .zuqen-new-chat {
          width: 100%;
          height: 52px;
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 0 13px;
          border-radius: 14px;
          color: var(--zuqen-text);
          background:
            linear-gradient(
              135deg,
              rgba(255, 255, 255, 0.1),
              rgba(255, 255, 255, 0.035)
            );
          border: 1px solid var(--zuqen-border);
          transition: 0.2s ease;
          box-shadow:
            inset 0 1px 0
              rgba(255, 255, 255, 0.04);
        }

        .zuqen-new-chat:hover {
          background: var(--zuqen-hover);
          border-color: var(--zuqen-border-strong);
          transform: translateY(-1px);
        }

        .new-chat-icon {
          width: 31px;
          height: 31px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--zuqen-accent);
          color: var(--zuqen-accent-text);
        }

        .zuqen-new-chat > span:nth-child(2) {
          font-size: 14px;
          font-weight: 650;
          flex: 1;
          text-align: left;
        }

        .zuqen-new-chat kbd {
          color: var(--zuqen-soft);
          font-size: 10px;
          border: 1px solid var(--zuqen-border);
          border-radius: 6px;
          padding: 3px 6px;
        }

        .zuqen-search {
          height: 45px;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 0 13px;
          margin-top: 13px;
          border: 1px solid var(--zuqen-border);
          border-radius: 12px;
          background: var(--zuqen-panel);
          color: var(--zuqen-muted);
        }

        .zuqen-search:focus-within {
          border-color: var(--zuqen-border-strong);
        }

        .zuqen-search input {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: 0;
          color: var(--zuqen-text);
          background: transparent;
          font-size: 13px;
        }

        .zuqen-search input::placeholder {
          color: var(--zuqen-soft);
        }

        .zuqen-search button {
          display: flex;
          color: var(--zuqen-muted);
          background: transparent;
        }

        .zuqen-sidebar-section-title {
          padding: 24px 9px 9px;
          color: var(--zuqen-soft);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1.7px;
        }

        .zuqen-side-nav {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .zuqen-side-nav-item {
          height: 46px;
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 12px;
          border-radius: 11px;
          background: transparent;
          color: var(--zuqen-muted);
          transition: 0.18s ease;
          text-align: left;
        }

        .zuqen-side-nav-item:hover,
        .zuqen-side-nav-item.active {
          color: var(--zuqen-text);
          background: var(--zuqen-hover);
        }

        .zuqen-side-nav-item.active {
          box-shadow:
            inset 2px 0 0
              var(--zuqen-text);
        }

        .zuqen-side-nav-item span {
          flex: 1;
          font-size: 14px;
          font-weight: 650;
        }

        .zuqen-side-nav-item b {
          min-width: 24px;
          text-align: right;
          color: var(--zuqen-soft);
          font-size: 11px;
          font-weight: 600;
        }

        .zuqen-history {
          min-height: 0;
          flex: 1;
          padding: 10px 12px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .zuqen-history-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 11px 7px;
          color: var(--zuqen-soft);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1.6px;
        }

        .zuqen-chat-list {
          min-height: 0;
          flex: 1;
          overflow-y: auto;
          padding-right: 2px;
        }

        .zuqen-chat-list::-webkit-scrollbar {
          width: 4px;
        }

        .zuqen-chat-list::-webkit-scrollbar-thumb {
          background: var(--zuqen-border-strong);
          border-radius: 99px;
        }

        .zuqen-chat-item {
          position: relative;
          min-height: 60px;
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 8px;
          margin-bottom: 3px;
          border-radius: 12px;
          cursor: pointer;
          color: var(--zuqen-muted);
          transition: 0.18s ease;
        }

        .zuqen-chat-item:hover,
        .zuqen-chat-item.active {
          background: var(--zuqen-hover);
          color: var(--zuqen-text);
        }

        .zuqen-chat-item.active {
          box-shadow:
            inset 2px 0 0
              var(--zuqen-text);
        }

        .zuqen-chat-icon {
          width: 34px;
          height: 34px;
          flex: 0 0 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          background: var(--zuqen-panel-2);
          color: var(--zuqen-muted);
        }

        .zuqen-chat-info {
          min-width: 0;
          flex: 1;
        }

        .zuqen-chat-title {
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          color: var(--zuqen-text);
          font-size: 13px;
          font-weight: 600;
        }

        .zuqen-chat-date {
          margin-top: 4px;
          color: var(--zuqen-soft);
          font-size: 10px;
        }

        .zuqen-chat-more {
          width: 29px;
          height: 29px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: transparent;
          color: var(--zuqen-soft);
          opacity: 0;
        }

        .zuqen-chat-item:hover
          .zuqen-chat-more,
        .zuqen-chat-more:focus {
          opacity: 1;
        }

        .zuqen-chat-more:hover {
          color: var(--zuqen-text);
          background: var(--zuqen-hover);
        }

        .zuqen-chat-menu {
          position: absolute;
          z-index: 80;
          right: 8px;
          top: 49px;
          width: 165px;
          padding: 6px;
          border: 1px solid var(--zuqen-border-strong);
          border-radius: 12px;
          background: var(--zuqen-panel);
          box-shadow: var(--zuqen-shadow);
        }

        .zuqen-chat-menu button {
          width: 100%;
          height: 36px;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 0 10px;
          border-radius: 8px;
          color: var(--zuqen-muted);
          background: transparent;
          text-align: left;
          font-size: 12px;
        }

        .zuqen-chat-menu button:hover {
          color: var(--zuqen-text);
          background: var(--zuqen-hover);
        }

        .zuqen-chat-menu button.danger:hover {
          color: var(--zuqen-danger);
        }

        .zuqen-empty-history {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 45px 18px;
          color: var(--zuqen-soft);
        }

        .empty-history-icon {
          width: 48px;
          height: 48px;
          border: 1px solid var(--zuqen-border);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 13px;
          background: var(--zuqen-panel);
        }

        .zuqen-empty-history strong {
          color: var(--zuqen-muted);
          font-size: 13px;
        }

        .zuqen-empty-history span {
          margin-top: 7px;
          line-height: 1.5;
          font-size: 11px;
        }

        .zuqen-sidebar-bottom {
          padding: 12px;
          border-top: 1px solid var(--zuqen-border);
        }

        .zuqen-account {
          height: 57px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 7px;
          border-radius: 13px;
          background: var(--zuqen-panel);
          border: 1px solid var(--zuqen-border);
        }

        .zuqen-account-avatar {
          width: 37px;
          height: 37px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 11px;
          background: var(--zuqen-panel-2);
          color: var(--zuqen-muted);
        }

        .zuqen-account-info {
          min-width: 0;
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .zuqen-account-info strong {
          color: var(--zuqen-text);
          font-size: 12px;
        }

        .zuqen-account-info span {
          margin-top: 3px;
          color: var(--zuqen-soft);
          font-size: 10px;
        }

        .zuqen-account-more {
          display: flex;
          color: var(--zuqen-soft);
          background: transparent;
        }

        /* =====================================================
           MAIN / TOPBAR
        ===================================================== */

        .zuqen-main {
          min-width: 0;
          flex: 1;
          height: 100vh;
          display: flex;
          flex-direction: column;
        }

        .zuqen-topbar {
          height: 78px;
          min-height: 78px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 0 25px;
          border-bottom: 1px solid var(--zuqen-border);
          background: color-mix(
            in srgb,
            var(--zuqen-bg) 88%,
            transparent
          );
          backdrop-filter: blur(22px);
          z-index: 40;
        }

        .zuqen-topbar-left,
        .zuqen-topbar-actions {
          display: flex;
          align-items: center;
        }

        .zuqen-topbar-left {
          gap: 13px;
          min-width: 0;
        }

        .zuqen-topbar-actions {
          gap: 8px;
        }

        .zuqen-icon-button {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 11px;
          background: transparent;
          color: var(--zuqen-muted);
          transition: 0.18s ease;
        }

        .zuqen-icon-button:hover {
          color: var(--zuqen-text);
          background: var(--zuqen-hover);
        }

        .zuqen-top-title {
          min-width: 0;
        }

        .top-title-main {
          max-width: 420px;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          font-size: 16px;
          font-weight: 750;
        }

        .top-title-sub {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 4px;
          color: var(--zuqen-soft);
          font-size: 10px;
        }

        .online-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--zuqen-green);
          box-shadow: 0 0 10px
            rgba(72, 213, 151, 0.65);
        }

        .zuqen-dropdown-wrap {
          position: relative;
        }

        .zuqen-credit-button,
        .zuqen-agent-button {
          height: 40px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 11px;
          border: 1px solid var(--zuqen-border);
          border-radius: 11px;
          color: var(--zuqen-muted);
          background: var(--zuqen-panel);
          transition: 0.18s ease;
        }

        .zuqen-credit-button:hover,
        .zuqen-credit-button.active,
        .zuqen-agent-button:hover,
        .zuqen-agent-button.active {
          color: var(--zuqen-text);
          border-color: var(--zuqen-border-strong);
          background: var(--zuqen-hover);
        }

        .credit-icon {
          width: 25px;
          height: 25px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: var(--zuqen-accent);
          color: var(--zuqen-accent-text);
        }

        .zuqen-credit-button strong {
          color: var(--zuqen-text);
          font-size: 12px;
        }

        .credit-button-label,
        .zuqen-agent-button span {
          font-size: 12px;
          font-weight: 650;
        }

        /* =====================================================
           CREDITS
        ===================================================== */

        .zuqen-credits-panel {
          position: absolute;
          top: calc(100% + 10px);
          right: 0;
          width: 360px;
          padding: 18px;
          border: 1px solid var(--zuqen-border-strong);
          border-radius: 18px;
          background: var(--zuqen-panel);
          box-shadow: var(--zuqen-shadow);
          z-index: 100;
          animation: zuqenDrop 0.18s ease;
        }

        @keyframes zuqenDrop {
          from {
            opacity: 0;
            transform: translateY(-5px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .credits-panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 3px 3px 17px;
        }

        .credits-panel-header span {
          color: var(--zuqen-soft);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1.5px;
        }

        .credits-panel-header h3 {
          margin: 5px 0 0;
          font-size: 29px;
          letter-spacing: -1px;
        }

        .credits-large-icon {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          background: var(--zuqen-panel-2);
          color: var(--zuqen-text);
        }

        .credits-stat-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .credits-stat-row > div {
          padding: 11px;
          border: 1px solid var(--zuqen-border);
          border-radius: 11px;
          background: var(--zuqen-bg);
        }

        .credits-stat-row span {
          display: block;
          color: var(--zuqen-soft);
          font-size: 10px;
        }

        .credits-stat-row strong {
          display: block;
          margin-top: 4px;
          font-size: 14px;
        }

        .credits-progress {
          height: 5px;
          margin: 13px 1px 18px;
          border-radius: 99px;
          overflow: hidden;
          background: var(--zuqen-panel-2);
        }

        .credits-progress > div {
          height: 100%;
          border-radius: inherit;
          background: var(--zuqen-accent);
          transition: width 0.3s ease;
        }

        .credits-section-title {
          margin: 4px 3px 9px;
          color: var(--zuqen-soft);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1.4px;
        }

        .credits-features {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .credit-feature {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px;
          border-radius: 10px;
        }

        .credit-feature:hover {
          background: var(--zuqen-hover);
        }

        .credit-feature-icon {
          width: 31px;
          height: 31px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          background: var(--zuqen-panel-2);
          color: var(--zuqen-muted);
        }

        .credit-feature-main {
          flex: 1;
          min-width: 0;
        }

        .credit-feature-main > div:first-child {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .credit-feature-main span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--zuqen-muted);
          font-size: 11px;
        }

        .credit-feature-main strong {
          color: var(--zuqen-text);
          font-size: 11px;
        }

        .credit-feature-bar {
          height: 3px;
          margin-top: 6px;
          overflow: hidden;
          border-radius: 99px;
          background: var(--zuqen-panel-2);
        }

        .credit-feature-bar div {
          height: 100%;
          border-radius: inherit;
          background: var(--zuqen-text);
        }

        .credit-warning {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 13px;
          padding: 10px;
          border-radius: 10px;
          color: #ffbdc5;
          background: rgba(255, 107, 122, 0.08);
          border: 1px solid
            rgba(255, 107, 122, 0.15);
          font-size: 11px;
        }

        .get-credit-button {
          width: 100%;
          height: 43px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 13px;
          border-radius: 11px;
          background: var(--zuqen-accent);
          color: var(--zuqen-accent-text);
          font-size: 12px;
          font-weight: 750;
          transition: 0.18s ease;
        }

        .get-credit-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 25px
            rgba(255, 255, 255, 0.08);
        }

        /* =====================================================
           AGENT DROPDOWN
        ===================================================== */

        .zuqen-agent-dropdown {
          position: absolute;
          top: calc(100% + 10px);
          right: 0;
          width: 245px;
          padding: 6px;
          border: 1px solid var(--zuqen-border-strong);
          border-radius: 14px;
          background: var(--zuqen-panel);
          box-shadow: var(--zuqen-shadow);
          z-index: 100;
          animation: zuqenDrop 0.18s ease;
        }

        .zuqen-agent-dropdown button {
          width: 100%;
          height: 43px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 9px;
          border-radius: 9px;
          background: transparent;
          color: var(--zuqen-muted);
          text-align: left;
          font-size: 12px;
        }

        .zuqen-agent-dropdown button:hover,
        .zuqen-agent-dropdown button.selected {
          color: var(--zuqen-text);
          background: var(--zuqen-hover);
        }

        .zuqen-agent-dropdown button > span:nth-child(2) {
          flex: 1;
        }

        .agent-option-icon {
          width: 29px;
          height: 29px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: var(--zuqen-panel-2);
        }

        /* =====================================================
           CHAT
        ===================================================== */

        .zuqen-chat-area {
          min-height: 0;
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .zuqen-chat-scroll {
          min-height: 0;
          flex: 1;
          overflow-y: auto;
          scroll-behavior: smooth;
        }

        .zuqen-chat-scroll::-webkit-scrollbar {
          width: 6px;
        }

        .zuqen-chat-scroll::-webkit-scrollbar-thumb {
          background: var(--zuqen-border-strong);
          border-radius: 99px;
        }

        /* =====================================================
           WELCOME
        ===================================================== */

        .zuqen-welcome {
          position: relative;
          width: min(980px, calc(100% - 60px));
          min-height: calc(100% - 20px);
          margin: auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 80px 20px;
        }

        .welcome-glow {
          position: absolute;
          width: 500px;
          height: 300px;
          top: 15%;
          left: 50%;
          transform: translateX(-50%);
          background: radial-gradient(
            ellipse,
            rgba(255, 255, 255, 0.045),
            transparent 65%
          );
          pointer-events: none;
        }

        .welcome-logo {
          position: relative;
          margin-bottom: 24px;
        }

        .welcome-logo .zuqen-logo-mark {
          width: 72px;
          height: 72px;
          border-radius: 21px;
          font-size: 34px;
          box-shadow:
            0 25px 60px
              rgba(255, 255, 255, 0.08),
            inset 0 1px 0
              rgba(255, 255, 255, 0.9);
        }

        .welcome-eyebrow {
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--zuqen-soft);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 2.5px;
        }

        .welcome-line {
          width: 28px;
          height: 1px;
          background: var(--zuqen-border-strong);
        }

        .zuqen-welcome h1 {
          margin: 18px 0 15px;
          font-size: clamp(45px, 6vw, 72px);
          line-height: 0.98;
          letter-spacing: -4px;
          font-weight: 820;
        }

        .zuqen-welcome h1 em {
          font-style: normal;
          color: var(--zuqen-muted);
        }

        .zuqen-welcome > p {
          width: min(620px, 100%);
          margin: 0;
          color: var(--zuqen-muted);
          font-size: 15px;
          line-height: 1.75;
        }

        .welcome-suggestions {
          width: min(840px, 100%);
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-top: 38px;
        }

        .welcome-suggestions button {
          min-height: 88px;
          display: flex;
          align-items: flex-start;
          gap: 11px;
          padding: 16px;
          border: 1px solid var(--zuqen-border);
          border-radius: 14px;
          background: var(--zuqen-panel);
          color: var(--zuqen-muted);
          text-align: left;
          transition: 0.2s ease;
        }

        .welcome-suggestions button:hover {
          color: var(--zuqen-text);
          border-color: var(--zuqen-border-strong);
          transform: translateY(-2px);
          box-shadow: var(--zuqen-shadow);
        }

        .welcome-suggestions button span {
          flex: 1;
          color: var(--zuqen-text);
          font-size: 12px;
          font-weight: 650;
          line-height: 1.45;
        }

        .welcome-suggestions small {
          color: var(--zuqen-soft);
          font-size: 17px;
        }

        /* =====================================================
           MESSAGES
        ===================================================== */

        .zuqen-messages {
          width: min(1120px, calc(100% - 70px));
          margin: 0 auto;
          padding: 46px 0 165px;
        }

        .zuqen-message-row {
          width: 100%;
          display: flex;
          margin-bottom: 34px;
        }

        .zuqen-message-row.user-message {
          justify-content: flex-start;
        }

        .zuqen-message-row.ai-message {
          justify-content: flex-end;
        }

        .zuqen-message-wrapper {
          width: min(82%, 850px);
          display: flex;
          flex-direction: column;
        }

        .user-message .zuqen-message-wrapper {
          align-items: flex-start;
        }

        .ai-message .zuqen-message-wrapper {
          align-items: flex-end;
        }

        .message-author {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0 5px 8px;
          color: var(--zuqen-muted);
          font-size: 11px;
          font-weight: 750;
        }

        .ai-message .message-author {
          justify-content: flex-end;
        }

        .author-avatar {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
        }

        .user-avatar {
          background: var(--zuqen-panel-2);
          color: var(--zuqen-text);
          font-size: 10px;
          font-weight: 850;
        }

        .ai-avatar {
          background: var(--zuqen-accent);
          color: var(--zuqen-accent-text);
        }

        .mini-z-logo {
          position: relative;
          width: 22px;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 950;
          font-size: 12px;
          letter-spacing: -1px;
        }

        .mini-z-logo i {
          position: absolute;
          width: 4px;
          height: 4px;
          right: 1px;
          top: 2px;
          border-radius: 50%;
          background: currentColor;
        }

        .ai-status {
          padding: 3px 6px;
          border-radius: 5px;
          color: var(--zuqen-soft);
          background: var(--zuqen-panel-2);
          font-size: 8px;
          letter-spacing: 0.5px;
        }

        .zuqen-message-card {
          position: relative;
          padding: 17px 19px;
          border-radius: 18px;
          border: 1px solid var(--zuqen-border);
          box-shadow: 0 8px 30px
            rgba(0, 0, 0, 0.08);
        }

        .user-card {
          max-width: 82%;
          color: var(--zuqen-text);
          background:
            linear-gradient(
              135deg,
              rgba(255, 255, 255, 0.075),
              rgba(255, 255, 255, 0.035)
            );
          border-top-left-radius: 6px;
        }

        .ai-card {
          width: 100%;
          color: var(--zuqen-text);
          background: var(--zuqen-panel);
          border-top-right-radius: 6px;
        }

        .message-content {
          white-space: pre-wrap;
          word-break: break-word;
          font-size: 15px;
          line-height: 1.75;
        }

        .ai-card .message-content {
          font-size: 15px;
          line-height: 1.8;
        }

        .message-attachments {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 13px;
        }

        .message-attachment {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 7px 9px;
          border-radius: 9px;
          background: var(--zuqen-panel-2);
          color: var(--zuqen-muted);
          font-size: 10px;
        }

        .message-attachment span {
          max-width: 180px;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .message-attachment small {
          color: var(--zuqen-soft);
        }

        .message-actions {
          display: flex;
          gap: 3px;
          margin-top: 7px;
          opacity: 0;
          transition: 0.18s ease;
        }

        .zuqen-message-wrapper:hover
          .message-actions {
          opacity: 1;
        }

        .message-actions button {
          min-height: 29px;
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 0 8px;
          border-radius: 7px;
          color: var(--zuqen-soft);
          background: transparent;
          font-size: 10px;
        }

        .message-actions button:hover {
          color: var(--zuqen-text);
          background: var(--zuqen-hover);
        }

        .message-actions button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        /* =====================================================
           THINKING
        ===================================================== */

        .ai-thinking {
          display: flex;
          align-items: center;
          gap: 13px;
          min-height: 62px;
        }

        .thinking-orb {
          position: relative;
          width: 40px;
          height: 40px;
          flex: 0 0 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 3px;
          border-radius: 13px;
          background: var(--zuqen-panel-2);
          overflow: hidden;
        }

        .thinking-orb::before {
          content: "";
          position: absolute;
          inset: -20px;
          background: conic-gradient(
            transparent,
            rgba(255, 255, 255, 0.8),
            transparent
          );
          animation: zuqenSpin 1.5s linear infinite;
        }

        .thinking-orb span {
          position: relative;
          z-index: 2;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: var(--zuqen-text);
          animation: zuqenThinking 1s
            infinite ease-in-out;
        }

        .thinking-orb span:nth-child(2) {
          animation-delay: 0.15s;
        }

        .thinking-orb span:nth-child(3) {
          animation-delay: 0.3s;
        }

        @keyframes zuqenSpin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes zuqenThinking {
          0%,
          100% {
            transform: translateY(2px);
            opacity: 0.35;
          }

          50% {
            transform: translateY(-3px);
            opacity: 1;
          }
        }

        .ai-thinking strong {
          display: block;
          font-size: 12px;
        }

        .ai-thinking p {
          margin: 4px 0 0;
          color: var(--zuqen-muted);
          font-size: 11px;
        }

        .zuqen-ai-typing {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 9px;
          margin-top: 10px;
        }

        .typing-avatar {
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          background: var(--zuqen-accent);
          color: var(--zuqen-accent-text);
          animation: zuqenFloat 1.2s
            infinite ease-in-out;
        }

        @keyframes zuqenFloat {
          0%,
          100% {
            transform: translateY(0);
          }

          50% {
            transform: translateY(-4px);
          }
        }

        .typing-content {
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--zuqen-muted);
          font-size: 11px;
        }

        /* =====================================================
           COMPOSER
        ===================================================== */

        .zuqen-composer-area {
          position: absolute;
          left: 318px;
          right: 0;
          bottom: 0;
          z-index: 30;
          padding: 0 24px 18px;
          pointer-events: none;
        }

        .zuqen-sidebar.closed
          ~ .zuqen-main
          .zuqen-composer-area {
          left: 0;
        }

        .zuqen-composer-container {
          width: min(980px, 100%);
          margin: auto;
          pointer-events: auto;
        }

        .editing-banner {
          height: 39px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 11px;
          margin-bottom: 6px;
          border: 1px solid var(--zuqen-border);
          border-radius: 10px 10px 0 0;
          background: var(--zuqen-panel);
          color: var(--zuqen-muted);
          font-size: 11px;
        }

        .editing-banner > div {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .editing-banner button {
          display: flex;
          align-items: center;
          gap: 5px;
          color: var(--zuqen-soft);
          background: transparent;
          font-size: 10px;
        }

        .attachment-preview-row {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-bottom: 7px;
        }

        .attachment-preview {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 7px 9px;
          border: 1px solid var(--zuqen-border);
          border-radius: 10px;
          background: var(--zuqen-panel);
          box-shadow: var(--zuqen-shadow);
        }

        .attachment-preview-icon {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: var(--zuqen-panel-2);
          color: var(--zuqen-muted);
        }

        .attachment-preview div:nth-child(2) {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .attachment-preview strong {
          max-width: 150px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--zuqen-text);
          font-size: 10px;
        }

        .attachment-preview small {
          margin-top: 2px;
          color: var(--zuqen-soft);
          font-size: 9px;
        }

        .attachment-preview button {
          display: flex;
          color: var(--zuqen-soft);
          background: transparent;
        }

        .zuqen-composer {
          padding: 13px 14px 10px;
          border: 1px solid var(--zuqen-border-strong);
          border-radius: 19px;
          background:
            linear-gradient(
              145deg,
              color-mix(
                in srgb,
                var(--zuqen-panel) 94%,
                transparent
              ),
              var(--zuqen-bg-2)
            );
          box-shadow:
            0 20px 55px
              rgba(0, 0, 0, 0.22),
            inset 0 1px 0
              rgba(255, 255, 255, 0.035);
          backdrop-filter: blur(24px);
        }

        .zuqen-composer textarea {
          display: block;
          width: 100%;
          min-height: 54px;
          max-height: 240px;
          resize: none;
          border: 0;
          outline: 0;
          background: transparent;
          color: var(--zuqen-text);
          font-size: 15px;
          line-height: 1.65;
          padding: 3px 2px 9px;
        }

        .zuqen-composer textarea::placeholder {
          color: var(--zuqen-soft);
        }

        .zuqen-composer textarea:disabled {
          opacity: 0.55;
        }

        .composer-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .composer-tools,
        .composer-right {
          display: flex;
          align-items: center;
        }

        .composer-tools {
          gap: 2px;
        }

        .composer-tools button {
          height: 33px;
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 0 9px;
          border-radius: 8px;
          background: transparent;
          color: var(--zuqen-muted);
          font-size: 10px;
          font-weight: 600;
        }

        .composer-tools button:hover {
          color: var(--zuqen-text);
          background: var(--zuqen-hover);
        }

        .composer-right {
          gap: 10px;
        }

        .composer-hint {
          color: var(--zuqen-soft);
          font-size: 9px;
        }

        .zuqen-send {
          width: 39px;
          height: 39px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 11px;
          background: var(--zuqen-panel-2);
          color: var(--zuqen-soft);
          transition: 0.2s ease;
        }

        .zuqen-send.ready {
          color: var(--zuqen-accent-text);
          background: var(--zuqen-accent);
        }

        .zuqen-send.ready:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 20px
            rgba(255, 255, 255, 0.09);
        }

        .zuqen-send:disabled {
          cursor: not-allowed;
        }

        .send-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid
            currentColor;
          border-right-color: transparent;
          border-radius: 50%;
          animation: zuqenSpin 0.7s linear infinite;
        }

        .composer-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 8px 4px 0;
          color: var(--zuqen-soft);
          font-size: 8px;
        }

        .composer-security {
          display: flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
        }

        /* =====================================================
           MOBILE
        ===================================================== */

        .zuqen-mobile-overlay {
          display: none;
        }

        @media (max-width: 1050px) {
          .zuqen-sidebar {
            width: 285px;
            min-width: 285px;
          }

          .zuqen-composer-area {
            left: 285px;
          }

          .zuqen-message-wrapper {
            width: min(88%, 850px);
          }
        }

        @media (max-width: 780px) {
          .zuqen-sidebar {
            position: fixed;
            left: 0;
            top: 0;
            bottom: 0;
            width: 300px;
            min-width: 300px;
            transform: translateX(0);
            box-shadow: 20px 0 60px
              rgba(0, 0, 0, 0.35);
          }

          .zuqen-sidebar.closed {
            width: 300px;
            min-width: 300px;
            transform: translateX(-105%);
          }

          .zuqen-mobile-overlay {
            position: fixed;
            inset: 0;
            display: block;
            z-index: 45;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(3px);
          }

          .zuqen-topbar {
            height: 67px;
            min-height: 67px;
            padding: 0 13px;
          }

          .top-title-main {
            max-width: 170px;
            font-size: 14px;
          }

          .zuqen-agent-button span {
            display: none;
          }

          .zuqen-agent-button {
            width: 40px;
            justify-content: center;
            padding: 0;
          }

          .zuqen-agent-button svg:last-child {
            display: none;
          }

          .credit-button-label {
            display: none;
          }

          .zuqen-credit-button {
            padding: 0 8px;
          }

          .zuqen-composer-area,
          .zuqen-sidebar.closed
            ~ .zuqen-main
            .zuqen-composer-area {
            left: 0;
            padding: 0 10px 9px;
          }

          .zuqen-messages {
            width: calc(100% - 24px);
            padding-top: 25px;
            padding-bottom: 155px;
          }

          .zuqen-message-wrapper {
            width: 94%;
          }

          .user-card {
            max-width: 92%;
          }

          .message-content,
          .ai-card .message-content {
            font-size: 14px;
          }

          .zuqen-welcome {
            width: calc(100% - 30px);
            padding: 50px 10px;
          }

          .zuqen-welcome h1 {
            font-size: 45px;
            letter-spacing: -2.5px;
          }

          .zuqen-welcome > p {
            font-size: 13px;
          }

          .welcome-suggestions {
            grid-template-columns: 1fr;
            width: min(430px, 100%);
          }

          .zuqen-credits-panel {
            position: fixed;
            top: 72px;
            right: 10px;
            left: 10px;
            width: auto;
            max-height: calc(100vh - 90px);
            overflow-y: auto;
          }

          .composer-hint {
            display: none;
          }

          .composer-footer {
            font-size: 7px;
          }

          .composer-security {
            display: none;
          }
        }

        @media (max-width: 480px) {
          .zuqen-topbar-actions {
            gap: 2px;
          }

          .zuqen-topbar-left {
            gap: 5px;
          }

          .zuqen-top-title {
            display: none;
          }

          .zuqen-message-wrapper {
            width: 96%;
          }

          .zuqen-message-row {
            margin-bottom: 25px;
          }

          .zuqen-message-card {
            padding: 14px;
          }

          .zuqen-welcome h1 {
            font-size: 39px;
          }

          .zuqen-welcome > p {
            font-size: 12px;
          }

          .composer-tools button span {
            display: none;
          }

          .composer-tools button {
            width: 35px;
            padding: 0;
            justify-content: center;
          }

          .zuqen-composer {
            border-radius: 16px;
          }
        }
      `}</style>
    </div>
  );
}