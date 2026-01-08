import events from "../data/events";
import EventCard from "../components/EventCard";

function Events() {
  return (
    <div className="container">
      <h1 style={{ textAlign: "center", marginBottom: "20px" }}>
        Fest Events 🎭
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
        }}
      >
        {events.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}

export default Events;
