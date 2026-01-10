import Header from "../components/Header";
import Gallery from "../components/Gallery";

function Home() {
  return (
    <div className="container">

      {/* Hero */}
      <section className="hero">
        <img
          src="/pwa-192x192.png"
          alt="AHAM Arts Fest"
          className="hero-logo"
        />
        <h1>AHAM Arts Fest 2025–26</h1>
        <p>Where talent meets tradition 🎭</p>
      </section>

      <Header />

      <section>
        <Gallery />
      </section>

    </div>
  );
}

export default Home;
