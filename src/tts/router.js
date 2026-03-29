const { deepgramTTS } = require("../deepgram/tts");
const { elevenLabsTTS } = require("../elevenlabs/tts");

async function getTTS(text) {
  const provider = process.env.TTS_PROVIDER || "deepgram";

  if (provider === "elevenlabs") {
    return await elevenLabsTTS(text);
  } else {
    return await deepgramTTS(text);
  }
}

module.exports = { getTTS };
