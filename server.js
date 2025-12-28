import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import twilio from "twilio";
import mongoose from "mongoose";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// =====================
// MongoDB
// =====================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connecté"))
  .catch((err) => console.error("❌ MongoDB erreur", err));

// =====================
// Conversation Schema
// =====================
const conversationSchema = new mongoose.Schema({
  from: String,
  messages: [
    {
      role: String,
      content: String,
    },
  ],
});

const Conversation = mongoose.model("Conversation", conversationSchema);

// =====================
// Twilio
// =====================
const twilioClient = twilio(
  process.env.TWILIO_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// =====================
// OpenAI
// =====================
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// =====================
// Webhook WhatsApp
// =====================
app.post("/whatsapp", async (req, res) => {
  try {
    const from = req.body.From;
    const body = req.body.Body;

    let convo = await Conversation.findOne({ from });
    if (!convo) {
      convo = new Conversation({ from, messages: [] });
    }

    convo.messages.push({ role: "user", content: body });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: convo.messages,
    });

    const reply = completion.choices[0].message.content;

    convo.messages.push({ role: "assistant", content: reply });
    await convo.save();

    await twilioClient.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM,
      to: from,
      body: reply,
    });

    res.status(200).send("OK");
  } catch (error) {
    console.error("❌ Erreur WhatsApp IA:", error);
    res.status(500).send("Erreur serveur");
  }
});

// =====================
// Health Check
// =====================
app.get("/", (req, res) => {
  res.send("WhatsApp AI Bot is running 🚀");
});

// =====================
// Start Server
// =====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
