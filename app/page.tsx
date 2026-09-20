"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  Archive,
  ArrowUp,
  Bot,
  Check,
  ChevronDown,
  Copy,
  Edit3,
  File,
  FileText,
  Image as ImageIcon,
  LayoutTemplate,
  Menu,
  MessageSquare,
  Mic,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  Trash2,
  User,
  Video,
  WandSparkles,
  X,
} from "lucide-react";

type Role = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: Role;
  content: string;
  createdAt: string;
  attachments?: {
    name: string;
    type: string;
    size: number;
  }[];
};

type Chat = {
  id: string;
  user_id?: string;
  title: string;
  archived: boolean;
  messages: ChatMessage[];
  created_at?: string;
  updated_at?: string;
};

type Agent = {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  href?: string;
};

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

const AGENTS: Agent[] = [
  {
    id: "chat",
    name: "ZUQEN AI",
    description: "Your intelligent AI assistant",
    icon: <Sparkles size={17} />,
  },
  {
    id: "website",
    name: "Website Builder",
    description: "Build complete websites with AI",
    icon: <WandSparkles size={17} />,
    href: "/website-builder",
  },
  {
    id: "image",
    name: "Text to Image",
    description: "Create images from text",
    icon: <ImageIcon size={17} />,
    href: "/generate-image",
  },
  {
    id: "video",
    name: "Text to Video",
    description: "Create videos from text",
    icon: <Video size={17} />,
    href: "/generate-video",
  },
  {
    id: "voice",
    name: "Voice Generator",
    description: "Generate natural AI voices",
    icon: <Mic size={17} />,
    href: "/generate-voice",
  },
];

const QUICK_PROMPTS = [
  {
    title: "Write something",
    description: "Emails, articles, ideas and more",
    icon: <Pencil size={17} />,
    prompt: "Help me write ",
  },
  {
    title: "Build a website",
    description: "Create a website from an idea",
    icon: <WandSparkles size={17} />,
    prompt: "Help me plan a professional website for ",
  },
  {
    title: "Analyze a file",
    description: "Understand your documents",
    icon: <FileText size={17} />,
    prompt: "Analyze this document and explain ",
  },
  {
    title: "Brainstorm ideas",
    description: "Explore ideas with ZUQEN",
    icon: <Sparkles size={17} />,
    prompt: "Give me ideas for ",
  },
];

function makeMessage(
  role: Role,
  content: string,
  attachments?: ChatMessage["attachments"]
): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString(),
    attachments,
  };
}

function makeChat(userId?: string): Chat {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    user_id: userId,
    title: "New conversation",
    archived: false,
    messages: [],
    created_at: now,
    updated_at: now,
  };
}

