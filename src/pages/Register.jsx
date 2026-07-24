import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, query, orderBy, doc, onSnapshot, updateDoc, where } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { Helmet } from "react-helmet-async";
import "./Register.css";
import { getEventType, isGeneralEvent, getEventScope, getGeneralSubtype } from "../constants/events";
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

    // Student Replacement States
    const [activeSubTab, setActiveSubTab] = useState("register"); // 'register' | 'general' | 'swap'
    const [selectedEventName, setSelectedEventName] = useState("");
    
    // Team General Events state
    const [teamGeneralEvents, setTeamGeneralEvents] = useState([]);
    const [selectedCurrentStudentRegId, setSelectedCurrentStudentRegId] = useState("");
    const [selectedReplacementChestNumber, setSelectedReplacementChestNumber] = useState("");
    const [replacementReason, setReplacementReason] = useState("");
    const [isSubmittingReplacement, setIsSubmittingReplacement] = useState(false);
    const [replacementRequestsList, setReplacementRequestsList] = useState([]);
    const [loadingReplacementRequests, setLoadingReplacementRequests] = useState(false);

    const fetchReplacementRequests = async (teamName) => {
        if (!teamName) return;
        setLoadingReplacementRequests(true);
        try {
            const q = query(
                collection(db, "replacementRequests"),
                where("team", "==", teamName)
            );
            const snap = await getDocs(q);
            const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            list.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
            setReplacementRequestsList(list);
        } catch (err) {
            console.error("Error fetching replacement requests:", err);
        } finally {
            setLoadingReplacementRequests(false);
        }
    };

    const handleReplacementSubmit = async (e) => {
        e.preventDefault();
        if (!selectedEventName || !selectedCurrentStudentRegId || !selectedReplacementChestNumber) {
            showToast("Please select the event, current student, and replacement student.");
            return;
        }

        const currentReg = existingRegistrations.find(r => r.id === selectedCurrentStudentRegId);
        const replacementStudent = masterStudents.find(s => s.chestNumber === selectedReplacementChestNumber);

        if (!currentReg || !replacementStudent) {
            showToast("Student information not found.");
            return;
        }

        if (currentReg.chestNumber === replacementStudent.chestNumber) {
            showToast("The current student and the replacement student cannot be the same.");
            return;
        }

        // Limit Check for the replacement student
        const targetEvent = events.find(ev => ev.name === selectedEventName);
        const eventType = targetEvent?.type || getEventType(selectedEventName);
        const eventIsGeneral = targetEvent?.type === 'General' || isGeneralEvent(selectedEventName);
        const replacementReg = existingRegistrations.find(r => 
            String(r.chestNumber).toUpperCase() === String(replacementStudent.chestNumber).toUpperCase()
        );

        if (replacementReg) {
            if (eventType === "On Stage" && !eventIsGeneral) {
                const currentOnStageCount = (replacementReg.onStageEvents || []).length;
                if (currentOnStageCount >= 4) {
                    if (!window.confirm(`Warning: The replacement student already has ${currentOnStageCount} On Stage event(s) registered (limit is 4).\n\nDo you still want to submit this request for Admin override (e.g. for interchanging events)?`)) {
                        return;
                    }
                }
            } else if (eventType === "Off Stage" && !eventIsGeneral) {
                const currentOffStageCount = (replacementReg.offStageEvents || []).length;
                if (currentOffStageCount >= 4) {
                    if (!window.confirm(`Warning: The replacement student already has ${currentOffStageCount} Off Stage event(s) registered (limit is 4).\n\nDo you still want to submit this request for Admin override (e.g. for interchanging events)?`)) {
                        return;
                    }
                }
            }
        }

        setIsSubmittingReplacement(true);
        try {
            await addDoc(collection(db, "replacementRequests"), {
                registrationId: selectedCurrentStudentRegId,
                eventName: selectedEventName,
                oldChestNumber: currentReg.chestNumber,
                oldStudentName: currentReg.fullName,
                newChestNumber: replacementStudent.chestNumber,
                newStudentName: replacementStudent.fullName,
                reason: replacementReason,
                status: 'pending',
                team: formData.team,
                requestedAt: new Date().toISOString(),
                requestedBy: user?.email || ""
            });

            showToast("Replacement request submitted successfully!");
            // Reset form
            setSelectedEventName("");
            setSelectedCurrentStudentRegId("");
            setSelectedReplacementChestNumber("");
            setReplacementReason("");
            
            // Refresh
            fetchReplacementRequests(formData.team);
        } catch (err) {
            console.error("Error submitting replacement request:", err);
            showToast("Failed to submit request: " + err.message);
        } finally {
            setIsSubmittingReplacement(false);
        }
    };
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
                            else if (teamNames.length > 0) teamName = teamNames[0];
                        }

                        if (teamName) {
                            setFormData(prev => ({ ...prev, team: teamName }));
                            fetchReplacementRequests(teamName);
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

        // Listen to Existing Registrations in real-time (for limit enforcement)
        const unsubscribeRegs = onSnapshot(collection(db, "registrations"), (snapshot) => {
            const regList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setExistingRegistrations(regList);
        }, (err) => {
            console.error("Error listening to registrations:", err);
        });

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
            unsubscribeRegs();
        };
    }, [navigate]);

    useEffect(() => {
        if (formData.team && existingRegistrations.length > 0) {
            const teamReg = existingRegistrations.find(r => 
                r.team === formData.team && 
                (!r.chestNumber || r.chestNumber === "")
            );
            if (teamReg) {
                setTeamGeneralEvents(teamReg.generalEvents || teamReg.events || []);
            } else {
                setTeamGeneralEvents([]);
            }
        }
    }, [formData.team, existingRegistrations]);

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

    const isExceptionIndividualEvent = (eventNameOrObj) => {
        if (!eventNameOrObj) return false;
        const name = typeof eventNameOrObj === 'object' ? eventNameOrObj.name : eventNameOrObj;
        const cleanName = name.trim().toUpperCase();
        return cleanName === "TED X TALK" || cleanName === "TED-X TALK";
    };

    const getStudentCategory = (chestNo) => {
        if (!chestNo) return "";
        const student = masterStudents.find(s => 
            String(s.chestNumber).trim().toUpperCase() === String(chestNo).trim().toUpperCase()
        );
        return student ? (student.category || student.studentCategory || "") : "";
    };

    const handleEventToggle = (eventName, type) => {
        setFormData(prev => {
            const currentList = prev.events;
            const eventNameUpper = String(eventName).trim().toUpperCase();
            if (currentList.map(e => String(e).trim().toUpperCase()).includes(eventNameUpper)) {
                return { ...prev, events: currentList.filter(e => String(e).trim().toUpperCase() !== eventNameUpper) };
            } else {
                // Check if already registered in past submissions
                if (formData.chestNumber) {
                    const pastRegs = existingRegistrations.filter(r => 
                        String(r.chestNumber).trim().toUpperCase() === String(formData.chestNumber).trim().toUpperCase()
                    );
                    const allPastEvents = [];
                    pastRegs.forEach(r => {
                        if (r.events) allPastEvents.push(...r.events);
                        if (r.onStageEvents) allPastEvents.push(...r.onStageEvents);
                        if (r.offStageEvents) allPastEvents.push(...r.offStageEvents);
                        if (r.generalEvents) allPastEvents.push(...r.generalEvents);
                    });
                    if (allPastEvents.map(e => String(e).trim().toUpperCase()).includes(eventNameUpper)) {
                        showToast(`You are already registered for ${eventName}.`);
                        return prev;
                    }
                }

                // Team Event Limit Check: Max 2 registrations per category per event per team (On Stage & Off Stage)
                if ((type === "On Stage" || type === "Off Stage") && formData.team) {
                    const currentCategory = getStudentCategory(formData.chestNumber);
                    const teamEventCountForCategory = existingRegistrations.filter(r => {
                        if (r.team !== formData.team) return false;
                        if (formData.chestNumber && String(r.chestNumber).trim().toUpperCase() === String(formData.chestNumber).trim().toUpperCase()) return false;
                        
                        if (currentCategory) {
                            const otherStudentCategory = getStudentCategory(r.chestNumber);
                            if (otherStudentCategory.toLowerCase() !== currentCategory.toLowerCase()) return false;
                        }

                        const allEvents = [
                            ...(r.events || []),
                            ...(r.onStageEvents || []),
                            ...(r.offStageEvents || []),
                            ...(r.generalEvents || [])
                        ].map(e => String(e).trim().toUpperCase());
                        return allEvents.includes(eventNameUpper);
                    }).length;

                    if (teamEventCountForCategory >= 2) {
                        const catLabel = currentCategory ? `${currentCategory} ` : "";
                        showToast(`Your team already has ${teamEventCountForCategory} ${catLabel}student(s) registered for "${eventName}" (limit is 2 per category).`);
                        return prev;
                    }
                }

                // Limit Check for On Stage events
                if (type === "On Stage" && !isExceptionIndividualEvent(eventName)) {
                    const onStageCount = currentList.filter(e => {
                        const found = events.find(ev => ev.name.trim().toUpperCase() === String(e).trim().toUpperCase());
                        const t = found?.type || getEventType(e);
                        return t === "On Stage" && !resolveIsGeneral(e);
                    }).length;

                    let pastOnStageCount = 0;
                    if (formData.chestNumber) {
                        const pastRegs = existingRegistrations.filter(r => 
                            String(r.chestNumber).trim().toUpperCase() === String(formData.chestNumber).trim().toUpperCase()
                        );
                        pastRegs.forEach(r => {
                            if (r.onStageEvents) pastOnStageCount += r.onStageEvents.length;
                        });
                    }

                    if (onStageCount + pastOnStageCount >= 4) {
                        if (pastOnStageCount > 0) {
                            showToast(`You already registered for ${pastOnStageCount} On Stage event(s) previously. You can only select a total of 4.`);
                        } else {
                            showToast("You can only select up to 4 On Stage events.");
                        }
                        return prev;
                    }
                }
                
                // Limit Check for Off Stage events
                if (type === "Off Stage" && !isExceptionIndividualEvent(eventName)) {
                    const offStageCount = currentList.filter(e => {
                        const found = events.find(ev => ev.name.trim().toUpperCase() === String(e).trim().toUpperCase());
                        const t = found?.type || getEventType(e);
                        return t === "Off Stage" && !resolveIsGeneral(e);
                    }).length;

                    let pastOffStageCount = 0;
                    if (formData.chestNumber) {
                        const pastRegs = existingRegistrations.filter(r => 
                            String(r.chestNumber).trim().toUpperCase() === String(formData.chestNumber).trim().toUpperCase()
                        );
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
                const pastRegs = existingRegistrations.filter(r => 
                    String(r.chestNumber).trim().toUpperCase() === String(formData.chestNumber).trim().toUpperCase()
                );
                pastRegs.forEach(r => {
                    if (r.onStageEvents) pastOnStageCount += r.onStageEvents.length;
                    if (r.offStageEvents) pastOffStageCount += r.offStageEvents.length;
                    
                    if (r.events) allPastEvents.push(...r.events);
                    if (r.onStageEvents) allPastEvents.push(...r.onStageEvents);
                    if (r.offStageEvents) allPastEvents.push(...r.offStageEvents);
                    if (r.generalEvents) allPastEvents.push(...r.generalEvents);
                });
            }

            const allPastEventsUpper = allPastEvents.map(e => String(e).trim().toUpperCase());
            const duplicateEvents = formData.events.filter(e => 
                allPastEventsUpper.includes(String(e).trim().toUpperCase())
            );
            if (duplicateEvents.length > 0) {
                showToast(`Submission blocked: You have already registered for ${duplicateEvents.join(", ")}`);
                setSubmitting(false);
                return;
            }

            // Team limit validation (Max 2 students per category per team per On/Off Stage event)
            for (const eventName of formData.events) {
                const isGeneral = resolveIsGeneral(eventName);
                const eventType = isGeneral ? getGeneralSubtype(eventName) : resolveEventType(eventName);
                if ((eventType === "On Stage" || eventType === "Off Stage") && (!isGeneral || isExceptionIndividualEvent(eventName))) {
                    const currentCategory = getStudentCategory(formData.chestNumber);
                    const teamEventCountForCategory = existingRegistrations.filter(r => {
                        if (r.team !== formData.team) return false;
                        if (formData.chestNumber && String(r.chestNumber).trim().toUpperCase() === String(formData.chestNumber).trim().toUpperCase()) return false;
                        
                        if (currentCategory) {
                            const otherStudentCategory = getStudentCategory(r.chestNumber);
                            if (otherStudentCategory.toLowerCase() !== currentCategory.toLowerCase()) return false;
                        }

                        const allEvents = [
                            ...(r.events || []),
                            ...(r.onStageEvents || []),
                            ...(r.offStageEvents || []),
                            ...(r.generalEvents || [])
                        ].map(e => String(e).trim().toUpperCase());
                        return allEvents.includes(String(eventName).trim().toUpperCase());
                    }).length;
                    
                    if (teamEventCountForCategory >= 2) {
                        const catLabel = currentCategory ? `${currentCategory} ` : "";
                        showToast(`Submission blocked: Your team already has ${teamEventCountForCategory} ${catLabel}student(s) registered for "${eventName}" (limit is 2 per category).`);
                        setSubmitting(false);
                        return;
                    }
                }
            }

            if (onStageEvents.length + pastOnStageCount > 4) {
                showToast(`Submission blocked: You already registered for ${pastOnStageCount} On Stage event(s) previously. You can only select up to 4 total.`);
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
                String(r.chestNumber).trim().toUpperCase() === String(formData.chestNumber).trim().toUpperCase()
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

    const handleTeamGeneralEventToggle = (eventName) => {
        setTeamGeneralEvents(prev => {
            if (prev.includes(eventName)) {
                return prev.filter(e => e !== eventName);
            } else {
                return [...prev, eventName];
            }
        });
    };

    const handleTeamGeneralSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        if (!formData.team) {
            showToast("Please select a team.");
            setSubmitting(false);
            return;
        }

        try {
            const existingTeamReg = existingRegistrations.find(r => 
                r.team === formData.team && 
                (!r.chestNumber || r.chestNumber === "")
            );

            // Clean chestNumber, cicNumber, and fullName for team registration
            const teamRegData = {
                fullName: "Team Registration",
                chestNumber: "",
                cicNumber: "",
                team: formData.team,
                events: teamGeneralEvents,
                onStageEvents: [],
                offStageEvents: [],
                generalEvents: teamGeneralEvents,
                submittedAt: new Date().toISOString()
            };

            if (existingTeamReg) {
                await updateDoc(doc(db, "registrations", existingTeamReg.id), teamRegData);
            } else {
                await addDoc(collection(db, "registrations"), teamRegData);
            }

            // Sync local form state to trigger correct success view
            setFormData(prev => ({
                ...prev,
                fullName: "Team Registration",
                chestNumber: "",
                cicNumber: "",
                category: "",
                events: teamGeneralEvents
            }));

            showToast("Team general events registered successfully!");
            
            // Refresh local registrations
            const q = query(collection(db, "registrations"));
            const snapshot = await getDocs(q);
            const regList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setExistingRegistrations(regList);
            setSuccess(true);
        } catch (error) {
            console.error("Team registration error:", error);
            showToast("Failed to submit team registration. Please try again.");
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

    const onStageList = events.filter(e => {
        const isGeneral = resolveIsGeneral(e);
        const isException = isExceptionIndividualEvent(e);
        const type = isGeneral ? getGeneralSubtype(e.name) : resolveEventType(e);
        const matchesType = type === "On Stage" && (!isGeneral || isException);
        return matchesType && filterByScope(e) && searchFilter(e);
    });
    const offStageList = events.filter(e => {
        const isGeneral = resolveIsGeneral(e);
        const isException = isExceptionIndividualEvent(e);
        const type = isGeneral ? getGeneralSubtype(e.name) : resolveEventType(e);
        const matchesType = type === "Off Stage" && (!isGeneral || isException);
        return matchesType && filterByScope(e) && searchFilter(e);
    });
    const generalList = events.filter(e => resolveIsGeneral(e) && !isExceptionIndividualEvent(e) && filterByScope(e) && searchFilter(e));

    const teamRegs = existingRegistrations.filter(r => r.team === formData.team);
    
    const teamRegisteredEvents = (() => {
        const activeEventsSet = new Set();
        teamRegs.forEach(r => {
            const allEvents = [
                ...(r.events || []),
                ...(r.onStageEvents || []),
                ...(r.offStageEvents || []),
                ...(r.generalEvents || [])
            ];
            allEvents.forEach(eName => activeEventsSet.add(eName));
        });
        return Array.from(activeEventsSet).sort();
    })();

    const candidatesForSelectedEvent = teamRegs.filter(r => {
        const allEvents = [
            ...(r.events || []),
            ...(r.onStageEvents || []),
            ...(r.offStageEvents || []),
            ...(r.generalEvents || [])
        ].map(e => String(e).trim().toUpperCase());
        return allEvents.includes(String(selectedEventName).trim().toUpperCase());
    });

    const replacementCandidates = masterStudents
        .filter(s => formData.team ? s.team === formData.team : true)
        .filter(s => {
            const isAlreadyRegistered = existingRegistrations.some(r => 
                String(r.chestNumber).trim().toUpperCase() === String(s.chestNumber).trim().toUpperCase() &&
                [
                    ...(r.events || []),
                    ...(r.onStageEvents || []),
                    ...(r.offStageEvents || []),
                    ...(r.generalEvents || [])
                ].map(e => String(e).trim().toUpperCase()).includes(String(selectedEventName).trim().toUpperCase())
            );
            return !isAlreadyRegistered;
        });

    if (success) {
        const isTeamReg = !formData.chestNumber;
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
                        {isTeamReg ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', marginBottom: '24px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Registration Type</label>
                                    <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-main)' }}>Team Events (General)</div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Team</label>
                                    <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--primary)' }}>{formData.team}</div>
                                </div>
                            </div>
                        ) : (
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
                        )}

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

            {/* TAB SELECTOR */}
            <div className="category-tabs" style={{ marginBottom: '25px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button
                    type="button"
                    className={`category-tab ${activeSubTab === 'register' ? 'active' : ''}`}
                    onClick={() => setActiveSubTab('register')}
                    style={{ flex: '1', maxWidth: '250px' }}
                >
                    📝 Register Candidate
                </button>
                <button
                    type="button"
                    className={`category-tab ${activeSubTab === 'general' ? 'active' : ''}`}
                    onClick={() => setActiveSubTab('general')}
                    style={{ flex: '1', maxWidth: '250px' }}
                >
                    🌐 Register Team (General)
                </button>
                <button
                    type="button"
                    className={`category-tab ${activeSubTab === 'swap' ? 'active' : ''}`}
                    onClick={() => {
                        setActiveSubTab('swap');
                        if (formData.team) fetchReplacementRequests(formData.team);
                    }}
                    style={{ flex: '1', maxWidth: '250px' }}
                >
                    🔄 Replace Candidate
                </button>
            </div>

            {activeSubTab === 'register' && (
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
            )}

            {activeSubTab === 'general' && (
                <div className="register-form">
                    <form onSubmit={handleTeamGeneralSubmit}>
                        <div className="form-section">
                            <div className="section-label">Team Classification</div>
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

                        <div className="form-section">
                            <div className="section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                <span>Select General Events for your Team</span>
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

                            {loading ? <div className="spinner"></div> : (
                                categoryStatus.general ? (
                                    <div className="events-selection-grid stagger-reveal-grid" style={{ marginTop: '15px' }}>
                                        {generalList.length > 0 ? generalList.map(ev => {
                                            const subtype = ev.generalSubtype || (getEventType(ev.name) !== "Unknown" ? getEventType(ev.name) : "On Stage");
                                            return (
                                                <label key={ev.id} className="event-checkbox-label premium-glass-hover">
                                                    <input
                                                        type="checkbox"
                                                        checked={teamGeneralEvents.includes(ev.name)}
                                                        onChange={() => handleTeamGeneralEventToggle(ev.name)}
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
                                    <div className="registration-closed-msg" style={{ padding: '20px', textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', marginTop: '15px' }}>
                                        <p style={{ margin: 0, fontWeight: 'bold' }}>🔒 Registration for General events is currently closed.</p>
                                    </div>
                                )
                            )}
                        </div>

                        {/* SUBMIT */}
                        <div className="submit-container">
                            <button type="submit" className="register-btn" disabled={submitting}>
                                {submitting ? (
                                    <span><span className="spinner" style={{ width: '14px', height: '14px', marginRight: '8px' }}></span> Saving...</span>
                                ) : "Submit Team Events"}
                            </button>
                        </div>
                    </form>
                </div>
            )}
            
            {activeSubTab === "swap" && (
                    <div className="register-form">
                        <div className="form-section">
                            <div className="section-label">Request Candidate Replacement / Substitution</div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
                                Choose an event, select the candidate you wish to remove/replace, and select the student who will take their place. Replacements require admin approval.
                            </p>
                            
                            <form onSubmit={handleReplacementSubmit}>
                                <div className="input-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                                    <div className="form-group">
                                        <label>Select Event *</label>
                                        <select
                                            className="form-select"
                                            value={selectedEventName}
                                            onChange={(e) => {
                                                setSelectedEventName(e.target.value);
                                                setSelectedCurrentStudentRegId("");
                                                setSelectedReplacementChestNumber("");
                                            }}
                                            required
                                        >
                                            <option value="">-- Select Registered Event --</option>
                                            {teamRegisteredEvents.map(evName => (
                                                <option key={evName} value={evName}>{evName}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {selectedEventName && (
                                        <div className="form-group">
                                            <label>Current Candidate to Replace *</label>
                                            <select
                                                className="form-select"
                                                value={selectedCurrentStudentRegId}
                                                onChange={(e) => setSelectedCurrentStudentRegId(e.target.value)}
                                                required
                                            >
                                                <option value="">-- Select Candidate --</option>
                                                {candidatesForSelectedEvent.map(r => (
                                                    <option key={r.id} value={r.id}>
                                                        {r.chestNumber} - {r.fullName}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {selectedEventName && selectedCurrentStudentRegId && (
                                        <div className="form-group">
                                            <label>New Replacement Student *</label>
                                            <select
                                                className="form-select"
                                                value={selectedReplacementChestNumber}
                                                onChange={(e) => setSelectedReplacementChestNumber(e.target.value)}
                                                required
                                            >
                                                <option value="">-- Select Replacement Student --</option>
                                                {replacementCandidates.map(s => (
                                                    <option key={s.id} value={s.chestNumber}>
                                                        {s.chestNumber} - {s.fullName} ({s.studentCategory || "No Category"})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>

                                {selectedEventName && selectedCurrentStudentRegId && selectedReplacementChestNumber && (
                                    <>
                                        <div className="form-group" style={{ marginBottom: '20px' }}>
                                            <label>Reason / Notes for Admin (Optional)</label>
                                            <textarea
                                                className="form-input"
                                                value={replacementReason}
                                                onChange={(e) => setReplacementReason(e.target.value)}
                                                placeholder="Explain why this substitution is needed (e.g. candidate absent/sick)..."
                                                style={{ width: '100%', minHeight: '80px', padding: '10px', background: 'var(--bg-main)', border: '1px solid var(--border-soft)', borderRadius: '8px', color: 'var(--text-main)' }}
                                            />
                                        </div>

                                        <div className="submit-container" style={{ display: 'flex', justifyContent: 'flex-start' }}>
                                            <button type="submit" className="register-btn" disabled={isSubmittingReplacement} style={{ padding: '12px 24px', width: 'auto' }}>
                                                {isSubmittingReplacement ? "Submitting Request..." : "Submit Substitution Request"}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </form>
                        </div>

                        {/* HISTORY OF REPLACEMENT REQUESTS */}
                        <div className="form-section" style={{ marginTop: '40px' }}>
                            <div className="section-label">Substitution Request History</div>
                            {loadingReplacementRequests ? <p style={{ color: 'var(--text-muted)' }}>Loading history...</p> : (
                                replacementRequestsList.length === 0 ? (
                                    <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>No replacement requests submitted yet.</p>
                                ) : (
                                    <div style={{ overflowX: 'auto', marginTop: '15px' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                                            <thead>
                                                <tr style={{ borderBottom: '1px solid var(--border-soft)', color: 'var(--text-muted)' }}>
                                                    <th style={{ padding: '10px 5px' }}>Date</th>
                                                    <th style={{ padding: '10px 5px' }}>Event</th>
                                                    <th style={{ padding: '10px 5px' }}>Current Student</th>
                                                    <th style={{ padding: '10px 5px' }}>Replacement Student</th>
                                                    <th style={{ padding: '10px 5px' }}>Status</th>
                                                    <th style={{ padding: '10px 5px' }}>Admin Comment</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {replacementRequestsList.map(req => (
                                                    <tr key={req.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                                        <td style={{ padding: '10px 5px', color: 'var(--text-muted)' }}>
                                                            {new Date(req.requestedAt).toLocaleDateString()}
                                                        </td>
                                                        <td style={{ padding: '10px 5px', fontWeight: 'bold' }}>
                                                            {req.eventName}
                                                        </td>
                                                        <td style={{ padding: '10px 5px', color: '#ef4444' }}>
                                                            {req.oldStudentName} ({req.oldChestNumber})
                                                        </td>
                                                        <td style={{ padding: '10px 5px', color: '#10b981' }}>
                                                            {req.newStudentName} ({req.newChestNumber})
                                                        </td>
                                                        <td style={{ padding: '10px 5px' }}>
                                                            <span style={{
                                                                padding: '2px 8px',
                                                                borderRadius: '4px',
                                                                fontSize: '0.75rem',
                                                                fontWeight: 'bold',
                                                                background: req.status === 'approved' ? 'rgba(16, 185, 129, 0.15)' : (req.status === 'rejected' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)'),
                                                                color: req.status === 'approved' ? '#10b981' : (req.status === 'rejected' ? '#ef4444' : '#f59e0b'),
                                                                border: `1px solid ${req.status === 'approved' ? '#10b981' : (req.status === 'rejected' ? '#ef4444' : '#f59e0b')}`
                                                            }}>
                                                                {req.status ? req.status.toUpperCase() : 'PENDING'}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '10px 5px', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>
                                                            {req.adminComment || "-"}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )
                            )}
                        </div>
                    </div>
            )}
        </div>
    );
}
