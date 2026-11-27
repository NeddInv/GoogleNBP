import { BASIC_ACCOUNT_PDF_DOCUMENT } from './pdfDocumentContent';

/**
 * Pure TypeScript PDF-1.4 Generator
 * Creates a valid PDF binary file with custom formatting, multi-page flow,
 * headers, footers, boxes, and bullet points without external dependencies.
 */
export class PurePdfDocumentBuilder {
  private objects: string[] = [];
  private pagesContent: string[][] = [];
  private currentPageLines: string[] = [];
  private currentY: number = 740; // Top margin start (792 - 52)
  private pageHeight: number = 792;
  private pageWidth: number = 612;
  private marginLeft: number = 45;
  private marginRight: number = 45;
  private marginBottom: number = 50;
  private usableWidth: number = 522; // 612 - 90
  private currentPageIndex: number = 0;

  constructor() {
    this.startNewPage();
  }

  private startNewPage() {
    if (this.currentPageLines.length > 0) {
      this.pagesContent.push([...this.currentPageLines]);
      this.currentPageLines = [];
    }
    this.currentPageIndex++;
    this.currentY = 730;

    // Page Header line
    this.addRawContent(`
      0.15 0.18 0.35 rg
      ${this.marginLeft} 752 ${this.usableWidth} 1.5 re f
      0.4 0.4 0.45 rg
      BT
      /F2 8 Tf
      ${this.marginLeft} 760 Td
      (${this.escapeText(BASIC_ACCOUNT_PDF_DOCUMENT.title)} - ${BASIC_ACCOUNT_PDF_DOCUMENT.version}) Tj
      ET
    `);
  }

  private checkPageOverflow(requiredHeight: number) {
    if (this.currentY - requiredHeight < this.marginBottom) {
      this.startNewPage();
    }
  }

  private addRawContent(content: string) {
    this.currentPageLines.push(content);
  }

  public addTitle(title: string, subtitle: string) {
    this.checkPageOverflow(110);

    // Decorative Header Banner Box
    this.addRawContent(`
      0.08 0.08 0.18 rg
      ${this.marginLeft} ${this.currentY - 60} ${this.usableWidth} 65 re f
      0.3 0.4 0.8 rg
      ${this.marginLeft} ${this.currentY - 60} 4 65 re f
    `);

    // Title Text
    this.addRawContent(`
      1 1 1 rg
      BT
      /F2 16 Tf
      ${this.marginLeft + 15} ${this.currentY - 24} Td
      (${this.escapeText(title)}) Tj
      ET
      0.8 0.85 0.95 rg
      BT
      /F1 9.5 Tf
      ${this.marginLeft + 15} ${this.currentY - 42} Td
      (${this.escapeText(subtitle)}) Tj
      ET
    `);

    this.currentY -= 80;

    // Metadata Bar
    const dateStr = `Date: ${BASIC_ACCOUNT_PDF_DOCUMENT.date}  |  Author: ${BASIC_ACCOUNT_PDF_DOCUMENT.author}  |  Scope: Basic Account Tier`;
    this.addRawContent(`
      0.94 0.95 0.98 rg
      ${this.marginLeft} ${this.currentY - 18} ${this.usableWidth} 20 re f
      0.2 0.25 0.4 rg
      BT
      /F2 8.5 Tf
      ${this.marginLeft + 10} ${this.currentY - 12} Td
      (${this.escapeText(dateStr)}) Tj
      ET
    `);

    this.currentY -= 32;
  }

  public addSectionHeader(title: string) {
    this.checkPageOverflow(35);

    this.addRawContent(`
      0.1 0.15 0.35 rg
      ${this.marginLeft} ${this.currentY - 18} ${this.usableWidth} 22 re f
      0.2 0.5 0.9 rg
      ${this.marginLeft} ${this.currentY - 18} 3 22 re f
      1 1 1 rg
      BT
      /F2 11 Tf
      ${this.marginLeft + 10} ${this.currentY - 12} Td
      (${this.escapeText(title)}) Tj
      ET
    `);

    this.currentY -= 30;
  }

