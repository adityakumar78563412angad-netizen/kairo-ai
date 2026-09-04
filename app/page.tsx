"use client";

import {
  useEffect,
  useRef,
  useState,
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

const supabase = createClient();

function Icon({
  children,
  size = 18,
  strokeWidth = 1.8,
}: {
  children: ReactNode;
  size?: number;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function KairoMark({ small = false }: { small?: boolean }) {
  return (
    <div
      className={`kairo-mark ${
        small ? "kairo-mark-small" : ""
      }`}
    >
      <div className="kairo-mark-ring">
        <div className="kairo-mark-dot" />
      </div>
    </div>
  );
}

function formatFileSize(size = 0) {
  if (size < 1024) return `${size} B`;

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  if (size < 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(
    size /
    (1024 * 1024 * 1024)
  ).toFixed(1)} GB`;
}

function getFileIcon(type: string, name: string) {
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";

  if (
    type.includes("pdf") ||
    name.toLowerCase().endsWith(".pdf")
  ) {
    return "pdf";
  }

  if (
    type.includes("zip") ||
    type.includes("compressed")
  ) {
    return "zip";
  }

  if (
    type.includes("spreadsheet") ||
    /\.(xls|xlsx|csv)$/i.test(name)
  ) {
    return "sheet";
  }

  if (
    type.includes("word") ||
    /\.(doc|docx)$/i.test(name)
  ) {
    return "doc";
  }

  return "file";
}

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);

  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);

  const [activeChat, setActiveChat] =
    useState<string | null>(null);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [sidebar, setSidebar] = useState(true);
  const [archiveOpen, setArchiveOpen] =
    useState(false);

  const [menuOpen, setMenuOpen] =
    useState<string | null>(null);

  const [attachments, setAttachments] =
    useState<Attachment[]>([]);

  const [uploading, setUploading] =
    useState(false);

  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [lightMode, setLightMode] =
    useState(false);

  const fileInput =
    useRef<HTMLInputElement>(null);

  const folderInput =
    useRef<HTMLInputElement>(null);

  const bottomRef =
    useRef<HTMLDivElement>(null);

  // ============================================================
  // THEME
  // ============================================================

  useEffect(() => {
    const saved =
      localStorage.getItem("kairo-theme");

    if (saved === "light") {
      setLightMode(true);
    }
  }, []);

  function toggleTheme() {
    setLightMode((previous) => {
      const next = !previous;

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
      const current =
        await supabase.auth.getUser();

      if (current.data.user) {
        setUser(current.data.user);

        await loadChats(
          current.data.user.id
        );

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
          title: "New conversation",
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

    setChats((previous) => [
      data,
      ...previous.filter(
        (chat) => chat.id !== data.id
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
        "Couldn't open this conversation:\n\n" +
          error.message
      );

      return;
    }

    setMessages(data || []);

    if (
      typeof window !== "undefined" &&
      window.innerWidth < 900
    ) {
      setSidebar(false);
    }
  }

  async function renameChat(id: string) {
    const chat = chats.find(
      (item) => item.id === id
    );

    if (!chat) return;

    const name = window.prompt(
      "Rename conversation",
      chat.title
    );

    if (!name?.trim()) return;

    const cleanName = name.trim();

    const now =
      new Date().toISOString();

    const { error } =
      await supabase
        .from("kairo_chats")
        .update({
          title: cleanName,
          updated_at: now,
        })
        .eq("id", id);

    if (error) {
      alert(
        "Couldn't rename chat:\n\n" +
          error.message
      );

      return;
    }

    setChats((previous) =>
      previous.map((chat) =>
        chat.id === id
          ? {
              ...chat,
              title: cleanName,
              updated_at: now,
            }
          : chat
      )
    );

    setMenuOpen(null);
  }

  async function archiveChat(id: string) {
    const now =
      new Date().toISOString();

    const { error } =
      await supabase
        .from("kairo_chats")
        .update({
          archived: true,
          updated_at: now,
        })
        .eq("id", id);

    if (error) {
      alert(
        "Couldn't archive chat:\n\n" +
          error.message
      );

      return;
    }

    setChats((previous) =>
      previous.map((chat) =>
        chat.id === id
          ? {
              ...chat,
              archived: true,
              updated_at: now,
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
    const now =
      new Date().toISOString();

    const { error } =
      await supabase
        .from("kairo_chats")
        .update({
          archived: false,
          updated_at: now,
        })
        .eq("id", id);

    if (error) {
      alert(
        "Couldn't restore chat:\n\n" +
          error.message
      );

      return;
    }

    setChats((previous) =>
      previous.map((chat) =>
        chat.id === id
          ? {
              ...chat,
              archived: false,
              updated_at: now,
            }
          : chat
      )
    );
  }

  async function deleteChat(id: string) {
    const confirmed =
      window.confirm(
        "Delete this conversation permanently?"
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

    setChats((previous) =>
      previous.filter(
        (chat) => chat.id !== id
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
  // BACKBLAZE B2 UPLOAD
  // ============================================================

  async function uploadFiles(
    files: FileList | null
  ) {
    if (!files || files.length === 0) {
      return;
    }

    const currentUser =
      await ensureUser();

    if (!currentUser) return;

    setUploading(true);

    try {
      const uploaded: Attachment[] = [];

      for (const file of Array.from(files)) {
        try {
          const formData =
            new FormData();

          formData.append(
            "file",
            file
          );

          formData.append(
            "userId",
            currentUser.id
          );

          formData.append(
            "relativePath",
            (
              file as File & {
                webkitRelativePath?: string;
              }
            ).webkitRelativePath ||
              file.name
          );

          const response =
            await fetch(
              "/api/upload",
              {
                method: "POST",
                body: formData,
              }
            );

          const result =
            await response.json();

          if (!response.ok) {
            throw new Error(
              result?.error ||
                "Upload failed."
            );
          }

          uploaded.push({
            name: file.name,
            type:
              file.type ||
              "application/octet-stream",
            size: file.size,
            url: result.url,
            key: result.key,
            relativePath:
              result.relativePath,
          });
        } catch (error: any) {
          console.error(
            "B2 upload error:",
            error
          );

          alert(
            `Couldn't upload ${file.name}:\n\n${
              error?.message ||
              "Upload failed."
            }`
          );
        }
      }

      if (uploaded.length > 0) {
        setAttachments((previous) => [
          ...previous,
          ...uploaded,
        ]);
      }
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
    setAttachments((previous) =>
      previous.filter(
        (_, i) => i !== index
      )
    );
  }

  // ============================================================
  // STREAMING AI
  // ============================================================

  async function streamAI(
    chatId: string,
    history: Message[],
    currentAttachments: Attachment[] = []
  ) {
    const assistantId =
      crypto.randomUUID();

    setMessages((previous) => [
      ...previous,
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
            messages: history.map(
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

          if (
            !data ||
            data === "[DONE]"
          ) {
            continue;
          }

          try {
            const parsed =
              JSON.parse(data);

            if (parsed.text) {
              answer += parsed.text;

              setMessages(
                (previous) =>
                  previous.map(
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

      setMessages((previous) =>
        previous.map((message) =>
          message.id === assistantId
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
    if (loading || uploading) {
      return;
    }

    const text =
      input.trim();

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
      // ========================================================
      // EDIT MODE
      // ========================================================

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
            newMessages,
            newUserMessage.attachments ||
              []
          );

          await updateChatTime(
            chatId
          );

          return;
        }
      }

      // ========================================================
      // NORMAL MESSAGE
      // ========================================================

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

      const userMessage: Message =
        {
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

    setChats((previous) =>
      previous
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
      "New conversation"
    ) {
      return;
    }

    const title =
      text.slice(0, 42) ||
      "File conversation";

    await supabase
      .from("kairo_chats")
      .update({
        title,
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", chatId);

    setChats((previous) =>
      previous.map((item) =>
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

      alert("Copied to clipboard.");
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

    if (message.attachments) {
      setAttachments(
        message.attachments
      );
    }

    setTimeout(() => {
      const textarea =
        document.querySelector(
          ".kairo-textarea"
        ) as HTMLTextAreaElement | null;

      if (textarea) {
        textarea.focus();
      }
    }, 50);
  }

  function cancelEdit() {
    setEditingId(null);
    setInput("");
    setAttachments([]);
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

    if (assistantIndex === -1) {
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
    event: KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

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

        button,
        textarea {
          font: inherit;
        }

        button {
          cursor: pointer;
        }

        .kairo-app {
          --bg: #050608;
          --bg2: #090b10;
          --panel: rgba(12, 14, 20, 0.82);
          --panel-solid: #0d1017;
          --panel-soft: rgba(255,255,255,.045);
          --panel-hover: rgba(255,255,255,.07);
          --line: rgba(255,255,255,.085);
          --line-soft: rgba(255,255,255,.055);
          --text: #f7f8fc;
          --muted: #9198aa;
          --muted2: #5f6779;
          --purple: #8b5cf6;
          --blue: #6366f1;
          --pink: #d946ef;
          --green: #34d399;
          --danger: #fb7185;
          --shadow: rgba(0,0,0,.45);

          width: 100vw;
          height: 100vh;
          display: flex;
          overflow: hidden;
          color: var(--text);

          background:
            radial-gradient(
              circle at 55% -15%,
              rgba(139,92,246,.12),
              transparent 32%
            ),
            radial-gradient(
              circle at 90% 90%,
              rgba(59,130,246,.07),
              transparent 30%
            ),
            linear-gradient(
              145deg,
              var(--bg),
              var(--bg2)
            );

          transition:
            background .35s ease,
            color .35s ease;
        }

        .kairo-app.light {
          --bg: #f5f7fb;
          --bg2: #eef1f7;
          --panel: rgba(255,255,255,.84);
          --panel-solid: #ffffff;
          --panel-soft: rgba(20,27,45,.045);
          --panel-hover: rgba(20,27,45,.07);
          --line: #e2e6ee;
          --line-soft: #edf0f5;
          --text: #171b26;
          --muted: #697286;
          --muted2: #99a1b1;
          --shadow: rgba(25,35,55,.11);

          background:
            radial-gradient(
              circle at 55% -15%,
              rgba(124,58,237,.09),
              transparent 34%
            ),
            radial-gradient(
              circle at 90% 90%,
              rgba(59,130,246,.055),
              transparent 30%
            ),
            linear-gradient(
              145deg,
              #f8f9fc,
              #eef1f7
            );
        }

        /* =====================================================
           SIDEBAR
        ===================================================== */

        .kairo-sidebar {
          width: 300px;
          height: 100%;
          flex-shrink: 0;
          background: var(--panel);
          border-right: 1px solid var(--line);
          backdrop-filter: blur(32px);
          overflow: hidden;
          transition:
            width .3s ease,
            transform .3s ease;
          z-index: 40;
        }

        .kairo-sidebar.closed {
          width: 0;
          border-right: 0;
        }

        .kairo-sidebar-inner {
          width: 300px;
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .kairo-side-top {
          padding: 22px 18px 15px;
        }

        .kairo-brand-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .kairo-brand {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .kairo-mark {
          width: 42px;
          height: 42px;
          border-radius: 14px;
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
            0 10px 35px rgba(124,58,237,.3);
          position: relative;
        }

        .kairo-mark-small {
          width: 36px;
          height: 36px;
          border-radius: 12px;
        }

        .kairo-mark-ring {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,.65);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow:
            inset 0 0 14px rgba(255,255,255,.18);
        }

        .kairo-mark-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: white;
          box-shadow:
            0 0 15px white;
        }

        .kairo-brand-name {
          font-size: 16px;
          font-weight: 800;
          letter-spacing: -.04em;
        }

        .kairo-brand-sub {
          margin-top: 2px;
          font-size: 9px;
          color: var(--muted2);
          letter-spacing: .16em;
          text-transform: uppercase;
        }

        .kairo-icon-button {
          width: 36px;
          height: 36px;
          border-radius: 11px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--muted);
          background: transparent;
          border: 1px solid transparent;
          transition: .2s ease;
        }

        .kairo-icon-button:hover {
          color: var(--text);
          background: var(--panel-hover);
          border-color: var(--line);
        }

        .kairo-new-button {
          width: 100%;
          height: 48px;
          margin-top: 20px;
          border: 1px solid rgba(139,92,246,.22);
          border-radius: 15px;
          color: white;
          font-size: 13px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;

          background:
            linear-gradient(
              135deg,
              rgba(139,92,246,.95),
              rgba(99,102,241,.9)
            );

          box-shadow:
            0 12px 32px rgba(99,102,241,.2);

          transition:
            transform .2s ease,
            box-shadow .2s ease;
        }

        .kairo-new-button:hover {
          transform: translateY(-1px);
          box-shadow:
            0 16px 40px rgba(99,102,241,.3);
        }

        .kairo-new-button:disabled {
          opacity: .45;
          cursor: not-allowed;
          transform: none;
        }

        .kairo-history {
          flex: 1;
          overflow-y: auto;
          padding: 6px 11px;
        }

        .kairo-history::-webkit-scrollbar,
        .kairo-messages::-webkit-scrollbar {
          width: 6px;
        }

        .kairo-history::-webkit-scrollbar-thumb,
        .kairo-messages::-webkit-scrollbar-thumb {
          background: rgba(128,135,150,.22);
          border-radius: 99px;
        }

        .kairo-section-label {
          padding: 13px 9px 9px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .16em;
          color: var(--muted2);
          text-transform: uppercase;
        }

        .kairo-chat {
          position: relative;
          width: 100%;
          min-height: 52px;
          margin-bottom: 4px;
          padding: 7px 8px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          gap: 10px;
          text-align: left;
          border: 1px solid transparent;
          color: var(--muted);
          background: transparent;
          transition: .18s ease;
        }

        .kairo-chat:hover {
          background: var(--panel-hover);
          color: var(--text);
          border-color: var(--line-soft);
        }

        .kairo-chat.active {
          color: var(--text);
          background:
            linear-gradient(
              135deg,
              rgba(139,92,246,.13),
              rgba(99,102,241,.06)
            );
          border-color:
            rgba(139,92,246,.2);
        }

        .kairo-chat-icon {
          width: 34px;
          height: 34px;
          border-radius: 11px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--panel-soft);
          color: var(--muted2);
        }

        .kairo-chat.active .kairo-chat-icon {
          color: #a78bfa;
          background: rgba(139,92,246,.14);
        }

        .kairo-chat-title {
          min-width: 0;
          flex: 1;
          font-size: 12px;
          font-weight: 550;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .kairo-chat-more {
          width: 30px;
          height: 30px;
          border: 0;
          border-radius: 9px;
          color: var(--muted2);
          background: transparent;
          opacity: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: .18s ease;
        }

        .kairo-chat:hover .kairo-chat-more,
        .kairo-chat-more:focus {
          opacity: 1;
        }

        .kairo-chat-more:hover {
          color: var(--text);
          background: var(--panel-soft);
        }

        .kairo-empty-history {
          margin: 7px 3px;
          padding: 22px 14px;
          border: 1px dashed var(--line);
          border-radius: 16px;
          text-align: center;
          color: var(--muted2);
          font-size: 11px;
          line-height: 1.6;
        }

        .kairo-archive-toggle {
          width: 100%;
          margin-top: 12px;
          padding: 8px;
          border: 0;
          border-radius: 13px;
          color: var(--muted);
          background: transparent;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .kairo-archive-toggle:hover {
          color: var(--text);
          background: var(--panel-soft);
        }

        .kairo-archive-item {
          padding: 11px 10px;
          border-radius: 12px;
        }

        .kairo-archive-item:hover {
          background: var(--panel-soft);
        }

        .kairo-archive-name {
          font-size: 11px;
          color: var(--muted);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .kairo-archive-actions {
          display: flex;
          gap: 13px;
          margin-top: 7px;
        }

        .kairo-archive-actions button {
          border: 0;
          padding: 0;
          background: transparent;
          font-size: 10px;
        }

        .restore {
          color: #60a5fa;
        }

        .delete {
          color: #fb7185;
        }

        .kairo-side-bottom {
          padding: 14px;
        }

        .kairo-account-card {
          padding: 13px;
          border: 1px solid var(--line);
          border-radius: 17px;
          background: var(--panel-soft);
        }

        .kairo-account-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .kairo-account-avatar {
          width: 34px;
          height: 34px;
          border-radius: 11px;
          display: flex;
          align-items: center;
          justify-content: center;
          background:
            linear-gradient(
              135deg,
              rgba(139,92,246,.2),
              rgba(59,130,246,.12)
            );
        }

        .kairo-account-title {
          font-size: 11px;
          font-weight: 700;
        }

        .kairo-account-sub {
          font-size: 9px;
          color: var(--muted2);
          margin-top: 2px;
        }

        .kairo-online {
          margin-left: auto;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--green);
          box-shadow:
            0 0 12px rgba(52,211,153,.7);
        }

        /* =====================================================
           MAIN
        ===================================================== */

        .kairo-main {
          min-width: 0;
          flex: 1;
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .kairo-topbar {
          height: 72px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          padding: 0 20px;
          border-bottom: 1px solid var(--line);
          background: rgba(5,6,8,.4);
          backdrop-filter: blur(30px);
          z-index: 20;
        }

        .light .kairo-topbar {
          background: rgba(255,255,255,.65);
        }

        .kairo-topbar-left {
          display: flex;
          align-items: center;
          gap: 11px;
          min-width: 0;
        }

        .kairo-topbar-info {
          min-width: 0;
        }

        .kairo-topbar-name {
          font-size: 13px;
          font-weight: 750;
          letter-spacing: -.02em;
        }

        .kairo-topbar-status {
          display: flex;
          align-items: center;
          gap: 5px;
          color: var(--muted2);
          font-size: 9px;
          margin-top: 2px;
        }

        .status-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--green);
          box-shadow:
            0 0 9px rgba(52,211,153,.8);
        }

        .kairo-topbar-actions {
          margin-left: auto;
          display: flex;
          gap: 7px;
        }

        .kairo-top-action {
          width: 38px;
          height: 38px;
          border-radius: 12px;
          border: 1px solid var(--line);
          color: var(--muted);
          background: var(--panel-soft);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: .2s ease;
        }

        .kairo-top-action:hover {
          color: var(--text);
          background: var(--panel-hover);
          transform: translateY(-1px);
        }

        /* =====================================================
           WELCOME
        ===================================================== */

        .kairo-messages {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
        }

        .kairo-welcome {
          width: min(980px, 100%);
          min-height: 100%;
          margin: auto;
          padding: 55px 24px 35px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .kairo-welcome-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 7px 11px;
          border-radius: 999px;
          border: 1px solid var(--line);
          background: var(--panel-soft);
          color: var(--muted);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: .07em;
        }

        .badge-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #a78bfa;
          box-shadow:
            0 0 12px rgba(167,139,250,.8);
        }

        .kairo-welcome-orb {
          width: 108px;
          height: 108px;
          margin-bottom: 27px;
          border-radius: 31px;
          display: flex;
          align-items: center;
          justify-content: center;
          background:
            linear-gradient(
              145deg,
              rgba(255,255,255,.08),
              rgba(255,255,255,.018)
            );
          border: 1px solid var(--line);
          box-shadow:
            0 30px 90px rgba(0,0,0,.25);
          position: relative;
        }

        .light .kairo-welcome-orb {
          background:
            linear-gradient(
              145deg,
              white,
              #f1f3f8
            );
          box-shadow:
            0 25px 75px rgba(45,55,75,.1);
        }

        .kairo-orb-inner {
          width: 62px;
          height: 62px;
          border-radius: 50%;
          padding: 2px;
          background:
            conic-gradient(
              from 20deg,
              #8b5cf6,
              #d946ef,
              #3b82f6,
              #8b5cf6
            );
          animation:
            kairo-spin 8s linear infinite;
        }

        .kairo-orb-center {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: var(--bg);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .light .kairo-orb-center {
          background: white;
        }

        .kairo-orb-core {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: white;
          box-shadow:
            0 0 25px white;
          position: relative;
        }

        .kairo-orb-core::after {
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

        @keyframes kairo-spin {
          to {
            transform: rotate(360deg);
          }
        }

        .kairo-welcome-title {
          margin: 18px 0 0;
          font-size: clamp(43px, 7vw, 78px);
          line-height: .95;
          font-weight: 850;
          letter-spacing: -.075em;
          text-align: center;
        }

        .kairo-gradient {
          background:
            linear-gradient(
              100deg,
              #a78bfa,
              #d946ef 48%,
              #60a5fa
            );
          background-clip: text;
          -webkit-background-clip: text;
          color: transparent;
        }

        .kairo-welcome-copy {
          max-width: 590px;
          margin: 20px auto 0;
          text-align: center;
          font-size: 14px;
          line-height: 1.8;
          color: var(--muted);
        }

        .kairo-pills {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 7px;
          margin-top: 19px;
        }

        .kairo-pill {
          padding: 6px 10px;
          border: 1px solid var(--line);
          border-radius: 999px;
          color: var(--muted2);
          background: var(--panel-soft);
          font-size: 9px;
        }

        .kairo-prompts {
          width: 100%;
          max-width: 900px;
          display: grid;
          grid-template-columns:
            repeat(3, 1fr);
          gap: 11px;
          margin-top: 42px;
        }

        .kairo-prompt {
          min-height: 145px;
          padding: 18px;
          text-align: left;
          border: 1px solid var(--line);
          border-radius: 20px;
          background: var(--panel);
          color: var(--text);
          box-shadow:
            0 15px 45px var(--shadow);
          backdrop-filter: blur(25px);
          transition:
            transform .2s ease,
            border-color .2s ease,
            background .2s ease;
        }

        .kairo-prompt:hover {
          transform: translateY(-4px);
          border-color:
            rgba(139,92,246,.3);
          background: var(--panel-hover);
        }

        .kairo-prompt-icon {
          width: 35px;
          height: 35px;
          border-radius: 11px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #a78bfa;
          background:
            rgba(139,92,246,.1);
          margin-bottom: 25px;
        }

        .kairo-prompt-label {
          font-size: 8px;
          font-weight: 800;
          color: #a78bfa;
          letter-spacing: .18em;
        }

        .kairo-prompt-title {
          margin-top: 7px;
          font-size: 12px;
          line-height: 1.55;
          font-weight: 650;
        }

        .kairo-prompt-arrow {
          float: right;
          color: var(--muted2);
        }

        .kairo-welcome-footer {
          margin-top: 28px;
          color: var(--muted2);
          font-size: 9px;
        }

        /* =====================================================
           CHAT MESSAGES
        ===================================================== */

        .kairo-message-list {
          width: min(900px, 100%);
          margin: auto;
          padding: 34px 22px 50px;
        }

        .kairo-message {
          display: flex;
          margin-bottom: 30px;
          animation:
            kairo-message-in .22s ease;
        }

        @keyframes kairo-message-in {
          from {
            opacity: 0;
            transform: translateY(5px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .kairo-message.user {
          justify-content: flex-end;
        }

        .kairo-user-bubble {
          max-width: min(720px, 85%);
          padding: 14px 17px;
          border-radius: 20px 20px 6px 20px;
          border: 1px solid rgba(139,92,246,.22);
          background:
            linear-gradient(
              135deg,
              rgba(139,92,246,.16),
              rgba(99,102,241,.1)
            );
          box-shadow:
            0 12px 40px var(--shadow);
        }

        .light .kairo-user-bubble {
          background:
            linear-gradient(
              135deg,
              #f0ebff,
              #edf1ff
            );
          border-color: #ded7f5;
          box-shadow:
            0 10px 30px rgba(45,55,80,.06);
        }

        .kairo-message-text {
          white-space: pre-wrap;
          word-break: break-word;
          font-size: 14px;
          line-height: 1.75;
        }

        .kairo-assistant-message {
          display: flex;
          gap: 13px;
          width: 100%;
        }

        .kairo-assistant-mark {
          width: 36px;
          height: 36px;
          flex-shrink: 0;
          border-radius: 12px;
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
            0 9px 25px rgba(124,58,237,.2);
        }

        .kairo-assistant-mark-inner {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: white;
          box-shadow:
            0 0 13px white;
        }

        .kairo-assistant-content {
          min-width: 0;
          flex: 1;
          padding-top: 1px;
        }

        .kairo-assistant-header {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 7px;
        }

        .kairo-assistant-name {
          font-size: 11px;
          font-weight: 800;
        }

        .kairo-ai-badge {
          padding: 3px 6px;
          border-radius: 6px;
          color: #a78bfa;
          background: rgba(139,92,246,.09);
          border: 1px solid rgba(139,92,246,.12);
          font-size: 7px;
          font-weight: 800;
          letter-spacing: .1em;
        }

        .kairo-assistant-text {
          white-space: pre-wrap;
          word-break: break-word;
          color: var(--text);
          font-size: 14px;
          line-height: 1.8;
        }

        .kairo-thinking {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          color: var(--muted2);
        }

        .kairo-thinking span {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #8b5cf6;
          animation:
            thinking 1s infinite ease-in-out;
        }

        .kairo-thinking span:nth-child(2) {
          animation-delay: .12s;
        }

        .kairo-thinking span:nth-child(3) {
          animation-delay: .24s;
        }

        @keyframes thinking {
          0%, 60%, 100% {
            transform: translateY(0);
            opacity: .35;
          }

          30% {
            transform: translateY(-4px);
            opacity: 1;
          }
        }

        .kairo-actions {
          display: flex;
          gap: 3px;
          margin-top: 12px;
        }

        .kairo-message-action {
          height: 30px;
          padding: 0 8px;
          border: 0;
          border-radius: 8px;
          color: var(--muted2);
          background: transparent;
          font-size: 9px;
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .kairo-message-action:hover {
          color: var(--text);
          background: var(--panel-soft);
        }

        .kairo-message-action:disabled {
          opacity: .3;
        }

        /* =====================================================
           ATTACHMENTS
        ===================================================== */

        .kairo-files {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 11px;
        }

        .kairo-file-card {
          min-width: 175px;
          max-width: 255px;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 9px 10px;
          border: 1px solid var(--line);
          border-radius: 13px;
          background: var(--panel-soft);
        }

        .kairo-file-icon {
          width: 31px;
          height: 31px;
          flex-shrink: 0;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #a78bfa;
          background:
            rgba(139,92,246,.1);
        }

        .kairo-file-info {
          min-width: 0;
        }

        .kairo-file-name {
          font-size: 10px;
          font-weight: 650;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .kairo-file-size {
          margin-top: 2px;
          color: var(--muted2);
          font-size: 8px;
        }

        /* =====================================================
           COMPOSER
        ===================================================== */

        .kairo-composer-area {
          flex-shrink: 0;
          padding:
            10px 20px 18px;
          background:
            linear-gradient(
              to top,
              var(--bg) 48%,
              transparent
            );
        }

        .kairo-composer-width {
          width: min(900px, 100%);
          margin: auto;
        }

        .kairo-edit-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 9px 12px;
          margin-bottom: 7px;
          border: 1px solid rgba(139,92,246,.2);
          border-radius: 13px;
          background: rgba(139,92,246,.07);
          font-size: 10px;
        }

        .kairo-edit-label {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #a78bfa;
        }

        .kairo-cancel {
          border: 0;
          color: var(--muted);
          background: transparent;
          font-size: 9px;
        }

        .kairo-cancel:hover {
          color: var(--text);
        }

        .kairo-pending-files {
          display: flex;
          gap: 7px;
          flex-wrap: wrap;
          margin-bottom: 8px;
        }

        .kairo-pending {
          max-width: 245px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 7px 8px;
          border: 1px solid var(--line);
          border-radius: 11px;
          background: var(--panel);
        }

        .kairo-pending-icon {
          width: 27px;
          height: 27px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          color: #a78bfa;
          background: rgba(139,92,246,.1);
        }

        .kairo-pending-name {
          max-width: 150px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 9px;
        }

        .kairo-pending-size {
          color: var(--muted2);
          font-size: 8px;
        }

        .kairo-remove {
          width: 23px;
          height: 23px;
          border: 0;
          border-radius: 7px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--muted2);
          background: transparent;
        }

        .kairo-remove:hover {
          color: var(--danger);
          background: rgba(251,113,133,.08);
        }

        .kairo-composer {
          min-height: 58px;
          display: flex;
          align-items: flex-end;
          gap: 5px;
          padding: 7px;
          border: 1px solid var(--line);
          border-radius: 20px;
          background: var(--panel);
          box-shadow:
            0 18px 65px var(--shadow);
          backdrop-filter: blur(30px);
          transition: .2s ease;
        }

        .kairo-composer:focus-within {
          border-color:
            rgba(139,92,246,.32);
          box-shadow:
            0 20px 70px var(--shadow),
            0 0 0 3px
              rgba(139,92,246,.055);
        }

        .kairo-tool {
          width: 40px;
          height: 40px;
          flex-shrink: 0;
          border: 0;
          border-radius: 12px;
          color: var(--muted2);
          background: transparent;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: .18s ease;
        }

        .kairo-tool:hover {
          color: var(--text);
          background: var(--panel-hover);
        }

        .kairo-tool:disabled {
          opacity: .3;
          cursor: not-allowed;
        }

        .kairo-textarea {
          flex: 1;
          min-width: 0;
          min-height: 40px;
          max-height: 150px;
          padding: 10px 7px;
          resize: none;
          border: 0;
          outline: none;
          color: var(--text);
          background: transparent;
          font-size: 13px;
          line-height: 20px;
        }

        .kairo-textarea::placeholder {
          color: var(--muted2);
        }

        .kairo-send {
          width: 40px;
          height: 40px;
          flex-shrink: 0;
          border: 0;
          border-radius: 12px;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          background:
            linear-gradient(
              135deg,
              #8b5cf6,
              #6366f1
            );
          box-shadow:
            0 8px 25px
              rgba(99,102,241,.28);
          transition: .2s ease;
        }

        .kairo-send:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow:
            0 12px 30px
              rgba(99,102,241,.38);
        }

        .kairo-send:disabled {
          opacity: .22;
          box-shadow: none;
          cursor: not-allowed;
        }

        .kairo-disclaimer {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          margin-top: 8px;
          color: var(--muted2);
          font-size: 8px;
        }

        /* =====================================================
           MENU
        ===================================================== */

        .kairo-menu {
          position: absolute;
          right: 6px;
          top: 47px;
          z-index: 100;
          width: 170px;
          padding: 5px;
          border: 1px solid var(--line);
          border-radius: 14px;
          background: var(--panel-solid);
          box-shadow:
            0 25px 70px var(--shadow);
          backdrop-filter: blur(25px);
        }

        .kairo-menu button {
          width: 100%;
          height: 36px;
          padding: 0 10px;
          border: 0;
          border-radius: 9px;
          color: var(--muted);
          background: transparent;
          display: flex;
          align-items: center;
          gap: 8px;
          text-align: left;
          font-size: 10px;
        }

        .kairo-menu button:hover {
          color: var(--text);
          background: var(--panel-soft);
        }

        .kairo-menu .danger-item {
          color: #fb7185;
        }

        /* =====================================================
           MOBILE
        ===================================================== */

        @media (max-width: 850px) {
          .kairo-sidebar {
            position: fixed;
            left: 0;
            top: 0;
            bottom: 0;
            box-shadow:
              25px 0 80px rgba(0,0,0,.35);
          }

          .kairo-sidebar.closed {
            width: 0;
          }

          .kairo-topbar {
            padding: 0 13px;
          }

          .kairo-message-list {
            padding:
              24px 13px 35px;
          }

          .kairo-user-bubble {
            max-width: 91%;
          }

          .kairo-composer-area {
            padding:
              7px 9px 12px;
          }

          .kairo-prompts {
            grid-template-columns:
              1fr;
            max-width: 470px;
          }

          .kairo-prompt {
            min-height: 105px;
          }

          .kairo-prompt-icon {
            margin-bottom: 13px;
          }

          .kairo-welcome {
            padding:
              35px 16px 25px;
          }

          .kairo-welcome-copy {
            font-size: 12px;
          }
        }

        @media (max-width: 480px) {
          .kairo-brand-sub {
            display: none;
          }

          .kairo-topbar-name {
            font-size: 12px;
          }

          .kairo-topbar-status {
            font-size: 8px;
          }

          .kairo-welcome-title {
            font-size: 47px;
          }

          .kairo-welcome-orb {
            width: 88px;
            height: 88px;
            border-radius: 27px;
          }

          .kairo-orb-inner {
            width: 52px;
            height: 52px;
          }

          .kairo-message {
            margin-bottom: 25px;
          }

          .kairo-assistant-message {
            gap: 9px;
          }

          .kairo-assistant-mark {
            width: 32px;
            height: 32px;
            border-radius: 10px;
          }

          .kairo-assistant-text,
          .kairo-message-text {
            font-size: 13px;
          }

          .kairo-file-card {
            max-width: 100%;
          }

          .kairo-tool {
            width: 36px;
          }

          .kairo-send {
            width: 38px;
            height: 38px;
          }
        }
      `}</style>

      <main
        className={`kairo-app ${
          lightMode ? "light" : ""
        }`}
      >
        {/* ====================================================
            SIDEBAR
        ==================================================== */}

        <aside
          className={`kairo-sidebar ${
            sidebar ? "" : "closed"
          }`}
        >
          <div className="kairo-sidebar-inner">
            <div className="kairo-side-top">
              <div className="kairo-brand-row">
                <div className="kairo-brand">
                  <KairoMark />

                  <div>
                    <div className="kairo-brand-name">
                      KAIRO
                    </div>

                    <div className="kairo-brand-sub">
                      AI workspace
                    </div>
                  </div>
                </div>

                <button
                  className="kairo-icon-button"
                  onClick={() =>
                    setSidebar(false)
                  }
                  title="Close sidebar"
                >
                  <Icon size={17}>
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </Icon>
                </button>
              </div>

              <button
                className="kairo-new-button"
                disabled={!authReady}
                onClick={() =>
                  createChat()
                }
              >
                <Icon size={16}>
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </Icon>

                New conversation
              </button>
            </div>

            <div className="kairo-history">
              <div className="kairo-section-label">
                <span>
                  Conversations
                </span>

                <span>
                  {activeChats.length}
                </span>
              </div>

              {activeChats.length ===
                0 && (
                <div className="kairo-empty-history">
                  <Icon size={20}>
                    <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
                  </Icon>

                  <div
                    style={{
                      marginTop: 9,
                    }}
                  >
                    Start a conversation and
                    it will appear here.
                  </div>
                </div>
              )}

              {activeChats.map(
                (chat) => (
                  <div
                    key={chat.id}
                    className={`kairo-chat ${
                      activeChat ===
                      chat.id
                        ? "active"
                        : ""
                    }`}
                  >
                    <button
                      onClick={() =>
                        openChat(
                          chat.id
                        )
                      }
                      style={{
                        position:
                          "absolute",
                        inset: 0,
                        width: "100%",
                        border: 0,
                        background:
                          "transparent",
                      }}
                      aria-label={`Open ${chat.title}`}
                    />

                    <div className="kairo-chat-icon">
                      <Icon size={15}>
                        <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
                      </Icon>
                    </div>

                    <div className="kairo-chat-title">
                      {chat.title}
                    </div>

                    <button
                      className="kairo-chat-more"
                      onClick={() =>
                        setMenuOpen(
                          menuOpen ===
                            chat.id
                            ? null
                            : chat.id
                        )
                      }
                      title="Options"
                    >
                      <Icon
                        size={15}
                        strokeWidth={2}
                      >
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

                    {menuOpen ===
                      chat.id && (
                      <div className="kairo-menu">
                        <button
                          onClick={() =>
                            renameChat(
                              chat.id
                            )
                          }
                        >
                          <Icon size={14}>
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
                          </Icon>

                          Rename
                        </button>

                        <button
                          onClick={() =>
                            archiveChat(
                              chat.id
                            )
                          }
                        >
                          <Icon size={14}>
                            <path d="M4 7h16" />
                            <path d="M6 7v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7" />
                            <path d="M8 4h8l1 3H7l1-3Z" />
                          </Icon>

                          Archive
                        </button>

                        <button
                          className="danger-item"
                          onClick={() =>
                            deleteChat(
                              chat.id
                            )
                          }
                        >
                          <Icon size={14}>
                            <path d="M3 6h18" />
                            <path d="M8 6V4h8v2" />
                            <path d="M19 6l-1 14H6L5 6" />
                            <path d="M10 11v5" />
                            <path d="M14 11v5" />
                          </Icon>

                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                )
              )}

              <button
                className="kairo-archive-toggle"
                onClick={() =>
                  setArchiveOpen(
                    !archiveOpen
                  )
                }
              >
                <span
                  style={{
                    display: "flex",
                    alignItems:
                      "center",
                    gap: 8,
                    fontSize: 11,
                  }}
                >
                  <Icon size={15}>
                    <path d="M4 7h16" />
                    <path d="M6 7v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7" />
                    <path d="M8 4h8l1 3H7l1-3Z" />
                  </Icon>

                  Archived
                </span>

                <Icon size={14}>
                  {archiveOpen ? (
                    <path d="m6 15 6-6 6 6" />
                  ) : (
                    <path d="m6 9 6 6 6-6" />
                  )}
                </Icon>
              </button>

              {archiveOpen && (
                <div>
                  {archivedChats.length ===
                  0 ? (
                    <div
                      style={{
                        padding:
                          "10px",
                        color:
                          "var(--muted2)",
                        fontSize: 10,
                      }}
                    >
                      No archived
                      conversations.
                    </div>
                  ) : (
                    archivedChats.map(
                      (chat) => (
                        <div
                          key={chat.id}
                          className="kairo-archive-item"
                        >
                          <div className="kairo-archive-name">
                            {
                              chat.title
                            }
                          </div>

                          <div className="kairo-archive-actions">
                            <button
                              className="restore"
                              onClick={() =>
                                restoreChat(
                                  chat.id
                                )
                              }
                            >
                              Restore
                            </button>

                            <button
                              className="delete"
                              onClick={() =>
                                deleteChat(
                                  chat.id
                                )
                              }
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

            <div className="kairo-side-bottom">
              <div className="kairo-account-card">
                <div className="kairo-account-row">
                  <div className="kairo-account-avatar">
                    <KairoMark small />
                  </div>

                  <div>
                    <div className="kairo-account-title">
                      KAIRO AI
                    </div>

                    <div className="kairo-account-sub">
                      Intelligent companion
                    </div>
                  </div>

                  <div className="kairo-online" />
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* ====================================================
            MAIN
        ==================================================== */}

        <section className="kairo-main">
          {/* TOP BAR */}

          <header className="kairo-topbar">
            <div className="kairo-topbar-left">
              {!sidebar && (
                <button
                  className="kairo-top-action"
                  onClick={() =>
                    setSidebar(true)
                  }
                  title="Open sidebar"
                >
                  <Icon size={17}>
                    <path d="M4 6h16" />
                    <path d="M4 12h16" />
                    <path d="M4 18h16" />
                  </Icon>
                </button>
              )}

              <KairoMark small />

              <div className="kairo-topbar-info">
                <div className="kairo-topbar-name">
                  KAIRO AI
                </div>

                <div className="kairo-topbar-status">
                  <span className="status-dot" />
                  Online · Groq intelligence
                </div>
              </div>
            </div>

            <div className="kairo-topbar-actions">
              <button
                className="kairo-top-action"
                onClick={
                  toggleTheme
                }
                title={
                  lightMode
                    ? "Dark mode"
                    : "Light mode"
                }
              >
                {lightMode ? (
                  <Icon size={17}>
                    <circle
                      cx="12"
                      cy="12"
                      r="4"
                    />
                    <path d="M12 2v2" />
                    <path d="M12 20v2" />
                    <path d="m4.93 4.93 1.42 1.42" />
                    <path d="m17.65 17.65 1.42 1.42" />
                    <path d="M2 12h2" />
                    <path d="M20 12h2" />
                    <path d="m6.35 17.65-1.42 1.42" />
                    <path d="m19.07 4.93-1.42 1.42" />
                  </Icon>
                ) : (
                  <Icon size={17}>
                    <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.6 6.6 0 0 0 21 12.8Z" />
                  </Icon>
                )}
              </button>

              <button
                className="kairo-top-action"
                disabled={!authReady}
                onClick={() =>
                  createChat()
                }
                title="New conversation"
              >
                <Icon size={17}>
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </Icon>
              </button>
            </div>
          </header>

          {/* MESSAGES */}

          <div className="kairo-messages">
            {messages.length ===
            0 ? (
              <div className="kairo-welcome">
                <div className="kairo-welcome-orb">
                  <div className="kairo-orb-inner">
                    <div className="kairo-orb-center">
                      <div className="kairo-orb-core" />
                    </div>
                  </div>
                </div>

                <div className="kairo-welcome-badge">
                  <span className="badge-dot" />
                  Your private AI workspace
                </div>

                <h1 className="kairo-welcome-title">
                  Meet{" "}
                  <span className="kairo-gradient">
                    KAIRO
                  </span>
                </h1>

                <p className="kairo-welcome-copy">
                  Think, build, learn and create
                  with an intelligent AI companion
                  designed to turn your ideas into
                  action.
                </p>

                <div className="kairo-pills">
                  <span className="kairo-pill">
                    Ask anything
                  </span>

                  <span className="kairo-pill">
                    Upload files
                  </span>

                  <span className="kairo-pill">
                    Analyze ideas
                  </span>

                  <span className="kairo-pill">
                    Build projects
                  </span>
                </div>

                <div className="kairo-prompts">
                  <button
                    className="kairo-prompt"
                    onClick={() =>
                      setInput(
                        "Explain quantum physics in a simple way"
                      )
                    }
                  >
                    <div className="kairo-prompt-icon">
                      <Icon size={17}>
                        <circle
                          cx="12"
                          cy="12"
                          r="8"
                        />
                        <path d="M12 8v4l3 2" />
                      </Icon>
                    </div>

                    <div className="kairo-prompt-label">
                      LEARN
                    </div>

                    <div className="kairo-prompt-title">
                      Explain something difficult
                      in a simple way.
                    </div>

                    <div className="kairo-prompt-arrow">
                      <Icon size={15}>
                        <path d="M5 12h14" />
                        <path d="m13 6 6 6-6 6" />
                      </Icon>
                    </div>
                  </button>

                  <button
                    className="kairo-prompt"
                    onClick={() =>
                      setInput(
                        "Help me build a modern website"
                      )
                    }
                  >
                    <div className="kairo-prompt-icon">
                      <Icon size={17}>
                        <path d="m8 9-4 3 4 3" />
                        <path d="m16 9 4 3-4 3" />
                        <path d="m14 5-4 14" />
                      </Icon>
                    </div>

                    <div className="kairo-prompt-label">
                      BUILD
                    </div>

                    <div className="kairo-prompt-title">
                      Turn an idea into a real
                      project.
                    </div>

                    <div className="kairo-prompt-arrow">
                      <Icon size={15}>
                        <path d="M5 12h14" />
                        <path d="m13 6 6 6-6 6" />
                      </Icon>
                    </div>
                  </button>

                  <button
                    className="kairo-prompt"
                    onClick={() =>
                      setInput(
                        "Give me a creative idea for a new project"
                      )
                    }
                  >
                    <div className="kairo-prompt-icon">
                      <Icon size={17}>
                        <path d="M9 18h6" />
                        <path d="M10 22h4" />
                        <path d="M8.5 14.5A6 6 0 1 1 15.5 14c-.9.7-1.5 1.5-1.5 2.5h-4c0-1-.6-1.8-1.5-2.5Z" />
                      </Icon>
                    </div>

                    <div className="kairo-prompt-label">
                      CREATE
                    </div>

                    <div className="kairo-prompt-title">
                      Explore a fresh idea and make
                      it real.
                    </div>

                    <div className="kairo-prompt-arrow">
                      <Icon size={15}>
                        <path d="M5 12h14" />
                        <path d="m13 6 6 6-6 6" />
                      </Icon>
                    </div>
                  </button>
                </div>

                <div className="kairo-welcome-footer">
                  KAIRO · Think beyond the obvious
                </div>
              </div>
            ) : (
              <div className="kairo-message-list">
                {messages.map(
                  (message) => {
                    const files =
                      message.attachments ||
                      [];

                    if (
                      message.role ===
                      "user"
                    ) {
                      return (
                        <div
                          key={
                            message.id
                          }
                          className="kairo-message user"
                        >
                          <div className="kairo-user-bubble">
                            {message.content && (
                              <div className="kairo-message-text">
                                {
                                  message.content
                                }
                              </div>
                            )}

                            {files.length >
                              0 && (
                              <div className="kairo-files">
                                {files.map(
                                  (
                                    file,
                                    index
                                  ) => (
                                    <div
                                      className="kairo-file-card"
                                      key={`${file.name}-${index}`}
                                    >
                                      <div className="kairo-file-icon">
                                        <Icon
                                          size={
                                            15
                                          }
                                        >
                                          <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                                        </Icon>
                                      </div>

                                      <div className="kairo-file-info">
                                        <div className="kairo-file-name">
                                          {
                                            file.name
                                          }
                                        </div>

                                        <div className="kairo-file-size">
                                          {
                                            file.size
                                              ? formatFileSize(
                                                  file.size
                                                )
                                              : "Attached file"
                                          }
                                        </div>
                                      </div>
                                    </div>
                                  )
                                )}
                              </div>
                            )}

                            <div
                              style={{
                                display:
                                  "flex",
                                justifyContent:
                                  "flex-end",
                                marginTop:
                                  6,
                              }}
                            >
                              <button
                                className="kairo-message-action"
                                onClick={() =>
                                  editMessage(
                                    message
                                  )
                                }
                              >
                                <Icon
                                  size={12}
                                >
                                  <path d="M12 20h9" />
                                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
                                </Icon>

                                Edit
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={
                          message.id
                        }
                        className="kairo-message"
                      >
                        <div className="kairo-assistant-message">
                          <div className="kairo-assistant-mark">
                            <div className="kairo-assistant-mark-inner" />
                          </div>

                          <div className="kairo-assistant-content">
                            <div className="kairo-assistant-header">
                              <span className="kairo-assistant-name">
                                KAIRO
                              </span>

                              <span className="kairo-ai-badge">
                                AI
                              </span>
                            </div>

                            {message.content ? (
                              <div className="kairo-assistant-text">
                                {
                                  message.content
                                }
                              </div>
                            ) : loading ? (
                              <div className="kairo-thinking">
                                <span />
                                <span />
                                <span />
                                <span
                                  style={{
                                    marginLeft: 5,
                                  }}
                                >
                                  Thinking
                                </span>
                              </div>
                            ) : null}

                            {files.length >
                              0 && (
                              <div className="kairo-files">
                                {files.map(
                                  (
                                    file,
                                    index
                                  ) => (
                                    <div
                                      className="kairo-file-card"
                                      key={`${file.name}-${index}`}
                                    >
                                      <div className="kairo-file-icon">
                                        <Icon
                                          size={
                                            15
                                          }
                                        >
                                          <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                                        </Icon>
                                      </div>

                                      <div className="kairo-file-info">
                                        <div className="kairo-file-name">
                                          {
                                            file.name
                                          }
                                        </div>

                                        <div className="kairo-file-size">
                                          {
                                            file.size
                                              ? formatFileSize(
                                                  file.size
                                                )
                                              : "Attached file"
                                          }
                                        </div>
                                      </div>
                                    </div>
                                  )
                                )}
                              </div>
                            )}

                            {message.content &&
                              !message.content.startsWith(
                                "⚠️"
                              ) && (
                                <div className="kairo-actions">
                                  <button
                                    className="kairo-message-action"
                                    onClick={() =>
                                      copyMessage(
                                        message.content
                                      )
                                    }
                                  >
                                    <Icon
                                      size={
                                        12
                                      }
                                    >
                                      <rect
                                        x="9"
                                        y="9"
                                        width="11"
                                        height="11"
                                        rx="2"
                                      />
                                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                    </Icon>

                                    Copy
                                  </button>

                                  <button
                                    className="kairo-message-action"
                                    disabled={
                                      loading
                                    }
                                    onClick={() =>
                                      regenerate(
                                        message
                                      )
                                    }
                                  >
                                    <Icon
                                      size={
                                        12
                                      }
                                    >
                                      <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4" />
                                      <path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4" />
                                    </Icon>

                                    Regenerate
                                  </button>
                                </div>
                              )}
                          </div>
                        </div>
                      </div>
                    );
                  }
                )}

                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* ====================================================
              COMPOSER
          ==================================================== */}

          <div className="kairo-composer-area">
            <div className="kairo-composer-width">
              {editingId && (
                <div className="kairo-edit-bar">
                  <div className="kairo-edit-label">
                    <Icon size={13}>
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
                    </Icon>

                    Editing message
                  </div>

                  <button
                    className="kairo-cancel"
                    onClick={
                      cancelEdit
                    }
                  >
                    Cancel
                  </button>
                </div>
              )}

              {attachments.length >
                0 && (
                <div className="kairo-pending-files">
                  {attachments.map(
                    (
                      file,
                      index
                    ) => (
                      <div
                        className="kairo-pending"
                        key={`${file.name}-${index}`}
                      >
                        <div className="kairo-pending-icon">
                          <Icon size={13}>
                            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                          </Icon>
                        </div>

                        <div
                          style={{
                            minWidth: 0,
                          }}
                        >
                          <div className="kairo-pending-name">
                            {
                              file.name
                            }
                          </div>

                          <div className="kairo-pending-size">
                            {file.size
                              ? formatFileSize(
                                  file.size
                                )
                              : "Uploaded"}
                          </div>
                        </div>

                        <button
                          className="kairo-remove"
                          onClick={() =>
                            removeAttachment(
                              index
                            )
                          }
                        >
                          <Icon size={12}>
                            <path d="M18 6 6 18" />
                            <path d="m6 6 12 12" />
                          </Icon>
                        </button>
                      </div>
                    )
                  )}
                </div>
              )}

              <div className="kairo-composer">
                <button
                  className="kairo-tool"
                  disabled={
                    uploading ||
                    loading
                  }
                  onClick={() =>
                    fileInput.current?.click()
                  }
                  title="Attach files"
                >
                  <Icon size={19}>
                    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </Icon>
                </button>

                <button
                  className="kairo-tool"
                  disabled={
                    uploading ||
                    loading
                  }
                  onClick={() =>
                    folderInput.current?.click()
                  }
                  title="Attach folder"
                >
                  <Icon size={18}>
                    <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
                  </Icon>
                </button>

                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  hidden
                  accept="image/*,video/*,.pdf,.txt,.csv,.json,.doc,.docx,.xls,.xlsx,.zip"
                  onChange={(event) =>
                    uploadFiles(
                      event.target.files
                    )
                  }
                />

                <input
                  ref={folderInput}
                  type="file"
                  multiple
                  hidden
                  {...({
                    webkitdirectory: "",
                    directory: "",
                  } as any)}
                  onChange={(event) =>
                    uploadFiles(
                      event.target.files
                    )
                  }
                />

                <textarea
                  className="kairo-textarea"
                  value={input}
                  onChange={(event) =>
                    setInput(
                      event.target.value
                    )
                  }
                  onKeyDown={
                    handleKeyDown
                  }
                  rows={1}
                  disabled={
                    uploading
                  }
                  placeholder={
                    uploading
                      ? "Uploading to secure storage..."
                      : editingId
                      ? "Edit your message..."
                      : "Message KAIRO..."
                  }
                />

                <button
                  className="kairo-send"
                  disabled={
                    loading ||
                    uploading ||
                    (!input.trim() &&
                      attachments.length ===
                        0)
                  }
                  onClick={() =>
                    sendMessage()
                  }
                  title="Send"
                >
                  {loading ? (
                    <span
                      style={{
                        width: 15,
                        height: 15,
                        border:
                          "2px solid rgba(255,255,255,.3)",
                        borderTopColor:
                          "white",
                        borderRadius:
                          "50%",
                        animation:
                          "kairo-spin 1s linear infinite",
                      }}
                    />
                  ) : (
                    <Icon
                      size={17}
                      strokeWidth={2}
                    >
                      <path d="M22 2 11 13" />
                      <path d="m22 2-7 20-4-9-9-4Z" />
                    </Icon>
                  )}
                </button>
              </div>

              <div className="kairo-disclaimer">
                <span>✦</span>
                KAIRO can make mistakes. Check
                important information.
                <span>✦</span>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}