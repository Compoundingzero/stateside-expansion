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

Current status: technical support implemented; provider-issued tokens and account
verification are pending. The cloud browser connection is unavailable, and no
connected tool provides ownership verification for these accounts.

Official instructions:
- https://support.google.com/webmasters/answer/9008080
- https://www.bing.com/webmasters/help/add-and-verify-site-12184f8b
