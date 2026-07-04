import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, query, orderBy, doc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { Helmet } from "react-helmet-async";
import "./Register.css";
import { getEventType, isGeneralEvent } from "../constants/events";
import { logAppEvent } from "../utils/analytics";


export default function Register() {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    // Auto-scroll to top when success screen is shown
    useEffect(() => {
        if (success) {
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    }, [success]);
    const [warning, setWarning] = useState(null); // Toast state
    const [user, setUser] = useState(null);
    const navigate = useNavigate();
    const appName = localStorage.getItem("branding_appName") || "Arts Fest 2026";

    // Data States
    const [events, setEvents] = useState([]);
    const [liveTeams, setLiveTeams] = useState([]);
    const [masterStudents, setMasterStudents] = useState([]);
    const [formData, setFormData] = useState({
        fullName: "",
        cicNumber: "",
        chestNumber: "",
        team: "",

        events: []
    });

    const [isRegistrationOpen, setIsRegistrationOpen] = useState(true);
    const [activeCategory, setActiveCategory] = useState("onstage");
    const [categoryStatus, setCategoryStatus] = useState({ onStage: true, offStage: true, general: true });
    const [showDropdown, setShowDropdown] = useState(false);

    // Auth & Data Fetch
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (!currentUser) {
                navigate("/team-login");
            } else {
                setUser(currentUser);
                const email = currentUser.email.toLowerCase();

                // Fetch team from firestore dynamically
                const fetchTeamName = async () => {
                    try {
                        const q = query(collection(db, "teams"));
                        const snapshot = await getDocs(q);
                        const teamNames = [];
                        let teamName = "";
                        snapshot.docs.forEach(doc => {
                            const data = doc.data();
                            teamNames.push(data.name);
                            if (data.email && data.email.toLowerCase() === email) {
                                teamName = data.name;
                            }
                        });
                        setLiveTeams(teamNames);

                        // Fallback simple heuristic
                        if (!teamName) {
                            if (email.includes("pyra")) teamName = "PYRA";
                            else if (email.includes("ignis")) teamName = "IGNIS";
                            else if (email.includes("atash")) teamName = "ATASH";
                        }

                        if (teamName) {
                            setFormData(prev => ({ ...prev, team: teamName }));
                        }
                    } catch(err) {
                        console.error("Error fetching team mappings", err);
                    }
                };
                fetchTeamName();
            }
        });

        const fetchEvents = async () => {
            try {
                const q = query(collection(db, "events"), orderBy("name"));
                const snapshot = await getDocs(q);
                const eventList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setEvents(eventList);
            } catch (error) {
                console.error("Error fetching events:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchEvents();

        // Fetch Master Students
        const fetchMasterStudents = async () => {
            try {
                const q = query(collection(db, "students"), orderBy("chestNumber"));
                const snapshot = await getDocs(q);
                const studentsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setMasterStudents(studentsList);
            } catch (error) {
                console.error("Error fetching master students:", error);
            }
        };
        fetchMasterStudents();

        // Registration Lock Listener
        const unsubSettings = onSnapshot(doc(db, "settings", "config"), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setIsRegistrationOpen(data.isRegistrationOpen ?? true);
                setCategoryStatus({
                    onStage: data.onStageOpen ?? true,
                    offStage: data.offStageOpen ?? true,
                    general: data.generalOpen ?? true
                });
            }
        });

        return () => {
            unsubscribe();
            unsubSettings();
        };
    }, [navigate]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const showToast = (msg) => {
        setWarning(msg);
        setTimeout(() => setWarning(null), 3000);
    };

    // Resolve event type: prefer Firestore `type` field, fall back to static EVENT_MAP
    const resolveEventType = (eventNameOrObj) => {
        if (typeof eventNameOrObj === 'object' && eventNameOrObj !== null) {
            return eventNameOrObj.type || getEventType(eventNameOrObj.name);
        }
        const found = events.find(ev => ev.name === eventNameOrObj);
        if (found && found.type) return found.type;
        return getEventType(eventNameOrObj);
    };

    const resolveIsGeneral = (eventNameOrObj) => {
        if (typeof eventNameOrObj === 'object' && eventNameOrObj !== null) {
            return eventNameOrObj.type === 'General' || isGeneralEvent(eventNameOrObj.name);
        }
        const found = events.find(ev => ev.name === eventNameOrObj);
        if (found && found.type === 'General') return true;
        return isGeneralEvent(eventNameOrObj);
    };

    const handleEventToggle = (eventName, type) => {
        setFormData(prev => {
            const currentList = prev.events;

            if (currentList.includes(eventName)) {
                return { ...prev, events: currentList.filter(e => e !== eventName) };
            } else {
                // Limit Check for On Stage events
                if (type === "On Stage") {
                    const onStageCount = currentList.filter(e => {
                        const found = events.find(ev => ev.name === e);
                        const t = found?.type || getEventType(e);
                        return t === "On Stage" && !resolveIsGeneral(e);
                    }).length;
                    if (onStageCount >= 3) {
                        showToast("You can only select up to 3 On Stage events.");
                        return prev;
                    }
                }
                return { ...prev, events: [...currentList, eventName] };
            }
        });
    };

    const handleChestSelect = (e) => {
        const selectedChest = e.target.value.toUpperCase();
        
        setFormData({
            ...formData,
            chestNumber: selectedChest
        });
        setShowDropdown(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        // Basic Validation
        if (!formData.team) {
            showToast("Please select a team.");
            setSubmitting(false);
            return;
        }

        try {
            const onStageEvents = formData.events.filter(e => resolveEventType(e) === "On Stage" && !resolveIsGeneral(e));
            const offStageEvents = formData.events.filter(e => resolveEventType(e) === "Off Stage" && !resolveIsGeneral(e));
            const generalEvents = formData.events.filter(e => resolveIsGeneral(e));

            await addDoc(collection(db, "registrations"), {
                fullName: formData.fullName,
                cicNumber: formData.cicNumber,
                chestNumber: formData.chestNumber,
                team: formData.team,
                events: formData.events,
                onStageEvents,
                offStageEvents,
                generalEvents,
                submittedAt: new Date().toISOString()
            });

            // Log Analytics
            logAppEvent('registration_submitted', { team: formData.team, hasEvents: formData.events.length > 0 });

            setSuccess(true);
        } catch (error) {
            console.error("Registration error:", error);
            showToast("Failed to submit registration. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    // Filter events for display
    const onStageList = events.filter(e => resolveEventType(e) === "On Stage" && !resolveIsGeneral(e));
    const offStageList = events.filter(e => resolveEventType(e) === "Off Stage" && !resolveIsGeneral(e));
    const generalList = events.filter(e => resolveIsGeneral(e));

    if (success) {
        return (
            <div className="register-container">

                <div className="register-form success-message">
                    <span className="success-icon">🎉</span>
                    <h3>Registration Successful!</h3>
                    <p>Thank you, <strong>{formData.fullName}</strong>.</p>
                    <p>Your registration for <strong>{appName}</strong> has been recorded.</p>

                    <div style={{ marginTop: '30px' }}>
                        <button
                            className="register-btn"
                            onClick={() => window.location.reload()}
                            style={{ background: 'var(--bg-secondary)' }}
                        >
                            Register Another Student
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Show event concluded message
    const eventConcluded = false; // Arts fest has ended

    if (eventConcluded || !isRegistrationOpen) {
        return (
            <div className="register-container">
                <Helmet>
                    <title>{`Registration Closed | ${appName}`}</title>
                </Helmet>
                <header className="register-header">
                    <button onClick={() => navigate("/")} className="back-home-btn">
                        ← Home
                    </button>
                    <h2 className="register-title">{appName}</h2>
                </header>
                <div className="register-form concluded-container">
                    <div className="concluded-icon">🎉</div>
                    <h3 className="concluded-title">Event Concluded!</h3>
                    <p className="concluded-subtitle">
                        {appName} has successfully concluded.
                    </p>
                    <p className="concluded-text">
                        Thank you to all participants, teams, and organizers for making this event a success!
                    </p>

                    <div className="concluded-buttons">
                        <button onClick={() => navigate("/results")} className="concluded-btn btn-primary">
                            🏆 View Final Results
                        </button>
                        <button onClick={() => navigate("/gallery")} className="concluded-btn btn-secondary">
                            📸 View Gallery
                        </button>
                    </div>

                    {user && (
                        <button
                            onClick={() => signOut(auth)}
                            style={{
                                marginTop: '30px',
                                background: '#ffebee',
                                color: '#d32f2f',
                                border: 'none',
                                padding: '8px 16px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '0.9rem'
                            }}
                        >
                            Logout ({user.email})
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="register-container">
            <Helmet>
                <title>{`Register | ${appName}`}</title>
                <meta name="description" content={`Register for ${appName}. Select your team and events.`} />
            </Helmet>


            <header className="register-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <button onClick={() => navigate("/")} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666' }}>
                        ← Home
                    </button>
                    {user && (
                        <button
                            onClick={() => signOut(auth)}
                            style={{
                                background: '#ffebee',
                                color: '#d32f2f',
                                border: 'none',
                                padding: '5px 10px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '0.85rem'
                            }}
                        >
                            Logout ({user.email.split('@')[0]})
                        </button>
                    )}
                </div>
                <h2 className="register-title">Candidate Registration</h2>
                <div className="live-status">
                    <span className="live-dot"></span>
                    Registration Open
                </div>
            </header>

            {warning && (
                <div className="toast-notification">
                    <span>⚠️ {warning}</span>
                </div>
            )}

            <div className="register-form">
                <form onSubmit={handleSubmit}>
                    {/* SECTION 1: PERSONAL DETAILS */}
                    <div className="form-section">
                        <div className="section-label">Student Details</div>



                        <div className="input-grid">
                            <div className="form-group" style={{ position: 'relative' }}>
                                <label style={{ color: 'var(--primary-light)' }}>Chest Number (Type or Select) *</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    name="chestNumber"
                                    value={formData.chestNumber}
                                    onChange={handleChestSelect}
                                    onFocus={() => setShowDropdown(true)}
                                    onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                                    style={{ borderColor: 'var(--primary)', background: 'rgba(79, 70, 229, 0.05)' }}
                                    placeholder="Start typing to auto-fill..."
                                    required
                                    autoComplete="off"
                                />
                                {showDropdown && (
                                    <div style={{
                                        position: 'absolute', top: '100%', left: 0, right: 0, 
                                        background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)',
                                        borderRadius: '0 0 8px 8px', maxHeight: '200px', overflowY: 'auto',
                                        zIndex: 999, boxShadow: '0 10px 25px rgba(0,0,0,0.8)'
                                    }}>
                                        {masterStudents
                                            .filter(s => !formData.team || s.team === formData.team || !s.team)
                                            .filter(s => s.chestNumber.includes(formData.chestNumber.toUpperCase()) || s.fullName.toLowerCase().includes(formData.chestNumber.toLowerCase()))
                                            .sort((a, b) => a.chestNumber.localeCompare(b.chestNumber))
                                            .map(s => (
                                            <div 
                                                key={s.id} 
                                                onClick={() => {
                                                    setFormData({
                                                        ...formData,
                                                        chestNumber: s.chestNumber,
                                                        fullName: s.fullName,
                                                        cicNumber: s.cicNumber || "",
                                                        team: s.team || formData.team
                                                    });
                                                    setShowDropdown(false);
                                                }}
                                                style={{
                                                    padding: '10px', cursor: 'pointer', borderBottom: '1px solid var(--border-soft)', color: 'var(--text-main)', fontSize: '0.9rem'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--primary-dark)'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <strong>{s.chestNumber}</strong> - {s.fullName}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="form-group">
                                <label>Full Name *</label>
                                <input
                                    className="form-input"
                                    name="fullName"
                                    value={formData.fullName}
                                    onChange={handleChange}
                                    placeholder="e.g. Muhammed Sabir"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>CIC No *</label>
                                <input
                                    className="form-input"
                                    name="cicNumber"
                                    value={formData.cicNumber}
                                    onChange={handleChange}
                                    placeholder="e.g. 20532"
                                    required
                                />
                            </div>

                        </div>
                    </div>

                    {/* SECTION 2: TEAM & CATEGORY */}
                    <div className="form-section">
                        <div className="section-label">Classification</div>
                        <div className="input-grid">
                            <div className="form-group">
                                <label>House / Team *</label>
                                <select
                                    className="form-select"
                                    name="team"
                                    value={formData.team}
                                    onChange={handleChange}
                                    required
                                >
                                    <option value="">-- Select Team --</option>
                                    {liveTeams.map(team => (
                                        <option key={team} value={team}>{team}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* EVENT CATEGORY TABS */}
                    <div className="form-section">
                        <div className="section-label">Select Event Category</div>
                        <div className="category-tabs">
                            <button
                                type="button"
                                className={`category-tab ${activeCategory === 'onstage' ? 'active' : ''}`}
                                onClick={() => setActiveCategory('onstage')}
                            >
                                🎭 On Stage
                            </button>
                            <button
                                type="button"
                                className={`category-tab ${activeCategory === 'offstage' ? 'active' : ''}`}
                                onClick={() => setActiveCategory('offstage')}
                            >
                                📝 Off Stage
                            </button>
                            <button
                                type="button"
                                className={`category-tab ${activeCategory === 'general' ? 'active' : ''}`}
                                onClick={() => setActiveCategory('general')}
                            >
                                🌐 General
                            </button>
                        </div>

                        {/* RENDER ACTIVE CATEGORY */}
                        {loading ? <div className="spinner"></div> : (
                            <>
                                {activeCategory === 'onstage' && (
                                    categoryStatus.onStage ? (
                                        <div className="events-selection-grid stagger-reveal-grid">
                                            {onStageList.length > 0 ? onStageList.map(ev => (
                                                <label key={ev.id} className="event-checkbox-label premium-glass-hover">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.events.includes(ev.name)}
                                                        onChange={() => handleEventToggle(ev.name, "On Stage")}
                                                    />
                                                    <span className="event-name">{ev.name}</span>
                                                </label>
                                            )) : <p style={{ color: '#666', fontStyle: 'italic' }}>No on-stage events found.</p>}
                                        </div>
                                    ) : (
                                        <div className="registration-closed-msg" style={{ padding: '20px', textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>
                                            <p style={{ margin: 0, fontWeight: 'bold' }}>🔒 Registration for On Stage events is currently closed.</p>
                                        </div>
                                    )
                                )}

                                {activeCategory === 'offstage' && (
                                    categoryStatus.offStage ? (
                                        <div className="events-selection-grid stagger-reveal-grid">
                                            {offStageList.length > 0 ? offStageList.map(ev => (
                                                <label key={ev.id} className="event-checkbox-label premium-glass-hover">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.events.includes(ev.name)}
                                                        onChange={() => handleEventToggle(ev.name, "Off Stage")}
                                                    />
                                                    <span className="event-name">{ev.name}</span>
                                                </label>
                                            )) : <p style={{ color: '#666', fontStyle: 'italic' }}>No off-stage events found.</p>}
                                        </div>
                                    ) : (
                                        <div className="registration-closed-msg" style={{ padding: '20px', textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>
                                            <p style={{ margin: 0, fontWeight: 'bold' }}>🔒 Registration for Off Stage events is currently closed.</p>
                                        </div>
                                    )
                                )}

                                {activeCategory === 'general' && (
                                    categoryStatus.general ? (
                                        <div className="events-selection-grid stagger-reveal-grid">
                                            {generalList.length > 0 ? generalList.map(ev => {
                                                const subtype = getEventType(ev.name);
                                                return (
                                                    <label key={ev.id} className="event-checkbox-label premium-glass-hover">
                                                        <input
                                                            type="checkbox"
                                                            checked={formData.events.includes(ev.name)}
                                                            onChange={() => handleEventToggle(ev.name, "General")}
                                                        />
                                                        <div className="event-info-wrapper">
                                                            <span className="event-name">{ev.name}</span>
                                                            {subtype && (
                                                                <span className={`event-subtype-tag ${subtype.toLowerCase().replace(' ', '-')}`}>
                                                                    {subtype}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </label>
                                                );
                                            }) : <p style={{ color: '#666', fontStyle: 'italic' }}>No general events found.</p>}
                                        </div>
                                    ) : (
                                        <div className="registration-closed-msg" style={{ padding: '20px', textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>
                                            <p style={{ margin: 0, fontWeight: 'bold' }}>🔒 Registration for General events is currently closed.</p>
                                        </div>
                                    )
                                )}
                            </>
                        )}
                    </div>

                    {/* SUBMIT */}
                    <div className="submit-container">
                        <button type="submit" className="register-btn" disabled={submitting}>
                            {submitting ? (
                                <span><span className="spinner" style={{ width: '14px', height: '14px', marginRight: '8px' }}></span> Saving...</span>
                            ) : "Submit"}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
