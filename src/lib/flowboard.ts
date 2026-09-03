export type Status = "planned" | "doing" | "done";

export interface Task {
  id: string;
  title: string;
  status: Status;
  assignee: string;
  dateRange: string;
  description: string;
  x: number;
  y: number;
  /** id of the task (or null for a project-level root task) this branches off of. */
  parentId: string | null;
}

export interface Project {
  id: string;
  name: string;
  labelX: number;
  labelY: number;
  tasks: Task[];
}

export interface Marker {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  label: string;
}

export interface BoardState {
  projects: Project[];
  markers: Marker[];
  pan: { x: number; y: number };
  zoom: number;
}

export const STORAGE_KEY = "wonder-flowboard-v1";

export const MIN_ZOOM = 0.4;
export const MAX_ZOOM = 2;

export const PIXELS_PER_DAY = 32;

export const STATUS_LABEL: Record<Status, string> = {
  planned: "예정",
  doing: "진행중",
  done: "완료",
};

export const STATUS_DOT_CLASS: Record<Status, string> = {
  planned: "bg-gray-400",
  doing: "bg-amber-400",
  done: "bg-emerald-400",
};

let idCounter = 0;
function nextId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

export function createTask(partial?: Partial<Pick<Task, "x" | "y" | "parentId">>): Task {
  return {
    id: nextId("task"),
    title: "새 작업",
    status: "planned",
    assignee: "",
    dateRange: "",
    description: "",
    x: partial?.x ?? 0,
    y: partial?.y ?? 0,
    parentId: partial?.parentId ?? null,
  };
}

export function createProject(name: string, labelX: number, labelY: number): Project {
  return {
    id: nextId("project"),
    name,
    labelX,
    labelY,
    tasks: [],
  };
}

export function createMarker(date: string, label: string): Marker {
  return { id: nextId("marker"), date, label };
}

/** Parses a `YYYY-MM-DD` (e.g. from an `<input type="date">`) as a local-timezone date. */
export function parseDateInput(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function seedTask(
  title: string,
  status: Status,
  x: number,
  y: number,
  assignee: string,
  dateRange: string,
  parentId: string | null,
): Task {
  return { id: nextId("task"), title, status, assignee, dateRange, description: "", x, y, parentId };
}

function seedBoardState(): BoardState {
  const projectA = createProject("Project A", 40, 120);
  const a1 = seedTask("기획안 작성", "done", 260, 120, "서윤", "9월 1주", null);
  const a2 = seedTask("디자인 시안", "doing", 480, 120, "태희", "9월 2주", a1.id);
  const a3 = seedTask("개발 착수", "planned", 700, 160, "우찬", "9월 3주", a2.id);
  projectA.tasks = [a1, a2, a3];

  const projectB = createProject("Project B", 40, 320);
  projectB.tasks = [seedTask("요구사항 정리", "doing", 260, 320, "지윤", "9월 1주", null)];

  return {
    projects: [projectA, projectB],
    markers: [],
    pan: { x: 0, y: 0 },
    zoom: 1,
  };
}

/**
 * Old saved boards predate `parentId` and `markers`; infer a linear chain from
 * array order and default in an empty marker list so existing layouts don't break.
 */
function migrateBoardState(state: BoardState): BoardState {
  return {
    ...state,
    markers: Array.isArray(state.markers) ? state.markers : [],
    projects: state.projects.map((p) => ({
      ...p,
      tasks: p.tasks.map((t, i) => ({
        ...t,
        parentId: t.parentId !== undefined ? t.parentId : i === 0 ? null : p.tasks[i - 1].id,
      })),
    })),
  };
}

export function loadBoardState(): BoardState {
  if (typeof window === "undefined") return seedBoardState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedBoardState();
    const parsed = JSON.parse(raw) as BoardState;
    if (!parsed.projects || !Array.isArray(parsed.projects)) return seedBoardState();
    return migrateBoardState(parsed);
  } catch {
    return seedBoardState();
  }
}

export function saveBoardState(state: BoardState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function dayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function daysBetween(a: Date, b: Date) {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  return Math.round((dayStart(b).getTime() - dayStart(a).getTime()) / MS_PER_DAY);
}

export interface WeekSegment {
  startX: number;
  width: number;
  label: string;
}

export interface MonthSegment {
  startX: number;
  width: number;
  label: string;
}

export interface TimelineSegments {
  months: MonthSegment[];
  weeks: WeekSegment[];
  originDate: Date;
}

/**
 * Builds month/week header segments for a window of `totalDays` days starting
 * from a fixed anchor (8월 3주, i.e. August 15) of the current year rather than
 * a rolling window relative to today — keeps the board's date layout stable
 * from day to day. x=0 corresponds to the window start; the caller positions
 * the whole header (and the today line) using these offsets.
 */
export function getTimelineSegments(totalDays = 120): TimelineSegments {
  const originDate = dayStart(new Date(new Date().getFullYear(), 7, 15));

  const months: MonthSegment[] = [];
  const weeks: WeekSegment[] = [];

  let cursor = new Date(originDate);
  const end = new Date(originDate);
  end.setDate(end.getDate() + totalDays);

  let weekIndexInMonth = 1;
  let currentMonthKey = "";

  while (cursor < end) {
    const monthKey = `${cursor.getFullYear()}-${cursor.getMonth()}`;
    if (monthKey !== currentMonthKey) {
      currentMonthKey = monthKey;
      weekIndexInMonth = 1;
      const monthStartX = daysBetween(originDate, cursor) * PIXELS_PER_DAY;
      const monthDaysRemaining = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1).getTime() - cursor.getTime();
      const daysInThisMonthChunk = Math.min(
        Math.round(monthDaysRemaining / (1000 * 60 * 60 * 24)),
        daysBetween(cursor, end),
      );
      months.push({
        startX: monthStartX,
        width: daysInThisMonthChunk * PIXELS_PER_DAY,
        label: `${cursor.getMonth() + 1}월`,
      });
    }

    const weekStartX = daysBetween(originDate, cursor) * PIXELS_PER_DAY;
    const nextMonthStart = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    const daysLeftInMonth = daysBetween(cursor, nextMonthStart);
    const weekLength = Math.min(7, daysLeftInMonth, daysBetween(cursor, end));
    weeks.push({
      startX: weekStartX,
      width: weekLength * PIXELS_PER_DAY,
      label: `${weekIndexInMonth}주`,
    });
    weekIndexInMonth += 1;
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + weekLength);
  }

  return { months, weeks, originDate };
}

export function dateLineX(originDate: Date, date: Date) {
  return daysBetween(originDate, date) * PIXELS_PER_DAY;
}

export function todayLineX(originDate: Date) {
  return dateLineX(originDate, new Date());
}

export function dateAtX(originDate: Date, x: number): Date {
  const date = new Date(originDate);
  date.setDate(date.getDate() + Math.round(x / PIXELS_PER_DAY));
  return date;
}

export function formatShortDate(date: Date): string {
  return date.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
}

export function bezierPath(x1: number, y1: number, x2: number, y2: number) {
  const off = Math.max(50, Math.abs(x2 - x1) * 0.55);
  return `M ${x1} ${y1} C ${x1 + off} ${y1}, ${x2 - off} ${y2}, ${x2} ${y2}`;
}
