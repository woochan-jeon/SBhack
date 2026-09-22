"use client";

import Link from "next/link";
import { useActionState, useMemo, useRef, useState, useTransition } from "react";
import {
  createCategoryAction,
  createEntryAction,
  deleteCategoryAction,
  deleteEntryAction,
  updateEntryAction,
  type ActionState,
} from "@/app/(app)/schedule/actions";
import { toDateKey } from "@/lib/calendar-grid";

interface EntryVM {
  id: string;
  date: string; // start, YYYY-MM-DD
  endDate: string; // end, YYYY-MM-DD (same as date for a single-day item)
  content: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
}

interface CategoryVM {
  id: string;
  name: string;
  color: string;
}

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const CATEGORY_COLOR_SWATCHES = [
  "#0066cc",
  "#059669",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#65a30d",
];
const BAR_HEIGHT = 22;
const BAR_GAP = 4;
const initialState: ActionState = {};

export default function ScheduleBoard({
  view,
  weeks,
  month,
  title,
  prevHref,
  nextHref,
  todayHref,
  entries,
  categories,
}: {
  view: "week" | "month";
  weeks: Date[][];
  month: number | null;
  title: string;
  prevHref: string;
  nextHref: string;
  todayHref: string;
  entries: EntryVM[];
  categories: CategoryVM[];
}) {
  const [managingCategories, setManagingCategories] = useState(false);
  const [addingDate, setAddingDate] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  const todayKey = toDateKey(new Date());
  const editingEntry = editingEntryId ? entries.find((e) => e.id === editingEntryId) ?? null : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <div className="flex items-center gap-1">
            <Link
              href={prevHref}
              className="rounded-md border border-gray-300 px-2.5 py-1 text-sm text-gray-900 hover:bg-gray-50"
            >
              ‹
            </Link>
            <Link
              href={todayHref}
              className="rounded-md border border-gray-300 px-2.5 py-1 text-sm text-gray-900 hover:bg-gray-50"
            >
              오늘
            </Link>
            <Link
              href={nextHref}
              className="rounded-md border border-gray-300 px-2.5 py-1 text-sm text-gray-900 hover:bg-gray-50"
            >
              ›
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-gray-200 p-0.5 text-sm">
          <Link
            href="/schedule?view=week"
            className={`rounded px-2.5 py-1 ${view === "week" ? "bg-[#0066cc] text-white" : "text-gray-600 hover:bg-gray-50"}`}
          >
            주간
          </Link>
          <Link
            href="/schedule"
            className={`rounded px-2.5 py-1 ${view === "month" ? "bg-[#0066cc] text-white" : "text-gray-600 hover:bg-gray-50"}`}
          >
            월간
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
        <div className="flex flex-wrap items-center gap-3">
          {categories.map((c) => (
            <span key={c.id} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} aria-hidden />
              {c.name}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setManagingCategories((v) => !v)}
          className="text-xs text-gray-500 underline decoration-dotted hover:text-gray-700"
        >
          카테고리 관리
        </button>
      </div>

      {managingCategories && <CategoryManagePanel categories={categories} />}

      <div className="hidden overflow-hidden rounded-lg border border-gray-200 md:block">
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {WEEKDAY_LABELS.map((label, i) => (
            <div
              key={label}
              className={`px-2 py-1.5 text-center text-xs font-medium ${
                i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-gray-700"
              }`}
            >
              {label}
            </div>
          ))}
        </div>
        {weeks.map((week) => (
          <WeekRow
            key={toDateKey(week[0])}
            week={week}
            month={month}
            todayKey={todayKey}
            entries={entries}
            minHeight={view === "week" ? 160 : 80}
            onAddDate={setAddingDate}
            onEditEntry={setEditingEntryId}
          />
        ))}
      </div>

      <div className="flex flex-col gap-2 md:hidden">
        {weeks.flat().map((day) => {
          const key = toDateKey(day);
          const isToday = key === todayKey;
          const dayEntries = entries.filter((e) => e.date <= key && key <= e.endDate);
          return (
            <MobileDayAccordion
              key={key}
              day={day}
              isToday={isToday}
              entries={dayEntries}
              defaultOpen={isToday}
              onAdd={() => setAddingDate(key)}
              onEditEntry={setEditingEntryId}
            />
          );
        })}
      </div>

      {addingDate && (
        <AddEntryModal date={addingDate} categories={categories} onClose={() => setAddingDate(null)} />
      )}

      {editingEntry && (
        <EditEntryModal entry={editingEntry} categories={categories} onClose={() => setEditingEntryId(null)} />
      )}
    </div>
  );
}

type BarSegment = {
  entry: EntryVM;
  colStart: number;
  colSpan: number;
  isStart: boolean;
  isEnd: boolean;
  lane: number;
};

