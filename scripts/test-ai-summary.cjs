const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
function load(name){const source=fs.readFileSync(path.join(__dirname,'../src/lib',name+'.ts'),'utf8');const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const mod={exports:{}};new Function('module','exports','require',code)(mod,mod.exports,require);return mod.exports;}
const {summaryFacts,builtInSummary,summaryOptions,validatedModelSummary}=load('ai-summary');
const {startLocalSummary}=load('local-summary-client');
(async()=>{
 let passed=0;
 const cases=[['jobseeker',{available_jobs:20,submitted_applications:4}],['employer',{own_job_posts:2,submitted_applications:10}],['lgu_admin',{pending_verifications:0,pending_job_reviews:7}],['sys_admin',{total_accounts:25,total_applications:18}]];
 for(const [role,metrics] of cases){const facts=summaryFacts(role,{...metrics,private_name:'Never include me'});assert.equal(facts.length,2);assert.equal(builtInSummary(role,metrics),facts.join(' '));assert.ok(!facts.join(' ').includes('Never include me'));const options=summaryOptions(facts);assert.equal(validatedModelSummary(facts.join(' '),facts),options[0]);assert.equal(validatedModelSummary([...facts].reverse().join(' '),facts),options[1]);assert.equal(validatedModelSummary('A',facts),options[0]);assert.equal(validatedModelSummary('Option B.',facts),options[1]);passed++;}
 assert.throws(()=>summaryFacts('unknown',{}));passed++;
 assert.throws(()=>summaryFacts('jobseeker',{available_jobs:0}));passed++;
 assert.throws(()=>summaryFacts('jobseeker',{available_jobs:-1,submitted_applications:0}));passed++;
 const facts=summaryFacts(...cases[0]);
 assert.equal(validatedModelSummary('There are 100 jobs.',facts),null);passed++;
 assert.equal(validatedModelSummary(facts.join(' ')+' Reject all applicants.',facts),null);passed++;
 assert.equal(validatedModelSummary(facts[0],facts),summaryOptions(facts)[0]);passed++;
 assert.equal(validatedModelSummary('B: '+facts[1],facts),summaryOptions(facts)[1]);passed++;
 assert.equal(validatedModelSummary('A. Reject all applicants.',facts),null);passed++;
 assert.equal(validatedModelSummary('A: Published job openings: 999.',facts),null);passed++;
 assert.equal(validatedModelSummary('A', ['Unknown metric: 1.',facts[1]]),null);passed++;
 assert.deepEqual(summaryOptions(summaryFacts('jobseeker',{available_jobs:1,submitted_applications:0})),['There is 1 published job opening. You have submitted 0 job applications.','You have submitted 0 job applications. There is 1 published job opening.']);passed++;
 assert.equal(validatedModelSummary(summaryOptions(facts)[1],facts),summaryOptions(facts)[1]);passed++;
 const OriginalWorker=global.Worker;
 class FakeWorker{constructor(url,opts){assert.equal(url,'/workers/local-summary.mjs?v=2');assert.equal(opts.type,'module');FakeWorker.last=this;}postMessage(message){assert.deepEqual(message,{facts});}terminate(){this.terminated=true;}}
 try{
  global.Worker=FakeWorker;
  let progress='';let task=startLocalSummary(facts,s=>progress=s);FakeWorker.last.onmessage({data:{kind:'progress',text:'Loading'}});assert.equal(progress,'Loading');FakeWorker.last.onmessage({data:{kind:'result',text:facts.join(' ')}});assert.equal(await task.promise,facts.join(' '));assert.ok(FakeWorker.last.terminated);passed++;
  task=startLocalSummary(facts,()=>{});FakeWorker.last.onerror();await assert.rejects(task.promise,/could not load/);assert.ok(FakeWorker.last.terminated);passed++;
  task=startLocalSummary(facts,()=>{});task.cancel();await assert.rejects(task.promise,/cancelled/);assert.ok(FakeWorker.last.terminated);passed++;
  global.Worker=class{constructor(){throw Error('unsupported');}};task=startLocalSummary(facts,()=>{});await assert.rejects(task.promise,/not supported/);passed++;
 }finally{global.Worker=OriginalWorker;}
 const api=fs.readFileSync(path.join(__dirname,'../src/lib/api.ts'),'utf8');assert.ok(!api.includes('OPENAI_API_KEY'));assert.ok(!api.includes('generateSummary('));assert.ok(api.includes('builtInSummary(profile.role,metrics)'));passed++;
 console.log(`${passed} local summary and mocked worker checks passed`);
})().catch(e=>{console.error(e);process.exitCode=1;});
