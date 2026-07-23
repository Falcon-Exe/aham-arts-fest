import React, { useState, useEffect } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { collection, query, where, getDocs, onSnapshot, doc } from "firebase/firestore";
import { db } from "../firebase";
import { getEventType } from "../constants/events";
import Toast from "./Toast";

export default function ManageScanner() {
    const [scannedResult, setScannedResult] = useState(null);
    const [studentData, setStudentData] = useState(null);
    const [resultsData, setResultsData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState(null);
    const [completedEvents, setCompletedEvents] = useState(new Set());

    const showToast = (message, type = "info") => {
        setToast({ message, type });
    };

    useEffect(() => {
        const scanner = new Html5QrcodeScanner("reader", {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            rememberLastUsedCamera: true,
            aspectRatio: 1.0
        });

        scanner.render(onScanSuccess, onScanFailure);

        // Fetch completed events to match Profile logic
        const unsubResults = onSnapshot(collection(db, "results"), (snap) => {
            const completed = new Set();
            snap.docs.forEach(d => completed.add(d.data().eventName));
            setCompletedEvents(completed);
        });

        return () => {
            scanner.clear().catch(error => console.error("Failed to clear scanner:", error));
            unsubResults();
        };
    }, []);

    async function onScanSuccess(decodedText) {
        if (loading) return;

        // Vibrate if supported
        if ("vibrate" in navigator) navigator.vibrate(200);

        setScannedResult(decodedText);

        // Logic to extract Chest Number from URL
        // Expected formats:
        // 1. Full URL: ...#/profile?chest=101
        // 2. Just Chest No: 101
        let chestNo = "";
        try {
            if (decodedText.includes("chest=")) {
                const url = new URL(decodedText.replace("#", ""));
                chestNo = url.searchParams.get("chest");
            } else if (decodedText.includes("?chest=")) {
                chestNo = decodedText.split("chest=")[1].split("&")[0];
            } else {
                chestNo = decodedText.trim();
            }
        } catch (e) {
            chestNo = decodedText.trim();
        }

        if (chestNo) {
            fetchStudentInfo(chestNo.toUpperCase());
        } else {
            showToast("Invalid QR Code format", "warning");
        }
    }

    function onScanFailure(error) {
        // quiet fail to avoid console spam
    }

    const fetchStudentInfo = async (chestNo) => {
        setLoading(true);
        setStudentData(null);
        setResultsData([]);

        try {
            // 1. Fetch Registration
            const regQuery = query(collection(db, "registrations"), where("chestNumber", "==", chestNo));
            const regSnap = await getDocs(regQuery);

            if (!regSnap.empty) {
                let data = null;
                const events = new Set();
                regSnap.docs.forEach(doc => {
                    const d = doc.data();
                    if (!data) data = d;
                    if (d.events) d.events.forEach(ev => events.add(ev));
                });
                if (data) {
                    data.events = Array.from(events);
                    setStudentData(data);
                    showToast(`Student Found: ${data.fullName}`, "success");
                }
            } else {
                showToast("No student found with this chest number", "error");
            }

            // 2. Fetch Results
            const resQuery = query(collection(db, "results"), where("chestNo", "==", chestNo));
            const resSnap = await getDocs(resQuery);
            setResultsData(resSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        } catch (error) {
            console.error("Error fetching student info:", error);
            showToast("Database error", "error");
        } finally {
            setLoading(false);
        }
    };

    const getTeamColor = (teamName) => {
        if (!teamName) return "var(--primary)";
        const t = teamName.toUpperCase();
        if (t.includes("AETHER")) return "#ffcc00";
        if (t.includes("ATASH")) return "#00e676";
        if (t.includes("TERRA")) return "#8d6e63";
        if (t.includes("AQUA")) return "#29b6f6";
        if (t.includes("AER")) return "#ab47bc";
        return "var(--primary)";
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', paddingBottom: '40px' }}>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <h3 className="section-title" style={{ margin: 0 }}>🔍 Rapid Student Verification (Scanner)</h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '30px' }}>

                {/* SCANNER VIEW */}
                <div style={{ background: 'var(--surface)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-soft)' }}>
                    <div id="reader" style={{ width: '100%', borderRadius: '8px', overflow: 'hidden', border: 'none' }}></div>
                    <div style={{ marginTop: '20px', textAlign: 'center' }}>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                            Scan a student's ID card QR code to verify registration and achievements.
                        </p>
                        {scannedResult && (
                            <div style={{ marginTop: '10px', fontSize: '0.75rem', color: 'var(--primary)', wordBreak: 'break-all', opacity: 0.6 }}>
                                Last Scan: {scannedResult}
                            </div>
                        )}
                        <button
                            onClick={() => { setScannedResult(null); setStudentData(null); setResultsData([]); }}
                            className="tab-btn"
                            style={{ marginTop: '15px', background: 'var(--bg-tertiary)', width: '100%' }}
                        >
                            Reset Results
                        </button>
                    </div>
                </div>

                {/* INFO VIEW */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px', background: 'var(--surface)', borderRadius: '12px' }}>
                            Verifying Database...
                        </div>
                    ) : studentData ? (
                        <div style={{ animation: 'fadeUp 0.4s both' }}>
                            <div style={{
                                background: 'var(--surface)',
                                padding: '24px',
                                borderRadius: '12px',
                                border: `1px solid ${getTeamColor(studentData.team)}`,
                                borderLeft: `6px solid ${getTeamColor(studentData.team)}`,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '15px'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ fontSize: '10px', color: getTeamColor(studentData.team), letterSpacing: '1px', fontWeight: 'bold' }}>VERIFIED STUDENT</div>
                                        <h3 style={{ margin: '5px 0', textTransform: 'uppercase' }}>{studentData.fullName}</h3>
                                        <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                                            #{studentData.chestNumber} | {studentData.team?.toUpperCase()}
                                        </div>
                                    </div>
                                    <div style={{ padding: '4px 10px', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', borderRadius: '20px', fontSize: '10px', fontWeight: 'bold', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                                        VALID ✓
                                    </div>
                                </div>

                                {/* Event Summary */}
                                <div style={{ marginTop: '10px' }}>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>REGISTERED EVENTS ({studentData.events?.length || 0})</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {studentData.events?.map(ev => (
                                            <span key={ev} style={{
                                                fontSize: '10px',
                                                padding: '4px 8px',
                                                background: completedEvents.has(ev) ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-tertiary)',
                                                borderRadius: '4px',
                                                border: '1px solid var(--border-soft)',
                                                color: completedEvents.has(ev) ? '#22c55e' : 'var(--text-secondary)'
                                            }}>
                                                {ev} {completedEvents.has(ev) && "✓"}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* Achievements */}
                                {resultsData.length > 0 && (
                                    <div style={{ marginTop: '10px' }}>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>ACHIEVEMENTS</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {resultsData.map(res => (
                                                <div key={res.id} style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between', background: 'var(--bg-main)', padding: '8px 12px', borderRadius: '6px' }}>
                                                    <span>{res.eventName}</span>
                                                    <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{res.place}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div style={{
                            background: 'var(--surface)',
                            padding: '60px 20px',
                            borderRadius: '12px',
                            border: '1px solid var(--border-soft)',
                            textAlign: 'center',
                            color: 'var(--text-muted)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '15px'
                        }}>
                            <div style={{ fontSize: '40px', opacity: 0.3 }}>📷</div>
                            <p>Ready to Scan...<br/><span style={{ fontSize: '0.8rem' }}>Waiting for student QR code input</span></p>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
