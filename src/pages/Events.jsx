import events from "../data/events";
import EventCard from "../components/EventCard";

function Events() {
  return (
    <div style={{ textAlign: "center", padding: "30px" }}>
      <h1>Fest Events 🎭</h1>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "20px",
          justifyContent: "center",
          marginTop: "20px",
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
