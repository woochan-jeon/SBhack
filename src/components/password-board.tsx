"use client";

import { useActionState, useState, useTransition } from "react";
import {
  createEntryAction,
  updateEntryAction,
  deleteEntryAction,
  togglePinAction,
  type ActionState,
} from "@/app/(app)/passwords/actions";

type Entry = {
  id: string;
  service: string;
  account: string | null;
  password: string;
  note: string | null;
  sourceUrl: string | null;
  pinned: boolean;
};

const initialState: ActionState = {};

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      title={`${label} 복사`}
      className="rounded p-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-700"
    >
      {copied ? "✅" : "📋"}
    </button>
  );
}

export default function PasswordBoard({ entries }: { entries: Entry[] }) {
  const [showNewForm, setShowNewForm] = useState(false);
  const [query, setQuery] = useState("");

  const visible = entries.filter((e) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      e.service.toLowerCase().includes(q) ||
      (e.account ?? "").toLowerCase().includes(q) ||
      (e.note ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="서비스, 계정, 비고로 검색"
          className="w-64 rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
        />
        <button
          onClick={() => setShowNewForm((v) => !v)}
          title={showNewForm ? "닫기" : "새 항목 추가"}
          aria-label={showNewForm ? "닫기" : "새 항목 추가"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0066cc] text-base font-medium text-white hover:bg-[#0071e3]"
        >
          {showNewForm ? "×" : "+"}
        </button>
      </div>

      {showNewForm && <EntryForm onDone={() => setShowNewForm(false)} />}

      <p className="text-xs text-gray-500">{visible.length}개 항목</p>

      <div className="flex flex-col gap-2">
        {visible.map((entry) => (
          <EntryCard key={entry.id} entry={entry} />
        ))}
        {visible.length === 0 && (
          <p className="rounded-md border border-dashed border-gray-200 p-4 text-center text-xs text-gray-900">
            항목 없음
          </p>
        )}
      </div>
    </div>
  );
}

function EntryForm({ entry, onDone }: { entry?: Entry; onDone: () => void }) {
  const action = entry ? updateEntryAction : createEntryAction;
  const [state, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await action(prev, formData);
    if (!result.error) onDone();
    return result;
  }, initialState);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-4"
    >
      {entry && <input type="hidden" name="entryId" value={entry.id} />}
      <div className="flex flex-wrap gap-2">
        <input
          name="service"
          placeholder="서비스/용도 *"
          defaultValue={entry?.service}
          required
          autoFocus
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
        />
        <input
          name="account"
          placeholder="계정 (ID/이메일)"
          defaultValue={entry?.account ?? ""}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
        />
      </div>
      <input
        name="password"
        placeholder="비밀번호 *"
        defaultValue={entry?.password}
        required
        className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
      />
      <input
        name="sourceUrl"
        type="url"
        placeholder="원본 링크 (선택, https://...)"
        defaultValue={entry?.sourceUrl ?? ""}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
      />
      <textarea
        name="note"
        placeholder="비고 (선택)"
        defaultValue={entry?.note ?? ""}
        rows={2}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
      />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-[#0066cc] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0071e3] disabled:opacity-60"
        >
          {pending ? "저장 중..." : entry ? "저장" : "추가"}
        </button>
      </div>
    </form>
  );
}

function EntryCard({ entry }: { entry: Entry }) {
  const [editing, setEditing] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (editing) {
    return <EntryForm entry={entry} onDone={() => setEditing(false)} />;
  }

  return (
    <div
      className={`flex flex-col gap-1.5 rounded-lg border bg-white p-3 shadow-sm ${
        entry.pinned ? "border-amber-300 bg-amber-50/40" : "border-gray-200"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-gray-900">{entry.service}</p>
          {entry.account && <p className="text-xs text-gray-500">{entry.account}</p>}
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            onClick={() => startTransition(() => togglePinAction(entry.id, !entry.pinned))}
            disabled={isPending}
            title={entry.pinned ? "고정 해제" : "위에 고정"}
            className={`rounded p-1 text-xs hover:bg-gray-100 ${
              entry.pinned ? "text-amber-500" : "text-gray-400 hover:text-gray-700"
            }`}
          >
            📌
          </button>
          <button
            onClick={() => setEditing(true)}
            title="수정"
            className="rounded p-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            ✏️
          </button>
          <button
            onClick={() => {
              if (confirm(`"${entry.service}" 항목을 삭제할까요?`)) {
                startTransition(() => deleteEntryAction(entry.id));
              }
            }}
            disabled={isPending}
            title="삭제"
            className="rounded p-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-red-600"
          >
            🗑️
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 rounded-md bg-gray-50 px-2 py-1">
        <code className="flex-1 select-all font-mono text-sm text-gray-900">
          {revealed ? entry.password : "•".repeat(Math.min(entry.password.length, 12))}
        </code>
        <button
          onClick={() => setRevealed((v) => !v)}
          title={revealed ? "숨기기" : "보기"}
          className="rounded p-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          {revealed ? "🙈" : "👁️"}
        </button>
        <CopyButton value={entry.password} label="비밀번호" />
        {entry.account && <CopyButton value={entry.account} label="계정" />}
      </div>

      {entry.note && <p className="text-xs text-gray-900">{entry.note}</p>}

      {entry.sourceUrl && (
        <a
          href={entry.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="truncate text-xs text-[#0066cc] hover:underline"
        >
          🔗 원본 링크
        </a>
      )}
    </div>
  );
}
