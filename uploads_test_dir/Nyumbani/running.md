Happy to lay out the exact contributor flow. Since I'm in plan mode, here's the researched answer — say the word and I'll write it into the repo as a CONTRIBUTING.md (or expand the README's Local development section).
Contributor setup guide
Prerequisites (one-time):
Requirement	Notes
Node.js ≥ 22	matches Dockerfile; check node -v
pnpm 11	corepack enable is enough — the repo pins the version via packageManager
PostgreSQL 16+	via Docker (easiest) or any local install
Git + repo access	clone after being added as collaborator
Steps:
git clone https://github.com/<you>/nyumbani.git && cd nyumbani
corepack enable                # provides pnpm at the pinned version
pnpm install                   # installs api + web workspaces

cp .env.example .env           # REQUIRED — .env is gitignored, never shared
Edit .env: only two values really matter out of the box —
DATABASE_URL=postgresql://nyumbani:nyumbani@localhost:5433/nyumbani   # default already matches docker-compose
JWT_SECRET=<any random 32+ chars>                                     # change from the example value
BUSINESS_NAME / BUSINESS_TAGLINE / OWNER_PHONE                        # optional branding
# Start Postgres — option A: Docker (recommended)
docker compose up -d db        # postgres:16 on host port 5433

# …or option B: existing local postgres → point DATABASE_URL at it instead

pnpm db:migrate:dev            # applies both committed migrations (+ prisma generate)
pnpm db:seed                   # 6 demo furniture products

pnpm dev                       # parallel: API :3000 + web :5173 (Vite proxies /api)
Then open http://localhost:5173 — storefront. Dashboard at /dashboard/login.
Why no other credentials are needed
The whole point of the design: with empty AT_API_KEY, GEMINI_API_KEY, and Daraja keys, everything runs simulated — SMS is logged, M-Pesa returns deterministic SIM-… refs, Gemini report narration falls back to templates. And in dev, the login OTP is returned in the API response (devCode), so a contributor needs zero phone numbers, keys, or AT/Daraja accounts to exercise every feature offline. ngrok + real sandbox keys are only needed later if they want to test actual USSD dialing (*384*38239#) or real STK pushes against AT's sandbox.
Gotchas contributors hit
1. Forgetting cp .env.example .env → zod fails fast at boot with a clear message.
2. Port clash on 5433 (they already run Postgres there) → either stop theirs or edit docker-compose.yml/DATABASE_URL.
3. Using pnpm db:migrate (deploy-only) in dev when schema drifts → tell them db:migrate:dev is the right one while iterating.
4. Node <22 LTS may work but isn't what the image/tests assume.