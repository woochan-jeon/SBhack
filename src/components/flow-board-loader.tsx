"use client";

import dynamic from "next/dynamic";

const FlowBoard = dynamic(() => import("@/components/flow-board"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center bg-[#0b1120] text-sm text-white/50">불러오는 중...</div>
  ),
});

export default function FlowBoardLoader() {
  return <FlowBoard />;
}
