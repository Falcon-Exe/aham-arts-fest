import { useState, useEffect, useMemo } from "react";
import { collection, onSnapshot, query, doc } from "firebase/firestore";
import { db } from "../firebase";
import { getEventType } from "../constants/events";

export function useTeamScores() {
    const [rawResults, setRawResults] = useState([]);
    const [eventsList, setEventsList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showPoints, setShowPoints] = useState(false);
    const [showHomePoints, setShowHomePoints] = useState(false);
    const [showResultsPoints, setShowResultsPoints] = useState(false);
    const [showEventResults, setShowEventResults] = useState(true);
    const [teamColors, setTeamColors] = useState({});

    useEffect(() => {
        // 1. Live listener for results
        const unsubscribeScores = onSnapshot(collection(db, "results"), (snapshot) => {
            setRawResults(snapshot.docs.map(doc => doc.data()));
        }, (error) => {
            console.error("Error fetching scores:", error);
        });

        // 2. Live listener for events to resolve dynamic types
        const unsubscribeEvents = onSnapshot(collection(db, "events"), (snapshot) => {
            setEventsList(snapshot.docs.map(doc => doc.data()));
        }, (error) => {
            console.error("Error fetching events:", error);
        });

        // 3. Real-time listener for public settings
        const unsubscribeSettings = onSnapshot(doc(db, "settings", "publicConfig"), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setShowPoints(data.showPoints);
                setShowHomePoints(data.showHomePoints ?? data.showPoints);
                setShowResultsPoints(data.showResultsPoints ?? data.showPoints);
                setShowEventResults(data.showEventResults ?? true);
            }
        });

        // 4. Real-time listener for team colors
        const unsubscribeTeams = onSnapshot(collection(db, "teams"), (snapshot) => {
            const colors = {};
            snapshot.docs.forEach(d => {
                const t = d.data();
                if (t.name && t.color) {
                    colors[t.name.toUpperCase()] = t.color;
                }
            });
            setTeamColors(colors);
            setLoading(false);
        });

        return () => {
            unsubscribeScores();
            unsubscribeEvents();
            unsubscribeSettings();
            unsubscribeTeams();
        };
    }, []);

    // Memoize the calculated scores based on results and events
    const scores = useMemo(() => {
        // Build map of event name -> type
        const eventTypeMap = {};
        eventsList.forEach(ev => {
            if (ev.name) {
                eventTypeMap[ev.name.trim().toUpperCase()] = ev.type;
            }
        });

        const teamMap = {};

        rawResults.forEach(r => {
            const team = r.team;
            if (!team) return;

            if (!teamMap[team]) {
                teamMap[team] = {
                    team,
                    total: 0,
                    onStage: 0,
                    offStage: 0,
                    categories: {}
                };
            }

            const pts = Number(r.points) || 0;
            teamMap[team].total += pts;

            // Resolve dynamic type, fallback to static getEventType, then to default
            const normalizedEventName = (r.eventName || "").trim().toUpperCase();
            const type = eventTypeMap[normalizedEventName] || getEventType(r.eventName) || "On Stage";

            if (type === "On Stage") {
                teamMap[team].onStage += pts;
            } else {
                teamMap[team].offStage += pts;
            }

            const cat = r.studentCategory || "General";
            if (!teamMap[team].categories[cat]) {
                teamMap[team].categories[cat] = { total: 0, onStage: 0, offStage: 0 };
            }
            teamMap[team].categories[cat].total += pts;
            if (type === "On Stage") {
                teamMap[team].categories[cat].onStage = (teamMap[team].categories[cat].onStage || 0) + pts;
            } else {
                teamMap[team].categories[cat].offStage = (teamMap[team].categories[cat].offStage || 0) + pts;
            }
        });

        // Convert to array and sort
        return Object.values(teamMap).sort((a, b) => b.total - a.total);
    }, [rawResults, eventsList]);

    const champion = scores.length > 0 ? scores[0] : null;
    const runnerUp = scores.length > 1 ? scores[1] : null;

    return { scores, loading, champion, runnerUp, showPoints, showHomePoints, showResultsPoints, showEventResults, teamColors };
}


