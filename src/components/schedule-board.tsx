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

type EntryStatus = "DONE" | "PLANNED";

interface EntryVM {
  id: string;
  date: string;
  content: string;
  status: EntryStatus;
  categoryId: string;
  categoryName: string;
}

interface CategoryVM {
  id: string;
  name: string;
}

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const CURRENT_CATEGORY_KEY = "wonder-schedule-current-category";
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
  // Read once on mount (this component is client-only, see
  // schedule-board-loader.tsx, so `window` is always available here). A
  // stale id whose category was since deleted is filtered out below rather
  // than cleared eagerly in an effect.
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(() =>
    window.localStorage.getItem(CURRENT_CATEGORY_KEY),
  );
  const [addingDate, setAddingDate] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  const currentCategoryId =
    selectedCategoryId && categories.some((c) => c.id === selectedCategoryId) ? selectedCategoryId : null;

  function selectCategory(id: string | null) {
    setSelectedCategoryId(id);
    if (id) window.localStorage.setItem(CURRENT_CATEGORY_KEY, id);
    else window.localStorage.removeItem(CURRENT_CATEGORY_KEY);
  }

  const entriesByDate = useMemo(() => {
    const map = new Map<string, EntryVM[]>();
    for (const entry of entries) {
      const list = map.get(entry.date);
      if (list) list.push(entry);
      else map.set(entry.date, [entry]);
    }
    return map;
  }, [entries]);

  const todayKey = toDateKey(new Date());
  const currentCategory = categories.find((c) => c.id === currentCategoryId) ?? null;
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
        <CategorySwitcher categories={categories} currentCategoryId={currentCategoryId} onSelect={selectCategory} />
        <div className="flex items-center gap-3 text-xs text-gray-600">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-gray-900" aria-hidden />
            완료된 일정
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-blue-600" aria-hidden />
            진행 예정 일정
          </span>
        </div>
      </div>

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
          <div key={toDateKey(week[0])} className="grid grid-cols-7 border-b border-gray-100 last:border-b-0">
            {week.map((day) => {
              const key = toDateKey(day);
              const inMonth = month === null || day.getMonth() === month;
              return (
                <DayCell
                  key={key}
                  day={day}
                  inMonth={inMonth}
                  isToday={key === todayKey}
                  entries={entriesByDate.get(key) ?? []}
                  canAdd={currentCategoryId !== null}
                  minHeight={view === "week" ? "12rem" : "7rem"}
                  onAdd={() => setAddingDate(key)}
                  onEditEntry={setEditingEntryId}
                />
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 md:hidden">
        {weeks.flat().map((day) => {
          const key = toDateKey(day);
          const isToday = key === todayKey;
          return (
            <MobileDayAccordion
              key={key}
              day={day}
              isToday={isToday}
              entries={entriesByDate.get(key) ?? []}
              canAdd={currentCategoryId !== null}
              defaultOpen={isToday}
              onAdd={() => setAddingDate(key)}
              onEditEntry={setEditingEntryId}
            />
          );
        })}
      </div>

      {addingDate && currentCategory && (
        <AddEntryModal date={addingDate} category={currentCategory} onClose={() => setAddingDate(null)} />
      )}

      {editingEntry && <EditEntryModal entry={editingEntry} onClose={() => setEditingEntryId(null)} />}
    </div>
  );
}

function DayCell({
  day,
  inMonth,
  isToday,
  entries,
  canAdd,
  minHeight,
  onAdd,
  onEditEntry,
}: {
  day: Date;
  inMonth: boolean;
  isToday: boolean;
  entries: EntryVM[];
  canAdd: boolean;
  minHeight: string;
  onAdd: () => void;
  onEditEntry: (id: string) => void;
}) {
  return (
    <div
      style={{ minHeight }}
      className={`flex flex-col gap-1 border-r border-gray-100 p-1.5 last:border-r-0 ${inMonth ? "bg-white" : "bg-gray-50"}`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
            isToday ? "bg-[#0066cc] font-semibold text-white" : inMonth ? "text-gray-900" : "text-gray-400"
          }`}
        >
          {day.getDate()}
        </span>
        <button
          type="button"
          onClick={onAdd}
          disabled={!canAdd}
          title={canAdd ? "일정 추가" : "먼저 상단에서 카테고리를 선택하세요"}
          aria-label="일정 추가"
          className="flex h-4 w-4 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30"
        >
          +
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
        <EntryList entries={entries} onEditEntry={onEditEntry} />
      </div>
    </div>
  );
}

function MobileDayAccordion({
  day,
  isToday,
  entries,
  canAdd,
  defaultOpen,
  onAdd,
  onEditEntry,
}: {
  day: Date;
  isToday: boolean;
  entries: EntryVM[];
  canAdd: boolean;
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
        <EntryList entries={entries} onEditEntry={onEditEntry} />
        <button
          type="button"
          onClick={onAdd}
          disabled={!canAdd}
          title={canAdd ? undefined : "먼저 상단에서 카테고리를 선택하세요"}
          className="mt-1 rounded-md border border-dashed border-gray-300 px-2 py-1.5 text-xs text-gray-500 hover:border-gray-400 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          + 일정 추가
        </button>
      </div>
    </details>
  );
}

// Groups entries by category, preserving each category's first-appearance
// order, so a day's entries cluster by category (JM, JM, Q10, ...) instead
// of the raw creation order they'd otherwise come back from the DB in.
function groupEntriesByCategory(entries: EntryVM[]): { categoryId: string; categoryName: string; entries: EntryVM[] }[] {
  const order: string[] = [];
  const groups = new Map<string, EntryVM[]>();
  for (const entry of entries) {
    if (!groups.has(entry.categoryId)) {
      groups.set(entry.categoryId, []);
      order.push(entry.categoryId);
    }
    groups.get(entry.categoryId)!.push(entry);
  }
  return order.map((categoryId) => ({
    categoryId,
    categoryName: groups.get(categoryId)![0].categoryName,
    entries: groups.get(categoryId)!,
  }));
}

function EntryList({ entries, onEditEntry }: { entries: EntryVM[]; onEditEntry: (id: string) => void }) {
  return (
    <>
      {groupEntriesByCategory(entries).map((group) => (
        <div key={group.categoryId} className="flex flex-col gap-0.5">
          <span className="px-1.5 text-[10px] font-semibold text-gray-500">{group.categoryName}</span>
          {group.entries.map((entry) => (
            <EntryContentRow key={entry.id} entry={entry} onClick={() => onEditEntry(entry.id)} />
          ))}
        </div>
      ))}
    </>
  );
}

function EntryContentRow({ entry, onClick }: { entry: EntryVM; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-1 rounded px-1.5 py-0.5 text-left text-[11px] hover:bg-gray-100"
    >
      <span
        className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${entry.status === "DONE" ? "bg-gray-900" : "bg-blue-600"}`}
        aria-hidden
      />
      <span className={`line-clamp-2 ${entry.status === "DONE" ? "text-gray-900" : "text-blue-700"}`}>
        {entry.content}
      </span>
    </button>
  );
}

function StatusToggle({ status, onChange }: { status: EntryStatus; onChange: (s: EntryStatus) => void }) {
  return (
    <div className="flex gap-1.5">
      <button
        type="button"
        onClick={() => onChange("DONE")}
        className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium ${
          status === "DONE" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
        }`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
        완료
      </button>
      <button
        type="button"
        onClick={() => onChange("PLANNED")}
        className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium ${
          status === "PLANNED" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
        }`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
        예정
      </button>
    </div>
  );
}

function CategorySwitcher({
  categories,
  currentCategoryId,
  onSelect,
}: {
  categories: CategoryVM[];
  currentCategoryId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [managing, setManaging] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [, startTransition] = useTransition();
  const [state, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await createCategoryAction(prev, formData);
    if (!result.error) formRef.current?.reset();
    return result;
  }, initialState);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-gray-500">카테고리:</span>
      <select
        value={currentCategoryId ?? ""}
        onChange={(e) => onSelect(e.target.value || null)}
        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 outline-none focus:border-[#0066cc]"
      >
        <option value="">선택 안 함</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => setManaging((v) => !v)}
        className="text-xs text-gray-500 underline decoration-dotted hover:text-gray-700"
      >
        카테고리 관리
      </button>
      {managing && (
        <div className="flex flex-wrap items-center gap-2">
          <form ref={formRef} action={formAction} className="flex items-center gap-1">
            <input
              name="name"
              placeholder="새 카테고리 이름"
              required
              className="w-32 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#0066cc]"
            />
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-[#0066cc] px-2 py-1 text-xs text-white hover:bg-[#0071e3] disabled:opacity-60"
            >
              추가
            </button>
          </form>
          {categories.map((c) => (
            <span key={c.id} className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
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
      )}
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
    </div>
  );
}

function AddEntryModal({ date, category, onClose }: { date: string; category: CategoryVM; onClose: () => void }) {
  const [status, setStatus] = useState<EntryStatus>("PLANNED");
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
          <h3 className="text-sm font-semibold text-gray-900">
            {new Date(`${date}T00:00:00`).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })} ·{" "}
            {category.name}
          </h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-900">
            ✕
          </button>
        </div>
        <input type="hidden" name="categoryId" value={category.id} />
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="status" value={status} />
        <textarea
          name="content"
          autoFocus
          required
          rows={4}
          placeholder="일정 내용을 적어주세요"
          className="resize-none rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#0066cc]"
        />
        <StatusToggle status={status} onChange={setStatus} />
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

function EditEntryModal({ entry, onClose }: { entry: EntryVM; onClose: () => void }) {
  const [content, setContent] = useState(entry.content);
  const [status, setStatus] = useState<EntryStatus>(entry.status);
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
          <h3 className="text-sm font-semibold text-gray-900">
            {new Date(`${entry.date}T00:00:00`).toLocaleDateString("ko-KR", {
              month: "long",
              day: "numeric",
              weekday: "short",
            })}{" "}
            · {entry.categoryName}
          </h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-900">
            ✕
          </button>
        </div>
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="entryId" value={entry.id} />
          <input type="hidden" name="status" value={status} />
          <textarea
            name="content"
            autoFocus
            required
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="resize-none rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#0066cc]"
          />
          <StatusToggle status={status} onChange={setStatus} />
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
