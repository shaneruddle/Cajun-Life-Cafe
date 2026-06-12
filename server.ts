import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
import { initializeApp, getApps, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

dotenv.config();

// ── Firebase Admin — initialise once at startup ───────────────────────────
if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}
const adminDb = getFirestore(); // default database

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
          model: "claude-sonnet-4-6",
          max_tokens: 2048,
          messages: [{
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mimeType, data: imageBase64 }
              },
              {
                type: "text",
                text: `You are a receipt parser for a Thai restaurant. Extract all data from this receipt image.
Return ONLY valid JSON with no markdown fences or extra text:
{
  "supplier": "shop or supplier name",
  "date": "",
  "total": total amount as number or null,
  "line_items": [
    { "name": "item name in English", "quantity": number, "unit": "kg", "unit_cost": number, "total_cost": number }
  ]
}
Rules:
- date: always return empty string "" — the app will use today's date
- total: look for ยอดรวม, รวมทั้งสิ้น, รวมเงิน, TOTAL, grand total
- line_items: extract ALL line items from the receipt. Thai handwritten receipts have columns: จำนวน (qty) | รายการ (description) | หน่วยละ (unit price) | จำนวนเงิน (amount)
  * name: translate Thai to English, keep concise (e.g. "Chicken Wings", "Tiger Prawns", "Cooking Oil")
  * quantity: number of units (numeric only, e.g. 6, 3, 1)
  * unit: use "kg", "g", "L", "ml", "pcs", "pack", "box", "can", "bag", "bottle" — use "pcs" if unclear
  * unit_cost: price per unit as number
  * total_cost: total for that line as number. Decorative pen strokes after amounts should be ignored — "1800 /" means 1800. If a price looks like "103/56" it means 103.56
  * SKIP the line entirely if you cannot confidently read the description or amount
- supplier: use the shop/brand name from the receipt header
- Return ONLY valid JSON, no markdown, no extra text`
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
  // Always returns 200, logs User IDs for linking purposes
  app.post("/api/line-webhook", (req, res) => {
    res.status(200).json({ status: "ok" });
    const events = req.body?.events || [];
    for (const event of events) {
      const userId = event.source?.userId;
      if (userId) console.log(`LINE user ID: ${userId}`);
    }
  });



  // ── LINE Login Activation ─────────────────────────────────────────
  const LINE_LOGIN_CHANNEL_ID = process.env.LINE_LOGIN_CHANNEL_ID || "";
  const LINE_LOGIN_CHANNEL_SECRET = process.env.LINE_LOGIN_CHANNEL_SECRET || "";
  const ACTIVATION_BASE_URL = "https://cajunlifecafe.com";

  // Get activation token info (for the activation page)
  app.get("/api/activate/:token", async (req, res) => {
    const { token } = req.params;
    try {
      // Query by token field (tokens stored with addDoc — doc ID is random)
      const snap = await adminDb.collection("activation_tokens")
        .where("token", "==", token)
        .limit(1)
        .get();
      if (snap.empty) return res.status(404).json({ error: "Invalid or expired link" });
      const data = snap.docs[0].data();
      if (data.used) return res.status(400).json({ error: "This link has already been used" });
      return res.json({ 
        valid: true, 
        firstName: data.firstName,
        lastName: data.lastName
      });
    } catch (err: any) {
      console.error("Activation token lookup error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  });

  // Initiate LINE Login OAuth
  app.get("/api/activate/:token/line-login", (req, res) => {
    const { token } = req.params;
    const state = token;
    const callbackUrl = `${ACTIVATION_BASE_URL}/activate/callback`;
    const lineLoginUrl = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${LINE_LOGIN_CHANNEL_ID}&redirect_uri=${encodeURIComponent(callbackUrl)}&state=${state}&scope=profile`;
    res.redirect(lineLoginUrl);
  });

  // LINE Login callback — saves lineUserId to loyalty_customers
  app.get("/activate/callback", async (req, res) => {
    const { code, state: activationToken } = req.query as { code: string; state: string };
    if (!code || !activationToken) {
      return res.redirect(`/activate/error?msg=Missing+parameters`);
    }
    try {
      // Exchange code for access token
      const tokenResp = await fetch("https://api.line.me/oauth2/v2.1/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: `${ACTIVATION_BASE_URL}/activate/callback`,
          client_id: LINE_LOGIN_CHANNEL_ID,
          client_secret: LINE_LOGIN_CHANNEL_SECRET
        })
      });
      const tokenData = await tokenResp.json() as any;
      if (!tokenData.access_token) {
        console.error("LINE Login token error:", tokenData);
        return res.redirect(`/activate/error?msg=LINE+login+failed`);
      }

      // Get LINE profile (User ID)
      const profileResp = await fetch("https://api.line.me/v2/profile", {
        headers: { "Authorization": `Bearer ${tokenData.access_token}` }
      });
      const profile = await profileResp.json() as any;
      const lineUserId = profile.userId;

      if (!lineUserId) return res.redirect(`/activate/error?msg=Could+not+get+LINE+ID`);

      // Look up activation token by field (tokens stored with addDoc — doc ID is random)
      const tokenSnap = await adminDb.collection("activation_tokens")
        .where("token", "==", activationToken)
        .limit(1)
        .get();
      if (tokenSnap.empty || tokenSnap.docs[0].data().used) {
        return res.redirect(`/activate/error?msg=Link+already+used`);
      }

      const tokenDocRef = tokenSnap.docs[0].ref;
      const { crmCustomerId } = tokenSnap.docs[0].data();

      if (!crmCustomerId) {
        console.error(`LINE Login: no crmCustomerId on token ${activationToken}`);
        return res.redirect(`/activate/error?msg=Invalid+activation+token`);
      }

      // Save lineUserId directly to crm_customers (single source of truth)
      await adminDb.collection("crm_customers").doc(crmCustomerId).update({
        lineUserId,
        updatedAt: new Date().toISOString()
      });

      // Mark token as used
      await tokenDocRef.update({
        used: true,
        usedAt: new Date().toISOString(),
        lineUserId
      });

      console.log(`LINE Login: linked ${lineUserId} to CRM customer ${crmCustomerId}`);
      return res.redirect(`/activate/success`);
    } catch (err) {
      console.error("LINE Login callback error:", err);
      return res.redirect(`/activate/error?msg=Server+error`);
    }
  });


  // ── Loyalty Signup (public, from /loyalty page) ───────────────────
  app.post("/api/loyalty-signup", async (req, res) => {
    const { firstName, lastName, email, mobile, website } = req.body || {};

    // Honeypot — bots fill hidden fields
    if (website) return res.json({ success: true });

    if (!firstName?.trim() || !lastName?.trim() || !mobile?.trim()) {
      return res.status(400).json({ success: false, error: "Name and mobile number are required" });
    }

    // Normalise mobile to +66 format (matches CRM convention)
    const digits = String(mobile).replace(/[\s\-()]/g, "");
    let fullMobile = digits;
    if (digits.startsWith("0")) fullMobile = `+66${digits.slice(1)}`;
    else if (!digits.startsWith("+")) fullMobile = `+66${digits}`;
    if (!/^\+\d{8,15}$/.test(fullMobile)) {
      return res.status(400).json({ success: false, error: "Please enter a valid mobile number" });
    }

    try {
      // Dedupe by mobile
      const existing = await adminDb.collection("crm_customers")
        .where("mobile", "==", fullMobile)
        .limit(1)
        .get();
      if (!existing.empty) {
        return res.json({ success: true, existing: true });
      }

      const now = new Date().toISOString();
      const docRef = await adminDb.collection("crm_customers").add({
        firstName: String(firstName).trim(),
        lastName: String(lastName).trim(),
        email: String(email || "").trim(),
        mobile: fullMobile,
        notes: "Signed up via loyalty page",
        status: "active",
        lineUserId: "",
        address: "",
        deliveryLat: null,
        deliveryLng: null,
        deliveryNotes: "",
        totalSpend: 0,
        uid: "loyalty-signup",
        createdAt: now,
        updatedAt: now,
      });

      // Activation token so the new member can link LINE immediately
      const token = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
      await adminDb.collection("activation_tokens").add({
        token,
        crmCustomerId: docRef.id,
        firstName: String(firstName).trim(),
        lastName: String(lastName).trim(),
        mobile: fullMobile,
        used: false,
        createdAt: now,
      });

      await adminDb.collection("system_logs").add({
        action: "Loyalty Signup",
        details: `Self-signup via loyalty page: ${String(firstName).trim()} ${String(lastName).trim()} (${fullMobile})`,
        category: "loyalty",
        userEmail: "loyalty-page",
        userId: "loyalty-signup",
        timestamp: now,
      });

      return res.json({ success: true, activationUrl: `${ACTIVATION_BASE_URL}/activate/${token}` });
    } catch (err) {
      console.error("Loyalty signup error:", err);
      return res.status(500).json({ success: false, error: "Server error — please try again" });
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
      console.log(`LINE push response: HTTP ${pushResp.status}`, JSON.stringify(pushData));
      if (pushResp.ok) {
        console.log(`LINE push sent to ${lineUserId}`);
        return res.json({ success: true });
      } else {
        console.error("LINE push error:", pushResp.status, JSON.stringify(pushData));
        return res.status(500).json({ success: false, httpStatus: pushResp.status, error: pushData.message, detail: pushData });
      }
    } catch (error) {
      console.error("LINE push exception:", error);
      return res.status(500).json({ success: false, error: "Failed to send LINE message" });
    }
  });


  // ── Nightly Loyalty Digest Email ─────────────────────────────────
  async function sendLoyaltyDigest(): Promise<{ sent: boolean; entries: number; error?: string }> {
    const smtpHost = process.env.SMTP_HOST || "";
    const smtpPort = parseInt(process.env.SMTP_PORT || "587");
    const smtpUser = process.env.SMTP_USER || "";
    const smtpPass = process.env.SMTP_PASS || "";
    if (!smtpHost || !smtpUser || !smtpPass) return { sent: false, entries: 0, error: "SMTP not configured" };

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Fetch activity logs and all loyalty members in parallel
    const [logsSnap, membersSnap] = await Promise.all([
      adminDb.collection("system_logs")
        .where("category", "==", "loyalty")
        .where("timestamp", ">=", since)
        .orderBy("timestamp", "asc")
        .get(),
      adminDb.collection("crm_customers")
        .where("loyaltyEnabled", "==", true)
        .get()
    ]);

    const logs = logsSnap.docs.map(d => d.data());
    const members = membersSnap.docs.map(d => d.data());
    const totalBalance = members.reduce((sum: number, m: any) => sum + (m.balance || 0), 0);
    const dateStr = new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Bangkok", day: "2-digit", month: "long", year: "numeric" });

    // Activity rows
    let rows = "";
    if (logs.length === 0) {
      rows = `<tr><td colspan="4" style="text-align:center;color:#999;padding:20px;">No loyalty activity in the past 24 hours</td></tr>`;
    } else {
      for (const log of logs) {
        const t = new Date(log.timestamp).toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });
        const c = log.action === "Receipt Redemption" ? "#e53e3e" : (log.action === "Balance Loaded" || log.action === "Wallet Top Up") ? "#276749" : "#2b6cb0";
        rows += `<tr style="border-bottom:1px solid #eee"><td style="padding:10px;color:#666">${t}</td><td style="padding:10px;font-weight:600;color:${c}">${log.action}</td><td style="padding:10px;color:#333;font-size:13px">${log.details}</td><td style="padding:10px;color:#999;font-size:12px">${log.userEmail || ""}</td></tr>`;
      }
    }

    // Balance snapshot rows — sorted by balance descending
    const sortedMembers = [...members].sort((a: any, b: any) => (b.balance || 0) - (a.balance || 0));
    let balanceRows = "";
    for (const m of sortedMembers) {
      const bal = m.balance || 0;
      const colour = bal > 0 ? "#276749" : "#999";
      const linked = m.lineUserId ? "✓" : "–";
      balanceRows += `<tr style="border-bottom:1px solid #eee">
        <td style="padding:10px;font-weight:600;color:#333">${m.firstName || ""} ${m.lastName || ""}</td>
        <td style="padding:10px;color:#666;font-size:13px">${m.mobile || "–"}</td>
        <td style="padding:10px;font-weight:700;color:${colour};text-align:right">฿${bal.toLocaleString()}</td>
        <td style="padding:10px;color:#999;font-size:12px;text-align:center">${linked}</td>
      </tr>`;
    }

    const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f7f7f7;padding:30px"><div style="max-width:700px;margin:0 auto;background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
      <div style="background:#1a1a1a;padding:24px 32px;border-radius:12px 12px 0 0">
        <p style="margin:0;color:#fff;font-size:20px;font-weight:700">Cajun Life Cafe</p>
        <p style="margin:4px 0 0;color:#aaa;font-size:13px">Loyalty Digest — ${dateStr}</p>
      </div>

      <div style="padding:24px 32px">
        <p style="color:#333"><strong>${logs.length} loyalty event${logs.length !== 1 ? "s" : ""}</strong> in the past 24 hours.</p>
        <table width="100%" style="border-collapse:collapse;border:1px solid #eee">
          <thead><tr style="background:#f9f9f9">
            <th style="padding:10px;text-align:left;color:#666;font-size:12px">Time</th>
            <th style="padding:10px;text-align:left;color:#666;font-size:12px">Action</th>
            <th style="padding:10px;text-align:left;color:#666;font-size:12px">Details</th>
            <th style="padding:10px;text-align:left;color:#666;font-size:12px">Staff</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>

      <div style="padding:0 32px 24px">
        <p style="color:#333;font-weight:700;font-size:16px;margin-bottom:4px">💰 Wallet Balances Snapshot</p>
        <p style="color:#666;font-size:13px;margin-top:0">${members.length} enrolled member${members.length !== 1 ? "s" : ""} · Total outstanding: <strong>฿${totalBalance.toLocaleString()}</strong></p>
        <table width="100%" style="border-collapse:collapse;border:1px solid #eee">
          <thead><tr style="background:#f9f9f9">
            <th style="padding:10px;text-align:left;color:#666;font-size:12px">Customer</th>
            <th style="padding:10px;text-align:left;color:#666;font-size:12px">Mobile</th>
            <th style="padding:10px;text-align:right;color:#666;font-size:12px">Balance</th>
            <th style="padding:10px;text-align:center;color:#666;font-size:12px">LINE</th>
          </tr></thead>
          <tbody>${balanceRows}</tbody>
          <tfoot><tr style="background:#f9f9f9">
            <td colspan="2" style="padding:10px;font-weight:700;color:#333">Total outstanding</td>
            <td style="padding:10px;font-weight:700;color:#276749;text-align:right">฿${totalBalance.toLocaleString()}</td>
            <td></td>
          </tr></tfoot>
        </table>
      </div>

      <div style="padding:16px 32px 24px;border-top:1px solid #eee">
        <p style="color:#aaa;font-size:12px;margin:0">Auto-generated nightly at midnight ICT.</p>
      </div>
    </div></body></html>`;

    try {
      const nodemailer = require("nodemailer");
      const transporter = nodemailer.createTransport({ host: smtpHost, port: smtpPort, secure: false, auth: { user: smtpUser, pass: smtpPass } });
      await transporter.sendMail({
        from: `"Cajun Life Cafe" <${smtpUser}>`,
        to: "info@cajunlifecafe.com",
        subject: `Loyalty Digest — ${dateStr} (${logs.length} event${logs.length !== 1 ? "s" : ""})`,
        html
      });
      console.log(`Loyalty digest sent: ${logs.length} entries`);
      return { sent: true, entries: logs.length };
    } catch (err: any) {
      console.error("Loyalty digest error:", err);
      return { sent: false, entries: logs.length, error: err?.message };
    }
  }

  app.post("/api/loyalty-digest", async (_req, res) => {
    try { return res.json(await sendLoyaltyDigest()); }
    catch (err: any) { return res.status(500).json({ sent: false, error: err?.message }); }
  });

  app.get("/api/loyalty-digest-scheduled", async (_req, res) => {
    res.status(200).json({ status: "triggered" });
    await sendLoyaltyDigest();
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

