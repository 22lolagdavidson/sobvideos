# Build: Open Enrollment Studio (small-group health insurance + SBC explainer videos)

Paste everything below into Claude Code, from an empty project folder. If you also have `index.html` (the working prototype), put it in the folder as `prototype/index.html` first. Claude Code should treat it as the reference for UX, copy, the cartoon characters and the scene types.

---

You are building a production web app for **Davidson Solutions**, a health insurance brokerage serving small businesses (2–50 employees). It runs open enrollment for each employer group. Its standout feature: the broker uploads a plan's **Summary of Benefits and Coverage (SBC) PDF**, and the app turns it into a short animated cartoon explainer video, like a kids' educational cartoon. Employees watch it while choosing a plan.

If `prototype/index.html` exists, read it first. It is a working single-file prototype. Match its flows, wording, cost math, scene types, and the two original characters (Penny, a piggy bank, and Patch, a bandage). Don't copy its claude.ai-specific APIs (`claude.use(...)`). Replace them with the stack below.

## Stack
- **Next.js 15 (App Router) + TypeScript + Tailwind**
- **PostgreSQL + Prisma** (SQLite is fine for local dev)
- **Auth.js (NextAuth)** with email magic links. Roles: `BROKER_ADMIN`, `EMPLOYER_ADMIN`, `EMPLOYEE`
- **Anthropic API** (`@anthropic-ai/sdk`, model `claude-sonnet-5-5`) reads the SBC and writes the video script
- **pdf-parse** (server side) pulls the SBC text. If a page has no text layer, send the page images to Claude instead (vision fallback for scanned SBCs)
- **Remotion** (`@remotion/renderer`) renders real MP4 videos. Use the same scenes as an in-browser `<Player>` preview
- **Text-to-speech:** one `TtsProvider` interface with an OpenAI TTS implementation (`gpt-4o-mini-tts`) and an ElevenLabs implementation, chosen by an env var. Penny and Patch each get their own voice
- **File storage:** S3-compatible (local disk in dev) for SBC PDFs, audio and rendered MP4s
- **Job queue:** BullMQ + Redis, or a simple DB-polled worker, for SBC parsing, TTS and rendering
- `.env.example` with every key: `DATABASE_URL`, `ANTHROPIC_API_KEY`, `TTS_PROVIDER`, `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`, `S3_*`, `NEXTAUTH_*`, `EMAIL_SERVER`

## Data model (Prisma)
- `Agency` (name, contact, logo, brand colors)
- `EmployerGroup` (agencyId, name, planYear, effectiveDate, windowStart, windowEnd, payPeriods [52|26|24|12], eePct, depPct, participationTarget)
- `Plan` (groupId, name, carrier, type [PPO|HMO|EPO|POS|HDHP/HSA|Other], deductible, deductibleFam, oop, oopFam, coinsurance, pcp, specialist, urgent, er, rx, rates {ee, es, ec, fam} in monthly dollars)
- `SbcDocument` (planId, fileKey, extractedText, status, error)
- `Explainer` (planId, script JSON, status [DRAFT|APPROVED|RENDERING|READY|FAILED], audio keys, mp4Key, durationSec, createdBy, approvedBy, approvedAt)
- `Employee` (groupId, name, email, hireDate, eligible bool, userId?)
- `Election` (employeeId, planId?, status [ENROLLED|WAIVED], tier [ee|es|ec|fam], dependents JSON [{name, relationship, dob}], tobacco, waiveReason, premium, employerShare, employeeShare, perPaycheck, signatureName, signedAt, ip, userAgent). Keep **all versions**: a change makes a new row, and the latest one counts
- `AuditLog` (actor, action, entity, before/after, timestamp)

## Business rules (copy these exactly)
- **Coverage tier from dependents:** spouse or domestic partner plus at least one child = `fam`; spouse/partner only = `es`; children only = `ec`; nobody = `ee`. Allow at most one spouse or partner.
- **Cost math:** `P` = the plan's rate for the tier, `E` = the plan's `ee` rate.
  `employer = min(P, E × eePct/100 + max(0, P − E) × depPct/100)`
  `employee = P − employer`; `perPaycheck = employee × 12 / payPeriods`.
  Round to cents only when displaying.
- **Participation** = enrolled ÷ (eligible − waivers with other coverage). Waiver reasons that count as "other coverage": spouse/partner employer plan, another employer plan, Medicare, Medicaid/CHIP, TRICARE/VA. Marketplace and Other do not count. Show this against the group's target, and say in the UI that rules vary by carrier.
- **Window:** employees can submit or change an election only between windowStart and windowEnd. Admins can enter or edit elections at any time, and every admin change is audit-logged.
- **E-signature:** a checkbox attestation plus the typed full name, which must match the employee's name. Waivers get extra wording about waiting until the next open enrollment unless a qualifying life event happens.

