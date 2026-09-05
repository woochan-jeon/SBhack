"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { WorkLogStatus } from "@/generated/prisma/enums";

export type ActionState = { error?: string };

const createMemberSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해 주세요").max(30),
});

export async function createMemberAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = createMemberSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요" };

  const existing = await prisma.workLogMember.findUnique({ where: { name: parsed.data.name } });
  if (existing) return { error: "이미 있는 이름입니다" };

  await prisma.workLogMember.create({ data: { name: parsed.data.name } });
  revalidatePath("/worklog");
  return {};
}

export async function deleteMemberAction(memberId: string) {
  await prisma.workLogMember.delete({ where: { id: memberId } });
  revalidatePath("/worklog");
}

const createEntrySchema = z.object({
  memberId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  content: z.string().trim().min(1, "내용을 입력해 주세요").max(2000),
  status: z.enum(["DONE", "PLANNED"]),
});

export async function createEntryAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = createEntrySchema.safeParse({
    memberId: formData.get("memberId"),
    date: formData.get("date"),
    content: formData.get("content"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요" };
  const { memberId, date, content, status } = parsed.data;

  await prisma.workLogEntry.create({
    data: { memberId, date: new Date(`${date}T00:00:00`), content, status: status as WorkLogStatus },
  });
  revalidatePath("/worklog");
  return {};
}

const updateEntrySchema = z.object({
  entryId: z.string().min(1),
  memberId: z.string().min(1),
  content: z.string().trim().min(1, "내용을 입력해 주세요").max(2000),
  status: z.enum(["DONE", "PLANNED"]),
});

export async function updateEntryAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = updateEntrySchema.safeParse({
    entryId: formData.get("entryId"),
    memberId: formData.get("memberId"),
    content: formData.get("content"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요" };
  const { entryId, memberId, content, status } = parsed.data;

  const entry = await prisma.workLogEntry.findUnique({ where: { id: entryId } });
  if (!entry) return { error: "기록을 찾을 수 없습니다" };
  if (entry.memberId !== memberId) return { error: "본인이 작성한 기록만 수정할 수 있습니다" };

  await prisma.workLogEntry.update({ where: { id: entryId }, data: { content, status: status as WorkLogStatus } });
  revalidatePath("/worklog");
  return {};
}

export async function deleteEntryAction(entryId: string, actingMemberId: string) {
  const entry = await prisma.workLogEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.memberId !== actingMemberId) return;
  await prisma.workLogEntry.delete({ where: { id: entryId } });
  revalidatePath("/worklog");
}
