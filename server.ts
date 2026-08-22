import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fs from "fs";
import { createRequire } from "module";
import multer from "multer";
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

  // `verify` stashes the raw request body on `req.rawBody` so the LINE
  // webhook can compute an HMAC signature over the exact bytes LINE sent —
  // JSON.stringify(req.body) is not guaranteed to reproduce them byte-for-byte.
  app.use(express.json({
    limit: "20mb",
    verify: (req: any, _res, buf) => { req.rawBody = buf; }
  }));

  // Version endpoint
  app.get("/api/version", (_req, res) => res.json({ version: "2026-07-16 00:00:00 UTC", has_anthropic: !!process.env.ANTHROPIC_API_KEY }));


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

  // ── Convert HEIC/HEIF photos to JPEG before sending to Claude Vision ──
  // Claude's vision API only accepts JPEG/PNG/GIF/WEBP. iPhone photos
  // uploaded via Safari's file picker are usually auto-converted to JPEG by
  // the browser, but a desktop browser (or "Keep Original" on iOS) can send
  // the raw .HEIC file straight through. Claude can't read that — it
  // replies with something that isn't the expected JSON, which surfaces to
  // staff as "Could not read any days off the card" with no real clue why.
  async function normalizeImageForVision(imageBase64: string, mimeType?: string): Promise<{ data: string; media_type: string }> {
    const isHeic = /heic|heif/i.test(mimeType || "");
    if (!isHeic) {
      return { data: imageBase64, media_type: mimeType || "image/jpeg" };
    }
    try {
      const heicConvert = require("heic-convert");
      const inputBuffer = Buffer.from(imageBase64, "base64");
      const outputBuffer: Buffer = await heicConvert({ buffer: inputBuffer, format: "JPEG", quality: 0.92 });
      return { data: outputBuffer.toString("base64"), media_type: "image/jpeg" };
    } catch (err) {
      console.error("HEIC_CONVERT_ERR:", err);
      // Don't let a conversion bug crash the endpoint — fall through with
      // the original bytes (Claude will likely still fail to read it, but
      // the user gets the existing "couldn't read" message, not a 500).
      return { data: imageBase64, media_type: mimeType || "image/jpeg" };
    }
  }

  // ── OCR Receipt Endpoint ───────────────────────────────────────────
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
      const normalizedImage = await normalizeImageForVision(imageBase64, mimeType);

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
                source: { type: "base64", media_type: normalizedImage.media_type, data: normalizedImage.data }
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
- line_items: extract ALL line items from the receipt
- Return ONLY valid JSON, no markdown, no extra text`
              }
            ]
          }]
        })
      });

      const claudeData = await claudeResp.json() as any;
      const claudeText = claudeData?.content?.[0]?.text || "{}";
      const clean = claudeText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      let parsed: any = {};
      try { parsed = JSON.parse(clean); } catch(e) { console.error("JSON_PARSE_ERR:", e); }

      return res.json({ success: true, data: parsed });
    } catch (error) {
      console.error("OCR error:", error);
      return res.status(500).json({ success: false, error: "Failed to process receipt" });
    }
  });

  // ── OCR Time Card Endpoint ───────────────────────────────────────────
  // Reads photo(s) of a Vertex mechanical punch/time-clock card — one side
  // covers days 1-15 (blue header), the other days 16-31 (orange header),
  // for a single employee, already selected by the admin/manager in
  // Payroll.tsx before upload (so this endpoint never has to guess *who*
  // the card belongs to — just what it says).
  app.post("/api/ocr-timecard", async (req, res) => {
    const { images, expectedEmployeeName } = req.body as {
      images?: { imageBase64: string; mimeType?: string }[];
      expectedEmployeeName?: string;
    };
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (!anthropicKey) {
      return res.status(500).json({ success: false, error: "OCR service not configured" });
    }
    if (!images || !images.length) {
      return res.status(400).json({ success: false, error: "No image provided" });
    }

    try {
      const normalizedImages = await Promise.all(
        images.map(img => normalizeImageForVision(img.imageBase64, img.mimeType))
      );
      const imageBlocks = normalizedImages.map(img => ({
        type: "image",
        source: { type: "base64", media_type: img.media_type, data: img.data }
      }));

      const promptText = `You are reading a Vertex mechanical time-clock punch card from a Thai restaurant. You may be given one or two photos — the front of the card (blue header, days 1-15) and/or the back (orange header, days 16-31) — both belong to the SAME employee.

