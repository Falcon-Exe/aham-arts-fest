import Papa from "papaparse";
import fetch from "node-fetch";

const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQiHgMpkz6uOV0DF6rjB3Mt2nXEGK7IkkO4qTHMUyy6auEG9yhQ74UYxndu907N0Khtb6lLoKQyQJEu/pub?gid=985462019&single=true&output=csv";

const getValue = (row, ...keys) => {
    const rowKeys = Object.keys(row);
    for (const k of keys) {
        if (row[k]) return row[k];
        const lowerK = k.toLowerCase();
        const match = rowKeys.find(rk => rk.toLowerCase() === lowerK);
        if (match && row[match]) return row[match];
        const normK = lowerK.replace(/\s+/g, '');
        const normMatch = rowKeys.find(rk => rk.toLowerCase().replace(/\s+/g, '') === normK);
        if (normMatch && row[normMatch]) return row[normMatch];
    }
    return "";
};

async function checkCSV() {
    console.log("Fetching CSV...");
    const res = await fetch(CSV_URL);
    const csvText = await res.text();

    const results = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
    });

    const data = results.data;
    console.log(`Total Rows Parsed: ${data.length}`);

    let missingName = 0;
    let missingChest = 0;
    let chestDuplicates = {};
    let sampleParsed = [];

    data.forEach((row, index) => {
        const name = getValue(row, "CANDIDATE NAME", "NAME", "FULL NAME");
        const chest = getValue(row, "CHEST NUMBER", "CHEST NO", "CHEST #");
        const cic = getValue(row, "CIC NO", "CIC NUMBER");
        const team = getValue(row, "TEAM", "HOUSE");

        if (!name) missingName++;
        if (!chest) missingChest++;

        if (chest) {
            if (chestDuplicates[chest]) chestDuplicates[chest]++;
            else chestDuplicates[chest] = 1;
        }

        if (index < 5) {
            sampleParsed.push({ index, name, chest, team, cic });
        }
    });

    console.log("\n--- Analysis ---");
    console.log(`Rows with missing Name: ${missingName}`);
    console.log(`Rows with missing Chest No: ${missingChest}`);

    const dups = Object.entries(chestDuplicates).filter(([k, v]) => v > 1);
    console.log(`Duplicate Chest Numbers: ${dups.length}`);
    if (dups.length > 0) {
        console.log("Sample Duplicates:", dups.slice(0, 5));
    }

    console.log("\n--- Sample Parsed Data (First 5) ---");
    console.table(sampleParsed);
}

checkCSV();
