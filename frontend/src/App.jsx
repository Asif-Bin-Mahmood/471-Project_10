import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bell,
  Bookmark,
  BriefcaseBusiness,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Compass,
  Database,
  Gauge,
  Heart,
  LayoutDashboard,
  LifeBuoy,
  ListPlus,
  Mail,
  MapPin,
  MessageSquareText,
  PanelLeft,
  PhoneCall,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Store,
  UserRound,
  UsersRound,
  Wrench,
  XCircle
} from "lucide-react";
import { api, setAuthToken } from "./api/client.js";
import AddressAutocomplete from "./components/AddressAutocomplete.jsx";
import { MessagesPage, NotificationsPage } from "./components/Communications.jsx";
import ListingMap from "./components/ListingMap.jsx";
import { connectSocket, disconnectSocket, getSocket } from "./realtime/socket.js";

const demoLogins = {
  business: { email: "obaeed@officekhoj.bd", password: "demo123" },
  property: { email: "owner@officekhoj.bd", password: "demo123" },
  service: { email: "interior@officekhoj.bd", password: "demo123" },
  admin: { email: "admin@officekhoj.bd", password: "admin123" }
};

const roles = [
  { key: "business", label: "Business", icon: BriefcaseBusiness },
  { key: "property", label: "Property", icon: Building2 },
  { key: "service", label: "Service", icon: Wrench },
  { key: "admin", label: "Admin", icon: ShieldCheck }
];

const roleLandingViews = {
  business: "marketplace",
  property: "listings",
  service: "listings",
  admin: "admin"
};

const navItems = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "marketplace", label: "Marketplace", icon: Search },
  { key: "listings", label: "Listings", icon: ListPlus },
  { key: "pipeline", label: "Pipeline", icon: CalendarCheck },
  { key: "messages", label: "Messages", icon: MessageSquareText },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "workspace", label: "Workspace", icon: Compass },
  { key: "operations", label: "Operations", icon: Gauge },
  { key: "support", label: "Support", icon: LifeBuoy },
  { key: "admin", label: "Admin", icon: ShieldCheck }
];

const initialSearchQuery = {
  area: "Banani",
  type: "all",
  category: "all",
  sort: "distance",
  minPrice: 0,
  maxPrice: 150000,
  minSize: 0,
  page: 1,
  pageSize: 8
};

const CUSTOMER_SERVICE_PHONE = "+8801636317693";
const categoryValues = ["Office", "Shop", "Interior", "ISP", "Electrician"];

function normalizePreferenceNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function hasSavedSearchPreferences(profile) {
  if (!profile) return false;
  return Boolean(
    String(profile.preferredArea || "").trim() ||
    normalizePreferenceNumber(profile.budgetMin) > 0 ||
    normalizePreferenceNumber(profile.budgetMax) > 0 ||
    normalizePreferenceNumber(profile.minSize) > 0
  );
}

function queryFromSavedPreferences(profile, baseQuery = initialSearchQuery) {
  const nextQuery = { ...baseQuery, page: 1 };
  const preferredArea = String(profile?.preferredArea || "").trim();
  if (preferredArea) nextQuery.area = preferredArea;
  nextQuery.minPrice = normalizePreferenceNumber(profile?.budgetMin);
  const maxBudget = normalizePreferenceNumber(profile?.budgetMax, initialSearchQuery.maxPrice);
  nextQuery.maxPrice = maxBudget > 0 ? maxBudget : initialSearchQuery.maxPrice;
  nextQuery.minSize = normalizePreferenceNumber(profile?.minSize);
  return nextQuery;
}

