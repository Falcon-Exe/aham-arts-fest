function Navbar() {
  return (
    <nav
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "12px",
        justifyContent: "center",
        padding: "12px",
        borderBottom: "1px solid #ddd",
      }}
    >
      <a href="/">Home</a>
      <a href="/schedule">Schedule</a>
      {/* <a href="/events">Events</a> */}
      <a href="/participants">Participants</a>
      <a href="/results">Results</a>
    </nav>
  );
}

export default Navbar;