Card layout:
- Header fields, usually handwritten in blue pen: เลขที่/NO. (employee number, often blank), ชื่อ/NAME, แผนก/DEPT. (often used for job position/title instead), and sometimes a handwritten month/period label.
- A grid with one row per day of the month (วันที่ = day number 1-31). Columns, left to right: ก่อนเที่ยง (before noon) with เข้า (time in) / ออก (time out); หลังเที่ยง (after noon) with เข้า / ออก; ล่วงเวลา (overtime) with เข้า / ออก.
- Times are mechanically stamped by the clock in HH:MM 24-hour format (may appear in red or black ink, sometimes smudged or partially cut off — do your best, and if truly unreadable leave that field as an empty string rather than guessing).
- Some day rows show a handwritten code instead of stamped times: "CD" (a shift swap with a coworker — the employee worked a different day instead) or "OFF" (a scheduled day off). When you see one of these, set that day's "status" field and leave the time fields for that half of the day empty.
- Some days have handwritten marks in blue pen near or over a stamped time — e.g. "+2", "-2", a replacement time like "1400", or a short handwritten note (sometimes in Thai, e.g. about a doctor's visit). Capture these VERBATIM as plain text in that day's "note" field. Do NOT use them to adjust or recalculate any time field — just record what's written.
- A day row with no stamps and no handwriting at all (nothing has happened yet, e.g. future days) should just have all time fields as empty strings and status "".

${expectedEmployeeName ? `The employee this card should belong to is "${expectedEmployeeName}" — read whatever name is actually written on the card regardless, and report it in cardNameRaw as-is (do not force it to match).` : ""}

Return ONLY valid JSON, no markdown fences, no extra text, in exactly this shape:
{
  "cardNameRaw": "whatever is handwritten in the NAME field, as-is",
  "cardPositionRaw": "whatever is handwritten in the DEPT/position field, as-is",
  "periodLabel": "any handwritten month/period label on the card, as-is, or empty string",
  "days": [
    { "day": 1, "amIn": "08:46", "amOut": "18:09", "pmIn": "", "pmOut": "", "otIn": "", "otOut": "", "status": "", "note": "" }
  ]
}
Rules:
- Include an entry for every day that has ANY data on either photo (stamped time, CD, OFF, or a handwritten note) — you do not need to include fully blank future days.
- "status" is either "CD", "OFF", or "" — never put CD/OFF in a time field.
- If both photos were provided, merge them into one "days" array covering the full month (front photo = days 1-15, back = days 16-31), sorted by day number ascending.
- Return ONLY the JSON object, nothing else.`;

      const claudeResp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 4096,
          messages: [{
            role: "user",
            content: [...imageBlocks, { type: "text", text: promptText }]
          }]
        })
      });

      const claudeData = await claudeResp.json() as any;
      const claudeText = claudeData?.content?.[0]?.text || "{}";
      const clean = claudeText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      let parsed: any = {};
      try { parsed = JSON.parse(clean); } catch(e) { console.error("TIMECARD_JSON_PARSE_ERR:", e); }

      return res.json({ success: true, data: parsed });
    } catch (error) {
      console.error("Timecard OCR error:", error);
      return res.status(500).json({ success: false, error: "Failed to process time card" });
    }
  });

  // ── LINE Messaging API Webhook ────────────────────────────────────
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

  function verifyLineSignature(body: string, signature: string): boolean {
    if (!LINE_CHANNEL_SECRET) return false;
    const hmacLib = require("crypto");
    const hmac = hmacLib.createHmac("sha256", LINE_CHANNEL_SECRET);
    hmac.update(body);
    const expected = hmac.digest("base64");
    return expected === signature;
  }

  app.get("/api/line-webhook", (_req, res) => {
    res.status(200).send("OK");
  });

  // Sends a reply into the chat the triggering event came from. Free (unlike
  // /api/line-push, which uses the metered push API) but only usable once,
  // within the request/response cycle for that event's replyToken.
  async function replyLineMessage(replyToken: string | undefined, messages: any[]) {
    const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN || "";
    if (!accessToken || !replyToken) return;
    try {
      const resp = await fetch("https://api.line.me/v2/bot/message/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
        body: JSON.stringify({ replyToken, messages })
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        console.error("LINE reply error:", errData);
      }
    } catch (err) {
      console.error("LINE reply exception:", err);
    }
  }

  // Pushes messages into a user's chat as the bot (metered push API, unlike
  // replyLineMessage's free reply). Used for the order-confirmation Flex
  // Message: liff.sendMessages() (client-side, "on behalf of the user")
  // only allows URI actions on Flex/template message buttons — LINE rejects
  // postback actions there with INVALID_MESSAGE. A bot-sent push message has
  // no such restriction, so the Confirm/Edit/Cancel Flex Message is pushed
  // here instead of sent from the LIFF app.
  async function pushLineMessages(lineUserId: string, messages: any[]) {
    const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN || "";
    if (!accessToken || !lineUserId) return { success: false, error: "Missing access token or lineUserId" };
    try {
      const resp = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
        body: JSON.stringify({ to: lineUserId, messages })
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        console.error("LINE push error:", errData);
        return { success: false, error: errData };
      }
      return { success: true };
    } catch (err) {
      console.error("LINE push exception:", err);
      return { success: false, error: String(err) };
    }
  }

  // Builds the order-confirmation Flex Message (summary + Confirm/Edit/Cancel
  // postback buttons) — shared by /api/orders/draft's push and available for
  // reuse (e.g. resending) elsewhere.
  function buildOrderFlexMessage(opts: {
    orderRef: string; orderId: string; total: number;
    items: Array<{ name: string; qty: number; unitPrice: number }>;
    addressText?: string;
    orderNotes?: string;
  }) {
    const itemLines = opts.items
      .map((it) => `${it.qty} × ${it.name} — ฿${it.unitPrice * it.qty}`)
      .join("\n");
    const bodyContents: any[] = [
      { type: "text", text: itemLines, wrap: true, size: "sm" },
      { type: "separator", margin: "md" },
      { type: "text", text: `Total ฿${opts.total}`, weight: "bold", size: "md", margin: "md" },
      // Address is optional (pickup / phone-in orders leave it blank) - say
      // so explicitly rather than the old "Address to confirm", which read
      // as if one was always expected.
      { type: "text", text: `Delivery: ${opts.addressText || "No address provided"}`, wrap: true, size: "xs", color: "#5A5A40", margin: "sm" }
    ];
    if (opts.orderNotes && opts.orderNotes.trim()) {
      bodyContents.push({ type: "text", text: `Notes: ${opts.orderNotes.trim()}`, wrap: true, size: "xs", color: "#5A5A40", margin: "sm" });
    }
    bodyContents.push({ type: "text", text: `Order ref: ${opts.orderRef}`, size: "xs", color: "#999999", margin: "sm" });
    return {
      type: "flex",
      altText: `Your Cajun Life order #${opts.orderRef} — ฿${opts.total}`,
      contents: {
        type: "bubble",
        header: {
          type: "box",
          layout: "vertical",
          contents: [{ type: "text", text: "🥗 Your Cajun Life Order", weight: "bold", size: "lg", color: "#A64B2A" }]
        },
        body: {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: bodyContents
        }
      }
    };
  }

  // logActivity() (src/utils/logger.ts) is client-side only — it reads
  // auth.currentUser, which doesn't exist for server-driven events like a
  // customer tapping Confirm in LINE. This is the server-side equivalent,
  // writing directly to the same system_logs collection/shape.
  async function logServerActivity(action: string, details: string, category: string) {
    try {
      await adminDb.collection("system_logs").add({
        action,
        details,
        category,
        userEmail: "line-bot@system",
        userId: "line-webhook",
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to log server activity:", err);
    }
  }

  // Handles a postback from the order-confirmation Flex Message the LIFF
  // ordering app sends into the chat via liff.sendMessages(). Expected
  // postback.data shape: "action=confirm_order&id=<delivery_orders docId>"
  // (also cancel_order / edit_order).
  async function handleOrderPostback(data: string, replyToken: string | undefined) {
    const params = new URLSearchParams(data);
    const action = params.get("action");
    const orderId = params.get("id");
    if (!action || !orderId) return;

    const orderDocRef = adminDb.collection("delivery_orders").doc(orderId);
    const snap = await orderDocRef.get();
    if (!snap.exists) {
      await replyLineMessage(replyToken, [{ type: "text", text: "Sorry, we couldn't find that order — please tap Order Food to start again." }]);
      return;
    }
    const order = snap.data() as any;
    const now = new Date().toISOString();

    if (action === "confirm_order") {
      if (order.status !== "draft") {
        await replyLineMessage(replyToken, [{ type: "text", text: `Order #${order.orderRef} is already ${order.status}.` }]);
        return;
      }
      await orderDocRef.update({
        status: "confirmed",
        updatedAt: now,
        statusHistory: [...(order.statusHistory || []), { status: "confirmed", at: now }]
      });
      await logServerActivity("Delivery Order Confirmed", `Order #${order.orderRef} confirmed by customer via LINE`, "delivery");
      await replyLineMessage(replyToken, [{
        type: "text",
        text: `✅ Order #${order.orderRef} confirmed!\nWe're preparing your food.\nEstimated delivery: 35–45 minutes.`
      }]);
    } else if (action === "cancel_order") {
      if (order.status !== "draft" && order.status !== "confirmed") {
        await replyLineMessage(replyToken, [{ type: "text", text: `Order #${order.orderRef} can't be cancelled — it's already ${order.status}.` }]);
        return;
      }
      await orderDocRef.update({
        status: "cancelled",
        updatedAt: now,
        statusHistory: [...(order.statusHistory || []), { status: "cancelled", at: now }]
      });
      await logServerActivity("Delivery Order Cancelled", `Order #${order.orderRef} cancelled by customer via LINE`, "delivery");
      await replyLineMessage(replyToken, [{ type: "text", text: `Order #${order.orderRef} has been cancelled. Let us know if you'd like to order again!` }]);
    } else if (action === "edit_order") {
      // No state change — the draft is left as-is (harmless if abandoned;
      // the dispatch view only ever queries non-draft orders) and we just
      // point the customer back to the ordering flow.
      await replyLineMessage(replyToken, [{ type: "text", text: `No problem — tap "Order Food" again to make changes to order #${order.orderRef}.` }]);
    }
  }

  app.post("/api/line-webhook", async (req, res) => {
    res.status(200).json({ status: "ok" });

    const signature = req.headers["x-line-signature"] as string | undefined;
    const rawBody = (req as any).rawBody as Buffer | undefined;
    if (LINE_CHANNEL_SECRET) {
      if (!signature || !rawBody || !verifyLineSignature(rawBody.toString("utf8"), signature)) {
        console.error("LINE webhook: signature verification failed");
        return;
      }
    }

    const events = req.body?.events || [];
    for (const event of events) {
      try {
        const userId = event.source?.userId;
        if (userId) console.log(`LINE user ID: ${userId}`);

        if (event.type === "postback" && event.postback?.data) {
          await handleOrderPostback(event.postback.data, event.replyToken);
        }
      } catch (err) {
        console.error("LINE webhook event handling error:", err);
      }
    }
  });

  // ── Delivery Orders (LINE structured ordering) ──────────────────────
  // Created by the LIFF/MINI App ordering page once the customer taps
  // "Review Order" — see cajun-line-ordering-spec.md. There's no Firebase
  // Auth session for a LINE customer, so this has to be a public server
  // endpoint writing via the Admin SDK, same pattern as /api/activate/:token
  // and the loyalty signup endpoint above.
  function generateOrderRef(): string {
    const n = Math.floor(10000 + Math.random() * 90000);
    return `CJL-${n}`;
  }

  app.post("/api/orders/draft", async (req, res) => {
    try {
      const { lineUserId, items, deliveryAddress, notes } = req.body || {};
      if (!lineUserId || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, error: "lineUserId and at least one item are required" });
      }
      const total = items.reduce((sum: number, it: any) => sum + (Number(it.unitPrice) || 0) * (Number(it.qty) || 1), 0);

      // Match an existing CRM customer by lineUserId (set by the LINE Login
      // activation flow) so the order can be linked to their loyalty/history.
      let customerId: string | null = null;
      const custSnap = await adminDb.collection("crm_customers").where("lineUserId", "==", lineUserId).limit(1).get();
      if (!custSnap.empty) customerId = custSnap.docs[0].id;

      // Save the address for next time, kept in fields separate from the
      // CRM's own registered address/deliveryNotes so an in-store
      // registration is never silently overwritten by a one-off LINE order
      // address - GET /api/customer/by-line prefers these when present.
      // Only bother when an address was actually given; skip entirely for a
      // blank/pickup order rather than saving nothing over something.
      const addressToSave = (deliveryAddress?.addressText || "").trim();
      if (addressToSave) {
        const now2 = new Date().toISOString();
        const lastOrderFields = {
          lastOrderAddress: addressToSave,
          lastOrderDeliveryNotes: deliveryAddress?.notes || "",
          lastOrderAt: now2
        };
        if (customerId) {
          await adminDb.collection("crm_customers").doc(customerId).update(lastOrderFields);
        } else {
          // No CRM record yet for this LINE user - create a minimal one
          // purely so the address can be reused next time. Mirrors the
          // shape CRMDirectory.tsx/the loyalty-signup endpoint create,
          // since CRMDirectory's list view assumes firstName/lastName exist.
          const stubRef = await adminDb.collection("crm_customers").add({
            firstName: "",
            lastName: "",
            email: "",
            mobile: "",
            notes: "Auto-created from a LINE order",
            status: "active",
            lineUserId,
            address: "",
            deliveryLat: null,
            deliveryLng: null,
            deliveryNotes: "",
            ...lastOrderFields,
            totalSpend: 0,
            uid: "line-order",
            createdAt: now2,
            updatedAt: now2
          });
          customerId = stubRef.id;
        }
      }

      const orderRef = generateOrderRef();
      const now = new Date().toISOString();
      const docRef = await adminDb.collection("delivery_orders").add({
        orderRef,
        lineUserId,
        customerId,
        items,
        total,
        deliveryAddress: deliveryAddress || null,
        notes: notes || "",
        status: "confirmed",
        orderSource: "line_structured",
        driverName: null,
        createdAt: now,
        updatedAt: now,
        statusHistory: [{ status: "confirmed", at: now }]
      });

      // Push the order summary Flex Message (no action buttons — orders
      // auto-confirm on submission, there's no separate confirm/edit/cancel
      // step) as the bot, not via liff.sendMessages() from the client — see
      // pushLineMessages()'s comment for why. Failure here doesn't fail the
      // request (the order was created successfully either way) but is
      // surfaced to the client so the LIFF app can tell the customer.
      const flexMessage = buildOrderFlexMessage({
        orderRef,
        orderId: docRef.id,
        total,
        items,
        addressText: deliveryAddress?.addressText,
        orderNotes: notes
      });
      const pushResult = await pushLineMessages(lineUserId, [flexMessage]);
      if (!pushResult.success) {
        console.error("Order draft created but push failed:", pushResult.error);
      }

      return res.json({ success: true, orderId: docRef.id, orderRef, total, messagePushed: pushResult.success });
    } catch (err) {
      console.error("Create draft order error:", err);
      return res.status(500).json({ success: false, error: "Failed to create draft order" });
    }
  });

  // Lookup used by the ordering page to prefill a returning customer's saved
  // delivery address. Public (no Firebase Auth session exists for a LINE
  // customer), so this deliberately returns only the address/name fields —
  // never balance, totalSpend, email, or anything else on the crm_customers doc.
  app.get("/api/customer/by-line/:lineUserId", async (req, res) => {
    try {
      const { lineUserId } = req.params;
      const snap = await adminDb.collection("crm_customers").where("lineUserId", "==", lineUserId).limit(1).get();
      if (snap.empty) return res.json({ found: false });
      const data = snap.docs[0].data();
      return res.json({
        found: true,
        firstName: data.firstName || "",
        address: data.address || "",
        deliveryLat: data.deliveryLat ?? null,
        deliveryLng: data.deliveryLng ?? null,
        deliveryNotes: data.deliveryNotes || "",
        // From their last LINE order, if any - kept separate from the CRM's
        // own address fields above; the client prefers these when present.
        lastOrderAddress: data.lastOrderAddress || "",
        lastOrderDeliveryNotes: data.lastOrderDeliveryNotes || ""
      });
    } catch (err) {
      console.error("Customer lookup by lineUserId error:", err);
      return res.status(500).json({ found: false, error: "Server error" });
    }
  });

  // ── LINE Login Activation ─────────────────────────────────────────
  const LINE_LOGIN_CHANNEL_ID = process.env.LINE_LOGIN_CHANNEL_ID || "";
  const LINE_LOGIN_CHANNEL_SECRET = process.env.LINE_LOGIN_CHANNEL_SECRET || "";
  const ACTIVATION_BASE_URL = "https://cajunlifecafe.com";

  app.get("/api/activate/:token", async (req, res) => {
    const { token } = req.params;
    try {
      const snap = await adminDb.collection("activation_tokens")
        .where("token", "==", token)
        .limit(1)
        .get();
      if (snap.empty) return res.status(404).json({ error: "Invalid or expired link" });
      const data = snap.docs[0].data();
      if (data.used) return res.status(400).json({ error: "This link has already been used" });
      return res.json({ valid: true, firstName: data.firstName, lastName: data.lastName });
    } catch (err: any) {
      console.error("Activation token lookup error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/activate/:token/line-login", (req, res) => {
    const { token } = req.params;
    const state = token;
    const callbackUrl = `${ACTIVATION_BASE_URL}/activate/callback`;
    const lineLoginUrl = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${LINE_LOGIN_CHANNEL_ID}&redirect_uri=${encodeURIComponent(callbackUrl)}&state=${state}&scope=profile`;
    res.redirect(lineLoginUrl);
  });

  app.get("/activate/callback", async (req, res) => {
    const { code, state: activationToken } = req.query as { code: string; state: string };
    if (!code || !activationToken) {
      return res.redirect(`/activate/error?msg=Missing+parameters`);
    }
    try {
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
        return res.redirect(`/activate/error?msg=LINE+login+failed`);
      }

      const profileResp = await fetch("https://api.line.me/v2/profile", {
        headers: { "Authorization": `Bearer ${tokenData.access_token}` }
      });
      const profile = await profileResp.json() as any;
      const lineUserId = profile.userId;
      if (!lineUserId) return res.redirect(`/activate/error?msg=Could+not+get+LINE+ID`);

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
        return res.redirect(`/activate/error?msg=Invalid+activation+token`);
      }

      await adminDb.collection("crm_customers").doc(crmCustomerId).update({
        lineUserId,
        updatedAt: new Date().toISOString()
      });
      await tokenDocRef.update({ used: true, usedAt: new Date().toISOString(), lineUserId });

      return res.redirect(`/activate/success`);
    } catch (err) {
      console.error("LINE Login callback error:", err);
      return res.redirect(`/activate/error?msg=Server+error`);
    }
  });

  // ── Notification Email Helper ─────────────────────────────────────
  async function sendNotificationEmail(subject: string, html: string, replyTo?: string): Promise<boolean> {
    const smtpHost = process.env.SMTP_HOST || "";
    const smtpPort = parseInt(process.env.SMTP_PORT || "587");
    const smtpUser = process.env.SMTP_USER || "";
    const smtpPass = process.env.SMTP_PASS || "";
    if (!smtpHost || !smtpUser || !smtpPass) {
      console.error("Notification email: SMTP not configured");
      return false;
    }
    try {
      const nodemailer = require("nodemailer");
      const transporter = nodemailer.createTransport({ host: smtpHost, port: smtpPort, secure: false, auth: { user: smtpUser, pass: smtpPass } });
      await transporter.sendMail({
        from: `"Cajun Life Cafe" <${smtpUser}>`,
        to: "info@cajunlifecafe.com",
        subject,
        html,
        ...(replyTo ? { replyTo } : {})
      });
      return true;
    } catch (err) {
      console.error("Notification email error:", err);
      return false;
    }
  }

  const escapeHtml = (s: any) => String(s || "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] as string));

  // ── Loyalty Signup ────────────────────────────────────────────────
  app.post("/api/loyalty-signup", async (req, res) => {
    const { firstName, lastName, email, mobile, website } = req.body || {};
    if (website) return res.json({ success: true });
    if (!firstName?.trim() || !lastName?.trim() || !mobile?.trim()) {
      return res.status(400).json({ success: false, error: "Name and mobile number are required" });
    }
    const digits = String(mobile).replace(/[\s\-()]/g, "");
    let fullMobile = digits;
    if (digits.startsWith("0")) fullMobile = `+66${digits.slice(1)}`;
    else if (!digits.startsWith("+")) fullMobile = `+66${digits}`;
    if (!/^\+\d{8,15}$/.test(fullMobile)) {
      return res.status(400).json({ success: false, error: "Please enter a valid mobile number" });
    }

    try {
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

      sendNotificationEmail(
        `New Loyalty Signup — ${escapeHtml(firstName)} ${escapeHtml(lastName)}`,
        `<div style="font-family:Arial,sans-serif;max-width:560px">
          <h2 style="color:#A64B2A;margin-bottom:4px">New Loyalty Member Signup</h2>
          <table style="border-collapse:collapse">
            <tr><td style="padding:6px 16px 6px 0;color:#999">Name</td><td style="padding:6px 0;font-weight:700">${escapeHtml(firstName)} ${escapeHtml(lastName)}</td></tr>
            <tr><td style="padding:6px 16px 6px 0;color:#999">Mobile</td><td style="padding:6px 0">${escapeHtml(fullMobile)}</td></tr>
            <tr><td style="padding:6px 16px 6px 0;color:#999">Email</td><td style="padding:6px 0">${escapeHtml(email) || "&ndash;"}</td></tr>
          </table>
        </div>`,
        String(email || "").trim() || undefined
      ).catch(() => {});

      return res.json({ success: true, activationUrl: `${ACTIVATION_BASE_URL}/activate/${token}` });
    } catch (err) {
      console.error("Loyalty signup error:", err);
      return res.status(500).json({ success: false, error: "Server error — please try again" });
    }
  });

  // ── Contact Form ──────────────────────────────────────────────────
  app.post("/api/contact", async (req, res) => {
    const { name, email, phone, message, website } = req.body || {};
    if (website) return res.json({ success: true });
    if (!name?.trim() || !message?.trim()) {
      return res.status(400).json({ success: false, error: "Please tell us your name and a message" });
    }
    if (!email?.trim() && !phone?.trim()) {
      return res.status(400).json({ success: false, error: "Please give us an email or phone number so we can reply" });
    }
    if (String(message).length > 5000) {
      return res.status(400).json({ success: false, error: "Message is too long" });
    }

    const html = `<div style="font-family:Arial,sans-serif;max-width:560px">
      <h2 style="color:#A64B2A;margin-bottom:4px">Website Contact Message</h2>
      <table style="border-collapse:collapse">
        <tr><td style="padding:6px 16px 6px 0;color:#999">Name</td><td style="padding:6px 0;font-weight:700">${escapeHtml(name)}</td></tr>
        <tr><td style="padding:6px 16px 6px 0;color:#999">Email</td><td style="padding:6px 0">${escapeHtml(email) || "&ndash;"}</td></tr>
        <tr><td style="padding:6px 16px 6px 0;color:#999">Phone</td><td style="padding:6px 0">${escapeHtml(phone) || "&ndash;"}</td></tr>
      </table>
      <p style="white-space:pre-wrap;background:#f7f7f7;padding:16px;border-radius:8px;color:#333">${escapeHtml(message)}</p>
    </div>`;

    const sent = await sendNotificationEmail(`Website Contact — ${escapeHtml(name)}`, html, String(email || "").trim() || undefined);
    if (!sent) {
      return res.status(500).json({ success: false, error: "Could not send your message — please try again later" });
    }

    adminDb.collection("system_logs").add({
      action: "Contact Message",
      details: `Website contact from ${String(name).trim()} (${String(email || phone).trim()}): ${String(message).trim().slice(0, 200)}`,
      category: "system",
      userEmail: "contact-form",
      userId: "contact-form",
      timestamp: new Date().toISOString(),
    }).catch(() => {});

    return res.json({ success: true });
  });

  // ── Customer Feedback ─────────────────────────────────────────────
  app.post("/api/feedback", async (req, res) => {
    const { category, rating, dish, message, name, contact, website } = req.body || {};
    if (website) return res.json({ success: true });
    if (!message?.trim()) {
      return res.status(400).json({ success: false, error: "Please write something — even a few words help." });
    }
    if (String(message).length > 5000) {
      return res.status(400).json({ success: false, error: "Message is too long." });
    }

    const categoryLabels: Record<string, string> = {
      overall: "Overall Experience",
      dish: "Specific Dish",
      suggestion: "Suggestion",
      complaint: "Complaint",
    };
    const categoryLabel = categoryLabels[category] || category || "General";
    const ratingStars = (category === "overall" && rating) ? "⭐".repeat(Number(rating)) : "";

    const html = `<div style="font-family:Arial,sans-serif;max-width:600px">
      <h2 style="color:#A64B2A;margin-bottom:4px">Customer Feedback — ${categoryLabel}</h2>
      ${ratingStars ? `<p style="font-size:20px;margin:4px 0 12px">${ratingStars}</p>` : ""}
      <table style="border-collapse:collapse;margin-bottom:12px">
        ${dish ? `<tr><td style="padding:4px 16px 4px 0;color:#999">Dish</td><td style="padding:4px 0;font-weight:700">${escapeHtml(dish)}</td></tr>` : ""}
        <tr><td style="padding:4px 16px 4px 0;color:#999">Name</td><td style="padding:4px 0">${escapeHtml(name) || "<em>Anonymous</em>"}</td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#999">Contact</td><td style="padding:4px 0">${escapeHtml(contact) || "<em>Not provided</em>"}</td></tr>
      </table>
      <p style="white-space:pre-wrap;background:#f7f7f7;padding:16px;border-radius:8px;color:#333;font-size:15px">${escapeHtml(message)}</p>
      ${contact ? `<p style="color:#A64B2A;font-size:13px">💡 This person left contact details — consider the ฿300 voucher if the feedback is valuable.</p>` : ""}
    </div>`;

    const sent = await sendNotificationEmail(
      `Feedback: ${categoryLabel}${name ? ` from ${escapeHtml(name)}` : " (anonymous)"}`,
      html
    );
    if (!sent) {
      return res.status(500).json({ success: false, error: "Could not send your feedback — please try again later." });
    }

    adminDb.collection("system_logs").add({
      action: "Customer Feedback",
      details: `${categoryLabel}${name ? ` from ${String(name).trim()}` : " (anonymous)"}: ${String(message).trim().slice(0, 200)}`,
      category: "system",
      userEmail: "feedback-form",
      userId: "feedback-form",
      timestamp: new Date().toISOString(),
    }).catch(() => {});

    return res.json({ success: true });
  });

  // ── LINE Push Message ─────────────────────────────────────────────
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
        return res.json({ success: true });
      } else {
        return res.status(500).json({ success: false, error: pushData.message, detail: pushData });
      }
    } catch (error) {
      console.error("LINE push exception:", error);
      return res.status(500).json({ success: false, error: "Failed to send LINE message" });
    }
  });

  // ── Loyalty Digest ────────────────────────────────────────────────
  async function sendLoyaltyDigest(): Promise<{ sent: boolean; entries: number; error?: string }> {
    const smtpHost = process.env.SMTP_HOST || "";
    const smtpPort = parseInt(process.env.SMTP_PORT || "587");
    const smtpUser = process.env.SMTP_USER || "";
    const smtpPass = process.env.SMTP_PASS || "";
    if (!smtpHost || !smtpUser || !smtpPass) return { sent: false, entries: 0, error: "SMTP not configured" };

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
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

    const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f7f7f7;padding:30px"><div style="max-width:700px;margin:0 auto;background:#fff;border-radius:12px">
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
        <p style="color:#333;font-weight:700">${members.length} enrolled members · Total outstanding: ฿${totalBalance.toLocaleString()}</p>
        <table width="100%" style="border-collapse:collapse;border:1px solid #eee">
          <thead><tr style="background:#f9f9f9">
            <th style="padding:10px;text-align:left;color:#666;font-size:12px">Customer</th>
            <th style="padding:10px;text-align:left;color:#666;font-size:12px">Mobile</th>
            <th style="padding:10px;text-align:right;color:#666;font-size:12px">Balance</th>
            <th style="padding:10px;text-align:center;color:#666;font-size:12px">LINE</th>
          </tr></thead>
          <tbody>${balanceRows}</tbody>
        </table>
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

  // ── Careers Application ───────────────────────────────────────────
  const cvUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
      cb(null, allowed.includes(file.mimetype));
    }
  });

  app.post("/api/careers", cvUpload.single("cv"), async (req, res) => {
    const { name, email, role, experience, website } = req.body || {};
    const cvFile = req.file;
    if (website) return res.json({ success: true });
    if (!name?.trim() || !email?.trim()) {
      return res.status(400).json({ success: false, error: "Name and email are required" });
    }

    const smtpHost = process.env.SMTP_HOST || "";
    const smtpPort = parseInt(process.env.SMTP_PORT || "587");
    const smtpUser = process.env.SMTP_USER || "";
    const smtpPass = process.env.SMTP_PASS || "";
    if (!smtpHost || !smtpUser || !smtpPass) {
      return res.status(500).json({ success: false, error: "Mail service not configured" });
    }

    const html = `<div style="font-family:Arial,sans-serif;max-width:560px">
      <h2 style="color:#A64B2A;margin-bottom:4px">New Job Application</h2>
      <table style="border-collapse:collapse">
        <tr><td style="padding:6px 16px 6px 0;color:#999">Name</td><td style="padding:6px 0;font-weight:700">${escapeHtml(name)}</td></tr>
        <tr><td style="padding:6px 16px 6px 0;color:#999">Email</td><td style="padding:6px 0">${escapeHtml(email)}</td></tr>
        <tr><td style="padding:6px 16px 6px 0;color:#999">Role</td><td style="padding:6px 0">${escapeHtml(role) || "&ndash;"}</td></tr>
      </table>
      ${experience ? `<p style="white-space:pre-wrap;background:#f7f7f7;padding:16px;border-radius:8px;color:#333">${escapeHtml(experience)}</p>` : ""}
      ${cvFile ? `<p>CV attached: <strong>${escapeHtml(cvFile.originalname)}</strong></p>` : ""}
    </div>`;

    try {
      const nodemailer = require("nodemailer");
      const transporter = nodemailer.createTransport({ host: smtpHost, port: smtpPort, secure: false, auth: { user: smtpUser, pass: smtpPass } });
      await transporter.sendMail({
        from: `"Cajun Life Cafe" <${smtpUser}>`,
        to: "info@cajunlifecafe.com",
        replyTo: String(email).trim(),
        subject: `Job Application — ${escapeHtml(name)}${role ? ` (${escapeHtml(role)})` : ""}`,
        html,
        ...(cvFile ? { attachments: [{ filename: cvFile.originalname, content: cvFile.buffer, contentType: cvFile.mimetype }] } : {})
      });

      adminDb.collection("system_logs").add({
        action: "Careers Application",
        details: `Application from ${String(name).trim()} <${String(email).trim()}>${role ? ` — ${String(role).trim()}` : ""}`,
        category: "system",
        userEmail: "careers-page",
        userId: "careers-page",
        timestamp: new Date().toISOString(),
      }).catch(() => {});

      return res.json({ success: true });
    } catch (err) {
      console.error("Careers application email error:", err);
      return res.status(500).json({ success: false, error: "Could not send your application — please try again later" });
    }
  });

  // ── Serve React app ───────────────────────────────────────────────
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
