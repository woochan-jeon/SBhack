import "dotenv/config";
import express from "express";
import { fileURLToPath } from "url";
import path from "path";

import { getUsdKrw } from "./lib/fx.js";
import { getOverview, getIdle, stopInstance, usingAws, PREV_MONTH } from "./lib/aws.js";
import { ask } from "./lib/ai.js";

const app = express();
app.use(express.json());
const here = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(here, "public")));

// 조치로 반영된 절감액을 세션 동안 기억(데모용 간단 상태)
const stopped = new Set();

// ---- 개요: 비용 + 환율 ----
app.get("/api/overview", async (req, res) => {
  try {
    const [ov, rate] = await Promise.all([getOverview(), getUsdKrw()]);
    const krwTotal = ov.costUsd * rate;
    // 환율만으로 인한 변동분: 이번 사용량 × (현재환율 − 지난달환율)
    const fxImpactKrw = ov.costUsd * (rate - PREV_MONTH.fxRate);
    res.json({
      ...ov,
      fx: {
        rate: Math.round(rate),
        prevRate: PREV_MONTH.fxRate,
        krwTotal: Math.round(krwTotal),
        fxImpactKrw: Math.round(fxImpactKrw),
      },
      liveAws: usingAws,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---- 유휴 자원 ----
app.get("/api/idle", async (req, res) => {
  try {
    const { source, resources } = await getIdle();
    res.json({ source, resources: resources.map((r) => ({ ...r, done: stopped.has(r.id) })) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---- 조치 실행 (EC2 stop만 실제, 나머지는 데모 표시) ----
app.post("/api/action", async (req, res) => {
  const { id, action } = req.body || {};
  if (!id) return res.status(400).json({ error: "id 필요" });
  try {
    let result = { ok: true, simulated: true };
    if (action === "stop") result = await stopInstance(id);
    stopped.add(id);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---- AI 챗 ----
app.post("/api/ask", async (req, res) => {
  const { question } = req.body || {};
  if (!question) return res.status(400).json({ error: "question 필요" });
  try {
    const [ov, rate, idle] = await Promise.all([getOverview(), getUsdKrw(), getIdle()]);
    const fxImpactKrw = ov.costUsd * (rate - PREV_MONTH.fxRate);
    const context = {
      costUsd: ov.costUsd,
      byService: ov.byService,
      forecastUsd: ov.forecastUsd,
      fx: { rate: Math.round(rate), fxImpactKrw: Math.round(fxImpactKrw) },
      idle: idle.resources,
    };
    const out = await ask(question, context);
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  CloudFX ▶ http://localhost:${PORT}`);
  console.log(`  AWS 연동: ${usingAws ? "ON (실데이터)" : "OFF (예시 데이터)"}`);
  console.log(`  Claude:  ${process.env.ANTHROPIC_API_KEY ? "ON" : "OFF (폴백 응답)"}\n`);
});
