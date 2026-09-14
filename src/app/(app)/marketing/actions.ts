"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export type ActionState = { error?: string };

const createProjectSchema = z.object({
  name: z.string().trim().min(1, "프로젝트 이름을 입력해 주세요").max(30),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "올바른 색상 값이 아닙니다"),
});

export async function createProjectAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createProjectSchema.safeParse({
    name: formData.get("name"),
    color: formData.get("color"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요" };
  const { name, color } = parsed.data;

  const existing = await prisma.marketingProject.findUnique({ where: { name } });
  if (existing) return { error: "이미 있는 프로젝트 이름입니다" };

  await prisma.marketingProject.create({ data: { name, color } });
  revalidatePath("/marketing");
  return {};
}

export async function deleteProjectAction(projectId: string) {
  await prisma.marketingProject.delete({ where: { id: projectId } });
  revalidatePath("/marketing");
}

const createCategorySchema = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(1, "카테고리 이름을 입력해 주세요").max(30),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "올바른 색상 값이 아닙니다"),
});

export async function createCategoryAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createCategorySchema.safeParse({
    projectId: formData.get("projectId"),
    name: formData.get("name"),
    color: formData.get("color"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요" };
  const { projectId, name, color } = parsed.data;

  const existing = await prisma.marketingCategory.findUnique({
    where: { projectId_name: { projectId, name } },
  });
  if (existing) return { error: "이미 있는 카테고리 이름입니다" };

  await prisma.marketingCategory.create({ data: { projectId, name, color } });
  revalidatePath("/marketing");
  return {};
}

export async function deleteCategoryAction(categoryId: string) {
  await prisma.marketingCategory.delete({ where: { id: categoryId } });
  revalidatePath("/marketing");
}

const setBudgetSchema = z.object({
  projectId: z.string().min(1),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  amount: z.coerce.number().int().min(0, "0 이상의 금액을 입력해 주세요"),
});

export async function setBudgetAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = setBudgetSchema.safeParse({
    projectId: formData.get("projectId"),
    year: formData.get("year"),
    month: formData.get("month"),
    amount: formData.get("amount"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요" };
  const { projectId, year, month, amount } = parsed.data;

  await prisma.marketingBudget.upsert({
    where: { projectId_year_month: { projectId, year, month } },
    create: { projectId, year, month, amount },
    update: { amount },
  });
  revalidatePath("/marketing");
  return {};
}

const expenseSchema = z.object({
  projectId: z.string().min(1, "프로젝트를 선택해 주세요"),
  categoryId: z.string().trim().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜를 선택해 주세요"),
  channel: z.string().trim().min(1, "채널을 입력해 주세요").max(60),
  description: z.string().trim().min(1, "어떤 마케팅인지 입력해 주세요").max(500),
  amount: z.coerce.number().int().min(0, "0 이상의 금액을 입력해 주세요"),
  paymentMethod: z.string().trim().min(1, "지출 방식을 입력해 주세요").max(60),
  note: z.string().trim().max(1000).optional(),
});

export async function createExpenseAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = expenseSchema.safeParse({
    projectId: formData.get("projectId"),
    categoryId: formData.get("categoryId") || undefined,
    date: formData.get("date"),
    channel: formData.get("channel"),
    description: formData.get("description"),
    amount: formData.get("amount"),
    paymentMethod: formData.get("paymentMethod"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요" };
  const { projectId, categoryId, date, channel, description, amount, paymentMethod, note } = parsed.data;

  await prisma.marketingExpense.create({
    data: {
      projectId,
      categoryId: categoryId || null,
      date: new Date(`${date}T00:00:00`),
      channel,
      description,
      amount,
      paymentMethod,
      note: note || null,
    },
  });
  revalidatePath("/marketing");
  return {};
}

const updateExpenseSchema = expenseSchema.extend({ expenseId: z.string().min(1) });

export async function updateExpenseAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updateExpenseSchema.safeParse({
    expenseId: formData.get("expenseId"),
    projectId: formData.get("projectId"),
    categoryId: formData.get("categoryId") || undefined,
    date: formData.get("date"),
    channel: formData.get("channel"),
    description: formData.get("description"),
    amount: formData.get("amount"),
    paymentMethod: formData.get("paymentMethod"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요" };
  const { expenseId, projectId, categoryId, date, channel, description, amount, paymentMethod, note } =
    parsed.data;

  const result = await prisma.marketingExpense.updateMany({
    where: { id: expenseId },
    data: {
      projectId,
      categoryId: categoryId || null,
      date: new Date(`${date}T00:00:00`),
      channel,
      description,
      amount,
      paymentMethod,
      note: note || null,
    },
  });
  if (result.count === 0) return { error: "지출 항목을 찾을 수 없습니다" };
  revalidatePath("/marketing");
  return {};
}

export async function deleteExpenseAction(expenseId: string) {
  await prisma.marketingExpense.deleteMany({ where: { id: expenseId } });
  revalidatePath("/marketing");
}
