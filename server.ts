import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "8080");

  app.use(express.json({ limit: "20mb" }));

  // ── CORS ──────────────────────────────────────────────────────────
  app.use((req, res, next) => {
    const allowed = [
      "https://cajunlifecafe.com",
      "https://cajun-life-cafe.web.app",
      "https://cajun-life-cafe.firebaseapp.com",
    ];
    const origin = req.headers.origin || "";
    if (allowed.includes(origin) || !origin) {
      res.setHeader("Access-Control-Allow-Origin", origin || "*");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  const publicDir = path.join(process.cwd(), "public");
  const distDir = path.join(process.cwd(), "dist");

  // Static file routes
  app.get("/menu-items/:filename", (req, res, next) => {
    const filePath = path.join(publicDir, "menu-items", req.params.filename);
    if (fs.existsSync(filePath)) return res.sendFile(filePath);
    next();
  });

  app.get("/menu/:filename", (req, res, next) => {
    const filePath = path.join(publicDir, "menu", req.params.filename);
    if (fs.existsSync(filePath)) return res.sendFile(filePath);
    next();
  });

  app.get("/logo.png", (req, res) => {
    const filePath = path.join(publicDir, "logo.png");
    if (fs.existsSync(filePath)) return res.sendFile(filePath);
    res.status(404).send("Not found");
  });

  app.use(express.static(publicDir));

  // ── OCR Receipt Endpoint ───────────────────────────────────────────
  // Accepts a base64 image, sends to Google Cloud Vision API, returns structured line items
  app.post("/api/ocr-receipt", async (req, res) => {
    const { imageBase64, mimeType = "image/jpeg" } = req.body;
    const apiKey = process.env.CLOUD_VISION_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ success: false, error: "OCR service not configured" });
    }
    if (!imageBase64) {
      return res.status(400).json({ success: false, error: "No image provided" });
    }

    try {
      // Step 1: Extract raw text from image using Cloud Vision
      const visionResponse = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requests: [{
              image: { content: imageBase64 },
              features: [{ type: "TEXT_DETECTION", maxResults: 1 }]
            }]
          })
        }
      );

      const visionData = await visionResponse.json() as any;
      const rawText = visionData?.responses?.[0]?.fullTextAnnotation?.text || "";

      if (!rawText) {
        return res.json({
          success: true,
          data: { supplier: "", date: "", total: null, currency: "THB", items: [] }
        });
      }

      // Step 2: Parse the raw text into structured data
      // Use Claude API to parse the raw text intelligently
      console.log("OCR_RAW_TEXT_LENGTH:", rawText.length, "PREVIEW:", rawText.substring(0, 200));
      console.log("ANTHROPIC_KEY_SET:", !!process.env.ANTHROPIC_API_KEY);
      const claudeResp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY || "",
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          messages: [{
            role: "user",
            content: `Extract data from this Thai/English receipt OCR text. Return ONLY valid JSON, no markdown:
{
  "supplier": "shop name or empty string",
  "date": "YYYY-MM-DD or empty string",
  "total": number or null,
  "currency": "THB",
  "items": [{"description": "item name in English", "quantity": number or null, "unit": "", "unit_price": number or null, "total_price": number or null}]
}

Receipt text:
${rawText}`
          }]
        })
      });
      const claudeData = await claudeResp.json() as any;
      console.log("CLAUDE_STATUS:", claudeResp.status, "ERROR:", claudeData?.error);
      const claudeText = claudeData?.content?.[0]?.text || "{}";
      console.log("CLAUDE_RESPONSE:", claudeText.substring(0, 300));
      const clean = claudeText.replace(/\`\`\`json\n?/g, "").replace(/\`\`\`\n?/g, "").trim();
      const parsed = JSON.parse(clean);

      return res.json({
        success: true,
        data: parsed
      });

    } catch (error) {
      console.error("OCR error:", error);
      return res.status(500).json({ success: false, error: "Failed to process receipt" });
    }
  });

  // ── Twilio SMS / OTP ──────────────────────────────────────────────
  app.post("/api/send-sms", async (req, res) => {
    const { to, body } = req.body;
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      return res.status(500).json({ success: false, error: "Twilio not configured" });
    }

    try {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const params = new URLSearchParams({ To: to, From: fromNumber, Body: body });
      const response = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });
      const data = await response.json() as any;
      if (data.sid) return res.json({ success: true, sid: data.sid });
      return res.status(400).json({ success: false, error: data.message });
    } catch (error) {
      console.error("Twilio SMS error:", error);
      return res.status(500).json({ success: false, error: "Failed to send SMS" });
    }
  });

  app.post("/api/send-otp", async (req, res) => {
    const { to } = req.body;
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

    if (!accountSid || !authToken || !verifyServiceSid) {
      return res.status(500).json({ success: false, error: "Twilio Verify not configured" });
    }

    try {
      const url = `https://verify.twilio.com/v2/Services/${verifyServiceSid}/Verifications`;
      const params = new URLSearchParams({ To: to, Channel: "sms" });
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });
      const data = await response.json() as any;
      if (data.sid) return res.json({ success: true });
      return res.status(400).json({ success: false, error: data.message });
    } catch (error) {
      console.error("Twilio OTP error:", error);
      return res.status(500).json({ success: false, error: "Failed to send OTP" });
    }
  });

  app.post("/api/verify-otp", async (req, res) => {
    const { to, code } = req.body;
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

    if (!accountSid || !authToken || !verifyServiceSid) {
      return res.status(500).json({ success: false, error: "Twilio Verify not configured" });
    }

    try {
      const url = `https://verify.twilio.com/v2/Services/${verifyServiceSid}/VerificationCheck`;
      const params = new URLSearchParams({ To: to, Code: code });
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });
      const data = await response.json() as any;
      if (data.status === "approved") return res.json({ success: true });
      return res.json({ success: false, message: "Invalid or expired code" });
    } catch (error) {
      console.error("Twilio verify error:", error);
      return res.status(500).json({ success: false, error: "Failed to verify OTP" });
    }
  });

  // ── Serve React app (production) ──────────────────────────────────
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch(console.error);
