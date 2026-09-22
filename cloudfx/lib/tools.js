// AI 에이전트가 호출하는 도구(tool) 정의 + 실행기.
// 도구는 서버가 미리 수집한 스냅샷(snapshot)에서 값을 읽는다.
// → 실제 AWS 호출은 요청당 1번(서버에서)만 발생하고, 에이전트의 tool 호출은
//   그 스냅샷을 조회/가공하는 안전·고속 연산이 된다. (데모 안정성)

import { decomposeCostChange } from "./analyze.js";
import { detectAlerts } from "./alerts.js";

const round = (n) => Math.round(n);

// Claude에 넘길 도구 스키마.
// 조회(read) 도구 3종은 에이전트가 자유롭게 호출한다.
// propose_savings_plan 은 "종료(terminal)" 도구로, 최종 실행안을 구조화해 반환한다.
export const toolDefs = [
  {
    name: "get_cost_overview",
    description:
      "현재 AWS 계정의 이번 달 비용 개요를 가져온다. 총비용(USD), 월말 예측, 서비스별 비용, 현재/지난달 환율, 환율만으로 늘어난 원화 금액(fxImpactKrw)을 포함한다. 비용/예산/환율 관련 질문에 먼저 호출하라.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "list_idle_resources",
    description:
      "낭비되고 있는 유휴 리소스 목록(저사용 EC2, 미연결 EBS, 미사용 Elastic IP)과 각 리소스의 월 절감액(USD/KRW), 권장 조치(stop/delete/release)를 가져온다. '절감', '정리', '줄여줘' 요청 시 반드시 먼저 호출하라.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_alerts",
    description:
      "시스템이 능동적으로 감지한 점검 항목(유휴 리소스 낭비, 환율 리스크, 예산 초과 전망, 비용 급증 등)을 심각도 순으로 가져온다. '오늘 브리핑', '점검해줘', '뭐 문제 있어?' 같은 요청에 사용하라.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "decompose_cost_change",
    description:
      "지난달 대비 이번 달 원화 비용 증감을 '환율 효과'와 '사용량 효과'로 분해한다. '비용이 왜 늘었어?', '지난달보다 왜 비싸?' 같은 질문에 사용하라. 비용 증가가 환율 탓인지 실제 사용량 증가 탓인지 구분해 통찰을 준다.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "simulate_fx",
    description:
      "가정한 원/달러 환율에서 이번 달 실질 비용(KRW)이 얼마가 되는지, 현재 환율 대비 차액이 얼마인지 계산한다. '환율이 X면?', '환율 오르면 얼마?' 같은 질문에 사용하라.",
    input_schema: {
      type: "object",
      properties: {
        rate: { type: "number", description: "가정할 원/달러 환율 (예: 1450)" },
      },
      required: ["rate"],
    },
  },
  {
    name: "propose_savings_plan",
    description:
      "조사한 내용을 바탕으로 사용자가 원클릭으로 실행할 수 있는 최종 비용 절감 실행안을 제안한다. 사용자가 비용 절감/정리/특정 목표(예: 20% 절감)를 요청했을 때, 조회 도구로 데이터를 확인한 뒤 마지막에 이 도구를 호출하라. 실제 실행은 사용자가 승인 버튼을 눌러야 일어난다.",
    input_schema: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description:
            "제안 요약. 한국어 2~4문장. 총 절감액(USD·KRW)과 왜 이 조치들을 골랐는지 근거를 포함. 핵심 숫자는 **굵게**.",
        },
        actions: {
          type: "array",
          description: "실행할 조치 목록. 조회한 유휴 리소스 중에서만 고른다.",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "리소스 ID (list_idle_resources 결과의 id 그대로)" },
              action: { type: "string", enum: ["stop", "delete", "release"], description: "권장 조치" },
              reason: { type: "string", description: "이 리소스를 고른 짧은 이유 (한국어)" },
            },
            required: ["id", "action"],
          },
        },
      },
      required: ["summary", "actions"],
    },
  },
];

// 도구 실행기. snapshot = { ov, rate, idle, fxImpactKrw, prevMonth }
export function runTool(name, input, snapshot) {
  const { ov, rate, idle, fxImpactKrw, prevMonth } = snapshot;
  switch (name) {
    case "get_cost_overview":
      return {
        costUsd: ov.costUsd,
        forecastUsd: ov.forecastUsd,
        byService: ov.byService,
        fxRate: round(rate),
        prevFxRate: prevMonth.fxRate,
        krwTotal: round(ov.costUsd * rate),
        fxImpactKrw: round(fxImpactKrw),
        note: "fxImpactKrw는 사용량이 지난달과 같다고 가정했을 때 '환율만으로' 늘어난 원화 금액입니다.",
      };

    case "list_idle_resources": {
      const resources = idle.map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        metric: r.metric,
        action: r.action,
        saveUsd: r.saveUsd,
        saveKrw: round(r.saveUsd * rate),
        done: !!r.done,
      }));
      const totalSaveUsd = Math.round(resources.reduce((s, r) => s + r.saveUsd, 0) * 100) / 100;
      return { count: resources.length, totalSaveUsd, totalSaveKrw: round(totalSaveUsd * rate), resources };
    }

    case "get_alerts":
      return detectAlerts(snapshot);

    case "decompose_cost_change":
      return decomposeCostChange(ov.costUsd, prevMonth.usd, rate, prevMonth.fxRate);

    case "simulate_fx": {
      const r = Number(input?.rate) || rate;
      return {
        atRate: round(r),
        currentRate: round(rate),
        krwTotalAtRate: round(ov.costUsd * r),
        currentKrwTotal: round(ov.costUsd * rate),
        deltaKrw: round(ov.costUsd * (r - rate)),
      };
    }

    default:
      return { error: `알 수 없는 도구: ${name}` };
  }
}
