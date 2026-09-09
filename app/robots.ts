"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase";

type Attachment = {
  name: string;
  size: number;
  type: string;
  url?: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
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

const supabase = createClient();

const AGENTS = [
  {
    key: "chat",
    name: "AI Chat",
    description: "Talk with ZUQEN AI",
    icon: "✦",
    href: "/",
  },
  {
    key: "website_builder",
    name: "Website Builder",
    description: "Build websites with AI",
    icon: "◫",
    href: "/website-builder",
  },
  {
    key: "image_generator",
    name: "Image Generator",
    description: "Create images with AI",
    icon: "◉",
    href: "/image-generator",
  },
  {
    key: "video_generator",
    name: "Video Generator",
    description: "Generate AI videos",
    icon: "▶",
    href: "/video-generator",
  },
  {
    key: "voice_generator",
    name: "Voice Generator",
    description: "Generate AI voices",
    icon: "◖",
    href: "/generate-voice",
  },
];

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

function formatFileSize(bytes: number) {
  if (!bytes) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );

  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${
    units[index]
  }`;
}

function formatTime(date: string) {
  const value = new Date(date);

  if (Number.isNaN(value.getTime())) return "";

  return value.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Icon({
  name,
  size = 18,
}: {
  name: string;
  size?: number;
}) {
  const icons: Record<string, string> = {
    plus: "＋",
    search: "⌕",
    archive: "▱",
    restore: "↩",
    trash: "⌫",
    more: "•••",
    edit: "✎",
    copy: "▣",
    refresh: "↻",
    send: "➤",
    paperclip: "⌕",
    close: "×",
    chevron: "⌄",
    moon: "☾",
    sun: "☼",
    menu: "☰",
    chat: "◌",
    spark: "✦",
    user: "○",
    folder: "▰",
    check: "✓",
  };

  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        fontSize: size * 0.9,
        lineHeight: 1,
      }}
    >
      {icons[name] ?? "•"}
    </span>
  );
}

export default function HomePage() {
  const [user, setUser] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);

  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebar, setSidebar] = useState(true);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

  const [lightMode, setLightMode] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);

  const [selectedAgent, setSelectedAgent] = useState("chat");

  const [featureCredits, setFeatureCredits] = useState<FeatureCredit[]>([]);
  const [creditsLoading, setCreditsLoading] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(
    null
  );
  const [editingMessageText, setEditingMessageText] = useState("");

  const [mobileSidebar, setMobileSidebar] = useState(false);

  const mountedRef = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeChats = useMemo(
    () =>
      chats
        .filter((chat) => !chat.archived)
        .sort(
          (a, b) =>
            new Date(b.updated_at).getTime() -
            new Date(a.updated_at).getTime()
        ),
    [chats]
  );

  const archivedChats = useMemo(
    () =>
      chats
        .filter((chat) => chat.archived)
        .sort(
          (a, b) =>
            new Date(b.updated_at).getTime() -
            new Date(a.updated_at).getTime()
        ),
    [chats]
  );

  const filteredChats = useMemo(() => {
    const source = archiveOpen ? archivedChats : activeChats;

    if (!searchQuery.trim()) return source;

    const query = searchQuery.toLowerCase();

    return source.filter((chat) =>
      chat.title.toLowerCase().includes(query)
    );
  }, [
    archiveOpen,
    archivedChats,
    activeChats,
    searchQuery,
  ]);

  const totalCredits = useMemo(
    () =>
      featureCredits.reduce(
        (total, item) => total + Number(item.balance || 0),
        0
      ),
    [featureCredits]
  );

  const chatCredits = useMemo(
    () =>
      Number(
        featureCredits.find((item) => item.feature_key === "chat")
          ?.balance || 0
      ),
    [featureCredits]
  );

  const selectedAgentData =
    AGENTS.find((agent) => agent.key === selectedAgent) ?? AGENTS[0];

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("zuqen-light", lightMode);

    return () => {
      document.documentElement.classList.remove("zuqen-light");
    };
  }, [lightMode]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      if (!target.closest("[data-zuqen-menu]")) {
        setMenuOpen(null);
      }

      if (!target.closest("[data-zuqen-agent]")) {
        setAgentOpen(false);
      }

      if (!target.closest("[data-zuqen-credits]")) {
        setCreditsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      bottomRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }, 40);

    return () => window.clearTimeout(timer);
  }, [messages, loading]);

  useEffect(() => {
    if (!textareaRef.current) return;

    textareaRef.current.style.height = "auto";

    const nextHeight = Math.min(
      Math.max(textareaRef.current.scrollHeight, 58),
      220
    );

    textareaRef.current.style.height = `${nextHeight}px`;
  }, [input]);

  const loadFeatureCredits = useCallback(async (userId: string) => {
    if (!userId) return;

    setCreditsLoading(true);

    try {
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
        console.error("Feature credits error:", error);
        return;
      }

      const normalized: FeatureCredit[] = (data ?? []).map((item: any) => ({
        feature_key: item.feature_key,
        feature_name:
          item.provider_features?.feature_name ?? item.feature_key,
        provider: item.provider_features?.provider ?? "unknown",
        balance: Number(item.balance ?? 0),
        total_granted: Number(item.total_granted ?? 0),
        total_used: Number(item.total_used ?? 0),
      }));

      if (mountedRef.current) {
        setFeatureCredits(normalized);
      }
    } finally {
      if (mountedRef.current) {
        setCreditsLoading(false);
      }
    }
  }, []);

  const loadChats = useCallback(async (userId: string) => {
    if (!userId) return;

    const { data, error } = await supabase
      .from("chats")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Chats loading error:", error);
      return;
    }

    if (mountedRef.current) {
      setChats((data ?? []) as Chat[]);
    }
  }, []);

  const loadMessages = useCallback(
    async (chatId: string) => {
      if (!chatId || !user?.id) return;

      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("chat_id", chatId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Messages loading error:", error);
        return;
      }

      if (mountedRef.current) {
        setMessages((data ?? []) as Message[]);
      }
    },
    [user]
  );

  const initializeUser = useCallback(async () => {
    try {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      let finalUser = currentUser;

      if (!finalUser) {
        const { data, error } =
          await supabase.auth.signInAnonymously();

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

      if (!mountedRef.current) return;

      setUser(finalUser);

      await Promise.all([
        loadChats(finalUser.id),
        loadFeatureCredits(finalUser.id),
      ]);
    } catch (error) {
      console.error("User initialization failed:", error);
    } finally {
      if (mountedRef.current) {
        setAuthReady(true);
      }
    }
  }, [loadChats, loadFeatureCredits]);

  useEffect(() => {
    initializeUser();
  }, [initializeUser]);

  const createChat = useCallback(async () => {
    if (!user?.id) return null;

    const { data, error } = await supabase
      .from("chats")
      .insert({
        user_id: user.id,
        title: "New conversation",
        archived: false,
      })
      .select()
      .single();

    if (error) {
      console.error("Create chat error:", error);
      return null;
    }

    const newChat = data as Chat;

    setChats((previous) => [newChat, ...previous]);
    setActiveChat(newChat);
    setMessages([]);
    setArchiveOpen(false);
    setMobileSidebar(false);
    setInput("");

    return newChat;
  }, [user]);

  const openChat = async (chat: Chat) => {
    setActiveChat(chat);
    setMenuOpen(null);
    setArchiveOpen(chat.archived);
    setMobileSidebar(false);

    // Important:
    // clear old messages first so another chat's messages
    // cannot remain visible while the new chat loads.
    setMessages([]);

    await loadMessages(chat.id);
  };

  const updateChatTitle = async (
    chatId: string,
    title: string
  ) => {
    if (!user?.id) return;

    const cleanTitle =
      title.trim().slice(0, 120) || "New conversation";

    const { data, error } = await supabase
      .from("chats")
      .update({
        title: cleanTitle,
        updated_at: new Date().toISOString(),
      })
      .eq("id", chatId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Rename chat error:", error);
      return;
    }

    const updatedChat = data as Chat;

    setChats((previous) =>
      previous.map((chat) =>
        chat.id === chatId ? updatedChat : chat
      )
    );

    if (activeChat?.id === chatId) {
      setActiveChat(updatedChat);
    }

    setEditingChatId(null);
    setEditingTitle("");
    setMenuOpen(null);
  };

  const archiveChat = async (chat: Chat) => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from("chats")
      .update({
        archived: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", chat.id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Archive chat error:", error);
      return;
    }

    const updated = data as Chat;

    setChats((previous) =>
      previous.map((item) =>
        item.id === chat.id ? updated : item
      )
    );

    if (activeChat?.id === chat.id) {
      setActiveChat(null);
      setMessages([]);
    }

    setMenuOpen(null);
  };

  const restoreChat = async (chat: Chat) => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from("chats")
      .update({
        archived: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", chat.id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Restore chat error:", error);
      return;
    }

    const updated = data as Chat;

    setChats((previous) =>
      previous.map((item) =>
        item.id === chat.id ? updated : item
      )
    );

    setArchiveOpen(false);
    setMenuOpen(null);
  };

  const deleteChat = async (chat: Chat) => {
    if (!user?.id) return;

    const confirmed = window.confirm(
      `Delete "${chat.title}"?\n\nThis will permanently delete the conversation and its messages.`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("chats")
      .delete()
      .eq("id", chat.id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Delete chat error:", error);
      return;
    }

    setChats((previous) =>
      previous.filter((item) => item.id !== chat.id)
    );

    if (activeChat?.id === chat.id) {
      setActiveChat(null);
      setMessages([]);
    }

    setMenuOpen(null);
  };

  const startRename = (chat: Chat) => {
    setEditingChatId(chat.id);
    setEditingTitle(chat.title);
    setMenuOpen(null);
  };

  const saveRename = async (chat: Chat) => {
    await updateChatTitle(chat.id, editingTitle);
  };

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files ?? []);

    if (!files.length) return;

    setUploading(true);

    const nextAttachments: Attachment[] = files.map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type,
    }));

    setAttachments((previous) => [
      ...previous,
      ...nextAttachments,
    ]);

    setUploading(false);

    event.target.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((previous) =>
      previous.filter((_, itemIndex) => itemIndex !== index)
    );
  };

  const saveMessage = async ({
    chatId,
    role,
    content,
    messageAttachments = [],
  }: {
    chatId: string;
    role: "user" | "assistant";
    content: string;
    messageAttachments?: Attachment[];
  }) => {
    if (!user?.id) return null;

    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
        chat_id: chatId,
        user_id: user.id,
        role,
        content,
        attachments: messageAttachments,
      })
      .select()
      .single();

    if (error) {
      console.error("Save message error:", error);
      return null;
    }

    return data as Message;
  };

  const touchChat = async (
    chatId: string,
    title?: string
  ) => {
    if (!user?.id) return;

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (title?.trim()) {
      updateData.title = title.trim().slice(0, 120);
    }

    const { data, error } = await supabase
      .from("chats")
      .update(updateData)
      .eq("id", chatId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Touch chat error:", error);
      return;
    }

    const updatedChat = data as Chat;

    setChats((previous) =>
      previous.map((chat) =>
        chat.id === chatId ? updatedChat : chat
      )
    );

    if (activeChat?.id === chatId) {
      setActiveChat(updatedChat);
    }
  };

  const sendMessage = async () => {
    const text = input.trim();

    if (!text || loading || !user?.id) return;

    let chat = activeChat;

    if (!chat) {
      chat = await createChat();

      if (!chat) {
        return;
      }
    }

    const currentAttachments = [...attachments];

    setInput("");
    setAttachments([]);
    setLoading(true);

    const temporaryUserMessage: Message = {
      id: `temp-user-${Date.now()}`,
      role: "user",
      content: text,
      attachments: currentAttachments,
      created_at: new Date().toISOString(),
    };

    setMessages((previous) => [
      ...previous,
      temporaryUserMessage,
    ]);

    const savedUserMessage = await saveMessage({
      chatId: chat.id,
      role: "user",
      content: text,
      messageAttachments: currentAttachments,
    });

    if (!savedUserMessage) {
      setMessages((previous) =>
        previous.filter(
          (message) => message.id !== temporaryUserMessage.id
        )
      );

      setLoading(false);
      return;
    }

    setMessages((previous) =>
      previous.map((message) =>
        message.id === temporaryUserMessage.id
          ? savedUserMessage
          : message
      )
    );

    const currentMessages = [
      ...messages,
      savedUserMessage,
    ].map((message) => ({
      role: message.role,
      content: message.content,
    }));

    const title =
      chat.title === "New conversation"
        ? text.slice(0, 55)
        : undefined;

    if (title) {
      await touchChat(chat.id, title);
    } else {
      await touchChat(chat.id);
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: currentMessages,
          attachments: currentAttachments,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();

        throw new Error(
          errorText || `Request failed with ${response.status}`
        );
      }

      if (!response.body) {
        throw new Error("AI response body is empty.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = "";
      let assistantText = "";

      const tempAssistantId = `temp-assistant-${Date.now()}`;

      setMessages((previous) => [
        ...previous,
        {
          id: tempAssistantId,
          role: "assistant",
          content: "",
          attachments: [],
          created_at: new Date().toISOString(),
        },
      ]);

      while (true) {
        const { value, done } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, {
          stream: true,
        });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const rawLine of lines) {
          const line = rawLine.trim();

          if (!line.startsWith("data:")) continue;

          const payload = line.slice(5).trim();

          if (!payload || payload === "[DONE]") continue;

          try {
            const parsed = JSON.parse(payload);

            const delta =
              parsed.delta ??
              parsed.content ??
              parsed.text ??
              parsed.message?.content ??
              "";

            if (typeof delta === "string" && delta) {
              assistantText += delta;

              setMessages((previous) =>
                previous.map((message) =>
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
            // Some providers can split SSE JSON between chunks.
            // The buffer will receive the next complete payload.
          }
        }
      }

      if (!assistantText.trim()) {
        throw new Error("ZUQEN AI returned an empty response.");
      }

      const savedAssistantMessage = await saveMessage({
        chatId: chat.id,
        role: "assistant",
        content: assistantText,
      });

      if (!savedAssistantMessage) {
        throw new Error(
          "AI response was generated but could not be saved."
        );
      }

      setMessages((previous) =>
        previous.map((message) =>
          message.id === tempAssistantId
            ? savedAssistantMessage
            : message
        )
      );

      await touchChat(chat.id);

      await Promise.all([
        loadFeatureCredits(user.id),
        loadChats(user.id),
      ]);
    } catch (error) {
      console.error("Send message error:", error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : "Something went wrong.";

      const errorText =
        "Sorry, I couldn't complete that request. Please try again.";

      setMessages((previous) =>
        previous.filter(
          (message) =>
            !message.id.startsWith("temp-assistant-")
        )
      );

      const savedErrorMessage = await saveMessage({
        chatId: chat!.id,
        role: "assistant",
        content: errorText,
      });

      if (savedErrorMessage) {
        setMessages((previous) => [
          ...previous,
          savedErrorMessage,
        ]);
      }

      console.error(errorMessage);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  const copyMessage = async (message: Message) => {
    try {
      await navigator.clipboard.writeText(message.content);

      setCopiedId(message.id);

      window.setTimeout(() => {
        setCopiedId((current) =>
          current === message.id ? null : current
        );
      }, 1500);
    } catch (error) {
      console.error("Copy failed:", error);
    }
  };

  const startMessageEdit = (message: Message) => {
    setEditingMessageId(message.id);
    setEditingMessageText(message.content);
  };

  const cancelMessageEdit = () => {
    setEditingMessageId(null);
    setEditingMessageText("");
  };

  const saveMessageEdit = async (message: Message) => {
    if (!user?.id) return;

    const content = editingMessageText.trim();

    if (!content) return;

    const { data, error } = await supabase
      .from("chat_messages")
      .update({
        content,
      })
      .eq("id", message.id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Edit message error:", error);
      return;
    }

    const updated = data as Message;

    setMessages((previous) =>
      previous.map((item) =>
        item.id === message.id ? updated : item
      )
    );

    setEditingMessageId(null);
    setEditingMessageText("");
  };

  const regenerate = async (message: Message) => {
    if (!activeChat || loading) return;

    const messageIndex = messages.findIndex(
      (item) => item.id === message.id
    );

    if (messageIndex === -1) return;

    const beforeMessage = messages.slice(0, messageIndex);

    const lastUserMessage = [...beforeMessage]
      .reverse()
      .find((item) => item.role === "user");

    if (!lastUserMessage) return;

    setMessages(beforeMessage);
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: beforeMessage.map((item) => ({
            role: item.role,
            content: item.content,
          })),
          attachments: lastUserMessage.attachments ?? [],
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Regeneration failed.");
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

        for (const rawLine of lines) {
          const line = rawLine.trim();

          if (!line.startsWith("data:")) continue;

          const payload = line.slice(5).trim();

          if (!payload || payload === "[DONE]") continue;

          try {
            const parsed = JSON.parse(payload);

            const delta =
              parsed.delta ??
              parsed.content ??
              parsed.text ??
              "";

            if (typeof delta === "string") {
              assistantText += delta;
            }
          } catch {
            // Ignore incomplete SSE chunks.
          }
        }
      }

      if (!assistantText.trim()) {
        throw new Error("Empty regenerated response.");
      }

      const saved = await saveMessage({
        chatId: activeChat.id,
        role: "assistant",
        content: assistantText,
      });

      if (saved) {
        setMessages((previous) => [
          ...previous,
          saved,
        ]);
      }

      await Promise.all([
        loadFeatureCredits(user.id),
        loadChats(user.id),
      ]);
    } catch (error) {
      console.error("Regenerate error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const selectAgent = (agent: typeof AGENTS[number]) => {
    setSelectedAgent(agent.key);
    setAgentOpen(false);

    if (agent.key !== "chat") {
      window.location.href = agent.href;
    }
  };

  const startNewConversation = () => {
    setActiveChat(null);
    setMessages([]);
    setInput("");
    setAttachments([]);
    setArchiveOpen(false);
    setMobileSidebar(false);
  };

  if (!authReady) {
    return (
      <>
        <style>{styles}</style>

        <main className="zuqen-loading">
          <div className="zuqen-loading-mark">Z</div>

          <div className="zuqen-loading-title">
            ZUQEN
          </div>

          <div className="zuqen-loading-dots">
            <span />
            <span />
            <span />
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <style>{styles}</style>

      <div className="zuqen-app">
        {/* MOBILE OVERLAY */}
        {mobileSidebar && (
          <button
            className="zuqen-mobile-overlay"
            onClick={() => setMobileSidebar(false)}
            aria-label="Close sidebar"
          />
        )}

        {/* SIDEBAR */}
        <aside
          className={`zuqen-sidebar ${
            sidebar ? "" : "collapsed"
          } ${mobileSidebar ? "mobile-open" : ""}`}
        >
          <div className="zuqen-sidebar-top">
            <button
              className="zuqen-brand"
              onClick={startNewConversation}
            >
              <span className="zuqen-logo">
                Z
              </span>

              <span className="zuqen-brand-copy">
                <strong>ZUQEN</strong>
                <small>AI Workspace</small>
              </span>
            </button>

            <button
              className="zuqen-sidebar-close-mobile"
              onClick={() => setMobileSidebar(false)}
            >
              <Icon name="close" />
            </button>
          </div>

          <button
            className="zuqen-new-chat"
            onClick={startNewConversation}
          >
            <Icon name="plus" />
            <span>New conversation</span>
          </button>

          <button
            className="zuqen-short-search"
            onClick={() => {
              setSearchOpen(true);
              setSearchQuery("");
            }}
          >
            <span className="short-search-icon">
              <Icon name="search" size={20} />
            </span>

            <span className="short-search-copy">
              <strong>Search chats</strong>
              <small>Find conversations instantly</small>
            </span>

            <span className="short-search-key">
              ⌘K
            </span>
          </button>

          <div className="zuqen-sidebar-section">
            <div className="zuqen-section-heading">
              <span>
                {archiveOpen
                  ? "Archived"
                  : "Conversations"}
              </span>

              <span className="zuqen-count">
                {archiveOpen
                  ? archivedChats.length
                  : activeChats.length}
              </span>
            </div>

            <div className="zuqen-chat-list">
              {filteredChats.length === 0 ? (
                <div className="zuqen-empty-list">
                  <div className="empty-icon">
                    {archiveOpen ? "▱" : "✦"}
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
                filteredChats.map((chat) => (
                  <div
                    key={chat.id}
                    className={`zuqen-chat-row ${
                      activeChat?.id === chat.id
                        ? "active"
                        : ""
                    }`}
                  >
                    {editingChatId === chat.id ? (
                      <input
                        autoFocus
                        className="zuqen-rename-input"
                        value={editingTitle}
                        onChange={(event) =>
                          setEditingTitle(event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            saveRename(chat);
                          }

                          if (event.key === "Escape") {
                            setEditingChatId(null);
                            setEditingTitle("");
                          }
                        }}
                        onBlur={() => saveRename(chat)}
                      />
                    ) : (
                      <>
                        <button
                          className="zuqen-chat-open"
                          onClick={() => openChat(chat)}
                        >
                          <span className="chat-row-icon">
                            <Icon name="chat" size={16} />
                          </span>

                          <span className="chat-row-content">
                            <strong>{chat.title}</strong>
                            <small>
                              {formatTime(chat.updated_at)}
                            </small>
                          </span>
                        </button>

                        <div
                          className="zuqen-chat-menu-wrap"
                          data-zuqen-menu
                        >
                          <button
                            className={`zuqen-more ${
                              menuOpen === chat.id
                                ? "visible"
                                : ""
                            }`}
                            onClick={(event) => {
                              event.stopPropagation();

                              setMenuOpen((current) =>
                                current === chat.id
                                  ? null
                                  : chat.id
                              );
                            }}
                            aria-label="Chat options"
                          >
                            <Icon name="more" size={17} />
                          </button>

                          {menuOpen === chat.id && (
                            <div className="zuqen-context-menu">
                              <button
                                onClick={() =>
                                  startRename(chat)
                                }
                              >
                                <Icon name="edit" />
                                <span>Rename</span>
                              </button>

                              {chat.archived ? (
                                <button
                                  onClick={() =>
                                    restoreChat(chat)
                                  }
                                >
                                  <Icon name="restore" />
                                  <span>Restore</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() =>
                                    archiveChat(chat)
                                  }
                                >
                                  <Icon name="archive" />
                                  <span>Archive</span>
                                </button>
                              )}

                              <div className="menu-divider" />

                              <button
                                className="danger"
                                onClick={() =>
                                  deleteChat(chat)
                                }
                              >
                                <Icon name="trash" />
                                <span>Delete</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="zuqen-sidebar-bottom">
            <button
              className={`zuqen-archive-switch ${
                archiveOpen ? "active" : ""
              }`}
              onClick={() => {
                setArchiveOpen((current) => !current);
                setMenuOpen(null);
              }}
            >
              <Icon name="archive" />
              <span>
                {archiveOpen
                  ? "Back to conversations"
                  : "Archived"}
              </span>

              <span className="archive-number">
                {archivedChats.length}
              </span>
            </button>

            <div className="zuqen-account">
              <div className="account-avatar">
                {user?.email?.[0]?.toUpperCase() ?? "U"}
              </div>

              <div className="account-info">
                <strong>
                  {user?.is_anonymous
                    ? "Guest user"
                    : user?.email ?? "ZUQEN user"}
                </strong>

                <span>
                  {user?.is_anonymous
                    ? "Anonymous account"
                    : "Personal workspace"}
                </span>
              </div>

              <span className="account-status" />
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <main className="zuqen-main">
          {/* TOPBAR */}
          <header className="zuqen-topbar">
            <div className="topbar-left">
              <button
                className="topbar-icon-button"
                onClick={() => {
                  setSidebar((current) => !current);
                  setMobileSidebar((current) => !current);
                }}
                aria-label="Toggle sidebar"
              >
                <Icon name="menu" size={21} />
              </button>

              <div className="topbar-title">
                <strong>
                  {activeChat?.title ??
                    "AI Workspace"}
                </strong>

                <span>
                  {activeChat
                    ? "Conversation"
                    : "Ask ZUQEN anything"}
                </span>
              </div>
            </div>

            <div className="topbar-actions">
              {/* CREDITS */}
              <div
                className="topbar-dropdown-wrap"
                data-zuqen-credits
              >
                <button
                  className={`credits-pill ${
                    creditsOpen ? "open" : ""
                  }`}
                  onClick={() =>
                    setCreditsOpen((current) => !current)
                  }
                >
                  <span className="credits-spark">
                    ✦
                  </span>

                  <span className="credits-value">
                    {creditsLoading
                      ? "..."
                      : formatCredits(totalCredits)}
                  </span>

                  <span className="credits-label">
                    credits
                  </span>

                  <Icon name="chevron" size={13} />
                </button>

                {creditsOpen && (
                  <div className="zuqen-dropdown credits-dropdown">
                    <div className="dropdown-header">
                      <div>
                        <strong>
                          Feature credits
                        </strong>

                        <span>
                          Available capacity
                        </span>
                      </div>

                      <span className="credits-big">
                        {formatCredits(totalCredits)}
                      </span>
                    </div>

                    <div className="credit-list">
                      {featureCredits.length === 0 ? (
                        <div className="credit-empty">
                          No feature credits yet.
                        </div>
                      ) : (
                        featureCredits.map((credit) => (
                          <div
                            className="credit-row"
                            key={credit.feature_key}
                          >
                            <div className="credit-feature-icon">
                              {credit.feature_key ===
                              "chat"
                                ? "✦"
                                : credit.feature_key ===
                                  "website_builder"
                                ? "◫"
                                : credit.feature_key ===
                                  "image_generator"
                                ? "◉"
                                : credit.feature_key ===
                                  "video_generator"
                                ? "▶"
                                : "◖"}
                            </div>

                            <div className="credit-feature-copy">
                              <strong>
                                {credit.feature_name}
                              </strong>

                              <span>
                                {credit.provider}
                              </span>
                            </div>

                            <strong>
                              {formatCredits(
                                credit.balance
                              )}
                            </strong>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* AGENTS */}
              <div
                className="topbar-dropdown-wrap"
                data-zuqen-agent
              >
                <button
                  className={`agent-pill ${
                    agentOpen ? "open" : ""
                  }`}
                  onClick={() =>
                    setAgentOpen((current) => !current)
                  }
                >
                  <span className="agent-pill-icon">
                    {selectedAgentData.icon}
                  </span>

                  <span>
                    {selectedAgentData.name}
                  </span>

                  <Icon name="chevron" size={13} />
                </button>

                {agentOpen && (
                  <div className="zuqen-dropdown agent-dropdown">
                    <div className="dropdown-header simple">
                      <div>
                        <strong>
                          ZUQEN Agents
                        </strong>

                        <span>
                          Choose an AI workspace
                        </span>
                      </div>
                    </div>

                    {AGENTS.map((agent) => (
                      <button
                        className={`agent-option ${
                          selectedAgent === agent.key
                            ? "selected"
                            : ""
                        }`}
                        key={agent.key}
                        onClick={() =>
                          selectAgent(agent)
                        }
                      >
                        <span className="agent-option-icon">
                          {agent.icon}
                        </span>

                        <span className="agent-option-copy">
                          <strong>{agent.name}</strong>
                          <small>
                            {agent.description}
                          </small>
                        </span>

                        {selectedAgent ===
                          agent.key && (
                          <Icon name="check" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                className="topbar-icon-button"
                onClick={() =>
                  setLightMode((current) => !current)
                }
                aria-label="Toggle theme"
              >
                <Icon
                  name={lightMode ? "moon" : "sun"}
                  size={19}
                />
              </button>
            </div>
          </header>

          {/* CONTENT */}
          <section className="zuqen-content">
            {messages.length === 0 ? (
              <div className="zuqen-welcome">
                <div className="welcome-orbit">
                  <div className="welcome-logo">
                    Z
                  </div>
                </div>

                <span className="welcome-eyebrow">
                  ZUQEN AI
                </span>

                <h1>
                  What can I help
                  <br />
                  you build today?
                </h1>

                <p>
                  Ask questions, brainstorm ideas,
                  write code, analyze information,
                  or create something new.
                </p>

                <div className="welcome-shortcuts">
                  <button
                    onClick={() =>
                      setInput(
                        "Explain this concept in a simple way"
                      )
                    }
                  >
                    <span>✦</span>
                    <div>
                      <strong>Explain something</strong>
                      <small>
                        Learn any concept simply
                      </small>
                    </div>
                  </button>

                  <button
                    onClick={() =>
                      setInput(
                        "Help me write a professional website"
                      )
                    }
                  >
                    <span>◫</span>
                    <div>
                      <strong>Build something</strong>
                      <small>
                        Turn ideas into projects
                      </small>
                    </div>
                  </button>

                  <button
                    onClick={() =>
                      setInput(
                        "Help me solve this problem"
                      )
                    }
                  >
                    <span>◇</span>
                    <div>
                      <strong>Solve a problem</strong>
                      <small>
                        Think through difficult tasks
                      </small>
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              <div className="zuqen-messages">
                {messages.map((message) => {
                  const isUser =
                    message.role === "user";

                  const isEditing =
                    editingMessageId === message.id;

                  return (
                    <article
                      key={message.id}
                      className={`zuqen-message ${
                        isUser ? "user-message" : "ai-message"
                      }`}
                    >
                      <div className="message-label">
                        <span
                          className={`message-label-dot ${
                            isUser ? "user-dot" : "ai-dot"
                          }`}
                        />

                        <strong>
                          {isUser ? "You" : "ZUQEN AI"}
                        </strong>

                        <span>
                          {formatTime(
                            message.created_at
                          )}
                        </span>
                      </div>

                      <div className="message-body">
                        {isEditing ? (
                          <div className="message-edit-box">
                            <textarea
                              value={editingMessageText}
                              onChange={(event) =>
                                setEditingMessageText(
                                  event.target.value
                                )
                              }
                              autoFocus
                            />

                            <div className="message-edit-actions">
                              <button
                                onClick={cancelMessageEdit}
                              >
                                Cancel
                              </button>

                              <button
                                className="primary"
                                onClick={() =>
                                  saveMessageEdit(
                                    message
                                  )
                                }
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="message-content">
                              {message.content}
                            </div>

                            {message.attachments &&
                              message.attachments.length >
                                0 && (
                                <div className="message-attachments">
                                  {message.attachments.map(
                                    (file, index) => (
                                      <div
                                        className="message-file"
                                        key={`${file.name}-${index}`}
                                      >
                                        <span>
                                          ◫
                                        </span>

                                        <div>
                                          <strong>
                                            {file.name}
                                          </strong>

                                          <small>
                                            {formatFileSize(
                                              file.size
                                            )}
                                          </small>
                                        </div>
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
                            onClick={() =>
                              copyMessage(message)
                            }
                            title="Copy"
                          >
                            {copiedId === message.id
                              ? "✓"
                              : "▣"}
                          </button>

                          {isUser && (
                            <button
                              onClick={() =>
                                startMessageEdit(
                                  message
                                )
                              }
                              title="Edit"
                            >
                              ✎
                            </button>
                          )}

                          {!isUser && (
                            <button
                              onClick={() =>
                                regenerate(message)
                              }
                              title="Regenerate"
                              disabled={loading}
                            >
                              ↻
                            </button>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}

                {loading && (
                  <div className="zuqen-message ai-message ai-thinking">
                    <div className="message-label">
                      <span className="message-label-dot ai-dot" />
                      <strong>ZUQEN AI</strong>
                      <span>thinking</span>
                    </div>

                    <div className="message-body">
                      <div className="thinking-animation">
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
          </section>

          {/* COMPOSER */}
          <div className="zuqen-composer-area">
            <div className="zuqen-composer">
              {attachments.length > 0 && (
                <div className="attachment-preview">
                  {attachments.map((file, index) => (
                    <div
                      className="attachment-chip"
                      key={`${file.name}-${index}`}
                    >
                      <span className="attachment-chip-icon">
                        ◫
                      </span>

                      <span className="attachment-chip-name">
                        {file.name}
                      </span>

                      <span className="attachment-chip-size">
                        {formatFileSize(file.size)}
                      </span>

                      <button
                        onClick={() =>
                          removeAttachment(index)
                        }
                        aria-label="Remove attachment"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <textarea
                ref={textareaRef}
                className="zuqen-input"
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
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden-file-input"
                    onChange={handleFileChange}
                  />

                  <button
                    className="composer-tool"
                    onClick={() =>
                      fileInputRef.current?.click()
                    }
                    disabled={uploading || loading}
                    title="Attach files"
                  >
                    <Icon name="paperclip" size={19} />
                  </button>

                  <button
                    className="composer-tool"
                    onClick={() =>
                      setInput((current) =>
                        current
                          ? `${current} ✦`
                          : "✦ "
                      )
                    }
                    title="Add AI prompt"
                  >
                    <Icon name="spark" size={18} />
                  </button>

                  <span className="composer-hint">
                    Shift + Enter for new line
                  </span>
                </div>

                <div className="composer-right">
                  <span className="composer-credit-info">
                    {formatCredits(chatCredits)} chat
                    credits
                  </span>

                  <button
                    className={`send-button ${
                      input.trim() ? "ready" : ""
                    }`}
                    onClick={sendMessage}
                    disabled={
                      !input.trim() || loading
                    }
                    aria-label="Send message"
                  >
                    {loading ? (
                      <span className="send-spinner" />
                    ) : (
                      <Icon name="send" size={18} />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="composer-footer">
              ZUQEN AI can make mistakes. Check important
              information.
            </div>
          </div>
        </main>

        {/* SEARCH MODAL */}
        {searchOpen && (
          <div
            className="zuqen-search-overlay"
            onMouseDown={() => setSearchOpen(false)}
          >
            <div
              className="zuqen-search-modal"
              onMouseDown={(event) =>
                event.stopPropagation()
              }
            >
              <div className="search-modal-top">
                <div className="search-modal-input-wrap">
                  <Icon name="search" size={21} />

                  <input
                    autoFocus
                    value={searchQuery}
                    onChange={(event) =>
                      setSearchQuery(event.target.value)
                    }
                    placeholder="Search your conversations..."
                  />
                </div>

                <button
                  className="search-close"
                  onClick={() => setSearchOpen(false)}
                >
                  Esc
                </button>
              </div>

              <div className="search-results">
                {searchQuery.trim() === "" ? (
                  <div className="search-empty">
                    <div>⌕</div>
                    <strong>
                      Search your conversations
                    </strong>
                    <span>
                      Find a previous chat by its title.
                    </span>
                  </div>
                ) : (
                  (() => {
                    const results = chats.filter(
                      (chat) =>
                        chat.title
                          .toLowerCase()
                          .includes(
                            searchQuery.toLowerCase()
                          )
                    );

                    if (!results.length) {
                      return (
                        <div className="search-empty">
                          <div>⌕</div>
                          <strong>
                            No conversations found
                          </strong>
                          <span>
                            Try a different search.
                          </span>
                        </div>
                      );
                    }

                    return results.map((chat) => (
                      <button
                        className="search-result"
                        key={chat.id}
                        onClick={() => {
                          openChat(chat);
                          setSearchOpen(false);
                        }}
                      >
                        <span className="search-result-icon">
                          <Icon name="chat" size={17} />
                        </span>

                        <span className="search-result-copy">
                          <strong>
                            {chat.title}
                          </strong>
                          <small>
                            {chat.archived
                              ? "Archived"
                              : "Conversation"}
                          </small>
                        </span>

                        <span className="search-result-arrow">
                          →
                        </span>
                      </button>
                    ));
                  })()
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

const styles = `
:root {
  --z-bg: #08090d;
  --z-sidebar: #0b0d12;
  --z-surface: #11141a;
  --z-surface-2: #151922;
  --z-border: rgba(255,255,255,.08);
  --z-border-strong: rgba(255,255,255,.13);
  --z-text: #f5f7fb;
  --z-muted: #8b93a3;
  --z-muted-2: #626a79;
  --z-accent: #a78bfa;
  --z-accent-2: #7c5cff;
  --z-danger: #ff6b7a;
  --z-shadow: 0 20px 60px rgba(0,0,0,.32);
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  min-height: 100%;
  background: var(--z-bg);
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
  color: var(--z-text);
}

button,
input,
textarea {
  font: inherit;
}

button {
  border: 0;
}

button:focus-visible,
input:focus-visible,
textarea:focus-visible {
  outline: 2px solid rgba(167,139,250,.6);
  outline-offset: 2px;
}

.zuqen-light {
  --z-bg: #f5f6f8;
  --z-sidebar: #ffffff;
  --z-surface: #ffffff;
  --z-surface-2: #f0f1f4;
  --z-border: rgba(15,20,30,.09);
  --z-border-strong: rgba(15,20,30,.14);
  --z-text: #11141a;
  --z-muted: #687080;
  --z-muted-2: #8a919d;
  --z-shadow: 0 20px 60px rgba(20,25,35,.12);
}

.zuqen-app {
  min-height: 100vh;
  height: 100vh;
  display: flex;
  overflow: hidden;
  background:
    radial-gradient(
      circle at 65% -10%,
      rgba(124,92,255,.08),
      transparent 34%
    ),
    var(--z-bg);
}

.zuqen-sidebar {
  width: 292px;
  height: 100vh;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  padding: 20px 14px 14px;
  background: rgba(11,13,18,.94);
  border-right: 1px solid var(--z-border);
  backdrop-filter: blur(24px);
  transition:
    width .24s ease,
    transform .24s ease,
    padding .24s ease;
  z-index: 20;
}

.zuqen-light .zuqen-sidebar {
  background: rgba(255,255,255,.94);
}

.zuqen-sidebar.collapsed {
  width: 0;
  padding-left: 0;
  padding-right: 0;
  overflow: hidden;
  border-right: 0;
}

.zuqen-sidebar-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.zuqen-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  background: transparent;
  color: var(--z-text);
  cursor: pointer;
  padding: 2px;
}

