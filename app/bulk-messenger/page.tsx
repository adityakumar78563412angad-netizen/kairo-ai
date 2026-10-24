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
    description: "Email",
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
  const [connectedApps, setConnectedApps] = useState<string[]>([]);
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [activeApp, setActiveApp] = useState<string | null>(null);

  const [connectionsLoading, setConnectionsLoading] = useState(true);

  const [contactsByApp, setContactsByApp] = useState<
    Record<string, Contact[]>
  >({});

  const [contactsLoadingByApp, setContactsLoadingByApp] = useState<
    Record<string, boolean>
  >({});

  const [contactsLoadedByApp, setContactsLoadedByApp] = useState<
    Record<string, boolean>
  >({});

  const [selectedContactsByApp, setSelectedContactsByApp] = useState<
    Record<string, string[]>
  >({});

  const [message, setMessage] = useState("");
  const [attachmentName, setAttachmentName] = useState("");

  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");

  const [connectModalApp, setConnectModalApp] =
    useState<Platform | null>(null);

  const [notice, setNotice] = useState<string | null>(null);

  const providerToPlatform: Record<string, string> = {
    google: "email",
  };

  const platformToProvider: Record<string, string> = {
    email: "google",
  };

  useEffect(() => {
    let cancelled = false;

    async function loadConnections() {
      try {
        setConnectionsLoading(true);

        const response = await fetch("/api/connections", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          if (response.status === 401) {
            if (!cancelled) {
              setConnectedApps([]);
            }
            return;
          }

          throw new Error("Failed to load connected accounts.");
        }

        const result: {
          connections?: ConnectionResponse[];
        } = await response.json();

        if (cancelled) {
          return;
        }

        const realConnectedApps = Array.isArray(result.connections)
          ? result.connections
              .filter(
                (connection) => connection.status === "connected"
              )
              .map((connection) => {
                return providerToPlatform[connection.provider] ?? null;
              })
              .filter(
                (platformId: string | null): platformId is string =>
                  platformId !== null
              )
          : [];

        setConnectedApps([...new Set(realConnectedApps)]);
      } catch (error) {
        console.error("Unable to load connected apps:", error);

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
    }, 3500);
  }

  async function loadContactsForApp(appId: string) {
    if (!connectedApps.includes(appId)) {
      return;
    }

    if (contactsLoadingByApp[appId]) {
      return;
    }

    if (contactsLoadedByApp[appId]) {
      return;
    }

    if (appId !== "email") {
      setContactsLoadedByApp((current) => ({
        ...current,
        [appId]: true,
      }));
      return;
    }

    try {
      setContactsLoadingByApp((current) => ({
        ...current,
        [appId]: true,
      }));

      const response = await fetch(
        "/api/connections/google/contacts",
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
          source?: string;
        }>;
        error?: string;
      } = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ?? "Unable to load Google contacts."
        );
      }

      const contacts: Contact[] = Array.isArray(result.contacts)
        ? result.contacts
            .filter((contact) => contact.email?.trim())
            .map((contact) => ({
              id: contact.id,
              name: contact.name || contact.email,
              address: contact.email,
            }))
        : [];

      setContactsByApp((current) => ({
        ...current,
        [appId]: contacts,
      }));

      setContactsLoadedByApp((current) => ({
        ...current,
        [appId]: true,
      }));
    } catch (error) {
      console.error("Unable to load contacts:", error);

      showNotice(
        error instanceof Error
          ? error.message
          : "Unable to load contacts."
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

  async function handleDisconnect(platform: Platform) {
    const provider = platformToProvider[platform.id];

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
            "Content-Type": "application/json",
          },
        }
      );

      const result: {
        error?: string;
        warning?: string;
      } = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ?? `Unable to disconnect ${platform.name}.`
        );
      }

      setConnectedApps((current) =>
        current.filter((id) => id !== platform.id)
      );

      setSelectedApps((current) =>
        current.filter((id) => id !== platform.id)
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
        current === platform.id ? null : current
      );

      showNotice(
        result.warning ??
          `${platform.name} has been disconnected from ZUQEN.`
      );
    } catch (error) {
      console.error("Disconnect error:", error);

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
    return Object.values(selectedContactsByApp).reduce(
      (total, contacts) => total + contacts.length,
      0
    );
  }, [selectedContactsByApp]);

  function handleAppClick(platform: Platform) {
    const isConnected = connectedApps.includes(platform.id);

    if (!isConnected) {
      setConnectModalApp(platform);
      return;
    }

    toggleSelectedApp(platform.id);
  }

  function toggleSelectedApp(platformId: string) {
    if (!connectedApps.includes(platformId)) {
      const platform = PLATFORMS.find(
        (item) => item.id === platformId
      );

      if (platform) {
        setConnectModalApp(platform);
      }

      return;
    }

    setSelectedApps((current) => {
      const alreadySelected = current.includes(platformId);

      if (alreadySelected) {
        const next = current.filter(
          (id) => id !== platformId
        );

        if (activeApp === platformId) {
          setActiveApp(next[0] ?? null);
        }

        return next;
      }

      if (!activeApp) {
        setActiveApp(platformId);
      }

      return [...current, platformId];
    });
  }

  function handleConnect(platform: Platform) {
    setConnectModalApp(null);

    if (platform.id === "email") {
      window.location.href =
        "/api/connections/google/connect";
      return;
    }

    showNotice(
      `${platform.name} connection will be completed through its official authorization flow.`
    );
  }

  function handleContactToggle(
    appId: string,
    contactId: string
  ) {
    if (!connectedApps.includes(appId)) {
      showNotice("Connect this app first.");
      return;
    }

    setSelectedContactsByApp((current) => {
      const existing = current[appId] ?? [];

      const next = existing.includes(contactId)
        ? existing.filter((id) => id !== contactId)
        : [...existing, contactId];

      return {
        ...current,
        [appId]: next,
      };
    });
  }

  function handleSend() {
    if (selectedApps.length === 0) {
      showNotice("Select at least one connected app first.");
      return;
    }

    const disconnectedSelectedApp = selectedApps.find(
      (appId) => !connectedApps.includes(appId)
    );

    if (disconnectedSelectedApp) {
      const platform = PLATFORMS.find(
        (item) => item.id === disconnectedSelectedApp
      );

      showNotice(
        `First connect ${platform?.name ?? "this app"} before sending.`
      );

      return;
    }

    if (totalSelectedContacts === 0) {
      showNotice(
        "Select at least one eligible contact first."
      );
      return;
    }

    if (!message.trim()) {
      showNotice("Write a message first.");
      return;
    }

    if (scheduleEnabled) {
      if (!scheduleDate || !scheduleTime) {
        showNotice(
          "Choose a schedule date and time first."
        );
        return;
      }
    }

    showNotice(
      scheduleEnabled
        ? "Schedule request is ready for the real sending system."
        : "Send request is ready for the real sending system."
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#111827]">
      <style jsx global>{`
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
        .preview-panel {
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
          max-width: 420px;
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
        }

        .contact-row input {
          width: 17px;
          height: 17px;
        }

        .contact-info {
          min-width: 0;
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
        }

        .composer-panel {
          padding: 20px;
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

        .preview-panel {
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

        .send-meta {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-top: 10px;
          color: #667085;
          font-size: 11px;
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
        }
      `}</style>

      <div className="bulk-shell">
        <div className="bulk-container">
          <header className="bulk-header">
            <div>
              <h1 className="bulk-title">Bulk Messenger</h1>

              <p className="bulk-subtitle">
                Connect your communication apps, select eligible contacts,
                compose one message, and send or schedule it.
              </p>
            </div>

            <div className="connection-count">
              {connectionsLoading ? (
                <strong>Checking connections...</strong>
              ) : (
                <>
                  <strong>{connectedPlatforms.length}</strong> connected
                  {" · "}
                  <strong>{selectedApps.length}</strong> selected
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
                  Only connected apps can be selected for messaging.
                </p>
              </div>
            </div>

            <div className="apps-grid">
              {PLATFORMS.map((platform) => {
                const isConnected = connectedApps.includes(
                  platform.id
                );

                const isSelected = selectedApps.includes(
                  platform.id
                );

                return (
                  <div
                    key={platform.id}
                    className={`app-card ${
                      isConnected
                        ? "connected"
                        : "not-connected"
                    } ${isSelected ? "selected" : ""}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleAppClick(platform)}
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" ||
                        event.key === " "
                      ) {
                        event.preventDefault();
                        handleAppClick(platform);
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
                          handleDisconnect(platform);
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
                  Contacts are separated by app. No cross-app matching
                  is used.
                </p>
              </div>

              {selectedPlatforms.length > 0 ? (
                <div className="app-tabs">
                  {selectedPlatforms.map((platform) => (
                    <button
                      key={platform.id}
                      type="button"
                      className={`app-tab ${
                        activeApp === platform.id
                          ? "active"
                          : ""
                      }`}
                      onClick={() =>
                        setActiveApp(platform.id)
                      }
                    >
                      <span>{platform.icon}</span>
                      <span>{platform.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="app-tabs">
                  <span
                    style={{
                      color: "#667085",
                      fontSize: 12,
                      padding: "9px 0",
                    }}
                  >
                    Select a connected app above to view its
                    contacts.
                  </span>
                </div>
              )}

              <div className="contact-area">
                {activeApp ? (
                  (() => {
                    const contacts =
                      contactsByApp[activeApp] ?? [];

                    const activePlatform = PLATFORMS.find(
                      (platform) =>
                        platform.id === activeApp
                    );

                    if (
                      contactsLoadingByApp[activeApp]
                    ) {
                      return (
                        <div className="contacts-loading">
                          <div>
                            <div className="empty-icon">
                              {activePlatform?.icon ?? "👥"}
                            </div>

                            <div className="empty-title">
                              Loading eligible contacts...
                            </div>

                            <p className="empty-text">
                              ZUQEN is securely loading the contacts
                              available through the connected account.
                            </p>
                          </div>
                        </div>
                      );
                    }

                    if (contacts.length === 0) {
                      return (
                        <div className="empty-contacts">
                          <div>
                            <div className="empty-icon">
                              {activePlatform?.icon ?? "👥"}
                            </div>

                            <div className="empty-title">
                              No eligible contacts available
                            </div>

                            <p className="empty-text">
                              No contacts with a usable email address
                              are available from this connected account.
                              You can reconnect Google if you recently
                              added the Contacts permission.
                            </p>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="contacts-list">
                        {contacts.map((contact) => {
                          const selected =
                            selectedContactsByApp[
                              activeApp
                            ]?.includes(contact.id) ?? false;

                          return (
                            <label
                              key={contact.id}
                              className="contact-row"
                            >
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() =>
                                  handleContactToggle(
                                    activeApp,
                                    contact.id
                                  )
                                }
                              />

                              <div className="contact-info">
                                <div className="contact-name">
                                  {contact.name}
                                </div>

                                <div className="contact-address">
                                  {contact.address}
                                </div>
                              </div>
                            </label>
                          );
                        })}
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
                        Connect and select an app first
                      </div>

                      <p className="empty-text">
                        Only apps that have completed their official
                        connection can be selected and used here.
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
                      Your message will be prepared for the selected
                      connected apps.
                    </p>
                  </div>
                </div>

                <textarea
                  className="textarea"
                  value={message}
                  onChange={(event) =>
                    setMessage(event.target.value)
                  }
                  placeholder="Write your message..."
                />

                <div className="composer-actions">
                  <label className="attachment-button">
                    📎{" "}
                    {attachmentName || "Attach file"}

                    <input
                      className="attachment-input"
                      type="file"
                      onChange={(event) => {
                        const file =
                          event.target.files?.[0];

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
                      checked={scheduleEnabled}
                      onChange={(event) =>
                        setScheduleEnabled(
                          event.target.checked
                        )
                      }
                    />

                    Schedule instead of sending now
                  </label>

                  {scheduleEnabled && (
                    <div className="schedule-fields">
                      <input
                        type="date"
                        value={scheduleDate}
                        onChange={(event) =>
                          setScheduleDate(
                            event.target.value
                          )
                        }
                      />

                      <input
                        type="time"
                        value={scheduleTime}
                        onChange={(event) =>
                          setScheduleTime(
                            event.target.value
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
                      Review the message before the real provider
                      sending system is connected.
                    </p>
                  </div>
                </div>

                <div className="preview-message">
                  {message.trim() ||
                    "Your message preview will appear here."}
                </div>

                <div className="send-meta">
                  <span>
                    {selectedApps.length} app
                    {selectedApps.length === 1
                      ? ""
                      : "s"}
                  </span>

                  <span>
                    {totalSelectedContacts} contact
                    {totalSelectedContacts === 1
                      ? ""
                      : "s"}
                  </span>
                </div>

                <button
                  type="button"
                  className="send-button"
                  onClick={handleSend}
                >
                  {scheduleEnabled
                    ? "Schedule Message"
                    : "Send Message"}
                </button>
              </section>
            </div>
          </div>
        </div>
      </div>

      {connectModalApp && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
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
              First connect {connectModalApp.name}
            </h2>

            <p className="modal-text">
              You selected {connectModalApp.name}, but this
              account is not connected to ZUQEN yet. Connect it
              through the official authorization system before
              selecting contacts or sending messages.
            </p>

            <div className="modal-actions">
              <button
                type="button"
                className="modal-cancel"
                onClick={() =>
                  setConnectModalApp(null)
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="modal-connect"
                onClick={() =>
                  handleConnect(connectModalApp)
                }
              >
                Connect {connectModalApp.name}
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