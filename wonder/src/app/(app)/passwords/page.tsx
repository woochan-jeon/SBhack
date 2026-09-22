import ChannelHeader from "@/components/channel-header";
import PasswordGate from "@/components/password-gate";
import PasswordBoard from "@/components/password-board";
import { prisma } from "@/lib/prisma";
import { gateConfigured, isUnlocked } from "@/lib/password-gate";
import { lockAction } from "./actions";

export default async function PasswordsPage() {
  const unlocked = await isUnlocked();

  if (!unlocked) {
    return (
      <>
        <ChannelHeader icon="🔒" title="비밀번호" description="팀 공용 계정/비밀번호 보관 채널" />
        <div className="flex flex-1 items-center justify-center p-6">
          <PasswordGate configured={gateConfigured()} />
        </div>
      </>
    );
  }

  const entries = await prisma.passwordEntry.findMany({
    orderBy: [{ pinned: "desc" }, { createdAt: "asc" }],
  });

  return (
    <>
      <ChannelHeader
        icon="🔒"
        title="비밀번호"
        description="팀 공용 계정/비밀번호 보관 채널 — 아무나 접속 가능한 링크이므로 채널 밖으로 공유하지 마세요."
        action={
          <form action={lockAction}>
            <button
              type="submit"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-900 hover:bg-gray-50"
            >
              🔒 잠그기
            </button>
          </form>
        }
      />
      <div className="flex-1 overflow-y-auto p-6">
        <PasswordBoard
          entries={entries.map((e) => ({
            id: e.id,
            service: e.service,
            account: e.account,
            password: e.password,
            note: e.note,
            sourceUrl: e.sourceUrl,
            pinned: e.pinned,
          }))}
        />
      </div>
    </>
  );
}
