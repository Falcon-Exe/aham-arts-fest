import { useState, useEffect } from "react";
import { collection, query, getDocs, updateDoc, doc, onSnapshot, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import Toast from "./Toast";
import ConfirmDialog from "./ConfirmDialog";
import { useConfirm } from "../hooks/useConfirm";
import { getEventType, isGeneralEvent } from "../constants/events";

export default function ManageReplacements() {
    const [requests, setRequests] = useState([]);
    const [events, setEvents] = useState([]);
    const [registrations, setRegistrations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("pending"); // 'pending' | 'history'
    const [toast, setToast] = useState(null);
    const { confirm, confirmState } = useConfirm();
    const [adminComments, setAdminComments] = useState({}); // { requestId: commentText }
    const [studentsList, setStudentsList] = useState([]);

    const showToast = (message, type = 'info') => {
        setToast({ message, type });
    };

    const handleToastClose = () => {
        setToast(null);
    };

    // Load requests, registrations, events, and students
    useEffect(() => {
        const unsubRequests = onSnapshot(collection(db, "replacementRequests"), (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Sort by requestedAt descending
            list.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
            setRequests(list);
            setLoading(false);
        });

        const unsubRegs = onSnapshot(collection(db, "registrations"), (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setRegistrations(list);
        });

        const fetchEventsAndStudents = async () => {
            try {
                const q = query(collection(db, "events"));
                const snap = await getDocs(q);
                setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));

                const studentSnap = await getDocs(collection(db, "students"));
                setStudentsList(studentSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (err) {
                console.error("Error fetching events/students:", err);
            }
        };
        fetchEventsAndStudents();

        return () => {
            unsubRequests();
            unsubRegs();
        };
    }, []);

    const getStudentEventCount = (chestNumber) => {
        const reg = registrations.find(r => 
            String(r.chestNumber).trim().toUpperCase() === String(chestNumber).trim().toUpperCase()
        );
        if (!reg) return { onstage: 0, offstage: 0 };
        return {
            onstage: (reg.onStageEvents || []).length,
            offstage: (reg.offStageEvents || []).length
        };
    };

    const getStudentCategory = (chestNumber) => {
        if (!chestNumber) return "";
        const student = studentsList.find(s => 
            String(s.chestNumber).trim().toUpperCase() === String(chestNumber).trim().toUpperCase()
        );
        return student ? (student.category || student.studentCategory || "") : "";
    };

    const getTeamCategoryEventCount = (teamName, eventName, category, excludeChestNumber = "") => {
        if (!teamName || !eventName || !category) return 0;
        
        return registrations.filter(r => {
            if (r.team !== teamName) return false;
            if (excludeChestNumber && String(r.chestNumber).trim().toUpperCase() === String(excludeChestNumber).trim().toUpperCase()) return false;
            
            // Check student category
            const sCat = getStudentCategory(r.chestNumber);
            if (sCat.toLowerCase() !== category.toLowerCase()) return false;

            const allEvents = [
                ...(r.events || []),
                ...(r.onStageEvents || []),
                ...(r.offStageEvents || []),
                ...(r.generalEvents || [])
            ].map(e => String(e).trim().toUpperCase());
            return allEvents.includes(String(eventName).trim().toUpperCase());
        }).length;
    };

    const handleCommentChange = (reqId, value) => {
        setAdminComments(prev => ({ ...prev, [reqId]: value }));
    };

    const resolveEventType = (eventName) => {
        const found = events.find(ev => ev.name === eventName);
        if (found && found.type) return found.type;
        return getEventType(eventName);
    };

    const resolveIsGeneral = (eventName) => {
        const found = events.find(ev => ev.name === eventName);
        if (found && found.type === 'General') return true;
        return isGeneralEvent(eventName);
    };

    const isExceptionIndividualEvent = (name) => {
        if (!name) return false;
        const cleanName = name.trim().toUpperCase();
        return cleanName === "TED X TALK" || cleanName === "TED-X TALK";
    };

    const handleApprove = async (request) => {
        const comment = adminComments[request.id] || "";
        
        const evType = resolveEventType(request.eventName);
        const isGeneral = resolveIsGeneral(request.eventName);
        let warningSuffix = "";
        let teamWarning = "";
        
        if ((evType === "On Stage" || evType === "Off Stage") && (!isGeneral || isExceptionIndividualEvent(request.eventName))) {
            // Only check the individual 4-event limit for non-exception (non-General) events
            if (!isExceptionIndividualEvent(request.eventName)) {
                const counts = getStudentEventCount(request.newChestNumber);
                const count = evType === "On Stage" ? counts.onstage : counts.offstage;
                if (count >= 4) {
                    warningSuffix = `\n\n⚠️ WARNING: The replacement student "${request.newStudentName}" already has ${count} ${evType} event(s) registered (limit is 4). Approving this will cause them to exceed the limit.`;
                }
            }

            const currentCategory = getStudentCategory(request.newChestNumber);
            if (currentCategory) {
                const teamCatCount = getTeamCategoryEventCount(request.team, request.eventName, currentCategory, request.oldChestNumber);
                if (teamCatCount >= 2) {
                    teamWarning = `\n\n⚠️ TEAM LIMIT WARNING: Your team already has ${teamCatCount} ${currentCategory} student(s) registered for "${request.eventName}" (limit is 2 per category). Approving this swap will violate the team category limit.`;
                }
            }
        }

        if (!await confirm(`Are you sure you want to APPROVE this substitution?\n\nThis will replace candidate "${request.oldStudentName}" (${request.oldChestNumber}) with "${request.newStudentName}" (${request.newChestNumber}) for the event "${request.eventName}".${warningSuffix}${teamWarning}`)) return;

        try {
            const batch = writeBatch(db);

            // 1. Load registrations
            const regSnap = await getDocs(collection(db, "registrations"));
            
            // Find old student's registration
            const oldRegDoc = regSnap.docs.find(d => 
                String(d.data().chestNumber).trim().toUpperCase() === String(request.oldChestNumber).trim().toUpperCase()
            );

            if (!oldRegDoc) {
                showToast("Original candidate's registration record not found.", "error");
                return;
            }

            // Remove event from old student's lists
            const oldRegData = oldRegDoc.data();
            const cleanArray = (arr, val) => (arr || []).filter(item => 
                String(item).trim().toUpperCase() !== String(val).trim().toUpperCase()
            );
            
            batch.update(doc(db, "registrations", oldRegDoc.id), {
                events: cleanArray(oldRegData.events, request.eventName),
                onStageEvents: cleanArray(oldRegData.onStageEvents, request.eventName),
                offStageEvents: cleanArray(oldRegData.offStageEvents, request.eventName),
                generalEvents: cleanArray(oldRegData.generalEvents, request.eventName),
                submittedAt: new Date().toISOString()
            });

            // Find new student's registration
            const newRegDoc = regSnap.docs.find(d => 
                String(d.data().chestNumber).trim().toUpperCase() === String(request.newChestNumber).trim().toUpperCase()
            );

            const newEventType = resolveEventType(request.eventName);
            const newEventIsGeneral = resolveIsGeneral(request.eventName);

            if (newRegDoc) {
                // Add event to new student's registration lists
                const newRegData = newRegDoc.data();
                const addToArray = (arr, val, condition) => {
                    const cleaned = (arr || []).filter(item => 
                        String(item).trim().toUpperCase() !== String(val).trim().toUpperCase()
                    );
                    if (condition) cleaned.push(val);
                    return Array.from(new Set(cleaned));
                };

                batch.update(doc(db, "registrations", newRegDoc.id), {
                    events: addToArray(newRegData.events, request.eventName, true),
                    onStageEvents: addToArray(newRegData.onStageEvents, request.eventName, newEventType === "On Stage" && !newEventIsGeneral),
                    offStageEvents: addToArray(newRegData.offStageEvents, request.eventName, newEventType === "Off Stage" && !newEventIsGeneral),
                    generalEvents: addToArray(newRegData.generalEvents, request.eventName, newEventIsGeneral),
                    submittedAt: new Date().toISOString()
                });
            } else {
                // Create a new registration document for new student
                // Fetch student details from master students
                const studentSnap = await getDocs(collection(db, "students"));
                const studentDoc = studentSnap.docs.find(d => 
                    String(d.data().chestNumber).trim().toUpperCase() === String(request.newChestNumber).trim().toUpperCase()
                );
                
                const cicNo = studentDoc ? studentDoc.data().cicNumber || "" : "";
                const category = studentDoc ? studentDoc.data().studentCategory || studentDoc.data().category || "" : "";

                const newRegRef = doc(collection(db, "registrations"));
                batch.set(newRegRef, {
                    fullName: request.newStudentName,
                    chestNumber: request.newChestNumber,
                    cicNumber: cicNo,
                    category: category,
                    team: request.team,
                    events: [request.eventName],
                    onStageEvents: newEventType === "On Stage" && !newEventIsGeneral ? [request.eventName] : [],
                    offStageEvents: newEventType === "Off Stage" && !newEventIsGeneral ? [request.eventName] : [],
                    generalEvents: newEventIsGeneral ? [request.eventName] : [],
                    submittedAt: new Date().toISOString()
                });
            }

            // Update results (if any results were recorded for the old candidate)
            const resultsSnap = await getDocs(collection(db, "results"));
            resultsSnap.docs.forEach(resDoc => {
                const resData = resDoc.data();
                if (String(resData.chestNo).trim().toUpperCase() === String(request.oldChestNumber).trim().toUpperCase() &&
                    String(resData.eventName).trim().toUpperCase() === String(request.eventName).trim().toUpperCase()) {
                    
                    batch.update(resDoc.ref, {
                        chestNo: request.newChestNumber,
                        name: request.newStudentName
                    });
                }
            });

            // Update request document
            batch.update(doc(db, "replacementRequests", request.id), {
                status: "approved",
                adminComment: comment,
                resolvedAt: new Date().toISOString()
            });

            await batch.commit();
            showToast("Substitution approved and database updated successfully!", "success");
        } catch (err) {
            console.error("Approve failed:", err);
            showToast("Failed to approve request: " + err.message, "error");
        }
    };

    const handleReject = async (request) => {
        const comment = adminComments[request.id] || "";
        if (!await confirm(`Are you sure you want to REJECT this substitution request?`)) return;

        try {
            await updateDoc(doc(db, "replacementRequests", request.id), {
                status: "rejected",
                adminComment: comment,
                resolvedAt: new Date().toISOString()
            });
            showToast("Swap request rejected.", "info");
        } catch (err) {
            console.error("Reject failed:", err);
            showToast("Failed to reject request.", "error");
        }
    };

    const pendingRequests = requests.filter(r => r.status === "pending" || !r.status);
    const historyRequests = requests.filter(r => r.status === "approved" || r.status === "rejected");

    return (
        <div className="manage-replacements">
            {toast && <Toast message={toast.message} type={toast.type} onClose={handleToastClose} />}
            {confirmState && <ConfirmDialog {...confirmState} />}
            
            <h3 className="section-title">🔄 Candidate Substitution Requests</h3>

            <div className="category-tabs" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <button 
                    onClick={() => setActiveTab("pending")} 
                    className={`tab-btn ${activeTab === "pending" ? "active" : ""}`}
                >
                    📥 Pending Requests ({pendingRequests.length})
                </button>
                <button 
                    onClick={() => setActiveTab("history")} 
                    className={`tab-btn ${activeTab === "history" ? "active" : ""}`}
                >
                    📜 Request History ({historyRequests.length})
                </button>
            </div>

            {loading ? <p>Loading requests...</p> : (
                activeTab === "pending" ? (
                    pendingRequests.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No pending candidate substitution requests.</p>
                    ) : (
                        <div className="admin-table-container">
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Team</th>
                                        <th>Event Name</th>
                                        <th>Current Candidate</th>
                                        <th>Replacement Candidate</th>
                                        <th>Reason / Notes</th>
                                        <th>Admin Comment</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pendingRequests.map(req => (
                                        <tr key={req.id}>
                                            <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                {new Date(req.requestedAt).toLocaleString()}
                                            </td>
                                            <td style={{ fontWeight: 'bold' }}>{req.team}</td>
                                            <td style={{ fontWeight: '600', color: 'var(--primary-light)' }}>{req.eventName}</td>
                                            <td>
                                                <div style={{ fontWeight: '600', color: '#ef4444' }}>{req.oldStudentName}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Chest: {req.oldChestNumber}</div>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: '600', color: '#10b981' }}>{req.newStudentName}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Chest: {req.newChestNumber}</div>
                                                {(() => {
                                                    const evType = resolveEventType(req.eventName);
                                                    const isGeneral = resolveIsGeneral(req.eventName);
                                                    if ((evType === "On Stage" || evType === "Off Stage") && (!isGeneral || isExceptionIndividualEvent(req.eventName))) {
                                                        const counts = getStudentEventCount(req.newChestNumber);
                                                        const count = evType === "On Stage" ? counts.onstage : counts.offstage;
                                                        const currentCategory = getStudentCategory(req.newChestNumber);
                                                        
                                                        return (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                                                                {count >= 4 && !isExceptionIndividualEvent(req.eventName) && (
                                                                    <div style={{ 
                                                                        color: '#facc15', 
                                                                        fontSize: '0.75rem', 
                                                                        fontWeight: 'bold', 
                                                                        display: 'inline-block',
                                                                        padding: '2px 6px',
                                                                        background: 'rgba(250, 204, 21, 0.1)',
                                                                        borderRadius: '4px',
                                                                        border: '1px solid rgba(250, 204, 21, 0.2)',
                                                                        width: 'max-content'
                                                                    }}>
                                                                        ⚠️ Exceeds Limit ({count}/4 {evType})
                                                                    </div>
                                                                )}
                                                                {(() => {
                                                                    if (currentCategory) {
                                                                        const teamCatCount = getTeamCategoryEventCount(req.team, req.eventName, currentCategory, req.oldChestNumber);
                                                                        if (teamCatCount >= 2) {
                                                                            return (
                                                                                <div style={{ 
                                                                                    color: '#ef4444', 
                                                                                    fontSize: '0.75rem', 
                                                                                    fontWeight: 'bold', 
                                                                                    display: 'inline-block',
                                                                                    padding: '2px 6px',
                                                                                    background: 'rgba(239, 68, 68, 0.1)',
                                                                                    borderRadius: '4px',
                                                                                    border: '1px solid rgba(239, 68, 68, 0.2)',
                                                                                    width: 'max-content'
                                                                                }}>
                                                                                    ⚠️ Team Category Limit Reached ({teamCatCount}/2 {currentCategory})
                                                                                </div>
                                                                            );
                                                                        }
                                                                    }
                                                                    return null;
                                                                })()}
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                })()}
                                            </td>
                                            <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '200px', wordBreak: 'break-word' }}>
                                                {req.reason || <span style={{ fontStyle: 'italic', color: '#666' }}>None provided</span>}
                                            </td>
                                            <td>
                                                <input 
                                                    type="text" 
                                                    className="admin-input" 
                                                    value={adminComments[req.id] || ""}
                                                    onChange={(e) => handleCommentChange(req.id, e.target.value)}
                                                    placeholder="Optional feedback..."
                                                    style={{ padding: '6px 10px', fontSize: '0.85rem', minWidth: '150px' }}
                                                />
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button 
                                                        onClick={() => handleApprove(req)} 
                                                        className="tab-btn" 
                                                        style={{ background: '#10b981', color: '#fff', border: 'none', padding: '6px 12px', fontSize: '0.8rem', fontWeight: 'bold' }}
                                                    >
                                                        Approve
                                                    </button>
                                                    <button 
                                                        onClick={() => handleReject(req)} 
                                                        className="delete-btn"
                                                        style={{ padding: '6px 12px', fontSize: '0.8rem', fontWeight: 'bold' }}
                                                    >
                                                        Reject
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                ) : (
                    historyRequests.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No resolved substitution requests found.</p>
                    ) : (
                        <div className="admin-table-container">
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Requested</th>
                                        <th>Team</th>
                                        <th>Event Name</th>
                                        <th>Current Candidate</th>
                                        <th>Replacement Candidate</th>
                                        <th>Status</th>
                                        <th>Comment</th>
                                        <th>Resolved At</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {historyRequests.map(req => (
                                        <tr key={req.id}>
                                            <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                {new Date(req.requestedAt).toLocaleDateString()}
                                            </td>
                                            <td>{req.team}</td>
                                            <td style={{ fontWeight: '600' }}>{req.eventName}</td>
                                            <td style={{ color: '#ef4444', textDecoration: 'line-through' }}>
                                                {req.oldStudentName} ({req.oldChestNumber})
                                            </td>
                                            <td style={{ color: '#10b981' }}>
                                                {req.newStudentName} ({req.newChestNumber})
                                            </td>
                                            <td>
                                                <span style={{
                                                    padding: '2px 8px',
                                                    borderRadius: '4px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 'bold',
                                                    background: req.status === 'approved' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                                    color: req.status === 'approved' ? '#10b981' : '#ef4444',
                                                    border: `1px solid ${req.status === 'approved' ? '#10b981' : '#ef4444'}`
                                                }}>
                                                    {req.status.toUpperCase()}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                {req.adminComment || "-"}
                                            </td>
                                            <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                {req.resolvedAt ? new Date(req.resolvedAt).toLocaleString() : "-"}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                )
            )}
        </div>
    );
}
