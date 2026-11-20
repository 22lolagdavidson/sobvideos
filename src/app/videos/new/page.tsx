import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { UploadForm } from "./UploadForm";

export const metadata = { title: "New video · Explainer Studio" };

export default async function NewVideoPage() {
  await requireUser();
  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }} className="grid">
      <Link href="/videos" className="small">
        ← All videos
      </Link>
      <div className="card">
        <h1 style={{ marginTop: 0 }}>New explainer video</h1>
        <p className="muted">
          Upload the plan&apos;s Schedule of Benefits or Summary of Benefits and Coverage (SBC). Claude reads it and writes a
          Penny &amp; Patch script using only the numbers in the document. You review every line before anything is rendered.
        </p>
        <UploadForm />
      </div>
      <p className="small muted">
        Only the plan document is sent to Claude. Don&apos;t upload anything with employee or member information on it.
      </p>
    </div>
  );
}
