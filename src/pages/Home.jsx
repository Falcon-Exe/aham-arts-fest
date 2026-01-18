import { lazy, Suspense } from "react";
import "./Home.css";
import { Link } from "react-router-dom";
import unionLogo from "/union-logo.png";

// Lazy loaded components
const Header = lazy(() => import("../components/Header"));
const Gallery = lazy(() => import("../components/Gallery"));

function Home() {
  return (
    <div className="avant-garde-container">
      {/* HEADER */}
      <Suspense fallback={null}>
        {/* ISLAND HEADER */}
        <Header />

        {/* WELCOME INDICATOR */}
        <div className="welcome-indicator">
          <div className="welcome-dot"></div>
          <span>WELCOME</span>
        </div>
      </Suspense>

      {/* HERO SECTION */}
      <section className="cinematic-hero">
        <div className="noise-overlay"></div>

        {/* CENTERED TYPOGRAPHY */}
        <div className="hero-typography-centered">
          <h1>AHAM2026</h1>
        </div>

        {/* FLOATING RED CIRCLE BADGE */}
        <div className="hero-center-badge">
          <div className="circle-frame">
            <span className="visual-text">ARTS FEST</span>
          </div>
        </div>

        {/* BENTO GRID NAVIGATION (2x2) */}
        <div className="bento-nav-grid">
          <Link to="/events" className="bento-card card-events">
            <span className="card-num">01</span>
            <span className="card-label">EVENTS</span>
            <span className="card-icon">🎭</span>
          </Link>

          <Link to="/results" className="bento-card card-results">
            <div className="card-header">
              <span className="card-num">02</span>
              <span className="live-badge">LIVE</span>
            </div>
            <span className="card-label">RESULTS</span>
          </Link>

          <Link to="/register" className="bento-card card-register">
            <span className="card-num">03</span>
            <span className="card-label">REGISTER</span>
            <span className="card-icon">✍️</span>
          </Link>

          <Link to="/participants" className="bento-card card-players">
            <span className="card-num">04</span>
            <span className="card-label">PLAYERS</span>
            <span className="card-icon">👥</span>
          </Link>
        </div>
      </section>

      {/* GALLERY STRIP */}
      <section className="film-strip-section">
        <div className="section-label">FEATURED HIGHLIGHTS</div>
        <Suspense fallback={<div className="loader">Loading...</div>}>
          <Gallery />
        </Suspense>
      </section>

      {/* FOOTER */}
      <div className="footer-container-styled">
        <footer className="minimal-footer">
          <div className="footer-content">
            <img src={unionLogo} alt="Union" className="footer-logo" />
            <div className="footer-text">
              <h3>MAJLIS UMARIYYA STUDENTS' FEDERATION</h3>
              <p>Majlis Umariyya Wafy College</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default Home;
