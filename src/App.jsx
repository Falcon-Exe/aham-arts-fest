import { useEffect, useState } from "react";
import { HashRouter as Router, Routes, Route } from "react-router-dom";

import AppLayout from "./components/AppLayout";

import Home from "./pages/Home";
import Events from "./pages/Events";
import Results from "./pages/Results";
import Participants from "./pages/Participants";
import Register from "./pages/Register";
import PwaUpdate from "./components/PwaUpdate";
import AdminLogin from "./components/AdminLogin";
import Dashboard from "./pages/Dashboard";

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
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/events" element={<Events />} />
          <Route path="/register" element={<Register />} />
          <Route path="/results" element={<Results />} />
          <Route path="/participants" element={<Participants />} />
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

      {/* 🔔 PWA UPDATE BANNER (OUTSIDE ROUTES, INSIDE ROUTER) */}
      <PwaUpdate />
    </Router>
  );
}
