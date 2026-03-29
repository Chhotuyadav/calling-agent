async function askOllama(prompt) {
  const res = await fetch("http://localhost:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "mistral",
      stream: false,
      messages: [
        {
          role: "system",
          content: `You are a helpful voice assistant. Follow these rules strictly:

1. Respond in the SAME language as the user's input
2. Keep responses under 20 words
3. Be natural and conversational
4. Do NOT translate or mix languages 

Language matching examples:
- English input → English response only
- Hindi input → Hindi response only (Devanagari script)
- Never explain which language you're using`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error("Ollama API error: " + errText);
  }

  const data = await res.json();
  return data?.message?.content?.trim() || "";
}

module.exports = { askOllama };