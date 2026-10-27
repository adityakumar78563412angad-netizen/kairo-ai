"use client";

import { useEffect, useMemo, useState } from "react";

type Platform = {
  id: string;
  name: string;
  icon: string;
  description: string;
};

type Contact = {
  id: string;
  name: string;
  address: string;
  source?: "google-contact" | "gmail" | "telegram";
};

type ConnectionResponse = {
  id: string;
  provider: string;
  provider_account_id?: string | null;
  account_name?: string | null;
  account_email?: string | null;
  status: string;
  scopes?: string[] | null;
  created_at?: string;
  updated_at?: string;
};

type SendStatus =
  | "pending"
  | "sending"
  | "sent"
  | "failed";

type RecipientResult = {
  email?: string;
  chatId?: string;
  name?: string;
  status: "sent" | "failed";
  messageId?: string | number;
  threadId?: string;
  error?: string;
};

const PLATFORMS: Platform[] = [
  {
    id: "whatsapp",
    name: "WhatsApp",
    icon: "💬",
    description: "WhatsApp Business",
  },
  {
    id: "telegram",
    name: "Telegram",
    icon: "✈️",
    description: "Telegram",
  },
  {
    id: "email",
    name: "Email",
    icon: "✉️",
    description: "Gmail / Email",
  },
  {
    id: "instagram",
    name: "Instagram",
    icon: "◎",
    description: "Instagram",
  },
  {
    id: "messenger",
    name: "Messenger",
    icon: "⚡",
    description: "Facebook Messenger",
  },
  {
    id: "sms",
    name: "SMS",
    icon: "📱",
    description: "SMS",
  },
  {
    id: "google-chat",
    name: "Google Chat",
    icon: "💠",
    description: "Google Chat",
  },
  {
    id: "discord",
    name: "Discord",
    icon: "🎮",
    description: "Discord",
  },
];

