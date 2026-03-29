const { ElevenLabsClient } = require("@elevenlabs/elevenlabs-js");

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

async function elevenLabsTTS(text) {
  const voiceId = process.env.ELEVENLABS_VOICE_ID || "cFvQm3lZl5miSWHxawFj";

  try {
    console.log("🔊 ElevenLabs TTS: Generating audio...");
    
    const audioStream = await elevenlabs.textToSpeech.convert(voiceId, {
      text,
      modelId: "eleven_multilingual_v2",
      outputFormat: "mp3_44100_128",
    });

    const chunks = [];
    for await (const chunk of audioStream) chunks.push(chunk);

    console.log("✅ ElevenLabs TTS: Audio generated successfully");
    return Buffer.concat(chunks);
  } catch (error) {
    console.error("❌ ElevenLabs TTS Error:", error.message);
    console.error("Error details:", error);
    throw error;
  }
}

module.exports = { elevenLabsTTS };