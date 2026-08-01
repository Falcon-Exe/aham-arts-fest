import { useState, useEffect, useCallback } from "react";
import { collection, addDoc, orderBy, query, deleteDoc, doc, updateDoc, setDoc, onSnapshot, deleteField, writeBatch, increment, serverTimestamp, arrayUnion } from "firebase/firestore";
import { getDocs } from "firebase/firestore";
import { db, auth } from "../firebase";
import Toast from "./Toast";
import ConfirmDialog from "./ConfirmDialog";
import { useConfirm } from "../hooks/useConfirm";
import { useMasterParticipants } from "../hooks/useMasterParticipants";
import { isGeneralEvent, getEventType, resolveClassCategory, getEventScope } from "../constants/events";
import { calculatePoints } from "../utils/scoringRules";
import { compressImage } from "../utils/imageOptimizer";
import { logAppEvent } from "../utils/analytics";
import styles from "./ManageResults.module.css";

export const getEventCategoryBreakdown = (ev, resultsList = []) => {
    if (!ev) return { targetCats: [], breakdown: [], isFullyCompleted: false, hasAnyResults: false, label: "" };

    const isGen = ev.type === "General" || isGeneralEvent(ev.name);
    const scope = getEventScope(ev.name);

    let targetCats = [];
    if (isGen || ev.studentCategory === "General") {
        targetCats = ["General"];
    } else if (ev.studentCategory === "Junior") {
        targetCats = ["Junior"];
    } else if (ev.studentCategory === "Senior") {
        targetCats = ["Senior"];
    } else if (ev.studentCategory === "Junior & Senior" || ev.studentCategory === "Junior/Senior") {
        targetCats = ["Junior", "Senior"];
    } else if (scope === "Junior") {
        targetCats = ["Junior"];
    } else if (scope === "Senior") {
        targetCats = ["Senior"];
    } else {
        targetCats = ["Junior", "Senior"];
    }

    const eventResults = resultsList.filter(r =>
        r.eventId === ev.id ||
        (r.eventName && ev.name && r.eventName.toLowerCase().trim() === ev.name.toLowerCase().trim())
    );

    const breakdown = targetCats.map(cat => {
        const catRes = eventResults.filter(r => {
            const rCat = (r.studentCategory || "").trim();
            if (cat === "General") {
                return !rCat || rCat === "General";
            }
            return rCat.toUpperCase() === cat.toUpperCase();
        });

        const hasFirst = catRes.some(r => r.place === "First");
        const hasSecond = catRes.some(r => r.place === "Second");
        const hasThird = catRes.some(r => r.place === "Third");
        const count = catRes.length;

        let status = "pending";
        let icon = "⚪";

        if (hasFirst && (hasSecond || hasThird || count >= 3)) {
            status = "completed";
            icon = "🟢";
        } else if (count > 0 || hasFirst || hasSecond || hasThird) {
            status = "in_progress";
            icon = "🟡";
        }

        return {
            category: cat,
            status,
            icon,
            count,
            hasFirst,
            hasSecond,
            hasThird,
            catRes
        };
    });

    const isFullyCompleted = breakdown.length > 0 && breakdown.every(b => b.status === "completed");
    const hasAnyResults = breakdown.some(b => b.count > 0);

    const parts = breakdown.map(b => `${b.category}: ${b.icon} ${b.status === 'completed' ? 'Done' : b.status === 'in_progress' ? 'In Prog' : 'Pending'}`);
    const label = parts.length > 0 ? `[${parts.join(" | ")}]` : "";

    return {
        targetCats,
        breakdown,
        isFullyCompleted,
        hasAnyResults,
        label
    };
};

