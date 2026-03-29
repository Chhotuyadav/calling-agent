require("dotenv").config();
const express = require("express");
const path = require("path");
const { WebSocketServer } = require("ws");
const { handleSocketConnection } = require("./src/ws/socketHandler");
const { handleTwilioConnection } = require("./src/twilio/twilioHandler");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: false }));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Twilio webhook - when a call comes in
app.post("/incoming-call", (req, res) => {
  const callerNumber = req.body.From || "unknown";
  console.log(`📞 Incoming call from: ${callerNumber}`);

  const host = req.headers.host;
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${host}/twilio-stream">
      <Parameter name="callerNumber" value="${callerNumber}"/>
    </Stream>
  </Connect>
</Response>`;

  res.type("text/xml").send(twiml);
});

const server = app.listen(port, () => {
  console.log(`🚀 Server running: http://localhost:${port}`);
});

const wss = new WebSocketServer({ server, path: "/ws" });
const twilioWss = new WebSocketServer({ server, path: "/twilio-stream" });

wss.on("connection", (ws) => {
  console.log("🔌 Browser client connected");
  handleSocketConnection(ws);
});

twilioWss.on("connection", (ws) => {
  handleTwilioConnection(ws);
});
