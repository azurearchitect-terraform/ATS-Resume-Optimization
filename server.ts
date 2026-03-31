import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import puppeteer from "puppeteer";
import bodyParser from "body-parser";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for large HTML strings
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

  // API Endpoint for PDF Generation
  app.post("/api/generate-pdf", async (req, res) => {
    const { html, css, fonts } = req.body;

    if (!html) {
      return res.status(400).json({ error: "HTML content is required" });
    }

    let browser;
    try {
      // Launch Puppeteer with necessary flags for container environments
      browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--font-render-hinting=none",
          "--disable-gpu",
        ],
      });

      const page = await browser.newPage();

      // Set a reasonable viewport
      await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });

      // Construct the base HTML
      const baseHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              @page {
                size: A4;
              }
              html, body {
                margin: 0;
                padding: 0;
                height: auto !important;
                min-height: 100% !important;
                -webkit-print-color-adjust: exact;
                background: white;
              }
              /* Ensure the resume-page fits perfectly and allows multiple pages */
              .resume-page {
                box-shadow: none !important;
                margin: 0 !important;
                border: none !important;
                width: 100% !important;
                min-height: 100% !important;
                height: auto !important;
                overflow: visible !important;
                display: block !important;
                padding: 0 !important;
              }
              .resume-section {
                /* Removed page-break-inside to allow sections to break across pages */
              }
            </style>
          </head>
          <body>
            ${html}
          </body>
        </html>
      `;

      // Set content
      await page.setContent(baseHtml, { waitUntil: "load", timeout: 30000 });

      // Inject styles safely
      if (css) {
        await page.addStyleTag({ content: css });
      }
      if (fonts) {
        await page.addStyleTag({ content: fonts });
      }
      
      // Wait for network to settle a bit for any external assets
      try {
        await page.waitForNetworkIdle({ idleTime: 500, timeout: 5000 });
      } catch (e) {
        console.warn("Network idle timeout, proceeding with PDF generation");
      }
      
      // Wait for fonts to be ready
      await page.evaluateHandle('document.fonts.ready');

      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: {
          top: "10mm",
          right: "10mm",
          bottom: "10mm",
          left: "10mm",
        }
      });

      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error("Generated PDF buffer is empty");
      }

      console.log(`PDF generated successfully. Size: ${pdfBuffer.length} bytes`);

      res.writeHead(200, {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="resume.pdf"',
        "Content-Length": pdfBuffer.length,
      });

      res.end(pdfBuffer);
    } catch (error: any) {
      console.error("PDF Generation Error:", error);
      res.status(500).json({ error: "Failed to generate PDF", details: error.message });
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
