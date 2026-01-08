import schedule from "../data/schedule";

function Schedule() {
  return (
    <div className="container">
      <h1 style={{ textAlign: "center", marginBottom: "20px" }}>
        Fest Schedule 📅
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "16px",
        }}
      >
        {schedule.map((item, index) => (
          <div
            key={index}
            style={{
              border: "1px solid #ddd",
              borderRadius: "12px",
              padding: "14px",
              backgroundColor: "#f9f9f9",
            }}
          >
            <h3 style={{ marginBottom: "8px" }}>{item.event}</h3>
            <p><strong>Time:</strong> {item.time}</p>
            <p><strong>Venue:</strong> {item.venue}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Schedule;
