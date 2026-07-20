import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, query, orderBy, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { Helmet } from "react-helmet-async";
import "./Register.css";
import { getEventType, isGeneralEvent, getEventScope } from "../constants/events";
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
    const appName = localStorage.getItem("branding_appName") || "HAMARTIA";

    // Data States
    const [events, setEvents] = useState([]);
    const [liveTeams, setLiveTeams] = useState([]);
    const [masterStudents, setMasterStudents] = useState([]);
    const [existingRegistrations, setExistingRegistrations] = useState([]);
    const [formData, setFormData] = useState({
        fullName: "",
        cicNumber: "",
        chestNumber: "",
        team: "",
        category: "",
        events: []
    });

    const [isRegistrationOpen, setIsRegistrationOpen] = useState(true);
    const [activeCategory, setActiveCategory] = useState("onstage");
    const [categoryStatus, setCategoryStatus] = useState({ onStage: true, offStage: true, general: true });
    const [showDropdown, setShowDropdown] = useState(false);
    const [eventSearchTerm, setEventSearchTerm] = useState("");


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
                            if (email.includes("y4y4")) teamName = "TEAM A";
                            else if (email.includes("w2w2")) teamName = "TEAM B";
                            else if (email.includes("t3t3")) teamName = "TEAM C";
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

        // Fetch Existing Registrations (for limit enforcement)
        const fetchRegistrations = async () => {
            try {
                const q = query(collection(db, "registrations"));
                const snapshot = await getDocs(q);
                const regList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setExistingRegistrations(regList);
            } catch (err) {
                console.error("Error fetching registrations:", err);
            }
        };
        fetchRegistrations();

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
                // Check if already registered in past submissions
                if (formData.chestNumber) {
                    const pastRegs = existingRegistrations.filter(r => String(r.chestNumber).toUpperCase() === String(formData.chestNumber).toUpperCase());
                    const allPastEvents = [];
                    pastRegs.forEach(r => {
                        if (r.events) allPastEvents.push(...r.events);
                        if (r.onStageEvents) allPastEvents.push(...r.onStageEvents);
                        if (r.offStageEvents) allPastEvents.push(...r.offStageEvents);
                        if (r.generalEvents) allPastEvents.push(...r.generalEvents);
                    });
                    if (allPastEvents.includes(eventName)) {
                        showToast(`You are already registered for ${eventName}.`);
                        return prev;
                    }
                }
                // Limit Check for On Stage events
                if (type === "On Stage") {
                    const onStageCount = currentList.filter(e => {
                        const found = events.find(ev => ev.name === e);
                        const t = found?.type || getEventType(e);
                        return t === "On Stage" && !resolveIsGeneral(e);
                    }).length;

                    let pastOnStageCount = 0;
                    if (formData.chestNumber) {
                        const pastRegs = existingRegistrations.filter(r => String(r.chestNumber).toUpperCase() === String(formData.chestNumber).toUpperCase());
                        pastRegs.forEach(r => {
                            if (r.onStageEvents) pastOnStageCount += r.onStageEvents.length;
                        });
                    }

                    if (onStageCount + pastOnStageCount >= 3) {
                        if (pastOnStageCount > 0) {
                            showToast(`You already registered for ${pastOnStageCount} On Stage event(s) previously. You can only select a total of 3.`);
                        } else {
                            showToast("You can only select up to 3 On Stage events.");
                        }
                        return prev;
                    }
                }
                
                // Limit Check for Off Stage events
                if (type === "Off Stage") {
                    const offStageCount = currentList.filter(e => {
                        const found = events.find(ev => ev.name === e);
                        const t = found?.type || getEventType(e);
                        return t === "Off Stage" && !resolveIsGeneral(e);
                    }).length;

                    let pastOffStageCount = 0;
                    if (formData.chestNumber) {
                        const pastRegs = existingRegistrations.filter(r => String(r.chestNumber).toUpperCase() === String(formData.chestNumber).toUpperCase());
                        pastRegs.forEach(r => {
                            if (r.offStageEvents) pastOffStageCount += r.offStageEvents.length;
                        });
                    }

                    if (offStageCount + pastOffStageCount >= 4) {
                        if (pastOffStageCount > 0) {
                            showToast(`You already registered for ${pastOffStageCount} Off Stage event(s) previously. You can only select a total of 4.`);
                        } else {
                            showToast("You can only select up to 4 Off Stage events.");
                        }
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

        if (formData.events.length === 0) {
            showToast("Please select at least one event before submitting.");
            setSubmitting(false);
            return;
        }

        try {
            const onStageEvents = formData.events.filter(e => resolveEventType(e) === "On Stage" && !resolveIsGeneral(e));
            const offStageEvents = formData.events.filter(e => resolveEventType(e) === "Off Stage" && !resolveIsGeneral(e));
            const generalEvents = formData.events.filter(e => resolveIsGeneral(e));

            // Enforce limit across multiple submissions and block duplicates
            let pastOnStageCount = 0;
            let pastOffStageCount = 0;
            const allPastEvents = [];
            
            if (formData.chestNumber) {
                const pastRegs = existingRegistrations.filter(r => String(r.chestNumber).toUpperCase() === String(formData.chestNumber).toUpperCase());
                pastRegs.forEach(r => {
                    if (r.onStageEvents) pastOnStageCount += r.onStageEvents.length;
                    if (r.offStageEvents) pastOffStageCount += r.offStageEvents.length;
                    
                    if (r.events) allPastEvents.push(...r.events);
                    if (r.onStageEvents) allPastEvents.push(...r.onStageEvents);
                    if (r.offStageEvents) allPastEvents.push(...r.offStageEvents);
                    if (r.generalEvents) allPastEvents.push(...r.generalEvents);
                });
            }

            const duplicateEvents = formData.events.filter(e => allPastEvents.includes(e));
            if (duplicateEvents.length > 0) {
                showToast(`Submission blocked: You have already registered for ${duplicateEvents.join(", ")}`);
                setSubmitting(false);
                return;
            }

            if (onStageEvents.length + pastOnStageCount > 3) {
                showToast(`Submission blocked: You already registered for ${pastOnStageCount} On Stage event(s) previously. You can only select up to 3 total.`);
                setSubmitting(false);
                return;
            }

            if (offStageEvents.length + pastOffStageCount > 4) {
                showToast(`Submission blocked: You already registered for ${pastOffStageCount} Off Stage event(s) previously. You can only select up to 4 total.`);
                setSubmitting(false);
                return;
            }

            // Find existing registration document for this student to merge rather than create duplicate documents
            const existingReg = existingRegistrations.find(r => 
                String(r.chestNumber).toUpperCase() === String(formData.chestNumber).toUpperCase()
            );

            if (existingReg) {
                const mergedEvents = Array.from(new Set([...(existingReg.events || []), ...formData.events]));
                const mergedOnStage = Array.from(new Set([...(existingReg.onStageEvents || []), ...onStageEvents]));
                const mergedOffStage = Array.from(new Set([...(existingReg.offStageEvents || []), ...offStageEvents]));
                const mergedGeneral = Array.from(new Set([...(existingReg.generalEvents || []), ...generalEvents]));

                await updateDoc(doc(db, "registrations", existingReg.id), {
                    events: mergedEvents,
                    onStageEvents: mergedOnStage,
                    offStageEvents: mergedOffStage,
                    generalEvents: mergedGeneral,
                    submittedAt: new Date().toISOString()
                });
            } else {
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
            }

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
    const filterByScope = (e) => {
        if (!formData.category) return true;
        const scope = typeof e === 'object' 
            ? (e.studentCategory || e.scope || getEventScope(e.name)) 
            : getEventScope(e);
        if (scope.includes("Junior") && scope.includes("Senior")) return true;
        if (scope === "General" || scope === "Common/General" || scope === "Common / General") return true;
        if (formData.category.toLowerCase() === "junior" && scope.toLowerCase() === "senior") return false;
        if (formData.category.toLowerCase() === "senior" && scope.toLowerCase() === "junior") return false;
        return true;
    };

    const searchFilter = (e) => {
        if (!eventSearchTerm) return true;
        const name = (typeof e === 'string' ? e : e.name).toLowerCase();
        return name.includes(eventSearchTerm.toLowerCase());
    };

    const onStageList = events.filter(e => resolveEventType(e) === "On Stage" && !resolveIsGeneral(e) && filterByScope(e) && searchFilter(e));
    const offStageList = events.filter(e => resolveEventType(e) === "Off Stage" && !resolveIsGeneral(e) && filterByScope(e) && searchFilter(e));
    const generalList = events.filter(e => resolveIsGeneral(e) && filterByScope(e) && searchFilter(e));

    if (success) {
        return (
            <div className="register-container">
                <Helmet>
                    <title>{`Registration Summary | ${appName}`}</title>
                </Helmet>
                <div className="register-form success-message" style={{ maxWidth: '600px', padding: '40px 30px' }}>
                    <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                        <div style={{ fontSize: '60px', marginBottom: '10px' }}>✨</div>
                        <h2 style={{ fontSize: '28px', color: 'var(--text-main)', marginBottom: '10px' }}>Registration Confirmed!</h2>
                        <p style={{ color: 'var(--text-secondary)' }}>Successfully registered for <strong>{appName}</strong>.</p>
                    </div>

                    <div style={{ background: 'var(--bg-secondary)', borderRadius: '16px', padding: '24px', border: '1px solid var(--border-soft)', marginBottom: '30px', textAlign: 'left' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Name</label>
                                <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-main)' }}>{formData.fullName}</div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Chest No</label>
                                <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--primary)' }}>#{formData.chestNumber}</div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Team</label>
                                <div style={{ fontSize: '16px', fontWeight: '500', color: 'var(--text-main)' }}>{formData.team}</div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Category</label>
                                <div style={{ fontSize: '16px', fontWeight: '500', color: 'var(--text-main)' }}>{formData.category || 'N/A'}</div>
                            </div>
                        </div>

                        <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: '20px' }}>
                            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Registered Events ({formData.events.length})</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {formData.events.map(ev => {
                                    const type = resolveEventType(ev);
                                    const badgeColor = type === "On Stage" ? "rgba(230, 57, 70, 0.2)" : (type === "Off Stage" ? "rgba(52, 211, 153, 0.2)" : "rgba(139, 92, 246, 0.2)");
                                    const badgeText = type === "On Stage" ? "#e63946" : (type === "Off Stage" ? "#34d399" : "#8b5cf6");
                                    return (
                                        <div key={ev} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-soft)' }}>
                                            <span style={{ fontWeight: '500' }}>{ev}</span>
                                            <span style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '4px', background: badgeColor, color: badgeText, fontWeight: '700' }}>{type}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                        <button
                            className="register-btn"
                            onClick={() => window.location.reload()}
                            style={{ background: 'var(--primary)', flex: 1 }}
                        >
                            ➕ New Registration
                        </button>
                        <button
                            className="register-btn"
                            onClick={() => {
                                const printContent = document.querySelector('.success-message').innerHTML;
                                const originalContent = document.body.innerHTML;
                                document.body.innerHTML = printContent;
                                window.print();
                                document.body.innerHTML = originalContent;
                                window.location.reload();
                            }}
                            style={{ background: 'var(--surface)', flex: 1, border: '1px solid var(--border-soft)' }}
                        >
                            🖨️ Print
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
                                            .filter(s => formData.team ? s.team === formData.team : true)
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
                                                        team: s.team || formData.team,
                                                        category: s.category || ""
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
                        <div className="section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                            <span>Select Event Category</span>
                            <div className="search-bar-container" style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
                                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>🔍</span>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Search events..."
                                    value={eventSearchTerm}
                                    onChange={(e) => setEventSearchTerm(e.target.value)}
                                    style={{ paddingLeft: '35px', background: 'var(--bg-main)', border: '1px solid var(--border-soft)' }}
                                />
                            </div>
                        </div>
                        <div className="category-tabs" style={{ marginTop: '15px' }}>
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
                                                const subtype = ev.generalSubtype || (getEventType(ev.name) !== "Unknown" ? getEventType(ev.name) : "On Stage");
                                                return (
                                                    <label key={ev.id} className="event-checkbox-label premium-glass-hover">
                                                        <input
                                                            type="checkbox"
                                                            checked={formData.events.includes(ev.name)}
                                                            onChange={() => handleEventToggle(ev.name, "General")}
                                                        />
                                                        <div className="event-info-wrapper">
                                                            <span className="event-name">{ev.name}</span>
                                                            {subtype && subtype !== "General" && subtype !== "Unknown" && (
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
