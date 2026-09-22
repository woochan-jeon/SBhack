// AWS 연동 계층.
// 자격증명이 있으면 실제 AWS 데이터를, 없거나 실패하면 예시 데이터를 반환합니다.
// AWS SDK는 함수 안에서 lazy import → 패키지 미설치 시에도 데모로 동작.

import { demoOverview, demoIdle, PREV_MONTH } from "./demo.js";

export const usingAws = !!(process.env.AWS_ACCESS_KEY_ID || process.env.USE_AWS === "true");

function monthRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

function lastMonthRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

// ---- 비용 개요 ----
export async function getOverview() {
  if (!usingAws) return { source: "demo", ...demoOverview(), prevUsd: PREV_MONTH.usd };
  try {
    const { CostExplorerClient, GetCostAndUsageCommand, GetCostForecastCommand } =
      await import("@aws-sdk/client-cost-explorer");
    const ce = new CostExplorerClient({ region: "us-east-1" }); // Cost Explorer는 us-east-1 전용
    const { start, end } = monthRange();

    // 서비스별 이번달 비용
    const cost = await ce.send(new GetCostAndUsageCommand({
      TimePeriod: { Start: start, End: end },
      Granularity: "MONTHLY",
      Metrics: ["UnblendedCost"],
      GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }],
    }));
    const groups = cost.ResultsByTime?.[0]?.Groups || [];
    let byService = groups.map((g) => ({
      name: g.Keys?.[0] || "기타",
      usd: Math.round(parseFloat(g.Metrics.UnblendedCost.Amount) * 100) / 100,
    })).filter((x) => x.usd > 0).sort((a, b) => b.usd - a.usd);
    // 상위 5개 + 나머지 합산
    if (byService.length > 5) {
      const top = byService.slice(0, 5);
      const rest = byService.slice(5).reduce((s, x) => s + x.usd, 0);
      byService = [...top, { name: "기타", usd: Math.round(rest * 100) / 100 }];
    }
    const costUsd = Math.round(byService.reduce((s, x) => s + x.usd, 0) * 100) / 100;

    // 하이브리드: 실지출이 사실상 없으면(신규/미사용 계정) 대표 비용 데이터로 채운다.
    // 실지출이 $1 이상 쌓이면 이 분기를 건너뛰고 자동으로 실데이터를 사용한다.
    if (costUsd < 1) {
      return { source: "aws", representative: true, ...demoOverview(), prevUsd: PREV_MONTH.usd };
    }

    // 월말 예측
    let forecastUsd = costUsd;
    try {
      const fc = await ce.send(new GetCostForecastCommand({
        TimePeriod: { Start: new Date().toISOString().slice(0, 10), End: end },
        Granularity: "MONTHLY",
        Metric: "UNBLENDED_COST",
      }));
      forecastUsd = costUsd + parseFloat(fc.Total.Amount);
    } catch { /* 예측 실패 시 현재값 유지 */ }

    // 주간 추이(최근 28일 일별 → 4주 버킷)
    let weekly = demoOverview().weekly;
    try {
      const d0 = new Date(); d0.setUTCDate(d0.getUTCDate() - 28);
      const daily = await ce.send(new GetCostAndUsageCommand({
        TimePeriod: { Start: d0.toISOString().slice(0, 10), End: new Date().toISOString().slice(0, 10) },
        Granularity: "DAILY",
        Metrics: ["UnblendedCost"],
      }));
      const days = (daily.ResultsByTime || []).map((r) => parseFloat(r.Total.UnblendedCost.Amount));
      weekly = [0, 1, 2, 3].map((w) => ({
        label: `${w + 1}주`,
        usd: Math.round(days.slice(w * 7, w * 7 + 7).reduce((s, x) => s + x, 0) * 100) / 100,
      }));
    } catch { /* 유지 */ }

    // 지난달 실제 총비용(비교 기준) — 실데이터로 환율/사용량 분해를 정확히 하기 위함
    let prevUsd = null;
    try {
      const lm = lastMonthRange();
      const pc = await ce.send(new GetCostAndUsageCommand({
        TimePeriod: { Start: lm.start, End: lm.end },
        Granularity: "MONTHLY",
        Metrics: ["UnblendedCost"],
      }));
      const amt = parseFloat(pc.ResultsByTime?.[0]?.Total?.UnblendedCost?.Amount);
      if (!isNaN(amt)) prevUsd = Math.round(amt * 100) / 100;
    } catch { /* 지난달 데이터 없음 → null 유지 */ }

    return { source: "aws", costUsd, byService, weekly, forecastUsd: Math.round(forecastUsd * 100) / 100, prevUsd };
  } catch (e) {
    console.warn("[aws] 비용 조회 실패, 데모로 폴백:", e.message);
    return { source: "demo", ...demoOverview(), prevUsd: PREV_MONTH.usd };
  }
}

