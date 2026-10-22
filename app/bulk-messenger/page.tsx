"use client";

import { useMemo, useState } from "react";

type Platform = {
  id: string;
  name: string;
  icon: string;
  description: string;
  connected: boolean;
};

type Contact = {
  id: number;
  name: string;
  email: string;
  phone: string;
  platforms: string[];
  eligible: boolean;
};

const platforms: Platform[] = [
  {
    id: "whatsapp",
    name: "WhatsApp",
    icon: "💬",
    description: "WhatsApp Business contacts",
    connected: false,
  },
  {
    id: "telegram",
    name: "Telegram",
    icon: "✈️",
    description: "Telegram subscribers",
    connected: false,
  },
  {
    id: "email",
    name: "Email",
    icon: "✉️",
    description: "Email recipients",
    connected: false,
  },
  {
    id: "instagram",
    name: "Instagram",
    icon: "◎",
    description: "Instagram messaging",
    connected: false,
  },
  {
    id: "messenger",
    name: "Messenger",
    icon: "⚡",
    description: "Facebook Messenger",
    connected: false,
  },
  {
    id: "sms",
    name: "SMS",
    icon: "📱",
    description: "SMS recipients",
    connected: false,
  },
  {
    id: "discord",
    name: "Discord",
    icon: "🎮",
    description: "Discord communities",
    connected: false,
  },
];

const contacts: Contact[] = [
  {
    id: 1,
    name: "Aarav Sharma",
    email: "aarav@example.com",
    phone: "+91 98XXXXXX21",
    platforms: ["whatsapp", "telegram", "email"],
    eligible: true,
  },
  {
    id: 2,
    name: "Riya Singh",
    email: "riya@example.com",
    phone: "+91 97XXXXXX43",
    platforms: ["whatsapp", "email"],
    eligible: true,
  },
  {
    id: 3,
    name: "Kabir Verma",
    email: "kabir@example.com",
    phone: "+91 96XXXXXX87",
    platforms: ["telegram", "email", "discord"],
    eligible: true,
  },
  {
    id: 4,
    name: "Ananya Das",
    email: "ananya@example.com",
    phone: "+91 95XXXXXX12",
    platforms: ["whatsapp", "instagram"],
    eligible: true,
  },
  {
    id: 5,
    name: "Vihaan Kumar",
    email: "vihaan@example.com",
    phone: "+91 94XXXXXX76",
    platforms: ["email", "telegram"],
    eligible: true,
  },
  {
    id: 6,
    name: "Meera Gupta",
    email: "meera@example.com",
    phone: "+91 93XXXXXX54",
    platforms: ["whatsapp", "email", "sms"],
    eligible: true,
  },
];

