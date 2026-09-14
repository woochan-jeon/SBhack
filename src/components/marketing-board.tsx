"use client";

import Link from "next/link";
import { useActionState, useMemo, useRef, useState, useTransition, type ChangeEvent, type ReactNode } from "react";
import {
  createCategoryAction,
  createExpenseAction,
  createProjectAction,
  deleteCategoryAction,
  deleteExpenseAction,
  deleteProjectAction,
  setBudgetAction,
  updateExpenseAction,
  type ActionState,
} from "@/app/(app)/marketing/actions";

type ProjectVM = { id: string; name: string; color: string };
type CategoryVM = { id: string; name: string; color: string; projectId: string };
type BudgetVM = { projectId: string; amount: number };
type ExpenseVM = {
  id: string;
  date: string;
  channel: string;
  description: string;
  amount: number;
  paymentMethod: string;
  note: string | null;
  projectId: string;
  categoryId: string | null;
};

const PROJECT_COLOR_SWATCHES = [
  "#0066cc",
  "#8D7150",
  "#9D9FA2",
  "#2563eb",
  "#059669",
  "#d97706",
  "#dc2626",
  "#0891b2",
];

const initialState: ActionState = {};

function formatWon(amount: number) {
  return `${amount.toLocaleString("ko-KR")}원`;
}

