"use client";

import { useActionState } from "react";
import { unlockAction, type ActionState } from "@/app/(app)/passwords/actions";

const initialState: ActionState = {};

export default function PasswordGate({ configured }: { configured: boolean }) {
  const [state, formAction, pending] = useActionState(unlockAction, initialState);

  if (!configured) {
    return (
      <div className="max-w-sm rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-900">
        관리자가 아직 이 채널의 비밀번호를 설정하지 않았습니다.
        <br />
        <code className="text-xs">.env</code>에 <code className="text-xs">PASSWORDS_CHANNEL_PASSPHRASE</code>를
        설정해 주세요.
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="flex w-full max-w-xs flex-col gap-3 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
    >
      <p className="text-center text-sm font-medium text-gray-900">잠긴 채널입니다</p>
      <p className="text-center text-xs text-gray-500">비밀번호를 입력해 주세요</p>
      <input
        type="password"
        name="passphrase"
        autoFocus
        required
        className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
      />
      {state.error && <p className="text-center text-xs text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-[#0066cc] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0071e3] disabled:opacity-60"
      >
        {pending ? "확인 중..." : "잠금 해제"}
      </button>
    </form>
  );
}
