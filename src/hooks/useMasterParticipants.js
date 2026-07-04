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
            const firestorePromise = getDocs(query(collection(db, "registrations"), orderBy("submittedAt", "desc")))
                .then(snapshot => snapshot.docs.map(doc => ({
                    _id: doc.id,
                    "CANDIDATE NAME": doc.data().fullName,
                    "CIC NO": doc.data().cicNumber,
                    "CHEST NUMBER": doc.data().chestNumber,
                    "TEAM": doc.data().team,
                    "ON STAGE EVENTS": doc.data().onStageEvents?.join(", ") || "",
                    "OFF STAGE EVENTS": doc.data().offStageEvents?.join(", ") || "",
                    "GENERAL EVENTS": doc.data().generalEvents?.join(", ") || "",
                    _source: "firestore",
                    _submittedAt: doc.data().submittedAt
                })))
                .catch(err => {
                    console.error("FIRESTORE LOAD FAILED:", err);
                    return [];
                });

            const firestoreData = await firestorePromise;
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
