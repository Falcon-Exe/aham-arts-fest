import { useState, useEffect } from "react";
import Papa from "papaparse";

function Participants() {
  const [participants, setParticipants] = useState([]);

  useEffect(() => {
    const url =
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vR7akmZPo8vINBoUN2hF6GdJ3ob-SqZFV2oDNSej9QvfY4z8H7Q9UbRIVmyu31pgiecp2h_2uiunBDJ/pub?gid=885092322&single=true&output=csv";

    fetch(url)
      .then((res) => res.text())
      .then((csv) => {
        Papa.parse(csv, {
          header: true,
          complete: (results) => {
            setParticipants(results.data);
          },
        });
      });
  }, []);

  return (
    <div className="container">
      <h1 style={{ textAlign: "center", marginBottom: "20px" }}>
        Registered Participants
      </h1>

      {participants.length === 0 ? (
        <p>No registration data found.</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "16px",
          }}
        >
          {participants.map((p, i) => (
            <div
              key={i}
              style={{
                border: "1px solid #ddd",
                borderRadius: "12px",
                padding: "14px",
                backgroundColor: "#f9f9f9",
              }}
            >
              <p><strong>Name:</strong> {p["CANDIDATE  FULL NAME"]}</p>
              <p><strong>CIC No:</strong> {p["CIC NUMBER"]}</p>
              <p><strong>Chest No:</strong> {p["CHEST NO"]}</p>
              <p><strong>Team:</strong> {p["TEAM NAME"]}</p>
              <p><strong>Off Stage:</strong> {p["OFF STAGE EVENTS"]}</p>
              <p><strong>On Stage:</strong> {p["ON STAGE EVENTS"]}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Participants;
