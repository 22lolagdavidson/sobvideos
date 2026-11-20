import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { auth, signIn } from "@/auth";

export const metadata = { title: "Sign in · Explainer Studio" };

const ERRORS: Record<string, string> = {
  Verification: "That sign-in link has expired or was already used. Ask for a new one below.",
  Configuration: "Sign-in isn't configured correctly. Please contact your broker.",
  Default: "Something went wrong signing you in. Please try again.",
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if ((await auth())?.user) redirect("/");
  const { error } = await searchParams;
  // Unknown emails get the same "check your email" screen, so the form can't be used to
  // discover who is on a roster.
  if (error === "AccessDenied") redirect("/signin/check-email");
  const msg = error ? (ERRORS[error] ?? ERRORS.Default) : null;

  async function sendLink(formData: FormData) {
    "use server";
    const email = String(formData.get("email") || "").trim();
    if (!email) return;
    let error: string | null = null;
    try {
      // redirect: false so we control the next page (Auth.js would send the browser
      // through an API route, which client navigation from a server action doesn't follow).
      await signIn("nodemailer", { email, redirectTo: "/", redirect: false });
    } catch (e) {
      if (!(e instanceof AuthError)) throw e;
      error = e.type === "AccessDenied" ? "AccessDenied" : "Default";
    }
    redirect(error && error !== "AccessDenied" ? `/signin?error=${error}` : "/signin/check-email");
  }

  return (
    <div style={{ maxWidth: 460, margin: "40px auto" }}>
      <div className="card">
        <h1>Sign in</h1>
        <p className="muted">
          Enter your work email. We&apos;ll email you a secure sign-in link. No password
          needed.
        </p>
        {msg && (
          <div className="notice err" role="alert" style={{ marginBottom: 14 }}>
            {msg}
          </div>
        )}
        <form action={sendLink}>
          <label className="f">
            Work email
            <input type="email" name="email" required autoComplete="email" autoFocus />
          </label>
          <button className="btn primary" type="submit">
            Email me a sign-in link
          </button>
        </form>
        {process.env.NODE_ENV !== "production" && !process.env.EMAIL_SERVER && (
          <p className="small muted" style={{ marginTop: 16 }}>
            Dev mode: emails aren&apos;t sent. Open the <a href="/dev/outbox">dev outbox</a> to click your link. Demo
            account: broker@example.com.
          </p>
        )}
      </div>
    </div>
  );
}