export default function ManageResults() {
    const [events, setEvents] = useState([]);
    const [results, setResults] = useState([]);
    const { participants: masterParticipants } = useMasterParticipants();
    const [filteredParticipants, setFilteredParticipants] = useState([]);
    const [allRegisteredParticipants, setAllRegisteredParticipants] = useState([]);
    const [publishCategoryFilter, setPublishCategoryFilter] = useState("All");
    const [selectedStudentId, setSelectedStudentId] = useState("");
    const [editId, setEditId] = useState(null);
    const [formData, setFormData] = useState({
        eventId: "",
        eventName: "",
        place: "First",
        name: "",
        team: "",
        grade: "",
        chestNo: "",
        studentCategory: ""
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showHomePoints, setShowHomePoints] = useState(false);
    const [showResultsPoints, setShowResultsPoints] = useState(false);
    const [showEventResults, setShowEventResults] = useState(true);
    const [toast, setToast] = useState(null);
    const { confirm, confirmState } = useConfirm();
    const [liveTeams, setLiveTeams] = useState([]);
    const [scoringConfig, setScoringConfig] = useState(null);

    const showToast = (message, type = 'info') => {
        setToast({ message, type });
    };

    const handleToastClose = () => {
        setToast(null);
    };

    // Subscribe to settings/publicConfig for Points & Event Results Visibility
    useEffect(() => {
        const unsubscribe = onSnapshot(doc(db, "settings", "publicConfig"), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                // Initialize with legacy showPoints if new fields don't exist
                setShowHomePoints(data.showHomePoints ?? data.showPoints);
                setShowResultsPoints(data.showResultsPoints ?? data.showPoints);
                setShowEventResults(data.showEventResults ?? true);
            }
        });
        const unsubscribeScoring = onSnapshot(doc(db, "settings", "scoring"), (doc) => {
            if (doc.exists()) {
                setScoringConfig(doc.data());
            }
        });
        return () => {
            unsubscribe();
            unsubscribeScoring();
        };
    }, []);

    const toggleHomePoints = async () => {
        try {
            await setDoc(doc(db, "settings", "publicConfig"), { showHomePoints: !showHomePoints }, { merge: true });
        } catch (err) {
            console.error("Error toggling home points:", err);
            showToast("Failed to update settings.", "error");
        }
    };

    const toggleResultsPoints = async () => {
        try {
            await setDoc(doc(db, "settings", "publicConfig"), { showResultsPoints: !showResultsPoints }, { merge: true });
        } catch (err) {
            console.error("Error toggling results points:", err);
            showToast("Failed to update settings.", "error");
        }
    };

    const toggleEventResults = async () => {
        try {
            await setDoc(doc(db, "settings", "publicConfig"), { showEventResults: !showEventResults }, { merge: true });
            showToast(`Event results are now ${!showEventResults ? 'VISIBLE' : 'HIDDEN'} to the public.`, "success");
        } catch (err) {
            console.error("Error toggling event results:", err);
            showToast("Failed to update settings.", "error");
        }
    };

    // Fetch Events
    const fetchEvents = useCallback(async () => {
        const q = query(collection(db, "events"), orderBy("name"));
        const snap = await getDocs(q);
        setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, []);

    const fetchResults = useCallback(async () => {
        const q = query(collection(db, "results"), orderBy("eventName"));
        const snap = await getDocs(q);
        setResults(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, []);

    useEffect(() => {
        const run = async () => {
            await fetchEvents();
            await fetchResults();
        };
        run();

        // Fetch Dynamic Teams
        const unsubTeams = onSnapshot(collection(db, "teams"), (snap) => {
            const teamNames = snap.docs.map(doc => doc.data().name);
            setLiveTeams(teamNames);
        });

        return () => unsubTeams();
    }, [fetchEvents, fetchResults]);


    const filterParticipantsByCategory = (participants, catFilter) => {
        if (!catFilter || catFilter === "All") return participants;
        return participants.filter(p => {
            const pClass = p["CLASS"] || p["STUDENT CLASS"] || p["CLASS NAME"] || p["class"] || "";
            const resolved = resolveClassCategory(pClass, p["CATEGORY"] || p["STUDENT CATEGORY"]);
            return resolved.trim().toUpperCase() === catFilter.trim().toUpperCase();
        });
    };

    const handleEventChange = (e) => {
        const eventId = e.target.value;
        const ev = events.find(event => event.id === eventId);
        const eventName = ev?.name || "";

        let defaultCat = "All";
        if (ev?.studentCategory === "Junior") defaultCat = "Junior";
        else if (ev?.studentCategory === "Senior") defaultCat = "Senior";
        else if (ev?.studentCategory === "General") defaultCat = "General";

        setPublishCategoryFilter(defaultCat);
        setFormData({ ...formData, eventId, eventName, name: "", team: "", chestNo: "", studentCategory: defaultCat !== "All" ? defaultCat : "" });
        setSelectedStudentId("");

        if (eventName) {
            const registered = masterParticipants.filter(p => {
                const onStage = p["ON STAGE EVENTS"] || p["ON STAGE ITEMS"] || "";
                const offStage = p["OFF STAGE EVENTS"] || p["OFF STAGE ITEMS"] || p["OFF STAGE ITEMES"] || "";
                const general = p["GENERAL EVENTS"] || p["OFF STAGE - GENERAL"] || p["ON STAGE - GENERAL"] || "";

                const allEventsList = (onStage + "," + offStage + "," + general).split(',').map(s => s.trim().toUpperCase());
                return allEventsList.includes(eventName.toUpperCase().trim());
            });
            setAllRegisteredParticipants(registered);
            setFilteredParticipants(filterParticipantsByCategory(registered, defaultCat));
        } else {
            setAllRegisteredParticipants([]);
            setFilteredParticipants([]);
        }
    };

    const handleStudentChange = (e) => {
        const val = e.target.value;
        setSelectedStudentId(val);

        if (val === "Manual Entry") {
            setFormData({ ...formData, name: "", team: "", chestNo: "" });
            return;
        }

        const student = filteredParticipants.find(p => p._id === val);

        if (student) {
            const studentClass = student["CLASS"] || student["STUDENT CLASS"] || student["CLASS NAME"] || student["class"] || "";
            const resolvedCat = resolveClassCategory(studentClass, student["CATEGORY"] || student["STUDENT CATEGORY"]);
            setFormData({
                ...formData,
                name: student["CANDIDATE NAME"] || student["CANDIDATE  FULL NAME"],
                team: student["TEAM"] || student["TEAM NAME"] || "",
                chestNo: student["CHEST NUMBER"] || student["CHEST NO"] || "",
                studentClass: studentClass,
                studentCategory: resolvedCat !== "General" ? resolvedCat : (formData.studentCategory || "General")
            });
        }
    };

    const checkRegistration = (studentName, eventName, chestNo = null, studentId = null) => {
        if (masterParticipants.length === 0) return { status: 'loading', msg: '' };

        let candidates = [];

        // 0. Try finding by ID (most precise, used in Submit)
        if (studentId && studentId !== "Manual Entry") {
            candidates = masterParticipants.filter(p => p._id === studentId);
        }

        // 1. Try finding by Chest Number (if provided) - precise match
        if (candidates.length === 0 && chestNo) {
            candidates = masterParticipants.filter(p =>
                String(p["CHEST NUMBER"] || p["CHEST NO"] || "").trim() === String(chestNo).trim()
            );
        }

        // 2. Fallback to Name (Smart Lookup: Prioritize valid registration)
        if (candidates.length === 0) {
            candidates = masterParticipants.filter(p =>
                (p["CANDIDATE NAME"] || p["CANDIDATE  FULL NAME"])?.trim().toLowerCase() === studentName.trim().toLowerCase()
            );
        }

        if (candidates.length === 0) {
            return { status: 'error', msg: `Student "${studentName}" not found in master list!`, studentObj: null };
        }

        // Aggregate events across ALL matched rows (in case a student's registration is split across multiple rows)
        let combinedOnStage = [];
        let combinedOffStage = [];
        let combinedGeneral = [];

        candidates.forEach(student => {
            if (student["ON STAGE ITEMS"]) combinedOnStage.push(student["ON STAGE ITEMS"]);
            if (student["ON STAGE EVENTS"]) combinedOnStage.push(student["ON STAGE EVENTS"]);
            if (student["OFF STAGE ITEMES"]) combinedOffStage.push(student["OFF STAGE ITEMES"]);
            if (student["OFF STAGE ITEMS"]) combinedOffStage.push(student["OFF STAGE ITEMS"]);
            if (student["OFF STAGE EVENTS"]) combinedOffStage.push(student["OFF STAGE EVENTS"]);
            if (student["GENERAL EVENTS"]) combinedGeneral.push(student["GENERAL EVENTS"]);
            if (student["OFF STAGE - GENERAL"]) combinedGeneral.push(student["OFF STAGE - GENERAL"]);
            if (student["ON STAGE - GENERAL"]) combinedGeneral.push(student["ON STAGE - GENERAL"]);
        });

        const allEventsList = [...combinedOnStage, ...combinedOffStage, ...combinedGeneral]
            .join(",")
            .split(',')
            .map(s => s.trim().toUpperCase());

        const baseStudent = candidates[0]; // Use the first row for metadata (category, chest no, etc)

        // Exact Check
        if (!allEventsList.includes(eventName.toUpperCase().trim())) {
            return { status: 'warning', msg: `Student is found, but NOT registered for "${eventName}".`, studentObj: baseStudent };
        }

        return { status: 'success', msg: 'Verified Registration ✓', studentObj: baseStudent };
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return; // Block re-entry on double-click
        if (!formData.eventId || !formData.name) {
            showToast("Please select an event and enter name", "error");
            return;
        }

        // Registration Validation
        const eventObj = events.find(e => e.id === formData.eventId);
        const regCheck = checkRegistration(formData.name, eventObj?.name || "", formData.chestNo, selectedStudentId);

        let autoRegister = false;
        if (regCheck.status === 'error') {
            if (!await confirm(`${regCheck.msg}\n\nDo you want to proceed anyway?`)) return;
        } else if (regCheck.status === 'warning') {
            const shouldRegister = await confirm(`${regCheck.msg}\n\nDo you want to automatically REGISTER the student for this event and proceed? (Clicking Cancel will skip registration and proceed anyway)`);
            if (shouldRegister) {
                autoRegister = true;
            }
        }

        let actualStudentCategory = eventObj?.studentCategory || "General";
        const studentClass = regCheck.studentObj ? (regCheck.studentObj["CLASS"] || regCheck.studentObj["STUDENT CLASS"] || regCheck.studentObj["CLASS NAME"] || regCheck.studentObj["class"] || "") : (formData.studentClass || "");

        if (actualStudentCategory === "Junior & Senior" || actualStudentCategory === "Junior/Senior") {
            const resolvedFromClass = resolveClassCategory(studentClass, regCheck.studentObj ? (regCheck.studentObj["CATEGORY"] || regCheck.studentObj["STUDENT CATEGORY"]) : formData.studentCategory);
            actualStudentCategory = resolvedFromClass !== "General" ? resolvedFromClass : (formData.studentCategory || "Junior");
        } else {
            actualStudentCategory = resolveClassCategory(studentClass, actualStudentCategory);
        }

        // Validation: Prevent duplicate place for same event AND same category (excluding current edit)
        const isDuplicatePlace = results.some(r =>
            r.id !== editId && r.eventId === formData.eventId && r.place === formData.place && r.studentCategory === actualStudentCategory
        );
        if (isDuplicatePlace) {
            const confirmed = await confirm(`A ${formData.place} Place winner already exists for this event in the ${actualStudentCategory} category. Do you want to add another one (Tie)?`);
            if (!confirmed) return;
        }

        setIsSubmitting(true);
        try {
            // Find event details
            const ev = events.find(e => e.id === formData.eventId);
            const category = ev?.category || "A"; // Default to A if missing
            const place = formData.place;
            const grade = formData.grade;

            const isGeneral = ev?.type === "General" || isGeneralEvent(ev?.name);
            const totalPoints = calculatePoints({
                category,
                place,
                grade
            }, scoringConfig);

            const batch = writeBatch(db);

            if (autoRegister && selectedStudentId && selectedStudentId !== "Manual Entry") {
                const regRef = doc(db, "registrations", selectedStudentId);
                const evName = ev?.name;
                const isGeneral = ev?.type === "General" || isGeneralEvent(evName);
                const evType = ev?.type || getEventType(evName);

                if (isGeneral) {
                    batch.update(regRef, {
                        generalEvents: arrayUnion(evName),
                        events: arrayUnion(evName)
                    });
                } else if (evType === "On Stage") {
                    batch.update(regRef, {
                        onStageEvents: arrayUnion(evName),
                        events: arrayUnion(evName)
                    });
                } else if (evType === "Off Stage") {
                    batch.update(regRef, {
                        offStageEvents: arrayUnion(evName),
                        events: arrayUnion(evName)
                    });
                }
            }

            const payload = {
                ...formData,
                eventName: ev?.name || "Unknown",
                category: isGeneral ? "General" : category,
                studentCategory: actualStudentCategory,
                studentClass: studentClass || formData.studentClass || "",
                points: totalPoints,
                timestamp: serverTimestamp() // Better than static string for ranking integrity
            };

            const resultRef = editId ? doc(db, "results", editId) : doc(collection(db, "results"));

            if (editId) {
                batch.update(resultRef, payload);
            } else {
                batch.set(resultRef, payload);
            }

            // Client-Side Leaderboard Update
            if (payload.team && totalPoints > 0) {
                // Note: True bullet-proof edit logic requires a cloud function to diff old/new points.
                const teamScoreRef = doc(db, "teamScores", payload.team.toUpperCase());
                batch.set(teamScoreRef, {
                    totalPoints: increment(totalPoints),
                    // Track General vs Regular points separately for category-based display
                    ...(isGeneral
                        ? { generalPoints: increment(totalPoints) }
                        : { regularPoints: increment(totalPoints) }
                    ),
                    lastUpdated: serverTimestamp()
                }, { merge: true });
            }

            // Audit Log
            const auditRef = doc(collection(db, "auditLogs"));
            batch.set(auditRef, {
                action: editId ? "update_result" : "publish_result",
                timestamp: serverTimestamp(),
                event: payload.eventName,
                team: payload.team,
                pointsAwarded: totalPoints,
                resultId: resultRef.id,
                admin: auth.currentUser?.email || "unknown"
            });

            await batch.commit();

            showToast(editId ? `Result updated! Points: ${totalPoints}` : `Result published! Points: ${totalPoints}`, "success");
            logAppEvent(editId ? 'result_updated' : 'result_published', { event: payload.eventName, category: payload.category, place: payload.place, points: totalPoints });

            const currentEvId = formData.eventId;
            const currentEvName = payload.eventName || formData.eventName;
            const publishedPlace = formData.place;
            const currentStudentCat = formData.studentCategory;

            // Auto-advance prize place
            let nextPlace = "First";
            if (publishedPlace === "First") nextPlace = "Second";
            else if (publishedPlace === "Second") nextPlace = "Third";
            else if (publishedPlace === "Third") nextPlace = "First";

            await fetchResults();

            if (editId) {
                setEditId(null);
                setFormData(prev => ({
                    ...prev,
                    place: "First",
                    name: "",
                    team: "",
                    grade: "",
                    chestNo: ""
                }));
                setSelectedStudentId("");
            } else {
                // Retain selected event so form does not refresh/reset event selection!
                setFormData(prev => ({
                    ...prev,
                    eventId: currentEvId,
                    eventName: currentEvName,
                    place: nextPlace,
                    name: "",
                    team: "",
                    grade: "",
                    chestNo: "",
                    studentCategory: currentStudentCat || (publishCategoryFilter !== "All" ? publishCategoryFilter : "")
                }));
                setSelectedStudentId("");

                if (currentEvName) {
                    const registered = masterParticipants.filter(p => {
                        const onStage = p["ON STAGE EVENTS"] || p["ON STAGE ITEMS"] || "";
                        const offStage = p["OFF STAGE EVENTS"] || p["OFF STAGE ITEMS"] || p["OFF STAGE ITEMES"] || "";
                        const general = p["GENERAL EVENTS"] || p["OFF STAGE - GENERAL"] || p["ON STAGE - GENERAL"] || "";
                        const allEventsList = (onStage + "," + offStage + "," + general).split(',').map(s => s.trim().toUpperCase());
                        return allEventsList.includes(currentEvName.toUpperCase().trim());
                    });
                    setAllRegisteredParticipants(registered);
                    setFilteredParticipants(filterParticipantsByCategory(registered, publishCategoryFilter));
                }
            }
        } catch (err) {
            console.error(err);
            showToast("Error saving result", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (result) => {
        const ev = events.find(event => event.id === result.eventId);
        const eventName = ev?.name || "";

        // Populate registered students for this event first
        if (eventName) {
            const registered = masterParticipants.filter(p => {
                const onStage = p["ON STAGE EVENTS"] || "";
                const offStage = p["OFF STAGE EVENTS"] || "";
                const general = p["GENERAL EVENTS"] || p["OFF STAGE - GENERAL"] || p["ON STAGE - GENERAL"] || "";
                const allEventsList = (onStage + "," + offStage + "," + general).split(',').map(s => s.trim().toUpperCase());
                return allEventsList.includes(eventName.toUpperCase().trim());
            });
            setFilteredParticipants(registered);

            // Try to find the exact student by Name + ChestNo
            const match = registered.find(p =>
                (p["CANDIDATE NAME"] || p["CANDIDATE  FULL NAME"]) === result.name &&
                (!result.chestNo || (p["CHEST NUMBER"] || p["CHEST NO"]) == result.chestNo)
            );

            if (match) {
                setSelectedStudentId(match._id);
            } else {
                setSelectedStudentId("Manual Entry");
            }
        }

        setFormData({
            eventId: result.eventId || "",
            eventName: result.eventName || "",
            place: result.place || "First",
            name: result.name || "",
            team: result.team || "",
            grade: result.grade || "",
            chestNo: result.chestNo || "",
            studentCategory: result.studentCategory || ""
        });
        setEditId(result.id);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleCancelEdit = () => {
        setFormData({
            eventId: "",
            eventName: "",
            place: "First",
            name: "",
            team: "",
            grade: "",
            chestNo: "",
            studentCategory: ""
        });
        setSelectedStudentId("");
        setEditId(null);
    };

    const handleBulkUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            let csvData = event.target.result;
            if (csvData.charCodeAt(0) === 0xFEFF) csvData = csvData.slice(1);

            const lines = csvData.split(/\r?\n/).filter(line => line.trim() !== "");
            if (lines.length < 2) {
                if (lines.length < 2) {
                    showToast("CSV file seems empty or only contains headers.", "error");
                    return;
                }
            }

            const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
            let addedCount = 0;
            let skipCount = 0;

            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(",").map(v => v.trim());
                const row = {};
                headers.forEach((header, i) => {
                    row[header] = values[i] || "";
                });

                // Header mapping: event, name, team, prize/place, grade, chestno
                const eventName = row.event || row.eventname;
                const studentName = row.name || row.studentname;
                const teamName = row.team;
                const prize = row.prize || row.place;
                const grade = row.grade;
                const chestNo = row.chestno || row.chestnumber;

                if (eventName && studentName) {
                    // Match event name to event ID
                    const matchedEvent = events.find(e => e.name.toLowerCase() === eventName.toLowerCase());

                    if (matchedEvent) {
                        try {
                            // Validation within bulk upload
                            const regCheck = checkRegistration(studentName, matchedEvent.name, chestNo);
                            if (regCheck.status !== 'success') {
                                console.warn(`Bulk warning for ${studentName}: ${regCheck.msg}`);
                            }

                            const isGeneral = matchedEvent.type === "General" || isGeneralEvent(matchedEvent.name);
                            const category = matchedEvent.category || "A";
                            const calculatedPts = calculatePoints({
                                category,
                                place: prize,
                                grade,
                                isGeneral
                            }, scoringConfig);

                            let actualStudentCategory = matchedEvent.studentCategory || "General";
                            if (actualStudentCategory === "Junior & Senior" && regCheck.studentObj) {
                                actualStudentCategory = regCheck.studentObj["CATEGORY"] || regCheck.studentObj["STUDENT CATEGORY"] || "General";
                            }

                            await addDoc(collection(db, "results"), {
                                eventId: matchedEvent.id,
                                eventName: matchedEvent.name,
                                name: studentName,
                                team: teamName,
                                place: prize,
                                grade: grade,
                                chestNo: chestNo,
                                points: calculatedPts,
                                category: isGeneral ? "General" : category,
                                studentCategory: actualStudentCategory,
                                timestamp: serverTimestamp()
                            });
                            addedCount++;
                        } catch (err) {
                            console.error("Result row failed:", i, err);
                            skipCount++;
                        }
                    } else {
                        console.warn("No event found matching:", eventName);
                        skipCount++;
                    }
                } else {
                    skipCount++;
                }
            }
            showToast(`Results Upload Finished! Added: ${addedCount}, Skipped: ${skipCount}`, "success");
            fetchResults();
        };
        reader.readAsText(file);
    };

    const downloadResultsCSV = () => {
        if (results.length === 0) return;

        // Custom columns requested: Team, Event, Published, Prize, Chest No, Grade, Name
        const headers = ["Team", "Event", "Published", "Prize", "Chest No", "Grade", "Name"];
        const rows = results.map(r => [
            `"${r.team}"`,
            `"${r.eventName}"`,
            `"Yes"`, // Published status
            `"${r.place}"`, // Prize
            `"${r.chestNo || ''}"`,
            `"${r.grade || ''}"`,
            `"${r.name}"`
        ]);

        const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "hamartia_results.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDelete = async (id) => {
        if (!await confirm("Delete this result?")) return;
        const targetRes = results.find(r => r.id === id);
        await deleteDoc(doc(db, "results", id));
        try {
            await addDoc(collection(db, "auditLogs"), {
                action: "delete_result",
                timestamp: serverTimestamp(),
                event: targetRes?.eventName || "Unknown",
                team: targetRes?.team || "Unknown",
                pointsAwarded: targetRes?.points ? -targetRes.points : 0,
                resultId: id,
                admin: auth.currentUser?.email || "unknown"
            });
        } catch (e) {
            console.error("Audit log write failed on delete:", e);
        }
        fetchResults();
    }

    const handleRecalculatePoints = async () => {
        if (!await confirm("This will recalculate points and automatically resolve missing/generic candidate categories (Junior/Senior) for ALL published results. Continue?")) return;
        let updated = 0;

        for (const r of results) {
            const ev = events.find(e => e.id === r.eventId);

            const category = ev?.category || r.category || "A";
            const place = r.place;
            const grade = r.grade;

            const isGeneral = ev?.type === "General" || isGeneralEvent(ev?.name || r.eventName);
            const totalPoints = calculatePoints({
                category,
                place,
                grade
            }, scoringConfig);

            let expectedStudentCategory = r.studentCategory;
            let expectedStudentClass = r.studentClass || r.class || "";

            const candidateMatch = masterParticipants.find(p =>
                (r.chestNo && String(p["CHEST NUMBER"] || p["CHEST NO"]).trim() === String(r.chestNo).trim()) ||
                ((p["CANDIDATE NAME"] || p["CANDIDATE  FULL NAME"])?.trim().toLowerCase() === r.name?.trim().toLowerCase())
            );

            if (candidateMatch) {
                if (!expectedStudentClass) {
                    expectedStudentClass = candidateMatch["CLASS"] || candidateMatch["STUDENT CLASS"] || candidateMatch["class"] || "";
                }
                const resolvedCat = resolveClassCategory(expectedStudentClass, candidateMatch["CATEGORY"] || candidateMatch["STUDENT CATEGORY"]);
                if (resolvedCat !== "General") {
                    expectedStudentCategory = resolvedCat;
                }
            }

            // Fallback to event definition if available
            if (!expectedStudentCategory || expectedStudentCategory === "Junior & Senior") {
                expectedStudentCategory = resolveClassCategory(expectedStudentClass, ev?.studentCategory && ev.studentCategory !== "Junior & Senior" ? ev.studentCategory : "General");
            }

            if (r.points !== totalPoints || r.studentCategory !== expectedStudentCategory || r.studentClass !== expectedStudentClass) {
                await updateDoc(doc(db, "results", r.id), {
                    points: totalPoints,
                    category: isGeneral ? "General" : category,
                    studentCategory: expectedStudentCategory,
                    studentClass: expectedStudentClass
                });
                updated++;
            }
        }
        showToast(`Recalculation & Category Sync Complete! Updated ${updated} results.`, "success");
        fetchResults();
    };

    // State for Poster Upload
    const [posterEventId, setPosterEventId] = useState("");
    const [posterUploading, setPosterUploading] = useState(false);

    // Event Search State
    const [eventSearchTerm, setEventSearchTerm] = useState("");
    const [overviewSearch, setOverviewSearch] = useState("");
    const [overviewStatusFilter, setOverviewStatusFilter] = useState("All");

    // Batch Result Upload State
    const [publishMode, setPublishMode] = useState("batch"); // "batch" | "single"
    const [batchRows, setBatchRows] = useState([
        { id: "row-1", place: "First", studentId: "", name: "", chestNo: "", team: "", grade: "A+", studentClass: "" },
        { id: "row-2", place: "Second", studentId: "", name: "", chestNo: "", team: "", grade: "A", studentClass: "" },
        { id: "row-3", place: "Third", studentId: "", name: "", chestNo: "", team: "", grade: "B", studentClass: "" }
    ]);

    const handleBatchStudentChange = (index, studentId) => {
        const nextRows = [...batchRows];
        const row = { ...nextRows[index], studentId };

        if (studentId === "Manual Entry") {
            row.name = "";
            row.team = "";
            row.chestNo = "";
            row.studentClass = "";
        } else {
            const student = filteredParticipants.find(p => p._id === studentId) || masterParticipants.find(p => p._id === studentId);
            if (student) {
                const studentClass = student["CLASS"] || student["STUDENT CLASS"] || student["CLASS NAME"] || student["class"] || "";
                const resolvedCat = resolveClassCategory(studentClass, student["CATEGORY"] || student["STUDENT CATEGORY"]);
                row.name = student["CANDIDATE NAME"] || student["CANDIDATE  FULL NAME"] || "";
                row.team = student["TEAM"] || student["TEAM NAME"] || "";
                row.chestNo = student["CHEST NUMBER"] || student["CHEST NO"] || "";
                row.studentClass = studentClass;
                row.studentCategory = resolvedCat !== "General" ? resolvedCat : (formData.studentCategory || "General");
            }
        }
        nextRows[index] = row;
        setBatchRows(nextRows);
    };

    const handleBatchTeamChange = (index, teamName) => {
        const nextRows = [...batchRows];
        nextRows[index] = {
            ...nextRows[index],
            team: teamName,
            name: teamName ? `${teamName} Team` : ""
        };
        setBatchRows(nextRows);
    };

    const handleBatchRowUpdate = (index, field, value) => {
        const nextRows = [...batchRows];
        nextRows[index] = { ...nextRows[index], [field]: value };
        setBatchRows(nextRows);
    };

    const handleAddBatchRow = () => {
        setBatchRows(prev => [
            ...prev,
            { id: `row-${Date.now()}`, place: "None", studentId: "", name: "", chestNo: "", team: "", grade: "A", studentClass: "" }
        ]);
    };

    const handleRemoveBatchRow = (index) => {
        if (batchRows.length <= 1) return;
        setBatchRows(prev => prev.filter((_, i) => i !== index));
    };

    const handlePopulateBatchFromCSV = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            let csvData = event.target.result;
            if (csvData.charCodeAt(0) === 0xFEFF) csvData = csvData.slice(1);

            const lines = csvData.split(/\r?\n/).filter(line => line.trim() !== "");
            if (lines.length < 2) {
                showToast("CSV file is empty or missing data rows.", "error");
                return;
            }

            const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
            const newRows = [];

            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(",").map(v => v.trim());
                const row = {};
                headers.forEach((h, idx) => {
                    row[h] = values[idx] || "";
                });

                const place = row.prize || row.place || (i === 1 ? "First" : i === 2 ? "Second" : i === 3 ? "Third" : "None");
                const name = row.name || row.studentname || row.candidate;
                const team = row.team;
                const grade = row.grade || "A";
                const chestNo = row.chestno || row.chestnumber;

                if (name || team) {
                    const match = masterParticipants.find(p =>
                        (chestNo && String(p["CHEST NUMBER"] || p["CHEST NO"]).trim() === String(chestNo).trim()) ||
                        ((p["CANDIDATE NAME"] || p["CANDIDATE  FULL NAME"])?.trim().toLowerCase() === (name || "").trim().toLowerCase())
                    );

                    newRows.push({
                        id: `csv-row-${i}`,
                        place: place,
                        studentId: match ? match._id : "Manual Entry",
                        name: name || (match ? (match["CANDIDATE NAME"] || match["CANDIDATE  FULL NAME"]) : ""),
                        team: team || (match ? (match["TEAM"] || match["TEAM NAME"]) : ""),
                        chestNo: chestNo || (match ? (match["CHEST NUMBER"] || match["CHEST NO"]) : ""),
                        grade: grade,
                        studentClass: match ? (match["CLASS"] || match["STUDENT CLASS"]) : ""
                    });
                }
            }

            if (newRows.length > 0) {
                setBatchRows(newRows);
                showToast(`Loaded ${newRows.length} rows into Batch Form! Review and click Publish All.`, "success");
            } else {
                showToast("No valid result rows found in CSV.", "warning");
            }
        };
        reader.readAsText(file);
    };

    const handleBatchSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;
        if (!formData.eventId) {
            showToast("Please select an event first", "error");
            return;
        }

        const ev = events.find(event => event.id === formData.eventId);
        if (!ev) {
            showToast("Selected event not found", "error");
            return;
        }

        const isGeneral = ev.type === "General" || isGeneralEvent(ev.name);
        const validRows = batchRows.filter(r => (isGeneral ? (r.team && r.team.trim() !== "") : ((r.name && r.name.trim() !== "") || (r.studentId && r.studentId !== ""))));

        if (validRows.length === 0) {
            showToast("Please fill in at least one winner before publishing.", "error");
            return;
        }

        const placeCounts = {};
        validRows.forEach(r => {
            if (r.place && r.place !== "None") {
                placeCounts[r.place] = (placeCounts[r.place] || 0) + 1;
            }
        });

        const duplicatePlaces = Object.entries(placeCounts).filter(([, count]) => count > 1);
        if (duplicatePlaces.length > 0) {
            const confirmTie = await confirm(`Multiple candidates are assigned to: ${duplicatePlaces.map(([p]) => p).join(", ")}. Do you want to publish as a Tie?`);
            if (!confirmTie) return;
        }

        setIsSubmitting(true);
        try {
            const category = ev.category || "A";
            const batch = writeBatch(db);
            let publishedCount = 0;

            for (const r of validRows) {
                let actualStudentCategory = ev.studentCategory || "General";

                if (publishCategoryFilter !== "All") {
                    actualStudentCategory = publishCategoryFilter;
                } else if (actualStudentCategory === "Junior & Senior" || actualStudentCategory === "Junior/Senior") {
                    const resolvedFromClass = resolveClassCategory(r.studentClass, r.studentCategory);
                    actualStudentCategory = resolvedFromClass !== "General" ? resolvedFromClass : "Junior";
                } else {
                    actualStudentCategory = resolveClassCategory(r.studentClass, actualStudentCategory);
                }

                const totalPoints = calculatePoints({
                    category,
                    place: r.place,
                    grade: r.grade
                }, scoringConfig);

                const payload = {
                    eventId: ev.id,
                    eventName: ev.name,
                    place: r.place,
                    name: r.name,
                    team: r.team,
                    grade: r.grade || "",
                    chestNo: r.chestNo || "",
                    category: isGeneral ? "General" : category,
                    studentCategory: actualStudentCategory,
                    studentClass: r.studentClass || "",
                    points: totalPoints,
                    timestamp: serverTimestamp()
                };

                const resultRef = doc(collection(db, "results"));
                batch.set(resultRef, payload);

                if (payload.team && totalPoints > 0) {
                    const teamScoreRef = doc(db, "teamScores", payload.team.toUpperCase());
                    batch.set(teamScoreRef, {
                        totalPoints: increment(totalPoints),
                        ...(isGeneral
                            ? { generalPoints: increment(totalPoints) }
                            : { regularPoints: increment(totalPoints) }
                        ),
                        lastUpdated: serverTimestamp()
                    }, { merge: true });
                }

                const auditRef = doc(collection(db, "auditLogs"));
                batch.set(auditRef, {
                    action: "publish_result_batch",
                    timestamp: serverTimestamp(),
                    event: payload.eventName,
                    team: payload.team,
                    pointsAwarded: totalPoints,
                    resultId: resultRef.id,
                    admin: auth.currentUser?.email || "unknown"
                });

                publishedCount++;
            }

            await batch.commit();

            showToast(`🎉 Successfully published all ${publishedCount} results for "${ev.name}"!`, "success");
            logAppEvent("batch_results_published", { event: ev.name, count: publishedCount });

            setBatchRows([
                { id: "row-1", place: "First", studentId: "", name: "", chestNo: "", team: "", grade: "A+", studentClass: "" },
                { id: "row-2", place: "Second", studentId: "", name: "", chestNo: "", team: "", grade: "A", studentClass: "" },
                { id: "row-3", place: "Third", studentId: "", name: "", chestNo: "", team: "", grade: "B", studentClass: "" }
            ]);

            await fetchResults();
        } catch (err) {
            console.error("Batch publish failed:", err);
            showToast("Failed to publish batch results.", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Student-First Search State
    const [studentSearchTerm, setStudentSearchTerm] = useState("");
    const [studentEventSuggestions, setStudentEventSuggestions] = useState([]);

    // Results History Search State
    const [resultsSearchTerm, setResultsSearchTerm] = useState("");
    const [filterTeam, setFilterTeam] = useState("");
    const [filterPrize, setFilterPrize] = useState("");
    const [filterGrade, setFilterGrade] = useState("");

    const exportToCSV = () => {
        if (results.length === 0) {
            showToast("No results to export.", "warning");
            return;
        }
        
        const headers = ["Event Name", "Category", "Student Category", "Place", "Grade", "Points", "Name", "Chest No", "Team"];
        const rows = results.map(r => [
            `"${r.eventName || ""}"`,
            `"${r.category || ""}"`,
            `"${r.studentCategory || ""}"`,
            `"${r.place || ""}"`,
            `"${r.grade || ""}"`,
            r.points || 0,
            `"${r.name || ""}"`,
            `"${r.chestNo || ""}"`,
            `"${r.team || ""}"`
        ]);
        
        const csvContent = "data:text/csv;charset=utf-8," 
            + headers.join(",") + "\n" 
            + rows.map(e => e.join(",")).join("\n");
            
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Arts_Fest_Results_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Cloudinary Config (Reused)
    const CLOUD_NAME = "dncz0c7vu";
    const UPLOAD_PRESET = "majlis-wafy-arts-fest";

    const handlePosterUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !posterEventId) return;

        setPosterUploading(true);
        try {
            // Compress image before upload
            const compressedBlob = await compressImage(file, 1000, 1000, 0.8);
            const compressedFile = new File([compressedBlob], file.name, {
                type: "image/jpeg",
                lastModified: Date.now(),
            });

            const data = new FormData();
            data.append("file", compressedFile);
            data.append("upload_preset", UPLOAD_PRESET);

            const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
                method: "POST",
                body: data
            });

            const fileData = await res.json();
            if (fileData.secure_url) {
                // Update Event Document with resultImage
                await updateDoc(doc(db, "events", posterEventId), {
                    resultImage: fileData.secure_url
                });
                showToast("Result Poster Uploaded Successfully!", "success");

                // Update local state without reload
                setEvents(prev => prev.map(ev =>
                    ev.id === posterEventId ? { ...ev, resultImage: fileData.secure_url } : ev
                ));
            } else {
                throw new Error("Upload failed");
            }
        } catch (err) {
            console.error("Poster Upload Error:", err);
            showToast("Failed to upload poster.", "error");
        }
        setPosterUploading(false);
    };

    const handleRemovePoster = async () => {
        if (!posterEventId || !await confirm("Remove the current poster for this event?")) return;

        try {
            await updateDoc(doc(db, "events", posterEventId), {
                resultImage: deleteField()
            });

            // Update local state
            setEvents(prev => prev.map(ev =>
                ev.id === posterEventId ? { ...ev, resultImage: null } : ev
            ));

            showToast("Poster removed.", "success");
        } catch (err) {
            console.error(err);
            showToast("Failed to remove poster.", "error");
        }
    };

    // Helper to find selected event image
    const selectedEvent = events.find(e => e.id === posterEventId);

    // Filter events for dropdown
    const filteredEventsForSelect = events.filter(e =>
        e.name.toLowerCase().includes(eventSearchTerm.toLowerCase())
    );

    const filteredResults = results.filter(r => {
        const q = resultsSearchTerm.toLowerCase();
        const matchesSearch = (
            (r.eventName || "").toLowerCase().includes(q) ||
            (r.name || "").toLowerCase().includes(q) ||
            (r.chestNo || "").toString().toLowerCase().includes(q)
        );

        const matchesTeam = filterTeam ? r.team === filterTeam : true;
        const matchesPrize = filterPrize ? r.place === filterPrize : true;
        const matchesGrade = filterGrade ? r.grade === filterGrade : true;

        return matchesSearch && matchesTeam && matchesPrize && matchesGrade;
    });


    // Handle Student Search Input
    const handleStudentSearchChange = (e) => {
        const term = e.target.value;
        setStudentSearchTerm(term);

        if (!term || term.length < 2) {
            setStudentEventSuggestions([]);
            return;
        }

        const suggestions = [];
        const lowerTerm = term.toLowerCase();

        masterParticipants.forEach(p => {
            const name = p["CANDIDATE NAME"] || p["CANDIDATE  FULL NAME"] || "";
            const nameMatches = name.toLowerCase().includes(lowerTerm);

            // Get all events for this student
            const onStage = (p["ON STAGE EVENTS"] || "").split(',').map(s => s.trim()).filter(Boolean);
            const offStage = (p["OFF STAGE EVENTS"] || "").split(',').map(s => s.trim()).filter(Boolean);
            const general = (p["GENERAL EVENTS"] || p["OFF STAGE - GENERAL"] || p["ON STAGE - GENERAL"] || "").split(',').map(s => s.trim()).filter(Boolean);

            const allStudentEvents = [...onStage, ...offStage, ...general];

            allStudentEvents.forEach(evName => {
                const eventMatches = evName.toLowerCase().includes(lowerTerm);

                // Add to suggestions if either name or event matches
                if (nameMatches || eventMatches) {
                    suggestions.push({
                        studentName: name,
                        chestNo: p["CHEST NUMBER"] || p["CHEST NO"] || "",
                        eventName: evName,
                        studentId: p._id // Assuming _id exists from fetch
                    });
                }
            });
        });
        setStudentEventSuggestions(suggestions.slice(0, 10)); // Limit to 10
    };

    const selectStudentEvent = (suggestion) => {
        // 1. Find the event obj
        const ev = events.find(e => e.name.toUpperCase() === suggestion.eventName.toUpperCase());
        if (!ev) {
            showToast(`Event '${suggestion.eventName}' not found in system definition.`, "error");
            return;
        }

        // 2. Set Event
        setFormData(prev => ({
            ...prev,
            eventId: ev.id,
            eventName: ev.name,
            place: "First", // Reset place
            name: suggestion.studentName,
            chestNo: suggestion.chestNo,
            team: "" // Reset team
            // Grade reset? Keep empty
        }));

        // 3. Trigger logic to populate student list for this event (simulate handleEventChange partially)
        const registered = masterParticipants.filter(p => {
            const onStage = p["ON STAGE EVENTS"] || "";
            const offStage = p["OFF STAGE EVENTS"] || "";
            const general = p["GENERAL EVENTS"] || p["OFF STAGE - GENERAL"] || p["ON STAGE - GENERAL"] || "";
            const allEventsList = (onStage + "," + offStage + "," + general).split(',').map(s => s.trim().toUpperCase());
            return allEventsList.includes(ev.name.toUpperCase().trim());
        });
        setFilteredParticipants(registered);

        // 4. Select the student in the dropdown
        // Find exact match in filtered participants
        const exactMatch = registered.find(p => (p["CANDIDATE NAME"] || p["CANDIDATE  FULL NAME"]) === suggestion.studentName);
        if (exactMatch) {
            setSelectedStudentId(exactMatch._id);
        } else {
            setSelectedStudentId("Manual Entry");
        }

        setStudentSearchTerm("");
        setStudentEventSuggestions([]);
        showToast(`Selected: ${suggestion.studentName} - ${ev.name}`, "success");
    };

    return (
        <div className={styles.container}>
            {toast && <Toast message={toast.message} type={toast.type} onClose={handleToastClose} />}
            {confirmState && <ConfirmDialog {...confirmState} />}

            <h3 className={styles.sectionTitle}>Upload Result Poster 🖼️</h3>
            <div className="card" style={{ marginBottom: '30px', padding: '20px', background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)' }}>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '15px' }}>Upload the official result poster image for an event.</p>
                <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                    <select
                        className="admin-select full-width"
                        style={{ flex: '1 1 200px' }}
                        value={posterEventId}
                        onChange={(e) => setPosterEventId(e.target.value)}
                    >
                        <option value="">-- Select Event --</option>
                        {events.map(ev => (
                            <option key={ev.id} value={ev.id}>
                                {ev.name} {ev.resultImage ? "✅" : ""}
                            </option>
                        ))}
                    </select>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {selectedEvent?.resultImage && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-tertiary)', padding: '10px', borderRadius: '6px' }}>
                                <img src={selectedEvent.resultImage} alt="Current Poster" style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px' }} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>Current Poster Active</div>
                                    <a href={selectedEvent.resultImage} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>View Full</a>
                                </div>
                                <button type="button" onClick={handleRemovePoster} style={{ background: 'var(--danger)', border: 'none', color: 'white', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}> Remove </button>
                            </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <label className={styles.buttonPrimary} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-main)', cursor: !posterEventId || posterUploading ? 'not-allowed' : 'pointer', opacity: !posterEventId || posterUploading ? 0.5 : 1, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 15px', width: 'auto' }}>
                                📤 Choose Poster Image
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handlePosterUpload}
                                    disabled={!posterEventId || posterUploading}
                                    style={{ display: 'none' }}
                                />
                            </label>
                        </div>
                    </div>
                </div>
                {posterUploading && <p style={{ color: 'var(--primary)', marginTop: '10px' }}>Uploading Poster... Please wait...</p>}
            </div>

            {/* DUPLICATE STUDENTS SECTION */}
            {(() => {
                // Find all duplicates
                const nameMap = new Map();
                masterParticipants.forEach(p => {
                    const name = (p["CANDIDATE NAME"] || p["CANDIDATE  FULL NAME"] || "").trim();
                    if (!name || name.toLowerCase().includes("team registration")) return;

                    if (!nameMap.has(name)) {
                        nameMap.set(name, []);
                    }
                    nameMap.get(name).push(p);
                });

                // Filter only duplicates (names with multiple entries)
                const duplicates = Array.from(nameMap.entries())
                    .filter(([, entries]) => entries.length > 1)
                    .map(([name, entries]) => ({ name, entries }));

                if (duplicates.length === 0) return null;

                return (
                    <>
                        <h3 className={styles.sectionTitle} style={{ color: '#ff9800', marginTop: '30px' }}>
                            ⚠️ Multiple Registrations Detected ({duplicates.length} names, {duplicates.reduce((sum, d) => sum + d.entries.length, 0)} total entries)
                        </h3>
                        <div className="card" style={{ marginBottom: '30px', padding: '20px', background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)' }}>
                            <p style={{ color: '#ff9800', marginBottom: '15px', fontSize: '0.9rem' }}>
                                ⚠️ The following names appear multiple times in the master registration list. If these are accidental duplicate submissions (same chest number), please delete the extra ones in the Registrations tab. If they are different students who share the same name, you can safely ignore this.
                            </p>
                            <div className="admin-table-container" style={{ maxHeight: '400px' }}>
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Student Name</th>
                                            <th>Chest No</th>
                                            <th>Team</th>
                                            <th>CIC No</th>
                                            <th>Events Registered</th>
                                            <th>Source</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {duplicates.map(({ name, entries }) => (
                                            entries.map((entry, idx) => {
                                                const chestNo = entry["CHEST NUMBER"] || entry["CHEST NO"] || "---";
                                                const team = entry["TEAM"] || entry["TEAM NAME"] || "---";
                                                const cicNo = entry["CIC NO"] || entry["CIC NUMBER"] || "---";
                                                const onStage = (entry["ON STAGE EVENTS"] || "").split(',').filter(Boolean).length;
                                                const offStage = (entry["OFF STAGE EVENTS"] || "").split(',').filter(Boolean).length;
                                                const general = (entry["GENERAL EVENTS"] || "").split(',').filter(Boolean).length;
                                                const totalEvents = onStage + offStage + general;

                                                return (
                                                    <tr key={entry._id} style={{
                                                        background: idx === 0 ? 'var(--bg-tertiary)' : 'transparent',
                                                        borderTop: idx === 0 ? '2px solid #ff9800' : '1px solid var(--border-soft)'
                                                    }}>
                                                        <td style={{ fontWeight: idx === 0 ? 'bold' : 'normal', color: idx === 0 ? '#ff9800' : 'var(--text-main)' }}>
                                                            {idx === 0 && '🔴 '}{name}
                                                        </td>
                                                        <td>{chestNo}</td>
                                                        <td>{team}</td>
                                                        <td>{cicNo}</td>
                                                        <td>{totalEvents} events (On: {onStage}, Off: {offStage}, Gen: {general})</td>
                                                        <td style={{ fontSize: '0.75rem', color: '#888' }}>{entry._source || 'unknown'}</td>
                                                    </tr>
                                                );
                                            })
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                );
            })()}


            {/* EVENT CATEGORIES PUBLICATION OVERVIEW */}
            <div className="card" style={{ marginBottom: '25px', padding: '18px', background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                    <h4 style={{ margin: 0, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        📅 Event Category Publication Progress Overview
                    </h4>
                    <input
                        type="text"
                        placeholder="🔍 Search Event Status..."
                        value={overviewSearch}
                        onChange={(e) => setOverviewSearch(e.target.value)}
                        className="admin-input"
                        style={{ padding: '6px 12px', fontSize: '0.82rem', flex: '0 1 220px' }}
                    />
                </div>

                {(() => {
                    const eventsWithBreakdown = events.map(ev => ({
                        ev,
                        ...getEventCategoryBreakdown(ev, results)
                    }));

                    const totalEventsCount = events.length;
                    const fullyCompletedCount = eventsWithBreakdown.filter(item => item.isFullyCompleted).length;
                    const inProgressCount = eventsWithBreakdown.filter(item => !item.isFullyCompleted && item.hasAnyResults).length;
                    const pendingCount = eventsWithBreakdown.filter(item => !item.hasAnyResults).length;

                    const filteredOverviewEvents = eventsWithBreakdown.filter(({ ev, isFullyCompleted, hasAnyResults }) => {
                        const q = overviewSearch.toLowerCase();
                        const matchesSearch = ev.name.toLowerCase().includes(q);
                        if (!matchesSearch) return false;
                        if (overviewStatusFilter === "Completed") return isFullyCompleted;
                        if (overviewStatusFilter === "InProgress") return !isFullyCompleted && hasAnyResults;
                        if (overviewStatusFilter === "Pending") return !hasAnyResults;
                        return true;
                    });

                    return (
                        <>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                                <button
                                    type="button"
                                    onClick={() => setOverviewStatusFilter("All")}
                                    style={{
                                        background: overviewStatusFilter === "All" ? "var(--primary)" : "var(--bg-tertiary)",
                                        color: "white", border: "1px solid var(--border-soft)", padding: "5px 12px", borderRadius: "16px", fontSize: "0.78rem", cursor: "pointer", fontWeight: "600"
                                    }}
                                >
                                    📋 All ({totalEventsCount})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setOverviewStatusFilter("Completed")}
                                    style={{
                                        background: overviewStatusFilter === "Completed" ? "#22c55e" : "var(--bg-tertiary)",
                                        color: "white", border: "1px solid var(--border-soft)", padding: "5px 12px", borderRadius: "16px", fontSize: "0.78rem", cursor: "pointer", fontWeight: "600"
                                    }}
                                >
                                    🟢 Completed ({fullyCompletedCount})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setOverviewStatusFilter("InProgress")}
                                    style={{
                                        background: overviewStatusFilter === "InProgress" ? "#eab308" : "var(--bg-tertiary)",
                                        color: "white", border: "1px solid var(--border-soft)", padding: "5px 12px", borderRadius: "16px", fontSize: "0.78rem", cursor: "pointer", fontWeight: "600"
                                    }}
                                >
                                    🟡 In Progress ({inProgressCount})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setOverviewStatusFilter("Pending")}
                                    style={{
                                        background: overviewStatusFilter === "Pending" ? "#64748b" : "var(--bg-tertiary)",
                                        color: "white", border: "1px solid var(--border-soft)", padding: "5px 12px", borderRadius: "16px", fontSize: "0.78rem", cursor: "pointer", fontWeight: "600"
                                    }}
                                >
                                    ⚪ Pending ({pendingCount})
                                </button>
                            </div>

                            <div className="admin-table-container" style={{ maxHeight: '220px' }}>
                                <table className="admin-table" style={{ fontSize: '0.8rem' }}>
                                    <thead>
                                        <tr>
                                            <th>Event Name</th>
                                            <th>Category Scope</th>
                                            <th>Published Status per Category</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredOverviewEvents.length === 0 ? (
                                            <tr>
                                                <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No matching events found.</td>
                                            </tr>
                                        ) : (
                                            filteredOverviewEvents.map(({ ev, breakdown }) => (
                                                <tr key={ev.id} style={{ background: formData.eventId === ev.id ? 'rgba(59, 130, 246, 0.12)' : 'transparent' }}>
                                                    <td style={{ fontWeight: 'bold' }}>{ev.name}</td>
                                                    <td>{ev.studentCategory || getEventScope(ev.name)}</td>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                            {breakdown.map(b => (
                                                                <span key={b.category} style={{
                                                                    fontSize: '0.72rem', padding: '2px 8px', borderRadius: '10px',
                                                                    background: b.status === 'completed' ? 'rgba(34, 197, 94, 0.2)' : b.status === 'in_progress' ? 'rgba(234, 179, 8, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                                                    color: b.status === 'completed' ? '#4ade80' : b.status === 'in_progress' ? '#facc15' : 'var(--text-muted)'
                                                                }}>
                                                                    {b.category}: {b.icon} {b.status === 'completed' ? 'Done' : b.status === 'in_progress' ? 'In Prog' : 'Pending'}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                handleEventChange({ target: { value: ev.id } });
                                                                const formEl = document.querySelector('form');
                                                                if (formEl) formEl.scrollIntoView({ behavior: 'smooth' });
                                                            }}
                                                            style={{
                                                                background: formData.eventId === ev.id ? 'var(--primary)' : 'var(--bg-tertiary)',
                                                                color: 'white', border: '1px solid var(--border-soft)',
                                                                padding: '3px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold'
                                                            }}
                                                        >
                                                            {formData.eventId === ev.id ? 'Active ✓' : 'Select ⚡'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    );
                })()}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginTop: '20px', marginBottom: '12px' }}>
                <h3 className={styles.sectionTitle} style={{ margin: 0 }}>
                    {editId ? "Edit Result" : "Publish Event Results"}
                </h3>
                {!editId && (
                    <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-secondary)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-soft)' }}>
                        <button
                            type="button"
                            onClick={() => setPublishMode("batch")}
                            style={{
                                background: publishMode === "batch" ? "var(--primary)" : "transparent",
                                color: "white",
                                border: "none",
                                padding: "6px 14px",
                                borderRadius: "6px",
                                fontSize: "0.82rem",
                                fontWeight: "bold",
                                cursor: "pointer",
                                transition: "all 0.2s ease"
                            }}
                        >
                            ⚡ Batch Mode (Publish All at Once)
                        </button>
                        <button
                            type="button"
                            onClick={() => setPublishMode("single")}
                            style={{
                                background: publishMode === "single" ? "var(--primary)" : "transparent",
                                color: "white",
                                border: "none",
                                padding: "6px 14px",
                                borderRadius: "6px",
                                fontSize: "0.82rem",
                                fontWeight: "bold",
                                cursor: "pointer",
                                transition: "all 0.2s ease"
                            }}
                        >
                            👤 Single Winner Mode
                        </button>
                    </div>
                )}
            </div>

            {/* BATCH MODE FORM */}
            {publishMode === "batch" && !editId ? (
                <form onSubmit={handleBatchSubmit} className={styles.card}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <input
                                placeholder="🔍 Filter Events..."
                                value={eventSearchTerm}
                                onChange={(e) => setEventSearchTerm(e.target.value)}
                                className="admin-input full-width"
                            />
                            <select
                                className="admin-select full-width"
                                value={formData.eventId}
                                onChange={handleEventChange}
                                required
                            >
                                <option value="">-- Select Event --</option>
                                {filteredEventsForSelect.map(ev => {
                                    const categoryInfo = getEventCategoryBreakdown(ev, results);
                                    return (
                                        <option key={ev.id} value={ev.id}>
                                            {ev.name} {categoryInfo.label}
                                        </option>
                                    );
                                })}
                            </select>

                            {/* ACTIVE EVENT CATEGORY STATUS CARD */}
                            {(() => {
                                const activeEv = events.find(e => e.id === formData.eventId);
                                if (!activeEv) return null;
                                const { breakdown } = getEventCategoryBreakdown(activeEv, results);
                                return (
                                    <div style={{
                                        background: 'var(--bg-tertiary)',
                                        border: '1px solid var(--border-soft)',
                                        borderRadius: '8px',
                                        padding: '12px 14px',
                                        marginTop: '8px',
                                        marginBottom: '8px'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                                            <span style={{ fontSize: '0.82rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                                                📊 Published Category Results for "{activeEv.name}":
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setFormData({ eventId: "", eventName: "", place: "First", name: "", team: "", grade: "", chestNo: "", studentCategory: "" });
                                                    setSelectedStudentId("");
                                                    setFilteredParticipants([]);
                                                }}
                                                style={{
                                                    background: 'transparent',
                                                    border: '1px solid var(--border-soft)',
                                                    color: 'var(--text-secondary)',
                                                    fontSize: '0.72rem',
                                                    padding: '2px 8px',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                ✕ Deselect Event
                                            </button>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                                            {breakdown.map(b => (
                                                <div key={b.category} style={{
                                                    background: 'var(--bg-secondary)',
                                                    border: `1px solid ${b.status === 'completed' ? 'rgba(34, 197, 94, 0.4)' : b.status === 'in_progress' ? 'rgba(234, 179, 8, 0.4)' : 'var(--border-soft)'}`,
                                                    borderRadius: '6px',
                                                    padding: '8px 10px'
                                                }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold', fontSize: '0.78rem', color: 'var(--text-main)' }}>
                                                        <span>{b.category} Category</span>
                                                        <span style={{
                                                            fontSize: '0.7rem',
                                                            padding: '1px 6px',
                                                            borderRadius: '4px',
                                                            background: b.status === 'completed' ? 'rgba(34, 197, 94, 0.2)' : b.status === 'in_progress' ? 'rgba(234, 179, 8, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                                            color: b.status === 'completed' ? '#4ade80' : b.status === 'in_progress' ? '#facc15' : 'var(--text-muted)'
                                                        }}>
                                                            {b.icon} {b.status === 'completed' ? 'Completed' : b.status === 'in_progress' ? 'In Progress' : 'No Results'}
                                                        </span>
                                                    </div>
                                                    {b.catRes.length > 0 ? (
                                                        <ul style={{ margin: '4px 0 0 0', paddingLeft: '14px', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                                            {b.catRes.map(r => (
                                                                <li key={r.id}>
                                                                    <strong style={{ color: 'var(--primary)' }}>{r.place}:</strong> {r.name} ({r.team}) {r.grade ? `[${r.grade}]` : ''}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    ) : (
                                                        <p style={{ margin: '4px 0 0 0', fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                                            No published winners yet.
                                                        </p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        {formData.eventId && (
                            <div style={{ marginTop: '10px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                                    <h4 style={{ margin: 0, color: 'var(--primary)', fontSize: '0.95rem' }}>
                                        🏆 Enter All Winners for "{formData.eventName}" at Once
                                    </h4>
                                    <label className={styles.buttonPrimary} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-main)', cursor: 'pointer', fontSize: '0.78rem', padding: '5px 12px', border: '1px solid var(--border-soft)' }}>
                                        📥 Load CSV for this Event
                                        <input type="file" accept=".csv" onChange={handlePopulateBatchFromCSV} style={{ display: 'none' }} />
                                    </label>
                                </div>

                                {/* CLASS CATEGORY SELECTOR FOR BATCH SUBMISSION */}
                                {!isGeneralEvent(events.find(e => e.id === formData.eventId)?.name) && (
                                    <div style={{ marginBottom: '15px', background: 'var(--bg-tertiary)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-soft)' }}>
                                        <label style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>
                                            🎯 Select Target Category for this Result Entry:
                                        </label>
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                            {["All", "Junior", "Senior", "General"].map(cat => (
                                                <button
                                                    key={cat}
                                                    type="button"
                                                    style={{
                                                        background: publishCategoryFilter === cat ? "var(--primary)" : "var(--bg-secondary)",
                                                        color: "white",
                                                        border: "1px solid var(--border-soft)",
                                                        padding: "4px 12px",
                                                        borderRadius: "14px",
                                                        fontSize: "0.78rem",
                                                        cursor: "pointer",
                                                        fontWeight: "600"
                                                    }}
                                                    onClick={() => {
                                                        setPublishCategoryFilter(cat);
                                                        setFilteredParticipants(filterParticipantsByCategory(allRegisteredParticipants, cat));
                                                        if (cat !== "All") {
                                                            setFormData(prev => ({ ...prev, studentCategory: cat }));
                                                        }
                                                    }}
                                                >
                                                    {cat === "All" ? "📋 All Categories" : cat === "Junior" ? "👤 Thamheediyya (Junior)" : cat === "Senior" ? "👤 Aliya (Senior)" : `👤 ${cat}`}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* BATCH WINNERS TABLE */}
                                <div className="admin-table-container" style={{ marginBottom: '15px' }}>
                                    <table className="admin-table" style={{ fontSize: '0.85rem' }}>
                                        <thead>
                                            <tr>
                                                <th style={{ width: '140px' }}>Prize Position</th>
                                                <th>{isGeneralEvent(events.find(e => e.id === formData.eventId)?.name) ? "Winning Team" : "Student Winner"}</th>
                                                <th style={{ width: '100px' }}>Grade</th>
                                                <th style={{ width: '110px' }}>Chest No</th>
                                                <th style={{ width: '120px' }}>Team</th>
                                                <th style={{ width: '50px' }}>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {batchRows.map((row, idx) => (
                                                <tr key={row.id || idx}>
                                                    <td>
                                                        <select
                                                            className="admin-select"
                                                            style={{ padding: '6px', fontSize: '0.8rem', width: '100%' }}
                                                            value={row.place}
                                                            onChange={e => handleBatchRowUpdate(idx, "place", e.target.value)}
                                                        >
                                                            <option value="First">First Prize 🥇</option>
                                                            <option value="Second">Second Prize 🥈</option>
                                                            <option value="Third">Third Prize 🥉</option>
                                                            <option value="None">Grade Only (None)</option>
                                                        </select>
                                                    </td>
                                                    <td>
                                                        {isGeneralEvent(events.find(e => e.id === formData.eventId)?.name) ? (
                                                            <select
                                                                className="admin-select"
                                                                style={{ padding: '6px', fontSize: '0.8rem', width: '100%' }}
                                                                value={row.team}
                                                                onChange={e => handleBatchTeamChange(idx, e.target.value)}
                                                            >
                                                                <option value="">-- Select Team --</option>
                                                                {liveTeams.map(t => (
                                                                    <option key={t} value={t}>{t}</option>
                                                                ))}
                                                            </select>
                                                        ) : (
                                                            <select
                                                                className="admin-select"
                                                                style={{ padding: '6px', fontSize: '0.8rem', width: '100%' }}
                                                                value={row.studentId}
                                                                onChange={e => handleBatchStudentChange(idx, e.target.value)}
                                                            >
                                                                <option value="">-- Select Candidate ({filteredParticipants.length} available) --</option>
                                                                {filteredParticipants.map(p => {
                                                                    const chestNo = p["CHEST NUMBER"] || p["CHEST NO"];
                                                                    const name = p["CANDIDATE NAME"] || p["CANDIDATE  FULL NAME"];
                                                                    const team = p["TEAM"] || p["TEAM NAME"];
                                                                    return (
                                                                        <option key={p._id} value={p._id}>
                                                                            {chestNo ? `[${chestNo}] ` : ""}{name}{team ? ` - ${team}` : ""}
                                                                        </option>
                                                                    );
                                                                })}
                                                                <option value="Manual Entry">Enter Manually...</option>
                                                            </select>
                                                        )}
                                                        {row.studentId === "Manual Entry" && (
                                                            <input
                                                                className="admin-input"
                                                                style={{ marginTop: '4px', padding: '4px', fontSize: '0.8rem', width: '100%' }}
                                                                placeholder="Manually Enter Candidate Name"
                                                                value={row.name}
                                                                onChange={e => handleBatchRowUpdate(idx, "name", e.target.value)}
                                                            />
                                                        )}
                                                    </td>
                                                    <td>
                                                        <select
                                                            className="admin-select"
                                                            style={{ padding: '6px', fontSize: '0.8rem', width: '100%' }}
                                                            value={row.grade}
                                                            onChange={e => handleBatchRowUpdate(idx, "grade", e.target.value)}
                                                        >
                                                            <option value="A+">A+</option>
                                                            <option value="A">A</option>
                                                            <option value="B">B</option>
                                                            <option value="C">C</option>
                                                            <option value="">None</option>
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <input
                                                            className="admin-input"
                                                            style={{ padding: '6px', fontSize: '0.8rem', width: '100%' }}
                                                            placeholder="Chest No"
                                                            value={row.chestNo}
                                                            onChange={e => handleBatchRowUpdate(idx, "chestNo", e.target.value)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            className="admin-input"
                                                            style={{ padding: '6px', fontSize: '0.8rem', width: '100%' }}
                                                            placeholder="Team"
                                                            value={row.team}
                                                            onChange={e => handleBatchRowUpdate(idx, "team", e.target.value)}
                                                        />
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveBatchRow(idx)}
                                                            style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.9rem' }}
                                                            title="Remove row"
                                                        >
                                                            🗑️
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                    <button
                                        type="button"
                                        onClick={handleAddBatchRow}
                                        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-main)', border: '1px solid var(--border-soft)', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '600' }}
                                    >
                                        ➕ Add Grade-Only / Extra Winner Row
                                    </button>

                                    <button
                                        type="submit"
                                        className={styles.buttonPrimary}
                                        style={{ padding: '10px 24px', fontSize: '0.9rem', opacity: isSubmitting ? 0.6 : 1, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? "⏳ Publishing All Results..." : `🚀 Publish All Results for ${formData.eventName || 'Event'}`}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </form>
            ) : (
                /* SINGLE RESULT FORM */
                <form onSubmit={handleSubmit} className={styles.card}>
                    <div className={styles.formGrid}>
                        <div className="full-width" style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <input
                                placeholder="🔍 Filter Events..."
                                value={eventSearchTerm}
                                onChange={(e) => setEventSearchTerm(e.target.value)}
                                className="admin-input full-width"
                            />
                            <select
                                className="admin-select full-width"
                                value={formData.eventId}
                                onChange={handleEventChange}
                                required
                            >
                                <option value="">-- Select Event --</option>
                                {filteredEventsForSelect.map(ev => {
                                    const categoryInfo = getEventCategoryBreakdown(ev, results);

                                    return (
                                        <option key={ev.id} value={ev.id}>
                                            {ev.name} {categoryInfo.label}
                                        </option>
                                    );
                                })}
                            </select>

                            {/* ACTIVE EVENT CATEGORY STATUS CARD */}
                            {(() => {
                                const activeEv = events.find(e => e.id === formData.eventId);
                                if (!activeEv) return null;
                                const { breakdown } = getEventCategoryBreakdown(activeEv, results);
                                return (
                                    <div style={{
                                        background: 'var(--bg-tertiary)',
                                        border: '1px solid var(--border-soft)',
                                        borderRadius: '8px',
                                        padding: '12px 14px',
                                        marginTop: '8px',
                                        marginBottom: '8px'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                                            <span style={{ fontSize: '0.82rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                                                📊 Published Category Results for "{activeEv.name}":
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setFormData({ eventId: "", eventName: "", place: "First", name: "", team: "", grade: "", chestNo: "", studentCategory: "" });
                                                    setSelectedStudentId("");
                                                    setFilteredParticipants([]);
                                                }}
                                                style={{
                                                    background: 'transparent',
                                                    border: '1px solid var(--border-soft)',
                                                    color: 'var(--text-secondary)',
                                                    fontSize: '0.72rem',
                                                    padding: '2px 8px',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                ✕ Deselect Event
                                            </button>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                                            {breakdown.map(b => (
                                                <div key={b.category} style={{
                                                    background: 'var(--bg-secondary)',
                                                    border: `1px solid ${b.status === 'completed' ? 'rgba(34, 197, 94, 0.4)' : b.status === 'in_progress' ? 'rgba(234, 179, 8, 0.4)' : 'var(--border-soft)'}`,
                                                    borderRadius: '6px',
                                                    padding: '8px 10px'
                                                }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold', fontSize: '0.78rem', color: 'var(--text-main)' }}>
                                                        <span>{b.category} Category</span>
                                                        <span style={{
                                                            fontSize: '0.7rem',
                                                            padding: '1px 6px',
                                                            borderRadius: '4px',
                                                            background: b.status === 'completed' ? 'rgba(34, 197, 94, 0.2)' : b.status === 'in_progress' ? 'rgba(234, 179, 8, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                                            color: b.status === 'completed' ? '#4ade80' : b.status === 'in_progress' ? '#facc15' : 'var(--text-muted)'
                                                        }}>
                                                            {b.icon} {b.status === 'completed' ? 'Completed' : b.status === 'in_progress' ? 'In Progress' : 'No Results'}
                                                        </span>
                                                    </div>
                                                    {b.catRes.length > 0 ? (
                                                        <ul style={{ margin: '4px 0 0 0', paddingLeft: '14px', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                                            {b.catRes.map(r => (
                                                                <li key={r.id}>
                                                                    <strong style={{ color: 'var(--primary)' }}>{r.place}:</strong> {r.name} ({r.team}) {r.grade ? `[${r.grade}]` : ''}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    ) : (
                                                        <p style={{ margin: '4px 0 0 0', fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                                            No published winners yet.
                                                        </p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* STUDENT FINDER */}
                            <div style={{ position: 'relative' }}>
                                <input
                                    placeholder="🎓 Find by Student Name or Event..."
                                    value={studentSearchTerm}
                                    onChange={handleStudentSearchChange}
                                    className="admin-input full-width"
                                    style={{ marginTop: '5px' }}
                                />
                                {studentEventSuggestions.length > 0 && (
                                    <ul style={{
                                        position: 'absolute', top: '100%', left: 0, right: 0,
                                        background: '#1a1a1a', border: '1px solid #444',
                                        listStyle: 'none', padding: 0, margin: 0, zIndex: 100,
                                        maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 10px rgba(0,0,0,0.5)'
                                    }}>
                                        {studentEventSuggestions.map((s, i) => (
                                            <li
                                                key={i}
                                                onClick={() => selectStudentEvent(s)}
                                                style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-soft)', cursor: 'pointer', fontSize: '0.85rem' }}
                                                onMouseEnter={e => e.target.style.background = 'var(--surface-hover)'}
                                                onMouseLeave={e => e.target.style.background = 'transparent'}
                                            >
                                                <span style={{ color: 'var(--text-main)', fontWeight: 'bold' }}>{s.studentName}</span>
                                                <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>({s.chestNo})</span>
                                                <br />
                                                <span style={{ color: 'var(--primary)', fontSize: '0.75rem' }}>👉 {s.eventName}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <select
                                className="admin-select"
                                value={formData.place}
                                onChange={e => setFormData({ ...formData, place: e.target.value })}
                            >
                                <option value="First">First Prize 🥇</option>
                                <option value="Second">Second Prize 🥈</option>
                                <option value="Third">Third Prize 🥉</option>
                                <option value="None">None (Grade Only)</option>
                            </select>
                            {(() => {
                                const targetCat = formData.studentCategory || (publishCategoryFilter !== "All" ? publishCategoryFilter : "");
                                const existingWinner = results.find(r =>
                                    r.eventId === formData.eventId &&
                                    r.place === formData.place &&
                                    r.id !== editId &&
                                    r.place !== "None" &&
                                    (!targetCat || !r.studentCategory || r.studentCategory === targetCat)
                                );
                                if (existingWinner) {
                                    return (
                                        <div style={{ color: '#facc15', fontSize: '0.85rem', padding: '5px' }}>
                                            ⚠️ Warning: A {formData.place} prize winner already exists for this event in {targetCat || 'this category'} ({existingWinner.name}). Submitting this will create a tie.
                                        </div>
                                    );
                                }
                                return null;
                            })()}
                        </div>

                        {/* CLASS CATEGORY FILTER FOR CANDIDATE SELECTION */}
                        {formData.eventId && !isGeneralEvent(events.find(e => e.id === formData.eventId)?.name) && (
                            <div className="full-width" style={{ marginTop: '10px', marginBottom: '5px' }}>
                                <label style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>
                                    🎯 Filter Candidates by Class Category:
                                </label>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {["All", "Junior", "Senior", "General"].map(cat => (
                                        <button
                                            key={cat}
                                            type="button"
                                            style={{
                                                background: publishCategoryFilter === cat ? "var(--primary)" : "var(--bg-tertiary)",
                                                color: "white",
                                                border: "1px solid var(--border-soft)",
                                                padding: "5px 14px",
                                                borderRadius: "16px",
                                                fontSize: "0.8rem",
                                                cursor: "pointer",
                                                fontWeight: "600",
                                                transition: "all 0.2s ease"
                                            }}
                                            onClick={() => {
                                                setPublishCategoryFilter(cat);
                                                setFilteredParticipants(filterParticipantsByCategory(allRegisteredParticipants, cat));
                                                if (cat !== "All") {
                                                    setFormData(prev => ({ ...prev, studentCategory: cat }));
                                                }
                                            }}
                                        >
                                            {cat === "All" ? "📋 All Registered" : cat === "Junior" ? "👤 Thamheediyya (Junior)" : cat === "Senior" ? "👤 Aliya (Senior)" : `👤 ${cat}`}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Dynamic Selection: Team for General, Student for Others */}
                        {(
                            (() => {
                                const evName = events.find(e => e.id === formData.eventId)?.name;
                                return isGeneralEvent(evName);
                            })()
                        ) ? (
                            <div className="full-width" style={{ marginBottom: '15px' }}>
                                <label style={{ color: '#aaa', fontSize: '0.8rem', marginBottom: '5px', display: 'block' }}>Select Winning Team (General Event)</label>
                                <select
                                    className="admin-select full-width"
                                    value={formData.team}
                                    onChange={(e) => {
                                        const t = e.target.value;
                                        setFormData({
                                            ...formData,
                                            team: t,
                                            name: t ? `${t} Team` : "" // Auto-set name
                                        });
                                        setSelectedStudentId("Manual Entry"); // Bypass student validation
                                    }}
                                    required
                                >
                                    <option value="">-- Select Team --</option>
                                    {liveTeams.map(team => (
                                        <option key={team} value={team}>{team}</option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <select
                                className="admin-select full-width"
                                value={selectedStudentId}
                                onChange={handleStudentChange}
                                required={selectedStudentId !== "Manual Entry"}
                                disabled={!formData.eventId}
                            >
                                <option value="">-- Select Registered Student ({filteredParticipants.length} available) --</option>
                                {filteredParticipants.map((p) => {
                                    const chestNo = p["CHEST NUMBER"] || p["CHEST NO"];
                                    const name = p["CANDIDATE NAME"] || p["CANDIDATE  FULL NAME"];
                                    const team = p["TEAM"] || p["TEAM NAME"];
                                    const cicNo = p["CIC NO"] || p["CIC NUMBER"];
                                    const catTag = (p["CATEGORY"] || p["STUDENT CATEGORY"]) ? `[${p["CATEGORY"] || p["STUDENT CATEGORY"]}] ` : "";

                                    const hasDuplicateName = filteredParticipants.filter(
                                        participant => (participant["CANDIDATE NAME"] || participant["CANDIDATE  FULL NAME"]) === name
                                    ).length > 1;

                                    const hasNoChestNo = !chestNo;
                                    const hasNoTeam = !team;

                                    let warningFlag = "";
                                    if (hasDuplicateName && chestNo) warningFlag = "⚠️ DUP ";
                                    else if (hasNoChestNo) warningFlag = "⚠️ NO-CHEST ";
                                    else if (hasNoTeam) warningFlag = "⚠️ NO-TEAM ";

                                    return (
                                        <option key={p._id} value={p._id}>
                                            {warningFlag}{catTag}{chestNo ? `[${chestNo}] ` : "[---] "}{name}{team ? ` - ${team}` : ""}{cicNo ? ` (CIC: ${cicNo})` : ""}
                                        </option>
                                    );
                                })}
                                <option value="Manual Entry">Enter Manually...</option>
                            </select>
                        )}

                        {selectedStudentId === "Manual Entry" && !isGeneralEvent(events.find(e => e.id === formData.eventId)?.name) && (
                            <input
                                className="admin-input full-width"
                                value={formData.name}
                                placeholder="Manually Enter Name"
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        )}

                        <input className="admin-input" placeholder="Team" value={formData.team} onChange={e => setFormData({ ...formData, team: e.target.value })} required />
                        <select
                            className="admin-select"
                            value={formData.grade}
                            onChange={e => setFormData({ ...formData, grade: e.target.value })}
                        >
                            <option value="">-- Select Grade --</option>
                            <option value="A+">A+</option>
                            <option value="A">A</option>
                            <option value="B">B</option>
                            <option value="C">C</option>
                        </select>
                        <input className="admin-input" placeholder="Chest No" value={formData.chestNo} onChange={e => setFormData({ ...formData, chestNo: e.target.value })} />
                    </div>
                    <div className="admin-form-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', marginTop: '20px' }}>
                        <button
                            type="submit"
                            className={styles.buttonPrimary}
                            style={{ flex: '1 1 200px', opacity: isSubmitting ? 0.6 : 1, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? "⏳ Saving..." : editId ? "Update Result ✓" : "Publish Winner"}
                        </button>
                        {editId && (
                            <button type="button" onClick={handleCancelEdit} className={styles.buttonPrimary} style={{ flex: '1 1 150px', background: 'var(--bg-tertiary)' }}>
                                Cancel
                            </button>
                        )}
                        {!editId && (
                            <label className={styles.buttonPrimary} style={{ flex: '1 1 150px', background: 'var(--bg-secondary)', cursor: 'pointer', textAlign: 'center', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                📥 Bulk Upload (CSV)
                                <input type="file" accept=".csv" onChange={handleBulkUpload} style={{ display: 'none' }} />
                            </label>
                        )}
                    </div>
                </form>
            )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flex: '1 1 100%', flexWrap: 'wrap', marginBottom: '10px' }}>
                    <h4 style={{ margin: 0, color: 'var(--primary)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        Published Results History
                        <button onClick={exportToCSV} title="Export to CSV" style={{ background: 'transparent', border: '1px solid var(--border-soft)', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-secondary)' }}>
                            ⬇️ CSV
                        </button>
                    </h4>
                    <input
                        type="text"
                        placeholder="🔍 Search name, event, chest no..."
                        value={resultsSearchTerm}
                        onChange={(e) => setResultsSearchTerm(e.target.value)}
                        className="admin-input"
                        style={{ padding: '8px', fontSize: '0.85rem', flex: '1 1 200px' }}
                    />
                    <select
                        className="admin-select"
                        style={{ padding: '8px', fontSize: '0.85rem', flex: '1 1 150px' }}
                        value={filterTeam}
                        onChange={(e) => setFilterTeam(e.target.value)}
                    >
                        <option value="">All Teams</option>
                        {liveTeams.map(team => (
                            <option key={team} value={team}>{team}</option>
                        ))}
                    </select>
                    <select
                        className="admin-select"
                        style={{ padding: '8px', fontSize: '0.85rem', flex: '1 1 150px' }}
                        value={filterPrize}
                        onChange={(e) => setFilterPrize(e.target.value)}
                    >
                        <option value="">All Prizes</option>
                        <option value="First">First Prize</option>
                        <option value="Second">Second Prize</option>
                        <option value="Third">Third Prize</option>
                        <option value="None">None</option>
                    </select>
                    <select
                        className="admin-select"
                        style={{ padding: '8px', fontSize: '0.85rem', flex: '1 1 150px' }}
                        value={filterGrade}
                        onChange={(e) => setFilterGrade(e.target.value)}
                    >
                        <option value="">All Grades</option>
                        <option value="A+">A+</option>
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                    </select>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', flex: '1 1 auto' }}>
                    <button
                        onClick={toggleHomePoints}
                        className={styles.buttonPrimary}
                        style={{
                            padding: '8px 15px',
                            fontSize: '0.85rem',
                            background: showHomePoints ? '#22c55e' : '#e63946',
                            boxShadow: showHomePoints ? '0 0 15px rgba(34, 197, 94, 0.4)' : 'none'
                        }}
                    >
                        {showHomePoints ? "🏠 Home Points: VISIBLE" : "🏠 Home Points: HIDDEN"}
                    </button>
                    <button
                        onClick={toggleResultsPoints}
                        className={styles.buttonPrimary}
                        style={{
                            padding: '8px 15px',
                            fontSize: '0.85rem',
                            background: showResultsPoints ? '#22c55e' : '#e63946',
                            boxShadow: showResultsPoints ? '0 0 15px rgba(34, 197, 94, 0.4)' : 'none'
                        }}
                    >
                        {showResultsPoints ? "🏆 Result Points: VISIBLE" : "🏆 Result Points: HIDDEN"}
                    </button>
                    <button
                        onClick={toggleEventResults}
                        className={styles.buttonPrimary}
                        style={{
                            padding: '8px 15px',
                            fontSize: '0.85rem',
                            background: showEventResults ? '#22c55e' : '#e63946',
                            boxShadow: showEventResults ? '0 0 15px rgba(34, 197, 94, 0.4)' : 'none'
                        }}
                    >
                        {showEventResults ? "📋 Event Results: VISIBLE" : "📋 Event Results: HIDDEN"}
                    </button>
                    <button
                        onClick={downloadResultsCSV}
                        className={styles.buttonPrimary}
                        style={{ padding: '8px 15px', fontSize: '0.85rem', background: 'var(--bg-tertiary)' }}
                    >
                        📊 Export Results (CSV)
                    </button>
                    <button
                        onClick={handleRecalculatePoints}
                        className={styles.buttonPrimary}
                        style={{ padding: '8px 15px', fontSize: '0.85rem', background: '#ff9800' }}
                    >
                        🔄 Recalculate Points
                    </button>
                </div>

            <div className="admin-table-container" style={{ maxHeight: '400px' }}>
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Event</th>
                            <th>Category</th>
                            <th>Prize</th>
                            <th>Name</th>
                            <th>Team</th>
                            <th>Grade</th>
                            <th>Chest No</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredResults.map(r => (
                            <tr key={r.id}>
                                <td>{r.eventName}</td>
                                <td>
                                    <span style={{
                                        fontSize: '0.75rem',
                                        fontWeight: '700',
                                        padding: '2px 8px',
                                        borderRadius: '10px',
                                        background: r.studentCategory === 'Junior' ? 'rgba(59, 130, 246, 0.2)' : r.studentCategory === 'Senior' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                                        color: r.studentCategory === 'Junior' ? '#60a5fa' : r.studentCategory === 'Senior' ? '#c084fc' : '#4ade80'
                                    }}>
                                        {r.studentCategory || "General"}
                                    </span>
                                </td>
                                <td>{r.place}</td>
                                <td>{r.name}</td>
                                <td>{r.team}</td>
                                <td>{r.grade}</td>
                                <td>{r.chestNo}</td>
                                <td>
                                    {(() => {
                                        const check = checkRegistration(r.name, r.eventName, r.chestNo);
                                        return (
                                            <span style={{
                                                fontSize: '0.65rem',
                                                color: check.status === 'success' ? '#4ade80' : check.status === 'warning' ? '#facc15' : '#f87171',
                                                display: 'block',
                                                marginBottom: '4px'
                                            }}>
                                                {check.status === 'success' ? '✓ Registered' : check.status === 'warning' ? '⚠ Not in Event' : '✖ Not Found'}
                                            </span>
                                        );
                                    })()}
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={() => handleEdit(r)} className="tab-btn" style={{ padding: '4px 10px', fontSize: '0.8rem', minWidth: 'auto', background: 'var(--surface)' }}>Edit</button>
                                        <button onClick={() => handleDelete(r.id)} className={styles.buttonDanger}>Remove</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
