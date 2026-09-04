"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";

type Attachment = {
  id?: string;
  name: string;
  type: string;
  url?: string;
  size?: number;
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

const supabase = createClient();

export default function Home() {
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

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);

  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // --------------------------------------------------
  // AUTH
  // --------------------------------------------------

  useEffect(() => {
    initializeUser();
  }, []);

  async function initializeUser() {
    try {
      const current = await supabase.auth.getUser();

      if (current.data.user) {
        setUser(current.data.user);
        await loadChats(current.data.user.id);
        setAuthReady(true);
        return;
      }

      const anonymous = await supabase.auth.signInAnonymously();

      if (anonymous.error) {
        console.error("Anonymous auth error:", anonymous.error);

        alert(
          "KAIRO couldn't connect to Supabase.\n\n" +
            anonymous.error.message +
            "\n\nEnable Anonymous Sign-Ins in Supabase."
        );

        setAuthReady(true);
        return;
      }

      const newUser = await supabase.auth.getUser();

      if (newUser.data.user) {
        setUser(newUser.data.user);
        await loadChats(newUser.data.user.id);
      }
    } catch (error) {
      console.error("Auth error:", error);
    } finally {
      setAuthReady(true);
    }
  }

  async function ensureUser() {
    if (user) return user;

    const current = await supabase.auth.getUser();

    if (current.data.user) {
      setUser(current.data.user);
      return current.data.user;
    }

    const anonymous = await supabase.auth.signInAnonymously();

    if (anonymous.error) {
      alert(
        "Supabase login failed:\n\n" + anonymous.error.message
      );
      return null;
    }

    const again = await supabase.auth.getUser();

    if (!again.data.user) {
      alert("KAIRO could not create a user session.");
      return null;
    }

    setUser(again.data.user);

    await loadChats(again.data.user.id);

    return again.data.user;
  }

  // --------------------------------------------------
  // CHATS
  // --------------------------------------------------

  async function loadChats(userId: string) {
    const { data, error } = await supabase
      .from("kairo_chats")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", {
        ascending: false,
      });

    if (error) {
      console.error("Load chats:", error);
      return;
    }

    setChats(data || []);
  }

  async function createChat() {
    const currentUser = await ensureUser();

    if (!currentUser) return null;

    const { data, error } = await supabase
      .from("kairo_chats")
      .insert({
        user_id: currentUser.id,
        title: "New chat",
        archived: false,
      })
      .select()
      .single();

    if (error) {
      console.error("Create chat:", error);

      alert(
        "Couldn't create chat:\n\n" +
          error.message
      );

      return null;
    }

    setChats((prev) => [
      data,
      ...prev.filter((chat) => chat.id !== data.id),
    ]);

    setActiveChat(data.id);
    setMessages([]);
    setAttachments([]);
    setInput("");
    setEditingId(null);
    setMenuOpen(null);
    setArchiveOpen(false);

    return data.id;
  }

  async function openChat(id: string) {
    setActiveChat(id);
    setMenuOpen(null);
    setArchiveOpen(false);
    setEditingId(null);
    setAttachments([]);

    const { data, error } = await supabase
      .from("kairo_messages")
      .select("*")
      .eq("chat_id", id)
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      console.error("Open chat:", error);

      alert(
        "Couldn't open this chat:\n\n" +
          error.message
      );

      return;
    }

    setMessages(data || []);
  }

  async function renameChat(id: string) {
    const chat = chats.find((item) => item.id === id);

    if (!chat) return;

    const name = window.prompt(
      "Enter new chat name:",
      chat.title
    );

    if (!name || !name.trim()) return;

    const cleanName = name.trim();

    const { error } = await supabase
      .from("kairo_chats")
      .update({
        title: cleanName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      alert(
        "Couldn't rename chat:\n\n" +
          error.message
      );
      return;
    }

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === id
          ? {
              ...chat,
              title: cleanName,
              updated_at: new Date().toISOString(),
            }
          : chat
      )
    );

    setMenuOpen(null);
  }

  async function archiveChat(id: string) {
    const { error } = await supabase
      .from("kairo_chats")
      .update({
        archived: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      alert(
        "Couldn't archive chat:\n\n" +
          error.message
      );
      return;
    }

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === id
          ? {
              ...chat,
              archived: true,
            }
          : chat
      )
    );

    if (activeChat === id) {
      setActiveChat(null);
      setMessages([]);
    }

    setMenuOpen(null);
  }

  async function restoreChat(id: string) {
    const { error } = await supabase
      .from("kairo_chats")
      .update({
        archived: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      alert(
        "Couldn't restore chat:\n\n" +
          error.message
      );
      return;
    }

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === id
          ? {
              ...chat,
              archived: false,
            }
          : chat
      )
    );
  }

  async function deleteChat(id: string) {
    const confirmed = window.confirm(
      "Delete this chat permanently?"
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("kairo_chats")
      .delete()
      .eq("id", id);

    if (error) {
      alert(
        "Couldn't delete chat:\n\n" +
          error.message
      );
      return;
    }

    setChats((prev) =>
      prev.filter((chat) => chat.id !== id)
    );

    if (activeChat === id) {
      setActiveChat(null);
      setMessages([]);
      setInput("");
    }

    setMenuOpen(null);
  }

  // --------------------------------------------------
  // FILES
  // --------------------------------------------------

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    const currentUser = await ensureUser();

    if (!currentUser) return;

    setUploading(true);

    const uploaded: Attachment[] = [];

    try {
      for (const file of Array.from(files)) {
        const safeName = file.name.replace(
          /[^a-zA-Z0-9._-]/g,
          "_"
        );

        const path =
          currentUser.id +
          "/" +
          crypto.randomUUID() +
          "-" +
          safeName;

        const { error } = await supabase.storage
          .from("kairo-files")
          .upload(path, file);

        if (error) {
          console.error(
            "Upload error:",
            error
          );

          alert(
            `Couldn't upload ${file.name}:\n\n${error.message}`
          );

          continue;
        }

        const { data } = supabase.storage
          .from("kairo-files")
          .getPublicUrl(path);

        uploaded.push({
          name: file.name,
          type:
            file.type ||
            "application/octet-stream",
          size: file.size,
          url: data.publicUrl,
        });
      }

      setAttachments((prev) => [
        ...prev,
        ...uploaded,
      ]);
    } finally {
      setUploading(false);

      if (fileInput.current) {
        fileInput.current.value = "";
      }

      if (folderInput.current) {
        folderInput.current.value = "";
      }
    }
  }

  function removeAttachment(index: number) {
    setAttachments((prev) =>
      prev.filter((_, i) => i !== index)
    );
  }

  // --------------------------------------------------
  // STREAMING
  // --------------------------------------------------

  async function streamAI(
    chatId: string,
    history: Message[],
    currentAttachments: Attachment[] = []
  ) {
    const assistantId = crypto.randomUUID();

    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: "assistant",
        content: "",
      },
    ]);

    let answer = "";

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: history.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          attachments: currentAttachments,
        }),
      });

      if (!response.ok) {
        let errorMessage =
          "KAIRO request failed.";

        try {
          const errorData =
            await response.json();

          errorMessage =
            errorData?.details ||
            errorData?.error ||
            errorMessage;
        } catch {}

        throw new Error(errorMessage);
      }

      if (!response.body) {
        throw new Error(
          "KAIRO returned an empty response."
        );
      }

      const reader =
        response.body.getReader();

      const decoder = new TextDecoder();

      let buffer = "";

      while (true) {
        const { value, done } =
          await reader.read();

        if (done) break;

        buffer += decoder.decode(value, {
          stream: true,
        });

        const lines =
          buffer.split("\n");

        buffer =
          lines.pop() || "";

        for (const line of lines) {
          const trimmed =
            line.trim();

          if (
            !trimmed.startsWith("data:")
          ) {
            continue;
          }

          const data =
            trimmed
              .slice(5)
              .trim();

          if (data === "[DONE]") {
            continue;
          }

          try {
            const parsed =
              JSON.parse(data);

            if (parsed.text) {
              answer += parsed.text;

              setMessages((prev) =>
                prev.map((message) =>
                  message.id ===
                  assistantId
                    ? {
                        ...message,
                        content:
                          answer,
                      }
                    : message
                )
              );
            }
          } catch (error) {
            console.error(
              "Stream parsing error:",
              error
            );
          }
        }
      }

      if (!answer.trim()) {
        throw new Error(
          "KAIRO returned no text."
        );
      }

      const { error: saveError } =
        await supabase
          .from("kairo_messages")
          .insert({
            chat_id: chatId,
            role: "assistant",
            content: answer,
          });

      if (saveError) {
        console.error(
          "Save assistant message:",
          saveError
        );
      }

      return answer;
    } catch (error: any) {
      console.error(
        "AI request:",
        error
      );

      const errorText =
        error?.message ||
        "KAIRO couldn't complete the request.";

      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                content:
                  "⚠️ " + errorText,
              }
            : message
        )
      );

      return null;
    }
  }

  // --------------------------------------------------
  // SEND
  // --------------------------------------------------

  async function sendMessage() {
    if (loading || uploading) return;

    const text = input.trim();

    if (
      !text &&
      attachments.length === 0
    ) {
      return;
    }

    const currentUser =
      await ensureUser();

    if (!currentUser) return;

    setLoading(true);

    try {
      // --------------------------------------------
      // EDIT MODE
      // --------------------------------------------

      if (editingId) {
        const editedIndex =
          messages.findIndex(
            (message) =>
              message.id === editingId
          );

        if (editedIndex !== -1) {
          const editedMessage =
            messages[editedIndex];

          const newUserMessage: Message =
            {
              ...editedMessage,
              content: text,
              attachments:
                attachments.length > 0
                  ? attachments
                  : editedMessage.attachments,
            };

          const newMessages =
            messages.slice(
              0,
              editedIndex + 1
            );

          newMessages[
            editedIndex
          ] = newUserMessage;

          setMessages(newMessages);

          setInput("");
          setEditingId(null);

          const chatId =
            activeChat;

          if (!chatId) {
            setLoading(false);
            return;
          }

          await supabase
            .from("kairo_messages")
            .delete()
            .eq("chat_id", chatId)
            .eq(
              "id",
              editedMessage.id
            );

          await supabase
            .from("kairo_messages")
            .insert({
              chat_id: chatId,
              role: "user",
              content: text,
              attachments:
                newUserMessage.attachments ||
                [],
            });

          setAttachments([]);

          await streamAI(
            chatId,
            newMessages
          );

          await updateChatTime(
            chatId
          );

          return;
        }
      }

      // --------------------------------------------
      // NORMAL MESSAGE
      // --------------------------------------------

      let chatId =
        activeChat;

      if (!chatId) {
        chatId =
          await createChat();

        if (!chatId) {
          setLoading(false);
          return;
        }
      }

      const currentAttachments =
        [...attachments];

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        attachments:
          currentAttachments,
      };

      const history = [
        ...messages,
        userMessage,
      ];

      setMessages(history);

      setInput("");
      setAttachments([]);

      const { error: saveError } =
        await supabase
          .from("kairo_messages")
          .insert({
            chat_id: chatId,
            role: "user",
            content: text,
            attachments:
              currentAttachments,
          });

      if (saveError) {
        console.error(
          "Save user message:",
          saveError
        );
      }

      await updateChatTitle(
        chatId,
        text
      );

      await streamAI(
        chatId,
        history,
        currentAttachments
      );

      await updateChatTime(
        chatId
      );
    } catch (error) {
      console.error(
        "Send message error:",
        error
      );

      alert(
        "Something went wrong while sending the message."
      );
    } finally {
      setLoading(false);
    }
  }

  // --------------------------------------------------
  // CHAT UPDATE
  // --------------------------------------------------

  async function updateChatTime(
    chatId: string
  ) {
    const now =
      new Date().toISOString();

    await supabase
      .from("kairo_chats")
      .update({
        updated_at: now,
      })
      .eq("id", chatId);

    setChats((prev) =>
      prev
        .map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                updated_at: now,
              }
            : chat
        )
        .sort(
          (a, b) =>
            new Date(
              b.updated_at
            ).getTime() -
            new Date(
              a.updated_at
            ).getTime()
        )
    );
  }

  async function updateChatTitle(
    chatId: string,
    text: string
  ) {
    const chat = chats.find(
      (item) =>
        item.id === chatId
    );

    if (!chat) return;

    if (
      chat.title !==
      "New chat"
    ) {
      return;
    }

    const title =
      text.slice(0, 40) ||
      "Attachment chat";

    await supabase
      .from("kairo_chats")
      .update({
        title,
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", chatId);

    setChats((prev) =>
      prev.map((item) =>
        item.id === chatId
          ? {
              ...item,
              title,
            }
          : item
      )
    );
  }

  // --------------------------------------------------
  // COPY
  // --------------------------------------------------

  async function copyMessage(
    text: string
  ) {
    try {
      await navigator.clipboard.writeText(
        text
      );

      alert("Copied!");
    } catch {
      const textarea =
        document.createElement(
          "textarea"
        );

      textarea.value = text;

      document.body.appendChild(
        textarea
      );

      textarea.select();

      document.execCommand(
        "copy"
      );

      textarea.remove();
    }
  }

  // --------------------------------------------------
  // EDIT
  // --------------------------------------------------

  function editMessage(
    message: Message
  ) {
    setEditingId(message.id);
    setInput(message.content);

    setTimeout(() => {
      document
        .querySelector("textarea")
        ?.focus();
    }, 50);
  }

  function cancelEdit() {
    setEditingId(null);
    setInput("");
  }

  // --------------------------------------------------
  // REGENERATE
  // --------------------------------------------------

  async function regenerate(
    message: Message
  ) {
    if (loading) return;

    if (!activeChat) return;

    const assistantIndex =
      messages.findIndex(
        (item) =>
          item.id === message.id
      );

    if (
      assistantIndex === -1
    ) {
      return;
    }

    const previousMessages =
      messages.slice(
        0,
        assistantIndex
      );

    if (
      previousMessages.length ===
      0
    ) {
      return;
    }

    const lastUser =
      previousMessages[
        previousMessages.length - 1
      ];

    if (
      lastUser.role !== "user"
    ) {
      return;
    }

    setLoading(true);

    setMessages(
      previousMessages
    );

    await supabase
      .from("kairo_messages")
      .delete()
      .eq(
        "chat_id",
        activeChat
      )
      .eq(
        "role",
        "assistant"
      )
      .gt(
        "created_at",
        lastUser.created_at ||
          "1970-01-01"
      );

    try {
      await streamAI(
        activeChat,
        previousMessages,
        lastUser.attachments ||
          []
      );

      await updateChatTime(
        activeChat
      );
    } finally {
      setLoading(false);
    }
  }

  // --------------------------------------------------
  // ENTER KEY
  // --------------------------------------------------

  function handleKeyDown(
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (
      e.key === "Enter" &&
      !e.shiftKey
    ) {
      e.preventDefault();

      if (
        !loading &&
        !uploading &&
        (input.trim() ||
          attachments.length > 0)
      ) {
        sendMessage();
      }
    }
  }

  // --------------------------------------------------
  // SCROLL
  // --------------------------------------------------

  useEffect(() => {
    bottomRef.current?.scrollIntoView(
      {
        behavior: "smooth",
      }
    );
  }, [messages]);

  const activeChats =
    chats.filter(
      (chat) => !chat.archived
    );

  const archivedChats =
    chats.filter(
      (chat) => chat.archived
    );

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <main className="h-screen bg-[#0b0b0f] text-white flex overflow-hidden">
      {/* SIDEBAR */}

      <aside
        className={`${
          sidebar
            ? "w-[280px]"
            : "w-0"
        } transition-all duration-200 bg-[#111116] border-r border-white/10 overflow-hidden flex flex-col shrink-0`}
      >
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="font-bold text-xl whitespace-nowrap">
              🤖 KAIRO
            </div>

            <button
              onClick={() =>
                setSidebar(false)
              }
              className="text-white/50 hover:text-white text-xl"
            >
              ×
            </button>
          </div>

          <button
            onClick={() =>
              createChat()
            }
            disabled={!authReady}
            className="mt-6 w-full rounded-xl bg-white text-black py-3 font-semibold hover:bg-white/90 disabled:opacity-40"
          >
            ＋ New chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3">
          <p className="text-xs text-white/40 px-2 mb-2">
            HISTORY
          </p>

          {activeChats.length ===
            0 && (
            <p className="text-xs text-white/25 px-3 py-3">
              No chats yet
            </p>
          )}

          {activeChats.map(
            (chat) => (
              <div
                key={chat.id}
                className={`group relative mb-1 rounded-xl ${
                  activeChat ===
                  chat.id
                    ? "bg-white/10"
                    : "hover:bg-white/5"
                }`}
              >
                <button
                  onClick={() =>
                    openChat(
                      chat.id
                    )
                  }
                  className="w-full text-left px-3 py-3 pr-10 truncate"
                >
                  {chat.title}
                </button>

                <button
                  onClick={() =>
                    setMenuOpen(
                      menuOpen ===
                        chat.id
                        ? null
                        : chat.id
                    )
                  }
                  className="absolute right-2 top-2 text-white/40 hover:text-white px-1"
                >
                  ⋯
                </button>

                {menuOpen ===
                  chat.id && (
                  <div className="absolute z-30 right-2 top-10 w-40 rounded-xl bg-[#202027] border border-white/10 shadow-xl overflow-hidden">
                    <button
                      onClick={() =>
                        renameChat(
                          chat.id
                        )
                      }
                      className="w-full text-left px-3 py-2 hover:bg-white/10"
                    >
                      ✏️ Rename
                    </button>

                    <button
                      onClick={() =>
                        archiveChat(
                          chat.id
                        )
                      }
                      className="w-full text-left px-3 py-2 hover:bg-white/10"
                    >
                      📦 Archive
                    </button>

                    <button
                      onClick={() =>
                        deleteChat(
                          chat.id
                        )
                      }
                      className="w-full text-left px-3 py-2 text-red-400 hover:bg-white/10"
                    >
                      🗑 Delete
                    </button>
                  </div>
                )}
              </div>
            )
          )}

          <button
            onClick={() =>
              setArchiveOpen(
                !archiveOpen
              )
            }
            className="w-full text-left px-3 py-3 mt-5 rounded-xl hover:bg-white/5 text-white/70"
          >
            📦 Archived chats
          </button>

          {archiveOpen && (
            <div className="mt-1">
              {archivedChats.length ===
              0 ? (
                <p className="text-xs text-white/30 px-3 py-2">
                  No archived chats
                </p>
              ) : (
                archivedChats.map(
                  (chat) => (
                    <div
                      key={chat.id}
                      className="rounded-xl hover:bg-white/5 px-3 py-3"
                    >
                      <div className="truncate text-sm">
                        {chat.title}
                      </div>

                      <div className="flex gap-3 mt-2">
                        <button
                          onClick={() =>
                            restoreChat(
                              chat.id
                            )
                          }
                          className="text-xs text-blue-400"
                        >
                          Restore
                        </button>

                        <button
                          onClick={() =>
                            deleteChat(
                              chat.id
                            )
                          }
                          className="text-xs text-red-400"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )
                )
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-white/10 text-xs text-white/30 whitespace-nowrap">
          KAIRO AI
          <br />
          Your intelligent AI companion
        </div>
      </aside>

      {/* MAIN CHAT */}

      <section className="flex-1 flex flex-col min-w-0">
        {/* HEADER */}

        <header className="h-16 border-b border-white/10 flex items-center px-4 shrink-0">
          {!sidebar && (
            <button
              onClick={() =>
                setSidebar(true)
              }
              className="mr-3 text-xl"
            >
              ☰
            </button>
          )}

          <div>
            <div className="font-semibold">
              KAIRO AI
            </div>

            <div className="text-xs text-white/40">
              Powered by Groq
            </div>
          </div>

          <div className="ml-auto">
            <button
              onClick={() =>
                createChat()
              }
              disabled={!authReady}
              className="px-3 py-2 rounded-lg hover:bg-white/10 disabled:opacity-40"
              title="New chat"
            >
              ＋
            </button>
          </div>
        </header>

        {/* MESSAGES */}

        <div className="flex-1 overflow-y-auto">
          {messages.length ===
          0 ? (
            <div className="h-full flex flex-col items-center justify-center px-5 text-center">
              <div className="text-6xl mb-5">
                🤖
              </div>

             <h1 className="text-4xl md:text-5xl font-bold">
  Hello, I'm KAIRO.
</h1>

<p className="text-white/50 mt-3 max-w-lg">
  Kairo AI is your intelligent AI companion for chatting, learning,
  brainstorming, writing code, analyzing information, and getting things done.
</p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8 max-w-2xl w-full">
                {[
                  "Explain quantum physics simply",
                  "Help me build a website",
                  "Give me a creative idea",
                ].map(
                  (text) => (
                    <button
                      key={text}
                      onClick={() =>
                        setInput(text)
                      }
                      className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm text-left"
                    >
                      {text}
                    </button>
                  )
                )}
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto px-4 py-8">
              {messages.map(
                (message) => (
                  <div
                    key={
                      message.id
                    }
                    className={`flex mb-7 ${
                      message.role ===
                      "user"
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] ${
                        message.role ===
                        "user"
                          ? "bg-[#25252d] rounded-3xl px-5 py-3"
                          : "w-full"
                      }`}
                    >
                      <div className="whitespace-pre-wrap leading-7">
                        {message.content ||
                          (loading &&
                          message.role ===
                            "assistant"
                            ? "Thinking..."
                            : "")}
                      </div>

                      {message.attachments &&
                        message
                          .attachments
                          .length >
                          0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {message.attachments.map(
                              (
                                file,
                                index
                              ) => (
                                <div
                                  key={`${file.name}-${index}`}
                                  className="text-xs bg-black/30 rounded-lg px-3 py-2"
                                >
                                  📎{" "}
                                  {
                                    file.name
                                  }
                                </div>
                              )
                            )}
                          </div>
                        )}

                      {message.role ===
                        "assistant" &&
                        message.content &&
                        !message.content.startsWith(
                          "⚠️"
                        ) && (
                          <div className="flex gap-3 mt-3">
                            <button
                              onClick={() =>
                                copyMessage(
                                  message.content
                                )
                              }
                              className="text-xs text-white/40 hover:text-white"
                            >
                              📋 Copy
                            </button>

                            <button
                              onClick={() =>
                                regenerate(
                                  message
                                )
                              }
                              disabled={
                                loading
                              }
                              className="text-xs text-white/40 hover:text-white disabled:opacity-30"
                            >
                              🔄 Regenerate
                            </button>
                          </div>
                        )}

                      {message.role ===
                        "user" && (
                        <button
                          onClick={() =>
                            editMessage(
                              message
                            )
                          }
                          className="text-xs text-white/40 hover:text-white mt-2"
                        >
                          ✏️ Edit
                        </button>
                      )}
                    </div>
                  </div>
                )
              )}

              <div
                ref={bottomRef}
              />
            </div>
          )}
        </div>

        {/* COMPOSER */}

        <div className="p-3 md:p-5 shrink-0">
          <div className="max-w-4xl mx-auto">
            {/* EDITING BAR */}

            {editingId && (
              <div className="mb-2 flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-4 py-2">
                <span className="text-xs text-white/60">
                  ✏️ Editing
                  message
                </span>

                <button
                  onClick={
                    cancelEdit
                  }
                  className="text-xs text-white/50 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* ATTACHMENTS */}

            {attachments.length >
              0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {attachments.map(
                  (
                    file,
                    index
                  ) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="bg-white/10 rounded-xl px-3 py-2 text-xs flex items-center gap-2"
                    >
                      📎{" "}
                      {
                        file.name
                      }

                      <button
                        onClick={() =>
                          removeAttachment(
                            index
                          )
                        }
                        className="text-white/50 hover:text-white"
                      >
                        ×
                      </button>
                    </div>
                  )
                )}
              </div>
            )}

            <div className="rounded-3xl border border-white/10 bg-[#15151b] p-2 shadow-2xl">
              <div className="flex items-end gap-2">
                {/* FILE */}

                <button
                  onClick={() =>
                    fileInput.current?.click()
                  }
                  disabled={
                    uploading ||
                    loading
                  }
                  className="w-11 h-11 shrink-0 rounded-full hover:bg-white/10 text-xl disabled:opacity-30"
                  title="Attach files"
                >
                  ＋
                </button>

                {/* FOLDER */}

                <button
                  onClick={() =>
                    folderInput.current?.click()
                  }
                  disabled={
                    uploading ||
                    loading
                  }
                  className="w-11 h-11 shrink-0 rounded-full hover:bg-white/10 text-lg disabled:opacity-30"
                  title="Attach folder"
                >
                  📁
                </button>

                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  accept="image/*,video/*,.pdf,.txt,.csv,.json,.doc,.docx,.xls,.xlsx,.zip"
                  hidden
                  onChange={(e) =>
                    uploadFiles(
                      e.target
                        .files
                    )
                  }
                />

                <input
                  ref={folderInput}
                  type="file"
                  multiple
                  hidden
                  {...({
                    webkitdirectory:
                      "",
                    directory:
                      "",
                  } as any)}
                  onChange={(e) =>
                    uploadFiles(
                      e.target
                        .files
                    )
                  }
                />

                {/* TEXT */}

                <textarea
                  value={input}
                  onChange={(e) =>
                    setInput(
                      e.target.value
                    )
                  }
                  onKeyDown={
                    handleKeyDown
                  }
                  placeholder={
                    uploading
                      ? "Uploading files..."
                      : editingId
                      ? "Edit your message..."
                      : "Message KAIRO..."
                  }
                  disabled={
                    uploading
                  }
                  rows={1}
                  className="flex-1 min-w-0 resize-none bg-transparent outline-none px-2 py-3 max-h-40"
                />

                {/* SEND */}

                <button
                  onClick={() =>
                    sendMessage()
                  }
                  disabled={
                    loading ||
                    uploading ||
                    (!input.trim() &&
                      attachments.length ===
                        0)
                  }
                  className="w-11 h-11 shrink-0 rounded-full bg-white text-black disabled:opacity-30 font-bold hover:bg-white/90"
                  title="Send message"
                >
                  {loading
                    ? "..."
                    : "➤"}
                </button>
              </div>
            </div>

            <p className="text-center text-[11px] text-white/25 mt-2">
              KAIRO can make
              mistakes. Check
              important
              information.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}