# Contributing to MoodFlix

Thanks for taking the time to improve MoodFlix. This guide covers the local workflow, conventions, and checks expected before a pull request.

## Code of Conduct

By participating, you agree to follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Report unacceptable behavior to ishan.vaidya01@gmail.com.

## Local Setup

MoodFlix has two applications: an Express API at the repository root and a React client in `client/`.

```bash
# 1. Fork and clone your fork
git clone https://github.com/<your-user>/MoodFlix.git
cd MoodFlix

# 2. Install and configure the API
npm install
cp .env.example .env          # Windows: Copy-Item .env.example .env
# Set TMDB_KEY in .env to your own TMDB API key

# 3. Start the API
node server.js

# 4. In a second terminal, install and start the client
cd client
npm install
npm start
```

The client's `BACKEND` constant in `client/src/App.js` points at a deployed API by default. For local UI work, point it at `http://localhost:5000`. Do not commit a personal deployment URL unless the change is intentional.

You need Node.js 18 or newer and a [TMDB API key](https://www.themoviedb.org/settings/api). Never commit `.env`, API keys, `movies.db`, or `favorites.db`.

## Branch Naming

Create a branch from `main`:

- `feature/<short-description>` — new behavior or UI
- `fix/<short-description>` — bug fixes
- `docs/<short-description>` — documentation only

Examples: `feature/mood-autocomplete`, `fix/trailer-fallback`, `docs/local-setup`.

Do not push directly to `main`; open a pull request.

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>(<optional scope>): <imperative description>
```

Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`.

Examples:

```text
feat(search): add mood aliases for anxious
fix(movie): handle missing trailer results
docs(readme): clarify local client setup
```

Keep each commit focused. Explain the reason for a change in the body when it is not obvious.

## Pull Request Checklist

- [ ] The change is scoped to one problem and based on the latest `main`.
- [ ] The API starts with `node server.js` and the client starts with `npm start`.
- [ ] The affected flow was tested manually (search, rails, detail modal, or trailer/providers as relevant).
- [ ] `cd client && npm test` passes if client code changed.
- [ ] No `.env`, API keys, credentials, SQLite files, `node_modules`, or build output are included.
- [ ] New behavior and any configuration changes are documented in `README.md`.
- [ ] UI changes include a screenshot or a clear description of the before/after behavior.
- [ ] The PR description explains the motivation, the approach, and how to verify the change.

## Testing and Linting

There is no backend test suite, linter, or formatter configured at the repository root. The root `npm test` command is a placeholder and exits with an error. If you add tooling, keep it reproducible and update this guide and the README.

Client tests use Create React App's Jest setup:

```bash
cd client
npm test
```

For a production sanity check:

```bash
cd client
npm run build
```

## Coding Guidelines

- Keep server changes in `server.js` small and readable; the service is intentionally a single-file Express app.
- Treat TMDB responses as untrusted: check for missing arrays, posters, trailers, and provider fields.
- Avoid adding dependencies unless they remove meaningful complexity.
- Preserve the existing cache behavior or document any change to its lifetime and keying.
- Do not expose `TMDB_KEY` to the client or log secrets.
- Match the existing JavaScript style: double quotes, semicolons, two-space indentation.
- Update the README's API and environment-variable sections when behavior changes.

## Reporting Issues

Open an issue with steps to reproduce, expected behavior, actual behavior, and relevant logs with secrets removed. For security vulnerabilities, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
