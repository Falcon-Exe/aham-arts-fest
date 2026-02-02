import fetch from 'node-fetch';
import Papa from 'papaparse';
import fs from 'fs';

const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQiHgMpkz6uOV0DF6rjB3Mt2nXEGK7IkkO4qTHMUyy6auEG9yhQ74UYxndu907N0Khtb6lLoKQyQJEu/pub?gid=985462019&single=true&output=csv";

async function mergeDuplicates() {
    console.log("📥 Fetching CSV data...");

    // Fetch CSV
    const response = await fetch(CSV_URL);
    const csvText = await response.text();

    // Parse CSV
    const parsed = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true
    });

    const rows = parsed.data;
    console.log(`📊 Total rows fetched: ${rows.length}`);

    // Merge by chest number
    const mergedMap = new Map();
    let duplicateCount = 0;

    rows.forEach((row, index) => {
        const chestNo = (row['CHEST NUMBER'] || '').trim();

        // Skip rows without chest number
        if (!chestNo) {
            console.log(`⚠️  Row ${index + 2}: No chest number, skipping`);
            return;
        }

        if (mergedMap.has(chestNo)) {
            // Duplicate found - merge the data
            duplicateCount++;
            const existing = mergedMap.get(chestNo);

            console.log(`🔴 Duplicate found: Chest ${chestNo} - ${row['CANDIDATE NAME'] || 'Unknown'}`);

            // Merge events (combine and deduplicate)
            const mergeEvents = (field) => {
                const existing_events = (existing[field] || '').split(',').map(e => e.trim()).filter(Boolean);
                const new_events = (row[field] || '').split(',').map(e => e.trim()).filter(Boolean);
                const combined = [...new Set([...existing_events, ...new_events])];
                return combined.join(', ');
            };

            // Merge all event fields
            existing['OFF STAGE ITEMES'] = mergeEvents('OFF STAGE ITEMES');
            existing['ON STAGE ITEMS'] = mergeEvents('ON STAGE ITEMS');
            existing['GENERAL'] = mergeEvents('GENERAL');

            // Use longer/more complete name
            if (row['CANDIDATE NAME'] && row['CANDIDATE NAME'].length > (existing['CANDIDATE NAME'] || '').length) {
                existing['CANDIDATE NAME'] = row['CANDIDATE NAME'];
            }

            // Fill in missing category if available
            if (!existing['CATEGORY'] && row['CATEGORY']) {
                existing['CATEGORY'] = row['CATEGORY'];
            }

            console.log(`   ✅ Merged into existing entry`);

        } else {
            // First occurrence - add to map
            mergedMap.set(chestNo, { ...row });
        }
    });

    // Convert map back to array
    const mergedRows = Array.from(mergedMap.values());

    console.log("\n📊 SUMMARY:");
    console.log(`   Original rows: ${rows.length}`);
    console.log(`   Duplicates found: ${duplicateCount}`);
    console.log(`   Merged rows: ${mergedRows.length}`);
    console.log(`   Rows removed: ${rows.length - mergedRows.length}`);

    // Sort by chest number
    mergedRows.sort((a, b) => {
        const chestA = parseInt(a['CHEST NUMBER']) || 0;
        const chestB = parseInt(b['CHEST NUMBER']) || 0;
        return chestA - chestB;
    });

    // Add SL NO
    mergedRows.forEach((row, index) => {
        row['SL NO'] = index + 1;
    });

    // Generate CSV
    const csv = Papa.unparse(mergedRows, {
        columns: ['SL NO', 'CANDIDATE NAME', 'CIC NO', 'CHEST NUMBER', 'TEAM', 'CATEGORY', 'OFF STAGE ITEMES', 'ON STAGE ITEMS', 'GENERAL']
    });

    // Save to file
    const outputPath = './participants_cleaned.csv';
    fs.writeFileSync(outputPath, csv, 'utf8');

    console.log(`\n✅ Cleaned CSV saved to: ${outputPath}`);
    console.log("\n🔍 DUPLICATES MERGED:");

    // Show which duplicates were merged
    const chestNumbers = new Map();
    rows.forEach(row => {
        const chestNo = (row['CHEST NUMBER'] || '').trim();
        if (chestNo) {
            if (!chestNumbers.has(chestNo)) {
                chestNumbers.set(chestNo, []);
            }
            chestNumbers.get(chestNo).push(row['CANDIDATE NAME']);
        }
    });

    let mergedList = [];
    chestNumbers.forEach((names, chestNo) => {
        if (names.length > 1) {
            mergedList.push({ chestNo, names: [...new Set(names)] });
        }
    });

    mergedList.forEach(({ chestNo, names }) => {
        console.log(`   Chest ${chestNo}: ${names.join(' / ')}`);
    });

    console.log(`\n📋 Total unique students after merge: ${mergedRows.length}`);
}

// Run the script
mergeDuplicates().catch(err => {
    console.error("❌ Error:", err);
    process.exit(1);
});
