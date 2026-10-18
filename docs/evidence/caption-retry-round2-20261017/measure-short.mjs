import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {setTimeout as sleep} from 'node:timers/promises';
const base='https://murmur-worker-sandbox.msbilal.workers.dev';
const pcm=await readFile(new URL('./good-morning.pcm', import.meta.url));
if(pcm.length!==89114)throw Error('robot fixture mismatch');
export async function runSandbox(run){
 const install=randomUUID();let cookie='',token='',id='',ws;
 const result={sequence:[],inputBytes:0,inputChunks:0,firstTranslationMs:null,firstAudioMs:null,audioToCaptionMs:null,captions:[],outputAudio:[],observedRetryCount:0,timeout:false,errors:[],model:null,providerConfig:[]};
 async function request(path,body){
  const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,Cookie:cookie,Authorization:'Bearer '+token,'X-Murmur-Install-Id':install,'X-Murmur-Free-Allowance-Id':install},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  const value=await r.json();if(!r.ok)throw Error(`${path.split('/').slice(0,3).join('/')} HTTP ${r.status} ${value.error??''}`);return{r,value};
 }
 try{
  const login=await request('/api/auth/sign-in/anonymous',{});token=login.value.token??'';cookie=login.r.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
  const {value}=await request('/v2/session',{app_install_id:install,app_platform:'ios',app_version:'1.3.1',source_language:'en',target_language:'es',capture_source:'microphone',playback_enabled:true,analytics_enabled:false,insights_consent:false,device_integrity:{available:false,platform:'ios',provider:'app_attest'}});id=value.app_session_id;
  const url=new URL(value.realtime_ws_url);if(url.origin!==base.replace('https:','wss:')||url.pathname!=='/v2/realtime')throw Error('sandbox destination mismatch');
  ws=new WebSocket(url);ws.binaryType='arraybuffer';const audio=[];let generation=-1,lastOutput=0;const ready=Promise.withResolvers();void ready.promise.catch(()=>{});
  let start=null,caption='',ended=false;const began=performance.now();
  ws.addEventListener('error',()=>ready.reject(Error('websocket_error')));
  ws.addEventListener('close',()=>{ended=true;ready.reject(Error('websocket_closed'));});
  ws.addEventListener('message',e=>{
   if(typeof e.data!=='string'){const bytes=Buffer.from(e.data);const ms=Math.round(performance.now()-start);result.firstAudioMs??=ms;lastOutput=performance.now();audio.push(bytes);result.outputAudio.push({ms,bytes:bytes.length,generation,sha256:createHash('sha256').update(bytes).digest('hex')});return;}
   const data=JSON.parse(e.data);result.sequence.push({type:data.kind,ms:Math.round(performance.now()-(start??began))});
   if(data.kind==='session_opened'){result.model=data.provider_metadata?.model;ready.resolve();}
   if(data.kind==='provider_session_config'&&data.phase==='updated')generation++;
   if(data.kind==='provider_session_config')result.providerConfig.push({phase:data.phase,output_language:data.output_language,input_noise_reduction:data.input_noise_reduction,transcription_model:data.transcription_model});
   if(data.kind==='input_audio_ack'){result.inputBytes=data.bytes_received;result.inputChunks=data.chunk_seq;}
   if(data.kind==='translation_delta'&&data.delta?.trim()&&start!==null){if(result.firstTranslationMs===null)result.firstTranslationMs=Math.round(performance.now()-start);caption+=data.delta;lastOutput=performance.now();result.captions.push({ms:Math.round(performance.now()-start),generation,delta:data.delta});}
   if(data.kind==='session_error'||data.kind==='error')result.errors.push({kind:data.kind,code:data.code,retryable:data.retryable});
  });
  await Promise.race([ready.promise,sleep(15000).then(()=>{throw Error('open_timeout')})]);start=performance.now();
  for(let offset=0;offset<pcm.length;offset+=4800){const chunk=pcm.subarray(offset,offset+4800);ws.send(new Uint8Array(chunk));await sleep(chunk.length/48);}
  while(!ended&&result.errors.length===0&&performance.now()-start<60000){if(result.firstTranslationMs!==null&&performance.now()-lastOutput>2500)break;await sleep(50);}
  result.audioToCaptionMs=result.firstTranslationMs===null||result.firstAudioMs===null?null:result.firstTranslationMs-result.firstAudioMs;
  result.captionText=caption;result.outputBytes=audio.reduce((sum,b)=>sum+b.length,0);
  await writeFile(`./short-playback-${run}.pcm`,Buffer.concat(audio));
  result.timeout=result.firstTranslationMs===null&&performance.now()-start>=60000;
  result.streamMs=Math.round(performance.now()-start);
  result.observedRetryCount=Math.max(0,result.providerConfig.filter(c=>c.phase==='updated').length-1);
  if(ws.readyState===WebSocket.OPEN){ws.send(JSON.stringify({kind:'close_session'}));const closeAt=performance.now();while(!ended&&performance.now()-closeAt<2000)await sleep(50);}
 }catch(e){result.failure=e.message;}
 finally{
  if(ws&&ws.readyState!==WebSocket.CLOSED)ws.close(1000,'long_speech_complete');
  if(id)try{await request('/v2/session/'+encodeURIComponent(id)+'/stop',{});}catch(e){result.stopFailure=e.message;}
  if(cookie)try{await request('/api/auth/delete-user',{});}catch(e){result.deleteFailure=e.message;}
 }
 return result;
}
