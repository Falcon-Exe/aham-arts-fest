import { useState, useEffect } from "react";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

export default function ManageAuditLogs() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, "auditLogs"), orderBy("timestamp", "desc"), limit(100));
        
        const unsubscribe = onSnapshot(q, (snap) => {
            const logsData = snap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setLogs(logsData);
            setLoading(false);
        }, (err) => {
            console.error("Error fetching audit logs:", err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const formatTimestamp = (ts) => {
        if (!ts) return "Pending...";
        const date = ts.toDate ? ts.toDate() : new Date(ts);
        return date.toLocaleString();
    };

    return (
        <div style={{ padding: "20px" }}>
            <h3 style={{ color: "var(--primary)", marginBottom: "15px" }}>📜 System Audit Logs</h3>
            <p style={{ color: "var(--text-secondary)", marginBottom: "20px", fontSize: "0.9rem" }}>
                Real-time tracking of administrative actions, result publishing, and modifications.
            </p>

            {loading ? (
                <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Loading system logs...</div>
            ) : logs.length === 0 ? (
                <div className="card" style={{ padding: "20px", textAlign: "center", color: "var(--text-secondary)" }}>
                    No audit logs recorded yet.
                </div>
            ) : (
                <div className="admin-table-container">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Timestamp</th>
                                <th>Action</th>
                                <th>Event</th>
                                <th>Team</th>
                                <th>Points</th>
                                <th>Admin User</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((log) => (
                                <tr key={log.id}>
                                    <td style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                                        {formatTimestamp(log.timestamp)}
                                    </td>
                                    <td>
                                        <span style={{
                                            padding: "3px 8px",
                                            borderRadius: "4px",
                                            fontSize: "0.75rem",
                                            fontWeight: "bold",
                                            background: log.action?.includes("delete") || log.action?.includes("remove")
                                                ? "rgba(239, 68, 68, 0.2)" 
                                                : log.action?.includes("update") || log.action?.includes("edit")
                                                    ? "rgba(245, 158, 11, 0.2)" 
                                                    : "rgba(34, 197, 94, 0.2)",
                                            color: log.action?.includes("delete") || log.action?.includes("remove")
                                                ? "#ef4444" 
                                                : log.action?.includes("update") || log.action?.includes("edit")
                                                    ? "#f59e0b" 
                                                    : "#22c55e"
                                        }}>
                                            {(log.action || "action").toUpperCase()}
                                        </span>
                                    </td>
                                    <td style={{ fontWeight: "600" }}>{log.event || "—"}</td>
                                    <td>{log.team || "—"}</td>
                                    <td style={{ color: "var(--primary)", fontWeight: "bold" }}>
                                        {log.pointsAwarded !== undefined ? `+${log.pointsAwarded}` : "—"}
                                    </td>
                                    <td style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                                        {log.admin || "system"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
