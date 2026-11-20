import { requireOwnEmployee } from "@/lib/authz";

export default async function PlansPage() {
  const { employee } = await requireOwnEmployee();
  return (
    <div className="card">
      <h1>{employee.group.name} plans</h1>
      <p className="muted">Plan cards and explainer videos arrive in step 6.</p>
    </div>
  );
}
