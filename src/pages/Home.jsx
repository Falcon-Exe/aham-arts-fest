import { lazy, Suspense } from "react";
import { Helmet } from "react-helmet-async";
import "./Home.css";
import { Link } from "react-router-dom";
import { useTeamScores } from "../hooks/useTeamScores";

// Lazy loaded components
const Header = lazy(() => import("../components/Header"));
const Gallery = lazy(() => import("../components/Gallery"));

const BattleArena = () => {
  const { scores, loading, showHomePoints } = useTeamScores();

  if (loading || !showHomePoints) return null;

  // Find max score for relative progress bars
  const maxScore = scores.length > 0 ? scores[0].total : 100;

  return (
    <section className="battle-arena-section">
      <div className="arena-header">
        <h2 className="arena-title">BATTLE ARENA</h2>
        <div className="live-badge-pulse">LIVE</div>
      </div>

      <div className="arena-grid">
        {scores.slice(0, 3).map((team, index) => (
          <div key={team.team} className={`arena-card rank-${index + 1} team-${team.team}`}>
            <div className="arena-rank">#{index + 1}</div>
            <div className="arena-info">
              <div className="arena-team-name">{team.team}</div>
              <div className="arena-score-bar">
                <div
                  className={`score-fill team-${team.team}`}
                  style={{ width: `${(team.total / maxScore) * 100}%` }}
                ></div>
              </div>
              <div className="arena-stats">
                <span className="sc-total">{team.total} PTS</span>
                <span className="sc-breakdown">
                  🎭 {team.onStage} | 📝 {team.offStage}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

function Home() {
  return (
    <div className="avant-garde-container">
      <Helmet>
        <title>AHAM Arts Fest | Home</title>
      </Helmet>
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
            <span className="visual-text">
              <span className="month-text">JANUARY</span>
              <span className="date-text">30 31</span>
            </span>
          </div>
        </div>

        {/* BENTO GRID NAVIGATION (2x2) */}
        <div className="bento-nav-grid">
          <Link to="/events" className="bento-card card-events">
            <span className="card-num">01</span>
            <span className="card-label">EVENTS</span>
            <span className="card-icon">🎭</span>
          </Link>

          <Link to="/register" className="bento-card card-register">
            <span className="card-num">02</span>
            <span className="card-label">REGISTER</span>
            <span className="card-icon">✍️</span>
          </Link>

          <Link to="/participants" className="bento-card card-players">
            <span className="card-num">03</span>
            <span className="card-label">PARTICIPANTS</span>
            <span className="card-icon">👥</span>
          </Link>

          <Link to="/results" className="bento-card card-results">
            <div className="card-header">
              <span className="card-num">04</span>
              <span className="live-badge">LIVE</span>
            </div>
            <span className="card-label">RESULTS</span>
          </Link>
        </div>
      </section>

      {/* BATTLE ARENA (LIVE SCOREBOARD) */}
      <BattleArena />

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
          <div className="footer-content" style={{ flexDirection: 'column', gap: '20px' }}>
            <div className="footer-text">
              <Link to="/admin" style={{ textDecoration: 'none', color: 'inherit', cursor: 'default' }}>
                <p style={{ fontSize: '0.8rem', letterSpacing: '1px', opacity: 0.9, fontWeight: '600' }}>&copy; 2026 MAJLIS UMARIYYA STUDENTS' FEDERATION</p>
              </Link>
              <p style={{ marginTop: '3px', fontSize: '0.75rem', opacity: 0.6 }}>Majlis Umariyya Wafy College | All Rights Reserved</p>
            </div>

            {/* SOCIAL LINKS */}
            <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginTop: '10px' }}>
              <a href="https://www.instagram.com/majlis_wafy.arts_fest/" target="_blank" rel="noopener noreferrer" style={{ color: '#fff', opacity: 0.8, transition: 'opacity 0.3s' }} onMouseOver={e => e.currentTarget.style.opacity = 1} onMouseOut={e => e.currentTarget.style.opacity = 0.8}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
              </a>
              <a href="https://www.facebook.com/musf.puramannur" target="_blank" rel="noopener noreferrer" style={{ color: '#fff', opacity: 0.8, transition: 'opacity 0.3s' }} onMouseOver={e => e.currentTarget.style.opacity = 1} onMouseOut={e => e.currentTarget.style.opacity = 0.8}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
              </a>
              <a href="https://www.youtube.com/channel/UCQELHz-keYmmQqSG0vX2jwA" target="_blank" rel="noopener noreferrer" style={{ color: '#fff', opacity: 0.8, transition: 'opacity 0.3s' }} onMouseOver={e => e.currentTarget.style.opacity = 1} onMouseOut={e => e.currentTarget.style.opacity = 0.8}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z"></path><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon></svg>
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default Home;
