# CloudFX — 환율까지 아는 AI 클라우드 비용 코파일럿

글로벌 FinOps 툴은 달러권 대기업용이라 **환율을 모른다**. CloudFX는 환율에 시달리는
아시아 무역·커머스 기업을 위한, **환율을 아는** 클라우드 비용 코파일럿입니다.

- 💰 AWS 비용을 **원화/엔화로 실질 환산** + "환율만으로 늘어난 금액" 표시
- 🤖 AI 챗 — "이번주 왜 늘었어?"에 원인·절감안으로 대화 응답 (Claude)
- 🔻 유휴 자원 **원클릭 정리** (EC2 중지 등 실제 조치)
- 💱 환율 시나리오 시뮬레이터

## 빠른 시작

```bash
npm install
npm start
```

→ http://localhost:3000

**자격증명이 하나도 없어도 예시 데이터로 바로 실행됩니다.** 실데이터로 전환하려면:

```bash
cp .env.example .env   # Windows: copy .env.example .env
```

`.env`에 값을 채우면 자동 전환됩니다:
- `ANTHROPIC_API_KEY` → AI 챗이 실제 Claude로 응답 (없으면 규칙 기반 폴백)
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` → 실제 AWS 비용/자원 연동

## AWS IAM 최소 권한

```
ce:GetCostAndUsage, ce:GetCostForecast
ec2:DescribeInstances, ec2:DescribeVolumes, ec2:DescribeAddresses
cloudwatch:GetMetricStatistics
ec2:StopInstances          ← 조치(쓰기)는 이것만
```

⚠️ 데모에서는 **stop(중지)만 실제 실행**됩니다. 되돌릴 수 있어 안전합니다.

## 구조

```
server.js          Express: /api/overview, /api/idle, /api/action, /api/ask
lib/aws.js         AWS 비용조회·유휴탐지·중지 (실데이터↔예시 자동전환)
lib/fx.js          실시간 USD/KRW 환율
lib/ai.js          Claude 비용 분석 챗 (폴백 포함)
lib/demo.js        예시 데이터
public/index.html  대시보드
```

## 로드맵 (해커톤 제출용 → 본선)
- [ ] 실제 AWS 계정 연동 검증 (비용·자원)
- [ ] 엔화(JPY) 지원
- [ ] 예측에 환율 시나리오 결합
- [ ] 조치 종류 확대 (EBS/EIP/gp2→gp3)
