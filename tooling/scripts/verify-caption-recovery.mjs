import assert from "node:assert/strict";
import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import { randomUUID } from "node:crypto";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(realpathSync(resolve(root, "apps/worker/node_modules/wrangler/package.json")));
import { build } from "esbuild";
const { unstable_splitSqlQuery: splitSqlQuery } = require("wrangler");
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
const output = resolve(root, "artifacts/caption-recovery");
await mkdir(output, { recursive: true });
const bundled = await build({
  entryPoints: [resolve(root, "apps/worker/caption-recovery-probe.ts")],
  bundle: true, write: false, format: "esm", platform: "neutral",
  conditions: ["workerd", "worker", "browser"], external: ["node:*", "cloudflare:*"],
});
const captionSentinel = "SYNTHETIC_PRIVATE_TRANSCRIPT_CAPTION_RETRY";
const provider = `
const states = new Map();
export default { async fetch(request) {
 const url = new URL(request.url);
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
 const connection = {index,bytes:0,chunks:0,closed:false,config:null};state.connections.push(connection);
 const pair = new WebSocketPair(), socket=pair[1];socket.accept();
 const timers=[];let sentCaption=false,started=false;
 const send = value => {try{socket.send(JSON.stringify(value));}catch{}};
 const caption = tag => send({type:'session.output_transcript.delta',delta:'${captionSentinel}_'+tag});
 socket.addEventListener('message',event=>{
   const data=JSON.parse(event.data);
   if(data.type==='session.update') {connection.config=data.session;send({type:'session.updated',session:{audio:data.session.audio}});}
   if(data.type!=='session.input_audio_buffer.append') return;
   const raw=atob(data.audio), marker=raw.charCodeAt(0);
   connection.bytes+=raw.length;connection.chunks++;
   if(!(index>1 && ['silent','cap','continuous'].includes(mode))) {
     const bytes=index>1 ? (mode==='shorter'?2400:mode==='longer'?7200:4800) : 4800;
     send({type:'session.output_audio.delta',delta:btoa(String.fromCharCode(marker,16).repeat(bytes/2))});
   }
   if(!started) {
     started=true;
     if(index===1 && mode==='healthy')timers.push(setTimeout(()=>caption('original'),2500));
     if(index===1 && mode==='original-wins') {timers.push(setTimeout(()=>caption('original'),11000));timers.push(setTimeout(()=>caption('continued'),14000));}
     if(index===1 && mode==='recovery-wins')timers.push(setTimeout(()=>caption('late-original'),12000));
     if(index===2 && mode==='original-wins')timers.push(setTimeout(()=>caption('late-side'),3000));
   }
   if(!sentCaption && connection.bytes>=48000 && (index===2 && ['shorter','longer','mute','recovery-wins'].includes(mode) || index===3 && mode==='silent')) {sentCaption=true;caption('recovered');}
 });
 socket.addEventListener('close',()=>{connection.closed=true;for(const t of timers)clearTimeout(t);try{socket.close(1000);}catch{}});
 return new Response(null,{status:101,webSocket:pair[0]});
}};
`;
const mf = new Miniflare(convertV4MiniflareOptions({
  workers: [{
    name: "proxy", modules: true, script: bundled.outputFiles[0].text,
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
  {mode:"continuous",connections:3,recovered:false,tags:[],frames:310,waitMs:6000},
  {mode:"cap",connections:3,recovered:false,tags:[],waitMs:25000},
  {mode:"original-wins",connections:2,recovered:false,tags:["original","continued"],original:true,afterCaptionMs:4000},
  {mode:"recovery-wins",connections:2,recovered:true,tags:["recovered"],original:true,afterCaptionMs:4000},
  {mode:"healthy",connections:1,recovered:false,tags:["original"],original:true},
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
  assert.equal(ended.properties.caption_recovery_with_transcript,spec.recovered?1:0);
  assert.equal(ended.properties.caption_recovery_input_bytes,state.connections.slice(1).reduce((sum,c)=>sum+c.bytes,0));
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
 const selected=process.env.CAPTION_PROOF_CASES?.split(',');
 const results=await Promise.all(cases.filter(s=>!selected||selected.includes(s.mode)).map(async spec=>{
  try{return await runCase({frames:10,waitMs:0,afterCaptionMs:0,muted:false,...spec});}catch(error){return{mode:spec.mode,passed:false,error:error.message};}
 }));
 await writeFile(resolve(output,"results.json"),JSON.stringify(results,null,2)+"\n");console.log(JSON.stringify(results));
 assert.ok(results.every(r=>r.passed),"caption-only proxy proof failed");
}finally{for(const ws of sockets)try{ws.close();}catch{}await mf.dispose();clearTimeout(deadline);}
