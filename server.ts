import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fetch from "node-fetch";
import fs from "fs";
import sharp from "sharp";
import nodemailer from "nodemailer";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for base64 images
  app.use(express.json({ limit: '10mb' }));

  // Serve public assets with logging for debugging
  const publicDir = path.join(process.cwd(), 'public');
  
  // Explicit route for menu images to ensure they are served correctly
  app.get('/menu-items/:filename', (req, res, next) => {
    const filePath = path.join(publicDir, 'menu-items', req.params.filename);
    if (fs.existsSync(filePath)) {
      console.log(`Serving menu item image: ${req.params.filename}`);
      return res.sendFile(filePath);
    }
    next();
  });

  app.get('/menu/:filename', (req, res, next) => {
    const filePath = path.join(publicDir, 'menu', req.params.filename);
    if (fs.existsSync(filePath)) {
      console.log(`Serving menu image: ${req.params.filename}`);
      return res.sendFile(filePath);
    }
    next();
  });

  app.get('/logo.png', (req, res) => {
    const filePath = path.join(publicDir, 'logo.png');
    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath);
    }
    res.status(404).send('Not found');
  });

  app.use(express.static(publicDir));

  // API routes
  app.post("/api/save-hero", async (req, res) => {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: "No image data provided" });
    }

    try {
      // Extract base64 data
      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, 'base64');

      const publicDir = path.join(process.cwd(), 'public');
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }

      const outputPath = path.join(publicDir, 'hero.webp');
      
      await sharp(buffer)
        .webp({ quality: 85 })
        .toFile(outputPath);

      console.log(`Hero image saved to ${outputPath}`);
      res.json({ success: true, url: "/hero.webp" });
    } catch (error) {
      console.error("Error saving hero image:", error);
      res.status(500).json({ error: "Failed to save hero image" });
    }
  });

  app.get("/api/place-details/:placeId", async (req, res) => {
    const { placeId } = req.params;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ 
        status: 'REQUEST_DENIED', 
        error_message: "Google Maps API Key is not configured on the server. Please add GOOGLE_MAPS_API_KEY to your secrets in the AI Studio settings." 
      });
    }

    try {
      console.log(`Fetching details for Place ID: ${placeId}`);
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,formatted_phone_number,opening_hours,rating,user_ratings_total,website,url,reviews&key=${apiKey}`
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Google API responded with status ${response.status}: ${errorText}`);
        return res.status(response.status).json({ 
          status: 'ERROR', 
          error_message: `Google API error: ${response.statusText}` 
        });
      }

      const data = await response.json() as any;
      console.log(`Google API Response Status: ${data.status}`);
      
      if (data.status !== 'OK') {
        console.error(`Google API returned non-OK status: ${data.status}`, data.error_message);
      }

      res.json(data);
    } catch (error) {
      console.error("Error fetching from Google Places API:", error);
      res.status(500).json({ 
        status: 'ERROR', 
        error_message: "Internal server error while fetching place details from Google." 
      });
    }
  });

  app.post("/api/send-otp", async (req, res) => {
    const { to } = req.body;
    const accountSid = process.env.VITE_TWILIO_ACCOUNT_SID || process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.VITE_TWILIO_AUTH_TOKEN || process.env.TWILIO_AUTH_TOKEN;
    const verifyServiceSid = process.env.VITE_TWILIO_VERIFY_SERVICE_SID || process.env.TWILIO_VERIFY_SERVICE_SID;

    if (!accountSid || !authToken || !verifyServiceSid) {
      return res.status(500).json({ success: false, error: "Twilio Verify credentials not configured" });
    }

    try {
      const url = `https://verify.twilio.com/v2/Services/${verifyServiceSid}/Verifications`;
      const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
      
      const params = new URLSearchParams();
      params.append('To', to);
      params.append('Channel', 'sms');

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      if (!response.ok) {
        const errorData = await response.json() as any;
        return res.status(response.status).json({ success: false, error: errorData.message || response.statusText });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Twilio Verify error:", error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Internal server error" });
    }
  });

  app.post("/api/verify-otp", async (req, res) => {
    const { to, code } = req.body;
    const accountSid = process.env.VITE_TWILIO_ACCOUNT_SID || process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.VITE_TWILIO_AUTH_TOKEN || process.env.TWILIO_AUTH_TOKEN;
    const verifyServiceSid = process.env.VITE_TWILIO_VERIFY_SERVICE_SID || process.env.TWILIO_VERIFY_SERVICE_SID;

    if (!accountSid || !authToken || !verifyServiceSid) {
      return res.status(500).json({ success: false, error: "Twilio Verify credentials not configured" });
    }

    try {
      const url = `https://verify.twilio.com/v2/Services/${verifyServiceSid}/VerificationCheck`;
      const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
      
      const params = new URLSearchParams();
      params.append('To', to);
      params.append('Code', code);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      const data = await response.json() as any;

      if (!response.ok) {
        return res.status(response.status).json({ success: false, error: data.message || response.statusText });
      }

      if (data.status === 'approved') {
        res.json({ success: true });
      } else {
        res.json({ success: false, error: "Invalid verification code" });
      }
    } catch (error) {
      console.error("Twilio Verify check error:", error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Internal server error" });
    }
  });

  app.post("/api/send-sms", async (req, res) => {
    const { to, body } = req.body;
    const accountSid = process.env.VITE_TWILIO_ACCOUNT_SID || process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.VITE_TWILIO_AUTH_TOKEN || process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.VITE_TWILIO_PHONE_NUMBER || process.env.TWILIO_PHONE_NUMBER;
    const messagingServiceSid = process.env.VITE_TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_MESSAGING_SERVICE_SID;

    if (!accountSid || !authToken || (!fromNumber && !messagingServiceSid)) {
      return res.status(500).json({ success: false, error: "Twilio credentials not configured" });
    }

    try {
      const twilio = (await import('twilio')).default;
      const client = twilio(accountSid, authToken);

      const senderId = process.env.VITE_TWILIO_SENDER_ID || process.env.TWILIO_SENDER_ID || "CajunCafe";
      
      console.log(`Attempting to send SMS to ${to}. Configuration: SenderID=${senderId}, FromNumber=${fromNumber}, MessagingService=${messagingServiceSid ? 'YES' : 'NO'}`);
      
      let message;
      try {
        if (messagingServiceSid) {
          console.log(`Using Messaging Service: ${messagingServiceSid}`);
          message = await client.messages.create({
            body: body,
            messagingServiceSid: messagingServiceSid,
            to: to
          });
        } else {
          // Thailand (+66) often requires registration for Alphanumeric Sender IDs.
          // If destination is Thailand and we have a From phone number, prefer it over Alphanumeric ID.
          const usePhoneInsteadOfAlpha = to.startsWith('+66') && fromNumber;
          
          if (usePhoneInsteadOfAlpha) {
            console.log(`Forcing phone number for Thailand destination: ${fromNumber}`);
            message = await client.messages.create({
              body: body,
              from: fromNumber,
              to: to
            });
          } else {
            console.log(`Using Sender ID: ${senderId}`);
            message = await client.messages.create({
              body: body,
              from: senderId,
              to: to
            });
          }
        }
      } catch (innerError: any) {
        console.warn(`Primary send attempt failed (Code ${innerError.code}): ${innerError.message}`);
        
        // Fallback or specific error handling
        if (innerError.code === 21612 && fromNumber && senderId !== fromNumber) {
          console.log(`Sender ID "${senderId}" not supported for ${to}. Retrying with phone number: ${fromNumber}`);
          message = await client.messages.create({
            body: body,
            from: fromNumber,
            to: to
          });
        } else {
          throw innerError;
        }
      }

      console.log(`SMS sent successfully. SID: ${message.sid}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Twilio SDK error:", error);
      
      let errorMessage = error.message || "Internal Twilio error";
      
      if (error.code === 21612) {
        errorMessage = `Alphanumeric Sender ID is not supported for ${to}. Please use a Twilio Phone Number or Messaging Service with Thailand SMS permissions enabled.`;
      } else if (error.code === 21606) {
         errorMessage = `The 'From' number ${fromNumber} is not a valid sender for the destination ${to}. Please check your Twilio geo-permissions for Thailand.`;
      } else if (error.message.includes("current combination of 'To' and/or 'From'")) {
         errorMessage = `Twilio cannot send this message from ${fromNumber} to ${to}. This usually means SMS Geo-Permissions for Thailand are not enabled in your Twilio Console, or the sender type is not allowed for this destination.`;
      }

      res.status(500).json({ 
        success: false, 
        error: errorMessage,
        code: error.code,
        moreInfo: error.moreInfo || 'https://www.twilio.com/docs/errors/' + error.code
      });
    }
  });

  app.post("/api/contact", async (req, res) => {
    const { name, email, message } = req.body;
    console.log("New Contact Form Submission:");
    console.log(`Name: ${name}`);
    console.log(`Email: ${email}`);
    console.log(`Message: ${message}`);
    
    // SMTP Configuration from environment variables
    const smtpConfig = {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    };

    // Check if SMTP is configured
    if (!smtpConfig.host || !smtpConfig.auth.user || !smtpConfig.auth.pass) {
      console.warn("SMTP is not fully configured. Logging message to console instead of sending email.");
      return res.json({ 
        success: true, 
        message: "Message received (SMTP not configured, logged to console)" 
      });
    }

    try {
      const transporter = nodemailer.createTransport(smtpConfig);

      const mailOptions = {
        from: `"${name}" <${smtpConfig.auth.user}>`, // Use the authenticated user as sender
        to: "info@cajunlifecafe.com",
        replyTo: email,
        subject: `New Contact Form Submission from ${name}`,
        text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
        html: `
          <h3>New Contact Form Submission</h3>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Message:</strong></p>
          <p>${message.replace(/\n/g, '<br>')}</p>
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log("Email sent successfully");
      res.json({ success: true, message: "Message sent successfully" });
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  // Vite middleware for development

    // Gemini AI proxy endpoint — keeps API key server-side only
    app.post("/api/ai", async (req, res) => {
          const { prompt, context } = req.body;
          const apiKey = process.env.GEMINI_API_KEY;
          if (!apiKey) {
                  return res.status(500).json({ error: "Gemini API key not configured on the server." });
          }
          try {
                  const response = await fetch(
                            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
                    {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                              contents: [{ parts: [{ text: context ? `${context}\n\n${prompt}` : prompt }] }],
                                }),
                    }
                          );
                  if (!response.ok) {
                            const errText = await response.text();
                            return res.status(response.status).json({ error: `Gemini API error: ${errText}` });
                  }
                  const data = await response.json() as any;
                  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
                  res.json({ success: true, text });
          } catch (error) {
                  console.error("Gemini proxy error:", error);
                  res.status(500).json({ error: "Internal server error calling Gemini API." });
          }
    });
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

startServer();
