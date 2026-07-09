import { useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { Helmet } from "react-helmet-async";
import "./Register.css"; // Reuse styling where possible
import { getEventType } from "../constants/events";
import html2canvas from "html2canvas";
import { useRef, useEffect } from "react";

export default function Profile() {
    const [chestNumber, setChestNumber] = useState("");
    const [loading, setLoading] = useState(false);
    const [studentData, setStudentData] = useState(null);
    const [resultsData, setResultsData] = useState([]);
    const [searched, setSearched] = useState(false);
    const [completedEvents, setCompletedEvents] = useState(new Set());
    const profileRef = useRef(null);
    
    const appName = localStorage.getItem("branding_appName") || "Arts Fest 2026";

    useEffect(() => {
        // Fetch all results to know which events are completed
        const fetchCompleted = async () => {
            try {
                const snap = await getDocs(collection(db, "results"));
                const completed = new Set();
                snap.docs.forEach(d => completed.add(d.data().eventName));
                setCompletedEvents(completed);
            } catch (e) {
                console.error("Failed to fetch completed events");
            }
        };
        fetchCompleted();
    }, []);

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

    const handleExport = async () => {
        if (!profileRef.current) return;
        try {
            // Add a temporary class or style to optimize for image
            const canvas = await html2canvas(profileRef.current, {
                scale: 2, // High resolution
                backgroundColor: "#0f0f13", // match dark theme
                windowWidth: profileRef.current.scrollWidth,
                windowHeight: profileRef.current.scrollHeight,
                useCORS: true
            });
            const image = canvas.toDataURL("image/png");
            const link = document.createElement("a");
            link.href = image;
            link.download = `Profile_${chestNumber.toUpperCase()}.png`;
            link.click();
        } catch (err) {
            console.error("Export failed:", err);
            alert("Failed to export image.");
        }
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!chestNumber.trim()) return;

        setLoading(true);
        setSearched(true);
        setStudentData(null);
        setResultsData([]);

        try {
            // 1. Fetch Registration
            const regQuery = query(collection(db, "registrations"), where("chestNumber", "==", chestNumber.toUpperCase()));
            const regSnap = await getDocs(regQuery);
            
            if (!regSnap.empty) {
                // If there are multiple, combine events
                let data = null;
                const events = new Set();
                
                regSnap.docs.forEach(doc => {
                    const d = doc.data();
                    if (!data) data = d; // take first doc for basic info
                    if (d.events) d.events.forEach(ev => events.add(ev));
                });
                
                if (data) {
                    data.events = Array.from(events);
                    setStudentData(data);
                }
            }

            // 2. Fetch Results
            const resQuery = query(collection(db, "results"), where("chestNo", "==", chestNumber.toUpperCase()));
            const resSnap = await getDocs(resQuery);
            
            if (!resSnap.empty) {
                const results = resSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setResultsData(results);
            }

        } catch (error) {
            console.error("Error fetching student profile:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container" style={{ marginTop: '40px', minHeight: 'calc(100vh - 100px)' }}>
            <Helmet>
                <title>{`Student Profile | ${appName}`}</title>
            </Helmet>
            
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                <h2 style={{ textAlign: 'center', marginBottom: '10px' }}>Student Profile Check</h2>
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '30px' }}>
                    Enter your Chest Number to view your registered events and results.
                </p>

                <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', marginBottom: '40px' }}>
                    <input 
                        type="text" 
                        value={chestNumber}
                        onChange={(e) => setChestNumber(e.target.value)}
                        placeholder="Enter Chest Number (e.g. 101)"
                        className="form-input"
                        style={{ flex: 1, textTransform: 'uppercase' }}
                        required
                    />
                    <button type="submit" className="primary-btn" disabled={loading}>
                        {loading ? 'Searching...' : 'Search'}
                    </button>
                </form>

                {loading && <div style={{ textAlign: 'center' }}>Loading profile...</div>}

                {!loading && searched && !studentData && resultsData.length === 0 && (
                    <div style={{ background: 'var(--bg-secondary)', padding: '30px', borderRadius: '12px', textAlign: 'center', border: '1px solid var(--border-soft)' }}>
                        <div style={{ fontSize: '40px', marginBottom: '10px' }}>🔍</div>
                        <h3>No records found</h3>
                        <p style={{ color: 'var(--text-muted)' }}>We couldn't find any registrations or results for chest number #{chestNumber.toUpperCase()}.</p>
                    </div>
                )}

                {!loading && (studentData || resultsData.length > 0) && (
                    <div style={{ animation: 'fadeUp var(--transition-normal) both' }}>
                        
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }}>
                            <button onClick={handleExport} className="primary-btn" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)', padding: '8px 16px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                📸 Share to Story
                            </button>
                        </div>

                        {/* EXPORTABLE WRAPPER */}
                        <div ref={profileRef} className="profile-dashboard" style={{ padding: '20px', background: 'var(--bg-main)', borderRadius: '16px' }}>
                            
                            {/* 1. DIGITAL ID CARD */}
                            <div style={{ 
                                background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))', 
                                borderRadius: '16px', 
                                padding: '24px', 
                                border: `1px solid ${getTeamColor(studentData?.team)}`, 
                                borderTop: `4px solid ${getTeamColor(studentData?.team)}`,
                                marginBottom: '30px', 
                                display: 'flex', 
                                flexDirection: 'column',
                                gap: '20px', 
                                boxShadow: `0 10px 30px ${getTeamColor(studentData?.team)}22`,
                                position: 'relative',
                                overflow: 'hidden'
                            }}>
                                {/* Watermark */}
                                <div style={{ position: 'absolute', right: '-20px', top: '-20px', fontSize: '100px', opacity: 0.05, filter: 'grayscale(1)' }}>🎭</div>
                                
                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', zIndex: 1 }}>
                                    <div style={{ width: '80px', height: '80px', borderRadius: '12px', background: getTeamColor(studentData?.team), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 'bold', color: '#111', boxShadow: `0 0 20px ${getTeamColor(studentData?.team)}55` }}>
                                        {studentData ? studentData.fullName.charAt(0).toUpperCase() : chestNumber.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '12px', color: getTeamColor(studentData?.team), letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '4px' }}>FESTIVAL PASS</div>
                                        <h3 style={{ fontSize: '24px', margin: '0 0 5px 0', textTransform: 'uppercase' }}>{studentData ? studentData.fullName : "Unknown Name"}</h3>
                                        <div style={{ display: 'flex', gap: '15px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                                            <span><strong>CHEST NO:</strong> #{chestNumber.toUpperCase()}</span>
                                            {studentData?.team && <span><strong>TEAM:</strong> {studentData.team.toUpperCase()}</span>}
                                        </div>
                                    </div>
                                </div>
                                {/* Barcode Aesthetic */}
                                <div style={{ height: '30px', width: '100%', opacity: 0.3, backgroundImage: 'repeating-linear-gradient(90deg, #fff 0, #fff 2px, transparent 2px, transparent 5px, #fff 5px, #fff 6px, transparent 6px, transparent 10px)', marginTop: '10px', zIndex: 1 }}></div>
                            </div>

                            {/* 2. ACHIEVEMENTS */}
                            {resultsData.length > 0 && (
                                <div style={{ marginBottom: '30px' }}>
                                    <h3 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-main)' }}>
                                        🏆 Achievements
                                    </h3>
                                    <div style={{ display: 'grid', gap: '12px' }}>
                                        {resultsData.map(res => (
                                            <div key={res.id} style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.05), transparent)', padding: '16px', borderRadius: '12px', borderLeft: `4px solid ${res.place === '1st' ? '#F59E0B' : res.place === '2nd' ? '#94A3B8' : res.place === '3rd' ? '#B45309' : 'var(--border-soft)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <div style={{ fontWeight: '600', marginBottom: '4px', fontSize: '1.1rem' }}>{res.eventName}</div>
                                                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Score: {res.points || 0} pts | Grade: {res.grade || 'N/A'}</div>
                                                </div>
                                                <div style={{ fontSize: '28px', fontWeight: '800', color: res.place === '1st' ? '#F59E0B' : res.place === '2nd' ? '#94A3B8' : res.place === '3rd' ? '#B45309' : 'var(--text-main)', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
                                                    {res.place}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 4. EVENT ITINERARY (Timeline) */}
                            {studentData && studentData.events && studentData.events.length > 0 && (
                                <div>
                                    <h3 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-main)' }}>
                                        📋 Event Itinerary
                                    </h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                                        {studentData.events.map((ev, index) => {
                                            const type = getEventType(ev);
                                            const isCompleted = completedEvents.has(ev);
                                            
                                            return (
                                                <div key={ev} style={{ display: 'flex', gap: '15px', position: 'relative', paddingBottom: index !== studentData.events.length - 1 ? '20px' : '0' }}>
                                                    {/* Timeline Line & Dot */}
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                        <div style={{ 
                                                            width: '14px', height: '14px', borderRadius: '50%', 
                                                            background: isCompleted ? 'var(--success)' : 'var(--bg-secondary)', 
                                                            border: `2px solid ${isCompleted ? 'var(--success)' : 'var(--border-soft)'}`,
                                                            boxShadow: isCompleted ? '0 0 10px rgba(16, 185, 129, 0.4)' : 'none',
                                                            zIndex: 2
                                                        }}></div>
                                                        {index !== studentData.events.length - 1 && (
                                                            <div style={{ width: '2px', flex: 1, background: isCompleted ? 'var(--success)' : 'var(--border-soft)', opacity: isCompleted ? 0.5 : 1, margin: '4px 0' }}></div>
                                                        )}
                                                    </div>
                                                    
                                                    {/* Event Content */}
                                                    <div style={{ flex: 1, background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '-12px', opacity: isCompleted ? 0.7 : 1 }}>
                                                        <div>
                                                            <div style={{ fontWeight: '500', marginBottom: '4px', textDecoration: isCompleted ? 'line-through' : 'none' }}>{ev}</div>
                                                            <div style={{ fontSize: '11px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                                <span style={{ padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>{type}</span>
                                                                {isCompleted ? (
                                                                    <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>✓ Results Published</span>
                                                                ) : (
                                                                    <span style={{ color: 'var(--warning)', fontWeight: 'bold' }}>⏳ Upcoming</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            
                            {/* Branding Footer for Export */}
                            <div style={{ textAlign: 'center', marginTop: '30px', paddingTop: '20px', borderTop: '1px solid var(--border-soft)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                <strong>{appName}</strong> | Generated via Student Portal
                            </div>

                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