.zuqen-logo {
  width: 39px;
  height: 39px;
  border-radius: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 19px;
  font-weight: 900;
  letter-spacing: -1px;
  color: white;
  background:
    linear-gradient(145deg,#c4b5fd,#7657ed);
  box-shadow:
    0 8px 25px rgba(124,92,255,.28),
    inset 0 1px 0 rgba(255,255,255,.35);
}

.zuqen-brand-copy {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.1;
}

.zuqen-brand-copy strong {
  font-size: 15px;
  letter-spacing: .12em;
}

.zuqen-brand-copy small {
  margin-top: 5px;
  color: var(--z-muted);
  font-size: 10px;
  letter-spacing: .05em;
}

.zuqen-sidebar-close-mobile {
  display: none;
}

.zuqen-new-chat {
  height: 48px;
  width: 100%;
  border-radius: 13px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 15px;
  color: white;
  background:
    linear-gradient(
      135deg,
      rgba(124,92,255,.98),
      rgba(167,139,250,.88)
    );
  box-shadow: 0 10px 28px rgba(124,92,255,.18);
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
  transition: transform .16s ease, filter .16s ease;
}

.zuqen-new-chat:hover {
  transform: translateY(-1px);
  filter: brightness(1.06);
}

.zuqen-short-search {
  width: 100%;
  min-height: 67px;
  margin-top: 10px;
  padding: 10px 11px;
  display: flex;
  align-items: center;
  gap: 11px;
  border: 1px solid var(--z-border);
  border-radius: 14px;
  color: var(--z-text);
  background: rgba(255,255,255,.025);
  cursor: pointer;
  text-align: left;
  transition:
    border-color .16s ease,
    background .16s ease,
    transform .16s ease;
}

.zuqen-short-search:hover {
  border-color: var(--z-border-strong);
  background: rgba(255,255,255,.045);
  transform: translateY(-1px);
}

.short-search-icon {
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 11px;
  background: rgba(124,92,255,.11);
  color: #b8a5ff;
}

.short-search-copy {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.short-search-copy strong {
  font-size: 12px;
  font-weight: 700;
}

.short-search-copy small {
  color: var(--z-muted);
  font-size: 10px;
}

.short-search-key {
  color: var(--z-muted-2);
  font-size: 10px;
  border: 1px solid var(--z-border);
  padding: 4px 6px;
  border-radius: 6px;
}

.zuqen-sidebar-section {
  min-height: 0;
  flex: 1;
  margin-top: 25px;
  display: flex;
  flex-direction: column;
}

.zuqen-section-heading {
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  color: var(--z-muted);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .13em;
  text-transform: uppercase;
}

.zuqen-count {
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  background: rgba(255,255,255,.045);
  color: var(--z-muted);
  font-size: 9px;
  letter-spacing: 0;
}

.zuqen-chat-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 5px 0;
}

.zuqen-chat-list::-webkit-scrollbar {
  width: 5px;
}

.zuqen-chat-list::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,.08);
  border-radius: 20px;
}

