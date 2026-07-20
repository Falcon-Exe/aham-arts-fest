import { useEffect, useState, lazy, Suspense } from "react";
import { HashRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { doc, onSnapshot, collection } from "firebase/firestore";
import { db } from "./firebase";

import AppLayout from "./components/AppLayout";
import PwaUpdate from "./components/PwaUpdate";
import NetworkStatus from "./components/NetworkStatus";
import AdminLogin from "./components/AdminLogin";
import Maintenance from "./pages/Maintenance";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";

// Lazy Load Pages
const Home = lazy(() => import("./pages/Home"));
const GalleryPage = lazy(() => import("./pages/GalleryPage"));
const Events = lazy(() => import("./pages/Events"));
const Results = lazy(() => import("./pages/Results"));
const Participants = lazy(() => import("./pages/Participants"));
const TeamLogin = lazy(() => import("./pages/TeamLogin"));
const Register = lazy(() => import("./pages/Register"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Profile = lazy(() => import("./pages/Profile"));
const NotFound = lazy(() => import("./pages/NotFound"));

import CustomCursor from "./components/CustomCursor";

function AppContent() {
  const [loading, setLoading] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Check for maintenance mode
    const unscubscribe = onSnapshot(doc(db, "settings", "publicConfig"), (snapshot) => {
      if (snapshot.exists()) {
        setMaintenanceMode(snapshot.data().maintenanceMode || false);
      }
      setTimeout(() => setLoading(false), 800);
    });

    // Dynamic Branding subscription
    const unsubscribeBranding = onSnapshot(doc(db, "settings", "branding"), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        localStorage.setItem("branding_appName", data.appName || "HAMARTIA");
        localStorage.setItem("branding_appShortName", data.appShortName || "HAMARTIA");
        localStorage.setItem("branding_logoUrl", data.logoUrl || "/pwa-512x512.png");

        if (data.studentCategories) {
          localStorage.setItem("branding_studentCategories", JSON.stringify(data.studentCategories));
        }
        if (data.studentClasses) {
          localStorage.setItem("branding_studentClasses", JSON.stringify(data.studentClasses));
        }

        const root = document.documentElement;
        if (data.primaryColor) root.style.setProperty('--primary', data.primaryColor);
        if (data.secondaryColor) root.style.setProperty('--secondary', data.secondaryColor);
        if (data.backgroundColor) root.style.setProperty('--bg-main', data.backgroundColor);
        if (data.surfaceColor) root.style.setProperty('--surface', data.surfaceColor);
      }
    });

    // Dynamic Team Colors Global Injector
    const dynamicStyleId = "dynamic-team-styles";
    let styleEl = document.getElementById(dynamicStyleId);
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = dynamicStyleId;
      document.head.appendChild(styleEl);
    }

    const unsubscribeTeams = onSnapshot(collection(db, "teams"), (snapshot) => {
      let cssRules = "";
      snapshot.docs.forEach(docSnap => {
        const team = docSnap.data();
        if (!team.name || !team.color) return;

        const cssClass = `team-${team.name.replace(/\s+/g, '-').toUpperCase()}`;
        const color = team.color;

        const hex2rgb = (hex, alpha) => {
          if (!hex.startsWith('#') || hex.length !== 7) return color; // fallback
          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);
          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        };

        const bgAlpha10 = hex2rgb(color, 0.12);
        const bgAlpha20 = hex2rgb(color, 0.2);
        const bgAlpha25 = hex2rgb(color, 0.25);
        const bgAlpha60 = hex2rgb(color, 0.6);

        cssRules += `
.${cssClass} { color: ${color} !important; }
.score-fill.${cssClass}, .chart-hbar-fill.${cssClass} { background: ${color} !important; box-shadow: 0 0 12px ${bgAlpha60} !important; }
.hero-section.${cssClass} { background: linear-gradient(135deg, ${bgAlpha10}, var(--surface)) !important; border-color: ${bgAlpha25} !important; }
.hero-section.${cssClass} .glow-circle { background: ${color} !important; }
.hero-runner.${cssClass} { border-color: ${bgAlpha25} !important; }
.hero-runner.${cssClass} .runner-team-name { color: ${color} !important; }
.team-badge.${cssClass}, .winner-team.${cssClass}, .team-pill.${cssClass} { background: ${bgAlpha10} !important; color: ${color} !important; border: 1px solid ${bgAlpha20} !important; }
.team-pill.active.${cssClass} { background: ${bgAlpha20} !important; border-color: ${color} !important; box-shadow: 0 0 12px ${bgAlpha20} !important; }
.team-pill.${cssClass}:hover { border-color: ${bgAlpha60} !important; box-shadow: 0 0 8px ${bgAlpha10} !important; }
.winner-box.${cssClass} { border-color: ${bgAlpha20} !important; }
.winner-box.${cssClass}:hover { border-color: ${color} !important; box-shadow: 0 0 15px ${bgAlpha20} !important; }
`;
      });
      styleEl.textContent = cssRules;
    });

    return () => {
      unscubscribe();
      unsubscribeBranding();
      unsubscribeTeams();
    };
  }, []);

  const logoUrl = localStorage.getItem("branding_logoUrl") || "/pwa-512x512.png";

  if (loading) {
    return (
      <div className="loader">
        <img src={logoUrl} alt="Logo" style={{ maxWidth: '120px', maxHeight: '120px', objectFit: 'contain' }} />
      </div>
    );
  }

  // Check if current route is an admin route
  const isAdminRoute = location.pathname.includes("/admin") || location.pathname.includes("/dashboard");

  if (maintenanceMode && !isAdminRoute) {
    return <Maintenance />;
  }

  return (
    <>
      <CustomCursor />
      <Suspense fallback={
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '50px', color: '#666' }}>
          Loading...
        </div>
      }>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/gallery" element={<GalleryPage />} />
            <Route path="/events" element={<Events />} />
            <Route path="/team-login" element={<TeamLogin />} />
            <Route path="/register" element={<Register />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/results" element={<Results />} />
            <Route path="/participants" element={<Participants />} />
            <Route path="*" element={<NotFound />} />
          </Route>

          {/* ADMIN ROUTES */}
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </Suspense>
      <Analytics />
      <SpeedInsights />
      <PwaUpdate />
      <NetworkStatus />
    </>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
