const { createDeepgramSTT } = require("../deepgram/stt");
const { getTTS } = require("../tts/router");
const { askOpenAIStream } = require("../llm/openai");

function handleSocketConnection(socket) {
  console.log("🔌 Client connected:", socket.id);

  let dgLive = null;

  try {
    dgLive = createDeepgramSTT();
  } catch (error) {
    console.error("❌ Failed to create Deepgram STT:", error.message);
    socket.emit("STATUS", {
      msg: "Error: Failed to initialize speech recognition",
    });
    socket.disconnect();
    return;
  }

  const onTranscript = async (data) => {
    const transcript =
      data?.channel?.alternatives?.[0]?.transcript?.trim() || "";

    if (transcript)
      console.log("🎤 Transcript:", transcript, "| final:", data.is_final);
    if (!transcript) return;

    if (data.is_final) {
      socket.emit("USER_TRANSCRIPT", { text: transcript });
      socket.emit("STOP_AUDIO");
      socket.emit("STATUS", { msg: "OpenAI thinking..." });

      try {
        let sentenceBuffer = "";

        const aiText = await askOpenAIStream(transcript, async (chunk) => {
          sentenceBuffer += chunk;
          socket.emit("AI_STREAM", { text: chunk });

          if (/[.!?\n]/.test(chunk)) {
            const textToSpeak = sentenceBuffer.trim();
            if (textToSpeak) {
              getTTS(textToSpeak)
                .then((audioBuffer) => {
                  socket.emit("AUDIO", Buffer.from(audioBuffer));
                })
                .catch((err) => console.error("TTS Chunk Error:", err));
            }
            sentenceBuffer = "";
          }
        });

        if (sentenceBuffer.trim()) {
          const audioBuffer = await getTTS(sentenceBuffer.trim());
          socket.emit("AUDIO", Buffer.from(audioBuffer));
        }

        console.log("🤖 AI:", aiText);
        socket.emit("AI_RESPONSE", { text: aiText });
        socket.emit("STATUS", { msg: "Listening..." });
      } catch (err) {
        console.error("❌ Pipeline Error:", err.message || err);
        socket.emit("STATUS", { msg: "Error occurred" });
      }
    }
  };

  dgLive.on("Results", onTranscript);
  dgLive.on("TranscriptResult", onTranscript);
  dgLive.on("error", (err) => {
    console.error("❌ Deepgram error event:", err);
    socket.emit("STATUS", { msg: "Speech recognition error" });
  });

  socket.on("AUDIO_CHUNK", (data) => {
    if (dgLive && dgLive.getReadyState() === 1) {
      dgLive.send(Buffer.from(data));
    }
  });

  socket.on("disconnect", () => {
    console.log("🔌 Client disconnected:", socket.id);
    try {
      if (dgLive) {
        dgLive.finish();
      }
    } catch (e) {}
  });
}

module.exports = { handleSocketConnection };
