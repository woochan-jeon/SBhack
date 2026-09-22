export type Status = "planned" | "doing" | "done";

export interface Task {
  id: string;
  title: string;
  status: Status;
  assignee: string;
  /** Freeform note/tag shown on the card (e.g. "우선순위 높음") — no date meaning. */
  note: string;
  description: string;
  x: number;
  y: number;
  /** id of the task (or null for a project-level root task) this branches off of. */
  parentId: string | null;
  /** ids of additional tasks (in the same project) that merge into this task, alongside `parentId`. */
  extraParentIds: string[];
}

export interface Project {
  id: string;
  name: string;
  labelX: number;
  labelY: number;
  tasks: Task[];
}

/** A freeform sticky note pinned anywhere on the canvas (e.g. a milestone label) — no date attached. */
export interface Note {
  id: string;
  x: number;
  y: number;
  text: string;
}

/** A cross-project link between two tasks, drawn from one task's bottom edge to another's. */
export interface CrossLink {
  id: string;
  fromTaskId: string;
  toTaskId: string;
}

export interface BoardState {
  projects: Project[];
  notes: Note[];
  links: CrossLink[];
  pan: { x: number; y: number };
  zoom: number;
}

export const MIN_ZOOM = 0.4;
export const MAX_ZOOM = 2;

/** Drag-snap grid size in canvas pixels (purely a visual alignment aid, unrelated to time). */
export const GRID_SIZE = 96;

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
    note: "",
    description: "",
    x: partial?.x ?? 0,
    y: partial?.y ?? 0,
    parentId: partial?.parentId ?? null,
    extraParentIds: [],
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

export function createNote(x: number, y: number, text: string): Note {
  return { id: nextId("note"), x, y, text };
}

export function createLink(fromTaskId: string, toTaskId: string): CrossLink {
  return { id: nextId("link"), fromTaskId, toTaskId };
}

function seedTask(
  title: string,
  status: Status,
  x: number,
  y: number,
  assignee: string,
  note: string,
  parentId: string | null,
): Task {
  return { id: nextId("task"), title, status, assignee, note, description: "", x, y, parentId, extraParentIds: [] };
}

export function seedBoardState(): BoardState {
  const projectA = createProject("Project A", 40, 120);
  const a1 = seedTask("기획안 작성", "done", 260, 120, "서윤", "", null);
  const a2 = seedTask("디자인 시안", "doing", 480, 120, "태희", "검토 필요", a1.id);
  const a3 = seedTask("개발 착수", "planned", 700, 160, "우찬", "", a2.id);
  projectA.tasks = [a1, a2, a3];

  const projectB = createProject("Project B", 40, 320);
  projectB.tasks = [seedTask("요구사항 정리", "doing", 260, 320, "지윤", "", null)];

  return {
    projects: [projectA, projectB],
    notes: [],
    links: [],
    pan: { x: 0, y: 0 },
    zoom: 1,
  };
}

/**
 * Old saved boards may predate `parentId`, cross-project `links`, merge
 * `extraParentIds`, the `notes` array (previously date-based `markers`), or
 * have tasks with the old `dateRange` field instead of `note` — reshape them
 * into the current shape so existing layouts don't break or lose data.
 */
export function migrateBoardState(state: BoardState): BoardState {
  const legacyState = state as BoardState & { markers?: { id: string; label: string }[] };
  const notes: Note[] = Array.isArray(state.notes)
    ? state.notes
    : Array.isArray(legacyState.markers)
      ? legacyState.markers.map((m, i) => ({ id: m.id, x: 40 + i * 220, y: -80, text: m.label }))
      : [];

  return {
    projects: state.projects.map((p) => ({
      ...p,
      tasks: p.tasks.map((t, i) => {
        const { dateRange, ...rest } = t as Task & { dateRange?: string };
        return {
          ...rest,
          note: typeof rest.note === "string" ? rest.note : (dateRange ?? ""),
          parentId: t.parentId !== undefined ? t.parentId : i === 0 ? null : p.tasks[i - 1].id,
          extraParentIds: Array.isArray(t.extraParentIds) ? t.extraParentIds : [],
        };
      }),
    })),
    notes,
    links: Array.isArray(state.links) ? state.links : [],
    pan: state.pan,
    zoom: state.zoom,
  };
}

export function bezierPath(x1: number, y1: number, x2: number, y2: number) {
  const off = Math.max(50, Math.abs(x2 - x1) * 0.55);
  return `M ${x1} ${y1} C ${x1 + off} ${y1}, ${x2 - off} ${y2}, ${x2} ${y2}`;
}

/** Vertical bezier from a task's bottom edge down/into another task, for cross-project links. */
export function verticalBezierPath(x1: number, y1: number, x2: number, y2: number) {
  const off = Math.max(40, Math.abs(y2 - y1) * 0.5);
  return `M ${x1} ${y1} C ${x1} ${y1 + off}, ${x2} ${y2 - off}, ${x2} ${y2}`;
}
