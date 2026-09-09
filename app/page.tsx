
"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase";

type Attachment = {
  id?: string;
  name: string;
  type: string;
  url?: string;
  key?: string;
  size?: number;
  relativePath?: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
  attachments?: Attachment[];
};

type Chat = {
  id: string;
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

function Icon({
  children,
  size = 18,
}: {
  children: ReactNode;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function formatCredits(value: number) {
  if (!Number.isFinite(value)) return "0";

  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }

  return Math.floor(value).toLocaleString();
}

function formatFileSize(size = 0) {
  if (!size) return "";

  if (size < 1024) return `${size} B`;

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function featureIcon(feature: string) {
  if (feature === "chat") return "✦";
  if (feature === "website_builder") return "⌘";
  if (feature === "image_generator") return "◈";
  if (feature === "video_generator") return "▶";
  if (feature === "voice_generator") return "◉";

  return "•";
}

function featureLabel(feature: string) {
  if (feature === "chat") return "AI Chat";
  if (feature === "website_builder") return "Website Builder";
  if (feature === "image_generator") return "Image Generator";
  if (feature === "video_generator") return "Video Generator";
  if (feature === "voice_generator") return "Voice Generator";

  return feature;
}

export default function HomePage() {
  const supabase = createClient();

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
  const [editingText, setEditingText] = useState("");

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

  const [lightMode, setLightMode] = useState(false);

  const [agentOpen, setAgentOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] =
    useState("ZUQEN AI");

  const [creditsOpen, setCreditsOpen] = useState(false);
  const [featureCredits, setFeatureCredits] =
    useState<FeatureCredit[]>([]);
  const [creditsLoading, setCreditsLoading] =
    useState(false);

  const [copiedMessage, setCopiedMessage] =
    useState<string | null>(null);

  const fileInput = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef =
    useRef<HTMLTextAreaElement>(null);

  const activeChats = chats.filter(
    (chat) => !chat.archived
  );

  const archivedChats = chats.filter(
    (chat) => chat.archived
  );

  const totalCredits = featureCredits.reduce(
    (total, item) =>
      total + Number(item.balance || 0),
    0
  );

  const totalAllocatedCredits =
    featureCredits.reduce(
      (total, item) =>
        total + Number(item.total_granted || 0),
      0
    );

  const totalUsedCredits =
    featureCredits.reduce(
      (total, item) =>
        total + Number(item.total_used || 0),
      0
    );

  const totalUsagePercentage =
    totalAllocatedCredits > 0
      ? Math.min(
          100,
          Math.round(
            (totalUsedCredits /
              totalAllocatedCredits) *
              100
          )
        )
      : 0;

  const chatCredits = featureCredits.find(
    (item) => item.feature_key === "chat"
  );

  useEffect(() => {
    document.documentElement.classList.toggle(
      "light",
      lightMode
    );
  }, [lightMode]);

  async function loadFeatureCredits(userId: string) {
    setCreditsLoading(true);

    try {
      const [
        { data: balances, error: balanceError },
        { data: features, error: featureError },
      ] = await Promise.all([
        supabase
          .from("feature_credit_balances")
          .select(
            "feature_key,balance,total_granted,total_used"
          )
          .eq("user_id", userId),

        supabase
          .from("provider_features")
          .select(
            "feature_key,feature_name,provider,enabled"
          )
          .eq("enabled", true),
      ]);

      if (balanceError) {
        console.error(balanceError);
      }

      if (featureError) {
        console.error(featureError);
      }

      const balanceMap = new Map(
        (balances || []).map((item: any) => [
          item.feature_key,
          item,
        ])
      );

      const mapped: FeatureCredit[] = (
        features || []
      ).map((feature: any) => {
        const balance = balanceMap.get(
          feature.feature_key
        ) as any;

        return {
          feature_key: feature.feature_key,
          feature_name:
            feature.feature_name ||
            featureLabel(feature.feature_key),
          provider: feature.provider,
          balance: Number(
            balance?.balance || 0
          ),
          total_granted: Number(
            balance?.total_granted || 0
          ),
          total_used: Number(
            balance?.total_used || 0
          ),
        };
      });

      setFeatureCredits(mapped);
    } catch (error) {
      console.error(
        "Failed to load feature credits:",
        error
      );
    } finally {
      setCreditsLoading(false);
    }
  }

  async function loadChats(userId: string) {
    const { data, error } = await supabase
      .from("ZUQEN_chats")
      .select(
        "id,title,archived,created_at,updated_at"
      )
      .eq("user_id", userId)
      .order("updated_at", {
        ascending: false,
      });

    if (error) {
      console.error(error);
      return;
    }

    setChats((data || []) as Chat[]);
  }

  async function initializeUser() {
    try {
      let {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (!currentUser) {
        const { data, error } =
          await supabase.auth.signInAnonymously();

        if (error) {
          console.error(
            "Anonymous auth failed:",
            error
          );

          setAuthReady(true);
          return;
        }

        currentUser = data.user;
      }

      if (!currentUser) {
        setAuthReady(true);
        return;
      }

      setUser(currentUser);

      await Promise.all([
        loadChats(currentUser.id),
        loadFeatureCredits(currentUser.id),
      ]);
    } catch (error) {
      console.error(error);
    } finally {
      setAuthReady(true);
    }
  }

  useEffect(() => {
    initializeUser();
  }, []);

  useEffect(() => {
    const handleWindowClick = () => {
      setMenuOpen(null);
      setAgentOpen(false);
      setCreditsOpen(false);
    };

    window.addEventListener(
      "click",
      handleWindowClick
    );

    return () =>
      window.removeEventListener(
        "click",
        handleWindowClick
      );
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, loading]);

  function startNewConversation() {
    setActiveChat(null);
    setMessages([]);
    setAttachments([]);
    setInput("");
    setEditingId(null);
    setEditingText("");

    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  }

  async function createChat() {
    if (!user) return null;

    const { data, error } = await supabase
      .from("ZUQEN_chats")
      .insert({
        user_id: user.id,
        title: "New conversation",
        archived: false,
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      return null;
    }

    setChats((previous) => [
      data as Chat,
      ...previous,
    ]);

    setActiveChat(data.id);
    setMessages([]);

    return data.id;
  }

  async function openChat(chatId: string) {
    setActiveChat(chatId);
    setArchiveOpen(false);
    setMenuOpen(null);
    setEditingId(null);

    const { data, error } = await supabase
      .from("ZUQEN_messages")
      .select(
        "id,role,content,created_at,attachments"
      )
      .eq("chat_id", chatId)
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      console.error(error);
      return;
    }

    setMessages((data || []) as Message[]);
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

    setChats((previous) =>
      previous.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              archived: true,
            }
          : chat
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

    setChats((previous) =>
      previous.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              archived: false,
            }
          : chat
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

    setChats((previous) =>
      previous.filter(
        (chat) => chat.id !== chatId
      )
    );

    if (activeChat === chatId) {
      setActiveChat(null);
      setMessages([]);
    }

    setMenuOpen(null);
  }

  async function renameChat(
    chatId: string,
    title: string
  ) {
    const cleanTitle =
      title.trim() || "New conversation";

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

    setChats((previous) =>
      previous.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              title: cleanTitle,
              updated_at:
                new Date().toISOString(),
            }
          : chat
      )
    );
  }

  function beginRename(chat: Chat) {
    const title = window.prompt(
      "Rename conversation",
      chat.title
    );

    if (title === null) return;

    renameChat(chat.id, title);
    setMenuOpen(null);
  }

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(
      event.target.files || []
    );

    if (!files.length) return;

    setUploading(true);

    const newAttachments: Attachment[] =
      files.map((file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type,
        size: file.size,
      }));

    setAttachments((previous) => [
      ...previous,
      ...newAttachments,
    ]);

    event.target.value = "";
    setUploading(false);
  }

  function removeAttachment(id?: string) {
    setAttachments((previous) =>
      previous.filter(
        (item) => item.id !== id
      )
    );
  }

  async function copyMessage(
    message: Message
  ) {
    try {
      await navigator.clipboard.writeText(
        message.content
      );

      setCopiedMessage(message.id);

      setTimeout(() => {
        setCopiedMessage(null);
      }, 1600);
    } catch (error) {
      console.error(error);
    }
  }

  function beginEditMessage(message: Message) {
    if (message.role !== "user") return;

    setEditingId(message.id);
    setEditingText(message.content);

    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingText("");
  }

  async function saveEditedMessage(
    message: Message
  ) {
    const cleanText = editingText.trim();

    if (!cleanText || loading) return;

    const index = messages.findIndex(
      (item) => item.id === message.id
    );

    if (index === -1) return;

    const updatedMessages =
      messages.slice(0, index + 1);

    updatedMessages[index] = {
      ...updatedMessages[index],
      content: cleanText,
    };

    setMessages(updatedMessages);
    setEditingId(null);
    setEditingText("");

    if (!activeChat || !user) return;

    try {
      await supabase
        .from("ZUQEN_messages")
        .update({
          content: cleanText,
        })
        .eq("id", message.id);

      await generateAssistantResponse(
        updatedMessages,
        activeChat,
        cleanText
      );
    } catch (error) {
      console.error(error);
    }
  }

  async function regenerate(
    message: Message
  ) {
    if (loading || message.role !== "assistant") {
      return;
    }

    const assistantIndex =
      messages.findIndex(
        (item) => item.id === message.id
      );

    if (assistantIndex <= 0) return;

    const previousUserMessage =
      [...messages]
        .slice(0, assistantIndex)
        .reverse()
        .find((item) => item.role === "user");

    if (!previousUserMessage) return;

    const baseMessages =
      messages.slice(0, assistantIndex);

    setMessages(baseMessages);

    if (!activeChat || !user) return;

    await generateAssistantResponse(
      baseMessages,
      activeChat,
      previousUserMessage.content
    );
  }

  async function generateAssistantResponse(
    conversationMessages: Message[],
    chatId: string,
    lastUserText: string
  ) {
    if (!user) return;

    setLoading(true);

    try {
      const response = await fetch(
        "/api/chat",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: conversationMessages,
            attachments: [],
            agent: selectedAgent,
          }),
        }
      );

      if (!response.ok) {
        const errorText =
          await response.text();

        throw new Error(
          errorText ||
            "ZUQEN AI request failed."
        );
      }

      if (!response.body) {
        throw new Error(
          "No response body received."
        );
      }

      const reader =
        response.body.getReader();

      const decoder = new TextDecoder();

      let assistantText = "";

      const assistantId =
        crypto.randomUUID();

      setMessages((previous) => [
        ...previous,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          created_at:
            new Date().toISOString(),
        },
      ]);

      while (true) {
        const { done, value } =
          await reader.read();

        if (done) break;

        const chunk =
          decoder.decode(value, {
            stream: true,
          });

        const lines =
          chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data:")) {
            continue;
          }

          const raw = line
            .replace(/^data:\s*/, "")
            .trim();

          if (!raw || raw === "[DONE]") {
            continue;
          }

          try {
            const parsed =
              JSON.parse(raw);

            if (parsed.text) {
              assistantText +=
                parsed.text;

              setMessages((previous) =>
                previous.map(
                  (current) =>
                    current.id ===
                    assistantId
                      ? {
                          ...current,
                          content:
                            assistantText,
                        }
                      : current
                )
              );
            }
          } catch {
            // Ignore malformed stream chunks.
          }
        }
      }

      if (assistantText.trim()) {
        await supabase
          .from("ZUQEN_messages")
          .insert({
            chat_id: chatId,
            role: "assistant",
            content: assistantText,
            attachments: [],
          });
      }

      if (user?.id) {
        await loadFeatureCredits(user.id);
        await loadChats(user.id);
      }

      if (lastUserText) {
        await renameChat(
          chatId,
          lastUserText.length > 45
            ? `${lastUserText.slice(0, 45)}…`
            : lastUserText
        );
      }
    } catch (error) {
      console.error(error);

      setMessages((previous) => [
        ...previous,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            error instanceof Error
              ? error.message
              : "Something went wrong.",
          created_at:
            new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage() {
    const text = input.trim();

    if (
      (!text && !attachments.length) ||
      loading
    ) {
      return;
    }

    if (!user) return;

    let chatId = activeChat;

    if (!chatId) {
      chatId = await createChat();

      if (!chatId) return;
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      created_at:
        new Date().toISOString(),
      attachments:
        attachments.length > 0
          ? attachments
          : undefined,
    };

    const conversation =
      activeChat
        ? [...messages, userMessage]
        : [userMessage];

    setMessages((previous) => [
      ...previous,
      userMessage,
    ]);

    setInput("");
    setAttachments([]);

    await generateAssistantResponse(
      conversation,
      chatId,
      text
    );
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      sendMessage();
    }
  }

  function selectAgent(agent: string) {
    setSelectedAgent(agent);
    setAgentOpen(false);

    if (agent === "Website Builder") {
      window.location.href =
        "/website-builder";
      return;
    }

    if (agent === "Image Generator") {
      window.location.href =
        "/image-generator";
      return;
    }

    if (agent === "Video Generator") {
      window.location.href =
        "/video-generator";
      return;
    }

    if (agent === "Voice Generator") {
      window.location.href =
        "/generate-voice";
    }
  }

  function handleComposerChange(
    value: string
  ) {
    if (editingId) {
      setEditingText(value);
    } else {
      setInput(value);
    }
  }

  const composerValue = editingId
    ? editingText
    : input;

  if (!authReady) {
    return (
      <div className="ZUQEN-loading-screen">
        <div className="ZUQEN-loading-orb">
          <span>Z</span>
        </div>

        <div className="ZUQEN-loading-title">
          ZUQEN
        </div>

        <div className="ZUQEN-loading-sub">
          Preparing your workspace…
        </div>
      </div>
    );
  }

  return (
    <main
      className={`ZUQEN-app ${
        lightMode ? "light" : ""
      }`}
    >
      <aside
        className={`ZUQEN-sidebar ${
          sidebar ? "" : "closed"
        }`}
      >
        <div className="ZUQEN-sidebar-inner">
          <div className="ZUQEN-side-top">
            <div className="ZUQEN-brand-row">
              <div className="ZUQEN-brand">
                <div className="ZUQEN-brand-mark">
                  Z
                </div>

                <div className="ZUQEN-brand-text">
                  <strong>ZUQEN</strong>
                  <span>AI WORKSPACE</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="ZUQEN-new-chat"
              onClick={
                startNewConversation
              }
            >
              <span className="ZUQEN-new-chat-icon">
                <Icon size={16}>
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </Icon>
              </span>

              <span>
                New conversation
              </span>

              <span className="ZUQEN-new-chat-shortcut">
                ⌘K
              </span>
            </button>
          </div>

          <div className="ZUQEN-history">
            <div className="ZUQEN-section-header">
              <div className="ZUQEN-section-title">
                <span className="ZUQEN-section-dot" />
                <span>
                  {archiveOpen
                    ? "Archived"
                    : "Conversations"}
                </span>
              </div>

              <span className="ZUQEN-section-count">
                {archiveOpen
                  ? archivedChats.length
                  : activeChats.length}
              </span>
            </div>

            {archiveOpen ? (
              <>
                {archivedChats.length ===
                  0 && (
                  <div className="ZUQEN-empty-history">
                    <div className="ZUQEN-empty-icon">
                      <Icon size={18}>
                        <path d="M4 7h16" />
                        <path d="M5 7v12h14V7" />
                        <path d="M9 11h6" />
                      </Icon>
                    </div>

                    <strong>
                      No archived chats
                    </strong>

                    <span>
                      Archived conversations
                      will appear here.
                    </span>
                  </div>
                )}

                {archivedChats.map(
                  (chat) => (
                    <ChatItem
                      key={chat.id}
                      chat={chat}
                      active={
                        activeChat ===
                        chat.id
                      }
                      menuOpen={
                        menuOpen ===
                        chat.id
                      }
                      archived
                      onOpen={() =>
                        openChat(chat.id)
                      }
                      onMenu={() =>
                        setMenuOpen(
                          menuOpen ===
                            chat.id
                            ? null
                            : chat.id
                        )
                      }
                      onRestore={() =>
                        restoreChat(
                          chat.id
                        )
                      }
                      onRename={() =>
                        beginRename(chat)
                      }
                      onDelete={() =>
                        deleteChat(
                          chat.id
                        )
                      }
                    />
                  )
                )}
              </>
            ) : (
              <>
                {activeChats.length ===
                  0 && (
                  <div className="ZUQEN-empty-history">
                    <div className="ZUQEN-empty-icon">
                      <Icon size={18}>
                        <path d="M4 5h16v12H4z" />
                        <path d="m8 21 4-4 4 4" />
                      </Icon>
                    </div>

                    <strong>
                      No conversations yet
                    </strong>

                    <span>
                      Start a new conversation
                      with ZUQEN.
                    </span>
                  </div>
                )}

                {activeChats.map(
                  (chat) => (
                    <ChatItem
                      key={chat.id}
                      chat={chat}
                      active={
                        activeChat ===
                        chat.id
                      }
                      menuOpen={
                        menuOpen ===
                        chat.id
                      }
                      archived={false}
                      onOpen={() =>
                        openChat(chat.id)
                      }
                      onMenu={() =>
                        setMenuOpen(
                          menuOpen ===
                            chat.id
                            ? null
                            : chat.id
                        )
                      }
                      onArchive={() =>
                        archiveChat(
                          chat.id
                        )
                      }
                      onRename={() =>
                        beginRename(chat)
                      }
                      onDelete={() =>
                        deleteChat(
                          chat.id
                        )
                      }
                    />
                  )
                )}
              </>
            )}

            <button
              type="button"
              className={`ZUQEN-archive-button ${
                archiveOpen ? "active" : ""
              }`}
              onClick={() =>
                setArchiveOpen(
                  (value) => !value
                )
              }
            >
              <span className="ZUQEN-archive-icon">
                <Icon size={15}>
                  <path d="M4 4h16v4H4z" />
                  <path d="M6 8v11h12V8" />
                  <path d="M9 12h6" />
                </Icon>
              </span>

              <span>
                {archiveOpen
                  ? "Back to History"
                  : "Archived"}
              </span>

              {!archiveOpen &&
                archivedChats.length >
                  0 && (
                  <span className="ZUQEN-archive-count">
                    {archivedChats.length}
                  </span>
                )}
            </button>
          </div>

          <div className="ZUQEN-sidebar-footer">
            <div className="ZUQEN-account">
              <div className="ZUQEN-avatar">
                {user?.email?.[0]?.toUpperCase() ||
                  "U"}
              </div>

              <div className="ZUQEN-account-info">
                <strong>
                  {user?.email ||
                    "ZUQEN User"}
                </strong>

                <span>
                  <i />
                  Free account
                </span>
              </div>

              <button
                type="button"
                className="ZUQEN-account-more"
                title="Account"
              >
                <Icon size={15}>
                  <circle
                    cx="12"
                    cy="12"
                    r="1"
                  />
                  <circle
                    cx="19"
                    cy="12"
                    r="1"
                  />
                  <circle
                    cx="5"
                    cy="12"
                    r="1"
                  />
                </Icon>
              </button>
            </div>
          </div>
        </div>
      </aside>

      <section className="ZUQEN-main">
        <header className="ZUQEN-topbar">
          <div className="ZUQEN-topbar-left">
            <button
              type="button"
              className="ZUQEN-top-action"
              onClick={() =>
                setSidebar(
                  (value) => !value
                )
              }
              title="Toggle sidebar"
            >
              <Icon size={18}>
                <path d="M4 6h16" />
                <path d="M4 12h16" />
                <path d="M4 18h16" />
              </Icon>
            </button>

            <div className="ZUQEN-topbar-info">
              <div className="ZUQEN-title-line">
                <strong>
                  {activeChat
                    ? chats.find(
                        (chat) =>
                          chat.id ===
                          activeChat
                      )?.title ||
                      "ZUQEN AI"
                    : "ZUQEN AI"}
                </strong>

                <span className="ZUQEN-live-badge">
                  <i />
                  Online
                </span>
              </div>

              <span>
                Your intelligent workspace
              </span>
            </div>
          </div>

          <div className="ZUQEN-topbar-actions">
            <div
              className="ZUQEN-credits-selector"
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <button
                type="button"
                className={`ZUQEN-credits-button ${
                  creditsOpen
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  setCreditsOpen(
                    (value) => !value
                  )
                }
                title="View credits"
              >
                <span className="ZUQEN-credits-icon">
                  <Icon size={15}>
                    <circle
                      cx="12"
                      cy="12"
                      r="8"
                    />
                    <path d="M12 8v8" />
                    <path d="M9 12h6" />
                  </Icon>
                </span>

                <span className="ZUQEN-credits-info">
                  <small>Credits</small>

                  <strong>
                    {creditsLoading
                      ? "..."
                      : formatCredits(
                          totalCredits
                        )}
                  </strong>
                </span>

                <span className="ZUQEN-chevron">
                  <Icon size={13}>
                    <path d="m6 9 6 6 6-6" />
                  </Icon>
                </span>
              </button>

              {creditsOpen && (
                <div
                  className="ZUQEN-credit-panel"
                  onClick={(event) =>
                    event.stopPropagation()
                  }
                >
                  <div className="ZUQEN-credit-panel-top">
                    <div>
                      <span className="ZUQEN-credit-kicker">
                        ZUQEN WALLET
                      </span>

                      <div className="ZUQEN-credit-total-row">
                        <strong>
                          {creditsLoading
                            ? "..."
                            : formatCredits(
                                totalCredits
                              )}
                        </strong>

                        <span>
                          available
                        </span>
                      </div>
                    </div>

                    <div className="ZUQEN-credit-symbol">
                      <Icon size={18}>
                        <circle
                          cx="12"
                          cy="12"
                          r="8"
                        />
                        <path d="M12 8v8" />
                        <path d="M9 12h6" />
                      </Icon>
                    </div>
                  </div>

                  <div className="ZUQEN-credit-progress-wrap">
                    <div className="ZUQEN-credit-progress-labels">
                      <span>
                        Usage
                      </span>

                      <strong>
                        {totalUsagePercentage}%
                      </strong>
                    </div>

                    <div className="ZUQEN-credit-progress">
                      <div
                        style={{
                          width: `${totalUsagePercentage}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="ZUQEN-credit-stats">
                    <div>
                      <span>
                        Allocated
                      </span>
                      <strong>
                        {formatCredits(
                          totalAllocatedCredits
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Used
                      </span>
                      <strong>
                        {formatCredits(
                          totalUsedCredits
                        )}
                      </strong>
                    </div>
                  </div>

                  <div className="ZUQEN-credit-divider" />

                  <div className="ZUQEN-credit-section-heading">
                    Feature balances
                  </div>

                  <div className="ZUQEN-credit-features">
                    {featureCredits.map(
                      (feature) => {
                        const low =
                          feature.balance >
                            0 &&
                          feature.total_granted >
                            0 &&
                          feature.balance <=
                            feature.total_granted *
                              0.15;

                        const empty =
                          feature.balance <=
                          0;

                        return (
                          <div
                            key={
                              feature.feature_key
                            }
                            className="ZUQEN-credit-feature"
                          >
                            <div className="ZUQEN-credit-feature-icon">
                              {featureIcon(
                                feature.feature_key
                              )}
                            </div>

                            <div className="ZUQEN-credit-feature-info">
                              <strong>
                                {
                                  feature.feature_name
                                }
                              </strong>

                              <span>
                                Provider-backed
                                credits
                              </span>
                            </div>

                            <div
                              className={`ZUQEN-feature-balance ${
                                low
                                  ? "low"
                                  : ""
                              } ${
                                empty
                                  ? "empty"
                                  : ""
                              }`}
                            >
                              {formatCredits(
                                feature.balance
                              )}
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>

                  {chatCredits &&
                    chatCredits.balance <=
                      0 && (
                      <div className="ZUQEN-credit-empty">
                        <span>!</span>
                        <div>
                          <strong>
                            Chat credits
                            exhausted
                          </strong>
                          <small>
                            Refill credits to
                            continue using
                            ZUQEN AI.
                          </small>
                        </div>
                      </div>
                    )}

                  {totalCredits > 0 &&
                    totalAllocatedCredits >
                      0 &&
                    totalCredits <=
                      totalAllocatedCredits *
                        0.15 && (
                      <div className="ZUQEN-credit-warning">
                        <span>!</span>
                        Your total credit
                        balance is running
                        low.
                      </div>
                    )}

                  {totalCredits <= 0 &&
                    featureCredits.length >
                      0 && (
                      <button
                        type="button"
                        className="ZUQEN-credit-get-more"
                        onClick={() =>
                          window.alert(
                            "Premium credit refill will be available soon."
                          )
                        }
                      >
                        <span>
                          Get More Credits
                        </span>

                        <Icon size={14}>
                          <path d="m9 18 6-6-6-6" />
                        </Icon>
                      </button>
                    )}
                </div>
              )}
            </div>

            <div
              className="ZUQEN-agent-selector"
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <button
                type="button"
                className={`ZUQEN-agent-button ${
                  agentOpen ? "active" : ""
                }`}
                onClick={() =>
                  setAgentOpen(
                    (value) => !value
                  )
                }
              >
                <span className="ZUQEN-agent-icon">
                  ✦
                </span>

                <span className="ZUQEN-agent-label">
                  {selectedAgent}
                </span>

                <Icon size={13}>
                  <path d="m6 9 6 6 6-6" />
                </Icon>
              </button>

              {agentOpen && (
                <div className="ZUQEN-agent-dropdown">
                  <div className="ZUQEN-agent-dropdown-title">
                    AI AGENTS
                  </div>

                  {[
                    "ZUQEN AI",
                    "Website Builder",
                    "Image Generator",
                    "Video Generator",
                    "Voice Generator",
                  ].map((agent) => (
                    <button
                      key={agent}
                      type="button"
                      className={
                        selectedAgent ===
                        agent
                          ? "selected"
                          : ""
                      }
                      onClick={() =>
                        selectAgent(
                          agent
                        )
                      }
                    >
                      <span className="ZUQEN-agent-option-icon">
                        {featureIcon(
                          agent ===
                            "ZUQEN AI"
                            ? "chat"
                            : agent ===
                              "Website Builder"
                            ? "website_builder"
                            : agent ===
                              "Image Generator"
                            ? "image_generator"
                            : agent ===
                              "Video Generator"
                            ? "video_generator"
                            : "voice_generator"
                        )}
                      </span>

                      <span>
                        {agent}
                      </span>

                      {selectedAgent ===
                        agent && (
                        <span className="ZUQEN-agent-check">
                          ✓
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              className="ZUQEN-top-action"
              onClick={() =>
                setLightMode(
                  (value) => !value
                )
              }
              title="Toggle theme"
            >
              <Icon size={17}>
                {lightMode ? (
                  <>
                    <circle
                      cx="12"
                      cy="12"
                      r="4"
                    />
                    <path d="M12 2v2" />
                    <path d="M12 20v2" />
                    <path d="m4.93 4.93 1.41 1.41" />
                    <path d="m17.66 17.66 1.41 1.41" />
                    <path d="M2 12h2" />
                    <path d="M20 12h2" />
                  </>
                ) : (
                  <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.5 6.5 0 0 0 21 12.8Z" />
                )}
              </Icon>
            </button>
          </div>
        </header>

        <div className="ZUQEN-chat-area">
          {messages.length === 0 ? (
            <div className="ZUQEN-welcome">
              <div className="ZUQEN-welcome-glow" />

              <div className="ZUQEN-welcome-mark">
                Z
              </div>

              <div className="ZUQEN-welcome-kicker">
                INTELLIGENT WORKSPACE
              </div>

              <h1>
                What can I help you
                <span> create?</span>
              </h1>

              <p>
                Ask questions, write content,
                analyze ideas, build websites,
                generate media and more with
                ZUQEN AI.
              </p>

              <div className="ZUQEN-prompts">
                {[
                  {
                    icon: "✦",
                    text:
                      "Explain something to me",
                  },
                  {
                    icon: "Aa",
                    text:
                      "Help me write something",
                  },
                  {
                    icon: "⌘",
                    text:
                      "Build a website idea",
                  },
                  {
                    icon: "◈",
                    text:
                      "Analyze my idea",
                  },
                ].map((prompt) => (
                  <button
                    key={prompt.text}
                    type="button"
                    onClick={() =>
                      setInput(
                        prompt.text
                      )
                    }
                  >
                    <span>
                      {prompt.icon}
                    </span>

                    {prompt.text}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="ZUQEN-messages">
              {messages.map(
                (message) => (
                  <div
                    key={message.id}
                    className={`ZUQEN-message ${
                      message.role
                    }`}
                  >
                    <div className="ZUQEN-message-avatar">
                      {message.role ===
                      "user"
                        ? user?.email?.[0]?.toUpperCase() ||
                          "U"
                        : "Z"}
                    </div>

                    <div className="ZUQEN-message-body">
                      <div className="ZUQEN-message-header">
                        <div className="ZUQEN-message-role">
                          {message.role ===
                          "user"
                            ? "You"
                            : "ZUQEN"}
                        </div>

                        <div className="ZUQEN-message-actions">
                          {message.role ===
                            "assistant" && (
                            <button
                              type="button"
                              onClick={() =>
                                regenerate(
                                  message
                                )
                              }
                              title="Regenerate"
                              disabled={
                                loading
                              }
                            >
                              <Icon size={14}>
                                <path d="M20 11a8 8 0 0 0-14.9-4" />
                                <path d="M4 5v5h5" />
                                <path d="M4 13a8 8 0 0 0 14.9 4" />
                                <path d="M20 19v-5h-5" />
                              </Icon>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              copyMessage(
                                message
                              )
                            }
                            title="Copy"
                          >
                            {copiedMessage ===
                            message.id ? (
                              <span className="ZUQEN-copied">
                                ✓
                              </span>
                            ) : (
                              <Icon size={14}>
                                <rect
                                  x="9"
                                  y="9"
                                  width="11"
                                  height="11"
                                  rx="2"
                                />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </Icon>
                            )}
                          </button>

                          {message.role ===
                            "user" && (
                            <button
                              type="button"
                              onClick={() =>
                                beginEditMessage(
                                  message
                                )
                              }
                              title="Edit"
                            >
                              <Icon size={14}>
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
                              </Icon>
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="ZUQEN-message-content">
                        {message.content ||
                          "Thinking…"}
                      </div>

                      {message.attachments &&
                        message.attachments
                          .length >
                          0 && (
                          <div className="ZUQEN-attachments">
                            {message.attachments.map(
                              (
                                attachment
                              ) => (
                                <div
                                  key={
                                    attachment.id ||
                                    attachment.name
                                  }
                                  className="ZUQEN-attachment-card"
                                >
                                  <div className="ZUQEN-attachment-icon">
                                    <Icon
                                      size={
                                        15
                                      }
                                    >
                                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                                      <path d="M14 2v6h6" />
                                    </Icon>
                                  </div>

                                  <div>
                                    <strong>
                                      {
                                        attachment.name
                                      }
                                    </strong>

                                    <span>
                                      {formatFileSize(
                                        attachment.size
                                      )}
                                    </span>
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        )}
                    </div>
                  </div>
                )
              )}

              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className="ZUQEN-composer-area">
          {editingId && (
            <div className="ZUQEN-edit-bar">
              <div>
                <span className="ZUQEN-edit-icon">
                  <Icon size={14}>
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
                  </Icon>
                </span>

                <span>
                  Editing message
                </span>
              </div>

              <button
                type="button"
                onClick={cancelEdit}
              >
                Cancel
              </button>
            </div>
          )}

          {attachments.length > 0 && (
            <div className="ZUQEN-pending-files">
              {attachments.map(
                (attachment) => (
                  <div
                    key={
                      attachment.id
                    }
                    className="ZUQEN-pending-file"
                  >
                    <div className="ZUQEN-pending-file-icon">
                      <Icon size={14}>
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                        <path d="M14 2v6h6" />
                      </Icon>
                    </div>

                    <div className="ZUQEN-pending-file-info">
                      <strong>
                        {attachment.name}
                      </strong>

                      <span>
                        {formatFileSize(
                          attachment.size
                        )}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        removeAttachment(
                          attachment.id
                        )
                      }
                      title="Remove"
                    >
                      <Icon size={14}>
                        <path d="M6 6l12 12" />
                        <path d="M18 6 6 18" />
                      </Icon>
                    </button>
                  </div>
                )
              )}
            </div>
          )}

          <div className="ZUQEN-composer">
            <button
              type="button"
              className="ZUQEN-composer-action"
              onClick={() =>
                fileInput.current?.click()
              }
              disabled={
                uploading || loading
              }
              title="Attach files"
            >
              <Icon size={18}>
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </Icon>
            </button>

            <input
              ref={fileInput}
              type="file"
              multiple
              hidden
              onChange={handleFileChange}
            />

            <textarea
              ref={textareaRef}
              value={composerValue}
              onChange={(event) =>
                handleComposerChange(
                  event.target.value
                )
              }
              onKeyDown={handleKeyDown}
              placeholder={
                editingId
                  ? "Edit your message…"
                  : "Message ZUQEN AI…"
              }
              rows={1}
              disabled={loading}
            />

            <div className="ZUQEN-composer-tools">
              {editingId ? (
                <button
                  type="button"
                  className="ZUQEN-send"
                  onClick={() => {
                    const message =
                      messages.find(
                        (item) =>
                          item.id ===
                          editingId
                      );

                    if (message) {
                      saveEditedMessage(
                        message
                      );
                    }
                  }}
                  disabled={
                    loading ||
                    !editingText.trim()
                  }
                  title="Save edit"
                >
                  <Icon size={17}>
                    <path d="m5 12 4 4L19 6" />
                  </Icon>
                </button>
              ) : (
                <button
                  type="button"
                  className="ZUQEN-send"
                  onClick={sendMessage}
                  disabled={
                    loading ||
                    (!input.trim() &&
                      attachments.length ===
                        0)
                  }
                  title="Send message"
                >
                  {loading ? (
                    <span className="ZUQEN-spinner" />
                  ) : (
                    <Icon size={17}>
                      <path d="m5 12 14-8-4 16-3-7-7-1Z" />
                    </Icon>
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="ZUQEN-composer-footer">
            <span>
              ZUQEN can make mistakes. Check
              important information.
            </span>

            <span>
              Enter to send · Shift + Enter
              for new line
            </span>
          </div>
        </div>
      </section>

      <style jsx global>{`
        :root {
          --bg: #07070a;
          --panel: #0d0d11;
          --panel-2: #111116;
          --panel-3: #17171d;
          --text: #f5f5f7;
          --muted: #9b9ba5;
          --muted-2: #686873;
          --line: rgba(255, 255, 255, 0.075);
          --line-strong: rgba(
            255,
            255,
            255,
            0.12
          );
          --accent: #8b5cf6;
          --accent-2: #6366f1;
          --accent-soft: rgba(
            139,
            92,
            246,
            0.11
          );
          --danger: #ef4444;
          --warning: #f59e0b;
          --shadow: rgba(0, 0, 0, 0.52);
        }

        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          background: var(--bg);
          color: var(--text);
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
        textarea,
        input {
          font: inherit;
        }

        button {
          cursor: pointer;
        }

        .light {
          --bg: #f6f7f9;
          --panel: #ffffff;
          --panel-2: #ffffff;
          --panel-3: #f1f2f5;
          --text: #18181b;
          --muted: #5f6068;
          --muted-2: #888992;
          --line: rgba(0, 0, 0, 0.08);
          --line-strong: rgba(
            0,
            0,
            0,
            0.12
          );
          --accent-soft: rgba(
            124,
            58,
            237,
            0.08
          );
          --shadow: rgba(0, 0, 0, 0.16);
        }

        .ZUQEN-app {
          width: 100vw;
          height: 100vh;
          display: flex;
          overflow: hidden;
          background:
            radial-gradient(
              circle at 75% -20%,
              rgba(99, 102, 241, 0.07),
              transparent 32%
            ),
            var(--bg);
        }

        /* SIDEBAR */

        .ZUQEN-sidebar {
          width: 292px;
          min-width: 292px;
          height: 100%;
          background: var(--panel);
          border-right: 1px solid var(--line);
          overflow: hidden;
          transition:
            width 0.25s ease,
            min-width 0.25s ease;
        }

        .ZUQEN-sidebar.closed {
          width: 0;
          min-width: 0;
          border-right: 0;
        }

        .ZUQEN-sidebar-inner {
          width: 292px;
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .ZUQEN-side-top {
          padding: 18px 14px 12px;
        }

        .ZUQEN-brand-row {
          padding: 3px 8px 19px;
        }

        .ZUQEN-brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .ZUQEN-brand-mark {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 11px;
          background:
            linear-gradient(
              135deg,
              #a78bfa,
              #6366f1
            );
          box-shadow:
            0 7px 24px
              rgba(99, 102, 241, 0.25);
          color: white;
          font-size: 15px;
          font-weight: 950;
        }

        .ZUQEN-brand-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .ZUQEN-brand-text strong {
          font-size: 14px;
          letter-spacing: 0.12em;
        }

        .ZUQEN-brand-text span {
          color: var(--muted-2);
          font-size: 6px;
          font-weight: 850;
          letter-spacing: 0.2em;
        }

        .ZUQEN-new-chat {
          width: 100%;
          height: 46px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 10px;
          border: 1px solid var(--line);
          border-radius: 13px;
          background:
            linear-gradient(
              180deg,
              var(--panel-3),
              rgba(255, 255, 255, 0.015)
            );
          color: var(--text);
          font-size: 11px;
          font-weight: 750;
          transition:
            transform 0.18s ease,
            border-color 0.18s ease,
            background 0.18s ease;
        }

        .ZUQEN-new-chat:hover {
          transform: translateY(-1px);
          border-color: rgba(
            139,
            92,
            246,
            0.35
          );
          background: var(--accent-soft);
        }

        .ZUQEN-new-chat-icon {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          background: var(--accent-soft);
          color: #a78bfa;
        }

        .ZUQEN-new-chat-shortcut {
          margin-left: auto;
          color: var(--muted-2);
          font-size: 8px;
          font-weight: 700;
        }

        .ZUQEN-history {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 8px 10px 12px;
          scrollbar-width: thin;
        }

        .ZUQEN-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 9px 10px;
        }

        .ZUQEN-section-title {
          display: flex;
          align-items: center;
          gap: 7px;
          color: var(--muted-2);
          font-size: 8px;
          font-weight: 850;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .ZUQEN-section-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--accent);
          box-shadow: 0 0 10px
            rgba(139, 92, 246, 0.6);
        }

        .ZUQEN-section-count {
          min-width: 20px;
          height: 19px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 7px;
          background: var(--panel-3);
          color: var(--muted-2);
          font-size: 7px;
          font-weight: 800;
        }

        .ZUQEN-chat-item {
          position: relative;
          display: flex;
          align-items: center;
          gap: 2px;
          margin-bottom: 3px;
          border: 1px solid transparent;
          border-radius: 11px;
          transition:
            background 0.15s ease,
            border-color 0.15s ease;
        }

        .ZUQEN-chat-item:hover {
          background: var(--panel-3);
          border-color: var(--line);
        }

        .ZUQEN-chat-item.active {
          background:
            linear-gradient(
              90deg,
              rgba(139, 92, 246, 0.12),
              transparent
            ),
            var(--panel-3);
          border-color: rgba(
            139,
            92,
            246,
            0.12
          );
        }

        .ZUQEN-chat-main {
          min-width: 0;
          flex: 1;
          height: 42px;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 0 9px;
          border: 0;
          background: transparent;
          color: var(--muted);
          text-align: left;
        }

        .ZUQEN-chat-main > svg {
          flex: 0 0 auto;
          opacity: 0.7;
        }

        .ZUQEN-chat-main span {
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          font-size: 10px;
        }

        .ZUQEN-chat-item.active
          .ZUQEN-chat-main {
          color: var(--text);
        }

        .ZUQEN-chat-more {
          width: 32px;
          height: 32px;
          margin-right: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 8px;
          background: transparent;
          color: var(--muted-2);
          opacity: 0;
          transition: opacity 0.15s ease,
            background 0.15s ease;
        }

        .ZUQEN-chat-item:hover
          .ZUQEN-chat-more,
        .ZUQEN-chat-item.active
          .ZUQEN-chat-more {
          opacity: 1;
        }

        .ZUQEN-chat-more:hover {
          background: rgba(
            255,
            255,
            255,
            0.06
          );
          color: var(--text);
        }

        .ZUQEN-chat-menu {
          position: absolute;
          top: 39px;
          right: 7px;
          z-index: 100;
          width: 156px;
          padding: 5px;
          border: 1px solid var(--line-strong);
          border-radius: 12px;
          background: var(--panel-2);
          box-shadow:
            0 20px 60px var(--shadow);
          backdrop-filter: blur(18px);
          animation:
            ZUQEN-pop 0.14s ease;
        }

        .ZUQEN-chat-menu button {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 9px 10px;
          border: 0;
          border-radius: 8px;
          background: transparent;
          color: var(--text);
          text-align: left;
          font-size: 9px;
          font-weight: 650;
        }

        .ZUQEN-chat-menu button:hover {
          background: var(--panel-3);
        }

        .ZUQEN-chat-menu button:last-child {
          color: #f87171;
        }

        .ZUQEN-archive-button {
          width: 100%;
          height: 40px;
          display: flex;
          align-items: center;
          gap: 9px;
          margin-top: 9px;
          padding: 0 9px;
          border: 1px solid transparent;
          border-radius: 10px;
          background: transparent;
          color: var(--muted);
          font-size: 10px;
          text-align: left;
          transition: all 0.15s ease;
        }

        .ZUQEN-archive-button:hover,
        .ZUQEN-archive-button.active {
          background: var(--panel-3);
          border-color: var(--line);
          color: var(--text);
        }

        .ZUQEN-archive-icon {
          display: flex;
        }

        .ZUQEN-archive-count {
          min-width: 20px;
          height: 18px;
          margin-left: auto;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          background: var(--accent-soft);
          color: #a78bfa;
          font-size: 7px;
          font-weight: 850;
        }

        .ZUQEN-empty-history {
          min-height: 160px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 20px;
          text-align: center;
        }

        .ZUQEN-empty-icon {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 5px;
          border: 1px solid var(--line);
          border-radius: 11px;
          background: var(--panel-3);
          color: var(--muted-2);
        }

        .ZUQEN-empty-history strong {
          color: var(--muted);
          font-size: 9px;
        }

        .ZUQEN-empty-history span {
          max-width: 170px;
          color: var(--muted-2);
          font-size: 7px;
          line-height: 1.6;
        }

        .ZUQEN-sidebar-footer {
          padding: 12px;
          border-top: 1px solid var(--line);
        }

        .ZUQEN-account {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px;
          border: 1px solid var(--line);
          border-radius: 12px;
          background: var(--panel-3);
        }

        .ZUQEN-avatar {
          width: 32px;
          height: 32px;
          flex: 0 0 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          background:
            linear-gradient(
              135deg,
              #27272a,
              #18181b
            );
          color: white;
          font-size: 10px;
          font-weight: 850;
        }

        .ZUQEN-account-info {
          min-width: 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .ZUQEN-account-info strong {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 9px;
        }

        .ZUQEN-account-info span {
          display: flex;
          align-items: center;
          gap: 5px;
          color: var(--muted-2);
          font-size: 7px;
        }

        .ZUQEN-account-info i {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 8px
            rgba(34, 197, 94, 0.5);
        }

        .ZUQEN-account-more {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 8px;
          background: transparent;
          color: var(--muted-2);
        }

        .ZUQEN-account-more:hover {
          background: var(--panel);
          color: var(--text);
        }

        /* MAIN */

        .ZUQEN-main {
          min-width: 0;
          flex: 1;
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .ZUQEN-topbar {
          position: relative;
          z-index: 60;
          height: 72px;
          flex: 0 0 72px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 20px;
          border-bottom: 1px solid var(--line);
          background: rgba(
            13,
            13,
            17,
            0.84
          );
          backdrop-filter: blur(18px);
        }

        .light .ZUQEN-topbar {
          background: rgba(
            255,
            255,
            255,
            0.86
          );
        }

        .ZUQEN-topbar-left,
        .ZUQEN-topbar-actions {
          display: flex;
          align-items: center;
        }

        .ZUQEN-topbar-left {
          min-width: 0;
          gap: 12px;
        }

        .ZUQEN-topbar-actions {
          gap: 8px;
        }

        .ZUQEN-top-action {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid transparent;
          border-radius: 10px;
          background: transparent;
          color: var(--muted);
          transition: all 0.16s ease;
        }

        .ZUQEN-top-action:hover {
          border-color: var(--line);
          background: var(--panel-3);
          color: var(--text);
        }

        .ZUQEN-topbar-info {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .ZUQEN-title-line {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .ZUQEN-title-line strong {
          max-width: 300px;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          font-size: 11px;
          font-weight: 800;
        }

        .ZUQEN-topbar-info > span {
          color: var(--muted-2);
          font-size: 7px;
        }

        .ZUQEN-live-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 3px 6px;
          border: 1px solid
            rgba(34, 197, 94, 0.14);
          border-radius: 99px;
          color: #4ade80;
          background: rgba(
            34,
            197,
            94,
            0.06
          );
          font-size: 6px !important;
          font-weight: 750;
        }

        .ZUQEN-live-badge i {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #22c55e;
        }

        /* CREDITS */

        .ZUQEN-credits-selector {
          position: relative;
        }

        .ZUQEN-credits-button {
          min-width: 112px;
          height: 38px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 9px 4px 6px;
          border: 1px solid var(--line);
          border-radius: 11px;
          background: var(--panel-3);
          color: var(--text);
          transition: all 0.18s ease;
        }

        .ZUQEN-credits-button:hover,
        .ZUQEN-credits-button.active {
          border-color: rgba(
            139,
            92,
            246,
            0.35
          );
          background: var(--accent-soft);
          box-shadow:
            0 6px 24px
              rgba(99, 102, 241, 0.08);
        }

        .ZUQEN-credits-icon {
          width: 27px;
          height: 27px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background:
            linear-gradient(
              135deg,
              rgba(139, 92, 246, 0.2),
              rgba(99, 102, 241, 0.12)
            );
          color: #a78bfa;
        }

        .ZUQEN-credits-info {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 1px;
        }

        .ZUQEN-credits-info small {
          color: var(--muted-2);
          font-size: 6px;
          font-weight: 750;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .ZUQEN-credits-info strong {
          font-size: 9px;
          font-weight: 900;
        }

        .ZUQEN-chevron {
          margin-left: auto;
          display: flex;
          color: var(--muted-2);
        }

        .ZUQEN-credit-panel {
          position: absolute;
          top: calc(100% + 10px);
          right: 0;
          z-index: 200;
          width: 350px;
          max-height: calc(100vh - 94px);
          overflow-y: auto;
          padding: 17px;
          border: 1px solid var(--line-strong);
          border-radius: 18px;
          background: var(--panel-2);
          box-shadow:
            0 28px 90px var(--shadow),
            0 0 0 1px
              rgba(139, 92, 246, 0.025);
          backdrop-filter: blur(24px);
          animation:
            ZUQEN-pop 0.16s ease;
        }

        .ZUQEN-credit-panel-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
        }

        .ZUQEN-credit-kicker {
          color: var(--muted-2);
          font-size: 7px;
          font-weight: 850;
          letter-spacing: 0.16em;
        }

        .ZUQEN-credit-total-row {
          display: flex;
          align-items: baseline;
          gap: 7px;
          margin-top: 6px;
        }

        .ZUQEN-credit-total-row strong {
          font-size: 29px;
          line-height: 1;
          font-weight: 950;
          letter-spacing: -0.055em;
        }

        .ZUQEN-credit-total-row span {
          color: var(--muted-2);
          font-size: 7px;
        }

        .ZUQEN-credit-symbol {
          width: 39px;
          height: 39px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid
            rgba(139, 92, 246, 0.15);
          border-radius: 11px;
          background: var(--accent-soft);
          color: #a78bfa;
        }

        .ZUQEN-credit-progress-wrap {
          margin-top: 17px;
        }

        .ZUQEN-credit-progress-labels {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 7px;
          color: var(--muted-2);
          font-size: 7px;
          font-weight: 700;
        }

        .ZUQEN-credit-progress-labels strong {
          color: var(--muted);
          font-size: 7px;
        }

        .ZUQEN-credit-progress {
          width: 100%;
          height: 6px;
          overflow: hidden;
          border-radius: 99px;
          background: var(--panel-3);
        }

        .ZUQEN-credit-progress div {
          height: 100%;
          border-radius: inherit;
          background:
            linear-gradient(
              90deg,
              #8b5cf6,
              #6366f1,
              #7c3aed
            );
          box-shadow: 0 0 14px
            rgba(139, 92, 246, 0.3);
          transition: width 0.4s ease;
        }

        .ZUQEN-credit-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: 10px;
        }

        .ZUQEN-credit-stats > div {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 9px 10px;
          border: 1px solid var(--line);
          border-radius: 10px;
          background: var(--panel-3);
        }

        .ZUQEN-credit-stats span {
          color: var(--muted-2);
          font-size: 6px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .ZUQEN-credit-stats strong {
          font-size: 10px;
          font-weight: 850;
        }

        .ZUQEN-credit-divider {
          height: 1px;
          margin: 15px 0 12px;
          background: var(--line);
        }

        .ZUQEN-credit-section-heading {
          color: var(--muted-2);
          font-size: 7px;
          font-weight: 850;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .ZUQEN-credit-features {
          display: flex;
          flex-direction: column;
          gap: 5px;
          margin-top: 9px;
        }

        .ZUQEN-credit-feature {
          min-height: 49px;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 7px 9px;
          border: 1px solid var(--line);
          border-radius: 11px;
          background: var(--panel-3);
          transition:
            border-color 0.15s ease,
            transform 0.15s ease;
        }

        .ZUQEN-credit-feature:hover {
          transform: translateX(1px);
          border-color: var(--line-strong);
        }

        .ZUQEN-credit-feature-icon {
          width: 30px;
          height: 30px;
          flex: 0 0 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          background: var(--accent-soft);
          color: #a78bfa;
          font-size: 12px;
          font-weight: 800;
        }

        .ZUQEN-credit-feature-info {
          min-width: 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .ZUQEN-credit-feature-info strong {
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          font-size: 8px;
          font-weight: 800;
        }

        .ZUQEN-credit-feature-info span {
          color: var(--muted-2);
          font-size: 6px;
        }

        .ZUQEN-feature-balance {
          font-size: 9px;
          font-weight: 900;
        }

        .ZUQEN-feature-balance.low {
          color: #f59e0b;
        }

        .ZUQEN-feature-balance.empty {
          color: #f87171;
        }

        .ZUQEN-credit-empty,
        .ZUQEN-credit-warning {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin-top: 9px;
          padding: 9px;
          border-radius: 10px;
          font-size: 7px;
          line-height: 1.45;
        }

        .ZUQEN-credit-empty {
          color: #fca5a5;
          background: rgba(
            239,
            68,
            68,
            0.07
          );
          border: 1px solid
            rgba(239, 68, 68, 0.09);
        }

        .ZUQEN-credit-empty > span,
        .ZUQEN-credit-warning > span {
          width: 16px;
          height: 16px;
          flex: 0 0 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          font-size: 8px;
          font-weight: 900;
        }

        .ZUQEN-credit-empty > span {
          background: rgba(
            239,
            68,
            68,
            0.12
          );
        }

        .ZUQEN-credit-empty div {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .ZUQEN-credit-empty strong {
          font-size: 7px;
        }

        .ZUQEN-credit-empty small {
          color: #f87171;
          font-size: 6px;
        }

        .ZUQEN-credit-warning {
          color: #fbbf24;
          background: rgba(
            245,
            158,
            11,
            0.07
          );
          border: 1px solid
            rgba(245, 158, 11, 0.1);
        }

        .ZUQEN-credit-warning > span {
          background: rgba(
            245,
            158,
            11,
            0.12
          );
        }

        .ZUQEN-credit-get-more {
          width: 100%;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 10px;
          border: 0;
          border-radius: 10px;
          background:
            linear-gradient(
              135deg,
              #8b5cf6,
              #6366f1
            );
          color: white;
          font-size: 8px;
          font-weight: 850;
          box-shadow:
            0 8px 25px
              rgba(99, 102, 241, 0.2);
        }

        .ZUQEN-credit-get-more:hover {
          filter: brightness(1.08);
        }

        /* AGENT */

        .ZUQEN-agent-selector {
          position: relative;
        }

        .ZUQEN-agent-button {
          height: 38px;
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 0 10px;
          border: 1px solid var(--line);
          border-radius: 11px;
          background: var(--panel-3);
          color: var(--text);
          font-size: 8px;
          font-weight: 750;
          transition: all 0.16s ease;
        }

        .ZUQEN-agent-button:hover,
        .ZUQEN-agent-button.active {
          border-color: var(--line-strong);
          background: var(--panel);
        }

        .ZUQEN-agent-icon {
          color: #a78bfa;
          font-size: 12px;
        }

        .ZUQEN-agent-dropdown {
          position: absolute;
          top: calc(100% + 9px);
          right: 0;
          z-index: 150;
          width: 220px;
          padding: 7px;
          border: 1px solid var(--line-strong);
          border-radius: 14px;
          background: var(--panel-2);
          box-shadow:
            0 22px 70px var(--shadow);
          backdrop-filter: blur(22px);
          animation:
            ZUQEN-pop 0.14s ease;
        }

        .ZUQEN-agent-dropdown-title {
          padding: 7px 9px;
          color: var(--muted-2);
          font-size: 6px;
          font-weight: 850;
          letter-spacing: 0.14em;
        }

        .ZUQEN-agent-dropdown button {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 9px;
          border: 0;
          border-radius: 9px;
          background: transparent;
          color: var(--text);
          text-align: left;
          font-size: 8px;
        }

        .ZUQEN-agent-dropdown button:hover,
        .ZUQEN-agent-dropdown button.selected {
          background: var(--panel-3);
        }

        .ZUQEN-agent-option-icon {
          width: 25px;
          height: 25px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 7px;
          background: var(--accent-soft);
          color: #a78bfa;
          font-size: 9px;
        }

        .ZUQEN-agent-check {
          margin-left: auto;
          color: #a78bfa;
        }

        /* CHAT */

        .ZUQEN-chat-area {
          min-height: 0;
          flex: 1;
          overflow-y: auto;
          scrollbar-width: thin;
        }

        .ZUQEN-welcome {
          position: relative;
          min-height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 50px 20px;
          text-align: center;
          overflow: hidden;
        }

        .ZUQEN-welcome-glow {
          position: absolute;
          width: 420px;
          height: 420px;
          border-radius: 50%;
          background:
            radial-gradient(
              circle,
              rgba(124, 58, 237, 0.1),
              transparent 68%
            );
          pointer-events: none;
        }

        .ZUQEN-welcome-mark {
          position: relative;
          width: 62px;
          height: 62px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 17px;
          border: 1px solid
            rgba(255, 255, 255, 0.1);
          border-radius: 19px;
          background:
            linear-gradient(
              135deg,
              #8b5cf6,
              #6366f1
            );
          box-shadow:
            0 20px 60px
              rgba(99, 102, 241, 0.25);
          color: white;
          font-size: 22px;
          font-weight: 950;
        }

        .ZUQEN-welcome-kicker {
          position: relative;
          margin-bottom: 9px;
          color: #a78bfa;
          font-size: 7px;
          font-weight: 850;
          letter-spacing: 0.22em;
        }

        .ZUQEN-welcome h1 {
          position: relative;
          margin: 0;
          color: var(--text);
          font-size: clamp(
            26px,
            4vw,
            40px
          );
          line-height: 1.1;
          letter-spacing: -0.055em;
          font-weight: 900;
        }

        .ZUQEN-welcome h1 span {
          background:
            linear-gradient(
              90deg,
              #a78bfa,
              #818cf8
            );
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .ZUQEN-welcome p {
          position: relative;
          max-width: 530px;
          margin: 13px 0 0;
          color: var(--muted);
          font-size: 10px;
          line-height: 1.8;
        }

        .ZUQEN-prompts {
          position: relative;
          display: grid;
          grid-template-columns: repeat(
            2,
            minmax(0, 1fr)
          );
          gap: 8px;
          width: min(560px, 100%);
          margin-top: 26px;
        }

        .ZUQEN-prompts button {
          display: flex;
          align-items: center;
          gap: 9px;
          min-height: 43px;
          padding: 8px 11px;
          border: 1px solid var(--line);
          border-radius: 11px;
          background: var(--panel-3);
          color: var(--muted);
          text-align: left;
          font-size: 8px;
          transition: all 0.16s ease;
        }

        .ZUQEN-prompts button:hover {
          transform: translateY(-1px);
          border-color: rgba(
            139,
            92,
            246,
            0.25
          );
          background: var(--accent-soft);
          color: var(--text);
        }

        .ZUQEN-prompts button > span {
          width: 25px;
          height: 25px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 25px;
          border-radius: 7px;
          background: var(--accent-soft);
          color: #a78bfa;
          font-size: 8px;
          font-weight: 850;
        }

        .ZUQEN-messages {
          width: min(900px, 100%);
          margin: 0 auto;
          padding: 38px 24px 28px;
        }

        .ZUQEN-message {
          display: flex;
          gap: 13px;
          margin-bottom: 31px;
        }

        .ZUQEN-message-avatar {
          width: 31px;
          height: 31px;
          flex: 0 0 31px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 1px;
          border: 1px solid var(--line);
          border-radius: 10px;
          background: var(--panel-3);
          color: var(--muted);
          font-size: 9px;
          font-weight: 900;
        }

        .ZUQEN-message.assistant
          .ZUQEN-message-avatar {
          border-color: rgba(
            139,
            92,
            246,
            0.2
          );
          background:
            linear-gradient(
              135deg,
              #8b5cf6,
              #6366f1
            );
          color: white;
          box-shadow:
            0 7px 20px
              rgba(99, 102, 241, 0.16);
        }

        .ZUQEN-message-body {
          min-width: 0;
          flex: 1;
        }

        .ZUQEN-message-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-height: 22px;
          margin-bottom: 5px;
        }

        .ZUQEN-message-role {
          color: var(--muted-2);
          font-size: 7px;
          font-weight: 850;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .ZUQEN-message-actions {
          display: flex;
          align-items: center;
          gap: 2px;
          opacity: 0;
          transition: opacity 0.15s ease;
        }

        .ZUQEN-message:hover
          .ZUQEN-message-actions {
          opacity: 1;
        }

        .ZUQEN-message-actions button {
          width: 27px;
          height: 27px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid transparent;
          border-radius: 7px;
          background: transparent;
          color: var(--muted-2);
        }

        .ZUQEN-message-actions button:hover {
          border-color: var(--line);
          background: var(--panel-3);
          color: var(--text);
        }

        .ZUQEN-message-actions button:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .ZUQEN-copied {
          color: #4ade80;
          font-size: 12px;
          font-weight: 900;
        }

        .ZUQEN-message-content {
          white-space: pre-wrap;
          color: var(--text);
          font-size: 11px;
          line-height: 1.82;
          letter-spacing: 0.005em;
        }

        .ZUQEN-message.user
          .ZUQEN-message-content {
          color: var(--text);
        }

        .ZUQEN-attachments {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 11px;
        }

        .ZUQEN-attachment-card {
          min-width: 160px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border: 1px solid var(--line);
          border-radius: 10px;
          background: var(--panel-3);
        }

        .ZUQEN-attachment-icon {
          width: 27px;
          height: 27px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 7px;
          background: var(--accent-soft);
          color: #a78bfa;
        }

        .ZUQEN-attachment-card > div:last-child {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .ZUQEN-attachment-card strong {
          max-width: 180px;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          font-size: 7px;
        }

        .ZUQEN-attachment-card span {
          color: var(--muted-2);
          font-size: 6px;
        }

        /* COMPOSER */

        .ZUQEN-composer-area {
          width: min(900px, 100%);
          margin: 0 auto;
          padding: 0 24px 18px;
        }

        .ZUQEN-edit-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-height: 34px;
          margin-bottom: 7px;
          padding: 0 10px;
          border: 1px solid
            rgba(139, 92, 246, 0.15);
          border-radius: 9px;
          background: var(--accent-soft);
          color: var(--muted);
          font-size: 7px;
        }

        .ZUQEN-edit-bar > div {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .ZUQEN-edit-icon {
          display: flex;
          color: #a78bfa;
        }

        .ZUQEN-edit-bar button {
          border: 0;
          background: transparent;
          color: var(--muted-2);
          font-size: 7px;
        }

        .ZUQEN-edit-bar button:hover {
          color: var(--text);
        }

        .ZUQEN-pending-files {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-bottom: 8px;
        }

        .ZUQEN-pending-file {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 150px;
          padding: 7px 8px;
          border: 1px solid var(--line);
          border-radius: 10px;
          background: var(--panel-3);
        }

        .ZUQEN-pending-file-icon {
          width: 27px;
          height: 27px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 7px;
          background: var(--accent-soft);
          color: #a78bfa;
        }

        .ZUQEN-pending-file-info {
          min-width: 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .ZUQEN-pending-file-info strong {
          max-width: 150px;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          font-size: 7px;
        }

        .ZUQEN-pending-file-info span {
          color: var(--muted-2);
          font-size: 6px;
        }

        .ZUQEN-pending-file button {
          width: 25px;
          height: 25px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 7px;
          background: transparent;
          color: var(--muted-2);
        }

        .ZUQEN-pending-file button:hover {
          background: rgba(
            239,
            68,
            68,
            0.08
          );
          color: #f87171;
        }

        .ZUQEN-composer {
          min-height: 58px;
          display: flex;
          align-items: flex-end;
          gap: 8px;
          padding: 9px;
          border: 1px solid var(--line-strong);
          border-radius: 17px;
          background:
            linear-gradient(
              180deg,
              var(--panel-2),
              var(--panel)
            );
          box-shadow:
            0 15px 50px
              rgba(0, 0, 0, 0.18);
          transition:
            border-color 0.18s ease,
            box-shadow 0.18s ease;
        }

        .ZUQEN-composer:focus-within {
          border-color: rgba(
            139,
            92,
            246,
            0.35
          );
          box-shadow:
            0 18px 60px
              rgba(0, 0, 0, 0.2),
            0 0 0 3px
              rgba(139, 92, 246, 0.04);
        }

        .ZUQEN-composer textarea {
          min-height: 37px;
          max-height: 160px;
          flex: 1;
          resize: none;
          padding: 10px 3px;
          border: 0;
          outline: none;
          background: transparent;
          color: var(--text);
          font-size: 10px;
          line-height: 1.6;
        }

        .ZUQEN-composer textarea::placeholder {
          color: var(--muted-2);
        }

        .ZUQEN-composer-action,
        .ZUQEN-send {
          width: 37px;
          height: 37px;
          flex: 0 0 37px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 11px;
          transition: all 0.16s ease;
        }

        .ZUQEN-composer-action {
          border: 1px solid var(--line);
          background: var(--panel-3);
          color: var(--muted);
        }

        .ZUQEN-composer-action:hover {
          border-color: var(--line-strong);
          color: var(--text);
        }

        .ZUQEN-composer-action:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .ZUQEN-composer-tools {
          display: flex;
        }

        .ZUQEN-send {
          border: 0;
          background:
            linear-gradient(
              135deg,
              #8b5cf6,
              #6366f1
            );
          color: white;
          box-shadow:
            0 7px 20px
              rgba(99, 102, 241, 0.22);
        }

        .ZUQEN-send:hover:not(
            :disabled
          ) {
          transform: translateY(-1px);
          filter: brightness(1.08);
        }

        .ZUQEN-send:disabled {
          opacity: 0.3;
          cursor: not-allowed;
          box-shadow: none;
        }

        .ZUQEN-composer-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 7px 4px 0;
          color: var(--muted-2);
          font-size: 6px;
        }

        .ZUQEN-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid
            rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation:
            ZUQEN-spin 0.7s linear
            infinite;
        }

        /* LOADING */

        .ZUQEN-loading-screen {
          width: 100vw;
          height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: #07070a;
          color: #a1a1aa;
        }

        .ZUQEN-loading-orb {
          width: 50px;
          height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 4px;
          border-radius: 15px;
          background:
            linear-gradient(
              135deg,
              #8b5cf6,
              #6366f1
            );
          box-shadow:
            0 15px 50px
              rgba(99, 102, 241, 0.28);
          color: white;
          animation:
            ZUQEN-breathe 1.8s ease-in-out
            infinite;
        }

        .ZUQEN-loading-orb span {
          font-weight: 950;
        }

        .ZUQEN-loading-title {
          color: #f4f4f5;
          font-size: 11px;
          font-weight: 850;
          letter-spacing: 0.15em;
        }

        .ZUQEN-loading-sub {
          color: #71717a;
          font-size: 7px;
        }

        @keyframes ZUQEN-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes ZUQEN-pop {
          from {
            opacity: 0;
            transform: translateY(-4px)
              scale(0.98);
          }

          to {
            opacity: 1;
            transform: translateY(0)
              scale(1);
          }
        }

        @keyframes ZUQEN-breathe {
          0%,
          100% {
            transform: scale(1);
          }

          50% {
            transform: scale(1.04);
          }
        }

        @media (max-width: 900px) {
          .ZUQEN-sidebar {
            width: 270px;
            min-width: 270px;
          }

          .ZUQEN-sidebar-inner {
            width: 270px;
          }

          .ZUQEN-title-line strong {
            max-width: 190px;
          }
        }

        @media (max-width: 700px) {
          .ZUQEN-sidebar {
            position: fixed;
            z-index: 300;
            width: 292px;
            min-width: 292px;
            height: 100vh;
            box-shadow:
              25px 0 80px
                rgba(0, 0, 0, 0.4);
          }

          .ZUQEN-sidebar.closed {
            transform: translateX(-100%);
            width: 292px;
            min-width: 292px;
          }

          .ZUQEN-topbar {
            height: 64px;
            flex-basis: 64px;
            padding: 0 10px;
          }

          .ZUQEN-topbar-info
            > span {
            display: none;
          }

          .ZUQEN-live-badge {
            display: none !important;
          }

          .ZUQEN-title-line strong {
            max-width: 125px;
          }

          .ZUQEN-topbar-actions {
            gap: 4px;
          }

          .ZUQEN-credits-button {
            min-width: 39px;
            width: 39px;
            padding: 0;
            justify-content: center;
          }

          .ZUQEN-credits-info,
          .ZUQEN-chevron {
            display: none;
          }

          .ZUQEN-agent-label {
            display: none;
          }

          .ZUQEN-agent-button {
            width: 38px;
            padding: 0;
            justify-content: center;
          }

          .ZUQEN-credit-panel {
            position: fixed;
            top: 73px;
            right: 9px;
            width: min(
              350px,
              calc(100vw - 18px)
            );
            max-height: calc(100vh - 85px);
          }

          .ZUQEN-welcome {
            padding: 30px 16px;
          }

          .ZUQEN-welcome h1 {
            font-size: 28px;
          }

          .ZUQEN-welcome p {
            font-size: 9px;
          }

          .ZUQEN-prompts {
            grid-template-columns: 1fr;
            width: min(
              400px,
              100%
            );
          }

          .ZUQEN-messages {
            padding: 25px 14px 20px;
          }

          .ZUQEN-message {
            gap: 9px;
            margin-bottom: 25px;
          }

          .ZUQEN-message-avatar {
            width: 28px;
            height: 28px;
            flex-basis: 28px;
          }

          .ZUQEN-message-content {
            font-size: 10px;
          }

          .ZUQEN-composer-area {
            padding: 0 10px 12px;
          }

          .ZUQEN-composer-footer {
            padding-left: 2px;
            padding-right: 2px;
          }

          .ZUQEN-composer-footer span:last-child {
            display: none;
          }

          .ZUQEN-message-actions {
            opacity: 1;
          }
        }

        @media (max-width: 430px) {
          .ZUQEN-topbar-info {
            display: none;
          }

          .ZUQEN-topbar-left {
            margin-right: auto;
          }

          .ZUQEN-topbar-actions {
            margin-left: auto;
          }

          .ZUQEN-credit-panel {
            right: 6px;
            width: calc(100vw - 12px);
          }

          .ZUQEN-credits-button,
          .ZUQEN-agent-button,
          .ZUQEN-top-action {
            width: 35px;
            height: 35px;
          }
        }
      `}</style>
    </main>
  );
}

function ChatItem({
  chat,
  active,
  menuOpen,
  archived,
  onOpen,
  onMenu,
  onArchive,
  onRestore,
  onRename,
  onDelete,
}: {
  chat: Chat;
  active: boolean;
  menuOpen: boolean;
  archived: boolean;
  onOpen: () => void;
  onMenu: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`ZUQEN-chat-item ${
        active ? "active" : ""
      }`}
    >
      <button
        type="button"
        className="ZUQEN-chat-main"
        onClick={onOpen}
      >
        <Icon size={14}>
          <path d="M4 5h16v12H4z" />
          <path d="m8 21 4-4 4 4" />
        </Icon>

        <span>{chat.title}</span>
      </button>

      <button
        type="button"
        className="ZUQEN-chat-more"
        onClick={(event) => {
          event.stopPropagation();
          onMenu();
        }}
        title="Conversation options"
      >
        <Icon size={15}>
          <circle
            cx="5"
            cy="12"
            r="1"
          />
          <circle
            cx="12"
            cy="12"
            r="1"
          />
          <circle
            cx="19"
            cy="12"
            r="1"
          />
        </Icon>
      </button>

      {menuOpen && (
        <div
          className="ZUQEN-chat-menu"
          onClick={(event) =>
            event.stopPropagation()
          }
        >
          <button
            type="button"
            onClick={onRename}
          >
            <Icon size={13}>
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
            </Icon>

            Rename
          </button>

          {archived ? (
            <button
              type="button"
              onClick={onRestore}
            >
              <Icon size={13}>
                <path d="M3 12a9 9 0 1 0 3-6.7" />
                <path d="M3 4v6h6" />
              </Icon>

              Restore
            </button>
          ) : (
            <button
              type="button"
              onClick={onArchive}
            >
              <Icon size={13}>
                <path d="M4 4h16v4H4z" />
                <path d="M6 8v11h12V8" />
              </Icon>

              Archive
            </button>
          )}

          <button
            type="button"
            onClick={onDelete}
          >
            <Icon size={13}>
              <path d="M3 6h18" />
              <path d="M8 6V4h8v2" />
              <path d="M19 6l-1 14H6L5 6" />
            </Icon>

            Delete
          </button>
        </div>
      )}
    </div>
  );
}

