# Contributing to ClickME

## Branch Strategy

| Branch           | Purpose                              |
| ---------------- | ------------------------------------ |
| `main`           | Production — deploys via CI          |
| `develop`        | Integration — PR target for features |
| `feature/<name>` | One feature or fix                   |
| `hotfix/<name>`  | Critical production fixes            |

## Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body]
```

**Types:** `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`, `ci`, `style`

**Scopes:** `backend`, `frontend`, `docker`, `scripts`, `deps`

Examples:

```
feat(backend): add rate limiter middleware
fix(frontend): token refresh re-reads consumed Response
perf(backend): batch N+1 Like.exists into bulk query
refactor(backend): extract enrichment service
test(backend): add security smoke tests
docs: add CONTRIBUTING.md
```

## Code Style

- **Backend:** ESLint flat config (`backend/eslint.config.js`) + Prettier (`.prettierrc`)
- **Frontend:** Next.js built-in ESLint + Prettier
- Run `npm run lint` in `backend/` before committing.

## Testing

```bash
# Backend unit/smoke tests
cd backend && npm test

# Watch mode during development
cd backend && npm run test:watch
```

All PRs must pass the existing test suite. Add tests for new utilities and bug fixes.

## PR Checklist

- [ ] Tests pass (`npm test`)
- [ ] Lint clean (`npm run lint`)
- [ ] No `console.log` — use `logger` from `src/utils/logger.js`
- [ ] No hardcoded secrets — use env vars
- [ ] No `new RegExp(userInput)` — use `buildSafeRegex()`
- [ ] Batch DB queries — no `Promise.all(items.map(async => db.query))`
- [ ] Atomic counters — use `$inc` instead of read-modify-write
