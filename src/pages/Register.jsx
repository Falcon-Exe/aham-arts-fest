import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, query, orderBy } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { Helmet } from "react-helmet-async";
import "./Register.css";
import { getEventType, isGeneralEvent } from "../constants/events";


export default function Register() {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [warning, setWarning] = useState(null); // Toast state
    const [user, setUser] = useState(null);
    const navigate = useNavigate();

    // Data States
    const [events, setEvents] = useState([]);
    const [formData, setFormData] = useState({
        fullName: "",
        cicNumber: "",
        chestNumber: "",
        team: "",
        category: "General",
        onStageEvents: [],
        offStageEvents: [],
        generalEvents: []
    });

    // Auth & Data Fetch
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (!currentUser) {
                navigate("/team-login");
            } else {
                setUser(currentUser);

                // Auto-select team based on email (simple heuristic)
                const email = currentUser.email.toLowerCase();
                let teamName = "";
                if (email.includes("pyra")) teamName = "PYRA";
                else if (email.includes("ignis")) teamName = "IGNIS";
                else if (email.includes("atash")) teamName = "ATASH";

                if (teamName) {
                    setFormData(prev => ({ ...prev, team: teamName }));
                }
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

        return () => unsubscribe();
    }, [navigate]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const showToast = (msg) => {
        setWarning(msg);
        setTimeout(() => setWarning(null), 3000);
    };

    const handleEventToggle = (eventName, type) => {
        setFormData(prev => {
            let listKey = "offStageEvents";
            if (type === "On Stage") listKey = "onStageEvents";
            if (type === "General") listKey = "generalEvents";

            const currentList = prev[listKey];

            if (currentList.includes(eventName)) {
                return { ...prev, [listKey]: currentList.filter(e => e !== eventName) };
            } else {
                // Limit Check
                if (type === "On Stage" && currentList.length >= 3) {
                    showToast("You can only select up to 3 On Stage events.");
                    return prev;
                }
                return { ...prev, [listKey]: [...currentList, eventName] };
            }
        });
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
            await addDoc(collection(db, "registrations"), {
                ...formData,
                submittedAt: new Date().toISOString()
            });
            setSuccess(true);
            window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (error) {
            console.error("Registration error:", error);
            showToast("Failed to submit registration. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    // Filter events for display
    const onStageList = events.filter(e => getEventType(e.name) === "On Stage" && !isGeneralEvent(e.name));
    const offStageList = events.filter(e => getEventType(e.name) === "Off Stage" && !isGeneralEvent(e.name));
    const generalList = events.filter(e => isGeneralEvent(e.name));

    if (success) {
        return (
            <div className="register-container">

                <div className="register-form success-message">
                    <span className="success-icon">🎉</span>
                    <h3>Registration Successful!</h3>
                    <p>Thank you, <strong>{formData.fullName}</strong>.</p>
                    <p>Your registration for <strong>AHAM Arts Fest 2026</strong> has been recorded.</p>

                    <div style={{ marginTop: '30px' }}>
                        <button
                            className="register-btn"
                            onClick={() => window.location.reload()}
                            style={{ background: '#333' }}
                        >
                            Register Another Student
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="register-container">
            <Helmet>
                <title>Register | AHAM Arts Fest</title>
                <meta name="description" content="Register for AHAM Arts Fest 2026. Select your team and events." />
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
                            <div className="form-group">
                                <label>Chest Number</label>
                                <input
                                    className="form-input"
                                    name="chestNumber"
                                    value={formData.chestNumber}
                                    onChange={handleChange}
                                    placeholder="e.g. 000"
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
                                    <option value="PYRA">PYRA</option>
                                    <option value="IGNIS">IGNIS</option>
                                    <option value="ATASH">ATASH</option>
                                </select>
                            </div>
                            {/* <div className="form-group">
                                <label>Category</label>
                                <select
                                    className="form-select"
                                    name="category"
                                    value={formData.category}
                                    onChange={handleChange}
                                >
                                    <option value="General">General</option>
                                    <option value="Kiddies">Kiddies</option>
                                    <option value="Junior">Junior</option>
                                    <option value="Senior">Senior</option>
                                    <option value="Super Senior">Super Senior</option>
                                </select>
                            </div> */}
                        </div>
                    </div>

                    {/* SECTION 3: ON STAGE EVENTS */}
                    <div className="form-section">
                        <div className="section-label">🎭 On Stage Events</div>
                        {loading ? <div className="spinner"></div> : (
                            <div className="events-selection-grid">
                                {onStageList.length > 0 ? onStageList.map(ev => (
                                    <label key={ev.id} className="event-checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={formData.onStageEvents.includes(ev.name)}
                                            onChange={() => handleEventToggle(ev.name, "On Stage")}
                                        />
                                        <span className="event-name">{ev.name}</span>
                                    </label>
                                )) : <p style={{ color: '#666', fontStyle: 'italic' }}>No on-stage events found.</p>}
                            </div>
                        )}
                    </div>



                    {/* SECTION 5: GENERAL EVENTS */}
                    <div className="form-section">
                        <div className="section-label">🌐 General Events</div>
                        {loading ? <div className="spinner"></div> : (
                            <div className="events-selection-grid">
                                {generalList.length > 0 ? generalList.map(ev => {
                                    const subtype = getEventType(ev.name);
                                    return (
                                        <label key={ev.id} className="event-checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={formData.generalEvents.includes(ev.name)}
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
