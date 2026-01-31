const fs = require('fs');
const path = require('path');

// MOCK EVENTS (Copy from events.js to avoid ESM issues if not configured)
const EVENT_MAP = {
    // ON STAGE
    "QIRAATH": "On Stage", "DEBATE MALAYALAM": "On Stage", "SPEECH MALAYALAM": "On Stage", "SPEECH ENGLISH": "On Stage",
    "SPEECH ARABIC": "On Stage", "SPEECH URDU": "On Stage", "THINK TALK": "On Stage", "SATIRICAL TALK MALAYALAM": "On Stage",
    "ENCOUNTER": "On Stage", "ROLE PLAY": "On Stage", "SPOT TRANSLATION (A-M)": "On Stage", "SPOT TRANSLATION (E-M)": "On Stage",
    "SPELLING BEE": "On Stage", "QUIZ": "On Stage", "SONG MALAYALAM": "On Stage", "SONG ARABIC": "On Stage", "TABLE TALK URDU": "On Stage",
    "INSPIRING TALK ARABIC": "On Stage", "INSPIRING TALK ENGLISH": "On Stage", "MASHUP": "On Stage", "SHOW YOUR POTENTIAL": "On Stage",
    "MIME": "On Stage",
    // OFF STAGE
    "BOOK REVIEW MALAYALAM": "Off Stage", "EPIC STUDY": "Off Stage", "ESSAY ARABIC": "Off Stage", "ESSAY ENGLISH": "Off Stage",
    "ESSAY MALAYALAM": "Off Stage", "ESSAY URDU": "Off Stage", "MINI STORY MALAYALAM": "Off Stage", "POEM ARABIC": "Off Stage",
    "POEM ENGLISH": "Off Stage", "POEM MALAYALAM": "Off Stage", "REPORT ARABIC": "Off Stage", "REPORT ENGLISH": "Off Stage",
    "REPORT MALAYALAM": "Off Stage", "SUMMARIZATION (MAL)": "Off Stage", "SHORT VLOGGING ENGLISH": "Off Stage", "SONG WRITING": "Off Stage",
    "STORY ARABIC": "Off Stage", "STORY ENGLISH": "Off Stage", "STORY MALAYALAM": "Off Stage", "STORY URDU": "Off Stage",
    "TRANSLATION (A-M)": "Off Stage", "TRANSLATION (E-M)": "Off Stage", "CARTOON": "Off Stage", "DEFEND & OFFEND": "Off Stage",
    "PHOTO FEATURE": "Off Stage", "Q AND H PAINTING": "Off Stage", "BROCHURE MAKING": "Off Stage", "PROJECT SUBMISSION": "Off Stage",
    "REEL MAKING": "Off Stage", "AI VIDEO CREATION": "Off Stage", "TRENT SETTING": "Off Stage", "PAINTING": "Off Stage"
};

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

// Simple CSV Parser (Handle quotes coarsely)
// We assume events are comma separated inside quotes or just plain strings?
// Actually, user data shows "ESSAY MALAYALAM, STORY MALAYALAM..." inside quotes.
function parseAndCheck() {
    const csvContent = fs.readFileSync(path.join(__dirname, 'temp_data.csv'), 'utf8');
    const lines = csvContent.split('\n');

    // Headers: look for indices
    const header = lines[0].split(',').map(h => h.trim());

    console.log("Headers detected:", header);

    // Indices (naive find)
    const onStageIdx = header.findIndex(h => h.includes("ON STAGE"));
    const offStageIdx = header.findIndex(h => h.includes("OFF STAGE"));
    const generalIdx = header.findIndex(h => h.includes("GENERAL"));

    console.log(`Indices: On=${onStageIdx}, Off=${offStageIdx}, Gen=${generalIdx}`);

    const allFoundEvents = new Set();

    // Helper to extract events from a "cell" which might be quoted
    // This is a hacked CSV parser for valid verification
    const regex = /"([^"]+)"/g;

    lines.forEach((line, i) => {
        if (i === 0) return;
        const normalizedLine = normalizeEventString(line);
        // Find all uppercase strings that look like events?
        // Or simply iterate known keys and see if they exist?
        // No, we want to find UNKNOWN ones.

        // Extract content inside quotes (usually where lists are)
        let match;
        while ((match = regex.exec(normalizedLine)) !== null) {
            const list = match[1];
            list.split(',').forEach(e => {
                const trimE = e.trim();
                if (trimE.length > 3) allFoundEvents.add(trimE); // Ignore small noise
            });
        }
    });

    console.log("\n--- Audit Results ---");
    let unknownCount = 0;
    allFoundEvents.forEach(evt => {
        // Check if map has it (allowing some slop)
        if (EVENT_MAP[evt]) return;

        // Try precise match
        if (Object.keys(EVENT_MAP).includes(evt)) return;

        console.log(`[UNKNOWN] '${evt}'`);
        unknownCount++;
    });

    if (unknownCount === 0) {
        console.log("SUCCESS: All extracted events match known constants.");
    } else {
        console.log(`WARNING: Found ${unknownCount} potential unknown events.`);
    }
}

parseAndCheck();
