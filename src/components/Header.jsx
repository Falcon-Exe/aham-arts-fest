import "./Header.css";

function Header() {
  return (
    <div className="header">
      <div className="header-card">
<img
  src="/pwa-512x512.png"
  alt="AHAM Arts Fest official logo"
  className="header-logo"
/>

        <h1 className="header-title">
          AHAM ARTS FEST 2025–26
        </h1>

        <p className="header-tagline">
          {/* Where talent meets tradition 🎭 */}
        </p>
      </div>
    </div>
  );
}

import { memo } from "react";
export default memo(Header);
