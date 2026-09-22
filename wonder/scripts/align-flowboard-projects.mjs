import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import fs from "node:fs";

neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Keep in sync with src/lib/flowboard.ts (PIXELS_PER_DAY) and
// src/components/flow-board.tsx (PROJECT_WIDTH).
const PIXELS_PER_DAY = 96;
const PROJECT_WIDTH = 150;

const row = await prisma.flowBoard.findFirst();
if (!row) {
  console.log("No FlowBoard row found, nothing to align.");
  process.exit(0);
}

const state = JSON.parse(row.stateJson);

const backupDir = "C:\\Users\\lego1\\AppData\\Local\\Temp\\claude\\C--Users-lego1\\b89d5da2-c569-48dc-b309-7343940297ef\\scratchpad";
fs.mkdirSync(backupDir, { recursive: true });
const backupPath = `${backupDir}\\flowboard-backup-${Date.now()}.json`;
fs.writeFileSync(backupPath, row.stateJson);
console.log(`Backed up current state to ${backupPath}`);

let changed = false;
for (const project of state.projects) {
  const centerX = project.labelX + PROJECT_WIDTH / 2;
  const snappedCenterX = Math.round(centerX / PIXELS_PER_DAY) * PIXELS_PER_DAY;
  const delta = snappedCenterX - centerX;
  if (delta === 0) continue;
  changed = true;
  console.log(
    `${project.name}: labelX ${project.labelX} -> ${project.labelX + delta} (delta ${delta}), ${project.tasks.length} task(s) shifted`,
  );
  project.labelX += delta;
  for (const task of project.tasks) {
    task.x += delta;
  }
}

if (!changed) {
  console.log("All projects already aligned to the date grid. No changes made.");
  process.exit(0);
}

if (process.argv.includes("--dry-run")) {
  console.log("Dry run: not saving.");
  process.exit(0);
}

await prisma.flowBoard.update({ where: { id: row.id }, data: { stateJson: JSON.stringify(state) } });
console.log("Saved aligned board state.");
