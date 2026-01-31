import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

function parseAndCheck() {
    try {
        const csvContent = fs.readFileSync(path.join(__dirname, 'temp_data.csv'), 'utf8');
        const lines = csvContent.split('\n');

        // Headers detection
        if (lines.length === 0) { console.log("Empty file"); return; }

        console.log("Headers detect:", lines[0]);

        const allFoundEvents = new Set();
        const regex = /"([^"]+)"/g;

        lines.forEach((line, i) => {
            if (i === 0) return;
            const normalizedLine = normalizeEventString(line);

            // Extract quoted content
            let match;
            while ((match = regex.exec(normalizedLine)) !== null) {
                const list = match[1];
                list.split(',').forEach(e => {
                    const trimE = e.trim();
                    // Basic heuristic to avoid candidate names or random strings: 
                    // Lookup in known map keys (loosely) OR check length/structure
                    // Ideally we check if it LOOKS like an event.
                    // For now, assume anything >3 chars might be an event
                    if (trimE.length > 3) allFoundEvents.add(trimE);
                });
            }
        });

        console.log("\n--- UNKNOWN EVENTS AUDIT ---");
        let unknownCount = 0;
        const knownKeys = Object.keys(EVENT_MAP);

        allFoundEvents.forEach(evt => {
            if (knownKeys.includes(evt)) return;

            // Filter out common false positives if any (like headers or team names if caught)
            if (evt === "PYRA" || evt === "IGNIS" || evt === "ATASH") return;

            console.log(`[UNKNOWN] '${evt}'`);
            unknownCount++;
        });

        if (unknownCount === 0) {
            console.log("SUCCESS: All extracted events match known constants.");
        } else {
            console.log(`WARNING: Found ${unknownCount} potential unknown events.`);
        }
    } catch (e) {
        console.error("Script error:", e);
    }
}

parseAndCheck();
