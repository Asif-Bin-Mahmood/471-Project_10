import { useEffect, useMemo, useRef } from "react";
import {
  Bell,
  CalendarCheck,
  CheckCheck,
  CircleDollarSign,
  MessageSquareText,
  Search,
  Send,
  Settings
} from "lucide-react";

const conversationFilters = ["all", "unread", "owners", "bookings"];
const notificationFilters = ["all", "booking", "message", "payment", "system"];

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
  onSend,
  busy
}) {
  const messageFeedRef = useRef(null);
  const selectedConversation = conversations.find((item) => item._id === selectedConversationId);
  const selectedParticipant = selectedConversation ? otherParticipant(selectedConversation, user?._id) : null;

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
      <section className="messages-workspace">
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
                    <span className={`conversation-preview ${unread ? "unread" : ""}`}>{latest?.body || "No messages yet"}</span>
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
            <form className="active-conversation" onSubmit={onSend}>
              <header className="active-conversation-header">
                <Avatar name={selectedParticipant?.name || selectedConversation.subject} size="small" />
                <div><strong>{selectedParticipant?.name || selectedConversation.subject}</strong><p>{roleLabel(selectedParticipant?.role)}{selectedConversation.listing?.title ? ` · ${selectedConversation.listing.title}` : ""}</p></div>
                <span className={`realtime-status ${socketStatus}`}>{connectionLabel}</span>
              </header>
              <div className="modern-message-feed" ref={messageFeedRef}>
                {messages.map((message) => {
                  const mine = String(message.sender?._id || message.sender) === String(user?._id);
                  return (
                    <div className={`modern-message ${mine ? "mine" : "theirs"}`} key={message._id}>
                      <div><p>{message.body}</p><time>{relativeTime(message.createdAt)}</time></div>
                    </div>
                  );
                })}
                {!messages.length && <div className="communications-list-empty"><MessageSquareText size={22} /><strong>No messages yet</strong><p>Start the conversation below.</p></div>}
              </div>
              <input type="hidden" name="conversationId" value={selectedConversationId} />
              <div className="modern-compose-row">
                <textarea name="message" placeholder="Write a message..." aria-label="Message" required />
                <button type="submit" disabled={busy}><Send size={17} />Send</button>
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
                {item === "booking" ? "Bookings" : item === "message" ? "Messages" : item === "payment" ? "Payments" : item[0].toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="modern-notification-list">
          {visibleNotifications.map((item) => {
            const Icon = notificationIcon(item.type);
            return (
              <article className={`modern-notification ${item.read ? "read" : "unread"}`} key={item._id}>
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
                  <button type="button" onClick={() => onView(item)}>View</button>
                  {!item.read && <button type="button" className="secondary" onClick={() => onRead(item._id)}>Mark as read</button>}
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
