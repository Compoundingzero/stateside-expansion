import test from 'node:test';
import assert from 'node:assert/strict';
import {searchVerificationMeta,addSearchVerification} from '../src/server/search-verification.mjs';

test('search ownership uses only explicitly configured public tokens in the HTML head',()=>{
 const html='<html><head><title>ELN</title></head><body></body></html>';
 assert.equal(addSearchVerification(html,searchVerificationMeta({})),html);
 const result=addSearchVerification(html,searchVerificationMeta({GOOGLE_SITE_VERIFICATION:'google_real_token-123',BING_SITE_VERIFICATION:'0123456789ABCDEF'}));
 assert.match(result,/<meta name="google-site-verification" content="google_real_token-123">/);
 assert.match(result,/<meta name="msvalidate.01" content="0123456789ABCDEF"><\/head>/);
 assert.throws(()=>searchVerificationMeta({GOOGLE_SITE_VERIFICATION:'"><script>alert(1)</script>'}));
});