  public addSubsectionHeader(title: string) {
    this.checkPageOverflow(25);

    this.addRawContent(`
      0.15 0.2 0.4 rg
      BT
      /F2 10 Tf
      ${this.marginLeft} ${this.currentY - 10} Td
      (${this.escapeText(title)}) Tj
      ET
      0.8 0.82 0.9 rg
      ${this.marginLeft} ${this.currentY - 14} ${this.usableWidth} 0.5 re f
    `);

    this.currentY -= 22;
  }

  public addParagraph(text: string, fontType: 'F1' | 'F2' = 'F1', size: number = 9.5, lineHeight: number = 13) {
    const wrappedLines = this.wrapText(text, this.usableWidth, size);
    
    for (const line of wrappedLines) {
      this.checkPageOverflow(lineHeight);

      this.addRawContent(`
        0.15 0.15 0.2 rg
        BT
        /${fontType} ${size} Tf
        ${this.marginLeft} ${this.currentY - 10} Td
        (${this.escapeText(line)}) Tj
        ET
      `);

      this.currentY -= lineHeight;
    }
    this.currentY -= 4; // Paragraph spacing
  }

  public addBulletPoint(text: string) {
    const wrappedLines = this.wrapText(text, this.usableWidth - 18, 9);
    
    for (let i = 0; i < wrappedLines.length; i++) {
      this.checkPageOverflow(12);

      const isFirst = i === 0;
      const bulletSymbol = isFirst ? "• " : "  ";
      const indent = isFirst ? this.marginLeft + 6 : this.marginLeft + 18;

      this.addRawContent(`
        0.2 0.2 0.25 rg
        BT
        /${isFirst ? 'F2' : 'F1'} 9 Tf
        ${indent} ${this.currentY - 9} Td
        (${this.escapeText((isFirst ? bulletSymbol : '') + wrappedLines[i])}) Tj
        ET
      `);

      this.currentY -= 12;
    }
  }

  public addCalloutBox(title: string, text: string) {
    const lines = this.wrapText(text, this.usableWidth - 24, 8.5);
    const boxHeight = 24 + (lines.length * 11);

    this.checkPageOverflow(boxHeight + 10);

    // Box Background
    this.addRawContent(`
      0.95 0.97 1.0 rg
      ${this.marginLeft} ${this.currentY - boxHeight} ${this.usableWidth} ${boxHeight} re f
      0.2 0.45 0.85 rg
      ${this.marginLeft} ${this.currentY - boxHeight} 3.5 ${boxHeight} re f
      0.8 0.85 0.95 rg
      ${this.marginLeft} ${this.currentY - boxHeight} ${this.usableWidth} ${boxHeight} re s
    `);

    // Title
    this.addRawContent(`
      0.1 0.2 0.5 rg
      BT
      /F2 9.5 Tf
      ${this.marginLeft + 12} ${this.currentY - 14} Td
      (${this.escapeText(title)}) Tj
      ET
    `);

    let lineY = this.currentY - 26;
    for (const line of lines) {
      this.addRawContent(`
        0.2 0.25 0.35 rg
        BT
        /F1 8.5 Tf
        ${this.marginLeft + 12} ${lineY} Td
        (${this.escapeText(line)}) Tj
        ET
      `);
      lineY -= 11;
    }

    this.currentY -= (boxHeight + 12);
  }

  private wrapText(text: string, maxWidthPt: number, fontSizePt: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    // Approx 0.52 width factor for Helvetica font
    const charWidth = fontSizePt * 0.52;
    const maxCharsPerLine = Math.floor(maxWidthPt / charWidth);

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (testLine.length <= maxCharsPerLine) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);

