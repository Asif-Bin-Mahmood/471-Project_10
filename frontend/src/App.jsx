import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bell,
  Bookmark,
  BriefcaseBusiness,
  Building2,
  CalendarCheck,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Compass,
  Gauge,
  Flag,
  Heart,
  LayoutDashboard,
  LifeBuoy,
  ListPlus,
  LogOut,
  Mail,
  MapPinned,
  MapPin,
  MessageSquareText,
  PanelLeft,
  PanelLeftClose,
  PhoneCall,
  Plus,
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
import { api, getAuthToken, setAuthToken } from "./api/client.js";
import AddressAutocomplete from "./components/AddressAutocomplete.jsx";
import AuthPage from "./components/AuthPage.jsx";
import { MessagesPage, NotificationsPage } from "./components/Communications.jsx";
import FacilitiesPicker from "./components/FacilitiesPicker.jsx";
import ListingMap from "./components/ListingMap.jsx";
import PhotoUploadField from "./components/PhotoUploadField.jsx";
import ProfilePreferences from "./components/ProfilePreferences.jsx";
import { connectSocket, disconnectSocket, getSocket } from "./realtime/socket.js";
import { uploadProfilePhoto } from "./services/photoUpload.js";

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

const roleKeyByUserRole = {
  "business-owner": "business",
  "property-owner": "property",
  "service-provider": "service",
  admin: "admin"
};

const roleViewAccess = {
  business: new Set(["dashboard", "marketplace", "pipeline", "messages", "notifications", "workspace", "profile", "support"]),
  property: new Set(["dashboard", "marketplace", "listings", "pipeline", "messages", "notifications", "workspace", "profile", "support"]),
  service: new Set(["dashboard", "marketplace", "listings", "pipeline", "messages", "notifications", "workspace", "profile", "support"]),
  admin: new Set(["dashboard", "marketplace", "messages", "notifications", "workspace", "profile", "operations", "support", "admin"])
};

function roleKeyForUser(user) {
  return roleKeyByUserRole[user?.role] || "business";
}

function canAccessView(role, view) {
  return Boolean(roleViewAccess[role]?.has(view));
}

const navItems = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "marketplace", label: "Marketplace", icon: Search },
  { key: "listings", label: "Listings", icon: ListPlus },
  { key: "pipeline", label: "Pipeline", icon: CalendarCheck },
  { key: "messages", label: "Messages", icon: MessageSquareText },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "workspace", label: "Workspace", icon: Compass },
  { key: "profile", label: "My Profile", icon: UserRound, showInSidebar: false },
  { key: "operations", label: "Operations", icon: Gauge },
  { key: "support", label: "Support", icon: LifeBuoy },
  { key: "admin", label: "Admin", icon: ShieldCheck }
];

// Member 1 - Module 1 & 2: marketplace search/filter defaults.
const initialSearchQuery = {
  area: "",
  type: "all",
  propertyType: "all",
  serviceCategory: "all",
  sort: "newest",
  minPrice: "",
  maxPrice: "",
  minSize: "",
  maxSize: "",
  page: 1,
  pageSize: 8
};

const CUSTOMER_SERVICE_PHONE = "+8801636317693";
const propertyTypeValues = ["Office", "Shop"];
const serviceCategoryValues = ["Interior Design", "ISP", "Electrician", "Vendor"];

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
  const routes = {
    "/": "dashboard",
    "/marketplace": "marketplace",
    "/listings": "listings",
    "/bookings": "pipeline",
    "/messages": "messages",
    "/notifications": "notifications",
    "/workspace": "workspace",
    "/profile": "profile",
    "/operations": "operations",
    "/support": "support",
    "/admin": "admin"
  };
  return routes[pathname] || "dashboard";
}

function pathnameForView(view) {
  const routes = {
    dashboard: "/",
    marketplace: "/marketplace",
    listings: "/listings",
    pipeline: "/bookings",
    messages: "/messages",
    notifications: "/notifications",
    workspace: "/workspace",
    profile: "/profile",
    operations: "/operations",
    support: "/support",
    admin: "/admin"
  };
  return routes[view] || "/";
}

const photoAssets = {
  "retail-front.jpg": "/images/listings/retail-front-real.jpg",
  "retail-floor.jpg": "/images/listings/retail-front-real.jpg",
  "portfolio-1.jpg": "/images/listings/portfolio-real.jpg",
  "portfolio-2.jpg": "/images/listings/portfolio-real.jpg",
  "isp-rack.jpg": "/images/listings/isp-rack-real.jpg",
  "office-floor.jpg": "/images/listings/office-floor-real.jpg",
  "electric-team.jpg": "/images/listings/electric-team-real.jpg",
  "uploaded-photo.jpg": "/images/listings/uploaded-photo.jpg"
};

const categoryPhotoAssets = {
  shop: photoAssets["retail-front.jpg"],
  interior: photoAssets["portfolio-1.jpg"],
  isp: photoAssets["isp-rack.jpg"],
  office: photoAssets["office-floor.jpg"],
  electrician: photoAssets["electric-team.jpg"],
  vendor: photoAssets["uploaded-photo.jpg"],
  property: photoAssets["office-floor.jpg"],
  service: photoAssets["portfolio-1.jpg"]
};

const categoryOptions = [
  { value: "all", label: "All", type: "all", propertyType: "all", serviceCategory: "all", icon: LayoutDashboard },
  { value: "Office", label: "Office", type: "property", propertyType: "Office", serviceCategory: "all", icon: Building2 },
  { value: "Shop", label: "Shop", type: "property", propertyType: "Shop", serviceCategory: "all", icon: Store },
  { value: "Interior Design", label: "Interior Design", type: "service", propertyType: "all", serviceCategory: "Interior Design", icon: Compass },
  { value: "ISP", label: "ISP", type: "service", propertyType: "all", serviceCategory: "ISP", icon: Gauge },
  { value: "Electrician", label: "Electrician", type: "service", propertyType: "all", serviceCategory: "Electrician", icon: Activity },
  { value: "Vendor", label: "Vendor", type: "service", propertyType: "all", serviceCategory: "Vendor", icon: BriefcaseBusiness }
];

