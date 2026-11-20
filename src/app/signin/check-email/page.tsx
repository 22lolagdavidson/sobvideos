export const metadata = { title: "Check your email · Open Enrollment Studio" };

export default function CheckEmail() {
  return (
    <div style={{ maxWidth: 460, margin: "40px auto" }}>
      <div className="card">
        <h1>Check your email</h1>
        <p>
          If that address is on file, a sign-in link is on its way. It works once and expires in 15 minutes.
        </p>
        <p className="muted small">
          Don&apos;t see it? Check your spam folder, or ask your HR contact which email they have for you.
        </p>
        {process.env.NODE_ENV !== "production" && !process.env.EMAIL_SERVER && (
          <p className="small">
            Dev mode: <a href="/dev/outbox">open the dev outbox</a>.
          </p>
        )}
        <p>
          <a href="/signin">Back to sign in</a>
        </p>
      </div>
    </div>
  );
}
