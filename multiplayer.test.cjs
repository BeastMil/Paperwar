const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {WebSocket}=require('ws');
const {Room,cleanPlan,createBattle}=require('./multiplayer.cjs');
const plan=[{x:15,y:470,w:58.5,h:156,spacingX:9.75,angle:0,type:'rock',count:34},{x:215,y:500,w:58.5,h:156,spacingX:9.75,angle:.1,type:'scissors',count:33},{x:415,y:470,w:58.5,h:156,spacingX:9.75,angle:0,type:'paper',count:33}];
assert.equal(cleanPlan(plan).length,3);
assert.throws(()=>cleanPlan(plan.map(g=>({...g,count:100}))));
assert.throws(()=>cleanPlan(plan.map(g=>({...g,spacingX:1}))));
const battle=createBattle([plan,plan]);assert.equal(battle.agents.length,200);
assert(battle.agents.slice(0,100).every(a=>a.y>420));assert(battle.agents.slice(100).every(a=>a.y<380));
const room=new Room();room.connect({readyState:1});room.connect({readyState:1});room.ready(0,plan);room.ready(1,plan);
assert(room.pulse(0,700,400,10));assert(room.pulse(1,900,400,10));
for(const seat of [0,1])assert.deepEqual(room.snapshot(seat,10).waves.map(w=>w.team),[0,1]);
const server=spawn(process.execPath,['server.cjs'],{env:{...process.env,PORT:'0',HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
const clients=[];
function client(port){
 const ws=new WebSocket('ws://127.0.0.1:'+port+'/play');clients.push(ws);
 const messages=[],waiting=[];ws.on('message',raw=>{const msg=JSON.parse(raw);messages.push(msg);for(const entry of [...waiting])if(entry.predicate(msg)){waiting.splice(waiting.indexOf(entry),1);clearTimeout(entry.timer);entry.resolve(msg);}});
 ws.next=(predicate)=>new Promise((resolve,reject)=>{const entry={predicate,resolve,timer:setTimeout(()=>reject(Error('Message timeout')),5000)};waiting.push(entry);});
 ws.messages=messages;return ws;
}
(async()=>{
 const port=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server timeout')),5000);server.stdout.on('data',data=>{const match=data.toString().match(/listening on (\d+)/);if(match){clearTimeout(timer);resolve(Number(match[1]));}});server.once('error',reject);});
 assert.equal((await fetch('http://127.0.0.1:'+port+'/health')).status,200);
 const response=await fetch('http://127.0.0.1:'+port+'/api/rooms',{method:'POST'});const {id}=await response.json();
 const a=client(port),b=client(port);await Promise.all([a,b].map(ws=>new Promise(resolve=>ws.once('open',resolve))));
 const aj=a.next(m=>m.type==='joined'),bj=b.next(m=>m.type==='joined');a.send(JSON.stringify({type:'join',room:id}));const host=await aj;b.send(JSON.stringify({type:'join',room:id}));const guest=await bj;assert.equal(host.seat,0);assert.equal(guest.seat,1);
 const full=client(port);await new Promise(resolve=>full.once('open',resolve));const refusal=full.next(m=>m.type==='error');full.send(JSON.stringify({type:'join',room:id}));assert.match((await refusal).message,/voll/);
 const hidden=b.next(m=>m.type==='state'&&m.ready[0]);a.send(JSON.stringify({type:'ready',groups:plan}));const concealed=await hidden;assert.equal(concealed.agents,undefined);assert.equal(concealed.phase,'setup');
 const started=a.next(m=>m.type==='state'&&m.phase==='battle');b.send(JSON.stringify({type:'ready',groups:plan}));const state=await started;assert.equal(state.agents.length,200);assert.equal(state.width,1600);
 const ap=a.next(m=>m.type==='state'&&m.cooldown>0);a.send(JSON.stringify({type:'pulse',x:700,y:400}));assert((await ap).cooldown<=1.25);
 const independent=b.next(m=>m.type==='state');assert.equal((await independent).cooldown,0);
 const disconnected=a.next(m=>m.type==='state'&&!m.connected[1]);b.close();const frozen=await disconnected;const still=a.next(m=>m.type==='state'&&!m.connected[1]);assert.equal((await still).elapsed,frozen.elapsed);
 const back=client(port);await new Promise(resolve=>back.once('open',resolve));const rejoin=back.next(m=>m.type==='joined');back.send(JSON.stringify({type:'join',room:id,token:guest.token}));assert.equal((await rejoin).seat,1);
 const reset=a.next(m=>m.type==='state'&&m.phase==='setup');back.send(JSON.stringify({type:'reset'}));assert.equal((await reset).agents,undefined);
 console.log('Multiplayer passed: validation, 2 seats, private setup, authoritative battle, separate cooldowns, disconnect pause, reconnect, reset.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{for(const ws of clients)ws.terminate();server.kill();});
