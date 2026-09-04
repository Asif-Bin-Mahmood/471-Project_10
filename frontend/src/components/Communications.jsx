import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bell,
  CalendarCheck,
  Check,
  CheckCheck,
  CircleDollarSign,
  ImagePlus,
  LoaderCircle,
  MessageSquareText,
  Mic,
  Search,
  Send,
  Settings,
  Square,
  X
} from "lucide-react";
import { uploadMessageAttachment } from "../services/messageAttachment.js";

const conversationFilters = ["all", "unread", "owners", "bookings"];
// The backend raises exactly these four notification types. Chips are built
// from the types the signed-in user actually has, in this order, so a filter
// is never offered for a category that would come back empty. A business owner
// therefore sees Bookings and Messages, while a listing owner also sees Reviews.
const notificationTypeOrder = ["booking", "message", "review", "verification"];
const notificationFilterLabels = {
  all: "All",
  booking: "Bookings",
  message: "Messages",
  review: "Reviews",
  verification: "Verifications"
};

function relativeTime(value) {
  if (!value) return "";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "";
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d`;
  return new Date(value).toLocaleDateString([], { month: "short", day: "numeric" });
}

function initials(name = "OfficeKhoj") {
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function avatarTone(name = "") {
  const tones = ["blue", "teal", "violet", "orange"];
  const score = [...String(name)].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return tones[score % tones.length];
}

function otherParticipant(conversation, userId) {
  return conversation.participants?.find((participant) => String(participant?._id) !== String(userId)) ||
    conversation.participants?.[0] ||
    null;
}

function latestMessage(conversation) {
  return conversation.messages?.at(-1) || null;
}

function messagePreview(message) {
  if (!message) return "No messages yet";
  if (message.body) return message.body;
  if (message.kind === "image") return "📷 Image";
  if (message.kind === "audio") return "🎙 Voice message";
  return "Message";
}

function unreadMessages(conversation, userId) {
  return (conversation.messages || []).filter((message) => (
    String(message.sender?._id || message.sender) !== String(userId) &&
    !(message.readBy || []).some((reader) => String(reader?._id || reader) === String(userId))
  )).length;
}

function roleLabel(role = "") {
  return {
    "property-owner": "Property owner",
    "service-provider": "Service provider",
    "business-owner": "Business owner",
    admin: "Administrator"
  }[role] || String(role).replaceAll("-", " ") || "Member";
}

function CommunicationsHeader({ title, subtitle, actions }) {
  return (
    <div className="communications-header">
      <div><h2>{title}</h2><p>{subtitle}</p></div>
      {actions && <div className="communications-header-actions">{actions}</div>}
    </div>
  );
}

function Avatar({ name, size = "regular" }) {
  return <span className={`communications-avatar ${avatarTone(name)} ${size}`}>{initials(name)}</span>;
}

export function MessagesPage({
  conversations,
  selectedConversationId,
  messages,
  user,
  socketStatus,
  search,
  onSearch,
  filter,
  onFilter,
  onSelect,
  onBack,
  onSend,
  busy
}) {
  const messageFeedRef = useRef(null);
  const imageInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingStreamRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingStartedAtRef = useRef(0);
  const [draft, setDraft] = useState("");
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [composerBusy, setComposerBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [composerError, setComposerError] = useState("");
  const selectedConversation = conversations.find((item) => item._id === selectedConversationId);
  const selectedParticipant = selectedConversation ? otherParticipant(selectedConversation, user?._id) : null;
  const selectedParticipantId = selectedParticipant?._id;

  const filteredConversations = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return conversations.filter((conversation) => {
      const participant = otherParticipant(conversation, user?._id);
      const latest = latestMessage(conversation);
      const searchable = [
        participant?.name,
        participant?.role,
        conversation.subject,
        conversation.listing?.title,
        conversation.listing?.area,
        latest?.body
      ].filter(Boolean).join(" ").toLowerCase();
      if (normalizedSearch && !searchable.includes(normalizedSearch)) return false;
      if (filter === "unread") return unreadMessages(conversation, user?._id) > 0;
      if (filter === "owners") return ["property-owner", "service-provider"].includes(participant?.role);
      if (filter === "bookings") return /booking|visit|tour/i.test(`${conversation.subject || ""} ${latest?.body || ""}`);
      return true;
    });
  }, [conversations, filter, search, user?._id]);

  useEffect(() => {
    if (!messageFeedRef.current) return;
    messageFeedRef.current.scrollTop = messageFeedRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => () => {
    if (pendingAttachment?.previewUrl) URL.revokeObjectURL(pendingAttachment.previewUrl);
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, [pendingAttachment?.previewUrl]);

  function clearAttachment() {
    if (pendingAttachment?.previewUrl) URL.revokeObjectURL(pendingAttachment.previewUrl);
    setPendingAttachment(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  function chooseImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(file.type)) {
      setComposerError("Choose a JPEG, PNG or WebP image.");
      event.target.value = "";
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setComposerError("Images must be 8 MB or smaller.");
      event.target.value = "";
      return;
    }
    clearAttachment();
    setPendingAttachment({ file, kind: "image", previewUrl: URL.createObjectURL(file), durationSeconds: 0 });
    setComposerError("");
  }

  async function toggleRecording() {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setComposerError("Voice recording is not supported by this browser.");
      return;
    }
    try {
      clearAttachment();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const supportedType = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"]
        .find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, supportedType ? { mimeType: supportedType } : undefined);
      recordingStreamRef.current = stream;
      recordingChunksRef.current = [];
      recordingStartedAtRef.current = Date.now();
      recorder.ondataavailable = (event) => {
        if (event.data?.size) recordingChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const durationSeconds = Math.max(1, Math.round((Date.now() - recordingStartedAtRef.current) / 1000));
        const contentType = String(recorder.mimeType || "audio/webm").split(";")[0];
        const extension = contentType === "audio/mp4" ? "m4a" : contentType === "audio/ogg" ? "ogg" : "webm";
        const file = new File(recordingChunksRef.current, `voice-${Date.now()}.${extension}`, { type: contentType });
        recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        if (file.size) setPendingAttachment({ file, kind: "audio", previewUrl: URL.createObjectURL(file), durationSeconds });
      };
      recorder.onerror = () => {
        setComposerError("The voice recording could not be completed.");
        setRecording(false);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setComposerError("");
    } catch {
      setComposerError("Microphone access was not granted. Allow it in your browser and try again.");
    }
  }

  async function submitMessage(event) {
    event.preventDefault();
    const message = draft.trim();
    if ((!message && !pendingAttachment) || composerBusy || busy || recording) return;
    setComposerBusy(true);
    setComposerError("");
    try {
      let attachment = null;
      if (pendingAttachment) {
        attachment = await uploadMessageAttachment(pendingAttachment.file, pendingAttachment.kind, selectedConversationId);
      }
      const sent = await onSend({
        conversationId: selectedConversationId,
        message,
        kind: attachment?.kind || "text",
        attachmentUrl: attachment?.url || "",
        attachmentName: attachment?.name || "",
        attachmentMimeType: attachment?.contentType || "",
        attachmentSize: attachment?.size || 0,
        durationSeconds: pendingAttachment?.durationSeconds || 0
      });
      if (sent) {
        setDraft("");
        clearAttachment();
      }
    } catch (error) {
      setComposerError(error.message || "The message could not be sent.");
    } finally {
      setComposerBusy(false);
    }
  }

  const connectionLabel = socketStatus === "connected"
    ? "Live"
    : socketStatus === "reconnecting"
      ? "Reconnecting"
      : socketStatus === "connecting"
        ? "Connecting"
        : "Offline";

  return (
    <div className="communications-page messages-page">
      <CommunicationsHeader title="Messages" subtitle={`${conversations.length} conversation${conversations.length === 1 ? "" : "s"}`} />
      <section className={`messages-workspace ${selectedConversation ? "has-selection" : "show-list"}`}>
        <aside className="conversation-column">
          <div className="conversation-tools">
            <label className="conversation-search">
              <Search size={18} />
              <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search conversations..." />
            </label>
            <div className="communications-filters" aria-label="Conversation filters">
              {conversationFilters.map((item) => (
                <button type="button" className={filter === item ? "active" : ""} key={item} onClick={() => onFilter(item)}>
                  {item[0].toUpperCase() + item.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="conversation-list">
            {filteredConversations.map((conversation) => {
              const participant = otherParticipant(conversation, user?._id);
              const latest = latestMessage(conversation);
              const unread = unreadMessages(conversation, user?._id);
              return (
                <button
                  type="button"
                  className={`conversation-row ${conversation._id === selectedConversationId ? "active" : ""}`}
                  key={conversation._id}
                  onClick={() => onSelect(conversation._id)}
                >
                  <Avatar name={participant?.name || conversation.subject} />
                  <span className="conversation-summary">
                    <span className="conversation-line"><strong>{participant?.name || conversation.subject}</strong><time>{relativeTime(latest?.createdAt || conversation.updatedAt)}</time></span>
                    <span className="conversation-context">{roleLabel(participant?.role)}{conversation.listing?.title ? ` · ${conversation.listing.title}` : ""}</span>
                    <span className={`conversation-preview ${unread ? "unread" : ""}`}>{messagePreview(latest)}</span>
                  </span>
                  {unread > 0 && <span className="conversation-unread">{unread}</span>}
                </button>
              );
            })}
            {!filteredConversations.length && (
              <div className="communications-list-empty"><Search size={22} /><strong>No conversations found</strong><p>Try a different search or filter.</p></div>
            )}
          </div>
        </aside>

        <section className="conversation-stage">
          {!selectedConversation ? (
            <div className="conversation-empty">
              <span><MessageSquareText size={30} /></span>
              <h3>Select a conversation</h3>
              <p>Chat with property owners or service providers about listings, terms, and bookings.</p>
            </div>
          ) : (
            <form className="active-conversation" onSubmit={submitMessage}>
              <header className="active-conversation-header">
                <button className="mobile-conversation-back" type="button" aria-label="Back to conversations" onClick={onBack}><ArrowLeft size={18} /></button>
                <Avatar name={selectedParticipant?.name || selectedConversation.subject} size="small" />
                <div><strong>{selectedParticipant?.name || selectedConversation.subject}</strong><p>{roleLabel(selectedParticipant?.role)}{selectedConversation.listing?.title ? ` · ${selectedConversation.listing.title}` : ""}</p></div>
                <span className={`realtime-status ${socketStatus}`}>{connectionLabel}</span>
              </header>
              <div className="modern-message-feed" ref={messageFeedRef}>
                {messages.map((message, index) => {
                  const mine = String(message.sender?._id || message.sender) === String(user?._id);
                  const readByRecipient = mine && (message.readBy || []).some(
                    (reader) => String(reader?._id || reader) === String(selectedParticipantId)
                  );
                  const isLatestOwnMessage = mine && !messages.slice(index + 1).some(
                    (nextMessage) => String(nextMessage.sender?._id || nextMessage.sender) === String(user?._id)
                  );
                  return (
                    <div className={`modern-message ${mine ? "mine" : "theirs"}`} key={message._id}>
                      <div className={`message-bubble ${message.kind || "text"}`}>
                        {message.kind === "image" && message.attachmentUrl && (
                          <a className="message-image-link" href={message.attachmentUrl} target="_blank" rel="noreferrer" aria-label="Open full-size image">
                            <img src={message.attachmentUrl} alt={message.attachmentName || "Shared image"} />
                          </a>
                        )}
                        {message.kind === "audio" && message.attachmentUrl && (
                          <div className="message-audio"><Mic size={16} aria-hidden="true" /><audio controls preload="metadata" src={message.attachmentUrl}>Your browser cannot play this voice message.</audio></div>
                        )}
                        {message.body && <p>{message.body}</p>}
                        <span className="message-meta">
                          <time title={new Date(message.createdAt).toLocaleString()}>{relativeTime(message.createdAt)}</time>
                          {isLatestOwnMessage && (
                            <span className={`message-delivery ${readByRecipient ? "seen" : "sent"}`}>
                              {readByRecipient ? <CheckCheck size={13} /> : <Check size={13} />}
                              {readByRecipient ? "Seen" : "Sent"}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {!messages.length && <div className="communications-list-empty"><MessageSquareText size={22} /><strong>No messages yet</strong><p>Start the conversation below.</p></div>}
              </div>
              <input type="hidden" name="conversationId" value={selectedConversationId} />
              <div className="message-composer-shell">
                {pendingAttachment && (
                  <div className="message-attachment-preview">
                    {pendingAttachment.kind === "image"
                      ? <img src={pendingAttachment.previewUrl} alt="Selected attachment preview" />
                      : <span className="voice-preview"><Mic size={17} /><span><strong>Voice message</strong><small>{pendingAttachment.durationSeconds}s ready to send</small></span><audio controls src={pendingAttachment.previewUrl} /></span>}
                    <button type="button" onClick={clearAttachment} aria-label="Remove attachment"><X size={16} /></button>
                  </div>
                )}
                {composerError && <p className="message-composer-error" role="alert">{composerError}</p>}
                <div className="modern-compose-row">
                  <input ref={imageInputRef} className="message-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseImage} />
                  <button className="compose-icon-button" type="button" onClick={() => imageInputRef.current?.click()} aria-label="Attach an image" title="Attach image" disabled={busy || composerBusy || recording}><ImagePlus size={19} /></button>
                  <button className={`compose-icon-button voice ${recording ? "recording" : ""}`} type="button" onClick={toggleRecording} aria-label={recording ? "Stop voice recording" : "Record a voice message"} title={recording ? "Stop recording" : "Record voice"} disabled={busy || composerBusy}>
                    {recording ? <Square size={16} fill="currentColor" /> : <Mic size={19} />}
                  </button>
                  <textarea name="message" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }} placeholder={recording ? "Recording voice message…" : "Write a message"} aria-label="Message" maxLength="4000" disabled={recording} />
                  <button className="compose-send-button" type="submit" disabled={busy || composerBusy || recording || (!draft.trim() && !pendingAttachment)}>
                    {composerBusy ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />}<span>Send</span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </section>
      </section>
    </div>
  );
}

function notificationIcon(type) {
  if (type === "booking") return CalendarCheck;
  if (type === "message") return MessageSquareText;
  if (type === "payment") return CircleDollarSign;
  return Settings;
}

export function NotificationsPage({ notifications, unreadCount, filter, onFilter, onRead, onReadAll, onView, busy }) {
  const visibleNotifications = filter === "all" ? notifications : notifications.filter((item) => item.type === filter);
  const presentTypes = new Set(notifications.map((item) => item.type));
  const notificationFilters = ["all", ...notificationTypeOrder.filter((type) => presentTypes.has(type))];

  return (
    <div className="communications-page notifications-page">
      <CommunicationsHeader
        title="Notifications"
        subtitle={`${unreadCount} unread`}
        actions={(
          <button className="mark-all-read" type="button" onClick={onReadAll} disabled={!unreadCount || busy}>
            <CheckCheck size={17} />Mark all as read
          </button>
        )}
      />
      <section className="notifications-workspace">
        <div className="notifications-toolbar">
          <div className="communications-filters" aria-label="Notification filters">
            {notificationFilters.map((item) => (
              <button type="button" className={filter === item ? "active" : ""} key={item} onClick={() => onFilter(item)}>
                {notificationFilterLabels[item] || item[0].toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="modern-notification-list">
          {visibleNotifications.map((item) => {
            const Icon = notificationIcon(item.type);
            return (
              <article
                className={`modern-notification ${item.read ? "read" : "unread"}`}
                key={item._id}
                role="link"
                tabIndex="0"
                aria-label={`Open ${item.title}`}
                onClick={() => onView(item)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onView(item);
                  }
                }}
              >
                <span className={`notification-icon ${item.type}`}><Icon size={20} /></span>
                <div className="notification-copy">
                  <div className="notification-title-line">
                    <strong>{item.title}</strong>
                    <span className="notification-type">{item.type}</span>
                    {!item.read && <i aria-label="Unread" />}
                  </div>
                  <p>{item.message}</p>
                  <time>{relativeTime(item.createdAt)}</time>
                </div>
                <div className="notification-actions">
                  <span className="notification-open-hint">Open</span>
                  {!item.read && <button type="button" className="secondary" onClick={(event) => { event.stopPropagation(); onRead(item._id); }}>Mark as read</button>}
                </div>
              </article>
            );
          })}
          {!visibleNotifications.length && (
            <div className="communications-list-empty notification-empty"><Bell size={24} /><strong>No notifications</strong><p>No real notifications match this filter.</p></div>
          )}
        </div>
      </section>
    </div>
  );
}
