import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import "./Home.css";
import { Link } from "react-router-dom";
import { useTeamScores } from "../hooks/useTeamScores";

// Lazy loaded components
const Header = lazy(() => import("../components/Header"));
const Gallery = lazy(() => import("../components/Gallery"));

// Premium Component: Animated Number
const AnimatedNumber = ({ value }) => {
  const [current, setCurrent] = useState(0);
  const nodeRef = useRef(null);

  useEffect(() => {
    let observer;
    if (nodeRef.current) {
      observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          animateValue(0, value, 2000);
          observer.disconnect();
        }
      });
      observer.observe(nodeRef.current);
    }
    return () => observer && observer.disconnect();
  }, [value]);

  const animateValue = (start, end, duration) => {
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCurrent(Math.floor(easeProgress * (end - start) + start));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  };

  return <span ref={nodeRef}>{current}</span>;
};

// Premium Component: Animated Progress Bar
const ProgressBar = ({ percentage, teamName }) => {
  const [width, setWidth] = useState(0);
  const nodeRef = useRef(null);
  const [hasIntersected, setHasIntersected] = useState(false);

  useEffect(() => {
    let observer;
    if (nodeRef.current) {
      observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          setHasIntersected(true);
          observer.disconnect();
        }
      });
      observer.observe(nodeRef.current);
    }
    return () => observer && observer.disconnect();
  }, []);

  useEffect(() => {
    if (hasIntersected) {
      setWidth(percentage);
    }
  }, [percentage, hasIntersected]);

  return (
    <div ref={nodeRef} className="arena-score-bar">
      <div
        className={`score-fill team-${teamName.replace(/\s+/g, '-').toUpperCase()}`}
        style={{ width: `${width}%`, transition: 'width 2s cubic-bezier(0.16, 1, 0.3, 1)' }}
      ></div>
    </div>
  );
};

const BattleArena = () => {
  const { scores, loading, showHomePoints } = useTeamScores();

  if (loading || !showHomePoints) return null;

  // Find max score for relative progress bars
  const maxScore = scores.length > 0 ? scores[0].total : 100;

  return (
    <section className="battle-arena-section">
      <div className="arena-header">
        <h2 className="arena-title">FINAL STANDINGS</h2>
        <div className="live-badge-pulse" style={{ background: '#22c55e', animation: 'none' }}>FINAL</div>
      </div>

      <div className="arena-grid">
        {scores.slice(0, 3).map((team, index) => (
          <div key={team.team} className={`arena-card rank-${index + 1} team-${team.team.replace(/\s+/g, '-').toUpperCase()}`}>
            <div className="arena-rank">#{index + 1}</div>
            <div className="arena-info">
              <div className="arena-team-name">{team.team}</div>
              <ProgressBar percentage={(team.total / maxScore) * 100} teamName={team.team} />
              <div className="arena-stats">
                <span className="sc-total"><AnimatedNumber value={team.total} /> PTS</span>
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
  const heroTextRef = useRef(null);

  // Parallax Scrolling Effect
  useEffect(() => {
    // Disable on mobile/touch to prevent scroll jitter
    if (window.matchMedia("(hover: none) and (pointer: coarse)").matches) return;

    const handleScroll = () => {
      if (heroTextRef.current) {
        const scrollY = window.scrollY;
        heroTextRef.current.style.transform = `translateY(${scrollY * 0.3}px)`;
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const appName = localStorage.getItem("branding_appName") || "Arts Fest 2026";
  const appShortName = localStorage.getItem("branding_appShortName") || "ArtsFest2026";

  return (
    <div className="avant-garde-container">
      <Helmet>
        <title>{`${appName} | Home`}</title>
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
      <section className="cinematic-hero" aria-label={`Welcome to ${appName}`}>
        <div className="noise-overlay"></div>

        {/* Cinematic Background Ambient Orbs */}
        <div className="ambient-orb orb-1"></div>
        <div className="ambient-orb orb-2"></div>
        <div className="ambient-orb orb-3"></div>

        {/* CENTERED TYPOGRAPHY with Parallax */}
        <div className="hero-typography-centered stagger-reveal-text" ref={heroTextRef}>
          <h1>{appShortName.toUpperCase()}</h1>
        </div>

        {/* FLOATING RED CIRCLE BADGE */}
        <div className="hero-center-badge">
          <div className="stagger-reveal-badge">
            <div className="circle-frame">
              <span className="visual-text">
                <span className="month-text">FESTIVAL</span>
                <span className="date-text">LIVE</span>
              </span>
            </div>
          </div>
        </div>

        {/* BENTO GRID NAVIGATION (2x2) */}
        <div className="bento-nav-grid stagger-reveal-grid" role="navigation" aria-label="Main Menu">
          <Link to="/events" className="bento-card card-events premium-glass-hover">
            <span className="card-num">01</span>
            <span className="card-label">EVENTS</span>
            <span className="card-icon">🎭</span>
          </Link>

          <Link to="/register" className="bento-card card-register premium-glass-hover">
            <span className="card-num">02</span>
            <span className="card-label">REGISTRATION</span>
            <span className="card-icon">📝</span>
          </Link>

          <Link to="/participants" className="bento-card card-players premium-glass-hover">
            <span className="card-num">03</span>
            <span className="card-label">PARTICIPANTS</span>
            <span className="card-icon">👥</span>
          </Link>

          <Link to="/results" className="bento-card card-results premium-glass-hover">
            <span className="card-num">04</span>
            <span className="card-label">RESULTS</span>
            <span className="card-icon">🏆</span>
          </Link>
          
          <Link to="/profile" className="bento-card card-profile premium-glass-hover">
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <span className="card-num" style={{ margin: 0 }}>05</span>
              <span className="card-label" style={{ margin: 0, fontSize: '1.2rem' }}>STUDENT DASHBOARD</span>
            </div>
            <span className="card-icon" style={{ position: 'relative', top: 'auto', right: 'auto', marginLeft: 'auto', fontSize: '2rem' }}>🎓</span>
          </Link>
        </div>
      </section>

      {/* BATTLE ARENA (LIVE SCOREBOARD) */}
      <BattleArena />

      {/* GALLERY STRIP */}
      <section className="film-strip-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: '20px' }}>
          <div className="section-label">FEATURED HIGHLIGHTS</div>
          <Link to="/gallery" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: '600' }}>
            VIEW ALL ➔
          </Link>
        </div>
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
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '16px' }}>
              <a href="https://www.instagram.com/majlis_wafy.arts_fest/" target="_blank" rel="noopener noreferrer" className="social-link-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
              </a>
              <a href="https://www.facebook.com/musf.puramannur" target="_blank" rel="noopener noreferrer" className="social-link-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
              </a>
              <a href="https://www.youtube.com/channel/UCQELHz-keYmmQqSG0vX2jwA" target="_blank" rel="noopener noreferrer" className="social-link-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z"></path><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon></svg>
              </a>
            </div>

            {/* DEVELOPER CREDITS */}
            <div className="developer-credits" style={{ marginTop: '20px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Developed & Designed by <a href="https://www.instagram.com/sa_bi_r___/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-light)', textDecoration: 'none', fontWeight: '700', letterSpacing: '0.5px', transition: 'color 0.3s' }} onMouseOver={e => e.currentTarget.style.color = 'var(--text-main)'} onMouseOut={e => e.currentTarget.style.color = 'var(--primary-light)'}>Sabir</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default Home;
