import React, { useState, useEffect } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../firebase";
import { useMasterParticipants } from "../hooks/useMasterParticipants";
import { getEventType, resolveClassCategory } from "../constants/events";

export default function ManageIndividualPoints() {
    const { participants: masterParticipants } = useMasterParticipants();
    const [individualScores, setIndividualScores] = useState([]);
    const [eventsList, setEventsList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [sortConfig, setSortConfig] = useState({ key: 'total', direction: 'desc' });
    const [expandedRow, setExpandedRow] = useState(null);
    const [expandedChampion, setExpandedChampion] = useState(null);
    const [activeCategoryTab, setActiveCategoryTab] = useState("Overall");
    const [expandedTier, setExpandedTier] = useState(null);

    let dynamicCategories = [];
    try {
        const storedCats = localStorage.getItem("branding_studentCategories");
        if (storedCats) dynamicCategories = JSON.parse(storedCats);
    } catch (e) {
        console.error(e);
    }
    if (dynamicCategories.length === 0) {
        dynamicCategories = ["Junior", "Senior"];
    }

    const masterMetaMap = React.useMemo(() => {
        const catMap = {};
        const classMap = {};
        const teamMap = {};
        const nameMap = {};
        if (masterParticipants && masterParticipants.length > 0) {
            masterParticipants.forEach(p => {
                const chest = p["CHEST NUMBER"];
                const name = (p["CANDIDATE NAME"] || "").trim();
                const category = p["CATEGORY"];
                const studentClass = p["CLASS"];
                const team = p["TEAM"];
                if (chest) {
                    const chestKey = `CHEST_${String(chest).trim().toUpperCase()}`;
                    catMap[chestKey] = category;
                    classMap[chestKey] = studentClass;
                    if (team) teamMap[chestKey] = team;
                    if (name) nameMap[chestKey] = name;
                }
                if (name) {
                    const nameKey = `NAME_${name.toUpperCase()}`;
                    catMap[nameKey] = category;
                    classMap[nameKey] = studentClass;
                    if (team) teamMap[nameKey] = team;
                }
            });
        }
        return { catMap, classMap, teamMap, nameMap };
    }, [masterParticipants]);

    const isThamheediyyaUla = (studentClass) => {
        if (!studentClass) return false;
        const upper = String(studentClass).toUpperCase().trim();
        return upper.includes("THAMHEEDIYYA ULA") ||
               upper.includes("THAMHIDIYYA ULA") ||
               upper.includes("THAMHEEDIYA ULA") ||
               upper.includes("THAMHEEDIYYA 1") ||
               upper.includes("THAMHIDIYYA 1") ||
               upper.includes("1 THAMHEEDIYYA") ||
               (upper.includes("THAMHEEDI") && upper.includes("ULA"));
    };

    useEffect(() => {
        // Real-time listener for events to resolve types (On Stage vs Off Stage)
        const unsubEvents = onSnapshot(collection(db, "events"), (snapshot) => {
            const list = snapshot.docs.map(doc => doc.data());
            setEventsList(list);
        });

        // Real-time listener for results
        const q = query(collection(db, "results"));
        const unsubResults = onSnapshot(q, (snapshot) => {
            const scores = {};

            snapshot.docs.forEach((doc) => {
                const data = doc.data();

                const chestNo = data.chestNo ? String(data.chestNo).trim() : null;
                const rawName = data.name ? data.name.trim() : "Unknown";
                const rawTeam = data.team || "";

                // Skip team/group entries without a chest number (e.g. POLARIS Team in AI VIDEO CREATION)
                const isGroupTeamEntry = (!chestNo || chestNo === '-' || chestNo === 'null') &&
                    (rawName.toUpperCase().includes("TEAM") || rawName.toUpperCase() === rawTeam.toUpperCase() || rawName === "Unknown");
                if (isGroupTeamEntry) return;

                const chestKey = chestNo ? `CHEST_${chestNo.toUpperCase()}` : null;
                const nameKey = rawName ? `NAME_${rawName.toUpperCase()}` : null;

                // Priority: Master student roster mapping for Team and Name, fallback to Result entry
                const masterTeam = (chestKey && masterMetaMap.teamMap[chestKey]) || (nameKey && masterMetaMap.teamMap[nameKey]);
                const masterName = (chestKey && masterMetaMap.nameMap[chestKey]);

                const team = masterTeam || rawTeam;
                const name = masterName || rawName;

                const key = chestNo || `${name}_${team}`;

                const masterCat = (chestKey && masterMetaMap.catMap[chestKey]) || (nameKey && masterMetaMap.catMap[nameKey]);
                const masterClass = (chestKey && masterMetaMap.classMap[chestKey]) || (nameKey && masterMetaMap.classMap[nameKey]);

                const studentClass = masterClass || data.studentClass || data.class || "";
                const rawCategory = masterCat || data.studentCategory || "General";
                const studentCategory = resolveClassCategory(studentClass, rawCategory);

                if (!scores[key]) {
                    scores[key] = {
                        key,
                        name: name,
                        chestNo: chestNo || "-",
                        team: team,
                        category: studentCategory,
                        studentClass: studentClass,
                        items: [],
                        first: 0,
                        second: 0,
                        third: 0,
                        total: 0
                    };
                } else {
                    if (studentCategory && studentCategory !== "General") {
                        scores[key].category = studentCategory;
                    }
                    if (studentClass && !scores[key].studentClass) {
                        scores[key].studentClass = studentClass;
                    }
                }

                // Keep team up to date if resolved from master roster
                if (masterTeam && scores[key].team !== masterTeam) {
                    scores[key].team = masterTeam;
                }

                if (studentCategory && studentCategory !== "General" && studentCategory !== "Junior & Senior") {
                    scores[key].category = studentCategory;
                }

                if (masterClass && !scores[key].studentClass) {
                    scores[key].studentClass = masterClass;
                }

                if (data.place === "First") scores[key].first += 1;
                else if (data.place === "Second") scores[key].second += 1;
                else if (data.place === "Third") scores[key].third += 1;

                const pts = Number(data.points) || 0;
                scores[key].total += pts;

                if (pts > 0) {
                    scores[key].items.push(`${data.eventName} (${data.place})`);
                }

                if (!scores[key].rawResults) scores[key].rawResults = [];
                scores[key].rawResults.push(data);
            });

            const scoreArray = Object.values(scores);
            setIndividualScores(scoreArray);
            setLoading(false);
        });

        return () => {
            unsubEvents();
            unsubResults();
        };
    }, [masterMetaMap]);

    // SORTING LOGIC
    const handleSort = (key) => {
        let direction = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const handleRowClick = (key) => {
        if (expandedRow === key) {
            setExpandedRow(null);
        } else {
            setExpandedRow(key);
        }
    };

    // Filter out team entries (those without chest numbers or where chest number matches a team name)
    const individualOnlyScores = individualScores.filter(student => {
        if (!student.chestNo || student.chestNo === '-') return false;
        const chestUpper = String(student.chestNo).toUpperCase().trim();
        const teamUpper = String(student.team).toUpperCase().trim();
        // Ignore if chest number is literally a team name (e.g. TEAM A)
        if (chestUpper.startsWith("TEAM") || chestUpper === teamUpper) return false;
        return true;
    });

    const filteredByCategoryScores = individualOnlyScores.filter(student => {
        if (activeCategoryTab === "Overall") return true;
        return student.category === activeCategoryTab;
    });

    const sortedScores = [...filteredByCategoryScores].sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
            return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
            return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
    });

    const isCategoryA = (r) => {
        const cat = (r.category || "").trim().toUpperCase();
        return cat === "A" || cat === "CAT A" || cat === "CATEGORY A";
    };

    // CHAMPIONSHIP LOGIC PER CATEGORY
    const calculateChampions = (scores) => {
        const eventTypeMap = {};
        eventsList.forEach(ev => {
            if (ev.name) eventTypeMap[ev.name.trim().toUpperCase()] = ev.type;
        });

        const getResultType = (r) => {
            if (r.type) return r.type;
            if (r.eventType) return r.eventType;
            const norm = (r.eventName || "").trim().toUpperCase();
            const mapped = eventTypeMap[norm];
            if (mapped) return mapped;
            const staticType = getEventType(r.eventName);
            return staticType !== "Unknown" ? staticType : "On Stage";
        };

        const kalaEligibleCandidates = [];

        scores.forEach(student => {
            const raw = student.rawResults || [];

            // 1. Must have at least one 1st Place with A+ in a Category A event
            const hasCatAFirstWithAPlus = raw.some(r =>
                isCategoryA(r) &&
                (r.place === "First" || r.place === "1") &&
                r.grade === "A+"
            );

            // 2. Must have earned an A+ grade in an On-Stage event
            const hasOnStageAPlus = raw.some(r =>
                getResultType(r) === "On Stage" &&
                r.grade === "A+"
            );

            // 3. Must have earned an A+ grade in an Off-Stage event
            const hasOffStageAPlus = raw.some(r =>
                getResultType(r) === "Off Stage" &&
                r.grade === "A+"
            );

            const isEligible = hasCatAFirstWithAPlus && hasOnStageAPlus && hasOffStageAPlus;

            // Count total Category A events participated in & A+ grades secured for tie-breakers
            const catAEventsCount = raw.filter(r => isCategoryA(r)).length;
            const aPlusCount = raw.filter(r => (r.grade || "").trim() === "A+").length;

            if (isEligible) {
                kalaEligibleCandidates.push({
                    student,
                    total: student.total,
                    catAEventsCount,
                    aPlusCount
                });
            }
        });

        // Sort Kalaprathibha candidates:
        // Priority 1: Highest Total Points | Priority 2: Highest Category A Event Count | Priority 3: Highest A+ Grade Count
        kalaEligibleCandidates.sort((a, b) => {
            if (b.total !== a.total) return b.total - a.total;
            if (b.catAEventsCount !== a.catAEventsCount) return b.catAEventsCount - a.catAEventsCount;
            return b.aPlusCount - a.aPlusCount;
        });

        const kalaWinner = kalaEligibleCandidates.length > 0 ? kalaEligibleCandidates[0].student : null;

        // Sargaprathibha: Highest points excluding Kalaprathibha winner
        const sargaCandidates = [];

        scores.forEach(student => {
            if (kalaWinner && student.key === kalaWinner.key) return;

            const raw = student.rawResults || [];
            const catAEventsCount = raw.filter(r => isCategoryA(r)).length;
            const aPlusCount = raw.filter(r => (r.grade || "").trim() === "A+").length;

            sargaCandidates.push({
                student,
                total: student.total,
                catAEventsCount,
                aPlusCount
            });
        });

        // Sort Sargaprathibha candidates:
        // Priority 1: Highest Total Points | Priority 2: Highest Category A Event Count | Priority 3: Highest A+ Grade Count
        sargaCandidates.sort((a, b) => {
            if (b.total !== a.total) return b.total - a.total;
            if (b.catAEventsCount !== a.catAEventsCount) return b.catAEventsCount - a.catAEventsCount;
            return b.aPlusCount - a.aPlusCount;
        });

        const sargaWinner = sargaCandidates.length > 0 ? sargaCandidates[0].student : null;

        return { sargaWinner, kalaWinner };
    };

    // Emerging Star Award calculation (Thamheediyya Ula highest points with Cat A & A+ tie breaker)
    const getEmergingStarWinner = (scores) => {
        const ulaCandidates = [];
        scores.forEach(student => {
            const raw = student.rawResults || [];
            const stClass = student.studentClass || "";
            const isUla = isThamheediyyaUla(stClass) || raw.some(r => isThamheediyyaUla(r.studentClass || r.class));

            if (isUla) {
                const catAEventsCount = raw.filter(r => isCategoryA(r)).length;
                const aPlusCount = raw.filter(r => (r.grade || "").trim() === "A+").length;
                ulaCandidates.push({
                    student,
                    total: student.total,
                    catAEventsCount,
                    aPlusCount
                });
            }
        });

        ulaCandidates.sort((a, b) => {
            if (b.total !== a.total) return b.total - a.total;
            if (b.catAEventsCount !== a.catAEventsCount) return b.catAEventsCount - a.catAEventsCount;
            return b.aPlusCount - a.aPlusCount;
        });

        return ulaCandidates.length > 0 ? ulaCandidates[0].student : null;
    };

    const isLStarArabicEvent = (eventName) => {
        if (!eventName) return false;
        const upper = String(eventName).toUpperCase().trim();
        const targets = [
            "SPEECH ARABIC", "TABLE TALK ARABIC", "LISTENING ARABIC",
            "REPORT WRITING ARABIC", "REPORT ARABIC", "STORY ARABIC",
            "MINI STORY ARABIC", "MINISTORY ARABIC", "INSPIRING TALK ARABIC",
            "SPIRITUAL TALK ARABIC"
        ];
        return targets.some(t => upper.includes(t)) ||
               (upper.includes("ARABIC") && (upper.includes("SPEECH") || upper.includes("TABLE TALK") || upper.includes("LISTENING") || upper.includes("REPORT") || upper.includes("STORY") || upper.includes("INSPIRING") || upper.includes("SPIRITUAL")));
    };

    const isLStarEnglishEvent = (eventName) => {
        if (!eventName) return false;
        const upper = String(eventName).toUpperCase().trim();
        const targets = [
            "SPEECH ENGLISH", "TABLE TALK ENGLISH", "DISCUSSION ENGLISH",
            "MINI STORY ENGLISH", "MINISTORY ENGLISH", "REPORT WRITING ENGLISH",
            "REPORT ENGLISH", "STORY ENGLISH", "INSPIRING TALK ENGLISH"
        ];
        return targets.some(t => upper.includes(t)) ||
               (upper.includes("ENGLISH") && (upper.includes("SPEECH") || upper.includes("TABLE TALK") || upper.includes("DISCUSSION") || upper.includes("MINI STORY") || upper.includes("REPORT") || upper.includes("STORY") || upper.includes("INSPIRING")));
    };

    const getLStarArabicWinner = (scores) => {
        const candidates = [];
        scores.forEach(student => {
            if (student.category !== "Junior") return;
            const raw = student.rawResults || [];
            let arabicPts = 0;
            raw.forEach(r => {
                if (isLStarArabicEvent(r.eventName)) {
                    arabicPts += (Number(r.points) || 0);
                }
            });

            if (arabicPts > 0) {
                const catAEventsCount = raw.filter(r => isCategoryA(r)).length;
                const aPlusCount = raw.filter(r => (r.grade || "").trim() === "A+").length;
                candidates.push({
                    student: { ...student, totalInCategory: arabicPts },
                    total: arabicPts,
                    catAEventsCount,
                    aPlusCount
                });
            }
        });

        candidates.sort((a, b) => {
            if (b.total !== a.total) return b.total - a.total;
            if (b.catAEventsCount !== a.catAEventsCount) return b.catAEventsCount - a.catAEventsCount;
            return b.aPlusCount - a.aPlusCount;
        });

        return candidates.length > 0 ? candidates[0].student : null;
    };

    const getLStarEnglishWinner = (scores) => {
        const candidates = [];
        scores.forEach(student => {
            if (student.category !== "Junior") return;
            const raw = student.rawResults || [];
            let englishPts = 0;
            raw.forEach(r => {
                if (isLStarEnglishEvent(r.eventName)) {
                    englishPts += (Number(r.points) || 0);
                }
            });

            if (englishPts > 0) {
                const catAEventsCount = raw.filter(r => isCategoryA(r)).length;
                const aPlusCount = raw.filter(r => (r.grade || "").trim() === "A+").length;
                candidates.push({
                    student: { ...student, totalInCategory: englishPts },
                    total: englishPts,
                    catAEventsCount,
                    aPlusCount
                });
            }
        });

        candidates.sort((a, b) => {
            if (b.total !== a.total) return b.total - a.total;
            if (b.catAEventsCount !== a.catAEventsCount) return b.catAEventsCount - a.catAEventsCount;
            return b.aPlusCount - a.aPlusCount;
        });

        return candidates.length > 0 ? candidates[0].student : null;
    };

    const juniorScores = individualOnlyScores.filter(student => student.category === "Junior");
    const seniorScores = individualOnlyScores.filter(student => student.category === "Senior");

    const juniorChampions = calculateChampions(juniorScores);
    const seniorChampions = calculateChampions(seniorScores);
    const emergingStarWinner = getEmergingStarWinner(individualOnlyScores);
    const lStarArabicWinner = getLStarArabicWinner(individualOnlyScores);
    const lStarEnglishWinner = getLStarEnglishWinner(individualOnlyScores);

    // TROPHY TIER LOGIC
    const getTrophyTier = (points) => {
        if (points >= 71 && points <= 84) return '⭐⭐⭐⭐⭐';
        if (points >= 56 && points <= 70) return '⭐⭐⭐⭐';
        if (points >= 39 && points <= 55) return '⭐⭐⭐';
        if (points >= 22 && points <= 38) return '⭐⭐';
        if (points >= 5 && points <= 21) return '⭐';
        return '-';
    };

    // FILTER LOGIC
    const filteredScores = sortedScores.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.chestNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.team.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const renderChampionCard = (title, winner, badgeEmoji, gradientBg, keyPrefix) => (
        <div className="stat-card" style={{ background: gradientBg, color: '#000', border: 'none', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div style={{ width: '100%' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.8 }}>{badgeEmoji} {title}</span>
                    {winner ? (
                        <>
                            <h2 style={{ fontSize: '1.7rem', margin: '8px 0 4px 0', fontWeight: '900' }}>{winner.name}</h2>
                            <div style={{ fontSize: '0.95rem', fontWeight: '600' }}>Chest No: {winner.chestNo}</div>

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                                <div style={{ background: 'rgba(0,0,0,0.1)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem', fontWeight: '600' }}>
                                    {winner.team} • {winner.total} Pts
                                </div>
                                <div style={{ background: 'rgba(255,255,255,0.3)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span>🥇{winner.first}</span>
                                    <span>🥈{winner.second}</span>
                                    <span>🥉{winner.third}</span>
                                </div>
                            </div>

                            {/* Grades Summary */}
                            <div style={{ marginTop: '8px', fontSize: '0.8rem', opacity: 0.9, marginBottom: '10px' }}>
                                {(() => {
                                    const grades = {};
                                    winner.rawResults?.forEach(r => { if (r.grade) grades[r.grade] = (grades[r.grade] || 0) + 1; });
                                    return Object.entries(grades).map(([g, c]) => <span key={g} style={{ marginRight: '8px' }}>{g}: <strong>{c}</strong></span>);
                                })()}
                            </div>

                            <button
                                onClick={() => setExpandedChampion(expandedChampion === keyPrefix ? null : keyPrefix)}
                                style={{ background: 'rgba(0,0,0,0.2)', color: '#000', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                            >
                                {expandedChampion === keyPrefix ? 'Hide Details' : 'View Full Details'}
                            </button>

                            {expandedChampion === keyPrefix && (
                                <div className="admin-table-container" style={{ marginTop: '15px', background: 'var(--bg-main)', padding: '10px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                                    <table className="admin-table">
                                        <thead>
                                            <tr>
                                                <th style={{ textAlign: 'left', padding: '8px' }}>Event</th>
                                                <th style={{ padding: '8px' }}>Prize</th>
                                                <th style={{ padding: '8px' }}>Grd</th>
                                                <th style={{ padding: '8px' }}>Pts</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {winner.rawResults.map((r, i) => (
                                                <tr key={i}>
                                                    <td style={{ padding: '8px' }}>{r.eventName}</td>
                                                    <td style={{ padding: '8px', fontWeight: 'bold' }}>{r.place}</td>
                                                    <td style={{ padding: '8px' }}>{r.grade}</td>
                                                    <td style={{ padding: '8px' }}>{r.points}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    ) : (
                        <h3 style={{ marginTop: '15px', opacity: 0.6 }}>No Eligible Winner Yet</h3>
                    )}
                </div>
                <div style={{ fontSize: '2.5rem', opacity: 0.2 }}>{badgeEmoji}</div>
            </div>
        </div>
    );

    return (
        <div className="manage-individual">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
                <h3 className="section-title" style={{ margin: 0 }}>🎖️ Individual Points</h3>
                <div className="tab-container" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                    <button className="tab-btn" style={{ background: activeCategoryTab === "Overall" ? "var(--primary)" : "var(--surface)", color: "white", border: "1px solid var(--border-soft)", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", whiteSpace: "nowrap", fontWeight: 600 }} onClick={() => setActiveCategoryTab("Overall")}>🏆 Overall Table</button>
                    {dynamicCategories.map(cat => (
                        <button key={cat} className="tab-btn" style={{ background: activeCategoryTab === cat ? "var(--primary)" : "var(--surface)", color: "white", border: "1px solid var(--border-soft)", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", whiteSpace: "nowrap", fontWeight: 600 }} onClick={() => setActiveCategoryTab(cat)}>👤 {cat}</button>
                    ))}
                </div>
            </div>

            {/* CHAMPIONSHIP CARDS (JUNIOR & SENIOR PRATHIBHA AWARDS) */}
            {!loading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', marginBottom: '30px' }}>
                    {/* JUNIOR SECTION */}
                    {(activeCategoryTab === "Overall" || activeCategoryTab === "Junior") && (
                        <div>
                            <h4 style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', color: '#ffd700' }}>
                                👦 Junior Category Champions
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                                {renderChampionCard("Junior Kalaprathibha", juniorChampions.kalaWinner, "👑", "linear-gradient(135deg, #ffd700 0%, #ffb900 100%)", "jun_kala")}
                                {renderChampionCard("Junior Sargaprathibha", juniorChampions.sargaWinner, "🌟", "linear-gradient(135deg, #e0e0e0 0%, #ffffff 100%)", "jun_sarga")}
                            </div>
                        </div>
                    )}

                    {/* JUNIOR LANGUAGE CHAMPIONS SECTION */}
                    {(activeCategoryTab === "Overall" || activeCategoryTab === "Junior") && (
                        <div>
                            <h4 style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', color: '#38ef7d' }}>
                                🌐 Junior Language Champions (L-Star Awards)
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                                {renderChampionCard("L-Star Arabic Award (Junior)", lStarArabicWinner, "🌙", "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)", "lstar_arabic")}
                                {renderChampionCard("L-Star English Award (Junior)", lStarEnglishWinner, "🇬🇧", "linear-gradient(135deg, #6a11cb 0%, #2575fc 100%)", "lstar_english")}
                            </div>
                        </div>
                    )}

                    {/* SENIOR SECTION */}
                    {(activeCategoryTab === "Overall" || activeCategoryTab === "Senior") && (
                        <div>
                            <h4 style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', color: '#fda085' }}>
                                🧑 Senior Category Champions
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                                {renderChampionCard("Senior Kalaprathibha", seniorChampions.kalaWinner, "👑", "linear-gradient(135deg, #f6d365 0%, #fda085 100%)", "sen_kala")}
                                {renderChampionCard("Senior Sargaprathibha", seniorChampions.sargaWinner, "🌟", "linear-gradient(135deg, #e2ebf0 0%, #cfd9df 100%)", "sen_sarga")}
                            </div>
                        </div>
                    )}

                    {/* EMERGING STAR SECTION */}
                    {activeCategoryTab === "Overall" && (
                        <div>
                            <h4 style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', color: '#00f2fe' }}>
                                ⭐ Special Award Champion
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                                {renderChampionCard("Emerging Star (Thamheediyya Ula)", emergingStarWinner, "⭐", "linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)", "emerging_star")}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* DUPLICATE STUDENTS DETECTION */}
            {!loading && (() => {
                // Find students with same name but different chest numbers
                const nameMap = new Map();
                individualOnlyScores.forEach(student => {
                    const name = student.name.trim();
                    if (!name || name === "Unknown") return;

                    if (!nameMap.has(name)) {
                        nameMap.set(name, []);
                    }
                    nameMap.get(name).push(student);
                });

                // Filter only duplicates (same name, different chest numbers)
                const duplicates = Array.from(nameMap.entries())
                    .filter(([, entries]) => {
                        if (entries.length <= 1) return false;
                        // Check if they have different chest numbers
                        const chestNumbers = new Set(entries.map(e => e.chestNo).filter(c => c !== "-"));
                        return chestNumbers.size > 1; // Multiple different chest numbers
                    })
                    .map(([name, entries]) => ({ name, entries }));

                if (duplicates.length === 0) return null;

                return (
                    <>
                        <h3 className="section-title" style={{ color: '#ff9800', marginTop: '30px' }}>
                            ⚠️ Duplicate Students in Scoring ({duplicates.length} names, {duplicates.reduce((sum, d) => sum + d.entries.length, 0)} total entries)
                        </h3>
                        <div className="card" style={{ marginBottom: '30px', padding: '20px', background: '#1a1a1a', border: '1px solid #ff9800' }}>
                            <p style={{ color: '#ff9800', marginBottom: '15px', fontSize: '0.9rem' }}>
                                ⚠️ The following students appear multiple times with different chest numbers in the results. This may indicate duplicate entries or data errors.
                            </p>
                            <div className="admin-table-container" style={{ maxHeight: '400px' }}>
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Student Name</th>
                                            <th>Chest No</th>
                                            <th>Team</th>
                                            <th>🥇 1st</th>
                                            <th>🥈 2nd</th>
                                            <th>🥉 3rd</th>
                                            <th>Total Points</th>
                                            <th>Events Won</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {duplicates.map(({ name, entries }) => (
                                            <React.Fragment key={name}>
                                                {entries.map((entry, idx) => (
                                                    <tr key={entry.key} style={{
                                                        background: idx === 0 ? 'var(--bg-tertiary)' : 'transparent',
                                                        borderTop: idx === 0 ? '2px solid var(--primary)' : '1px solid var(--border-soft)'
                                                    }}>
                                                        <td style={{ fontWeight: idx === 0 ? 'bold' : 'normal', color: idx === 0 ? 'var(--primary)' : 'var(--text-main)' }}>
                                                            {idx === 0 && '🔴 '}{name}
                                                        </td>
                                                        <td style={{ fontFamily: 'monospace', fontSize: '1.1rem' }}>{entry.chestNo}</td>
                                                        <td>{entry.team || "N/A"}</td>
                                                        <td>{entry.first}</td>
                                                        <td>{entry.second}</td>
                                                        <td>{entry.third}</td>
                                                        <td style={{ color: 'var(--primary)', fontWeight: '900' }}>{entry.total}</td>
                                                        <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{entry.items.length} events</td>
                                                    </tr>
                                                ))}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div style={{ marginTop: '15px', padding: '10px', background: '#2a1a1a', borderRadius: '6px', fontSize: '0.85rem', color: '#ffd700' }}>
                                💡 <strong>Action Required:</strong> Review these entries in the Results management section. Verify the correct chest number for each student and remove duplicate entries.
                            </div>
                        </div>
                    </>
                );
            })()}

            {/* TROPHY TIER STATISTICS */}
            {!loading && filteredScores.length > 0 && (() => {
                const tierCounts = {
                    '5star': filteredScores.filter(s => s.total >= 71 && s.total <= 84).length,
                    '4star': filteredScores.filter(s => s.total >= 56 && s.total <= 70).length,
                    '3star': filteredScores.filter(s => s.total >= 39 && s.total <= 55).length,
                    '2star': filteredScores.filter(s => s.total >= 22 && s.total <= 38).length,
                    '1star': filteredScores.filter(s => s.total >= 5 && s.total <= 21).length,
                    'none': filteredScores.filter(s => s.total < 5).length
                };

                const tierStudents = {
                    '5star': filteredScores.filter(s => s.total >= 71 && s.total <= 84),
                    '4star': filteredScores.filter(s => s.total >= 56 && s.total <= 70),
                    '3star': filteredScores.filter(s => s.total >= 39 && s.total <= 55),
                    '2star': filteredScores.filter(s => s.total >= 22 && s.total <= 38),
                    '1star': filteredScores.filter(s => s.total >= 5 && s.total <= 21),
                    'none': filteredScores.filter(s => s.total < 5)
                };

                const handleDownloadTier = (tierName, students, stars) => {
                    if (students.length === 0) return;

                    const csvData = students.map((student, index) => ({
                        Rank: index + 1,
                        'Chest No': student.chestNo,
                        Name: student.name,
                        Team: student.team || 'N/A',
                        '1st Place': student.first,
                        '2nd Place': student.second,
                        '3rd Place': student.third,
                        'Total Points': student.total,
                        'Trophy Tier': stars
                    }));

                    const headers = Object.keys(csvData[0] || {});
                    const csvContent = [
                        headers.join(','),
                        ...csvData.map(row =>
                            headers.map(header => {
                                const value = row[header];
                                if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                                    return `"${value.replace(/"/g, '""')}"`;
                                }
                                return value;
                            }).join(',')
                        )
                    ].join('\n');

                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                    const link = document.createElement('a');
                    const url = URL.createObjectURL(blob);
                    link.setAttribute('href', url);
                    link.setAttribute('download', `trophy_tier_${tierName}_${new Date().toISOString().split('T')[0]}.csv`);
                    link.style.visibility = 'hidden';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                };

                const TierCard = ({ tier, stars, count, pointRange, color, students }) => (
                    <div
                        style={{
                            textAlign: 'center',
                            padding: '15px',
                            background: '#2a1a1a',
                            borderRadius: '8px',
                            border: expandedTier === tier ? `2px solid ${color}` : '1px solid #444',
                            transition: 'all 0.2s ease',
                            position: 'relative'
                        }}
                    >
                        <div
                            style={{ cursor: 'pointer' }}
                            onClick={() => setExpandedTier(expandedTier === tier ? null : tier)}
                        >
                            <div style={{ fontSize: '1.5rem', marginBottom: '5px' }}>{stars}</div>
                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: color }}>{count}</div>
                            <div style={{ fontSize: '0.8rem', color: '#888' }}>{pointRange}</div>
                        </div>
                        {students.length > 0 && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownloadTier(tier, students, stars);
                                }}
                                style={{
                                    marginTop: '10px',
                                    padding: '6px 12px',
                                    background: color,
                                    color: tier === 'none' ? 'var(--text-main)' : '#000',
                                    border: 'none',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold',
                                    width: '100%',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                📥 Download
                            </button>
                        )}
                        {expandedTier === tier && students.length > 0 && (
                            <div style={{
                                marginTop: '15px',
                                paddingTop: '15px',
                                borderTop: '1px solid #444',
                                maxHeight: '300px',
                                overflowY: 'auto',
                                textAlign: 'left'
                            }}>
                                <div style={{ fontSize: '0.75rem', color: '#aaa', marginBottom: '8px', fontWeight: 'bold' }}>
                                    Students in this tier:
                                </div>
                                {students.map((student) => (
                                    <div
                                        key={student.key}
                                        style={{
                                            padding: '6px 8px',
                                            marginBottom: '4px',
                                            background: 'rgba(255,255,255,0.05)',
                                            borderRadius: '4px',
                                            fontSize: '0.8rem',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <div>
                                            <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>{student.name}</span>
                                            <span style={{ color: '#888', marginLeft: '8px' }}>({student.chestNo})</span>
                                        </div>
                                        <span style={{ color: color, fontWeight: 'bold' }}>{student.total} pts</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {expandedTier === tier && (
                            <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '10px' }}>
                                {students.length > 0 ? 'Click to collapse' : 'No students in this tier'}
                            </div>
                        )}
                    </div>
                );

                return (
                    <div className="card" style={{ marginBottom: '30px', padding: '20px', background: '#1a1a1a' }}>
                        <h4 style={{ margin: '0 0 15px 0', color: '#ffd700', fontSize: '1.1rem' }}>🏆 Trophy Tier Distribution</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
                            <TierCard
                                tier="5star"
                                stars="⭐⭐⭐⭐⭐"
                                count={tierCounts['5star']}
                                pointRange="71-84 pts"
                                color="#ffd700"
                                students={tierStudents['5star']}
                            />
                            <TierCard
                                tier="4star"
                                stars="⭐⭐⭐⭐"
                                count={tierCounts['4star']}
                                pointRange="56-70 pts"
                                color="#22c55e"
                                students={tierStudents['4star']}
                            />
                            <TierCard
                                tier="3star"
                                stars="⭐⭐⭐"
                                count={tierCounts['3star']}
                                pointRange="39-55 pts"
                                color="#3b82f6"
                                students={tierStudents['3star']}
                            />
                            <TierCard
                                tier="2star"
                                stars="⭐⭐"
                                count={tierCounts['2star']}
                                pointRange="22-38 pts"
                                color="#a855f7"
                                students={tierStudents['2star']}
                            />
                            <TierCard
                                tier="1star"
                                stars="⭐"
                                count={tierCounts['1star']}
                                pointRange="5-21 pts"
                                color="#f97316"
                                students={tierStudents['1star']}
                            />
                            {tierCounts['none'] > 0 && (
                                <TierCard
                                    tier="none"
                                    stars="-"
                                    count={tierCounts['none']}
                                    pointRange="< 5 pts"
                                    color="#666"
                                    students={tierStudents['none']}
                                />
                            )}
                        </div>
                        <div style={{ marginTop: '15px', padding: '10px', background: '#2a1a1a', borderRadius: '6px', textAlign: 'center' }}>
                            <span style={{ fontSize: '0.9rem', color: '#888' }}>Total Students: </span>
                            <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{filteredScores.length}</span>
                            <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '5px' }}>💡 Click on any tier to see student names</div>
                        </div>
                    </div>
                );
            })()}


            <h3 className="section-title">👤 Individual Standings</h3>

            <div className="table-controls" style={{ marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center' }}>
                <input
                    type="text"
                    className="admin-input"
                    placeholder="🔍 Search by Name, Chest No, or Team..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ flex: '1 1 200px', minWidth: '200px' }}
                />
                <button
                    onClick={() => {
                        // Prepare CSV data
                        const csvData = filteredScores.map((student, index) => ({
                            Rank: sortConfig.key === 'total' ? index + 1 : '-',
                            'Chest No': student.chestNo,
                            Name: student.name,
                            Team: student.team || 'N/A',
                            '1st Place': student.first,
                            '2nd Place': student.second,
                            '3rd Place': student.third,
                            'Total Points': student.total,
                            'Trophy Tier': getTrophyTier(student.total),
                            'Events Won': student.items.length
                        }));

                        // Convert to CSV string
                        const headers = Object.keys(csvData[0] || {});
                        const csvContent = [
                            headers.join(','),
                            ...csvData.map(row =>
                                headers.map(header => {
                                    const value = row[header];
                                    // Escape commas and quotes
                                    if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                                        return `"${value.replace(/"/g, '""')}"`;
                                    }
                                    return value;
                                }).join(',')
                            )
                        ].join('\n');

                        // Download
                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                        const link = document.createElement('a');
                        const url = URL.createObjectURL(blob);
                        link.setAttribute('href', url);
                        link.setAttribute('download', `individual_points_${new Date().toISOString().split('T')[0]}.csv`);
                        link.style.visibility = 'hidden';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }}
                    className="admin-btn"
                    style={{
                        background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                        padding: '10px 20px',
                        whiteSpace: 'nowrap'
                    }}
                >
                    📥 Download CSV
                </button>
            </div>

            {loading ? <div className="spinner"></div> : (
                <div className="admin-table-container">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th onClick={() => handleSort('total')} style={{ cursor: 'pointer' }}>
                                    Rank {sortConfig.key === 'total' && (sortConfig.direction === 'desc' ? '▼' : '▲')}
                                </th>
                                <th onClick={() => handleSort('chestNo')} style={{ cursor: 'pointer' }}>
                                    Chest No {sortConfig.key === 'chestNo' && (sortConfig.direction === 'desc' ? '▼' : '▲')}
                                </th>
                                <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>
                                    Name {sortConfig.key === 'name' && (sortConfig.direction === 'desc' ? '▼' : '▲')}
                                </th>
                                <th onClick={() => handleSort('team')} style={{ cursor: 'pointer' }}>
                                    Team {sortConfig.key === 'team' && (sortConfig.direction === 'desc' ? '▼' : '▲')}
                                </th>
                                <th>🥇 1st</th>
                                <th>🥈 2nd</th>
                                <th>🥉 3rd</th>
                                <th onClick={() => handleSort('total')} style={{ cursor: 'pointer' }}>
                                    Total Points {sortConfig.key === 'total' && (sortConfig.direction === 'desc' ? '▼' : '▲')}
                                </th>
                                <th>🏆 Trophy</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredScores.length > 0 ? filteredScores.map((student, index) => {
                                // Calculate Rank based on current sort order (if sorting by total points)
                                let rankDisplay = index + 1;
                                if (sortConfig.key !== 'total') rankDisplay = '-';

                                return (
                                    <>
                                        <tr
                                            key={student.key}
                                            onClick={() => handleRowClick(student.key)}
                                            style={{
                                                background: rankDisplay === 1 ? 'rgba(255, 215, 0, 0.05)' : 'transparent',
                                                cursor: 'pointer',
                                                borderBottom: expandedRow === student.key ? 'none' : '1px solid #333'
                                            }}
                                            className="hover-row"
                                        >
                                            <td style={{ fontWeight: 'bold', color: rankDisplay <= 3 && rankDisplay > 0 ? '#ffd700' : '#888' }}>
                                                {rankDisplay > 0 ? `#${rankDisplay}` : '-'}
                                            </td>
                                            <td style={{ fontFamily: 'monospace', fontSize: '1.1rem' }}>{student.chestNo}</td>
                                            <td>
                                                <div style={{ fontWeight: '600' }}>{student.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#666' }}>
                                                    {expandedRow === student.key ? '▼ Hide Details' : `▶ Show ${student.items.length} Events`}
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`tag ${student.team?.toLowerCase()}-tag`} style={{
                                                    padding: '2px 8px',
                                                    borderRadius: '4px',
                                                    backgroundColor: 'var(--bg-secondary)',
                                                    color: '#ccc',
                                                    fontSize: '0.8rem'
                                                }}>
                                                    {student.team || "N/A"}
                                                </span>
                                            </td>
                                            <td>{student.first}</td>
                                            <td>{student.second}</td>
                                            <td>{student.third}</td>
                                            <td style={{ color: '#22c55e', fontWeight: '900', fontSize: '1.2rem' }}>
                                                {student.total}
                                            </td>
                                            <td style={{ fontSize: '1.2rem' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                                    <div>{getTrophyTier(student.total)}</div>
                                                    <div style={{ fontSize: '0.75rem', color: '#888', fontWeight: '500' }}>
                                                        {student.name}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                        {expandedRow === student.key && (
                                            <tr key={`${student.key}-detail`} style={{ background: 'rgba(255,255,255,0.02)' }}>
                                                <td colSpan="9" style={{ padding: '0 0 20px 0' }}>
                                                    <div className="admin-table-container" style={{ padding: '15px', marginLeft: '50px', borderLeft: '2px solid var(--border-soft)' }}>
                                                        <h4 style={{ marginTop: 0, marginBottom: '10px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Detailed Results for {student.name}</h4>
                                                        <table className="admin-table">
                                                            <thead>
                                                                <tr>
                                                                    <th>Event</th>
                                                                    <th>Category</th>
                                                                    <th>Prize</th>
                                                                    <th>Grade</th>
                                                                    <th>Points</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {student.rawResults && student.rawResults.map((res, idx) => (
                                                                    <tr key={idx}>
                                                                        <td>{res.eventName}</td>
                                                                        <td>{res.category || "-"}</td>
                                                                        <td style={{ color: res.place === 'First' ? '#ffd700' : res.place === 'Second' ? '#c0c0c0' : res.place === 'Third' ? '#cd7f32' : 'var(--text-main)' }}>
                                                                            {res.place}
                                                                        </td>
                                                                        <td style={{ fontWeight: 'bold', color: res.grade?.startsWith('A') ? 'var(--primary)' : 'var(--text-main)' }}>
                                                                            {res.grade}
                                                                        </td>
                                                                        <td>{res.points}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                );
                            }) : (
                                <tr>
                                    <td colSpan="8" style={{ textAlign: 'center', padding: '30px' }}>
                                        No students found matching "{searchQuery}"
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
