import assert from "node:assert/strict";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { randomUUID } from "node:crypto";

import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { bundleWorkerProof } from "./worker-proof-runtime.mjs";

const { root, script, splitSqlQuery } = await bundleWorkerProof({
  entryPoint: "apps/worker/caption-recovery-probe.ts",
  plugins: process.env.CAPTION_PROOF_BASELINE_SOURCE ? [{name: "baseline-caption-recovery", setup(builder) {
    builder.onLoad({filter: /sockets\/captionRecovery\.ts$/}, async () => ({
      contents: await readFile(process.env.CAPTION_PROOF_BASELINE_SOURCE, "utf8"), loader: "ts",
    }));
  }}] : [],
});
const output = resolve(root, "artifacts/caption-recovery");
await mkdir(output, { recursive: true });
const captionSentinel = "SYNTHETIC_PRIVATE_TRANSCRIPT_CAPTION_RETRY";
const provider = `
const states = new Map(), controls = new Map();
export default { async fetch(request) {
 const url = new URL(request.url);
 if (url.pathname === '/control') {
   const body=await request.json();controls.get(url.searchParams.get('key'))[body.index-1].push(body);
   return Response.json({});
 }
 if (url.pathname === '/state') return Response.json(states.get(url.searchParams.get('key')) ?? {});
 if (url.hostname !== 'api.openai.com') {
   if(url.pathname.includes('flags')) return Response.json({flags:{}});
   const body = await request.json(), key = body.properties?.app_session_id;
   if(key) { const state = states.get(key) ?? {events:[]}; state.events.push(body);states.set(key,state); }
   return Response.json({});
 }
 const key = request.headers.get('OpenAI-Safety-Identifier'), mode = key.split('_')[0];
 const state = states.get(key) ?? {connections:[],events:[]};states.set(key,state);
 const index = state.connections.length + 1;
 const connection = {index,bytes:0,chunks:0,closed:false,config:null,markers:[]};state.connections.push(connection);
 const pair = new WebSocketPair(), socket=pair[1];socket.accept();
 const queue=[],list=controls.get(key)??[];list.push(queue);controls.set(key,list);
 const controlTimer=setInterval(()=>{for(const body of queue.splice(0)){if(body.close)socket.close(body.close,'synthetic close');else socket.send(JSON.stringify(body.event));}},10);
 const timers=[];let sentCaption=false,started=false;
 const send = value => {try{socket.send(JSON.stringify(value));}catch{}};
 const caption = tag => send({type:'session.output_transcript.delta',delta:'${captionSentinel}_'+tag});
 socket.addEventListener('message',event=>{
   const data=JSON.parse(event.data);
   if(data.type==='session.update') {connection.config=data.session;send({type:'session.updated',session:{audio:data.session.audio}});}
   if(data.type!=='session.input_audio_buffer.append') return;
   const raw=atob(data.audio), marker=raw.charCodeAt(0);
   connection.bytes+=raw.length;connection.chunks++;connection.markers.push(marker);
   if(!(index>1 && ['silent','cap','continuous'].includes(mode))) {
     const bytes=index>1 ? (mode==='shorter'?2400:mode==='longer'?7200:4800) : 4800;
     const output={type:'session.output_audio.delta',delta:btoa(String.fromCharCode(marker,16).repeat(bytes/2))};
     if(index===1 && mode==='healthy-quiet' && connection.chunks===10)timers.push(setTimeout(()=>send(output),3000));else send(output);
   }
   if(!started) {
     started=true;
     if(index===1 && ['healthy','healthy-quiet'].includes(mode))timers.push(setTimeout(()=>caption('original'),2500));
     if(index===1 && mode==='original-wins') {timers.push(setTimeout(()=>caption('original'),11000));timers.push(setTimeout(()=>caption('continued'),14000));}
     if(index===1 && mode==='recovery-wins')timers.push(setTimeout(()=>caption('late-original'),12000));
     if(index===2 && mode==='original-wins')timers.push(setTimeout(()=>caption('late-side'),3000));
   }
   if(!sentCaption && connection.bytes>=48000 && (index===2 && ['shorter','longer','mute','recovery-wins'].includes(mode) || index===3 && mode==='silent')) {sentCaption=true;caption('recovered');}
 });
 socket.addEventListener('close',()=>{connection.closed=true;clearInterval(controlTimer);for(const t of timers)clearTimeout(t);try{socket.close(1000);}catch{}});
 return new Response(null,{status:101,webSocket:pair[0]});
}};
`;
const mf = new Miniflare(convertV4MiniflareOptions({
  workers: [{
    name: "proxy", modules: true, script,
    compatibilityDate: "2026-05-16", compatibilityFlags: ["nodejs_compat"],
    outboundService: "provider", d1Databases: ["BILLING_DB"],
    durableObjects: { CUSTOMER_LEDGER: { className: "CustomerLedgerDurableObject", useSQLite: true } },
    bindings: { OPENAI_API_KEY: "fake-test-only", BILLING_ENFORCEMENT_ENABLED: "true",
      POSTHOG_PROJECT_TOKEN: "fake-test-only", MURMUR_ENV: "development" },
  }, {name: "provider", modules: true, script: provider, compatibilityDate: "2026-05-16"}],
}));
const deadline = setTimeout(() => { console.error("caption proof exceeded 75s"); process.exit(2); }, 75_000);
const sockets=[];
try {
 const database=await mf.getD1Database("BILLING_DB","proxy"), migrations=resolve(root,"apps/worker/migrations");
 for(const name of (await readdir(migrations)).sort())if(name.endsWith(".sql"))await database.batch(splitSqlQuery(await readFile(resolve(migrations,name),"utf8")).map(s=>database.prepare(s)));
 const upstream=await mf.getWorker("provider");
 const cases=[
  {mode:"shorter",connections:2,recovered:true,tags:["recovered"]},
  {mode:"longer",connections:2,recovered:true,tags:["recovered"]},
  {mode:"mute",connections:2,recovered:true,tags:["recovered"],muted:true},
  {mode:"silent",connections:3,recovered:true,tags:["recovered"]},
  {mode:"continuous",connections:4,recovered:false,exhausted:true,tags:[],frames:310,waitMs:12000},
  {mode:"cap",connections:4,recovered:false,tags:[],waitMs:28000},
  {mode:"original-wins",connections:2,recovered:false,tags:["original","continued"],original:true,afterCaptionMs:4000},
  {mode:"recovery-wins",connections:2,recovered:true,tags:["recovered"],original:true,afterCaptionMs:4000},
  {mode:"healthy",connections:1,recovered:false,tags:["original"],original:true},
  {mode:"healthy-quiet",connections:1,recovered:false,tags:["original"],original:true,waitMs:15000},
 ];
 async function settledUsage(id) {
  for(let i=0;i<100;i++) {
   const usage=await database.prepare("SELECT state, settled_ms FROM usage_sessions WHERE usage_session_id = ?").bind(id).first();
   if(usage?.state==='closed')return usage;
   await sleep(25);
  }
  assert.fail("billing settlement did not finish");
 }
 async function endedTelemetry(id) {
  for(let i=0;i<100;i++) {
   const telemetry=await(await upstream.fetch(`http://fake/state?key=${id}`)).json();
   const ended=telemetry.events?.find(e=>e.event==='worker_session_ended');
   if(ended)return{telemetry,ended};
   await sleep(25);
  }
  assert.fail("ended telemetry did not arrive");
 }
 async function feedInput(ws,frames,muted,expected) {
  for(let i=0;i<frames;i++) {
   const marker=16+i%100;ws.send(new Uint8Array(4800).fill(marker).buffer);
   if(!muted)expected.push(marker);
   await sleep(100);
  }
 }
 function assertCostTelemetry(ended,spec) {
  if (process.env.CAPTION_PROOF_BASELINE !== '1') {
   assert.equal(ended.properties.caption_only_used,spec.recovered);
   assert.equal(ended.properties.caption_replacement_count,Math.max(0,spec.connections-2));
   assert.equal(ended.properties.caption_recovery_exhausted,spec.exhausted??spec.mode==='cap');
   if(spec.connections>1)assert.ok(ended.properties.caption_only_connected_seconds>0);
   else assert.equal(ended.properties.caption_only_connected_seconds,0);
  }
 }
 async function assertSettlement(id,frames,state,spec) {
  const usage=await settledUsage(id);
  assert.equal(usage.settled_ms,(frames+1)*100,"fan-out/replay billed only once");
  const {telemetry,ended}=await endedTelemetry(id);
  assert.ok(ended,"ended telemetry delivered");
  const text=JSON.stringify(telemetry.events);assert.ok(!text.includes(captionSentinel));assert.ok(!text.includes(Buffer.alloc(4800,16).toString('base64')));
  assert.equal(ended.properties.caption_retry_count,spec.connections-1);
  assert.equal(ended.properties.captions_recovered,spec.recovered);
  assert.equal(ended.properties.caption_original_received,spec.original??false);
  assert.equal(ended.properties.caption_recovery_connections,spec.connections-1);
  assert.equal(ended.properties.caption_recovery_with_transcript,spec.answered??(spec.recovered?1:0));
  assert.equal(ended.properties.caption_recovery_input_bytes,state.connections.slice(1).reduce((sum,c)=>sum+c.bytes,0));
  assertCostTelemetry(ended,spec);
  assert.equal(ended.properties.input_audio_bytes,(frames+1)*4800);assert.equal(ended.properties.transport_close_source,null);
  return{mode:spec.mode,passed:true,connections:spec.connections,billedMs:usage.settled_ms,retries:ended.properties.caption_retry_count,recovered:spec.recovered,markersExactlyOnce:true,privacySentinelMatches:0};
 }
 async function enablePlayback(ws,muted,audio) {
  if(!muted)return;
  assert.deepEqual(audio,[],"muted original and all side audio stay muted");
  ws.send(JSON.stringify({kind:"set_playback",enabled:true}));await sleep(100);
 }
 async function observeCase(spec,until,events) {
  if(spec.waitMs)await sleep(spec.waitMs);
  else await until(()=>events.some(e=>e.kind==='translation_delta'),"caption within 25s");
  await sleep(spec.afterCaptionMs);
 }
 async function runCase(spec) {
  const {mode}=spec,id=randomUUID(),key=mode+"_"+id,events=[],audio=[],expected=[];
  let clientClosed=false;
  const until=async(predicate,label,ms=25000)=>{const end=Date.now()+ms;while(!predicate()&&Date.now()<end&&!clientClosed)await sleep(25);assert.ok(predicate(),mode+": "+label);};
  const response=await mf.dispatchFetch(`http://proxy.test/v2/realtime?case=${mode}&app_session_id=${id}&target_language=es&analytics_enabled=true&playback_enabled=${!spec.muted}`,{headers:{Upgrade:"websocket"}});
  assert.equal(response.status,101,await response.text());const ws=response.webSocket;assert.ok(ws);sockets.push(ws);ws.accept();
  ws.addEventListener("message",event=>{if(typeof event.data==='string')events.push(JSON.parse(event.data));else audio.push(new Uint8Array(event.data)[0]);});
  ws.addEventListener("close",()=>{clientClosed=true;});
  try{
   await until(()=>events.some(e=>e.kind==='session_opened'),"session opens");
   const frames=spec.frames;
   await feedInput(ws,frames,spec.muted,expected);
   await observeCase(spec,until,events);
   assert.equal(clientClosed,false,"caption recovery keeps client open");
   assert.equal(events.filter(e=>e.kind==='session_opened').length,1);
   assert.equal(events.filter(e=>e.kind==='session_closed'||e.kind==='session_error').length,0);
   const state=await(await upstream.fetch(`http://fake/state?key=${key}`)).json();
   if(mode==='original-wins')assert.equal(state.connections[1].closed,true,'original winner closes side');
   assert.equal(state.connections.length,spec.connections);
   for(const c of state.connections.slice(1))assert.deepEqual(c.config,state.connections[0].config);
   await enablePlayback(ws,spec.muted,audio);
   ws.send(new Uint8Array(4800).fill(32).buffer);expected.push(32);
   await until(()=>events.filter(e=>e.kind==='input_audio_ack').length===frames+1,"all live input acknowledged");
   await until(()=>audio.includes(32),"new original playback continues");
   assert.deepEqual(audio,expected,"every original speech marker exactly once, regardless of replacement duration or mute");
   assert.equal(state.connections[0].closed,false,"original upstream must never be replaced");
   assert.deepEqual(events.filter(e=>e.kind==='translation_delta').map(e=>e.delta),spec.tags.map(tag=>captionSentinel+'_'+tag));
   ws.send(JSON.stringify({kind:"close_session"}));await until(()=>clientClosed,"client closes itself");
   const finalState=await(await upstream.fetch(`http://fake/state?key=${key}`)).json();
   return await assertSettlement(id,frames,finalState,spec);
  }finally{try{ws.close();}catch{}}
 }
 const continuityCases = ["winner-close", "winner-error", "winner-silent", "winner-retry", "original-stall", "winner-cap", "whitespace-original", "whitespace-side", "long-recovered", "pause-resume", "winner-bursts", "original-bursts", "winner-boundary", "original-boundary", "winner-tail", "original-tail", "bounded-buffer"];
 async function whitespaceScenario(context) {
  const original=context.mode==='whitespace-original',index=original?1:2;
  if(!original)await context.until(async()=>(await context.state()).connections.length===2,'first recovery opens');
  for(const delta of ['hello',' ','world','\n','next'])await context.caption(index,delta);
  await context.until(()=>context.text().length===5,'all active whitespace deltas arrive');
  assert.deepEqual(context.text(),['hello',' ','world','\n','next'],'active deltas preserve whitespace');
  return {connections:index,answered:index-1,original,recovered:!original};
 }
 async function audioUntil(context,check,label) {
  let marker=40;
  const stream=setInterval(()=>context.feed(marker++),500);
  try {await context.until(check,label);}finally{clearInterval(stream);}
 }
 async function originalStallScenario(context) {
  await context.caption(1,'first sentence.');context.feed(30);
  await audioUntil(context,async()=>(await context.state()).connections.length===2,'healthy original later stalls');
  await context.caption(2,'first ');await context.caption(2,'sentence.');await context.caption(2,' second sentence.');
  await context.until(()=>context.text().join('').endsWith(' second sentence.'),'replayed captions arrive');
  assert.equal(context.text().join(''),'first sentence.first sentence. second sentence.','independent replay forwarded unchanged');
  return {connections:2,answered:1,original:true,recovered:true};
 }
 async function replacementScenario(context) {
  const failure={
   'winner-close':{event:null,close:1011},
   'winner-error':{event:{type:'error',error:{code:'server_error',message:'SYNTHETIC_PRIVATE_PROVIDER_ERROR'}}},
  }[context.mode];
  if(failure)await context.control(2,failure.event,failure.close);
  await context.caption(1,'original translation must never appear');
  context.feed(30);
  await audioUntil(context,async()=>(await context.state()).connections.length===3,'winner replaced without original fallback');
  await context.until(async()=>(await context.state()).connections[2].bytes>=4800,'replacement replays speech');
  for(const delta of ['first ','sentence.',' ','second','\n','next'])await context.caption(3,delta);
  await context.until(()=>context.text().length>=7,'all replacement deltas arrive');
  assert.deepEqual(context.text(),['first sentence.','first ','sentence.',' ','second','\n','next'],'all replacement deltas unchanged; no original captions');
  const capped=context.mode==='winner-cap';
  if(capped) {
   await context.control(3,null,1011);
   await context.until(async()=>(await context.state()).connections.length===4,'second replacement opens');
   await context.caption(4,' final side.');
   await context.until(()=>context.text().at(-1)===' final side.','last side caption arrives');
   await context.control(4,null,1011);
   await context.until(async()=>(await context.state()).connections[3].closed,'cap retires last side');
   await context.caption(1,' no fallback after cap.');context.feed(33);await sleep(300);
   assert.equal((await context.state()).connections.length,4,'two replacement lifetime cap');
   assert.equal(context.text().join(''),'first sentence.first sentence. second\nnext final side.');
  }
  await context.caption(1,' still no original.');
  assert.ok(!context.text().join('').includes('original'));
  const connections=3+Number(capped);
  return {connections,answered:connections-1,original:true,recovered:true,exhausted:capped};
 }
 async function longScenario(context) {
  // Audio duration, not wall time: 160 seconds exceeds the removed 120-second input cap.
  for(let i=0;i<1600;i++) {
   context.feed(50+i%50);
   if(i%100===0) {await context.caption(2,' continued');await sleep(25);}
  }
  await context.until(async()=>(await context.state()).connections[1].bytes>150*48000,'caption input continues past two minutes');
  await context.caption(2,' after 160 seconds');
  await context.until(()=>context.text().at(-1)===' after 160 seconds','late side caption arrives');
  await context.caption(1,'original must be ignored after two minutes');
  assert.equal(context.text().at(-1),' after 160 seconds');
  assert.ok(!context.text().join('').includes('original'));
  assert.equal((await context.state()).connections.length,2,'healthy side never replaced');
  return {connections:2,answered:1,original:true,recovered:true};
 }
 async function captionedSource(context) {
  const original=context.mode.startsWith('original'),index=original?1:2;
  if(!original)await context.until(async()=>(await context.state()).connections.length===2,'first recovery opens');
  await context.caption(index,'healthy caption');
  await context.until(()=>context.text().at(-1)==='healthy caption','winner delivers caption');
  return {original,index};
 }
 async function shortBurst(context) {
  for(let second=0;second<5;second++){context.feed(60+second);await sleep(1000);}
 }
 function feedSecond(context,marker) {
  for(let frame=0;frame<10;frame++)context.feed(marker);
 }
 async function shortBurstsScenario(context) {
  const {original,index}=await captionedSource(context);
  await sleep(11000);
  assert.equal((await context.state()).connections.length,index,'idle silence alone is not a failure');
  for(let burst=0;burst<2;burst++) {
   await shortBurst(context);
   await context.until(async()=>(await context.state()).connections.length===index+burst+1,'short unanswered speech has a bounded response deadline');
   await context.caption(index+burst+1,'resumed captions '+burst);
   await context.until(()=>context.text().at(-1)==='resumed captions '+burst,'replacement answers');
   await sleep(11000);
   assert.equal((await context.state()).connections.length,index+burst+1,'healthy pause never replaces winner');
  }
  return {connections:index+2,answered:index+1,original,recovered:true};
 }
 async function trailingPlaybackScenario(context) {
  const {original,index}=await captionedSource(context);
  for(let tail=0;tail<2;tail++) {
   await context.playback(110+tail);
   context.silence();
   await sleep(11000);
   assert.equal((await context.state()).connections.length,index,'trailing output and silent input never arm recovery');
  }
  return {connections:index,answered:index-1,original,recovered:!original,syntheticOutputFrames:2};
 }
 async function boundedBufferScenario(context) {
  for(let second=0;second<75;second++) {
   feedSecond(context,30+second);
   await context.until(async()=>(await context.state()).connections[0].bytes===(second+2)*48000,'input position delivered');
  }
  await context.until(async()=>(await context.state()).connections.length===2,'bounded first takeover opens');
  await context.caption(2,'bounded takeover');
  await context.until(()=>context.text().at(-1)==='bounded takeover','takeover answers');
  await context.until(async()=>(await context.state()).connections[1].bytes>=15*48000,'first takeover replays bounded window');
  assert.equal((await context.state()).connections[1].bytes,15*48000,'first takeover replay size');
  assert.deepEqual([...new Set((await context.state()).connections[1].markers)],Array.from({length:15},(_,i)=>90+i),'old input evicted before any captions');
  return {connections:2,answered:1,original:false,recovered:true};
 }
 async function replayBoundaryScenario(context) {
  const {original,index}=await captionedSource(context);
  await context.until(async()=>(await context.state()).connections[index-1].bytes===48000,'initial input delivered');
  for(let second=0;second<70;second++) {
   feedSecond(context,30+second);
   await context.until(async()=>(await context.state()).connections[index-1].bytes===(second+2)*48000,'input position delivered');
   await context.caption(index,'line-'+second);
   await context.until(()=>context.text().at(-1)==='line-'+second,'caption boundary delivered');
  }
  for(let i=0;i<20;i++)context.feed(120);
  await context.until(async()=>(await context.state()).connections[index-1].bytes===73*48000,'pending speech delivered');
  if(original){await sleep(11000);context.feed(121);}
  else await context.control(index,undefined,1011);
  await context.until(async()=>(await context.state()).connections.length===index+1,'replacement opens at caption boundary');
  const expectedBytes=(15+Number(original)*0.1)*48000;
  await context.until(async()=>(await context.state()).connections[index].bytes>=expectedBytes,'fixed window and live input replayed');
  const replacement=(await context.state()).connections[index];
  assert.equal(replacement.bytes,expectedBytes,'exactly 15 seconds plus live input');
  assert.deepEqual([...new Set(replacement.markers)],[...Array.from({length:13},(_,i)=>87+i),120,...Array.from({length:Number(original)},()=>121)],'fixed 15-second input window');
  await context.caption(index+1,'replacement caption');
  await context.until(()=>context.text().at(-1)==='replacement caption','replacement caption delivered');
  return {connections:index+1,answered:index,original,recovered:true};
 }
 async function winnerScenario(context) {
  await context.until(async()=>(await context.state()).connections.length===2,'first recovery opens');
  await context.until(async()=>(await context.state()).connections[1].bytes===48000,'replay caught up');
  await context.caption(2,'first sentence.');
  if(context.mode==='pause-resume')await sleep(11000);
  return context.mode==='long-recovered'?longScenario(context):replacementScenario(context);
 }
 const continuityScenarios={
  'winner-bursts':shortBurstsScenario,'original-bursts':shortBurstsScenario,
  'winner-boundary':replayBoundaryScenario,'original-boundary':replayBoundaryScenario,
  'winner-tail':trailingPlaybackScenario,'original-tail':trailingPlaybackScenario,
  'bounded-buffer':boundedBufferScenario,
  'whitespace-original':whitespaceScenario,'whitespace-side':whitespaceScenario,
  'original-stall':originalStallScenario,
 };
 async function runContinuity(mode) {
  const id=randomUUID(),key=mode+'_'+id,events=[],audio=[],expected=[];let closed=false;
  const response=await mf.dispatchFetch(`http://proxy.test/v2/realtime?case=${mode}&app_session_id=${id}&target_language=es&analytics_enabled=true&playback_enabled=true`,{headers:{Upgrade:'websocket'}});
  assert.equal(response.status,101);const ws=response.webSocket;ws.accept();sockets.push(ws);
  ws.addEventListener('message',event=>{if(typeof event.data==='string')events.push(JSON.parse(event.data));else audio.push(new Uint8Array(event.data)[0]);});
  ws.addEventListener('close',()=>{closed=true;});
  const state=async()=>await(await upstream.fetch('http://fake/state?key='+key)).json();
  const until=async(check,label,ms=16000)=>{const end=Date.now()+ms;while(!await check()&&Date.now()<end&&!closed)await sleep(25);assert.ok(await check(),mode+': '+label);};
  const control=async(index,event,close)=>{await upstream.fetch('http://fake/control?key='+key,{method:'POST',body:JSON.stringify({index,event,close})});await sleep(50);};
  const caption=(index,delta)=>control(index,{type:'session.output_transcript.delta',delta});
  const text=()=>events.filter(e=>e.kind==='translation_delta').map(e=>e.delta);
  const feed=marker=>{ws.send(new Uint8Array(4800).fill(marker).buffer);expected.push(marker);};
  try {
   await until(()=>events.some(e=>e.kind==='session_opened'),'opened');await feedInput(ws,10,false,expected);
   const silence=()=>{ws.send(new ArrayBuffer(4800));expected.push(0);};
   const playback=async marker=>{expected.push(marker);await control(1,{type:'session.output_audio.delta',delta:Buffer.alloc(4800,marker).toString('base64')});};
   const context={mode,until,state,control,caption,text,feed,silence,playback};
   const scenario=continuityScenarios[mode]??winnerScenario;
   const result=await scenario(context);
   feed(32);await until(()=>audio.length===expected.length,'original audio continues');
   assert.deepEqual(audio,expected,'all original audio exactly once');
   assert.equal(closed,false);assert.equal(events.filter(e=>e.kind==='session_opened').length,1);
   assert.equal(events.filter(e=>e.kind==='session_error'||e.kind==='session_closed').length,0);
   ws.send(JSON.stringify({kind:'close_session'}));await until(()=>closed,'client closes');
   return await assertSettlement(id,expected.length-1-(result.syntheticOutputFrames??0),await state(),{mode,...result});
  } finally {try{ws.close();}catch{}}
 }
 const selected=process.env.CAPTION_PROOF_CASES?.split(',');
 const results=await Promise.all([...continuityCases.filter(mode=>!selected||selected.includes(mode)).map(async mode=>{try{return await runContinuity(mode);}catch(error){return{mode,passed:false,error:error.message};}}),...cases.filter(s=>!selected||selected.includes(s.mode)).map(async spec=>{
  try{return await runCase({frames:10,waitMs:0,afterCaptionMs:0,muted:false,...spec});}catch(error){return{mode:spec.mode,passed:false,error:error.message};}
 })]);
 await writeFile(resolve(output,"results.json"),JSON.stringify(results,null,2)+"\n");console.log(JSON.stringify(results));
 assert.ok(results.every(r=>r.passed),"caption-only proxy proof failed");
}finally{for(const ws of sockets)try{ws.close();}catch{}await mf.dispose();clearTimeout(deadline);}
