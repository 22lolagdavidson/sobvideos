import Link from "next/link";

export function Logo({ agencyName }: { agencyName?: string | null }) {
  return (
    <Link href="/" className="logo">
      <span className="logo-mark" aria-hidden="true">
        <svg width="24" height="24" viewBox="0 0 24 24">
          <rect x="9" y="3" width="6" height="18" rx="2" fill="#ff8a3d" />
          <rect x="3" y="9" width="18" height="6" rx="2" fill="#2b59c3" />
        </svg>
      </span>
      <span>
        <b>Open Enrollment Studio</b>
        <small>{agencyName || "Davidson Solutions"}</small>
      </span>
    </Link>
  );
}
