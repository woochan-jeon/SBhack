"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { WorkLogStatus } from "@/generated/prisma/enums";

export type ActionState = { error?: string };

const createCategorySchema = z.object({
  name: z.string().trim().min(1, "카테고리 이름을 입력해 주세요").max(30),
});

export async function createCategoryAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = createCategorySchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요" };

  const existing = await prisma.scheduleCategory.findUnique({ where: { name: parsed.data.name } });
  if (existing) return { error: "이미 있는 카테고리 이름입니다" };

  await prisma.scheduleCategory.create({ data: { name: parsed.data.name } });
  revalidatePath("/schedule");
  return {};
}

export async function deleteCategoryAction(categoryId: string) {
  await prisma.scheduleCategory.delete({ where: { id: categoryId } });
  revalidatePath("/schedule");
}

const createEntrySchema = z.object({
  categoryId: z.string().min(1, "카테고리를 선택해 주세요"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  content: z.string().trim().min(1, "내용을 입력해 주세요").max(2000),
  status: z.enum(["DONE", "PLANNED"]),
});

export async function createEntryAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = createEntrySchema.safeParse({
    categoryId: formData.get("categoryId"),
    date: formData.get("date"),
    content: formData.get("content"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요" };
  const { categoryId, date, content, status } = parsed.data;

  await prisma.scheduleEntry.create({
    data: { categoryId, date: new Date(`${date}T00:00:00`), content, status: status as WorkLogStatus },
  });
  revalidatePath("/schedule");
  return {};
}

const updateEntrySchema = z.object({
  entryId: z.string().min(1),
  content: z.string().trim().min(1, "내용을 입력해 주세요").max(2000),
  status: z.enum(["DONE", "PLANNED"]),
});

export async function updateEntryAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = updateEntrySchema.safeParse({
    entryId: formData.get("entryId"),
    content: formData.get("content"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요" };
  const { entryId, content, status } = parsed.data;

  const result = await prisma.scheduleEntry.updateMany({
    where: { id: entryId },
    data: { content, status: status as WorkLogStatus },
  });
  if (result.count === 0) return { error: "기록을 찾을 수 없습니다" };
  revalidatePath("/schedule");
  return {};
}

export async function deleteEntryAction(entryId: string) {
  await prisma.scheduleEntry.deleteMany({ where: { id: entryId } });
  revalidatePath("/schedule");
}
