"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkPassphrase, gateConfigured, isUnlocked, lock, unlock } from "@/lib/password-gate";

export type ActionState = { error?: string };

export async function unlockAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  if (!gateConfigured()) {
    return { error: "관리자가 PASSWORDS_CHANNEL_PASSPHRASE를 아직 설정하지 않았습니다." };
  }
  const passphrase = String(formData.get("passphrase") ?? "");
  if (!checkPassphrase(passphrase)) {
    return { error: "비밀번호가 올바르지 않습니다." };
  }
  await unlock();
  redirect("/passwords");
}

export async function lockAction() {
  await lock();
  redirect("/passwords");
}

const entrySchema = z.object({
  service: z.string().trim().min(1, "서비스/용도를 입력해 주세요").max(200),
  account: z.string().trim().max(300).optional(),
  password: z.string().trim().min(1, "비밀번호를 입력해 주세요").max(500),
  note: z.string().trim().max(1000).optional(),
  sourceUrl: z.union([z.literal(""), z.string().trim().url("올바른 링크 형식이 아닙니다")]).optional(),
});

async function requireUnlocked(): Promise<string | null> {
  if (!(await isUnlocked())) return "잠긴 채널입니다. 다시 잠금 해제해 주세요.";
  return null;
}

export async function createEntryAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const guardError = await requireUnlocked();
  if (guardError) return { error: guardError };

  const parsed = entrySchema.safeParse({
    service: formData.get("service"),
    account: formData.get("account") || undefined,
    password: formData.get("password"),
    note: formData.get("note") || undefined,
    sourceUrl: formData.get("sourceUrl") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요" };
  const { service, account, password, note, sourceUrl } = parsed.data;

  await prisma.passwordEntry.create({
    data: { service, account, password, note, sourceUrl: sourceUrl || null },
  });
  revalidatePath("/passwords");
  return {};
}

export async function updateEntryAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const guardError = await requireUnlocked();
  if (guardError) return { error: guardError };

  const entryId = String(formData.get("entryId") ?? "");
  if (!entryId) return { error: "잘못된 요청입니다" };

  const parsed = entrySchema.safeParse({
    service: formData.get("service"),
    account: formData.get("account") || undefined,
    password: formData.get("password"),
    note: formData.get("note") || undefined,
    sourceUrl: formData.get("sourceUrl") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요" };
  const { service, account, password, note, sourceUrl } = parsed.data;

  const result = await prisma.passwordEntry.updateMany({
    where: { id: entryId },
    data: { service, account, password, note, sourceUrl: sourceUrl || null },
  });
  if (result.count === 0) return { error: "항목을 찾을 수 없습니다" };
  revalidatePath("/passwords");
  return {};
}

export async function deleteEntryAction(entryId: string) {
  if (!(await isUnlocked())) return;

  await prisma.passwordEntry.deleteMany({ where: { id: entryId } });
  revalidatePath("/passwords");
}

export async function togglePinAction(entryId: string, pinned: boolean) {
  if (!(await isUnlocked())) return;

  await prisma.passwordEntry.updateMany({ where: { id: entryId }, data: { pinned } });
  revalidatePath("/passwords");
}
