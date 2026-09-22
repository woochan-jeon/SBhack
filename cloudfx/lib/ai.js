// Claude 기반 비용 코파일럿 — tool-use 에이전트.
// ANTHROPIC_API_KEY 가 있으면 실제 Claude가 도구를 스스로 호출하며 추론,
// 없으면 규칙 기반 폴백 응답.

import Anthropic from "@anthropic-ai/sdk";
import { toolDefs, runTool } from "./tools.js";

const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5";
const hasKey = !!process.env.ANTHROPIC_API_KEY;
const client = hasKey ? new Anthropic() : null;
const MAX_STEPS = 6; // 무한루프 방지

const SYSTEM = `당신은 "CloudFX"의 AI 클라우드 비용 코파일럿이자 자율 에이전트입니다.
한국/일본 무역·커머스 기업을 위해 AWS 비용을 분석하고 절감을 실행합니다.
특징: 클라우드 요금은 USD로 청구되므로 **환율(원/달러) 영향**을 항상 함께 고려합니다.

작업 방식(중요):
- 추측하지 말고 **도구를 호출해 실제 데이터를 먼저 확인**하세요. 숫자를 지어내지 마세요.
- 비용/환율 질문 → get_cost_overview, simulate_fx 를 사용.
- '절감·정리·줄여줘·아껴줘' 또는 목표(예: "20% 줄여줘") → list_idle_resources 로 유휴 자원을 확인한 뒤,
  실행할 조치를 골라 **propose_savings_plan** 을 호출해 실행안을 제안하세요. (실제 실행은 사용자가 버튼으로 승인)
- '오늘 브리핑·점검·문제 있어?' → get_alerts 로 능동 점검 항목을 확인하고, 심각도 순으로 핵심만 브리핑하세요.
- 단순 질문이면 도구로 확인 후 텍스트로 답하세요.

답변 형식:
- 한국어, 간결하게(핵심 3~5문장). 핵심 숫자는 **굵게** 강조하고, USD와 원화를 함께 표기.
- 가능하면 "환율 때문 vs 사용량 때문"을 구분해 통찰을 주세요.`;

export async function ask(question, snapshot) {
  if (!hasKey) return fallback(question, snapshot);
  try {
    const messages = [{ role: "user", content: question }];
    const steps = []; // 데모용: 에이전트가 호출한 도구 기록

    for (let i = 0; i < MAX_STEPS; i++) {
      const res = await client.messages.create({
        model: MODEL,
        max_tokens: 1500,
        system: SYSTEM,
        tools: toolDefs,
        messages,
      });

      if (res.stop_reason === "tool_use") {
        messages.push({ role: "assistant", content: res.content });
        const toolResults = [];

        for (const block of res.content) {
          if (block.type !== "tool_use") continue;

          // 종료 도구: 실행안 제안 → 여기서 루프를 끝내고 구조화 결과 반환
          if (block.name === "propose_savings_plan") {
            steps.push({ tool: block.name });
            const actions = enrichActions(block.input?.actions || [], snapshot);
            return {
              answer: block.input?.summary || "실행안을 준비했어요.",
              plan: actions,
              steps,
              model: MODEL,
              live: true,
            };
          }

          // 조회 도구 실행
          steps.push({ tool: block.name, input: block.input });
          const out = runTool(block.name, block.input, snapshot);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(out),
          });
        }

        messages.push({ role: "user", content: toolResults });
        continue;
      }

      // 최종 텍스트 답변
      const text = res.content.find((b) => b.type === "text")?.text;
      return { answer: text || "응답을 생성하지 못했어요.", steps, model: MODEL, live: true };
    }

    return { answer: "분석이 길어져 중단했어요. 질문을 좀 더 구체적으로 해주세요.", steps, model: MODEL, live: true };
  } catch (e) {
    console.warn("[ai] Claude 호출 실패, 폴백 사용:", e.message);
    return fallback(question, snapshot);
  }
}

// 제안된 조치에 이름·절감액 등 표시용 정보를 붙인다(프론트 렌더용).
function enrichActions(actions, snapshot) {
  const byId = new Map((snapshot.idle || []).map((r) => [r.id, r]));
  return actions
    .map((a) => {
      const r = byId.get(a.id);
      if (!r) return null;
      return {
        id: a.id,
        action: a.action || r.action,
        reason: a.reason || "",
        name: r.name,
        type: r.type,
        saveUsd: r.saveUsd,
        saveKrw: Math.round(r.saveUsd * snapshot.rate),
      };
    })
    .filter(Boolean);
}

// ---- API 키 없이도 데모가 굴러가도록 하는 규칙 기반 응답 ----
function fallback(question, snapshot) {
  const ctx = {
    costUsd: snapshot?.ov?.costUsd,
    byService: snapshot?.ov?.byService,
    fx: { rate: snapshot?.rate, fxImpactKrw: snapshot?.fxImpactKrw },
    idle: snapshot?.idle || [],
  };
  const q = (question || "").toLowerCase();
  const krw = (usd) => "₩" + Math.round(usd * (ctx.fx?.rate || 1382)).toLocaleString("ko-KR");
  const totalSave = (ctx.idle || []).reduce((s, r) => s + r.saveUsd, 0);
  let answer, plan;

  if (q.includes("환율") || q.includes("fx")) {
    const impact = ctx.fx?.fxImpactKrw || 0;
    answer = `사용량은 지난달과 비슷하지만, 원/달러 환율이 오르면서 **환율만으로 약 ${"₩" + Math.round(impact).toLocaleString("ko-KR")}**가 더 청구되는 효과가 있어요. 달러 강세 구간이라면 **USD 선불형 예약 인스턴스**로 지금 락인해 환율·비용을 동시에 방어하는 걸 추천합니다.`;
  } else if (q.includes("정리") || q.includes("절감") || q.includes("아낄") || q.includes("줄여") || q.includes("뭘")) {
    answer = `유휴 자원 **${(ctx.idle || []).length}건**을 찾았어요. 전부 정리하면 **월 약 $${totalSave.toFixed(1)} (${krw(totalSave)})** 절감됩니다. 아래 실행안에서 원클릭으로 조치할 수 있어요.`;
    plan = (ctx.idle || []).map((r) => ({
      id: r.id, action: r.action, reason: r.metric,
      name: r.name, type: r.type, saveUsd: r.saveUsd,
      saveKrw: Math.round(r.saveUsd * (ctx.fx?.rate || 1382)),
    }));
  } else {
    const top = ctx.byService?.[0];
    answer = `이번달 총비용은 **$${ctx.costUsd} (${krw(ctx.costUsd)})**이고, 가장 큰 비중은 **${top?.name} ($${top?.usd})**입니다. 유휴 자원을 정리하면 **월 $${totalSave.toFixed(1)}**를 아낄 수 있어요. "환율 영향"이나 "20% 줄여줘"도 물어보세요.`;
  }
  return { answer, plan, steps: [], model: "fallback", live: false };
}
