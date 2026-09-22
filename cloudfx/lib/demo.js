// 예시 데이터 — AWS 자격증명이 없을 때 자동으로 사용됩니다.
// 실제 연동 시 lib/aws.js 가 이 값을 실데이터로 대체합니다.

export const PREV_MONTH = { usd: 1188.4, fxRate: 1335 }; // 지난달 사용량/환율(비교 기준)

export function demoOverview() {
  const byService = [
    { name: "EC2", usd: 796.5 },
    { name: "RDS", usd: 231.2 },
    { name: "데이터전송", usd: 102.8 },
    { name: "S3", usd: 77.1 },
    { name: "기타", usd: 77.0 },
  ];
  const usd = byService.reduce((s, x) => s + x.usd, 0); // = 1284.6
  return {
    costUsd: Math.round(usd * 100) / 100,
    byService,
    weekly: [
      { label: "1주", usd: 210 },
      { label: "2주", usd: 245 },
      { label: "3주", usd: 268 },
      { label: "4주", usd: 312 },
    ],
    forecastUsd: 1910,
  };
}

export function demoIdle() {
  return [
    { id: "i-0a1b2c3d", name: "web-prod-03", type: "m5.xlarge", region: "ap-northeast-2", metric: "CPU 2%", saveUsd: 86, action: "stop" },
    { id: "i-0e4f5g6h", name: "batch-worker", type: "t3.large", region: "ap-northeast-2", metric: "CPU 4%", saveUsd: 61, action: "stop" },
    { id: "vol-07a8b9c0", name: "미연결 EBS", type: "gp2 200GB", region: "unattached", metric: "미연결", saveUsd: 20, action: "delete" },
    { id: "eip-0c1d2e3f", name: "미사용 Elastic IP", type: "EIP", region: "unassociated", metric: "미사용", saveUsd: 3.6, action: "release" },
  ];
}
