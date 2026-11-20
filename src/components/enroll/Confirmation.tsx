import Link from "next/link";
import type { ElectionStatus, Tier, WaiveReason } from "@prisma/client";
import { TIERS, WAIVE_REASONS } from "@/lib/domain/constants";
import { money } from "@/lib/domain/cost";
import type { Dependent } from "@/lib/domain/tier";

type Props = {
  justSubmitted: boolean;
  windowOpen: boolean;
  windowLabel: string;
  effectiveDate: string;
  agency: { name: string; contactEmail: string | null };
  election: {
    status: ElectionStatus;
    planName: string | null;
    planId: string | null;
    tier: Tier;
    perPaycheck: number;
    employeeMonthly: number;
    dependents: Dependent[];
    waiveReason: WaiveReason | null;
    waiveNote: string | null;
    signedAt: string;
    enteredByAdmin: boolean;
    hasExplainer: boolean;
  };
};

export function Confirmation({ justSubmitted, windowOpen, windowLabel, effectiveDate, agency, election: e }: Props) {
  const when = new Date(e.signedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  return (
    <div className="card" style={{ maxWidth: 820 }}>
      <div className="notice ok" role="status" style={{ marginBottom: 14 }}>
        ✓ {justSubmitted ? "Thanks! Your election was received" : "Your election is on file"} ({when}).{" "}
        {justSubmitted && "We emailed you a confirmation."}
        {e.enteredByAdmin && " It was entered by your benefits administrator."}
      </div>
      <h1>{e.status === "WAIVED" ? "You waived coverage" : e.planName}</h1>
      {e.status === "WAIVED" ? (
        <p className="muted">
          Reason: {e.waiveReason ? WAIVE_REASONS[e.waiveReason] : "—"}
          {e.waiveNote ? `: ${e.waiveNote}` : ""}
        </p>
      ) : (
        <p className="muted">
          {TIERS[e.tier]} · <b>{money(e.perPaycheck)}</b> per paycheck ({money(e.employeeMonthly)} a month) · coverage starts {effectiveDate}
        </p>
      )}
      {e.status === "ENROLLED" && e.dependents.length > 0 && (
        <p className="small muted">Covering: {e.dependents.map((x) => x.name).join(", ")}</p>
      )}
      <div className="row">
        {windowOpen ? (
          <Link className="btn" href="/enroll?change=1">
            Change my election
          </Link>
        ) : (
          <span className="small muted">
            Enrollment is closed ({windowLabel}). Contact {agency.name} with questions.
          </span>
        )}
        {e.planId && e.hasExplainer && (
          <Link className="btn ghost" href={`/plans/${e.planId}/watch`}>
            ▶ Rewatch your plan&apos;s explainer
          </Link>
        )}
      </div>
      <p className="small muted" style={{ marginTop: 14 }}>
        Questions? {agency.name}
        {agency.contactEmail ? `: ${agency.contactEmail}` : ""}
      </p>
    </div>
  );
}
