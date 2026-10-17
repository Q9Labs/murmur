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
const provider = `
const states = new Map();
export default { async fetch(request) {
 const url = new URL(request.url);
 if (url.pathname === '/state') return Response.json(states.get(url.searchParams.get('key')) ?? {});
 if (url.hostname !== 'api.openai.com') {
   if(url.pathname.includes('flags')) return Response.json({flags:{}});
   const body = await request.json();
   const key = body.properties?.app_session_id;
   if(key) {
     const state = states.get(key) ?? {events:[]};
     state.events.push(body);states.set(key,state);
   }
   return Response.json({});
 }
 const key = request.headers.get('OpenAI-Safety-Identifier');
 const state = states.get(key) ?? {connections:[],events:[]};states.set(key,state);
 const index = state.connections.length + 1;
 const connection = {index,bytes:0,chunks:0,closed:false,config:null};state.connections.push(connection);
 const pair = new WebSocketPair();const socket=pair[1];socket.accept();
 let interval; let captionTimer; let sentCaption=false;
 const send = value => {try{socket.send(JSON.stringify(value));}catch{clearInterval(interval);}};
 const caption = () => { if(!sentCaption){sentCaption=true;send({type:'session.output_transcript.delta',delta:'Recovered caption'});} };
 socket.addEventListener('message',event=>{
   const data=JSON.parse(event.data);
   if(data.type==='session.update') {
     connection.config=data.session;
     send({type:'session.updated',session:{audio:data.session.audio}});
   }
   if(data.type==='session.input_audio_buffer.append') {
     connection.bytes+=atob(data.audio).length;connection.chunks++;
     send({type:'session.output_audio.delta',delta:btoa(String.fromCharCode(index,0))});
     interval ??= setInterval(()=>send({type:'session.output_audio.delta',delta:btoa(String.fromCharCode(index,0))}),40);
     if(key.startsWith('recover_') && index===2 && connection.bytes>=48000) caption();
     if(key.startsWith('healthy_')) captionTimer ??= setTimeout(caption,1500);
   }
 });
 socket.addEventListener('close',()=>{connection.closed=true;clearInterval(interval);clearTimeout(captionTimer);socket.close(1000);});
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
const deadline = setTimeout(() => { console.error("caption proof exceeded 60s"); process.exit(2); }, 60_000);
const sockets=[];
try {
  const database = await mf.getD1Database("BILLING_DB", "proxy");
  const migrations = resolve(root, "apps/worker/migrations");
  for(const name of (await readdir(migrations)).sort()) {
    if(name.endsWith(".sql")) {
      const sql=await readFile(resolve(migrations,name),"utf8");
      await database.batch(splitSqlQuery(sql).map(s=>database.prepare(s)));
    }
  }
  const upstream = await mf.getWorker("provider");
  const results=[];
  for(const mode of ["recover", "cap", "healthy"]) {
    const id=randomUUID();const key=mode+"_"+id;
    const response=await mf.dispatchFetch(`http://proxy.test/v2/realtime?case=${mode}&app_session_id=${id}&target_language=es&analytics_enabled=true`,{headers:{Upgrade:"websocket"}});
    assert.equal(response.status,101,await response.text());
    const ws=response.webSocket;assert.ok(ws);sockets.push(ws);ws.accept();
    const events=[];const audio=[];let clientClosed=false;
    ws.addEventListener("message",event=>{
      if(typeof event.data==='string')events.push(JSON.parse(event.data));
      else audio.push(new Uint8Array(event.data)[0]);
    });
    ws.addEventListener("close",()=>{clientClosed=true;});
    const until=async(predicate,label,ms=12000)=>{
      const end=Date.now()+ms;
      while(!predicate()&&Date.now()<end&&!clientClosed)await sleep(25);
      assert.ok(predicate(),`${mode}: ${label}; events=${JSON.stringify(events)}`);
    };
    await until(()=>events.some(e=>e.kind==='session_opened'),"session opens");
    for(let i=0;i<10;i++){ws.send(new Uint8Array(4800).fill(16).buffer);await sleep(100);}
    if(mode==='cap') await sleep(7000);
    else await until(()=>events.some(e=>e.kind==='translation_delta'),"caption recovers");
    assert.equal(clientClosed,false,"retry must not close the client");
    assert.equal(events.filter(e=>e.kind==='session_opened').length,1);
    assert.equal(events.filter(e=>e.kind==='session_closed'||e.kind==='session_error').length,0);
    const state=await (await upstream.fetch(`http://fake/state?key=${key}`)).json();
    assert.equal(state.connections.length,mode==='healthy'?1:mode==='cap'?3:2);
    if(mode==='recover') {
      assert.equal(state.connections[1].bytes,48000,"all buffered audio replayed once");
      assert.deepEqual(state.connections[0].config,state.connections[1].config);
      assert.ok(state.connections[0].closed,"old upstream closed cleanly");
      assert.ok(audio.includes(2));
      assert.ok(!audio.slice(audio.indexOf(2)).includes(1),"stale audio cannot leak after switch");
    }
    // Real input after recovery/cap must still flow, and must be charged only once.
    ws.send(new Uint8Array(4800).fill(32).buffer);
    await until(()=>events.filter(e=>e.kind==='input_audio_ack').length===11,"live input continues");
    await sleep(100);
    ws.send(JSON.stringify({kind:"close_session"}));
    await until(()=>clientClosed,"client closes on its own command");
    let usage;
    for(let i=0;i<80;i++) {
      usage=await database.prepare("SELECT state, settled_ms FROM usage_sessions WHERE usage_session_id = ?").bind(id).first();
      if(usage?.state==='closed')break;await sleep(25);
    }
    assert.equal(usage?.state,"closed");
    assert.equal(usage?.settled_ms,1100,"replayed audio must not consume allowance");
    const telemetry=await (await upstream.fetch(`http://fake/state?key=${id}`)).json();
    const ended=telemetry.events.find(e=>e.event==='worker_session_ended');
    assert.ok(ended,"session-ended telemetry delivered");
    assert.equal(ended.properties.caption_retry_count,mode==='healthy'?0:mode==='cap'?2:1);
    assert.equal(ended.properties.captions_recovered,mode==='recover');
    assert.equal(ended.properties.input_audio_bytes,52800);
    assert.equal(ended.properties.transport_close_source,null,"deliberate retired socket close is not a failure");
    results.push({mode,connections:state.connections.length,billedMs:usage.settled_ms,retries:ended.properties.caption_retry_count,recovered:ended.properties.captions_recovered});
  }
  await writeFile(resolve(output,"results.json"),JSON.stringify(results,null,2)+"\n");
  console.log(JSON.stringify(results));
} finally {
  for(const ws of sockets)try{ws.close();}catch{}
  await mf.dispose();clearTimeout(deadline);
}
