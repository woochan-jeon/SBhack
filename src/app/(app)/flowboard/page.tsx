import ChannelHeader from "@/components/channel-header";
import FlowBoardLoader from "@/components/flow-board-loader";
import { getBoardState } from "./actions";

export default async function FlowboardPage() {
  const initialState = await getBoardState();

  return (
    <>
      <ChannelHeader
        icon="🗺️"
        title="플로우보드"
        description="프로젝트/작업 진행상황을 무한 캔버스에 자유롭게 배치해서 보는 팀 공용 보드"
      />
      <FlowBoardLoader initialState={initialState} />
    </>
  );
}
