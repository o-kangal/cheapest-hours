# Security Policy

## Reporting a vulnerability

Please report vulnerabilities **privately**, through GitHub: on the repository's **Security** tab, choose **Report a vulnerability** ([private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)). Do not open a public issue or pull request for a vulnerability before it is fixed.

Include what you found, how to reproduce it, the version or commit, and the impact you see. You will get an acknowledgement within 7 days and a first assessment within 14 days. Once a fix is released, the advisory is published with credit to you, unless you prefer otherwise.

## Scope

Cheapest Hours stores no personal data and sets no cookies. It promises two boundaries, and reports that break them count:

- **The `/api/prices` proxy is closed.** It accepts only a `date` parameter, always queries the `DE-LU` bidding zone of `api.energy-charts.info`, and cannot be made to request any other URL or forward other input (no open proxy, no SSRF).
- **Data from the upstream API is never executed.** It is validated and rendered as text only, so a malicious or broken upstream response cannot inject script into the page (no XSS).

Out of scope: issues in dependencies without an effect on Cheapest Hours (report those upstream), and missing hardening without a concrete attack.

## Supported versions

Only the latest release (and `main`) receives security fixes.

## For maintainers

Checks that run on every change: gitleaks (`gitleaks git --config .gitleaks.toml`), CodeQL, `pnpm audit`.