export default function MarketingBoard({
  year,
  month,
  title,
  prevHref,
  nextHref,
  todayHref,
  projects,
  categories,
  budgets,
  expenses,
  channelSuggestions,
  paymentMethodSuggestions,
}: {
  year: number;
  month: number;
  title: string;
  prevHref: string;
  nextHref: string;
  todayHref: string;
  projects: ProjectVM[];
  categories: CategoryVM[];
  budgets: BudgetVM[];
  expenses: ExpenseVM[];
  channelSuggestions: string[];
  paymentMethodSuggestions: string[];
}) {
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [managingProjects, setManagingProjects] = useState(false);
  const [managingCategories, setManagingCategories] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  function selectProject(id: string | null) {
    setActiveProjectId(id);
    setActiveCategoryId(null);
    setManagingCategories(false);
  }

  const budgetByProject = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of budgets) map.set(b.projectId, b.amount);
    return map;
  }, [budgets]);

  const spendByProject = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) map.set(e.projectId, (map.get(e.projectId) ?? 0) + e.amount);
    return map;
  }, [expenses]);

  const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
  const totalSpend = expenses.reduce((sum, e) => sum + e.amount, 0);

  const projectExpenses = activeProjectId
    ? expenses.filter((e) => e.projectId === activeProjectId)
    : expenses;

  const categoriesForActiveProject = activeProjectId
    ? categories.filter((c) => c.projectId === activeProjectId)
    : [];

  const spendByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) {
      if (!e.categoryId) continue;
      map.set(e.categoryId, (map.get(e.categoryId) ?? 0) + e.amount);
    }
    return map;
  }, [expenses]);

  const visibleExpenses = activeCategoryId
    ? projectExpenses.filter((e) => e.categoryId === activeCategoryId)
    : projectExpenses;

  const editingExpense = editingExpenseId ? expenses.find((e) => e.id === editingExpenseId) ?? null : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <div className="flex items-center gap-1">
            <Link href={prevHref} className="rounded-md border border-gray-300 px-2.5 py-1 text-sm text-gray-900 hover:bg-gray-50">
              ‹
            </Link>
            <Link href={todayHref} className="rounded-md border border-gray-300 px-2.5 py-1 text-sm text-gray-900 hover:bg-gray-50">
              이번 달
            </Link>
            <Link href={nextHref} className="rounded-md border border-gray-300 px-2.5 py-1 text-sm text-gray-900 hover:bg-gray-50">
              ›
            </Link>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowExpenseForm((v) => !v)}
          className="rounded-full bg-[#0066cc] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0071e3]"
        >
          {showExpenseForm ? "닫기" : "+ 지출 추가"}
        </button>
      </div>

      {showExpenseForm && (
        <ExpenseForm
          year={year}
          month={month}
          projects={projects}
          categories={categories}
          defaultProjectId={activeProjectId}
          channelSuggestions={channelSuggestions}
          paymentMethodSuggestions={paymentMethodSuggestions}
          onDone={() => setShowExpenseForm(false)}
        />
      )}

      <SummaryCard
        label="전체"
        color="#111827"
        budget={totalBudget}
        spend={totalSpend}
        active={activeProjectId === null}
        onClick={() => selectProject(null)}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {projects.map((p) => (
          <ProjectSummary
            key={p.id}
            project={p}
            year={year}
            month={month}
            budget={budgetByProject.get(p.id) ?? null}
            spend={spendByProject.get(p.id) ?? 0}
            categories={categories}
            spendByCategory={spendByCategory}
            active={activeProjectId === p.id}
            onClick={() => selectProject(p.id)}
          />
        ))}
      </div>

      {activeProjectId && (
        <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-gray-500">카테고리별 지출</p>
            <button
              type="button"
              onClick={() => setManagingCategories((v) => !v)}
              className="text-xs text-gray-500 underline decoration-dotted hover:text-gray-700"
            >
              카테고리 관리
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <CategoryChip
              label="전체"
              color="#111827"
              amount={projectExpenses.reduce((sum, e) => sum + e.amount, 0)}
              active={activeCategoryId === null}
              onClick={() => setActiveCategoryId(null)}
            />
            {categoriesForActiveProject.map((c) => (
              <CategoryChip
                key={c.id}
                label={c.name}
                color={c.color}
                amount={spendByCategory.get(c.id) ?? 0}
                active={activeCategoryId === c.id}
                onClick={() => setActiveCategoryId(c.id)}
              />
            ))}
            {categoriesForActiveProject.length === 0 && (
              <p className="text-xs text-gray-400">등록된 카테고리가 없습니다.</p>
            )}
          </div>
          {managingCategories && (
            <CategoryManagePanel projectId={activeProjectId} categories={categoriesForActiveProject} />
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-500">
          {activeProjectId ? projects.find((p) => p.id === activeProjectId)?.name : "전체"}
          {activeCategoryId ? ` · ${categoriesForActiveProject.find((c) => c.id === activeCategoryId)?.name}` : ""} ·{" "}
          {visibleExpenses.length}건
        </p>
        <button
          type="button"
          onClick={() => setManagingProjects((v) => !v)}
          className="text-xs text-gray-500 underline decoration-dotted hover:text-gray-700"
        >
          프로젝트 관리
        </button>
      </div>

      {managingProjects && <ProjectManagePanel projects={projects} />}

      <ExpenseTable
        expenses={visibleExpenses}
        projects={projects}
        categories={categories}
        onEdit={setEditingExpenseId}
      />

      {editingExpense && (
        <ExpenseEditModal
          expense={editingExpense}
          projects={projects}
          categories={categories}
          channelSuggestions={channelSuggestions}
          paymentMethodSuggestions={paymentMethodSuggestions}
          onClose={() => setEditingExpenseId(null)}
        />
      )}
    </div>
  );
}

function SummaryCard({
  label,
  color,
  budget,
  spend,
  active,
  onClick,
  children,
}: {
  label: string;
  color: string;
  budget: number;
  spend: number;
  active: boolean;
  onClick: () => void;
  children?: ReactNode;
}) {
  const hasBudget = budget > 0;
  const pct = hasBudget ? Math.round((spend / budget) * 100) : null;
  const over = hasBudget && spend > budget;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full flex-col gap-1.5 rounded-lg border p-3 text-left transition-colors ${
        active ? "border-[#0066cc] bg-[#0066cc]/5" : "border-gray-200 bg-white hover:bg-gray-50"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} aria-hidden />
          {label}
        </span>
        {pct !== null && (
          <span className={`text-xs font-medium ${over ? "text-red-600" : "text-gray-500"}`}>{pct}%</span>
        )}
      </div>
      <p className="text-lg font-semibold text-gray-900">
        {formatWon(spend)}
        {hasBudget && <span className="ml-1 text-xs font-normal text-gray-400">/ {formatWon(budget)}</span>}
      </p>
      {hasBudget && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full ${over ? "bg-red-500" : "bg-[#0066cc]"}`}
            style={{ width: `${Math.min(pct ?? 0, 100)}%` }}
          />
        </div>
      )}
      {hasBudget && (
        <p className={`text-xs ${over ? "text-red-600" : "text-gray-500"}`}>
          {over ? `${formatWon(spend - budget)} 초과` : `${formatWon(budget - spend)} 남음`}
        </p>
      )}
      {children}
    </button>
  );
}

function ProjectSummary({
  project,
  year,
  month,
  budget,
  spend,
  categories,
  spendByCategory,
  active,
  onClick,
}: {
  project: ProjectVM;
  year: number;
  month: number;
  budget: number | null;
  spend: number;
  categories: CategoryVM[];
  spendByCategory: Map<string, number>;
  active: boolean;
  onClick: () => void;
}) {
  const [editingBudget, setEditingBudget] = useState(false);
  const projectCategories = categories.filter((c) => c.projectId === project.id);

  return (
    <div className="flex flex-col gap-1.5">
      <SummaryCard
        label={project.name}
        color={project.color}
        budget={budget ?? 0}
        spend={spend}
        active={active}
        onClick={onClick}
      >
        {projectCategories.length > 0 && (
          <div className="flex flex-col gap-0.5 border-t border-gray-100 pt-1.5">
            {projectCategories.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c.color }} aria-hidden />
                  {c.name}
                </span>
                <span>{formatWon(spendByCategory.get(c.id) ?? 0)}</span>
              </div>
            ))}
          </div>
        )}
      </SummaryCard>
      {editingBudget ? (
        <BudgetForm
          projectId={project.id}
          year={year}
          month={month}
          defaultAmount={budget}
          onDone={() => setEditingBudget(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditingBudget(true)}
          className="self-start px-1 text-xs text-gray-500 underline decoration-dotted hover:text-gray-700"
        >
          {budget !== null ? "목표 예산 수정" : "목표 예산 설정"}
        </button>
      )}
    </div>
  );
}

function BudgetForm({
  projectId,
  year,
  month,
  defaultAmount,
  onDone,
}: {
  projectId: string;
  year: number;
  month: number;
  defaultAmount: number | null;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await setBudgetAction(prev, formData);
    if (!result.error) onDone();
    return result;
  }, initialState);

  return (
    <form action={formAction} className="flex items-center gap-1.5">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="year" value={year} />
      <input type="hidden" name="month" value={month} />
      <input
        name="amount"
        type="number"
        min={0}
        step={10000}
        autoFocus
        required
        defaultValue={defaultAmount ?? ""}
        placeholder="목표 예산(원)"
        className="w-32 rounded-md border border-gray-300 px-2 py-1 text-xs outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-[#0066cc] px-2 py-1 text-xs text-white hover:bg-[#0071e3] disabled:opacity-60"
      >
        저장
      </button>
      <button type="button" onClick={onDone} className="text-xs text-gray-500 hover:text-gray-700">
        취소
      </button>
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

function ProjectManagePanel({ projects }: { projects: ProjectVM[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [color, setColor] = useState(PROJECT_COLOR_SWATCHES[0]);
  const [, startTransition] = useTransition();
  const [state, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await createProjectAction(prev, formData);
    if (!result.error) formRef.current?.reset();
    return result;
  }, initialState);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="flex flex-wrap gap-2">
        {projects.map((p) => (
          <span key={p.id} className="flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs text-gray-600 ring-1 ring-gray-200">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.color }} aria-hidden />
            {p.name}
            <button
              type="button"
              onClick={() => {
                if (confirm(`"${p.name}" 프로젝트를 삭제할까요? 관련 예산/지출 기록도 함께 삭제됩니다.`)) {
                  startTransition(() => deleteProjectAction(p.id));
                }
              }}
              title={`${p.name} 삭제`}
              aria-label={`${p.name} 삭제`}
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
          placeholder="새 프로젝트 이름 (예: 큐텐, 쇼피)"
          required
          className="w-48 rounded-md border border-gray-300 px-2 py-1 text-xs outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
        />
        <div className="flex items-center gap-1">
          {PROJECT_COLOR_SWATCHES.map((swatch) => (
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

function CategoryChip({
  label,
  color,
  amount,
  active,
  onClick,
}: {
  label: string;
  color: string;
  amount: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
        active ? "border-[#0066cc] bg-[#0066cc]/10 text-[#0066cc]" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      {label}
      <span className="text-gray-400">{formatWon(amount)}</span>
    </button>
  );
}

function CategoryManagePanel({ projectId, categories }: { projectId: string; categories: CategoryVM[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [color, setColor] = useState(PROJECT_COLOR_SWATCHES[0]);
  const [, startTransition] = useTransition();
  const [state, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await createCategoryAction(prev, formData);
    if (!result.error) formRef.current?.reset();
    return result;
  }, initialState);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <span key={c.id} className="flex items-center gap-1 rounded-full bg-gray-50 px-2 py-0.5 text-xs text-gray-600 ring-1 ring-gray-200">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c.color }} aria-hidden />
            {c.name}
            <button
              type="button"
              onClick={() => {
                if (confirm(`"${c.name}" 카테고리를 삭제할까요? 관련 지출 기록의 카테고리는 비워집니다.`)) {
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
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="color" value={color} />
        <input
          name="name"
          placeholder="새 카테고리 이름 (예: 광고비, 인플루언서)"
          required
          className="w-48 rounded-md border border-gray-300 px-2 py-1 text-xs outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
        />
        <div className="flex items-center gap-1">
          {PROJECT_COLOR_SWATCHES.map((swatch) => (
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

function ProjectSelect({
  projects,
  value,
  defaultValue,
  onChange,
  className,
}: {
  projects: ProjectVM[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  className: string;
}) {
  const controlledProps = onChange
    ? { value: value ?? "", onChange: (e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value) }
    : { defaultValue: defaultValue ?? "" };
  return (
    <select name="projectId" required className={className} {...controlledProps}>
      <option value="" disabled>
        프로젝트 선택
      </option>
      {projects.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}

function CategorySelect({
  categories,
  value,
  defaultValue,
  onChange,
  className,
}: {
  categories: CategoryVM[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  className: string;
}) {
  const controlledProps = onChange
    ? { value: value ?? "", onChange: (e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value) }
    : { defaultValue: defaultValue ?? "" };
  return (
    <select name="categoryId" disabled={categories.length === 0} className={className} {...controlledProps}>
      <option value="">{categories.length === 0 ? "카테고리 없음" : "카테고리 선택 안 함"}</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function ExpenseForm({
  year,
  month,
  projects,
  categories,
  defaultProjectId,
  channelSuggestions,
  paymentMethodSuggestions,
  onDone,
}: {
  year: number;
  month: number;
  projects: ProjectVM[];
  categories: CategoryVM[];
  defaultProjectId: string | null;
  channelSuggestions: string[];
  paymentMethodSuggestions: string[];
  onDone: () => void;
}) {
  const now = new Date();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
  const defaultDate = isCurrentMonth
    ? todayKey()
    : `${year}-${String(month).padStart(2, "0")}-01`;

  const [selectedProjectId, setSelectedProjectId] = useState(defaultProjectId ?? "");
  const categoriesForProject = categories.filter((c) => c.projectId === selectedProjectId);

  const [state, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await createExpenseAction(prev, formData);
    if (!result.error) onDone();
    return result;
  }, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="flex flex-wrap gap-2">
        <ProjectSelect
          projects={projects}
          value={selectedProjectId}
          onChange={setSelectedProjectId}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
        />
        <CategorySelect
          key={selectedProjectId}
          categories={categoriesForProject}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
        />
        <input
          name="date"
          type="date"
          defaultValue={defaultDate}
          required
          className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          name="channel"
          list="marketing-channel-suggestions"
          placeholder="채널 (예: 페이스북 광고, 인플루언서) *"
          required
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
        />
        <input
          name="paymentMethod"
          list="marketing-payment-suggestions"
          placeholder="지출 방식 (예: 법인카드) *"
          required
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
        />
      </div>
      <textarea
        name="description"
        placeholder="어떤 마케팅을 진행했는지 *"
        required
        rows={2}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
      />
      <input
        name="amount"
        type="number"
        min={0}
        step={1000}
        placeholder="비용(원) *"
        required
        className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
      />
      <textarea
        name="note"
        placeholder="비고 (선택)"
        rows={2}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
      />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
          취소
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-[#0066cc] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0071e3] disabled:opacity-60"
        >
          {pending ? "저장 중..." : "추가"}
        </button>
      </div>
      <datalist id="marketing-channel-suggestions">
        {channelSuggestions.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <datalist id="marketing-payment-suggestions">
        {paymentMethodSuggestions.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
    </form>
  );
}

function ExpenseTable({
  expenses,
  projects,
  categories,
  onEdit,
}: {
  expenses: ExpenseVM[];
  projects: ProjectVM[];
  categories: CategoryVM[];
  onEdit: (id: string) => void;
}) {
  const [, startTransition] = useTransition();
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  if (expenses.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-gray-200 p-4 text-center text-xs text-gray-900">
        지출 내역 없음
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-100 text-sm">
        <thead className="bg-gray-50">
          <tr className="text-left text-xs font-medium text-gray-500">
            <th className="px-3 py-2">날짜</th>
            <th className="px-3 py-2">프로젝트</th>
            <th className="px-3 py-2">카테고리</th>
            <th className="px-3 py-2">채널</th>
            <th className="px-3 py-2">내용</th>
            <th className="px-3 py-2 text-right">비용</th>
            <th className="px-3 py-2">지출 방식</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {expenses.map((e) => {
            const project = projectById.get(e.projectId);
            const category = e.categoryId ? categoryById.get(e.categoryId) : null;
            return (
              <tr key={e.id} className="align-top hover:bg-gray-50">
                <td className="whitespace-nowrap px-3 py-2 text-gray-900">{e.date}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  {project && (
                    <span className="flex items-center gap-1.5 text-gray-900">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: project.color }} aria-hidden />
                      {project.name}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {category ? (
                    <span className="flex items-center gap-1.5 text-gray-900">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: category.color }} aria-hidden />
                      {category.name}
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-900">{e.channel}</td>
                <td className="max-w-xs px-3 py-2 text-gray-900">
                  <p>{e.description}</p>
                  {e.note && <p className="mt-0.5 text-xs text-gray-500">{e.note}</p>}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-medium text-gray-900">
                  {formatWon(e.amount)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-900">{e.paymentMethod}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <button
                    onClick={() => onEdit(e.id)}
                    title="수정"
                    className="rounded p-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("이 지출 항목을 삭제할까요?")) {
                        startTransition(() => deleteExpenseAction(e.id));
                      }
                    }}
                    title="삭제"
                    className="rounded p-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-red-600"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ExpenseEditModal({
  expense,
  projects,
  categories,
  channelSuggestions,
  paymentMethodSuggestions,
  onClose,
}: {
  expense: ExpenseVM;
  projects: ProjectVM[];
  categories: CategoryVM[];
  channelSuggestions: string[];
  paymentMethodSuggestions: string[];
  onClose: () => void;
}) {
  const [selectedProjectId, setSelectedProjectId] = useState(expense.projectId);
  const categoriesForProject = categories.filter((c) => c.projectId === selectedProjectId);

  const [state, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await updateExpenseAction(prev, formData);
    if (!result.error) onClose();
    return result;
  }, initialState);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div onClick={onClose} className="absolute inset-0" aria-hidden />
      <form action={formAction} className="relative z-10 flex w-full max-w-md flex-col gap-3 rounded-lg bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">지출 항목 수정</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-900">
            ✕
          </button>
        </div>
        <input type="hidden" name="expenseId" value={expense.id} />
        <div className="flex flex-wrap gap-2">
          <ProjectSelect
            projects={projects}
            value={selectedProjectId}
            onChange={setSelectedProjectId}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
          />
          <CategorySelect
            key={selectedProjectId}
            categories={categoriesForProject}
            defaultValue={selectedProjectId === expense.projectId ? (expense.categoryId ?? "") : ""}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
          />
          <input
            name="date"
            type="date"
            defaultValue={expense.date}
            required
            className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            name="channel"
            list="marketing-channel-suggestions-edit"
            defaultValue={expense.channel}
            required
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
          />
          <input
            name="paymentMethod"
            list="marketing-payment-suggestions-edit"
            defaultValue={expense.paymentMethod}
            required
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
          />
        </div>
        <textarea
          name="description"
          defaultValue={expense.description}
          required
          rows={2}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
        />
        <input
          name="amount"
          type="number"
          min={0}
          step={1000}
          defaultValue={expense.amount}
          required
          className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
        />
        <textarea
          name="note"
          defaultValue={expense.note ?? ""}
          placeholder="비고 (선택)"
          rows={2}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
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
        <datalist id="marketing-channel-suggestions-edit">
          {channelSuggestions.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <datalist id="marketing-payment-suggestions-edit">
          {paymentMethodSuggestions.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </form>
    </div>
  );
}