.zuqen-chat-row {
  min-height: 52px;
  position: relative;
  display: flex;
  align-items: center;
  border-radius: 11px;
  margin-bottom: 2px;
}

.zuqen-chat-row.active {
  background: rgba(255,255,255,.055);
}

.zuqen-chat-row:hover {
  background: rgba(255,255,255,.04);
}

.zuqen-chat-open {
  min-width: 0;
  flex: 1;
  height: 52px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 5px 0 9px;
  color: var(--z-text);
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.chat-row-icon {
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  color: var(--z-muted);
  background: rgba(255,255,255,.04);
}

.chat-row-content {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.chat-row-content strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 600;
}

.chat-row-content small {
  color: var(--z-muted-2);
  font-size: 9px;
}

.zuqen-more {
  width: 34px;
  height: 34px;
  margin-right: 4px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--z-muted);
  background: transparent;
  cursor: pointer;
  opacity: 0;
  transition: opacity .15s ease, background .15s ease;
}

.zuqen-chat-row:hover .zuqen-more,
.zuqen-more.visible {
  opacity: 1;
}

.zuqen-more:hover {
  color: var(--z-text);
  background: rgba(255,255,255,.08);
}

.zuqen-chat-menu-wrap {
  position: relative;
}

.zuqen-context-menu {
  position: absolute;
  right: 5px;
  top: 39px;
  width: 174px;
  padding: 6px;
  border: 1px solid var(--z-border-strong);
  border-radius: 12px;
  background: #151820;
  box-shadow: var(--z-shadow);
  z-index: 80;
  animation: menuIn .12s ease-out;
}

