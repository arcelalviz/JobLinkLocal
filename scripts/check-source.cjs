/* Static interaction and dependency audit. Does not replace full browser/Supabase tests. */
const fs=require('fs'), path=require('path');
const ts=require('typescript');
const root=path.resolve(__dirname,'..'), source=path.join(root,'src');
const files=[];
function collect(d){for(const name of fs.readdirSync(d)){const full=path.join(d,name);if(fs.statSync(full).isDirectory())collect(full);else if(/\.(ts|tsx)$/.test(name))files.push(full);}}collect(source);
const defects=[]; const totals={sourceFiles:files.length,buttons:0,anchors:0,formFields:0,localImports:0,sourceRoutes:0};
function flag(file,node,msg,sf){let loc=sf.getLineAndCharacterOfPosition(node.getStart(sf));defects.push(`${path.relative(root,file)}:${loc.line+1}: ${msg}`);}
for(const file of files){
 const content=fs.readFileSync(file,'utf8'),sf=ts.createSourceFile(file,content,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 for(const d of sf.parseDiagnostics){let at=sf.getLineAndCharacterOfPosition(d.start);defects.push(`${path.relative(root,file)}:${at.line+1}: ${ts.flattenDiagnosticMessageText(d.messageText,' ')}`);}
 function visit(node){
  if(ts.isImportDeclaration(node)&&ts.isStringLiteral(node.moduleSpecifier)){
   const spec=node.moduleSpecifier.text;
   if(spec.startsWith('@/')||spec.startsWith('./')||spec.startsWith('../')){
     totals.localImports++;const base=spec.startsWith('@/')?path.join(source,spec.slice(2)):path.resolve(path.dirname(file),spec);
     if(!fs.existsSync(base)&&!['.ts','.tsx','.js','.jsx','.css','.json','/index.ts','/index.tsx'].some(ext=>fs.existsSync(base+ext)))flag(file,node,`Missing local import: ${spec}`,sf);
   }
  }
  if(ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node)){
   const tag=node.tagName.getText(sf), attrs=node.attributes.properties.filter(ts.isJsxAttribute);
   const names=attrs.map(a=>a.name.text);
   if(tag==='button'){
    totals.buttons++;
    let inForm=false,p=node.parent;while(p){if(ts.isJsxElement(p)&&p.openingElement.tagName.getText(sf)==='form'){inForm=true;break;}p=p.parent;}
    const typeAttr=attrs.find(a=>a.name.text==='type');
    const type=typeAttr?.initializer?.getText(sf).replace(/["']/g,'');
    if(!names.includes('onClick')&&!(inForm&&type!=='button')&&!names.includes('aria-hidden'))flag(file,node,`Button has no click handler or form submit behavior: ${node.getText(sf).slice(0,90)}`,sf);
   }
   if(tag==='Link'||tag==='a'){
    totals.anchors++;
    if(!names.includes('href'))flag(file,node,'Link has no destination.',sf);
    if(attrs.some(a=>a.name.text==='href'&&a.initializer?.getText(sf)==='"#"'))flag(file,node,'Link points to # rather than a destination.',sf);
   }
   if(['input','select','textarea'].includes(tag))totals.formFields++;
  }
  ts.forEachChild(node,visit);
 }
 visit(sf);
}
const api=fs.readFileSync(path.join(source,'lib/api.ts'),'utf8');
totals.sourceRoutes=(api.match(/if\(routeIs\(parts,|if\(parts\[0\]/g)||[]).length;
for(const [label,snippet] of Object.entries({
 'saved jobs removal':"if(body.remove===true){",
 'private preview retry':"fetchWithSessionRetry(url",
 'LGU full job preview':"<h4>Job description</h4>",
 'system admin jobs tab':"roles:['lgu_admin','sys_admin']",
 'dedicated job detail route':"/jobs/${job.id}",
 'login job deep link':"returnJobId&&portal==='jobseeker'",
 'manual account approval':"await currentUser(['lgu_admin'],true)"
})){
 if(!files.some(file=>fs.readFileSync(file,'utf8').includes(snippet)))defects.push(`Missing regression invariant: ${label}`);
}
console.log('JobLinkLocal static audit:',JSON.stringify(totals));
if(defects.length){console.error(defects.join('\n'));process.exitCode=1;}else{console.log('PASS: syntax, local imports, button/link checks, expected regression invariants.');}
