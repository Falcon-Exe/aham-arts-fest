import React from "react";
import "./Maintenance.css"; // We'll create a basic CSS for it

export default function Maintenance() {
    return (
        <div className="maintenance-container">
            <div className="maintenance-content">
                <div className="maintenance-logo">
                    <img src="/pwa-192x192.png" alt="AHAM Logo" />
                </div>
                <h1>We'll be back soon!</h1>
                <p>The AHAM Arts Fest platform is currently undergoing scheduled maintenance.</p>
                <p>Please check back in a few minutes.</p>
                <div className="maintenance-spinner"></div>
            </div>
            <div className="maintenance-footer">
                &copy; 2026 MAJLIS UMARIYYA
            </div>
        </div>
    );
}
