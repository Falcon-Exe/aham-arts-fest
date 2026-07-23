import jsPDF from "jspdf";

export const generateCertificate = (data) => {
    const { studentName, chestNo, eventName, place, team, appName, date } = data;

    // Create new PDF (Landscape A4)
    const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4"
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // 1. Background / Border
    doc.setDrawColor(145, 56, 49); // Primary color #913831
    doc.setLineWidth(2);
    doc.rect(5, 5, pageWidth - 10, pageHeight - 10);
    doc.setLineWidth(0.5);
    doc.rect(7, 7, pageWidth - 14, pageHeight - 14);

    // 2. Header
    doc.setTextColor(145, 56, 49);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(40);
    doc.text(appName.toUpperCase(), pageWidth / 2, 40, { align: "center" });

    doc.setTextColor(60, 60, 60);
    doc.setFontSize(20);
    doc.text("CERTIFICATE OF MERIT", pageWidth / 2, 55, { align: "center" });

    // 3. Body Text
    doc.setFont("helvetica", "normal");
    doc.setFontSize(16);
    doc.text("This is to certify that", pageWidth / 2, 80, { align: "center" });

    doc.setFont("helvetica", "bolditalic");
    doc.setFontSize(28);
    doc.setTextColor(0, 0, 0);
    doc.text(studentName.toUpperCase(), pageWidth / 2, 95, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(16);
    doc.setTextColor(60, 60, 60);
    doc.text(`Chest No: ${chestNo} | Team: ${team}`, pageWidth / 2, 105, { align: "center" });

    doc.text("has secured", pageWidth / 2, 125, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.setTextColor(145, 56, 49);
    doc.text(`${place.toUpperCase()} PLACE`, pageWidth / 2, 140, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(16);
    doc.setTextColor(60, 60, 60);
    doc.text("in the event", pageWidth / 2, 155, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(0, 0, 0);
    doc.text(eventName.toUpperCase(), pageWidth / 2, 170, { align: "center" });

    // 4. Footer
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(`Date: ${date || new Date().toLocaleDateString()}`, 30, pageHeight - 25);

    doc.setFont("helvetica", "bold");
    doc.text("General Convener", pageWidth - 60, pageHeight - 25);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Arts Festival Committee", pageWidth - 60, pageHeight - 20);

    // Save the PDF
    doc.save(`Certificate_${studentName.replace(/\s+/g, '_')}_${eventName.replace(/\s+/g, '_')}.pdf`);
};
