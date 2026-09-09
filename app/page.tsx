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

type FeatureCredit = {
  feature_key: string;
  feature_name: string;
  provider: string;
  balance: number;
  total_granted: number;
  total_used: number;
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
  if (type.includes("pdf") || /\.pdf$/i.test(name)) return "pdf";

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

function formatCredits(value: number) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(Math.max(0, Number(value) || 0));
}

function featureIcon(feature: string) {
  switch (feature) {
    case "chat":
      return "✦";
    case "website_builder":
      return "⌘";
    case "image_generator":
      return "◈";
    case "video_generator":
      return "▶";
    case "voice_generator":
      return "◉";
    default:
      return "•";
  }
}

export default function Home() {
  const router = useRouter();

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
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);

  const [lightMode, setLightMode] = useState(false);

  const [agentOpen, setAgentOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState("ZUQEN AI");

  const [featureCredits, setFeatureCredits] = useState<
    FeatureCredit[]
  >([]);

  const [creditsLoading, setCreditsLoading] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("ZUQEN-theme");

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
    setSelectedAgent(agent);

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

    if (agent === "Voice Generator") {
      router.push("/generate-voice");
      return;
    }
  }

  async function loadFeatureCredits(userId: string) {
    try {
      setCreditsLoading(true);

      const { data, error } = await supabase
        .from("feature_credit_balances")
        .select(
          "feature_key,balance,total_granted,total_used"
        )
        .eq("user_id", userId);

      if (error) {
        console.error(
          "Failed to load feature credits:",
          error
        );
        return;
      }

      const { data: features, error: featureError } =
        await supabase
          .from("provider_features")
          .select(
            "feature_key,feature_name,provider,enabled"
          )
          .eq("enabled", true);

      if (featureError) {
        console.error(
          "Failed to load provider features:",
          featureError
        );
        return;
      }

      const balances = new Map(
        (data || []).map((item: any) => [
          item.feature_key,
          item,
        ])
      );

      const result: FeatureCredit[] = (features || []).map(
        (feature: any) => {
          const balance = balances.get(
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
        }
      );

      setFeatureCredits(result);
    } catch (error) {
      console.error(
        "Feature credit loading failed:",
        error
      );
    } finally {
      setCreditsLoading(false);
    }
  }

  async function initializeUser() {
    try {
      const {
        data: { user: existingUser },
      } = await supabase.auth.getUser();

      if (existingUser) {
        setUser(existingUser);

        await Promise.all([
          loadChats(existingUser.id),
          loadFeatureCredits(existingUser.id),
        ]);

        setAuthReady(true);
        return;
      }

      const { data, error } =
        await supabase.auth.signInAnonymously();

      if (error) throw error;

      if (data.user) {
        setUser(data.user);

        await Promise.all([
          loadChats(data.user.id),
          loadFeatureCredits(data.user.id),
        ]);
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
      await loadFeatureCredits(existingUser.id);
      return existingUser;
    }

    const { data, error } =
      await supabase.auth.signInAnonymously();

    if (error) throw error;

    if (!data.user) {
      throw new Error(
        "Unable to create anonymous session."
      );
    }

    setUser(data.user);
    await loadFeatureCredits(data.user.id);

    return data.user;
  }

  async function loadChats(userId: string) {
    const { data, error } = await supabase
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
      const currentUser = await ensureUser();

      const now = new Date().toISOString();

      const { data, error } = await supabase
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

      const { data, error } = await supabase
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

    const nextTitle = window.prompt(
      "Rename conversation",
      chat.title
    );

    if (!nextTitle?.trim()) {
      setMenuOpen(null);
      setMenuPosition(null);
      return;
    }

    const title = nextTitle.trim().slice(0, 100);

    const { error } = await supabase
      .from("ZUQEN_chats")
      .update({
        title,
        updated_at: new Date().toISOString(),
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
    const { error } = await supabase
      .from("ZUQEN_chats")
      .update({
        archived: true,
        updated_at: new Date().toISOString(),
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
    const { error } = await supabase
      .from("ZUQEN_chats")
      .update({
        archived: false,
        updated_at: new Date().toISOString(),
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
    const confirmed = window.confirm(
      "Delete this conversation permanently?"
    );

    if (!confirmed) {
      setMenuOpen(null);
      setMenuPosition(null);
      return;
    }

    const { error } = await supabase
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

    if (left < 8) left = 8;

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

  async function uploadFiles(
    fileList: FileList | null
  ) {
    if (!fileList?.length) return;

    try {
      setUploading(true);

      const currentUser = await ensureUser();

      const uploaded: Attachment[] = [];

      for (
        let index = 0;
        index < fileList.length;
        index++
      ) {
        const file = fileList.item(index);

        if (!file) continue;

        const formData = new FormData();

        formData.append("file", file);
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

        const response = await fetch(
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

  function removeAttachment(index: number) {
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
      const response = await fetch(
        "/api/chat",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            messages: history.map(
              (message) => ({
                role: message.role,
                content: message.content,
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

        let errorMessage =
          "ZUQEN AI request failed.";

        try {
          const parsed =
            JSON.parse(text);

          errorMessage =
            parsed?.error ||
            parsed?.message ||
            errorMessage;
        } catch {
          if (text) {
            errorMessage = text;
          }
        }

        throw new Error(errorMessage);
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
          { stream: true }
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

            /*
             * The API sends final credit
             * information here.
             *
             * Refresh from Supabase after
             * receiving it so Home always
             * shows the latest balance.
             */
            if (
              parsed.credits &&
              user?.id
            ) {
              void loadFeatureCredits(
                user.id
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

      if (user?.id) {
        await loadFeatureCredits(
          user.id
        );
      }
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

      if (user?.id) {
        await loadFeatureCredits(
          user.id
        );
      }
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

    const { error } =
      await supabase
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
    if (loading || uploading) return;

    const text = (
      forcedText ?? input
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

      let chatId = activeChat;

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
        const { error } =
          await supabase
            .from("ZUQEN_messages")
            .update({
              content: text,
            })
            .eq("id", editingId)
            .eq("chat_id", chatId);

        if (error) throw error;

        setMessages((previous) =>
          previous.map(
            (message) =>
              message.id === editingId
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

      const { error } =
        await supabase
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

    if (messageIndex === -1) return;

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

    if (!latestUser) return;

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, loading]);

  const activeChats =
    chats.filter(
      (chat) => !chat.archived
    );

  const archivedChats =
    chats.filter(
      (chat) => chat.archived
    );

  const totalCredits =
    featureCredits.reduce(
      (total, item) =>
        total + item.balance,
      0
    );

  const totalAllocatedCredits =
    featureCredits.reduce(
      (total, item) =>
        total + item.total_granted,
      0
    );

  const totalUsedCredits =
    featureCredits.reduce(
      (total, item) =>
        total + item.total_used,
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

  const chatCredits =
    featureCredits.find(
      (item) =>
        item.feature_key ===
        "chat"
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

        .ZUQEN-new-button:hover {
          transform: translateY(-1px);
        }

        .ZUQEN-history {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 6px 11px 16px;
        }

        .ZUQEN-history::-webkit-scrollbar,
        .ZUQEN-messages::-webkit-scrollbar {
          width: 5px;
        }

        .ZUQEN-history::-webkit-scrollbar-thumb,
        .ZUQEN-messages::-webkit-scrollbar-thumb {
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

        .ZUQEN-chat:hover,
        .ZUQEN-chat.active {
          color: var(--text);
          background: var(--panel-soft);
        }

        .ZUQEN-chat.active {
          border-color: var(--line);
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

        /* CREDIT CARD */

        .ZUQEN-credit-card {
          margin-top: 10px;
          padding: 13px;
          border: 1px solid var(--line);
          border-radius: 15px;
          background:
            linear-gradient(
              145deg,
              rgba(
                139,
                92,
                246,
                0.09
              ),
              var(--panel-soft)
            );
        }

        .ZUQEN-credit-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .ZUQEN-credit-title {
          font-size: 9px;
          font-weight: 850;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .ZUQEN-credit-total {
          margin-top: 5px;
          font-size: 23px;
          line-height: 1;
          font-weight: 850;
          letter-spacing: -0.04em;
        }

        .ZUQEN-credit-total-label {
          margin-top: 4px;
          color: var(--muted2);
          font-size: 7px;
        }

        .ZUQEN-credit-progress {
          height: 5px;
          margin-top: 12px;
          overflow: hidden;
          border-radius: 999px;
          background: var(--line);
        }

        .ZUQEN-credit-progress > div {
          height: 100%;
          border-radius: inherit;
          background:
            linear-gradient(
              90deg,
              #8b5cf6,
              #d946ef,
              #60a5fa
            );
        }

        .ZUQEN-credit-stats {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          margin-top: 8px;
          color: var(--muted2);
          font-size: 7px;
        }

        .ZUQEN-credit-features {
          margin-top: 11px;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .ZUQEN-credit-feature {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 7px;
          border-radius: 9px;
          background: var(--panel-soft);
        }

        .ZUQEN-credit-feature-icon {
          width: 23px;
          height: 23px;
          border-radius: 7px;
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
          font-size: 10px;
        }

        .ZUQEN-credit-feature-info {
          min-width: 0;
          flex: 1;
        }

        .ZUQEN-credit-feature-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 8px;
          font-weight: 700;
        }

        .ZUQEN-credit-feature-provider {
          margin-top: 2px;
          color: var(--muted2);
          font-size: 6px;
        }

        .ZUQEN-credit-feature-balance {
          font-size: 8px;
          font-weight: 800;
        }

        .ZUQEN-credit-warning {
          margin-top: 9px;
          padding: 7px 8px;
          border-radius: 8px;
          color: #fbbf24;
          background: rgba(
            251,
            191,
            36,
            0.07
          );
          font-size: 7px;
          line-height: 1.5;
        }

        .ZUQEN-credit-empty {
          margin-top: 9px;
          padding: 8px;
          border-radius: 8px;
          color: var(--danger);
          background: rgba(
            251,
            113,
            133,
            0.07
          );
          font-size: 7px;
          line-height: 1.5;
        }

        .ZUQEN-credit-get-more {
          width: 100%;
          margin-top: 9px;
          min-height: 31px;
          border: 1px solid
            rgba(
              139,
              92,
              246,
              0.25
            );
          border-radius: 9px;
          color: white;
          background:
            linear-gradient(
              135deg,
              #8b5cf6,
              #6366f1
            );
          font-size: 8px;
          font-weight: 800;
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

        .ZUQEN-messages {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
        }

        .ZUQEN-welcome {
          min-height: 100%;
          padding: 55px 20px 35px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
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
            ZUQEN-spin
            8s
            linear
            infinite;
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
          grid-template-columns: repeat(
            3,
            1fr
          );
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
            0 15px 45px
              var(--shadow);

          backdrop-filter: blur(25px);
          transition: 0.2s ease;
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
        }

        .ZUQEN-prompt-title {
          margin-top: 14px;
          font-size: 11px;
          font-weight: 800;
        }

        .ZUQEN-prompt-copy {
          margin-top: 7px;
          color: var(--muted);
          font-size: 9px;
          line-height: 1.6;
        }

        .ZUQEN-message-row {
          width: 100%;
          padding: 22px 20px;
          display: flex;
        }

        .ZUQEN-message-row.user {
          justify-content: flex-end;
        }

        .ZUQEN-message {
          max-width: min(
            780px,
            88%
          );
        }

        .ZUQEN-message-user {
          padding: 13px 15px;
          border-radius: 18px 18px 5px 18px;
          background:
            linear-gradient(
              135deg,
              rgba(
                139,
                92,
                246,
                0.88
              ),
              rgba(
                99,
                102,
                241,
                0.88
              )
            );
          color: white;
          font-size: 12px;
          line-height: 1.65;
          white-space: pre-wrap;
        }

        .ZUQEN-message-assistant {
          padding: 3px 0;
          color: var(--text);
          font-size: 13px;
          line-height: 1.8;
          white-space: pre-wrap;
        }

        .ZUQEN-message-tools {
          display: flex;
          gap: 5px;
          margin-top: 7px;
        }

        .ZUQEN-message-tool {
          width: 28px;
          height: 28px;
          border: 1px solid var(--line);
          border-radius: 8px;
          color: var(--muted2);
          background: var(--panel-soft);

          display: flex;
          align-items: center;
          justify-content: center;
        }

        .ZUQEN-message-tool:hover {
          color: var(--text);
          background: var(--panel-hover);
        }

        .ZUQEN-attachments {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 9px;
        }

        .ZUQEN-attachment {
          padding: 7px 9px;
          border: 1px solid var(--line);
          border-radius: 9px;
          background: var(--panel-soft);
          font-size: 8px;
          color: var(--muted);
        }

        .ZUQEN-composer-wrap {
          padding: 14px 20px 18px;
          flex-shrink: 0;
        }

        .ZUQEN-composer {
          width: min(
            900px,
            100%
          );
          margin: 0 auto;
          border: 1px solid var(--line);
          border-radius: 20px;
          background: var(--panel);
          box-shadow:
            0 20px 70px
              var(--shadow);
          backdrop-filter: blur(25px);
        }

        .ZUQEN-composer-edit {
          padding: 8px 13px;
          border-bottom: 1px solid var(--line-soft);
          color: #a78bfa;
          font-size: 8px;
        }

        .ZUQEN-composer-input {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          padding: 11px;
        }

        .ZUQEN-textarea {
          flex: 1;
          min-height: 45px;
          max-height: 180px;
          resize: none;
          border: 0;
          outline: 0;
          color: var(--text);
          background: transparent;
          font-size: 12px;
          line-height: 1.6;
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

          background:
            linear-gradient(
              135deg,
              #8b5cf6,
              #6366f1
            );

          display: flex;
          align-items: center;
          justify-content: center;
        }

        .ZUQEN-send:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .ZUQEN-composer-tools {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0 11px 11px;
        }

        .ZUQEN-composer-tool {
          width: 31px;
          height: 31px;
          border: 1px solid var(--line);
          border-radius: 9px;
          color: var(--muted);
          background: var(--panel-soft);

          display: flex;
          align-items: center;
          justify-content: center;
        }

        .ZUQEN-composer-tool:hover {
          color: var(--text);
          background: var(--panel-hover);
        }

        .ZUQEN-composer-hint {
          margin-left: auto;
          color: var(--muted2);
          font-size: 7px;
        }

        .ZUQEN-upload-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          padding: 0 11px 9px;
        }

        .ZUQEN-upload-item {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 6px 8px;
          border: 1px solid var(--line);
          border-radius: 9px;
          color: var(--muted);
          background: var(--panel-soft);
          font-size: 8px;
        }

        .ZUQEN-upload-remove {
          border: 0;
          background: transparent;
          color: var(--danger);
        }

        .ZUQEN-loading {
          display: inline-flex;
          gap: 4px;
          align-items: center;
        }

        .ZUQEN-loading span {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: currentColor;
          animation:
            ZUQEN-pulse
            1s
            infinite;
        }

        .ZUQEN-loading span:nth-child(2) {
          animation-delay: 0.15s;
        }

        .ZUQEN-loading span:nth-child(3) {
          animation-delay: 0.3s;
        }

        @keyframes ZUQEN-pulse {
          0%,
          100% {
            opacity: 0.25;
            transform: translateY(0);
          }

          50% {
            opacity: 1;
            transform: translateY(-2px);
          }
        }

        @keyframes ZUQEN-spin {
          from {
            transform: rotate(0deg);
          }

          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 850px) {
          .ZUQEN-sidebar {
            width: 260px;
          }

          .ZUQEN-sidebar-inner {
            width: 260px;
          }

          .ZUQEN-prompts {
            grid-template-columns: 1fr;
            max-width: 520px;
          }

          .ZUQEN-agent-button {
            min-width: 120px;
          }
        }

        @media (max-width: 650px) {
          .ZUQEN-sidebar {
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            box-shadow:
              20px 0 60px
                var(--shadow);
          }

          .ZUQEN-sidebar.closed {
            width: 0;
          }

          .ZUQEN-topbar {
            padding: 0 10px;
          }

          .ZUQEN-topbar-status {
            display: none;
          }

          .ZUQEN-agent-button {
            min-width: 105px;
          }

          .ZUQEN-message-row {
            padding: 15px 12px;
          }

          .ZUQEN-message {
            max-width: 94%;
          }

          .ZUQEN-composer-wrap {
            padding: 8px 9px 10px;
          }

          .ZUQEN-welcome {
            padding: 35px 14px 25px;
          }

          .ZUQEN-welcome-copy {
            font-size: 12px;
          }

          .ZUQEN-prompts {
            margin-top: 25px;
          }

          .ZUQEN-prompt {
            min-height: 115px;
          }
        }
      `}</style>

      {/* SIDEBAR */}

      <aside
        className={`ZUQEN-sidebar ${
          sidebar ? "" : "closed"
        }`}
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
                    INTELLIGENCE PLATFORM
                  </div>
                </div>
              </div>

              <button
                className="ZUQEN-icon-button"
                type="button"
                onClick={() =>
                  setSidebar(false)
                }
                title="Close sidebar"
              >
                <Icon size={16}>
                  <path d="M15 6l-6 6 6 6" />
                </Icon>
              </button>
            </div>

            <button
              className="ZUQEN-new-button"
              type="button"
              onClick={() =>
                void createChat()
              }
            >
              <Icon size={15}>
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </Icon>

              New conversation
            </button>

            {/* ZUQEN CREDIT DASHBOARD */}

            <div className="ZUQEN-credit-card">
              <div className="ZUQEN-credit-head">
                <div>
                  <div className="ZUQEN-credit-title">
                    ZUQEN Credits
                  </div>

                  <div className="ZUQEN-credit-total">
                    {creditsLoading
                      ? "..."
                      : formatCredits(
                          totalCredits
                        )}
                  </div>

                  <div className="ZUQEN-credit-total-label">
                    credits available
                  </div>
                </div>

                <Icon
                  size={20}
                  strokeWidth={1.6}
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="8"
                  />
                  <path d="M12 8v8" />
                  <path d="M9 12h6" />
                </Icon>
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
                            Provider-backed credits
                          </div>
                        </div>

                        <div
                          className="ZUQEN-credit-feature-balance"
                          style={{
                            color: low
                              ? "#fbbf24"
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
                chatCredits.balance <= 0 && (
                  <div className="ZUQEN-credit-empty">
                    Your Chat credits are
                    exhausted. Get more credits
                    to continue using ZUQEN AI.
                  </div>
                )}

              {totalCredits > 0 &&
                totalAllocatedCredits >
                  0 &&
                totalCredits <=
                  totalAllocatedCredits *
                    0.15 && (
                  <div className="ZUQEN-credit-warning">
                    Your ZUQEN credit balance is
                    running low.
                  </div>
                )}

              {totalCredits <= 0 &&
                featureCredits.length > 0 && (
                  <button
                    type="button"
                    className="ZUQEN-credit-get-more"
                    onClick={() => {
                      window.alert(
                        "Get More Credits will be available with ZUQEN Premium."
                      );
                    }}
                  >
                    Get More Credits
                  </button>
                )}
            </div>
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

            {activeChats.length === 0 ? (
              <div className="ZUQEN-empty-history">
                Your conversations will
                appear here.
              </div>
            ) : (
              activeChats.map((chat) => (
                <div
                  key={chat.id}
                  className={`ZUQEN-chat ${
                    activeChat === chat.id
                      ? "active"
                      : ""
                  }`}
                >
                  <button
                    type="button"
                    className="ZUQEN-chat-open"
                    onClick={() =>
                      void openChat(chat.id)
                    }
                    aria-label={`Open ${chat.title}`}
                  />

                  <div className="ZUQEN-chat-icon">
                    <Icon size={15}>
                      <path d="M4 5h16v11H7l-3 3V5z" />
                    </Icon>
                  </div>

                  <div className="ZUQEN-chat-title">
                    {chat.title}
                  </div>

                  <button
                    type="button"
                    className="ZUQEN-chat-more"
                    onClick={(event) =>
                      openChatMenu(
                        event,
                        chat.id
                      )
                    }
                  >
                    <Icon size={16}>
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
              ))
            )}

            <button
              type="button"
              className="ZUQEN-archive-toggle"
              onClick={() =>
                setArchiveOpen(
                  (value) => !value
                )
              }
            >
              <span>
                Archived
              </span>

              <span>
                {archivedChats.length}
              </span>
            </button>

            {archiveOpen &&
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
                        type="button"
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
                        type="button"
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
                    ZUQEN User
                  </div>

                  <div className="ZUQEN-account-sub">
                    {authReady
                      ? "Account active"
                      : "Connecting..."}
                  </div>
                </div>

                <div className="ZUQEN-online" />
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN */}

      <main className="ZUQEN-main">
        <header className="ZUQEN-topbar">
          <div className="ZUQEN-topbar-left">
            {!sidebar && (
              <button
                type="button"
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
                {activeChat
                  ? chats.find(
                      (chat) =>
                        chat.id ===
                        activeChat
                    )?.title ||
                    "ZUQEN AI"
                  : "ZUQEN AI"}
              </div>

              <div className="ZUQEN-topbar-status">
                <span className="status-dot" />
                {chatCredits
                  ? `${formatCredits(
                      chatCredits.balance
                    )} Chat credits available`
                  : "AI system ready"}
              </div>
            </div>
          </div>

          <div className="ZUQEN-topbar-actions">
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

                <span>
                  ▾
                </span>
              </button>

              {agentOpen && (
                <div className="ZUQEN-agent-dropdown">
                  <div className="ZUQEN-agent-dropdown-title">
                    SELECT AGENT
                  </div>

                  {[
                    [
                      "ZUQEN AI",
                      "AI Chat",
                    ],
                    [
                      "Website Builder",
                      "Build websites",
                    ],
                    [
                      "Image Generator",
                      "Generate images",
                    ],
                    [
                      "Video Generator",
                      "Generate videos",
                    ],
                    [
                      "Voice Generator",
                      "Generate voice",
                    ],
                  ].map(
                    ([name, description]) => (
                      <button
                        key={name}
                        type="button"
                        className={`ZUQEN-agent-option ${
                          selectedAgent ===
                          name
                            ? "selected"
                            : ""
                        }`}
                        onClick={() =>
                          selectAgent(
                            name
                          )
                        }
                      >
                        <span className="ZUQEN-agent-option-icon">
                          {featureIcon(
                            name ===
                              "ZUQEN AI"
                              ? "chat"
                              : name ===
                                "Website Builder"
                              ? "website_builder"
                              : name ===
                                "Image Generator"
                              ? "image_generator"
                              : name ===
                                "Video Generator"
                              ? "video_generator"
                              : "voice_generator"
                          )}
                        </span>

                        <span>
                          <strong>
                            {name}
                          </strong>

                          <small>
                            {description}
                          </small>
                        </span>

                        {selectedAgent ===
                          name && (
                          <span>
                            ✓
                          </span>
                        )}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              className="ZUQEN-top-action"
              onClick={toggleTheme}
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
                    <path d="M4.93 4.93l1.41 1.41" />
                    <path d="M17.66 17.66l1.41 1.41" />
                  </>
                ) : (
                  <>
                    <path d="M21 12.8A8.5 8.5 0 1111.2 3 6.7 6.7 0 0021 12.8z" />
                  </>
                )}
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

              <h1 className="ZUQEN-welcome-title">
                <span className="ZUQEN-gradient">
                  Think.
                </span>{" "}
                Create.
              </h1>

              <p className="ZUQEN-welcome-copy">
                Welcome to ZUQEN AI — your
                intelligent workspace for
                conversation, creation and
                powerful AI tools.
              </p>

              <div className="ZUQEN-pills">
                <span className="ZUQEN-pill">
                  AI Chat
                </span>

                <span className="ZUQEN-pill">
                  Website Builder
                </span>

                <span className="ZUQEN-pill">
                  Image Generation
                </span>

                <span className="ZUQEN-pill">
                  Video Generation
                </span>

                <span className="ZUQEN-pill">
                  Voice Generation
                </span>
              </div>

              <div className="ZUQEN-prompts">
                <button
                  type="button"
                  className="ZUQEN-prompt"
                  onClick={() =>
                    void sendMessage(
                      "Explain a complex topic to me in a simple way."
                    )
                  }
                >
                  <div className="ZUQEN-prompt-icon">
                    <Icon size={17}>
                      <path d="M12 3l2.2 5.3L20 10.5l-5.8 2.2L12 18l-2.2-5.3L4 10.5l5.8-2.2L12 3z" />
                    </Icon>
                  </div>

                  <div className="ZUQEN-prompt-title">
                    Learn something
                  </div>

                  <div className="ZUQEN-prompt-copy">
                    Break down difficult ideas
                    into clear explanations.
                  </div>
                </button>

                <button
                  type="button"
                  className="ZUQEN-prompt"
                  onClick={() =>
                    void sendMessage(
                      "Help me brainstorm a creative idea."
                    )
                  }
                >
                  <div className="ZUQEN-prompt-icon">
                    <Icon size={17}>
                      <path d="M9 18h6" />
                      <path d="M10 22h4" />
                      <path d="M8.5 14.5a6 6 0 117 0C14.5 15.5 14 16.5 14 18h-4c0-1.5-.5-2.5-1.5-3.5z" />
                    </Icon>
                  </div>

                  <div className="ZUQEN-prompt-title">
                    Brainstorm ideas
                  </div>

                  <div className="ZUQEN-prompt-copy">
                    Generate concepts, ideas and
                    creative directions.
                  </div>
                </button>

                <button
                  type="button"
                  className="ZUQEN-prompt"
                  onClick={() =>
                    void sendMessage(
                      "Help me write something professional."
                    )
                  }
                >
                  <div className="ZUQEN-prompt-icon">
                    <Icon size={17}>
                      <path d="M4 20h4L19 9a2 2 0 10-4-4L4 16v4z" />
                    </Icon>
                  </div>

                  <div className="ZUQEN-prompt-title">
                    Create with AI
                  </div>

                  <div className="ZUQEN-prompt-copy">
                    Write, improve and transform
                    your content.
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`ZUQEN-message-row ${
                    message.role === "user"
                      ? "user"
                      : ""
                  }`}
                >
                  <div className="ZUQEN-message">
                    {message.role ===
                      "user" ? (
                      <>
                        <div className="ZUQEN-message-user">
                          {message.content}
                        </div>

                        {message.attachments &&
                          message.attachments.length >
                            0 && (
                            <div className="ZUQEN-attachments">
                              {message.attachments.map(
                                (
                                  attachment,
                                  index
                                ) => (
                                  <div
                                    key={
                                      attachment.id ||
                                      `${attachment.name}-${index}`
                                    }
                                    className="ZUQEN-attachment"
                                  >
                                    {getFileIcon(
                                      attachment.name,
                                      attachment.type
                                    )}{" "}
                                    {
                                      attachment.name
                                    }{" "}
                                    ·{" "}
                                    {formatFileSize(
                                      attachment.size ||
                                        0
                                    )}
                                  </div>
                                )
                              )}
                            </div>
                          )}

                        <div className="ZUQEN-message-tools">
                          <button
                            type="button"
                            className="ZUQEN-message-tool"
                            title="Copy"
                            onClick={() =>
                              copyMessage(
                                message.content
                              )
                            }
                          >
                            <Icon size={13}>
                              <rect
                                x="8"
                                y="8"
                                width="11"
                                height="11"
                                rx="2"
                              />
                              <path d="M16 8V5a2 2 0 00-2-2H5a2 2 0 00-2 2v9a2 2 0 002 2h3" />
                            </Icon>
                          </button>

                          <button
                            type="button"
                            className="ZUQEN-message-tool"
                            title="Edit"
                            onClick={() =>
                              editMessage(
                                message
                              )
                            }
                          >
                            <Icon size={13}>
                              <path d="M4 20h4L19 9a2 2 0 10-4-4L4 16v4z" />
                            </Icon>
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="ZUQEN-message-assistant">
                          {message.content ||
                            (loading ? (
                              <span className="ZUQEN-loading">
                                <span />
                                <span />
                                <span />
                              </span>
                            ) : (
                              ""
                            ))}
                        </div>

                        <div className="ZUQEN-message-tools">
                          <button
                            type="button"
                            className="ZUQEN-message-tool"
                            title="Copy"
                            onClick={() =>
                              copyMessage(
                                message.content
                              )
                            }
                          >
                            <Icon size={13}>
                              <rect
                                x="8"
                                y="8"
                                width="11"
                                height="11"
                                rx="2"
                              />
                              <path d="M16 8V5a2 2 0 00-2-2H5a2 2 0 00-2 2v9a2 2 0 002 2h3" />
                            </Icon>
                          </button>

                          <button
                            type="button"
                            className="ZUQEN-message-tool"
                            title="Regenerate"
                            onClick={() =>
                              void regenerate(
                                message
                              )
                            }
                            disabled={loading}
                          >
                            <Icon size={13}>
                              <path d="M20 11a8.1 8.1 0 00-15.5-2M4 5v4h4" />
                              <path d="M4 13a8.1 8.1 0 0015.5 2M20 19v-4h-4" />
                            </Icon>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}

              <div ref={bottomRef} />
            </>
          )}
        </div>

        <div className="ZUQEN-composer-wrap">
          <div className="ZUQEN-composer">
            {editingId && (
              <div className="ZUQEN-composer-edit">
                Editing message
                <button
                  type="button"
                  onClick={cancelEdit}
                  style={{
                    float: "right",
                    border: 0,
                    background:
                      "transparent",
                    color: "inherit",
                  }}
                >
                  Cancel
                </button>
              </div>
            )}

            {attachments.length > 0 && (
              <div className="ZUQEN-upload-list">
                {attachments.map(
                  (
                    attachment,
                    index
                  ) => (
                    <div
                      key={`${attachment.name}-${index}`}
                      className="ZUQEN-upload-item"
                    >
                      <span>
                        {getFileIcon(
                          attachment.name,
                          attachment.type
                        )}
                      </span>

                      <span>
                        {attachment.name}
                      </span>

                      <button
                        type="button"
                        className="ZUQEN-upload-remove"
                        onClick={() =>
                          removeAttachment(
                            index
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

            <div className="ZUQEN-composer-input">
              <textarea
                className="ZUQEN-textarea"
                value={input}
                onChange={(event) =>
                  setInput(
                    event.target.value
                  )
                }
                onKeyDown={handleKeyDown}
                placeholder={
                  chatCredits &&
                  chatCredits.balance <= 0
                    ? "Chat credits exhausted..."
                    : "Message ZUQEN AI..."
                }
                disabled={
                  loading ||
                  uploading ||
                  Boolean(
                    chatCredits &&
                      chatCredits.balance <=
                        0
                  )
                }
              />

              <button
                type="button"
                className="ZUQEN-send"
                onClick={() =>
                  void sendMessage()
                }
                disabled={
                  loading ||
                  uploading ||
                  (!input.trim() &&
                    attachments.length ===
                      0) ||
                  Boolean(
                    chatCredits &&
                      chatCredits.balance <=
                        0
                  )
                }
                title={
                  chatCredits &&
                  chatCredits.balance <= 0
                    ? "Chat credits exhausted"
                    : "Send"
                }
              >
                {loading ? (
                  <Icon size={16}>
                    <path d="M12 2v4" />
                    <path d="M12 18v4" />
                    <path d="M4.93 4.93l2.83 2.83" />
                    <path d="M16.24 16.24l2.83 2.83" />
                  </Icon>
                ) : (
                  <Icon size={17}>
                    <path d="M22 2L11 13" />
                    <path d="M22 2l-7 20-4-9-9-4 20-7z" />
                  </Icon>
                )}
              </button>
            </div>

            <div className="ZUQEN-composer-tools">
              <button
                type="button"
                className="ZUQEN-composer-tool"
                title="Upload files"
                onClick={() =>
                  fileInput.current?.click()
                }
                disabled={
                  uploading ||
                  loading
                }
              >
                <Icon size={15}>
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </Icon>
              </button>

              <button
                type="button"
                className="ZUQEN-composer-tool"
                title="Upload folder"
                onClick={() =>
                  folderInput.current?.click()
                }
                disabled={
                  uploading ||
                  loading
                }
              >
                <Icon size={15}>
                  <path d="M3 7h7l2 2h9v10H3z" />
                </Icon>
              </button>

              <input
                ref={fileInput}
                type="file"
                multiple
                hidden
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
                  webkitdirectory:
                    "",
                  directory: "",
                } as any)}
                onChange={(event) =>
                  void uploadFiles(
                    event.target.files
                  )
                }
              />

              <span className="ZUQEN-composer-hint">
                Enter to send · Shift + Enter
                for new line
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* CHAT MENU */}

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
              type="button"
              onClick={() =>
                void renameChat(menuOpen)
              }
            >
              <Icon size={14}>
                <path d="M4 20h4L19 9a2 2 0 10-4-4L4 16v4z" />
              </Icon>
              Rename
            </button>

            <button
              type="button"
              onClick={() =>
                void archiveChat(menuOpen)
              }
            >
              <Icon size={14}>
                <path d="M4 7h16" />
                <path d="M6 7l1 13h10l1-13" />
                <path d="M9 7V4h6v3" />
              </Icon>
              Archive
            </button>

            <button
              type="button"
              className="danger-item"
              onClick={() =>
                void deleteChat(menuOpen)
              }
            >
              <Icon size={14}>
                <path d="M4 7h16" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
                <path d="M6 7l1 13h10l1-13" />
                <path d="M9 7V4h6v3" />
              </Icon>
              Delete
            </button>
          </div>
        )}
    </div>
  );
}