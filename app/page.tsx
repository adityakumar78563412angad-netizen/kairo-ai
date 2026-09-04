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

  // --------------------------------------------------
  // THEME
  // --------------------------------------------------

  const [lightMode, setLightMode] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("kairo-theme");

    if (savedTheme === "light") {
      setLightMode(true);
    }
  }, []);

  function toggleTheme() {
    setLightMode((prev) => {
      const next = !prev;

      localStorage.setItem(
        "kairo-theme",
        next ? "light" : "dark"
      );

      return next;
    });
  }

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

      const anonymous =
        await supabase.auth.signInAnonymously();

      if (anonymous.error) {
        console.error(
          "Anonymous auth error:",
          anonymous.error
        );

        alert(
          "KAIRO couldn't connect to Supabase.\n\n" +
            anonymous.error.message +
            "\n\nEnable Anonymous Sign-Ins in Supabase."
        );

        setAuthReady(true);
        return;
      }

      const newUser =
        await supabase.auth.getUser();

      if (newUser.data.user) {
        setUser(newUser.data.user);

        await loadChats(
          newUser.data.user.id
        );
      }
    } catch (error) {
      console.error("Auth error:", error);
    } finally {
      setAuthReady(true);
    }
  }

  async function ensureUser() {
    if (user) return user;

    const current =
      await supabase.auth.getUser();

    if (current.data.user) {
      setUser(current.data.user);
      return current.data.user;
    }

    const anonymous =
      await supabase.auth.signInAnonymously();

    if (anonymous.error) {
      alert(
        "Supabase login failed:\n\n" +
          anonymous.error.message
      );

      return null;
    }

    const again =
      await supabase.auth.getUser();

    if (!again.data.user) {
      alert(
        "KAIRO could not create a user session."
      );

      return null;
    }

    setUser(again.data.user);

    await loadChats(
      again.data.user.id
    );

    return again.data.user;
  }

  // --------------------------------------------------
  // CHATS
  // --------------------------------------------------

  async function loadChats(userId: string) {
    const { data, error } =
      await supabase
        .from("kairo_chats")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", {
          ascending: false,
        });

    if (error) {
      console.error(
        "Load chats:",
        error
      );

      return;
    }

    setChats(data || []);
  }

  async function createChat() {
    const currentUser =
      await ensureUser();

    if (!currentUser) return null;

    const { data, error } =
      await supabase
        .from("kairo_chats")
        .insert({
          user_id: currentUser.id,
          title: "New chat",
          archived: false,
        })
        .select()
        .single();

    if (error) {
      console.error(
        "Create chat:",
        error
      );

      alert(
        "Couldn't create chat:\n\n" +
          error.message
      );

      return null;
    }

    setChats((prev) => [
      data,
      ...prev.filter(
        (chat) =>
          chat.id !== data.id
      ),
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

    const { data, error } =
      await supabase
        .from("kairo_messages")
        .select("*")
        .eq("chat_id", id)
        .order("created_at", {
          ascending: true,
        });

    if (error) {
      console.error(
        "Open chat:",
        error
      );

      alert(
        "Couldn't open this chat:\n\n" +
          error.message
      );

      return;
    }

    setMessages(data || []);
  }

  async function renameChat(id: string) {
    const chat = chats.find(
      (item) => item.id === id
    );

    if (!chat) return;

    const name = window.prompt(
      "Enter new chat name:",
      chat.title
    );

    if (!name || !name.trim()) return;

    const cleanName = name.trim();

    const { error } =
      await supabase
        .from("kairo_chats")
        .update({
          title: cleanName,
          updated_at:
            new Date().toISOString(),
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
              updated_at:
                new Date().toISOString(),
            }
          : chat
      )
    );

    setMenuOpen(null);
  }

  async function archiveChat(id: string) {
    const { error } =
      await supabase
        .from("kairo_chats")
        .update({
          archived: true,
          updated_at:
            new Date().toISOString(),
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
    const { error } =
      await supabase
        .from("kairo_chats")
        .update({
          archived: false,
          updated_at:
            new Date().toISOString(),
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
    const confirmed =
      window.confirm(
        "Delete this chat permanently?"
      );

    if (!confirmed) return;

    const { error } =
      await supabase
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
      prev.filter(
        (chat) =>
          chat.id !== id
      )
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

  async function uploadFiles(
    files: FileList | null
  ) {
    if (!files || files.length === 0)
      return;

    const currentUser =
      await ensureUser();

    if (!currentUser) return;

    setUploading(true);

    const uploaded: Attachment[] =
      [];

    try {
      for (const file of Array.from(
        files
      )) {
        const safeName =
          file.name.replace(
            /[^a-zA-Z0-9._-]/g,
            "_"
          );

        const path =
          currentUser.id +
          "/" +
          crypto.randomUUID() +
          "-" +
          safeName;

        const { error } =
          await supabase.storage
            .from("kairo-files")
            .upload(
              path,
              file
            );

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

        const { data } =
          supabase.storage
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

  function removeAttachment(
    index: number
  ) {
    setAttachments((prev) =>
      prev.filter(
        (_, i) => i !== index
      )
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
    const assistantId =
      crypto.randomUUID();

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
      const response =
        await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            messages:
              history.map(
                (message) => ({
                  role: message.role,
                  content:
                    message.content,
                })
              ),
            attachments:
              currentAttachments,
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

        throw new Error(
          errorMessage
        );
      }

      if (!response.body) {
        throw new Error(
          "KAIRO returned an empty response."
        );
      }

      const reader =
        response.body.getReader();

      const decoder =
        new TextDecoder();

      let buffer = "";

      while (true) {
        const {
          value,
          done,
        } = await reader.read();

        if (done) break;

        buffer += decoder.decode(
          value,
          {
            stream: true,
          }
        );

        const lines =
          buffer.split("\n");

        buffer =
          lines.pop() || "";

        for (const line of lines) {
          const trimmed =
            line.trim();

          if (
            !trimmed.startsWith(
              "data:"
            )
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

              setMessages(
                (prev) =>
                  prev.map(
                    (message) =>
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

      const {
        error: saveError,
      } = await supabase
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
          message.id ===
          assistantId
            ? {
                ...message,
                content:
                  "⚠️ " +
                  errorText,
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
    if (loading || uploading)
      return;

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
      // EDIT MODE

      if (editingId) {
        const editedIndex =
          messages.findIndex(
            (message) =>
              message.id ===
              editingId
          );

        if (editedIndex !== -1) {
          const editedMessage =
            messages[
              editedIndex
            ];

          const newUserMessage:
            Message = {
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

          setMessages(
            newMessages
          );

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
            .eq(
              "chat_id",
              chatId
            )
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

      // NORMAL MESSAGE

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

      const userMessage:
        Message = {
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

      const {
        error: saveError,
      } = await supabase
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
    <>
      <style jsx global>{`
        .kairo-light {
          filter: invert(1) hue-rotate(180deg);
        }

        .kairo-light input,
        .kairo-light textarea,
        .kairo-light button,
        .kairo-light [role="button"] {
          filter: invert(1) hue-rotate(180deg);
        }

        .kairo-light input[type="file"] {
          filter: none;
        }

        .kairo-theme-toggle {
          position: relative;
          overflow: hidden;
        }

        .kairo-theme-icon {
          transition:
            transform 0.35s ease,
            opacity 0.25s ease;
        }

        .kairo-theme-toggle:hover .kairo-theme-icon {
          transform: rotate(25deg) scale(1.08);
        }
      `}</style>

      <main
        className={`h-screen ${
          lightMode
            ? "kairo-light"
            : ""
        } bg-[#08090d] text-white flex overflow-hidden`}
      >
        {/* SIDEBAR */}

        <aside
          className={`${
            sidebar
              ? "w-[285px]"
              : "w-0"
          } transition-all duration-300 bg-[#0d0f14] border-r border-white/[0.07] overflow-hidden flex flex-col shrink-0`}
        >
          <div className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 whitespace-nowrap">
                <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-violet-400 via-fuchsia-500 to-blue-500 flex items-center justify-center shadow-lg shadow-violet-500/10">
                  <div className="absolute inset-[1px] rounded-[10px] bg-[#0d0f14]/30" />

                  <div className="relative w-3 h-3 rounded-full bg-white shadow-[0_0_16px_rgba(255,255,255,0.9)]" />
                </div>

                <span className="text-[19px] font-semibold tracking-[-0.03em]">
                  KAIRO
                </span>
              </div>

              <button
                onClick={() =>
                  setSidebar(false)
                }
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/35 hover:text-white hover:bg-white/[0.06] transition"
                title="Close sidebar"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <button
              onClick={() =>
                createChat()
              }
              disabled={!authReady}
              className="mt-7 w-full h-11 rounded-xl bg-white text-black font-medium text-sm hover:bg-white/90 transition disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>

              <span>New chat</span>
            </button>
          </div>

          {/* HISTORY */}

          <div className="flex-1 overflow-y-auto px-3">
            <div className="flex items-center justify-between px-3 mb-2">
              <p className="text-[10px] font-semibold tracking-[0.18em] text-white/30">
                RECENT CHATS
              </p>

              {activeChats.length >
                0 && (
                <span className="text-[10px] text-white/20">
                  {
                    activeChats.length
                  }
                </span>
              )}
            </div>

            {activeChats.length ===
              0 && (
              <div className="mx-2 mt-3 rounded-xl border border-dashed border-white/[0.07] p-4">
                <p className="text-xs text-white/25 text-center">
                  Your conversations will appear here.
                </p>
              </div>
            )}

            {activeChats.map(
              (chat) => (
                <div
                  key={chat.id}
                  className={`group relative mb-1 rounded-xl border ${
                    activeChat ===
                    chat.id
                      ? "bg-white/[0.065] border-white/[0.08]"
                      : "border-transparent hover:bg-white/[0.035] hover:border-white/[0.05]"
                  } transition`}
                >
                  <button
                    onClick={() =>
                      openChat(
                        chat.id
                      )
                    }
                    className="w-full text-left px-3.5 py-3 pr-11 truncate text-[13px] text-white/70 hover:text-white transition"
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
                    className="absolute right-2 top-2 w-7 h-7 rounded-lg flex items-center justify-center text-white/25 hover:text-white hover:bg-white/[0.08] transition"
                    title="Chat options"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <circle
                        cx="5"
                        cy="12"
                        r="1.5"
                      />
                      <circle
                        cx="12"
                        cy="12"
                        r="1.5"
                      />
                      <circle
                        cx="19"
                        cy="12"
                        r="1.5"
                      />
                    </svg>
                  </button>

                  {menuOpen ===
                    chat.id && (
                    <div className="absolute z-30 right-2 top-11 w-44 rounded-xl bg-[#171a21] border border-white/[0.09] shadow-2xl shadow-black/40 overflow-hidden p-1">
                      <button
                        onClick={() =>
                          renameChat(
                            chat.id
                          )
                        }
                        className="w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-lg text-sm text-white/65 hover:text-white hover:bg-white/[0.07] transition"
                      >
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                        >
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
                        </svg>
                        Rename
                      </button>

                      <button
                        onClick={() =>
                          archiveChat(
                            chat.id
                          )
                        }
                        className="w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-lg text-sm text-white/65 hover:text-white hover:bg-white/[0.07] transition"
                      >
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                        >
                          <path d="M4 7h16" />
                          <path d="M6 7v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7" />
                          <path d="M9 11h6" />
                          <path d="M8 4h8l1 3H7l1-3Z" />
                        </svg>
                        Archive
                      </button>

                      <button
                        onClick={() =>
                          deleteChat(
                            chat.id
                          )
                        }
                        className="w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-red-500/[0.08] transition"
                      >
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                        >
                          <path d="M3 6h18" />
                          <path d="M8 6V4h8v2" />
                          <path d="M19 6l-1 14H6L5 6" />
                          <path d="M10 11v5" />
                          <path d="M14 11v5" />
                        </svg>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )
            )}

            {/* ARCHIVED */}

            <button
              onClick={() =>
                setArchiveOpen(
                  !archiveOpen
                )
              }
              className="w-full flex items-center justify-between text-left px-3 py-3 mt-5 rounded-xl hover:bg-white/[0.04] text-white/45 hover:text-white/75 transition"
            >
              <span className="flex items-center gap-3 text-[13px]">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                >
                  <path d="M4 7h16" />
                  <path d="M6 7v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7" />
                  <path d="M9 11h6" />
                  <path d="M8 4h8l1 3H7l1-3Z" />
                </svg>

                Archived chats
              </span>

              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className={`transition-transform ${
                  archiveOpen
                    ? "rotate-180"
                    : ""
                }`}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {archiveOpen && (
              <div className="mt-1">
                {archivedChats.length ===
                0 ? (
                  <p className="text-xs text-white/25 px-3 py-3">
                    No archived chats
                  </p>
                ) : (
                  archivedChats.map(
                    (chat) => (
                      <div
                        key={chat.id}
                        className="rounded-xl hover:bg-white/[0.035] px-3 py-3 transition"
                      >
                        <div className="truncate text-sm text-white/60">
                          {
                            chat.title
                          }
                        </div>

                        <div className="flex gap-4 mt-2.5">
                          <button
                            onClick={() =>
                              restoreChat(
                                chat.id
                              )
                            }
                            className="text-xs text-blue-400 hover:text-blue-300 transition"
                          >
                            Restore
                          </button>

                          <button
                            onClick={() =>
                              deleteChat(
                                chat.id
                              )
                            }
                            className="text-xs text-red-400 hover:text-red-300 transition"
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

          {/* SIDEBAR FOOTER */}

          <div className="p-4 border-t border-white/[0.07]">
            <div className="rounded-xl bg-white/[0.025] border border-white/[0.05] p-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-white/[0.07] flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-violet-400 shadow-[0_0_10px_rgba(167,139,250,0.8)]" />
                </div>

                <div>
                  <p className="text-xs font-medium text-white/65">
                    KAIRO AI
                  </p>

                  <p className="text-[10px] text-white/25">
                    Intelligent AI companion
                  </p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN CHAT */}

        <section className="flex-1 flex flex-col min-w-0 bg-[#08090d]">
          {/* HEADER */}

          <header className="h-16 border-b border-white/[0.07] flex items-center px-4 md:px-6 shrink-0 bg-[#08090d]/90 backdrop-blur-xl">
            {!sidebar && (
              <button
                onClick={() =>
                  setSidebar(true)
                }
                className="mr-3 w-9 h-9 rounded-xl flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.06] transition"
                title="Open sidebar"
              >
                <svg
                  width="19"
                  height="19"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M4 6h16" />
                  <path d="M4 12h16" />
                  <path d="M4 18h16" />
                </svg>
              </button>
            )}

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-400 via-fuchsia-500 to-blue-500 flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.9)]" />
              </div>

              <div>
                <div className="font-semibold tracking-tight text-sm">
                  KAIRO AI
                </div>

                <div className="flex items-center gap-1.5 text-[10px] text-white/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_7px_rgba(52,211,153,0.7)]" />
                  Powered by Groq
                </div>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
              {/* THEME TOGGLE */}

              <button
                onClick={toggleTheme}
                className="kairo-theme-toggle w-9 h-9 rounded-xl border border-white/[0.08] hover:bg-white/[0.06] flex items-center justify-center text-white/55 hover:text-white transition"
                title={
                  lightMode
                    ? "Switch to dark mode"
                    : "Switch to light mode"
                }
                aria-label={
                  lightMode
                    ? "Switch to dark mode"
                    : "Switch to light mode"
                }
              >
                {lightMode ? (
                  <svg
                    className="kairo-theme-icon"
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  >
                    <path d="M12 3v2" />
                    <path d="M12 19v2" />
                    <path d="m4.22 4.22 1.42 1.42" />
                    <path d="m18.36 18.36 1.42 1.42" />
                    <path d="M3 12h2" />
                    <path d="M19 12h2" />
                    <path d="m4.22 19.78 1.42-1.42" />
                    <path d="m18.36 5.64 1.42-1.42" />
                    <circle
                      cx="12"
                      cy="12"
                      r="4"
                    />
                  </svg>
                ) : (
                  <svg
                    className="kairo-theme-icon"
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.6 6.6 0 0 0 21 12.8Z" />
                  </svg>
                )}
              </button>

              {/* NEW CHAT */}

              <button
                onClick={() =>
                  createChat()
                }
                disabled={!authReady}
                className="w-9 h-9 rounded-xl border border-white/[0.08] hover:bg-white/[0.06] flex items-center justify-center text-white/55 hover:text-white transition disabled:opacity-40"
                title="New chat"
              >
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>
              </button>
            </div>
          </header>

          {/* MESSAGES */}

          <div className="flex-1 overflow-y-auto">
            {messages.length ===
            0 ? (
              <div className="min-h-full flex flex-col items-center justify-center px-5 text-center pb-8">
                {/* AI VISUAL */}

                <div className="relative mb-8">
                  <div className="absolute -inset-10 rounded-full bg-violet-500/[0.08] blur-3xl" />

                  <div className="absolute -inset-5 rounded-full border border-violet-400/[0.08] animate-pulse" />

                  <div className="relative w-28 h-28 rounded-[32px] border border-white/[0.1] bg-gradient-to-br from-white/[0.09] to-white/[0.025] backdrop-blur-xl shadow-2xl flex items-center justify-center overflow-hidden">
                    <div className="absolute -top-8 -right-8 w-20 h-20 rounded-full bg-blue-500/20 blur-2xl" />

                    <div className="absolute -bottom-8 -left-8 w-20 h-20 rounded-full bg-fuchsia-500/20 blur-2xl" />

                    <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-violet-400 via-fuchsia-500 to-blue-500 p-[1px] shadow-[0_0_35px_rgba(139,92,246,0.3)]">
                      <div className="w-full h-full rounded-full bg-[#0b0c11] flex items-center justify-center">
                        <div className="relative w-7 h-7 rounded-full bg-white">
                          <div className="absolute inset-0 rounded-full bg-white blur-md opacity-60" />

                          <div className="absolute inset-[5px] rounded-full bg-gradient-to-br from-violet-400 to-blue-500" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* HERO */}

                <div className="max-w-2xl">
                  <h1 className="text-4xl md:text-6xl font-semibold tracking-[-0.055em] leading-[1.05]">
                    Hello, I&apos;m{" "}
                    <span className="bg-gradient-to-r from-white via-white to-white/55 bg-clip-text text-transparent">
                      KAIRO
                    </span>
                    <span className="text-violet-400">
                      .
                    </span>
                  </h1>

                  <p className="text-white/40 mt-5 max-w-xl mx-auto text-sm md:text-base leading-7">
                    Your intelligent AI companion for thinking,
                    creating, learning, coding, and getting things
                    done.
                  </p>
                </div>

                {/* SUGGESTIONS */}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-10 max-w-3xl w-full">
                  {[
                    {
                      label: "LEARN",
                      title:
                        "Explain quantum physics simply",
                    },
                    {
                      label: "BUILD",
                      title:
                        "Help me build a website",
                    },
                    {
                      label: "CREATE",
                      title:
                        "Give me a creative idea",
                    },
                  ].map((item) => (
                    <button
                      key={item.title}
                      onClick={() =>
                        setInput(
                          item.title
                        )
                      }
                      className="group text-left rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4.5 transition-all duration-200 hover:bg-white/[0.055] hover:border-white/[0.14] hover:-translate-y-0.5"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[9px] font-semibold tracking-[0.2em] text-white/25 group-hover:text-violet-300/60 transition">
                          {
                            item.label
                          }
                        </span>

                        <span className="w-6 h-6 rounded-full border border-white/[0.07] flex items-center justify-center text-white/20 group-hover:text-white/70 group-hover:border-white/15 transition">
                          <svg
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                          >
                            <path d="M5 12h14" />
                            <path d="m13 6 6 6-6 6" />
                          </svg>
                        </span>
                      </div>

                      <p className="text-sm text-white/60 group-hover:text-white/85 leading-6 transition">
                        {
                          item.title
                        }
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="max-w-4xl mx-auto px-4 py-8 md:py-10">
                {messages.map(
                  (message) => (
                    <div
                      key={message.id}
                      className={`flex mb-8 ${
                        message.role ===
                        "user"
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      <div
                        className={`${
                          message.role ===
                          "user"
                            ? "max-w-[85%] bg-[#1b1e26] border border-white/[0.06] rounded-[22px] px-5 py-3.5"
                            : "w-full"
                        }`}
                      >
                        {message.role ===
                          "assistant" && (
                          <div className="flex items-start gap-3">
                            <div className="shrink-0 mt-1 w-7 h-7 rounded-lg bg-gradient-to-br from-violet-400 via-fuchsia-500 to-blue-500 flex items-center justify-center">
                              <div className="w-2 h-2 rounded-full bg-white" />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="whitespace-pre-wrap leading-7 text-[14px] md:text-[15px] text-white/85">
                                {message.content ||
                                  (loading
                                    ? "Thinking..."
                                    : "")}
                              </div>

                              {message.attachments &&
                                message.attachments.length >
                                  0 && (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {message.attachments.map(
                                      (
                                        file,
                                        index
                                      ) => (
                                        <div
                                          key={`${file.name}-${index}`}
                                          className="text-xs bg-white/[0.05] border border-white/[0.06] rounded-lg px-3 py-2 text-white/50 flex items-center gap-2"
                                        >
                                          <svg
                                            width="13"
                                            height="13"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1.7"
                                          >
                                            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                                          </svg>

                                          {
                                            file.name
                                          }
                                        </div>
                                      )
                                    )}
                                  </div>
                                )}

                              {message.content &&
                                !message.content.startsWith(
                                  "⚠️"
                                ) && (
                                  <div className="flex gap-1.5 mt-4">
                                    <button
                                      onClick={() =>
                                        copyMessage(
                                          message.content
                                        )
                                      }
                                      className="h-8 px-2.5 rounded-lg text-[11px] text-white/30 hover:text-white/75 hover:bg-white/[0.05] transition flex items-center gap-2"
                                    >
                                      <svg
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.7"
                                      >
                                        <rect
                                          x="9"
                                          y="9"
                                          width="11"
                                          height="11"
                                          rx="2"
                                        />
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                      </svg>
                                      Copy
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
                                      className="h-8 px-2.5 rounded-lg text-[11px] text-white/30 hover:text-white/75 hover:bg-white/[0.05] transition disabled:opacity-30 flex items-center gap-2"
                                    >
                                      <svg
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.7"
                                      >
                                        <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4" />
                                        <path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4" />
                                      </svg>
                                      Regenerate
                                    </button>
                                  </div>
                                )}
                            </div>
                          </div>
                        )}

                        {message.role ===
                          "user" && (
                          <>
                            <div className="whitespace-pre-wrap leading-7 text-[14px] md:text-[15px] text-white/90">
                              {
                                message.content
                              }
                            </div>

                            {message.attachments &&
                              message.attachments.length >
                                0 && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {message.attachments.map(
                                    (
                                      file,
                                      index
                                    ) => (
                                      <div
                                        key={`${file.name}-${index}`}
                                        className="text-xs bg-black/20 border border-white/[0.05] rounded-lg px-3 py-2 text-white/50 flex items-center gap-2"
                                      >
                                        <svg
                                          width="13"
                                          height="13"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="1.7"
                                        >
                                          <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                                        </svg>

                                        {
                                          file.name
                                        }
                                      </div>
                                    )
                                  )}
                                </div>
                              )}

                            <button
                              onClick={() =>
                                editMessage(
                                  message
                                )
                              }
                              className="mt-2 h-7 px-2 rounded-lg text-[11px] text-white/25 hover:text-white/65 hover:bg-white/[0.05] transition flex items-center gap-1.5"
                            >
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                              >
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
                              </svg>
                              Edit
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                )}

                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* COMPOSER */}

          <div className="p-3 md:p-5 shrink-0 bg-gradient-to-t from-[#08090d] via-[#08090d] to-transparent">
            <div className="max-w-4xl mx-auto">
              {/* EDITING BAR */}

              {editingId && (
                <div className="mb-2.5 flex items-center justify-between rounded-xl bg-violet-500/[0.07] border border-violet-400/[0.12] px-4 py-2.5">
                  <span className="text-xs text-violet-200/60 flex items-center gap-2">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
                    </svg>
                    Editing message
                  </span>

                  <button
                    onClick={
                      cancelEdit
                    }
                    className="text-xs text-white/35 hover:text-white transition"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* ATTACHMENTS */}

              {attachments.length >
                0 && (
                <div className="flex flex-wrap gap-2 mb-2.5">
                  {attachments.map(
                    (
                      file,
                      index
                    ) => (
                      <div
                        key={`${file.name}-${index}`}
                        className="bg-[#151820] border border-white/[0.08] rounded-xl px-3 py-2 text-xs flex items-center gap-2 text-white/55"
                      >
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                        >
                          <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                        </svg>

                        <span className="max-w-[180px] truncate">
                          {
                            file.name
                          }
                        </span>

                        <button
                          onClick={() =>
                            removeAttachment(
                              index
                            )
                          }
                          className="w-5 h-5 rounded-md flex items-center justify-center text-white/30 hover:text-white hover:bg-white/[0.07] transition"
                        >
                          <svg
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M18 6 6 18" />
                            <path d="m6 6 12 12" />
                          </svg>
                        </button>
                      </div>
                    )
                  )}
                </div>
              )}

              {/* COMPOSER BOX */}

              <div className="rounded-[24px] border border-white/[0.09] bg-[#11141a] p-2 shadow-2xl shadow-black/20 focus-within:border-white/[0.15] transition">
                <div className="flex items-end gap-1.5">
                  {/* FILE */}

                  <button
                    onClick={() =>
                      fileInput.current?.click()
                    }
                    disabled={
                      uploading ||
                      loading
                    }
                    className="w-10 h-10 shrink-0 rounded-xl hover:bg-white/[0.06] text-white/35 hover:text-white/80 transition disabled:opacity-30 flex items-center justify-center"
                    title="Attach files"
                  >
                    <svg
                      width="19"
                      height="19"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                    >
                      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
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
                    className="w-10 h-10 shrink-0 rounded-xl hover:bg-white/[0.06] text-white/35 hover:text-white/80 transition disabled:opacity-30 flex items-center justify-center"
                    title="Attach folder"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                    >
                      <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
                    </svg>
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
                    className="flex-1 min-w-0 resize-none bg-transparent outline-none px-2.5 py-2.5 max-h-40 text-sm text-white placeholder:text-white/25 leading-6"
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
                    className="w-10 h-10 shrink-0 rounded-xl bg-white text-black disabled:opacity-20 font-bold hover:bg-white/90 transition flex items-center justify-center"
                    title="Send message"
                  >
                    {loading ? (
                      <span className="w-4 h-4 rounded-full border-2 border-black/20 border-t-black animate-spin" />
                    ) : (
                      <svg
                        width="17"
                        height="17"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M22 2 11 13" />
                        <path d="m22 2-7 20-4-9-9-4Z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <p className="text-center text-[10px] text-white/20 mt-2.5">
                KAIRO can make mistakes. Check important information.
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}