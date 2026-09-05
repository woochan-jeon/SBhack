import ChannelHeader from "@/components/channel-header";
import WorklogBoard from "@/components/worklog-board-loader";
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

export default async function WorklogPage({
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
    prevHref = `/worklog?view=week&date=${weekParam(prevAnchor)}`;
    nextHref = `/worklog?view=week&date=${weekParam(nextAnchor)}`;
    todayHref = `/worklog?view=week`;
    title = `${week[0].toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} ~ ${week[6].toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}`;
  } else {
    const { year, month: m } = parseMonthParam(params.month);
    const grid = getMonthGrid(year, m);
    weeks = grid.weeks;
    month = m;
    const prev = shiftMonth(year, m, -1);
    const next = shiftMonth(year, m, 1);
    prevHref = `/worklog?month=${monthParam(prev.year, prev.month)}`;
    nextHref = `/worklog?month=${monthParam(next.year, next.month)}`;
    todayHref = `/worklog`;
    title = grid.firstOfMonth.toLocaleDateString("ko-KR", { year: "numeric", month: "long" });
  }

  const rangeStart = weeks[0][0];
  const rangeEndExclusive = new Date(weeks[weeks.length - 1][6]);
  rangeEndExclusive.setDate(rangeEndExclusive.getDate() + 1);

  const [entryRows, members] = await Promise.all([
    prisma.workLogEntry.findMany({
      where: { date: { gte: rangeStart, lt: rangeEndExclusive } },
      include: { member: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.workLogMember.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  const entries = entryRows.map((e) => ({
    id: e.id,
    date: toDateKey(e.date),
    content: e.content,
    status: e.status,
    memberId: e.memberId,
    memberName: e.member.name,
  }));

  return (
    <>
      <ChannelHeader
        icon="📔"
        title="업무일지"
        description="각자 본인 업무를 정리한 후 자율적으로 업로드해 주세요! 정해진 시간은 없으며, 자정 전까지 업로드하는 것을 권장합니다."
      />
      <div className="flex-1 overflow-y-auto p-6">
        <WorklogBoard
          view={view}
          weeks={weeks}
          month={month}
          title={title}
          prevHref={prevHref}
          nextHref={nextHref}
          todayHref={todayHref}
          entries={entries}
          members={members.map((m) => ({ id: m.id, name: m.name }))}
        />
      </div>
    </>
  );
}