## Screens
1. **Broker dashboard:** list of groups with window status, participation % and pending count
2. **Group setup:** group details, contribution settings, roster import (paste or CSV upload: name, email, hire date), and plans with rates
3. **Plan → SBC → Explainer:** upload the SBC → extract text → generate a script → **review screen** where the broker edits each scene's lines, numbers and the quiz, previews it in the Remotion Player, and **approves it** → render the MP4. Employees never see an explainer until it is approved.
4. **Employee enrollment wizard:** Welcome → About you → Family → Choose a plan (cards show per-paycheck cost for their tier, key benefits and a "Watch the explainer" button) → Review & sign → Confirmation, plus a confirmation email
5. **Group dashboard:** eligible / enrolled / waived / pending counts, participation bar, monthly totals (premium, employer, employee), counts by plan, roster table, **CSV export**, and a reminder email to everyone pending
6. **Public plan page** for each group (signed-in employees only): plan cards with the videos

## SBC → script (the core feature)
Server action `generateExplainer(planId)`:
1. Get the SBC text. If it's under 300 characters, use the vision fallback on page images.
2. Call Claude with **tool use / structured output** so the response must match a Zod schema. The schema has `plan` (the plan fields above, as short strings) and `scenes[]`. Each scene has `visual` (a discriminated union on `kind`) and `lines[]` (`{who: "penny"|"patch", text}`, 1–3 lines per scene, under 200 characters each).
3. Scene kinds, in this order, skipping any the SBC can't support: `title`, `meter` (deductible jar), `prices` (copays, up to 5 tags), `split` (coinsurance you/plan bar), `shield` (out-of-pocket max), `story` (one of the SBC's own coverage examples, such as "Peg is Having a Baby", as a receipt with rows and a total), `list` tone good (covered or free preventive care), `list` tone bad (excluded services), `list` recap (3–5 key numbers), `quiz` (question, 3 options, answer index).
4. System prompt rules: use ONLY numbers stated in the SBC; never invent, round or estimate; use in-network amounts; never recommend a plan; don't mention premiums; write at a 6th-grade reading level with light humor; define each insurance term the first time it's used; Penny asks and Patch explains; Patch closes by saying the SBC and plan documents are the official word.
5. **Number check:** after generating, pull every dollar amount and percentage from the script and confirm each appears in the SBC text. Flag any that don't on the review screen, and block approval until the broker fixes or confirms them.
6. Fill in the plan's benefit fields from `plan`. Never touch rates.

## Video rendering
- Build a Remotion composition, 1920×1080 at 30 fps, matching the prototype: sky gradient, rolling hills, a center white card holding the scene visual, Penny bottom-left, Patch bottom-right. The character who is speaking bobs and moves its mouth; both blink. Entrance animations: pop, slide-up, jar fill, bar grow, receipt rows appearing.
- Pipeline: render TTS audio for each line (Penny and Patch in their own voices) → measure each clip's length → build a timeline where each scene lasts as long as its lines plus 0.6 s of padding → render the MP4 with **burned-in captions**, plus a separate WebVTT caption file for accessibility.
- Add a 3-second end card: "This video is a plain-language summary. Your SBC and plan documents are the official description of coverage." Include the agency name and logo.
- Store the MP4 and serve it with an HTML5 player that supports captions. Add a "Download MP4" button for brokers, so they can use the video in their own presentations.

## Security and compliance (this app handles PII and benefits data)
- Every query is scoped by agency and group, with server-side permission checks. Employees can only ever read or write their own election.
- Encryption in transit and at rest. **Don't collect SSNs in v1.** Add a TODO for an encrypted field if carriers require them later.
- Audit-log every election change and every admin action.
- Rate-limit the AI and TTS endpoints. Validate file uploads (PDF only, 10 MB max).
- Never send employee data to Claude or the TTS service. Only the SBC goes out.

## Quality bar
- Seed script: one demo agency ("Davidson Solutions"), one demo group, 2 sample plans, 5 employees, 2 elections, and one approved explainer script so the video can be previewed without an API key.
- Unit tests (Vitest) for the tier logic, cost math, participation and the number check. One Playwright test for the employee wizard from start to finish.
- README covering setup, env vars, running the worker and deploying (Vercel for the web app, plus a separate Node worker on Railway or Render for rendering).
- Accessible: keyboard navigation, focus states, captions, 4.5:1 contrast.

## Work in this order and check in with me after each step
1. Scaffold, schema, auth, seed data
2. Group setup + roster + plans
3. Employee wizard + elections + dashboard + CSV export
4. SBC upload → script generation → review/approve screen with the Remotion Player preview
5. TTS + MP4 rendering worker
6. Emails, audit log, tests, README
