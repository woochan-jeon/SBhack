import ChannelHeader from "@/components/channel-header";
import FlowBoardLoader from "@/components/flow-board-loader";

export default function FlowboardPage() {
  return (
    <>
      <ChannelHeader
        icon="🗺️"
        title="플로우보드"
        description="프로젝트/작업 진행상황을 무한 캔버스에서 보는 개인용 타임라인 보드 (이 브라우저에만 저장됨)"
      />
      <FlowBoardLoader />
    </>
  );
}
