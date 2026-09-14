import ChannelHeader from "@/components/channel-header";
import MarketingBoard from "@/components/marketing-board";
import { prisma } from "@/lib/prisma";
import { monthParam, parseMonthParam, shiftMonth } from "@/lib/calendar-grid";

export default async function MarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const { year, month } = parseMonthParam(params.month); // month is 0-indexed
  const calendarMonth = month + 1;

  const rangeStart = new Date(year, month, 1);
  const rangeEndExclusive = new Date(year, month + 1, 1);

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const prevHref = `/marketing?month=${monthParam(prev.year, prev.month)}`;
  const nextHref = `/marketing?month=${monthParam(next.year, next.month)}`;
  const todayHref = `/marketing`;
  const title = rangeStart.toLocaleDateString("ko-KR", { year: "numeric", month: "long" });

  const [projects, categories, budgets, expenseRows, channelRows, paymentMethodRows] = await Promise.all([
    prisma.marketingProject.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.marketingCategory.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.marketingBudget.findMany({ where: { year, month: calendarMonth } }),
    prisma.marketingExpense.findMany({
      where: { date: { gte: rangeStart, lt: rangeEndExclusive } },
      include: { project: true },
      orderBy: { date: "desc" },
    }),
    prisma.marketingExpense.findMany({
      distinct: ["channel"],
      select: { channel: true },
      orderBy: { channel: "asc" },
    }),
    prisma.marketingExpense.findMany({
      distinct: ["paymentMethod"],
      select: { paymentMethod: true },
      orderBy: { paymentMethod: "asc" },
    }),
  ]);

  const expenses = expenseRows.map((e) => ({
    id: e.id,
    date: e.date.toISOString().slice(0, 10),
    channel: e.channel,
    description: e.description,
    amount: e.amount,
    paymentMethod: e.paymentMethod,
    note: e.note,
    projectId: e.projectId,
    categoryId: e.categoryId,
  }));

  return (
    <>
      <ChannelHeader
        icon="📊"
        title="마케팅"
        description="월별 채널별 마케팅 진행 현황과 예산 집행 내역을 관리하는 채널"
      />
      <div className="flex-1 overflow-y-auto p-6">
        <MarketingBoard
          year={year}
          month={calendarMonth}
          title={title}
          prevHref={prevHref}
          nextHref={nextHref}
          todayHref={todayHref}
          projects={projects.map((p) => ({ id: p.id, name: p.name, color: p.color }))}
          categories={categories.map((c) => ({ id: c.id, name: c.name, color: c.color, projectId: c.projectId }))}
          budgets={budgets.map((b) => ({ projectId: b.projectId, amount: b.amount }))}
          expenses={expenses}
          channelSuggestions={channelRows.map((c) => c.channel)}
          paymentMethodSuggestions={paymentMethodRows.map((p) => p.paymentMethod)}
        />
      </div>
    </>
  );
}
