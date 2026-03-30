require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { WebSocketServer } = require("ws");
const { handleSocketConnection } = require("./src/ws/socketHandler");
const { handleTwilioConnection } = require("./src/twilio/twilioHandler");
const twilio = require("twilio");
const { AccessToken } = twilio.jwt;
const { VoiceGrant } = AccessToken;

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 8000;

const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim());

app.use(cors({ origin: allowedOrigins, methods: ["GET", "POST"] }));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Voice Agent Backend Running" });
});

// Socket.IO for browser clients
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
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

// Token for Twilio browser client
app.get("/token", (req, res) => {
  const identity = req.query.identity || "user";
  const token = new AccessToken(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_API_KEY,
    process.env.TWILIO_API_SECRET,
    { identity }
  );
  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: process.env.TWIML_APP_SID,
    incomingAllow: true,
  });
  token.addGrant(voiceGrant);
  res.json({ token: token.toJwt(), identity });
});

// TwiML for browser outgoing call — connect directly to AI stream
app.post("/twilio/voice", (req, res) => {
  const host = req.headers.host;
  const callerIdentity = req.body.Caller || "browser-user";
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${host}/twilio-stream">
      <Parameter name="callerNumber" value="${callerIdentity}"/>
    </Stream>
  </Connect>
</Response>`;
  res.type("text/xml").send(twiml);
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