.zuqen-light .zuqen-context-menu {
  background: white;
}

@keyframes menuIn {
  from {
    opacity: 0;
    transform: translateY(-4px) scale(.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.zuqen-context-menu button {
  width: 100%;
  height: 38px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-radius: 8px;
  color: var(--z-text);
  background: transparent;
  cursor: pointer;
  text-align: left;
  font-size: 12px;
}

.zuqen-context-menu button:hover {
  background: rgba(255,255,255,.07);
}

.zuqen-context-menu button.danger {
  color: var(--z-danger);
}

.menu-divider {
  height: 1px;
  margin: 5px 3px;
  background: var(--z-border);
}

.zuqen-rename-input {
  width: calc(100% - 10px);
  margin: 5px;
  height: 38px;
  padding: 0 10px;
  color: var(--z-text);
  background: var(--z-surface-2);
  border: 1px solid var(--z-accent);
  border-radius: 8px;
  outline: none;
  font-size: 12px;
}

.zuqen-empty-list {
  padding: 42px 20px;
  display: flex;
  align-items: center;
  text-align: center;
  flex-direction: column;
  gap: 8px;
  color: var(--z-muted);
}

.empty-icon {
  width: 42px;
  height: 42px;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 13px;
  color: #b6a3ff;
  background: rgba(124,92,255,.1);
}

.zuqen-empty-list strong {
  color: var(--z-text);
  font-size: 11px;
}

.zuqen-empty-list span {
  max-width: 190px;
  font-size: 10px;
  line-height: 1.5;
}

.zuqen-sidebar-bottom {
  margin-top: 12px;
}

.zuqen-archive-switch {
  width: 100%;
  height: 42px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--z-muted);
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
  text-align: left;
  font-size: 11px;
}

.zuqen-archive-switch:hover,
.zuqen-archive-switch.active {
  color: var(--z-text);
  background: rgba(255,255,255,.045);
}

.archive-number {
  margin-left: auto;
  color: var(--z-muted-2);
  font-size: 10px;
}

.zuqen-account {
  margin-top: 8px;
  padding: 11px 9px;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--z-border);
  border-radius: 13px;
  background: rgba(255,255,255,.025);
}

.account-avatar {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: linear-gradient(135deg,#242936,#171a21);
  color: white;
  font-size: 11px;
  font-weight: 800;
}

.account-info {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.account-info strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--z-text);
  font-size: 10px;
}

.account-info span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--z-muted);
  font-size: 9px;
}