export default function HomePage() {
  const [user, setUser] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);

  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const [credits, setCredits] = useState<number>(0);
  const [creditsLoading, setCreditsLoading] = useState(true);

  const [activeAgent, setActiveAgent] = useState("chat");
  const [agentOpen, setAgentOpen] = useState(false);

  const [templatesOpen, setTemplatesOpen] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");

  const [composer, setComposer] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);

  const [generating, setGenerating] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(
    null
  );
  const [editingText, setEditingText] = useState("");

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");

  const [showArchived, setShowArchived] = useState(false);
  const [menuChatId, setMenuChatId] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId) ?? null,
    [chats, activeChatId]
  );

  const currentAgent =
    AGENTS.find((agent) => agent.id === activeAgent) ?? AGENTS[0];

  const visibleChats = useMemo(() => {
    const query = search.trim().toLowerCase();

    return chats
      .filter((chat) => (showArchived ? chat.archived : !chat.archived))
      .filter((chat) =>
        query ? chat.title.toLowerCase().includes(query) : true
      )
      .sort(
        (a, b) =>
          new Date(b.updated_at || 0).getTime() -
          new Date(a.updated_at || 0).getTime()
      );
  }, [chats, search, showArchived]);

  const scrollBottom = useCallback(() => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    });
  }, []);

  const loadChatCredits = useCallback(async (userId: string) => {
    setCreditsLoading(true);

    try {
      const { data, error } = await supabase
        .from("feature_credit_balances")
        .select("balance")
        .eq("user_id", userId)
        .eq("feature_key", "chat")
        .maybeSingle();

      if (error) {
        console.error("Credit load error:", error);
        setCredits(0);
        return;
      }

      setCredits(Number(data?.balance ?? 0));
    } catch (error) {
      console.error(error);
      setCredits(0);
    } finally {
      setCreditsLoading(false);
    }
  }, []);

  const loadChats = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("chats")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Chat load error:", error);
      return;
    }

    const loaded: Chat[] = (data || []).map((chat: any) => ({
      ...chat,
      archived: Boolean(chat.archived),
      messages: Array.isArray(chat.messages) ? chat.messages : [],
    }));

    setChats(loaded);

    if (loaded.length > 0) {
      const firstNonArchived =
        loaded.find((chat) => !chat.archived) ?? loaded[0];

      setActiveChatId(firstNonArchived.id);
    } else {
      const first = makeChat(userId);
      setChats([first]);
      setActiveChatId(first.id);

      await supabase.from("chats").insert({
        id: first.id,
        user_id: userId,
        title: first.title,
        archived: false,
        messages: [],
      });
    }
  }, []);

  const initializeAuth = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      let currentUser = session?.user ?? null;

      if (!currentUser) {
        const { data, error } = await supabase.auth.signInAnonymously();

        if (error) {
          console.error("Anonymous auth error:", error);
          window.location.href = "/auth";
          return;
        }

        currentUser = data.user;
      }

      if (!currentUser) {
        window.location.href = "/auth";
        return;
      }

      setUser(currentUser);

      if (currentUser.is_anonymous) {
        const { error } = await supabase.rpc("setup_guest_chat_credits");

        if (error) {
          console.error("Guest credit setup error:", error);
        }
      }

      await Promise.all([
        loadChats(currentUser.id),
        loadChatCredits(currentUser.id),
      ]);
    } catch (error) {
      console.error("Auth initialization error:", error);
    } finally {
      setAuthReady(true);
    }
  }, [loadChatCredits, loadChats]);

  useEffect(() => {
    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const sessionUser = session?.user;

      if (!sessionUser) return;

      setUser(sessionUser);

      await Promise.all([
        loadChats(sessionUser.id),
        loadChatCredits(sessionUser.id),
      ]);

      setAuthReady(true);
    });

    return () => subscription.unsubscribe();
  }, [initializeAuth, loadChatCredits, loadChats]);

  useEffect(() => {
    scrollBottom();
  }, [activeChat?.messages.length, generating, scrollBottom]);

  useEffect(() => {
    if (!agentOpen && !templatesOpen && !menuChatId) return;

    const close = () => {
      setAgentOpen(false);
      setTemplatesOpen(false);
      setMenuChatId(null);
    };

    document.addEventListener("click", close);

    return () => document.removeEventListener("click", close);
  }, [agentOpen, templatesOpen, menuChatId]);

  const persistChat = async (chat: Chat) => {
    if (!user?.id) return;

    const { error } = await supabase.from("chats").upsert({
      id: chat.id,
      user_id: user.id,
      title: chat.title,
      archived: chat.archived,
      messages: chat.messages,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Chat save error:", error);
    }
  };

  const updateChat = async (
    chatId: string,
    updater: (chat: Chat) => Chat
  ) => {
    let changed: Chat | null = null;

    setChats((previous) =>
      previous.map((chat) => {
        if (chat.id !== chatId) return chat;

        changed = updater(chat);

        return changed;
      })
    );

    if (changed) {
      await persistChat(changed);
    }
  };

  const createNewChat = async () => {
    if (!user?.id) return;

    const chat = makeChat(user.id);

    setChats((previous) => [chat, ...previous]);
    setActiveChatId(chat.id);
    setComposer("");
    setAttachments([]);
    setSidebarOpen(false);

    await persistChat(chat);

    textareaRef.current?.focus();
  };

  const selectChat = (id: string) => {
    setActiveChatId(id);
    setSidebarOpen(false);
    setMenuChatId(null);
  };

  const deleteChat = async (id: string) => {
    const { error } = await supabase.from("chats").delete().eq("id", id);

    if (error) {
      console.error(error);
      return;
    }

    const remaining = chats.filter((chat) => chat.id !== id);

    setChats(remaining);

    if (activeChatId === id) {
      const next = remaining.find((chat) => !chat.archived);
      setActiveChatId(next?.id ?? null);
    }

    setMenuChatId(null);
  };

  const archiveChat = async (id: string) => {
    const chat = chats.find((item) => item.id === id);
    if (!chat) return;

    const updated = {
      ...chat,
      archived: !chat.archived,
      updated_at: new Date().toISOString(),
    };

    setChats((previous) =>
      previous.map((item) => (item.id === id ? updated : item))
    );

    await persistChat(updated);

    if (activeChatId === id && updated.archived) {
      const next = chats.find(
        (item) => item.id !== id && !item.archived
      );

      setActiveChatId(next?.id ?? null);
    }

    setMenuChatId(null);
  };

  const beginRename = (chat: Chat) => {
    setRenamingChatId(chat.id);
    setRenameText(chat.title);
    setMenuChatId(null);
  };

  const finishRename = async () => {
    if (!renamingChatId) return;

    const title = renameText.trim();

    if (!title) {
      setRenamingChatId(null);
      return;
    }

    const chat = chats.find((item) => item.id === renamingChatId);

    if (!chat) return;

    const updated = {
      ...chat,
      title,
      updated_at: new Date().toISOString(),
    };

    setChats((previous) =>
      previous.map((item) =>
        item.id === renamingChatId ? updated : item
      )
    );

    setRenamingChatId(null);
    await persistChat(updated);
  };

  const copyMessage = async (message: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(message.content);

      setCopiedId(message.id);

      setTimeout(() => {
        setCopiedId(null);
      }, 1400);
    } catch (error) {
      console.error(error);
    }
  };

  const selectAgent = (agent: Agent) => {
    setAgentOpen(false);

    if (agent.href) {
      window.location.href = agent.href;
      return;
    }

    setActiveAgent(agent.id);
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;

    const selected = Array.from(files);

    setAttachments((previous) => [...previous, ...selected]);
  };

  const removeAttachment = (index: number) => {
    setAttachments((previous) =>
      previous.filter((_, itemIndex) => itemIndex !== index)
    );
  };

  const getAttachmentMetadata = () =>
    attachments.map((file) => ({
      name: file.name,
      type: file.type,
      size: file.size,
    }));

  const sendMessage = async (
    overrideText?: string,
    regenerateFromIndex?: number
  ) => {
    if (generating || !user || activeAgent !== "chat") return;

    const text = (overrideText ?? composer).trim();

    if (!text && regenerateFromIndex === undefined) return;

    if (!activeChat) {
      await createNewChat();
      return;
    }

    if (credits <= 0) {
      const message = makeMessage(
        "assistant",
        "Your ZUQEN Chat Credits are exhausted. Please add more credits to continue."
      );

      const updated = {
        ...activeChat,
        messages: [...activeChat.messages, message],
        updated_at: new Date().toISOString(),
      };

      setChats((previous) =>
        previous.map((chat) =>
          chat.id === activeChat.id ? updated : chat
        )
      );

      await persistChat(updated);
      return;
    }

    setGenerating(true);

    let conversation = [...activeChat.messages];

    if (regenerateFromIndex !== undefined) {
      conversation = conversation.slice(0, regenerateFromIndex);
    } else {
      const userMessage = makeMessage(
        "user",
        text,
        getAttachmentMetadata()
      );

      conversation.push(userMessage);
    }

    const title =
      activeChat.messages.length === 0 && text
        ? text.length > 60
          ? `${text.slice(0, 60)}...`
          : text
        : activeChat.title;

    const optimisticChat: Chat = {
      ...activeChat,
      title,
      messages: conversation,
      updated_at: new Date().toISOString(),
    };

    setChats((previous) =>
      previous.map((chat) =>
        chat.id === activeChat.id ? optimisticChat : chat
      )
    );

    setComposer("");
    setAttachments([]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: conversation.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          userId: user.id,
          chatId: activeChat.id,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();

        throw new Error(
          errorText || `Chat request failed: ${response.status}`
        );
      }

      if (!response.body) {
        throw new Error("The chat server returned no response body.");
      }

      const assistantId = crypto.randomUUID();

      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
      };

      let runningMessages = [
        ...conversation,
        assistantMessage,
      ];

      setChats((previous) =>
        previous.map((chat) =>
          chat.id === activeChat.id
            ? {
                ...chat,
                messages: runningMessages,
                updated_at: new Date().toISOString(),
              }
            : chat
        )
      );

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let accumulated = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, {
          stream: true,
        });

        const lines = buffer.split("\n");

        buffer = lines.pop() || "";

        for (const rawLine of lines) {
          const line = rawLine.trim();

          if (!line) continue;

          let payload = line;

          if (payload.startsWith("data:")) {
            payload = payload.slice(5).trim();
          }

          if (payload === "[DONE]") continue;

          try {
            const parsed = JSON.parse(payload);

            const chunk =
              parsed?.text ??
              parsed?.content ??
              parsed?.delta ??
              parsed?.choices?.[0]?.delta?.content ??
              "";

            if (typeof chunk === "string" && chunk) {
              accumulated += chunk;
            }
          } catch {
            accumulated += payload;
          }

          runningMessages = runningMessages.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  content: accumulated,
                }
              : message
          );

          setChats((previous) =>
            previous.map((chat) =>
              chat.id === activeChat.id
                ? {
                    ...chat,
                    messages: runningMessages,
                    updated_at: new Date().toISOString(),
                  }
                : chat
            )
          );
        }
      }

      if (!accumulated.trim()) {
        throw new Error("ZUQEN returned an empty response.");
      }

      const finalChat: Chat = {
        ...activeChat,
        title,
        messages: runningMessages,
        updated_at: new Date().toISOString(),
      };

      setChats((previous) =>
        previous.map((chat) =>
          chat.id === activeChat.id ? finalChat : chat
        )
      );

      await persistChat(finalChat);

      await loadChatCredits(user.id);
    } catch (error) {
      console.error("Chat error:", error);

      const errorMessage = makeMessage(
        "assistant",
        error instanceof Error
          ? `I couldn't complete that request. ${error.message}`
          : "I couldn't complete that request. Please try again."
      );

      const failedChat: Chat = {
        ...activeChat,
        messages: [...conversation, errorMessage],
        updated_at: new Date().toISOString(),
      };

      setChats((previous) =>
        previous.map((chat) =>
          chat.id === activeChat.id ? failedChat : chat
        )
      );

      await persistChat(failedChat);
    } finally {
      setGenerating(false);
      scrollBottom();
    }
  };

  const editMessage = async (message: ChatMessage) => {
    setEditingMessageId(message.id);
    setEditingText(message.content);
  };

  const submitEdit = async () => {
    if (!activeChat || !editingMessageId || !editingText.trim()) {
      return;
    }

    const index = activeChat.messages.findIndex(
      (message) => message.id === editingMessageId
    );

    if (index === -1) return;

    const updatedUserMessage = {
      ...activeChat.messages[index],
      content: editingText.trim(),
    };

    const newMessages = [
      ...activeChat.messages.slice(0, index),
      updatedUserMessage,
    ];

    const editedChat = {
      ...activeChat,
      messages: newMessages,
      updated_at: new Date().toISOString(),
    };

    setChats((previous) =>
      previous.map((chat) =>
        chat.id === activeChat.id ? editedChat : chat
      )
    );

    setEditingMessageId(null);
    setEditingText("");

    await sendMessage(
      updatedUserMessage.content,
      index
    );
  };

  const regenerate = async (messageIndex: number) => {
    if (!activeChat) return;

    await sendMessage(undefined, messageIndex);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  if (!authReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07080b] text-white">
        <style jsx global>{`
          body {
            margin: 0;
            background: #07080b;
          }
        `}</style>

        <div className="flex flex-col items-center gap-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
            <Sparkles
              size={25}
              className="animate-pulse text-violet-400"
            />
          </div>

          <div className="text-center">
            <div className="text-lg font-semibold tracking-tight">
              ZUQEN
            </div>
            <div className="mt-1 text-xs text-white/30">
              Preparing your workspace...
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#07080b] text-white">
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          min-height: 100%;
          background: #07080b;
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
        }

        ::selection {
          background: rgba(139, 92, 246, 0.3);
        }

        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }

        ::-webkit-scrollbar-track {
          background: transparent;
        }

        ::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.12);
          border-radius: 999px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        textarea {
          field-sizing: content;
        }
      `}</style>

      {sidebarOpen && (
        <button
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-[292px] flex-col border-r border-white/[0.065] bg-[#0b0c10] transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-[76px] items-center justify-between px-5">
          <button
            onClick={() => {
              setActiveAgent("chat");
              setSidebarOpen(false);
            }}
            className="flex items-center gap-3"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-black shadow-xl shadow-white/[0.04]">
              <Sparkles size={18} strokeWidth={2.5} />
            </div>

            <div className="text-left">
              <div className="text-[18px] font-bold tracking-[-0.045em]">
                ZUQEN
              </div>

              <div className="mt-[-1px] text-[8px] font-medium uppercase tracking-[0.3em] text-white/30">
                AI WORKSPACE
              </div>
            </div>
          </button>

          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-2 text-white/30 hover:bg-white/5 hover:text-white lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-4">
          <button
            onClick={createNewChat}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold text-black transition hover:bg-white/90 active:scale-[0.99]"
          >
            <Plus size={17} />
            New conversation
          </button>
        </div>

        <div className="px-4 pb-4 pt-4">
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25"
            />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search conversations"
              className="h-10 w-full rounded-xl border border-white/[0.07] bg-white/[0.025] pl-9 pr-3 text-xs text-white outline-none placeholder:text-white/25 focus:border-white/[0.14]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3">
          <div className="mb-2 flex items-center justify-between px-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/25">
              {showArchived ? "Archived" : "Conversations"}
            </span>

            <button
              onClick={() => setShowArchived((value) => !value)}
              className="text-[10px] text-white/25 hover:text-white/60"
            >
              {showArchived ? "Active" : "Archived"}
            </button>
          </div>

          {visibleChats.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <MessageSquare
                size={22}
                className="mx-auto mb-3 text-white/10"
              />

              <p className="text-xs text-white/25">
                {showArchived
                  ? "No archived conversations"
                  : "No conversations found"}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {visibleChats.map((chat) => {
                const selected = chat.id === activeChatId;

                return (
                  <div
                    key={chat.id}
                    className={`group relative flex items-center rounded-xl transition ${
                      selected
                        ? "bg-white/[0.075]"
                        : "hover:bg-white/[0.035]"
                    }`}
                  >
                    {renamingChatId === chat.id ? (
                      <input
                        autoFocus
                        value={renameText}
                        onChange={(event) =>
                          setRenameText(event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            finishRename();
                          }

                          if (event.key === "Escape") {
                            setRenamingChatId(null);
                          }
                        }}
                        onBlur={finishRename}
                        className="mx-2 my-2 w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-white outline-none"
                      />
                    ) : (
                      <>
                        <button
                          onClick={() => selectChat(chat.id)}
                          className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left"
                        >
                          <MessageSquare
                            size={15}
                            className={`shrink-0 ${
                              selected
                                ? "text-white/70"
                                : "text-white/25"
                            }`}
                          />

                          <span
                            className={`truncate text-[13px] ${
                              selected
                                ? "font-medium text-white/85"
                                : "text-white/45"
                            }`}
                          >
                            {chat.title}
                          </span>
                        </button>

                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            setMenuChatId(
                              menuChatId === chat.id ? null : chat.id
                            );
                          }}
                          className="mr-1 rounded-lg p-2 text-white/20 opacity-0 transition hover:bg-white/10 hover:text-white group-hover:opacity-100"
                        >
                          <MoreHorizontal size={15} />
                        </button>

                        {menuChatId === chat.id && (
                          <div
                            onClick={(event) => event.stopPropagation()}
                            className="absolute right-2 top-[42px] z-50 w-40 rounded-xl border border-white/[0.08] bg-[#15161c] p-1.5 shadow-2xl shadow-black/50"
                          >
                            <button
                              onClick={() => beginRename(chat)}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-white/60 hover:bg-white/5 hover:text-white"
                            >
                              <Edit3 size={14} />
                              Rename
                            </button>

                            <button
                              onClick={() => archiveChat(chat.id)}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-white/60 hover:bg-white/5 hover:text-white"
                            >
                              <Archive size={14} />
                              {chat.archived ? "Restore" : "Archive"}
                            </button>

                            <button
                              onClick={() => deleteChat(chat.id)}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-red-400/70 hover:bg-red-500/10 hover:text-red-400"
                            >
                              <Trash2 size={14} />
                              Delete
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-white/[0.06] p-4">
          <div className="mb-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400">
                  <Sparkles size={14} />
                </div>

                <div>
                  <div className="text-[10px] text-white/30">
                    ZUQEN Chat Credits
                  </div>

                  <div className="mt-0.5 text-sm font-semibold">
                    {creditsLoading
                      ? "..."
                      : credits.toFixed(2)}
                  </div>
                </div>
              </div>

              <a
                href="/pricing"
                className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] font-medium text-white/55 transition hover:bg-white/5 hover:text-white"
              >
                Add
              </a>
            </div>
          </div>

          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/35 transition hover:bg-white/5 hover:text-white"
          >
            <Settings size={17} />
            Account & Settings
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <section className="flex min-h-screen flex-col lg:pl-[292px]">
        {/* TOP BAR */}
        <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-white/[0.06] bg-[#07080b]/85 px-4 backdrop-blur-2xl sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-2.5 text-white/45 hover:bg-white/5 hover:text-white lg:hidden"
            >
              <Menu size={18} />
            </button>

            <div className="relative">
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  setAgentOpen((value) => !value);
                  setTemplatesOpen(false);
                }}
                className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5 transition hover:bg-white/[0.05]"
              >
                <span className="text-violet-400">
                  {currentAgent.icon}
                </span>

                <span className="hidden text-sm font-medium text-white/80 sm:block">
                  {currentAgent.name}
                </span>

                <ChevronDown
                  size={14}
                  className="text-white/25"
                />
              </button>

              {agentOpen && (
                <div
                  onClick={(event) => event.stopPropagation()}
                  className="absolute left-0 top-[52px] z-[60] w-[290px] rounded-2xl border border-white/[0.08] bg-[#111218] p-2 shadow-2xl shadow-black/60"
                >
                  <div className="px-3 pb-2 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/25">
                    ZUQEN Agents
                  </div>

                  {AGENTS.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => selectAgent(agent)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                        currentAgent.id === agent.id
                          ? "bg-white/[0.07]"
                          : "hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.045] text-violet-400">
                        {agent.icon}
                      </div>

                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white/85">
                          {agent.name}
                        </div>

                        <div className="mt-0.5 truncate text-[11px] text-white/30">
                          {agent.description}
                        </div>
                      </div>

                      {currentAgent.id === agent.id && (
                        <Check
                          size={15}
                          className="ml-auto text-violet-400"
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  setTemplatesOpen((value) => !value);
                  setAgentOpen(false);
                }}
                className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5 text-sm text-white/50 transition hover:bg-white/[0.05] hover:text-white"
              >
                <LayoutTemplate size={16} />
                <span className="hidden sm:block">
                  Templates
                </span>
              </button>

              {templatesOpen && (
                <div
                  onClick={(event) => event.stopPropagation()}
                  className="absolute right-0 top-[52px] z-[60] w-[260px] rounded-2xl border border-white/[0.08] bg-[#111218] p-2 shadow-2xl shadow-black/60"
                >
                  <div className="px-3 pb-2 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/25">
                    Templates
                  </div>

                  <button
                    onClick={() => {
                      setTemplatesOpen(false);
                      setComposer(
                        "I want to build a professional website for "
                      );
                      setActiveAgent("chat");
                      textareaRef.current?.focus();
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-white/[0.05]"
                  >
                    <WandSparkles
                      size={17}
                      className="text-violet-400"
                    />

                    <div>
                      <div className="text-sm font-medium">
                        Build
                      </div>

                      <div className="text-[11px] text-white/30">
                        Create something with AI
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setTemplatesOpen(false);
                      setComposer(
                        "Help me create a product listing for "
                      );
                      setActiveAgent("chat");
                      textareaRef.current?.focus();
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-white/[0.05]"
                  >
                    <FileText
                      size={17}
                      className="text-blue-400"
                    />

                    <div>
                      <div className="text-sm font-medium">
                        Sell
                      </div>

                      <div className="text-[11px] text-white/30">
                        Create product content
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setTemplatesOpen(false);
                      setComposer(
                        "Help me research products for "
                      );
                      setActiveAgent("chat");
                      textareaRef.current?.focus();
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-white/[0.05]"
                  >
                    <Search
                      size={17}
                      className="text-emerald-400"
                    />

                    <div>
                      <div className="text-sm font-medium">
                        Buy
                      </div>

                      <div className="text-[11px] text-white/30">
                        Research products
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => setSearchOpen((value) => !value)}
              className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-2.5 text-white/35 hover:bg-white/5 hover:text-white"
            >
              <Search size={17} />
            </button>
          </div>
        </header>

        {searchOpen && (
          <div className="border-b border-white/[0.06] bg-[#0a0b0f] px-4 py-3 lg:px-8">
            <div className="mx-auto max-w-[900px]">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25"
                />

                <input
                  autoFocus
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search your conversations..."
                  className="h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.025] pl-10 pr-4 text-sm text-white outline-none placeholder:text-white/25"
                />
              </div>
            </div>
          </div>
        )}

        {/* CONTENT */}
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mx-auto flex w-full max-w-[960px] flex-1 flex-col px-4 sm:px-6">
            {!activeChat || activeChat.messages.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center py-12 sm:py-16">
                <div className="relative mb-7">
                  <div className="absolute inset-[-25px] rounded-full bg-violet-500/[0.08] blur-3xl" />

                  <div className="relative flex h-[76px] w-[76px] items-center justify-center rounded-[25px] border border-white/[0.08] bg-white/[0.035] shadow-2xl shadow-black/40">
                    <Sparkles
                      size={30}
                      className="text-violet-400"
                    />
                  </div>
                </div>

                <h1 className="text-center text-[30px] font-semibold tracking-[-0.045em] sm:text-[38px]">
                  What can I help you create?
                </h1>

                <p className="mt-3 max-w-[570px] text-center text-sm leading-6 text-white/30">
                  ZUQEN brings chat, websites, images, video and
                  voice generation together in one AI workspace.
                </p>

                <div className="mt-10 grid w-full max-w-[760px] grid-cols-1 gap-3 sm:grid-cols-2">
                  {QUICK_PROMPTS.map((item) => (
                    <button
                      key={item.title}
                      onClick={() => {
                        setComposer(item.prompt);
                        setActiveAgent("chat");
                        setTimeout(
                          () => textareaRef.current?.focus(),
                          50
                        );
                      }}
                      className="group flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-white/[0.12] hover:bg-white/[0.045]"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.045] text-white/45 transition group-hover:bg-violet-500/10 group-hover:text-violet-400">
                        {item.icon}
                      </div>

                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white/75">
                          {item.title}
                        </div>

                        <div className="mt-1 text-xs text-white/25">
                          {item.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 py-8 sm:py-10">
                <div className="space-y-8">
                  {activeChat.messages.map((message, index) => {
                    const isUser = message.role === "user";

                    return (
                      <div
                        key={message.id}
                        className={`group flex gap-3 ${
                          isUser
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        {!isUser && (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.035] text-violet-400">
                            <Sparkles size={15} />
                          </div>
                        )}

                        <div
                          className={`min-w-0 max-w-[88%] ${
                            isUser
                              ? "sm:max-w-[75%]"
                              : "sm:max-w-[82%]"
                          }`}
                        >
                          {editingMessageId === message.id ? (
                            <div className="rounded-2xl border border-white/[0.1] bg-white/[0.035] p-2">
                              <textarea
                                autoFocus
                                value={editingText}
                                onChange={(event) =>
                                  setEditingText(
                                    event.target.value
                                  )
                                }
                                className="min-h-[100px] w-full resize-none bg-transparent p-2 text-sm leading-6 text-white outline-none"
                              />

                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => {
                                    setEditingMessageId(null);
                                    setEditingText("");
                                  }}
                                  className="rounded-lg px-3 py-1.5 text-xs text-white/40 hover:bg-white/5 hover:text-white"
                                >
                                  Cancel
                                </button>

                                <button
                                  onClick={submitEdit}
                                  className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-black"
                                >
                                  Save & regenerate
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div
                                className={`rounded-2xl px-4 py-3 text-[14px] leading-7 ${
                                  isUser
                                    ? "rounded-br-md bg-white text-black"
                                    : "rounded-bl-md border border-white/[0.065] bg-white/[0.025] text-white/75"
                                }`}
                              >
                                <div className="whitespace-pre-wrap break-words">
                                  {message.content}
                                </div>

                                {message.attachments &&
                                  message.attachments.length >
                                    0 && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      {message.attachments.map(
                                        (file) => (
                                          <div
                                            key={`${message.id}-${file.name}`}
                                            className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs ${
                                              isUser
                                                ? "border-black/10 bg-black/5 text-black/60"
                                                : "border-white/10 bg-white/5 text-white/45"
                                            }`}
                                          >
                                            <File size={13} />
                                            <span className="max-w-[160px] truncate">
                                              {file.name}
                                            </span>
                                          </div>
                                        )
                                      )}
                                    </div>
                                  )}
                              </div>

                              <div
                                className={`mt-1 flex items-center gap-1 opacity-0 transition group-hover:opacity-100 ${
                                  isUser
                                    ? "justify-end"
                                    : "justify-start"
                                }`}
                              >
                                <button
                                  onClick={() =>
                                    copyMessage(message)
                                  }
                                  className="rounded-lg p-1.5 text-white/20 hover:bg-white/5 hover:text-white/70"
                                  title="Copy"
                                >
                                  {copiedId === message.id ? (
                                    <Check size={13} />
                                  ) : (
                                    <Copy size={13} />
                                  )}
                                </button>

                                {isUser && (
                                  <button
                                    onClick={() =>
                                      editMessage(message)
                                    }
                                    className="rounded-lg p-1.5 text-white/20 hover:bg-white/5 hover:text-white/70"
                                    title="Edit"
                                  >
                                    <Edit3 size={13} />
                                  </button>
                                )}

                                {!isUser && (
                                  <button
                                    onClick={() =>
                                      regenerate(index)
                                    }
                                    disabled={generating}
                                    className="rounded-lg p-1.5 text-white/20 hover:bg-white/5 hover:text-white/70"
                                    title="Regenerate"
                                  >
                                    <RotateCcw size={13} />
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>

                        {isUser && (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.08] text-white/45">
                            <User size={15} />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {generating && (
                    <div className="flex gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.035] text-violet-400">
                        <Sparkles size={15} />
                      </div>

                      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-white/[0.065] bg-white/[0.025] px-4 py-4">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/50" />
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/35 [animation-delay:150ms]" />
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/20 [animation-delay:300ms]" />
                      </div>
                    </div>
                  )}

                  <div ref={bottomRef} />
                </div>
              </div>
            )}

            {/* COMPOSER */}
            <div className="sticky bottom-0 z-20 pb-4 pt-3 sm:pb-7">
              <div className="rounded-[22px] border border-white/[0.09] bg-[#101116]/95 p-2 shadow-2xl shadow-black/40 backdrop-blur-2xl">
                {attachments.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto px-2 pb-2 pt-1">
                    {attachments.map((file, index) => (
                      <div
                        key={`${file.name}-${index}`}
                        className="flex shrink-0 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2"
                      >
                        {file.type.startsWith("image/") ? (
                          <ImageIcon
                            size={14}
                            className="text-violet-400"
                          />
                        ) : (
                          <File
                            size={14}
                            className="text-white/40"
                          />
                        )}

                        <span className="max-w-[150px] truncate text-xs text-white/50">
                          {file.name}
                        </span>

                        <button
                          onClick={() =>
                            removeAttachment(index)
                          }
                          className="text-white/20 hover:text-white"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <textarea
                  ref={textareaRef}
                  value={composer}
                  onChange={(event) =>
                    setComposer(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey
                    ) {
                      event.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder={
                    activeAgent === "chat"
                      ? "Message ZUQEN..."
                      : `Message ${currentAgent.name}...`
                  }
                  rows={1}
                  className="max-h-[200px] min-h-[54px] w-full resize-none bg-transparent px-3 py-3 text-[14px] leading-6 text-white outline-none placeholder:text-white/22"
                />

                <div className="flex items-center justify-between px-1 pb-1">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        fileInputRef.current?.click()
                      }
                      className="rounded-xl p-2.5 text-white/30 transition hover:bg-white/5 hover:text-white"
                      title="Attach files"
                    >
                      <Paperclip size={18} />
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(event) => {
                        handleFiles(event.target.files);

                        event.currentTarget.value = "";
                      }}
                    />

                    <button
                      onClick={() => {
                        if (activeAgent === "voice") {
                          window.location.href =
                            "/generate-voice";
                        }
                      }}
                      className="hidden rounded-xl p-2.5 text-white/30 transition hover:bg-white/5 hover:text-white sm:block"
                      title="Voice"
                    >
                      <Mic size={18} />
                    </button>

                    <span className="ml-1 hidden text-[10px] text-white/20 md:block">
                      Enter to send · Shift + Enter for new line
                    </span>
                  </div>

                  <button
                    onClick={() => sendMessage()}
                    disabled={
                      generating ||
                      !composer.trim() ||
                      activeAgent !== "chat"
                    }
                    className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
                      composer.trim() &&
                      !generating &&
                      activeAgent === "chat"
                        ? "bg-white text-black hover:bg-white/90"
                        : "bg-white/[0.055] text-white/15"
                    }`}
                    title={
                      activeAgent !== "chat"
                        ? "Open this agent from the agent selector"
                        : "Send"
                    }
                  >
                    <ArrowUp
                      size={18}
                      strokeWidth={2.5}
                    />
                  </button>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-white/18">
                <Bot size={11} />
                <span>
                  ZUQEN AI may make mistakes. Verify important
                  information.
                </span>

                <span>·</span>

                <span>
                  {creditsLoading
                    ? "Loading credits..."
                    : `${credits.toFixed(2)} credits`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}