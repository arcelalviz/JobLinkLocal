const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const {createRequire}=require('node:module');
const source=fs.readFileSync(require('node:path').join(__dirname,'../src/lib/ai-summary.ts'),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};new Function('module','exports','require',code)(mod,mod.exports,createRequire(__filename));
const {generateSummary}=mod.exports;
(async()=>{
 let count=0;const original=global.fetch;const originalLog=console.error;const logs=[];console.error=(...args)=>logs.push(JSON.stringify(args));
 try{
  for(const [status,code,type,reason] of [[401,'invalid_api_key','invalid_request_error','credentials'],[429,'insufficient_quota','insufficient_quota','quota'],[404,'model_not_found','invalid_request_error','model'],[403,'','permission_error','permission'],[429,'rate_limit_exceeded','rate_limit_error','rate_limit'],[400,'invalid_request_error','invalid_request_error','request'],[503,'server_is_overloaded','service_unavailable_error','provider']]){
   global.fetch=async()=>new Response(JSON.stringify({error:{code,type,message:'secret-test-key'}}),{status});
   await assert.rejects(generateSummary('secret-test-key','gpt-6.1-terra','jobseeker',{available_jobs:2}),e=>e.reason===reason);count++;
  }
  global.fetch=async(_,options)=>{const b=JSON.parse(options.body);assert.equal(b.reasoning.effort,'none');assert.equal(b.store,false);assert.equal(b.max_output_tokens,1024);return new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:'Two jobs are available.'}]}]}));};
  assert.equal(await generateSummary('secret-test-key','gpt-6.1-terra','jobseeker',{available_jobs:2}),'Two jobs are available.');count++;
  global.fetch=async()=>new Response(JSON.stringify({status:'incomplete',output:[]}));await assert.rejects(generateSummary('secret-test-key','gpt-6.1-terra','jobseeker',{}),e=>e.reason==='incomplete');count++;
  global.fetch=async()=>{throw new Error('secret-test-key')};await assert.rejects(generateSummary('secret-test-key','gpt-6.1-terra','jobseeker',{}),e=>e.reason==='connection');count++;
  assert.ok(logs.every(l=>!l.includes('secret-test-key')));count++;
  console.log(`${count} mocked AI summary checks passed`);
 }finally{global.fetch=original;console.error=originalLog;}
})().catch(e=>{console.error(e);process.exitCode=1;});
