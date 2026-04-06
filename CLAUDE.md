# Claude Code Instructions
- Always work on the staging branch
- After changes: git add . && git commit -m 'description' && git push origin staging
- Staging auto-deploys to Railway
- Never push directly to master (production)
- Backend code is in /backend
- Storefront code is in /storefront
- Never hallucinate API model IDs, package versions, or external identifiers. Always verify from documentation, system prompt, or by searching the web. If unsure, look it up first.
