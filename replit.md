# MathBridge AI

## Run on Replit
- Requires Node.js 20 or newer. There are no external packages to install.
- Use the **Start application** workflow (or Run) to execute `npm start`.
- The server listens on `0.0.0.0:5000` by default; `PORT` can override it.
- Open Preview to use the app. No build step or database is needed.

## Checks
- Run `npm test` for the equation engine, question bank, and AI output-filter tests.
- `GET /healthz` returns `{"ok":true}`.
- `GET /api/config` reports whether AI hints are enabled.

## Optional AI hints
- Keep AI hints off for the default setup. Rule-based hints work without credentials.
- Before enabling Gemini for students, review the age-related terms concern in README.md.
- Enabling AI requires an explicit `AI_HINTS=on` setting and a Gemini API key in Secrets; neither is needed to run the app.

## Project constraints
- Preserve the existing dependency-free Node.js server and plain JavaScript frontend.
- Student progress stays in browser memory; do not add persistence or analytics without asking.
