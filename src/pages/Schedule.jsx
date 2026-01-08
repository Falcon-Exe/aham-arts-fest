import schedule from "../data/schedule";

function Schedule() {
  return (
    <div style={{ padding: "30px", textAlign: "center" }}>
      <h1>Fest Schedule 📅</h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "20px",
          marginTop: "30px",
        }}
      >
        {schedule.map((item, index) => (
          <div
            key={index}
            style={{
              border: "1px solid #ddd",
              borderRadius: "10px",
              padding: "15px",
              boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
              backgroundColor: "#f9f9f9",
              transition: "transform 0.3s",
            }}
          >
            <h3 style={{ marginBottom: "10px" }}>{item.event}</h3>
            <p><strong>Time:</strong> {item.time}</p>
            <p><strong>Venue:</strong> {item.venue}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Schedule;
