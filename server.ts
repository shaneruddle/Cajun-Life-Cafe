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

  app.use(express.json({ limit: "10mb" }));

  const publicDir = path.join(process.cwd(), "public");
  const distDir = path.join(process.cwd(), "dist");

  // Serve menu images
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

  // ── Twilio SMS / OTP ──────────────────────────────────────────────
  // Kept for future loyalty / CRM SMS features. Not active yet.

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