/** Greedy per-week lane packing so overlapping bars stack instead of collide (independent per week row, like a month-view calendar). */
function layoutWeekBars(week: Date[], entries: EntryVM[]): { segments: BarSegment[]; laneCount: number } {
  const weekKeys = week.map(toDateKey);
  const weekStartKey = weekKeys[0];
  const weekEndKey = weekKeys[6];

  const raw = entries
    .map((entry) => {
      if (entry.endDate < weekStartKey || entry.date > weekEndKey) return null;
      const segStartKey = entry.date < weekStartKey ? weekStartKey : entry.date;
      const segEndKey = entry.endDate > weekEndKey ? weekEndKey : entry.endDate;
      const colStart = weekKeys.indexOf(segStartKey);
      const colEnd = weekKeys.indexOf(segEndKey);
      return {
        entry,
        colStart,
        colSpan: colEnd - colStart + 1,
        isStart: segStartKey === entry.date,
        isEnd: segEndKey === entry.endDate,
      };
    })
    .filter((s): s is Omit<BarSegment, "lane"> => s !== null)
    .sort((a, b) => a.colStart - b.colStart || b.colSpan - a.colSpan);

  const laneEnds: number[] = [];
  const segments: BarSegment[] = [];
  for (const seg of raw) {
    let lane = laneEnds.findIndex((end) => end < seg.colStart);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(seg.colStart + seg.colSpan - 1);
    } else {
      laneEnds[lane] = seg.colStart + seg.colSpan - 1;
    }
    segments.push({ ...seg, lane });
  }
  return { segments, laneCount: laneEnds.length };
}

