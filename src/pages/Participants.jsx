import { useState, useEffect } from "react";
import Papa from "papaparse";

function Participants() {
  const [participants, setParticipants] = useState([]);

  useEffect(() => {
    // 👉 YOUR CSV LINK HERE
    const url =
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vR7akmZPo8vINBoUN2hF6GdJ3ob-SqZFV2oDNSej9QvfY4z8H7Q9UbRIVmyu31pgiecp2h_2uiunBDJ/pub?gid=885092322&single=true&output=csv";

    fetch(url)
      .then((response) => response.text())
      .then((csv) => {
        Papa.parse(csv, {
          header: true,
          complete: (results) => {
            setParticipants(results.data);
          },
        });
      })
      .catch((error) => {
        console.error("Error fetching registration data:", error);
      });
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <h1>Registered Participants</h1>
      {participants.length === 0 ? (
        <p>No registration data found.</p>
      ) : (
        <table border="1" cellPadding="8">
          <thead>
            <tr>
              <th>CIC Number</th>
              <th>Chest No</th>
              <th>CANDIDATE  FULL NAME</th>
              <th>Team Name</th>
              <th>Off Stage Events</th>
              <th>On Stage Events</th>
            </tr>
          </thead>
          <tbody>
            {participants.map((p, i) => (
              <tr key={i}>
                <td>{p["CIC NUMBER"]}</td>
                <td>{p["CHEST NO"]}</td>
                <td>{p["CANDIDATE  FULL NAME"]}</td>
                <td>{p["TEAM NAME"]}</td>
                <td>{p["OFF STAGE EVENTS"]}</td>
                <td>{p["ON STAGE EVENTS"]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default Participants;
