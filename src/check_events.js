import { CSV_URL } from "./config.js";
import { getEventType } from "./constants/events.js";
import Papa from "papaparse";
import fetch from "node-fetch";

// Mock helper from Participants.jsx
const normalizeEventString = (str) => {
    if (!str) return "";
    let s = str.toUpperCase();
    s = s.split(',').map(item => item.trim()).filter(Boolean).join(', ');
    s = s.replace(/SHORT VLOGING/g, "SHORT VLOGGING");
    s = s.replace(/SAMMARIZATION/g, "SUMMARIZATION");
    s = s.replace(/MINISTORY/g, "MINI STORY");
    s = s.replace(/PHOTOFEACHURE/g, "PHOTO FEATURE");
    s = s.replace(/Q&H/g, "Q AND H");
    s = s.replace(/SONG WRITER/g, "SONG WRITING");
    return s;
};

async function check() {
    console.log("Fetching CSV...");
    const res = await fetch(CSV_URL);
    const csv = await res.text();

    Papa.parse(csv, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
            const allEvents = new Set();

            results.data.forEach(row => {
                // Check all potential columns
                const onStage = row["ON STAGE EVENTS"] || row["ON STAGE ITEMS"] || "";
                const offStage = row["OFF STAGE EVENTS"] || row["OFF STAGE ITEMS"] || row["OFF STAGE ITEMES"] || "";
                const general = row["GENERAL EVENTS"] || row["GENERAL ITEMS"] || row["GENERAL"] || "";

                const combined = [onStage, offStage, general].map(normalizeEventString).join(", ");

                combined.split(",").map(s => s.trim()).filter(Boolean).forEach(e => allEvents.add(e));
            });

            console.log("\n--- UNKNOWN EVENTS ---");
            let unknownCount = 0;
            allEvents.forEach(evt => {
                const type = getEventType(evt);
                if (type === "Unknown") {
                    console.log(`[UNKNOWN] '${evt}'`);
                    unknownCount++;
                }
            });

            if (unknownCount === 0) {
                console.log("All events are recognized!");
            }
        }
    });
}

check();