// ---- 유휴 자원 ----
export async function getIdle() {
  if (!usingAws) return { source: "demo", resources: demoIdle() };
  try {
    const region = process.env.AWS_REGION || "ap-northeast-2";
    const { EC2Client, DescribeInstancesCommand, DescribeVolumesCommand, DescribeAddressesCommand } =
      await import("@aws-sdk/client-ec2");
    const { CloudWatchClient, GetMetricStatisticsCommand } =
      await import("@aws-sdk/client-cloudwatch");
    const ec2 = new EC2Client({ region });
    const cw = new CloudWatchClient({ region });
    const resources = [];

    // 실행 중 EC2 + 평균 CPU
    const inst = await ec2.send(new DescribeInstancesCommand({
      Filters: [{ Name: "instance-state-name", Values: ["running"] }],
    }));
    const end = new Date(), start = new Date(end - 7 * 864e5);
    for (const r of inst.Reservations || []) {
      for (const i of r.Instances || []) {
        let cpu = null;
        try {
          const m = await cw.send(new GetMetricStatisticsCommand({
            Namespace: "AWS/EC2", MetricName: "CPUUtilization",
            Dimensions: [{ Name: "InstanceId", Value: i.InstanceId }],
            StartTime: start, EndTime: end, Period: 86400, Statistics: ["Average"],
          }));
          const pts = m.Datapoints || [];
          if (pts.length) cpu = pts.reduce((s, p) => s + p.Average, 0) / pts.length;
        } catch { /* 메트릭 없음 */ }
        if (cpu !== null && cpu < 5) {
          const name = (i.Tags || []).find((t) => t.Key === "Name")?.Value || i.InstanceId;
          resources.push({
            id: i.InstanceId, name, type: i.InstanceType, region,
            metric: `CPU ${cpu.toFixed(1)}%`, saveUsd: estimateMonthly(i.InstanceType), action: "stop",
          });
        }
      }
    }
    // 미연결 EBS
    const vols = await ec2.send(new DescribeVolumesCommand({
      Filters: [{ Name: "status", Values: ["available"] }],
    }));
    for (const v of vols.Volumes || []) {
      resources.push({
        id: v.VolumeId, name: "미연결 EBS", type: `${v.VolumeType} ${v.Size}GB`, region,
        metric: "미연결", saveUsd: Math.round(v.Size * 0.1 * 100) / 100, action: "delete",
      });
    }
    // 미사용 Elastic IP
    const eips = await ec2.send(new DescribeAddressesCommand({}));
    for (const a of eips.Addresses || []) {
      if (!a.AssociationId) resources.push({
        id: a.AllocationId, name: "미사용 Elastic IP", type: "EIP", region,
        metric: "미사용", saveUsd: 3.6, action: "release",
      });
    }
    return { source: "aws", resources };
  } catch (e) {
    console.warn("[aws] 유휴 자원 조회 실패, 데모로 폴백:", e.message);
    return { source: "demo", resources: demoIdle() };
  }
}

// ---- 조치: EC2 중지 (안전: stop만 실제 구현) ----
export async function stopInstance(id) {
  if (!usingAws) return { ok: true, simulated: true };
  const region = process.env.AWS_REGION || "ap-northeast-2";
  const { EC2Client, StopInstancesCommand } = await import("@aws-sdk/client-ec2");
  const ec2 = new EC2Client({ region });
  await ec2.send(new StopInstancesCommand({ InstanceIds: [id] }));
  return { ok: true, simulated: false };
}

// 인스턴스 타입별 월 비용 대략 추정(ap-northeast-2 온디맨드 근사치)
function estimateMonthly(type) {
  const hourly = { "t3.micro": 0.013, "t3.small": 0.026, "t3.medium": 0.052, "t3.large": 0.1043,
    "m5.large": 0.118, "m5.xlarge": 0.236, "m5.2xlarge": 0.472, "c5.large": 0.107 };
  return Math.round((hourly[type] || 0.1) * 730 * 100) / 100;
}

export { PREV_MONTH };
