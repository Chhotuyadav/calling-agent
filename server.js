require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { WebSocketServer } = require("ws");
const { handleSocketConnection } = require("./src/ws/socketHandler");
const { handleTwilioConnection } = require("./src/twilio/twilioHandler");

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 8000;

app.use(express.urlencoded({ extended: false }));

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Voice Agent Backend Running" });
});

// Socket.IO for browser clients
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  handleSocketConnection(socket);
});

// Raw WebSocket for Twilio only
const twilioWss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  if (req.url === "/twilio-stream") {
    twilioWss.handleUpgrade(req, socket, head, (ws) => {
      handleTwilioConnection(ws);
    });
  }
  // Socket.IO handles its own upgrades automatically — do NOT call io.engine.handleUpgrade here
});

// Twilio incoming call webhook
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

server.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
