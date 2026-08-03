import { useState, useCallback, useRef, useEffect } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { Helmet } from "react-helmet-async";
import { useSearchParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import "./Register.css"; // Reuse styling where possible
import { getEventType } from "../constants/events";
import { generateCertificate } from "../utils/certificate";
import { useTeamScores } from "../hooks/useTeamScores";
import html2canvas from "html2canvas";

const getTrophyTier = (points) => {
    if (points >= 90 && points <= 112) return '⭐⭐⭐⭐⭐';
    if (points >= 77 && points <= 89) return '⭐⭐⭐⭐';
    if (points >= 50 && points <= 76) return '⭐⭐⭐';
    if (points >= 28 && points <= 49) return '⭐⭐';
    if (points >= 13 && points <= 27) return '⭐';
    return '-';
};

export default function Profile() {
    const { showEventResults } = useTeamScores();
    const [chestNumber, setChestNumber] = useState("");
    const [loading, setLoading] = useState(false);
    const [studentData, setStudentData] = useState(null);
    const [resultsData, setResultsData] = useState([]);
    const [searched, setSearched] = useState(false);
    const [completedEvents, setCompletedEvents] = useState(new Set());
    const profileRef = useRef(null);
    
    const appName = localStorage.getItem("branding_appName") || "HAMARTIA";

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

    const [searchParams, setSearchParams] = useSearchParams();

    const performSearch = useCallback(async (targetChestNo) => {
        if (!targetChestNo.trim()) return;

        setLoading(true);
        setSearched(true);
        setStudentData(null);
        setResultsData([]);

        try {
            const upChestNo = targetChestNo.toUpperCase();
            setChestNumber(upChestNo);

            // 1. Fetch Registration
            const regQuery = query(collection(db, "registrations"), where("chestNumber", "==", upChestNo));
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
                }
            }

            // 2. Fetch Results
            const resQuery = query(collection(db, "results"), where("chestNo", "==", upChestNo));
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
    }, []);

    // 2. Handle Initial Search from Query Param
    useEffect(() => {
        const chest = searchParams.get("chest");
        if (chest && !searched) {
            performSearch(chest);
        }
    }, [searchParams, searched, performSearch]);

    const handleSearch = async (e) => {
        e.preventDefault();
        setSearchParams({ chest: chestNumber.toUpperCase() });
        performSearch(chestNumber);
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

                                {/* QR CODE INTEGRATION */}
                                <div style={{
                                    position: 'absolute',
                                    right: '20px',
                                    bottom: '20px',
                                    background: 'white',
                                    padding: '6px',
                                    borderRadius: '8px',
                                    zIndex: 2,
                                    boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}>
                                    <QRCodeSVG
                                        value={`${window.location.origin}${window.location.pathname}#/profile?chest=${chestNumber.toUpperCase()}`}
                                        size={64}
                                        level="M"
                                        includeMargin={false}
                                    />
                                    <span style={{ fontSize: '8px', color: '#333', fontWeight: 'bold' }}>SCAN TO VERIFY</span>
                                </div>
                            </div>

                            {/* 2. ACHIEVEMENTS & STATS */}
                            {!showEventResults ? (
                                <div style={{ marginBottom: '30px', padding: '24px 18px', borderRadius: '16px', background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.12), rgba(236, 72, 153, 0.08), rgba(15, 23, 42, 0.9))', border: '1px solid rgba(168, 85, 247, 0.3)', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
                                    <div style={{ fontSize: '2.2rem', marginBottom: '8px', filter: 'drop-shadow(0 0 10px rgba(168, 85, 247, 0.6))' }}>🔮</div>
                                    <div style={{ fontWeight: '800', fontSize: '1.15rem', color: '#ffffff', marginBottom: '6px', letterSpacing: '-0.01em' }}>Mysterious Verdict Locked! 🕵️‍♂️</div>
                                    <div style={{ fontSize: '0.88rem', color: '#cbd5e1', maxWidth: '440px', margin: '0 auto 12px', lineHeight: '1.5' }}>Candidate scorecards & event achievements are currently inside the Vault! Can you predict their final grades?</div>
                                    <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#f472b6', background: 'rgba(236, 72, 153, 0.15)', border: '1px solid rgba(236, 72, 153, 0.3)', padding: '4px 12px', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>⚡ Unveiling Soon</span>
                                </div>
                            ) : resultsData.length > 0 && (() => {
                                const totalPoints = resultsData.reduce((sum, res) => sum + (Number(res.points) || 0), 0);
                                const firstCount = resultsData.filter(r => r.place === "First" || r.place === "1" || r.place === "1st").length;
                                const secondCount = resultsData.filter(r => r.place === "Second" || r.place === "2" || r.place === "2nd").length;
                                const thirdCount = resultsData.filter(r => r.place === "Third" || r.place === "3" || r.place === "3rd").length;
                                const gradeOnlyCount = resultsData.filter(r => r.place === "None" || !r.place).length;

                                return (
                                    <>
                                        {/* Performance Summary Card */}
                                        <div style={{
                                            background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
                                            borderRadius: '16px',
                                            padding: '20px',
                                            border: '1px solid var(--border-soft)',
                                            marginBottom: '30px',
                                            boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
                                        }}>
                                            <h4 style={{ margin: '0 0 15px 0', fontSize: '1.1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                📊 Performance Summary
                                            </h4>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                                                {/* Total Points */}
                                                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '12px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '5px' }}>Total Points</span>
                                                    <strong style={{ fontSize: '1.8rem', color: getTeamColor(studentData?.team), textShadow: `0 0 10px ${getTeamColor(studentData?.team)}44` }}>
                                                        {totalPoints} <span style={{ fontSize: '1rem' }}>pts</span>
                                                    </strong>
                                                </div>
                                                
                                                {/* Trophy Tier */}
                                                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '12px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '5px' }}>Trophy Tier</span>
                                                    <strong style={{ fontSize: '1.2rem', display: 'block', marginTop: '6px' }}>{getTrophyTier(totalPoints)}</strong>
                                                </div>
                                            </div>

                                            {/* Placement breakdown */}
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '12px' }}>
                                                <div style={{ textAlign: 'center' }}>
                                                    <span style={{ fontSize: '1.2rem', display: 'block' }}>🥇</span>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>1st Place</span>
                                                    <strong style={{ display: 'block', fontSize: '1.1rem', marginTop: '2px', color: '#ffd700' }}>{firstCount}</strong>
                                                </div>
                                                <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.08)', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
                                                    <span style={{ fontSize: '1.2rem', display: 'block' }}>🥈</span>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>2nd Place</span>
                                                    <strong style={{ display: 'block', fontSize: '1.1rem', marginTop: '2px', color: '#c0c0c0' }}>{secondCount}</strong>
                                                </div>
                                                <div style={{ textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
                                                    <span style={{ fontSize: '1.2rem', display: 'block' }}>🥉</span>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>3rd Place</span>
                                                    <strong style={{ display: 'block', fontSize: '1.1rem', marginTop: '2px', color: '#cd7f32' }}>{thirdCount}</strong>
                                                </div>
                                                <div style={{ textAlign: 'center' }}>
                                                    <span style={{ fontSize: '1.2rem', display: 'block' }}>🏷️</span>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Grade Only</span>
                                                    <strong style={{ display: 'block', fontSize: '1.1rem', marginTop: '2px', color: 'var(--text-main)' }}>{gradeOnlyCount}</strong>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Achievements list */}
                                        <div style={{ marginBottom: '30px' }}>
                                            <h3 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-main)' }}>
                                                🏆 Achievements ({resultsData.length})
                                            </h3>
                                            <div style={{ display: 'grid', gap: '12px' }}>
                                                {resultsData.map(res => {
                                                    const is1st = res.place === '1st' || res.place === 'First' || res.place === '1';
                                                    const is2nd = res.place === '2nd' || res.place === 'Second' || res.place === '2';
                                                    const is3rd = res.place === '3rd' || res.place === 'Third' || res.place === '3';
                                                    const borderLeftColor = is1st ? '#F59E0B' : is2nd ? '#94A3B8' : is3rd ? '#B45309' : 'var(--border-soft)';
                                                    const highlightColor = is1st ? '#F59E0B' : is2nd ? '#94A3B8' : is3rd ? '#B45309' : 'var(--text-main)';

                                                    return (
                                                        <div key={res.id} style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.05), transparent)', padding: '16px', borderRadius: '12px', borderLeft: `4px solid ${borderLeftColor}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <div>
                                                                <div style={{ fontWeight: '600', marginBottom: '4px', fontSize: '1.1rem' }}>{res.eventName}</div>
                                                                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Score: {res.points || 0} pts | Grade: {res.grade || 'N/A'}</div>
                                                            </div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                                                                <div style={{ fontSize: '28px', fontWeight: '800', color: highlightColor, textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
                                                                    {res.place}
                                                                </div>
                                                                {res.place !== "None" && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            generateCertificate({
                                                                                studentName: studentData?.fullName || res.name,
                                                                                chestNo: chestNumber.toUpperCase(),
                                                                                eventName: res.eventName,
                                                                                place: res.place,
                                                                                team: res.team,
                                                                                appName: appName,
                                                                                date: res.timestamp?.toDate().toLocaleDateString()
                                                                            });
                                                                        }}
                                                                        style={{
                                                                            background: 'rgba(255,255,255,0.05)',
                                                                            border: '1px solid var(--border-soft)',
                                                                            color: 'var(--text-secondary)',
                                                                            fontSize: '10px',
                                                                            padding: '4px 8px',
                                                                            borderRadius: '4px',
                                                                            cursor: 'pointer'
                                                                        }}
                                                                    >
                                                                        📜 Certificate
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}

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
