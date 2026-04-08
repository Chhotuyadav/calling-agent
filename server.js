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
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Coming Soon</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0a0a0f;
      font-family: 'Segoe UI', sans-serif;
      overflow: hidden;
    }
    .blob {
      position: fixed;
      border-radius: 50%;
      filter: blur(80px);
      opacity: 0.35;
      animation: float 8s ease-in-out infinite;
    }
    .blob1 { width: 500px; height: 500px; background: #7c3aed; top: -100px; left: -100px; animation-delay: 0s; }
    .blob2 { width: 400px; height: 400px; background: #2563eb; bottom: -80px; right: -80px; animation-delay: 2s; }
    .blob3 { width: 300px; height: 300px; background: #db2777; top: 50%; left: 50%; transform: translate(-50%, -50%); animation-delay: 4s; }
    @keyframes float {
      0%, 100% { transform: translateY(0px) scale(1); }
      50% { transform: translateY(-30px) scale(1.05); }
    }
    .blob3 { animation: float3 8s ease-in-out infinite; animation-delay: 4s; }
    @keyframes float3 {
      0%, 100% { transform: translate(-50%, -50%) scale(1); }
      50% { transform: translate(-50%, calc(-50% - 30px)) scale(1.05); }
    }
    .card {
      position: relative;
      z-index: 10;
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 24px;
      padding: 3rem 3.5rem;
      text-align: center;
      max-width: 480px;
      width: 90%;
      box-shadow: 0 25px 50px rgba(0,0,0,0.4);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.15);
      color: #a78bfa;
      font-size: 0.7rem;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      padding: 0.35rem 1rem;
      border-radius: 999px;
      margin-bottom: 2rem;
    }
    .dot {
      width: 6px; height: 6px;
      background: #22c55e;
      border-radius: 50%;
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(34,197,94,0.4); }
      50% { opacity: 0.6; box-shadow: 0 0 0 6px rgba(34,197,94,0); }
    }
    h1 {
      font-size: 3rem;
      font-weight: 800;
      background: linear-gradient(135deg, #fff 0%, #a78bfa 50%, #60a5fa 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 1rem;
      line-height: 1.1;
    }
    p {
      color: rgba(255,255,255,0.45);
      font-size: 0.95rem;
      line-height: 1.7;
      margin-bottom: 2rem;
    }
    .divider {
      width: 60px;
      height: 2px;
      background: linear-gradient(90deg, #7c3aed, #2563eb);
      border-radius: 999px;
      margin: 0 auto 2rem;
    }
    .notify {
      display: flex;
      gap: 8px;
    }
    .notify input {
      flex: 1;
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 10px;
      padding: 0.65rem 1rem;
      color: white;
      font-size: 0.85rem;
      outline: none;
      transition: border 0.2s;
    }
    .notify input::placeholder { color: rgba(255,255,255,0.3); }
    .notify input:focus { border-color: #7c3aed; }
    .notify button {
      background: linear-gradient(135deg, #7c3aed, #2563eb);
      border: none;
      border-radius: 10px;
      padding: 0.65rem 1.2rem;
      color: white;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .notify button:hover { opacity: 0.85; }
    .timer {
      display: flex;
      justify-content: center;
      gap: 1rem;
      margin-top: 0.5rem;
    }
    .timer-box {
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 12px;
      padding: 0.75rem 1.1rem;
      min-width: 64px;
    }
    .timer-box .num {
      font-size: 1.8rem;
      font-weight: 700;
      color: white;
      line-height: 1;
    }
    .timer-box .label {
      font-size: 0.65rem;
      color: rgba(255,255,255,0.35);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-top: 4px;
    }
  </style>
</head>
<body>
  <div class="blob blob1"></div>
  <div class="blob blob2"></div>
  <div class="blob blob3"></div>
  <div class="card">
    <div class="badge"><span class="dot"></span> In Development</div>
    <h1>Coming<br/>Soon</h1>
    <div class="divider"></div>
    <p>We're crafting something extraordinary.<br/>Stay tuned for the big reveal.</p>
    <div class="timer">
      <div class="timer-box"><div class="num" id="days">00</div><div class="label">Days</div></div>
      <div class="timer-box"><div class="num" id="hours">00</div><div class="label">Hours</div></div>
      <div class="timer-box"><div class="num" id="mins">00</div><div class="label">Mins</div></div>
      <div class="timer-box"><div class="num" id="secs">00</div><div class="label">Secs</div></div>
    </div>
    <script>
      const key = 'cs_end';
      if (!localStorage.getItem(key)) localStorage.setItem(key, Date.now() + 2 * 24 * 60 * 60 * 1000);
      const end = Number(localStorage.getItem(key));
      function update() {
        const diff = end - Date.now();
        if (diff <= 0) return;
        document.getElementById('days').textContent = String(Math.floor(diff / 86400000)).padStart(2,'0');
        document.getElementById('hours').textContent = String(Math.floor(diff % 86400000 / 3600000)).padStart(2,'0');
        document.getElementById('mins').textContent = String(Math.floor(diff % 3600000 / 60000)).padStart(2,'0');
        document.getElementById('secs').textContent = String(Math.floor(diff % 60000 / 1000)).padStart(2,'0');
      }
      update();
      setInterval(update, 1000);
    </script>
  </div>
</body>
</html>`);
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
    { identity },
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
  const callerIdentity = "browser-user";
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${host}/twilio-stream">
      <Parameter name="callerNumber" value="browser-user"/>
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
