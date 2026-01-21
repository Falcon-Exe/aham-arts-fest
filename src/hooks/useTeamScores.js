import { useState, useEffect } from "react";
import { collection, onSnapshot, query, doc } from "firebase/firestore";
import { db } from "../firebase";
import { getEventType } from "../constants/events";

export function useTeamScores() {
    const [scores, setScores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showPoints, setShowPoints] = useState(false);
    const [showHomePoints, setShowHomePoints] = useState(false);
    const [showResultsPoints, setShowResultsPoints] = useState(false);
    useEffect(() => {
        const q = query(collection(db, "results"));

        // Real-time listener for scores
        const unsubscribeScores = onSnapshot(q, (snapshot) => {
            const results = snapshot.docs.map(doc => doc.data());
            const teamMap = {};

            results.forEach(r => {
                const team = r.team;
                if (!team) return;

                if (!teamMap[team]) {
                    teamMap[team] = {
                        team,
                        total: 0,
                        onStage: 0,
                        offStage: 0
                    };
                }

                let pts = 0;
                if (r.place === "First") pts = 5;
                else if (r.place === "Second") pts = 3;
                else if (r.place === "Third") pts = 1;

                teamMap[team].total += pts;

                const type = getEventType(r.eventName);
                if (type === "On Stage") {
                    teamMap[team].onStage += pts;
                } else {
                    teamMap[team].offStage += pts;
                }
            });

            // Convert to array and sort
            const sorted = Object.values(teamMap).sort((a, b) => b.total - a.total);
            setScores(sorted);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching scores:", error);
            setLoading(false);
        });

        // Real-time listener for public settings
        const unsubscribeSettings = onSnapshot(doc(db, "settings", "publicConfig"), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setShowPoints(data.showPoints);
                setShowHomePoints(data.showHomePoints ?? data.showPoints); // Fallback to showPoints if undefined
                setShowResultsPoints(data.showResultsPoints ?? data.showPoints); // Fallback to showPoints if undefined
            }
        });

        return () => {
            unsubscribeScores();
            unsubscribeSettings();
        };
    }, []);

    const champion = scores.length > 0 ? scores[0] : null;
    const runnerUp = scores.length > 1 ? scores[1] : null;

    return { scores, loading, champion, runnerUp, showPoints, showHomePoints, showResultsPoints };
}
