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
