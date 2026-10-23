import {spawn} from 'node:child_process';

export async function dismissControls(page){
 await page.getByRole('button',{name:'Start building',exact:true}).click();
}

export async function revisionServer(){
 const url=process.env.BRICKED_URL||'http://127.0.0.1:5176';
 let processHandle;
 try{await fetch(url);}catch{
  processHandle=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5176'],{stdio:'ignore'});
  let ready=false;
  for(let i=0;i<60;i++){try{await fetch(url);ready=true;break;}catch{await new Promise(resolve=>setTimeout(resolve,250));}}
  if(!ready){processHandle.kill();throw new Error(`Could not start the revision test server at ${url}`);}
 }
 return {url,stop:async()=>{if(!processHandle||processHandle.exitCode!==null)return;await new Promise(resolve=>{const timer=setTimeout(resolve,1000);processHandle.once('exit',()=>{clearTimeout(timer);resolve();});processHandle.kill('SIGTERM');});}};
}