export default function BulkMessengerPage() {
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<number[]>([]);
  const [message, setMessage] = useState("");
  const [mediaName, setMediaName] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [showTracking, setShowTracking] = useState(false);

  const eligibleContacts = useMemo(
    () => contacts.filter((contact) => contact.eligible),
    []
  );

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms((current) =>
      current.includes(platformId)
        ? current.filter((id) => id !== platformId)
        : [...current, platformId]
    );
  };

  const toggleContact = (contactId: number) => {
    setSelectedContacts((current) =>
      current.includes(contactId)
        ? current.filter((id) => id !== contactId)
        : [...current, contactId]
    );
  };

  const selectAllContacts = () => {
    if (selectedContacts.length === eligibleContacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(eligibleContacts.map((contact) => contact.id));
    }
  };

  const clearAll = () => {
    setSelectedPlatforms([]);
    setSelectedContacts([]);
    setMessage("");
    setMediaName("");
    setScheduleEnabled(false);
    setScheduledDate("");
    setScheduledTime("");
    setShowPreview(false);
    setShowTracking(false);
  };

  const selectedPlatformObjects = platforms.filter((platform) =>
    selectedPlatforms.includes(platform.id)
  );

  const selectedContactObjects = contacts.filter((contact) =>
    selectedContacts.includes(contact.id)
  );

  const handleSend = () => {
    setShowTracking(true);
  };

  return (
    <main className="bulk-page">
      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .bulk-page {
          min-height: 100vh;
          background:
            radial-gradient(
              circle at 15% 10%,
              rgba(255, 255, 255, 0.95),
              transparent 30%
            ),
            radial-gradient(
              circle at 85% 15%,
              rgba(226, 232, 240, 0.7),
              transparent 28%
            ),
            linear-gradient(135deg, #f8fafc 0%, #eef2f7 48%, #e5e7eb 100%);
          color: #111827;
          padding: 24px;
          font-family:
            Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
            "Segoe UI", sans-serif;
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
          margin-bottom: 24px;
        }

        .brand-area {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .logo {
          width: 46px;
          height: 46px;
          border-radius: 15px;
          display: grid;
          place-items: center;
          color: white;
          font-weight: 900;
          font-size: 16px;
          background: linear-gradient(135deg, #111827, #374151);
          box-shadow:
            0 10px 30px rgba(15, 23, 42, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.2);
        }

        .brand-title {
          font-size: 19px;
          font-weight: 800;
          letter-spacing: -0.03em;
        }

        .brand-subtitle {
          margin-top: 3px;
          font-size: 12px;
          color: #64748b;
        }

        .top-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        button {
          font: inherit;
        }

        .ghost-button,
        .clear-button {
          border: 1px solid rgba(148, 163, 184, 0.35);
          background: rgba(255, 255, 255, 0.65);
          color: #1f2937;
          border-radius: 12px;
          padding: 10px 14px;
          cursor: pointer;
          transition: 0.2s ease;
          backdrop-filter: blur(14px);
        }

        .ghost-button:hover,
        .clear-button:hover {
          background: white;
          transform: translateY(-1px);
        }

        .hero {
          border: 1px solid rgba(148, 163, 184, 0.28);
          border-radius: 25px;
          padding: 28px;
          margin-bottom: 20px;
          background:
            linear-gradient(
              135deg,
              rgba(255, 255, 255, 0.88),
              rgba(255, 255, 255, 0.52)
            );
          box-shadow:
            0 20px 60px rgba(15, 23, 42, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(20px);
        }

        .hero-content {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 30px;
        }

        .eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.06);
          color: #475569;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 12px;
        }

        .hero h1 {
          margin: 0;
          font-size: clamp(27px, 4vw, 42px);
          line-height: 1.05;
          letter-spacing: -0.045em;
        }

        .hero p {
          margin: 12px 0 0;
          max-width: 720px;
          color: #64748b;
          line-height: 1.6;
          font-size: 14px;
        }

        .hero-stat {
          min-width: 170px;
          padding: 17px;
          border-radius: 18px;
          background: rgba(248, 250, 252, 0.78);
          border: 1px solid rgba(148, 163, 184, 0.25);
          text-align: center;
        }

        .hero-stat-number {
          font-size: 27px;
          font-weight: 850;
        }

        .hero-stat-label {
          margin-top: 4px;
          font-size: 11px;
          color: #64748b;
        }

        .workspace {
          display: grid;
          grid-template-columns: minmax(0, 1.6fr) minmax(320px, 0.8fr);
          gap: 20px;
          align-items: start;
        }

        .left-column,
        .right-column {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .card {
          border: 1px solid rgba(148, 163, 184, 0.27);
          border-radius: 21px;
          padding: 21px;
          background: rgba(255, 255, 255, 0.68);
          box-shadow: 0 14px 45px rgba(15, 23, 42, 0.055);
          backdrop-filter: blur(18px);
        }

        .card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 18px;
        }

        .section-title {
          font-size: 15px;
          font-weight: 800;
          letter-spacing: -0.02em;
        }

        .section-subtitle {
          margin-top: 4px;
          color: #64748b;
          font-size: 12px;
          line-height: 1.5;
        }

        .step {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          border-radius: 9px;
          background: #111827;
          color: white;
          font-size: 11px;
          font-weight: 800;
        }

        .platform-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }

        .platform-card {
          position: relative;
          border: 1px solid rgba(148, 163, 184, 0.28);
          border-radius: 15px;
          padding: 14px;
          min-height: 105px;
          background: rgba(248, 250, 252, 0.72);
          cursor: pointer;
          transition: 0.2s ease;
          text-align: left;
        }

        .platform-card:hover {
          transform: translateY(-2px);
          border-color: rgba(15, 23, 42, 0.3);
          background: white;
        }

        .platform-card.selected {
          border-color: #111827;
          background: rgba(241, 245, 249, 0.95);
          box-shadow: inset 0 0 0 1px #111827;
        }

        .platform-icon {
          width: 35px;
          height: 35px;
          border-radius: 11px;
          display: grid;
          place-items: center;
          background: white;
          border: 1px solid rgba(148, 163, 184, 0.22);
          font-size: 17px;
          margin-bottom: 10px;
        }

        .platform-name {
          font-size: 13px;
          font-weight: 750;
        }

        .platform-description {
          margin-top: 3px;
          color: #64748b;
          font-size: 10px;
          line-height: 1.35;
        }

        .selected-check {
          position: absolute;
          top: 10px;
          right: 10px;
          width: 20px;
          height: 20px;
          border-radius: 7px;
          display: grid;
          place-items: center;
          background: #111827;
          color: white;
          font-size: 11px;
        }

        textarea {
          width: 100%;
          min-height: 175px;
          resize: vertical;
          border-radius: 16px;
          border: 1px solid rgba(148, 163, 184, 0.3);
          background: rgba(248, 250, 252, 0.7);
          padding: 16px;
          outline: none;
          color: #111827;
          font-size: 14px;
          line-height: 1.6;
          transition: 0.2s ease;
        }

        textarea:focus,
        input:focus {
          border-color: #334155;
          background: white;
          box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.06);
        }

        .composer-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-top: 12px;
        }

        .media-button {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px dashed #94a3b8;
          border-radius: 11px;
          padding: 9px 12px;
          cursor: pointer;
          color: #475569;
          background: rgba(255, 255, 255, 0.45);
          font-size: 12px;
        }

        .media-button input {
          display: none;
        }

        .counter {
          color: #94a3b8;
          font-size: 11px;
        }

        .contact-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 12px;
        }

        .select-all {
          border: 0;
          background: transparent;
          color: #334155;
          cursor: pointer;
          font-size: 12px;
          font-weight: 700;
        }

        .contact-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 320px;
          overflow: auto;
          padding-right: 2px;
        }

        .contact-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 11px;
          border-radius: 14px;
          border: 1px solid transparent;
          background: rgba(248, 250, 252, 0.68);
          cursor: pointer;
          transition: 0.18s ease;
        }

        .contact-row:hover {
          background: white;
          border-color: rgba(148, 163, 184, 0.25);
        }

        .contact-row.selected {
          background: #f1f5f9;
          border-color: rgba(15, 23, 42, 0.16);
        }

        .checkbox {
          width: 18px;
          height: 18px;
          border-radius: 6px;
          border: 1px solid #94a3b8;
          display: grid;
          place-items: center;
          flex-shrink: 0;
          font-size: 10px;
        }

        .checkbox.checked {
          background: #111827;
          color: white;
          border-color: #111827;
        }

        .avatar {
          width: 36px;
          height: 36px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          background: linear-gradient(135deg, #e2e8f0, #cbd5e1);
          font-weight: 800;
          color: #334155;
          flex-shrink: 0;
          font-size: 12px;
        }

        .contact-info {
          min-width: 0;
          flex: 1;
        }

        .contact-name {
          font-size: 12px;
          font-weight: 750;
        }

        .contact-email {
          margin-top: 2px;
          font-size: 10px;
          color: #64748b;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .contact-platforms {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .mini-platform {
          width: 22px;
          height: 22px;
          display: grid;
          place-items: center;
          border-radius: 7px;
          background: white;
          font-size: 11px;
          border: 1px solid rgba(148, 163, 184, 0.2);
        }

        .preview-message {
          min-height: 130px;
          border-radius: 16px;
          padding: 16px;
          background: #111827;
          color: white;
          white-space: pre-wrap;
          word-break: break-word;
          font-size: 13px;
          line-height: 1.6;
        }

        .empty-preview {
          color: #94a3b8;
          font-style: italic;
        }

        .preview-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 12px;
        }

        .pill {
          border-radius: 999px;
          padding: 6px 9px;
          background: #f1f5f9;
          color: #475569;
          font-size: 10px;
          font-weight: 700;
        }

        .schedule-box {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 13px;
          border-radius: 15px;
          background: rgba(248, 250, 252, 0.8);
          border: 1px solid rgba(148, 163, 184, 0.22);
          margin-bottom: 12px;
        }

        .schedule-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .toggle {
          width: 42px;
          height: 24px;
          border-radius: 999px;
          border: 0;
          padding: 3px;
          background: #cbd5e1;
          cursor: pointer;
          transition: 0.2s ease;
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

        .date-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 9px;
        }

        input[type="date"],
        input[type="time"] {
          width: 100%;
          border: 1px solid rgba(148, 163, 184, 0.3);
          background: rgba(248, 250, 252, 0.8);
          border-radius: 12px;
          padding: 11px;
          outline: none;
          color: #1f2937;
        }

        .action-stack {
          display: flex;
          flex-direction: column;
          gap: 9px;
        }

        .primary-button,
        .secondary-button {
          width: 100%;
          border-radius: 13px;
          padding: 13px 15px;
          cursor: pointer;
          font-weight: 750;
          transition: 0.2s ease;
        }

        .primary-button {
          border: 1px solid #111827;
          background: #111827;
          color: white;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.15);
        }

        .primary-button:hover {
          transform: translateY(-1px);
          background: #1f2937;
        }

        .secondary-button {
          border: 1px solid rgba(148, 163, 184, 0.3);
          background: rgba(255, 255, 255, 0.7);
          color: #1f2937;
        }

        .secondary-button:hover {
          background: white;
        }

        .primary-button:disabled,
        .secondary-button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          transform: none;
        }

        .tracking {
          border: 1px solid rgba(34, 197, 94, 0.2);
          background: rgba(240, 253, 244, 0.7);
        }

        .tracking-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 800;
        }

        .live-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 0 5px rgba(34, 197, 94, 0.1);
        }

        .tracking-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-top: 15px;
        }

        .tracking-stat {
          padding: 12px;
          background: rgba(255, 255, 255, 0.65);
          border-radius: 12px;
          text-align: center;
        }

        .tracking-number {
          font-size: 20px;
          font-weight: 850;
        }

        .tracking-label {
          margin-top: 3px;
          color: #64748b;
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .notice {
          margin-top: 13px;
          padding: 11px 12px;
          border-radius: 12px;
          background: rgba(241, 245, 249, 0.8);
          color: #64748b;
          font-size: 10px;
          line-height: 1.5;
        }

        @media (max-width: 1050px) {
          .workspace {
            grid-template-columns: 1fr;
          }

          .platform-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 700px) {
          .bulk-page {
            padding: 12px;
          }

          .topbar,
          .hero-content {
            align-items: flex-start;
            flex-direction: column;
          }

          .top-actions {
            width: 100%;
          }

          .top-actions button {
            flex: 1;
          }

          .hero {
            padding: 20px;
          }

          .platform-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .card {
            padding: 16px;
          }

          .tracking-grid {
            grid-template-columns: 1fr 1fr 1fr;
          }
        }
      `}</style>

      <div className="shell">
        <header className="topbar">
          <div className="brand-area">
            <div className="logo">Z</div>

            <div>
              <div className="brand-title">ZUQEN Multi-Channel</div>
              <div className="brand-subtitle">
                Bulk Messenger Workspace
              </div>
            </div>
          </div>

          <div className="top-actions">
            <button
              type="button"
              className="clear-button"
              onClick={clearAll}
            >
              Clear
            </button>

            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                window.location.href = "/";
              }}
            >
              ← Back to ZUQEN
            </button>
          </div>
        </header>

        <section className="hero">
          <div className="hero-content">
            <div>
              <div className="eyebrow">
                <span>●</span>
                Messaging Workspace
              </div>

              <h1>Send Bulk to Eligible Contacts</h1>

              <p>
                Compose once, choose the communication channels, select
                eligible opted-in contacts, preview your message, and prepare
                it for delivery from one unified ZUQEN workspace.
              </p>
            </div>

            <div className="hero-stat">
              <div className="hero-stat-number">
                {selectedContacts.length}
              </div>
              <div className="hero-stat-label">
                contacts selected
              </div>
            </div>
          </div>
        </section>

        <div className="workspace">
          <div className="left-column">
            <section className="card">
              <div className="card-header">
                <div>
                  <div className="section-title">
                    <span className="step">1</span>{" "}
                    Select Communication Apps
                  </div>
                  <div className="section-subtitle">
                    Choose one or multiple channels for this campaign.
                  </div>
                </div>

                <div className="pill">
                  {selectedPlatforms.length} selected
                </div>
              </div>

              <div className="platform-grid">
                {platforms.map((platform) => {
                  const selected = selectedPlatforms.includes(platform.id);

                  return (
                    <button
                      key={platform.id}
                      type="button"
                      className={`platform-card ${
                        selected ? "selected" : ""
                      }`}
                      onClick={() => togglePlatform(platform.id)}
                    >
                      {selected && (
                        <span className="selected-check">✓</span>
                      )}

                      <div className="platform-icon">
                        {platform.icon}
                      </div>

                      <div className="platform-name">
                        {platform.name}
                      </div>

                      <div className="platform-description">
                        {platform.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="card">
              <div className="card-header">
                <div>
                  <div className="section-title">
                    <span className="step">2</span> Compose Message
                  </div>
                  <div className="section-subtitle">
                    Write the message you want to deliver.
                  </div>
                </div>
              </div>

              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Write your message here..."
                maxLength={5000}
              />

              <div className="composer-footer">
                <label className="media-button">
                  📎 Attach media
                  <input
                    type="file"
                    accept="image/*,video/*,.pdf"
                    onChange={(event) => {
                      const file = event.target.files?.[0];

                      if (file) {
                        setMediaName(file.name);
                      }
                    }}
                  />
                </label>

                <div className="counter">
                  {message.length}/5000
                </div>
              </div>

              {mediaName && (
                <div className="notice">
                  📎 Attached: <strong>{mediaName}</strong>
                </div>
              )}
            </section>

            <section className="card">
              <div className="card-header">
                <div>
                  <div className="section-title">
                    <span className="step">3</span> Eligible Contacts
                  </div>
                  <div className="section-subtitle">
                    Only contacts who are eligible for the selected
                    communication flow should be included.
                  </div>
                </div>

                <div className="pill">
                  {eligibleContacts.length} eligible
                </div>
              </div>

              <div className="contact-toolbar">
                <span className="counter">
                  {selectedContacts.length} selected
                </span>

                <button
                  type="button"
                  className="select-all"
                  onClick={selectAllContacts}
                >
                  {selectedContacts.length === eligibleContacts.length
                    ? "Deselect all"
                    : "Select all"}
                </button>
              </div>

              <div className="contact-list">
                {eligibleContacts.map((contact) => {
                  const selected = selectedContacts.includes(contact.id);

                  return (
                    <div
                      key={contact.id}
                      className={`contact-row ${
                        selected ? "selected" : ""
                      }`}
                      onClick={() => toggleContact(contact.id)}
                    >
                      <div
                        className={`checkbox ${
                          selected ? "checked" : ""
                        }`}
                      >
                        {selected ? "✓" : ""}
                      </div>

                      <div className="avatar">
                        {contact.name
                          .split(" ")
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)}
                      </div>

                      <div className="contact-info">
                        <div className="contact-name">
                          {contact.name}
                        </div>

                        <div className="contact-email">
                          {contact.email}
                        </div>
                      </div>

                      <div className="contact-platforms">
                        {contact.platforms.map((platformId) => {
                          const platform = platforms.find(
                            (item) => item.id === platformId
                          );

                          return (
                            <span
                              className="mini-platform"
                              key={platformId}
                              title={platform?.name}
                            >
                              {platform?.icon}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <div className="right-column">
            <section className="card">
              <div className="card-header">
                <div>
                  <div className="section-title">
                    <span className="step">4</span> Message Preview
                  </div>

                  <div className="section-subtitle">
                    Review exactly what you are preparing to send.
                  </div>
                </div>
              </div>

              <div className="preview-message">
                {message.trim() ? (
                  message
                ) : (
                  <span className="empty-preview">
                    Your message preview will appear here...
                  </span>
                )}
              </div>

              <div className="preview-meta">
                <span className="pill">
                  {selectedPlatforms.length} apps
                </span>

                <span className="pill">
                  {selectedContacts.length} contacts
                </span>

                {mediaName && (
                  <span className="pill">📎 Media attached</span>
                )}
              </div>

              <button
                type="button"
                className="secondary-button"
                style={{ marginTop: 12 }}
                onClick={() => setShowPreview((value) => !value)}
              >
                {showPreview ? "Hide Detailed Preview" : "Open Detailed Preview"}
              </button>

              {showPreview && (
                <div className="notice">
                  <strong>Selected channels:</strong>{" "}
                  {selectedPlatformObjects.length
                    ? selectedPlatformObjects
                        .map((platform) => platform.name)
                        .join(", ")
                    : "None selected"}
                  <br />
                  <br />
                  <strong>Recipients:</strong>{" "}
                  {selectedContactObjects.length
                    ? selectedContactObjects
                        .map((contact) => contact.name)
                        .join(", ")
                    : "None selected"}
                </div>
              )}
            </section>

            <section className="card">
              <div className="card-header">
                <div>
                  <div className="section-title">
                    <span className="step">5</span> Delivery
                  </div>

                  <div className="section-subtitle">
                    Send now or prepare a scheduled delivery.
                  </div>
                </div>
              </div>

              <div className="schedule-box">
                <div className="schedule-left">
                  <span>🕒</span>

                  <div>
                    <div className="contact-name">
                      Schedule delivery
                    </div>

                    <div className="counter">
                      Choose a future date and time
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
                  aria-label="Toggle schedule"
                >
                  <span className="toggle-dot" />
                </button>
              </div>

              {scheduleEnabled && (
                <div className="date-grid">
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(event) =>
                      setScheduledDate(event.target.value)
                    }
                  />

                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(event) =>
                      setScheduledTime(event.target.value)
                    }
                  />
                </div>
              )}

              <div className="action-stack" style={{ marginTop: 13 }}>
                <button
                  type="button"
                  className="primary-button"
                  disabled={
                    !message.trim() ||
                    selectedPlatforms.length === 0 ||
                    selectedContacts.length === 0
                  }
                  onClick={handleSend}
                >
                  {scheduleEnabled
                    ? "🕒 Schedule Campaign"
                    : "📤 Prepare Send"}
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowTracking((value) => !value)}
                >
                  📊 View Delivery Tracking
                </button>
              </div>

              <div className="notice">
                ZUQEN will only be connected to official messaging
                providers and eligible/authorized recipients when real
                delivery integrations are enabled.
              </div>
            </section>

            {showTracking && (
              <section className="card tracking">
                <div className="tracking-title">
                  <span className="live-dot" />
                  Delivery Tracking
                </div>

                <div className="section-subtitle">
                  Campaign status will appear here once a real delivery
                  provider is connected.
                </div>

                <div className="tracking-grid">
                  <div className="tracking-stat">
                    <div className="tracking-number">
                      {selectedContacts.length}
                    </div>
                    <div className="tracking-label">Prepared</div>
                  </div>

                  <div className="tracking-stat">
                    <div className="tracking-number">0</div>
                    <div className="tracking-label">Delivered</div>
                  </div>

                  <div className="tracking-stat">
                    <div className="tracking-number">0</div>
                    <div className="tracking-label">Failed</div>
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}