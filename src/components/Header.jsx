// import logo from "../assets/logo.jpg";

// function Header() {
//   return (
//     <div style={{ textAlign: "center", padding: "30px 20px" }}>
//       <img src={logo} alt="Fest Logo" width="500" />
//       <h1 style={{ marginTop: "10px", fontSize: "32px" }}>
//         AHAM ARTS FEST 2025–26
//       </h1>
//       <p style={{ color: "#555", marginTop: "5px" }}>
//         Where talent meets tradition 🎭
//       </p>
//     </div>
//   );
// }

// export default Header;
import logo from "../assets/logo.jpg";
import "./Header.css";

function Header() {
  return (
    <header className="hero">
      <img src={logo} alt="AHAM Arts Fest Logo" className="hero-logo" />

      <h1 className="hero-title">
        AHAM ARTS FEST 2025–26
      </h1>

      <p className="hero-tagline">
        Where talent meets tradition 🎭
      </p>
    </header>
  );
}

export default Header;
