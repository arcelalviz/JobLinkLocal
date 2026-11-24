const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
function load(file,globals={}){
 const exports={}; const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,require:(name)=>{if(name==='@supabase/ssr')return {};throw Error('Unexpected dependency: '+name);},...globals});return exports;
}
const {isWorkspaceProfile,isRecord}=load('src/lib/workspace-data.ts');
const base={id:'example',full_name:'Demo Account',role:'jobseeker',lgu_status:'approved'};
let passed=0;
function check(name,fn){fn();passed++;console.log('PASS '+name);}
async function main(){
 check('All four supported roles are accepted',()=>{for(const role of ['jobseeker','employer','lgu_admin','sys_admin'])assert.equal(isWorkspaceProfile({...base,role}),true);});
 check('Malformed and unknown roles rejected',()=>{for(const value of [undefined,null,[],{}, {...base,role:'admin'}, {...base,full_name:null}])assert.equal(isWorkspaceProfile(value),false);});
 check('Unknown verification state rejected',()=>assert.equal(isWorkspaceProfile({...base,lgu_status:'unknown'}),false));
 check('Dashboard record shape validation',()=>{assert.equal(isRecord({stats:{}}),true);assert.equal(isRecord([]),false);assert.equal(isRecord(null),false);});
 let response;
 const {request,HttpError}=load('src/lib/http.ts',{fetch:async()=>response,FormData,process:{env:{}}});
 response=new Response(JSON.stringify({data:base}),{status:200});assert.equal((await request('me')).id,base.id);passed++;console.log('PASS valid API envelope');
 for(const [status,body,expected] of [[401,{error:'expired'},401],[403,{error:'denied'},403],[503,{error:'unavailable'},503],[200,{message:'missing data'},502]]){
  response=new Response(JSON.stringify(body),{status});await assert.rejects(request('me'),e=>e instanceof HttpError&&e.status===expected);passed++;console.log('PASS HTTP '+status+' handled as '+expected);
 }
 response=new Response('<html>error</html>',{status:200});await assert.rejects(request('me'),e=>e.status===502);passed++;console.log('PASS non-JSON response handled');
 console.log(`${passed}/${passed} workspace recovery checks passed (mocked HTTP and shape validation).`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