.account-status {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #51d88a;
  box-shadow: 0 0 0 3px rgba(81,216,138,.08);
}

.zuqen-main {
  min-width: 0;
  flex: 1;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.zuqen-topbar {
  height: 70px;
  flex-shrink: 0;
  padding: 0 26px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--z-border);
  background: rgba(8,9,13,.7);
  backdrop-filter: blur(20px);
  z-index: 10;
}

.zuqen-light .zuqen-topbar {
  background: rgba(245,246,248,.75);
}

.topbar-left,
.topbar-actions {
  display: flex;
  align-items: center;
}

.topbar-left {
  gap: 14px;
}

.topbar-actions {
  gap: 8px;
}

.topbar-icon-button {
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  color: var(--z-muted);
  background: transparent;
  cursor: pointer;
}

.topbar-icon-button:hover {
  color: var(--z-text);
  background: rgba(255,255,255,.06);
}

.topbar-title {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.topbar-title strong {
  font-size: 13px;
  font-weight: 700;
}

.topbar-title span {
  color: var(--z-muted);
  font-size: 10px;
}

.topbar-dropdown-wrap {
  position: relative;
}

.credits-pill,
.agent-pill {
  height: 38px;
  display: flex;
  align-items: center;
  gap: 7px;
  border: 1px solid var(--z-border);
  border-radius: 10px;
  color: var(--z-text);
  background: rgba(255,255,255,.035);
  cursor: pointer;
  transition:
    border-color .15s ease,
    background .15s ease;
}

.credits-pill {
  padding: 0 11px;
}

.agent-pill {
  padding: 0 11px;
  font-size: 11px;
}

.credits-pill:hover,
.agent-pill:hover,
.credits-pill.open,
.agent-pill.open {
  border-color: var(--z-border-strong);
  background: rgba(255,255,255,.06);
}

.credits-spark {
  color: #bbaaff;
}

.credits-value {
  font-size: 11px;
  font-weight: 800;
}

.credits-label {
  color: var(--z-muted);
  font-size: 10px;
}

.agent-pill-icon {
  color: #b8a5ff;
}

.zuqen-dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + 9px);
  width: 320px;
  padding: 8px;
  border: 1px solid var(--z-border-strong);
  border-radius: 15px;
  background: #12151c;
  box-shadow: var(--z-shadow);
  z-index: 90;
  animation: menuIn .13s ease-out;
}

