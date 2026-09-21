"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export type ActionState = { error?: string };

const createCategorySchema = z.object({
  name: z.string().trim().min(1, "카테고리 이름을 입력해 주세요").max(30),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "올바른 색상 값이 아닙니다"),
});

export async function createCategoryAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = createCategorySchema.safeParse({
    name: formData.get("name"),
    color: formData.get("color"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요" };

  const existing = await prisma.scheduleCategory.findUnique({ where: { name: parsed.data.name } });
  if (existing) return { error: "이미 있는 카테고리 이름입니다" };

  await prisma.scheduleCategory.create({ data: parsed.data });
  revalidatePath("/schedule");
  return {};
}

export async function deleteCategoryAction(categoryId: string) {
  await prisma.scheduleCategory.delete({ where: { id: categoryId } });
  revalidatePath("/schedule");
}

const entryFieldsSchema = z.object({
  categoryId: z.string().min(1, "카테고리를 선택해 주세요"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "시작일을 선택해 주세요"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "종료일을 선택해 주세요"),
  content: z.string().trim().min(1, "내용을 입력해 주세요").max(2000),
});

const createEntrySchema = entryFieldsSchema.refine((v) => v.endDate >= v.date, {
  message: "종료일은 시작일보다 빠를 수 없습니다",
  path: ["endDate"],
});

export async function createEntryAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = createEntrySchema.safeParse({
    categoryId: formData.get("categoryId"),
    date: formData.get("date"),
    endDate: formData.get("endDate"),
    content: formData.get("content"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요" };
  const { categoryId, date, endDate, content } = parsed.data;

  await prisma.scheduleEntry.create({
    data: {
      categoryId,
      date: new Date(`${date}T00:00:00`),
      endDate: new Date(`${endDate}T00:00:00`),
      content,
    },
  });
  revalidatePath("/schedule");
  return {};
}

const updateEntrySchema = entryFieldsSchema.extend({ entryId: z.string().min(1) }).refine((v) => v.endDate >= v.date, {
  message: "종료일은 시작일보다 빠를 수 없습니다",
  path: ["endDate"],
});

export async function updateEntryAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = updateEntrySchema.safeParse({
    entryId: formData.get("entryId"),
    categoryId: formData.get("categoryId"),
    date: formData.get("date"),
    endDate: formData.get("endDate"),
    content: formData.get("content"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요" };
  const { entryId, categoryId, date, endDate, content } = parsed.data;

  const result = await prisma.scheduleEntry.updateMany({
    where: { id: entryId },
    data: {
      categoryId,
      date: new Date(`${date}T00:00:00`),
      endDate: new Date(`${endDate}T00:00:00`),
      content,
    },
  });
  if (result.count === 0) return { error: "기록을 찾을 수 없습니다" };
  revalidatePath("/schedule");
  return {};
}

export async function deleteEntryAction(entryId: string) {
  await prisma.scheduleEntry.deleteMany({ where: { id: entryId } });
  revalidatePath("/schedule");
}
