import fetch from "node-fetch";
import Papa from "papaparse";
import { CSV_URL } from "./config.js";

async function checkPaintingCategories() {
    console.log("Fetching CSV...");
    try {
        const res = await fetch(CSV_URL);
        const csvText = await res.text();

        Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const allCategories = new Set();
                results.data.forEach(row => {
                    if (row["CATEGORY"]) allCategories.add(row["CATEGORY"]);
                });
                console.log("All Categories in CSV:", Array.from(allCategories).sort());
            }
        });
    } catch (err) {
        console.error("Error:", err);
    }
}

checkPaintingCategories();
