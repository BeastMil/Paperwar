const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {WebSocketServer}=require('ws');const {Room}=require('./multiplayer.cjs');
const files={'/':'index.html','/index.html':'index.html','/style.css':'style.css','/app.js':'app.js','/simulation.js':'simulation.js','/network.js':'network.js'};
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
const rooms=new Map();
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/health'){res.writeHead(200);res.end('ok');return;}
 if(url.pathname==='/api/rooms'&&req.method==='POST'){
  if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host){res.writeHead(403);res.end();return;}
  if(rooms.size>=50){res.writeHead(503);res.end('Server voll. Bitte später versuchen.');return;}
  const room=new Room();rooms.set(room.id,room);res.writeHead(201,{'Content-Type':'application/json'});res.end(JSON.stringify({id:room.id}));return;
 }
 const file=files[url.pathname];if(!file){res.writeHead(404);res.end('Not found');return;}
 res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});fs.createReadStream(path.join(__dirname,file)).pipe(res);
});
const wss=new WebSocketServer({server,path:'/play',maxPayload:8192,perMessageDeflate:false});
wss.on('connection',(ws,req)=>{
 if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host){ws.close(1008);return;}}catch{ws.close(1008);return;}}
 let room=null,seat=-1,budget=0,windowStart=Date.now();ws.alive=true;ws.on('pong',()=>ws.alive=true);
 const send=data=>{if(ws.readyState===1)ws.send(JSON.stringify(data));};
 const joinDeadline=setTimeout(()=>{if(!room)ws.close(1008);},10000);
 ws.on('message',raw=>{
  if(Date.now()-windowStart>1000){windowStart=Date.now();budget=0;}if(++budget>40){ws.close(1008);return;}
  try{
   const msg=JSON.parse(raw.toString());
   if(msg.type==='join'&&!room){const candidate=rooms.get(msg.room);if(!candidate)throw Error('Raum nicht gefunden oder abgelaufen. Erstelle einen neuen Raum.');const joined=candidate.connect(ws,msg.token);room=candidate;seat=joined.seat;clearTimeout(joinDeadline);send({type:'joined',room:room.id,...joined});send(room.snapshot(seat,performance.now()/1000));return;}
   if(!room)throw Error('Bitte zuerst einem Raum beitreten.');room.updated=Date.now();
   if(msg.type==='configure')room.configure(seat,msg.settings);
   else if(msg.type==='ready')room.ready(seat,msg.groups);
   else if(msg.type==='unready'&&room.phase==='setup')room.seats[seat].plan=null;
   else if(msg.type==='surrender')room.surrender(seat);
   else if(msg.type==='reset')room.returnToSetup(seat);
   else if(msg.type==='pulse')room.pulse(seat,msg.x,msg.y,performance.now()/1000);
  }catch(error){send({type:'error',message:error.message||'Ungültige Anfrage.'});}
 });
 ws.on('error',()=>{});ws.on('close',()=>{clearTimeout(joinDeadline);if(room?.seats[seat]?.socket===ws){room.seats[seat].socket=null;room.seats[seat].absentAt=Date.now();}});
});
let last=performance.now(),acc=0,lastBroadcast=0;
const timer=setInterval(()=>{
 const now=performance.now(),dt=Math.min((now-last)/1000,.1);acc+=dt*.5;last=now;
 for(const r of rooms.values())r.advanceCountdown(dt);
 while(acc>=1/120){for(const r of rooms.values())if(r.phase==='battle'&&r.connected()&&r.countdown<=0&&!r.sim.result){r.stepAccumulator+=r.settings.speed/120;while(r.stepAccumulator>=1/120&&!r.sim.result){r.sim.step(1/120);r.stepAccumulator-=1/120;}}acc-=1/120;}
 if(now-lastBroadcast<50)return;lastBroadcast=now;
 for(const r of rooms.values())for(let seat=0;seat<2;seat++){const ws=r.seats[seat]?.socket;if(ws?.readyState===1&&ws.bufferedAmount<200000)ws.send(JSON.stringify(r.snapshot(seat,now/1000)));}
},1000/60);
const housekeeping=setInterval(()=>{
 for(const ws of wss.clients){if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}
 for(const [id,r]of rooms){
  for(let i=0;i<2;i++)if(r.seats[i]?.absentAt&&Date.now()-r.seats[i].absentAt>60000){r.seats[i]=null;r.reset();}
  if(!r.seats.some(s=>s?.socket)&&Date.now()-r.updated>120000)rooms.delete(id);
 }
},15000);
server.listen(Number(process.env.PORT??4173),process.env.HOST||'0.0.0.0',()=>console.log('Rival listening on '+server.address().port));
function stop(){clearInterval(timer);clearInterval(housekeeping);wss.clients.forEach(ws=>ws.close(1001));server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),2000).unref();}
process.on('SIGTERM',stop);process.on('SIGINT',stop);

