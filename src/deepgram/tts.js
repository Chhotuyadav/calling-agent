const { deepgram } = require("./client");

async function deepgramTTS(text) {
  try {
    const ttsResponse = await deepgram.speak.request(
      { text },
      {
        model: "aura-asteria-en",
        encoding: "linear16",
        container: "wav",
        language: "hi",
      }
    );

    if (typeof ttsResponse.getBuffer === 'function') {
        return await ttsResponse.getBuffer();
    }

    const stream = await ttsResponse.getStream();
    const reader = stream.getReader();
    const chunks = [];

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
    }
    return Buffer.concat(chunks);

  } catch (error) {
    console.error("Deepgram TTS Error:", error);
    throw error;
  }
}

module.exports = { deepgramTTS };