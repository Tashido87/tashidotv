"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export default function BackButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      className="absolute top-24 left-4 md:top-24 md:left-10 z-30 flex items-center gap-2 px-4 py-2 bg-zinc-900/50 hover:bg-zinc-900 backdrop-blur-md border border-white/10 text-white text-sm font-semibold rounded-full shadow-lg transition-all duration-300 hover:-translate-x-1 cursor-pointer"
      aria-label="Go back to previous page"
    >
      <ChevronLeft className="w-4 h-4" />
      <span>Back</span>
    </button>
  );
}
