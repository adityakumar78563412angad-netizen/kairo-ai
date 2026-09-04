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

  const [lightMode, setLightMode] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // ============================================================
  // THEME
  // ============================================================

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

  // ============================================================
  // AUTH
  // ============================================================

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

  // ============================================================
  // CHATS
  // ============================================================

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

  // ============================================================
  // FILES
  // ============================================================

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

  // ============================================================
  // STREAMING
  // ============================================================

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

  // ============================================================
  // SEND
  // ============================================================

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

  // ============================================================
  // CHAT UPDATE
  // ============================================================

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

  // ============================================================
  // ACTIONS
  // ============================================================

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  const activeChats =
    chats.filter(
      (chat) => !chat.archived
    );

  const archivedChats =
    chats.filter(
      (chat) => chat.archived
    );

  // ============================================================
  // UI
  // ============================================================

  return (
    <>
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          padding: 0;
          overflow: hidden;
        }

        .kairo-app {
          --bg: #07090f;
          --surface: rgba(15, 18, 27, 0.78);
          --surface-solid: #10131c;
          --surface-soft: rgba(255, 255, 255, 0.035);
          --border: rgba(255, 255, 255, 0.08);
          --border-soft: rgba(255, 255, 255, 0.055);
          --text: #f8fafc;
          --muted: #8d95a8;
          --muted-2: #626b7e;
          --accent: #8b5cf6;
          --accent-2: #6366f1;
          --input: #0d1017;
          --shadow: rgba(0, 0, 0, 0.38);

          background:
            radial-gradient(
              circle at 70% -20%,
              rgba(124, 58, 237, 0.11),
              transparent 35%
            ),
            radial-gradient(
              circle at 15% 80%,
              rgba(59, 130, 246, 0.055),
              transparent 30%
            ),
            var(--bg);

          color: var(--text);
          transition:
            background 0.3s ease,
            color 0.3s ease;
        }

        .kairo-app.light {
          --bg: #f5f7fb;
          --surface: rgba(255, 255, 255, 0.88);
          --surface-solid: #ffffff;
          --surface-soft: #f6f7fa;
          --border: #e4e7ee;
          --border-soft: #edf0f4;
          --text: #171a24;
          --muted: #687083;
          --muted-2: #9299a8;
          --accent: #7c3aed;
          --accent-2: #4f46e5;
          --input: #ffffff;
          --shadow: rgba(35, 43, 60, 0.08);

          background:
            radial-gradient(
              circle at 75% -15%,
              rgba(124, 58, 237, 0.075),
              transparent 34%
            ),
            radial-gradient(
              circle at 10% 80%,
              rgba(59, 130, 246, 0.045),
              transparent 30%
            ),
            #f5f7fb;
        }

        .kairo-sidebar {
          width: 292px;
          background: var(--surface);
          border-right: 1px solid var(--border);
          backdrop-filter: blur(30px);
          transition:
            width 0.3s ease,
            background 0.3s ease;
        }

        .kairo-sidebar.closed {
          width: 0;
        }

        .kairo-brand-mark {
          width: 38px;
          height: 38px;
          border-radius: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          background:
            linear-gradient(
              135deg,
              #8b5cf6,
              #d946ef 48%,
              #3b82f6
            );
          box-shadow:
            0 10px 30px rgba(124, 58, 237, 0.22);
        }

        .kairo-brand-core {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: white;
          box-shadow:
            0 0 18px rgba(255, 255, 255, 0.9);
        }

        .kairo-new-chat {
          border: 1px solid var(--border);
          background:
            linear-gradient(
              135deg,
              rgba(124, 58, 237, 0.13),
              rgba(99, 102, 241, 0.07)
            );
          color: var(--text);
          box-shadow:
            0 10px 30px var(--shadow);
        }

        .kairo-new-chat:hover {
          border-color: rgba(124, 58, 237, 0.28);
          transform: translateY(-1px);
        }

        .kairo-chat-item {
          border: 1px solid transparent;
          color: var(--muted);
          background: transparent;
        }

        .kairo-chat-item:hover {
          background: var(--surface-soft);
          color: var(--text);
          border-color: var(--border-soft);
        }

        .kairo-chat-item.active {
          background:
            linear-gradient(
              135deg,
              rgba(124, 58, 237, 0.13),
              rgba(99, 102, 241, 0.055)
            );
          border-color: rgba(124, 58, 237, 0.17);
          color: var(--text);
        }

        .kairo-menu {
          background: var(--surface-solid);
          border: 1px solid var(--border);
          box-shadow:
            0 24px 70px var(--shadow);
          backdrop-filter: blur(25px);
        }

        .kairo-menu button:hover {
          background: var(--surface-soft);
        }

        .kairo-sidebar-footer {
          background: var(--surface-soft);
          border: 1px solid var(--border-soft);
        }

        .kairo-main {
          background: transparent;
        }

        .kairo-header {
          height: 68px;
          background: rgba(7, 9, 15, 0.52);
          border-bottom: 1px solid var(--border);
          backdrop-filter: blur(28px);
        }

        .light .kairo-header {
          background: rgba(255, 255, 255, 0.7);
        }

        .kairo-header-button {
          border: 1px solid var(--border);
          background: var(--surface-soft);
          color: var(--muted);
        }

        .kairo-header-button:hover {
          color: var(--text);
          background: var(--surface);
          border-color: var(--border);
        }

        .kairo-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #34d399;
          box-shadow:
            0 0 10px rgba(52, 211, 153, 0.8);
        }

        .kairo-hero-orb {
          width: 122px;
          height: 122px;
          border-radius: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          background:
            linear-gradient(
              145deg,
              rgba(255, 255, 255, 0.075),
              rgba(255, 255, 255, 0.018)
            );
          border: 1px solid var(--border);
          box-shadow:
            0 30px 90px rgba(0, 0, 0, 0.18);
          backdrop-filter: blur(25px);
        }

        .light .kairo-hero-orb {
          background:
            linear-gradient(
              145deg,
              #ffffff,
              #f3f4f8
            );
          box-shadow:
            0 25px 70px rgba(50, 60, 80, 0.1);
        }

        .kairo-hero-core {
          width: 66px;
          height: 66px;
          border-radius: 50%;
          padding: 1px;
          background:
            linear-gradient(
              135deg,
              #8b5cf6,
              #d946ef,
              #3b82f6
            );
          box-shadow:
            0 0 45px rgba(139, 92, 246, 0.3);
        }

        .kairo-hero-inner {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: var(--bg);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .light .kairo-hero-inner {
          background: #ffffff;
        }

        .kairo-core-dot {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: white;
          position: relative;
          box-shadow:
            0 0 22px rgba(255, 255, 255, 0.75);
        }

        .kairo-core-dot::after {
          content: "";
          position: absolute;
          inset: 5px;
          border-radius: 50%;
          background:
            linear-gradient(
              135deg,
              #8b5cf6,
              #3b82f6
            );
        }

        .kairo-title {
          letter-spacing: -0.055em;
          line-height: 1;
        }

        .kairo-gradient-text {
          background:
            linear-gradient(
              90deg,
              var(--text),
              #8b5cf6 58%,
              #6366f1
            );
          background-clip: text;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .kairo-suggestion {
          border: 1px solid var(--border);
          background: var(--surface);
          box-shadow:
            0 12px 35px var(--shadow);
          backdrop-filter: blur(22px);
          transition:
            transform 0.2s ease,
            border-color 0.2s ease,
            box-shadow 0.2s ease;
        }

        .kairo-suggestion:hover {
          transform: translateY(-4px);
          border-color: rgba(124, 58, 237, 0.28);
          box-shadow:
            0 20px 45px var(--shadow);
        }

        .kairo-suggestion-icon {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          background:
            linear-gradient(
              135deg,
              rgba(124, 58, 237, 0.14),
              rgba(59, 130, 246, 0.08)
            );
          color: #8b5cf6;
        }

        .kairo-user-message {
          max-width: min(720px, 86%);
          background:
            linear-gradient(
              135deg,
              rgba(124, 58, 237, 0.15),
              rgba(99, 102, 241, 0.09)
            );
          border: 1px solid rgba(124, 58, 237, 0.18);
          border-radius: 24px;
          box-shadow:
            0 12px 35px var(--shadow);
        }

        .light .kairo-user-message {
          background:
            linear-gradient(
              135deg,
              #f1edff,
              #eef2ff
            );
          border-color: #ddd7f4;
          box-shadow:
            0 10px 30px rgba(50, 50, 80, 0.055);
        }

        .kairo-assistant-avatar {
          width: 34px;
          height: 34px;
          border-radius: 11px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background:
            linear-gradient(
              135deg,
              #8b5cf6,
              #d946ef 48%,
              #3b82f6
            );
          box-shadow:
            0 8px 25px rgba(124, 58, 237, 0.2);
        }

        .kairo-assistant-body {
          color: var(--text);
        }

        .kairo-action {
          color: var(--muted-2);
        }

        .kairo-action:hover {
          color: var(--text);
          background: var(--surface-soft);
        }

        .kairo-attachment {
          background: var(--surface-soft);
          border: 1px solid var(--border-soft);
          color: var(--muted);
        }

        .kairo-composer-wrap {
          background:
            linear-gradient(
              to top,
              var(--bg) 55%,
              transparent
            );
        }

        .kairo-editing {
          border: 1px solid rgba(124, 58, 237, 0.2);
          background:
            linear-gradient(
              135deg,
              rgba(124, 58, 237, 0.09),
              rgba(99, 102, 241, 0.045)
            );
        }

        .kairo-composer {
          border: 1px solid var(--border);
          background: var(--input);
          box-shadow:
            0 18px 60px var(--shadow);
          border-radius: 25px;
          transition:
            border-color 0.2s ease,
            box-shadow 0.2s ease;
        }

        .kairo-composer:focus-within {
          border-color: rgba(124, 58, 237, 0.35);
          box-shadow:
            0 20px 65px var(--shadow),
            0 0 0 4px rgba(124, 58, 237, 0.055);
        }

        .kairo-composer-button {
          color: var(--muted-2);
        }

        .kairo-composer-button:hover {
          color: var(--text);
          background: var(--surface-soft);
        }

        .kairo-send {
          background:
            linear-gradient(
              135deg,
              #8b5cf6,
              #6366f1
            );
          color: white;
          box-shadow:
            0 8px 25px rgba(99, 102, 241, 0.28);
        }

        .kairo-send:hover {
          transform: translateY(-1px);
          box-shadow:
            0 12px 30px rgba(99, 102, 241, 0.35);
        }

        .kairo-send:disabled {
          opacity: 0.22;
          box-shadow: none;
        }

        .kairo-textarea {
          color: var(--text);
        }

        .kairo-textarea::placeholder {
          color: var(--muted-2);
        }

        .kairo-scroll::-webkit-scrollbar {
          width: 7px;
        }

        .kairo-scroll::-webkit-scrollbar-track {
          background: transparent;
        }

        .kairo-scroll::-webkit-scrollbar-thumb {
          background: rgba(128, 135, 150, 0.25);
          border-radius: 999px;
        }

        .kairo-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(128, 135, 150, 0.4);
        }

        .kairo-theme-icon {
          transition:
            transform 0.35s ease,
            opacity 0.25s ease;
        }

        .kairo-theme-button:hover
          .kairo-theme-icon {
          transform: rotate(25deg) scale(1.08);
        }

        @media (max-width: 760px) {
          .kairo-sidebar {
            position: absolute;
            z-index: 50;
            height: 100%;
            left: 0;
            top: 0;
            box-shadow:
              20px 0 70px rgba(0, 0, 0, 0.25);
          }

          .kairo-sidebar.closed {
            width: 0;
          }

          .kairo-user-message {
            max-width: 92%;
          }

          .kairo-title {
            font-size: 40px;
          }
        }
      `}</style>

      <main
        className={`kairo-app ${
          lightMode ? "light" : ""
        } h-screen flex overflow-hidden`}
      >
        {/* ======================================================
            SIDEBAR
        ====================================================== */}

        <aside
          className={`kairo-sidebar ${
            sidebar ? "" : "closed"
          } shrink-0 overflow-hidden flex flex-col`}
        >
          <div className="w-[292px] h-full flex flex-col">
            {/* BRAND */}

            <div className="px-5 pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="kairo-brand-mark">
                    <div className="kairo-brand-core" />
                  </div>

                  <div>
                    <div className="text-[17px] font-bold tracking-[-0.035em]">
                      KAIRO
                    </div>

                    <div className="text-[9px] tracking-[0.18em] uppercase text-[var(--muted-2)]">
                      AI Intelligence
                    </div>
                  </div>
                </div>

                <button
                  onClick={() =>
                    setSidebar(false)
                  }
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--muted-2)] hover:text-[var(--text)] hover:bg-[var(--surface-soft)] transition"
                  title="Close sidebar"
                >
                  <svg
                    width="17"
                    height="17"
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
                className="kairo-new-chat mt-6 w-full h-12 rounded-2xl flex items-center justify-center gap-2.5 text-sm font-semibold transition disabled:opacity-40"
              >
                <span className="w-6 h-6 rounded-lg bg-[var(--accent)]/15 flex items-center justify-center">
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                  </svg>
                </span>

                New conversation
              </button>
            </div>

            {/* CHAT HISTORY */}

            <div className="flex-1 overflow-y-auto kairo-scroll px-3">
              <div className="flex items-center justify-between px-3 pt-3 pb-2">
                <div className="text-[9px] font-bold tracking-[0.2em] text-[var(--muted-2)] uppercase">
                  Conversations
                </div>

                {activeChats.length > 0 && (
                  <span className="text-[10px] text-[var(--muted-2)]">
                    {activeChats.length}
                  </span>
                )}
              </div>

              {activeChats.length === 0 && (
                <div className="mx-2 mt-3 rounded-2xl border border-dashed border-[var(--border)] p-5">
                  <div className="w-9 h-9 rounded-xl bg-[var(--surface-soft)] mx-auto flex items-center justify-center text-[var(--muted-2)]">
                    <svg
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                    >
                      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
                    </svg>
                  </div>

                  <p className="text-[11px] leading-5 text-[var(--muted-2)] text-center mt-3">
                    Your conversations will appear here.
                  </p>
                </div>
              )}

              {activeChats.map((chat) => (
                <div
                  key={chat.id}
                  className={`kairo-chat-item ${
                    activeChat === chat.id
                      ? "active"
                      : ""
                  } group relative rounded-2xl mb-1`}
                >
                  <button
                    onClick={() =>
                      openChat(chat.id)
                    }
                    className="w-full text-left px-3.5 py-3.5 pr-11 truncate text-[13px] transition"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          activeChat ===
                          chat.id
                            ? "bg-violet-500/15 text-violet-400"
                            : "bg-[var(--surface-soft)] text-[var(--muted-2)]"
                        }`}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                        >
                          <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
                        </svg>
                      </span>

                      <span className="truncate">
                        {chat.title}
                      </span>
                    </div>
                  </button>

                  <button
                    onClick={() =>
                      setMenuOpen(
                        menuOpen === chat.id
                          ? null
                          : chat.id
                      )
                    }
                    className="absolute right-2 top-2.5 w-8 h-8 rounded-xl flex items-center justify-center text-[var(--muted-2)] hover:text-[var(--text)] hover:bg-[var(--surface-soft)] transition"
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
                    <div className="kairo-menu absolute z-50 right-2 top-12 w-48 rounded-2xl overflow-hidden p-1.5">
                      <button
                        onClick={() =>
                          renameChat(chat.id)
                        }
                        className="w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-xl text-sm text-[var(--muted)] hover:text-[var(--text)] transition"
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
                          archiveChat(chat.id)
                        }
                        className="w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-xl text-sm text-[var(--muted)] hover:text-[var(--text)] transition"
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
                          deleteChat(chat.id)
                        }
                        className="w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition"
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
              ))}

              {/* ARCHIVED */}

              <button
                onClick={() =>
                  setArchiveOpen(
                    !archiveOpen
                  )
                }
                className="w-full flex items-center justify-between px-3.5 py-3.5 mt-5 rounded-2xl text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-soft)] transition"
              >
                <span className="flex items-center gap-3 text-[12px]">
                  <span className="w-7 h-7 rounded-lg bg-[var(--surface-soft)] flex items-center justify-center">
                    <svg
                      width="14"
                      height="14"
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
                  </span>

                  Archived
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
                    <p className="text-[11px] text-[var(--muted-2)] px-4 py-3">
                      No archived conversations.
                    </p>
                  ) : (
                    archivedChats.map(
                      (chat) => (
                        <div
                          key={chat.id}
                          className="px-4 py-3 rounded-xl hover:bg-[var(--surface-soft)] transition"
                        >
                          <div className="truncate text-xs text-[var(--muted)]">
                            {chat.title}
                          </div>

                          <div className="flex gap-4 mt-2">
                            <button
                              onClick={() =>
                                restoreChat(
                                  chat.id
                                )
                              }
                              className="text-[11px] text-blue-400 hover:text-blue-300"
                            >
                              Restore
                            </button>

                            <button
                              onClick={() =>
                                deleteChat(
                                  chat.id
                                )
                              }
                              className="text-[11px] text-red-400 hover:text-red-300"
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

            {/* FOOTER */}

            <div className="p-4">
              <div className="kairo-sidebar-footer rounded-2xl p-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/15 to-blue-500/10 flex items-center justify-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-violet-400 shadow-[0_0_12px_rgba(139,92,246,0.8)]" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[var(--text)]">
                      KAIRO AI
                    </p>

                    <p className="text-[10px] text-[var(--muted-2)] mt-0.5 truncate">
                      Intelligent AI companion
                    </p>
                  </div>

                  <span className="ml-auto w-2 h-2 rounded-full bg-emerald-400" />
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* ======================================================
            MAIN
        ====================================================== */}

        <section className="kairo-main flex-1 min-w-0 flex flex-col">
          {/* HEADER */}

          <header className="kairo-header shrink-0 flex items-center px-4 md:px-7">
            {!sidebar && (
              <button
                onClick={() =>
                  setSidebar(true)
                }
                className="kairo-header-button mr-3 w-10 h-10 rounded-xl flex items-center justify-center transition"
                title="Open sidebar"
              >
                <svg
                  width="18"
                  height="18"
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
              <div className="kairo-brand-mark w-9 h-9 rounded-xl">
                <div className="kairo-brand-core w-2.5 h-2.5" />
              </div>

              <div>
                <div className="font-bold tracking-tight text-sm">
                  KAIRO AI
                </div>

                <div className="flex items-center gap-1.5 text-[10px] text-[var(--muted-2)]">
                  <span className="kairo-status-dot" />
                  Online · Powered by Groq
                </div>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="kairo-header-button kairo-theme-button w-10 h-10 rounded-xl flex items-center justify-center transition"
                title={
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
                    <path d="M18.36 18.36 19.78 19.78" />
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
                  >
                    <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.6 6.6 0 0 0 21 12.8Z" />
                  </svg>
                )}
              </button>

              <button
                onClick={() =>
                  createChat()
                }
                disabled={!authReady}
                className="kairo-header-button w-10 h-10 rounded-xl flex items-center justify-center transition disabled:opacity-40"
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

          {/* ====================================================
              MESSAGES
          ==================================================== */}

          <div className="flex-1 overflow-y-auto kairo-scroll">
            {messages.length === 0 ? (
              <div className="min-h-full flex flex-col items-center justify-center px-5 py-12">
                {/* HERO VISUAL */}

                <div className="relative mb-9">
                  <div className="absolute -inset-16 rounded-full bg-violet-500/10 blur-3xl" />

                  <div className="absolute -inset-7 rounded-[44px] border border-violet-400/10 animate-pulse" />

                  <div className="kairo-hero-orb">
                    <div className="kairo-hero-core">
                      <div className="kairo-hero-inner">
                        <div className="kairo-core-dot" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* HERO TEXT */}

                <div className="text-center max-w-3xl">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-soft)] text-[10px] text-[var(--muted)] mb-5">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                    Your intelligent workspace
                  </div>

                  <h1 className="kairo-title text-5xl md:text-7xl font-bold">
                    Hello, I&apos;m{" "}
                    <span className="kairo-gradient-text">
                      KAIRO
                    </span>
                    <span className="text-violet-500">
                      .
                    </span>
                  </h1>

                  <p className="mt-6 max-w-xl mx-auto text-sm md:text-base leading-7 text-[var(--muted)]">
                    Think smarter, create faster, learn
                    anything and turn ideas into reality
                    with your AI companion.
                  </p>
                </div>

                {/* QUICK ACTIONS */}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-11 max-w-4xl w-full">
                  {[
                    {
                      label: "LEARN",
                      title:
                        "Explain quantum physics simply",
                      icon: (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                        >
                          <circle
                            cx="12"
                            cy="12"
                            r="8"
                          />
                          <path d="M12 8v4l3 2" />
                        </svg>
                      ),
                    },
                    {
                      label: "BUILD",
                      title:
                        "Help me build a website",
                      icon: (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                        >
                          <path d="m8 9-4 3 4 3" />
                          <path d="m16 9 4 3-4 3" />
                          <path d="m14 5-4 14" />
                        </svg>
                      ),
                    },
                    {
                      label: "CREATE",
                      title:
                        "Give me a creative idea",
                      icon: (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                        >
                          <path d="M9 18h6" />
                          <path d="M10 22h4" />
                          <path d="M8.5 14.5A6 6 0 1 1 15.5 14c-.9.7-1.5 1.5-1.5 2.5h-4c0-1-.6-1.8-1.5-2.5Z" />
                        </svg>
                      ),
                    },
                  ].map((item) => (
                    <button
                      key={item.title}
                      onClick={() =>
                        setInput(
                          item.title
                        )
                      }
                      className="kairo-suggestion text-left rounded-3xl p-5"
                    >
                      <div className="flex items-center justify-between mb-7">
                        <div className="kairo-suggestion-icon">
                          {item.icon}
                        </div>

                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          className="text-[var(--muted-2)]"
                        >
                          <path d="M5 12h14" />
                          <path d="m13 6 6 6-6 6" />
                        </svg>
                      </div>

                      <div className="text-[9px] font-bold tracking-[0.2em] text-violet-400 mb-2">
                        {item.label}
                      </div>

                      <div className="text-sm leading-6 font-medium text-[var(--text)]">
                        {item.title}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-9 text-[10px] text-[var(--muted-2)]">
                  Ask anything · Upload files · Build ideas
                </div>
              </div>
            ) : (
              <div className="max-w-4xl mx-auto px-4 md:px-6 py-9">
                {messages.map(
                  (message) => (
                    <div
                      key={message.id}
                      className={`flex mb-9 ${
                        message.role ===
                        "user"
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      {message.role ===
                      "assistant" ? (
                        <div className="w-full flex items-start gap-3.5">
                          <div className="kairo-assistant-avatar">
                            <div className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.8)]" />
                          </div>

                          <div className="min-w-0 flex-1 pt-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-semibold text-[var(--text)]">
                                KAIRO
                              </span>

                              <span className="text-[9px] px-2 py-0.5 rounded-full bg-[var(--surface-soft)] border border-[var(--border-soft)] text-[var(--muted-2)]">
                                AI
                              </span>
                            </div>

                            <div className="kairo-assistant-body whitespace-pre-wrap leading-7 text-[14px] md:text-[15px]">
                              {message.content ||
                                (loading
                                  ? "Thinking..."
                                  : "")}
                            </div>

                            {message.attachments &&
                              message.attachments.length >
                                0 && (
                                <div className="mt-4 flex flex-wrap gap-2">
                                  {message.attachments.map(
                                    (
                                      file,
                                      index
                                    ) => (
                                      <div
                                        key={`${file.name}-${index}`}
                                        className="kairo-attachment rounded-xl px-3 py-2 text-xs flex items-center gap-2"
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

                                        <span className="max-w-[220px] truncate">
                                          {file.name}
                                        </span>
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
                                    className="kairo-action h-8 px-2.5 rounded-lg text-[11px] transition flex items-center gap-2"
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
                                    className="kairo-action h-8 px-2.5 rounded-lg text-[11px] transition disabled:opacity-30 flex items-center gap-2"
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
                      ) : (
                        <div className="kairo-user-message px-5 py-4">
                          <div className="whitespace-pre-wrap leading-7 text-[14px] md:text-[15px] text-[var(--text)]">
                            {message.content}
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
                                      className="kairo-attachment rounded-xl px-3 py-2 text-xs flex items-center gap-2"
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

                                      <span className="max-w-[220px] truncate">
                                        {file.name}
                                      </span>
                                    </div>
                                  )
                                )}
                              </div>
                            )}

                          <div className="flex justify-end mt-2">
                            <button
                              onClick={() =>
                                editMessage(
                                  message
                                )
                              }
                              className="kairo-action h-7 px-2 rounded-lg text-[10px] transition flex items-center gap-1.5"
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
                          </div>
                        </div>
                      )}
                    </div>
                  )
                )}

                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* ====================================================
              COMPOSER
          ==================================================== */}

          <div className="kairo-composer-wrap shrink-0 px-3 md:px-5 pt-3 pb-4">
            <div className="max-w-4xl mx-auto">
              {/* EDITING */}

              {editingId && (
                <div className="kairo-editing mb-2.5 rounded-2xl px-4 py-3 flex items-center justify-between">
                  <span className="text-xs text-violet-400 flex items-center gap-2">
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
                    className="text-[11px] text-[var(--muted)] hover:text-[var(--text)]"
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
                        className="kairo-attachment rounded-xl px-3 py-2 text-xs flex items-center gap-2"
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

                        <span className="max-w-[190px] truncate">
                          {file.name}
                        </span>

                        <button
                          onClick={() =>
                            removeAttachment(
                              index
                            )
                          }
                          className="w-5 h-5 rounded-md flex items-center justify-center text-[var(--muted-2)] hover:text-[var(--text)] hover:bg-[var(--surface-soft)] transition"
                        >
                          <svg
                            width="12"
                            height="12"
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

              <div className="kairo-composer p-2">
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
                    className="kairo-composer-button w-10 h-10 shrink-0 rounded-xl flex items-center justify-center transition disabled:opacity-30"
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
                    className="kairo-composer-button w-10 h-10 shrink-0 rounded-xl flex items-center justify-center transition disabled:opacity-30"
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
                        e.target.files
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
                        e.target.files
                      )
                    }
                  />

                  {/* TEXTAREA */}

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
                        : "Ask KAIRO anything..."
                    }
                    disabled={
                      uploading
                    }
                    rows={1}
                    className="kairo-textarea flex-1 min-w-0 resize-none bg-transparent outline-none px-2.5 py-2.5 max-h-40 text-sm leading-6"
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
                    className="kairo-send w-10 h-10 shrink-0 rounded-xl font-bold transition flex items-center justify-center"
                    title="Send message"
                  >
                    {loading ? (
                      <span className="w-4 h-4 rounded-full border-2 border-white/25 border-t-white animate-spin" />
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

              <div className="flex items-center justify-center gap-2 mt-2.5">
                <span className="w-1 h-1 rounded-full bg-[var(--muted-2)]" />
                <p className="text-center text-[9px] text-[var(--muted-2)]">
                  KAIRO can make mistakes. Check important information.
                </p>
                <span className="w-1 h-1 rounded-full bg-[var(--muted-2)]" />
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}