// 비용 증감을 "환율 효과"와 "사용량 효과"로 분해.
// 원화 비용 = USD사용량 × 환율 이므로, 지난달 대비 원화 증감(ΔKRW)은
//   ΔKRW = 이번USD×이번환율 − 지난USD×지난환율
// 이를 두 항으로 정확히 분해한다(합이 ΔKRW와 일치):
//   사용량효과 = (이번USD − 지난USD) × 지난환율   ← 환율 고정, 사용량 변화분
//   환율효과   =  이번USD × (이번환율 − 지난환율)  ← 사용량 고정(이번), 환율 변화분
// 이 관점의 핵심 메시지: "비용이 올라도 그게 우리가 더 써서인지, 환율 탓인지"를 분리.

const r0 = (n) => Math.round(n);

export function decomposeCostChange(costUsd, prevUsd, rate, prevRate) {
  // 비교할 지난달 비용이 없으면(신규/미사용 계정 등) 분해를 건너뛴다.
  if (prevUsd == null || prevUsd <= 0) {
    return {
      insufficient: true,
      thisUsd: r0(costUsd * 100) / 100,
      thisKrw: r0(costUsd * rate),
      rate: r0(rate),
      headline: "비교할 지난달 비용 데이터가 아직 없어요 (데이터 축적 중).",
    };
  }

  const thisKrw = costUsd * rate;
  const prevKrw = prevUsd * prevRate;
  const totalKrw = thisKrw - prevKrw;

  const usageKrw = (costUsd - prevUsd) * prevRate;
  const fxKrw = costUsd * (rate - prevRate);

  const usdChange = costUsd - prevUsd;
  const pct = prevKrw ? (totalKrw / prevKrw) * 100 : 0;
  const fxSharePct = totalKrw ? (fxKrw / totalKrw) * 100 : 0;
  const usageSharePct = totalKrw ? (usageKrw / totalKrw) * 100 : 0;

  // 한 줄 요약 문구 (데모/AI 공용)
  const dir = totalKrw >= 0 ? "증가" : "감소";
  const driver = Math.abs(fxKrw) >= Math.abs(usageKrw) ? "환율" : "사용량";
  const headline =
    `이번 달 원화 비용은 지난달 대비 ${totalKrw >= 0 ? "+" : "−"}₩${Math.abs(r0(totalKrw)).toLocaleString("ko-KR")}` +
    ` (${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%) ${dir}했고, 그중 주된 원인은 **${driver}**입니다.`;

  return {
    thisUsd: r0(costUsd * 100) / 100,
    prevUsd: r0(prevUsd * 100) / 100,
    thisKrw: r0(thisKrw),
    prevKrw: r0(prevKrw),
    totalKrw: r0(totalKrw),
    usageKrw: r0(usageKrw),
    fxKrw: r0(fxKrw),
    usdChange: r0(usdChange * 100) / 100,
    rate: r0(rate),
    prevRate: r0(prevRate),
    pct: Math.round(pct * 10) / 10,
    fxSharePct: Math.round(fxSharePct),
    usageSharePct: Math.round(usageSharePct),
    driver,
    headline,
  };
}
