import { useState, useEffect, useCallback } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";

export const useMasterParticipants = () => {
    const [participants, setParticipants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchParticipants = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Fetch both registrations and students in parallel
            const [regSnap, studentSnap] = await Promise.all([
                getDocs(query(collection(db, "registrations"))).catch(() => ({ docs: [] })),
                getDocs(query(collection(db, "students"))).catch(() => ({ docs: [] }))
            ]);

            // Build student metadata map by chest number and candidate name
            const studentMetaMap = {};
            studentSnap.docs.forEach(d => {
                const s = d.data();
                const chest = s.chestNumber || s.chestNo;
                const name = (s.fullName || s.name || "").trim().toUpperCase();
                const studentClass = s.studentClass || s.class || s.className || "";
                const category = s.category || s.studentCategory || "";

                if (chest) studentMetaMap[`CHEST_${chest}`] = { studentClass, category };
                if (name) studentMetaMap[`NAME_${name}`] = { studentClass, category };
            });

            const firestoreData = regSnap.docs.map(doc => {
                const data = doc.data();
                const chest = data.chestNumber;
                const name = (data.fullName || "").trim().toUpperCase();

                const meta = studentMetaMap[`CHEST_${chest}`] || studentMetaMap[`NAME_${name}`] || {};
                const studentClass = data.studentClass || data.class || meta.studentClass || "";
                const category = data.studentCategory || data.category || meta.category || "";

                return {
                    _id: doc.id,
                    "CANDIDATE NAME": data.fullName,
                    "CIC NO": data.cicNumber,
                    "CHEST NUMBER": data.chestNumber,
                    "TEAM": data.team,
                    "CLASS": studentClass,
                    "CATEGORY": category,
                    "ON STAGE EVENTS": data.onStageEvents?.join(", ") || "",
                    "OFF STAGE EVENTS": data.offStageEvents?.join(", ") || "",
                    "GENERAL EVENTS": data.generalEvents?.join(", ") || "",
                    _source: "firestore",
                    _submittedAt: data.submittedAt
                };
            });

            setParticipants(firestoreData);
        } catch (err) {
            console.error("Error formatting participants:", err);
            setError(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchParticipants();
    }, [fetchParticipants]);

    return { participants, loading, error, refetch: fetchParticipants };
};
