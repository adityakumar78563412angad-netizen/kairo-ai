"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase";

type User = {
  id: string;
  email?: string | null;
  is_anonymous?: boolean;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
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

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [agentOpen, setAgentOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState("ZUQEN AI");

  const [mode, setMode] = useState<"chat" | "automation">("chat");

  const [credits, setCredits] = useState<number | null>(null);
  const [error, setError] = useState("");

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  /* =========================
     AUTOMATIC CHAT SCROLL
  ========================= */

  const scrollToBottom = useCallback((smooth = true) => {
    const box = messagesRef.current;

    if (!box) return;

    box.scrollTo({
      top: box.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => {
      scrollToBottom(false);
    });
  }, [messages, loading, scrollToBottom]);

  /* =========================
     LOAD CHATS
  ========================= */

  const loadChats = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("chats")
      .select("*")
      .eq("user_id", userId)
      .eq("archived", false)
      .order("updated_at", {
        ascending: false,
      });

    if (error) {
      console.error(error);
      return;
    }

    setChats((data || []) as Chat[]);
  }, []);

  /* =========================
     LOAD CREDITS
  ========================= */

  const loadCredits = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("feature_credit_balances")
      .select("balance")
      .eq("user_id", userId)
      .eq("feature_key", "chat")
      .maybeSingle();

    if (error) {
      console.error(error);
      setCredits(null);
      return;
    }

    setCredits(data ? Number(data.balance) : 0);
  }, []);

  /* =========================
     AUTH
  ========================= */

  const initializeAuth = useCallback(async () => {
    try {
      setReady(false);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      let currentUser = session?.user ?? null;

      if (!currentUser) {
        const {
          data: { user: existingUser },
        } = await supabase.auth.getUser();

        currentUser = existingUser ?? null;
      }

      if (!currentUser) {
        const { data, error } =
          await supabase.auth.signInAnonymously();

        if (error || !data.user) {
          setError(
            error?.message ||
              "Unable to create guest account."
          );
          return;
        }

        currentUser = data.user;
      }

      const normalizedUser: User = {
        id: currentUser.id,
        email: currentUser.email,
        is_anonymous: currentUser.is_anonymous,
      };

      setUser(normalizedUser);

      await Promise.all([
        loadChats(currentUser.id),
        loadCredits(currentUser.id),
      ]);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to initialize ZUQEN AI."
      );
    } finally {
      setReady(true);
    }
  }, [loadChats, loadCredits]);

  useEffect(() => {
    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!session?.user) return;

        const nextUser: User = {
          id: session.user.id,
          email: session.user.email,
          is_anonymous: session.user.is_anonymous,
        };

        setUser(nextUser);

        await Promise.all([
          loadChats(session.user.id),
          loadCredits(session.user.id),
        ]);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [initializeAuth, loadChats, loadCredits]);

  /* =========================
     NEW CHAT
  ========================= */

  const createChat = useCallback(async () => {
    if (!user?.id) return;

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("chats")
      .insert({
        user_id: user.id,
        title: "New conversation",
        archived: false,
        messages: [],
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();

    if (error || !data) {
      setError(
        error?.message ||
          "Unable to create conversation."
      );
      return;
    }

    setChats((prev) => [
      data as Chat,
      ...prev,
    ]);

    setActiveChatId(data.id);
    setMessages([]);
    setInput("");

    requestAnimationFrame(() => {
      scrollToBottom(false);
    });
  }, [user, scrollToBottom]);

  /* =========================
     SELECT CHAT
  ========================= */

  const selectChat = (chat: Chat) => {
    setActiveChatId(chat.id);

    setMessages(
      Array.isArray(chat.messages)
        ? chat.messages
        : []
    );

    setMode("chat");

    requestAnimationFrame(() => {
      scrollToBottom(false);
    });
  };

  /* =========================
     SAVE CHAT
  ========================= */

  const saveChat = async (
    chatId: string,
    nextMessages: Message[]
  ) => {
    if (!user?.id) return;

    await supabase
      .from("chats")
      .update({
        messages: nextMessages,
        updated_at: new Date().toISOString(),
      })
      .eq("id", chatId)
      .eq("user_id", user.id);

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              messages: nextMessages,
              updated_at:
                new Date().toISOString(),
            }
          : chat
      )
    );
  };

  /* =========================
     SEND CHAT
  ========================= */

  const sendMessage = async () => {
    const text = input.trim();

    if (!text || loading) return;

    if (!user?.id) {
      setError("Please wait for authentication.");
      return;
    }

    let chatId = activeChatId;

    if (!chatId) {
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from("chats")
        .insert({
          user_id: user.id,
          title: text.slice(0, 55),
          archived: false,
          messages: [],
          created_at: now,
          updated_at: now,
        })
        .select("*")
        .single();

      if (error || !data) {
        setError(
          error?.message ||
            "Unable to create conversation."
        );
        return;
      }

      chatId = data.id;

      setChats((prev) => [
        data as Chat,
        ...prev,
      ]);

      setActiveChatId(chatId);
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };

    const nextMessages = [
      ...messages,
      userMessage,
    ];

    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError("");

    requestAnimationFrame(() =>
      scrollToBottom(true)
    );

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: nextMessages,
          mode,
          agent: selectedAgent,
        }),
      });

      if (!response.ok) {
        throw new Error(
          await response.text()
        );
      }

      const reader =
        response.body?.getReader();

      if (!reader) {
        throw new Error(
          "No response stream received."
        );
      }

      const decoder = new TextDecoder();

      let assistantText = "";

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        created_at:
          new Date().toISOString(),
      };

      setMessages((prev) => [
        ...prev,
        assistantMessage,
      ]);

      while (true) {
        const { value, done } =
          await reader.read();

        if (done) break;

        const chunk =
          decoder.decode(value, {
            stream: true,
          });

        assistantText += chunk;

        setMessages((prev) =>
          prev.map((message) =>
            message.id ===
            assistantMessage.id
              ? {
                  ...message,
                  content:
                    assistantText,
                }
              : message
          )
        );

        /* IMPORTANT:
           auto-scroll while streaming */
        requestAnimationFrame(() =>
          scrollToBottom(true)
        );
      }

      const finalMessages = [
        ...nextMessages,
        {
          ...assistantMessage,
          content: assistantText,
        },
      ];

      setMessages(finalMessages);

      await saveChat(
        chatId,
        finalMessages
      );

      await loadCredits(user.id);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);

      requestAnimationFrame(() =>
        scrollToBottom(true)
      );
    }
  };

  /* =========================
     AGENT NAVIGATION
  ========================= */

  const selectAgent = (
    agent: (typeof AGENTS)[number]
  ) => {
    setAgentOpen(false);

    if (agent.route) {
      window.location.href =
        agent.route;
      return;
    }

    setSelectedAgent(agent.name);
    setMode("chat");
  };

  /* =========================
     AUTOMATION
  ========================= */

  const openAutomation = () => {
    setMode("automation");
    setSelectedAgent("ZUQEN AI");
    setAgentOpen(false);
    setMessages([]);
    setActiveChatId(null);
    setInput("");
  };

  /* =========================
     TEMPLATES
  ========================= */

  const openBuyTemplates = () => {
    window.location.href =
      "/templates";
  };

  const openSellTemplates = () => {
    window.location.href =
      "/templates/sell";
  };

  /* =========================
     TEXTAREA
  ========================= */

  const handleInput = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setInput(e.target.value);

    e.target.style.height = "auto";

    e.target.style.height =
      `${Math.min(
        e.target.scrollHeight,
        220
      )}px`;
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (
      e.key === "Enter" &&
      !e.shiftKey
    ) {
      e.preventDefault();
      sendMessage();
    }
  };

  /* =========================
     SIGN OUT
  ========================= */

  const signOut = async () => {
    await supabase.auth.signOut();

    window.location.href =
      "/auth";
  };

  /* =========================
     UI
  ========================= */

  if (!ready) {
    return (
      <main className="zuqen-loading">
        <div className="zuqen-logo">
          ZUQEN
        </div>

        <div>
          Loading your AI workspace...
        </div>

        <style jsx>{`
          .zuqen-loading {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            gap: 14px;
            background: #050505;
            color: #fff;
            font-family: Arial, sans-serif;
          }

          .zuqen-logo {
            font-size: 32px;
            font-weight: 800;
            letter-spacing: -1px;
          }
        `}</style>
      </main>
    );
  }

  return (
    <main className="zuqen">
      {/* ================= SIDEBAR ================= */}

      <aside
        className={`sidebar ${
          sidebarOpen ? "" : "closed"
        }`}
      >
        <div className="brand">
          <div className="brand-mark">
            Z
          </div>

          {sidebarOpen && (
            <strong>ZUQEN AI</strong>
          )}
        </div>

        <button
          className="new-chat"
          onClick={createChat}
        >
          <span>＋</span>

          {sidebarOpen && (
            <span>New Chat</span>
          )}
        </button>

        {sidebarOpen && (
          <>
            <div className="sidebar-title">
              WORKSPACE
            </div>

            <button
              className={`side-button ${
                mode === "chat"
                  ? "active"
                  : ""
              }`}
              onClick={() => {
                setMode("chat");
                setMessages([]);
                setActiveChatId(null);
              }}
            >
              <span>✦</span>
              <span>Normal Mode</span>
            </button>

            <button
              className={`side-button automation ${
                mode === "automation"
                  ? "active"
                  : ""
              }`}
              onClick={openAutomation}
            >
              <span>⚡</span>
              <span>Automation Mode</span>
            </button>

            <div className="sidebar-title">
              TEMPLATES
            </div>

            <button
              className="side-button"
              onClick={openBuyTemplates}
            >
              <span>🛒</span>
              <span>Buy Templates</span>
            </button>

            <button
              className="side-button"
              onClick={openSellTemplates}
            >
              <span>💰</span>
              <span>Sell Templates</span>
            </button>

            <div className="sidebar-title">
              AGENTS
            </div>

            {AGENTS.map((agent) => (
              <button
                key={agent.name}
                className="side-button"
                onClick={() =>
                  selectAgent(agent)
                }
              >
                <span>{agent.icon}</span>
                <span>
                  {agent.name}
                </span>
              </button>
            ))}

            <div className="sidebar-title">
              RECENT CHATS
            </div>

            <div className="chat-list">
              {chats.map((chat) => (
                <button
                  key={chat.id}
                  className={`chat-item ${
                    activeChatId ===
                    chat.id
                      ? "selected"
                      : ""
                  }`}
                  onClick={() =>
                    selectChat(chat)
                  }
                >
                  {chat.title}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="sidebar-bottom">
          {sidebarOpen && (
            <>
              <div className="credit-box">
                <span>
                  ZUQEN Credits
                </span>

                <strong>
                  {credits === null
                    ? "—"
                    : credits.toFixed(2)}
                </strong>
              </div>

              <button
                className="profile"
                onClick={signOut}
              >
                <span>●</span>

                <span>
                  {user?.is_anonymous
                    ? "Guest"
                    : user?.email ||
                      "Account"}
                </span>
              </button>
            </>
          )}

          <button
            className="collapse"
            onClick={() =>
              setSidebarOpen(
                (value) => !value
              )
            }
          >
            {sidebarOpen ? "‹" : "›"}
          </button>
        </div>
      </aside>

      {/* ================= MAIN ================= */}

      <section className="main">
        <header className="topbar">
          <div>
            <button
              className="mobile-menu"
              onClick={() =>
                setSidebarOpen(
                  (value) => !value
                )
              }
            >
              ☰
            </button>

            <span className="top-title">
              {mode === "automation"
                ? "Automation Mode"
                : selectedAgent}
            </span>
          </div>

          <div className="top-actions">
            <button
              onClick={openBuyTemplates}
            >
              🛒 Templates
            </button>

            <button
              onClick={openAutomation}
            >
              ⚡ Automate
            </button>
          </div>
        </header>

        {/* ================= AUTOMATION ================= */}

        {mode === "automation" ? (
          <div className="automation-page">
            <div className="automation-hero">
              <div className="automation-icon">
                ⚡
              </div>

              <h1>
                Tell ZUQEN what you want.
              </h1>

              <p>
                Don't explain which AI,
                tool or workflow to use.
                ZUQEN will plan the task
                and coordinate the required
                capabilities.
              </p>

              <div className="automation-examples">
                <button
                  onClick={() =>
                    setInput(
                      "Build me a complete online business website"
                    )
                  }
                >
                  Build a business
                </button>

                <button
                  onClick={() =>
                    setInput(
                      "Create a complete marketing campaign for my product"
                    )
                  }
                >
                  Marketing campaign
                </button>

                <button
                  onClick={() =>
                    setInput(
                      "Research this idea and create a complete plan"
                    )
                  }
                >
                  Research & plan
                </button>

                <button
                  onClick={() =>
                    setInput(
                      "Create a website with images, copy and SEO"
                    )
                  }
                >
                  Build a website
                </button>
              </div>
            </div>

            <div className="automation-composer">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                placeholder="Tell ZUQEN what you want to accomplish..."
                rows={1}
              />

              <button
                onClick={sendMessage}
                disabled={
                  loading ||
                  !input.trim()
                }
              >
                {loading
                  ? "..."
                  : "➤"}
              </button>
            </div>
          </div>
        ) : (
          /* ================= CHAT ================= */

          <>
            <div
              ref={messagesRef}
              className="messages"
            >
              {messages.length === 0 ? (
                <div className="welcome">
                  <div className="welcome-mark">
                    ✦
                  </div>

                  <h1>
                    What can I help you
                    with?
                  </h1>

                  <p>
                    Ask ZUQEN anything,
                    build something, or
                    choose an AI agent.
                  </p>

                  <div className="quick-grid">
                    <button
                      onClick={() =>
                        setInput(
                          "Build me a modern website"
                        )
                      }
                    >
                      Build a website
                    </button>

                    <button
                      onClick={() =>
                        setInput(
                          "Create an image for my brand"
                        )
                      }
                    >
                      Create an image
                    </button>

                    <button
                      onClick={() =>
                        setInput(
                          "Create a video concept"
                        )
                      }
                    >
                      Create a video
                    </button>

                    <button
                      onClick={() =>
                        openAutomation()
                      }
                    >
                      Automate a task
                    </button>
                  </div>
                </div>
              ) : (
                <div className="message-wrap">
                  {messages.map(
                    (message) => (
                      <div
                        key={message.id}
                        className={`message ${
                          message.role
                        }`}
                      >
                        <div className="avatar">
                          {message.role ===
                          "user"
                            ? "U"
                            : "✦"}
                        </div>

                        <div className="bubble">
                          {message.content}
                        </div>
                      </div>
                    )
                  )}

                  {loading && (
                    <div className="typing">
                      <span>●</span>
                      <span>●</span>
                      <span>●</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="composer-area">
              <div className="agent-picker">
                {agentOpen && (
                  <div className="agent-menu">
                    {AGENTS.map(
                      (agent) => (
                        <button
                          key={
                            agent.name
                          }
                          onClick={() =>
                            selectAgent(
                              agent
                            )
                          }
                        >
                          <span>
                            {agent.icon}
                          </span>

                          <div>
                            <strong>
                              {
                                agent.name
                              }
                            </strong>

                            <small>
                              {
                                agent.description
                              }
                            </small>
                          </div>
                        </button>
                      )
                    )}

                    <button
                      onClick={
                        openAutomation
                      }
                    >
                      <span>⚡</span>

                      <div>
                        <strong>
                          Automation Mode
                        </strong>

                        <small>
                          Let ZUQEN
                          coordinate the
                          task
                        </small>
                      </div>
                    </button>
                  </div>
                )}

                <button
                  className="agent-button"
                  onClick={() =>
                    setAgentOpen(
                      (value) => !value
                    )
                  }
                >
                  <span>
                    {mode ===
                    "automation"
                      ? "⚡"
                      : AGENTS.find(
                          (a) =>
                            a.name ===
                            selectedAgent
                        )?.icon ||
                        "✦"}
                  </span>

                  <span>
                    {selectedAgent}
                  </span>

                  <span>⌄</span>
                </button>
              </div>

              <div className="composer">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleInput}
                  onKeyDown={
                    handleKeyDown
                  }
                  placeholder="Message ZUQEN AI..."
                  rows={1}
                />

                <button
                  className="send"
                  onClick={sendMessage}
                  disabled={
                    loading ||
                    !input.trim()
                  }
                >
                  ➤
                </button>
              </div>

              <div className="composer-note">
                ZUQEN AI can make mistakes.
                Check important information.
              </div>
            </div>
          </>
        )}
      </section>

      {error && (
        <div className="error">
          {error}

          <button
            onClick={() => setError("")}
          >
            ×
          </button>
        </div>
      )}

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .zuqen {
          min-height: 100vh;
          display: flex;
          background: #050505;
          color: #f5f5f5;
          font-family:
            Inter,
            Arial,
            sans-serif;
        }

        .sidebar {
          width: 270px;
          min-width: 270px;
          height: 100vh;
          display: flex;
          flex-direction: column;
          border-right: 1px solid #1d1d1d;
          background: #090909;
          padding: 18px 14px;
          transition: 0.2s ease;
        }

        .sidebar.closed {
          width: 76px;
          min-width: 76px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
          height: 48px;
          padding: 0 8px;
          margin-bottom: 14px;
        }

        .brand-mark {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: #fff;
          color: #000;
          font-weight: 900;
        }

        .brand strong {
          font-size: 16px;
          letter-spacing: -0.3px;
        }

        .new-chat {
          width: 100%;
          height: 44px;
          border: 1px solid #292929;
          background: #151515;
          color: white;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 14px;
          cursor: pointer;
          font-weight: 600;
          margin-bottom: 18px;
        }

        .new-chat:hover,
        .side-button:hover {
          background: #1d1d1d;
        }

        .sidebar-title {
          font-size: 10px;
          color: #666;
          font-weight: 800;
          letter-spacing: 1px;
          margin: 16px 8px 7px;
        }

        .side-button {
          width: 100%;
          border: 0;
          background: transparent;
          color: #aaa;
          border-radius: 9px;
          min-height: 39px;
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 0 10px;
          cursor: pointer;
          text-align: left;
          margin-bottom: 2px;
        }

        .side-button.active {
          background: #1b1b1b;
          color: white;
        }

        .side-button.automation {
          color: #ddd;
        }

        .chat-list {
          overflow-y: auto;
          max-height: 260px;
        }

        .chat-item {
          width: 100%;
          border: 0;
          background: transparent;
          color: #8b8b8b;
          padding: 9px 10px;
          border-radius: 8px;
          text-align: left;
          cursor: pointer;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .chat-item:hover,
        .chat-item.selected {
          background: #171717;
          color: #fff;
        }

        .sidebar-bottom {
          margin-top: auto;
          position: relative;
        }

        .credit-box {
          padding: 12px;
          border: 1px solid #202020;
          border-radius: 12px;
          background: #101010;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
          font-size: 12px;
          color: #888;
        }

        .credit-box strong {
          color: white;
        }

        .profile {
          width: 100%;
          height: 40px;
          border: 0;
          background: transparent;
          color: #aaa;
          display: flex;
          align-items: center;
          gap: 9px;
          cursor: pointer;
          padding: 0 8px;
          text-align: left;
        }

        .collapse {
          position: absolute;
          right: -30px;
          bottom: 0;
          width: 28px;
          height: 28px;
          border: 1px solid #252525;
          border-radius: 50%;
          background: #101010;
          color: white;
          cursor: pointer;
          z-index: 5;
        }

        .main {
          flex: 1;
          min-width: 0;
          height: 100vh;
          display: flex;
          flex-direction: column;
        }

        .topbar {
          height: 62px;
          min-height: 62px;
          border-bottom: 1px solid #1b1b1b;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 22px;
        }

        .top-title {
          font-weight: 700;
          font-size: 14px;
        }

        .mobile-menu {
          display: none;
        }

        .top-actions {
          display: flex;
          gap: 8px;
        }

        .top-actions button {
          border: 1px solid #292929;
          background: #101010;
          color: #ddd;
          border-radius: 9px;
          padding: 8px 12px;
          cursor: pointer;
        }

        .top-actions button:hover {
          background: #191919;
        }

        .messages {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          scroll-behavior: smooth;
        }

        .welcome {
          min-height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 40px 20px;
          text-align: center;
        }

        .welcome-mark,
        .automation-icon {
          width: 60px;
          height: 60px;
          border-radius: 18px;
          background: #171717;
          border: 1px solid #292929;
          display: grid;
          place-items: center;
          font-size: 27px;
          margin-bottom: 20px;
        }

        .welcome h1,
        .automation-page h1 {
          margin: 0;
          font-size: 34px;
          letter-spacing: -1.5px;
        }

        .welcome p,
        .automation-page p {
          color: #777;
          max-width: 580px;
          line-height: 1.6;
        }

        .quick-grid,
        .automation-examples {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          margin-top: 25px;
          width: min(600px, 100%);
        }

        .quick-grid button,
        .automation-examples button {
          border: 1px solid #242424;
          background: #101010;
          color: #aaa;
          border-radius: 11px;
          padding: 13px;
          cursor: pointer;
        }

        .quick-grid button:hover,
        .automation-examples button:hover {
          background: #191919;
          color: white;
        }

        .message-wrap {
          width: min(850px, 100%);
          margin: auto;
          padding: 30px 20px 150px;
        }

        .message {
          display: flex;
          gap: 12px;
          margin-bottom: 28px;
        }

        .message.user {
          flex-direction: row-reverse;
        }

        .avatar {
          width: 32px;
          height: 32px;
          min-width: 32px;
          border-radius: 50%;
          background: #181818;
          border: 1px solid #292929;
          display: grid;
          place-items: center;
          font-size: 12px;
          font-weight: 700;
        }

        .bubble {
          max-width: 78%;
          white-space: pre-wrap;
          line-height: 1.7;
          padding: 13px 16px;
          border-radius: 15px;
          background: #111;
          border: 1px solid #202020;
        }

        .message.user .bubble {
          background: #1d1d1d;
        }

        .typing {
          margin-left: 44px;
          display: flex;
          gap: 4px;
          color: #777;
        }

        .typing span {
          animation: blink 1s infinite;
        }

        .typing span:nth-child(2) {
          animation-delay: 0.15s;
        }

        .typing span:nth-child(3) {
          animation-delay: 0.3s;
        }

        @keyframes blink {
          0%,
          100% {
            opacity: 0.2;
          }

          50% {
            opacity: 1;
          }
        }

        .composer-area {
          padding: 10px 20px 18px;
          width: min(850px, 100%);
          margin: 0 auto;
          position: relative;
        }

        .composer {
          display: flex;
          align-items: flex-end;
          gap: 10px;
          border: 1px solid #292929;
          background: #101010;
          border-radius: 18px;
          padding: 10px 10px 10px 16px;
        }

        .composer textarea,
        .automation-composer textarea {
          flex: 1;
          border: 0;
          outline: 0;
          background: transparent;
          color: white;
          resize: none;
          font: inherit;
          line-height: 1.5;
          max-height: 220px;
        }

        .composer textarea::placeholder,
        .automation-composer textarea::placeholder {
          color: #555;
        }

        .send,
        .automation-composer button {
          width: 40px;
          height: 40px;
          border: 0;
          border-radius: 12px;
          background: white;
          color: black;
          cursor: pointer;
          font-weight: 800;
        }

        .send:disabled,
        .automation-composer button:disabled {
          opacity: 0.3;
          cursor: default;
        }

        .composer-note {
          text-align: center;
          color: #444;
          font-size: 10px;
          margin-top: 8px;
        }

        .agent-picker {
          position: relative;
          margin-bottom: 8px;
        }

        .agent-button {
          border: 0;
          background: transparent;
          color: #888;
          display: flex;
          gap: 7px;
          align-items: center;
          cursor: pointer;
          padding: 4px 8px;
        }

        .agent-menu {
          position: absolute;
          bottom: 40px;
          left: 0;
          width: 310px;
          background: #101010;
          border: 1px solid #292929;
          border-radius: 14px;
          padding: 7px;
          box-shadow: 0 20px 60px #000;
          z-index: 20;
        }

        .agent-menu button {
          width: 100%;
          border: 0;
          background: transparent;
          color: white;
          display: flex;
          gap: 12px;
          text-align: left;
          padding: 11px;
          border-radius: 10px;
          cursor: pointer;
        }

        .agent-menu button:hover {
          background: #1b1b1b;
        }

        .agent-menu small {
          display: block;
          color: #666;
          margin-top: 3px;
        }

        .automation-page {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 30px;
        }

        .automation-hero {
          text-align: center;
          max-width: 800px;
        }

        .automation-icon {
          margin: 0 auto 20px;
        }

        .automation-composer {
          width: min(850px, 100%);
          margin-top: 40px;
          display: flex;
          align-items: flex-end;
          gap: 10px;
          border: 1px solid #292929;
          background: #101010;
          border-radius: 18px;
          padding: 12px 12px 12px 16px;
        }

        .error {
          position: fixed;
          right: 20px;
          bottom: 20px;
          max-width: 420px;
          background: #1b1010;
          border: 1px solid #542525;
          color: #ffb0b0;
          padding: 13px 15px;
          border-radius: 12px;
          z-index: 100;
          display: flex;
          gap: 15px;
        }

        .error button {
          background: transparent;
          color: inherit;
          border: 0;
          cursor: pointer;
        }

        @media (max-width: 800px) {
          .sidebar {
            position: fixed;
            z-index: 50;
            left: 0;
            top: 0;
            bottom: 0;
          }

          .sidebar.closed {
            transform: translateX(-100%);
          }

          .mobile-menu {
            display: inline-block;
            background: transparent;
            color: white;
            border: 0;
            margin-right: 10px;
            cursor: pointer;
          }

          .top-actions {
            display: none;
          }

          .welcome h1,
          .automation-page h1 {
            font-size: 27px;
          }

          .quick-grid,
          .automation-examples {
            grid-template-columns: 1fr;
          }

          .message-wrap {
            padding-left: 12px;
            padding-right: 12px;
          }

          .composer-area {
            padding-left: 10px;
            padding-right: 10px;
          }

          .bubble {
            max-width: 85%;
          }
        }
      `}</style>
    </main>
  );
}