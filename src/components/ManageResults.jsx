import { useState, useEffect, useCallback } from "react";
import { collection, addDoc, orderBy, query, deleteDoc, doc, updateDoc, setDoc, onSnapshot, deleteField } from "firebase/firestore";
import { getDocs } from "firebase/firestore";
import { db } from "../firebase";
import Papa from "papaparse";
import Toast from "./Toast";
import ConfirmDialog from "./ConfirmDialog";
import { useConfirm } from "../hooks/useConfirm";
import { CSV_URL } from "../config";
import { isGeneralEvent } from "../constants/events";
import { TEAMS } from "../constants/teams";

export default function ManageResults() {
    const [events, setEvents] = useState([]);
    const [results, setResults] = useState([]);
    const [masterParticipants, setMasterParticipants] = useState([]);
    const [filteredParticipants, setFilteredParticipants] = useState([]);
    const [selectedStudentId, setSelectedStudentId] = useState("");
    const [editId, setEditId] = useState(null);
    const [formData, setFormData] = useState({
        eventId: "",
        eventName: "",
        place: "First",
        name: "",
        team: "",
    });
    const [showHomePoints, setShowHomePoints] = useState(false);
    const [showResultsPoints, setShowResultsPoints] = useState(false);
    const [toast, setToast] = useState(null);
    const { confirm, confirmState } = useConfirm();

    const showToast = (message, type = 'info') => {
        setToast({ message, type });
    };

    const handleToastClose = () => {
        setToast(null);
    };

    // Subscribe to settings/publicConfig for Points Visibility
    useEffect(() => {
        const unsubscribe = onSnapshot(doc(db, "settings", "publicConfig"), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                // Initialize with legacy showPoints if new fields don't exist
                setShowHomePoints(data.showHomePoints ?? data.showPoints);
                setShowResultsPoints(data.showResultsPoints ?? data.showPoints);
            }
        });
        return () => unsubscribe();
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

    // URL for master participants CSV
    const csvUrl = CSV_URL;

    // Fetch Events and Master Participants
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

    const fetchAllParticipants = useCallback(async () => {
        // Helper to fix CSV typos
        const normalizeEventString = (str) => {
            if (!str) return "";
            let s = str.toUpperCase();
            s = s.replace(/SHORT VLOGING/g, "SHORT VLOGGING");
            s = s.replace(/SAMMARIZATION/g, "SUMMARIZATION");
            s = s.replace(/MINISTORY/g, "MINI STORY");
            s = s.replace(/PHOTOFEACHURE/g, "PHOTO FEATURE");
            s = s.replace(/Q&H/g, "Q AND H");
            s = s.replace(/SONG WRITER/g, "SONG WRITING");
            return s;
        };

        try {
            // 1. Fetch CSV
            const csvPromise = fetch(csvUrl + "&t=" + Date.now())
                .then(res => res.text())
                .then(csv => {
                    return new Promise((resolve) => {
                        Papa.parse(csv, {
                            header: true,
                            skipEmptyLines: true,
                            complete: (results) => resolve(results.data)
                        });
                    });
                });

            // 2. Fetch Firestore
            const firestorePromise = getDocs(query(collection(db, "registrations"), orderBy("submittedAt", "desc")))
                .then((snapshot) => {
                    return snapshot.docs.map(doc => {
                        const data = doc.data();
                        return {
                            _id: doc.id,
                            "CANDIDATE NAME": data.fullName,
                            "CANDIDATE  FULL NAME": data.fullName,
                            "CIC NO": data.cicNumber,
                            "CIC NUMBER": data.cicNumber,
                            "CHEST NUMBER": data.chestNumber,
                            "CHEST NO": data.chestNumber,
                            "TEAM": data.team,
                            "TEAM NAME": data.team,
                            "ON STAGE ITEMS": data.onStageEvents?.join(", ") || "",
                            "ON STAGE EVENTS": data.onStageEvents?.join(", ") || "",
                            "OFF STAGE ITEMES": data.offStageEvents?.join(", ") || "",
                            "OFF STAGE ITEMS": data.offStageEvents?.join(", ") || "",
                            "OFF STAGE EVENTS": data.offStageEvents?.join(", ") || "",
                            "GENERAL EVENTS": data.generalEvents?.join(", ") || "",
                            _source: "firestore"
                        };
                    });
                });

            const [csvData, firestoreData] = await Promise.all([csvPromise, firestorePromise]);

            // Add IDs to CSV data and normalize events
            const csvWithIds = csvData.map((row, idx) => {
                const onStage = normalizeEventString(row["ON STAGE EVENTS"] || row["ON STAGE ITEMS"]);
                const offStage = normalizeEventString(row["OFF STAGE EVENTS"] || row["OFF STAGE ITEMS"] || row["OFF STAGE ITEMES"]);
                const generalRaw = row["GENERAL EVENTS"] || row["GENERAL ITEMS"] || row["OFF STAGE - GENERAL"] || row["ON STAGE - GENERAL"];
                const general = normalizeEventString(generalRaw);

                return {
                    ...row,
                    _id: `csv_${idx}`,
                    id: `csv_${idx}`,
                    "CANDIDATE NAME": row["CANDIDATE NAME"] || row["CANDIDATE  FULL NAME"],
                    "CIC NO": row["CIC NO"] || row["CIC NUMBER"],
                    "TEAM": row["TEAM"] || row["TEAM NAME"],
                    "CHEST NUMBER": row["CHEST NUMBER"] || row["CHEST NO"],
                    "ON STAGE EVENTS": onStage,
                    "OFF STAGE EVENTS": offStage,
                    "GENERAL EVENTS": general,
                    _source: "csv"
                };
            });

            // MERGE LOGIC
            const mergedMap = new Map();
            const rawList = [...firestoreData, ...csvWithIds];

            rawList.forEach(item => {
                const chestNo = (item["CHEST NUMBER"] || item["CHEST NO"] || "").toString().trim();

                // If no chest no, just add as unique item
                if (!chestNo) {
                    mergedMap.set(item._id, item);
                    return;
                }

                if (mergedMap.has(chestNo)) {
                    // Merge with existing
                    const existing = mergedMap.get(chestNo);

                    // Combine events (deduplicate)
                    const mergeEvents = (str1, str2) => {
                        const s1 = str1 ? str1.split(",").map(s => s.trim()).filter(Boolean) : [];
                        const s2 = str2 ? str2.split(",").map(s => s.trim()).filter(Boolean) : [];
                        return [...new Set([...s1, ...s2])].join(", ");
                    };

                    existing["ON STAGE EVENTS"] = mergeEvents(existing["ON STAGE EVENTS"], item["ON STAGE EVENTS"]);
                    existing["OFF STAGE EVENTS"] = mergeEvents(existing["OFF STAGE EVENTS"], item["OFF STAGE EVENTS"]);
                    existing["GENERAL EVENTS"] = mergeEvents(existing["GENERAL EVENTS"], item["GENERAL EVENTS"]);

                    if (item._source === "firestore") existing._source = "firestore";
                    if (existing._source === "csv" && item._source === "firestore") existing._source = "APP+CSV";

                } else {
                    mergedMap.set(chestNo, item);
                }
            });

            // Merge Firestore first (live data) then CSV
            setMasterParticipants(Array.from(mergedMap.values()));

        } catch (err) {
            console.error("Error fetching participants:", err);
        }
    }, []);

    useEffect(() => {
        const run = async () => {
            await fetchEvents();
            await fetchResults();
            await fetchAllParticipants();
        };
        run();
    }, [fetchEvents, fetchResults, fetchAllParticipants]);



    // Helper for fuzzy matching (removes spaces, special chars)
    const toComparable = (str) => {
        return str ? str.toLowerCase().replace(/[^a-z0-9]/g, "") : "";
    };

    const handleEventChange = (e) => {
        const eventId = e.target.value;
        const ev = events.find(event => event.id === eventId);
        const eventName = ev?.name || "";

        setFormData({ ...formData, eventId, eventName, name: "", team: "", chestNo: "" });
        setSelectedStudentId("");

        if (eventName) {
            const registered = masterParticipants.filter(p => {
                const onStage = p["ON STAGE ITEMS"] || p["ON STAGE EVENTS"] || "";
                const offStage = p["OFF STAGE ITEMES"] || p["OFF STAGE ITEMS"] || p["OFF STAGE EVENTS"] || "";
                const general = p["GENERAL EVENTS"] || p["OFF STAGE - GENERAL"] || p["ON STAGE - GENERAL"] || "";

                const allEventsList = (onStage + "," + offStage + "," + general).split(',').map(s => s.trim().toUpperCase());
                return allEventsList.includes(eventName.toUpperCase().trim());
            });
            setFilteredParticipants(registered);
        } else {
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
            setFormData({
                ...formData,
                name: student["CANDIDATE NAME"] || student["CANDIDATE  FULL NAME"],
                team: student["TEAM"] || student["TEAM NAME"] || "",
                chestNo: student["CHEST NUMBER"] || student["CHEST NO"] || ""
            });
        }
    };

    const checkRegistration = (studentName, eventName, chestNo = null, studentId = null) => {
        if (masterParticipants.length === 0) return { status: 'loading', msg: '' };

        let student;

        // 0. Try finding by ID (most precise, used in Submit)
        if (studentId && studentId !== "Manual Entry") {
            student = masterParticipants.find(p => p._id === studentId);
        }

        // 1. Try finding by Chest Number (if provided) - precise match
        if (!student && chestNo) {
            student = masterParticipants.find(p =>
                String(p["CHEST NUMBER"] || p["CHEST NO"] || "").trim() === String(chestNo).trim()
            );
        }

        // 2. Fallback to Name (Smart Lookup: Prioritize valid registration)
        if (!student) {
            const candidates = masterParticipants.filter(p =>
                (p["CANDIDATE NAME"] || p["CANDIDATE  FULL NAME"])?.trim().toLowerCase() === studentName.trim().toLowerCase()
            );

            if (candidates.length > 0) {
                // Try to find one that has the event
                student = candidates.find(p => {
                    const onStage = p["ON STAGE ITEMS"] || p["ON STAGE EVENTS"] || "";
                    const offStage = p["OFF STAGE ITEMES"] || p["OFF STAGE ITEMS"] || p["OFF STAGE EVENTS"] || "";
                    const general = p["GENERAL EVENTS"] || p["OFF STAGE - GENERAL"] || p["ON STAGE - GENERAL"] || "";
                    const allEventsList = (onStage + "," + offStage + "," + general).split(',').map(s => s.trim().toUpperCase());
                    return allEventsList.includes(eventName.toUpperCase().trim());
                });

                // If none registered, just take the first candidate
                if (!student) student = candidates[0];
            }
        }

        if (!student) {
            return { status: 'error', msg: `Student "${studentName}" not found in master list!` };
        }

        // Check if event name exists in On Stage or Off Stage columns
        const onStage = student["ON STAGE ITEMS"] || student["ON STAGE EVENTS"] || "";
        const offStage = student["OFF STAGE ITEMES"] || student["OFF STAGE ITEMS"] || student["OFF STAGE EVENTS"] || "";
        const general = student["GENERAL EVENTS"] || student["OFF STAGE - GENERAL"] || student["ON STAGE - GENERAL"] || "";

        const allEventsList = (onStage + "," + offStage + "," + general).split(',').map(s => s.trim().toUpperCase());

        // Exact Check
        if (!allEventsList.includes(eventName.toUpperCase().trim())) {
            // If name matched but event didn't, and we didn't use chest number, maybe there's ANOTHER student with same name?
            // This is a "weak match" scenario. But for now, we assume name collision needs unique ID or ChestNo.
            return { status: 'warning', msg: `Student is found, but NOT registered for "${eventName}".` };
        }

        return { status: 'success', msg: 'Verified Registration ✓' };
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.eventId || !formData.name) {
            showToast("Please select an event and enter name", "error");
            return;
        }

        // Registration Validation
        const eventObj = events.find(e => e.id === formData.eventId);
        const regCheck = checkRegistration(formData.name, eventObj?.name || "", formData.chestNo, selectedStudentId);

        if (regCheck.status === 'error') {
            if (!await confirm(`${regCheck.msg}\n\nDo you want to proceed anyway?`)) return;
        } else if (regCheck.status === 'warning') {
            if (!await confirm(`${regCheck.msg}\n\nProceed anyway?`)) return;
        }

        // Validation: Prevent duplicate place for same event (excluding current edit)
        const isDuplicatePlace = results.some(r =>
            r.id !== editId && r.eventId === formData.eventId && r.place === formData.place
        );
        if (isDuplicatePlace) {
            const confirmed = await confirm(`A ${formData.place} Place winner already exists for this event. Do you want to add another one (Tie)?`);
            if (!confirmed) return;
        }

        try {
            // Find event details
            const ev = events.find(e => e.id === formData.eventId);
            const category = ev?.category || "A"; // Default to A if missing
            const place = formData.place;
            const grade = formData.grade;

            // 1. Calculate Category Points
            let categoryPoints = 0;

            // Check if General Event (Overrides Category)
            const isGeneral = isGeneralEvent(ev?.name);

            if (place === "None") {
                categoryPoints = 0;
            } else if (isGeneral) {       // <--- NEW: General Events Logic
                if (place === "First") categoryPoints = 25;
                else if (place === "Second") categoryPoints = 15;
                else if (place === "Third") categoryPoints = 10;
            } else if (category === "A") {
                if (place === "First") categoryPoints = 12;
                else if (place === "Second") categoryPoints = 8;
                else if (place === "Third") categoryPoints = 4;
            } else if (category === "B") {
                if (place === "First") categoryPoints = 10;
                else if (place === "Second") categoryPoints = 6;
                else if (place === "Third") categoryPoints = 3;
            } else if (category === "C") {
                if (place === "First") categoryPoints = 25;
                else if (place === "Second") categoryPoints = 15;
                else if (place === "Third") categoryPoints = 10;
            }

            // 2. Calculate Grade Points
            let gradePoints = 0;
            if (grade === "A+") gradePoints = 7;
            else if (grade === "A") gradePoints = 5;
            else if (grade === "B") gradePoints = 3;
            else if (grade === "C") gradePoints = 1;

            const totalPoints = categoryPoints + gradePoints;

            const payload = {
                ...formData,
                eventName: ev?.name || "Unknown",
                category: isGeneral ? "General" : category, // Tag as General if applicable
                points: totalPoints
            };

            if (editId) {
                await updateDoc(doc(db, "results", editId), payload);
                showToast(`Result updated! Points: ${totalPoints}`, "success");
            } else {
                await addDoc(collection(db, "results"), payload);
                showToast(`Result published! Points: ${totalPoints}`, "success");
            }
            setFormData({ ...formData, name: "", team: "", grade: "", chestNo: "" });
            setEditId(null);
            fetchResults();
        } catch (err) {
            console.error(err);
            showToast("Error saving result", "error");
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
            chestNo: result.chestNo || ""
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
            chestNo: ""
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

                            await addDoc(collection(db, "results"), {
                                eventId: matchedEvent.id,
                                eventName: matchedEvent.name,
                                name: studentName,
                                team: teamName,
                                place: prize,
                                grade: grade,
                                chestNo: chestNo
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
        link.setAttribute("download", "aham_arts_fest_results.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDelete = async (id) => {
        if (!await confirm("Delete this result?")) return;
        await deleteDoc(doc(db, "results", id));
        fetchResults();
    }

    const handleRecalculatePoints = async () => {
        if (!await confirm("This will recalculate points for ALL results based on the new rules (Category + Grade). Continue?")) return;
        let updated = 0;

        for (const r of results) {
            const ev = events.find(e => e.id === r.eventId);
            if (!ev) continue;

            const category = ev.category || "A";
            const place = r.place;
            const grade = r.grade;

            // 1. Calculate Category Points
            let categoryPoints = 0;
            const isGeneral = isGeneralEvent(ev.name); // Check General

            if (place === "None") {
                categoryPoints = 0;
            } else if (isGeneral) {       // <--- NEW: General Events Logic Recalc
                if (place === "First") categoryPoints = 25;
                else if (place === "Second") categoryPoints = 15;
                else if (place === "Third") categoryPoints = 10;
            } else if (category === "A") {
                if (place === "First") categoryPoints = 12;
                else if (place === "Second") categoryPoints = 8;
                else if (place === "Third") categoryPoints = 4;
            } else if (category === "B") {
                if (place === "First") categoryPoints = 10;
                else if (place === "Second") categoryPoints = 6;
                else if (place === "Third") categoryPoints = 3;
            } else if (category === "C") {
                if (place === "First") categoryPoints = 25;
                else if (place === "Second") categoryPoints = 15;
                else if (place === "Third") categoryPoints = 10;
            }

            // 2. Calculate Grade Points
            let gradePoints = 0;
            if (grade === "A+") gradePoints = 7;
            else if (grade === "A") gradePoints = 5;
            else if (grade === "B") gradePoints = 3;
            else if (grade === "C") gradePoints = 1;

            const totalPoints = categoryPoints + gradePoints;

            if (r.points !== totalPoints) {
                await updateDoc(doc(db, "results", r.id), {
                    points: totalPoints,
                    category: isGeneral ? "General" : category
                });
                updated++;
            }
        }
        showToast(`Recalculation Complete! Updated ${updated} results.`, "success");
        fetchResults();
    };

    // State for Poster Upload
    const [posterEventId, setPosterEventId] = useState("");
    const [posterUploading, setPosterUploading] = useState(false);

    // Event Search State
    const [eventSearchTerm, setEventSearchTerm] = useState("");

    // Results History Search State
    const [resultsSearchTerm, setResultsSearchTerm] = useState("");

    // Cloudinary Config (Reused)
    const CLOUD_NAME = "dncz0c7vu";
    const UPLOAD_PRESET = "aham-arts-fest";

    const handlePosterUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !posterEventId) return;

        setPosterUploading(true);
        const data = new FormData();
        data.append("file", file);
        data.append("upload_preset", UPLOAD_PRESET);

        try {
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
        return (
            (r.eventName || "").toLowerCase().includes(q) ||
            (r.name || "").toLowerCase().includes(q) ||
            (r.team || "").toLowerCase().includes(q) ||
            (r.chestNo || "").toString().toLowerCase().includes(q) ||
            (r.grade || "").toLowerCase().includes(q)
        );
    });

    return (
        <div className="manage-results">
            {toast && <Toast message={toast.message} type={toast.type} onClose={handleToastClose} />}
            {confirmState && <ConfirmDialog {...confirmState} />}

            <h3 className="section-title">Upload Result Poster 🖼️</h3>
            <div className="card" style={{ marginBottom: '30px', padding: '20px', background: '#1a1a1a', border: '1px solid #333' }}>
                <p style={{ color: '#888', marginBottom: '15px' }}>Upload the official result poster image for an event.</p>
                <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                    <select
                        className="admin-select"
                        style={{ flex: 1, minWidth: '200px' }}
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#222', padding: '10px', borderRadius: '6px' }}>
                                <img src={selectedEvent.resultImage} alt="Current Poster" style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px' }} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '0.8rem', color: '#fff' }}>Current Poster Active</div>
                                    <a href={selectedEvent.resultImage} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>View Full</a>
                                </div>
                                <button type="button" onClick={handleRemovePoster} style={{ background: '#d32f2f', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}> Remove </button>
                            </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handlePosterUpload}
                                disabled={!posterEventId || posterUploading}
                                style={{ color: '#ccc' }}
                            />
                        </div>
                    </div>
                </div>
                {posterUploading && <p style={{ color: 'var(--primary)', marginTop: '10px' }}>Uploading Poster... Please wait...</p>}
            </div>


            <h3 className="section-title">{editId ? "Edit Result" : "Publish Results (Winners)"}</h3>

            <form onSubmit={handleSubmit} className="admin-form">
                <div className="form-grid">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <input
                            placeholder="🔍 Filter Events..."
                            value={eventSearchTerm}
                            onChange={(e) => setEventSearchTerm(e.target.value)}
                            className="admin-input"
                            style={{ padding: '8px', fontSize: '0.8rem', background: '#222', border: '1px solid #333' }}
                        />
                        <select
                            className="admin-select"
                            value={formData.eventId}
                            onChange={handleEventChange}
                            required
                        >
                            <option value="">-- Select Event --</option>
                            {filteredEventsForSelect.map(ev => {
                                const hasResult = results.some(r => r.eventId === ev.id);
                                return (
                                    <option key={ev.id} value={ev.id}>
                                        {ev.name} {hasResult ? "✅" : ""}
                                    </option>
                                );
                            })}
                        </select>
                    </div>

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

                    {/* Dynamic Selection: Team for General, Student for Others */}
                    {isGeneralEvent(events.find(e => e.id === formData.eventId)?.name) ? (
                        <div style={{ marginBottom: '15px' }}>
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
                                {TEAMS.map(team => (
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
                            <option value="">-- Select Registered Student --</option>
                            {filteredParticipants.map((p) => (
                                <option key={p._id} value={p._id}>
                                    {(p["CHEST NUMBER"] || p["CHEST NO"]) ? `[${p["CHEST NUMBER"] || p["CHEST NO"]}] ` : ""}{p["CANDIDATE NAME"] || p["CANDIDATE  FULL NAME"]}
                                </option>
                            ))}
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
                        style={{ border: '1px solid #333' }}
                    >
                        <option value="">-- Select Grade --</option>
                        <option value="A+">A+</option>
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                    </select>
                    <input className="admin-input" placeholder="Chest No" value={formData.chestNo} onChange={e => setFormData({ ...formData, chestNo: e.target.value })} />
                </div>
                <div className="admin-form-actions" style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
                    <button type="submit" className="submit-btn" style={{ flex: 2 }}>
                        {editId ? "Update Result ✓" : "Publish Winner"}
                    </button>
                    {editId && (
                        <button type="button" onClick={handleCancelEdit} className="submit-btn" style={{ flex: 1, background: '#555' }}>
                            Cancel
                        </button>
                    )}
                    {!editId && (
                        <label className="submit-btn" style={{ flex: 1, background: '#333', cursor: 'pointer', textAlign: 'center', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            📥 Bulk Upload (CSV)
                            <input type="file" accept=".csv" onChange={handleBulkUpload} style={{ display: 'none' }} />
                        </label>
                    )}
                </div>
            </form>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '30px', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flex: 1 }}>
                    <h4 style={{ margin: 0, color: 'var(--primary)', whiteSpace: 'nowrap' }}>Published Results History</h4>
                    <input
                        type="text"
                        placeholder="🔍 Search history..."
                        value={resultsSearchTerm}
                        onChange={(e) => setResultsSearchTerm(e.target.value)}
                        className="admin-input"
                        style={{ padding: '8px', fontSize: '0.85rem', width: '100%', maxWidth: '300px', background: '#222', border: '1px solid #333' }}
                    />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={toggleHomePoints}
                        className="submit-btn"
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
                        className="submit-btn"
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
                        onClick={downloadResultsCSV}
                        className="submit-btn"
                        style={{ padding: '8px 15px', fontSize: '0.85rem', background: '#222' }}
                    >
                        📊 Export Results (CSV)
                    </button>
                    <button
                        onClick={handleRecalculatePoints}
                        className="submit-btn"
                        style={{ padding: '8px 15px', fontSize: '0.85rem', background: '#ff9800' }}
                    >
                        🔄 Recalculate Points
                    </button>
                </div>
            </div>
            <div className="admin-table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Event</th>
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
                                        <button onClick={() => handleEdit(r)} className="tab-btn" style={{ padding: '4px 10px', fontSize: '0.8rem', minWidth: 'auto', background: '#222' }}>Edit</button>
                                        <button onClick={() => handleDelete(r.id)} className="delete-btn">Remove</button>
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
