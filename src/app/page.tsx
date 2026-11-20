import { redirect } from "next/navigation";
import { auth } from "@/auth";

/** Send each role to its home screen. */
export default async function Home() {
  const s = await auth();
  const u = s?.user;
  if (!u) redirect("/signin");
  if (u.role === "BROKER_ADMIN") redirect("/broker");
  if (u.role === "EMPLOYER_ADMIN" && u.groupId) redirect(`/groups/${u.groupId}`);
  if (u.role === "EMPLOYEE") redirect("/enroll");
  return (
    <div className="card">
      <h2>No access yet</h2>
      <p className="muted">Your account isn&apos;t linked to an agency or employer group. Contact your broker.</p>
    </div>
  );
}
