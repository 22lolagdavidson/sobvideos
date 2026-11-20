import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { Visual } from "@/lib/explainer/schema";
import { grow, pop, slideUp } from "./anim";
import { baloo, inter } from "./fonts";

const INK = "#1d2340";
const H = "#1b3f94";

const wrap: React.CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  fontFamily: baloo,
  color: INK,
  padding: 10,
  boxSizing: "border-box",
};
const h2: React.CSSProperties = { fontSize: 30, margin: "0 0 12px", color: H, fontWeight: 700, lineHeight: 1.1 };
const p: React.CSSProperties = { fontSize: 21, margin: "8px 0 0", color: "#3a4266", fontFamily: inter, fontWeight: 500 };

/** The scene visual inside the white card. Designed at 530×410 (the card's inner size in a 960×540 stage). */
export function Panel({ v, planYear, reveal }: { v: Visual; planYear?: string; reveal?: boolean }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const P = (d = 0) => pop(frame, fps, d);
  const S = (d = 0) => slideUp(frame, fps, d);

  switch (v.kind) {
    case "title":
      return (
        <div style={wrap}>
          <div style={{ ...P(), display: "inline-block", background: "#c2410c", color: "#fff", borderRadius: 999, padding: "2px 14px", fontSize: 18, marginBottom: 12, fontWeight: 700 }}>
            {planYear ? `${planYear} plan explainer` : "Plan explainer"}
          </div>
          <div style={{ ...P(0.15), fontSize: v.title.length > 24 ? 38 : 46, margin: 0, lineHeight: 1.05, color: H, fontWeight: 800 }}>{v.title}</div>
          <p style={{ ...p, ...S(0.4) }}>{v.subtitle}</p>
        </div>
      );
    case "meter": {
      const fill = grow(frame, fps, 0.4, 2.6) * 78;
      return (
        <div style={wrap}>
          <div style={{ ...h2, ...S() }}>{v.label || "Deductible"}</div>
          <div style={{ display: "flex", gap: 30, alignItems: "center" }}>
            <div style={{ position: "relative", width: 150, height: 210, border: `7px solid ${INK}`, borderTopWidth: 0, borderRadius: "0 0 34px 34px", background: "#fff", overflow: "hidden" }}>
              <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 7, background: INK }} />
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: `${fill}%`,
                  background: "repeating-linear-gradient(45deg,#ffcf4a 0 14px,#ffbf1f 14px 28px)",
                }}
              />
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ ...P(0.6), fontSize: 44, fontWeight: 800, color: "#e0414f", lineHeight: 1 }}>{v.amount}</div>
              <p style={{ ...p, ...S(0.9), maxWidth: 240 }}>{v.note}</p>
            </div>
          </div>
        </div>
      );
    }
    case "prices":
      return (
        <div style={wrap}>
          <div style={{ ...h2, ...S() }}>{v.title || "What a visit costs"}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", maxWidth: 520 }}>
            {v.items.map((it, i) => (
              <div key={i} style={{ ...P(0.25 + i * 0.35), background: "#fff", border: `4px solid ${INK}`, borderRadius: 14, padding: "8px 14px", minWidth: 150, boxShadow: `4px 4px 0 ${INK}` }}>
                <b style={{ display: "block", fontSize: 30, color: "#2b59c3", lineHeight: 1 }}>{it.amount}</b>
                <span style={{ fontSize: 16, fontFamily: inter, fontWeight: 600, color: "#3a4266" }}>{it.label}</span>
              </div>
            ))}
          </div>
        </div>
      );
    case "split": {
      const g = grow(frame, fps, 0.3, 1.4);
      const cell = (w: number, bg: string): React.CSSProperties => ({
        width: `${w * g}%`,
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        color: "#fff",
        fontWeight: 800,
        fontSize: 26,
        lineHeight: 1,
        overflow: "hidden",
        whiteSpace: "nowrap",
      });
      return (
        <div style={wrap}>
          <div style={{ ...h2, ...S() }}>{v.title || "Coinsurance"}</div>
          <p style={{ ...p, ...S(0.1), margin: "0 0 10px" }}>After you meet your deductible, you split the bill:</p>
          <div style={{ display: "flex", width: 470, height: 86, border: `5px solid ${INK}`, borderRadius: 18, overflow: "hidden" }}>
            <div style={cell(v.you, "#d93a4a")}>
              {v.you}%<small style={{ fontSize: 14, fontFamily: inter, fontWeight: 700 }}>YOU</small>
            </div>
            <div style={cell(v.plan, "#2b59c3")}>
              {v.plan}%<small style={{ fontSize: 14, fontFamily: inter, fontWeight: 700 }}>THE PLAN</small>
            </div>
          </div>
        </div>
      );
    }
    case "shield":
      return (
        <div style={wrap}>
          <div style={{ ...h2, ...S() }}>{v.label || "Out-of-pocket max"}</div>
          <svg viewBox="0 0 200 220" width={190} height={200} style={P(0.3)}>
            <path d="M100 8 L186 40 C186 120 150 180 100 212 C50 180 14 120 14 40 Z" fill="#2b59c3" stroke={INK} strokeWidth={8} />
            <path d="M100 30 L166 54 C166 118 138 164 100 190 C62 164 34 118 34 54 Z" fill="#3f7be0" />
            <text x={100} y={125} textAnchor="middle" fontFamily={baloo} fontWeight={800} fontSize={v.amount.length > 8 ? 30 : 38} fill="#fff">
              {v.amount}
            </text>
          </svg>
          <p style={{ ...p, ...S(0.7), maxWidth: 440 }}>{v.note || "Once you pay this much in a year, the plan pays 100% of covered in-network care."}</p>
        </div>
      );
    case "story":
      return (
        <div style={wrap}>
          <div style={{ ...P(), background: "#fff", width: 440, border: `4px solid ${INK}`, borderRadius: 8, padding: "14px 20px", textAlign: "left", fontFamily: inter, boxShadow: `6px 6px 0 ${INK}` }}>
            <div style={{ fontFamily: baloo, fontSize: 24, margin: "0 0 8px", color: H, textAlign: "center", fontWeight: 700 }}>{v.title}</div>
            {v.rows.map((r, i) => (
              <div key={i} style={{ ...S(0.4 + i * 0.45), display: "flex", justifyContent: "space-between", borderBottom: "2px dashed #d5d9e8", padding: "5px 0", fontSize: 17, fontWeight: 600 }}>
                <span>{r.label}</span>
                <span>{r.amount}</span>
              </div>
            ))}
            {v.total && (
              <div style={{ ...S(0.5 + v.rows.length * 0.45), display: "flex", justifyContent: "space-between", paddingTop: 8, fontFamily: baloo, fontSize: 26, fontWeight: 800, color: "#e0414f" }}>
                <span>You&apos;d pay</span>
                <span>{v.total}</span>
              </div>
            )}
          </div>
        </div>
      );
    case "quiz":
      return (
        <div style={wrap}>
          <div style={{ width: 480 }}>
            <div style={{ ...P(), display: "inline-block", background: "#c2410c", color: "#fff", borderRadius: 999, padding: "2px 14px", fontSize: 18, marginBottom: 12, fontWeight: 700 }}>
              Quick quiz!
            </div>
            <div style={{ ...S(), fontSize: 26, fontWeight: 700, color: H, marginBottom: 12, lineHeight: 1.15 }}>{v.question}</div>
            {v.options.map((o, i) => {
              const right = reveal && i === v.answer; // the answer lights up when Patch gives it
              return (
                <div key={i} style={{ ...S(0.3 + i * 0.2), textAlign: "left", marginBottom: 9, background: right ? "#c9f2df" : "#fff", border: `4px solid ${right ? "#118457" : INK}`, borderRadius: 14, padding: "9px 14px", fontFamily: inter, fontWeight: 600, fontSize: 19, boxShadow: `4px 4px 0 ${INK}` }}>
                  {String.fromCharCode(65 + i)}. {o} {right ? "✓" : ""}
                </div>
              );
            })}
          </div>
        </div>
      );
    case "list": {
      const good = v.tone !== "bad";
      return (
        <div style={wrap}>
          <div style={{ ...h2, ...S() }}>{v.title}</div>
          <div style={{ textAlign: "left", width: 460 }}>
            {v.items.map((it, i) => (
              <div key={i} style={{ ...S(0.25 + i * 0.35), display: "flex", gap: 12, alignItems: "center", background: "#fff", border: `3px solid ${INK}`, borderRadius: 12, padding: "7px 12px", marginBottom: 8, fontSize: 19, fontFamily: inter, fontWeight: 600 }}>
                <span style={{ width: 30, height: 30, borderRadius: "50%", flex: "none", display: "grid", placeItems: "center", color: "#fff", fontWeight: 800, fontFamily: baloo, fontSize: 20, background: v.tone === "recap" ? "#2b59c3" : good ? "#16855b" : "#c93737" }}>
                  {v.tone === "recap" ? i + 1 : good ? "✓" : "✕"}
                </span>
                {it}
              </div>
            ))}
          </div>
        </div>
      );
    }
  }
}
