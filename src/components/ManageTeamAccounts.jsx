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

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, "teams"), (snapshot) => {
            const teamData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setTeams(teamData);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

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
                const { updateDoc } = await import("firebase/firestore");
                await updateDoc(doc(db, "teams", editId), {
                    name: teamName.toUpperCase(),
                    email: email.toLowerCase(),
                    color: teamColor,
                });
                showToast("Team updated successfully!", "success");
            } else {
                // CREATE NEW TEAM
                if (secondaryAuth) {
                    await createUserWithEmailAndPassword(secondaryAuth, email, password);
                    await secondaryAuth.signOut();
                }

                await addDoc(collection(db, "teams"), {
                    name: teamName.toUpperCase(),
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
                <div className="admin-card">
                    <h4>{editId ? "Edit Team" : "Create New Team"}</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '15px' }}>
                        {editId
                            ? "Editing display details. Warning: This does not change their actual login password."
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
                                // placeholder="e.g. 123@aham.com"
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
                                {isCreating ? (editId ? "Updating..." : "Creating...") : (editId ? "Update Team" : "Create Team Account")}
                            </button>
                            {editId && (
                                <button type="button" className="admin-btn" onClick={handleCancelEdit} style={{ background: 'var(--surface)' }}>
                                    Cancel
                                </button>
                            )}
                        </div>
                    </form>
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
