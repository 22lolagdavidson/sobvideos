import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { groupScope } from "@/lib/authz";
import { audit } from "@/lib/audit";
import { toCsv } from "@/lib/csv";
import { dashboardData } from "@/lib/server/dashboard";
import { TIERS, WAIVE_REASONS } from "@/lib/domain/constants";
import { isoDate } from "@/lib/domain/window";
import type { Dependent } from "@/lib/domain/tier";

const c2 = (n: unknown) => Number(n).toFixed(2); // cents only at output time

/** CSV of every roster employee with their latest election. Admins of the group only. */
export async function GET(_: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const user = (await auth())?.user;
  if (!user || (user.role !== "BROKER_ADMIN" && user.role !== "EMPLOYER_ADMIN"))
    return new NextResponse("Not found", { status: 404 });
  const group = await prisma.employerGroup.findFirst({ where: { id: groupId, ...groupScope(user) } });
  if (!group) return new NextResponse("Not found", { status: 404 });

  const { emps, planName } = await dashboardData(group);
  const head = [
    "Name", "Email", "Hire date", "Date of birth", "Eligible", "Status", "Plan", "Coverage tier", "Dependents",
    "Monthly premium", "Employer monthly", "Employee monthly", "Per paycheck", "Waive reason", "Tobacco",
    "Signature", "Signed at", "Entered by", "Election version",
  ];
  const rows = emps.map((e) => {
    const l = e.latest;
    const enrolled = l?.status === "ENROLLED";
    const deps = ((l?.dependents as Dependent[]) ?? []).map((d) => `${d.name} (${d.relationship}, ${d.dob})`).join("; ");
    return [
      e.name, e.email, e.hireDate ? isoDate(e.hireDate) : "", e.dob ? isoDate(e.dob) : "", e.eligible ? "yes" : "no",
      l ? (enrolled ? "enrolled" : "waived") : e.eligible ? "pending" : "not eligible",
      enrolled && l.planId ? planName.get(l.planId) ?? "" : "", enrolled ? TIERS[l.tier] : "", enrolled ? deps : "",
      enrolled ? c2(l.premium) : "", enrolled ? c2(l.employerShare) : "", enrolled ? c2(l.employeeShare) : "", enrolled ? c2(l.perPaycheck) : "",
      l?.waiveReason ? WAIVE_REASONS[l.waiveReason] + (l.waiveNote ? `: ${l.waiveNote}` : "") : "",
      l ? (l.tobacco ? "yes" : "no") : "", l?.signatureName ?? "", l?.signedAt.toISOString() ?? "",
      l ? (l.source === "ADMIN" ? "admin" : "employee") : "", l?.version ?? "",
    ];
  });
  await audit({ actor: user, action: "group.export_csv", entity: "EmployerGroup", entityId: group.id, groupId: group.id, after: { rows: rows.length } });
  const file = `${group.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${group.planYear}-elections.csv`;
  return new NextResponse(toCsv([head, ...rows]), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${file}"`,
      "cache-control": "no-store",
    },
  });
}
