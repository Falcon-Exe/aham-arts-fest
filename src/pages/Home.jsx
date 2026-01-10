import Header from "../components/Header";
import Gallery from "../components/Gallery";

function Home() {
  return (
    <div className="container">

      {/* Hero / Branding Section */}
      <div className="hero">
        <img
          src="/pwa-192x192.png"
          alt="AHAM Arts Fest Logo"
          className="hero-logo"
        />
        <h1>AHAM ARTS FEST 2025–26</h1>
        <p>Where talent meets tradition 🎭</p>
      </div>

      {/* Navigation */}
      <Header />

      {/* Gallery */}
      <Gallery />

    </div>
  );
}

export default Home;
