"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { migrateBoardState, seedBoardState, type BoardState } from "@/lib/flowboard";

export async function getBoardState(): Promise<BoardState> {
  const row = await prisma.flowBoard.findFirst();
  if (!row) return seedBoardState();
  try {
    const parsed = JSON.parse(row.stateJson) as BoardState;
    if (!parsed.projects || !Array.isArray(parsed.projects)) return seedBoardState();
    return migrateBoardState(parsed);
  } catch {
    return seedBoardState();
  }
}

export async function saveBoardStateAction(state: BoardState): Promise<void> {
  const stateJson = JSON.stringify(state);
  const existing = await prisma.flowBoard.findFirst();
  if (existing) {
    await prisma.flowBoard.update({ where: { id: existing.id }, data: { stateJson } });
  } else {
    await prisma.flowBoard.create({ data: { stateJson } });
  }
  revalidatePath("/flowboard");
}
