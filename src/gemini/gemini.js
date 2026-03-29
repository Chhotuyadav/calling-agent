const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  systemInstruction:
    "You are a fast-responding AI voice agent. Keep answers very short (max 2 sentences). Be conversational and helpful.",
});

async function askGemini(prompt) {
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

async function askGeminiStream(prompt, onChunk) {
  const result = await model.generateContentStream(prompt);
  let fullResponse = "";
  for await (const chunk of result.stream) {
    const chunkText = chunk.text();
    fullResponse += chunkText;
    onChunk(chunkText);
  }
  return fullResponse.trim();
}

module.exports = { askGemini, askGeminiStream };
