"use client";

import { useEffect, useRef, useState } from "react";
import { Device, Call } from "@twilio/voice-sdk";

interface Message {
  role: "user" | "ai";
  text: string;
}

export default function VoiceAgent() {
  const [status, setStatus] = useState("Idle (Press Start)");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const startAgent = async () => {
    setStatus("Connecting...");
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

      const res = await fetch(`${backendUrl}/token?identity=user`);
      const { token } = await res.json();

      const device = new Device(token, { logLevel: "error" });
      deviceRef.current = device;
      setMessages([]);

      await device.register();
      setStatus("Calling...");

      const call = await device.connect({
        params: { To: process.env.NEXT_PUBLIC_TWILIO_NUMBER || "" },
      });
      callRef.current = call;

      call.on("accept", () => {
        setStatus("Connected");
        setIsRecording(true);
      });

      call.on("disconnect", () => {
        setStatus("Idle (Press Start)");
        setIsRecording(false);
      });

      call.on("error", (err) => {
        console.error("Call error:", err);
        setStatus("Call error");
        setIsRecording(false);
      });
    } catch (err) {
      console.error("Start error:", err);
      setStatus("Connection failed");
    }
  };

  const stopAgent = () => {
    callRef.current?.disconnect();
    deviceRef.current?.destroy();
    callRef.current = null;
    deviceRef.current = null;
    setIsRecording(false);
    setStatus("Idle (Press Start)");
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
              status.includes("Error") || status.includes("failed")
                ? "bg-red-100 text-red-800"
                : status === "Connected"
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
            {messages.length === 0 && (
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
            <div ref={chatEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