.zuqen-light .zuqen-dropdown {
  background: white;
}

.dropdown-header {
  padding: 11px 10px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--z-border);
}

.dropdown-header.simple {
  display: block;
}

.dropdown-header div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dropdown-header strong {
  font-size: 12px;
}

.dropdown-header span {
  color: var(--z-muted);
  font-size: 9px;
}

.credits-big {
  color: #b9a8ff !important;
  font-size: 17px !important;
  font-weight: 800;
}

.credit-list {
  padding: 6px 0;
}

.credit-row {
  min-height: 49px;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 5px 7px;
  border-radius: 9px;
}

.credit-row:hover {
  background: rgba(255,255,255,.04);
}

.credit-feature-icon {
  width: 31px;
  height: 31px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  background: rgba(124,92,255,.1);
  color: #b8a5ff;
}

.credit-feature-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.credit-feature-copy strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 10px;
}

.credit-feature-copy span {
  color: var(--z-muted);
  font-size: 9px;
  text-transform: capitalize;
}

.credit-row > strong {
  font-size: 10px;
}

.credit-empty {
  padding: 25px 12px;
  color: var(--z-muted);
  text-align: center;
  font-size: 10px;
}

.agent-dropdown {
  width: 300px;
}

.agent-option {
  width: 100%;
  min-height: 54px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 9px;
  border-radius: 10px;
  color: var(--z-text);
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.agent-option:hover,
.agent-option.selected {
  background: rgba(255,255,255,.055);
}

.agent-option-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  color: #b9a7ff;
  background: rgba(124,92,255,.1);
}

