import { useEffect, useState, lazy, Suspense } from "react";
import { HashRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

import AppLayout from "./components/AppLayout";
import PwaUpdate from "./components/PwaUpdate";
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
const NotFound = lazy(() => import("./pages/NotFound"));

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

    return () => unscubscribe();
  }, []);

  if (loading) {
    return (
      <div className="loader">
        <img src="/pwa-512x512.png" alt="AHAM Logo" />
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