    return lines.length > 0 ? lines : [text];
  }

  private escapeText(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/[^\x20-\x7E]/g, ''); // Keep printable ASCII
  }

  public buildPdfBlob(): Blob {
    if (this.currentPageLines.length > 0) {
      this.pagesContent.push([...this.currentPageLines]);
    }

    const totalPages = this.pagesContent.length;
    const pdfObjects: string[] = [];
    const objectOffsets: number[] = [];

    let currentOffset = 0;

    const appendObject = (content: string) => {
      objectOffsets.push(currentOffset);
      pdfObjects.push(content);
      currentOffset += content.length;
    };

    // Header
    const header = "%PDF-1.4\n%\xFF\xFF\xFF\xFF\n";
    currentOffset += header.length;

    // Obj 1: Catalog
    appendObject(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);

    // Kids references for Pages object
    const pageObjIds: number[] = [];
    let nextObjId = 4; // 1:Catalog, 2:Pages, 3:Fonts

    for (let i = 0; i < totalPages; i++) {
      pageObjIds.push(nextObjId);
      nextObjId += 2; // Page obj + Content stream obj
    }

    // Obj 2: Pages
    const kidsArray = pageObjIds.map(id => `${id} 0 R`).join(' ');
    appendObject(`2 0 obj\n<< /Type /Pages /Kids [ ${kidsArray} ] /Count ${totalPages} >>\nendobj\n`);

    // Obj 3: Resources (Fonts)
    appendObject(`3 0 obj\n<< /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> >> >>\nendobj\n`);

    // Build Page Objects and Content Streams
    for (let i = 0; i < totalPages; i++) {
      const pageNum = i + 1;
      const pageObjId = pageObjIds[i];
      const contentObjId = pageObjId + 1;

      // Add Footer to page content
      const footerContent = `
        0.5 0.5 0.55 rg
        ${this.marginLeft} 45 ${this.usableWidth} 0.5 re f
        BT
        /F1 8 Tf
        ${this.marginLeft} 32 Td
        (AI Product Ad Generator & Studio - Basic Account Level Application Overview) Tj
        ET
        BT
        /F2 8 Tf
        ${this.marginLeft + this.usableWidth - 60} 32 Td
        (Page ${pageNum} of ${totalPages}) Tj
        ET
      `;

      const fullPageStream = [...this.pagesContent[i], footerContent].join('\n');
      const streamLength = fullPageStream.length;

      // Page Object
      appendObject(`${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentObjId} 0 R /Resources 3 0 R >>\nendobj\n`);

      // Content Stream Object
      appendObject(`${contentObjId} 0 obj\n<< /Length ${streamLength} >>\nstream\n${fullPageStream}\nendstream\nendobj\n`);
    }

    // Cross-Reference Table
    const xrefOffset = currentOffset;
    let xref = `xref\n0 ${pdfObjects.length + 1}\n0000000000 65535 f \n`;

    let runningOffset = header.length;
    for (const obj of pdfObjects) {
      const offsetStr = runningOffset.toString().padStart(10, '0');
      xref += `${offsetStr} 00000 n \n`;
      runningOffset += obj.length;
    }

    const trailer = `trailer\n<< /Size ${pdfObjects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    const fullPdfString = header + pdfObjects.join('') + xref + trailer;

    return new Blob([fullPdfString], { type: 'application/pdf' });
  }
}

/**
 * Generates and triggers download of the PDF application guide document.
 */
export const downloadBasicAccountPdfDocument = () => {
  const builder = new PurePdfDocumentBuilder();

  // Header Title
  builder.addTitle(
    BASIC_ACCOUNT_PDF_DOCUMENT.title,
    BASIC_ACCOUNT_PDF_DOCUMENT.subtitle
  );

  // Executive Summary
  builder.addSectionHeader("Executive Summary");
  builder.addParagraph(BASIC_ACCOUNT_PDF_DOCUMENT.executiveSummary, 'F1', 9.5, 13);
  
  builder.addCalloutBox(
    "Basic Account Level Application Purpose",
    "This document serves as the formal technical overview and user guide for Basic Account Level access to the AdCraft Studio platform. It details operational workflows, AI camera emulation specs, security features, and tier capabilities."
  );

  // Main Sections
  for (const section of BASIC_ACCOUNT_PDF_DOCUMENT.sections) {
    builder.addSectionHeader(section.title);

    if (section.subsections) {
      for (const sub of section.subsections) {
        if (sub.subtitle) {
          builder.addSubsectionHeader(sub.subtitle);
        }

        for (const paragraph of sub.paragraphs) {
          builder.addParagraph(paragraph, 'F1', 9, 12.5);
        }

        if (sub.bulletPoints) {
          for (const bullet of sub.bulletPoints) {
            builder.addBulletPoint(bullet);
          }
        }
      }
    }
  }

  // Create Blob & Download
  const pdfBlob = builder.buildPdfBlob();
  const blobUrl = URL.createObjectURL(pdfBlob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = `AdCraft_Studio_Basic_Account_Application_Guide.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
};

