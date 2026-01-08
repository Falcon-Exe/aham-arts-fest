import Header from "../components/Header";
import Gallery from "../components/Gallery";

function Home() {
  return (
    <div className="container">
      <h1>AHAM Arts Fest</h1>
      <p>Welcome to our fest</p>
      <p>MAJLIS WAFY COLLEGE</p>

      {/* Gallery component */}
      <Header />
      <Gallery />
    </div>
  );
}

export default Home;


    //   <div
    //     style={{
    //       maxWidth: "900px",
    //       margin: "0 auto",
    //       padding: "20px",
    //       textAlign: "center",
    //     }}
    //   >
    //     {/* LOGO IMAGE */}
    //     <img
    //       src="/pwa-192x192.jpg"
    //       alt="AHAM Arts Fest"
    //       style={{ width: "100%", maxWidth: "400px" }}
    //     />

    //     <h1>AHAM ARTS FEST 2025–26</h1>
    //     <p>Where talent meets tradition 🎭</p>
    //   </div>