const { deepgram } = require("./client");

function createDeepgramSTT() {
  const dgLive = deepgram.listen.live({
    model: "nova-2",
    language: "hi",
    smart_format: true,
    interim_results: true,
    endpointing: 500,
    encoding: "linear16",
    sample_rate: 16000,
    channels: 1,
  });

  console.log("🟡 dgLive created, state:", dgLive.getReadyState());

  dgLive.on("open", () => {
    console.log("✅ Deepgram STT OPEN (readyState:", dgLive.getReadyState(), ")");
  });

  dgLive.on("error", (err) => {
    console.log("❌ Deepgram STT ERROR:", err);
  });

  dgLive.on("close", () => {
    console.log("🔴 Deepgram STT CLOSED");
  });

  return dgLive;
}

module.exports = { createDeepgramSTT };
