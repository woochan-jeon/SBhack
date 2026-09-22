"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { WorkLogStatus } from "@/generated/prisma/enums";
import { WORKLOG_MEMBER_CANDIDATES } from "@/lib/worklog-roster";

export type ActionState = { error?: string };

const createMemberSchema = z.object({
  name: z.enum(WORKLOG_MEMBER_CANDIDATES, { message: "목록에 없는 이름입니다" }),
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

  const result = await prisma.workLogEntry.updateMany({
    where: { id: entryId },
    data: { content, status: status as WorkLogStatus },
  });
  if (result.count === 0) return { error: "기록을 찾을 수 없습니다" };
  revalidatePath("/worklog");
  return {};
}

export async function deleteEntryAction(entryId: string) {
  await prisma.workLogEntry.deleteMany({ where: { id: entryId } });
  revalidatePath("/worklog");
}
