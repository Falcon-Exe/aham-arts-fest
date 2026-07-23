import { useState, useEffect } from "react";
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import Toast from "./Toast";

export default function ManageSettings() {
    const [toast, setToast] = useState(null);
    const [loading, setLoading] = useState(true);

    const [branding, setBranding] = useState({
        appName: "HAMARTIA",
        appShortName: "HAMARTIA",
        primaryColor: "#913831",
        secondaryColor: "#e63946",
        backgroundColor: "#050505",
        surfaceColor: "#101010",
        logoUrl: "",
        studentCategories: ["Junior", "Senior"],
        studentClasses: [
            "THAMHEEDIYYA ULA",
            "THAMHEEDIYYA SANIYA",
            "ALIYA ULA",
            "ALIYA SANIYA",
            "ALIYA SALISA"
        ]
    });

    // Scoring Rules state
    const [scoring, setScoring] = useState({
        catA: { first: 12, second: 8, third: 4 },
        catB: { first: 10, second: 6, third: 3 },
        catC: { first: 25, second: 15, third: 10 },
        general: { first: 25, second: 15, third: 10 },
        grades: { ap: 7, a: 5, b: 3, c: 1 }
    });

    // Admins List state
    const [admins, setAdmins] = useState([]);
    const [newAdminEmail, setNewAdminEmail] = useState("");

    const showToast = (message, type = "info") => {
        setToast({ message, type });
    };

    // Fetch configs on mount
    useEffect(() => {
        const fetchConfigs = async () => {
            setLoading(true);
            try {
                // 1. Fetch Branding Config
                const brandSnap = await getDoc(doc(db, "settings", "branding"));
                if (brandSnap.exists()) {
                    setBranding(brandSnap.data());
                }

                // 2. Fetch Scoring Config
                const scoringSnap = await getDoc(doc(db, "settings", "scoring"));
                if (scoringSnap.exists()) {
                    setScoring(scoringSnap.data());
                }

                // 3. Fetch Admins list
                const adminSnap = await getDocs(collection(db, "admins"));
                const adminList = adminSnap.docs.map(doc => doc.id);
                setAdmins(adminList);

            } catch (err) {
                console.error("Error loading settings:", err);
                showToast("Failed to load configuration", "error");
            } finally {
                setLoading(false);
            }
        };

        fetchConfigs();
    }, []);

    // Save Branding Settings
    const handleSaveBranding = async () => {
        try {
            await setDoc(doc(db, "settings", "branding"), branding);
            showToast("Branding settings saved! Reload the page to apply theme fully.", "success");

            // Dynamic theme application
            const root = document.documentElement;
            root.style.setProperty('--primary', branding.primaryColor);
            root.style.setProperty('--secondary', branding.secondaryColor);
            root.style.setProperty('--bg-main', branding.backgroundColor);
            root.style.setProperty('--surface', branding.surfaceColor);

            localStorage.setItem("branding_appName", branding.appName || "HAMARTIA Arts Fest");
            localStorage.setItem("branding_appShortName", branding.appShortName || "HAMARTIA");
            localStorage.setItem("branding_logoUrl", branding.logoUrl || "/pwa-512x512.png");
            if (branding.studentCategories) {
                localStorage.setItem("branding_studentCategories", JSON.stringify(branding.studentCategories));
            }
            if (branding.studentClasses) {
                localStorage.setItem("branding_studentClasses", JSON.stringify(branding.studentClasses));
            }
        } catch (err) {
            console.error("Error saving branding config:", err);
            showToast("Failed to save branding settings", "error");
        }
    };

    // Save Scoring Rules
    const handleSaveScoring = async () => {
        try {
            await setDoc(doc(db, "settings", "scoring"), scoring);
            showToast("Scoring rules updated successfully!", "success");
        } catch (err) {
            console.error("Error saving scoring config:", err);
            showToast("Failed to save scoring rules", "error");
        }
    };

    // Add New Admin
    const handleAddAdmin = async (e) => {
        e.preventDefault();
        const trimmedEmail = newAdminEmail.trim().toLowerCase();
        if (!trimmedEmail) return;

        if (admins.includes(trimmedEmail)) {
            showToast("Email is already an administrator", "warning");
            return;
        }

        try {
            await setDoc(doc(db, "admins", trimmedEmail), {
                addedBy: auth.currentUser?.email || "system",
                addedAt: new Date()
            });
            setAdmins([...admins, trimmedEmail]);
            setNewAdminEmail("");
            showToast(`Added ${trimmedEmail} to admin whitelist`, "success");
        } catch (err) {
            console.error("Error adding admin:", err);
            showToast("Failed to add admin", "error");
        }
    };

    // Remove Admin
    const handleRemoveAdmin = async (emailToRemove) => {
        if (emailToRemove === auth.currentUser?.email) {
            showToast("You cannot remove yourself!", "error");
            return;
        }

        try {
            await deleteDoc(doc(db, "admins", emailToRemove));
            setAdmins(admins.filter(a => a !== emailToRemove));
            showToast(`Removed ${emailToRemove} from admin whitelist`, "success");
        } catch (err) {
            console.error("Error removing admin:", err);
            showToast("Failed to remove admin", "error");
        }
    };

    if (loading) {
        return <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>Loading application settings...</div>;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', paddingBottom: '40px' }}>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <h3 className="section-title" style={{ margin: 0 }}>⚙️ Platform Settings Panel</h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>

                {/* BRANDING CARD */}
                <div style={{
                    background: 'var(--surface)',
                    padding: '24px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-soft)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '15px'
                }}>
                    <h4 style={{ margin: 0, color: 'var(--text-main)', borderBottom: '1px solid var(--border-soft)', paddingBottom: '10px' }}>🎨 Custom Branding</h4>

                    <div>
                        <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '5px', fontSize: '0.85rem' }}>Application Name</label>
                        <input
                            type="text"
                            className="admin-input"
                            style={{ width: '100%', margin: 0 }}
                            value={branding.appName}
                            onChange={(e) => setBranding({ ...branding, appName: e.target.value })}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '5px', fontSize: '0.85rem' }}>PWA Short Name</label>
                        <input
                            type="text"
                            className="admin-input"
                            style={{ width: '100%', margin: 0 }}
                            value={branding.appShortName}
                            onChange={(e) => setBranding({ ...branding, appShortName: e.target.value })}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '5px', fontSize: '0.85rem' }}>Logo Image URL (Leave blank for default)</label>
                        <input
                            type="text"
                            className="admin-input"
                            style={{ width: '100%', margin: 0 }}
                            value={branding.logoUrl || ""}
                            onChange={(e) => setBranding({ ...branding, logoUrl: e.target.value })}
                            placeholder="e.g. /pwa-512x512.png"
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '5px', fontSize: '0.85rem' }}>Custom Student Categories (Comma-separated)</label>
                        <input
                            type="text"
                            className="admin-input"
                            style={{ width: '100%', margin: 0 }}
                            value={Array.isArray(branding.studentCategories) ? branding.studentCategories.join(", ") : (branding.studentCategories || "")}
                            onChange={(e) => {
                                const val = e.target.value;
                                setBranding({ ...branding, studentCategories: val.split(",").map(x => x.trim()).filter(Boolean) });
                            }}
                            placeholder="Junior, Senior"
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '5px', fontSize: '0.85rem' }}>Custom Student Classes (Comma-separated)</label>
                        <textarea
                            className="admin-input"
                            style={{ width: '100%', margin: 0, height: '70px', fontFamily: 'inherit', resize: 'vertical' }}
                            value={Array.isArray(branding.studentClasses) ? branding.studentClasses.join(", ") : (branding.studentClasses || "")}
                            onChange={(e) => {
                                const val = e.target.value;
                                setBranding({ ...branding, studentClasses: val.split(",").map(x => x.trim()).filter(Boolean) });
                            }}
                            placeholder="1 THAMHEEDIYYA ULA, 2 THAMHEEDIYYA SANIYA..."
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div>
                            <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '5px', fontSize: '0.85rem' }}>Primary Color</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    type="color"
                                    value={branding.primaryColor}
                                    onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                                    style={{ width: '38px', height: '38px', border: 'none', borderRadius: '4px', background: 'transparent', cursor: 'pointer' }}
                                />
                                <input
                                    type="text"
                                    className="admin-input"
                                    style={{ margin: 0, width: 'calc(100% - 46px)' }}
                                    value={branding.primaryColor}
                                    onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '5px', fontSize: '0.85rem' }}>Secondary Accent</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    type="color"
                                    value={branding.secondaryColor}
                                    onChange={(e) => setBranding({ ...branding, secondaryColor: e.target.value })}
                                    style={{ width: '38px', height: '38px', border: 'none', borderRadius: '4px', background: 'transparent', cursor: 'pointer' }}
                                />
                                <input
                                    type="text"
                                    className="admin-input"
                                    style={{ margin: 0, width: 'calc(100% - 46px)' }}
                                    value={branding.secondaryColor}
                                    onChange={(e) => setBranding({ ...branding, secondaryColor: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div>
                            <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '5px', fontSize: '0.85rem' }}>Background Color</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    type="color"
                                    value={branding.backgroundColor}
                                    onChange={(e) => setBranding({ ...branding, backgroundColor: e.target.value })}
                                    style={{ width: '38px', height: '38px', border: 'none', borderRadius: '4px', background: 'transparent', cursor: 'pointer' }}
                                />
                                <input
                                    type="text"
                                    className="admin-input"
                                    style={{ margin: 0, width: 'calc(100% - 46px)' }}
                                    value={branding.backgroundColor}
                                    onChange={(e) => setBranding({ ...branding, backgroundColor: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '5px', fontSize: '0.85rem' }}>Surface Card Color</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    type="color"
                                    value={branding.surfaceColor}
                                    onChange={(e) => setBranding({ ...branding, surfaceColor: e.target.value })}
                                    style={{ width: '38px', height: '38px', border: 'none', borderRadius: '4px', background: 'transparent', cursor: 'pointer' }}
                                />
                                <input
                                    type="text"
                                    className="admin-input"
                                    style={{ margin: 0, width: 'calc(100% - 46px)' }}
                                    value={branding.surfaceColor}
                                    onChange={(e) => setBranding({ ...branding, surfaceColor: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleSaveBranding}
                        className="tab-btn"
                        style={{ background: 'var(--primary)', color: 'white', border: 'none', marginTop: '10px' }}
                    >
                        Save Branding Settings
                    </button>
                </div>

                {/* SCORING RULES CARD */}
                <div style={{
                    background: 'var(--surface)',
                    padding: '24px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-soft)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '15px'
                }}>
                    <h4 style={{ margin: 0, color: 'var(--text-main)', borderBottom: '1px solid var(--border-soft)', paddingBottom: '10px' }}>🥇 Scoring Rules Configuration</h4>

                    <div>
                        <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '5px', fontSize: '0.9rem', fontWeight: 'bold' }}>Category A (1st / 2nd / 3rd)</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                            <input type="number" className="admin-input" style={{ margin: 0 }} placeholder="1st" value={scoring.catA?.first} onChange={(e) => setScoring({ ...scoring, catA: { ...scoring.catA, first: Number(e.target.value) } })} />
                            <input type="number" className="admin-input" style={{ margin: 0 }} placeholder="2nd" value={scoring.catA?.second} onChange={(e) => setScoring({ ...scoring, catA: { ...scoring.catA, second: Number(e.target.value) } })} />
                            <input type="number" className="admin-input" style={{ margin: 0 }} placeholder="3rd" value={scoring.catA?.third} onChange={(e) => setScoring({ ...scoring, catA: { ...scoring.catA, third: Number(e.target.value) } })} />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '5px', fontSize: '0.9rem', fontWeight: 'bold' }}>Category B (1st / 2nd / 3rd)</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                            <input type="number" className="admin-input" style={{ margin: 0 }} placeholder="1st" value={scoring.catB?.first} onChange={(e) => setScoring({ ...scoring, catB: { ...scoring.catB, first: Number(e.target.value) } })} />
                            <input type="number" className="admin-input" style={{ margin: 0 }} placeholder="2nd" value={scoring.catB?.second} onChange={(e) => setScoring({ ...scoring, catB: { ...scoring.catB, second: Number(e.target.value) } })} />
                            <input type="number" className="admin-input" style={{ margin: 0 }} placeholder="3rd" value={scoring.catB?.third} onChange={(e) => setScoring({ ...scoring, catB: { ...scoring.catB, third: Number(e.target.value) } })} />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '5px', fontSize: '0.9rem', fontWeight: 'bold' }}>Category C (1st / 2nd / 3rd)</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                            <input type="number" className="admin-input" style={{ margin: 0 }} placeholder="1st" value={scoring.catC?.first} onChange={(e) => setScoring({ ...scoring, catC: { ...scoring.catC, first: Number(e.target.value) } })} />
                            <input type="number" className="admin-input" style={{ margin: 0 }} placeholder="2nd" value={scoring.catC?.second} onChange={(e) => setScoring({ ...scoring, catC: { ...scoring.catC, second: Number(e.target.value) } })} />
                            <input type="number" className="admin-input" style={{ margin: 0 }} placeholder="3rd" value={scoring.catC?.third} onChange={(e) => setScoring({ ...scoring, catC: { ...scoring.catC, third: Number(e.target.value) } })} />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '5px', fontSize: '0.9rem', fontWeight: 'bold' }}>General Group Event (1st / 2nd / 3rd)</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                            <input type="number" className="admin-input" style={{ margin: 0 }} placeholder="1st" value={scoring.general?.first} onChange={(e) => setScoring({ ...scoring, general: { ...scoring.general, first: Number(e.target.value) } })} />
                            <input type="number" className="admin-input" style={{ margin: 0 }} placeholder="2nd" value={scoring.general?.second} onChange={(e) => setScoring({ ...scoring, general: { ...scoring.general, second: Number(e.target.value) } })} />
                            <input type="number" className="admin-input" style={{ margin: 0 }} placeholder="3rd" value={scoring.general?.third} onChange={(e) => setScoring({ ...scoring, general: { ...scoring.general, third: Number(e.target.value) } })} />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '5px', fontSize: '0.9rem', fontWeight: 'bold' }}>Grade Points (A+ / A / B / C)</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
                            <input type="number" className="admin-input" style={{ margin: 0 }} placeholder="A+" value={scoring.grades?.ap} onChange={(e) => setScoring({ ...scoring, grades: { ...scoring.grades, ap: Number(e.target.value) } })} />
                            <input type="number" className="admin-input" style={{ margin: 0 }} placeholder="A" value={scoring.grades?.a} onChange={(e) => setScoring({ ...scoring, grades: { ...scoring.grades, a: Number(e.target.value) } })} />
                            <input type="number" className="admin-input" style={{ margin: 0 }} placeholder="B" value={scoring.grades?.b} onChange={(e) => setScoring({ ...scoring, grades: { ...scoring.grades, b: Number(e.target.value) } })} />
                            <input type="number" className="admin-input" style={{ margin: 0 }} placeholder="C" value={scoring.grades?.c} onChange={(e) => setScoring({ ...scoring, grades: { ...scoring.grades, c: Number(e.target.value) } })} />
                        </div>
                    </div>

                    <button
                        onClick={handleSaveScoring}
                        className="tab-btn"
                        style={{ background: 'var(--primary)', color: 'white', border: 'none', marginTop: '10px' }}
                    >
                        Save Scoring Config
                    </button>
                </div>

                {/* ADMIN WHITELIST CARD */}
                <div style={{
                    background: 'var(--surface)',
                    padding: '24px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-soft)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '15px'
                }}>
                    <h4 style={{ margin: 0, color: 'var(--text-main)', borderBottom: '1px solid var(--border-soft)', paddingBottom: '10px' }}>🔐 Dynamic Admin Whitelist</h4>

                    <form onSubmit={handleAddAdmin} style={{ display: 'flex', gap: '10px' }}>
                        <input
                            type="email"
                            placeholder="Add admin email..."
                            className="admin-input"
                            style={{ flex: 1, margin: 0 }}
                            value={newAdminEmail}
                            onChange={(e) => setNewAdminEmail(e.target.value)}
                            required
                        />
                        <button type="submit" className="tab-btn" style={{ background: 'var(--secondary)', color: 'white', border: 'none' }}>
                            Add Admin
                        </button>
                    </form>

                    <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {admins.length === 0 ? (
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No database-configured admins yet. (Hardcoded bootstrap admins still apply).</div>
                        ) : (
                            admins.map(email => (
                                <div key={email} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    background: 'var(--bg-main)',
                                    padding: '8px 12px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border-soft)'
                                }}>
                                    <span style={{ fontSize: '0.9rem', wordBreak: 'break-all' }}>{email}</span>
                                    <button
                                        onClick={() => handleRemoveAdmin(email)}
                                        style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}
                                        title="Remove Admin"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
