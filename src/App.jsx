import { useEffect, useState, lazy, Suspense } from "react";
import { HashRouter as Router, Routes, Route } from "react-router-dom";

import AppLayout from "./components/AppLayout";
import PwaUpdate from "./components/PwaUpdate";
import AdminLogin from "./components/AdminLogin";

// Lazy Load Pages
const Home = lazy(() => import("./pages/Home"));
const Events = lazy(() => import("./pages/Events"));
const Results = lazy(() => import("./pages/Results"));
const Participants = lazy(() => import("./pages/Participants"));
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
        <img src="./pwa-192x192.png" alt="AHAM Logo" />
        <p>Loading AHAM Arts Fest...</p>
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
            <Route path="/events" element={<Events />} />
            <Route path="/register" element={<Register />} />
            <Route path="/results" element={<Results />} />
            <Route path="/participants" element={<Participants />} />
            <Route path="*" element={<NotFound />} />
          </Route>

          {/* ADMIN ROUTES */}
          <Route path="/admin" element={
            <div className="container" style={{ marginTop: "50px", maxWidth: "400px" }}>
              <h2 style={{ textAlign: "center", color: "var(--primary)", marginBottom: "20px" }}>Admin Access</h2>
              <div className="card">
                <AdminLogin />
              </div>
            </div>
          } />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </Suspense>

      {/* 🔔 PWA UPDATE BANNER (OUTSIDE ROUTES, INSIDE ROUTER) */}
      <PwaUpdate />
    </Router>
  );
}
