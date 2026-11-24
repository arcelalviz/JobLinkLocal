/* Small dependency-free logic regression suite. Not an end-to-end browser test. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
function load(source){
 const filename=path.join(root,source),contents=fs.readFileSync(filename,'utf8');
 const js=ts.transpileModule(contents,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};const context={exports,console,require,Intl,Date,Map,Set,Number,Object,Array,String,Math};
 vm.runInNewContext(js,context,{filename});return exports;
}
const skills=load('src/lib/skillMatching.ts'), geo=load('src/lib/olongapo.ts'),analytics=load('src/lib/analytics.ts');
const tests=[];
function test(name,cb){try{cb();tests.push([name,'PASS']);}catch(err){tests.push([name,err.message]);process.exitCode=1;}}

test('All 17 Olongapo barangays are in the source',()=>assert.equal(geo.OLONGAPO_BARANGAYS.length,17));
test('Invalid barangay rejected by validator',()=>{assert.equal(geo.isOlongapoBarangay('Santa Rita'),true);assert.equal(geo.isOlongapoBarangay('Manila'),false);});
test('Local job address contains full Olongapo location',()=>assert.equal(geo.olongapoAddress('Banicain','Sample Street'),'Sample Street, Brgy. Banicain, Olongapo City'));
test('Manila timestamps show correct local date',()=>assert.equal(geo.manilaTimestamp('2026-11-24T16:00:00.000Z').includes('Nov 25'),true));
test('Skill matcher recognizes synonyms and does not invent matches',()=>{const v=skills.matchJobSkills(['Microsoft Excel','Photoshop'], 'Experience with MS Excel and graphic design required.');assert.ok(v.required.includes('Excel'));assert.ok(v.required.includes('Graphic Design'));assert.ok(v.matched.includes('Excel'));assert.ok(v.matched.includes('Graphic Design'));assert.ok(!v.matched.includes('Driving'));});
test('Skill matcher does not make suitability or hiring decisions',()=>{const v=skills.matchJobSkills(['Excel'],'Must know Excel');assert.ok(!('rank' in v));assert.ok(!('eligible' in v));});
test('Analytics uses Philippine date near UTC midnight',()=>assert.equal(analytics.bucketLabel('2026-11-24T16:01:00.000Z','day'),'2026-11-25'));
test('Weekly analytics start on Monday',()=>assert.equal(analytics.bucketLabel('2026-11-24T05:00:00.000Z','week'),'2026-11-23'));
test('Activity series aggregates applications and hires',()=>{const series=analytics.buildActivitySeries({applications:[{created_at:'2026-11-24T05:00:00Z'},{created_at:'2026-11-24T06:00:00Z'}],employment:[{created_at:'2026-11-24T07:00:00Z'}],registrations:[],verifications:[],jobs:[]},'day');assert.equal(series.length,1);assert.equal(series[0].applications,2);assert.equal(series[0].hires,1);});
test('Empty analytics avoid invented trends',()=>{const insights=analytics.buildInsights({applications:[],employment:[],registrations:[],verifications:[],jobs:[],granularity:'day'});assert.equal(insights[0].id,'insufficient-data');});
test('Employer job form matches 16/12 character server validation',()=>{const s=fs.readFileSync(path.join(root,'src/components/EmployerPanels.tsx'),'utf8');assert.ok(s.includes('minLength={16} value={form.description}'));assert.ok(s.includes('minLength={12} value={form.requirements}'));});
test('Saved job deletion does not require a published job',()=>{const s=fs.readFileSync(path.join(root,'src/lib/api.ts'),'utf8');const a=s.indexOf("if(routeIs(parts,'saved')&&method==='POST')");const b=s.indexOf("if(routeIs(parts,'applications')&&method==='GET')",a);const sub=s.slice(a,b);assert.ok(sub.indexOf('if(body.remove===true)')<sub.indexOf(".eq('status','published')"));});
console.log(tests.map(([name,result])=>`${result==='PASS'?'PASS':'FAIL'} ${name}${result==='PASS'?'':': '+result}`).join('\n'));
console.log(`${tests.filter(t=>t[1]==='PASS').length}/${tests.length} logic tests passed.`);
