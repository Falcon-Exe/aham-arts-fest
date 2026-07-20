import React from "react";
import "./Maintenance.css"; // We'll create a basic CSS for it

export default function Maintenance() {
    const appName = localStorage.getItem("branding_appName") || "HAMARTIA";

    return (
        <div className="maintenance-container">
            <div className="maintenance-content">
                <div className="maintenance-logo">
                    <img src={localStorage.getItem("branding_logoUrl") || "/pwa-192x192.png"} alt="Logo" />
                </div>
                <h1>We'll be back soon!</h1>
                <p>The {appName} platform is currently undergoing scheduled maintenance.</p>
                <p>Please check back in a few minutes.</p>
                <div className="maintenance-spinner"></div>
            </div>
            <div className="maintenance-footer">
                &copy; 2026 MAJLIS UMARIYYA
            </div>
        </div>
    );
}
