import PptxGenJS from "pptxgenjs";
import { jsPDF } from "jspdf";
import { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, AlignmentType } from "docx";
import { saveAs } from "file-saver";

interface Section {
  title: string;
  description: string;
  imagePrompt: string;
  imageBase64?: string;
}

// Helper: base64 to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function exportToPDF(sections: Section[]) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  sections.forEach((section, index) => {
    if (index > 0) doc.addPage();

    // Background
    doc.setFillColor(15, 23, 42); // Navy
    doc.rect(0, 0, pageWidth, pageHeight, "F");

    // Add image if available
    if (section.imageBase64) {
      try {
        doc.addImage(
          `data:image/png;base64,${section.imageBase64}`,
          "PNG",
          10, 10, pageWidth - 20, (pageHeight - 20) * 0.55
        );
      } catch (e) {
        console.error("Error adding image to PDF:", e);
      }
    }

    // Title
    doc.setTextColor(0, 188, 212); // Cyan
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    const titleY = section.imageBase64 ? (pageHeight * 0.6) + 10 : 30;
    doc.text(section.title, pageWidth / 2, titleY, { align: "center" });

    // Description
    doc.setTextColor(200, 200, 200);
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    const splitText = doc.splitTextToSize(section.description, pageWidth - 40);
    doc.text(splitText, 20, titleY + 12);

    // Page number
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(9);
    doc.text(`${index + 1} / ${sections.length}`, pageWidth - 15, pageHeight - 8, { align: "right" });
  });

  doc.save(`myanmar-ai-doc-${Date.now()}.pdf`);
}

export async function exportToPPTX(sections: Section[]) {
  const pptx = new PptxGenJS();
  pptx.author = "Myanmar AI Studio";
  pptx.title = "AI Generated Presentation";

  sections.forEach((section) => {
    const slide = pptx.addSlide();
    slide.background = { color: "0F172A" };

    // Add image
    if (section.imageBase64) {
      slide.addImage({
        data: `data:image/png;base64,${section.imageBase64}`,
        x: 0.3,
        y: 0.3,
        w: 9.4,
        h: 3.5,
        rounding: true,
      });
    }

    // Title
    slide.addText(section.title, {
      x: 0.5,
      y: section.imageBase64 ? 4.0 : 0.8,
      w: 9,
      h: 0.8,
      fontSize: 28,
      bold: true,
      color: "00BCD4",
      fontFace: "Arial",
    });

    // Description
    slide.addText(section.description, {
      x: 0.5,
      y: section.imageBase64 ? 4.8 : 2.0,
      w: 9,
      h: 1.5,
      fontSize: 14,
      color: "CCCCCC",
      fontFace: "Arial",
      wrap: true,
    });
  });

  await pptx.writeFile({ fileName: `myanmar-ai-slides-${Date.now()}.pptx` });
}

export async function exportToDOCX(sections: Section[]) {
  const children: any[] = [];

  // Title page
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "Myanmar AI Studio",
          bold: true,
          size: 56,
          color: "00BCD4",
          font: "Arial",
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "AI Generated Document",
          size: 28,
          color: "999999",
          font: "Arial",
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 800 },
    })
  );

  for (const section of sections) {
    // Section title
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: section.title,
            bold: true,
            size: 36,
            color: "00BCD4",
            font: "Arial",
          }),
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );

    // Image
    if (section.imageBase64) {
      try {
        const imageData = base64ToUint8Array(section.imageBase64);
        children.push(
          new Paragraph({
            children: [
              new ImageRun({
                data: imageData,
                transformation: { width: 600, height: 338 },
                type: "png",
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          })
        );
      } catch (e) {
        console.error("Error adding image to DOCX:", e);
      }
    }

    // Description
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: section.description,
            size: 24,
            color: "444444",
            font: "Arial",
          }),
        ],
        spacing: { after: 300 },
      })
    );
  }

  const doc = new Document({
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `myanmar-ai-document-${Date.now()}.docx`);
}
