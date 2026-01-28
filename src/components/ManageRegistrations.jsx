import { useState, useEffect, useCallback } from "react";
import { collection, getDocs, query, orderBy, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import Toast from "./Toast";
import ConfirmDialog from "./ConfirmDialog";
import { useConfirm } from "../hooks/useConfirm";
import Papa from "papaparse";

export default function ManageRegistrations() {
    const [registrations, setRegistrations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);
    const { confirm, confirmState } = useConfirm();
    const [searchTerm, setSearchTerm] = useState("");
    const [sortConfig, setSortConfig] = useState({ key: 'CHEST NUMBER', direction: 'asc' });

    // URL for master participants CSV
    const csvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR7akmZPo8vINBoUN2hF6GdJ3ob-SqZFV2oDNSej9QvfY4z8H7Q9UbRIVmyu31pgiecp2h_2uiunBDJ/pub?gid=885092322&single=true&output=csv";

    // Sorting Logic
    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortedRegistrations = () => {
        let data = [...registrations];

        // Search Filter
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            data = data.filter(reg =>
                (reg["CANDIDATE NAME"] || reg["CANDIDATE  FULL NAME"] || "").toLowerCase().includes(lowerTerm) ||
                (reg["CHEST NUMBER"] || reg["CHEST NO"] || "").toString().includes(lowerTerm) ||
                (reg["CIC NUMBER"] || reg["CIC NO"] || "").toString().includes(lowerTerm)
            );
        }

        // Sort
        if (sortConfig.key) {
            data.sort((a, b) => {
                let aVal = a[sortConfig.key] || "";
                let bVal = b[sortConfig.key] || "";

                // Normalizing keys
                if (sortConfig.key === 'NAME') {
                    aVal = a["CANDIDATE NAME"] || a["CANDIDATE  FULL NAME"] || "";
                    bVal = b["CANDIDATE NAME"] || b["CANDIDATE  FULL NAME"] || "";
                }
                if (sortConfig.key === 'CHEST NUMBER') {
                    aVal = a["CHEST NUMBER"] || a["CHEST NO"] || 999999;
                    bVal = b["CHEST NUMBER"] || b["CHEST NO"] || 999999;
                    return sortConfig.direction === 'asc' ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
                }

                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return data;
    };

    // Fetch Registrations (Merged)
    const fetchRegistrations = useCallback(async () => {
        setLoading(true);

        // Helper to fix CSV typos
        const normalizeEventString = (str) => {
            if (!str) return "";
            let s = str.toUpperCase();
            s = s.replace(/SHORT VLOGING/g, "SHORT VLOGGING");
            s = s.replace(/SAMMARIZATION/g, "SUMMARIZATION");
            s = s.replace(/MINISTORY/g, "MINI STORY");
            s = s.replace(/PHOTOFEACHURE/g, "PHOTO FEATURE");
            s = s.replace(/Q&H/g, "Q AND H");
            s = s.replace(/SONG WRITER/g, "SONG WRITING");
            return s;
        };

        try {
            // 1. Fetch CSV
            const csvPromise = fetch(csvUrl + "&t=" + Date.now())
                .then(res => res.text())
                .then(csv => {
                    return new Promise((resolve) => {
                        Papa.parse(csv, {
                            header: true,
                            skipEmptyLines: true,
                            complete: (results) => resolve(results.data)
                        });
                    });
                });

            // 2. Fetch Firestore
            const firestorePromise = getDocs(query(collection(db, "registrations"), orderBy("submittedAt", "desc")))
                .then((snapshot) => {
                    return snapshot.docs.map(doc => {
                        const data = doc.data();
                        return {
                            _id: doc.id,
                            "CANDIDATE NAME": data.fullName,
                            "CIC NO": data.cicNumber,
                            "CHEST NUMBER": data.chestNumber,
                            "TEAM": data.team,
                            "ON STAGE EVENTS": data.onStageEvents?.join(", ") || "",
                            "OFF STAGE EVENTS": data.offStageEvents?.join(", ") || "",
                            "GENERAL EVENTS": data.generalEvents?.join(", ") || "",
                            _submittedAt: data.submittedAt, // Keep for sorting if needed
                            _source: "firestore"
                        };
                    });
                });

            const [csvData, firestoreData] = await Promise.all([csvPromise, firestorePromise]);

            // Add IDs and normalize CSV data
            const normalizedCsv = csvData.map((row, idx) => {
                const onStage = normalizeEventString(row["ON STAGE EVENTS"] || row["ON STAGE ITEMS"]);
                const offStage = normalizeEventString(row["OFF STAGE EVENTS"] || row["OFF STAGE ITEMS"] || row["OFF STAGE ITEMES"]);
                const generalRaw = row["GENERAL EVENTS"] || row["GENERAL ITEMS"] || row["OFF STAGE - GENERAL"] || row["ON STAGE - GENERAL"];
                const general = normalizeEventString(generalRaw);

                return {
                    ...row,
                    _id: `csv_${idx}`,
                    id: `csv_${idx}`,
                    "CANDIDATE NAME": row["CANDIDATE NAME"] || row["CANDIDATE  FULL NAME"],
                    "CIC NO": row["CIC NO"] || row["CIC NUMBER"],
                    "TEAM": row["TEAM"] || row["TEAM NAME"],
                    "CHEST NUMBER": row["CHEST NUMBER"] || row["CHEST NO"],
                    "ON STAGE EVENTS": onStage,
                    "OFF STAGE EVENTS": offStage,
                    "GENERAL EVENTS": general,
                    _source: "csv"
                };
            });

            // MERGE LOGIC
            const mergedMap = new Map();
            const rawList = [...firestoreData, ...normalizedCsv];

            rawList.forEach(item => {
                const chestNo = (item["CHEST NUMBER"] || item["CHEST NO"] || "").toString().trim();

                // If no chest no, just add as unique item
                if (!chestNo) {
                    mergedMap.set(item._id, item);
                    return;
                }

                if (mergedMap.has(chestNo)) {
                    // Merge with existing
                    const existing = mergedMap.get(chestNo);

                    // Combine events (deduplicate)
                    const mergeEvents = (str1, str2) => {
                        const s1 = str1 ? str1.split(",").map(s => s.trim()).filter(Boolean) : [];
                        const s2 = str2 ? str2.split(",").map(s => s.trim()).filter(Boolean) : [];
                        return [...new Set([...s1, ...s2])].join(", ");
                    };

                    existing["ON STAGE EVENTS"] = mergeEvents(existing["ON STAGE EVENTS"], item["ON STAGE EVENTS"]);
                    existing["OFF STAGE EVENTS"] = mergeEvents(existing["OFF STAGE EVENTS"], item["OFF STAGE EVENTS"]);
                    existing["GENERAL EVENTS"] = mergeEvents(existing["GENERAL EVENTS"], item["GENERAL EVENTS"]);

                    // If one source is firestore, mark as linked/merged (or keep firestore as primary for actions)
                    if (item._source === "firestore") existing._source = "firestore"; // prioritize app for delete ability
                    if (existing._source === "csv" && item._source === "firestore") existing._source = "APP+CSV";

                } else {
                    // New entry keyed by Chest No
                    mergedMap.set(chestNo, item);
                }
            });

            setRegistrations(Array.from(mergedMap.values()));

        } catch (error) {
            console.error("Error fetching registrations:", error);
            showToast("Failed to load registrations.", "error");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRegistrations();
    }, [fetchRegistrations]);

    const showToast = (message, type = 'info') => {
        setToast({ message, type });
    };

    const handleToastClose = () => {
        setToast(null);
    };

    const handleDelete = async (item) => {
        if (item._source !== "firestore") {
            showToast("Cannot delete CSV records. Please update the Google Sheet directly.", "warning");
            return;
        }

        if (!await confirm("Are you sure you want to delete this registration?")) return;

        try {
            await deleteDoc(doc(db, "registrations", item._id));
            showToast("Registration deleted.", "success");
            fetchRegistrations(); // Reload
        } catch (err) {
            console.error(err);
            showToast("Error deleting registration", "error");
        }
    };

    const sortedRegistrations = getSortedRegistrations();

    return (
        <div className="manage-results">
            {toast && <Toast message={toast.message} type={toast.type} onClose={handleToastClose} />}
            {confirmState && <ConfirmDialog {...confirmState} />}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 className="section-title">Manage All Registrations</h3>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                        type="text"
                        placeholder="Search Name, Chest No..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="admin-input"
                        style={{ width: '250px', margin: 0 }}
                    />
                    <button onClick={fetchRegistrations} className="tab-btn" style={{ background: '#333' }}>Refresh</button>
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>Loading...</div>
            ) : (
                <div className="admin-table-container" style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th onClick={() => handleSort('_source')} style={{ cursor: 'pointer' }}>Source ⬍</th>
                                <th onClick={() => handleSort('NAME')} style={{ cursor: 'pointer' }}>Name ⬍</th>
                                <th onClick={() => handleSort('CIC NUMBER')} style={{ cursor: 'pointer' }}>CIC No ⬍</th>
                                <th onClick={() => handleSort('TEAM')} style={{ cursor: 'pointer' }}>Team ⬍</th>
                                <th onClick={() => handleSort('CHEST NUMBER')} style={{ cursor: 'pointer' }}>Chest No ⬍</th>
                                <th>On Stage</th>
                                <th>Off Stage</th>
                                <th>General</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedRegistrations.length === 0 ? (
                                <tr>
                                    <td colSpan="9" style={{ textAlign: 'center', padding: '20px' }}>No registrations found.</td>
                                </tr>
                            ) : (
                                sortedRegistrations.map(reg => (
                                    <tr key={reg._id}>
                                        <td>
                                            <span style={{
                                                fontSize: '0.75rem',
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                background: reg._source === 'firestore' ? '#22c55e' : '#3b82f6',
                                                color: '#fff'
                                            }}>
                                                {reg._source === 'firestore' ? 'APP' : 'CSV'}
                                                {reg._source === 'APP+CSV' && 'APP+CSV'}
                                            </span>
                                        </td>
                                        <td>{reg["CANDIDATE NAME"] || reg["CANDIDATE  FULL NAME"]}</td>
                                        <td>{reg["CIC NUMBER"] || reg["CIC NO"]}</td>
                                        <td>{reg["TEAM"] || reg["TEAM NAME"]}</td>
                                        <td>{reg["CHEST NUMBER"] || reg["CHEST NO"] || '-'}</td>
                                        <td>
                                            {reg["ON STAGE EVENTS"] ? (
                                                <div style={{ color: '#4ade80', fontSize: '0.85rem' }}>{reg["ON STAGE EVENTS"]}</div>
                                            ) : <span style={{ color: '#ccc' }}>-</span>}
                                        </td>
                                        <td>
                                            {reg["OFF STAGE EVENTS"] ? (
                                                <div style={{ color: '#60a5fa', fontSize: '0.85rem' }}>{reg["OFF STAGE EVENTS"]}</div>
                                            ) : <span style={{ color: '#ccc' }}>-</span>}
                                        </td>
                                        <td>
                                            {reg["GENERAL EVENTS"] ? (
                                                <div style={{ color: '#facc15', fontSize: '0.85rem' }}>{reg["GENERAL EVENTS"]}</div>
                                            ) : <span style={{ color: '#ccc' }}>-</span>}
                                        </td>
                                        <td>
                                            {reg._source === 'firestore' ? (
                                                <button onClick={() => handleDelete(reg)} className="delete-btn">Delete</button>
                                            ) : <span style={{ color: '#666', fontSize: '0.8rem' }}>Read Only</span>}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
