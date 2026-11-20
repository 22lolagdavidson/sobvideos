import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/authz";
import { AgencyForm } from "./AgencyForm";

export const metadata = { title: "Settings · Explainer Studio" };

export default async function SettingsPage() {
  const user = await requireUser();
  const agency = await prisma.agency.findUniqueOrThrow({ where: { id: user.agencyId } });
  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }} className="card">
      <h1 style={{ marginTop: 0 }}>Agency settings</h1>
      <p className="muted">Your agency name and logo appear on the last 3 seconds of every video.</p>
      <AgencyForm
        name={agency.name}
        contactEmail={agency.contactEmail ?? ""}
        brandPrimary={agency.brandPrimary}
        logoUrl={agency.logoKey ? `/api/files/logo?v=${agency.updatedAt.getTime()}` : null}
      />
    </div>
  );
}
