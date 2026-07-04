import Papa from "papaparse";

self.addEventListener("message", (event) => {
    const csvText = event.data;
    
    Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
            self.postMessage({ data: results.data });
        },
        error: (error) => {
            self.postMessage({ error: error.message });
        }
    });
});
