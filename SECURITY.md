# Security Policy

## Supported Versions

MoodFlix is an actively maintained personal project. Security fixes are applied to the latest code on `main`; older snapshots are not supported.

| Version | Supported |
| :--- | :---: |
| Latest `main` | Yes |
| Older commits / forks | No |

## Reporting a Vulnerability

Please do **not** open a public issue for a security problem.

Report privately using either channel:

- **Email:** [ishan.vaidya01@gmail.com](mailto:ishan.vaidya01@gmail.com)
- **GitHub Security Advisories:** use the **Security → Report a vulnerability** flow on the repository, if enabled.

Include, where possible:

- a description of the issue and its impact;
- affected endpoint, file, or dependency;
- reproduction steps or a minimal proof of concept;
- the commit or version you tested;
- any suggested remediation.

Never include real API keys, tokens, or personal data in a report.

## Response Expectations

This is a best-effort, single-maintainer project. You can expect an acknowledgement within about 3 business days and a status update within 7 business days. Timelines for a fix depend on severity and maintainer availability. Please allow reasonable time for remediation before public disclosure.

## Scope

In scope:

- the Express API in `server.js` and its two endpoints;
- the React client in `client/`;
- handling of the TMDB API key and other environment variables;
- dependency vulnerabilities that affect this application;
- cross-origin, injection, and denial-of-service issues introduced by this code.

Out of scope:

- vulnerabilities in TMDB, GitHub Pages, Render, or other third-party services;
- issues that require a compromised local machine, browser extension, or account;
- missing security headers or unrestricted CORS when the app is run only as a local demo — these are known limitations documented in the README, though reports with a concrete production impact are still welcome;
- social engineering and physical attacks.

## Known Security Considerations

- The server has no authentication, authorization, rate limiting, or persistence. Do not treat it as a multi-user production service without adding those controls.
- CORS currently allows all origins.
- `TMDB_KEY` is server-side only. If a key is ever exposed in a commit, log, screenshot, or client bundle, revoke it in the TMDB dashboard and issue a new one.
- `.env`, SQLite files, and build output are gitignored and must never be committed.

## Safe Harbor

Good-faith security research that respects privacy, avoids destructive testing, and follows this policy will not be pursued or reported. Do not access, modify, or exfiltrate data that is not yours.
