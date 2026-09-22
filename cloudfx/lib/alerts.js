// 능동적 이상탐지 — 사용자가 묻기 전에 시스템이 먼저 점검 항목을 찾아낸다.
// 규칙 기반(빠르고 결정적 → 데모 안정적). 결과를 프론트 알림 카드 + AI 브리핑에 사용.

const won = (n) => "₩" + Math.round(n).toLocaleString("ko-KR");

export function detectAlerts(snapshot) {
  const { ov, rate, idle, prevMonth } = snapshot;
  const alerts = [];

  // 1) 유휴 리소스 낭비
  const active = (idle || []).filter((r) => !r.done);
  const saveUsd = active.reduce((s, r) => s + r.saveUsd, 0);
  if (active.length) {
    alerts.push({
      level: saveUsd >= 50 ? "high" : "warn",
      icon: "🗑️",
      title: `유휴 리소스 ${active.length}건이 매달 $${saveUsd.toFixed(1)} (${won(saveUsd * rate)}) 낭비 중`,
      detail: "저사용 EC2·미연결 EBS·유휴 Elastic IP를 정리하면 즉시 절감됩니다.",
      action: { label: "AI로 정리안 받기", kind: "cleanup" },
    });
  }

  // 2) 환율 리스크 (지난달 대비 상승)
  const prevRate = prevMonth?.fxRate;
  if (prevRate) {
    const pct = ((rate - prevRate) / prevRate) * 100;
    if (pct >= 1) {
      alerts.push({
        level: rate >= 1400 ? "warn" : "info",
        icon: "💱",
        title: `원/달러 환율 ${Math.round(prevRate)} → ${Math.round(rate)} (+${pct.toFixed(1)}%)`,
        detail: `달러 청구액이 그대로여도 원화 부담이 ${pct.toFixed(1)}% 커집니다. 달러 강세 구간엔 USD 선불형 예약 인스턴스로 환율·비용을 함께 방어하세요.`,
        action: { label: "환율 시뮬레이션", kind: "fxsim" },
      });
    }
  }

  // 3) 월말 예산 초과 전망 (MONTHLY_BUDGET_USD 설정 시)
  const budget = Number(process.env.MONTHLY_BUDGET_USD) || 0;
  if (budget > 0 && ov.forecastUsd > budget) {
    const over = ov.forecastUsd - budget;
    alerts.push({
      level: "high",
      icon: "📈",
      title: `월말 예상 $${ov.forecastUsd} → 예산 $${budget} 초과 전망`,
      detail: `현재 추세면 예산을 $${over.toFixed(0)} (${won(over * rate)}) 초과합니다.`,
    });
  }

  // 4) 전월 대비 비용 급증 (실제 지난달 데이터가 있을 때만)
  const prevUsd = ov.prevUsd;
  if (prevUsd != null && prevUsd > 0) {
    const pct = ((ov.costUsd - prevUsd) / prevUsd) * 100;
    if (pct >= 20) {
      alerts.push({
        level: "high",
        icon: "🚨",
        title: `이번 달 비용이 지난달 대비 +${pct.toFixed(0)}% 급증`,
        detail: `$${prevUsd} → $${ov.costUsd}. 원인(환율/사용량)을 분해해 확인하세요.`,
        action: { label: "원인 분석", kind: "diagnose" },
      });
    }
  }

  // 심각도 순 정렬
  const order = { high: 0, warn: 1, info: 2 };
  alerts.sort((a, b) => order[a.level] - order[b.level]);

  const brief = alerts.length
    ? `점검 항목 ${alerts.length}건 감지 — 가장 시급: ${alerts[0].title}`
    : "특이사항 없음. 유휴 리소스도 없고 비용도 안정적입니다.";

  return { alerts, brief, count: alerts.length };
}
