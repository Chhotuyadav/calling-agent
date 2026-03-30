const { createDeepgramSTT } = require("../deepgram/stt");
const { getTTS } = require("../tts/router");
const { askOpenAIStream } = require("../llm/openai");
const { deepgram } = require("../deepgram/client");

async function getTTSForTwilio(text) {
  const ttsResponse = await deepgram.speak.request(
    { text },
    { model: "aura-asteria-en", encoding: "mulaw", sample_rate: 8000, container: "none" }
  );
  const stream = await ttsResponse.getStream();
  const reader = stream.getReader();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

function handleTwilioConnection(ws) {
  console.log("📞 Twilio call connected");

  const dgLive = createDeepgramSTT();
  let streamSid = null;
  let callerNumber = null;

  const onTranscript = async (data) => {
    const transcript = data?.channel?.alternatives?.[0]?.transcript?.trim() || "";

    if (!transcript || !data.is_final) return;

    console.log(`🎤 [${callerNumber}] Transcript:`, transcript);

    try {
      let sentenceBuffer = "";

      await askOpenAIStream(transcript, async (chunk) => {
        sentenceBuffer += chunk;

        if (/[.!?\n]/.test(chunk)) {
          const textToSpeak = sentenceBuffer.trim();
          if (textToSpeak) {
            console.log("🔊 Speaking:", textToSpeak);
            getTTSForTwilio(textToSpeak)
              .then((audioBuffer) => sendAudioToTwilio(ws, streamSid, audioBuffer))
              .catch((err) => console.error("TTS Error:", err));
          }
          sentenceBuffer = "";
        }
      });

      if (sentenceBuffer.trim()) {
        const audioBuffer = await getTTSForTwilio(sentenceBuffer.trim());
        sendAudioToTwilio(ws, streamSid, audioBuffer);
      }
    } catch (err) {
      console.error("❌ Pipeline Error:", err.message || err);
    }
  };

  dgLive.on("Results", onTranscript);
  dgLive.on("TranscriptResult", onTranscript);

  ws.on("message", (message) => {
    const msg = JSON.parse(message);

    if (msg.event === "start") {
      streamSid = msg.start.streamSid;
      callerNumber = msg.start.customParameters?.callerNumber || msg.start.from || "unknown";
      console.log(`📞 Call started | SID: ${streamSid} | From: ${callerNumber}`);
    }

    if (msg.event === "media") {
      const audioChunk = Buffer.from(msg.media.payload, "base64");
      if (dgLive.getReadyState() === 1) {
        dgLive.send(audioChunk);
      }
    }

    if (msg.event === "stop") {
      console.log("📞 Call ended");
      try { dgLive.finish(); } catch (e) {}
    }
  });

  ws.on("close", () => {
    console.log("📞 Twilio WS closed");
    try { dgLive.finish(); } catch (e) {}
  });
}

// Twilio expects mulaw audio in base64 wrapped in JSON
function sendAudioToTwilio(ws, streamSid, audioBuffer) {
  if (!streamSid || ws.readyState !== 1) return;

  ws.send(JSON.stringify({
    event: "media",
    streamSid,
    media: {
      payload: audioBuffer.toString("base64"),
    },
  }));
}

module.exports = { handleTwilioConnection };
