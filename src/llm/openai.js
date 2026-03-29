const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ✅ store memory
let history = [];

const systemPrompt = {
  role: "system",
  content: `You are a helpful voice assistant. Follow these rules:

1. Respond in the EXACT same language as the user's message
2. For Hindi messages, respond ONLY in Hindi (Devanagari: हिंदी)
3. For English messages, respond ONLY in English
4. Keep responses under 25 words
5. Be natural, friendly, and conversational
6. Never mention which language you're using
7. Never translate unless explicitly asked`,
};

// Standard version
async function askOpenAI(prompt) {
  history.push({ role: "user", content: prompt });

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [systemPrompt, ...history],
    temperature: 0.3,
    max_tokens: 100,
  });

  const reply = response.choices[0].message.content.trim();
  history.push({ role: "assistant", content: reply });
  history = history.slice(-20);

  return reply;
}

// Streaming version
async function askOpenAIStream(prompt, onChunk) {
  history.push({ role: "user", content: prompt });

  const stream = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [systemPrompt, ...history],
    temperature: 0.3,
    max_tokens: 100,
    stream: true,
  });

  let fullResponse = "";
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || "";
    if (content) {
      fullResponse += content;
      onChunk(content);
    }
  }

  history.push({ role: "assistant", content: fullResponse });
  history = history.slice(-20);
  return fullResponse;
}

module.exports = { askOpenAI, askOpenAIStream };
