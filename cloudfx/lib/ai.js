// Claude 기반 비용 분석 챗.
// ANTHROPIC_API_KEY 가 있으면 실제 Claude 호출, 없으면 규칙 기반 폴백 응답.

import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5";
const hasKey = !!process.env.ANTHROPIC_API_KEY;
const client = hasKey ? new Anthropic() : null;

const SYSTEM = `당신은 "CloudFX"의 AI 클라우드 비용 코파일럿입니다.
한국/일본 무역·커머스 기업을 위해, AWS 비용을 분석하고 절감안을 제시합니다.
특징: 클라우드 요금은 USD로 청구되므로 **환율(원/달러) 영향**을 항상 함께 고려합니다.
규칙:
- 제공된 실제 비용 데이터(JSON)에만 근거해 답하세요. 숫자를 지어내지 마세요.
- 답변은 한국어로, 3~5문장 이내로 간결하게. 핵심 숫자는 굵게(**) 강조.
- 가능하면 구체적 절감 금액(USD와 원화)과 실행 가능한 다음 행동을 제시하세요.`;

export async function ask(question, context) {
  if (!hasKey) return fallback(question, context);
  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM,
      messages: [{
        role: "user",
        content: `다음은 현재 AWS 계정의 실제 비용 데이터입니다:\n${JSON.stringify(context, null, 2)}\n\n질문: ${question}`,
      }],
    });
    const text = res.content.find((b) => b.type === "text")?.text;
    return { answer: text || "응답을 생성하지 못했어요.", model: MODEL, live: true };
  } catch (e) {
    console.warn("[ai] Claude 호출 실패, 폴백 사용:", e.message);
    return fallback(question, context);
  }
}

// API 키 없이도 데모가 굴러가도록 하는 규칙 기반 응답
function fallback(question, ctx) {
  const q = (question || "").toLowerCase();
  const krw = (usd) => "₩" + Math.round(usd * (ctx.fx?.rate || 1382)).toLocaleString("ko-KR");
  const totalSave = (ctx.idle || []).reduce((s, r) => s + r.saveUsd, 0);
  let answer;
  if (q.includes("환율") || q.includes("fx")) {
    const impact = ctx.fx?.fxImpactKrw || 0;
    answer = `사용량은 지난달과 비슷하지만, 원/달러 환율이 오르면서 **환율만으로 약 ${"₩" + Math.round(impact).toLocaleString("ko-KR")}**가 더 청구되는 효과가 있어요. 달러 강세 구간이라면 **USD 선불형 예약 인스턴스**로 지금 락인해 환율·비용을 동시에 방어하는 걸 추천합니다.`;
  } else if (q.includes("정리") || q.includes("절감") || q.includes("아낄") || q.includes("뭘")) {
    answer = `유휴 자원 **${(ctx.idle || []).length}건**을 찾았어요. 전부 정리하면 **월 약 $${totalSave.toFixed(1)} (${krw(totalSave)})** 절감됩니다. 오른쪽 표에서 원클릭으로 조치할 수 있어요.`;
  } else {
    const top = ctx.byService?.[0];
    answer = `이번달 총비용은 **$${ctx.costUsd} (${krw(ctx.costUsd)})**이고, 가장 큰 비중은 **${top?.name} ($${top?.usd})**입니다. 유휴 자원을 정리하면 **월 $${totalSave.toFixed(1)}**를 아낄 수 있어요. "환율 영향"이나 "뭘 정리하면 좋아?"도 물어보세요.`;
  }
  return { answer, model: "fallback", live: false };
}
