import { useState, useEffect } from "react";
import { collection, onSnapshot, addDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { useConfirm } from "../hooks/useConfirm";
import ConfirmDialog from "./ConfirmDialog";
import Toast from "./Toast";

// We need a secondary Firebase app to create users without logging the Admin out
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let secondaryApp;
let secondaryAuth;
try {
    secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
    secondaryAuth = getAuth(secondaryApp);
} catch (e) {
    console.error("Secondary app init error", e);
}

export default function ManageTeamAccounts() {
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);

    // Form State
    const [teamName, setTeamName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [teamColor, setTeamColor] = useState("#e63946");
    const [isCreating, setIsCreating] = useState(false);
    const [editId, setEditId] = useState(null);
    const [toast, setToast] = useState(null);

    const { confirm, confirmState } = useConfirm();

    const showToast = (message, type = 'info') => {
        setToast({ message, type });
    };

    const [detectedDbTeams, setDetectedDbTeams] = useState([]);
    const [loadingDetectedTeams, setLoadingDetectedTeams] = useState(false);

    // Fetch detected team names across existing database records
    const scanDatabaseTeamNames = async () => {
        setLoadingDetectedTeams(true);
        try {
            const { collection, getDocs } = await import("firebase/firestore");
            const teamCounts = {};

            const collectionsToScan = ["students", "registrations", "results"];
            for (const colName of collectionsToScan) {
                const snap = await getDocs(collection(db, colName));
                snap.docs.forEach(d => {
                    const t = d.data().team;
                    if (t && typeof t === "string") {
                        const normalized = t.trim().toUpperCase();
                        if (normalized) {
                            teamCounts[normalized] = (teamCounts[normalized] || 0) + 1;
                        }
                    }
                });
            }

            const list = Object.keys(teamCounts).map(name => ({
                name,
                count: teamCounts[name]
            })).sort((a, b) => b.count - a.count);

            setDetectedDbTeams(list);
        } catch (err) {
            console.error("Error scanning DB team names:", err);
        } finally {
            setLoadingDetectedTeams(false);
        }
    };

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, "teams"), (snapshot) => {
            const teamData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setTeams(teamData);
            setLoading(false);
        });

        scanDatabaseTeamNames();

        return () => unsubscribe();
    }, []);

    const [syncOldName, setSyncOldName] = useState("");
    const [syncNewName, setSyncNewName] = useState("");
    const [isSyncing, setIsSyncing] = useState(false);

    const handleCreateTeam = async (e) => {
        e.preventDefault();

        if (!editId && password.length < 6) {
            showToast("Password must be at least 6 characters long.", "error");
            return;
        }

        setIsCreating(true);
        try {
            if (editId) {
                // UPDATE EXISTING TEAM
                const oldTeamObj = teams.find(t => t.id === editId);
                const oldName = oldTeamObj?.name;
                const newName = teamName.toUpperCase().trim();

                const { updateDoc, collection, getDocs, writeBatch } = await import("firebase/firestore");
                await updateDoc(doc(db, "teams", editId), {
                    name: newName,
                    email: email.toLowerCase(),
                    color: teamColor,
                });

                if (oldName && oldName.trim().toUpperCase() !== newName) {
                    let totalSynced = 0;
                    const collectionsToSync = ["students", "registrations", "results"];

                    for (const colName of collectionsToSync) {
                        const snap = await getDocs(collection(db, colName));
                        const batch = writeBatch(db);
                        let countInCol = 0;

                        snap.docs.forEach(d => {
                            const data = d.data();
                            if (data.team && data.team.trim().toUpperCase() === oldName.trim().toUpperCase()) {
                                batch.update(d.ref, { team: newName });
                                countInCol++;
                            }
                        });

                        if (countInCol > 0) {
                            await batch.commit();
                            totalSynced += countInCol;
                        }
                    }
                    showToast(`Team updated & synced across ${totalSynced} records!`, "success");
                    scanDatabaseTeamNames();
                } else {
                    showToast("Team updated successfully!", "success");
                }
            } else {
                // CREATE NEW TEAM
                if (secondaryAuth) {
                    await createUserWithEmailAndPassword(secondaryAuth, email, password);
                    await secondaryAuth.signOut();
                }

                await addDoc(collection(db, "teams"), {
                    name: teamName.toUpperCase().trim(),
                    email: email.toLowerCase(),
                    color: teamColor,
                    createdAt: new Date().toISOString()
                });
                showToast("Team account created successfully!", "success");
            }

            // Reset form
            setTeamName("");
            setEmail("");
            setPassword("");
            setTeamColor("#e63946");
            setEditId(null);
        } catch (error) {
            console.error("Error creating team:", error);
            showToast("Error creating team account: " + error.message, "error");
        } finally {
            setIsCreating(false);
        }
    };

    const handleSyncOldTeamData = async (e) => {
        e.preventDefault();
        const fromName = syncOldName.trim().toUpperCase();
        const toName = syncNewName.trim().toUpperCase();

        if (!fromName || !toName) {
            showToast("Please specify both old and target team names.", "error");
            return;
        }

        if (fromName === toName) {
            showToast("Old and target team names are identical.", "error");
            return;
        }

        if (!await confirm(`Are you sure you want to replace all records for team "${fromName}" with "${toName}" across Students, Registrations, and Published Results?`)) return;

        setIsSyncing(true);
        try {
            const { collection, getDocs, writeBatch } = await import("firebase/firestore");
            let totalSynced = 0;
            const collectionsToSync = ["students", "registrations", "results"];

            for (const colName of collectionsToSync) {
                const snap = await getDocs(collection(db, colName));
                const batch = writeBatch(db);
                let countInCol = 0;

                snap.docs.forEach(d => {
                    const data = d.data();
                    if (data.team && data.team.trim().toUpperCase() === fromName) {
                        batch.update(d.ref, { team: toName });
                        countInCol++;
                    }
                });

                if (countInCol > 0) {
                    await batch.commit();
                    totalSynced += countInCol;
                }
            }

            if (totalSynced > 0) {
                showToast(`Successfully updated ${totalSynced} records from "${fromName}" to "${toName}"!`, "success");
                setSyncOldName("");
                setSyncNewName("");
                scanDatabaseTeamNames();
            } else {
                showToast(`No records found with team name "${fromName}".`, "error");
            }
        } catch (err) {
            console.error("Error syncing team names:", err);
            showToast("Failed to sync team records: " + err.message, "error");
        } finally {
            setIsSyncing(false);
        }
    };

    const handleDelete = async (id, name) => {
        if (!await confirm(`Are you sure you want to delete the team profile for ${name}?\n\nNOTE: This only removes the team from the registry. You must manually delete the Firebase Auth user in the Firebase Console.`)) return;

        try {
            await deleteDoc(doc(db, "teams", id));
            showToast("Team deleted.", "success");
            if (editId === id) handleCancelEdit();
        } catch (error) {
            showToast("Failed to delete team.", "error");
        }
    };

    const handleEdit = (team) => {
        setEditId(team.id);
        setTeamName(team.name);
        setEmail(team.email);
        setPassword("");
        setTeamColor(team.color || "#e63946");
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleCancelEdit = () => {
        setEditId(null);
        setTeamName("");
        setEmail("");
        setPassword("");
        setTeamColor("#e63946");
    };

    return (
        <div className="manage-events-container">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            {confirmState && <ConfirmDialog {...confirmState} />}
            <h3 className="section-title">🔐 Manage Team Accounts</h3>

            <div className="admin-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
                {/* Form Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="admin-card">
                        <h4>{editId ? "Edit Team" : "Create New Team"}</h4>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '15px' }}>
                            {editId
                                ? "Editing display details. Changing the name here automatically updates all students, participants, and results!"
                                : "This will generate a login for the team leader to register their candidates."}
                        </p>
                        <form onSubmit={handleCreateTeam} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Team Name</label>
                                <input
                                    type="text"
                                    className="admin-input"
                                    value={teamName}
                                    onChange={e => setTeamName(e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Team Color</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <input
                                        type="color"
                                        value={teamColor}
                                        onChange={e => setTeamColor(e.target.value)}
                                        style={{ width: '48px', height: '40px', padding: '2px', borderRadius: '8px', border: '1px solid var(--border-soft)', cursor: 'pointer', background: 'none' }}
                                    />
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{teamColor}</span>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: teamColor, boxShadow: `0 0 10px ${teamColor}66` }} />
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Login Email</label>
                                <input
                                    type="email"
                                    className="admin-input"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                            {!editId && (
                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Password</label>
                                    <input
                                        type="password"
                                        className="admin-input"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder="Min 6 characters"
                                        minLength={6}
                                        required={!editId}
                                    />
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button type="submit" className="admin-btn primary" disabled={isCreating} style={{ flex: 1 }}>
                                    {isCreating ? (editId ? "Updating..." : "Creating...") : (editId ? "Update Team & Sync" : "Create Team Account")}
                                </button>
                                {editId && (
                                    <button type="button" className="admin-btn" onClick={handleCancelEdit} style={{ background: 'var(--surface)' }}>
                                        Cancel
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>

                    {/* Migration / Sync Card */}
                    <div className="admin-card" style={{ border: '1px solid rgba(234, 179, 8, 0.3)', background: 'rgba(234, 179, 8, 0.05)' }}>
                        <h4 style={{ color: '#eab308', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>🔄</span> Sync Previously Renamed Team
                        </h4>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '15px' }}>
                            If you changed a team's name earlier and existing students or results still show the old name, enter them below to migrate all records in 1 click.
                        </p>
                        <form onSubmit={handleSyncOldTeamData} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.82rem', fontWeight: 'bold' }}>Old Team Name (Detected in Database)</label>
                                {detectedDbTeams.length > 0 ? (
                                    <select
                                        className="admin-input"
                                        value={syncOldName}
                                        onChange={e => setSyncOldName(e.target.value)}
                                        required
                                    >
                                        <option value="">-- Select Old Team Name Found in Database --</option>
                                        {detectedDbTeams.map(item => (
                                            <option key={item.name} value={item.name}>
                                                {item.name} ({item.count} records)
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        className="admin-input"
                                        value={syncOldName}
                                        onChange={e => setSyncOldName(e.target.value)}
                                        placeholder="e.g. OLD NAME"
                                        required
                                    />
                                )}
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.82rem', fontWeight: 'bold' }}>Target New Team Name</label>
                                <select
                                    className="admin-input"
                                    value={syncNewName}
                                    onChange={e => setSyncNewName(e.target.value)}
                                    required
                                >
                                    <option value="">-- Select Target Team --</option>
                                    {teams.map(t => (
                                        <option key={t.id} value={t.name}>{t.name}</option>
                                    ))}
                                </select>
                            </div>
                            <button type="submit" className="admin-btn" disabled={isSyncing} style={{ background: '#eab308', color: '#000', fontWeight: 'bold' }}>
                                {isSyncing ? "Syncing..." : "Sync All Team Records Now"}
                            </button>
                        </form>
                    </div>
                </div>

                {/* List Section */}
                <div className="admin-table-container">
                    {loading ? <p>Loading teams...</p> : (
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Color</th>
                                    <th>Team Name</th>
                                    <th>Login Email</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {teams.length > 0 ? teams.map(team => (
                                    <tr key={team.id}>
                                        <td>
                                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: team.color || '#e63946', boxShadow: `0 0 8px ${team.color || '#e63946'}88`, margin: '0 auto' }} />
                                        </td>
                                        <td style={{ fontWeight: 'bold', color: team.color || 'var(--primary-light)' }}>{team.name}</td>
                                        <td>{team.email}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    onClick={() => handleEdit(team)}
                                                    className="tab-btn"
                                                    style={{ padding: '4px 10px', fontSize: '0.8rem', minWidth: 'auto', background: 'var(--surface)' }}
                                                    title="Edit Team"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(team.id, team.name)}
                                                    className="action-btn delete"
                                                    title="Delete Team"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="4" style={{ textAlign: 'center', padding: '20px' }}>No teams registered yet.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
