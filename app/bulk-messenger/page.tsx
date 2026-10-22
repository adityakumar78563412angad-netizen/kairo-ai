"use client";

import { useMemo, useState } from "react";

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
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [activeApp, setActiveApp] = useState<string | null>(null);

  const [contactsByApp, setContactsByApp] = useState<
    Record<string, Contact[]>
  >({});

  const [selectedContactsByApp, setSelectedContactsByApp] = useState<
    Record<string, string[]>
  >({});

  const [message, setMessage] = useState("");
  const [attachmentName, setAttachmentName] = useState("");

  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");

  const selectedPlatformObjects = useMemo(
    () =>
      PLATFORMS.filter((platform) =>
        selectedApps.includes(platform.id)
      ),
    [selectedApps]
  );

  const activeContacts = activeApp
    ? contactsByApp[activeApp] ?? []
    : [];

  const activeSelectedContacts = activeApp
    ? selectedContactsByApp[activeApp] ?? []
    : [];

  const totalSelectedContacts = Object.values(
    selectedContactsByApp
  ).reduce((total, contacts) => total + contacts.length, 0);

  const toggleApp = (appId: string) => {
    setSelectedApps((current) => {
      const exists = current.includes(appId);

      if (exists) {
        if (activeApp === appId) {
          const nextActive =
            current.find((id) => id !== appId) ?? null;
          setActiveApp(nextActive);
        }

        return current.filter((id) => id !== appId);
      }

      if (!activeApp) {
        setActiveApp(appId);
      }

      return [...current, appId];
    });
  };

  const selectAppForContacts = (appId: string) => {
    if (!selectedApps.includes(appId)) return;
    setActiveApp(appId);
  };

  const toggleContact = (contactId: string) => {
    if (!activeApp) return;

    setSelectedContactsByApp((current) => {
      const existing = current[activeApp] ?? [];

      return {
        ...current,
        [activeApp]: existing.includes(contactId)
          ? existing.filter((id) => id !== contactId)
          : [...existing, contactId],
      };
    });
  };

  const clearSelectedContactsForActiveApp = () => {
    if (!activeApp) return;

    setSelectedContactsByApp((current) => ({
      ...current,
      [activeApp]: [],
    }));
  };

  const selectAllActiveContacts = () => {
    if (!activeApp) return;

    const allIds = activeContacts.map((contact) => contact.id);

    setSelectedContactsByApp((current) => ({
      ...current,
      [activeApp]:
        activeSelectedContacts.length === allIds.length
          ? []
          : allIds,
    }));
  };

  const handleAttachment = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      setAttachmentName("");
      return;
    }

    setAttachmentName(file.name);
  };

  const clearEverything = () => {
    setSelectedApps([]);
    setActiveApp(null);
    setSelectedContactsByApp({});
    setMessage("");
    setAttachmentName("");
    setScheduleEnabled(false);
    setScheduleDate("");
    setScheduleTime("");
  };

  const canContinue =
    selectedApps.length > 0 &&
    totalSelectedContacts > 0 &&
    message.trim().length > 0;

  return (
    <main className="bulk-page">
      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .bulk-page {
          min-height: 100vh;
          padding: 24px;
          color: #111827;
          background:
            radial-gradient(
              circle at 10% 0%,
              rgba(255, 255, 255, 0.95),
              transparent 30%
            ),
            radial-gradient(
              circle at 90% 10%,
              rgba(226, 232, 240, 0.7),
              transparent 30%
            ),
            linear-gradient(
              135deg,
              #f8fafc 0%,
              #eef2f7 50%,
              #e5e7eb 100%
            );
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
        textarea,
        input {
          font: inherit;
        }

        .shell {
          width: min(1500px, 100%);
          margin: 0 auto;
        }

        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 20px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .logo {
          width: 45px;
          height: 45px;
          border-radius: 15px;
          display: grid;
          place-items: center;
          color: white;
          font-weight: 900;
          background: linear-gradient(
            135deg,
            #0f172a,
            #374151
          );
          box-shadow:
            0 12px 28px rgba(15, 23, 42, 0.18),
            inset 0 1px 0 rgba(255, 255, 255, 0.2);
        }

        .brand-title {
          font-size: 18px;
          font-weight: 850;
          letter-spacing: -0.03em;
        }

        .brand-subtitle {
          margin-top: 3px;
          color: #64748b;
          font-size: 11px;
        }

        .top-actions {
          display: flex;
          gap: 9px;
        }

        .top-button {
          border: 1px solid rgba(148, 163, 184, 0.3);
          border-radius: 12px;
          padding: 10px 14px;
          background: rgba(255, 255, 255, 0.65);
          color: #1f2937;
          cursor: pointer;
          transition: 0.2s ease;
          backdrop-filter: blur(15px);
        }

        .top-button:hover {
          background: white;
          transform: translateY(-1px);
        }

        .hero {
          margin-bottom: 18px;
          padding: 27px;
          border: 1px solid rgba(148, 163, 184, 0.28);
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.66);
          box-shadow: 0 18px 55px rgba(15, 23, 42, 0.07);
          backdrop-filter: blur(20px);
        }

        .eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.06);
          color: #475569;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .hero h1 {
          margin: 12px 0 0;
          font-size: clamp(28px, 4vw, 43px);
          line-height: 1.05;
          letter-spacing: -0.05em;
        }

        .hero p {
          max-width: 820px;
          margin: 12px 0 0;
          color: #64748b;
          font-size: 14px;
          line-height: 1.6;
        }

        .workspace {
          display: grid;
          grid-template-columns: minmax(0, 1.55fr) minmax(
              320px,
              0.75fr
            );
          gap: 18px;
          align-items: start;
        }

        .left,
        .right {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .card {
          padding: 21px;
          border: 1px solid rgba(148, 163, 184, 0.27);
          border-radius: 21px;
          background: rgba(255, 255, 255, 0.68);
          box-shadow: 0 14px 45px rgba(15, 23, 42, 0.055);
          backdrop-filter: blur(18px);
        }

        .card-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 15px;
          margin-bottom: 17px;
        }

        .title-line {
          display: flex;
          align-items: center;
          gap: 9px;
          font-size: 15px;
          font-weight: 800;
        }

        .step {
          width: 26px;
          height: 26px;
          border-radius: 9px;
          display: grid;
          place-items: center;
          background: #111827;
          color: white;
          font-size: 11px;
          font-weight: 800;
        }

        .subtitle {
          margin-top: 5px;
          color: #64748b;
          font-size: 11px;
          line-height: 1.5;
        }

        .count-pill {
          padding: 6px 9px;
          border-radius: 999px;
          background: #f1f5f9;
          color: #475569;
          font-size: 10px;
          font-weight: 750;
          white-space: nowrap;
        }

        .app-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }

        .app-card {
          position: relative;
          min-height: 110px;
          padding: 14px;
          text-align: left;
          border: 1px solid rgba(148, 163, 184, 0.27);
          border-radius: 15px;
          background: rgba(248, 250, 252, 0.7);
          cursor: pointer;
          transition: 0.2s ease;
        }

        .app-card:hover {
          background: white;
          transform: translateY(-2px);
        }

        .app-card.selected {
          border-color: #111827;
          box-shadow: inset 0 0 0 1px #111827;
          background: #f8fafc;
        }

        .app-icon {
          width: 37px;
          height: 37px;
          display: grid;
          place-items: center;
          border-radius: 11px;
          background: white;
          border: 1px solid rgba(148, 163, 184, 0.22);
          font-size: 18px;
          margin-bottom: 10px;
        }

        .app-name {
          font-size: 12px;
          font-weight: 800;
        }

        .app-description {
          margin-top: 3px;
          color: #64748b;
          font-size: 9px;
        }

        .check {
          position: absolute;
          top: 9px;
          right: 9px;
          width: 20px;
          height: 20px;
          display: grid;
          place-items: center;
          border-radius: 7px;
          background: #111827;
          color: white;
          font-size: 10px;
        }

        .contact-app-tabs {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 5px;
        }

        .contact-app-tab {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          flex-shrink: 0;
          padding: 9px 12px;
          border: 1px solid rgba(148, 163, 184, 0.28);
          border-radius: 12px;
          background: rgba(248, 250, 252, 0.72);
          color: #475569;
          cursor: pointer;
          font-size: 11px;
          font-weight: 750;
        }

        .contact-app-tab.active {
          background: #111827;
          color: white;
          border-color: #111827;
        }

        .contact-list {
          margin-top: 15px;
          min-height: 230px;
          border-radius: 16px;
          border: 1px dashed rgba(148, 163, 184, 0.38);
          background: rgba(248, 250, 252, 0.45);
          overflow: hidden;
        }

        .contact-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 11px 13px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.18);
        }

        .toolbar-button {
          border: 0;
          background: transparent;
          color: #334155;
          cursor: pointer;
          font-size: 11px;
          font-weight: 750;
        }

        .empty-state {
          min-height: 185px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          padding: 30px;
          text-align: center;
          color: #64748b;
        }

        .empty-icon {
          width: 46px;
          height: 46px;
          display: grid;
          place-items: center;
          border-radius: 15px;
          background: white;
          border: 1px solid rgba(148, 163, 184, 0.22);
          font-size: 20px;
          margin-bottom: 10px;
        }

        .empty-title {
          color: #334155;
          font-size: 13px;
          font-weight: 800;
        }

        .empty-text {
          max-width: 390px;
          margin-top: 6px;
          font-size: 11px;
          line-height: 1.55;
        }

        .contact-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 11px 13px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.15);
          cursor: pointer;
        }

        .contact-row:last-child {
          border-bottom: 0;
        }

        .contact-checkbox {
          width: 18px;
          height: 18px;
          display: grid;
          place-items: center;
          border: 1px solid #94a3b8;
          border-radius: 6px;
          font-size: 10px;
        }

        .contact-checkbox.selected {
          background: #111827;
          border-color: #111827;
          color: white;
        }

        .contact-avatar {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
          border-radius: 11px;
          background: #e2e8f0;
          color: #334155;
          font-size: 11px;
          font-weight: 800;
        }

        .contact-name {
          font-size: 12px;
          font-weight: 750;
        }

        .contact-address {
          margin-top: 2px;
          color: #64748b;
          font-size: 10px;
        }

        textarea {
          width: 100%;
          min-height: 190px;
          resize: vertical;
          padding: 15px;
          border: 1px solid rgba(148, 163, 184, 0.3);
          border-radius: 16px;
          outline: none;
          background: rgba(248, 250, 252, 0.72);
          color: #111827;
          font-size: 13px;
          line-height: 1.6;
        }

        textarea:focus,
        input:focus {
          border-color: #334155;
          background: white;
          box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.06);
        }

        .composer-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 10px;
        }

        .attach {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 8px 11px;
          border: 1px dashed #94a3b8;
          border-radius: 11px;
          color: #475569;
          background: rgba(255, 255, 255, 0.5);
          cursor: pointer;
          font-size: 11px;
        }

        .attach input {
          display: none;
        }

        .attachment {
          margin-top: 10px;
          padding: 9px 11px;
          border-radius: 10px;
          background: #f1f5f9;
          color: #475569;
          font-size: 10px;
        }

        .preview {
          min-height: 150px;
          padding: 15px;
          border-radius: 16px;
          background: #111827;
          color: white;
          white-space: pre-wrap;
          word-break: break-word;
          font-size: 12px;
          line-height: 1.6;
        }

        .preview-empty {
          color: #94a3b8;
          font-style: italic;
        }

        .summary {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 12px;
        }

        .summary-pill {
          padding: 6px 9px;
          border-radius: 999px;
          background: #f1f5f9;
          color: #475569;
          font-size: 10px;
          font-weight: 700;
        }

        .schedule {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 13px;
          border-radius: 14px;
          background: #f8fafc;
          border: 1px solid rgba(148, 163, 184, 0.2);
        }

        .schedule-info {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .toggle {
          width: 42px;
          height: 24px;
          padding: 3px;
          border: 0;
          border-radius: 999px;
          background: #cbd5e1;
          cursor: pointer;
        }

        .toggle.active {
          background: #111827;
        }

        .toggle-dot {
          display: block;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: white;
          transition: 0.2s ease;
        }

        .toggle.active .toggle-dot {
          transform: translateX(18px);
        }

        .date-time {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: 10px;
        }

        input[type="date"],
        input[type="time"] {
          width: 100%;
          padding: 10px;
          border: 1px solid rgba(148, 163, 184, 0.3);
          border-radius: 11px;
          outline: none;
          background: #f8fafc;
          color: #1f2937;
          font-size: 11px;
        }

        .send-button {
          width: 100%;
          margin-top: 12px;
          padding: 13px 15px;
          border: 1px solid #111827;
          border-radius: 13px;
          background: #111827;
          color: white;
          cursor: pointer;
          font-weight: 800;
          transition: 0.2s ease;
        }

        .send-button:hover:not(:disabled) {
          transform: translateY(-1px);
          background: #1f2937;
        }

        .send-button:disabled {
          opacity: 0.42;
          cursor: not-allowed;
        }

        .info {
          margin-top: 11px;
          padding: 11px;
          border-radius: 11px;
          background: #f1f5f9;
          color: #64748b;
          font-size: 10px;
          line-height: 1.55;
        }

        @media (max-width: 1050px) {
          .workspace {
            grid-template-columns: 1fr;
          }

          .app-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }

        @media (max-width: 700px) {
          .bulk-page {
            padding: 12px;
          }

          .topbar {
            align-items: flex-start;
            flex-direction: column;
          }

          .top-actions {
            width: 100%;
          }

          .top-button {
            flex: 1;
          }

          .hero {
            padding: 20px;
          }

          .card {
            padding: 16px;
          }

          .app-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .date-time {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="shell">
        <header className="topbar">
          <div className="brand">
            <div className="logo">Z</div>

            <div>
              <div className="brand-title">
                ZUQEN Multi-Channel Messenger
              </div>

              <div className="brand-subtitle">
                Bulk communication workspace
              </div>
            </div>
          </div>

          <div className="top-actions">
            <button
              type="button"
              className="top-button"
              onClick={clearEverything}
            >
              Clear
            </button>

            <button
              type="button"
              className="top-button"
              onClick={() => {
                window.location.href = "/";
              }}
            >
              ← Back to ZUQEN
            </button>
          </div>
        </header>

        <section className="hero">
          <div className="eyebrow">
            <span>●</span>
            Multi-Channel Bulk Messaging
          </div>

          <h1>Send Bulk to Eligible Contacts</h1>

          <p>
            Connect your communication apps, select the apps you want
            to use, choose eligible contacts from each selected app,
            write one message, preview it, and prepare the campaign.
          </p>
        </section>

        <div className="workspace">
          <div className="left">
            <section className="card">
              <div className="card-head">
                <div>
                  <div className="title-line">
                    <span className="step">1</span>
                    Select Communication Apps
                  </div>

                  <div className="subtitle">
                    Choose the channels you want to use for this
                    campaign.
                  </div>
                </div>

                <div className="count-pill">
                  {selectedApps.length} selected
                </div>
              </div>

              <div className="app-grid">
                {PLATFORMS.map((platform) => {
                  const selected = selectedApps.includes(platform.id);

                  return (
                    <button
                      key={platform.id}
                      type="button"
                      className={`app-card ${
                        selected ? "selected" : ""
                      }`}
                      onClick={() => toggleApp(platform.id)}
                    >
                      {selected && (
                        <span className="check">✓</span>
                      )}

                      <div className="app-icon">
                        {platform.icon}
                      </div>

                      <div className="app-name">
                        {platform.name}
                      </div>

                      <div className="app-description">
                        {platform.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="card">
              <div className="card-head">
                <div>
                  <div className="title-line">
                    <span className="step">2</span>
                    Eligible Contacts
                  </div>

                  <div className="subtitle">
                    Select an app above to view contacts from that
                    connected app.
                  </div>
                </div>

                <div className="count-pill">
                  {totalSelectedContacts} selected
                </div>
              </div>

              {selectedPlatformObjects.length > 0 ? (
                <>
                  <div className="contact-app-tabs">
                    {selectedPlatformObjects.map((platform) => (
                      <button
                        key={platform.id}
                        type="button"
                        className={`contact-app-tab ${
                          activeApp === platform.id
                            ? "active"
                            : ""
                        }`}
                        onClick={() =>
                          selectAppForContacts(platform.id)
                        }
                      >
                        <span>{platform.icon}</span>
                        {platform.name}
                      </button>
                    ))}
                  </div>

                  <div className="contact-list">
                    {activeApp ? (
                      <>
                        <div className="contact-toolbar">
                          <span className="count-pill">
                            {activeSelectedContacts.length} selected
                          </span>

                          <div
                            style={{
                              display: "flex",
                              gap: 12,
                            }}
                          >
                            <button
                              type="button"
                              className="toolbar-button"
                              onClick={selectAllActiveContacts}
                            >
                              {activeContacts.length > 0 &&
                              activeSelectedContacts.length ===
                                activeContacts.length
                                ? "Deselect all"
                                : "Select all"}
                            </button>

                            <button
                              type="button"
                              className="toolbar-button"
                              onClick={
                                clearSelectedContactsForActiveApp
                              }
                            >
                              Clear
                            </button>
                          </div>
                        </div>

                        {activeContacts.length === 0 ? (
                          <div className="empty-state">
                            <div className="empty-icon">
                              {PLATFORMS.find(
                                (platform) =>
                                  platform.id === activeApp
                              )?.icon ?? "◎"}
                            </div>

                            <div className="empty-title">
                              No contacts available yet
                            </div>

                            <div className="empty-text">
                              Connect this communication app to
                              ZUQEN. Once its official connection
                              provides eligible contacts, they will
                              appear here.
                            </div>
                          </div>
                        ) : (
                          activeContacts.map((contact) => {
                            const selected =
                              activeSelectedContacts.includes(
                                contact.id
                              );

                            return (
                              <div
                                key={contact.id}
                                className="contact-row"
                                onClick={() =>
                                  toggleContact(contact.id)
                                }
                              >
                                <div
                                  className={`contact-checkbox ${
                                    selected ? "selected" : ""
                                  }`}
                                >
                                  {selected ? "✓" : ""}
                                </div>

                                <div className="contact-avatar">
                                  {contact.name
                                    .slice(0, 2)
                                    .toUpperCase()}
                                </div>

                                <div>
                                  <div className="contact-name">
                                    {contact.name}
                                  </div>

                                  <div className="contact-address">
                                    {contact.address}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </>
                    ) : (
                      <div className="empty-state">
                        <div className="empty-icon">◎</div>

                        <div className="empty-title">
                          Select an app
                        </div>

                        <div className="empty-text">
                          The contacts area will show the eligible
                          contacts of the selected communication app.
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="contact-list">
                  <div className="empty-state">
                    <div className="empty-icon">👥</div>

                    <div className="empty-title">
                      No communication app selected
                    </div>

                    <div className="empty-text">
                      Select one or more communication apps above.
                      Their eligible-contact icons will appear here.
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className="card">
              <div className="card-head">
                <div>
                  <div className="title-line">
                    <span className="step">3</span>
                    Compose Message
                  </div>

                  <div className="subtitle">
                    Write the message for the selected recipients.
                  </div>
                </div>
              </div>

              <textarea
                value={message}
                onChange={(event) =>
                  setMessage(event.target.value)
                }
                maxLength={5000}
                placeholder="Write your message here..."
              />

              <div className="composer-bottom">
                <label className="attach">
                  📎 Attach media
                  <input
                    type="file"
                    accept="image/*,video/*,.pdf"
                    onChange={handleAttachment}
                  />
                </label>

                <span className="subtitle">
                  {message.length}/5000
                </span>
              </div>

              {attachmentName && (
                <div className="attachment">
                  📎 {attachmentName}
                </div>
              )}
            </section>
          </div>

          <div className="right">
            <section className="card">
              <div className="card-head">
                <div>
                  <div className="title-line">
                    <span className="step">4</span>
                    Preview
                  </div>

                  <div className="subtitle">
                    Review your campaign before delivery.
                  </div>
                </div>
              </div>

              <div className="preview">
                {message.trim() ? (
                  message
                ) : (
                  <span className="preview-empty">
                    Your message preview will appear here.
                  </span>
                )}
              </div>

              <div className="summary">
                <span className="summary-pill">
                  {selectedApps.length} apps
                </span>

                <span className="summary-pill">
                  {totalSelectedContacts} contacts
                </span>

                {attachmentName && (
                  <span className="summary-pill">
                    📎 Media
                  </span>
                )}
              </div>
            </section>

            <section className="card">
              <div className="card-head">
                <div>
                  <div className="title-line">
                    <span className="step">5</span>
                    Send or Schedule
                  </div>

                  <div className="subtitle">
                    Choose when the prepared campaign should be
                    delivered.
                  </div>
                </div>
              </div>

              <div className="schedule">
                <div className="schedule-info">
                  <span>🕒</span>

                  <div>
                    <div className="contact-name">
                      Schedule delivery
                    </div>

                    <div className="subtitle">
                      Send at a selected date and time
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className={`toggle ${
                    scheduleEnabled ? "active" : ""
                  }`}
                  onClick={() =>
                    setScheduleEnabled((value) => !value)
                  }
                  aria-label="Toggle scheduled delivery"
                >
                  <span className="toggle-dot" />
                </button>
              </div>

              {scheduleEnabled && (
                <div className="date-time">
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(event) =>
                      setScheduleDate(event.target.value)
                    }
                  />

                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(event) =>
                      setScheduleTime(event.target.value)
                    }
                  />
                </div>
              )}

              <button
                type="button"
                className="send-button"
                disabled={!canContinue}
                onClick={() => {
                  if (!canContinue) return;

                  alert(
                    scheduleEnabled
                      ? "Campaign ready for scheduling."
                      : "Campaign ready for delivery."
                  );
                }}
              >
                {scheduleEnabled
                  ? "🕒 Schedule Campaign"
                  : "📤 Send Campaign"}
              </button>

              <div className="info">
                Actual delivery will be connected later through the
                official APIs of the selected communication platforms.
                This UI does not send messages by itself.
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}