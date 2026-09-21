"use client";

import dynamic from "next/dynamic";

const ScheduleBoard = dynamic(() => import("@/components/schedule-board"), {
  ssr: false,
  loading: () => <div className="p-6 text-sm text-gray-400">불러오는 중...</div>,
});

export default ScheduleBoard;
