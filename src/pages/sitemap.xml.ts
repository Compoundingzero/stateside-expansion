import {published,tools} from '../lib/content';
import {publicSitemapEntries} from '../lib/article-presentation';
const xmlEscape=(value:string)=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
export const GET=({site}:{site:URL})=>{
  const urls=publicSitemapEntries(published,tools).map(entry=>'<url><loc>'+xmlEscape(new URL(entry.path,site).href)+'</loc>'+(entry.lastmod?'<lastmod>'+xmlEscape(entry.lastmod)+'</lastmod>':'')+'</url>').join('');
  return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls+'</urlset>',{headers:{'Content-Type':'application/xml'}});
};
