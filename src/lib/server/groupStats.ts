import "server-only";
import type { Election, Employee, EmployerGroup, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { participation, type Participation } from "@/lib/domain/participation";
import { windowState, type WindowState } from "@/lib/domain/window";

export type EmployeeWithLatest = Employee & { latest: Election | null };

export type GroupSummary = {
  group: EmployerGroup;
  window: WindowState;
  participation: Participation;
  eligible: number;
  enrolled: number;
  waived: number;
  pending: number;
};

/** Employees of a group with only their latest election (highest version). */
export async function employeesWithLatest(groupId: string): Promise<EmployeeWithLatest[]> {
  const rows = await prisma.employee.findMany({
    where: { groupId },
    orderBy: { name: "asc" },
    include: { elections: { orderBy: { version: "desc" }, take: 1 } },
  });
  return rows.map(({ elections, ...e }) => ({ ...e, latest: elections[0] ?? null }));
}

export function summarize(group: EmployerGroup, emps: EmployeeWithLatest[]): GroupSummary {
  const eligibleEmps = emps.filter((e) => e.eligible);
  const enrolled = eligibleEmps.filter((e) => e.latest?.status === "ENROLLED").length;
  const waivers = eligibleEmps.filter((e) => e.latest?.status === "WAIVED").map((e) => e.latest!.waiveReason);
  return {
    group,
    window: windowState(group),
    participation: participation({ eligible: eligibleEmps.length, enrolled, waivers }),
    eligible: eligibleEmps.length,
    enrolled,
    waived: waivers.length,
    pending: eligibleEmps.length - enrolled - waivers.length,
  };
}

/** Summaries for every group matching `where` (already permission-scoped by the caller). */
export async function groupSummaries(where: Prisma.EmployerGroupWhereInput): Promise<GroupSummary[]> {
  const groups = await prisma.employerGroup.findMany({ where, orderBy: [{ windowEnd: "asc" }, { name: "asc" }] });
  return Promise.all(groups.map(async (g) => summarize(g, await employeesWithLatest(g.id))));
}
