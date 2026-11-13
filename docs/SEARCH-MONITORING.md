# Search ownership and monitoring

The production URL-prefix property is `https://web-production-b4c2154d.up.railway.app/`.
Its sitemap is `https://web-production-b4c2154d.up.railway.app/sitemap.xml`.
Use URL-prefix verification: ELN does not control the Railway parent domain's DNS.

The server supports the real Google HTML-tag token through `GOOGLE_SITE_VERIFICATION`
and Bing's `msvalidate.01` token through `BING_SITE_VERIFICATION`. Set the `content`
value only in the existing Railway web service; restart it to load the values.
The public homepage emits the tags inside its HTML head without JavaScript.
Invalid token characters fail startup rather than injecting markup. No token is
invented or treated as successful ownership verification.

In the owner's Google Search Console account, add the URL-prefix property, select
HTML tag, install its token, and select Verify. Submit `sitemap.xml` in Sitemaps.
In Bing Webmaster Tools, add the same site and install its HTML meta token (or
import the verified Search Console property), verify, and submit the sitemap.
Keep installed tokens while the properties remain in use.

After verification, inspect the homepage and one guide; check sitemap processing,
page indexing exclusions, security/manual-action reports and search performance.
Review weekly initially and after material releases. Provider reporting may lag;
verification and sitemap submission do not guarantee indexing or rankings.
The separate `Monitor live site` GitHub workflow runs daily at 07:55 UTC and on
manual dispatch. It checks health, crawler access, sitemap origin/private-route
exclusions, sampled public canonical/indexing metadata and private-owner noindex.
It retains a dated JSON result for 30 days and fails the workflow on a problem.
This checks the live website; Google/Bing's actual indexing and performance remain
visible only in their authenticated property reports.
Private owner, API and planning routes are excluded from the sitemap; owner pages
also carry noindex directives. Do not use private board URLs in inspection requests.

IndexNow support uses the public ownership file `/eln-indexnow.txt`, with its
public identifier retained in `config/search-monitoring.json`. After deploying a
content release, run `node scripts/submit-indexnow.mjs` to preview the live public
URLs, then add `--submit` to notify participating search engines. For later
releases, use `--paths-file` with a JSON array of the added/changed public paths;
do not repeatedly resubmit unchanged URLs. The script verifies the live ownership
file and sitemap before submitting, excludes private routes, and records the
actual HTTP response. HTTP 200 confirms receipt; 202 leaves key validation pending.
Neither confirms indexing. Google does not use this protocol; it does not replace
Google/Bing account-property verification or their search performance reports.

Actual discovery submission: after Railway deployment `ead989f9-8721-4dc0-b4dc-82a329604291` reached SUCCESS, the live ownership file and all 296 sitemap URLs were verified. The initial request returned HTTP 403 shortly after deployment; a later homepage diagnostic returned HTTP 200, and the complete 296-URL submission returned HTTP 200 at `2026-11-13T02:21:02.169Z`. This records receipt only, not indexing. The original failed response and successful receipt are retained in local release artifacts. Do not resubmit the unchanged release merely because reporting has not appeared.

Current account status: technical support implemented; provider-issued tokens and
account verification remain pending. The user asked the agent to perform setup.
The cloud browser fails before opening a tab (`gaas-browser node_repl sandbox
cannot be disabled`), while the app's Desktop viewer does not recognize this
chat's available cloud environment. No connected tool can verify these accounts;
discovered Search Console integrations supply reporting, not ownership creation.
Do not claim successful account verification until access is restored and the
provider reports success.

Official instructions:
- https://support.google.com/webmasters/answer/9008080
- https://www.bing.com/webmasters/help/add-and-verify-site-12184f8b
- https://www.indexnow.org/documentation