function WeekRow({
  week,
  month,
  todayKey,
  entries,
  minHeight,
  onAddDate,
  onEditEntry,
}: {
  week: Date[];
  month: number | null;
  todayKey: string;
  entries: EntryVM[];
  minHeight: number;
  onAddDate: (date: string) => void;
  onEditEntry: (id: string) => void;
}) {
  const { segments, laneCount } = useMemo(() => layoutWeekBars(week, entries), [week, entries]);
  const barsHeight = Math.max(laneCount, 1) * (BAR_HEIGHT + BAR_GAP);

  return (
    <div className="grid grid-cols-7 border-b border-gray-100 last:border-b-0">
      {week.map((day) => {
        const key = toDateKey(day);
        const inMonth = month === null || day.getMonth() === month;
        return (
          <div
            key={key}
            className={`flex items-center justify-between border-r border-gray-100 px-1.5 pt-1 last:border-r-0 ${inMonth ? "bg-white" : "bg-gray-50"}`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                key === todayKey ? "bg-[#0066cc] font-semibold text-white" : inMonth ? "text-gray-900" : "text-gray-400"
              }`}
            >
              {day.getDate()}
            </span>
            <button
              type="button"
              onClick={() => onAddDate(key)}
              title="일정 추가"
              aria-label="일정 추가"
              className="flex h-4 w-4 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              +
            </button>
          </div>
        );
      })}
      <div className="relative col-span-7" style={{ minHeight: Math.max(barsHeight + 8, minHeight) }}>
        {segments.map((seg) => {
          const showLabel = seg.isStart || seg.colStart === 0;
          return (
            <button
              key={`${seg.entry.id}-${seg.colStart}`}
              type="button"
              onClick={() => onEditEntry(seg.entry.id)}
              title={seg.entry.content}
              style={{
                position: "absolute",
                left: `calc(${(seg.colStart / 7) * 100}% + 2px)`,
                width: `calc(${(seg.colSpan / 7) * 100}% - 4px)`,
                top: 4 + seg.lane * (BAR_HEIGHT + BAR_GAP),
                height: BAR_HEIGHT,
                backgroundColor: seg.entry.categoryColor,
              }}
              className={`overflow-hidden truncate px-2 text-left text-[11px] font-medium text-white hover:brightness-95 ${
                seg.isStart ? "rounded-l-md" : ""
              } ${seg.isEnd ? "rounded-r-md" : ""}`}
            >
              {showLabel ? seg.entry.content : " "}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MobileDayAccordion({
  day,
  isToday,
  entries,
  defaultOpen,
  onAdd,
  onEditEntry,
}: {
  day: Date;
  isToday: boolean;
  entries: EntryVM[];
  defaultOpen: boolean;
  onAdd: () => void;
  onEditEntry: (id: string) => void;
}) {
  return (
    <details open={defaultOpen} className="rounded-lg border border-gray-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2">
        <span className={`text-sm font-medium ${isToday ? "text-[#0066cc]" : "text-gray-900"}`}>
          {day.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })}
          {isToday && (
            <span className="ml-1.5 rounded-full bg-[#0066cc]/10 px-1.5 py-0.5 text-[10px] text-[#0066cc]">오늘</span>
          )}
        </span>
        <span className="text-xs text-gray-400">{entries.length > 0 ? `${entries.length}건` : ""}</span>
      </summary>
      <div className="flex flex-col gap-1 border-t border-gray-100 p-2">
        {entries.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => onEditEntry(e.id)}
            className="flex items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs hover:bg-gray-100"
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: e.categoryColor }} aria-hidden />
            <span className="truncate text-gray-900">{e.content}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={onAdd}
          className="mt-1 rounded-md border border-dashed border-gray-300 px-2 py-1.5 text-xs text-gray-500 hover:border-gray-400 hover:text-gray-700"
        >
          + 일정 추가
        </button>
      </div>
    </details>
  );
}

function CategoryManagePanel({ categories }: { categories: CategoryVM[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [color, setColor] = useState(CATEGORY_COLOR_SWATCHES[0]);
  const [, startTransition] = useTransition();
  const [state, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await createCategoryAction(prev, formData);
    if (!result.error) formRef.current?.reset();
    return result;
  }, initialState);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <span
            key={c.id}
            className="flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs text-gray-600 ring-1 ring-gray-200"
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c.color }} aria-hidden />
            {c.name}
            <button
              type="button"
              onClick={() => {
                if (confirm(`"${c.name}" 카테고리를 삭제할까요? 등록된 일정 기록도 함께 삭제됩니다.`)) {
                  startTransition(() => deleteCategoryAction(c.id));
                }
              }}
              title={`${c.name} 삭제`}
              aria-label={`${c.name} 삭제`}
              className="text-gray-400 hover:text-red-600"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <form ref={formRef} action={formAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="color" value={color} />
        <input
          name="name"
          placeholder="새 카테고리 이름"
          required
          className="w-40 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#0066cc]"
        />
        <div className="flex items-center gap-1">
          {CATEGORY_COLOR_SWATCHES.map((swatch) => (
            <button
              key={swatch}
              type="button"
              onClick={() => setColor(swatch)}
              title={swatch}
              style={{ backgroundColor: swatch }}
              className={`h-5 w-5 rounded-full ${color === swatch ? "ring-2 ring-offset-1 ring-gray-400" : ""}`}
            />
          ))}
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-[#0066cc] px-2.5 py-1 text-xs text-white hover:bg-[#0071e3] disabled:opacity-60"
        >
          추가
        </button>
      </form>
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
    </div>
  );
}

function CategorySelect({
  categories,
  defaultValue,
  className,
}: {
  categories: CategoryVM[];
  defaultValue?: string;
  className: string;
}) {
  return (
    <select name="categoryId" required defaultValue={defaultValue ?? categories[0]?.id ?? ""} className={className}>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

function AddEntryModal({
  date,
  categories,
  onClose,
}: {
  date: string;
  categories: CategoryVM[];
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await createEntryAction(prev, formData);
    if (!result.error) onClose();
    return result;
  }, initialState);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div onClick={onClose} className="absolute inset-0" aria-hidden />
      <form action={formAction} className="relative z-10 flex w-full max-w-sm flex-col gap-3 rounded-lg bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">일정 추가</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-900">
            ✕
          </button>
        </div>
        <CategorySelect
          categories={categories}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#0066cc]"
        />
        <div className="flex items-center gap-2">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-xs text-gray-400">시작일</span>
            <input
              name="date"
              type="date"
              defaultValue={date}
              required
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#0066cc]"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-xs text-gray-400">종료일</span>
            <input
              name="endDate"
              type="date"
              defaultValue={date}
              required
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#0066cc]"
            />
          </label>
        </div>
        <textarea
          name="content"
          autoFocus
          required
          rows={4}
          placeholder="일정 내용을 적어주세요"
          className="resize-none rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#0066cc]"
        />
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
            취소
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-[#0066cc] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0071e3] disabled:opacity-60"
          >
            {pending ? "저장 중..." : "저장"}
          </button>
        </div>
      </form>
    </div>
  );
}

function EditEntryModal({
  entry,
  categories,
  onClose,
}: {
  entry: EntryVM;
  categories: CategoryVM[];
  onClose: () => void;
}) {
  const [content, setContent] = useState(entry.content);
  const [, startTransition] = useTransition();
  const [state, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await updateEntryAction(prev, formData);
    if (!result.error) onClose();
    return result;
  }, initialState);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div onClick={onClose} className="absolute inset-0" aria-hidden />
      <div className="relative z-10 flex w-full max-w-sm flex-col gap-3 rounded-lg bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">일정 수정</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-900">
            ✕
          </button>
        </div>
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="entryId" value={entry.id} />
          <CategorySelect
            categories={categories}
            defaultValue={entry.categoryId}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#0066cc]"
          />
          <div className="flex items-center gap-2">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs text-gray-400">시작일</span>
              <input
                name="date"
                type="date"
                defaultValue={entry.date}
                required
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#0066cc]"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs text-gray-400">종료일</span>
              <input
                name="endDate"
                type="date"
                defaultValue={entry.endDate}
                required
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#0066cc]"
              />
            </label>
          </div>
          <textarea
            name="content"
            autoFocus
            required
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="resize-none rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#0066cc]"
          />
          {state.error && <p className="text-sm text-red-600">{state.error}</p>}
          <div className="flex justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                if (confirm("이 일정을 삭제할까요?")) {
                  startTransition(() => deleteEntryAction(entry.id));
                  onClose();
                }
              }}
              className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
            >
              삭제
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-[#0066cc] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0071e3] disabled:opacity-60"
            >
              {pending ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
