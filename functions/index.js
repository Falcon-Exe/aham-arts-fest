const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// PURE SCORING FUNCTION (Mirrors src/utils/scoringRules.js)
function calculatePoints(category, place, grade) {
  const placeMap = { First: 1, Second: 2, Third: 3, "1": 1, "2": 2, "3": 3 };
  const numericPlace = placeMap[place] || parseInt(place, 10);

  let categoryPoints = 0;
  if (place !== "None" && numericPlace && numericPlace >= 1 && numericPlace <= 3) {
    const base = {
      A: { 1: 12, 2: 8, 3: 4 },
      B: { 1: 10, 2: 6, 3: 3 },
      C: { 1: 25, 2: 15, 3: 10 }
    };
    categoryPoints = base[category]?.[numericPlace] || 0;
  }

  let gradePoints = 0;
  if (grade === "A+") gradePoints = 7;
  else if (grade === "A") gradePoints = 5;
  else if (grade === "B") gradePoints = 3;
  else if (grade === "C") gradePoints = 1;

  return categoryPoints + gradePoints;
}


exports.onResultPublish = onDocumentCreated("results/{resultId}", async (event) => {
  const resultData = event.data.data();
  if (!resultData) return;

  const { team, category, place, grade, eventName } = resultData;
  const points = calculatePoints(category, place, grade);

  logger.info(`Processing result for team ${team} in ${eventName}. Awarding ${points} points.`);

  const batch = db.batch();

  // 1. UPDATE LEADERBOARD ENGINE
  if (team && points > 0) {
    const teamScoreRef = db.collection("teamScores").doc(team.toUpperCase());
    
    // We use a transaction or simply increment
    batch.set(teamScoreRef, {
      totalPoints: admin.firestore.FieldValue.increment(points),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  // 2. AUDIT LOGGING SYSTEM
  const auditRef = db.collection("auditLogs").doc();
  batch.set(auditRef, {
    action: "publish_result",
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    event: eventName || "Unknown",
    team: team || "Unknown",
    pointsAwarded: points,
    resultId: event.params.resultId
  });

  try {
    await batch.commit();
    logger.info(`Successfully updated leaderboard and created audit log for result ${event.params.resultId}.`);
  } catch (error) {
    logger.error("Error committing batch:", error);
  }
});
