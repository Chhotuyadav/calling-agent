"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

interface Message {
  role: "user" | "ai";
  text: string;
}

export default function VoiceAgent() {
  const [status, setStatus] = useState("Idle (Press Start)");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioQueueRef = useRef<Blob[]>([]);
  const isPlayingRef = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const streamingBubbleRef = useRef<string>("");
  const [currentAIStream, setCurrentAIStream] = useState<string>("");

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentAIStream]);

  const floatTo16BitPCM = (float32Array: Float32Array) => {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    let offset = 0;
    for (let i = 0; i < float32Array.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  };

  const downsampleBuffer = (
    buffer: Float32Array,
    inputSampleRate: number,
    outputSampleRate: number,
  ) => {
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
      for (
        let i = offsetBuffer;
        i < nextOffsetBuffer && i < buffer.length;
        i++
      ) {
        accum += buffer[i];
        count++;
      }
      result[offsetResult] = accum / count;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return result;
  };

  const playNext = async () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setStatus("Listening...");
      return;
    }

    isPlayingRef.current = true;
    const audioBlob = audioQueueRef.current.shift()!;
    const url = URL.createObjectURL(audioBlob);
    const audio = new Audio(url);
    currentAudioRef.current = audio;

    audio.onended = () => {
      URL.revokeObjectURL(url);
      playNext();
    };

    try {
      await audio.play();
      setStatus("AI Speaking...");
    } catch (err) {
      console.error("Audio playback error:", err);
      playNext();
    }
  };

  const startAgent = async () => {
    setStatus("Connecting.......");

    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
    const socket = io(backendUrl);
    socketRef.current = socket;

    socket.on("connect", async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        const audioContext = new (
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext
        )();
        audioContextRef.current = audioContext;

        const source = audioContext.createMediaStreamSource(stream);
        sourceRef.current = source;

        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (!socket.connected) return;
          const input = e.inputBuffer.getChannelData(0);
          const downsampled = downsampleBuffer(
            input,
            audioContext.sampleRate,
            16000,
          );
          const pcm16 = floatTo16BitPCM(downsampled);
          socket.emit("AUDIO_CHUNK", pcm16);
        };

        source.connect(processor);
        processor.connect(audioContext.destination);

        setStatus("Listening...");
        setIsRecording(true);
      } catch (err) {
        console.error("Microphone access error:", err);
        setStatus("Microphone error");
        socket.disconnect();
      }
    });

    socket.on("STATUS", (data: { msg: string }) => {
      setStatus(data.msg);
    });

    socket.on("USER_TRANSCRIPT", (data: { text: string }) => {
      setMessages((prev) => [...prev, { role: "user", text: data.text }]);
    });

    socket.on("STOP_AUDIO", () => {
      audioQueueRef.current = [];
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      isPlayingRef.current = false;
    });

    socket.on("AI_STREAM", (data: { text: string }) => {
      streamingBubbleRef.current += data.text;
      setCurrentAIStream(streamingBubbleRef.current);
    });

    socket.on("AI_RESPONSE", (data: { text: string }) => {
      setMessages((prev) => [...prev, { role: "ai", text: data.text }]);
      streamingBubbleRef.current = "";
      setCurrentAIStream("");
    });

    socket.on("AUDIO", (data: ArrayBuffer) => {
      const blob = new Blob([data], { type: "audio/wav" });
      audioQueueRef.current.push(blob);
      if (!isPlayingRef.current) {
        playNext();
      }
    });

    socket.on("disconnect", () => {
      stopAgent();
    });
  };

  const stopAgent = () => {
    if (processorRef.current) processorRef.current.disconnect();
    if (sourceRef.current) sourceRef.current.disconnect();
    if (audioContextRef.current) audioContextRef.current.close();
    if (socketRef.current) socketRef.current.disconnect();
    if (currentAudioRef.current) currentAudioRef.current.pause();

    setIsRecording(false);
    setStatus("Idle (Press Start)");
    streamingBubbleRef.current = "";
    setCurrentAIStream("");
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            AI Voice Agent
          </h1>
          <div
            className={`px-4 py-1.5 rounded-full text-sm font-medium ${
              status.includes("Error")
                ? "bg-red-100 text-red-800"
                : status === "Listening..."
                  ? "bg-green-100 text-green-800 animate-pulse"
                  : status === "AI Speaking..."
                    ? "bg-blue-100 text-blue-800"
                    : "bg-gray-100 text-gray-600"
            }`}
          >
            {status}
          </div>
        </div>

        <div className="flex gap-4 mb-8">
          {!isRecording ? (
            <button
              onClick={startAgent}
              className="flex-1 bg-indigo-600 text-white px-6 py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95 flex items-center justify-center gap-2"
            >
              <div className="w-3 h-3 bg-white rounded-full"></div>
              Start Talking
            </button>
          ) : (
            <button
              onClick={stopAgent}
              className="flex-1 bg-rose-500 text-white px-6 py-4 rounded-xl font-bold text-lg hover:bg-rose-600 transition-all shadow-lg shadow-rose-200 active:scale-95 flex items-center justify-center gap-2"
            >
              <div className="w-3 h-3 bg-white rounded-sm"></div>
              Stop Agent
            </button>
          )}
        </div>

        <div className="relative group">
          <div className="h-[450px] overflow-y-auto pr-2 space-y-4 scrollbar-thin scrollbar-thumb-gray-200 hover:scrollbar-thumb-gray-300">
            {messages.length === 0 && !currentAIStream && (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                <svg
                  className="w-16 h-16 mb-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                  />
                </svg>
                <p className="text-lg">No conversation yet</p>
                <p className="text-sm">Click start to begin the conversation</p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
              >
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 px-1">
                  {msg.role === "user" ? "You" : "AI"}
                </span>
                <div
                  className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${
                    msg.role === "user"
                      ? "bg-indigo-600 text-white rounded-tr-none"
                      : "bg-gray-100 text-gray-800 rounded-tl-none"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {currentAIStream && (
              <div className="flex flex-col items-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 px-1">
                  AI
                </span>
                <div className="max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed bg-gray-100 text-gray-800 rounded-tl-none shadow-sm">
                  {currentAIStream}
                  <span className="inline-block w-1 h-4 ml-1 bg-indigo-500 animate-pulse align-middle"></span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
