"use client";

import dynamic from "next/dynamic";

const WorklogBoard = dynamic(() => import("@/components/worklog-board"), {
  ssr: false,
  loading: () => <div className="p-6 text-sm text-gray-400">불러오는 중...</div>,
});

export default WorklogBoard;
