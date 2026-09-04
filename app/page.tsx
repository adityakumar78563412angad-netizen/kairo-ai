"use client";
import { useRouter } from "next/navigation";
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
    <div className={`kairo-mark ${small ? "small" : ""}`}>
      <div className="kairo-mark-inner" />
    </div>
  );
}

function formatFileSize(size: number) {
  if (!size) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(size) / Math.log(1024)),
    units.length - 1
  );

  return `${(size / Math.pow(1024, index)).toFixed(
    index === 0 ? 0 : 1
  )} ${units[index]}`;
}

function getFileIcon(name: string, type: string) {
  if (type.startsWith("image/")) return "image";

  if (type.startsWith("video/")) return "video";

  if (type.includes("pdf") || /\.pdf$/i.test(name)) {
    return "pdf";
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

  if (
    type.includes("zip") ||
    /\.(zip|rar|7z)$/i.test(name)
  ) {
    return "zip";
  }

  return "file";
}

export default function Home() {
  const router = useRouter();
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

  const [menuPosition, setMenuPosition] =
    useState<{
      top: number;
      left: number;
    } | null>(null);

  const [attachments, setAttachments] =
    useState<Attachment[]>([]);

  const [uploading, setUploading] =
    useState(false);

  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [lightMode, setLightMode] =
    useState(false);

  const [agentOpen, setAgentOpen] =
    useState(false);

  const [selectedAgent, setSelectedAgent] =
    useState("Kairo AI");

  const fileInput =
    useRef<HTMLInputElement>(null);

  const folderInput =
    useRef<HTMLInputElement>(null);

  const bottomRef =
    useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedTheme =
      window.localStorage.getItem(
        "kairo-theme"
      );

    if (savedTheme === "light") {
      setLightMode(true);
    }
  }, []);

  function toggleTheme() {
    setLightMode((previous) => {
      const next = !previous;

      window.localStorage.setItem(
        "kairo-theme",
        next ? "light" : "dark"
      );

      return next;
    });
  }

 function selectAgent(agent: string) {
  setAgentOpen(false);

  if (agent === "Website Builder") {
    router.push("/website-builder");
    return;
  }

  setSelectedAgent(agent);
}

  async function initializeUser() {
    try {
      const {
        data: { user: existingUser },
      } = await supabase.auth.getUser();

      if (existingUser) {
        setUser(existingUser);
        await loadChats(existingUser.id);
        setAuthReady(true);
        return;
      }

      const {
        data,
        error,
      } = await supabase.auth.signInAnonymously();

      if (error) throw error;

      if (data.user) {
        setUser(data.user);
        await loadChats(data.user.id);
      }

      setAuthReady(true);
    } catch (error) {
      console.error(
        "Authentication initialization failed:",
        error
      );

      setAuthReady(true);
    }
  }

  async function ensureUser() {
    if (user) return user;

    const {
      data: { user: existingUser },
    } = await supabase.auth.getUser();

    if (existingUser) {
      setUser(existingUser);
      return existingUser;
    }

    const {
      data,
      error,
    } = await supabase.auth.signInAnonymously();

    if (error) throw error;

    if (!data.user) {
      throw new Error(
        "Unable to create anonymous session."
      );
    }

    setUser(data.user);

    return data.user;
  }

  async function loadChats(userId: string) {
    const {
      data,
      error,
    } = await supabase
      .from("kairo_chats")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", {
        ascending: false,
      });

    if (error) {
      console.error(
        "Failed to load chats:",
        error
      );
      return;
    }

    setChats((data || []) as Chat[]);
  }

  async function createChat(): Promise<string | null> {
    try {
      const currentUser =
        await ensureUser();

      const now =
        new Date().toISOString();

      const {
        data,
        error,
      } = await supabase
        .from("kairo_chats")
        .insert({
          user_id: currentUser.id,
          title: "New conversation",
          archived: false,
          created_at: now,
          updated_at: now,
        })
        .select("*")
        .single();

      if (error) throw error;

      const newChat = data as Chat;

      setChats((previous) => [
        newChat,
        ...previous,
      ]);

      setActiveChat(newChat.id);
      setMessages([]);
      setAttachments([]);
      setEditingId(null);
      setMenuOpen(null);
      setMenuPosition(null);

      return newChat.id;
    } catch (error) {
      console.error(
        "Failed to create chat:",
        error
      );

      return null;
    }
  }

  async function openChat(id: string) {
    try {
      setActiveChat(id);
      setMenuOpen(null);
      setMenuPosition(null);
      setAttachments([]);
      setEditingId(null);

      const {
        data,
        error,
      } = await supabase
        .from("kairo_messages")
        .select("*")
        .eq("chat_id", id)
        .order("created_at", {
          ascending: true,
        });

      if (error) throw error;

      setMessages(
        ((data || []) as Message[]).map(
          (message) => ({
            ...message,
            attachments:
              message.attachments || [],
          })
        )
      );
    } catch (error) {
      console.error(
        "Failed to open chat:",
        error
      );
    }
  }

  async function renameChat(id: string) {
    const chat = chats.find(
      (item) => item.id === id
    );

    if (!chat) return;

    const nextTitle =
      window.prompt(
        "Rename conversation",
        chat.title
      );

    if (
      !nextTitle ||
      !nextTitle.trim()
    ) {
      setMenuOpen(null);
      setMenuPosition(null);
      return;
    }

    const title =
      nextTitle.trim().slice(0, 100);

    const {
      error,
    } = await supabase
      .from("kairo_chats")
      .update({
        title,
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error(
        "Failed to rename chat:",
        error
      );
      return;
    }

    setChats((previous) =>
      previous.map((item) =>
        item.id === id
          ? {
              ...item,
              title,
            }
          : item
      )
    );

    setMenuOpen(null);
    setMenuPosition(null);
  }

  async function archiveChat(id: string) {
    const {
      error,
    } = await supabase
      .from("kairo_chats")
      .update({
        archived: true,
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error(
        "Failed to archive chat:",
        error
      );
      return;
    }

    setChats((previous) =>
      previous.map((item) =>
        item.id === id
          ? {
              ...item,
              archived: true,
            }
          : item
      )
    );

    if (activeChat === id) {
      setActiveChat(null);
      setMessages([]);
    }

    setMenuOpen(null);
    setMenuPosition(null);
  }

  async function restoreChat(id: string) {
    const {
      error,
    } = await supabase
      .from("kairo_chats")
      .update({
        archived: false,
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error(
        "Failed to restore chat:",
        error
      );
      return;
    }

    setChats((previous) =>
      previous.map((item) =>
        item.id === id
          ? {
              ...item,
              archived: false,
            }
          : item
      )
    );
  }

  async function deleteChat(id: string) {
    const confirmed =
      window.confirm(
        "Delete this conversation permanently?"
      );

    if (!confirmed) {
      setMenuOpen(null);
      setMenuPosition(null);
      return;
    }

    const {
      error,
    } = await supabase
      .from("kairo_chats")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(
        "Failed to delete chat:",
        error
      );
      return;
    }

    setChats((previous) =>
      previous.filter(
        (item) => item.id !== id
      )
    );

    if (activeChat === id) {
      setActiveChat(null);
      setMessages([]);
    }

    setMenuOpen(null);
    setMenuPosition(null);
  }

  function openChatMenu(
    event: React.MouseEvent<HTMLButtonElement>,
    chatId: string
  ) {
    event.preventDefault();
    event.stopPropagation();

    if (menuOpen === chatId) {
      setMenuOpen(null);
      setMenuPosition(null);
      return;
    }

    const rect =
      event.currentTarget.getBoundingClientRect();

    const menuWidth = 178;
    const menuHeight = 145;

    let left = rect.right - menuWidth;
    let top = rect.bottom + 6;

    if (
      left <
      8
    ) {
      left = 8;
    }

    if (
      left + menuWidth >
      window.innerWidth - 8
    ) {
      left =
        window.innerWidth -
        menuWidth -
        8;
    }

    if (
      top + menuHeight >
      window.innerHeight - 8
    ) {
      top =
        rect.top -
        menuHeight -
        6;
    }

    setMenuPosition({
      top,
      left,
    });

    setMenuOpen(chatId);
  }

  useEffect(() => {
    initializeUser();
  }, []);

  useEffect(() => {
    function handleWindowClick() {
      setMenuOpen(null);
      setMenuPosition(null);
      setAgentOpen(false);
    }

    function handleResize() {
      setMenuOpen(null);
      setMenuPosition(null);
    }

    window.addEventListener(
      "click",
      handleWindowClick
    );

    window.addEventListener(
      "resize",
      handleResize
    );

    window.addEventListener(
      "scroll",
      handleResize,
      true
    );

    return () => {
      window.removeEventListener(
        "click",
        handleWindowClick
      );

      window.removeEventListener(
        "resize",
        handleResize
      );

      window.removeEventListener(
        "scroll",
        handleResize,
        true
      );
    };
  }, []);

  async function uploadFiles(
    fileList: FileList | null
  ) {
    if (!fileList?.length) return;

    try {
      setUploading(true);

      const currentUser =
        await ensureUser();

      const uploaded: Attachment[] =
        [];

      for (
        let index = 0;
        index < fileList.length;
        index++
      ) {
        const file =
          fileList.item(index);

        if (!file) continue;

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

        if (!response.ok) {
          const text =
            await response.text();

          throw new Error(
            text ||
              `Upload failed for ${file.name}`
          );
        }

        const result =
          await response.json();

        uploaded.push({
          name: file.name,
          type:
            file.type ||
            "application/octet-stream",
          size: file.size,
          url: result.url,
          key: result.key,
          relativePath:
            result.relativePath ||
            (
              file as File & {
                webkitRelativePath?: string;
              }
            ).webkitRelativePath ||
            file.name,
        });
      }

      setAttachments((previous) => [
        ...previous,
        ...uploaded,
      ]);
    } catch (error) {
      console.error(
        "File upload failed:",
        error
      );

      window.alert(
        error instanceof Error
          ? error.message
          : "File upload failed."
      );
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
        (_, itemIndex) =>
          itemIndex !== index
      )
    );
  }

  async function streamAI(
    chatId: string,
    history: Message[],
    currentAttachments: Attachment[] = []
  ) {
    setLoading(true);

    const assistantId =
      crypto.randomUUID();

    setMessages((previous) => [
      ...previous,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        attachments: [],
      },
    ]);

    try {
      const response =
        await fetch(
          "/api/chat",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              messages:
                history.map(
                  (message) => ({
                    role:
                      message.role,
                    content:
                      message.content,
                  })
                ),
              attachments:
                currentAttachments,
              agent: selectedAgent,
            }),
          }
        );

      if (!response.ok) {
        const text =
          await response.text();

        throw new Error(
          text ||
            "Kairo AI request failed."
        );
      }

      if (!response.body) {
        throw new Error(
          "AI response stream is unavailable."
        );
      }

      const reader =
        response.body.getReader();

      const decoder =
        new TextDecoder();

      let buffer = "";
      let assistantText = "";

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
            !trimmed ||
            trimmed ===
              "data: [DONE]"
          ) {
            continue;
          }

          if (
            !trimmed.startsWith(
              "data:"
            )
          ) {
            continue;
          }

          const raw =
            trimmed.slice(5).trim();

          try {
            const parsed =
              JSON.parse(raw);

            if (
              typeof parsed.text ===
              "string"
            ) {
              assistantText +=
                parsed.text;

              setMessages(
                (previous) =>
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
            if (raw) {
              assistantText += raw;

              setMessages(
                (previous) =>
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
          }
        }
      }

      if (!assistantText) {
        assistantText =
          "I couldn't generate a response.";

        setMessages(
          (previous) =>
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

      await supabase
        .from("kairo_messages")
        .insert({
          id: assistantId,
          chat_id: chatId,
          role: "assistant",
          content: assistantText,
          attachments: [],
        });
    } catch (error) {
      console.error(
        "AI streaming failed:",
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : "Kairo AI request failed.";

      const errorText =
        `⚠️ ${message}`;

      setMessages(
        (previous) =>
          previous.map(
            (item) =>
              item.id === assistantId
                ? {
                    ...item,
                    content:
                      errorText,
                  }
                : item
          )
      );

      await supabase
        .from("kairo_messages")
        .insert({
          id: assistantId,
          chat_id: chatId,
          role: "assistant",
          content: errorText,
          attachments: [],
        });
    } finally {
      setLoading(false);
    }
  }

  async function updateChatTitle(
    chatId: string,
    text: string
  ) {
    const title =
      text.trim().slice(0, 60);

    if (!title) return;

    const chat = chats.find(
      (item) => item.id === chatId
    );

    if (
      chat &&
      chat.title !==
        "New conversation"
    ) {
      return;
    }

    const {
      error,
    } = await supabase
      .from("kairo_chats")
      .update({
        title,
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", chatId);

    if (error) {
      console.error(
        "Failed to update title:",
        error
      );
      return;
    }

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
      [...previous]
        .map((item) =>
          item.id === chatId
            ? {
                ...item,
                updated_at: now,
              }
            : item
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

  async function sendMessage(
    forcedText?: string
  ) {
    if (loading || uploading) {
      return;
    }

    const text =
      (
        forcedText ??
        input
      ).trim();

    if (
      !text &&
      attachments.length === 0
    ) {
      return;
    }

    try {
      const currentUser =
        await ensureUser();

      let chatId =
        activeChat;

      if (!chatId) {
        chatId =
          await createChat();

        if (!chatId) {
          throw new Error(
            "Unable to create conversation."
          );
        }
      }

      if (editingId) {
        const {
          error,
        } = await supabase
          .from("kairo_messages")
          .update({
            content: text,
          })
          .eq("id", editingId)
          .eq(
            "chat_id",
            chatId
          );

        if (error) throw error;

        setMessages((previous) =>
          previous.map(
            (message) =>
              message.id ===
              editingId
                ? {
                    ...message,
                    content: text,
                  }
                : message
          )
        );

        setEditingId(null);
        setInput("");

        await updateChatTime(
          chatId
        );

        return;
      }

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        attachments:
          attachments.length
            ? attachments
            : [],
      };

      const historyForAI = [
        ...messages,
        userMessage,
      ];

      const {
        error,
      } = await supabase
        .from("kairo_messages")
        .insert({
          id: userMessage.id,
          chat_id: chatId,
          role: "user",
          content: text,
          attachments:
            attachments.length
              ? attachments
              : [],
        });

      if (error) throw error;

      setMessages(historyForAI);
      setInput("");

      const currentAttachments =
        attachments;

      setAttachments([]);

      await updateChatTitle(
        chatId,
        text || "File conversation"
      );

      await streamAI(
        chatId,
        historyForAI,
        currentAttachments
      );

      await updateChatTime(
        chatId
      );

      void currentUser;
    } catch (error) {
      console.error(
        "Send message failed:",
        error
      );

      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to send message."
      );

      setLoading(false);
    }
  }

  function copyMessage(
    content: string
  ) {
    navigator.clipboard
      ?.writeText(content)
      .catch((error) =>
        console.error(
          "Copy failed:",
          error
        )
      );
  }

  function editMessage(
    message: Message
  ) {
    setInput(message.content);
    setEditingId(message.id);

    requestAnimationFrame(() => {
      const textarea =
        document.querySelector(
          ".kairo-textarea"
        ) as HTMLTextAreaElement | null;

      textarea?.focus();
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setInput("");
  }

  async function regenerate(
    message: Message
  ) {
    if (
      loading ||
      !activeChat
    ) {
      return;
    }

    const messageIndex =
      messages.findIndex(
        (item) =>
          item.id === message.id
      );

    if (
      messageIndex === -1
    ) {
      return;
    }

    const previousUserMessages =
      messages
        .slice(0, messageIndex)
        .filter(
          (item) =>
            item.role === "user"
        );

    const latestUser =
      previousUserMessages[
        previousUserMessages.length - 1
      ];

    if (!latestUser) {
      return;
    }

    await supabase
      .from("kairo_messages")
      .delete()
      .eq("id", message.id);

    setMessages((previous) =>
      previous.filter(
        (item) =>
          item.id !== message.id
      )
    );

    await streamAI(
      activeChat,
      messages.filter(
        (item) =>
          item.id !== message.id
      ),
      latestUser.attachments || []
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

      void sendMessage();
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView(
      {
        behavior: "smooth",
      }
    );
  }, [messages, loading]);

  const activeChats =
    chats.filter(
      (chat) =>
        !chat.archived
    );

  const archivedChats =
    chats.filter(
      (chat) =>
        chat.archived
    );

  return (
    <div
      className={`kairo-app ${
        lightMode ? "light" : ""
      }`}
      onClick={() => {
        if (menuOpen) {
          setMenuOpen(null);
          setMenuPosition(null);
        }

        if (agentOpen) {
          setAgentOpen(false);
        }
      }}
    >
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
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
          background: #050608;
        }

        button,
        textarea,
        input {
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
          --panel-soft: rgba(
            255,
            255,
            255,
            0.045
          );
          --panel-hover: rgba(
            255,
            255,
            255,
            0.07
          );
          --line: rgba(
            255,
            255,
            255,
            0.085
          );
          --line-soft: rgba(
            255,
            255,
            255,
            0.055
          );
          --text: #f7f8fc;
          --muted: #9198aa;
          --muted2: #5f6779;
          --purple: #8b5cf6;
          --blue: #6366f1;
          --pink: #d946ef;
          --green: #34d399;
          --danger: #fb7185;
          --shadow: rgba(
            0,
            0,
            0,
            0.45
          );

          position: fixed;
          inset: 0;
          display: flex;
          overflow: hidden;
          color: var(--text);
          background:
            radial-gradient(
              circle at 70% 15%,
              rgba(
                99,
                102,
                241,
                0.08
              ),
              transparent 32%
            ),
            radial-gradient(
              circle at 20% 85%,
              rgba(
                139,
                92,
                246,
                0.07
              ),
              transparent 28%
            ),
            var(--bg);
        }

        .kairo-app.light {
          --bg: #f5f7fb;
          --bg2: #eef1f7;
          --panel: rgba(
            255,
            255,
            255,
            0.84
          );
          --panel-solid: #ffffff;
          --panel-soft: rgba(
            20,
            27,
            45,
            0.045
          );
          --panel-hover: rgba(
            20,
            27,
            45,
            0.07
          );
          --line: #e2e6ee;
          --line-soft: #edf0f5;
          --text: #171b26;
          --muted: #697286;
          --muted2: #99a1b1;
          --shadow: rgba(
            25,
            35,
            55,
            0.11
          );
        }

        .kairo-mark {
          width: 39px;
          height: 39px;
          flex-shrink: 0;
          border-radius: 13px;
          padding: 2px;
          display: flex;
          align-items: center;
          justify-content: center;
          background:
            conic-gradient(
              from 20deg,
              #8b5cf6,
              #d946ef,
              #3b82f6,
              #8b5cf6
            );
          box-shadow:
            0 8px 25px
              rgba(
                124,
                58,
                237,
                0.2
              );
        }

        .kairo-mark.small {
          width: 31px;
          height: 31px;
          border-radius: 10px;
        }

        .kairo-mark-inner {
          width: 100%;
          height: 100%;
          border-radius: inherit;
          background: var(--bg);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .light .kairo-mark-inner {
          background: white;
        }

        .kairo-mark-inner::after {
          content: "";
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: white;
          box-shadow:
            0 0 14px white;
        }

        .kairo-sidebar {
          position: relative;
          width: 300px;
          height: 100%;
          flex-shrink: 0;
          background: var(--panel);
          border-right: 1px solid var(--line);
          backdrop-filter: blur(32px);
          overflow: hidden;
          transition:
            width 0.3s ease,
            transform 0.3s ease;
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
          padding: 18px 14px 12px;
          flex-shrink: 0;
        }

        .kairo-brand-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 16px;
        }

        .kairo-brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .kairo-brand-name {
          font-size: 13px;
          font-weight: 850;
          letter-spacing: 0.12em;
        }

        .kairo-brand-sub {
          margin-top: 2px;
          color: var(--muted2);
          font-size: 8px;
          letter-spacing: 0.08em;
        }

        .kairo-icon-button {
          width: 34px;
          height: 34px;
          border: 1px solid var(--line);
          border-radius: 10px;
          color: var(--muted);
          background: var(--panel-soft);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .kairo-icon-button:hover {
          color: var(--text);
          background: var(--panel-hover);
        }

        .kairo-new-button {
          width: 100%;
          min-height: 43px;
          border: 1px solid
            rgba(
              139,
              92,
              246,
              0.22
            );
          border-radius: 12px;
          color: white;
          background:
            linear-gradient(
              135deg,
              rgba(
                139,
                92,
                246,
                0.9
              ),
              rgba(
                99,
                102,
                241,
                0.9
              )
            );
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 11px;
          font-weight: 700;
          box-shadow:
            0 12px 35px
              rgba(
                99,
                102,
                241,
                0.16
              );
        }

        .kairo-new-button:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .kairo-new-button:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .kairo-history {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 6px 11px 16px;
        }

        .kairo-history::-webkit-scrollbar {
          width: 5px;
        }

        .kairo-history::-webkit-scrollbar-thumb {
          background: var(--line);
          border-radius: 20px;
        }

        .kairo-section-label {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 7px 8px;
          color: var(--muted2);
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .kairo-empty-history {
          padding: 35px 15px;
          text-align: center;
          color: var(--muted2);
          font-size: 10px;
          line-height: 1.7;
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
          transition: 0.18s ease;
        }

        .kairo-chat:hover {
          color: var(--text);
          background: var(--panel-soft);
        }

        .kairo-chat.active {
          color: var(--text);
          border-color: var(--line);
          background: var(--panel-soft);
        }

        .kairo-chat-open {
          position: absolute;
          inset: 0;
          width: 100%;
          border: 0;
          background: transparent;
          z-index: 1;
        }

        .kairo-chat-icon,
        .kairo-chat-title {
          position: relative;
          z-index: 2;
          pointer-events: none;
        }

        .kairo-chat-icon {
          flex-shrink: 0;
        }

        .kairo-chat-title {
          flex: 1;
          min-width: 0;
          padding-right: 2px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 11px;
          font-weight: 550;
        }

        .kairo-chat-more {
          position: relative;
          z-index: 20;
          width: 30px;
          height: 30px;
          flex-shrink: 0;
          border: 0;
          border-radius: 9px;
          color: var(--muted2);
          background: transparent;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .kairo-chat-more:hover {
          color: var(--text);
          background: var(--panel-hover);
        }

        .kairo-menu {
          position: fixed;
          z-index: 999999;
          width: 178px;
          padding: 5px;
          border: 1px solid var(--line);
          border-radius: 14px;
          background: var(--panel-solid);
          box-shadow:
            0 25px 70px
              var(--shadow);
          backdrop-filter: blur(25px);
          pointer-events: auto;
        }

        .kairo-menu button {
          width: 100%;
          min-height: 36px;
          padding: 0 10px;
          border: 0;
          border-radius: 9px;
          color: var(--muted);
          background: transparent;
          display: flex;
          align-items: center;
          gap: 9px;
          text-align: left;
          font-size: 10px;
        }

        .kairo-menu button:hover {
          color: var(--text);
          background: var(--panel-hover);
        }

        .kairo-menu button.danger-item {
          color: var(--danger);
        }

        .kairo-menu button.danger-item:hover {
          background:
            rgba(
              251,
              113,
              133,
              0.08
            );
        }

        .kairo-archive-toggle {
          width: 100%;
          margin-top: 8px;
          padding: 11px 9px;
          border: 0;
          border-top: 1px solid var(--line-soft);
          color: var(--muted);
          background: transparent;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .kairo-archive-toggle:hover {
          color: var(--text);
        }

        .kairo-archive-item {
          margin: 3px 0;
          padding: 9px;
          border-radius: 10px;
          background: var(--panel-soft);
        }

        .kairo-archive-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 10px;
        }

        .kairo-archive-actions {
          display: flex;
          gap: 6px;
          margin-top: 7px;
        }

        .kairo-archive-actions button {
          padding: 4px 7px;
          border: 0;
          border-radius: 6px;
          font-size: 8px;
          background: transparent;
        }

        .kairo-archive-actions .restore {
          color: #8b5cf6;
        }

        .kairo-archive-actions .delete {
          color: var(--danger);
        }

        .kairo-side-bottom {
          flex-shrink: 0;
          padding: 11px;
          border-top: 1px solid var(--line);
        }

        .kairo-account-card {
          padding: 11px;
          border: 1px solid var(--line);
          border-radius: 14px;
          background: var(--panel-soft);
        }

        .kairo-account-row {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .kairo-account-avatar {
          width: 32px;
          height: 32px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .kairo-account-title {
          font-size: 10px;
          font-weight: 800;
        }

        .kairo-account-sub {
          margin-top: 2px;
          color: var(--muted2);
          font-size: 8px;
        }

        .kairo-online {
          width: 7px;
          height: 7px;
          margin-left: auto;
          border-radius: 50%;
          background: #34d399;
          box-shadow:
            0 0 10px
              rgba(
                52,
                211,
                153,
                0.7
              );
        }

        .kairo-main {
          flex: 1;
          min-width: 0;
          min-height: 0;
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
          background:
            rgba(
              5,
              6,
              8,
              0.4
            );
          backdrop-filter: blur(30px);
          z-index: 20;
        }

        .light .kairo-topbar {
          background:
            rgba(
              255,
              255,
              255,
              0.58
            );
        }

        .kairo-topbar-left {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .kairo-topbar-info {
          min-width: 0;
        }

        .kairo-topbar-name {
          font-size: 11px;
          font-weight: 850;
          letter-spacing: 0.08em;
        }

        .kairo-topbar-status {
          margin-top: 3px;
          color: var(--muted2);
          font-size: 8px;
        }

        .status-dot {
          display: inline-block;
          width: 5px;
          height: 5px;
          margin-right: 4px;
          border-radius: 50%;
          background: #34d399;
          box-shadow:
            0 0 8px
              rgba(
                52,
                211,
                153,
                0.65
              );
        }

        .kairo-topbar-actions {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .kairo-top-action {
          width: 38px;
          height: 38px;
          flex-shrink: 0;
          border: 1px solid var(--line);
          border-radius: 11px;
          color: var(--muted);
          background: var(--panel-soft);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .kairo-top-action:hover {
          color: var(--text);
          background: var(--panel-hover);
        }

        /* AGENT SELECTOR */

        .kairo-agent-selector {
          position: relative;
          z-index: 100;
        }

        .kairo-agent-button {
          min-width: 150px;
          height: 38px;
          padding: 0 10px;
          border: 1px solid var(--line);
          border-radius: 11px;
          color: var(--text);
          background: var(--panel-soft);
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .kairo-agent-button:hover,
        .kairo-agent-button.active {
          border-color:
            rgba(
              139,
              92,
              246,
              0.3
            );
          background: var(--panel-hover);
        }

        .kairo-agent-icon {
          color: #a78bfa;
          font-size: 14px;
        }

        .kairo-agent-label {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          text-align: left;
          font-size: 9px;
          font-weight: 750;
        }

        .kairo-agent-chevron {
          color: var(--muted2);
          font-size: 12px;
        }

        .kairo-agent-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          width: 245px;
          padding: 7px;
          border: 1px solid var(--line);
          border-radius: 15px;
          background: var(--panel-solid);
          box-shadow:
            0 25px 70px
              var(--shadow);
          backdrop-filter: blur(25px);
          z-index: 99999;
        }

        .kairo-agent-dropdown-title {
          padding: 7px 9px 8px;
          color: var(--muted2);
          font-size: 7px;
          font-weight: 850;
          letter-spacing: 0.16em;
        }

        .kairo-agent-option {
          width: 100%;
          min-height: 48px;
          padding: 7px 8px;
          border: 1px solid transparent;
          border-radius: 10px;
          color: var(--muted);
          background: transparent;
          display: flex;
          align-items: center;
          gap: 9px;
          text-align: left;
        }

        .kairo-agent-option:hover,
        .kairo-agent-option.selected {
          color: var(--text);
          border-color:
            rgba(
              139,
              92,
              246,
              0.16
            );
          background:
            rgba(
              139,
              92,
              246,
              0.07
            );
        }

        .kairo-agent-option-icon {
          width: 29px;
          height: 29px;
          flex-shrink: 0;
          border-radius: 9px;
          color: #a78bfa;
          background:
            rgba(
              139,
              92,
              246,
              0.1
            );
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .kairo-agent-option > span:nth-child(2) {
          min-width: 0;
          flex: 1;
        }

        .kairo-agent-option strong {
          display: block;
          font-size: 9px;
          font-weight: 750;
        }

        .kairo-agent-option small {
          display: block;
          margin-top: 3px;
          color: var(--muted2);
          font-size: 7px;
        }

        .kairo-agent-check {
          color: #a78bfa;
          font-size: 12px;
          font-weight: 800;
        }

        .kairo-agent-divider {
          height: 1px;
          margin: 5px 2px;
          background: var(--line-soft);
        }

        .kairo-agent-coming {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 9px;
          color: var(--muted2);
          font-size: 8px;
        }

        .kairo-messages {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
        }

        .kairo-messages::-webkit-scrollbar {
          width: 6px;
        }

        .kairo-messages::-webkit-scrollbar-thumb {
          background: var(--line);
          border-radius: 20px;
        }

        /* WELCOME */

        .kairo-welcome {
          min-height: 100%;
          padding: 55px 20px 35px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .kairo-welcome-badge {
          margin-top: 22px;
          padding: 6px 10px;
          border: 1px solid var(--line);
          border-radius: 999px;
          color: var(--muted2);
          background: var(--panel-soft);
          font-size: 8px;
        }

        .badge-dot {
          display: inline-block;
          width: 5px;
          height: 5px;
          margin-right: 6px;
          border-radius: 50%;
          background: #34d399;
        }

        .kairo-welcome-orb {
          width: 70px;
          height: 70px;
          border-radius: 50%;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          background:
            radial-gradient(
              circle,
              rgba(
                139,
                92,
                246,
                0.2
              ),
              transparent 65%
            );
          box-shadow:
            0 25px 75px
              rgba(
                0,
                0,
                0,
                0.2
              );
        }

        .light .kairo-welcome-orb {
          background:
            linear-gradient(
              145deg,
              white,
              #f1f3f8
            );
          box-shadow:
            0 25px 75px
              rgba(
                45,
                55,
                75,
                0.1
              );
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
        }

        .kairo-welcome-title {
          margin: 18px 0 0;
          font-size: clamp(
            43px,
            7vw,
            78px
          );
          line-height: 0.95;
          font-weight: 850;
          letter-spacing: -0.075em;
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
          max-width: 680px;
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
            transform 0.2s ease,
            border-color 0.2s ease,
            background 0.2s ease;
        }

        .kairo-prompt:hover {
          transform: translateY(-4px);
          border-color:
            rgba(
              139,
              92,
              246,
              0.3
            );
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
            rgba(
              139,
              92,
              246,
              0.1
            );
          margin-bottom: 25px;
        }

        .kairo-prompt-label {
          font-size: 8px;
          font-weight: 800;
          color: #a78bfa;
          letter-spacing: 0.18em;
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

        /* MESSAGES */

        .kairo-message-list {
          width: min(900px, 100%);
          margin: auto;
          padding: 34px 22px 50px;
        }

        .kairo-message {
          display: flex;
          margin-bottom: 30px;
          animation:
            kairo-message-in 0.22s ease;
        }

        .kairo-message.user {
          justify-content: flex-end;
        }

        .kairo-user-bubble {
          max-width: min(
            720px,
            85%
          );
          padding: 14px 17px;
          border-radius:
            20px 20px 6px 20px;
          border: 1px solid
            rgba(
              139,
              92,
              246,
              0.22
            );
          background:
            linear-gradient(
              135deg,
              rgba(
                139,
                92,
                246,
                0.16
              ),
              rgba(
                99,
                102,
                241,
                0.1
              )
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
            0 10px 30px
              rgba(
                45,
                55,
                80,
                0.06
              );
        }

        .kairo-message-text,
        .kairo-assistant-text {
          white-space: pre-wrap;
          word-break: break-word;
          font-size: 14px;
          line-height: 1.8;
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
            0 9px 25px
              rgba(
                124,
                58,
                237,
                0.2
              );
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
          background:
            rgba(
              139,
              92,
              246,
              0.09
            );
          border: 1px solid
            rgba(
              139,
              92,
              246,
              0.12
            );
          font-size: 7px;
          font-weight: 800;
          letter-spacing: 0.1em;
        }

        .kairo-assistant-text {
          color: var(--text);
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
            thinking 1s infinite
              ease-in-out;
        }

        .kairo-thinking span:nth-child(2) {
          animation-delay: 0.12s;
        }

        .kairo-thinking span:nth-child(3) {
          animation-delay: 0.24s;
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
          opacity: 0.3;
        }

        /* FILES */

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
            rgba(
              139,
              92,
              246,
              0.1
            );
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

        /* COMPOSER */

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
          border: 1px solid
            rgba(
              139,
              92,
              246,
              0.2
            );
          border-radius: 13px;
          background:
            rgba(
              139,
              92,
              246,
              0.07
            );
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
          background:
            rgba(
              139,
              92,
              246,
              0.1
            );
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
          background:
            rgba(
              251,
              113,
              133,
              0.08
            );
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
        }

        .kairo-composer:focus-within {
          border-color:
            rgba(
              139,
              92,
              246,
              0.32
            );
          box-shadow:
            0 20px 70px var(--shadow),
            0 0 0 3px
              rgba(
                139,
                92,
                246,
                0.055
              );
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
        }

        .kairo-tool:hover {
          color: var(--text);
          background: var(--panel-hover);
        }

        .kairo-tool:disabled {
          opacity: 0.3;
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
        }

        .kairo-send:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .kairo-send:disabled {
          opacity: 0.22;
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

        @keyframes kairo-spin {
          to {
            transform: rotate(360deg);
          }
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

        @keyframes thinking {
          0%,
          60%,
          100% {
            transform: translateY(0);
            opacity: 0.35;
          }

          30% {
            transform: translateY(-4px);
            opacity: 1;
          }
        }

        @media (max-width: 900px) {
          .kairo-sidebar {
            position: fixed;
            left: 0;
            top: 0;
            bottom: 0;
            box-shadow:
              20px 0 60px
                rgba(
                  0,
                  0,
                  0,
                  0.35
                );
          }

          .kairo-sidebar.closed {
            transform: translateX(-100%);
            width: 300px;
          }

          .kairo-prompts {
            grid-template-columns: 1fr;
          }

          .kairo-welcome {
            padding:
              35px 18px 25px;
          }

          .kairo-composer-area {
            padding:
              8px 10px 12px;
          }

          .kairo-message-list {
            padding:
              25px 14px 35px;
          }
        }

        @media (max-width: 600px) {
          .kairo-topbar {
            padding: 0 12px;
          }

          .kairo-topbar-status {
            display: none;
          }

          .kairo-agent-button {
            min-width: 40px;
            width: 40px;
            padding: 0;
            justify-content: center;
          }

          .kairo-agent-label,
          .kairo-agent-chevron {
            display: none;
          }

          .kairo-agent-dropdown {
            right: -5px;
            width: 235px;
          }

          .kairo-welcome-title {
            font-size: 48px;
          }

          .kairo-welcome-copy {
            font-size: 12px;
          }

          .kairo-tool {
            width: 34px;
          }

          .kairo-send {
            width: 38px;
          }

          .kairo-user-bubble {
            max-width: 92%;
          }
        }
      `}</style>

      {/* SIDEBAR */}

      <aside
        className={`kairo-sidebar ${
          sidebar ? "" : "closed"
        }`}
        onClick={(event) =>
          event.stopPropagation()
        }
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
                void createChat()
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

            {activeChats.length === 0 && (
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
                    className="kairo-chat-open"
                    onClick={() =>
                      void openChat(
                        chat.id
                      )
                    }
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
                    onClick={(event) =>
                      openChatMenu(
                        event,
                        chat.id
                      )
                    }
                    title="Options"
                    aria-label="Conversation options"
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
                          {chat.title}
                        </div>

                        <div className="kairo-archive-actions">
                          <button
                            className="restore"
                            onClick={() =>
                              void restoreChat(
                                chat.id
                              )
                            }
                          >
                            Restore
                          </button>

                          <button
                            className="delete"
                            onClick={() =>
                              void deleteChat(
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

      {/* MAIN */}

      <section className="kairo-main">
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

            {/* AGENT SELECTOR */}

            <div
              className="kairo-agent-selector"
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <button
                type="button"
                className={`kairo-agent-button ${
                  agentOpen
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  setAgentOpen(
                    (previous) =>
                      !previous
                  )
                }
                aria-expanded={
                  agentOpen
                }
              >
                <span className="kairo-agent-icon">
                  ✦
                </span>

                <span className="kairo-agent-label">
                  {selectedAgent}
                </span>

                <span className="kairo-agent-chevron">
                  {agentOpen
                    ? "⌃"
                    : "⌄"}
                </span>
              </button>

              {agentOpen && (
                <div className="kairo-agent-dropdown">
                  <div className="kairo-agent-dropdown-title">
                    SELECT AGENT
                  </div>

                  <button
                    type="button"
                    className={`kairo-agent-option ${
                      selectedAgent ===
                      "Kairo AI"
                        ? "selected"
                        : ""
                    }`}
                    onClick={() =>
                      selectAgent(
                        "Kairo AI"
                      )
                    }
                  >
                    <span className="kairo-agent-option-icon">
                      ✦
                    </span>

                    <span>
                      <strong>
                        Kairo AI
                      </strong>

                      <small>
                        General AI assistant
                      </small>
                    </span>

                    {selectedAgent ===
                      "Kairo AI" && (
                      <span className="kairo-agent-check">
                        ✓
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    className={`kairo-agent-option ${
                      selectedAgent ===
                      "Website Builder"
                        ? "selected"
                        : ""
                    }`}
                    onClick={() =>
                      selectAgent(
                        "Website Builder"
                      )
                    }
                  >
                    <span className="kairo-agent-option-icon">
                      ⌘
                    </span>

                    <span>
                      <strong>
                        Website Builder
                      </strong>

                      <small>
                        Build websites with Kairo
                      </small>
                    </span>

                    {selectedAgent ===
                      "Website Builder" && (
                      <span className="kairo-agent-check">
                        ✓
                      </span>
                    )}
                  </button>

                  <div className="kairo-agent-divider" />

                  <div className="kairo-agent-coming">
                    <span>
                      ◈
                    </span>

                    <span>
                      More agents coming soon
                    </span>
                  </div>
                </div>
              )}
            </div>

            <button
              className="kairo-top-action"
              disabled={!authReady}
              onClick={() =>
                void createChat()
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

        <div className="kairo-messages">
          {messages.length === 0 ? (
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
                Kairo AI is your intelligent
                AI companion for chatting,
                learning, brainstorming,
                writing code, analyzing
                information, and getting
                things done.
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
                                        {file.size
                                          ? formatFileSize(
                                              file.size
                                            )
                                          : "Attached file"}
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
                              marginTop: 6,
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
                              <Icon size={12}>
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
                                      <Icon size={15}>
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
                                        {file.size
                                          ? formatFileSize(
                                              file.size
                                            )
                                          : "Attached file"}
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
                                  <Icon size={12}>
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
                                    void regenerate(
                                      message
                                    )
                                  }
                                >
                                  <Icon size={12}>
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

        {/* COMPOSER */}

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
                  void uploadFiles(
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
                  void uploadFiles(
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
                  void sendMessage()
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

              KAIRO can make mistakes.
              Check important
              information.

              <span>✦</span>
            </div>
          </div>
        </div>
      </section>

      {/* CHAT MENU PORTAL-LIKE FIXED MENU */}

      {menuOpen &&
        menuPosition && (
          <div
            className="kairo-menu"
            style={{
              top: menuPosition.top,
              left: menuPosition.left,
            }}
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <button
              onClick={() =>
                void renameChat(
                  menuOpen
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
                void archiveChat(
                  menuOpen
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
                void deleteChat(
                  menuOpen
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
  );
}