const popularDhakaAreas = [
  "Banani",
  "Gulshan",
  "Bashundhara",
  "Uttara",
  "Mohakhali",
  "Tejgaon",
  "Farmgate",
  "Dhanmondi",
  "Mohammadpur",
  "Mirpur",
  "Badda",
  "Rampura",
  "Motijheel",
  "Paltan"
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
    categories: ["Office", "Shop"],
    defaultFacilities: []
  },
  service: {
    eyebrow: "Service Workspace",
    title: "Service Package Management",
    badge: "Service provider",
    listingType: "service",
    canCreate: true,
    inventoryTitle: "My Service Packages",
    createTitle: "Create Service Package",
    categories: ["Interior Design", "ISP", "Electrician", "Vendor"],
    defaultFacilities: []
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

const roleDashboardContent = {
  business: {
    title: "Find and secure the right workspace",
    text: "Search verified spaces and services, manage visits, and keep owner conversations together.",
    actions: [
      { view: "marketplace", title: "Explore marketplace", text: "Search spaces and setup services.", icon: Search, tone: "green" },
      { view: "pipeline", title: "My bookings", text: "Track visit requests and confirmations.", icon: CalendarCheck, tone: "amber" },
      { view: "messages", title: "Owner messages", text: "Continue listing conversations.", icon: MessageSquareText, tone: "blue" },
      { view: "workspace", title: "Saved workspace", text: "Review favorites and preferences.", icon: Bookmark, tone: "teal" }
    ]
  },
  property: {
    title: "Manage your property portfolio",
    text: "Publish commercial spaces, keep availability accurate, and respond to business visit requests.",
    actions: [
      { view: "listings", title: "Property inventory", text: "Create and manage your spaces.", icon: Building2, tone: "blue" },
      { view: "pipeline", title: "Visit requests", text: "Accept or update booking requests.", icon: CalendarCheck, tone: "amber" },
      { view: "messages", title: "Business inquiries", text: "Reply to interested businesses.", icon: MessageSquareText, tone: "green" },
      { view: "marketplace", title: "Market overview", text: "Review comparable verified listings.", icon: Gauge, tone: "teal" }
    ]
  },
  service: {
    title: "Grow your service business",
    text: "Manage service packages, portfolio coverage, availability, and incoming client inquiries.",
    actions: [
      { view: "listings", title: "Service packages", text: "Create and manage your offers.", icon: Wrench, tone: "teal" },
      { view: "pipeline", title: "Client requests", text: "Track service booking activity.", icon: CalendarCheck, tone: "amber" },
      { view: "messages", title: "Client messages", text: "Reply to business inquiries.", icon: MessageSquareText, tone: "green" },
      { view: "marketplace", title: "Marketplace", text: "See nearby spaces and opportunities.", icon: Search, tone: "blue" }
    ]
  },
  admin: {
    title: "Keep the marketplace trusted",
    text: "Review accounts and listings, monitor operations, and resolve platform support issues.",
    actions: [
      { view: "admin", title: "Moderation queue", text: "Verify users and approve listings.", icon: ShieldCheck, tone: "amber" },
      { view: "operations", title: "Platform analytics", text: "Review inventory and activity health.", icon: Gauge, tone: "blue" },
      { view: "support", title: "Support desk", text: "Manage open platform tickets.", icon: LifeBuoy, tone: "teal" },
      { view: "notifications", title: "Admin alerts", text: "Review important platform updates.", icon: Bell, tone: "rose" }
    ]
  }
};

const roleGuides = {
  business: [
    { title: "Find the right place", text: "Search verified commercial spaces and setup services by location, category, price and size.", icon: Search, view: "marketplace", action: "Explore marketplace" },
    { title: "Shortlist with confidence", text: "Open a listing to review its gallery, live map location, nearby places, ratings and suggested providers.", icon: Heart, view: "workspace", action: "Open workspace" },
    { title: "Book and stay updated", text: "Request a property visit or service, then track accepted, declined or alternate-time responses.", icon: CalendarCheck, view: "pipeline", action: "View bookings" },
    { title: "Talk directly", text: "Message owners and providers in real time, then leave a verified review after working together.", icon: MessageSquareText, view: "messages", action: "Open messages" }
  ],
  property: [
    { title: "Complete verification", text: "Your listing tools become available after Admin approval, keeping the marketplace trustworthy.", icon: ShieldCheck, view: "notifications", action: "Check status" },
    { title: "Publish a property", text: "Create a listing with verified address suggestions, accurate map placement, photos and searchable facilities.", icon: Building2, view: "listings", action: "Manage properties" },
    { title: "Manage visit requests", text: "Accept, decline or propose another time while the requester receives live and email updates.", icon: CalendarCheck, view: "pipeline", action: "Open visit requests" },
    { title: "Support interested businesses", text: "Use real-time messaging to answer questions before a visit or booking.", icon: MessageSquareText, view: "messages", action: "Open messages" }
  ],
  service: [
    { title: "Complete verification", text: "Admin approval unlocks service publishing and protects businesses from unverified providers.", icon: ShieldCheck, view: "notifications", action: "Check status" },
    { title: "Publish service packages", text: "Add coverage areas, category, availability, portfolio photos and facilities included in your service.", icon: Wrench, view: "listings", action: "Manage packages" },
    { title: "Receive service bookings", text: "Respond to requests immediately with accept, decline or a practical alternate schedule.", icon: CalendarCheck, view: "pipeline", action: "Open bookings" },
    { title: "Build customer trust", text: "Answer inquiries in real time and keep your availability and package details current.", icon: MessageSquareText, view: "messages", action: "Open messages" }
  ],
  admin: [
    { title: "Verify trusted providers", text: "Review pending Property Owners and Service Providers, then approve or reject each account.", icon: ShieldCheck, view: "admin", action: "Open verification" },
    { title: "Moderate inventory", text: "Inspect every property and service listing, including pending and unavailable records.", icon: Store, view: "admin", action: "Open inventory" },
    { title: "Resolve reports", text: "Review reported listings or users, open the target and resolve, dismiss or remove unsafe content.", icon: Flag, view: "admin", action: "Review reports" },
    { title: "Monitor operations", text: "Track platform health, support tickets and operational settings from Admin-only workspaces.", icon: Gauge, view: "operations", action: "View operations" }
  ]
};

const settingDescriptions = {
  max_booking_window_days: "How far ahead users can request a booking.",
  email_notifications_enabled: "Send helpful booking, inquiry and review emails.",
  auto_verify_business_owners: "Let Business Owners start browsing immediately.",
  platform_commission_rate: "Default platform commission percentage.",
  customer_service_phone: "Phone number shown in the Help and Support workspace."
};

function money(value) {
  return `BDT ${Number(value || 0).toLocaleString("en-BD")}`;
}

function commaList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function number(value) {
  return Number(value || 0).toLocaleString("en-BD");
}

function shortDate(value) {
  if (!value) return "Not scheduled";
  return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function dateTimeLocalValue(value = Date.now() + 86400000) {
  const date = new Date(value);
  const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localTime.toISOString().slice(0, 16);
}

function asList(value) {
  if (Array.isArray(value)) return value.join(", ");
  return value || "Not added";
}

function maskedEmail(value) {
  const [, domain = ""] = String(value || "").split("@");
  if (!domain) return "Protected account email";
  return `••••••••@${domain}`;
}

const accountRoleLabels = {
  "business-owner": "Business Owner",
  "property-owner": "Property Owner",
  "service-provider": "Service Provider",
  admin: "Administrator"
};

function accountRoleLabel(value) {
  return accountRoleLabels[value] || "OfficeKhoj Member";
}

function accountInitials(value) {
  return String(value || "OfficeKhoj User")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "OK";
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

function LoadingWorkspace() {
  return (
    <div className="workspace-skeleton" aria-label="Loading workspace" aria-live="polite">
      <div className="skeleton-heading"><span /><strong /></div>
      <div className="skeleton-metrics">
        {[1, 2, 3, 4].map((item) => <i key={item} />)}
      </div>
      <div className="skeleton-panels"><i /><i /></div>
      <span className="sr-only">Loading workspace</span>
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

function ViewTabs({ label, value, onChange, items }) {
  return (
    <div className="view-tabs" role="tablist" aria-label={label}>
      {items.map(({ key, label: itemLabel, icon: Icon, count }) => (
        <button
          type="button"
          role="tab"
          aria-selected={value === key}
          className={value === key ? "active" : ""}
          key={key}
          onClick={() => onChange(key)}
        >
          {Icon ? <Icon size={15} /> : null}
          <span>{itemLabel}</span>
          {count !== undefined ? <small>{count}</small> : null}
        </button>
      ))}
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

function ListingRow({ listing, onOpen, onSave, onBook, onMessage, canEngage = false }) {
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
          <span><MapPin size={13} />{listing.searchDistanceLabel || listing.metricLabel}</span>
          <span><Star size={13} />{Number(listing.rating || 0).toFixed(1)}</span>
          <span><TypeIcon size={13} />{listing.listingType === "service" ? "Setup service" : "Commercial space"}</span>
        </div>
      </div>
      <div className="row-actions">
        {canEngage ? (
          <>
            <button type="button" className="icon-button" title="Save / remove favorite" onClick={() => onSave(listing._id)}><Heart size={16} /></button>
            <button type="button" className="icon-button" title="Message" onClick={() => onMessage(listing._id)}><Mail size={16} /></button>
            <button type="button" className="action primary small" onClick={() => onBook(listing._id)}>
              <CalendarCheck size={15} />{listing.listingType === "service" ? "Book service" : "Request visit"}
            </button>
          </>
        ) : null}
        <button type="button" className="action secondary small" onClick={() => onOpen(listing._id)}>Open<ChevronRight size={15} /></button>
      </div>
    </article>
  );
}

function SetupSuggestionCard({ listing, onOpen, onBook, onMessage }) {
  return (
    <article className="setup-suggestion-card">
      <PhotoImage listing={listing} className="setup-suggestion-photo" />
      <div className="setup-suggestion-copy">
        <div className="row-line">
          <div>
            <span className="eyebrow">{listing.category}</span>
            <h4>{listing.owner?.name || listing.title}</h4>
          </div>
          <Status value={listing.status} />
        </div>
        <p>{listing.title}</p>
        <div className="micro-row">
          <span><MapPin size={13} />Covers {asList(listing.coverageAreas)}</span>
          <span><Star size={13} fill="currentColor" />{Number(listing.rating || 0).toFixed(1)} ({Number(listing.reviewCount || 0)})</span>
        </div>
      </div>
      <div className="row-actions">
        <button type="button" className="icon-button" title="Message provider" onClick={() => onMessage(listing._id)}><Mail size={16} /></button>
        <button type="button" className="action secondary small" onClick={() => onOpen(listing._id)}>View</button>
        <button type="button" className="action primary small" onClick={() => onBook(listing._id)}><CalendarCheck size={15} />Book service</button>
      </div>
    </article>
  );
}

// Member 2 - Module 1 & 2: one editor is reused for property and service listings.
function ListingEditForm({ listing, busy, onCancel, onSave }) {
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const categories = listing.listingType === "service" ? serviceCategoryValues : propertyTypeValues;
  const statuses = listing.listingType === "service" ? ["Available", "Busy"] : ["Available", "Leased"];

  async function submit(event) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget).entries());
    const payload = {
      title: form.title,
      category: form.category,
      price: Number(form.price),
      size: listing.listingType === "property" ? Number(form.size) : 0,
      facilities: commaList(form.facilities),
      coverageAreas: commaList(form.coverageAreas),
      photos: commaList(form.photos),
      description: form.description,
      status: form.status
    };
    if (selectedAddress?.id) payload.addressId = selectedAddress.id;
    await onSave(listing._id, payload);
  }

  return (
    <form className="listing-edit-form" onSubmit={submit}>
      <div className="listing-edit-head">
        <div>
          <span className="eyebrow">Full listing editor</span>
          <strong>Edit {listing.listingType === "service" ? "service package" : "commercial space"}</strong>
        </div>
        <button className="icon-button" type="button" title="Close editor" onClick={onCancel}><XCircle size={16} /></button>
      </div>
      <div className="field-row">
        <label>Title<input name="title" defaultValue={listing.title} minLength="4" required /></label>
        <label>Category<select name="category" defaultValue={listing.category}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
      </div>
      <div className="field-row">
        <label>{listing.listingType === "service" ? "Starting price" : "Monthly rent"}<input name="price" type="number" min="1" defaultValue={listing.price} required /></label>
        {listing.listingType === "property" ? (
          <label>Size (sq ft)<input name="size" type="number" min="1" defaultValue={listing.size} required /></label>
        ) : (
          <label>Status<select name="status" defaultValue={listing.status}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label>
        )}
      </div>
      {listing.listingType === "property" ? (
        <label>Status<select name="status" defaultValue={listing.status}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label>
      ) : null}
      <FacilitiesPicker listingType={listing.listingType} initialValues={listing.facilities || []} />
      <label>Coverage areas{listing.listingType === "property" ? " (optional)" : ""}<input name="coverageAreas" defaultValue={(listing.coverageAreas || []).join(", ")} required={listing.listingType === "service"} /></label>
      <PhotoUploadField
        listingType={listing.listingType}
        initialUrls={listing.photos || []}
        label={listing.listingType === "service" ? "Portfolio photos" : "Property photos"}
        onUploadingChange={setPhotoUploading}
      />
      <label>{listing.listingType === "service" ? "Portfolio / service description" : "Description"}<textarea name="description" defaultValue={listing.description || ""} /></label>
      <AddressAutocomplete
        idPrefix={`full-edit-address-${listing._id}`}
        label="Change address/location (optional)"
        initialLabel={listing.address}
        onSelect={setSelectedAddress}
      />
      <p className="editor-help">Keep the current address text unchanged to preserve the existing coordinates, or select a suggestion to update them.</p>
      <div className="listing-edit-actions">
        <button className="action secondary" type="button" onClick={onCancel}>Cancel</button>
        <button className="action primary" type="submit" disabled={busy || photoUploading}><Settings size={16} />{photoUploading ? "Uploading photos..." : "Save all changes"}</button>
      </div>
    </form>
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
  onAddressSubmit,
  editing,
  onEdit,
  onCancelEdit,
  onSaveEdit,
  canManage = true
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
          <span><UserRound size={13} />{profile.badge}</span>
        </div>
      </div>
      <form className="management-actions" onSubmit={(event) => onPrice(event, listing._id)}>
        <input name="price" type="number" min="1" defaultValue={listing.price} aria-label={`Price for ${listing.title}`} disabled={!canManage} />
        <button className="action secondary small" type="submit" disabled={!canManage}><Settings size={15} />Save</button>
        <button className="action secondary small" type="button" disabled={!canManage} onClick={() => onStatus(listing._id, "Available")}>Available</button>
        <button className="action secondary small" type="button" disabled={!canManage} onClick={() => onStatus(listing._id, alternateStatus)}>{alternateStatus}</button>
        <button className="action secondary small" type="button" disabled={!canManage} onClick={() => onEdit(listing._id)}>Edit details</button>
        <button className="action secondary small" type="button" disabled={!canManage} onClick={() => onEditAddress(listing)}>Change address</button>
        <button className="icon-button danger" type="button" title="Delete listing" disabled={!canManage} onClick={() => onDelete(listing._id)}><XCircle size={16} /></button>
      </form>
      {!canManage ? <p className="editor-help">Admin verification is required before this listing can be managed.</p> : null}
      {canManage && isEditingAddress && (
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
      {canManage && editing ? (
        <ListingEditForm listing={listing} busy={busy} onCancel={onCancelEdit} onSave={onSaveEdit} />
      ) : null}
    </article>
  );
}

export default function App() {
  const [view, setView] = useState(() => viewFromPathname(window.location.pathname));
  const [role, setRole] = useState("business");
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState("");
  const [health, setHealth] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [operations, setOperations] = useState(null);
  const [admin, setAdmin] = useState({ pendingUsers: [], pendingListings: [], reports: [], inventory: [], inventorySummary: {} });
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
  const [createPhotoResetKey, setCreatePhotoResetKey] = useState(0);
  const [createPhotoUploading, setCreatePhotoUploading] = useState(false);
  const [addressEditor, setAddressEditor] = useState({ listingId: "", selectedAddress: null, resetKey: 0 });
  const [editingListingId, setEditingListingId] = useState("");
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [bookingTargetId, setBookingTargetId] = useState("");
  const [alternateBookingId, setAlternateBookingId] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState("");
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReviewId, setReportReviewId] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => (
    typeof window !== "undefined" && window.matchMedia("(min-width: 1021px)").matches
  ));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [marketplaceView, setMarketplaceView] = useState("results");
  const [dashboardTab, setDashboardTab] = useState("overview");
  const [listingWorkspaceTab, setListingWorkspaceTab] = useState("manage");
  const [workspaceTab, setWorkspaceTab] = useState("overview");
  const [profileSection, setProfileSection] = useState("overview");
  const [profilePhotoUploading, setProfilePhotoUploading] = useState(false);
  const [profilePhotoError, setProfilePhotoError] = useState("");
  const [adminTab, setAdminTab] = useState("queue");
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const toastTimer = useRef(null);
  const authBootstrapRef = useRef(false);
  const conversationsRef = useRef([]);
  const selectedConversationIdRef = useRef("");
  const areaRailRef = useRef(null);
  const categoryRailRef = useRef(null);
  const accountMenuRef = useRef(null);

  useEffect(() => {
    function closeOpenDialog(event) {
      if (event.key !== "Escape") return;
      setReportTarget(null);
      setReportReviewId("");
      setBookingTargetId("");
      setAlternateBookingId("");
      setDeleteTargetId("");
      setGuideOpen(false);
      setAccountMenuOpen(false);
    }
    window.addEventListener("keydown", closeOpenDialog);
    return () => window.removeEventListener("keydown", closeOpenDialog);
  }, []);

  useEffect(() => {
    const hasOpenDialog = guideOpen || reportTarget || reportReviewId || bookingTargetId || alternateBookingId || deleteTargetId;
    if (!hasOpenDialog) return undefined;

    const previousFocus = document.activeElement;
    const dialog = Array.from(document.querySelectorAll('[role="dialog"][aria-modal="true"]')).at(-1);
    if (!dialog) return undefined;
    const focusableSelector = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';
    const focusable = () => Array.from(dialog.querySelectorAll(focusableSelector)).filter((element) => !element.hidden);
    const firstControl = focusable()[0];
    firstControl?.focus();

    function containDialogFocus(event) {
      if (event.key !== "Tab") return;
      const controls = focusable();
      if (!controls.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    dialog.addEventListener("keydown", containDialogFocus);
    return () => {
      dialog.removeEventListener("keydown", containDialogFocus);
      if (previousFocus instanceof HTMLElement && document.contains(previousFocus)) previousFocus.focus();
    };
  }, [guideOpen, reportTarget, reportReviewId, bookingTargetId, alternateBookingId, deleteTargetId]);

  useEffect(() => {
    function closeAccountMenu(event) {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target)) setAccountMenuOpen(false);
    }
    document.addEventListener("pointerdown", closeAccountMenu);
    return () => document.removeEventListener("pointerdown", closeAccountMenu);
  }, []);

  const selectedListing = useMemo(
    () => detail?.listing || listings.find((item) => item._id === selectedListingId) || listings[0],
    [detail, listings, selectedListingId]
  );

  const bookingTargetListing = useMemo(
    () => listings.find((item) => item._id === bookingTargetId) ||
      favorites.find((item) => item._id === bookingTargetId) ||
      detail?.setupSuggestions?.find((item) => item._id === bookingTargetId) ||
      (detail?.listing?._id === bookingTargetId ? detail.listing : null),
    [bookingTargetId, detail, favorites, listings]
  );

  const deleteTargetListing = useMemo(
    () => inventoryListings.find((item) => item._id === deleteTargetId) ||
      (admin.inventory || []).find((item) => item._id === deleteTargetId) ||
      listings.find((item) => item._id === deleteTargetId) ||
      (detail?.listing?._id === deleteTargetId ? detail.listing : null),
    [admin.inventory, deleteTargetId, inventoryListings, listings, detail]
  );

  const selectedAdminReport = useMemo(
    () => (admin.reports || []).find((report) => report._id === reportReviewId) || null,
    [admin.reports, reportReviewId]
  );

  const maxArea = Math.max(...(operations?.areaDemand || []).map((item) => item.count), 1);
  const maxCategory = Math.max(...(operations?.categoryMix || []).map((item) => item.count), 1);
  const customerServicePhone = useMemo(
    () => operations?.settings?.find((setting) => setting.key === "customer_service_phone")?.value || CUSTOMER_SERVICE_PHONE,
    [operations]
  );
  const visibleTickets = useMemo(() => {
    const tickets = operations?.tickets || [];
    if (role === "admin") return tickets;
    return tickets.filter((ticket) => String(ticket.requester?._id || ticket.requester) === String(user?._id));
  }, [operations?.tickets, role, user?._id]);
  const managementProfile = managementProfiles[role] || managementProfiles.business;
  const currentRole = roles.find((item) => item.key === role) || roles[0];
  const currentNavItem = navItems.find((item) => item.key === view);

  useEffect(() => {
    setDashboardTab("overview");
    setListingWorkspaceTab("manage");
    setWorkspaceTab("overview");
    setAdminTab("queue");
    setAdvancedFiltersOpen(false);
    setMarketplaceView("results");
    setMobileMenuOpen(false);
    setGuideOpen(false);
    setGuideStep(0);
  }, [role]);

  function notify(message) {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2800);
  }

  function navigateToView(nextView, { replace = false, activeRole = role } = {}) {
    const allowedView = canAccessView(activeRole, nextView)
      ? nextView
      : roleLandingViews[activeRole] || "dashboard";
    if (allowedView !== nextView) notify("That workspace is not available for your account role.");
    if (allowedView === "profile") setWorkspaceTab("profile");
    const nextPath = pathnameForView(allowedView);
    if (window.location.pathname !== nextPath) {
      window.history[replace ? "replaceState" : "pushState"]({ view: allowedView }, "", nextPath);
    }
    setView(allowedView);
    setMobileMenuOpen(false);
    setAccountMenuOpen(false);
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
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

  function scrollDiscoveryRail(ref, direction) {
    const rail = ref.current;
    if (!rail) return;
    rail.scrollBy({
      left: direction * Math.max(220, Math.round(rail.clientWidth * 0.72)),
      behavior: "smooth"
    });
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

  function resetWorkspaceData() {
    setHealth(null);
    setDashboard(null);
    setOperations(null);
    setAdmin({ pendingUsers: [], pendingListings: [], reports: [], inventory: [], inventorySummary: {} });
    setListings([]);
    setInventoryListings([]);
    setFavorites([]);
    setConversations([]);
    setMessages([]);
    setBookings([]);
    setNotifications([]);
    setSelectedConversationId("");
    setSelectedListingId("");
    setDetail(null);
    setBookingTargetId("");
    setAlternateBookingId("");
  }

  async function establishSession(data, options = {}) {
    if (data.token) setAuthToken(data.token);
    const authenticatedUser = data.user;
    const nextRole = roleKeyForUser(authenticatedUser);
    const nextQuery = { ...initialSearchQuery };

    setUser(authenticatedUser);
    setRole(nextRole);
    setQuery(nextQuery);
    setSearchDraft(nextQuery);
    const requestedView = options.requestedView;
    const sessionView = requestedView && canAccessView(nextRole, requestedView)
      ? requestedView
      : roleLandingViews[nextRole] || "dashboard";
    if (sessionView === "profile") setWorkspaceTab("profile");
    navigateToView(sessionView, {
      replace: true,
      activeRole: nextRole
    });
    await loadCore(authenticatedUser, nextQuery, {
      resetSelections: true,
      activeRole: nextRole
    });
    return authenticatedUser;
  }

  async function login(credentials) {
    setBusy(true);
    setAuthError("");
    try {
      const data = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials)
      });
      await establishSession(data);
    } catch (error) {
      setAuthToken(null);
      resetWorkspaceData();
      setUser(null);
      setAuthError(error.message);
    } finally {
      setAuthReady(true);
      setBusy(false);
    }
  }

  async function register(registration) {
    setBusy(true);
    setAuthError("");
    try {
      const data = await api("/auth/register", {
        method: "POST",
        body: JSON.stringify(registration)
      });
      await establishSession(data);
      notify(data.user.verificationStatus === "pending"
        ? "Account created. Admin verification is pending."
        : "Account created successfully.");
    } catch (error) {
      setAuthToken(null);
      resetWorkspaceData();
      setUser(null);
      setAuthError(error.message);
    } finally {
      setAuthReady(true);
      setBusy(false);
    }
  }

  function logout() {
    disconnectSocket();
    setAuthToken(null);
    resetWorkspaceData();
    setUser(null);
    setRole("business");
    setAuthError("");
    setView("dashboard");
    window.history.replaceState({ view: "dashboard" }, "", "/");
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
    if (profile.canCreate && activeUser?._id) {
      const data = await api(`/listings/mine?type=${encodeURIComponent(profile.listingType)}`);
      setInventoryListings(data.results || []);
      setInventoryMeta(data);
      return;
    }

    const params = new URLSearchParams({
      area: "",
      type: profile.listingType,
      propertyType: "all",
      serviceCategory: "all",
      sort: "newest",
      maxPrice: String(Number.MAX_SAFE_INTEGER),
      minSize: "0",
      maxSize: "0",
      page: "1",
      pageSize: "12",
      includeUnavailable: activeRole === "admin" ? "true" : "false"
    });
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
        ? Promise.all([api("/admin/verifications"), api("/admin/inventory")]).then(([queue, inventory]) => ({
          ...queue,
          inventory: inventory.results || [],
          inventorySummary: inventory.summary || {}
        }))
        : Promise.resolve({ pendingUsers: [], pendingListings: [], reports: [], inventory: [], inventorySummary: {} });
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
    const nextMessages = data.messages || [];
    setMessages(nextMessages);
    setConversations((current) => current.map((conversation) => (
      String(conversation._id) === String(id)
        ? { ...conversation, messages: nextMessages }
        : conversation
    )));
    return nextMessages;
  }

  useEffect(() => {
    if (authBootstrapRef.current) return;
    authBootstrapRef.current = true;

    if (!getAuthToken()) {
      setAuthReady(true);
      return;
    }

    setBusy(true);
    api("/auth/me")
      .then((data) => establishSession(data, { requestedView: viewFromPathname(window.location.pathname) }))
      .catch(() => {
        setAuthToken(null);
        resetWorkspaceData();
        setUser(null);
        setAuthError("Your session expired. Please sign in again.");
      })
      .finally(() => {
        setAuthReady(true);
        setBusy(false);
      });
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const requestedView = viewFromPathname(window.location.pathname);
      setView(canAccessView(role, requestedView) ? requestedView : roleLandingViews[role]);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [role]);

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
    const handleBookingUpdate = (event) => {
      const booking = event?.booking;
      if (!booking?._id) return;

      setBookings((current) => [
        booking,
        ...current.filter((item) => String(item._id) !== String(booking._id))
      ]);
    };
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
        const sentByCurrentUser = String(event.message.sender?._id || event.message.sender) === String(user._id);
        if (sentByCurrentUser) {
          setMessages((current) => current.some((message) => String(message._id) === String(event.message._id))
            ? current
            : [...current, event.message]);
        } else {
          api(`/messages/${event.conversationId}`)
            .then((data) => {
              const nextMessages = data.messages || [];
              setMessages(nextMessages);
              setConversations((current) => current.map((conversation) => (
                String(conversation._id) === String(event.conversationId)
                  ? { ...conversation, messages: nextMessages, updatedAt: event.message.createdAt }
                  : conversation
              )));
            })
            .catch((error) => notify(error.message));
        }
      } else if (!selectedConversationIdRef.current) {
        selectedConversationIdRef.current = event.conversationId;
        setSelectedConversationId(event.conversationId);
        setMessages([event.message]);
      }
    };
    const handleMessagesRead = (event) => {
      if (!event?.conversationId || !event?.readerId || !Array.isArray(event.messageIds)) return;
      const readIds = new Set(event.messageIds.map(String));
      const markRead = (message) => readIds.has(String(message._id))
        ? {
            ...message,
            readBy: Array.from(new Set([...(message.readBy || []).map((reader) => String(reader?._id || reader)), String(event.readerId)]))
          }
        : message;
      setConversations((current) => current.map((conversation) => (
        String(conversation._id) === String(event.conversationId)
          ? { ...conversation, messages: (conversation.messages || []).map(markRead) }
          : conversation
      )));
      if (String(event.conversationId) === String(selectedConversationIdRef.current)) {
        setMessages((current) => current.map(markRead));
      }
    };

    const handleNotification = (incoming) => {
      if (!incoming?._id) return;
      setNotifications((current) => (
        current.some((item) => String(item._id) === String(incoming._id))
          ? current
          : [incoming, ...current]
      ));
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("message:new", handleMessage);
    socket.on("message:read", handleMessagesRead);
    socket.on("booking:updated", handleBookingUpdate);
    socket.on("notification:new", handleNotification);
    socket.io.on("reconnect_attempt", handleReconnectAttempt);
    if (socket.connected) handleConnect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("message:new", handleMessage);
      socket.off("message:read", handleMessagesRead);
      socket.off("booking:updated", handleBookingUpdate);
      socket.off("notification:new", handleNotification);
      socket.io.off("reconnect_attempt", handleReconnectAttempt);
      disconnectSocket();
    };
  }, [user?._id]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket?.connected || !selectedConversationId) return;
    socket.emit("conversation:join", selectedConversationId);
  }, [selectedConversationId, socketStatus]);

  // Member 1 - Module 1 & 2: send the current location/filter values to the unified search API.
  async function submitSearch(event) {
    event.preventDefault();
    await applySearch({ ...query, ...searchDraft });
  }

  async function selectCategoryOption(option) {
    const nextQuery = {
      ...searchDraft,
      type: option.type,
      propertyType: option.propertyType,
      serviceCategory: option.serviceCategory
    };
    setSearchDraft(nextQuery);
    await applySearch({ ...query, ...nextQuery });
  }

  // Member 2 - Module 1 & 2: create either a property or service listing through the same API.
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
    form.facilities = commaList(form.facilities);
    form.coverageAreas = commaList(form.coverageAreas);
    form.photos = commaList(form.photos);
    await runAction(async () => {
      await api("/listings", { method: "POST", body: JSON.stringify(form) });
      await loadCore(user, query, { activeRole: role });
      formElement.reset();
      setCreatePhotoResetKey((current) => current + 1);
      resetAddressSearch();
    }, "Listing saved");
  }

  // Member 2 - Module 3: property = Available/Leased, service = Available/Busy.
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

  async function updateListingDetails(id, payload) {
    await runAction(async () => {
      const data = await api(`/listings/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      setInventoryListings((current) => current.map((item) => (item._id === id ? data.listing : item)));
      setListings((current) => current.map((item) => (item._id === id ? data.listing : item)));
      setDetail((current) => (
        current?.listing?._id === id
          ? { ...current, listing: { ...current.listing, ...data.listing } }
          : current
      ));
      setEditingListingId("");
    }, "Listing details updated");
  }

  // Owners reach the photo/detail editor straight from the listing they are
  // viewing, instead of having to rediscover it under Listings.
  function manageListingMedia(id) {
    setEditingListingId(id);
    setListingWorkspaceTab("manage");
    navigateToView("listings");
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

  // Member 1 - Module 3: the same button adds or removes a favorite.
  async function saveFavorite(id) {
    const alreadySaved = favorites.some((item) => item._id === id);
    await runAction(async () => {
      await api(`/favorites/${user._id}/${id}`, { method: alreadySaved ? "DELETE" : "POST" });
      await loadCore(user);
    }, alreadySaved ? "Removed from favorites" : "Saved to favorites");
  }

  async function createBooking(id, payload) {
    await runAction(async () => {
      await api("/bookings", {
        method: "POST",
        body: JSON.stringify({
          listingId: id,
          requestType: payload.requestType,
          proposedAt: payload.proposedAt,
          notes: payload.notes
        })
      });
      await loadCore(user);
      navigateToView("pipeline");
    }, "Booking requested");
  }

  function openReportForm(targetType, targetId, targetLabel) {
    setReportTarget({ targetType, targetId, targetLabel });
  }

  async function submitReport(event) {
    event.preventDefault();
    if (!reportTarget) return;
    const form = Object.fromEntries(new FormData(event.currentTarget).entries());
    await runAction(async () => {
      await api("/reports", {
        method: "POST",
        body: JSON.stringify({
          targetType: reportTarget.targetType,
          targetId: reportTarget.targetId,
          reason: form.reason
        })
      });
      setReportTarget(null);
      await loadCore(user);
    }, "Report submitted for Admin review");
  }

  async function moderateReport(report, status, resolutionAction = status) {
    await runAction(async () => {
      await api(`/admin/reports/${report._id}`, {
        method: "PUT",
        body: JSON.stringify({ status, resolutionAction })
      });
      setReportReviewId("");
      await loadCore(user, query, { activeRole: role });
    }, status === "dismissed" ? "Report dismissed" : "Report resolved");
  }

  async function removeReportedListing(report) {
    if (!report?.target?._id || report.targetType !== "listing") return;
    await runAction(async () => {
      await api(`/listings/${report.target._id}`, { method: "DELETE" });
      await api(`/admin/reports/${report._id}`, {
        method: "PUT",
        body: JSON.stringify({ status: "resolved", resolutionAction: "target-removed" })
      });
      setReportReviewId("");
      await loadCore(user, query, { resetSelections: true, activeRole: role });
    }, "Reported listing removed");
  }

  function requestBooking(id) {
    setBookingTargetId(id);
  }

  async function confirmBooking(event) {
    event.preventDefault();
    const id = bookingTargetId;
    if (!id) return;
    const form = Object.fromEntries(new FormData(event.currentTarget).entries());
    const requestType = bookingTargetListing?.listingType === "service" ? "service-booking" : "visit";
    setBookingTargetId("");
    await createBooking(id, {
      requestType,
      proposedAt: new Date(form.proposedAt).toISOString(),
      notes: String(form.notes || "").trim()
    });
  }

  async function respondBooking(id, status, alternateAt) {
    await runAction(async () => {
      await api(`/bookings/${id}/respond`, { method: "PUT", body: JSON.stringify({ status, alternateAt }) });
      await loadCore(user);
    }, `Booking ${status}`);
  }

  async function proposeAlternateTime(event) {
    event.preventDefault();
    const id = alternateBookingId;
    if (!id) return;
    const form = Object.fromEntries(new FormData(event.currentTarget).entries());
    setAlternateBookingId("");
    await respondBooking(id, "alternate-proposed", new Date(form.alternateAt).toISOString());
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

  async function sendMessage(payload) {
    if (!payload?.conversationId || (!payload.message?.trim() && !payload.attachmentUrl)) return undefined;
    return runAction(async () => {
      const data = await api("/messages", { method: "POST", body: JSON.stringify(payload) });
      if (data.message?._id) {
        setMessages((current) => current.some((message) => String(message._id) === String(data.message._id))
          ? current
          : [...current, data.message]);
        setConversations((current) => current.map((conversation) => (
          String(conversation._id) === String(payload.conversationId)
            ? {
                ...conversation,
                messages: (conversation.messages || []).some((message) => String(message._id) === String(data.message._id))
                  ? conversation.messages
                  : [...(conversation.messages || []), data.message],
                updatedAt: data.message.createdAt
              }
            : conversation
        )));
      }
      return data;
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
    if (item.type === "verification" && role === "admin") {
      setAdminTab("queue");
      navigateToView("admin");
    }
    if (item.type === "system" && role === "admin" && item.title === "New content report") {
      setAdminTab("queue");
      navigateToView("admin");
    }
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

  async function updateUserVerification(id, status) {
    await runAction(async () => {
      await api(`/admin/users/${id}/verify`, { method: "PUT", body: JSON.stringify({ status }) });
      await loadCore(user);
    }, status === "verified" ? "User verified" : "User rejected");
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
    setWorkspaceTab("overview");
    navigateToView("workspace");
  }

  async function changeProfilePhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !user?._id) return;

    setProfilePhotoUploading(true);
    setProfilePhotoError("");
    try {
      const data = await uploadProfilePhoto(file, user._id);
      setUser(data.profile);
      notify("Profile photo updated");
    } catch (error) {
      setProfilePhotoError(error.message);
      notify(error.message);
    } finally {
      setProfilePhotoUploading(false);
    }
  }

  function renderDashboard() {
    const queueTotal = (dashboard?.pendingUsersCount || 0) + (dashboard?.pendingListingsCount || 0) + (dashboard?.openReports || 0) + (dashboard?.openTickets || 0);
    const roleDashboard = roleDashboardContent[role] || roleDashboardContent.business;
    const pendingBookings = bookings.filter((booking) => ["requested", "alternate-proposed"].includes(booking.status)).length;
    const availableInventory = inventoryListings.filter((listing) => String(listing.status).toLowerCase() === "available").length;
    const unreadNotifications = notifications.filter((notification) => !notification.read).length;
    const metricsByRole = {
      business: [
        { icon: Store, tone: "green", label: "Marketplace matches", value: number(meta.total || dashboard?.activeListings), note: `${meta.summary?.propertyCount || 0} property, ${meta.summary?.serviceCount || 0} service` },
        { icon: CalendarCheck, tone: "amber", label: "My bookings", value: number(bookings.length), note: `${pendingBookings} awaiting response` },
        { icon: Heart, tone: "rose", label: "Saved listings", value: number(favorites.length), note: "Ready to compare" },
        { icon: Bell, tone: "blue", label: "Unread updates", value: number(unreadNotifications), note: `${conversations.length} conversations` }
      ],
      property: [
        { icon: Building2, tone: "blue", label: "My properties", value: number(inventoryListings.length), note: `${availableInventory} available` },
        { icon: CalendarCheck, tone: "amber", label: "Visit requests", value: number(bookings.length), note: `${pendingBookings} need attention` },
        { icon: MessageSquareText, tone: "green", label: "Inquiries", value: number(conversations.length), note: "Business conversations" },
        { icon: Star, tone: "teal", label: "Owner rating", value: `${Number(user?.averageRating || 0).toFixed(1)}/5`, note: `${user?.reviewCount || 0} reviews` }
      ],
      service: [
        { icon: Wrench, tone: "teal", label: "My packages", value: number(inventoryListings.length), note: `${availableInventory} available` },
        { icon: CalendarCheck, tone: "amber", label: "Client requests", value: number(bookings.length), note: `${pendingBookings} need attention` },
        { icon: MessageSquareText, tone: "green", label: "Inquiries", value: number(conversations.length), note: "Client conversations" },
        { icon: Star, tone: "blue", label: "Provider rating", value: `${Number(user?.averageRating || 0).toFixed(1)}/5`, note: `${user?.reviewCount || 0} reviews` }
      ],
      admin: [
        { icon: Store, tone: "green", label: "Active listings", value: number(dashboard?.activeListings), note: `${dashboard?.activeProperties || 0} property, ${dashboard?.activeServices || 0} service` },
        { icon: UsersRound, tone: "blue", label: "Platform users", value: number(dashboard?.users), note: `${dashboard?.pendingUsersCount || 0} pending verification` },
        { icon: CalendarCheck, tone: "amber", label: "Bookings", value: number(dashboard?.bookings), note: `${operations?.operations?.conversionRate || 0}% conversion` },
        { icon: Activity, tone: "rose", label: "Open queue", value: number(queueTotal), note: "Moderation and support" }
      ]
    };
    const roleMetrics = metricsByRole[role] || metricsByRole.business;
    const statusRows = [
      { label: "Verification", value: `${(dashboard?.pendingUsersCount || 0) + (dashboard?.pendingListingsCount || 0)} pending review`, status: queueTotal ? "attention" : "healthy" },
      { label: "Marketplace", value: `${number(dashboard?.activeListings)} active listings`, status: "healthy" },
      { label: "Bookings", value: `${number(dashboard?.bookings)} total requests`, status: "healthy" },
      { label: "Support", value: `${number(dashboard?.openTickets)} open tickets`, status: dashboard?.openTickets ? "attention" : "healthy" }
    ];

    return (
      <>
        <PageHeader
          eyebrow={`${currentRole.label} workspace`}
          title={`${currentRole.label} Dashboard`}
          meta={<Status value={role === "admin" ? "Platform ready" : (user?.verificationStatus || "active")} />}
        >
          <button className="action secondary" type="button" onClick={() => loadCore(user)}><Activity size={16} />Refresh</button>
        </PageHeader>

        {role === "admin" ? (
          <ViewTabs
            label="Dashboard sections"
            value={dashboardTab}
            onChange={setDashboardTab}
            items={[
              { key: "overview", label: "Overview", icon: LayoutDashboard },
              { key: "insights", label: "Market insights", icon: Gauge },
              { key: "health", label: "Workflow health", icon: Activity, count: queueTotal }
            ]}
          />
        ) : null}

        {dashboardTab === "overview" ? (
          <>
            <section className="dashboard-command">
              <div>
                <span className="eyebrow">{currentRole.label} activity</span>
                <h3>{roleDashboard.title}</h3>
                <p>{roleDashboard.text}</p>
              </div>
              <div className="dashboard-action-grid">
                {roleDashboard.actions.map(({ view: targetView, title, text, icon: Icon, tone }) => (
                  <button className="dashboard-action" type="button" key={targetView} onClick={() => navigateToView(targetView)}>
                    <IconFrame icon={Icon} tone={tone} />
                    <span className="dashboard-action-title">{title}</span>
                    <p>{text}</p>
                  </button>
                ))}
              </div>
            </section>
            <section className="metric-grid">
              {roleMetrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}
            </section>
          </>
        ) : null}

        {role === "admin" && dashboardTab === "insights" ? (
          <section className="dashboard-grid dashboard-grid-focused">
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
          </section>
        ) : null}

        {role === "admin" && dashboardTab === "health" ? (
          <section className="dashboard-grid dashboard-grid-focused">
            <div className="panel">
              <div className="panel-head"><h3>Review Queue</h3><Pill tone="warning">{queueTotal} items</Pill></div>
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
        ) : null}
      </>
    );
  }

  function renderMarketplace() {
    const summary = meta.summary || {};
    const pages = visiblePages(meta.page, meta.totalPages);
    const advancedFilterCount = [
      searchDraft.propertyType !== "all",
      searchDraft.serviceCategory !== "all",
      Number(searchDraft.minPrice) > 0,
      Number(searchDraft.maxPrice) !== Number(initialSearchQuery.maxPrice),
      Number(searchDraft.minSize) > 0,
      Number(searchDraft.maxSize) > 0
    ].filter(Boolean).length;
    return (
      <>
        <PageHeader eyebrow="Marketplace" title="Commercial Spaces and Setup Services" meta={<Pill tone="neutral">{meta.total || 0} matches</Pill>} />
        {/* Member 1 - Module 1 & 2: location + type/category + price/size filters. */}
        <form className="filter-bar member-search-filter progressive-filter" onSubmit={submitSearch}>
          <div className="filter-core">
            <label className="area-filter search-command-field">
              <span className="search-field-label"><MapPin size={15} />Location</span>
              <input name="area" aria-label="Area / location" placeholder="Search area or address" value={searchDraft.area} onChange={(event) => updateSearchDraft("area", event.target.value)} />
            </label>
            <label className="search-command-field">
              <span className="search-field-label"><Building2 size={15} />Looking for</span>
              <select name="type" aria-label="Result type" value={searchDraft.type} onChange={(event) => updateSearchDraft("type", event.target.value)}><option value="all">Spaces + services</option><option value="property">Commercial spaces</option><option value="service">Setup services</option></select>
            </label>
            <label className="search-command-field">
              <span className="search-field-label"><SlidersHorizontal size={15} />Sort results</span>
              <select name="sort" aria-label="Sort" value={searchDraft.sort} onChange={(event) => updateSearchDraft("sort", event.target.value)}><option value="distance">Nearest first</option><option value="price-asc">Price low to high</option><option value="price-desc">Price high to low</option><option value="rating">Top rated</option><option value="newest">Newest</option></select>
            </label>
            <button className="action primary search-submit" type="submit"><Search size={18} /><span>Search</span></button>
            <button
              className={`action filter-toggle ${advancedFiltersOpen ? "active" : ""}`}
              type="button"
              aria-expanded={advancedFiltersOpen}
              onClick={() => setAdvancedFiltersOpen((current) => !current)}
            >
              <SlidersHorizontal size={16} />Filters
              {advancedFilterCount ? <small>{advancedFilterCount}</small> : null}
              <ChevronDown size={15} />
            </button>
          </div>
          {advancedFiltersOpen ? (
            <div className="advanced-filter-panel">
              <div className="advanced-filter-grid">
                <label>Space type<select name="propertyType" value={searchDraft.propertyType} onChange={(event) => updateSearchDraft("propertyType", event.target.value)}><option value="all">All spaces</option>{propertyTypeValues.map((category) => <option key={category}>{category}</option>)}</select></label>
                <label>Service category<select name="serviceCategory" value={searchDraft.serviceCategory} onChange={(event) => updateSearchDraft("serviceCategory", event.target.value)}><option value="all">All services</option>{serviceCategoryValues.map((category) => <option key={category}>{category}</option>)}</select></label>
                <label>Min price<input name="minPrice" type="number" min="0" value={searchDraft.minPrice} onChange={(event) => updateSearchDraft("minPrice", event.target.value)} /></label>
                <label>Max price<input name="maxPrice" type="number" min="0" value={searchDraft.maxPrice} onChange={(event) => updateSearchDraft("maxPrice", event.target.value)} /></label>
                <label>Min size (sq ft)<input name="minSize" type="number" min="0" value={searchDraft.minSize} onChange={(event) => updateSearchDraft("minSize", event.target.value)} /></label>
                <label>Max size (sq ft)<input name="maxSize" type="number" min="0" value={searchDraft.maxSize} onChange={(event) => updateSearchDraft("maxSize", event.target.value)} /></label>
              </div>
              <div className="filter-footer-actions">
                {hasSavedSearchPreferences(user) ? (
                  <button className="action secondary" type="button" onClick={applySavedPreferences}><Bookmark size={16} />Use saved preferences</button>
                ) : null}
                <button className="action secondary" type="button" onClick={() => applySearch(initialSearchQuery)}>Clear all</button>
                <button className="action primary" type="submit"><SlidersHorizontal size={16} />Apply filters</button>
              </div>
            </div>
          ) : null}
        </form>
        {meta.geocodeWarning ? <p className="geocode-warning">We could not verify this area precisely, so results use the nearest available location.</p> : null}
        <div className="area-discovery" aria-label="Popular Dhaka areas">
          <div className="area-discovery-label"><MapPin size={16} /><span><strong>Explore Dhaka</strong><small>Choose an area or type any location above</small></span></div>
          <div className="discovery-rail-shell">
            <button className="rail-arrow" type="button" aria-label="Show previous Dhaka areas" onClick={() => scrollDiscoveryRail(areaRailRef, -1)}><ChevronLeft size={17} /></button>
            <div className="area-chip-list" ref={areaRailRef}>
              {popularDhakaAreas.map((area) => (
                <button
                  type="button"
                  key={area}
                  className={String(searchDraft.area).toLowerCase() === area.toLowerCase() ? "active" : ""}
                  onClick={() => applySearch({ ...searchDraft, area })}
                  aria-pressed={String(searchDraft.area).toLowerCase() === area.toLowerCase()}
                >
                  {area}
                </button>
              ))}
            </div>
            <button className="rail-arrow" type="button" aria-label="Show more Dhaka areas" onClick={() => scrollDiscoveryRail(areaRailRef, 1)}><ChevronRight size={17} /></button>
          </div>
        </div>
        <div className="category-strip-heading">
          <span><Compass size={17} /></span>
          <div><strong>Browse by category</strong><small>Scroll sideways to see every space and service type.</small></div>
          <div className="discovery-rail-actions" aria-label="Category scroll controls">
            <button className="rail-arrow" type="button" aria-label="Show previous categories" onClick={() => scrollDiscoveryRail(categoryRailRef, -1)}><ChevronLeft size={17} /></button>
            <button className="rail-arrow" type="button" aria-label="Show more categories" onClick={() => scrollDiscoveryRail(categoryRailRef, 1)}><ChevronRight size={17} /></button>
          </div>
        </div>
        <div className="photo-option-grid" ref={categoryRailRef} role="group" aria-label="Browse listings by category">
          {categoryOptions.map((option) => {
            const OptionIcon = option.icon;
            return (
              <button
              type="button"
              className={`photo-option ${
                option.value === "all"
                  ? (searchDraft.type === "all" && searchDraft.propertyType === "all" && searchDraft.serviceCategory === "all" ? "active" : "")
                  : (searchDraft.type === option.type && searchDraft.propertyType === option.propertyType && searchDraft.serviceCategory === option.serviceCategory ? "active" : "")
              }`}
              key={option.value}
              onClick={() => selectCategoryOption(option)}
              title={`Show ${option.label} listings`}
              aria-label={`Show ${option.label} listings`}
            >
                <span className="category-option-icon"><OptionIcon size={17} /></span>
                <span className="category-option-label">{option.label}</span>
              </button>
            );
          })}
        </div>

        <section className="metric-grid compact-metrics">
          <MetricCard icon={CircleDollarSign} tone="green" label="Average Price" value={money(summary.avgPrice)} />
          <MetricCard icon={Building2} tone="blue" label="Properties" value={number(summary.propertyCount)} />
          <MetricCard icon={Wrench} tone="teal" label="Services" value={number(summary.serviceCount)} />
          <MetricCard icon={MapPin} tone="amber" label="Areas" value={asList(summary.areas)} />
        </section>

        <ViewTabs
          label="Marketplace display"
          value={marketplaceView}
          onChange={setMarketplaceView}
          items={[
            { key: "results", label: "Listing results", icon: Store, count: meta.total || 0 },
            { key: "map", label: "Map view", icon: MapPinned }
          ]}
        />

        {marketplaceView === "map" ? (
          <section className="panel marketplace-map-panel">
            <div className="panel-head"><h3>{meta.searchLocation?.area ? `${meta.searchLocation.area} Map` : "Unified Map"}</h3><Pill tone="neutral">Properties + services</Pill></div>
            {/* Same map shows P = property, S = service and the searched-area circle. */}
            <ListingMap listings={listings} searchLocation={meta.searchLocation} />
          </section>
        ) : (
          <section className="panel listing-panel marketplace-results-panel">
            <div className="panel-head"><h3>Verified Matches</h3><Pill tone="neutral">Page {meta.page || 1}/{meta.totalPages || 1}</Pill></div>
            {listings.length ? listings.map((listing) => (
              <ListingRow key={listing._id} listing={listing} onOpen={openListing} onSave={saveFavorite} onBook={requestBooking} onMessage={startConversation} canEngage={role === "business"} />
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
          </section>
        )}
      </>
    );
  }

  function renderListings() {
    const profile = managementProfile;
    const inventory = profile.canCreate || role === "admin" ? inventoryListings : listings;
    return (
      <>
        <PageHeader eyebrow={profile.eyebrow} title={profile.title} meta={<Pill tone="neutral">{inventoryMeta.total || inventory.length} records</Pill>}>
          {profile.canCreate ? (
            <button className="action primary" type="button" onClick={() => setListingWorkspaceTab("create")}><Plus size={16} />New listing</button>
          ) : null}
        </PageHeader>
        {profile.canCreate ? (
          <ViewTabs
            label="Listing workspace sections"
            value={listingWorkspaceTab}
            onChange={setListingWorkspaceTab}
            items={[
              { key: "manage", label: "Manage inventory", icon: Store, count: inventory.length },
              { key: "create", label: profile.listingType === "service" ? "Create package" : "Create property", icon: Plus }
            ]}
          />
        ) : null}
        <section className="single-focus-layout">
          {profile.canCreate && listingWorkspaceTab === "create" ? (
            user?.verificationStatus === "verified" ? (
              <form className="panel form-panel" onSubmit={createListing}>
                <div className="panel-head"><h3>{profile.createTitle}</h3><Pill tone="success">Verified account</Pill></div>
                <input type="hidden" name="listingType" defaultValue={profile.listingType} />
                <AddressAutocomplete
                  idPrefix="create-listing-address"
                  label="Address / location"
                  resetSignal={createAddressResetKey}
                  onSelect={setSelectedAddress}
                  required
                />
                <input type="hidden" name="addressId" value={selectedAddress?.id || ""} readOnly />
                <label>Title<input name="title" placeholder={profile.listingType === "service" ? "e.g. Complete Office Setup" : "e.g. Banani Commercial Office"} minLength="4" required /></label>
                <div className="field-row">
                  <label>{profile.listingType === "service" ? "Service category" : "Space type"}<select name="category" defaultValue="" required><option value="" disabled>Choose a category</option>{profile.categories.map((category) => <option key={category}>{category}</option>)}</select></label>
                  <label>{profile.listingType === "service" ? "Starting price" : "Monthly rent"}<input name="price" type="number" min="1" placeholder="Enter amount in BDT" required /></label>
                </div>
                {profile.listingType === "property" ? (
                  <label>Size (sq ft)<input name="size" type="number" min="1" placeholder="Enter usable floor area" required /></label>
                ) : (
                  <input name="size" type="hidden" defaultValue="0" />
                )}
                <FacilitiesPicker
                  listingType={profile.listingType}
                  initialValues={profile.defaultFacilities}
                  resetSignal={createAddressResetKey}
                />
                <label>Coverage areas{profile.listingType === "property" ? " (optional)" : ""}<input name="coverageAreas" placeholder="e.g. Banani, Gulshan, Dhanmondi" required={profile.listingType === "service"} /></label>
                <PhotoUploadField
                  listingType={profile.listingType}
                  label={profile.listingType === "service" ? "Portfolio photos" : "Property photos"}
                  resetSignal={createPhotoResetKey}
                  onUploadingChange={setCreatePhotoUploading}
                />
                <label>{profile.listingType === "service" ? "Portfolio / service description" : "Description"}<textarea name="description" placeholder={profile.listingType === "service" ? "Describe the service scope, delivery and support." : "Describe access, layout and suitability for a business."} /></label>
                <button className="action primary" type="submit" disabled={busy || createPhotoUploading}><ListPlus size={16} />{createPhotoUploading ? "Uploading photos..." : `Save ${profile.listingType === "service" ? "Service" : "Property"}`}</button>
              </form>
            ) : (
              <div className="panel role-workflow-panel verification-gate">
                <IconFrame icon={ShieldCheck} tone="amber" />
                <h3>Verification required</h3>
                <p>Your {role === "property" ? "property owner" : "service provider"} account must be verified by an admin before you can create, edit, or delete listings.</p>
                <Pill tone="warning">Current status: {user?.verificationStatus || "pending"}</Pill>
              </div>
            )
          ) : null}
          {(!profile.canCreate || listingWorkspaceTab === "manage") ? (
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
                  editing={editingListingId === listing._id}
                  onEdit={(id) => setEditingListingId((current) => current === id ? "" : id)}
                  onCancelEdit={() => setEditingListingId("")}
                  onSaveEdit={updateListingDetails}
                  canManage={user?.verificationStatus === "verified"}
                />
              ) : (
                <ListingRow key={listing._id} listing={listing} onOpen={openListing} onSave={saveFavorite} onBook={requestBooking} onMessage={startConversation} canEngage={role === "business"} />
              )
            )) : <Empty title="No listings yet" />}
            </div>
          ) : null}
        </section>
      </>
    );
  }

  function renderPipeline() {
    const grouped = ["requested", "alternate-proposed", "accepted", "completed", "declined"].map((status) => ({
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
                    {booking.alternateAt ? <p>Alternate: {shortDate(booking.alternateAt)}</p> : null}
                    <span>{booking.requester?.name} to {booking.receiver?.name}</span>
                  </div>
                  {role !== "business" ? (
                    <div className="row-actions">
                      {["requested", "alternate-proposed"].includes(booking.status) ? (
                        <>
                          <button type="button" className="icon-button" title="Accept" onClick={() => respondBooking(booking._id, "accepted")}><CheckCircle2 size={16} /></button>
                          <button type="button" className="icon-button" title="Propose alternate time" onClick={() => setAlternateBookingId(booking._id)}><CalendarCheck size={16} /></button>
                          <button type="button" className="icon-button danger" title="Decline" onClick={() => respondBooking(booking._id, "declined")}><XCircle size={16} /></button>
                        </>
                      ) : null}
                      {booking.status === "accepted" ? (
                        <button type="button" className="icon-button" title="Complete" onClick={() => respondBooking(booking._id, "completed")}><ClipboardCheck size={16} /></button>
                      ) : null}
                    </div>
                  ) : null}
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
        onBack={() => setSelectedConversationId("")}
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
    const ownsListing = Boolean(
      listing && user && String(listing.owner?._id || listing.owner || "") === String(user._id)
    );
    const canManageListingMedia = ownsListing && (role === "property" || role === "service");
    const reviews = detail?.listing?.reviews || [];
    const reviewSummary = detail?.reviewSummary || {};
    const reviewEligibility = detail?.reviewEligibility;
    const averageRating = Number(reviewSummary.averageRating ?? listing?.rating ?? 0);
    const reviewCount = Number(reviewSummary.reviewCount ?? listing?.reviewCount ?? reviews.length ?? 0);
    const distribution = reviewSummary.distribution || {};
    const profileRole = accountRoleLabel(user?.role);
    const profileVerification = user?.verificationStatus || (role === "admin" ? "verified" : "pending");
    const unreadCount = notifications.filter((item) => !item.read).length;
    const profileStatsByRole = {
      business: [
        { icon: Heart, tone: "rose", label: "Saved", value: favorites.length, note: "shortlisted places" },
        { icon: CalendarCheck, tone: "amber", label: "Bookings", value: bookings.length, note: "visits and services" },
        { icon: MessageSquareText, tone: "blue", label: "Conversations", value: conversations.length, note: "owners and providers" }
      ],
      property: [
        { icon: Building2, tone: "blue", label: "Properties", value: inventoryListings.length, note: "managed listings" },
        { icon: CalendarCheck, tone: "amber", label: "Visit requests", value: bookings.length, note: "business inquiries" },
        { icon: Star, tone: "green", label: "Rating", value: Number(user?.averageRating || 0).toFixed(1), note: `${user?.reviewCount || 0} reviews` }
      ],
      service: [
        { icon: Wrench, tone: "teal", label: "Packages", value: inventoryListings.length, note: "published services" },
        { icon: CalendarCheck, tone: "amber", label: "Client requests", value: bookings.length, note: "service bookings" },
        { icon: Star, tone: "blue", label: "Rating", value: Number(user?.averageRating || 0).toFixed(1), note: `${user?.reviewCount || 0} reviews` }
      ],
      admin: [
        { icon: UsersRound, tone: "blue", label: "Pending users", value: admin.pendingUsers?.length || 0, note: "verification queue" },
        { icon: Store, tone: "green", label: "Inventory", value: admin.inventorySummary?.total || 0, note: "all listings" },
        { icon: Flag, tone: "rose", label: "Open reports", value: admin.reports?.length || 0, note: "moderation queue" }
      ]
    };
    const profileStats = profileStatsByRole[role] || profileStatsByRole.business;
    const isProfileView = view === "profile" || workspaceTab === "profile";
    const isProfileSettings = isProfileView && profileSection === "settings";
    const recentProfileActivity = notifications.slice(0, 4);
    const roleProfileFields = role === "business"
      ? [user?.businessType, user?.preferredArea, Number(user?.budgetMax) > 0]
      : role === "service"
        ? [user?.tradeLicense, user?.coverageAreas?.length, user?.verificationStatus === "verified"]
        : role === "property"
          ? [user?.tradeLicense, user?.nid, user?.verificationStatus === "verified"]
          : [user?.status === "active", user?.verificationStatus === "verified"];
    const profileCompletionFields = [user?.name, user?.phone, user?.email, user?.profilePhotoUrl, ...roleProfileFields];
    const profileCompletion = Math.round((profileCompletionFields.filter(Boolean).length / profileCompletionFields.length) * 100);
    const membershipDate = user?.createdAt
      ? new Date(user.createdAt).toLocaleDateString([], { month: "short", year: "numeric" })
      : "Current member";
    return (
      <>
        <PageHeader
          eyebrow={isProfileView ? (isProfileSettings ? "Preferences & security" : "Private account") : "Workspace"}
          title={isProfileView ? (isProfileSettings ? "Account Settings" : "My Profile") : (listing?.title || "Client Workspace")}
          meta={isProfileView ? <Status value={profileVerification} /> : (listing && <Status value={listing.status} />)}
        />
        {isProfileView ? (
          <div className="profile-context-bar">
            <div><UserRound size={17} /><span><strong>Account center</strong><small>Private details and role access</small></span></div>
            <div className="profile-section-switcher" role="tablist" aria-label="Account center sections">
              <button className={profileSection === "overview" ? "active" : ""} type="button" role="tab" aria-selected={profileSection === "overview"} onClick={() => setProfileSection("overview")}><UserRound size={15} />Profile overview</button>
              <button className={profileSection === "settings" ? "active" : ""} type="button" role="tab" aria-selected={profileSection === "settings"} onClick={() => setProfileSection("settings")}><Settings size={15} />Account settings</button>
            </div>
            <button className="action secondary small" type="button" onClick={() => {
              setWorkspaceTab("overview");
              navigateToView(role === "admin" ? "admin" : "workspace");
            }}><ChevronLeft size={15} />{role === "admin" ? "Back to Admin" : "Back to workspace"}</button>
          </div>
        ) : (
          <ViewTabs
            label="Workspace sections"
            value={workspaceTab}
            onChange={setWorkspaceTab}
            items={[
              { key: "overview", label: "Overview", icon: Store },
              { key: "nearby", label: "Nearby & services", icon: MapPinned },
              { key: "reviews", label: "Reviews", icon: Star, count: reviewCount },
              { key: "profile", label: "My profile", icon: UserRound },
              ...(role === "business" ? [{ key: "favorites", label: "Saved", icon: Heart, count: favorites.length }] : [])
            ]}
          />
        )}
        <section className="workspace-grid workspace-focus-grid">
          {workspaceTab === "overview" ? (
            <div className="panel detail-panel">
            {listing ? (
              <>
                <div className="gallery-grid">
                  {(listing.photos?.length ? listing.photos : [primaryPhoto(listing)]).map((photo, index) => (
                    <figure className="gallery-tile" key={`${photo}-${index}`}>
                      <PhotoImage listing={listing} photo={photo} className="gallery-photo" alt={`${listing.title} - photo ${index + 1}`} />
                    </figure>
                  ))}
                </div>
                {canManageListingMedia ? (
                  <div className="gallery-manage">
                    <p className="editor-help">You own this listing. Photos can be removed or replaced in the listing editor.</p>
                    <button className="action secondary small" type="button" onClick={() => manageListingMedia(listing._id)}>
                      <Settings size={15} />Manage photos &amp; details
                    </button>
                  </div>
                ) : null}
                <p className="detail-copy">{listing.description}</p>
                <div className="metric-grid compact-metrics">
                  <MetricCard icon={CircleDollarSign} tone="green" label="Price" value={money(listing.price)} />
                  <MetricCard icon={Star} tone="amber" label="Rating" value={`${Number(listing.rating || 0).toFixed(1)}/5`} />
                  <MetricCard icon={MapPin} tone="blue" label="Distance" value={listing.metricLabel} />
                  <MetricCard icon={Store} tone="teal" label="Facilities" value={asList(listing.facilities)} />
                </div>
                <div className="detail-location-map">
                  <div className="panel-head"><h3>Listing Location</h3><Pill tone="neutral">Interactive map</Pill></div>
                  {/* Member 1 - Module 3: reuse the same Leaflet map for a single listing. */}
                  <ListingMap listings={[listing]} />
                </div>
                <div className="owner-line">
                  <IconFrame icon={UserRound} tone="blue" />
                  <div>
                    <strong>{listing.owner?.name || "Owner"}</strong>
                    <p>{listing.owner?.role || listing.listingType} - {listing.owner?.verificationStatus || "verified"}</p>
                    <ProviderRatingLine profile={listing.owner} />
                  </div>
                  {role !== "admin" && String(listing.owner?._id || "") !== String(user?._id || "") ? (
                    <div className="row-actions">
                      {role === "business" ? (
                        <>
                          {listing.status === "Available" ? (
                            <button type="button" className="action primary small" onClick={() => requestBooking(listing._id)}>
                              <CalendarCheck size={15} />{listing.listingType === "service" ? "Book service" : "Request visit"}
                            </button>
                          ) : null}
                          <button type="button" className="action secondary small" onClick={() => startConversation(listing._id)}><MessageSquareText size={15} />Message</button>
                        </>
                      ) : null}
                      <button type="button" className="action secondary small" onClick={() => openReportForm("listing", listing._id, listing.title)}><Flag size={15} />Report {listing.listingType}</button>
                      {listing.owner?._id ? (
                        <button type="button" className="action secondary small" onClick={() => openReportForm("user", listing.owner._id, listing.owner.name || "listing owner")}><Flag size={15} />Report user</button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {role === "business" && listing.listingType === "property" ? (
                  <section className="detail-setup-section" aria-labelledby="setup-suggestions-title">
                    <div className="panel-head">
                      <div>
                        <span className="eyebrow">Smart setup</span>
                        <h3 id="setup-suggestions-title">Suggested Service Providers</h3>
                      </div>
                      <Pill tone="neutral">{detail?.setupSuggestions?.length || 0}</Pill>
                    </div>
                    <p className="panel-intro">Verified providers matched from stored service category and coverage area data.</p>
                    <div className="setup-suggestion-list">
                      {(detail?.setupSuggestions || []).map((item) => (
                        <SetupSuggestionCard key={item._id} listing={item} onOpen={openListing} onBook={requestBooking} onMessage={startConversation} />
                      ))}
                      {!(detail?.setupSuggestions || []).length ? <Empty title="No verified setup providers cover this area yet" /> : null}
                    </div>
                  </section>
                ) : null}
              </>
            ) : <Empty title="No listing selected" />}
            </div>
          ) : null}
          {workspaceTab === "nearby" ? (
            <>
              <div className="panel">
            <div className="panel-head">
              {/* Member 2 - Module 3: live Foursquare data, with demo fallback from the backend. */}
              <h3>Nearby Places</h3>
              <Pill tone={detail?.nearbySource === "foursquare" ? "success" : "warning"}>
                {detail?.nearbySource === "foursquare" ? "Live nearby places" : "Local area guide"}
              </Pill>
            </div>
            {detail?.nearbyWarning ? <p className="nearby-warning">Live nearby information is temporarily unavailable, so saved local recommendations are shown.</p> : null}
            <div className="compact-list">
              {(detail?.nearbyPlaces || []).map((place) => (
                <div className="simple-row" key={place.id}>
                  <IconFrame icon={MapPin} tone="green" />
                  <div>
                    <strong>{place.category}: {place.name}</strong>
                    <p>
                      {place.walkingMinutes ? `${place.walkingMinutes} min walk` : place.distanceKm !== null && place.distanceKm !== undefined ? `${place.distanceKm} km away` : "Nearby"}
                      {place.address ? ` - ${place.address}` : ""}
                    </p>
                  </div>
                </div>
              ))}
              {!(detail?.nearbyPlaces || []).length ? <Empty title="No nearby places found" /> : null}
            </div>
              </div>
            </>
          ) : null}
          {workspaceTab === "reviews" ? (
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
          ) : null}
          {isProfileView ? (
            <div className="profile-workspace">
              <section className="panel profile-hero" aria-labelledby="profile-name">
                <div className="profile-photo-column">
                  <div className={`profile-avatar ${role}`}>
                    {user?.profilePhotoUrl
                      ? <img src={user.profilePhotoUrl} alt={`${user?.name || "User"} profile`} />
                      : <span aria-hidden="true">{accountInitials(user?.name)}</span>}
                  </div>
                  <label className="profile-photo-button" title="Upload profile photo">
                    <Camera size={15} /><span>{user?.profilePhotoUrl ? "Change photo" : "Add photo"}</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={changeProfilePhoto} disabled={profilePhotoUploading} />
                  </label>
                  {profilePhotoUploading ? <span className="profile-photo-progress">Uploading...</span> : null}
                </div>
                <div className="profile-identity">
                  <span className="eyebrow">{profileRole}</span>
                  <h3 id="profile-name">{user?.name || "OfficeKhoj member"}</h3>
                  <p>Your private account, role access and workspace preferences.</p>
                  {profilePhotoError ? <p className="profile-photo-error" role="alert">{profilePhotoError}</p> : null}
                  <div className="profile-badges">
                    <Status value={profileVerification} />
                    <Pill tone={user?.status === "suspended" ? "danger" : "success"}>{user?.status || "active"}</Pill>
                    {isProviderProfile(user) ? <ProviderRatingLine profile={user} /> : null}
                  </div>
                </div>
                <div className="profile-summary-panel">
                  <div className="profile-completion-head"><span>Profile completion</span><strong>{profileCompletion}%</strong></div>
                  <div className="profile-completion-track" aria-label={`Profile ${profileCompletion}% complete`}><i style={{ width: `${profileCompletion}%` }} /></div>
                  <div className="profile-summary-facts">
                    <span><ShieldCheck size={14} />Private contact details</span>
                    <span><CalendarCheck size={14} />Member since {membershipDate}</span>
                  </div>
                </div>
              </section>

              {!isProfileSettings ? (
                <section className="profile-stat-grid" aria-label="Account activity">
                  {profileStats.map((metric) => <MetricCard key={metric.label} {...metric} />)}
                </section>
              ) : null}

              <div className={`profile-content-grid ${isProfileSettings ? "settings-only" : "overview-only"}`}>
                {isProfileSettings ? (
                <form className="panel profile-form-card" onSubmit={updateProfile} key={user?._id || "profile-form"}>
                  <div className="panel-head">
                    <div><span className="eyebrow">Account details</span><h3>Personal information</h3></div>
                    <Pill tone="neutral">Only you can see this</Pill>
                  </div>
                  <div className="field-row">
                    <label>Display name<input name="name" defaultValue={user?.name || ""} minLength="2" maxLength="100" required /></label>
                    <label>Phone number<input name="phone" type="tel" defaultValue={user?.phone || ""} minLength="7" maxLength="30" required /></label>
                  </div>
                  <label>
                    Sign-in email
                    <span className="private-input protected">
                      <Mail size={17} />
                      <input type="text" value={maskedEmail(user?.email)} readOnly aria-describedby="private-email-note" aria-label="Protected sign-in email" />
                      <span className="private-field-status" aria-hidden="true"><ShieldCheck size={15} />Protected</span>
                    </span>
                  </label>
                  <p className="private-field-note" id="private-email-note"><ShieldCheck size={15} />Your complete sign-in address is stored securely for login and notifications and is not displayed on this page or any public profile.</p>

                  {role === "business" ? <ProfilePreferences user={user} /> : null}

                  {role === "service" ? (
                    <fieldset className="profile-fieldset">
                      <legend>Service coverage</legend>
                      <label>Coverage areas<input name="coverageAreas" defaultValue={(user?.coverageAreas || []).join(", ")} placeholder="Banani, Gulshan, Dhanmondi" required /></label>
                      <p className="field-assist">Separate areas with commas. These locations help match your services to Business Owners.</p>
                    </fieldset>
                  ) : null}

                  <div className="profile-form-actions">
                    <span><ShieldCheck size={16} />Your role and verification status can only be changed by an Admin.</span>
                    <button className="action primary" type="submit" disabled={busy}><Bookmark size={16} />{busy ? "Saving..." : "Save profile"}</button>
                  </div>
                </form>
                ) : null}

                {!isProfileSettings ? (
                <aside className="profile-side-stack">
                  <section className="panel profile-access-card">
                    <div className="panel-head"><h3>Role access</h3><IconFrame icon={ShieldCheck} tone="green" /></div>
                    <div className="profile-role-line"><strong>{profileRole}</strong><Status value={profileVerification} /></div>
                    <p>{role === "business" ? "Browse, save, message, book and review verified listings." : role === "property" ? "Publish properties and manage business visit requests after verification." : role === "service" ? "Publish service packages and manage client bookings after verification." : "Verify accounts, moderate inventory, resolve reports and manage platform operations."}</p>
                    {user?.tradeLicense ? <div className="profile-fact"><span>Trade license</span><strong>{user.tradeLicense}</strong></div> : null}
                    {user?.nid ? <div className="profile-fact"><span>Identity record</span><strong>Provided and protected</strong></div> : null}
                    {role === "service" ? <div className="profile-fact"><span>Coverage</span><strong>{asList(user?.coverageAreas)}</strong></div> : null}
                  </section>

                  <section className="panel profile-actions-card">
                    <div className="panel-head"><h3>Quick actions</h3><Pill tone="neutral">{unreadCount} unread</Pill></div>
                    <div className="profile-action-list">
                      {role === "business" ? <button type="button" onClick={() => navigateToView("marketplace")}><Search size={17} /><span><strong>Find a workspace</strong><small>Browse verified matches</small></span><ChevronRight size={16} /></button> : null}
                      {role === "property" ? <button type="button" onClick={() => navigateToView("listings")}><Building2 size={17} /><span><strong>Manage properties</strong><small>Update spaces and availability</small></span><ChevronRight size={16} /></button> : null}
                      {role === "service" ? <button type="button" onClick={() => navigateToView("listings")}><Wrench size={17} /><span><strong>Manage service packages</strong><small>Update coverage and availability</small></span><ChevronRight size={16} /></button> : null}
                      {role === "admin" ? <button type="button" onClick={() => { setAdminTab("queue"); navigateToView("admin"); }}><ShieldCheck size={17} /><span><strong>Open moderation queue</strong><small>Verify users and review reports</small></span><ChevronRight size={16} /></button> : null}
                      {role !== "admin" ? <button type="button" onClick={() => navigateToView("pipeline")}><CalendarCheck size={17} /><span><strong>{role === "business" ? "My bookings" : "Booking requests"}</strong><small>Track every status update</small></span><ChevronRight size={16} /></button> : null}
                      <button type="button" onClick={() => navigateToView("notifications")}><Bell size={17} /><span><strong>Notifications</strong><small>{unreadCount ? `${unreadCount} update${unreadCount === 1 ? "" : "s"} need${unreadCount === 1 ? "s" : ""} attention` : "You are all caught up"}</small></span><ChevronRight size={16} /></button>
                    </div>
                  </section>

                  <section className="panel profile-activity-card">
                    <div className="panel-head"><h3>Recent activity</h3><IconFrame icon={Activity} tone="blue" /></div>
                    {recentProfileActivity.length ? (
                      <div className="profile-activity-list">
                        {recentProfileActivity.map((item) => (
                          <button type="button" key={item._id} onClick={() => viewNotification(item)}>
                            <span className={`profile-activity-dot ${item.read ? "read" : ""}`} />
                            <span><strong>{item.title}</strong><small>{shortDate(item.createdAt)}</small></span>
                            <ChevronRight size={15} />
                          </button>
                        ))}
                      </div>
                    ) : <Empty title="No recent account activity" />}
                  </section>
                </aside>
                ) : null}
              </div>
            </div>
          ) : null}
          {role === "business" && workspaceTab === "favorites" ? (
            <div className="panel listing-panel">
              <div className="panel-head"><h3>Favorites</h3><Pill tone="neutral">{favorites.length}</Pill></div>
              {favorites.map((item) => <ListingRow key={item._id} listing={item} onOpen={openListing} onSave={saveFavorite} onBook={requestBooking} onMessage={startConversation} canEngage />)}
            </div>
          ) : null}
        </section>
      </>
    );
  }

  function renderOperations() {
    return (
      <>
        <PageHeader eyebrow="Operations" title="Platform Activity" meta={<Pill tone="success">Systems online</Pill>} />
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
            <div className="panel-head"><h3>Platform Records</h3><Pill tone="neutral">{operations?.database?.collections || 0} groups</Pill></div>
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
    const openTicketCount = visibleTickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status)).length;
    return (
      <>
        <PageHeader eyebrow="Support" title={role === "admin" ? "Support Operations" : "Ticket Desk"} meta={<Pill tone="warning">{openTicketCount} open</Pill>}>
          <a className="action secondary" href={`tel:${customerServicePhone}`}><PhoneCall size={16} />{customerServicePhone}</a>
        </PageHeader>
        <section className={role === "admin" ? "single-focus-layout" : "split-layout"}>
          {role !== "admin" ? <form className="panel form-panel" onSubmit={createTicket}>
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
          </form> : null}
          <div className="panel">
            <div className="panel-head"><h3>{role === "admin" ? "Support Queue" : "My Tickets"}</h3><Pill tone="neutral">{visibleTickets.length}</Pill></div>
            <div className="ticket-list">
              {visibleTickets.map((ticket) => (
                <article className="ticket-row" key={ticket._id}>
                  <IconFrame icon={LifeBuoy} tone={ticket.priority === "high" ? "rose" : "teal"} />
                  <div>
                    <div className="row-line"><h4>{ticket.subject}</h4><Status value={ticket.status} /></div>
                    <p>{ticket.requester?.name} - {ticket.category} - {ticket.priority}</p>
                  </div>
                  {role === "admin" ? <div className="row-actions">
                    <button className="action secondary small" type="button" onClick={() => updateTicket(ticket._id, "in-progress")}>Work</button>
                    <button className="action primary small" type="button" onClick={() => updateTicket(ticket._id, "resolved")}>Resolve</button>
                  </div> : null}
                </article>
              ))}
              {visibleTickets.length === 0 ? <Empty title={role === "admin" ? "No support tickets are waiting." : "You have not opened a support ticket yet."} /> : null}
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
        <ViewTabs
          label="Admin sections"
          value={adminTab}
          onChange={setAdminTab}
          items={[
            { key: "queue", label: "Moderation queue", icon: ShieldCheck, count: (admin.pendingUsers?.length || 0) + (admin.pendingListings?.length || 0) + (admin.reports?.length || 0) },
            { key: "inventory", label: "Listing inventory", icon: Store, count: admin.inventory?.length || 0 },
            { key: "settings", label: "Platform settings", icon: Settings, count: operations?.settings?.length || 0 }
          ]}
        />
        <section className="admin-grid">
          {adminTab === "queue" ? (
            <>
              <div className="panel">
            <div className="panel-head"><h3>Pending Users</h3><Pill tone="neutral">{admin.pendingUsers?.length || 0}</Pill></div>
            {(admin.pendingUsers || []).map((pending) => (
              <div className="admin-row" key={pending._id}>
                <IconFrame icon={UserRound} tone="amber" />
                <div><strong>{pending.name}</strong><p>{pending.role} - {pending.tradeLicense || pending.nid || "No document"}</p></div>
                <div className="row-actions">
                  <button className="action primary small" type="button" onClick={() => updateUserVerification(pending._id, "verified")}><CheckCircle2 size={15} />Verify</button>
                  <button className="action secondary small danger-action" type="button" onClick={() => updateUserVerification(pending._id, "rejected")}><XCircle size={15} />Reject</button>
                </div>
              </div>
            ))}
            {(admin.pendingUsers || []).length === 0 ? <Empty title="No pending users to verify." /> : null}
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
            {(admin.pendingListings || []).length === 0 ? <Empty title="No pending listings to review." /> : null}
              </div>
              <div className="panel">
            <div className="panel-head"><h3>Reports</h3><Pill tone="neutral">{admin.reports?.length || 0}</Pill></div>
            {(admin.reports || []).map((report) => (
              <div className="admin-row" key={report._id}>
                <IconFrame icon={Activity} tone="rose" />
                <div>
                  <strong>{report.target?.title || report.target?.name || `Reported ${report.targetType}`}</strong>
                  <p>{report.reason} · by {report.reporter?.name || "Legacy report"}</p>
                </div>
                <div className="row-actions">
                  <Status value={report.status} />
                  <button className="action secondary small" type="button" onClick={() => setReportReviewId(report._id)}>Review</button>
                </div>
              </div>
            ))}
            {(admin.reports || []).length === 0 ? <Empty title="No open reports." /> : null}
              </div>
            </>
          ) : null}
          {adminTab === "inventory" ? (
            <div className="panel settings-panel">
              <div className="panel-head">
                <div>
                  <h3>Platform Listing Inventory</h3>
                  <p>All property and service listings, including unavailable and unverified records.</p>
                </div>
                <Pill tone="neutral">{admin.inventorySummary?.total || 0} total</Pill>
              </div>
              <div className="metric-grid compact-metrics">
                <MetricCard icon={Building2} tone="blue" label="Properties" value={number(admin.inventorySummary?.property)} />
                <MetricCard icon={Wrench} tone="teal" label="Services" value={number(admin.inventorySummary?.service)} />
                <MetricCard icon={ShieldCheck} tone="amber" label="Pending" value={number(admin.inventorySummary?.pending)} />
                <MetricCard icon={XCircle} tone="rose" label="Unavailable" value={number(admin.inventorySummary?.unavailable)} />
              </div>
              <div className="management-list">
                {(admin.inventory || []).map((listing) => (
                  <article className="management-row" key={listing._id}>
                    <PhotoImage listing={listing} className="listing-thumb" />
                    <div>
                      <div className="row-line">
                        <h4>{listing.title}</h4>
                        <Status value={listing.verificationStatus} />
                      </div>
                      <p>{listing.listingType} · {listing.owner?.name || "Unknown owner"} · {listing.area}</p>
                      <div className="micro-row"><span>{listing.category}</span><Status value={listing.status} /></div>
                    </div>
                    <div className="row-actions">
                      <button className="action secondary small" type="button" onClick={() => openListing(listing._id)}>Open</button>
                      <button className="action primary small danger-action" type="button" onClick={() => deleteListing(listing._id)}><XCircle size={15} />Remove</button>
                    </div>
                  </article>
                ))}
                {(admin.inventory || []).length === 0 ? <Empty title="No listings are currently stored." /> : null}
              </div>
            </div>
          ) : null}
          {adminTab === "settings" ? (
            <div className="panel settings-panel">
            <div className="panel-head"><h3>Settings</h3><Pill tone="neutral">{operations?.settings?.length || 0}</Pill></div>
            {(operations?.settings || []).map((setting) => (
              <form className="setting-row" key={setting._id} onSubmit={updateSetting}>
                <input type="hidden" name="key" value={setting.key} />
                <input type="hidden" name="valueType" value={setting.valueType} />
                <div><strong>{setting.label}</strong><p>{settingDescriptions[setting.key] || "Platform preference"}</p></div>
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
          ) : null}
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
    profile: renderWorkspace,
    operations: renderOperations,
    support: renderSupport,
    admin: renderAdmin
  };

  if (!authReady) {
    return (
      <main className="auth-loading" aria-live="polite">
        <Building2 size={30} />
        <strong>Restoring secure session...</strong>
      </main>
    );
  }

  if (!user) {
    return <AuthPage busy={busy} error={authError} onClearError={() => setAuthError("")} onLogin={login} onRegister={register} />;
  }

  return (
    <>
      <header className="app-topbar">
        <div className="brand">
          <span className="brand-mark"><Building2 size={23} /></span>
          <div><h1>OfficeKhoj</h1><p>Bangladesh</p></div>
        </div>
        <button
          className="navigation-toggle"
          type="button"
          aria-label={mobileMenuOpen ? "Close navigation" : sidebarCollapsed ? "Expand navigation" : "Toggle navigation"}
          title={mobileMenuOpen ? "Close menu" : sidebarCollapsed ? "Expand menu" : "Collapse menu"}
          aria-expanded={mobileMenuOpen || !sidebarCollapsed}
          onClick={() => {
            if (window.matchMedia("(max-width: 1020px)").matches) setMobileMenuOpen((current) => !current);
            else {
              setSidebarCollapsed((current) => !current);
            }
          }}
        >
          {mobileMenuOpen ? <XCircle size={19} /> : sidebarCollapsed ? <PanelLeft size={19} /> : <PanelLeftClose size={19} />}
          <span className="navigation-toggle-label">{sidebarCollapsed ? "Show menu" : "Hide menu"}</span>
        </button>
        <div className="topbar-context">
          <span>OfficeKhoj BD</span>
          <strong>{currentNavItem?.label || "Dashboard"}</strong>
        </div>
        <div className="role-switcher auth-session-actions">
          <button className="guide-trigger" type="button" onClick={() => { setGuideStep(0); setGuideOpen(true); }} title={`How to use the ${currentRole.label} workspace`}><Compass size={15} /><span>Guide</span></button>
        </div>
        <div className="account-menu-shell" ref={accountMenuRef}>
          <button
            className="account-chip"
            type="button"
            title="Open account menu"
            aria-label="Open account menu"
            aria-haspopup="menu"
            aria-expanded={accountMenuOpen}
            onClick={() => setAccountMenuOpen((current) => !current)}
          >
            <span className="account-avatar" aria-hidden="true">
              {user?.profilePhotoUrl ? <img src={user.profilePhotoUrl} alt="" /> : accountInitials(user?.name)}
              <i className={health?.ok ? "live-dot" : "live-dot muted"} />
            </span>
            <div>
              <strong>{user?.name || "Connecting"}</strong>
              <p>{accountRoleLabel(user?.role)}</p>
            </div>
            <ChevronDown className="account-menu-chevron" size={15} />
          </button>
          {accountMenuOpen ? (
            <div className="account-menu-popover" role="menu" aria-label="Account options">
              <div className="account-menu-profile">
                <span className="account-menu-large-avatar" aria-hidden="true">
                  {user?.profilePhotoUrl ? <img src={user.profilePhotoUrl} alt="" /> : accountInitials(user?.name)}
                </span>
                <div><strong>{user?.name}</strong><span>Private account</span><Pill tone="success">{accountRoleLabel(user?.role)}</Pill></div>
              </div>
              <div className="account-menu-items">
                <button type="button" role="menuitem" onClick={() => { setProfileSection("overview"); navigateToView("profile"); }}><UserRound size={17} /><span><strong>My profile</strong><small>Photo, details and activity</small></span><ChevronRight size={15} /></button>
                <button type="button" role="menuitem" onClick={() => { setProfileSection("settings"); navigateToView("profile"); }}><Settings size={17} /><span><strong>Account settings</strong><small>Preferences and private information</small></span><ChevronRight size={15} /></button>
                <button type="button" role="menuitem" onClick={() => navigateToView("notifications")}><Bell size={17} /><span><strong>Notifications</strong><small>{notifications.filter((item) => !item.read).length} unread updates</small></span><ChevronRight size={15} /></button>
                <button type="button" role="menuitem" onClick={() => navigateToView("support")}><LifeBuoy size={17} /><span><strong>Help & support</strong><small>Get account or platform help</small></span><ChevronRight size={15} /></button>
              </div>
              <button className="account-menu-logout" type="button" role="menuitem" onClick={logout}><LogOut size={17} /><span>Sign out</span></button>
            </div>
          ) : null}
        </div>
      </header>

      <main className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        {mobileMenuOpen ? <button className="mobile-nav-backdrop" type="button" aria-label="Close navigation" onClick={() => setMobileMenuOpen(false)} /> : null}
        <aside
          className={`sidebar ${mobileMenuOpen ? "open" : ""}`}
          aria-label={`${currentRole.label} navigation`}
        >
          <button
            className="sidebar-toggle"
            type="button"
            aria-label={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
            title={sidebarCollapsed ? "Show menu" : "Hide menu"}
            aria-expanded={!sidebarCollapsed}
            onClick={() => setSidebarCollapsed((current) => !current)}
          >
            {sidebarCollapsed ? <PanelLeft size={17} /> : <PanelLeftClose size={17} />}
            <span className="nav-label">{sidebarCollapsed ? "Show menu" : "Hide menu"}</span>
          </button>
          <div className="sidebar-heading">
            <span className="sidebar-label">{currentRole.label} menu</span>
            <button className="sidebar-close" type="button" aria-label="Close navigation" onClick={() => setMobileMenuOpen(false)}><XCircle size={18} /></button>
          </div>
          {navItems.filter(({ key, showInSidebar }) => showInSidebar !== false && canAccessView(role, key)).map(({ key, label, icon: Icon }) => {
            const badge = key === "notifications"
              ? notifications.filter((item) => !item.read).length
              : key === "messages"
                ? conversations.reduce((total, conversation) => total + (conversation.messages || []).filter((message) => (
                    String(message.sender?._id || message.sender) !== String(user?._id) &&
                    !(message.readBy || []).some((reader) => String(reader?._id || reader) === String(user?._id))
                  )).length, 0)
                : 0;
            return (
              <button
                type="button"
                className={`nav-item ${view === key ? "active" : ""}`}
                key={key}
                onClick={() => navigateToView(key)}
                title={sidebarCollapsed ? label : undefined}
                aria-label={badge > 0 ? `${label}, ${badge} unread` : label}
              >
                <Icon size={17} />
                <span className="nav-label">{label}</span>
                {badge > 0 && <strong className="nav-badge">{badge}</strong>}
              </button>
            );
          })}
        </aside>

        <section className="content">
          {dashboard && operations ? (views[view] || views[roleLandingViews[role]])() : <LoadingWorkspace />}
        </section>
      </main>

      {busy && <div className="busy-line" />}
      {toast && <div className="toast">{toast}</div>}
      {guideOpen && (() => {
        const steps = roleGuides[role] || roleGuides.business;
        const step = steps[guideStep];
        const StepIcon = step.icon;
        return (
          <div className="guide-backdrop" role="presentation" onClick={() => setGuideOpen(false)}>
            <section className="product-guide" role="dialog" aria-modal="true" aria-labelledby="product-guide-title" onClick={(event) => event.stopPropagation()}>
              <div className="guide-visual" aria-hidden="true">
                <div className="guide-orbit guide-orbit-one" />
                <div className="guide-orbit guide-orbit-two" />
                <span><StepIcon size={34} /></span>
              </div>
              <div className="guide-copy">
                <div className="guide-topline">
                  <span className="eyebrow">{currentRole.label} guide</span>
                  <button className="icon-button" type="button" aria-label="Close guide" onClick={() => setGuideOpen(false)}><XCircle size={18} /></button>
                </div>
                <p className="guide-progress-label">Step {guideStep + 1} of {steps.length}</p>
                <h2 id="product-guide-title">{step.title}</h2>
                <p>{step.text}</p>
                <div className="guide-progress" aria-hidden="true">
                  {steps.map((item, index) => <i className={index <= guideStep ? "active" : ""} key={item.title} />)}
                </div>
                <div className="guide-step-list" aria-label="Guide steps">
                  {steps.map((item, index) => {
                    const ItemIcon = item.icon;
                    return <button className={index === guideStep ? "active" : ""} type="button" onClick={() => setGuideStep(index)} key={item.title}><ItemIcon size={16} /><span>{item.title}</span></button>;
                  })}
                </div>
                <div className="guide-actions">
                  <button className="action secondary" type="button" disabled={guideStep === 0} onClick={() => setGuideStep((current) => Math.max(0, current - 1))}>Back</button>
                  <button className="action secondary" type="button" onClick={() => { navigateToView(step.view); setGuideOpen(false); }}>{step.action}</button>
                  {guideStep < steps.length - 1 ? (
                    <button className="action primary" type="button" onClick={() => setGuideStep((current) => Math.min(steps.length - 1, current + 1))}>Next<ChevronRight size={16} /></button>
                  ) : (
                    <button className="action primary" type="button" onClick={() => setGuideOpen(false)}><CheckCircle2 size={16} />Done</button>
                  )}
                </div>
              </div>
            </section>
          </div>
        );
      })()}
      {reportTarget && (
        <div className="modal-backdrop" role="presentation" onClick={() => setReportTarget(null)}>
          <div className="confirm-modal booking-modal" role="dialog" aria-modal="true" aria-labelledby="report-target-title" onClick={(event) => event.stopPropagation()}>
            <IconFrame icon={Flag} tone="rose" />
            <div>
              <span className="eyebrow">Platform trust</span>
              <h3 id="report-target-title">Report {reportTarget.targetLabel}</h3>
              <p>Tell the Admin team what appears fraudulent, misleading, unsafe, or low quality.</p>
            </div>
            <form className="booking-request-form" onSubmit={submitReport}>
              <label>Reason<textarea name="reason" minLength="5" maxLength="500" rows="4" placeholder="Describe the issue clearly for the moderation team." required /></label>
              <div className="modal-actions">
                <button className="action secondary" type="button" onClick={() => setReportTarget(null)}>Cancel</button>
                <button className="action primary danger-action" type="submit" disabled={busy}><Flag size={16} />Submit report</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {selectedAdminReport && (
        <div className="modal-backdrop" role="presentation" onClick={() => setReportReviewId("")}>
          <div className="confirm-modal booking-modal" role="dialog" aria-modal="true" aria-labelledby="review-report-title" onClick={(event) => event.stopPropagation()}>
            <IconFrame icon={ShieldCheck} tone="amber" />
            <div>
              <span className="eyebrow">Moderation report</span>
              <h3 id="review-report-title">Review reported {selectedAdminReport.targetType}</h3>
              <p>{selectedAdminReport.reason}</p>
            </div>
            <div className="booking-summary">
              <span>Reporter: {selectedAdminReport.reporter?.name || "Legacy report"}</span>
              <strong>{selectedAdminReport.target?.title || selectedAdminReport.target?.name || "Target no longer exists"}</strong>
              {selectedAdminReport.target?.listingType ? <span>{selectedAdminReport.target.listingType} · {selectedAdminReport.target.area} · {selectedAdminReport.target.status}</span> : null}
              {selectedAdminReport.target?.role ? <span>{selectedAdminReport.target.role} · {selectedAdminReport.target.verificationStatus} · {selectedAdminReport.target.status}</span> : null}
            </div>
            <div className="modal-actions">
              <button className="action secondary" type="button" onClick={() => setReportReviewId("")}>Close</button>
              <button className="action secondary" type="button" onClick={() => moderateReport(selectedAdminReport, "dismissed", "dismissed")}>Dismiss</button>
              {selectedAdminReport.targetType === "listing" && selectedAdminReport.target?._id ? (
                <>
                  <button className="action secondary" type="button" onClick={() => { setReportReviewId(""); openListing(selectedAdminReport.target._id); }}>Open listing</button>
                  <button className="action primary danger-action" type="button" onClick={() => removeReportedListing(selectedAdminReport)}><XCircle size={16} />Remove listing</button>
                </>
              ) : null}
              <button className="action primary" type="button" onClick={() => moderateReport(selectedAdminReport, "resolved", "resolved")}><CheckCircle2 size={16} />Resolve</button>
            </div>
          </div>
        </div>
      )}
      {bookingTargetId && (
        <div className="modal-backdrop" role="presentation" onClick={() => setBookingTargetId("")}>
          <div className="confirm-modal booking-modal" role="dialog" aria-modal="true" aria-labelledby="booking-modal-title" onClick={(event) => event.stopPropagation()}>
            <IconFrame icon={CalendarCheck} tone="green" />
            <div>
              <span className="eyebrow">Booking request</span>
              <h3 id="booking-modal-title">{bookingTargetListing?.listingType === "service" ? "Request this service?" : "Request a guided visit?"}</h3>
              <p>Send a {bookingTargetListing?.listingType === "service" ? "service booking" : "property visit"} request for <strong>{bookingTargetListing?.title || "this listing"}</strong>. The provider can accept, decline, or suggest an alternative.</p>
            </div>
            <div className="booking-summary">
              <span><MapPin size={15} />{bookingTargetListing?.area || "Dhaka"}</span>
              <strong>{money(bookingTargetListing?.price)}</strong>
            </div>
            <form className="booking-request-form" onSubmit={confirmBooking}>
              <label>Proposed date and time<input name="proposedAt" type="datetime-local" min={dateTimeLocalValue(Date.now() + 300000)} defaultValue={dateTimeLocalValue()} required /></label>
              <label>Notes (optional)<textarea name="notes" rows="3" placeholder="Share access, timing, or setup requirements." /></label>
              <div className="modal-actions">
                <button className="action secondary" type="button" onClick={() => setBookingTargetId("")}>Cancel</button>
                <button className="action primary" type="submit" disabled={busy}><CalendarCheck size={16} />{bookingTargetListing?.listingType === "service" ? "Request service" : "Request visit"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {alternateBookingId && (
        <div className="modal-backdrop" role="presentation" onClick={() => setAlternateBookingId("")}>
          <div className="confirm-modal booking-modal" role="dialog" aria-modal="true" aria-labelledby="alternate-booking-title" onClick={(event) => event.stopPropagation()}>
            <IconFrame icon={CalendarCheck} tone="blue" />
            <div>
              <span className="eyebrow">Alternate schedule</span>
              <h3 id="alternate-booking-title">Propose another time</h3>
              <p>The requester will see this updated schedule immediately in their booking pipeline.</p>
            </div>
            <form className="booking-request-form" onSubmit={proposeAlternateTime}>
              <label>Alternate date and time<input name="alternateAt" type="datetime-local" min={dateTimeLocalValue(Date.now() + 300000)} defaultValue={dateTimeLocalValue()} required /></label>
              <div className="modal-actions">
                <button className="action secondary" type="button" onClick={() => setAlternateBookingId("")}>Cancel</button>
                <button className="action primary" type="submit" disabled={busy}><CalendarCheck size={16} />Send alternate time</button>
              </div>
            </form>
          </div>
        </div>
      )}
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
              <button className="action primary danger-action" type="button" onClick={confirmDeleteListing} disabled={busy}><XCircle size={16} />Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
