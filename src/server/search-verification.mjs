// Ownership tokens are public verification identifiers, never account credentials.
// Read at runtime so an account's real token can be installed without a rebuild.
export function searchVerificationMeta(env=process.env){
 const entries=[['google-site-verification',env.GOOGLE_SITE_VERIFICATION],['msvalidate.01',env.BING_SITE_VERIFICATION]];
 return entries.filter(([,value])=>value).map(([name,value])=>{
  if(typeof value!=='string'||!/^[A-Za-z0-9_-]{8,256}$/.test(value))throw new Error(`Invalid ${name} ownership token`);
  return `<meta name="${name}" content="${value}">`;
 }).join('');
}

export function addSearchVerification(html,meta){
 if(!meta)return html;
 if(!html.includes('</head>'))throw new Error('Homepage head is missing');
 return html.replace('</head>',`${meta}</head>`);
}
