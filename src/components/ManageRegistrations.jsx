import { useState, useEffect } from "react";
import { collection, deleteDoc, doc, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import Toast from "./Toast";
import ConfirmDialog from "./ConfirmDialog";
import { useConfirm } from "../hooks/useConfirm";

export default function ManageRegistrations() {
    const [registrations, setRegistrations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [toast, setToast] = useState(null);
    const { confirm, confirmState } = useConfirm();
    const [sortConfig, setSortConfig] = useState({ key: 'chestNumber', direction: 'ascending' });

    const showToast = (message, type = 'info') => {
        setToast({ message, type });
    };

    const handleToastClose = () => {
        setToast(null);
    };

    useEffect(() => {
        // Real-time listener
        const q = query(collection(db, "registrations"), orderBy("submittedAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setRegistrations(list);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching registrations:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleDelete = async (id) => {
        if (!await confirm("Are you sure you want to delete this registration? This cannot be undone.")) return;
        try {
            await deleteDoc(doc(db, "registrations", id));
            showToast("Registration deleted successfully", "success");
        } catch (err) {
            console.error("Delete failed:", err);
            showToast("Failed to delete registration", "error");
        }
    };

    const filteredList = registrations.filter(reg => {
        const q = searchQuery.toLowerCase();
        return (
            reg.fullName?.toLowerCase().includes(q) ||
            reg.chestNumber?.toLowerCase().includes(q) ||
            reg.team?.toLowerCase().includes(q) ||
            reg.cicNumber?.toLowerCase().includes(q)
        );
    });

    const sortedList = [...filteredList].sort((a, b) => {
        let aValue = a[sortConfig.key] || "";
        let bValue = b[sortConfig.key] || "";

        if (['onStageEvents', 'offStageEvents', 'generalEvents'].includes(sortConfig.key)) {
            aValue = a[sortConfig.key]?.length || 0;
            bValue = b[sortConfig.key]?.length || 0;
        }

        const aNum = parseFloat(aValue);
        const bNum = parseFloat(bValue);
        if (!isNaN(aNum) && !isNaN(bNum)) {
            aValue = aNum;
            bValue = bNum;
        }

        if (aValue < bValue) {
            return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
            return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
    });

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (name) => {
        if (sortConfig.key !== name) return null;
        return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
    };

    return (
        <div className="manage-registrations">
            {toast && <Toast message={toast.message} type={toast.type} onClose={handleToastClose} />}
            {confirmState && <ConfirmDialog {...confirmState} />}

            <h3 className="section-title">Manage Registrations</h3>

            <div className="table-controls" style={{ marginBottom: '20px' }}>
                <input
                    type="text"
                    className="admin-input"
                    placeholder="🔍 Search by Name, Chest No, or Team..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ maxWidth: '400px', width: '100%' }}
                />
            </div>

            {loading ? <p>Loading registrations...</p> : (
                <div className="admin-table-container">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th onClick={() => requestSort('chestNumber')} style={{ cursor: 'pointer' }}>Chest No{getSortIndicator('chestNumber')}</th>
                                <th onClick={() => requestSort('fullName')} style={{ cursor: 'pointer' }}>Name{getSortIndicator('fullName')}</th>
                                <th onClick={() => requestSort('team')} style={{ cursor: 'pointer' }}>Team{getSortIndicator('team')}</th>
                                <th onClick={() => requestSort('onStageEvents')} style={{ cursor: 'pointer' }}>On Stage{getSortIndicator('onStageEvents')}</th>
                                <th onClick={() => requestSort('offStageEvents')} style={{ cursor: 'pointer' }}>Off Stage{getSortIndicator('offStageEvents')}</th>
                                <th onClick={() => requestSort('generalEvents')} style={{ cursor: 'pointer' }}>General{getSortIndicator('generalEvents')}</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedList.length > 0 ? sortedList.map((reg) => (
                                <tr key={reg.id}>
                                    <td style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{reg.chestNumber || "TBA"}</td>
                                    <td style={{ fontWeight: '600' }}>
                                        {reg.fullName}
                                        <div style={{ fontSize: '0.75rem', color: '#888', fontWeight: 'normal' }}>
                                            CIC: {reg.cicNumber}
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`team-badge team-${reg.team?.toUpperCase()}`}>
                                            {reg.team}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: '0.85rem' }}>
                                        {reg.onStageEvents?.length > 0 ? reg.onStageEvents.join(", ") : <span style={{ color: '#555' }}>-</span>}
                                    </td>
                                    <td style={{ fontSize: '0.85rem' }}>
                                        {reg.offStageEvents?.length > 0 ? reg.offStageEvents.join(", ") : <span style={{ color: '#555' }}>-</span>}
                                    </td>
                                    <td style={{ fontSize: '0.85rem' }}>
                                        {reg.generalEvents?.length > 0 ? reg.generalEvents.join(", ") : <span style={{ color: '#555' }}>-</span>}
                                    </td>
                                    <td>
                                        <button
                                            onClick={() => handleDelete(reg.id)}
                                            className="delete-btn"
                                            title="Delete Registration"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '30px' }}>
                                        {searchQuery ? "No matching registrations found." : "No registrations found in database."}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
