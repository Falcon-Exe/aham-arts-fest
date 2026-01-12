import { useState, useEffect } from "react";
import Papa from "papaparse";
import "./Results.css";

function Results() {
  const [results, setResults] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const url =
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vTMLt3l_xtUOyT-YkXSTWhbWXbfXyF7vAIeHP3Nu0x0japM8OuAeA6_ZmHZTmZhouQq61_EOmFFQJ8Z/pub?gid=0&single=true&output=csv";

    fetch(url)
      .then((res) => res.text())
      .then((csv) => {
        Papa.parse(csv, {
          header: true,
          skipEmptyLines: true,
          complete: (data) => {
            const published = data.data.filter(
              (r) => r.Published === "YES"
            );
            setResults(published);
          },
        });
      });
  }, []);

  const filteredResults = results.filter((r) =>
    r.Event?.toLowerCase().includes(search.toLowerCase())
  );

  const gradeClass = (g) => {
    if (g === "A+") return "grade-a";
    if (g === "A") return "grade-a";
    if (g === "B") return "grade-b";
    if (g === "C") return "grade-c";
    return "";
  };

  return (
    <div className="container results-page">
      <h2 className="results-title">Results 🏆</h2>

      <input
        type="text"
        className="results-search"
        placeholder="Search by event..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {filteredResults.length === 0 ? (
        <p className="results-message">No results available.</p>
      ) : (
        <div className="results-grid">
          {filteredResults.map((r, i) => (
            <div key={i} className="results-card">
              <h3 className="results-event">{r.Event}</h3>

              {/* 🥇 FIRST */}
              <div className="results-position top-performer">
                🥇 <strong>{r.First}:</strong>{" "}
                {r["Chest Number"] || "—"}{" "}
                <span className={gradeClass(r.Grade)}>
                  ({r.Grade || "—"})
                </span>
              </div>

              {/* 🥈 SECOND */}
              <div className="results-position">
                🥈 <strong>{r.Second}:</strong>{" "}
                {r["Chest Number.1"] || "—"}{" "}
                <span className={gradeClass(r["Grade.1"])}>
                  ({r["Grade.1"] || "—"})
                </span>
              </div>

              {/* 🥉 THIRD */}
              <div className="results-position">
                🥉 <strong>{r.Third}:</strong>{" "}
                {r["Chest Number.2"] || "—"}{" "}
                <span className={gradeClass(r["Grade.2"])}>
                  ({r["Grade.2"] || "—"})
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Results;
