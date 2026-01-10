import Header from "../components/Header";
import Gallery from "../components/Gallery";

function Home() {
  return (
    <div className="container">
      
      <Header />

      {/* GALLERY */}
      <section className="section">
        <h2>Moments from AHAM</h2>
        <Gallery />
      </section>

      {/* QUICK INFO */}
      <section className="section info">
        <div>
          <h3>📅 Date</h3>
          <p>March 2026</p>
        </div>

        <div>
          <h3>📍 Venue</h3>
          <p>AHAM Campus</p>
        </div>

        <div>
          <h3>🎤 Events</h3>
          <p>On-stage & Off-stage</p>
        </div>
      </section>

      {/* CTA */}
      <section className="section cta">
        <a href="/schedule" className="btn">View Schedule</a>
        <a href="/registration" className="btn outline">Register Now</a>
      </section>

    </div>
  );
}

export default Home;
