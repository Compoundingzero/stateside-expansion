/** Plain-text search over public content only. No inferred legal categories or private inputs. */
function normalize(value:string):string {
 return value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase()
  .replace(/\bu\.\s*s\b\.?/gu,'us')
  .replace(/\blicen[cs](?:e[ds]?|ing)\b/g,'licens')
  .replace(/(\p{L})(\p{N})/gu,'$1 $2').replace(/(\p{N})(\p{L})/gu,'$1 $2')
  .replace(/[^\p{L}\p{N}]+/gu,' ').trim();
}
export function matchesContentQuery(text:string,query:string):boolean {
 if(!query.trim())return true;
 const normalized=normalize(text),terms=normalize(query).split(' ').filter(Boolean);
 if(!terms.length)return false;
 const words=new Set(normalized.split(' '));
 return terms.every(term=>term.length<=2||/^\d+$/.test(term)?words.has(term):normalized.includes(term));
}