function visiblePages(currentPage, totalPages) {
  const current = Number(currentPage || 1);
  const total = Number(totalPages || 1);
  const start = Math.max(1, current - 2);
  const end = Math.min(total, start + 4);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function viewFromPathname(pathname) {
  if (pathname === "/messages") return "messages";
  if (pathname === "/notifications") return "notifications";
  return "dashboard";
}

function pathnameForView(view) {
  if (view === "messages") return "/messages";
  if (view === "notifications") return "/notifications";
  return "/";
}

const photoAssets = {
  "retail-front.jpg": "/images/listings/retail-front.jpg",
  "retail-floor.jpg": "/images/listings/retail-floor.jpg",
  "portfolio-1.jpg": "/images/listings/portfolio-1.jpg",
  "portfolio-2.jpg": "/images/listings/portfolio-2.jpg",
  "isp-rack.jpg": "/images/listings/isp-rack.jpg",
  "office-floor.jpg": "/images/listings/office-floor.jpg",
  "electric-team.jpg": "/images/listings/electric-team.jpg",
  "uploaded-photo.jpg": "/images/listings/uploaded-photo.jpg"
};

const categoryPhotoAssets = {
  shop: photoAssets["retail-front.jpg"],
  interior: photoAssets["portfolio-1.jpg"],
  isp: photoAssets["isp-rack.jpg"],
  office: photoAssets["office-floor.jpg"],
  electrician: photoAssets["electric-team.jpg"],
  property: photoAssets["office-floor.jpg"],
  service: photoAssets["portfolio-1.jpg"]
};

const categoryOptions = [
  { value: "all", label: "All", type: "all", photo: photoAssets["uploaded-photo.jpg"] },
  { value: "Office", label: "Office", type: "property", photo: photoAssets["office-floor.jpg"] },
  { value: "Shop", label: "Shop", type: "property", photo: photoAssets["retail-front.jpg"] },
  { value: "Interior", label: "Interior", type: "service", photo: photoAssets["portfolio-1.jpg"] },
  { value: "ISP", label: "ISP", type: "service", photo: photoAssets["isp-rack.jpg"] },
  { value: "Electrician", label: "Electrician", type: "service", photo: photoAssets["electric-team.jpg"] }
];

const managementProfiles = {
  business: {
    eyebrow: "Business Workspace",
    title: "Saved Spaces and Service Directory",
    badge: "Browse mode",
    listingType: "all",
    canCreate: false,
    inventoryTitle: "Recommended Listings",
    inventoryNote: "Use Marketplace to search, save, book and message providers."
  },
  property: {
    eyebrow: "Property Workspace",
    title: "Property Listing Management",
    badge: "Property owner",
    listingType: "property",
    canCreate: true,
    inventoryTitle: "My Property Inventory",
    createTitle: "Create Property Listing",
    defaultTitle: "New Banani Office Unit",
    defaultCategory: "Office",
    categories: ["Office", "Shop"],
    defaultPrice: "85000",
    defaultSize: "720",
    defaultFacilities: "Lift, Generator, Parking, Road access",
    defaultCoverage: "Banani, Gulshan",
    defaultPhotos: "office-floor.jpg",
    defaultDescription: "Ready commercial property suitable for a growing team."
  },
  service: {
    eyebrow: "Service Workspace",
    title: "Service Package Management",
    badge: "Service provider",
    listingType: "service",
    canCreate: true,
    inventoryTitle: "My Service Packages",
    createTitle: "Create Service Package",
    defaultTitle: "Complete Office Setup Package",
    defaultCategory: "Interior",
    categories: ["Interior", "ISP", "Electrician"],
    defaultPrice: "45000",
    defaultSize: "0",
    defaultFacilities: "Planning, Installation, Support, Maintenance",
    defaultCoverage: "Banani, Gulshan, Mohakhali",
    defaultPhotos: "portfolio-1.jpg",
    defaultDescription: "Professional setup service package for new commercial offices."
  },
  admin: {
    eyebrow: "Admin Workspace",
    title: "Platform Listing Directory",
    badge: "All listings",
    listingType: "all",
    canCreate: false,
    inventoryTitle: "Verified Platform Listings",
    inventoryNote: "Use Admin panel for verification, moderation, reports and settings."
  }
};

const dashboardActions = [
  { role: "business", title: "Business Search", text: "Find spaces, compare services, save favorites and request visits.", icon: BriefcaseBusiness },
  { role: "property", title: "Property Owner", text: "Create offices or shops, manage property inventory and handle requests.", icon: Building2 },
  { role: "service", title: "Service Provider", text: "Publish setup packages, manage coverage areas and respond to clients.", icon: Wrench },
  { role: "admin", title: "Admin Control", text: "Verify users, approve listings, review reports and tune settings.", icon: ShieldCheck }
];

function money(value) {
  return `BDT ${Number(value || 0).toLocaleString("en-BD")}`;
}

function number(value) {
  return Number(value || 0).toLocaleString("en-BD");
}

function shortDate(value) {
  if (!value) return "Not scheduled";
  return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function asList(value) {
  if (Array.isArray(value)) return value.join(", ");
  return value || "Not added";
}

function isProviderProfile(profile) {
  return ["property-owner", "service-provider"].includes(profile?.role);
}

function ProviderRatingLine({ profile }) {
  if (!isProviderProfile(profile)) return null;
  const reviewCount = Number(profile.reviewCount || profile.ratingSummary?.reviewCount || 0);
  const averageRating = Number(profile.averageRating ?? profile.ratingSummary?.averageRating ?? 0);

  return (
    <p className="provider-rating-line">
      <Star size={13} fill={reviewCount ? "currentColor" : "none"} />
      {reviewCount ? `${averageRating.toFixed(1)} (${reviewCount} review${reviewCount === 1 ? "" : "s"})` : "No reviews yet"}
    </p>
  );
}

function humanizePhotoName(value) {
  return String(value || "photo")
    .split("/")
    .pop()
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function photoUrl(photo, listing) {
  if (photo && /^https?:\/\//i.test(photo)) return photo;
  if (photo && String(photo).startsWith("/")) return photo;
  if (photoAssets[photo]) return photoAssets[photo];
  const category = String(listing?.category || "").toLowerCase();
  const listingType = String(listing?.listingType || "").toLowerCase();
  return categoryPhotoAssets[category] || categoryPhotoAssets[listingType] || photoAssets["uploaded-photo.jpg"];
}

function primaryPhoto(listing) {
  return photoUrl(listing?.photos?.[0], listing);
}

function toneFromStatus(value = "") {
  const status = String(value).toLowerCase();
  if (["available", "verified", "accepted", "completed", "resolved", "closed", "success", "healthy", "connected"].includes(status)) return "success";
  if (["pending", "requested", "alternate-proposed", "in-progress", "busy", "warning", "attention", "open"].includes(status)) return "warning";
  if (["declined", "rejected", "suspended", "critical"].includes(status)) return "danger";
  return "neutral";
}

function IconFrame({ icon: Icon, tone = "blue" }) {
  return (
    <span className={`icon-frame ${tone}`}>
      <Icon size={17} strokeWidth={2.2} />
    </span>
  );
}

function Pill({ children, tone = "neutral" }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

function Status({ value }) {
  return <Pill tone={toneFromStatus(value)}>{value}</Pill>;
}

function Empty({ title }) {
  return (
    <div className="empty-state">
      <PanelLeft size={20} />
      <span>{title}</span>
    </div>
  );
}

function PageHeader({ eyebrow, title, meta, children }) {
  return (
    <div className="page-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      <div className="header-actions">
        {meta}
        {children}
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, note, tone }) {
  return (
    <article className="metric-card">
      <IconFrame icon={icon} tone={tone} />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {note && <p>{note}</p>}
      </div>
    </article>
  );
}

function StarMeter({ rating = 0, size = 15 }) {
  const numeric = Number(rating || 0);
  const rounded = Math.round(numeric);
  return (
    <span className="star-meter" aria-label={`${numeric.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          size={size}
          className={value <= rounded ? "filled" : ""}
          fill={value <= rounded ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
}

function StarRatingInput({ value, onChange }) {
  const [hoverValue, setHoverValue] = useState(0);
  const previewValue = hoverValue || value;

  function moveRating(event, nextValue) {
    event.preventDefault();
    onChange(Math.max(1, Math.min(5, nextValue)));
  }

  return (
    <div className="star-input" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((starValue) => (
        <button
          key={starValue}
          type="button"
          role="radio"
          aria-checked={value === starValue}
          aria-label={`${starValue} out of 5`}
          className={starValue <= previewValue ? "selected" : ""}
          onClick={() => onChange(starValue)}
          onFocus={() => setHoverValue(starValue)}
          onBlur={() => setHoverValue(0)}
          onMouseEnter={() => setHoverValue(starValue)}
          onMouseLeave={() => setHoverValue(0)}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight" || event.key === "ArrowUp") moveRating(event, (value || 0) + 1);
            if (event.key === "ArrowLeft" || event.key === "ArrowDown") moveRating(event, (value || 1) - 1);
          }}
        >
          <Star size={24} fill={starValue <= previewValue ? "currentColor" : "none"} />
        </button>
      ))}
      <button
        className="icon-button clear-rating"
        type="button"
        title="Clear rating"
        aria-label="Clear rating"
        onClick={() => onChange(0)}
        disabled={!value}
      >
        <XCircle size={16} />
      </button>
      <strong>{value ? `${value} / 5` : "No rating"}</strong>
    </div>
  );
}

function DataBar({ label, value, max = 1, note }) {
  const width = Math.max(7, Math.min(100, (Number(value || 0) / Math.max(1, max)) * 100));
  return (
    <div className="data-bar">
      <div className="data-bar-head">
        <span>{label}</span>
        <strong>{note || number(value)}</strong>
      </div>
      <div className="bar-track"><i style={{ width: `${width}%` }} /></div>
    </div>
  );
}

function PhotoImage({ listing, photo, className, alt }) {
  return (
    <img
      className={className}
      src={photoUrl(photo, listing)}
      alt={alt || `${listing?.title || "Listing"} photo`}
      loading="lazy"
      onError={(event) => {
        event.currentTarget.onerror = null;
        event.currentTarget.src = photoAssets["uploaded-photo.jpg"];
      }}
    />
  );
}

function ListingRow({ listing, onOpen, onSave, onBook, onMessage }) {
  const TypeIcon = listing.listingType === "service" ? Wrench : Building2;
  return (
    <article className="listing-row">
      <button className={`listing-thumb ${String(listing.category || "office").toLowerCase()}`} type="button" onClick={() => onOpen(listing._id)} title="Open detail">
        <PhotoImage listing={listing} className="listing-photo" />
        <span className="listing-thumb-badge"><TypeIcon size={14} /></span>
      </button>
      <div className="listing-copy">
        <div className="row-line">
          <h4>{listing.title}</h4>
          <Status value={listing.status} />
        </div>
        <p>{listing.category} in {listing.area} - {money(listing.price)}</p>
        <div className="micro-row">
          <span><MapPin size={13} />{listing.metricLabel}</span>
          <span><Star size={13} />{Number(listing.rating || 0).toFixed(1)}</span>
          <span><Database size={13} />{listing.listingType}</span>
        </div>
      </div>
      <div className="row-actions">
        <button type="button" className="icon-button" title="Save" onClick={() => onSave(listing._id)}><Heart size={16} /></button>
        <button type="button" className="icon-button" title="Message" onClick={() => onMessage(listing._id)}><Mail size={16} /></button>
        <button type="button" className="action primary small" onClick={() => onBook(listing._id)}><CalendarCheck size={15} />Book</button>
        <button type="button" className="action secondary small" onClick={() => onOpen(listing._id)}>Open<ChevronRight size={15} /></button>
      </div>
    </article>
  );
}

function ManagementListingRow({
  listing,
  profile,
  addressEditor,
  busy,
  onOpen,
  onStatus,
  onPrice,
  onDelete,
  onEditAddress,
  onCancelAddress,
  onAddressSelect,
  onAddressSubmit
}) {
  const alternateStatus = listing.listingType === "service" ? "Busy" : "Leased";
  const isEditingAddress = addressEditor?.listingId === listing._id;
  return (
    <article className="management-row">
      <button className="listing-thumb" type="button" onClick={() => onOpen(listing._id)} title="Open detail">
        <PhotoImage listing={listing} className="listing-photo" />
      </button>
      <div className="listing-copy">
        <div className="row-line">
          <h4>{listing.title}</h4>
          <Status value={listing.status} />
        </div>
        <p>{listing.category} in {listing.area} - {money(listing.price)}</p>
        <p className="management-address-line">{listing.address}</p>
        <div className="micro-row">
          <span><MapPin size={13} />{listing.metricLabel}</span>
          <span><Star size={13} />{Number(listing.rating || 0).toFixed(1)}</span>
          <span><Database size={13} />{profile.badge}</span>
        </div>
      </div>
      <form className="management-actions" onSubmit={(event) => onPrice(event, listing._id)}>
        <input name="price" type="number" min="1" defaultValue={listing.price} aria-label={`Price for ${listing.title}`} />
        <button className="action secondary small" type="submit"><Settings size={15} />Save</button>
        <button className="action secondary small" type="button" onClick={() => onStatus(listing._id, "Available")}>Available</button>
        <button className="action secondary small" type="button" onClick={() => onStatus(listing._id, alternateStatus)}>{alternateStatus}</button>
        <button className="action secondary small" type="button" onClick={() => onEditAddress(listing)}>Change address</button>
        <button className="icon-button danger" type="button" title="Delete listing" onClick={() => onDelete(listing._id)}><XCircle size={16} /></button>
      </form>
      {isEditingAddress && (
        <form className="management-address-editor" onSubmit={(event) => onAddressSubmit(event, listing)}>
          <div className="management-address-head">
            <strong>Change address</strong>
            <button className="icon-button" type="button" title="Cancel address change" onClick={onCancelAddress}><XCircle size={16} /></button>
          </div>
          <p>Current address: {listing.address}</p>
          <AddressAutocomplete
            idPrefix={`edit-address-${listing._id}`}
            label="New address"
            initialLabel={listing.address}
            resetSignal={addressEditor.resetKey}
            onSelect={onAddressSelect}
            required
          />
          <button className="action primary small" type="submit" disabled={busy || !addressEditor.selectedAddress}>
            <MapPin size={15} />Save address
          </button>
        </form>
      )}
    </article>
  );
}

export default function App() {
  const [view, setView] = useState(() => viewFromPathname(window.location.pathname));
  const [role, setRole] = useState("business");
  const [user, setUser] = useState(null);
  const [health, setHealth] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [operations, setOperations] = useState(null);
  const [admin, setAdmin] = useState({ pendingUsers: [], pendingListings: [], reports: [] });
  const [listings, setListings] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0, summary: {} });
  const [inventoryListings, setInventoryListings] = useState([]);
  const [inventoryMeta, setInventoryMeta] = useState({ total: 0, summary: {} });
  const [query, setQuery] = useState(initialSearchQuery);
  const [searchDraft, setSearchDraft] = useState(initialSearchQuery);
  const [selectedListingId, setSelectedListingId] = useState("");
  const [detail, setDetail] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [messages, setMessages] = useState([]);
  const [socketStatus, setSocketStatus] = useState("offline");
  const [bookings, setBookings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [conversationSearch, setConversationSearch] = useState("");
  const [conversationFilter, setConversationFilter] = useState("all");
  const [notificationFilter, setNotificationFilter] = useState("all");
  const [notificationResults, setNotificationResults] = useState(null);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [createAddressResetKey, setCreateAddressResetKey] = useState(0);
  const [addressEditor, setAddressEditor] = useState({ listingId: "", selectedAddress: null, resetKey: 0 });
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [switchingRole, setSwitchingRole] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState("");
  const toastTimer = useRef(null);
  const conversationsRef = useRef([]);
  const selectedConversationIdRef = useRef("");

  const selectedListing = useMemo(
    () => detail?.listing || listings.find((item) => item._id === selectedListingId) || listings[0],
    [detail, listings, selectedListingId]
  );

  const deleteTargetListing = useMemo(
    () => inventoryListings.find((item) => item._id === deleteTargetId) ||
      listings.find((item) => item._id === deleteTargetId) ||
      (detail?.listing?._id === deleteTargetId ? detail.listing : null),
    [deleteTargetId, inventoryListings, listings, detail]
  );

  const maxArea = Math.max(...(operations?.areaDemand || []).map((item) => item.count), 1);
  const maxCategory = Math.max(...(operations?.categoryMix || []).map((item) => item.count), 1);
  const customerServicePhone = useMemo(
    () => operations?.settings?.find((setting) => setting.key === "customer_service_phone")?.value || CUSTOMER_SERVICE_PHONE,
    [operations]
  );
  const managementProfile = managementProfiles[role] || managementProfiles.business;

  function notify(message) {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2800);
  }

  function navigateToView(nextView, { replace = false } = {}) {
    const nextPath = pathnameForView(nextView);
    if (window.location.pathname !== nextPath) {
      window.history[replace ? "replaceState" : "pushState"]({ view: nextView }, "", nextPath);
    }
    setView(nextView);
  }

  async function runAction(action, success) {
    setBusy(true);
    try {
      const result = await action();
      if (success) notify(success);
      return result;
    } catch (error) {
      notify(error.message);
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  function updateSearchDraft(field, value) {
    setSearchDraft((current) => ({ ...current, [field]: value }));
  }

  async function applySearch(nextQuery, options = {}) {
    const normalizedQuery = { ...nextQuery, page: options.resetPage === false ? nextQuery.page : 1 };
    setQuery(normalizedQuery);
    setSearchDraft(normalizedQuery);
    await runAction(async () => {
      const data = await api(`/listings?${new URLSearchParams(normalizedQuery).toString()}`);
      setListings(data.results || []);
      setMeta(data);
      setDetail(null);
      if (data.results?.[0]) setSelectedListingId(data.results[0]._id);
    });
  }

  async function applySavedPreferences() {
    if (!hasSavedSearchPreferences(user)) {
      notify("Save profile preferences before applying them.");
      return;
    }
    await applySearch(queryFromSavedPreferences(user, initialSearchQuery));
  }

  async function goToSearchPage(page) {
    const totalPages = Number(meta.totalPages || 1);
    const nextPage = Math.max(1, Math.min(Number(page || 1), totalPages));
    await applySearch({ ...query, page: nextPage }, { resetPage: false });
  }

  async function login(nextRole = role) {
    const data = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify(demoLogins[nextRole])
    });
    setAuthToken(data.token);
    setUser(data.user);
    return data.user;
  }

  function resetAddressSearch() {
    setSelectedAddress(null);
    setCreateAddressResetKey((current) => current + 1);
  }

  function resetReviewForm() {
    setReviewRating(0);
    setReviewComment("");
    setReviewError("");
  }

  async function loadRoleInventory(activeUser = user, activeRole = role) {
    const profile = managementProfiles[activeRole] || managementProfiles.business;
    const params = new URLSearchParams({
      area: "",
      type: profile.listingType,
      category: "all",
      sort: "newest",
      maxPrice: String(Number.MAX_SAFE_INTEGER),
      minSize: "0",
      page: "1",
      pageSize: "12",
      includeUnavailable: "true"
    });
    if (profile.canCreate && activeUser?._id) params.set("ownerId", activeUser._id);
    const data = await api(`/listings?${params.toString()}`);
    setInventoryListings(data.results || []);
    setInventoryMeta(data);
  }

  async function loadCore(activeUser = user, nextQuery = query, options = {}) {
    setBusy(true);
    try {
      const resetSelections = Boolean(options.resetSelections);
      const activeRole = options.activeRole || role;
      const params = new URLSearchParams(nextQuery).toString();
      const adminRequest = activeRole === "admin"
        ? api("/admin/verifications")
        : Promise.resolve({ pendingUsers: [], pendingListings: [], reports: [] });
      const [healthData, dashboardData, operationsData, listingData, adminData] = await Promise.all([
        api("/health"),
        api("/dashboard"),
        api("/operations/summary"),
        api(`/listings?${params}`),
        adminRequest
      ]);
      setHealth(healthData);
      setDashboard(dashboardData);
      setOperations(operationsData);
      setListings(listingData.results || []);
      setMeta(listingData);
      setAdmin(adminData);
      if (resetSelections) {
        setSelectedListingId(listingData.results?.[0]?._id || "");
        setDetail(null);
      } else if (!selectedListingId && listingData.results?.[0]) {
        setSelectedListingId(listingData.results[0]._id);
      }

      if (activeUser?._id) {
        const [favoriteData, conversationData, bookingData, notificationData] = await Promise.all([
          api(`/favorites/${activeUser._id}`),
          api(`/conversations/${activeUser._id}`),
          api(`/bookings/${activeUser._id}`),
          api(`/notifications/${activeUser._id}`)
        ]);
        const profileData = await api(`/profile/${activeUser._id}`);
        setUser(profileData.profile || activeUser);
        setFavorites(favoriteData.favorites || []);
        setConversations(conversationData.conversations || []);
        setBookings(bookingData.bookings || []);
        setNotifications(notificationData.notifications || []);
        if (resetSelections) {
          setSelectedConversationId("");
          setMessages([]);
        }
      }
      await loadRoleInventory(activeUser, activeRole);
    } finally {
      setBusy(false);
    }
  }

  async function loadDetail(id = selectedListingId) {
    const target = id || listings[0]?._id;
    if (!target) return;
    const eligibilityFallback = { eligible: false, reason: "Sign in before leaving a review." };
    const [data, reviewData, summaryData, eligibilityData] = await Promise.all([
      api(`/listings/${target}/detail`),
      api(`/reviews/${target}`),
      api(`/reviews/${target}/summary`),
      user?._id ? api(`/reviews/${target}/eligibility`).catch((error) => ({
        ...eligibilityFallback,
        reason: error.message
      })) : Promise.resolve(eligibilityFallback)
    ]);
    data.listing.reviews = reviewData.reviews || data.listing.reviews || [];
    setSelectedListingId(target);
    setDetail({ ...data, reviewSummary: summaryData, reviewEligibility: eligibilityData });
    resetReviewForm();
  }

  async function loadMessages(id = selectedConversationId) {
    if (!id) return;
    const data = await api(`/messages/${id}`);
    setMessages(data.messages || []);
  }

  useEffect(() => {
    login("business")
      .then((loggedUser) => {
        const savedQuery = queryFromSavedPreferences(loggedUser, initialSearchQuery);
        setQuery(savedQuery);
        setSearchDraft(savedQuery);
        return loadCore(loggedUser, savedQuery);
      })
      .catch((error) => notify(error.message));
  }, []);

  useEffect(() => {
    const handlePopState = () => setView(viewFromPathname(window.location.pathname));
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (view === "workspace") loadDetail();
    if (view === "messages") loadMessages();
  }, [view, selectedListingId, selectedConversationId]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  useEffect(() => {
    if (!user?._id) {
      disconnectSocket();
      setSocketStatus("offline");
      return undefined;
    }

    setSocketStatus("connecting");
    const socket = connectSocket();
    if (!socket) {
      setSocketStatus("offline");
      return undefined;
    }

    const handleConnect = () => setSocketStatus("connected");
    const handleDisconnect = () => setSocketStatus("offline");
    const handleConnectError = () => setSocketStatus("offline");
    const handleReconnectAttempt = () => setSocketStatus("reconnecting");
    const handleMessage = (event) => {
      if (!event?.conversationId || !event?.message?._id) return;

      const knownConversation = conversationsRef.current.some(
        (item) => String(item._id) === String(event.conversationId)
      );
      if (!knownConversation) {
        api(`/conversations/${user._id}`)
          .then((data) => setConversations(data.conversations || []))
          .catch((error) => notify(error.message));
      }

      setConversations((current) => {
        const index = current.findIndex((item) => String(item._id) === String(event.conversationId));
        if (index < 0) return current;
        const conversation = current[index];
        const existingMessages = conversation.messages || [];
        const hasMessage = existingMessages.some((item) => String(item._id) === String(event.message._id));
        const updated = {
          ...conversation,
          updatedAt: event.message.createdAt,
          messages: hasMessage ? existingMessages : [...existingMessages, event.message]
        };
        return [updated, ...current.filter((_, itemIndex) => itemIndex !== index)];
      });

      if (String(event.conversationId) === String(selectedConversationIdRef.current)) {
        setMessages((current) => (
          current.some((item) => String(item._id) === String(event.message._id))
            ? current
            : [...current, event.message]
        ));
      } else if (!selectedConversationIdRef.current) {
        selectedConversationIdRef.current = event.conversationId;
        setSelectedConversationId(event.conversationId);
        setMessages([event.message]);
      }
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("message:new", handleMessage);
    socket.io.on("reconnect_attempt", handleReconnectAttempt);
    if (socket.connected) handleConnect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("message:new", handleMessage);
      socket.io.off("reconnect_attempt", handleReconnectAttempt);
      disconnectSocket();
    };
  }, [user?._id]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket?.connected || !selectedConversationId) return;
    socket.emit("conversation:join", selectedConversationId);
  }, [selectedConversationId, socketStatus]);

  async function switchRole(nextRole) {
    if (switchingRole) return;
    const selectedRole = roles.find((item) => item.key === nextRole);
    setSwitchingRole(nextRole);
    setRole(nextRole);
    navigateToView(roleLandingViews[nextRole] || "dashboard", { replace: true });
    setDetail(null);
    setMessages([]);
    setSelectedConversationId("");
    setConversationSearch("");
    setConversationFilter("all");
    setNotificationFilter("all");
    setNotificationResults(null);
    resetAddressSearch();
    cancelListingAddressEdit();
    resetReviewForm();
    try {
      await runAction(async () => {
        const loggedUser = await login(nextRole);
        const nextQuery = nextRole === "business" ? queryFromSavedPreferences(loggedUser, initialSearchQuery) : query;
        setQuery(nextQuery);
        setSearchDraft(nextQuery);
        await loadCore(loggedUser, nextQuery, { resetSelections: true, activeRole: nextRole });
      }, `${selectedRole?.label || "Role"} workspace loaded`);
    } finally {
      setSwitchingRole("");
    }
  }

  async function submitSearch(event) {
    event.preventDefault();
    await applySearch({ ...query, ...searchDraft });
  }

  async function selectCategoryOption(option) {
    const nextQuery = { ...searchDraft, category: option.value, type: option.type };
    setSearchDraft(nextQuery);
    await applySearch({ ...query, ...nextQuery });
  }

  async function createListing(event) {
    event.preventDefault();
    if (!selectedAddress) {
      notify("Select an address suggestion before saving the listing.");
      return;
    }
    const formElement = event.currentTarget;
    const form = Object.fromEntries(new FormData(formElement).entries());
    form.ownerId = user._id;
    form.addressId = selectedAddress.id;
    form.address = selectedAddress.label;
    form.area = selectedAddress.area;
    form.location = { lat: selectedAddress.lat, lng: selectedAddress.lng };
    form.facilities = form.facilities.split(",").map((item) => item.trim()).filter(Boolean);
    form.coverageAreas = form.coverageAreas.split(",").map((item) => item.trim()).filter(Boolean);
    form.photos = (form.photos || "uploaded-photo.jpg").split(",").map((item) => item.trim()).filter(Boolean);
    await runAction(async () => {
      await api("/listings", { method: "POST", body: JSON.stringify(form) });
      await loadCore(user, query, { activeRole: role });
      formElement.reset();
      resetAddressSearch();
    }, "Listing saved");
  }

  async function updateListingStatus(id, status) {
    await runAction(async () => {
      const data = await api(`/listings/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) });
      setInventoryListings((current) => current.map((item) => (item._id === id ? data.listing : item)));
      setListings((current) => current.map((item) => (item._id === id ? data.listing : item)));
    }, `Status updated to ${status}`);
  }

  async function updateListingPrice(event, id) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget).entries());
    await runAction(async () => {
      const data = await api(`/listings/${id}`, { method: "PUT", body: JSON.stringify({ price: Number(form.price) }) });
      setInventoryListings((current) => current.map((item) => (item._id === id ? data.listing : item)));
      setListings((current) => current.map((item) => (item._id === id ? data.listing : item)));
    }, "Price updated");
  }

  function editListingAddress(listing) {
    setAddressEditor({ listingId: listing._id, selectedAddress: null, resetKey: Date.now() });
  }

  function cancelListingAddressEdit() {
    setAddressEditor({ listingId: "", selectedAddress: null, resetKey: 0 });
  }

  function selectListingAddress(suggestion) {
    setAddressEditor((current) => ({ ...current, selectedAddress: suggestion }));
  }

  async function updateListingAddress(event, listing) {
    event.preventDefault();
    const address = addressEditor.selectedAddress;
    if (!address) {
      notify("Select an address suggestion before saving the new address.");
      return;
    }
    await runAction(async () => {
      const data = await api(`/listings/${listing._id}`, {
        method: "PUT",
        body: JSON.stringify({ addressId: address.id })
      });
      setInventoryListings((current) => current.map((item) => (item._id === listing._id ? data.listing : item)));
      setListings((current) => current.map((item) => (item._id === listing._id ? data.listing : item)));
      setDetail((current) => (
        current?.listing?._id === listing._id
          ? { ...current, listing: { ...current.listing, ...data.listing } }
          : current
      ));
      cancelListingAddressEdit();
    }, "Address updated");
  }

  function deleteListing(id) {
    setDeleteTargetId(id);
  }

  async function confirmDeleteListing() {
    const id = deleteTargetId;
    if (!id) return;
    await runAction(async () => {
      await api(`/listings/${id}`, { method: "DELETE" });
      setDeleteTargetId("");
      await loadCore(user, query, { resetSelections: true, activeRole: role });
    }, "Listing deleted");
  }

  async function saveFavorite(id) {
    await runAction(async () => {
      await api(`/favorites/${user._id}/${id}`, { method: "POST" });
      await loadCore(user);
    }, "Saved to favorites");
  }

  async function createBooking(id) {
    await runAction(async () => {
      await api("/bookings", {
        method: "POST",
        body: JSON.stringify({
          listingId: id,
          requesterId: user._id,
          requestType: "visit",
          proposedAt: new Date(Date.now() + 86400000).toISOString(),
          notes: "Client requested a guided visit."
        })
      });
      await loadCore(user);
      navigateToView("pipeline");
    }, "Booking requested");
  }

  async function respondBooking(id, status) {
    await runAction(async () => {
      await api(`/bookings/${id}/respond`, { method: "PUT", body: JSON.stringify({ status, userId: user._id }) });
      await loadCore(user);
    }, `Booking ${status}`);
  }

  async function startConversation(id) {
    await runAction(async () => {
      const data = await api("/conversations", { method: "POST", body: JSON.stringify({ listingId: id }) });
      setSelectedConversationId(data.conversation._id);
      await loadCore(user);
      await loadMessages(data.conversation._id);
      navigateToView("messages");
    });
  }

  async function sendMessage(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = Object.fromEntries(new FormData(formElement).entries());
    if (!form.conversationId || !form.message.trim()) return;
    await runAction(async () => {
      await api("/messages", { method: "POST", body: JSON.stringify(form) });
      formElement.elements.message.value = "";
      await loadMessages(form.conversationId);
      await loadCore(user);
    }, "Message sent");
  }

  async function submitReview(event) {
    event.preventDefault();
    const listing = selectedListing;
    if (!listing?._id || !user?._id) return;
    if (reviewSubmitting) return;
    const comment = reviewComment.trim();
    if (!Number.isInteger(reviewRating) || reviewRating < 1 || reviewRating > 5) {
      setReviewError("Select a 1-5 star rating.");
      return;
    }
    if (comment.length < 3) {
      setReviewError("Review comment must be at least 3 characters.");
      return;
    }
    if (comment.length > 1000) {
      setReviewError("Review comment must be 1000 characters or fewer.");
      return;
    }

    setReviewSubmitting(true);
    setReviewError("");
    try {
      await api("/reviews", {
        method: "POST",
        body: JSON.stringify({
          listingId: listing._id,
          rating: reviewRating,
          comment
        })
      });
      await loadCore(user, query, { activeRole: role });
      await loadDetail(listing._id);
      notify("Review submitted");
    } catch (error) {
      setReviewError(error.message);
      notify(error.message);
    } finally {
      setReviewSubmitting(false);
    }
  }

  async function markNotificationRead(id) {
    await runAction(async () => {
      const data = await api(`/notifications/${id}/read`, { method: "PUT" });
      setNotifications((current) => current.map((item) => (item._id === id ? data.notification : item)));
      setNotificationResults((current) => current?.map((item) => (item._id === id ? data.notification : item)) || current);
    });
  }

  async function markAllNotificationsRead() {
    const unread = notifications.filter((item) => !item.read);
    if (!unread.length) return;
    await runAction(async () => {
      await Promise.all(unread.map((item) => api(`/notifications/${item._id}/read`, { method: "PUT" })));
      setNotifications((current) => current.map((item) => ({ ...item, read: true })));
      setNotificationResults((current) => current?.map((item) => ({ ...item, read: true })) || current);
    }, "All notifications marked as read");
  }

  async function selectNotificationFilter(nextFilter) {
    setNotificationFilter(nextFilter);
    if (nextFilter === "all") {
      setNotificationResults(null);
      return;
    }
    await runAction(async () => {
      const data = await api(`/notifications/${user._id}?type=${encodeURIComponent(nextFilter)}`);
      setNotificationResults(data.notifications || []);
    });
  }

  async function viewNotification(item) {
    if (!item.read) await markNotificationRead(item._id);
    if (item.type === "message") navigateToView("messages");
    if (item.type === "booking") navigateToView("pipeline");
  }

  async function updateProfile(event) {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    await runAction(async () => {
      const data = await api(`/profile/${user._id}`, { method: "PUT", body: JSON.stringify(body) });
      setUser(data.profile);
    }, "Profile updated");
  }

  async function createTicket(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = Object.fromEntries(new FormData(formElement).entries());
    await runAction(async () => {
      await api("/support/tickets", { method: "POST", body: JSON.stringify({ ...form, requesterId: user._id }) });
      await loadCore(user);
      formElement.reset();
    }, "Support ticket created");
  }

  async function updateTicket(id, status) {
    await runAction(async () => {
      await api(`/support/tickets/${id}`, { method: "PUT", body: JSON.stringify({ status, actorId: user._id }) });
      await loadCore(user);
    }, "Ticket updated");
  }

  async function updateSetting(event) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget).entries());
    let value = form.value;
    if (form.valueType === "number") value = Number(value);
    if (form.valueType === "boolean") value = value === "true";
    await runAction(async () => {
      await api(`/settings/${form.key}`, { method: "PUT", body: JSON.stringify({ value, updatedBy: user._id }) });
      await loadCore(user);
    }, "Setting updated");
  }

  async function verifyUser(id) {
    await runAction(async () => {
      await api(`/admin/users/${id}/verify`, { method: "PUT", body: JSON.stringify({ status: "verified" }) });
      await loadCore(user);
    }, "User verified");
  }

  async function moderateListing(id, verificationStatus = "verified") {
    await runAction(async () => {
      await api(`/admin/listings/${id}/moderate`, { method: "PUT", body: JSON.stringify({ verificationStatus }) });
      await loadCore(user);
    }, "Listing moderated");
  }

  function openListing(id) {
    setSelectedListingId(id);
    setDetail(null);
    navigateToView("workspace");
  }

  function renderDashboard() {
    const queueTotal = (dashboard?.pendingUsersCount || 0) + (dashboard?.pendingListingsCount || 0) + (dashboard?.openReports || 0) + (dashboard?.openTickets || 0);
    const statusRows = [
      { label: "Verification", value: `${(dashboard?.pendingUsersCount || 0) + (dashboard?.pendingListingsCount || 0)} pending review`, status: queueTotal ? "attention" : "healthy" },
      { label: "Marketplace", value: `${number(dashboard?.activeListings)} active listings`, status: "healthy" },
      { label: "Bookings", value: `${number(dashboard?.bookings)} total requests`, status: "healthy" },
      { label: "Support", value: `${number(dashboard?.openTickets)} open tickets`, status: dashboard?.openTickets ? "attention" : "healthy" }
    ];

    return (
      <>
        <PageHeader
          eyebrow="Command Center"
          title="OfficeKhoj BD Operations"
          meta={<Status value={operations?.database?.status || "connecting"} />}
        >
          <button className="action secondary" type="button" onClick={() => loadCore(user)}><Activity size={16} />Refresh</button>
        </PageHeader>

        <section className="dashboard-command">
          <div>
            <span className="eyebrow">Live Platform</span>
            <h3>Commercial space discovery and setup-service management</h3>
            <p>Role-based workflows for business owners, property owners, service providers and administrators.</p>
          </div>
          <div className="dashboard-action-grid">
            {dashboardActions.map(({ role: targetRole, title, text, icon: Icon }) => (
              <button className="dashboard-action" type="button" key={targetRole} onClick={() => switchRole(targetRole)}>
                <IconFrame icon={Icon} tone={targetRole === "admin" ? "amber" : targetRole === "service" ? "teal" : targetRole === "property" ? "blue" : "green"} />
                <span className="dashboard-action-title">{title}</span>
                <p>{text}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="metric-grid">
          <MetricCard icon={Store} tone="green" label="Active Listings" value={number(dashboard?.activeListings)} note={`${dashboard?.properties || 0} property, ${dashboard?.services || 0} service`} />
          <MetricCard icon={UsersRound} tone="blue" label="Users" value={number(dashboard?.users)} note={`${dashboard?.pendingUsersCount || 0} pending verification`} />
          <MetricCard icon={CalendarCheck} tone="amber" label="Bookings" value={number(dashboard?.bookings)} note={`${operations?.operations?.conversionRate || 0}% conversion`} />
          <MetricCard icon={Star} tone="teal" label="Reviews" value={`${dashboard?.averageRating || "0.0"}/5`} note={`${dashboard?.totalReviews || 0} total reviews`} />
        </section>

        <section className="dashboard-grid">
          <div className="panel">
            <div className="panel-head"><h3>Demand by Area</h3><Pill tone="neutral">Live aggregate</Pill></div>
            <div className="data-list">
              {(operations?.areaDemand || []).map((item) => <DataBar key={item.area} label={item.area} value={item.count} max={maxArea} note={`${item.count} - ${money(item.avgPrice)}`} />)}
            </div>
          </div>
          <div className="panel">
            <div className="panel-head"><h3>Category Mix</h3><Pill tone="neutral">Marketplace</Pill></div>
            <div className="data-list">
              {(operations?.categoryMix || []).map((item) => <DataBar key={item.category} label={item.category} value={item.count} max={maxCategory} note={`${item.count} - ${money(item.avgPrice)}`} />)}
            </div>
          </div>
          <div className="panel">
            <div className="panel-head"><h3>Review Queue</h3><Pill tone="warning">{(dashboard?.pendingUsersCount || 0) + (dashboard?.pendingListingsCount || 0) + (dashboard?.openReports || 0) + (dashboard?.openTickets || 0)} items</Pill></div>
            <div className="queue-grid">
              <MetricCard icon={UserRound} tone="amber" label="Users" value={number(dashboard?.pendingUsersCount)} />
              <MetricCard icon={Building2} tone="blue" label="Listings" value={number(dashboard?.pendingListingsCount)} />
              <MetricCard icon={Activity} tone="rose" label="Reports" value={number(dashboard?.openReports)} />
              <MetricCard icon={LifeBuoy} tone="teal" label="Tickets" value={number(dashboard?.openTickets)} />
            </div>
          </div>
          <div className="panel">
            <div className="panel-head"><h3>Workflow Health</h3><Pill tone="success">Operational</Pill></div>
            <div className="data-list">
              {statusRows.map((item) => (
                <div className="system-row" key={item.label}>
                  <IconFrame icon={CheckCircle2} tone={item.status === "attention" ? "amber" : "green"} />
                  <div><strong>{item.label}</strong><p>{item.value}</p></div>
                  <Status value={item.status} />
                </div>
              ))}
            </div>
          </div>
        </section>
      </>
    );
  }

  function renderMarketplace() {
    const summary = meta.summary || {};
    const pages = visiblePages(meta.page, meta.totalPages);
    return (
      <>
        <PageHeader eyebrow="Marketplace" title="Commercial Spaces and Setup Services" meta={<Pill tone="neutral">{meta.total || 0} matches</Pill>} />
        <form className="filter-bar" onSubmit={submitSearch}>
          <label>Area<input name="area" value={searchDraft.area} onChange={(event) => updateSearchDraft("area", event.target.value)} /></label>
          <label>Type<select name="type" value={searchDraft.type} onChange={(event) => updateSearchDraft("type", event.target.value)}><option value="all">All</option><option value="property">Property</option><option value="service">Service</option></select></label>
          <label>Category<select name="category" value={searchDraft.category} onChange={(event) => updateSearchDraft("category", event.target.value)}><option value="all">All</option>{categoryValues.map((category) => <option key={category}>{category}</option>)}</select></label>
          <label>Min price<input name="minPrice" type="number" min="0" value={searchDraft.minPrice} onChange={(event) => updateSearchDraft("minPrice", event.target.value)} /></label>
          <label>Max price<input name="maxPrice" type="number" min="0" value={searchDraft.maxPrice} onChange={(event) => updateSearchDraft("maxPrice", event.target.value)} /></label>
          <label>Min size<input name="minSize" type="number" min="0" value={searchDraft.minSize} onChange={(event) => updateSearchDraft("minSize", event.target.value)} /></label>
          <label>Sort<select name="sort" value={searchDraft.sort} onChange={(event) => updateSearchDraft("sort", event.target.value)}><option value="distance">Distance</option><option value="price-asc">Price low to high</option><option value="price-desc">Price high to low</option><option value="rating">Rating</option><option value="newest">Newest</option></select></label>
          <button className="action primary" type="submit"><SlidersHorizontal size={16} />Apply</button>
          {hasSavedSearchPreferences(user) ? (
            <button className="action secondary" type="button" onClick={applySavedPreferences}><Bookmark size={16} />Use Saved Preferences</button>
          ) : null}
          <button className="action secondary" type="button" onClick={() => applySearch(initialSearchQuery)}>Reset</button>
        </form>
        <div className="photo-option-grid">
          {categoryOptions.map((option) => (
            <button
              type="button"
              className={`photo-option ${searchDraft.category === option.value ? "active" : ""}`}
              key={option.value}
              onClick={() => selectCategoryOption(option)}
            >
              <img
                src={option.photo}
                alt={`${option.label} option`}
                loading="lazy"
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = photoAssets["uploaded-photo.jpg"];
                }}
              />
              <span>{option.label}</span>
            </button>
          ))}
        </div>

        <section className="metric-grid compact-metrics">
          <MetricCard icon={CircleDollarSign} tone="green" label="Average Price" value={money(summary.avgPrice)} />
          <MetricCard icon={Building2} tone="blue" label="Properties" value={number(summary.propertyCount)} />
          <MetricCard icon={Wrench} tone="teal" label="Services" value={number(summary.serviceCount)} />
          <MetricCard icon={MapPin} tone="amber" label="Areas" value={asList(summary.areas)} />
        </section>

        <section className="market-grid">
          <div className="panel">
            <div className="panel-head"><h3>Dhaka Map</h3><Pill tone="neutral">Location metric</Pill></div>
            <ListingMap listings={listings} />
          </div>
          <div className="panel listing-panel">
            <div className="panel-head"><h3>Verified Matches</h3><Pill tone="neutral">Page {meta.page || 1}/{meta.totalPages || 1}</Pill></div>
            {listings.length ? listings.map((listing) => (
              <ListingRow key={listing._id} listing={listing} onOpen={openListing} onSave={saveFavorite} onBook={createBooking} onMessage={startConversation} />
            )) : <Empty title="No matches" />}
            {Number(meta.totalPages || 1) > 1 ? (
              <div className="pagination-controls" aria-label="Listing pages">
                <button className="icon-button" type="button" onClick={() => goToSearchPage(Number(meta.page || 1) - 1)} disabled={Number(meta.page || 1) <= 1} title="Previous page" aria-label="Previous page">
                  <ChevronLeft size={16} />
                </button>
                {pages.map((pageNumber) => (
                  <button
                    className={`page-button ${Number(meta.page || 1) === pageNumber ? "active" : ""}`}
                    type="button"
                    key={pageNumber}
                    onClick={() => goToSearchPage(pageNumber)}
                  >
                    {pageNumber}
                  </button>
                ))}
                <button className="icon-button" type="button" onClick={() => goToSearchPage(Number(meta.page || 1) + 1)} disabled={Number(meta.page || 1) >= Number(meta.totalPages || 1)} title="Next page" aria-label="Next page">
                  <ChevronRight size={16} />
                </button>
              </div>
            ) : null}
          </div>
        </section>
      </>
    );
  }

  function renderListings() {
    const profile = managementProfile;
    const inventory = profile.canCreate || role === "admin" ? inventoryListings : listings;
    return (
      <>
        <PageHeader eyebrow={profile.eyebrow} title={profile.title} meta={<Pill tone="neutral">{inventoryMeta.total || inventory.length} records</Pill>} />
        <section className="split-layout">
          {profile.canCreate ? (
            <form className="panel form-panel" onSubmit={createListing}>
              <div className="panel-head"><h3>{profile.createTitle}</h3><Pill tone="neutral">{profile.badge}</Pill></div>
              <input type="hidden" name="listingType" defaultValue={profile.listingType} />
              <AddressAutocomplete
                idPrefix="create-listing-address"
                label="Address search"
                resetSignal={createAddressResetKey}
                onSelect={setSelectedAddress}
                required
              />
              <input type="hidden" name="addressId" value={selectedAddress?.id || ""} readOnly />
              <input type="hidden" name="area" value={selectedAddress?.area || ""} readOnly />
              <input type="hidden" name="lat" value={selectedAddress?.lat ?? ""} readOnly />
              <input type="hidden" name="lng" value={selectedAddress?.lng ?? ""} readOnly />
              <label>Title<input name="title" defaultValue={profile.defaultTitle} /></label>
              <div className="field-row">
                <label>Category<select name="category" defaultValue={profile.defaultCategory}>{profile.categories.map((category) => <option key={category}>{category}</option>)}</select></label>
                <label>{profile.listingType === "service" ? "Starting price" : "Monthly rent"}<input name="price" type="number" defaultValue={profile.defaultPrice} /></label>
              </div>
              {profile.listingType === "property" ? (
                <label>Size<input name="size" type="number" defaultValue={profile.defaultSize} /></label>
              ) : (
                <input name="size" type="hidden" defaultValue="0" />
              )}
              <label>{profile.listingType === "service" ? "Service features" : "Facilities"}<input name="facilities" defaultValue={profile.defaultFacilities} /></label>
              <label>Coverage areas<input name="coverageAreas" defaultValue={profile.defaultCoverage} /></label>
              <label>Photos<input name="photos" defaultValue={profile.defaultPhotos} /></label>
              <label>Description<textarea name="description" defaultValue={profile.defaultDescription} /></label>
              <button className="action primary" type="submit"><ListPlus size={16} />Save {profile.listingType === "service" ? "Service" : "Property"}</button>
            </form>
          ) : (
            <div className="panel role-workflow-panel">
              <IconFrame icon={role === "admin" ? ShieldCheck : BriefcaseBusiness} tone={role === "admin" ? "amber" : "green"} />
              <h3>{profile.badge}</h3>
              <p>{profile.inventoryNote}</p>
              <button className="action primary" type="button" onClick={() => navigateToView(role === "admin" ? "admin" : "marketplace")}>
                {role === "admin" ? "Open Admin Panel" : "Open Marketplace"}
              </button>
            </div>
          )}
          <div className="panel listing-panel">
            <div className="panel-head"><h3>{profile.inventoryTitle}</h3><Pill tone="success">{inventory.length} shown</Pill></div>
            {inventory.length ? inventory.map((listing) => (
              profile.canCreate ? (
                <ManagementListingRow
                  key={listing._id}
                  listing={listing}
                  profile={profile}
                  addressEditor={addressEditor}
                  busy={busy}
                  onOpen={openListing}
                  onStatus={updateListingStatus}
                  onPrice={updateListingPrice}
                  onDelete={deleteListing}
                  onEditAddress={editListingAddress}
                  onCancelAddress={cancelListingAddressEdit}
                  onAddressSelect={selectListingAddress}
                  onAddressSubmit={updateListingAddress}
                />
              ) : (
                <ListingRow key={listing._id} listing={listing} onOpen={openListing} onSave={saveFavorite} onBook={createBooking} onMessage={startConversation} />
              )
            )) : <Empty title="No listings yet" />}
          </div>
        </section>
      </>
    );
  }

  function renderPipeline() {
    const grouped = ["requested", "accepted", "completed", "declined"].map((status) => ({
      status,
      items: bookings.filter((booking) => booking.status === status)
    }));
    return (
      <>
        <PageHeader eyebrow="Pipeline" title="Bookings and Visit Requests" meta={<Pill tone="neutral">{bookings.length} bookings</Pill>} />
        <section className="pipeline-grid">
          {grouped.map((column) => (
            <div className="panel pipeline-column" key={column.status}>
              <div className="panel-head"><h3>{column.status}</h3><Status value={column.status} /></div>
              {column.items.length ? column.items.map((booking) => (
                <article className="pipeline-card" key={booking._id}>
                  <PhotoImage listing={booking.listing} className="pipeline-photo" />
                  <div className="pipeline-copy">
                    <strong>{booking.listing?.title}</strong>
                    <p>{booking.requestType} - {shortDate(booking.proposedAt)}</p>
                    <span>{booking.requester?.name} to {booking.receiver?.name}</span>
                  </div>
                  <div className="row-actions">
                    <button type="button" className="icon-button" title="Accept" onClick={() => respondBooking(booking._id, "accepted")}><CheckCircle2 size={16} /></button>
                    <button type="button" className="icon-button" title="Complete" onClick={() => respondBooking(booking._id, "completed")}><ClipboardCheck size={16} /></button>
                    <button type="button" className="icon-button danger" title="Decline" onClick={() => respondBooking(booking._id, "declined")}><XCircle size={16} /></button>
                  </div>
                </article>
              )) : <Empty title="No records" />}
            </div>
          ))}
        </section>
      </>
    );
  }

  function renderMessages() {
    return (
      <MessagesPage
        conversations={conversations}
        selectedConversationId={selectedConversationId}
        messages={messages}
        user={user}
        socketStatus={socketStatus}
        search={conversationSearch}
        onSearch={setConversationSearch}
        filter={conversationFilter}
        onFilter={setConversationFilter}
        onSelect={(id) => {
          setSelectedConversationId(id);
          loadMessages(id);
        }}
        onSend={sendMessage}
        busy={busy}
      />
    );
  }

  function renderNotifications() {
    return (
      <NotificationsPage
        notifications={notificationResults ?? notifications}
        unreadCount={notifications.filter((item) => !item.read).length}
        filter={notificationFilter}
        onFilter={selectNotificationFilter}
        onRead={markNotificationRead}
        onReadAll={markAllNotificationsRead}
        onView={viewNotification}
        busy={busy}
      />
    );
  }

  function renderWorkspace() {
    const listing = selectedListing;
    const reviews = detail?.listing?.reviews || [];
    const reviewSummary = detail?.reviewSummary || {};
    const reviewEligibility = detail?.reviewEligibility;
    const averageRating = Number(reviewSummary.averageRating ?? listing?.rating ?? 0);
    const reviewCount = Number(reviewSummary.reviewCount ?? listing?.reviewCount ?? reviews.length ?? 0);
    const distribution = reviewSummary.distribution || {};
    return (
      <>
        <PageHeader eyebrow="Workspace" title={listing?.title || "Client Workspace"} meta={listing && <Status value={listing.status} />} />
        <section className="workspace-grid">
          <div className="panel detail-panel">
            {listing ? (
              <>
                <div className="gallery-grid">
                  {(listing.photos?.length ? listing.photos : [primaryPhoto(listing)]).map((photo, index) => (
                    <figure className="gallery-tile" key={`${photo}-${index}`}>
                      <PhotoImage listing={listing} photo={photo} className="gallery-photo" alt={`${listing.title} ${humanizePhotoName(photo)}`} />
                      <figcaption>{humanizePhotoName(photo)}</figcaption>
                    </figure>
                  ))}
                </div>
                <p className="detail-copy">{listing.description}</p>
                <div className="metric-grid compact-metrics">
                  <MetricCard icon={CircleDollarSign} tone="green" label="Price" value={money(listing.price)} />
                  <MetricCard icon={Star} tone="amber" label="Rating" value={`${Number(listing.rating || 0).toFixed(1)}/5`} />
                  <MetricCard icon={MapPin} tone="blue" label="Distance" value={listing.metricLabel} />
                  <MetricCard icon={Store} tone="teal" label="Facilities" value={asList(listing.facilities)} />
                </div>
                <div className="owner-line">
                  <IconFrame icon={UserRound} tone="blue" />
                  <div>
                    <strong>{listing.owner?.name || "Owner"}</strong>
                    <p>{listing.owner?.role || listing.listingType} - {listing.owner?.verificationStatus || "verified"}</p>
                    <ProviderRatingLine profile={listing.owner} />
                  </div>
                  <button type="button" className="action primary small" onClick={() => startConversation(listing._id)}><MessageSquareText size={15} />Message</button>
                </div>
              </>
            ) : <Empty title="No listing selected" />}
          </div>
          <div className="panel">
            <div className="panel-head"><h3>Nearby Places</h3><Pill tone="neutral">Area data</Pill></div>
            <div className="compact-list">
              {(detail?.nearbyPlaces || []).map((place) => (
                <div className="simple-row" key={place.id}>
                  <IconFrame icon={MapPin} tone="green" />
                  <div><strong>{place.category}</strong><p>{place.name} - {place.walkingMinutes} min walk</p></div>
                </div>
              ))}
            </div>
          </div>
          <div className="panel">
            <div className="panel-head"><h3>Setup Suggestions</h3><Pill tone="neutral">{detail?.setupSuggestions?.length || 0}</Pill></div>
            {(detail?.setupSuggestions || []).map((item) => (
              <ListingRow key={item._id} listing={item} onOpen={openListing} onSave={saveFavorite} onBook={createBooking} onMessage={startConversation} />
            ))}
          </div>
          <div className="panel">
            <div className="panel-head"><h3>Reviews</h3><Pill tone="neutral">{reviewCount}</Pill></div>
            <div className="review-summary">
              <div className="review-score">
                <StarMeter rating={averageRating} size={18} />
                <strong>{averageRating.toFixed(1)}</strong>
                <span>{reviewCount} review{reviewCount === 1 ? "" : "s"}</span>
              </div>
              <div className="rating-distribution">
                {[5, 4, 3, 2, 1].map((ratingValue) => {
                  const count = Number(distribution[String(ratingValue)] || 0);
                  const width = reviewCount ? Math.round((count / reviewCount) * 100) : 0;
                  return (
                    <div className="rating-bar" key={ratingValue}>
                      <span>{ratingValue}</span>
                      <i><b style={{ width: `${width}%` }} /></i>
                      <strong>{count}</strong>
                    </div>
                  );
                })}
              </div>
            </div>
            {reviews.length ? reviews.map((review) => (
              <div className="review-row" key={review._id}>
                <span>
                  <StarMeter rating={review.rating} size={13} />
                  <strong>{review.rating}/5</strong>
                </span>
                <div>
                  <div className="row-line">
                    <strong>{review.reviewer?.name || "Reviewer"}</strong>
                    <small>{shortDate(review.createdAt)}</small>
                  </div>
                  <p>{review.comment}</p>
                </div>
              </div>
            )) : <Empty title="No reviews yet." />}
            {listing && (
              reviewEligibility?.eligible ? (
                <form className="review-form" onSubmit={submitReview}>
                  <label>
                    Rating
                    <StarRatingInput
                      value={reviewRating}
                      onChange={(nextRating) => {
                        setReviewRating(nextRating);
                        setReviewError("");
                      }}
                    />
                  </label>
                  <label>
                    Comment
                    <textarea
                      name="comment"
                      value={reviewComment}
                      onChange={(event) => {
                        setReviewComment(event.target.value);
                        setReviewError("");
                      }}
                      maxLength={1000}
                      placeholder="Share your experience with this listing."
                    />
                  </label>
                  {reviewError && <p className="form-error">{reviewError}</p>}
                  <button
                    className="action primary"
                    type="submit"
                    disabled={reviewSubmitting || !reviewRating || reviewComment.trim().length < 3}
                  >
                    <Star size={16} />{reviewSubmitting ? "Submitting" : "Submit Review"}
                  </button>
                </form>
              ) : (
                <div className="review-notice">
                  <IconFrame icon={ShieldCheck} tone={user?.role === "business-owner" ? "amber" : "blue"} />
                  <p>{reviewEligibility?.reason || "Checking review eligibility..."}</p>
                </div>
              )
            )}
          </div>
          <form className="panel form-panel" onSubmit={updateProfile} key={user?._id || "profile-form"}>
            <div className="panel-head"><h3>Profile</h3><Pill tone="neutral">{user?.role}</Pill></div>
            <ProviderRatingLine profile={user} />
            <label>Business type<input name="businessType" defaultValue={user?.businessType || ""} /></label>
            <label>Preferred area<input name="preferredArea" defaultValue={user?.preferredArea || ""} /></label>
            <div className="field-row">
              <label>Budget min<input name="budgetMin" type="number" min="0" defaultValue={user?.budgetMin || 0} /></label>
              <label>Budget max<input name="budgetMax" type="number" min="0" defaultValue={user?.budgetMax || 0} /></label>
            </div>
            <label>Preferred min size<input name="minSize" type="number" min="0" defaultValue={user?.minSize || 0} /></label>
            <label>Service need<input name="serviceNeed" defaultValue={user?.serviceNeed || ""} /></label>
            <button className="action primary" type="submit"><Bookmark size={16} />Save Profile</button>
          </form>
          <div className="panel listing-panel">
            <div className="panel-head"><h3>Favorites</h3><Pill tone="neutral">{favorites.length}</Pill></div>
            {favorites.map((item) => <ListingRow key={item._id} listing={item} onOpen={openListing} onSave={saveFavorite} onBook={createBooking} onMessage={startConversation} />)}
          </div>
        </section>
      </>
    );
  }

  function renderOperations() {
    return (
      <>
        <PageHeader eyebrow="Operations" title="Analytics and Database" meta={<Pill tone="success">{operations?.database?.status || "connected"}</Pill>} />
        <section className="ops-grid">
          <div className="panel">
            <div className="panel-head"><h3>Category Mix</h3><Pill tone="neutral">Inventory</Pill></div>
            <div className="data-list">
              {(operations?.categoryMix || []).map((item) => <DataBar key={item.category} label={item.category} value={item.count} max={maxCategory} note={`${item.count} - ${money(item.avgPrice)}`} />)}
            </div>
          </div>
          <div className="panel">
            <div className="panel-head"><h3>Booking Pipeline</h3><Pill tone="neutral">Status</Pill></div>
            <div className="status-grid">
              {(operations?.bookingPipeline || []).map((item) => <MetricCard key={item.status} icon={CalendarCheck} tone={toneFromStatus(item.status) === "success" ? "green" : "amber"} label={item.status} value={number(item.count)} />)}
            </div>
          </div>
          <div className="panel database-panel">
            <div className="panel-head"><h3>Database Collections</h3><Pill tone="neutral">{operations?.database?.collections || 0}</Pill></div>
            <div className="collection-grid">
              {(operations?.database?.counts || []).map((item) => (
                <div className="collection-tile" key={item.name}>
                  <span>{item.label}</span>
                  <strong>{number(item.count)}</strong>
                </div>
              ))}
            </div>
          </div>
          <div className="panel">
            <div className="panel-head"><h3>Activity Log</h3><Pill tone="neutral">{operations?.recentActivity?.length || 0}</Pill></div>
            <div className="activity-list">
              {(operations?.recentActivity || []).map((item) => (
                <div className="activity-row" key={item._id}>
                  <IconFrame icon={Activity} tone={item.severity === "warning" ? "amber" : "blue"} />
                  <div><strong>{item.message}</strong><p>{item.entityType} - {shortDate(item.createdAt)}</p></div>
                  <Status value={item.severity} />
                </div>
              ))}
            </div>
          </div>
        </section>
      </>
    );
  }

  function renderSupport() {
    return (
      <>
        <PageHeader eyebrow="Support" title="Ticket Desk" meta={<Pill tone="warning">{operations?.operations?.openTickets || 0} open</Pill>}>
          <a className="action secondary" href={`tel:${customerServicePhone}`}><PhoneCall size={16} />{customerServicePhone}</a>
        </PageHeader>
        <section className="split-layout">
          <form className="panel form-panel" onSubmit={createTicket}>
            <div className="panel-head"><h3>New Ticket</h3><Pill tone="neutral">Support</Pill></div>
            <div className="support-callout">
              <IconFrame icon={PhoneCall} tone="green" />
              <div>
                <span>Customer Service</span>
                <strong>{customerServicePhone}</strong>
                <p>Call for listing, booking, account, or technical support.</p>
              </div>
              <a className="action primary small" href={`tel:${customerServicePhone}`}>Call</a>
            </div>
            <label>Subject<input name="subject" defaultValue="Need help with listing comparison" /></label>
            <div className="field-row">
              <label>Category<select name="category" defaultValue="listing"><option value="account">Account</option><option value="listing">Listing</option><option value="booking">Booking</option><option value="payment">Payment</option><option value="technical">Technical</option></select></label>
              <label>Priority<select name="priority" defaultValue="medium"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
            </div>
            <label>Message<textarea name="message" defaultValue="Please help me compare Banani spaces with setup service availability." /></label>
            <button className="action primary" type="submit"><LifeBuoy size={16} />Create Ticket</button>
          </form>
          <div className="panel">
            <div className="panel-head"><h3>Tickets</h3><Pill tone="neutral">{operations?.tickets?.length || 0}</Pill></div>
            <div className="ticket-list">
              {(operations?.tickets || []).map((ticket) => (
                <article className="ticket-row" key={ticket._id}>
                  <IconFrame icon={LifeBuoy} tone={ticket.priority === "high" ? "rose" : "teal"} />
                  <div>
                    <div className="row-line"><h4>{ticket.subject}</h4><Status value={ticket.status} /></div>
                    <p>{ticket.requester?.name} - {ticket.category} - {ticket.priority}</p>
                  </div>
                  <div className="row-actions">
                    <button className="action secondary small" type="button" onClick={() => updateTicket(ticket._id, "in-progress")}>Work</button>
                    <button className="action primary small" type="button" onClick={() => updateTicket(ticket._id, "resolved")}>Resolve</button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </>
    );
  }

  function renderAdmin() {
    return (
      <>
        <PageHeader eyebrow="Admin" title="Verification, Moderation and Settings" meta={<Pill tone="warning">{(admin.pendingUsers?.length || 0) + (admin.pendingListings?.length || 0) + (admin.reports?.length || 0)} queue</Pill>} />
        <section className="admin-grid">
          <div className="panel">
            <div className="panel-head"><h3>Pending Users</h3><Pill tone="neutral">{admin.pendingUsers?.length || 0}</Pill></div>
            {(admin.pendingUsers || []).map((pending) => (
              <div className="admin-row" key={pending._id}>
                <IconFrame icon={UserRound} tone="amber" />
                <div><strong>{pending.name}</strong><p>{pending.role} - {pending.tradeLicense || pending.nid || "No document"}</p></div>
                <button className="action primary small" type="button" onClick={() => verifyUser(pending._id)}><CheckCircle2 size={15} />Verify</button>
              </div>
            ))}
          </div>
          <div className="panel">
            <div className="panel-head"><h3>Pending Listings</h3><Pill tone="neutral">{admin.pendingListings?.length || 0}</Pill></div>
            {(admin.pendingListings || []).map((listing) => (
              <div className="admin-row" key={listing._id}>
                <PhotoImage listing={listing} className="row-photo" />
                <div><strong>{listing.title}</strong><p>{listing.owner?.name} - {listing.area}</p></div>
                <button className="action primary small" type="button" onClick={() => moderateListing(listing._id)}><ClipboardCheck size={15} />Approve</button>
              </div>
            ))}
          </div>
          <div className="panel">
            <div className="panel-head"><h3>Reports</h3><Pill tone="neutral">{admin.reports?.length || 0}</Pill></div>
            {(admin.reports || []).map((report) => (
              <div className="admin-row" key={report._id}>
                <IconFrame icon={Activity} tone="rose" />
                <div><strong>{report.targetType}</strong><p>{report.reason}</p></div>
                <Status value={report.status} />
              </div>
            ))}
          </div>
          <div className="panel settings-panel">
            <div className="panel-head"><h3>Settings</h3><Pill tone="neutral">{operations?.settings?.length || 0}</Pill></div>
            {(operations?.settings || []).map((setting) => (
              <form className="setting-row" key={setting._id} onSubmit={updateSetting}>
                <input type="hidden" name="key" value={setting.key} />
                <input type="hidden" name="valueType" value={setting.valueType} />
                <div><strong>{setting.label}</strong><p>{setting.category} - {setting.key}</p></div>
                {setting.valueType === "boolean" ? (
                  <select name="value" defaultValue={String(setting.value)}>
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </select>
                ) : (
                  <input name="value" type={setting.valueType === "number" ? "number" : "text"} defaultValue={String(setting.value)} />
                )}
                <button className="action secondary small" type="submit"><Settings size={15} />Save</button>
              </form>
            ))}
          </div>
        </section>
      </>
    );
  }

  const views = {
    dashboard: renderDashboard,
    marketplace: renderMarketplace,
    listings: renderListings,
    pipeline: renderPipeline,
    messages: renderMessages,
    notifications: renderNotifications,
    workspace: renderWorkspace,
    operations: renderOperations,
    support: renderSupport,
    admin: renderAdmin
  };

  return (
    <>
      <header className="app-topbar">
        <div className="brand">
          <span className="brand-mark"><Building2 size={23} /></span>
          <div><h1>OfficeKhoj BD</h1><p>Commercial space operations</p></div>
        </div>
        <div className="role-switcher">
          {roles.map(({ key, label, icon: Icon }) => (
            <button
              type="button"
              className={`${role === key ? "active" : ""} ${switchingRole === key ? "loading" : ""}`}
              key={key}
              onClick={() => switchRole(key)}
              disabled={Boolean(switchingRole)}
              aria-pressed={role === key}
              title={`Switch to ${label} account`}
            >
              <Icon size={15} />{label}{switchingRole === key && <span className="role-spinner" />}
            </button>
          ))}
        </div>
        <div className="account-chip">
          <span className={health?.ok ? "live-dot" : "live-dot muted"} />
          <div>
            <strong>{user?.name || "Connecting"}</strong>
            <p>{user?.role || "session"}</p>
            <ProviderRatingLine profile={user} />
          </div>
        </div>
      </header>

      <main className="app-shell">
        <aside className="sidebar">
          <span className="sidebar-label">Menu</span>
          {navItems.map(({ key, label, icon: Icon }) => {
            const badge = key === "notifications"
              ? notifications.filter((item) => !item.read).length
              : key === "messages"
                ? conversations.reduce((total, conversation) => total + (conversation.messages || []).filter((message) => (
                    String(message.sender?._id || message.sender) !== String(user?._id) &&
                    !(message.readBy || []).some((reader) => String(reader?._id || reader) === String(user?._id))
                  )).length, 0)
                : 0;
            return (
              <button type="button" className={`nav-item ${view === key ? "active" : ""}`} key={key} onClick={() => navigateToView(key)}>
                <Icon size={17} />
                <span>{label}</span>
                {badge > 0 && <strong className="nav-badge">{badge}</strong>}
              </button>
            );
          })}
        </aside>

        <section className="content">
          {dashboard && operations ? views[view]() : <div className="loading-panel"><Database size={24} /><strong>Loading workspace</strong></div>}
        </section>
      </main>

      {busy && <div className="busy-line" />}
      {toast && <div className="toast">{toast}</div>}
      {deleteTargetId && (
        <div className="modal-backdrop" role="presentation" onClick={() => setDeleteTargetId("")}>
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-listing-title" onClick={(event) => event.stopPropagation()}>
            <IconFrame icon={XCircle} tone="rose" />
            <div>
              <span className="eyebrow">Confirm Delete</span>
              <h3 id="delete-listing-title">Delete this listing?</h3>
              <p>{deleteTargetListing?.title || "Selected listing"} will be removed from the platform inventory.</p>
            </div>
            <div className="modal-actions">
              <button className="action secondary" type="button" onClick={() => setDeleteTargetId("")}>Cancel</button>
              <button className="action primary danger-action" type="button" onClick={confirmDeleteListing}><XCircle size={16} />Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
