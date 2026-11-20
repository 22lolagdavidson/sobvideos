# Explainer Studio

Turns a health plan's **Schedule of Benefits or SBC** into a short cartoon explainer video, built for
**Davidson Solutions**. Penny (a piggy bank) asks the questions, Patch (a bandage) explains.

1. **Upload** the plan's Schedule of Benefits or SBC PDF (10 MB max). Text PDFs are read directly; scanned PDFs are sent to Claude as page images.
2. **Generate**: Claude writes the Penny & Patch script using only numbers in the document (in-network, never rounded, no premiums, no plan recommendations, 6th-grade reading level).
3. **Review**: edit every line, number and quiz answer, and preview the video in the browser. A **number check** flags any dollar amount or percentage that isn't in the document; approval is blocked until each one is fixed or confirmed.
4. **Approve & render**: the worker records the voices, renders a 1920×1080 MP4 with burned-in captions and a 3-second end card with your agency name and logo, and writes a WebVTT captions file.
5. **Share**: watch it in the app, then download the MP4 (and .vtt).

Editing an approved script makes a new draft, so the existing video stays available until the new one is rendered.

- Original build spec: [`docs/SPEC.md`](docs/SPEC.md) · UX/character reference: [`prototype/index.html`](prototype/index.html)

## Quick start (local)

```bash
cp .env.example .env              # set AUTH_SECRET (npx auth secret) and ANTHROPIC_API_KEY
docker compose up -d              # PostgreSQL on localhost:5432
npm install
npm run db:migrate
npm run db:seed                   # demo agency + a Gold PPO plan with an approved script, queued to render
npm run dev                       # http://localhost:3000
npm run worker                    # in a second terminal: renders queued videos
```

Sign in as **`broker@example.com`**. With `EMAIL_SERVER` empty, sign-in links are written to
`storage/dev-outbox/` and listed at <http://localhost:3000/dev/outbox>. Sign-in is invite-only: only
existing users can sign in (add brokers with `npx prisma studio`, User table, with your agency's id).

To try rendering without voice keys, set `TTS_PROVIDER="silent"`: the video renders with no voices, timed to the text.

## Configuration

| Variable | What it's for |
| --- | --- |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Script writing (default model `claude-sonnet-5-5`) |
| `TTS_PROVIDER` | `openai`, `elevenlabs` or `silent` |
| `OPENAI_API_KEY`, `OPENAI_TTS_MODEL`, `OPENAI_VOICE_PENNY/PATCH` | OpenAI voices (default `gpt-4o-mini-tts`, `coral` / `echo`) |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_PENNY/PATCH`, `ELEVENLABS_MODEL` | ElevenLabs voices (voice IDs) |
| `S3_DRIVER` + `S3_*` | `local` (./storage/files) or `s3` for any S3-compatible bucket (server-side encrypted) |
| `REMOTION_BROWSER_EXECUTABLE` | Chrome/Chromium for rendering; blank lets Remotion download its own |
| `RENDER_CONCURRENCY` | Frames rendered in parallel |
| `RATE_LIMIT_AI_PER_HOUR`, `RATE_LIMIT_TTS_PER_HOUR` | Per-user limits on script generation and renders |
| `EMAIL_SERVER`, `EMAIL_FROM` | SMTP for sign-in links |

## Privacy and safety

- Only the plan document goes to Claude, and only script dialogue goes to the voice service.
- Uploads must be real PDFs (checked by file signature), 10 MB max; logos PNG/JPG, 1 MB max.
- Every page, file and action is scoped to the signed-in user's agency. Files are served through the app with a permission check, never by public URL.
- Admin actions (upload, generate, edit, confirm a number, approve, delete, settings) are audit-logged.
- Use HTTPS in production and an encrypted database and bucket.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js app |
| `npm run worker` | Render worker (polls the Job table; run several safely). `--once` drains the queue and exits |
| `npm test` | Unit tests (number check, script normalizing, timeline, WAV timing) |
| `npm run typecheck`, `npm run lint` | Checks |
| `npm run db:migrate` / `db:seed` / `db:reset` | Database |

## Layout

- `src/app/videos`: list, upload, review page and server actions. `src/app/settings`: agency name, logo, brand color.
- `src/app/api/files`: permission-checked downloads (PDF, MP4 with Range support, VTT, logo).
- `src/lib/explainer`: prompt, generation, normalizing, number check, PDF extraction, timeline + WebVTT.
- `src/remotion`: the video composition (shared by the in-browser preview and the MP4 render). Fonts are self-hosted in `public/fonts`.
- `worker/`: job loop, TTS providers, render pipeline.

## Deploying

Run the Next.js app and at least one worker against the same database and bucket. The worker needs
Chromium and enough CPU (a 2-minute video takes about 3 minutes on 4 cores). `npm run db:deploy` applies migrations.
