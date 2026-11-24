const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const modules=new Map();
function load(name){if(modules.has(name))return modules.get(name);const source=fs.readFileSync(path.join(__dirname,'../src/lib',name+'.ts'),'utf8');const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const mod={exports:{}};new Function('module','exports','require',code)(mod,mod.exports,s=>s.startsWith('./')?load(s.slice(2)):require(s));modules.set(name,mod.exports);return mod.exports;}
const {reportSummaryData,verifiedReportSummary,reportFocuses}=load('report-ai');
const report={summary:{applications:34,jobs:8,employment_records:3,verification_submissions:12,approved_verifications:9,profiles:20,private_name:'Never share'},truncated:false};
let passed=0;
for(const {value} of reportFocuses){const data=reportSummaryData(report,value);assert.equal(data.facts.length,2);assert.equal(data.allFacts.length,6);assert.ok(!JSON.stringify(data).includes('Never share'));assert.equal(verifiedReportSummary('A',data),data.builtIn);const reversed=verifiedReportSummary('B',data);assert.ok(reversed&&reversed!==data.builtIn);for(const n of [34,8,3,12,9,20])assert.match(reversed,new RegExp(`\\b${n}\\b`));assert.equal(verifiedReportSummary('A. Fire all workers.',data),null);passed++;}
assert.throws(()=>reportSummaryData(null,'recruitment'));passed++;
assert.throws(()=>reportSummaryData(report,'unknown'));passed++;
assert.throws(()=>reportSummaryData({summary:{...report.summary,applications:-1}},'recruitment'));passed++;
assert.throws(()=>reportSummaryData({summary:{...report.summary,profiles:'20'}},'recruitment'));passed++;
assert.throws(()=>reportSummaryData({summary:{applications:1}},'recruitment'));passed++;
assert.equal(reportSummaryData({...report,truncated:true},'verification').truncated,true);passed++;
const empty=reportSummaryData({summary:Object.fromEntries(Object.keys(report.summary).filter(k=>k!=='private_name').map(k=>[k,0]))},'accounts');assert.ok(empty.allFacts.every(f=>f.endsWith(': 0.')));passed++;
assert.match(reportSummaryData({summary:{...report.summary,applications:1,jobs:1}},'recruitment').builtIn,/1 job application\./);passed++;
assert.match(reportSummaryData(report,'verification').builtIn,/9 have approved status/);passed++;
console.log(`${passed} report AI summary checks passed`);
