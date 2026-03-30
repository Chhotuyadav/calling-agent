"use client";

import dynamic from "next/dynamic";

const VoiceAgent = dynamic(() => import("../components/VoiceAgent"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
    </div>
  ),
});

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <VoiceAgent />
      <div className="max-w-2xl mx-auto mt-8 text-center text-gray-400 text-xs">
        Built with Next.js, Socket.IO and OpenAI
      </div>
    </main>
  );
}