/**
 * Triggers clean Print-to-PDF dialog in browser.
 */
export const printBasicAccountDocument = () => {
  const doc = BASIC_ACCOUNT_PDF_DOCUMENT;
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${doc.title} - Basic Account Overview</title>
        <style>
          @page {
            size: letter;
            margin: 0.6in;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #1a1a24;
            line-height: 1.5;
            margin: 0;
            padding: 0;
            background: #fff;
            font-size: 13px;
          }
          .header-banner {
            background: #0f172a;
            color: #fff;
            padding: 24px;
            border-radius: 8px;
            border-left: 6px solid #6366f1;
            margin-bottom: 20px;
          }
          .header-banner h1 {
            margin: 0 0 6px 0;
            font-size: 22px;
            font-weight: 800;
            letter-spacing: -0.5px;
          }
          .header-banner p {
            margin: 0;
            color: #cbd5e1;
            font-size: 13px;
          }
          .meta-bar {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 10px 16px;
            border-radius: 6px;
            font-size: 11px;
            color: #475569;
            margin-bottom: 24px;
            display: flex;
            justify-content: space-between;
          }
          h2 {
            font-size: 15px;
            color: #1e1b4b;
            border-bottom: 2px solid #6366f1;
            padding-bottom: 4px;
            margin-top: 24px;
            margin-bottom: 12px;
          }
          h3 {
            font-size: 13px;
            color: #312e81;
            margin-top: 16px;
            margin-bottom: 8px;
          }
          p {
            margin-top: 0;
            margin-bottom: 10px;
          }
          ul {
            margin-top: 0;
            margin-bottom: 12px;
            padding-left: 20px;
          }
          li {
            margin-bottom: 4px;
          }
          .callout {
            background: #f0f7ff;
            border-left: 4px solid #3b82f6;
            padding: 12px 16px;
            border-radius: 4px;
            margin: 16px 0;
            font-size: 12px;
          }
          .callout-title {
            font-weight: 700;
            color: #1e40af;
            margin-bottom: 4px;
          }
          .footer {
            margin-top: 40px;
            border-top: 1px solid #e2e8f0;
            padding-top: 12px;
            font-size: 10px;
            color: #94a3b8;
            display: flex;
            justify-content: space-between;
          }
          @media print {
            .no-print { display: none; }
            body { background: #fff; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="position: sticky; top: 0; background: #fff; padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right; margin-bottom: 20px;">
          <button onclick="window.print()" style="background: #4f46e5; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer;">
            Print / Save as PDF
          </button>
        </div>

        <div class="header-banner">
          <h1>${doc.title}</h1>
          <p>${doc.subtitle}</p>
        </div>

        <div class="meta-bar">
          <span><strong>Date:</strong> ${doc.date}</span>
          <span><strong>Author:</strong> ${doc.author}</span>
          <span><strong>Version:</strong> ${doc.version}</span>
        </div>

        <h2>Executive Summary</h2>
        <p>${doc.executiveSummary}</p>

        <div class="callout">
          <div class="callout-title">Basic Account Application Notice</div>
          This application specification details full functionality, system architecture, camera settings, and operational guidelines for the Basic Account Tier.
        </div>

        ${doc.sections.map(section => `
          <h2>${section.title}</h2>
          ${section.subsections ? section.subsections.map(sub => `
            ${sub.subtitle ? `<h3>${sub.subtitle}</h3>` : ''}
            ${sub.paragraphs.map(p => `<p>${p}</p>`).join('')}
            ${sub.bulletPoints ? `
              <ul>
                ${sub.bulletPoints.map(b => `<li>${b}</li>`).join('')}
              </ul>
            ` : ''}
          `).join('') : ''}
        `).join('')}

        <div class="footer">
          <span>AI Product Ad Generator & Studio - Basic Account Level Document</span>
          <span>Page 1 of 1</span>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
};
