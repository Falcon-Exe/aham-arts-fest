import { useState, useEffect } from "react";
import Papa from "papaparse";
import "./Participants.css";

function Participants() {
  const [participants, setParticipants] = useState([]);
  const [search, setSearch] = useState("");

  const csvUrl =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vR7akmZPo8vINBoUN2hF6GdJ3ob-SqZFV2oDNSej9QvfY4z8H7Q9UbRIVmyu31pgiecp2h_2uiunBDJ/pub?gid=885092322&single=true&output=csv";

  useEffect(() => {
fetch(csvUrl + "&t=" + Date.now())
      .then((res) => {
        if (!res.ok) throw new Error("Network error");
        return res.text();
      })
      .then((csv) => {
        Papa.parse(csv, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            setParticipants(results.data);
          },
        });
      })
      .catch((err) => {
        console.error("CSV LOAD FAILED:", err);
      });
  }, []);

  const filteredParticipants = participants.filter((p) => {
    const q = search.toLowerCase();
    return (
      p["CANDIDATE  FULL NAME"]?.toLowerCase().includes(q) ||
      p["CIC NUMBER"]?.toLowerCase().includes(q) ||
      p["CHEST NO"]?.toLowerCase().includes(q) ||
      p["TEAM NAME"]?.toLowerCase().includes(q) ||
      p["ON STAGE EVENTS"]?.toLowerCase().includes(q) ||
      p["OFF STAGE EVENTS"]?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="container">
      <h1 className="participants-title">Registered Participants</h1>

      <input
        type="text"
        className="participants-search"
        placeholder="Search by name, CIC, chest no, team, events..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {filteredParticipants.length === 0 ? (
        <p className="participants-empty">No matching participants found.</p>
      ) : (
        <div className="participants-grid">
          {filteredParticipants.map((p, i) => (
            <div key={i} className="card participant-card">
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
