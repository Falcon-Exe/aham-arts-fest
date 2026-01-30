import { useEffect, useState, lazy, Suspense } from "react";
import { HashRouter as Router, Routes, Route } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";

import AppLayout from "./components/AppLayout";
import PwaUpdate from "./components/PwaUpdate";
import AdminLogin from "./components/AdminLogin";

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

export default function App() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(t);
  }, []);

  if (loading) {
    return (
      <div className="loader">
        <img src="/pwa-512x512.png" alt="AHAM Logo" />

      </div>
    );
  }



  return (
    <Router>
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

      {/* 🔔 PWA UPDATE BANNER (OUTSIDE ROUTES, INSIDE ROUTER) */}
      <PwaUpdate />
      <Analytics />
    </Router>
  );
}
