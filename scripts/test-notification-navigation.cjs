const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname,'../src/components/AccountPanels.tsx'),'utf8');
const sf = ts.createSourceFile('AccountPanels.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let handler;
function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(sf)==='openRelatedPage')handler=node.initializer.getText(sf);ts.forEachChild(node,visit);}
visit(sf);
assert.ok(handler);
const compiled = ts.transpileModule('const handler='+handler+'; globalThis.handler=handler;', {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
function fixture({reject=false,hold=false}={}){
 const calls=[];let rows=[{id:'a',read_at:null},{id:'b',read_at:null}];let release;
 const gate=hold?new Promise(r=>{release=r;}):Promise.resolve();
 const ctx={URL,Date,Error,window:{location:{origin:'https://example.test'}},openingNotification:{current:false},request:async(path,method,body)=>{calls.push(['request',path,method,body.id]);await gate;if(reject)throw new Error('Offline');},setData:fn=>{rows=fn(rows);calls.push(['state']);},bump:()=>calls.push(['refresh']),router:{push:path=>calls.push(['navigate',path])},toast:{show:(msg,type)=>calls.push(['toast',msg,type])}};
 vm.runInNewContext(compiled,ctx);
 return {calls,handler:ctx.handler,rows:()=>rows,release};
}
const event=(overrides={})=>({defaultPrevented:false,button:0,preventDefault(){this.defaultPrevented=true;},...overrides});
const n={id:'a',link:'/app?tab=applications',read_at:null};
(async()=>{
 let f=fixture({hold:true});const e=event();const task=f.handler(e,n);assert.equal(e.defaultPrevented,true);assert.deepEqual(f.calls,[['request','notifications','PATCH','a']]);await f.handler(event(),n);assert.equal(f.calls.length,1);f.release();await task;assert.deepEqual(f.calls,[['request','notifications','PATCH','a'],['state'],['refresh'],['navigate','/app?tab=applications']]);assert.ok(f.rows()[0].read_at);assert.equal(f.rows()[1].read_at,null);console.log('PASS: single unread notification is persisted before navigating; repeat click ignored');
 f=fixture();await f.handler(event(),{...n,read_at:'2026-11-25'});assert.deepEqual(f.calls,[['navigate','/app?tab=applications']]);console.log('PASS: previously read notification navigates without another write');
 f=fixture({reject:true});await f.handler(event(),n);assert.deepEqual(f.calls,[['request','notifications','PATCH','a'],['toast','Offline','error']]);assert.equal(f.rows()[0].read_at,null);console.log('PASS: failed update keeps notification unread and allows retry');
 f=fixture();const modified=event({ctrlKey:true});await f.handler(modified,n);assert.equal(modified.defaultPrevented,false);assert.deepEqual(f.calls,[]);console.log('PASS: native new-tab click behavior preserved');
 f=fixture();await f.handler(event(),{...n,link:'https://other.example/'});assert.equal(f.calls[0][0],'toast');assert.equal(f.calls.length,1);console.log('PASS: unexpected external navigation rejected');
 assert.ok(source.includes('onClick={event=>void openRelatedPage(event,n)}'));console.log('PASS: actual related-page link uses tested handler');
 console.log('6/6 notification navigation checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
