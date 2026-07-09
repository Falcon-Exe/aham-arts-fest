import { Outlet, useLocation } from "react-router-dom";
import Breadcrumb from "./Breadcrumb";
import "./AppLayout.css";
import AnnouncementTicker from "./AnnouncementTicker";
import { Helmet } from "react-helmet-async";

export default function AppLayout() {
  const location = useLocation();

  // Hide breadcrumb on Home page
  const NAV_ITEMS = [
    { label: "Home", path: "/" },
    { label: "Events", path: "/events" },
    { label: "Gallery", path: "/gallery" },
    { label: "Results", path: "/results" },
    { label: "Participants", path: "/participants" },
    { label: "Register", path: "/register" },
  ];
  const isHome = location.pathname === "/";
  const currentItem = NAV_ITEMS.find(item => item.path === location.pathname);

  const appName = localStorage.getItem("branding_appName") || "Arts Fest 2026";

  return (
    <div className="app-layout">
      {/* Aurora Background Blobs */}
      <div className="aurora-bg">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>
      <Helmet>
        <title>{appName}</title>
        <meta name="description" content={`Official standings and live updates for ${appName}.`} />
      </Helmet>
      {/* GLOBAL ANNOUNCEMENT TICKER (TOP) */}
      <AnnouncementTicker />

      {!isHome && (
        <div className="app-header">
          <Breadcrumb current={currentItem ? currentItem.label : "Page"} />
        </div>
      )}

      <main className={`app-content ${isHome ? 'full-bleed' : ''}`}>
        <Outlet />
      </main>
    </div>
  );
}
