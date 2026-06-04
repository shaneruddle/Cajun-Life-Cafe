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

  // Version endpoint
  app.get("/api/version", (_req, res) => res.json({ version: "2026-06-03 12:48:59 UTC", has_anthropic: !!process.env.ANTHROPIC_API_KEY }));

  // ── CORS ──────────────────────────────────────────────────────────
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
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
  // Accepts a base64 image, sends directly to Claude Vision, returns structured data
  app.post("/api/ocr-receipt", async (req, res) => {
    const { imageBase64, mimeType = "image/jpeg" } = req.body;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (!anthropicKey) {
      return res.status(500).json({ success: false, error: "OCR service not configured" });
    }
    if (!imageBase64) {
      return res.status(400).json({ success: false, error: "No image provided" });
    }

    try {
      // Send image directly to Claude — no Vision API needed
      const claudeResp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          messages: [{
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mimeType, data: imageBase64 }
              },
              {
                type: "text",
                text: `You are a receipt parser. Look at this receipt image and extract the data.
Return ONLY valid JSON with no markdown fences:
{
  "supplier": "shop or supplier name",
  "date": "",
  "total": total amount as number or null,
  "currency": "THB",
  "items": [{"description": "item name in English", "quantity": number or null, "unit": "unit of measure or empty string", "unit_price": number or null, "total_price": number or null}]
}
Rules:
- date: always return empty string "" — the app will use today's date
- total: look for ยอดรวม, รวมทั้งสิ้น, รวมเงิน, TOTAL, grand total. If on second page, sum visible line items
- items: extract line items you can read clearly — SKIP any line that is blurry, unclear, or illegible. For each clear item:
  * description: translate to English, keep it concise (e.g. "Chicken Breast", "Cooking Oil 1L", "Fish Sauce 700ml")
  * quantity: number of units purchased (e.g. 2, 5, 1)
  * unit: the purchase unit — extract from the item name or column. Use: "kg", "g", "l", "ml", "piece", "pack", "box", "can", "bag", "bottle". If the item name contains a weight/volume (e.g. "น้ำมัน 5L", "ซีอิ้ว 700ml") extract that as the unit with quantity 1
  * unit_price: price per unit (THB)
  * total_price: total for that line. Dashes (—) after numbers are decorative. "680 —" means 680. Numbers split across columns like "103" "56" means 103.56
  * SKIP the line entirely if you cannot confidently read the description or amount
- supplier: use the shop/brand name from the receipt header`
              }
            ]
          }]
        })
      });

      const claudeData = await claudeResp.json() as any;
      console.log("CLAUDE_RAW_STATUS:", claudeResp.status);
      console.log("CLAUDE_RAW_DATA:", JSON.stringify(claudeData).substring(0, 500));
      const claudeText = claudeData?.content?.[0]?.text || "{}";
      console.log("CLAUDE_TEXT:", claudeText.substring(0, 300));
      const clean = claudeText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      let parsed: any = {};
      try { parsed = JSON.parse(clean); } catch(e) { console.error("JSON_PARSE_ERR:", e, "TEXT:", clean); }
      return res.json({ success: true, data: parsed, _debug: claudeText.substring(0, 200) });

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


  // ── LINE Messaging API Webhook ────────────────────────────────────
  // Uses stateless channel access tokens — no manual token needed
  const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || "";
  const LINE_CHANNEL_ID = process.env.LINE_CHANNEL_ID || "";

  async function getLineAccessToken(): Promise<string> {
    const resp = await fetch("https://api.line.me/v2/oauth/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: LINE_CHANNEL_ID,
        client_secret: LINE_CHANNEL_SECRET
      })
    });
    const data = await resp.json() as any;
    return data.access_token || "";
  }

  async function replyLineMessage(replyToken: string, text: string): Promise<void> {
    const token = await getLineAccessToken();
    await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        replyToken,
        messages: [{ type: "text", text }]
      })
    });
  }

  function verifyLineSignature(body: string, signature: string): boolean {
    if (!LINE_CHANNEL_SECRET) return false;
    const hmacLib = require("crypto");
    const hmac = hmacLib.createHmac("sha256", LINE_CHANNEL_SECRET);
    hmac.update(body);
    const expected = hmac.digest("base64");
    return expected === signature;
  }

  // Verify endpoint (LINE sends GET to check webhook)
  app.get("/api/line-webhook", (_req, res) => {
    res.status(200).send("OK");
  });

  // Main webhook — receives messages from LINE
  // Looks up customer balance by LINE User ID and replies
  app.post("/api/line-webhook", async (req, res) => {
    const signature = req.headers["x-line-signature"] as string;
    const body = req.body;

    const rawBody = JSON.stringify(body);
    if (LINE_CHANNEL_SECRET && !verifyLineSignature(rawBody, signature)) {
      console.error("LINE: invalid signature");
      return res.status(403).json({ error: "Invalid signature" });
    }

    res.status(200).json({ status: "ok" }); // Respond to LINE immediately

    for (const event of (body.events || [])) {
      if (event.type === "message" && event.message.type === "text") {
        const lineUserId = event.source.userId;
        const replyToken = event.replyToken;

        try {
          // Look up loyalty customer by lineUserId
          const { initializeApp, getApps, cert } = await import("firebase-admin/app");
          const { getFirestore } = await import("firebase-admin/firestore");

          if (!getApps().length) {
            initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}")) });
          }
          const db = getFirestore();

          const snap = await db.collection("loyalty_customers")
            .where("lineUserId", "==", lineUserId)
            .limit(1)
            .get();

          if (snap.empty) {
            // Not linked — don't reply, let staff handle the conversation normally
            console.log("LINE: unlinked user messaged, ignoring:", lineUserId);
            continue;
          }

          const customer = snap.docs[0].data();
          const firstName = customer.firstName || customer.name || "there";
          const balance = (customer.balance || 0).toLocaleString("en-US");

          await replyLineMessage(replyToken,
            `🌶️ Hi ${firstName}!\n\nYour Cajun Life Cafe wallet balance is:\n฿${balance}\n\nThank you for being a valued member! 🙏`
          );
          console.log(`LINE: balance reply sent to ${lineUserId} (${firstName}): ฿${balance}`);

        } catch (err) {
          console.error("LINE webhook error:", err);
        }
      }
    }
  });


  // ── LINE Push Message ─────────────────────────────────────────────
  // Sends an outbound push message to a customer's LINE account
  app.post("/api/line-push", async (req, res) => {
    const { lineUserId, message } = req.body;
    const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN || "";

    if (!lineUserId || !message) {
      return res.status(400).json({ success: false, error: "lineUserId and message required" });
    }
    if (!accessToken) {
      return res.status(500).json({ success: false, error: "LINE access token not configured" });
    }

    try {
      const pushResp = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          to: lineUserId,
          messages: [{ type: "text", text: message }]
        })
      });

      const pushData = await pushResp.json() as any;
      if (pushResp.ok) {
        console.log(`LINE push sent to ${lineUserId}`);
        return res.json({ success: true });
      } else {
        console.error("LINE push error:", JSON.stringify(pushData));
        return res.status(500).json({ success: false, error: pushData.message, detail: pushData });
      }
    } catch (error) {
      console.error("LINE push exception:", error);
      return res.status(500).json({ success: false, error: "Failed to send LINE message" });
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


