import "./Navbar.css";
import { Link } from "react-router-dom";

function Navbar() {
  return (
    <nav className="navbar">
      <Link to="/">Home</Link>
      <Link to="/schedule">Schedule</Link>
      <Link to="/register">Register</Link>
      <Link to="/participants">Participants</Link>
      <Link to="/results">Results</Link>
    </nav>
  );
}

export default Navbar;
// 