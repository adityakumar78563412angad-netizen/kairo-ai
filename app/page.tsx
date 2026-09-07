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

function ZUQENMark({ small = false }: { small?: boolean }) {
  return (
    <div className={`ZUQEN-mark ${small ? "small" : ""}`}>
      <div className="ZUQEN-mark-inner" />
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
    useState("ZUQEN AI");

  const fileInput =
    useRef<HTMLInputElement>(null);

  const folderInput =
    useRef<HTMLInputElement>(null);

  const bottomRef =
    useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedTheme =
      window.localStorage.getItem(
        "ZUQEN-theme"
      );

    if (savedTheme === "light") {
      setLightMode(true);
    }
  }, []);

  function toggleTheme() {
    setLightMode((previous) => {
      const next = !previous;

      window.localStorage.setItem(
        "ZUQEN-theme",
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

  if (agent === "Image Generator") {
    router.push("/image-generator");
    return;
  }
if (agent === "Video Generator") {
  router.push("/video-generator");
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
      .from("ZUQEN_chats")
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
        .from("ZUQEN_chats")
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
        .from("ZUQEN_messages")
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
      .from("ZUQEN_chats")
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
      .from("ZUQEN_chats")
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
      .from("ZUQEN_chats")
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
      .from("ZUQEN_chats")
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
            "ZUQEN AI request failed."
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
        .from("ZUQEN_messages")
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
          : "ZUQEN AI request failed.";

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
        .from("ZUQEN_messages")
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
      .from("ZUQEN_chats")
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
      .from("ZUQEN_chats")
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
          .from("ZUQEN_messages")
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
        .from("ZUQEN_messages")
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
          ".ZUQEN-textarea"
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
      .from("ZUQEN_messages")
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
      className={`ZUQEN-app ${
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

        .ZUQEN-app {
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

        .ZUQEN-app.light {
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

        .ZUQEN-mark {
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

        .ZUQEN-mark.small {
          width: 31px;
          height: 31px;
          border-radius: 10px;
        }

        .ZUQEN-mark-inner {
          width: 100%;
          height: 100%;
          border-radius: inherit;
          background: var(--bg);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .light .ZUQEN-mark-inner {
          background: white;
        }

        .ZUQEN-mark-inner::after {
          content: "";
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: white;
          box-shadow:
            0 0 14px white;
        }

        .ZUQEN-sidebar {
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

        .ZUQEN-sidebar.closed {
          width: 0;
          border-right: 0;
        }

        .ZUQEN-sidebar-inner {
          width: 300px;
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .ZUQEN-side-top {
          padding: 18px 14px 12px;
          flex-shrink: 0;
        }

        .ZUQEN-brand-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 16px;
        }

        .ZUQEN-brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .ZUQEN-brand-name {
          font-size: 13px;
          font-weight: 850;
          letter-spacing: 0.12em;
        }

        .ZUQEN-brand-sub {
          margin-top: 2px;
          color: var(--muted2);
          font-size: 8px;
          letter-spacing: 0.08em;
        }

        .ZUQEN-icon-button {
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

        .ZUQEN-icon-button:hover {
          color: var(--text);
          background: var(--panel-hover);
        }

        .ZUQEN-new-button {
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

        .ZUQEN-new-button:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .ZUQEN-new-button:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .ZUQEN-history {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 6px 11px 16px;
        }

        .ZUQEN-history::-webkit-scrollbar {
          width: 5px;
        }

        .ZUQEN-history::-webkit-scrollbar-thumb {
          background: var(--line);
          border-radius: 20px;
        }

        .ZUQEN-section-label {
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

        .ZUQEN-empty-history {
          padding: 35px 15px;
          text-align: center;
          color: var(--muted2);
          font-size: 10px;
          line-height: 1.7;
        }

        .ZUQEN-chat {
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

        .ZUQEN-chat:hover {
          color: var(--text);
          background: var(--panel-soft);
        }

        .ZUQEN-chat.active {
          color: var(--text);
          border-color: var(--line);
          background: var(--panel-soft);
        }

        .ZUQEN-chat-open {
          position: absolute;
          inset: 0;
          width: 100%;
          border: 0;
          background: transparent;
          z-index: 1;
        }

        .ZUQEN-chat-icon,
        .ZUQEN-chat-title {
          position: relative;
          z-index: 2;
          pointer-events: none;
        }

        .ZUQEN-chat-icon {
          flex-shrink: 0;
        }

        .ZUQEN-chat-title {
          flex: 1;
          min-width: 0;
          padding-right: 2px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 11px;
          font-weight: 550;
        }

        .ZUQEN-chat-more {
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

        .ZUQEN-chat-more:hover {
          color: var(--text);
          background: var(--panel-hover);
        }

        .ZUQEN-menu {
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

        .ZUQEN-menu button {
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

        .ZUQEN-menu button:hover {
          color: var(--text);
          background: var(--panel-hover);
        }

        .ZUQEN-menu button.danger-item {
          color: var(--danger);
        }

        .ZUQEN-menu button.danger-item:hover {
          background:
            rgba(
              251,
              113,
              133,
              0.08
            );
        }

        .ZUQEN-archive-toggle {
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

        .ZUQEN-archive-toggle:hover {
          color: var(--text);
        }

        .ZUQEN-archive-item {
          margin: 3px 0;
          padding: 9px;
          border-radius: 10px;
          background: var(--panel-soft);
        }

        .ZUQEN-archive-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 10px;
        }

        .ZUQEN-archive-actions {
          display: flex;
          gap: 6px;
          margin-top: 7px;
        }

        .ZUQEN-archive-actions button {
          padding: 4px 7px;
          border: 0;
          border-radius: 6px;
          font-size: 8px;
          background: transparent;
        }

        .ZUQEN-archive-actions .restore {
          color: #8b5cf6;
        }

        .ZUQEN-archive-actions .delete {
          color: var(--danger);
        }

        .ZUQEN-side-bottom {
          flex-shrink: 0;
          padding: 11px;
          border-top: 1px solid var(--line);
        }

        .ZUQEN-account-card {
          padding: 11px;
          border: 1px solid var(--line);
          border-radius: 14px;
          background: var(--panel-soft);
        }

        .ZUQEN-account-row {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .ZUQEN-account-avatar {
          width: 32px;
          height: 32px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .ZUQEN-account-title {
          font-size: 10px;
          font-weight: 800;
        }

        .ZUQEN-account-sub {
          margin-top: 2px;
          color: var(--muted2);
          font-size: 8px;
        }

        .ZUQEN-online {
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

        .ZUQEN-main {
          flex: 1;
          min-width: 0;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }

        .ZUQEN-topbar {
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

        .light .ZUQEN-topbar {
          background:
            rgba(
              255,
              255,
              255,
              0.58
            );
        }

        .ZUQEN-topbar-left {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .ZUQEN-topbar-info {
          min-width: 0;
        }

        .ZUQEN-topbar-name {
          font-size: 11px;
          font-weight: 850;
          letter-spacing: 0.08em;
        }

        .ZUQEN-topbar-status {
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

        .ZUQEN-topbar-actions {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .ZUQEN-top-action {
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

        .ZUQEN-top-action:hover {
          color: var(--text);
          background: var(--panel-hover);
        }

        /* AGENT SELECTOR */

        .ZUQEN-agent-selector {
          position: relative;
          z-index: 100;
        }

        .ZUQEN-agent-button {
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

        .ZUQEN-agent-button:hover,
        .ZUQEN-agent-button.active {
          border-color:
            rgba(
              139,
              92,
              246,
              0.3
            );
          background: var(--panel-hover);
        }

        .ZUQEN-agent-icon {
          color: #a78bfa;
          font-size: 14px;
        }

        .ZUQEN-agent-label {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          text-align: left;
          font-size: 9px;
          font-weight: 750;
        }

        .ZUQEN-agent-chevron {
          color: var(--muted2);
          font-size: 12px;
        }

        .ZUQEN-agent-dropdown {
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

        .ZUQEN-agent-dropdown-title {
          padding: 7px 9px 8px;
          color: var(--muted2);
          font-size: 7px;
          font-weight: 850;
          letter-spacing: 0.16em;
        }

        .ZUQEN-agent-option {
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

        .ZUQEN-agent-option:hover,
        .ZUQEN-agent-option.selected {
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

        .ZUQEN-agent-option-icon {
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

        .ZUQEN-agent-option > span:nth-child(2) {
          min-width: 0;
          flex: 1;
        }

        .ZUQEN-agent-option strong {
          display: block;
          font-size: 9px;
          font-weight: 750;
        }

        .ZUQEN-agent-option small {
          display: block;
          margin-top: 3px;
          color: var(--muted2);
          font-size: 7px;
        }

        .ZUQEN-agent-check {
          color: #a78bfa;
          font-size: 12px;
          font-weight: 800;
        }

        .ZUQEN-agent-divider {
          height: 1px;
          margin: 5px 2px;
          background: var(--line-soft);
        }

        .ZUQEN-agent-coming {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 9px;
          color: var(--muted2);
          font-size: 8px;
        }

        .ZUQEN-messages {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
        }

        .ZUQEN-messages::-webkit-scrollbar {
          width: 6px;
        }

        .ZUQEN-messages::-webkit-scrollbar-thumb {
          background: var(--line);
          border-radius: 20px;
        }

        /* WELCOME */

        .ZUQEN-welcome {
          min-height: 100%;
          padding: 55px 20px 35px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .ZUQEN-welcome-badge {
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

        .ZUQEN-welcome-orb {
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

        .light .ZUQEN-welcome-orb {
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

        .ZUQEN-orb-inner {
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
            ZUQEN-spin 8s linear infinite;
        }

        .ZUQEN-orb-center {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: var(--bg);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .light .ZUQEN-orb-center {
          background: white;
        }

        .ZUQEN-orb-core {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: white;
          box-shadow:
            0 0 25px white;
        }

        .ZUQEN-welcome-title {
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

        .ZUQEN-gradient {
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

        .ZUQEN-welcome-copy {
          max-width: 680px;
          margin: 20px auto 0;
          text-align: center;
          font-size: 14px;
          line-height: 1.8;
          color: var(--muted);
        }

        .ZUQEN-pills {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 7px;
          margin-top: 19px;
        }

        .ZUQEN-pill {
          padding: 6px 10px;
          border: 1px solid var(--line);
          border-radius: 999px;
          color: var(--muted2);
          background: var(--panel-soft);
          font-size: 9px;
        }

        .ZUQEN-prompts {
          width: 100%;
          max-width: 900px;
          display: grid;
          grid-template-columns:
            repeat(3, 1fr);
          gap: 11px;
          margin-top: 42px;
        }

        .ZUQEN-prompt {
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

        .ZUQEN-prompt:hover {
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

        .ZUQEN-prompt-icon {
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

        .ZUQEN-prompt-label {
          font-size: 8px;
          font-weight: 800;
          color: #a78bfa;
          letter-spacing: 0.18em;
        }

        .ZUQEN-prompt-title {
          margin-top: 7px;
          font-size: 12px;
          line-height: 1.55;
          font-weight: 650;
        }

        .ZUQEN-prompt-arrow {
          float: right;
          color: var(--muted2);
        }

        .ZUQEN-welcome-footer {
          margin-top: 28px;
          color: var(--muted2);
          font-size: 9px;
        }

        /* MESSAGES */

        .ZUQEN-message-list {
          width: min(900px, 100%);
          margin: auto;
          padding: 34px 22px 50px;
        }

        .ZUQEN-message {
          display: flex;
          margin-bottom: 30px;
          animation:
            ZUQEN-message-in 0.22s ease;
        }

        .ZUQEN-message.user {
          justify-content: flex-end;
        }

        .ZUQEN-user-bubble {
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

        .light .ZUQEN-user-bubble {
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

        .ZUQEN-message-text,
        .ZUQEN-assistant-text {
          white-space: pre-wrap;
          word-break: break-word;
          font-size: 14px;
          line-height: 1.8;
        }

        .ZUQEN-assistant-message {
          display: flex;
          gap: 13px;
          width: 100%;
        }

        .ZUQEN-assistant-mark {
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

        .ZUQEN-assistant-mark-inner {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: white;
          box-shadow:
            0 0 13px white;
        }

        .ZUQEN-assistant-content {
          min-width: 0;
          flex: 1;
          padding-top: 1px;
        }

        .ZUQEN-assistant-header {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 7px;
        }

        .ZUQEN-assistant-name {
          font-size: 11px;
          font-weight: 800;
        }

        .ZUQEN-ai-badge {
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

        .ZUQEN-assistant-text {
          color: var(--text);
        }

        .ZUQEN-thinking {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          color: var(--muted2);
        }

        .ZUQEN-thinking span {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #8b5cf6;
          animation:
            thinking 1s infinite
              ease-in-out;
        }

        .ZUQEN-thinking span:nth-child(2) {
          animation-delay: 0.12s;
        }

        .ZUQEN-thinking span:nth-child(3) {
          animation-delay: 0.24s;
        }

        .ZUQEN-actions {
          display: flex;
          gap: 3px;
          margin-top: 12px;
        }

        .ZUQEN-message-action {
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

        .ZUQEN-message-action:hover {
          color: var(--text);
          background: var(--panel-soft);
        }

        .ZUQEN-message-action:disabled {
          opacity: 0.3;
        }

        /* FILES */

        .ZUQEN-files {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 11px;
        }

        .ZUQEN-file-card {
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

        .ZUQEN-file-icon {
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

        .ZUQEN-file-info {
          min-width: 0;
        }

        .ZUQEN-file-name {
          font-size: 10px;
          font-weight: 650;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ZUQEN-file-size {
          margin-top: 2px;
          color: var(--muted2);
          font-size: 8px;
        }

        /* COMPOSER */

        .ZUQEN-composer-area {
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

        .ZUQEN-composer-width {
          width: min(900px, 100%);
          margin: auto;
        }

        .ZUQEN-edit-bar {
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

        .ZUQEN-edit-label {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #a78bfa;
        }

        .ZUQEN-cancel {
          border: 0;
          color: var(--muted);
          background: transparent;
          font-size: 9px;
        }

        .ZUQEN-cancel:hover {
          color: var(--text);
        }

        .ZUQEN-pending-files {
          display: flex;
          gap: 7px;
          flex-wrap: wrap;
          margin-bottom: 8px;
        }

        .ZUQEN-pending {
          max-width: 245px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 7px 8px;
          border: 1px solid var(--line);
          border-radius: 11px;
          background: var(--panel);
        }

        .ZUQEN-pending-icon {
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

        .ZUQEN-pending-name {
          max-width: 150px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 9px;
        }

        .ZUQEN-pending-size {
          color: var(--muted2);
          font-size: 8px;
        }

        .ZUQEN-remove {
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

        .ZUQEN-remove:hover {
          color: var(--danger);
          background:
            rgba(
              251,
              113,
              133,
              0.08
            );
        }

        .ZUQEN-composer {
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

        .ZUQEN-composer:focus-within {
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

        .ZUQEN-tool {
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

        .ZUQEN-tool:hover {
          color: var(--text);
          background: var(--panel-hover);
        }

        .ZUQEN-tool:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .ZUQEN-textarea {
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

        .ZUQEN-textarea::placeholder {
          color: var(--muted2);
        }

        .ZUQEN-send {
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

        .ZUQEN-send:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .ZUQEN-send:disabled {
          opacity: 0.22;
          box-shadow: none;
          cursor: not-allowed;
        }

        .ZUQEN-disclaimer {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          margin-top: 8px;
          color: var(--muted2);
          font-size: 8px;
        }

        @keyframes ZUQEN-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes ZUQEN-message-in {
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
          .ZUQEN-sidebar {
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

          .ZUQEN-sidebar.closed {
            transform: translateX(-100%);
            width: 300px;
          }

          .ZUQEN-prompts {
            grid-template-columns: 1fr;
          }

          .ZUQEN-welcome {
            padding:
              35px 18px 25px;
          }

          .ZUQEN-composer-area {
            padding:
              8px 10px 12px;
          }

          .ZUQEN-message-list {
            padding:
              25px 14px 35px;
          }
        }

        @media (max-width: 600px) {
          .ZUQEN-topbar {
            padding: 0 12px;
          }

          .ZUQEN-topbar-status {
            display: none;
          }

          .ZUQEN-agent-button {
            min-width: 40px;
            width: 40px;
            padding: 0;
            justify-content: center;
          }

          .ZUQEN-agent-label,
          .ZUQEN-agent-chevron {
            display: none;
          }

          .ZUQEN-agent-dropdown {
            right: -5px;
            width: 235px;
          }

          .ZUQEN-welcome-title {
            font-size: 48px;
          }

          .ZUQEN-welcome-copy {
            font-size: 12px;
          }

          .ZUQEN-tool {
            width: 34px;
          }

          .ZUQEN-send {
            width: 38px;
          }

          .ZUQEN-user-bubble {
            max-width: 92%;
          }
        }
      `}</style>

      {/* SIDEBAR */}

      <aside
        className={`ZUQEN-sidebar ${
          sidebar ? "" : "closed"
        }`}
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div className="ZUQEN-sidebar-inner">
          <div className="ZUQEN-side-top">
            <div className="ZUQEN-brand-row">
              <div className="ZUQEN-brand">
                <ZUQENMark />

                <div>
                  <div className="ZUQEN-brand-name">
                    ZUQEN
                  </div>

                  <div className="ZUQEN-brand-sub">
                    AI workspace
                  </div>
                </div>
              </div>

              <button
                className="ZUQEN-icon-button"
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
              className="ZUQEN-new-button"
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

          <div className="ZUQEN-history">
            <div className="ZUQEN-section-label">
              <span>
                Conversations
              </span>

              <span>
                {activeChats.length}
              </span>
            </div>

            {activeChats.length === 0 && (
              <div className="ZUQEN-empty-history">
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
                  className={`ZUQEN-chat ${
                    activeChat ===
                    chat.id
                      ? "active"
                      : ""
                  }`}
                >
                  <button
                    className="ZUQEN-chat-open"
                    onClick={() =>
                      void openChat(
                        chat.id
                      )
                    }
                    aria-label={`Open ${chat.title}`}
                  />

                  <div className="ZUQEN-chat-icon">
                    <Icon size={15}>
                      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
                    </Icon>
                  </div>

                  <div className="ZUQEN-chat-title">
                    {chat.title}
                  </div>

                  <button
                    className="ZUQEN-chat-more"
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
              className="ZUQEN-archive-toggle"
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
                        className="ZUQEN-archive-item"
                      >
                        <div className="ZUQEN-archive-name">
                          {chat.title}
                        </div>

                        <div className="ZUQEN-archive-actions">
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

          <div className="ZUQEN-side-bottom">
            <div className="ZUQEN-account-card">
              <div className="ZUQEN-account-row">
                <div className="ZUQEN-account-avatar">
                  <ZUQENMark small />
                </div>

                <div>
                  <div className="ZUQEN-account-title">
                    ZUQEN AI
                  </div>

                  <div className="ZUQEN-account-sub">
                    Intelligent companion
                  </div>
                </div>

                <div className="ZUQEN-online" />
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN */}

      <section className="ZUQEN-main">
        <header className="ZUQEN-topbar">
          <div className="ZUQEN-topbar-left">
            {!sidebar && (
              <button
                className="ZUQEN-top-action"
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

            <ZUQENMark small />

            <div className="ZUQEN-topbar-info">
              <div className="ZUQEN-topbar-name">
                ZUQEN AI
              </div>

              <div className="ZUQEN-topbar-status">
                <span className="status-dot" />
                Online · Groq intelligence
              </div>
            </div>
          </div>

          <div className="ZUQEN-topbar-actions">
            <button
              className="ZUQEN-top-action"
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
              className="ZUQEN-agent-selector"
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <button
                type="button"
                className={`ZUQEN-agent-button ${
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
                <span className="ZUQEN-agent-icon">
                  ✦
                </span>

                <span className="ZUQEN-agent-label">
                  {selectedAgent}
                </span>

                <span className="ZUQEN-agent-chevron">
                  {agentOpen
                    ? "⌃"
                    : "⌄"}
                </span>
              </button>

              {agentOpen && (
                <div className="ZUQEN-agent-dropdown">
                  <div className="ZUQEN-agent-dropdown-title">
                    SELECT AGENT
                  </div>

                  <button
                    type="button"
                    className={`ZUQEN-agent-option ${
                      selectedAgent ===
                      "ZUQEN AI"
                        ? "selected"
                        : ""
                    }`}
                    onClick={() =>
                      selectAgent(
                        "ZUQEN AI"
                      )
                    }
                  >
                    <span className="ZUQEN-agent-option-icon">
                      ✦
                    </span>

                    <span>
                      <strong>
                        ZUQEN AI
                      </strong>

                      <small>
                        General AI assistant
                      </small>
                    </span>

                    {selectedAgent ===
                      "ZUQEN AI" && (
                      <span className="ZUQEN-agent-check">
                        ✓
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    className={`ZUQEN-agent-option ${
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
                    <span className="ZUQEN-agent-option-icon">
                      ⌘
                    </span>

                    <span>
                      <strong>
                        Website Builder
                      </strong>

                      <small>
                        Build websites with ZUQEN
                      </small>
                    </span>

                    {selectedAgent ===
                      "Website Builder" && (
                      <span className="ZUQEN-agent-check">
                        ✓
                      </span>
                    )}
                  </button>

                  <button
  type="button"
  className={`ZUQEN-agent-option ${
    selectedAgent === "Image Generator"
      ? "selected"
      : ""
  }`}
  onClick={() =>
    selectAgent("Image Generator")
  }
>
  <span className="ZUQEN-agent-option-icon">
    ◇
  </span>

  <span>
    <strong>
      Image Generator
    </strong>

    <small>
      Create images with ZUQEN
    </small>
  </span>

  {selectedAgent ===
    "Image Generator" && (
    <span className="ZUQEN-agent-check">
      ✓
    </span>
  )}
</button>
<button
  type="button"
  className={`ZUQEN-agent-option ${
    selectedAgent === "Video Generator"
      ? "selected"
      : ""
  }`}
  onClick={() => selectAgent("Video Generator")}
>
  <span className="ZUQEN-agent-option-icon">
    ▶
  </span>

  <span>
    <strong>
      Video Generator
    </strong>

    <small>
      Create videos with ZUQEN
    </small>
  </span>

  {selectedAgent === "Video Generator" && (
    <span className="ZUQEN-agent-check">
      ✓
    </span>
  )}
</button>
                  <div className="ZUQEN-agent-divider" />

                  <div className="ZUQEN-agent-coming">
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
              className="ZUQEN-top-action"
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

        <div className="ZUQEN-messages">
          {messages.length === 0 ? (
            <div className="ZUQEN-welcome">
              <div className="ZUQEN-welcome-orb">
                <div className="ZUQEN-orb-inner">
                  <div className="ZUQEN-orb-center">
                    <div className="ZUQEN-orb-core" />
                  </div>
                </div>
              </div>

              <div className="ZUQEN-welcome-badge">
                <span className="badge-dot" />
                Your private AI workspace
              </div>

              <h1 className="ZUQEN-welcome-title">
                Meet{" "}
                <span className="ZUQEN-gradient">
                  ZUQEN
                </span>
              </h1>

              <p className="ZUQEN-welcome-copy">
                ZUQEN AI is your intelligent
                AI companion for chatting,
                learning, brainstorming,
                writing code, analyzing
                information, and getting
                things done.
              </p>

              <div className="ZUQEN-pills">
                <span className="ZUQEN-pill">
                  Ask anything
                </span>

                <span className="ZUQEN-pill">
                  Upload files
                </span>

                <span className="ZUQEN-pill">
                  Analyze ideas
                </span>

                <span className="ZUQEN-pill">
                  Build projects
                </span>
              </div>

              <div className="ZUQEN-prompts">
                <button
                  className="ZUQEN-prompt"
                  onClick={() =>
                    setInput(
                      "Explain quantum physics in a simple way"
                    )
                  }
                >
                  <div className="ZUQEN-prompt-icon">
                    <Icon size={17}>
                      <circle
                        cx="12"
                        cy="12"
                        r="8"
                      />
                      <path d="M12 8v4l3 2" />
                    </Icon>
                  </div>

                  <div className="ZUQEN-prompt-label">
                    LEARN
                  </div>

                  <div className="ZUQEN-prompt-title">
                    Explain something difficult
                    in a simple way.
                  </div>

                  <div className="ZUQEN-prompt-arrow">
                    <Icon size={15}>
                      <path d="M5 12h14" />
                      <path d="m13 6 6 6-6 6" />
                    </Icon>
                  </div>
                </button>

                <button
                  className="ZUQEN-prompt"
                  onClick={() =>
                    setInput(
                      "Help me build a modern website"
                    )
                  }
                >
                  <div className="ZUQEN-prompt-icon">
                    <Icon size={17}>
                      <path d="m8 9-4 3 4 3" />
                      <path d="m16 9 4 3-4 3" />
                      <path d="m14 5-4 14" />
                    </Icon>
                  </div>

                  <div className="ZUQEN-prompt-label">
                    BUILD
                  </div>

                  <div className="ZUQEN-prompt-title">
                    Turn an idea into a real
                    project.
                  </div>

                  <div className="ZUQEN-prompt-arrow">
                    <Icon size={15}>
                      <path d="M5 12h14" />
                      <path d="m13 6 6 6-6 6" />
                    </Icon>
                  </div>
                </button>

                <button
                  className="ZUQEN-prompt"
                  onClick={() =>
                    setInput(
                      "Give me a creative idea for a new project"
                    )
                  }
                >
                  <div className="ZUQEN-prompt-icon">
                    <Icon size={17}>
                      <path d="M9 18h6" />
                      <path d="M10 22h4" />
                      <path d="M8.5 14.5A6 6 0 1 1 15.5 14c-.9.7-1.5 1.5-1.5 2.5h-4c0-1-.6-1.8-1.5-2.5Z" />
                    </Icon>
                  </div>

                  <div className="ZUQEN-prompt-label">
                    CREATE
                  </div>

                  <div className="ZUQEN-prompt-title">
                    Explore a fresh idea and make
                    it real.
                  </div>

                  <div className="ZUQEN-prompt-arrow">
                    <Icon size={15}>
                      <path d="M5 12h14" />
                      <path d="m13 6 6 6-6 6" />
                    </Icon>
                  </div>
                </button>
              </div>

              <div className="ZUQEN-welcome-footer">
                ZUQEN · Think beyond the obvious
              </div>
            </div>
          ) : (
            <div className="ZUQEN-message-list">
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
                        className="ZUQEN-message user"
                      >
                        <div className="ZUQEN-user-bubble">
                          {message.content && (
                            <div className="ZUQEN-message-text">
                              {
                                message.content
                              }
                            </div>
                          )}

                          {files.length >
                            0 && (
                            <div className="ZUQEN-files">
                              {files.map(
                                (
                                  file,
                                  index
                                ) => (
                                  <div
                                    className="ZUQEN-file-card"
                                    key={`${file.name}-${index}`}
                                  >
                                    <div className="ZUQEN-file-icon">
                                      <Icon
                                        size={
                                          15
                                        }
                                      >
                                        <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                                      </Icon>
                                    </div>

                                    <div className="ZUQEN-file-info">
                                      <div className="ZUQEN-file-name">
                                        {
                                          file.name
                                        }
                                      </div>

                                      <div className="ZUQEN-file-size">
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
                              className="ZUQEN-message-action"
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
                      className="ZUQEN-message"
                    >
                      <div className="ZUQEN-assistant-message">
                        <div className="ZUQEN-assistant-mark">
                          <div className="ZUQEN-assistant-mark-inner" />
                        </div>

                        <div className="ZUQEN-assistant-content">
                          <div className="ZUQEN-assistant-header">
                            <span className="ZUQEN-assistant-name">
                              ZUQEN
                            </span>

                            <span className="ZUQEN-ai-badge">
                              AI
                            </span>
                          </div>

                          {message.content ? (
                            <div className="ZUQEN-assistant-text">
                              {
                                message.content
                              }
                            </div>
                          ) : loading ? (
                            <div className="ZUQEN-thinking">
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
                            <div className="ZUQEN-files">
                              {files.map(
                                (
                                  file,
                                  index
                                ) => (
                                  <div
                                    className="ZUQEN-file-card"
                                    key={`${file.name}-${index}`}
                                  >
                                    <div className="ZUQEN-file-icon">
                                      <Icon size={15}>
                                        <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                                      </Icon>
                                    </div>

                                    <div className="ZUQEN-file-info">
                                      <div className="ZUQEN-file-name">
                                        {
                                          file.name
                                        }
                                      </div>

                                      <div className="ZUQEN-file-size">
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
                              <div className="ZUQEN-actions">
                                <button
                                  className="ZUQEN-message-action"
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
                                  className="ZUQEN-message-action"
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

        <div className="ZUQEN-composer-area">
          <div className="ZUQEN-composer-width">
            {editingId && (
              <div className="ZUQEN-edit-bar">
                <div className="ZUQEN-edit-label">
                  <Icon size={13}>
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
                  </Icon>

                  Editing message
                </div>

                <button
                  className="ZUQEN-cancel"
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
              <div className="ZUQEN-pending-files">
                {attachments.map(
                  (
                    file,
                    index
                  ) => (
                    <div
                      className="ZUQEN-pending"
                      key={`${file.name}-${index}`}
                    >
                      <div className="ZUQEN-pending-icon">
                        <Icon size={13}>
                          <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                        </Icon>
                      </div>

                      <div
                        style={{
                          minWidth: 0,
                        }}
                      >
                        <div className="ZUQEN-pending-name">
                          {
                            file.name
                          }
                        </div>

                        <div className="ZUQEN-pending-size">
                          {file.size
                            ? formatFileSize(
                                file.size
                              )
                            : "Uploaded"}
                        </div>
                      </div>

                      <button
                        className="ZUQEN-remove"
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

            <div className="ZUQEN-composer">
              <button
                className="ZUQEN-tool"
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
                className="ZUQEN-tool"
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
                className="ZUQEN-textarea"
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
                    : "Message ZUQEN..."
                }
              />

              <button
                className="ZUQEN-send"
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
                        "ZUQEN-spin 1s linear infinite",
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

            <div className="ZUQEN-disclaimer">
              <span>✦</span>

              ZUQEN can make mistakes.
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
            className="ZUQEN-menu"
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