.agent-option-copy {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.agent-option-copy strong {
  font-size: 11px;
}

.agent-option-copy small {
  color: var(--z-muted);
  font-size: 9px;
}

.zuqen-content {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.zuqen-content::-webkit-scrollbar {
  width: 6px;
}

.zuqen-content::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,.08);
  border-radius: 20px;
}

.zuqen-welcome {
  width: min(900px, calc(100% - 40px));
  min-height: 100%;
  margin: 0 auto;
  padding: 65px 0 90px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.welcome-orbit {
  width: 92px;
  height: 92px;
  margin-bottom: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(167,139,250,.2);
  border-radius: 29px;
  background:
    radial-gradient(
      circle,
      rgba(124,92,255,.14),
      transparent 70%
    );
  box-shadow:
    0 0 80px rgba(124,92,255,.1);
}

.welcome-logo {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 20px;
  color: white;
  font-size: 28px;
  font-weight: 900;
  background:
    linear-gradient(145deg,#c4b5fd,#7050e9);
  box-shadow:
    0 14px 35px rgba(124,92,255,.25);
}

.welcome-eyebrow {
  margin-bottom: 12px;
  color: #a99aff;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .22em;
}

.zuqen-welcome h1 {
  margin: 0;
  color: var(--z-text);
  font-size: clamp(34px, 4vw, 54px);
  line-height: 1.06;
  letter-spacing: -.045em;
  font-weight: 800;
}

.zuqen-welcome p {
  max-width: 550px;
  margin: 20px auto 0;
  color: var(--z-muted);
  font-size: 14px;
  line-height: 1.7;
}

.welcome-shortcuts {
  width: 100%;
  margin-top: 42px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 11px;
}

.welcome-shortcuts button {
  min-height: 82px;
  padding: 14px;
  display: flex;
  align-items: center;
  gap: 13px;
  border: 1px solid var(--z-border);
  border-radius: 15px;
  color: var(--z-text);
  background: rgba(255,255,255,.025);
  cursor: pointer;
  text-align: left;
  transition:
    transform .16s ease,
    border-color .16s ease,
    background .16s ease;
}

.welcome-shortcuts button:hover {
  transform: translateY(-2px);
  border-color: var(--z-border-strong);
  background: rgba(255,255,255,.045);
}

.welcome-shortcuts button > span {
  width: 37px;
  height: 37px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 11px;
  color: #b8a6ff;
  background: rgba(124,92,255,.1);
}

.welcome-shortcuts button div {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.welcome-shortcuts strong {
  font-size: 11px;
}

.welcome-shortcuts small {
  color: var(--z-muted);
  font-size: 9px;
}

.zuqen-messages {
  width: min(1060px, calc(100% - 60px));
  margin: 0 auto;
  padding: 45px 0 70px;
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.zuqen-message {
  width: min(84%, 820px);
  animation: messageIn .28s ease-out both;
}

.user-message {
  align-self: flex-start;
}

.ai-message {
  align-self: flex-end;
}

@keyframes messageIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-label {
  height: 25px;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 3px;
  color: var(--z-muted);
  font-size: 10px;
}

.message-label strong {
  color: var(--z-text);
  font-size: 10px;
  font-weight: 800;
}

.message-label > span:last-child {
  margin-left: 3px;
  color: var(--z-muted-2);
  font-size: 9px;
}

.message-label-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.user-dot {
  background: #7d8798;
}

.ai-dot {
  background: #a991ff;
  box-shadow: 0 0 0 3px rgba(167,139,250,.09);
}

.message-body {
  margin-top: 5px;
  padding: 21px 23px;
  border: 1px solid var(--z-border);
  border-radius: 18px;
  background: rgba(255,255,255,.027);
  box-shadow: 0 10px 30px rgba(0,0,0,.07);
}

.user-message .message-body {
  border-top-left-radius: 5px;
}

.ai-message .message-body {
  border-top-right-radius: 5px;
  background:
    linear-gradient(
      135deg,
      rgba(124,92,255,.065),
      rgba(255,255,255,.025)
    );
}

.message-content {
  color: var(--z-text);
  font-size: 15px;
  line-height: 1.75;
  white-space: pre-wrap;
  word-break: break-word;
}

.message-actions {
  min-height: 28px;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px 3px 0;
  opacity: .55;
  transition: opacity .15s ease;
}

.zuqen-message:hover .message-actions {
  opacity: 1;
}

.message-actions button {
  width: 28px;
  height: 27px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  color: var(--z-muted);
  background: transparent;
  cursor: pointer;
  font-size: 13px;
}

.message-actions button:hover {
  color: var(--z-text);
  background: rgba(255,255,255,.06);
}

.message-actions button:disabled {
  opacity: .35;
  cursor: default;
}

.message-edit-box textarea {
  width: 100%;
  min-height: 130px;
  resize: vertical;
  padding: 13px;
  border: 1px solid var(--z-border-strong);
  border-radius: 11px;
  color: var(--z-text);
  background: rgba(0,0,0,.15);
  outline: none;
  font-size: 14px;
  line-height: 1.6;
}

.message-edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 7px;
  margin-top: 8px;
}

.message-edit-actions button {
  padding: 8px 12px;
  border-radius: 8px;
  color: var(--z-muted);
  background: rgba(255,255,255,.05);
  cursor: pointer;
  font-size: 10px;
}

.message-edit-actions button.primary {
  color: white;
  background: var(--z-accent-2);
}

.message-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.message-file {
  min-width: 190px;
  padding: 9px;
  display: flex;
  align-items: center;
  gap: 9px;
  border: 1px solid var(--z-border);
  border-radius: 10px;
  background: rgba(255,255,255,.025);
}

.message-file > span {
  width: 29px;
  height: 29px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: rgba(124,92,255,.1);
  color: #b8a6ff;
}

.message-file div {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.message-file strong {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 10px;
}

.message-file small {
  color: var(--z-muted);
  font-size: 8px;
}

.thinking-animation {
  height: 25px;
  display: flex;
  align-items: center;
  gap: 5px;
}

.thinking-animation span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #a891ff;
  animation: thinking 1.15s infinite ease-in-out;
}

.thinking-animation span:nth-child(2) {
  animation-delay: .16s;
}

.thinking-animation span:nth-child(3) {
  animation-delay: .32s;
}

@keyframes thinking {
  0%,
  60%,
  100% {
    transform: translateY(0);
    opacity: .35;
  }

  30% {
    transform: translateY(-5px);
    opacity: 1;
  }
}

.zuqen-composer-area {
  flex-shrink: 0;
  padding: 0 24px 17px;
  background:
    linear-gradient(
      to bottom,
      transparent,
      var(--z-bg) 25%
    );
}

.zuqen-composer {
  width: min(940px, 100%);
  margin: 0 auto;
  padding: 9px 10px 10px;
  border: 1px solid var(--z-border-strong);
  border-radius: 19px;
  background: rgba(18,21,28,.92);
  box-shadow:
    0 20px 50px rgba(0,0,0,.18),
    inset 0 1px 0 rgba(255,255,255,.025);
  backdrop-filter: blur(22px);
}

.zuqen-light .zuqen-composer {
  background: rgba(255,255,255,.92);
}

.zuqen-input {
  width: 100%;
  min-height: 58px;
  max-height: 220px;
  padding: 12px 13px 8px;
  resize: none;
  overflow-y: auto;
  border: 0;
  outline: 0;
  color: var(--z-text);
  background: transparent;
  font-size: 15px;
  line-height: 1.6;
}

.zuqen-input::placeholder {
  color: var(--z-muted-2);
}

.composer-bottom {
  min-height: 39px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.composer-tools,
.composer-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.composer-tool {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  color: var(--z-muted);
  background: transparent;
  cursor: pointer;
}

.composer-tool:hover {
  color: var(--z-text);
  background: rgba(255,255,255,.06);
}

.composer-tool:disabled {
  opacity: .35;
  cursor: default;
}

.hidden-file-input {
  display: none;
}

.composer-hint {
  margin-left: 4px;
  color: var(--z-muted-2);
  font-size: 9px;
}

.composer-credit-info {
  margin-right: 5px;
  color: var(--z-muted-2);
  font-size: 9px;
}

.send-button {
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 11px;
  color: var(--z-muted-2);
  background: rgba(255,255,255,.06);
  cursor: pointer;
  transition:
    background .16s ease,
    color .16s ease,
    transform .16s ease;
}

.send-button.ready {
  color: white;
  background: linear-gradient(
    135deg,
    #8d6dff,
    #6846df
  );
  box-shadow: 0 8px 20px rgba(124,92,255,.2);
}

.send-button.ready:hover {
  transform: translateY(-1px);
}

.send-button:disabled {
  cursor: default;
}

.send-spinner {
  width: 15px;
  height: 15px;
  border: 2px solid rgba(255,255,255,.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin .7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.composer-footer {
  width: min(940px, 100%);
  margin: 8px auto 0;
  color: var(--z-muted-2);
  text-align: center;
  font-size: 8px;
  letter-spacing: .02em;
}

.attachment-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  padding: 3px 4px 8px;
}

.attachment-chip {
  max-width: 270px;
  height: 34px;
  padding: 0 6px 0 8px;
  display: flex;
  align-items: center;
  gap: 7px;
  border: 1px solid var(--z-border);
  border-radius: 9px;
  background: rgba(255,255,255,.035);
}

.attachment-chip-icon {
  color: #aa98ff;
}

.attachment-chip-name {
  max-width: 130px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--z-text);
  font-size: 9px;
}

.attachment-chip-size {
  color: var(--z-muted-2);
  font-size: 8px;
}

.attachment-chip button {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  color: var(--z-muted);
  background: transparent;
  cursor: pointer;
}

.attachment-chip button:hover {
  color: var(--z-text);
  background: rgba(255,255,255,.06);
}

.zuqen-loading {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--z-bg);
}

.zuqen-loading-mark {
  width: 58px;
  height: 58px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 18px;
  color: white;
  font-size: 25px;
  font-weight: 900;
  background: linear-gradient(
    145deg,
    #c4b5fd,
    #7657ed
  );
  box-shadow: 0 15px 40px rgba(124,92,255,.22);
}

.zuqen-loading-title {
  margin-top: 16px;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: .2em;
}

.zuqen-loading-dots {
  display: flex;
  gap: 4px;
  margin-top: 12px;
}

.zuqen-loading-dots span {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #a995ff;
  animation: thinking 1s infinite ease-in-out;
}

.zuqen-loading-dots span:nth-child(2) {
  animation-delay: .15s;
}

.zuqen-loading-dots span:nth-child(3) {
  animation-delay: .3s;
}

.zuqen-search-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 12vh;
  background: rgba(0,0,0,.62);
  backdrop-filter: blur(10px);
}

.zuqen-search-modal {
  width: min(620px, calc(100% - 30px));
  max-height: 70vh;
  overflow: hidden;
  border: 1px solid var(--z-border-strong);
  border-radius: 18px;
  background: #11141a;
  box-shadow: 0 35px 100px rgba(0,0,0,.45);
  animation: searchIn .18s ease-out;
}

.zuqen-light .zuqen-search-modal {
  background: white;
}

@keyframes searchIn {
  from {
    opacity: 0;
    transform: translateY(-12px) scale(.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.search-modal-top {
  padding: 10px;
  display: flex;
  gap: 8px;
  border-bottom: 1px solid var(--z-border);
}

.search-modal-input-wrap {
  flex: 1;
  height: 47px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 13px;
  border: 1px solid var(--z-border);
  border-radius: 11px;
  color: var(--z-muted);
  background: rgba(255,255,255,.025);
}

.search-modal-input-wrap input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  color: var(--z-text);
  background: transparent;
  font-size: 13px;
}

.search-modal-input-wrap input::placeholder {
  color: var(--z-muted-2);
}

.search-close {
  width: 48px;
  border-radius: 10px;
  color: var(--z-muted);
  background: rgba(255,255,255,.04);
  cursor: pointer;
  font-size: 10px;
}

.search-results {
  max-height: calc(70vh - 70px);
  overflow-y: auto;
  padding: 7px;
}

.search-result {
  width: 100%;
  min-height: 58px;
  padding: 7px 9px;
  display: flex;
  align-items: center;
  gap: 11px;
  border-radius: 10px;
  color: var(--z-text);
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.search-result:hover {
  background: rgba(255,255,255,.05);
}

.search-result-icon {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  color: #b8a6ff;
  background: rgba(124,92,255,.1);
}

.search-result-copy {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.search-result-copy strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
}

.search-result-copy small {
  color: var(--z-muted);
  font-size: 9px;
}

.search-result-arrow {
  color: var(--z-muted);
}

.search-empty {
  min-height: 260px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  text-align: center;
  color: var(--z-muted);
}

.search-empty > div {
  width: 45px;
  height: 45px;
  margin-bottom: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  color: #b8a6ff;
  background: rgba(124,92,255,.1);
  font-size: 20px;
}

.search-empty strong {
  color: var(--z-text);
  font-size: 12px;
}

.search-empty span {
  font-size: 10px;
}

.zuqen-mobile-overlay {
  display: none;
}

@media (max-width: 900px) {
  .welcome-shortcuts {
    grid-template-columns: 1fr;
  }

  .zuqen-message {
    width: 90%;
  }

  .zuqen-messages {
    width: min(100% - 32px, 900px);
  }
}

@media (max-width: 720px) {
  .zuqen-sidebar {
    position: fixed;
    left: 0;
    top: 0;
    transform: translateX(-105%);
    box-shadow: 20px 0 70px rgba(0,0,0,.35);
  }

  .zuqen-sidebar.mobile-open {
    transform: translateX(0);
  }

  .zuqen-sidebar.collapsed {
    width: 292px;
    padding: 20px 14px 14px;
    border-right: 1px solid var(--z-border);
  }

  .zuqen-sidebar-close-mobile {
    width: 35px;
    height: 35px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 9px;
    color: var(--z-muted);
    background: rgba(255,255,255,.05);
    cursor: pointer;
  }

  .zuqen-mobile-overlay {
    position: fixed;
    inset: 0;
    display: block;
    z-index: 15;
    border: 0;
    background: rgba(0,0,0,.55);
    backdrop-filter: blur(4px);
  }

  .zuqen-topbar {
    height: 62px;
    padding: 0 12px;
  }

  .topbar-actions {
    gap: 3px;
  }

  .credits-pill {
    padding: 0 8px;
  }

  .credits-label,
  .agent-pill span:not(.agent-pill-icon),
  .composer-hint,
  .composer-credit-info {
    display: none;
  }

  .agent-pill {
    width: 38px;
    padding: 0;
    justify-content: center;
  }

  .agent-pill > span {
    display: none;
  }

  .agent-pill .agent-pill-icon {
    display: flex;
  }

  .zuqen-welcome {
    width: calc(100% - 30px);
    padding-top: 30px;
  }

  .zuqen-welcome h1 {
    font-size: 36px;
  }

  .zuqen-welcome p {
    font-size: 12px;
  }

  .zuqen-messages {
    width: calc(100% - 22px);
    padding-top: 25px;
  }

  .zuqen-message {
    width: 94%;
  }

  .message-body {
    padding: 16px 17px;
  }

  .message-content {
    font-size: 14px;
  }

  .zuqen-composer-area {
    padding: 0 8px 10px;
  }

  .zuqen-composer {
    border-radius: 16px;
  }

  .zuqen-input {
    font-size: 14px;
  }
}
`;