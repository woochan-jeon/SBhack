import ChannelHeader from "@/components/channel-header";
import ScheduleBoard from "@/components/schedule-board-loader";
import { prisma } from "@/lib/prisma";
import {
  getMonthGrid,
  getWeekGrid,
  monthParam,
  parseMonthParam,
  parseWeekParam,
  shiftMonth,
  shiftWeek,
  toDateKey,
  weekParam,
} from "@/lib/calendar-grid";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; month?: string; date?: string }>;
}) {
  const params = await searchParams;
  const view = params.view === "week" ? "week" : "month";

  let weeks: Date[][];
  let month: number | null = null;
  let title: string;
  let prevHref: string;
  let nextHref: string;
  let todayHref: string;

  if (view === "week") {
    const anchor = parseWeekParam(params.date);
    const week = getWeekGrid(anchor);
    weeks = [week];
    const prevAnchor = shiftWeek(anchor, -1);
    const nextAnchor = shiftWeek(anchor, 1);
    prevHref = `/schedule?view=week&date=${weekParam(prevAnchor)}`;
    nextHref = `/schedule?view=week&date=${weekParam(nextAnchor)}`;
    todayHref = `/schedule?view=week`;
    title = `${week[0].toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} ~ ${week[6].toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}`;
  } else {
    const { year, month: m } = parseMonthParam(params.month);
    const grid = getMonthGrid(year, m);
    weeks = grid.weeks;
    month = m;
    const prev = shiftMonth(year, m, -1);
    const next = shiftMonth(year, m, 1);
    prevHref = `/schedule?month=${monthParam(prev.year, prev.month)}`;
    nextHref = `/schedule?month=${monthParam(next.year, next.month)}`;
    todayHref = `/schedule`;
    title = grid.firstOfMonth.toLocaleDateString("ko-KR", { year: "numeric", month: "long" });
  }

  const rangeStart = weeks[0][0];
  const rangeEndExclusive = new Date(weeks[weeks.length - 1][6]);
  rangeEndExclusive.setDate(rangeEndExclusive.getDate() + 1);

  const [entryRows, categories] = await Promise.all([
    prisma.scheduleEntry.findMany({
      where: { date: { gte: rangeStart, lt: rangeEndExclusive } },
      include: { category: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.scheduleCategory.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  const entries = entryRows.map((e) => ({
    id: e.id,
    date: toDateKey(e.date),
    content: e.content,
    status: e.status,
    categoryId: e.categoryId,
    categoryName: e.category.name,
  }));

  return (
    <>
      <ChannelHeader icon="🗓️" title="일정" description="JM / Q10 / 창동 카테고리별 일정을 정리하는 채널" />
      <div className="flex-1 overflow-y-auto p-6">
        <ScheduleBoard
          view={view}
          weeks={weeks}
          month={month}
          title={title}
          prevHref={prevHref}
          nextHref={nextHref}
          todayHref={todayHref}
          entries={entries}
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        />
      </div>
    </>
  );
}
