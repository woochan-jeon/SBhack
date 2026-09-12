"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  bezierPath,
  createLink,
  createMarker,
  createProject,
  createTask,
  dateAtX,
  dateLineX,
  dayStart,
  formatShortDate,
  getTimelineSegments,
  parseDateInput,
  verticalBezierPath,
  MAX_ZOOM,
  MIN_ZOOM,
  PIXELS_PER_DAY,
  STATUS_DOT_CLASS,
  STATUS_LABEL,
  type BoardState,
  type Project,
  type Status,
  type Task,
} from "@/lib/flowboard";
import { saveBoardStateAction } from "@/app/(app)/flowboard/actions";

const PROJECT_WIDTH = 150;
const PROJECT_HEIGHT = 48;
const TASK_WIDTH = 134;
const TASK_HEIGHT = 45;

function clampZoom(z: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

export default function FlowBoard({ initialState }: { initialState: BoardState }) {
  const [board, setBoard] = useState<BoardState>(initialState);
  const [pan, setPan] = useState(() => board.pan);
  const [zoom, setZoom] = useState(() => board.zoom);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [showAddProject, setShowAddProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState("");
  const [showAddMarker, setShowAddMarker] = useState(false);
  const [newMarkerDate, setNewMarkerDate] = useState("");
  const [newMarkerLabel, setNewMarkerLabel] = useState("");
  const [linkDrag, setLinkDrag] = useState<{ fromTaskId: string; x: number; y: number } | null>(null);
  const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null);
  const [hoveredMergeId, setHoveredMergeId] = useState<string | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(1200);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => setViewportWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      saveBoardStateAction({ ...board, pan, zoom }).catch(() => {});
    }, 500);
    return () => clearTimeout(timer);
  }, [board, pan, zoom]);

  const applyZoom = useCallback((anchor: { x: number; y: number }, factor: number) => {
    setZoom((prevZoom) => {
      const newZoom = clampZoom(prevZoom * factor);
      const ratio = newZoom / prevZoom;
      setPan((prevPan) => ({
        x: anchor.x - (anchor.x - prevPan.x) * ratio,
        y: anchor.y - (anchor.y - prevPan.y) * ratio,
      }));
      return newZoom;
    });
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const anchor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const factor = Math.exp(-e.deltaY * 0.0015);
      applyZoom(anchor, factor);
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [applyZoom]);

  const { months, weeks, originDate } = useMemo(() => getTimelineSegments(), []);

  // The "오늘" line must track the real calendar date even if this tab is left
  // open across midnight, so it's kept in state and re-checked periodically
  // rather than computed once with `new Date()` at mount. Background tabs get
  // their timers throttled by the browser, so the interval alone can lag for
  // a while after the tab was hidden; recheck immediately on refocus too.
  const [today, setToday] = useState(() => dayStart(new Date()));
  useEffect(() => {
    const recheckToday = () => {
      setToday((prev) => {
        const now = dayStart(new Date());
        return now.getTime() === prev.getTime() ? prev : now;
      });
    };
    const id = setInterval(recheckToday, 60_000);
    document.addEventListener("visibilitychange", recheckToday);
    window.addEventListener("focus", recheckToday);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", recheckToday);
      window.removeEventListener("focus", recheckToday);
    };
  }, []);
  const todayX = useMemo(() => dateLineX(originDate, today), [originDate, today]);

  const dayGridLines: number[] = [];
  if (draggingTaskId) {
    const worldStart = -pan.x / zoom;
    const worldEnd = (viewportWidth - pan.x) / zoom;
    const firstLine = Math.floor(worldStart / PIXELS_PER_DAY) * PIXELS_PER_DAY;
    for (let x = firstLine; x <= worldEnd; x += PIXELS_PER_DAY) dayGridLines.push(x);
  }

  const draggingTask = draggingTaskId
    ? board.projects.flatMap((p) => p.tasks).find((t) => t.id === draggingTaskId) ?? null
    : null;

  const linkDragFromTask = linkDrag
    ? board.projects.flatMap((p) => p.tasks).find((t) => t.id === linkDrag.fromTaskId) ?? null
    : null;

  const updateBoard = useCallback((updater: (b: BoardState) => BoardState) => {
    setBoard((prev) => (prev ? updater(prev) : prev));
  }, []);

  const connections = useMemo(() => {
    const paths: { id: string; d: string }[] = [];
    for (const project of board.projects) {
      const projectAnchor = { x: project.labelX + PROJECT_WIDTH, y: project.labelY + PROJECT_HEIGHT / 2 };
      for (const task of project.tasks) {
        const parent = task.parentId ? project.tasks.find((t) => t.id === task.parentId) : null;
        const anchor = parent ? { x: parent.x + TASK_WIDTH, y: parent.y + TASK_HEIGHT / 2 } : projectAnchor;
        const target = { x: task.x, y: task.y + TASK_HEIGHT / 2 };
        paths.push({ id: `${project.id}-${task.id}`, d: bezierPath(anchor.x, anchor.y, target.x, target.y) });
      }
    }
    return paths;
  }, [board]);

  const crossLinkPaths = useMemo(() => {
    const allTasks = board.projects.flatMap((p) => p.tasks);
    const paths: { id: string; d: string; midX: number; midY: number }[] = [];
    for (const link of board.links) {
      const from = allTasks.find((t) => t.id === link.fromTaskId);
      const to = allTasks.find((t) => t.id === link.toTaskId);
      if (!from || !to) continue;
      const x1 = from.x + TASK_WIDTH / 2;
      const y1 = from.y + TASK_HEIGHT;
      const x2 = to.x + TASK_WIDTH / 2;
      const y2 = to.y;
      paths.push({ id: link.id, d: verticalBezierPath(x1, y1, x2, y2), midX: (x1 + x2) / 2, midY: (y1 + y2) / 2 });
    }
    return paths;
  }, [board.projects, board.links]);

  /** Extra branch curves for tasks that merge in more than one parent (in addition to the primary `parentId`). */
  const mergePaths = useMemo(() => {
    const paths: { id: string; d: string; midX: number; midY: number; taskId: string; parentId: string }[] = [];
    for (const project of board.projects) {
      for (const task of project.tasks) {
        for (const parentId of task.extraParentIds) {
          const parent = project.tasks.find((t) => t.id === parentId);
          if (!parent) continue;
          const x1 = parent.x + TASK_WIDTH;
          const y1 = parent.y + TASK_HEIGHT / 2;
          const x2 = task.x;
          const y2 = task.y + TASK_HEIGHT / 2;
          paths.push({
            id: `merge-${task.id}-${parentId}`,
            d: bezierPath(x1, y1, x2, y2),
            midX: (x1 + x2) / 2,
            midY: (y1 + y2) / 2,
            taskId: task.id,
            parentId,
          });
        }
      }
    }
    return paths;
  }, [board.projects]);

  /** Walks up `parentId`/`extraParentIds` from `startTaskId`; true if `candidateAncestorId` is reachable. */
  function isAncestor(startTaskId: string, candidateAncestorId: string, tasks: Task[]): boolean {
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const queue = [startTaskId];
    const seen = new Set<string>();
    while (queue.length) {
      const id = queue.shift()!;
      if (id === candidateAncestorId) return true;
      if (seen.has(id)) continue;
      seen.add(id);
      const t = byId.get(id);
      if (!t) continue;
      if (t.parentId) queue.push(t.parentId);
      queue.push(...t.extraParentIds);
    }
    return false;
  }

  let selected: { project: Project; task: Task } | null = null;
  if (selectedTaskId) {
    for (const project of board.projects) {
      const task = project.tasks.find((t) => t.id === selectedTaskId);
      if (task) {
        selected = { project, task };
        break;
      }
    }
  }

  function onBackgroundMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const origPan = pan;
    function onMove(ev: MouseEvent) {
      setPan({ x: origPan.x + (ev.clientX - startX), y: origPan.y + (ev.clientY - startY) });
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function handleTaskMouseDown(e: React.MouseEvent, projectId: string, task: Task) {
    e.stopPropagation();
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = task.x;
    const origY = task.y;
    let moved = false;
    function onMove(ev: MouseEvent) {
      const dx = (ev.clientX - startX) / zoom;
      const dy = (ev.clientY - startY) / zoom;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        if (!moved) setDraggingTaskId(task.id);
        moved = true;
      }
      const snappedX = Math.round((origX + dx) / PIXELS_PER_DAY) * PIXELS_PER_DAY;
      updateBoard((b) => ({
        ...b,
        projects: b.projects.map((p) =>
          p.id !== projectId
            ? p
            : { ...p, tasks: p.tasks.map((t) => (t.id !== task.id ? t : { ...t, x: snappedX, y: origY + dy })) },
        ),
      }));
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setDraggingTaskId(null);
      if (!moved) setSelectedTaskId(task.id);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function handleLinkHandleMouseDown(e: React.MouseEvent, task: Task) {
    e.stopPropagation();
    if (e.button !== 0) return;
    const viewportEl = viewportRef.current;
    if (!viewportEl) return;
    setLinkDrag({ fromTaskId: task.id, x: task.x + TASK_WIDTH / 2, y: task.y + TASK_HEIGHT });
    function onMove(ev: MouseEvent) {
      const rect = viewportEl!.getBoundingClientRect();
      setLinkDrag({
        fromTaskId: task.id,
        x: (ev.clientX - rect.left - pan.x) / zoom,
        y: (ev.clientY - rect.top - pan.y) / zoom,
      });
    }
    function onUp(ev: MouseEvent) {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setLinkDrag(null);
      const dropEl = document.elementFromPoint(ev.clientX, ev.clientY);
      const targetTaskId = dropEl?.closest<HTMLElement>("[data-task-id]")?.dataset.taskId;
      if (targetTaskId && targetTaskId !== task.id) {
        const sourceProject = board.projects.find((p) => p.tasks.some((t) => t.id === task.id));
        const sameProject = sourceProject?.tasks.some((t) => t.id === targetTaskId) ?? false;
        if (sameProject) {
          handleCreateMerge(task.id, targetTaskId);
        } else {
          handleCreateLink(task.id, targetTaskId);
        }
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function handleCreateLink(fromTaskId: string, toTaskId: string) {
    updateBoard((b) => {
      const alreadyLinked = b.links.some(
        (l) =>
          (l.fromTaskId === fromTaskId && l.toTaskId === toTaskId) ||
          (l.fromTaskId === toTaskId && l.toTaskId === fromTaskId),
      );
      if (alreadyLinked) return b;
      return { ...b, links: [...b.links, createLink(fromTaskId, toTaskId)] };
    });
  }

  function handleDeleteLink(linkId: string) {
    updateBoard((b) => ({ ...b, links: b.links.filter((l) => l.id !== linkId) }));
    setHoveredLinkId(null);
  }

  /** Merges `fromTaskId`'s branch into `toTaskId` (both in the same project) as an additional parent. */
  function handleCreateMerge(fromTaskId: string, toTaskId: string) {
    updateBoard((b) => {
      let changed = false;
      const projects = b.projects.map((p) => {
        const toTask = p.tasks.find((t) => t.id === toTaskId);
        const fromTask = p.tasks.find((t) => t.id === fromTaskId);
        if (!toTask || !fromTask) return p;
        if (toTask.parentId === fromTaskId || toTask.extraParentIds.includes(fromTaskId)) return p;
        // Adding this edge would create a cycle if `toTask` already precedes `fromTask`.
        if (isAncestor(fromTaskId, toTaskId, p.tasks)) return p;
        changed = true;
        return {
          ...p,
          tasks: p.tasks.map((t) =>
            t.id !== toTaskId ? t : { ...t, extraParentIds: [...t.extraParentIds, fromTaskId] },
          ),
        };
      });
      return changed ? { ...b, projects } : b;
    });
  }

  function handleDeleteMerge(taskId: string, parentTaskId: string) {
    updateBoard((b) => ({
      ...b,
      projects: b.projects.map((p) => ({
        ...p,
        tasks: p.tasks.map((t) =>
          t.id !== taskId ? t : { ...t, extraParentIds: t.extraParentIds.filter((id) => id !== parentTaskId) },
        ),
      })),
    }));
    setHoveredMergeId(null);
  }

  function handleProjectMouseDown(e: React.MouseEvent, project: Project) {
    e.stopPropagation();
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = project.labelX;
    const origY = project.labelY;
    const origTaskPositions = new Map(project.tasks.map((t) => [t.id, { x: t.x, y: t.y }]));
    let moved = false;
    function onMove(ev: MouseEvent) {
      const dx = (ev.clientX - startX) / zoom;
      const dy = (ev.clientY - startY) / zoom;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
      updateBoard((b) => ({
        ...b,
        projects: b.projects.map((p) =>
          p.id !== project.id
            ? p
            : {
                ...p,
                labelX: origX + dx,
                labelY: origY + dy,
                tasks: p.tasks.map((t) => {
                  const orig = origTaskPositions.get(t.id);
                  return orig ? { ...t, x: orig.x + dx, y: orig.y + dy } : t;
                }),
              },
        ),
      }));
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (!moved) {
        setEditingProjectId(project.id);
        setEditingProjectName(project.name);
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function handleAddTask(project: Project, parentId: string | null, anchorX: number, anchorY: number) {
    const siblings = project.tasks.filter((t) => t.parentId === parentId);
    const x = anchorX + 90;
    const y = anchorY + siblings.length * (TASK_HEIGHT + 24);
    const task = createTask({ x, y, parentId });
    updateBoard((b) => ({
      ...b,
      projects: b.projects.map((p) => (p.id !== project.id ? p : { ...p, tasks: [...p.tasks, task] })),
    }));
    setSelectedTaskId(task.id);
  }

  function handleAddProject(name: string) {
    const maxY = board.projects.reduce((m, p) => Math.max(m, p.labelY), 40);
    const project = createProject(name.trim() || "새 프로젝트", 40, maxY + 140);
    updateBoard((b) => ({ ...b, projects: [...b.projects, project] }));
  }

  function handleRenameProject(projectId: string, name: string) {
    const trimmed = name.trim();
    updateBoard((b) => ({
      ...b,
      projects: b.projects.map((p) => (p.id !== projectId ? p : { ...p, name: trimmed || p.name })),
    }));
  }

  function handleDeleteProject(project: Project) {
    if (!confirm(`"${project.name}" 프로젝트를 삭제할까요? 하위 작업도 함께 삭제됩니다.`)) return;
    if (project.tasks.some((t) => t.id === selectedTaskId)) setSelectedTaskId(null);
    const removedTaskIds = new Set(project.tasks.map((t) => t.id));
    updateBoard((b) => ({
      ...b,
      projects: b.projects.filter((p) => p.id !== project.id),
      links: b.links.filter((l) => !removedTaskIds.has(l.fromTaskId) && !removedTaskIds.has(l.toTaskId)),
    }));
  }

  function handleAddMarker(dateValue: string, label: string) {
    if (!dateValue) return;
    const marker = createMarker(dateValue, label.trim() || formatShortDate(parseDateInput(dateValue)));
    updateBoard((b) => ({ ...b, markers: [...b.markers, marker] }));
  }

  function handleDeleteMarker(markerId: string) {
    updateBoard((b) => ({ ...b, markers: b.markers.filter((m) => m.id !== markerId) }));
  }

  function handleDeleteTask(projectId: string, taskId: string) {
    updateBoard((b) => ({
      ...b,
      projects: b.projects.map((p) => {
        if (p.id !== projectId) return p;
        const deleted = p.tasks.find((t) => t.id === taskId);
        const newParentId = deleted ? deleted.parentId : null;
        return {
          ...p,
          tasks: p.tasks
            .filter((t) => t.id !== taskId)
            .map((t) => ({
              ...t,
              parentId: t.parentId === taskId ? newParentId : t.parentId,
              extraParentIds: t.extraParentIds.filter((id) => id !== taskId),
            })),
        };
      }),
      links: b.links.filter((l) => l.fromTaskId !== taskId && l.toTaskId !== taskId),
    }));
    setSelectedTaskId(null);
  }

  function handleUpdateTask(projectId: string, taskId: string, patch: Partial<Task>) {
    updateBoard((b) => ({
      ...b,
      projects: b.projects.map((p) =>
        p.id !== projectId ? p : { ...p, tasks: p.tasks.map((t) => (t.id !== taskId ? t : { ...t, ...patch })) },
      ),
    }));
  }

  function handleZoomButtonClick(factor: number) {
    const rect = viewportRef.current?.getBoundingClientRect();
    applyZoom({ x: (rect?.width ?? 0) / 2, y: (rect?.height ?? 0) / 2 }, factor);
  }

  function resetView() {
    const rect = viewportRef.current?.getBoundingClientRect();
    const width = rect?.width ?? 800;
    const height = rect?.height ?? 600;
    setZoom(1);
    setPan({ x: width / 2 - todayX, y: height / 2 - 200 });
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3">
        <div className="pointer-events-auto flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 text-gray-900 shadow-sm">
          <button
            onClick={() => handleZoomButtonClick(1 / 1.15)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-sm hover:bg-gray-100"
            title="축소"
          >
            −
          </button>
          <span className="w-10 text-center text-xs text-gray-500">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => handleZoomButtonClick(1.15)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-sm hover:bg-gray-100"
            title="확대"
          >
            +
          </button>
          <button
            onClick={resetView}
            className="ml-1 rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
          >
            오늘로 이동
          </button>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          {showAddMarker ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newMarkerDate) {
                  handleAddMarker(newMarkerDate, newMarkerLabel);
                  setNewMarkerDate("");
                  setNewMarkerLabel("");
                  setShowAddMarker(false);
                }
              }}
              className="flex items-center gap-1"
            >
              <input
                type="date"
                autoFocus
                required
                value={newMarkerDate}
                onChange={(e) => setNewMarkerDate(e.target.value)}
                className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 outline-none focus:border-[#7c3aed]"
              />
              <input
                value={newMarkerLabel}
                onChange={(e) => setNewMarkerLabel(e.target.value)}
                placeholder="라벨 (예: 마감일)"
                className="w-24 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#7c3aed]"
              />
              <button
                type="submit"
                className="rounded-full bg-[#7c3aed] px-2.5 py-1 text-xs text-white hover:bg-[#6d28d9]"
              >
                추가
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddMarker(false);
                  setNewMarkerDate("");
                  setNewMarkerLabel("");
                }}
                className="rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
              >
                취소
              </button>
            </form>
          ) : (
            <button
              onClick={() => setShowAddMarker(true)}
              title="날짜 마커 추가"
              aria-label="날짜 마커 추가"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50"
            >
              🚩
            </button>
          )}
          {showAddProject ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newProjectName.trim()) {
                  handleAddProject(newProjectName);
                  setNewProjectName("");
                  setShowAddProject(false);
                }
              }}
              className="flex items-center gap-1"
            >
              <input
                autoFocus
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="프로젝트 이름"
                className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#0066cc]"
              />
              <button
                type="submit"
                className="rounded-full bg-[#0066cc] px-2.5 py-1 text-xs text-white hover:bg-[#0071e3]"
              >
                추가
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddProject(false);
                  setNewProjectName("");
                }}
                className="rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
              >
                취소
              </button>
            </form>
          ) : (
            <button
              onClick={() => setShowAddProject(true)}
              title="새 프로젝트 추가"
              aria-label="새 프로젝트 추가"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0066cc] text-base font-medium text-white hover:bg-[#0071e3]"
            >
              +
            </button>
          )}
        </div>
      </div>

      <div
        ref={viewportRef}
        onMouseDown={onBackgroundMouseDown}
        className="relative flex-1 cursor-grab overflow-hidden active:cursor-grabbing"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.08) 1px, transparent 1px)",
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      >
        <div
          className="select-none"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
        >
          {months.map((m) => (
            <div
              key={`m-${m.startX}`}
              style={{ position: "absolute", left: m.startX, top: 0, width: m.width }}
              className="border-l border-gray-200 pl-2 pt-1 text-base font-semibold text-gray-700"
            >
              {m.label}
            </div>
          ))}
          {weeks.map((w, i) => (
            <div
              key={`w-${i}`}
              style={{ position: "absolute", left: w.startX, top: 28, width: w.width }}
              className="border-l border-gray-100 pl-1 text-sm text-gray-400"
            >
              {w.label}
            </div>
          ))}

          {draggingTaskId &&
            dayGridLines.map((x) => (
              <div
                key={`day-${x}`}
                style={{ position: "absolute", left: x, top: -40, width: 1, height: 4000 }}
                className="bg-gray-200"
              />
            ))}

          {draggingTask && (
            <div
              style={{
                position: "absolute",
                left: draggingTask.x + TASK_WIDTH / 2,
                top: draggingTask.y - 34,
                transform: "translateX(-50%)",
              }}
              className="whitespace-nowrap rounded-full bg-gray-900 px-2.5 py-1 text-xs font-medium text-white shadow-lg"
            >
              {formatShortDate(dateAtX(originDate, draggingTask.x))}
            </div>
          )}

          <div
            style={{ position: "absolute", left: todayX, top: -40, width: 1, height: 2000 }}
            className="bg-rose-500/70"
          />
          <div
            style={{ position: "absolute", left: todayX + 4, top: -38 }}
            className="text-sm font-semibold text-rose-600"
          >
            오늘
          </div>

          {board.markers.map((marker) => {
            const x = dateLineX(originDate, parseDateInput(marker.date));
            return (
              <div key={marker.id} className="group" style={{ position: "absolute", left: x, top: -40 }}>
                <div style={{ position: "absolute", top: 0, width: 1, height: 2000 }} className="bg-indigo-400/70" />
                <div className="absolute left-1 top-0 flex items-center gap-1 whitespace-nowrap">
                  <span className="rounded-full bg-indigo-500 px-2 py-0.5 text-xs font-medium text-white">
                    {marker.label}
                  </span>
                  <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => handleDeleteMarker(marker.id)}
                    className="hidden h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] text-gray-400 hover:text-red-600 group-hover:flex"
                    title="마커 삭제"
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })}

          <svg className="absolute left-0 top-0 overflow-visible" width={1} height={1}>
            {connections.map((c) => (
              <path key={c.id} d={c.d} fill="none" stroke="rgba(100,116,139,0.55)" strokeWidth={2} />
            ))}
            {mergePaths.map((m) => (
              <g key={m.id}>
                <path
                  d={m.d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={14}
                  style={{ pointerEvents: "stroke", cursor: "pointer" }}
                  onMouseEnter={() => setHoveredMergeId(m.id)}
                  onMouseLeave={() => setHoveredMergeId((id) => (id === m.id ? null : id))}
                />
                <path
                  d={m.d}
                  fill="none"
                  stroke={hoveredMergeId === m.id ? "rgba(16,185,129,0.9)" : "rgba(100,116,139,0.55)"}
                  strokeWidth={2}
                  style={{ pointerEvents: "none" }}
                />
              </g>
            ))}
            {crossLinkPaths.map((l) => (
              <g key={l.id}>
                <path
                  d={l.d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={14}
                  style={{ pointerEvents: "stroke", cursor: "pointer" }}
                  onMouseEnter={() => setHoveredLinkId(l.id)}
                  onMouseLeave={() => setHoveredLinkId((id) => (id === l.id ? null : id))}
                />
                <path
                  d={l.d}
                  fill="none"
                  stroke="#7c3aed"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  style={{ pointerEvents: "none" }}
                />
              </g>
            ))}
            {linkDrag && linkDragFromTask && (
              <path
                d={verticalBezierPath(
                  linkDragFromTask.x + TASK_WIDTH / 2,
                  linkDragFromTask.y + TASK_HEIGHT,
                  linkDrag.x,
                  linkDrag.y,
                )}
                fill="none"
                stroke="#7c3aed"
                strokeWidth={2}
                strokeDasharray="4 4"
                style={{ pointerEvents: "none" }}
              />
            )}
          </svg>
          {crossLinkPaths.map(
            (l) =>
              hoveredLinkId === l.id && (
                <button
                  key={`del-${l.id}`}
                  onMouseDown={(e) => e.stopPropagation()}
                  onMouseEnter={() => setHoveredLinkId(l.id)}
                  onMouseLeave={() => setHoveredLinkId((id) => (id === l.id ? null : id))}
                  onClick={() => handleDeleteLink(l.id)}
                  style={{ position: "absolute", left: l.midX - 8, top: l.midY - 8, width: 16, height: 16 }}
                  className="flex items-center justify-center rounded-full border border-gray-300 bg-white text-[10px] text-gray-400 shadow-sm hover:text-red-600"
                  title="연결 삭제"
                >
                  ×
                </button>
              ),
          )}
          {mergePaths.map(
            (m) =>
              hoveredMergeId === m.id && (
                <button
                  key={`del-${m.id}`}
                  onMouseDown={(e) => e.stopPropagation()}
                  onMouseEnter={() => setHoveredMergeId(m.id)}
                  onMouseLeave={() => setHoveredMergeId((id) => (id === m.id ? null : id))}
                  onClick={() => handleDeleteMerge(m.taskId, m.parentId)}
                  style={{ position: "absolute", left: m.midX - 8, top: m.midY - 8, width: 16, height: 16 }}
                  className="flex items-center justify-center rounded-full border border-gray-300 bg-white text-[10px] text-gray-400 shadow-sm hover:text-red-600"
                  title="병합 해제"
                >
                  ×
                </button>
              ),
          )}

          {board.projects.map((project) => (
            <div
              key={project.id}
              onMouseDown={(e) => handleProjectMouseDown(e, project)}
              style={{
                position: "absolute",
                left: project.labelX,
                top: project.labelY,
                width: PROJECT_WIDTH,
                height: PROJECT_HEIGHT,
              }}
              className="group relative flex cursor-grab select-none items-center gap-2 rounded-lg border border-[#0066cc]/40 bg-[#0066cc]/10 px-3 text-sm font-semibold text-[#0066cc] shadow-sm"
            >
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => handleDeleteProject(project)}
                className="absolute -right-2 -top-2 hidden h-5 w-5 items-center justify-center rounded-full border border-gray-300 bg-white text-xs text-gray-400 shadow-sm hover:border-red-300 hover:text-red-600 group-hover:flex"
                title="프로젝트 삭제"
              >
                ×
              </button>
              <span aria-hidden>📁</span>
              {editingProjectId === project.id ? (
                <input
                  autoFocus
                  value={editingProjectName}
                  onChange={(e) => setEditingProjectName(e.target.value)}
                  onMouseDown={(e) => e.stopPropagation()}
                  onBlur={() => {
                    handleRenameProject(project.id, editingProjectName);
                    setEditingProjectId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleRenameProject(project.id, editingProjectName);
                      setEditingProjectId(null);
                    } else if (e.key === "Escape") {
                      setEditingProjectId(null);
                    }
                  }}
                  className="min-w-0 flex-1 cursor-text rounded border border-[#0066cc]/50 bg-white px-1 py-0.5 text-sm font-semibold text-[#0066cc] outline-none"
                />
              ) : (
                <span className="truncate">{project.name}</span>
              )}
            </div>
          ))}

          {board.projects.flatMap((project) =>
            project.tasks.map((task) => (
              <div
                key={task.id}
                data-task-id={task.id}
                onMouseDown={(e) => handleTaskMouseDown(e, project.id, task)}
                style={{ position: "absolute", left: task.x, top: task.y, width: TASK_WIDTH, height: TASK_HEIGHT }}
                className="group relative flex cursor-grab select-none flex-col gap-1 rounded-lg border border-gray-200 bg-white p-3 text-xs shadow-sm hover:border-gray-300"
              >
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT_CLASS[task.status]}`} aria-hidden />
                  <span className="truncate text-sm font-medium text-gray-900">{task.title}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  {task.assignee && <span className="truncate">{task.assignee}</span>}
                  {task.dateRange && <span className="truncate">· {task.dateRange}</span>}
                </div>
                <div
                  onMouseDown={(e) => handleLinkHandleMouseDown(e, task)}
                  title="드래그해서 다른 작업과 연결 (같은 프로젝트: 병합, 다른 프로젝트: 링크)"
                  className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 cursor-crosshair rounded-full border-2 border-white bg-[#7c3aed] opacity-0 shadow group-hover:opacity-100"
                />
              </div>
            )),
          )}

          {board.projects.map((project) => (
            <button
              key={`add-root-${project.id}`}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() =>
                handleAddTask(project, null, project.labelX + PROJECT_WIDTH, project.labelY)
              }
              style={{
                position: "absolute",
                left: project.labelX + PROJECT_WIDTH + 24,
                top: project.labelY + PROJECT_HEIGHT / 2 - 14,
                width: 28,
                height: 28,
              }}
              className="flex items-center justify-center rounded-full border border-dashed border-gray-300 text-gray-400 hover:border-gray-500 hover:text-gray-700"
              title="작업 추가"
            >
              +
            </button>
          ))}

          {board.projects.flatMap((project) =>
            project.tasks.map((task) => (
              <button
                key={`add-${task.id}`}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => handleAddTask(project, task.id, task.x + TASK_WIDTH, task.y)}
                style={{
                  position: "absolute",
                  left: task.x + TASK_WIDTH + 24,
                  top: task.y + TASK_HEIGHT / 2 - 14,
                  width: 28,
                  height: 28,
                }}
                className="flex items-center justify-center rounded-full border border-dashed border-gray-300 text-gray-400 hover:border-gray-500 hover:text-gray-700"
                title="다음 작업 추가"
              >
                +
              </button>
            )),
          )}
        </div>
      </div>

      {selected && (
        <TaskDetailPanel
          task={selected.task}
          onChange={(patch) => handleUpdateTask(selected.project.id, selected.task.id, patch)}
          onDelete={() => handleDeleteTask(selected.project.id, selected.task.id)}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
    </div>
  );
}

function TaskDetailPanel({
  task,
  onChange,
  onDelete,
  onClose,
}: {
  task: Task;
  onChange: (patch: Partial<Task>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40 bg-black/30" />
      <div className="fixed inset-y-0 right-0 z-50 flex w-80 flex-col gap-4 overflow-y-auto border-l border-gray-200 bg-white p-5 text-sm text-gray-900 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">작업 상세</h2>
          <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-900">
            ✕
          </button>
        </div>

        <input
          value={task.title}
          onChange={(e) => onChange({ title: e.target.value })}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 outline-none focus:border-[#0066cc]"
        />

        <div>
          <p className="mb-1 text-xs text-gray-400">상태</p>
          <div className="flex gap-1.5">
            {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
              <button
                key={s}
                onClick={() => onChange({ status: s })}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium ${
                  task.status === s ? "bg-[#0066cc] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-400">담당자</span>
          <input
            value={task.assignee}
            onChange={(e) => onChange({ assignee: e.target.value })}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#0066cc]"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-400">일정</span>
          <input
            value={task.dateRange}
            onChange={(e) => onChange({ dateRange: e.target.value })}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#0066cc]"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-400">설명</span>
          <textarea
            value={task.description}
            onChange={(e) => onChange({ description: e.target.value })}
            rows={5}
            className="resize-none rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#0066cc]"
          />
        </label>

        <button
          onClick={onDelete}
          className="mt-auto rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          이 작업 삭제
        </button>
      </div>
    </>
  );
}
