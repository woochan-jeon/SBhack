// 실시간 USD/KRW 환율 — 무료 API(open.er-api.com), 키 불필요.
// 실패 시 폴백 환율 사용. Node 18+ 내장 fetch 사용.

const FALLBACK_RATE = 1382;
let cache = { rate: null, at: 0 };

export async function getUsdKrw() {
  // 10분 캐시
  if (cache.rate && Date.now() - cache.at < 10 * 60 * 1000) return cache.rate;
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(4000) });
    const data = await res.json();
    const rate = data?.rates?.KRW;
    if (rate) {
      cache = { rate, at: Date.now() };
      return rate;
    }
  } catch (e) {
    console.warn("[fx] 환율 조회 실패, 폴백 사용:", e.message);
  }
  return FALLBACK_RATE;
}
