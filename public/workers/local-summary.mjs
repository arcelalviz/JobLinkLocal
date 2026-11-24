// The model receives only two preformatted aggregate facts, never account identifiers.
// Version pinned to the official Transformers.js installation documentation.
const library = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2';
let generator;
self.onmessage = async ({data}) => {
 try {
  const facts=data?.facts;
  if(!Array.isArray(facts)||facts.length!==2||facts.some(f=>typeof f!=='string'||f.length>120||!/^[A-Za-z ]+: \d+\.$/.test(f)))throw Error('Invalid summary facts');
  self.postMessage({kind:'progress',text:'Preparing local model…'});
  if(!generator){
   const {pipeline,env}=await import(library);
   env.allowLocalModels=false;
   env.useBrowserCache=true;
   if(env.backends?.onnx?.wasm)env.backends.onnx.wasm.numThreads=1;
   generator=await pipeline('text2text-generation','Xenova/flan-t5-small',{
    device:'wasm',dtype:'q8',revision:'01731f8',
    progress_callback:(event)=>{
     const percent=event?.status==='progress'&&Number.isFinite(event.progress)?` (${Math.round(Math.max(0,Math.min(100,event.progress)))}% of current file)`:'';
     self.postMessage({kind:'progress',text:`Downloading or loading local model${percent}…`});
    }
   });
  }
  self.postMessage({kind:'progress',text:'Generating on your device…'});
  const result=await generator(`Question: Which dashboard fact should be mentioned first? Choose A or B. A: ${facts[0]} B: ${facts[1]} Answer:`,{max_new_tokens:32,do_sample:false});
  self.postMessage({kind:'result',text:result?.[0]?.generated_text});
 }catch{generator=undefined;self.postMessage({kind:'error'});}
};
