import fs from 'fs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

async function createPdf() {
    const pdfDoc = await PDFDocument.create();
    const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const fontSize = 30;
    page.drawText('Resume: Ivan Ivanov. Experience: Frontend 5 years. Skills: React, Node.js.', {
        x: 50,
        y: height - 4 * fontSize,
        size: 20,
        font: timesRomanFont,
        color: rgb(0, 0.53, 0.71),
    });
    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync('test_resume.pdf', pdfBytes);
}

createPdf().catch(err => console.error(err));
