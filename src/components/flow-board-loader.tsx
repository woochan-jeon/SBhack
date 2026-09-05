"use client";

import dynamic from "next/dynamic";
import type { BoardState } from "@/lib/flowboard";

const FlowBoard = dynamic(() => import("@/components/flow-board"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center bg-[#0b1120] text-sm text-white/50">불러오는 중...</div>
  ),
});

export default function FlowBoardLoader({ initialState }: { initialState: BoardState }) {
  return <FlowBoard initialState={initialState} />;
}
