import { lazy, Suspense } from "react";
import "./Home.css";
import { Link } from "react-router-dom";
import unionLogo from "/union-logo.png";

// Lazy loaded components
const Header = lazy(() => import("../components/Header"));
const Gallery = lazy(() => import("../components/Gallery"));

function Home() {
  console.log("HOME RENDERED");

  return (
    <div className="home-container">

      {/* HEADER */}
      <Suspense fallback={<div className="loader">Loading header...</div>}>
        <Header />
      </Suspense>

      {/* HERO / INTRO */}
      <section className="home-intro">
  <h1>AHAM 2026</h1>
  <p>
    A platform where creativity meets competition.
    Experience events, talent, and excellence.
  </p>

  {/* CENTER BUTTONS (2 × 2) */}
  <div className="center-buttons">
    <Link to="/schedule">Schedule</Link>
    <Link to="/register" className="primary">Register</Link>
    <Link to="/participants">Participants</Link>
    <Link to="/results">Results</Link>
  </div>
</section>



      {/* GALLERY */}
      <section className="home-gallery">
        <h2>MOMENTS:</h2>

        <Suspense fallback={<div className="loader">Loading gallery...</div>}>
          <Gallery />
        </Suspense>
      </section>
      {/* UNION FOOTER */}
<footer className="union-footer">
  <div className="footer-divider"></div>

  <img src="/union-logo.png" alt="Union Logo" className="union-logo" />

  <h3>MAJLIS UMARIYYA STUDENTS' FEDERATION</h3>
  <p>Majlis Umariyya Wafy College</p>

  <div className="union-socials">
    <a href="https://www.instagram.com/musf_puramannur/" target="_blank" aria-label="Instagram">
      <i className="fab fa-instagram"></i>
    </a>
    <a href="https://www.facebook.com/musf.puramannur" target="_blank" aria-label="Facebook">
      <i className="fab fa-facebook-f"></i>
    </a>
    <a href="https://www.youtube.com/channel/UCQELHz-keYmmQqSG0vX2jwA" target="_blank" aria-label="YouTube">
      <i className="fab fa-youtube"></i>
    </a>
  </div>

  <span className="footer-copy">
    © 2026 Majlis Umariyya Students' Federation
  </span>
</footer>

    </div>
    
  );
}

export default Home;
