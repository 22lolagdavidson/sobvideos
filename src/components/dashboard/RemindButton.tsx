"use client";
import { useState, useTransition } from "react";

export function RemindButton({ count, action }: { count: number; action: () => Promise<{ ok: boolean; message: string }> }) {
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, start] = useTransition();
  return (
    <>
      <button
        className="btn"
        type="button"
        disabled={busy || count === 0}
        onClick={() => {
          if (!window.confirm(`Email a reminder to ${count} employee${count === 1 ? "" : "s"} who haven't responded?`)) return;
          start(async () => setMsg(await action()));
        }}
      >
        {busy ? "Sending…" : `✉ Remind ${count} pending`}
      </button>
      {msg && (
        <span className={`notice ${msg.ok ? "ok" : "err"}`} role="status" style={{ padding: "6px 10px" }}>
          {msg.message}
        </span>
      )}
    </>
  );
}
