import {published,tools} from '../../lib/content';
import {learningKey} from '../../lib/learning';

export const prerender=true;
export function GET(){
 const items=[...published.map(guide=>learningKey('guide',guide.id)),...tools.map(tool=>learningKey('tool',tool.mode))].sort();
 return new Response(JSON.stringify({version:1,items}),{headers:{'Content-Type':'application/json; charset=utf-8','X-Robots-Tag':'noindex'}});
}
