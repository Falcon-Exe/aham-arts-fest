import { Outlet, useLocation } from "react-router-dom";
import Breadcrumb from "./Breadcrumb";
import "./AppLayout.css";
import AnnouncementTicker from "./AnnouncementTicker";

export default function AppLayout() {
  const location = useLocation();

  // Hide breadcrumb on Home page
  const NAV_ITEMS = [
    { label: "Home", path: "/" },
    { label: "Events", path: "/events" },
    { label: "Results", path: "/results" },
    { label: "Participants", path: "/participants" },
    { label: "Register", path: "/register" },
  ];
  const isHome = location.pathname === "/";

  return (
    <div className="app-layout">
      {/* GLOBAL ANNOUNCEMENT TICKER (TOP) */}
      <AnnouncementTicker />

      {!isHome && (
        <div className="app-header">
          <Breadcrumb />
        </div>
      )}

      <main className={`app-content ${isHome ? 'full-bleed' : ''}`}>
        <Outlet />
      </main>
    </div>
  );
}
