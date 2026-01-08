import { Link } from "react-router-dom";

function Navbar() {
  return (
    <nav
      style={{
        display: "flex",
        justifyContent: "center",
        gap: "30px",
        padding: "15px",
        borderBottom: "1px solid #ddd",
      }}
    >
      <Link to="/">Home</Link>
      <Link to="/events">Events</Link>
      <Link to="/schedule">Schedule</Link>
      <Link to="/results">Results</Link>
      <Link to="/participants">Participants</Link>

    </nav>
  );
}

export default Navbar;
