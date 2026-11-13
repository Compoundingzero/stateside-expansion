# Owner access and backup verification

The operations release is live at https://web-production-b4c2154d.up.railway.app/.
Source commit: `5b0a646252d022821207bf9741a2820e2046f3cc`.
Railway deployment: `a58feb6f-4883-40b7-8b18-d55715ac7eb3`, verified SUCCESS.
The existing database survived deployment and runtime remained UID1000 with the
actual `/data` volume mounted. No fictional production leads were submitted.

GitHub CI [43337197595](https://github.com/Compoundingzero/stateside-expansion/actions/runs/43337197595)
passed 43 Node tests, 23 browser tests, the production dependency audit and build.
The live monitor [43338187768](https://github.com/Compoundingzero/stateside-expansion/actions/runs/43338187768)
also passed all nine HTTP/search-readiness requests against 193 sitemap URLs.

The actual owner was activated on 12 November 2026 at approximately 4:30pm Pacific
(audit timestamp `2026-11-13T00:30:23.608Z`). A newly generated strong password and
eight single-use recovery codes were saved only to private files outside Git.
A fresh sign-in succeeded, temporary agent sessions were signed out, and the
bootstrap environment variable was removed. Existing owner state prevents setup
reuse. No password, code, session cookie or encryption key is recorded here.

A post-activation backup completed at `2026-11-13T00:30:22.237Z`. The runtime
uploaded encrypted bytes to the separate private bucket, downloaded the object,
verified its ciphertext digest, decrypted it in isolated temporary storage, and
passed full SQLite integrity and foreign-key checks. Retention cleanup reported
`ok` under the six-day target. No production database was copied to the authoring
workspace or restored over the live volume. The application now schedules daily
backups and offers a reauthenticated immediate backup in Security settings.

Owner sign-in: `/owner/`. Recovery: `/owner/recover/`. Security: `/owner/security/`.
These routes remain noindex and outside the public sitemap. Password changes and
recovery sign out every session; unused recovery codes persist until consumed or
replaced. See `BACKUPS.md` for outage, retention and disaster-recovery limits.

Google/Bing account verification is a separate unresolved access dependency,
documented in `SEARCH-MONITORING.md`; the live HTTP monitor does not assert those
accounts are verified or that any page has been indexed.
