import Papa from "papaparse";
import fetch from "node-fetch";

const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQiHgMpkz6uOV0DF6rjB3Mt2nXEGK7IkkO4qTHMUyy6auEG9yhQ74UYxndu907N0Khtb6lLoKQyQJEu/pub?gid=985462019&single=true&output=csv";

async function checkSpecifics() {
    console.log("Fetching CSV...");
    const res = await fetch(CSV_URL);
    const csvText = await res.text();

    const results = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
    });

    const data = results.data;
    console.log(`Total Rows Parsed: ${data.length}`);

    const rafih = data.find(r => JSON.stringify(r).toLowerCase().includes("rafih"));
    const afnan = data.find(r => JSON.stringify(r).toLowerCase().includes("afnan"));
    const chest256 = data.find(r => Object.values(r).includes("256"));

    console.log("\n--- SEARCH RESULTS (Raw CSV) ---");

    console.log("\n1. Searching for 'Rafih':");
    console.log(rafih || "Not Found");

    console.log("\n2. Searching for 'Afnan':");
    console.log(afnan || "Not Found");

    console.log("\n3. Searching for Chest No '256':");
    console.log(chest256 || "Not Found");
}

checkSpecifics();
