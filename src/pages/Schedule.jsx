import schedule from "../data/schedule";
import "./Schedule.css";

function Schedule() {
  return (
    <div className="container">
      <h1 className="schedule-title">Fest Schedule 📅</h1>

      {/* <div className="schedule-grid"> */}
      <div className="card">

        {schedule.map((item, index) => (
          <div key={index} className="schedule-card">
            <h3 className="schedule-event">{item.event}</h3>

            <p><strong>Date:</strong> {item.date}</p>
            <p><strong>Time:</strong> {item.time}</p>
            <p><strong>Venue:</strong> {item.venue}</p>
            <p><strong>Stage:</strong> {item.stage}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Schedule;
