import { useState, useEffect } from "react";
import Papa from "papaparse";
import "./Participants.css";

function Participants() {
  const [participants, setParticipants] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const url =
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vR7akmZPo8vINBoUN2hF6GdJ3ob-SqZFV2oDNSej9QvfY4z8H7Q9UbRIVmyu31pgiecp2h_2uiunBDJ/pub?gid=885092322&single=true&output=csv";

fetch(csvUrl + "?t=" + Date.now())

      .then((res) => res.text())
      .then((csv) => {
        Papa.parse(csv, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            setParticipants(results.data);
          },
        });
      });
  }, []);

  /* 🔍 SEARCH FILTER */
  const filteredParticipants = participants.filter((p) => {
    const query = search.toLowerCase();

    return (
      p["CANDIDATE  FULL NAME"]?.toLowerCase().includes(query) ||
      p["CIC NUMBER"]?.toLowerCase().includes(query) ||
      p["CHEST NO"]?.toLowerCase().includes(query) ||
      p["TEAM NAME"]?.toLowerCase().includes(query) ||
      p["ON STAGE EVENTS"]?.toLowerCase().includes(query) ||
      p["OFF STAGE EVENTS"]?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="container">
      <h1 className="participants-title">Registered Participants</h1>

      {/* 🔍 SEARCH INPUT */}
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
        // <div className="participants-grid">
          <div className="card">

          {filteredParticipants.map((p, i) => (
            <div key={i} className="participant-card">
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
