const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusDiv = document.getElementById("status");
const chatDiv = document.getElementById("chat");

let socket;
let audioContext;
let source;
let processor;
let currentAudio = null;
let audioQueue = [];
let isPlaying = false;

let streamingBubble = null;

function appendAIStream(chunk) {
  if (!streamingBubble) {
    const wrap = document.createElement("div");
    wrap.className = "msg ai";

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.innerText = "AI";

    const body = document.createElement("div");
    body.className = "stream-body";

    wrap.appendChild(meta);
    wrap.appendChild(body);
    chatDiv.appendChild(wrap);
    streamingBubble = body;
  }

  streamingBubble.innerText += chunk;
  chatDiv.scrollTop = chatDiv.scrollHeight;
}

function addMessage(role, text) {
  const wrap = document.createElement("div");
  wrap.className = `msg ${role}`;

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.innerText = role === "user" ? "You" : "AI";

  const body = document.createElement("div");
  body.innerText = text;

  wrap.appendChild(meta);
  wrap.appendChild(body);

  chatDiv.appendChild(wrap);
  chatDiv.scrollTop = chatDiv.scrollHeight;
}

function floatTo16BitPCM(float32Array) {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);

  let offset = 0;
  for (let i = 0; i < float32Array.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

function downsampleBuffer(buffer, inputSampleRate, outputSampleRate) {
  if (outputSampleRate === inputSampleRate) return buffer;

  const sampleRateRatio = inputSampleRate / outputSampleRate;
  const newLength = Math.round(buffer.length / sampleRateRatio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    let accum = 0,
      count = 0;

    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }

    result[offsetResult] = accum / count;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }

  return result;
}

async function playNext() {
  if (audioQueue.length === 0) {
    isPlaying = false;
    statusDiv.innerText = "Status: Listening...";
    return;
  }

  isPlaying = true;
  const audioBlob = audioQueue.shift();
  const url = URL.createObjectURL(audioBlob);
  currentAudio = new Audio(url);

  currentAudio.onended = () => {
    URL.revokeObjectURL(url);
    playNext();
  };

  try {
    await currentAudio.play();
    statusDiv.innerText = "Status: AI Speaking...";
  } catch (err) {
    console.error("Audio playback error:", err);
    playNext();
  }
}

startBtn.onclick = async () => {
  statusDiv.innerText = "Status: Connecting...";

  const wsUrl = "wss://3.110.174.90.nip.io/ws";
  socket = new WebSocket(wsUrl);
  socket.binaryType = "arraybuffer";

  socket.onopen = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    source = audioContext.createMediaStreamSource(stream);
    processor = audioContext.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (e) => {
      if (!socket || socket.readyState !== 1) return;

      const input = e.inputBuffer.getChannelData(0);
      const downsampled = downsampleBuffer(
        input,
        audioContext.sampleRate,
        16000,
      );
      const pcm16 = floatTo16BitPCM(downsampled);
      socket.send(pcm16);
    };

    source.connect(processor);
    processor.connect(audioContext.destination);

    statusDiv.innerText = "Status: Listening...";
    startBtn.style.display = "none";
    stopBtn.style.display = "inline-block";
  };

  socket.onmessage = async (event) => {
    if (typeof event.data === "string") {
      const data = JSON.parse(event.data);

      if (data.type === "STATUS") statusDiv.innerText = `Status: ${data.msg}`;

      if (data.type === "STOP_AUDIO") {
        audioQueue = [];
        if (currentAudio) {
          currentAudio.pause();
          currentAudio = null;
        }
        isPlaying = false;
      }

      if (data.type === "USER_TRANSCRIPT") addMessage("user", data.text);
      if (data.type === "AI_RESPONSE") {
        streamingBubble = null;
      }
      if (data.type === "AI_STREAM") appendAIStream(data.text);

      return;
    }

    const ttsProvider = "{{ TTS_PROVIDER }}"; // replaced at runtime if needed
    const mimeType = ttsProvider === "elevenlabs" ? "audio/mpeg" : "audio/wav";
    const blob = new Blob([event.data], { type: mimeType });
    audioQueue.push(blob);
    if (!isPlaying) playNext();
  };

  socket.onerror = (err) => console.error("WebSocket Error:", err);
  socket.onclose = () => console.log("WebSocket closed");
};

stopBtn.onclick = () => {
  if (processor) processor.disconnect();
  if (source) source.disconnect();
  if (audioContext) audioContext.close();
  if (socket) socket.close();
  if (currentAudio) currentAudio.pause();

  startBtn.style.display = "inline-block";
  stopBtn.style.display = "none";
  statusDiv.innerText = "Status: Idle";
};
