import { useEffect, useState } from "react";

function Registration() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vR7akmZPo8vINBoUN2hF6GdJ3ob-SqZFV2oDNSej9QvfY4z8H7Q9UbRIVmyu31pgiecp2h_2uiunBDJ/pub?gid=885092322&single=true&output=csv";

  useEffect(() => {
    fetch(CSV_URL)
      .then((res) => res.text())
      .then((text) => {
        const rows = text.split("\n").map((row) => row.split(","));
        const headers = rows[0];
        const body = rows.slice(1);

        const formatted = body.map((row) =>
          headers.reduce((obj, key, i) => {
            obj[key.trim()] = row[i]?.trim();
            return obj;
          }, {})
        );

        setData(formatted);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <p style={{ textAlign: "center" }}>Loading registrations…</p>;
  }

  return (
    <div className="container">
      <h1>Event Registration</h1>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>CIC No</th>
              <th>Chest No</th>
              <th>Name</th>
              <th>Team</th>
              <th>Off Stage</th>
              <th>On Stage</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i}>
                <td>{row["CIC NUMBER"]}</td>
                <td>{row["CHEST NO"]}</td>
                <td>{row["FULL NAME"]}</td>
                <td>{row["TEAM NAME"]}</td>
                <td>{row["OFF STAGE EVENTS"]}</td>
                <td>{row["ON STAGE EVENTS"]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Registration;
