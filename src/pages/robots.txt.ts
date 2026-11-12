export const GET=({site}:{site:URL})=>new Response(`User-agent: *\nAllow: /\nDisallow: /plan/\n\nSitemap: ${new URL('/sitemap.xml',site)}\n`,{headers:{'Content-Type':'text/plain'}});
