const { createDeepgramSTT } = require("../deepgram/stt");
const { getTTS } = require("../tts/router");
const { askOpenAIStream } = require("../llm/openai");

function handleSocketConnection(ws) {
  const dgLive = createDeepgramSTT();

  const onTranscript = async (data) => {
    const transcript =
      data?.channel?.alternatives?.[0]?.transcript?.trim() || "";

    if (transcript) console.log("🎤 Transcript:", transcript, "| final:", data.is_final);

    if (!transcript) return;

    if (data.is_final) {
      // Send user transcript to frontend
      ws.send(JSON.stringify({ type: "USER_TRANSCRIPT", text: transcript }));
      
      ws.send(JSON.stringify({ type: "STOP_AUDIO" }));
      ws.send(JSON.stringify({ type: "STATUS", msg: "OpenAI thinking..." }));

      try {
        let sentenceBuffer = "";
        let fullAIResponse = "";

        const aiText = await askOpenAIStream(transcript, async (chunk) => {
          fullAIResponse += chunk;
          sentenceBuffer += chunk;

          // Stream chunk to frontend
          ws.send(JSON.stringify({ type: "AI_STREAM", text: chunk }));

          // If chunk contains punctuation, send to TTS
          if (/[.!?\n]/.test(chunk)) {
            const textToSpeak = sentenceBuffer.trim();
            if (textToSpeak) {
              console.log("🔊 Speaking chunk:", textToSpeak);
              getTTS(textToSpeak).then(audioBuffer => {
                ws.send(audioBuffer);
              }).catch(err => console.error("TTS Chunk Error:", err));
            }
            sentenceBuffer = "";
          }
        });

        // Send remaining buffer if any
        if (sentenceBuffer.trim()) {
          const textToSpeak = sentenceBuffer.trim();
          console.log("🔊 Speaking final chunk:", textToSpeak);
          const audioBuffer = await getTTS(textToSpeak);
          ws.send(audioBuffer);
        }

        console.log("🤖 AI:", aiText);
        // Send AI response to frontend
        ws.send(JSON.stringify({ type: "AI_RESPONSE", text: aiText }));
        ws.send(JSON.stringify({ type: "STATUS", msg: "Listening..." }));

      } catch (err) {
        console.error("❌ Pipeline Error:", err.message || err);
        ws.send(JSON.stringify({ type: "STATUS", msg: "Error occurred" }));
      }
    }
  };

  dgLive.on("Results", onTranscript);
  dgLive.on("TranscriptResult", onTranscript);

  ws.on("message", (message) => {
    if (dgLive.getReadyState() === 1) {
      dgLive.send(message);
    }
  });

  ws.on("close", () => {
    console.log("🔌 Client disconnected");
    try {
      dgLive.finish();
    } catch (e) {}
  });
}

module.exports = { handleSocketConnection };
