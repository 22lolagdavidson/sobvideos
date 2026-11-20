import "server-only";
import type { Agency, Election, Employee, EmployerGroup, Plan } from "@prisma/client";
import { sendMail } from "@/lib/mail";
import { TIERS, WAIVE_REASONS } from "@/lib/domain/constants";
import { money } from "@/lib/domain/cost";
import { fmtDate } from "@/lib/domain/window";

const appUrl = () => (process.env.NEXTAUTH_URL || process.env.AUTH_URL || "http://localhost:3000").replace(/\/$/, "");

/** Sent after every employee submission or change. Contains no plan rates beyond the employee's own cost. */
export async function sendElectionConfirmation(a: {
  employee: Employee;
  group: EmployerGroup;
  agency: Pick<Agency, "name" | "contactEmail">;
  election: Election;
  plan: Plan | null;
}) {
  const { employee, group, agency, election, plan } = a;
  const first = employee.name.split(" ")[0];
  const deps = (election.dependents as { name: string; relationship: string }[]) ?? [];
  const lines =
    election.status === "ENROLLED"
      ? [
          `Plan: ${plan?.name ?? "—"} (${TIERS[election.tier]})`,
          deps.length ? `Covering: ${deps.map((d) => `${d.name} (${d.relationship})`).join(", ")}` : null,
          `Your cost: ${money(election.perPaycheck)} per paycheck (${money(election.employeeShare)} a month)`,
          `Coverage starts: ${fmtDate(group.effectiveDate)}`,
        ]
      : [
          "You chose to waive coverage.",
          `Reason: ${election.waiveReason ? WAIVE_REASONS[election.waiveReason] : "—"}${election.waiveNote ? `: ${election.waiveNote}` : ""}`,
          "Unless you have a qualifying life event, you may not be able to enroll until the next open enrollment.",
        ];
  const text = [
    `Hi ${first},`,
    "",
    `We received your ${group.planYear} benefits election for ${group.name} on ${election.signedAt.toLocaleString("en-US", { timeZone: "America/Denver", dateStyle: "medium", timeStyle: "short" })} (Mountain time).`,
    "",
    ...lines.filter(Boolean),
    "",
    `You can review or change your election until ${fmtDate(group.windowEnd)}: ${appUrl()}/enroll`,
    "",
    `Questions? Contact ${agency.name}${agency.contactEmail ? ` at ${agency.contactEmail}` : ""}.`,
  ].join("\n");
  await sendMail({ to: employee.email, subject: `Your ${group.planYear} benefits election is confirmed`, text });
}

export async function sendEnrollmentReminder(a: { employee: Employee; group: EmployerGroup; agency: Pick<Agency, "name"> }) {
  const { employee, group, agency } = a;
  const text = [
    `Hi ${employee.name.split(" ")[0]},`,
    "",
    `Open enrollment for ${group.name}'s ${group.planYear} health benefits closes on ${fmtDate(group.windowEnd)}, and we don't have your choice yet.`,
    "",
    "It takes about 5 minutes. You can compare plans, watch a short cartoon explainer for each one, and enroll or waive coverage:",
    `${appUrl()}/enroll`,
    "",
    `Sign in with this email address (${employee.email}).`,
    "",
    `Thanks,\n${agency.name}`,
  ].join("\n");
  await sendMail({ to: employee.email, subject: `Reminder: choose your ${group.planYear} health coverage by ${fmtDate(group.windowEnd)}`, text });
}
