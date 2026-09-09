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

  const fileInput = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeChats = chats.filter(
    (chat) => !chat.archived
  );

  const archivedChats = chats.filter(
    (chat) => chat.archived
  );

  const totalCredits = featureCredits.reduce(
    (total, item) => total + Number(item.balance || 0),
    0
  );

  const totalAllocatedCredits = featureCredits.reduce(
    (total, item) =>
      total + Number(item.total_granted || 0),
    0
  );

  const totalUsedCredits = featureCredits.reduce(
    (total, item) =>
      total + Number(item.total_used || 0),
    0
  );

  const totalUsagePercentage =
    totalAllocatedCredits > 0
      ? Math.min(
          100,
          Math.round(
            (totalUsedCredits / totalAllocatedCredits) *
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
        { data: balances },
        { data: features },
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
          feature_name: feature.feature_name,
          provider: feature.provider,
          balance: Number(balance?.balance || 0),
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
            }
          : chat
      )
    );
  }

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(
      event.target.files || []
    );

    if (!files.length) return;

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
  }

  function removeAttachment(id?: string) {
    setAttachments((previous) =>
      previous.filter(
        (item) => item.id !== id
      )
    );
  }

  async function sendMessage() {
    const text = input.trim();

    if ((!text && !attachments.length) || loading) {
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
      created_at: new Date().toISOString(),
      attachments:
        attachments.length > 0
          ? attachments
          : undefined,
    };

    setMessages((previous) => [
      ...previous,
      userMessage,
    ]);

    setInput("");
    setAttachments([]);
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            ...messages,
            userMessage,
          ],
          attachments:
            userMessage.attachments || [],
          agent: selectedAgent,
        }),
      });

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
                  (message) =>
                    message.id ===
                    assistantId
                      ? {
                          ...message,
                          content:
                            assistantText,
                        }
                      : message
                )
              );
            }
          } catch {
            // Ignore non-JSON stream chunks.
          }
        }
      }

      if (user?.id) {
        await loadFeatureCredits(user.id);
      }

      if (
        text &&
        activeChat === null
      ) {
        await renameChat(
          chatId,
          text.length > 45
            ? `${text.slice(0, 45)}…`
            : text
        );
      }

      await loadChats(user.id);
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

  if (!authReady) {
    return (
      <div className="ZUQEN-loading-screen">
        <div className="ZUQEN-loading-logo">
          Z
        </div>
        <div>Loading ZUQEN…</div>
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
            <div className="ZUQEN-brand">
              <div className="ZUQEN-brand-mark">
                Z
              </div>

              <span>ZUQEN</span>
            </div>

            <button
              type="button"
              className="ZUQEN-new-chat"
              onClick={() => {
                setActiveChat(null);
                setMessages([]);
                setAttachments([]);
              }}
            >
              <Icon size={16}>
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </Icon>

              <span>
                New conversation
              </span>
            </button>
          </div>

          <div className="ZUQEN-history">
            <div className="ZUQEN-section-title">
              <span>
                {archiveOpen
                  ? "Archived"
                  : "Conversations"}
              </span>

              <span>
                {archiveOpen
                  ? archivedChats.length
                  : activeChats.length}
              </span>
            </div>

            {archiveOpen ? (
              <>
                {archivedChats.length === 0 && (
                  <div className="ZUQEN-empty-history">
                    No archived chats
                  </div>
                )}

                {archivedChats.map(
                  (chat) => (
                    <div
                      key={chat.id}
                      className={`ZUQEN-chat-item ${
                        activeChat ===
                        chat.id
                          ? "active"
                          : ""
                      }`}
                    >
                      <button
                        type="button"
                        className="ZUQEN-chat-main"
                        onClick={() =>
                          openChat(chat.id)
                        }
                      >
                        <Icon size={14}>
                          <path d="M4 5h16v12H4z" />
                          <path d="m8 21 4-4 4 4" />
                        </Icon>

                        <span>
                          {chat.title}
                        </span>
                      </button>

                      <button
                        type="button"
                        className="ZUQEN-chat-more"
                        onClick={() =>
                          setMenuOpen(
                            menuOpen ===
                              chat.id
                              ? null
                              : chat.id
                          )
                        }
                      >
                        ⋯
                      </button>

                      {menuOpen ===
                        chat.id && (
                        <div className="ZUQEN-chat-menu">
                          <button
                            type="button"
                            onClick={() =>
                              restoreChat(
                                chat.id
                              )
                            }
                          >
                            Restore
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              deleteChat(
                                chat.id
                              )
                            }
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )
                )}
              </>
            ) : (
              <>
                {activeChats.length === 0 && (
                  <div className="ZUQEN-empty-history">
                    No conversations yet
                  </div>
                )}

                {activeChats.map(
                  (chat) => (
                    <div
                      key={chat.id}
                      className={`ZUQEN-chat-item ${
                        activeChat ===
                        chat.id
                          ? "active"
                          : ""
                      }`}
                    >
                      <button
                        type="button"
                        className="ZUQEN-chat-main"
                        onClick={() =>
                          openChat(chat.id)
                        }
                      >
                        <Icon size={14}>
                          <path d="M4 5h16v12H4z" />
                          <path d="m8 21 4-4 4 4" />
                        </Icon>

                        <span>
                          {chat.title}
                        </span>
                      </button>

                      <button
                        type="button"
                        className="ZUQEN-chat-more"
                        onClick={() =>
                          setMenuOpen(
                            menuOpen ===
                              chat.id
                              ? null
                              : chat.id
                          )
                        }
                      >
                        ⋯
                      </button>

                      {menuOpen ===
                        chat.id && (
                        <div className="ZUQEN-chat-menu">
                          <button
                            type="button"
                            onClick={() =>
                              archiveChat(
                                chat.id
                              )
                            }
                          >
                            Archive
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              deleteChat(
                                chat.id
                              )
                            }
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )
                )}
              </>
            )}

            <button
              type="button"
              className="ZUQEN-archive-button"
              onClick={() =>
                setArchiveOpen(
                  (value) => !value
                )
              }
            >
              <Icon size={15}>
                <path d="M4 4h16v4H4z" />
                <path d="M6 8v11h12V8" />
                <path d="M9 12h6" />
              </Icon>

              <span>
                {archiveOpen
                  ? "Back to History"
                  : "Archived"}
              </span>

              {!archiveOpen &&
                archivedChats.length >
                  0 && (
                  <span>
                    {archivedChats.length}
                  </span>
                )}
            </button>
          </div>

          <div className="ZUQEN-side-bottom">
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
                  Free account
                </span>
              </div>
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
            >
              <Icon size={18}>
                <path d="M4 6h16" />
                <path d="M4 12h16" />
                <path d="M4 18h16" />
              </Icon>
            </button>

            <div className="ZUQEN-topbar-info">
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

              <span>
                Your intelligent workspace
              </span>
            </div>
          </div>

          <div className="ZUQEN-topbar-actions">
            {/* CREDITS */}
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
                  <Icon size={14}>
                    <circle
                      cx="12"
                      cy="12"
                      r="8"
                    />
                    <path d="M12 8v8" />
                    <path d="M9 12h6" />
                  </Icon>
                </span>

                <span className="ZUQEN-credits-value">
                  {creditsLoading
                    ? "..."
                    : formatCredits(
                        totalCredits
                      )}
                </span>

                <span className="ZUQEN-credits-label">
                  Credits
                </span>
              </button>

              {creditsOpen && (
                <div
                  className="ZUQEN-credit-panel"
                  onClick={(event) =>
                    event.stopPropagation()
                  }
                >
                  <div className="ZUQEN-credit-panel-head">
                    <div>
                      <div className="ZUQEN-credit-panel-title">
                        ZUQEN Credits
                      </div>

                      <div className="ZUQEN-credit-panel-total">
                        {creditsLoading
                          ? "..."
                          : formatCredits(
                              totalCredits
                            )}
                      </div>

                      <div className="ZUQEN-credit-panel-sub">
                        credits available
                      </div>
                    </div>

                    <div className="ZUQEN-credit-panel-icon">
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

                  <div className="ZUQEN-credit-progress">
                    <div
                      style={{
                        width: `${totalUsagePercentage}%`,
                      }}
                    />
                  </div>

                  <div className="ZUQEN-credit-stats">
                    <span>
                      Allocated{" "}
                      {formatCredits(
                        totalAllocatedCredits
                      )}
                    </span>

                    <span>
                      Used{" "}
                      {formatCredits(
                        totalUsedCredits
                      )}
                    </span>

                    <span>
                      {totalUsagePercentage}%
                    </span>
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
                              <div className="ZUQEN-credit-feature-name">
                                {
                                  feature.feature_name
                                }
                              </div>

                              <div className="ZUQEN-credit-feature-provider">
                                Provider-backed
                                credits
                              </div>
                            </div>

                            <div
                              className="ZUQEN-credit-feature-balance"
                              style={{
                                color: low
                                  ? "#f59e0b"
                                  : undefined,
                              }}
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
                        Chat credits are
                        exhausted. Get
                        more credits to
                        continue using
                        ZUQEN AI.
                      </div>
                    )}

                  {totalCredits > 0 &&
                    totalAllocatedCredits >
                      0 &&
                    totalCredits <=
                      totalAllocatedCredits *
                        0.15 && (
                      <div className="ZUQEN-credit-warning">
                        Your credit
                        balance is
                        running low.
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
                        Get More Credits
                      </button>
                    )}
                </div>
              )}
            </div>

            {/* AGENT */}
            <div
              className="ZUQEN-agent-selector"
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <button
                type="button"
                className="ZUQEN-agent-button"
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

                <span>⌄</span>
              </button>

              {agentOpen && (
                <div className="ZUQEN-agent-dropdown">
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
                      onClick={() =>
                        selectAgent(
                          agent
                        )
                      }
                    >
                      {agent}
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
              <div className="ZUQEN-welcome-mark">
                Z
              </div>

              <h1>
                What can I help you with?
              </h1>

              <p>
                Ask anything, create
                content, build ideas and
                explore with ZUQEN AI.
              </p>

              <div className="ZUQEN-prompts">
                {[
                  "Explain something to me",
                  "Help me write something",
                  "Build a website idea",
                  "Analyze my idea",
                ].map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() =>
                      setInput(prompt)
                    }
                  >
                    {prompt}
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
                        ? "U"
                        : "Z"}
                    </div>

                    <div className="ZUQEN-message-body">
                      <div className="ZUQEN-message-role">
                        {message.role ===
                        "user"
                          ? "You"
                          : "ZUQEN"}
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
                                >
                                  📎{" "}
                                  {
                                    attachment.name
                                  }
                                  {attachment.size
                                    ? ` · ${formatFileSize(
                                        attachment.size
                                      )}`
                                    : ""}
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

        <div className="ZUQEN-composer-wrap">
          {attachments.length >
            0 && (
            <div className="ZUQEN-pending-files">
              {attachments.map(
                (attachment) => (
                  <div
                    key={
                      attachment.id
                    }
                  >
                    <span>
                      📎{" "}
                      {attachment.name}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        removeAttachment(
                          attachment.id
                        )
                      }
                    >
                      ×
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
              disabled={uploading}
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
              value={input}
              onChange={(event) =>
                setInput(
                  event.target.value
                )
              }
              onKeyDown={handleKeyDown}
              placeholder="Message ZUQEN AI…"
              rows={1}
              disabled={loading}
            />

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
            >
              {loading ? (
                <span className="ZUQEN-spinner" />
              ) : (
                <Icon size={17}>
                  <path d="m5 12 14-8-4 16-3-7-7-1Z" />
                </Icon>
              )}
            </button>
          </div>

          <div className="ZUQEN-composer-note">
            ZUQEN AI can make mistakes.
            Check important information.
          </div>
        </div>
      </section>

      <style jsx global>{`
        :root {
          --bg: #09090b;
          --panel: #111114;
          --panel-solid: #111114;
          --panel-soft: #18181c;
          --text: #f4f4f5;
          --muted: #a1a1aa;
          --muted2: #71717a;
          --line: rgba(255, 255, 255, 0.08);
          --shadow: rgba(0, 0, 0, 0.45);
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
          --bg: #f7f7f8;
          --panel: #ffffff;
          --panel-solid: #ffffff;
          --panel-soft: #f1f1f3;
          --text: #18181b;
          --muted: #52525b;
          --muted2: #71717a;
          --line: rgba(0, 0, 0, 0.09);
          --shadow: rgba(0, 0, 0, 0.15);
        }

        .ZUQEN-app {
          width: 100vw;
          height: 100vh;
          display: flex;
          background: var(--bg);
        }

        .ZUQEN-sidebar {
          width: 290px;
          min-width: 290px;
          height: 100%;
          border-right: 1px solid var(--line);
          background: var(--panel);
          transition:
            width 0.25s ease,
            min-width 0.25s ease;
          overflow: hidden;
        }

        .ZUQEN-sidebar.closed {
          width: 0;
          min-width: 0;
          border-right: 0;
        }

        .ZUQEN-sidebar-inner {
          width: 290px;
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .ZUQEN-side-top {
          padding: 18px 14px 12px;
        }

        .ZUQEN-brand {
          display: flex;
          align-items: center;
          gap: 9px;
          margin: 2px 8px 18px;
          font-size: 15px;
          font-weight: 850;
          letter-spacing: 0.08em;
        }

        .ZUQEN-brand-mark,
        .ZUQEN-welcome-mark {
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          background: linear-gradient(
            135deg,
            #8b5cf6,
            #6366f1
          );
          color: white;
          font-weight: 900;
        }

        .ZUQEN-brand-mark {
          width: 30px;
          height: 30px;
        }

        .ZUQEN-new-chat {
          width: 100%;
          height: 42px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 13px;
          border: 1px solid var(--line);
          border-radius: 11px;
          color: var(--text);
          background: var(--panel-soft);
          font-size: 12px;
          font-weight: 700;
        }

        .ZUQEN-new-chat:hover {
          border-color: rgba(139, 92, 246, 0.35);
        }

        .ZUQEN-history {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 8px 10px;
        }

        .ZUQEN-section-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 7px 8px 10px;
          color: var(--muted2);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .ZUQEN-chat-item {
          position: relative;
          display: flex;
          align-items: center;
          gap: 4px;
          margin-bottom: 3px;
          border-radius: 9px;
        }

        .ZUQEN-chat-item.active {
          background: var(--panel-soft);
        }

        .ZUQEN-chat-main {
          min-width: 0;
          flex: 1;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 10px 8px;
          border: 0;
          background: transparent;
          color: var(--muted);
          text-align: left;
          font-size: 11px;
        }

        .ZUQEN-chat-main span {
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .ZUQEN-chat-item.active
          .ZUQEN-chat-main {
          color: var(--text);
        }

        .ZUQEN-chat-more {
          width: 28px;
          height: 28px;
          margin-right: 4px;
          border: 0;
          border-radius: 7px;
          background: transparent;
          color: var(--muted2);
        }

        .ZUQEN-chat-more:hover {
          background: var(--panel-soft);
          color: var(--text);
        }

        .ZUQEN-chat-menu {
          position: absolute;
          top: 38px;
          right: 5px;
          z-index: 80;
          width: 130px;
          padding: 5px;
          border: 1px solid var(--line);
          border-radius: 10px;
          background: var(--panel-solid);
          box-shadow: 0 15px 40px var(--shadow);
        }

        .ZUQEN-chat-menu button {
          width: 100%;
          padding: 8px;
          border: 0;
          border-radius: 7px;
          background: transparent;
          color: var(--text);
          text-align: left;
          font-size: 11px;
        }

        .ZUQEN-chat-menu button:hover {
          background: var(--panel-soft);
        }

        .ZUQEN-archive-button {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 9px;
          margin-top: 10px;
          padding: 10px 8px;
          border: 0;
          border-radius: 9px;
          background: transparent;
          color: var(--muted);
          font-size: 11px;
          text-align: left;
        }

        .ZUQEN-archive-button:hover {
          background: var(--panel-soft);
          color: var(--text);
        }

        .ZUQEN-archive-button span:last-child {
          margin-left: auto;
        }

        .ZUQEN-empty-history {
          padding: 25px 10px;
          color: var(--muted2);
          text-align: center;
          font-size: 11px;
        }

        .ZUQEN-side-bottom {
          padding: 12px;
          border-top: 1px solid var(--line);
        }

        .ZUQEN-account {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px;
          border-radius: 11px;
          background: var(--panel-soft);
        }

        .ZUQEN-avatar {
          width: 31px;
          height: 31px;
          flex: 0 0 31px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          background: #27272a;
          color: white;
          font-size: 11px;
          font-weight: 800;
        }

        .ZUQEN-account-info {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .ZUQEN-account-info strong {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 10px;
        }

        .ZUQEN-account-info span {
          color: var(--muted2);
          font-size: 8px;
        }

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
          padding: 0 18px;
          border-bottom: 1px solid var(--line);
          background: var(--panel);
        }

        .ZUQEN-topbar-left,
        .ZUQEN-topbar-actions {
          display: flex;
          align-items: center;
        }

        .ZUQEN-topbar-left {
          gap: 12px;
          min-width: 0;
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
        }

        .ZUQEN-top-action:hover {
          border-color: var(--line);
          background: var(--panel-soft);
          color: var(--text);
        }

        .ZUQEN-topbar-info {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .ZUQEN-topbar-info strong {
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          font-size: 12px;
        }

        .ZUQEN-topbar-info span {
          color: var(--muted2);
          font-size: 8px;
        }

        /* CREDIT BUTTON */

        .ZUQEN-credits-selector {
          position: relative;
        }

        .ZUQEN-credits-button {
          height: 36px;
          min-width: 92px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 4px 9px;
          border: 1px solid var(--line);
          border-radius: 11px;
          background: var(--panel-soft);
          color: var(--text);
        }

        .ZUQEN-credits-button:hover,
        .ZUQEN-credits-button.active {
          border-color: rgba(
            139,
            92,
            246,
            0.35
          );
          background: rgba(
            139,
            92,
            246,
            0.08
          );
        }

        .ZUQEN-credits-icon {
          width: 22px;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 7px;
          background: rgba(
            139,
            92,
            246,
            0.12
          );
          color: #a78bfa;
        }

        .ZUQEN-credits-value {
          font-size: 10px;
          font-weight: 850;
        }

        .ZUQEN-credits-label {
          color: var(--muted2);
          font-size: 8px;
          font-weight: 700;
        }

        /* CREDIT PANEL */

        .ZUQEN-credit-panel {
          position: absolute;
          top: calc(100% + 9px);
          right: 0;
          z-index: 100;
          width: 320px;
          max-height: calc(100vh - 95px);
          overflow-y: auto;
          padding: 15px;
          border: 1px solid var(--line);
          border-radius: 17px;
          background: var(--panel-solid);
          box-shadow:
            0 25px 70px var(--shadow);
        }

        .ZUQEN-credit-panel-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
        }

        .ZUQEN-credit-panel-title {
          color: var(--muted2);
          font-size: 8px;
          font-weight: 850;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .ZUQEN-credit-panel-total {
          margin-top: 5px;
          color: var(--text);
          font-size: 28px;
          line-height: 1;
          font-weight: 900;
          letter-spacing: -0.04em;
        }

        .ZUQEN-credit-panel-sub {
          margin-top: 5px;
          color: var(--muted2);
          font-size: 8px;
        }

        .ZUQEN-credit-panel-icon {
          width: 35px;
          height: 35px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          background: rgba(
            139,
            92,
            246,
            0.12
          );
          color: #a78bfa;
        }

        .ZUQEN-credit-progress {
          width: 100%;
          height: 5px;
          margin-top: 15px;
          overflow: hidden;
          border-radius: 99px;
          background: var(--panel-soft);
        }

        .ZUQEN-credit-progress div {
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(
            90deg,
            #8b5cf6,
            #6366f1
          );
        }

        .ZUQEN-credit-stats {
          display: flex;
          justify-content: space-between;
          margin-top: 8px;
          color: var(--muted2);
          font-size: 8px;
        }

        .ZUQEN-credit-features {
          display: flex;
          flex-direction: column;
          gap: 5px;
          margin-top: 14px;
        }

        .ZUQEN-credit-feature {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 9px;
          border: 1px solid var(--line);
          border-radius: 10px;
          background: var(--panel-soft);
        }

        .ZUQEN-credit-feature-icon {
          width: 27px;
          height: 27px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 27px;
          border-radius: 8px;
          background: rgba(
            139,
            92,
            246,
            0.1
          );
          color: #a78bfa;
          font-size: 12px;
        }

        .ZUQEN-credit-feature-info {
          min-width: 0;
          flex: 1;
        }

        .ZUQEN-credit-feature-name {
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          font-size: 9px;
          font-weight: 800;
        }

        .ZUQEN-credit-feature-provider {
          margin-top: 2px;
          color: var(--muted2);
          font-size: 7px;
        }

        .ZUQEN-credit-feature-balance {
          font-size: 10px;
          font-weight: 850;
        }

        .ZUQEN-credit-warning,
        .ZUQEN-credit-empty {
          margin-top: 10px;
          padding: 9px;
          border-radius: 9px;
          font-size: 8px;
          line-height: 1.45;
        }

        .ZUQEN-credit-warning {
          color: #f59e0b;
          background: rgba(
            245,
            158,
            11,
            0.08
          );
        }

        .ZUQEN-credit-empty {
          color: #f87171;
          background: rgba(
            239,
            68,
            68,
            0.08
          );
        }

        .ZUQEN-credit-get-more {
          width: 100%;
          height: 36px;
          margin-top: 10px;
          border: 0;
          border-radius: 9px;
          background: linear-gradient(
            135deg,
            #8b5cf6,
            #6366f1
          );
          color: white;
          font-size: 9px;
          font-weight: 850;
        }

        /* AGENT */

        .ZUQEN-agent-selector {
          position: relative;
        }

        .ZUQEN-agent-button {
          height: 36px;
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 0 10px;
          border: 1px solid var(--line);
          border-radius: 10px;
          background: var(--panel-soft);
          color: var(--text);
          font-size: 9px;
          font-weight: 750;
        }

        .ZUQEN-agent-icon {
          color: #a78bfa;
        }

        .ZUQEN-agent-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          z-index: 90;
          width: 190px;
          padding: 5px;
          border: 1px solid var(--line);
          border-radius: 11px;
          background: var(--panel-solid);
          box-shadow: 0 20px 55px var(--shadow);
        }

        .ZUQEN-agent-dropdown button {
          width: 100%;
          padding: 9px;
          border: 0;
          border-radius: 7px;
          background: transparent;
          color: var(--text);
          text-align: left;
          font-size: 9px;
        }

        .ZUQEN-agent-dropdown button:hover {
          background: var(--panel-soft);
        }

        /* CHAT */

        .ZUQEN-chat-area {
          min-height: 0;
          flex: 1;
          overflow-y: auto;
        }

        .ZUQEN-welcome {
          min-height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 35px 20px;
          text-align: center;
        }

        .ZUQEN-welcome-mark {
          width: 52px;
          height: 52px;
          margin-bottom: 17px;
          border-radius: 15px;
          font-size: 20px;
        }

        .ZUQEN-welcome h1 {
          margin: 0;
          font-size: 27px;
          letter-spacing: -0.04em;
        }

        .ZUQEN-welcome p {
          max-width: 450px;
          margin: 10px 0 0;
          color: var(--muted);
          font-size: 11px;
          line-height: 1.7;
        }

        .ZUQEN-prompts {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 7px;
          margin-top: 23px;
        }

        .ZUQEN-prompts button {
          padding: 9px 12px;
          border: 1px solid var(--line);
          border-radius: 9px;
          background: var(--panel-soft);
          color: var(--muted);
          font-size: 9px;
        }

        .ZUQEN-prompts button:hover {
          color: var(--text);
          border-color: rgba(
            139,
            92,
            246,
            0.3
          );
        }

        .ZUQEN-messages {
          width: min(850px, 100%);
          margin: 0 auto;
          padding: 35px 20px 25px;
        }

        .ZUQEN-message {
          display: flex;
          gap: 13px;
          margin-bottom: 28px;
        }

        .ZUQEN-message-avatar {
          width: 29px;
          height: 29px;
          flex: 0 0 29px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          background: var(--panel-soft);
          color: var(--muted);
          font-size: 9px;
          font-weight: 850;
        }

        .ZUQEN-message.assistant
          .ZUQEN-message-avatar {
          color: white;
          background: linear-gradient(
            135deg,
            #8b5cf6,
            #6366f1
          );
        }

        .ZUQEN-message-body {
          min-width: 0;
          flex: 1;
        }

        .ZUQEN-message-role {
          margin-bottom: 6px;
          color: var(--muted2);
          font-size: 8px;
          font-weight: 800;
        }

        .ZUQEN-message-content {
          white-space: pre-wrap;
          color: var(--text);
          font-size: 12px;
          line-height: 1.75;
        }

        .ZUQEN-attachments {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 9px;
        }

        .ZUQEN-attachments div {
          padding: 6px 8px;
          border: 1px solid var(--line);
          border-radius: 7px;
          background: var(--panel-soft);
          color: var(--muted);
          font-size: 8px;
        }

        /* COMPOSER */

        .ZUQEN-composer-wrap {
          width: min(850px, 100%);
          margin: 0 auto;
          padding: 0 20px 18px;
        }

        .ZUQEN-pending-files {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 7px;
        }

        .ZUQEN-pending-files div {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 8px;
          border: 1px solid var(--line);
          border-radius: 8px;
          background: var(--panel-soft);
          font-size: 8px;
        }

        .ZUQEN-pending-files button {
          border: 0;
          background: transparent;
          color: var(--muted2);
        }

        .ZUQEN-composer {
          min-height: 54px;
          display: flex;
          align-items: flex-end;
          gap: 8px;
          padding: 8px;
          border: 1px solid var(--line);
          border-radius: 15px;
          background: var(--panel);
          box-shadow: 0 12px 40px var(--shadow);
        }

        .ZUQEN-composer textarea {
          min-height: 35px;
          max-height: 150px;
          flex: 1;
          resize: none;
          padding: 9px 4px;
          border: 0;
          outline: none;
          background: transparent;
          color: var(--text);
          font-size: 11px;
          line-height: 1.5;
        }

        .ZUQEN-composer textarea::placeholder {
          color: var(--muted2);
        }

        .ZUQEN-composer-action,
        .ZUQEN-send {
          width: 35px;
          height: 35px;
          flex: 0 0 35px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 10px;
        }

        .ZUQEN-composer-action {
          background: var(--panel-soft);
          color: var(--muted);
        }

        .ZUQEN-send {
          background: linear-gradient(
            135deg,
            #8b5cf6,
            #6366f1
          );
          color: white;
        }

        .ZUQEN-send:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .ZUQEN-composer-note {
          padding-top: 7px;
          color: var(--muted2);
          text-align: center;
          font-size: 7px;
        }

        .ZUQEN-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(
            255,
            255,
            255,
            0.35
          );
          border-top-color: white;
          border-radius: 50%;
          animation: ZUQEN-spin 0.7s linear
            infinite;
        }

        .ZUQEN-loading-screen {
          width: 100vw;
          height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          background: #09090b;
          color: #a1a1aa;
          font-size: 11px;
        }

        .ZUQEN-loading-logo {
          width: 45px;
          height: 45px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 13px;
          background: linear-gradient(
            135deg,
            #8b5cf6,
            #6366f1
          );
          color: white;
          font-weight: 900;
        }

        @keyframes ZUQEN-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 700px) {
          .ZUQEN-sidebar {
            position: fixed;
            z-index: 200;
            height: 100vh;
          }

          .ZUQEN-sidebar.closed {
            transform: translateX(-100%);
            width: 290px;
            min-width: 290px;
          }

          .ZUQEN-credit-panel {
            position: fixed;
            top: 64px;
            right: 9px;
            width: min(
              320px,
              calc(100vw - 18px)
            );
          }

          .ZUQEN-credits-label {
            display: none;
          }

          .ZUQEN-credits-button {
            min-width: 38px;
            width: 38px;
            padding: 0;
          }

          .ZUQEN-credits-value {
            display: none;
          }

          .ZUQEN-agent-label {
            display: none;
          }

          .ZUQEN-agent-button {
            width: 36px;
            padding: 0;
            justify-content: center;
          }

          .ZUQEN-topbar {
            padding: 0 10px;
          }

          .ZUQEN-welcome h1 {
            font-size: 22px;
          }
        }
      `}</style>
    </main>
  );
}