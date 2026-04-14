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