export default function BulkMessengerPage() {
  const [connectedApps, setConnectedApps] =
    useState<string[]>([]);

  const [selectedApps, setSelectedApps] =
    useState<string[]>([]);

  const [activeApp, setActiveApp] =
    useState<string | null>(null);

  const [connectionsLoading, setConnectionsLoading] =
    useState(true);

  const [contactsByApp, setContactsByApp] =
    useState<Record<string, Contact[]>>({});

  const [contactsLoadingByApp, setContactsLoadingByApp] =
    useState<Record<string, boolean>>({});

  const [contactsLoadedByApp, setContactsLoadedByApp] =
    useState<Record<string, boolean>>({});

  const [selectedContactsByApp, setSelectedContactsByApp] =
    useState<Record<string, string[]>>({});

  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState("");

  const [attachmentName, setAttachmentName] =
    useState("");

  const [scheduleEnabled, setScheduleEnabled] =
    useState(false);

  const [scheduleDate, setScheduleDate] =
    useState("");

  const [scheduleTime, setScheduleTime] =
    useState("");

  const [connectModalApp, setConnectModalApp] =
    useState<Platform | null>(null);

  const [telegramBotToken, setTelegramBotToken] =
    useState("");

  const [telegramConnecting, setTelegramConnecting] =
    useState(false);

  const [notice, setNotice] =
    useState<string | null>(null);

  const [sending, setSending] =
    useState(false);

  const [sendStatusByContact, setSendStatusByContact] =
    useState<Record<string, SendStatus>>({});

  const [sendResults, setSendResults] =
    useState<RecipientResult[]>([]);

  const providerToPlatform: Record<string, string> = {
    google: "email",
    telegram: "telegram",
  };

  const platformToProvider: Record<string, string> = {
    email: "google",
    telegram: "telegram",
  };

  useEffect(() => {
    let cancelled = false;

    async function loadConnections() {
      try {
        setConnectionsLoading(true);

        const response = await fetch(
          "/api/connections",
          {
            method: "GET",
            cache: "no-store",
          }
        );

        if (!response.ok) {
          if (response.status === 401) {
            if (!cancelled) {
              setConnectedApps([]);
            }

            return;
          }

          throw new Error(
            "Failed to load connected accounts."
          );
        }

        const result: {
          connections?: ConnectionResponse[];
        } = await response.json();

        if (cancelled) {
          return;
        }

        const realConnectedApps =
          Array.isArray(result.connections)
            ? result.connections
                .filter(
                  (connection) =>
                    connection.status === "connected"
                )
                .map(
                  (connection) =>
                    providerToPlatform[
                      connection.provider
                    ] ?? null
                )
                .filter(
                  (
                    platformId: string | null
                  ): platformId is string =>
                    platformId !== null
                )
            : [];

        setConnectedApps([
          ...new Set(realConnectedApps),
        ]);
      } catch (error) {
        console.error(
          "Unable to load connected apps:",
          error
        );

        if (!cancelled) {
          setConnectedApps([]);
        }
      } finally {
        if (!cancelled) {
          setConnectionsLoading(false);
        }
      }
    }

    loadConnections();

    return () => {
      cancelled = true;
    };
  }, []);

  function showNotice(text: string) {
    setNotice(text);

    window.setTimeout(() => {
      setNotice(null);
    }, 4500);
  }

  async function loadContactsForApp(
    appId: string
  ) {
    if (!connectedApps.includes(appId)) {
      return;
    }

    if (contactsLoadingByApp[appId]) {
      return;
    }

    if (contactsLoadedByApp[appId]) {
      return;
    }

    try {
      setContactsLoadingByApp((current) => ({
        ...current,
        [appId]: true,
      }));

      let contacts: Contact[] = [];

      if (appId === "email") {
        const response = await fetch(
          "/api/connections/google/email-recipients",
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const result: {
          contacts?: Array<{
            id: string;
            name: string;
            email: string;
            source?:
              | "google-contact"
              | "gmail";
          }>;
          googleContactsCount?: number;
          gmailContactsCount?: number;
          totalContacts?: number;
          error?: string;
        } = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error ??
              "Unable to load email contacts."
          );
        }

        contacts = Array.isArray(result.contacts)
          ? result.contacts
              .filter(
                (contact) =>
                  contact.email?.trim()
              )
              .map((contact) => ({
                id: contact.id,
                name:
                  contact.name ||
                  contact.email,
                address: contact.email,
                source: contact.source,
              }))
          : [];
      } else if (appId === "telegram") {
        const response = await fetch(
          "/api/connections/telegram/contacts",
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const result: {
          contacts?: Array<{
            id: string;
            name?: string | null;
            username?: string | null;
            address?: string | null;
            chatId?: string | null;
            isEligible?: boolean;
          }>;
          count?: number;
          error?: string;
        } = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error ??
              "Unable to load Telegram contacts."
          );
        }

        contacts = Array.isArray(result.contacts)
          ? result.contacts
              .filter(
                (contact) =>
                  contact.address?.trim() &&
                  contact.isEligible !== false
              )
              .map((contact) => ({
                id: contact.id,
                name:
                  contact.name ||
                  contact.username ||
                  contact.address ||
                  "Telegram contact",
                address:
                  contact.address ||
                  contact.chatId ||
                  "",
                source: "telegram" as const,
              }))
          : [];
      } else {
        setContactsByApp((current) => ({
          ...current,
          [appId]: [],
        }));

        setContactsLoadedByApp((current) => ({
          ...current,
          [appId]: true,
        }));

        return;
      }

      setContactsByApp((current) => ({
        ...current,
        [appId]: contacts,
      }));

      setContactsLoadedByApp((current) => ({
        ...current,
        [appId]: true,
      }));
    } catch (error) {
      console.error(
        `Unable to load ${appId} contacts:`,
        error
      );

      showNotice(
        error instanceof Error
          ? error.message
          : `Unable to load ${appId} contacts.`
      );
    } finally {
      setContactsLoadingByApp((current) => ({
        ...current,
        [appId]: false,
      }));
    }
  }

  useEffect(() => {
    if (!activeApp) {
      return;
    }

    loadContactsForApp(activeApp);
  }, [activeApp, connectedApps]);

  async function handleDisconnect(
    platform: Platform
  ) {
    const provider =
      platformToProvider[platform.id];

    if (!provider) {
      showNotice(
        `${platform.name} disconnect is not available yet.`
      );

      return;
    }

    try {
      const response = await fetch(
        `/api/connections/${provider}/disconnect`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
        }
      );

      const result: {
        error?: string;
        warning?: string;
      } = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ??
            `Unable to disconnect ${platform.name}.`
        );
      }

      setConnectedApps((current) =>
        current.filter(
          (id) => id !== platform.id
        )
      );

      setSelectedApps((current) =>
        current.filter(
          (id) => id !== platform.id
        )
      );

      setSelectedContactsByApp((current) => {
        const next = { ...current };

        delete next[platform.id];

        return next;
      });

      setContactsByApp((current) => {
        const next = { ...current };

        delete next[platform.id];

        return next;
      });

      setContactsLoadedByApp((current) => {
        const next = { ...current };

        delete next[platform.id];

        return next;
      });

      setContactsLoadingByApp((current) => {
        const next = { ...current };

        delete next[platform.id];

        return next;
      });

      setActiveApp((current) =>
        current === platform.id
          ? null
          : current
      );

      setSendResults([]);
      setSendStatusByContact({});

      showNotice(
        result.warning ??
          `${platform.name} has been disconnected from ZUQEN.`
      );
    } catch (error) {
      console.error(
        "Disconnect error:",
        error
      );

      showNotice(
        error instanceof Error
          ? error.message
          : `Unable to disconnect ${platform.name}.`
      );
    }
  }

  const selectedPlatforms = useMemo(
    () =>
      PLATFORMS.filter((platform) =>
        selectedApps.includes(platform.id)
      ),
    [selectedApps]
  );

  const connectedPlatforms = useMemo(
    () =>
      PLATFORMS.filter((platform) =>
        connectedApps.includes(platform.id)
      ),
    [connectedApps]
  );

  const totalSelectedContacts = useMemo(() => {
    return Object.values(
      selectedContactsByApp
    ).reduce(
      (total, contacts) =>
        total + contacts.length,
      0
    );
  }, [selectedContactsByApp]);

  const selectedEmailContacts = useMemo(() => {
    const selectedIds =
      selectedContactsByApp.email ?? [];

    const contacts =
      contactsByApp.email ?? [];

    return contacts.filter((contact) =>
      selectedIds.includes(contact.id)
    );
  }, [
    selectedContactsByApp,
    contactsByApp,
  ]);

  const sentCount = sendResults.filter(
    (result) => result.status === "sent"
  ).length;

  const failedCount = sendResults.filter(
    (result) => result.status === "failed"
  ).length;

  function handleAppClick(
    platform: Platform
  ) {
    const isConnected =
      connectedApps.includes(platform.id);

    if (!isConnected) {
      setConnectModalApp(platform);
      return;
    }

    toggleSelectedApp(platform.id);
  }

  function toggleSelectedApp(
    platformId: string
  ) {
    if (!connectedApps.includes(platformId)) {
      const platform = PLATFORMS.find(
        (item) =>
          item.id === platformId
      );

      if (platform) {
        setConnectModalApp(platform);
      }

      return;
    }

    setSelectedApps((current) => {
      const alreadySelected =
        current.includes(platformId);

      if (alreadySelected) {
        const next = current.filter(
          (id) => id !== platformId
        );

        if (activeApp === platformId) {
          setActiveApp(
            next[0] ?? null
          );
        }

        return next;
      }

      if (!activeApp) {
        setActiveApp(platformId);
      }

      return [...current, platformId];
    });

    setSendResults([]);
    setSendStatusByContact({});
  }

  async function handleConnect(
    platform: Platform
  ) {
    if (platform.id === "email") {
      setConnectModalApp(null);

      window.location.href =
        "/api/connections/google/connect";

      return;
    }

    if (platform.id !== "telegram") {
      setConnectModalApp(null);

      showNotice(
        `${platform.name} connection is not available yet.`
      );

      return;
    }

    const token =
      telegramBotToken.trim();

    if (!token) {
      showNotice(
        "Enter your Telegram bot token first."
      );

      return;
    }

    if (telegramConnecting) {
      return;
    }

    try {
      setTelegramConnecting(true);

      const response = await fetch(
        "/api/connections/telegram/connect",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            botToken: token,
          }),
        }
      );

      const result: {
        error?: string;
        success?: boolean;
        connection?: {
          providerAccountId?: string;
          accountName?: string;
          username?: string | null;
        };
      } = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ??
            "Unable to connect Telegram."
        );
      }

      setConnectedApps((current) =>
        current.includes("telegram")
          ? current
          : [...current, "telegram"]
      );

      setTelegramBotToken("");
      setConnectModalApp(null);

      showNotice(
        `Telegram connected successfully${
          result.connection?.username
            ? ` as ${result.connection.username}`
            : ""
        }.`
      );
    } catch (error) {
      console.error(
        "Telegram connection error:",
        error
      );

      showNotice(
        error instanceof Error
          ? error.message
          : "Unable to connect Telegram."
      );
    } finally {
      setTelegramConnecting(false);
    }
  }

  function handleContactToggle(
    appId: string,
    contactId: string
  ) {
    if (!connectedApps.includes(appId)) {
      showNotice(
        "Connect this app first."
      );

      return;
    }

    setSelectedContactsByApp(
      (current) => {
        const existing =
          current[appId] ?? [];

        const next =
          existing.includes(contactId)
            ? existing.filter(
                (id) => id !== contactId
              )
            : [
                ...existing,
                contactId,
              ];

        return {
          ...current,
          [appId]: next,
        };
      }
    );

    setSendResults([]);
    setSendStatusByContact({});
  }

  async function handleSend() {
    if (sending) {
      return;
    }

    if (selectedApps.length === 0) {
      showNotice(
        "Select at least one connected app first."
      );

      return;
    }

    const disconnectedSelectedApp =
      selectedApps.find(
        (appId) =>
          !connectedApps.includes(appId)
      );

    if (disconnectedSelectedApp) {
      const platform =
        PLATFORMS.find(
          (item) =>
            item.id ===
            disconnectedSelectedApp
        );

      showNotice(
        `First connect ${
          platform?.name ??
          "this app"
        } before sending.`
      );

      return;
    }

    if (selectedApps.length > 1) {
      showNotice(
        "For now, send one channel at a time. Select only Email or Telegram."
      );

      return;
    }

    if (!message.trim()) {
      showNotice(
        "Write a message first."
      );

      return;
    }

    if (attachmentName) {
      showNotice(
        "Attachment sending is not enabled yet. Remove the attachment and send the text-only message."
      );

      return;
    }

    if (scheduleEnabled) {
      showNotice(
        "Scheduled sending is not connected yet. Turn off scheduling to send immediately."
      );

      return;
    }

    const activeSendApp =
      selectedApps[0];

    /*
     * ============================================================
     * TELEGRAM SEND
     * ============================================================
     */

    if (
      activeSendApp ===
      "telegram"
    ) {
      const selectedTelegramIds =
        selectedContactsByApp.telegram ??
        [];

      const selectedTelegramContacts =
        (
          contactsByApp.telegram ??
          []
        ).filter((contact) =>
          selectedTelegramIds.includes(
            contact.id
          )
        );

      if (
        selectedTelegramContacts.length ===
        0
      ) {
        showNotice(
          "Select at least one eligible Telegram contact first."
        );

        return;
      }

      if (
        selectedTelegramContacts.length >
        50
      ) {
        showNotice(
          "For now, one Telegram send action supports up to 50 recipients."
        );

        return;
      }

      const initialStatuses: Record<
        string,
        SendStatus
      > = {};

      for (
        const contact of
        selectedTelegramContacts
      ) {
        initialStatuses[
          contact.id
        ] = "pending";
      }

      setSendStatusByContact(
        initialStatuses
      );

      setSendResults([]);
      setSending(true);

      for (
        const contact of
        selectedTelegramContacts
      ) {
        setSendStatusByContact(
          (current) => ({
            ...current,
            [contact.id]:
              "sending",
          })
        );
      }

      try {
       const response = await fetch("/api/connections/telegram/send", {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              cache: "no-store",
              body: JSON.stringify({
                message:
                  message.trim(),
                contactIds:
                  selectedTelegramContacts.map(
                    (contact) =>
                      contact.id
                  ),
              }),
            }
          );

        /*
         * IMPORTANT:
         * Do not directly call response.json().
         * If Vercel/Next returns an HTML 404/500 page,
         * response.json() itself throws:
         * Unexpected token '<'
         *
         * Reading text first lets us display the real
         * server response safely.
         */

        const responseText =
          await response.text();

        let result: {
          success?: boolean;
          error?: string;
          results?: RecipientResult[];
          summary?: {
            requested?: number;
            eligible?: number;
            sent?: number;
            failed?: number;
          };
        } = {};

        if (responseText.trim()) {
          try {
            result =
              JSON.parse(
                responseText
              );
          } catch {
            const cleanResponse =
              responseText
                .replace(
                  /<[^>]*>/g,
                  " "
                )
                .replace(
                  /\s+/g,
                  " "
                )
                .trim()
                .slice(0, 500);

            result = {
              error:
                `Server returned an invalid response (HTTP ${response.status}). ` +
                cleanResponse,
            };
          }
        }

        if (!response.ok) {
          setSendStatusByContact(
            (current) => {
              const next = {
                ...current,
              };

              for (
                const contact of
                selectedTelegramContacts
              ) {
                next[
                  contact.id
                ] = "failed";
              }

              return next;
            }
          );

          showNotice(
            result.error ??
              `Telegram send request failed (HTTP ${response.status}).`
          );

          return;
        }

        const results =
          Array.isArray(
            result.results
          )
            ? result.results
            : [];

        setSendResults(
          results
        );

        setSendStatusByContact(
          (current) => {
            const next = {
              ...current,
            };

            for (
              const contact of
              selectedTelegramContacts
            ) {
              const resultForContact =
                results.find(
                  (item) =>
                    item.chatId ===
                    contact.address
                );

              next[
                contact.id
              ] =
                resultForContact?.status ===
                "sent"
                  ? "sent"
                  : "failed";
            }

            return next;
          }
        );

        const sent =
          result.summary?.sent ??
          results.filter(
            (item) =>
              item.status ===
              "sent"
          ).length;

        const failed =
          result.summary?.failed ??
          results.filter(
            (item) =>
              item.status ===
              "failed"
          ).length;

        showNotice(
          failed === 0
            ? `${sent} Telegram message${
                sent === 1
                  ? ""
                  : "s"
              } sent successfully.`
            : `${sent} sent, ${failed} failed. Check the status list below.`
        );
      } catch (error) {
        console.error(
          "Bulk Telegram sending error:",
          error
        );

        setSendStatusByContact(
          (current) => {
            const next = {
              ...current,
            };

            for (
              const contact of
              selectedTelegramContacts
            ) {
              next[
                contact.id
              ] = "failed";
            }

            return next;
          }
        );

        showNotice(
          error instanceof Error
            ? error.message
            : "Network error while sending Telegram messages."
        );
      } finally {
        setSending(false);
      }

      return;
    }

    /*
     * ============================================================
     * EMAIL SEND
     * ============================================================
     */

    if (
      activeSendApp !==
      "email"
    ) {
      showNotice(
        "Real sending is currently enabled for Email and Telegram."
      );

      return;
    }

    if (
      selectedEmailContacts.length ===
      0
    ) {
      showNotice(
        "Select at least one eligible email contact first."
      );

      return;
    }

    if (
      selectedEmailContacts.length >
      50
    ) {
      showNotice(
        "For now, one Gmail send action supports up to 50 recipients."
      );

      return;
    }

    if (!subject.trim()) {
      showNotice(
        "Enter an email subject first."
      );

      return;
    }

    const initialStatuses: Record<
      string,
      SendStatus
    > = {};

    for (
      const contact of
      selectedEmailContacts
    ) {
      initialStatuses[
        contact.id
      ] = "pending";
    }

    setSendStatusByContact(
      initialStatuses
    );

    setSendResults([]);
    setSending(true);

    for (
      const contact of
      selectedEmailContacts
    ) {
      setSendStatusByContact(
        (current) => ({
          ...current,
          [contact.id]:
            "sending",
        })
      );
    }

    try {
      const response =
        await fetch(
          "/api/bulk-messenger/email/send",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            cache: "no-store",
            body: JSON.stringify({
              subject:
                subject.trim(),
              message:
                message.trim(),
              recipients:
                selectedEmailContacts.map(
                  (contact) => ({
                    id: contact.id,
                    name:
                      contact.name,
                    email:
                      contact.address,
                  })
                ),
            }),
          }
        );

      const responseText =
        await response.text();

      let result: {
        error?: string;
        requiresReconnect?: boolean;
        results?: RecipientResult[];
        summary?: {
          sent: number;
          failed: number;
          total: number;
        };
      } = {};

      if (responseText.trim()) {
        try {
          result =
            JSON.parse(
              responseText
            );
        } catch {
          result = {
            error:
              `Server returned an invalid response (HTTP ${response.status}).`,
          };
        }
      }

      if (!response.ok) {
        showNotice(
          result.error ??
            "Gmail could not send the messages."
        );

        setSendStatusByContact(
          (current) => {
            const next = {
              ...current,
            };

            for (
              const contact of
              selectedEmailContacts
            ) {
              next[
                contact.id
              ] = "failed";
            }

            return next;
          }
        );

        return;
      }

      const results =
        Array.isArray(
          result.results
        )
          ? result.results
          : [];

      setSendResults(
        results
      );

      setSendStatusByContact(
        (current) => {
          const next = {
            ...current,
          };

          for (
            const contact of
            selectedEmailContacts
          ) {
            const resultForContact =
              results.find(
                (item) =>
                  item.email?.toLowerCase() ===
                  contact.address.toLowerCase()
              );

            next[
              contact.id
            ] =
              resultForContact?.status ===
              "sent"
                ? "sent"
                : "failed";
          }

          return next;
        }
      );

      const sent =
        result.summary?.sent ??
        results.filter(
          (item) =>
            item.status ===
            "sent"
        ).length;

      const failed =
        result.summary?.failed ??
        results.filter(
          (item) =>
            item.status ===
            "failed"
        ).length;

      showNotice(
        failed === 0
          ? `${sent} email${
              sent === 1
                ? ""
                : "s"
            } accepted by Gmail successfully.`
          : `${sent} sent, ${failed} failed. Check the status list below.`
      );
    } catch (error) {
      console.error(
        "Bulk email sending error:",
        error
      );

      setSendStatusByContact(
        (current) => {
          const next = {
            ...current,
          };

          for (
            const contact of
            selectedEmailContacts
          ) {
            next[
              contact.id
            ] = "failed";
          }

          return next;
        }
      );

      showNotice(
        error instanceof Error
          ? error.message
          : "Network error while sending email."
      );
    } finally {
      setSending(false);
    }
  }

  function getStatusLabel(
    status?: SendStatus
  ) {
    switch (status) {
      case "pending":
        return "Pending";

      case "sending":
        return "Sending...";

      case "sent":
        return "Sent";

      case "failed":
        return "Failed";

      default:
        return null;
    }
  }

  function getStatusClass(
    status?: SendStatus
  ) {
    switch (status) {
      case "pending":
        return "result-pending";

      case "sending":
        return "result-sending";

      case "sent":
        return "result-sent";

      case "failed":
        return "result-failed";

      default:
        return "";
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#111827]">
      <style jsx global>{`
        .telegram-token-input {
          display: block;
          width: 100%;
          box-sizing: border-box;
          margin-top: 14px;
          padding: 12px 14px;
          border-radius: 12px;
          border: 1px solid #d0d5dd;
          background: #ffffff;
          color: #111827;
          outline: none;
          font-size: 13px;
          line-height: 1.4;
        }

        .telegram-token-input::placeholder {
          color: #98a2b3;
        }

        .telegram-token-input:focus {
          border-color: #667085;
          box-shadow: 0 0 0 3px rgba(16, 24, 40, 0.06);
        }

        .modal-connect:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #f7f8fa;
        }

        .bulk-shell {
          min-height: 100vh;
          padding: 32px;
        }

        .bulk-container {
          max-width: 1400px;
          margin: 0 auto;
        }

        .bulk-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
          margin-bottom: 28px;
        }

        .bulk-title {
          font-size: 32px;
          font-weight: 750;
          letter-spacing: -0.8px;
          margin: 0;
        }

        .bulk-subtitle {
          margin: 8px 0 0;
          color: #667085;
          font-size: 15px;
          line-height: 1.6;
        }

        .connection-count {
          border: 1px solid #e4e7ec;
          background: rgba(255, 255, 255, 0.8);
          border-radius: 14px;
          padding: 11px 15px;
          font-size: 13px;
          color: #475467;
          white-space: nowrap;
        }

        .connection-count strong {
          color: #111827;
        }

        .apps-panel,
        .contacts-panel,
        .composer-panel,
        .preview-panel,
        .status-panel {
          background: rgba(255, 255, 255, 0.88);
          border: 1px solid #e4e7ec;
          border-radius: 20px;
          box-shadow: 0 10px 35px rgba(16, 24, 40, 0.045);
        }

        .apps-panel {
          padding: 22px;
          margin-bottom: 20px;
        }

        .section-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 20px;
          margin-bottom: 18px;
        }

        .section-title {
          font-size: 17px;
          font-weight: 700;
          margin: 0;
        }

        .section-description {
          margin: 5px 0 0;
          color: #667085;
          font-size: 13px;
        }

        .apps-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .app-card {
          position: relative;
          border: 1px solid #e4e7ec;
          background: #fff;
          border-radius: 16px;
          padding: 15px;
          text-align: left;
          cursor: pointer;
          transition:
            border-color 0.18s ease,
            box-shadow 0.18s ease,
            transform 0.18s ease;
        }

        .app-card:hover {
          transform: translateY(-1px);
          border-color: #c7ccd5;
          box-shadow: 0 8px 22px rgba(16, 24, 40, 0.07);
        }

        .app-card.selected {
          border-color: #111827;
          box-shadow: 0 0 0 1px #111827;
        }

        .app-card.connected {
          background: #fbfffc;
        }

        .app-card.not-connected {
          opacity: 0.92;
        }

        .app-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .app-icon {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          background: #f2f4f7;
          font-size: 21px;
        }

        .app-card.selected .app-icon {
          background: #111827;
        }

        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          border-radius: 999px;
          padding: 5px 8px;
          font-size: 10px;
          font-weight: 700;
        }

        .status-connected {
          background: #ecfdf3;
          color: #027a48;
        }

        .status-not-connected {
          background: #f2f4f7;
          color: #667085;
        }

        .app-name {
          margin-top: 13px;
          font-size: 14px;
          font-weight: 700;
        }

        .app-description {
          margin-top: 4px;
          color: #667085;
          font-size: 12px;
        }

        .app-action {
          margin-top: 13px;
          font-size: 12px;
          font-weight: 650;
          color: #344054;
        }

        .app-card.connected .app-action {
          color: #027a48;
        }

        .disconnect-button {
          margin-top: 10px;
          border: 1px solid #f04438;
          background: #fff;
          color: #b42318;
          border-radius: 9px;
          padding: 7px 10px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }

        .disconnect-button:hover {
          background: #fef3f2;
        }

        .main-grid {
          display: grid;
          grid-template-columns:
            minmax(0, 1.35fr)
            minmax(340px, 0.65fr);
          gap: 20px;
          align-items: start;
        }

        .contacts-panel {
          min-height: 500px;
          overflow: hidden;
        }

        .contacts-head {
          padding: 21px 22px 0;
        }

        .app-tabs {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding: 16px 22px 0;
        }

        .app-tab {
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          border: 1px solid #e4e7ec;
          background: #fff;
          border-radius: 11px;
          padding: 9px 12px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 650;
          color: #475467;
        }

        .app-tab.active {
          background: #111827;
          color: #fff;
          border-color: #111827;
        }

        .contact-area {
          padding: 20px 22px 24px;
        }

        .empty-contacts,
        .contacts-loading {
          min-height: 300px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          border: 1px dashed #d0d5dd;
          border-radius: 16px;
          padding: 35px;
          background: #fcfcfd;
        }

        .empty-icon {
          width: 52px;
          height: 52px;
          margin: 0 auto 14px;
          display: grid;
          place-items: center;
          border-radius: 15px;
          background: #f2f4f7;
          font-size: 22px;
        }

        .empty-title {
          font-size: 15px;
          font-weight: 700;
        }

        .empty-text {
          max-width: 480px;
          margin: 7px auto 0;
          color: #667085;
          font-size: 13px;
          line-height: 1.6;
        }

        .contacts-list {
          display: grid;
          gap: 9px;
        }

        .contact-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border: 1px solid #eaecf0;
          border-radius: 13px;
          cursor: pointer;
          background: #fff;
        }

        .contact-row:hover {
          border-color: #c7ccd5;
          background: #fcfcfd;
        }

        .contact-row input {
          width: 17px;
          height: 17px;
          flex: 0 0 auto;
        }

        .contact-info {
          min-width: 0;
          flex: 1;
        }

        .contact-name {
          font-size: 13px;
          font-weight: 650;
        }

        .contact-address {
          margin-top: 2px;
          color: #667085;
          font-size: 12px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .contact-source {
          flex: 0 0 auto;
          border-radius: 999px;
          padding: 5px 8px;
          background: #f2f4f7;
          color: #475467;
          font-size: 10px;
          font-weight: 700;
        }

        .composer-panel {
          padding: 20px;
        }

        .field-label {
          display: block;
          margin-bottom: 7px;
          color: #344054;
          font-size: 12px;
          font-weight: 700;
        }

        .subject-input {
          width: 100%;
          border: 1px solid #d0d5dd;
          border-radius: 12px;
          padding: 12px 13px;
          outline: none;
          font: inherit;
          font-size: 13px;
          margin-bottom: 12px;
        }

        .subject-input:focus {
          border-color: #98a2b3;
          box-shadow: 0 0 0 3px rgba(16, 24, 40, 0.06);
        }

        .textarea {
          width: 100%;
          min-height: 180px;
          resize: vertical;
          border: 1px solid #d0d5dd;
          border-radius: 14px;
          padding: 14px;
          outline: none;
          font: inherit;
          font-size: 14px;
          line-height: 1.6;
        }

        .textarea:focus {
          border-color: #98a2b3;
          box-shadow: 0 0 0 3px rgba(16, 24, 40, 0.06);
        }

        .composer-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 12px;
        }

        .attachment-button {
          border: 1px solid #d0d5dd;
          background: #fff;
          border-radius: 10px;
          padding: 9px 11px;
          cursor: pointer;
          font-size: 12px;
        }

        .attachment-input {
          display: none;
        }

        .schedule-box {
          margin-top: 18px;
          border-top: 1px solid #eaecf0;
          padding-top: 17px;
        }

        .schedule-toggle {
          display: flex;
          align-items: center;
          gap: 9px;
          font-size: 13px;
          font-weight: 650;
        }

        .schedule-fields {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 9px;
          margin-top: 12px;
        }

        .schedule-fields input {
          width: 100%;
          border: 1px solid #d0d5dd;
          border-radius: 10px;
          padding: 10px;
          font: inherit;
          font-size: 12px;
        }

        .preview-panel,
        .status-panel {
          margin-top: 20px;
          padding: 20px;
        }

        .preview-message {
          border: 1px solid #eaecf0;
          border-radius: 14px;
          background: #fcfcfd;
          padding: 14px;
          white-space: pre-wrap;
          word-break: break-word;
          font-size: 13px;
          line-height: 1.6;
          min-height: 100px;
        }

        .preview-subject {
          border: 1px solid #eaecf0;
          border-radius: 12px;
          background: #fcfcfd;
          padding: 11px 13px;
          margin-bottom: 9px;
          font-size: 13px;
        }

        .preview-subject strong {
          color: #667085;
          margin-right: 6px;
        }

        .send-meta {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-top: 10px;
          color: #667085;
          font-size: 11px;
        }

        .send-button {
          width: 100%;
          margin-top: 14px;
          border: 0;
          border-radius: 12px;
          background: #111827;
          color: #fff;
          padding: 13px 15px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .send-button:hover {
          background: #1f2937;
        }

        .send-button:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .result-summary {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 14px;
        }

        .summary-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 7px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
        }

        .summary-sent {
          background: #ecfdf3;
          color: #027a48;
        }

        .summary-failed {
          background: #fef3f2;
          color: #b42318;
        }

        .summary-total {
          background: #f2f4f7;
          color: #475467;
        }

        .result-list {
          display: grid;
          gap: 8px;
        }

        .result-row {
          display: flex;
          align-items: center;
          gap: 10px;
          border: 1px solid #eaecf0;
          border-radius: 12px;
          padding: 10px 12px;
          background: #fff;
        }

        .result-info {
          min-width: 0;
          flex: 1;
        }

        .result-name {
          font-size: 12px;
          font-weight: 700;
        }

        .result-email {
          margin-top: 2px;
          color: #667085;
          font-size: 11px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .result-status {
          flex: 0 0 auto;
          border-radius: 999px;
          padding: 5px 8px;
          font-size: 10px;
          font-weight: 800;
        }

        .result-pending {
          background: #f2f4f7;
          color: #475467;
        }

        .result-sending {
          background: #eff8ff;
          color: #175cd3;
        }

        .result-sent {
          background: #ecfdf3;
          color: #027a48;
        }

        .result-failed {
          background: #fef3f2;
          color: #b42318;
        }

        .result-error {
          margin-top: 4px;
          color: #b42318;
          font-size: 10px;
          line-height: 1.4;
        }

        .result-message-id {
          margin-top: 4px;
          color: #667085;
          font-size: 9px;
          word-break: break-all;
        }

        .notice {
          position: fixed;
          right: 22px;
          bottom: 22px;
          z-index: 100;
          max-width: 390px;
          border: 1px solid #d0d5dd;
          background: #111827;
          color: #fff;
          border-radius: 13px;
          padding: 13px 15px;
          box-shadow: 0 18px 50px rgba(16, 24, 40, 0.2);
          font-size: 13px;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 90;
          display: grid;
          place-items: center;
          padding: 20px;
          background: rgba(16, 24, 40, 0.42);
          backdrop-filter: blur(5px);
        }

        .connect-modal {
          width: min(440px, 100%);
          border-radius: 20px;
          background: #fff;
          border: 1px solid #eaecf0;
          box-shadow: 0 25px 80px rgba(16, 24, 40, 0.22);
          padding: 24px;
        }

        .modal-icon {
          width: 48px;
          height: 48px;
          display: grid;
          place-items: center;
          border-radius: 14px;
          background: #f2f4f7;
          font-size: 23px;
          margin-bottom: 16px;
        }

        .modal-title {
          margin: 0;
          font-size: 19px;
          font-weight: 750;
        }

        .modal-text {
          margin: 8px 0 0;
          color: #667085;
          font-size: 13px;
          line-height: 1.65;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 9px;
          margin-top: 22px;
        }

        .modal-cancel,
        .modal-connect {
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .modal-cancel {
          border: 1px solid #d0d5dd;
          background: #fff;
          color: #344054;
        }

        .modal-connect {
          border: 0;
          background: #111827;
          color: #fff;
        }

        @media (max-width: 1050px) {
          .apps-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .main-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 650px) {
          .bulk-shell {
            padding: 18px;
          }

          .bulk-header {
            flex-direction: column;
          }

          .bulk-title {
            font-size: 26px;
          }

          .apps-grid {
            grid-template-columns: 1fr;
          }

          .schedule-fields {
            grid-template-columns: 1fr;
          }

          .contact-source {
            display: none;
          }

          .result-row {
            align-items: flex-start;
          }
        }
      `}</style>

      <div className="bulk-shell">
        <div className="bulk-container">
          <header className="bulk-header">
            <div>
              <h1 className="bulk-title">
                Bulk Messenger
              </h1>

              <p className="bulk-subtitle">
                Connect your communication apps,
                select eligible contacts, compose one
                message, and send or schedule it.
              </p>
            </div>

            <div className="connection-count">
              {connectionsLoading ? (
                <strong>
                  Checking connections...
                </strong>
              ) : (
                <>
                  <strong>
                    {connectedPlatforms.length}
                  </strong>{" "}
                  connected
                  {" · "}
                  <strong>
                    {selectedApps.length}
                  </strong>{" "}
                  selected
                </>
              )}
            </div>
          </header>

          <section className="apps-panel">
            <div className="section-head">
              <div>
                <h2 className="section-title">
                  Connect & Select Apps
                </h2>

                <p className="section-description">
                  Only connected apps can be selected
                  for messaging.
                </p>
              </div>
            </div>

            <div className="apps-grid">
              {PLATFORMS.map((platform) => {
                const isConnected =
                  connectedApps.includes(
                    platform.id
                  );

                const isSelected =
                  selectedApps.includes(
                    platform.id
                  );

                return (
                  <div
                    key={platform.id}
                    className={`app-card ${
                      isConnected
                        ? "connected"
                        : "not-connected"
                    } ${
                      isSelected
                        ? "selected"
                        : ""
                    }`}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      handleAppClick(
                        platform
                      )
                    }
                    onKeyDown={(event) => {
                      if (
                        event.key ===
                          "Enter" ||
                        event.key ===
                          " "
                      ) {
                        event.preventDefault();

                        handleAppClick(
                          platform
                        );
                      }
                    }}
                  >
                    <div className="app-top">
                      <span className="app-icon">
                        {platform.icon}
                      </span>

                      <span
                        className={`status-pill ${
                          isConnected
                            ? "status-connected"
                            : "status-not-connected"
                        }`}
                      >
                        {isConnected
                          ? "● Connected"
                          : "○ Not connected"}
                      </span>
                    </div>

                    <div className="app-name">
                      {platform.name}
                    </div>

                    <div className="app-description">
                      {platform.description}
                    </div>

                    <div className="app-action">
                      {isConnected
                        ? isSelected
                          ? "Selected ✓"
                          : "Click to select"
                        : "Connect required →"}
                    </div>

                    {isConnected && (
                      <button
                        type="button"
                        className="disconnect-button"
                        onClick={(event) => {
                          event.stopPropagation();

                          handleDisconnect(
                            platform
                          );
                        }}
                      >
                        Disconnect
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <div className="main-grid">
            <section className="contacts-panel">
              <div className="contacts-head">
                <h2 className="section-title">
                  Eligible Contacts
                </h2>

                <p className="section-description">
                  Contacts are separated by app.
                  For Email, ZUQEN combines Google
                  Contacts with real Gmail email
                  interactions. No cross-app matching
                  is used.
                </p>
              </div>

              {selectedPlatforms.length > 0 ? (
                <div className="app-tabs">
                  {selectedPlatforms.map(
                    (platform) => (
                      <button
                        key={platform.id}
                        type="button"
                        className={`app-tab ${
                          activeApp ===
                          platform.id
                            ? "active"
                            : ""
                        }`}
                        onClick={() =>
                          setActiveApp(
                            platform.id
                          )
                        }
                      >
                        <span>
                          {platform.icon}
                        </span>

                        <span>
                          {platform.name}
                        </span>
                      </button>
                    )
                  )}
                </div>
              ) : (
                <div className="app-tabs">
                  <span
                    style={{
                      color: "#667085",
                      fontSize: 12,
                      padding:
                        "9px 0",
                    }}
                  >
                    Select a connected app above
                    to view its contacts.
                  </span>
                </div>
              )}

              <div className="contact-area">
                {activeApp ? (
                  (() => {
                    const contacts =
                      contactsByApp[
                        activeApp
                      ] ?? [];

                    const activePlatform =
                      PLATFORMS.find(
                        (platform) =>
                          platform.id ===
                          activeApp
                      );

                    if (
                      contactsLoadingByApp[
                        activeApp
                      ]
                    ) {
                      return (
                        <div className="contacts-loading">
                          <div>
                            <div className="empty-icon">
                              {activePlatform?.icon ??
                                "👥"}
                            </div>

                            <div className="empty-title">
                              Loading{" "}
                              {activePlatform?.name ??
                                "app"}{" "}
                              contacts...
                            </div>

                            <p className="empty-text">
                              ZUQEN is securely loading
                              eligible contacts available
                              through your connected{" "}
                              {activePlatform?.name ??
                                "app"}{" "}
                              account.
                            </p>
                          </div>
                        </div>
                      );
                    }

                    if (
                      contacts.length ===
                      0
                    ) {
                      return (
                        <div className="empty-contacts">
                          <div>
                            <div className="empty-icon">
                              {activePlatform?.icon ??
                                "👥"}
                            </div>

                            <div className="empty-title">
                              No{" "}
                              {activePlatform?.name ??
                                "app"}{" "}
                              contacts available
                            </div>

                            <p className="empty-text">
                              No eligible contacts are
                              currently available for this
                              connected{" "}
                              {activePlatform?.name
                                ? ` ${activePlatform.name}`
                                : " app"}{" "}
                              account.
                            </p>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="contacts-list">
                        {contacts.map(
                          (contact) => {
                            const selected =
                              selectedContactsByApp[
                                activeApp
                              ]?.includes(
                                contact.id
                              ) ?? false;

                            const sendStatus =
                              sendStatusByContact[
                                contact.id
                              ];

                            return (
                              <label
                                key={
                                  contact.id
                                }
                                className="contact-row"
                              >
                                <input
                                  type="checkbox"
                                  checked={
                                    selected
                                  }
                                  disabled={
                                    sending
                                  }
                                  onChange={() =>
                                    handleContactToggle(
                                      activeApp,
                                      contact.id
                                    )
                                  }
                                />

                                <div className="contact-info">
                                  <div className="contact-name">
                                    {
                                      contact.name
                                    }
                                  </div>

                                  <div className="contact-address">
                                    {
                                      contact.address
                                    }
                                  </div>
                                </div>

                                {contact.source && (
                                  <span className="contact-source">
                                    {contact.source ===
                                    "google-contact"
                                      ? "Google Contact"
                                      : contact.source ===
                                          "gmail"
                                        ? "Gmail"
                                        : "Telegram"}
                                  </span>
                                )}

                                {sendStatus && (
                                  <span
                                    className={`result-status ${getStatusClass(
                                      sendStatus
                                    )}`}
                                  >
                                    {getStatusLabel(
                                      sendStatus
                                    )}
                                  </span>
                                )}
                              </label>
                            );
                          }
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <div className="empty-contacts">
                    <div>
                      <div className="empty-icon">
                        🔗
                      </div>

                      <div className="empty-title">
                        Connect and select an
                        app first
                      </div>

                      <p className="empty-text">
                        Only apps that have
                        completed their official
                        connection can be selected
                        and used here.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <div>
              <section className="composer-panel">
                <div className="section-head">
                  <div>
                    <h2 className="section-title">
                      Compose Message
                    </h2>

                    <p className="section-description">
                      Gmail and Telegram sending are live.
                      Other channels remain ready
                      for their official API
                      integrations.
                    </p>
                  </div>
                </div>

                <label className="field-label">
                  Subject
                </label>

                <input
                  className="subject-input"
                  value={subject}
                  disabled={sending}
                  onChange={(event) =>
                    setSubject(
                      event.target.value
                    )
                  }
                  placeholder="Enter email subject..."
                />

                <label className="field-label">
                  Message
                </label>

                <textarea
                  className="textarea"
                  value={message}
                  disabled={sending}
                  onChange={(event) =>
                    setMessage(
                      event.target.value
                    )
                  }
                  placeholder="Write your message..."
                />

                <div className="composer-actions">
                  <label className="attachment-button">
                    📎{" "}
                    {attachmentName ||
                      "Attach file"}

                    <input
                      className="attachment-input"
                      type="file"
                      disabled={sending}
                      onChange={(event) => {
                        const file =
                          event.target
                            .files?.[0];

                        setAttachmentName(
                          file?.name ?? ""
                        );
                      }}
                    />
                  </label>

                  <span
                    style={{
                      color: "#667085",
                      fontSize: 11,
                    }}
                  >
                    {message.length} characters
                  </span>
                </div>

                <div className="schedule-box">
                  <label className="schedule-toggle">
                    <input
                      type="checkbox"
                      checked={
                        scheduleEnabled
                      }
                      disabled={sending}
                      onChange={(event) =>
                        setScheduleEnabled(
                          event.target
                            .checked
                        )
                      }
                    />

                    Schedule instead of
                    sending now
                  </label>

                  {scheduleEnabled && (
                    <div className="schedule-fields">
                      <input
                        type="date"
                        value={scheduleDate}
                        disabled={sending}
                        onChange={(event) =>
                          setScheduleDate(
                            event.target
                              .value
                          )
                        }
                      />

                      <input
                        type="time"
                        value={scheduleTime}
                        disabled={sending}
                        onChange={(event) =>
                          setScheduleTime(
                            event.target
                              .value
                          )
                        }
                      />
                    </div>
                  )}
                </div>
              </section>

              <section className="preview-panel">
                <div className="section-head">
                  <div>
                    <h2 className="section-title">
                      Preview
                    </h2>

                    <p className="section-description">
                      Review the message before
                      the selected channel receives
                      the send request.
                    </p>
                  </div>
                </div>

                <div className="preview-subject">
                  <strong>
                    Subject:
                  </strong>

                  {subject.trim() ||
                    "Your subject will appear here."}
                </div>

                <div className="preview-message">
                  {message.trim() ||
                    "Your message preview will appear here."}
                </div>

                <div className="send-meta">
                  <span>
                    {selectedApps.length} app
                    {selectedApps.length ===
                    1
                      ? ""
                      : "s"}
                  </span>

                  <span>
                    {totalSelectedContacts} contact
                    {totalSelectedContacts ===
                    1
                      ? ""
                      : "s"}
                  </span>
                </div>

                <button
                  type="button"
                  className="send-button"
                  disabled={sending}
                  onClick={handleSend}
                >
                  {sending
                    ? "Sending..."
                    : scheduleEnabled
                      ? "Schedule Message"
                      : "Send Message"}
                </button>
              </section>

              {sendResults.length > 0 && (
                <section className="status-panel">
                  <div className="section-head">
                    <div>
                      <h2 className="section-title">
                        Send Status
                      </h2>

                      <p className="section-description">
                        The selected channel reports the result
                        for each message individually.
                      </p>
                    </div>
                  </div>

                  <div className="result-summary">
                    <span className="summary-pill summary-sent">
                      ✓ {sentCount} Sent
                    </span>

                    <span className="summary-pill summary-failed">
                      ✕ {failedCount} Failed
                    </span>

                    <span className="summary-pill summary-total">
                      {sendResults.length} Total
                    </span>
                  </div>

                  <div className="result-list">
                    {sendResults.map(
                      (result) => (
                        <div
                          key={
                            result.email ??
                            result.chatId ??
                            `${result.name ?? "recipient"}-${result.messageId ?? "result"}`
                          }
                          className="result-row"
                        >
                          <div className="result-info">
                            <div className="result-name">
                              {result.name ||
                                result.email ||
                                result.chatId ||
                                "Recipient"}
                            </div>

                            <div className="result-email">
                              {result.email ||
                                result.chatId ||
                                ""}
                            </div>

                            {result.error && (
                              <div className="result-error">
                                {
                                  result.error
                                }
                              </div>
                            )}

                            {result.messageId && (
                              <div className="result-message-id">
                                Message ID:{" "}
                                {result.messageId}
                              </div>
                            )}
                          </div>

                          <span
                            className={`result-status ${getStatusClass(
                              result.status
                            )}`}
                          >
                            {result.status ===
                            "sent"
                              ? "Sent"
                              : "Failed"}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      </div>

      {connectModalApp && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setConnectModalApp(null);
            }
          }}
        >
          <div className="connect-modal">
            <div className="modal-icon">
              {connectModalApp.icon}
            </div>

            <h2 className="modal-title">
              First connect{" "}
              {connectModalApp.name}
            </h2>

            {connectModalApp.id ===
            "telegram" ? (
              <>
                <p className="modal-text">
                  Enter the Bot Token you
                  received from Telegram
                  BotFather. ZUQEN will
                  verify the token with
                  Telegram before saving
                  the connection.
                </p>

                <input
                  type="password"
                  value={
                    telegramBotToken
                  }
                  onChange={(event) =>
                    setTelegramBotToken(
                      event.target.value
                    )
                  }
                  placeholder="Paste Telegram Bot Token"
                  className="telegram-token-input"
                  autoComplete="off"
                  aria-label="Telegram Bot Token"
                />
              </>
            ) : (
              <p className="modal-text">
                You selected{" "}
                {connectModalApp.name},
                but this account is not
                connected to ZUQEN yet.
                Connect it through the
                official authorization
                system before selecting
                contacts or sending
                messages.
              </p>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="modal-cancel"
                onClick={() =>
                  setConnectModalApp(
                    null
                  )
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="modal-connect"
                onClick={() =>
                  handleConnect(
                    connectModalApp
                  )
                }
                disabled={
                  connectModalApp.id ===
                    "telegram" &&
                  (
                    telegramConnecting ||
                    !telegramBotToken.trim()
                  )
                }
              >
                {connectModalApp.id ===
                  "telegram" &&
                telegramConnecting
                  ? "Connecting..."
                  : `Connect ${connectModalApp.name}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {notice && (
        <div className="notice">
          {notice}
        </div>
      )}
    </main>
  );
}