(function (root) {
  'use strict';
  const TYPES = ['rock', 'scissors', 'paper'];
  const beats = {rock: 'scissors', scissors: 'paper', paper: 'rock'};
  function convert(a, b) {
    if (a.team === b.team || a.type === b.type) return false;
    const winner = beats[a.type] === b.type ? a : b;
    const loser = winner === a ? b : a;
    loser.team = winner.team; loser.type = winner.type; loser.flash = 0.28;
    return true;
  }
  function outcome(agents) {
    const red = new Set(agents.filter(a => a.team === 0).map(a => a.type));
    const blue = new Set(agents.filter(a => a.team === 1).map(a => a.type));
    if (!red.size) return 'blue';
    if (!blue.size) return 'red';
    if (red.size === 1 && blue.size === 1 && [...red][0] === [...blue][0]) return 'draw';
    return null;
  }
  class Simulation {
    constructor(counts, width = 1000, height = 560, random = Math.random) {
      this.width = width; this.height = height; this.agents = []; this.elapsed = 0; this.conversions = 0; this.result = null;
      const total = counts.flat().reduce((a, b) => a + b, 0);
      const cols = Math.ceil(Math.sqrt(total * width / height)), rows = Math.ceil(total / cols);
      const slots = Array.from({length: total}, (_, i) => i);
      for (let i = slots.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [slots[i], slots[j]] = [slots[j], slots[i]]; }
      counts.forEach((teamCounts, team) => teamCounts.forEach((count, type) => {
        for (let n = 0; n < count; n++) {
          const slot = slots.pop(), angle = random() * Math.PI * 2, speed = 48 + random() * 25;
          this.agents.push({team, type: TYPES[type], x: (slot % cols + .5) * width / cols, y: (Math.floor(slot / cols) + .5) * height / rows, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, flash: 0});
        }
      }));
      this.result = outcome(this.agents);
    }
    recordHistory(force=false){
      this.history=this.history||[];this.historyInterval=this.historyInterval||.5;
      const last=this.history.at(-1);
      const counts=[0,0,0,0,0,0];for(const a of this.agents)counts[a.team*3+TYPES.indexOf(a.type)]++;
      this.deathEvents=this.deathEvents||[];
      if(this.previousHistoryCounts)counts.forEach((count,i)=>{
        if(count===0&&this.previousHistoryCounts[i]>0){this.deathEvents.push({time:this.elapsed,team:Math.floor(i/3),type:TYPES[i%3],counts:[...counts]});force=true;}
      });
      this.previousHistoryCounts=[...counts];
      if(!force&&last&&this.elapsed-last.time<this.historyInterval)return;
      const point={time:this.elapsed,counts};
      if(last&&last.time===this.elapsed)this.history[this.history.length-1]=point;else this.history.push(point);
      if(this.history.length>600){this.history=this.history.filter((p,i)=>i%2===0||i===this.history.length-1);this.historyInterval*=2;}
    }
    pulse(x,y,now=performance.now()/1000) {
      if(this.result||!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>this.width||y>this.height||now<(this.pulseReadyAt||0))return false;
      const radius=120,strength=210;
      for(const a of this.agents){
        const dx=a.x-x,dy=a.y-y,distance=Math.hypot(dx,dy);
        if(distance>=radius)continue;
        const nx=distance?dx/distance:1,ny=distance?dy/distance:0;
        const force=strength*(1-distance/radius);
        a.vx+=nx*force;a.vy+=ny*force;
        const speed=Math.hypot(a.vx,a.vy);
        if(speed>260){a.vx*=260/speed;a.vy*=260/speed;}
      }
      this.pulseReadyAt=now+1.25;
      this.lastPulse={x,y,radius,time:this.elapsed};
      this.pulseWaves=(this.pulseWaves||[]).filter(p=>now-p.createdAt<.9);
      this.pulseWaves.push({x,y,radius,createdAt:now});
      return true;
    }
    step(dt) {
      if (this.result) return;
      if(!this.history?.length)this.recordHistory(true);
      this.elapsed += dt;
      const radius = 12;
      for (const a of this.agents) {
        const inForest=(this.terrain?.forests||[]).some(f=>Math.hypot((a.x/this.width-f.x)/f.rx,(a.y/this.height-f.y)/f.ry)<1);
        const groundSpeed=inForest?.55:1;
        a.flash = Math.max(0, a.flash - dt); a.x += a.vx * dt*groundSpeed; a.y += a.vy * dt*groundSpeed;
        for(const rock of this.terrain?.rocks||[]){
          const cx=rock.x*this.width,cy=rock.y*this.height,rx=rock.rx*this.width+radius,ry=rock.ry*this.height+radius;
          const dx=a.x-cx,dy=a.y-cy,d=Math.hypot(dx/rx,dy/ry);
          if(d>=1)continue;
          const px=d?dx/d:rx,py=d?dy/d:0;
          a.x=cx+px*1.001;a.y=cy+py*1.001;
          const length=Math.hypot(px/(rx*rx),py/(ry*ry)),nx=px/(rx*rx)/length,ny=py/(ry*ry)/length;
          const impact=a.vx*nx+a.vy*ny;
          if(impact<0){a.vx-=2*impact*nx;a.vy-=2*impact*ny;}
          this.phase='chaos';
        }
        if(this.phase==='march'&&(a.x<radius||a.x>this.width-radius||a.y<radius||a.y>this.height-radius))this.phase='chaos';
        if (a.x < radius) { a.x = radius; a.vx = Math.abs(a.vx); }
        if (a.x > this.width - radius) { a.x = this.width - radius; a.vx = -Math.abs(a.vx); }
        if (a.y < radius) { a.y = radius; a.vy = Math.abs(a.vy); }
        if (a.y > this.height - radius) { a.y = this.height - radius; a.vy = -Math.abs(a.vy); }
      }
      for (let i = 0; i < this.agents.length; i++) for (let j = i + 1; j < this.agents.length; j++) {
        const a = this.agents[i], b = this.agents[j], dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy);
        if (distance >= radius * 2) continue;
        if(this.phase==='march'&&a.team!==b.team)this.phase='chaos';
        const nx = distance ? dx / distance : 1, ny = distance ? dy / distance : 0;
        const overlap = (radius * 2 - distance) / 2 + .01;
        a.x -= nx * overlap; a.y -= ny * overlap; b.x += nx * overlap; b.y += ny * overlap;
        const relative = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (relative > 0) {
          a.vx -= relative * nx; a.vy -= relative * ny; b.vx += relative * nx; b.vy += relative * ny;
          if (convert(a, b)) this.conversions++;
        }
      }
      if(this.phase!=='march')this.result = outcome(this.agents);
      this.recordHistory(Boolean(this.result));
    }
  }
  function formation(squads, random = Math.random) {
    const sim = new Simulation([[0,0,0],[0,0,0]],1000,560,random);
    sim.random=random; sim.phase='march'; sim.result=null;
    squads.forEach((lanes,team)=>lanes.forEach((squad,lane)=>{
      for(let i=0;i<squad.count;i++) {
        const column=Math.floor(i/5), row=i%5;
        sim.agents.push({team,type:squad.type,x:team===0?390-column*28:610+column*28,y:lane*560/3+560/6+(row-2)*28,vx:team===0?65:-65,vy:0,flash:0});
      }
    }));
    return sim;
  }
  function allocate(groups,total) {
    if(groups.every(g=>Number.isInteger(g.count)))return groups.map(g=>g.count);
    const exact=groups.map(g=>g.percent*total/100), counts=exact.map(Math.floor);
    let remaining=Math.round(exact.reduce((a,b)=>a+b,0))-counts.reduce((a,b)=>a+b,0);
    const order=exact.map((n,i)=>({i,f:n-counts[i]})).sort((a,b)=>b.f-a.f);
    for(let k=0;k<remaining;k++)counts[order[k%order.length].i]++;
    return counts;
  }
  const capacity=g=>Math.floor(g.w/(g.spacingX||26)+1e-8)*Math.floor(g.h/26);
  function localPoint(g,u,v){const angle=g.angle||0,ratio=26/(g.spacingX||26),c=Math.cos(angle),s=Math.sin(angle);return {x:g.x+u*c-v*s/ratio,y:g.y+u*ratio*s+v*c};}
  const corners=g=>[[0,0],[g.w,0],[g.w,g.h],[0,g.h]].map(([u,v])=>localPoint(g,u,v));
  const inZone=g=>corners(g).every(p=>p.x>=-1e-8&&p.x<=600+1e-8&&p.y>=420-1e-8&&p.y<=800+1e-8);
  function contains(g,p){const angle=g.angle||0,ratio=26/(g.spacingX||26),dx=(p.x-g.x)*ratio,dy=p.y-g.y;const u=dx*Math.cos(angle)+dy*Math.sin(angle),v=-dx*Math.sin(angle)+dy*Math.cos(angle);return u>=0&&u<=g.w*ratio&&v>=0&&v<=g.h;}
  function overlaps(a,b){const A=corners(a),B=corners(b);for(const polygon of [A,B])for(let i=0;i<4;i++){const p=polygon[i],q=polygon[(i+1)%4],nx=-(q.y-p.y),ny=q.x-p.x;const pa=A.map(v=>v.x*nx+v.y*ny),pb=B.map(v=>v.x*nx+v.y*ny);if(Math.max(...pa)<=Math.min(...pb)+1e-8||Math.max(...pb)<=Math.min(...pa)+1e-8)return false;}return true;}
  function validatePlan(groups,total) {
    if(!Number.isInteger(total)||total<10||total>150)return 'Wähle 10 bis 150 Truppen.';
    if(!groups.length)return 'Ziehe zuerst ein Rechteck auf deiner unteren Hälfte auf.';
    if(groups.every(g=>Number.isInteger(g.count))){
      if(groups.length!==3)return 'Es gibt genau drei Geschwader.';
      if(groups.some(g=>g.count<1||g.count>capacity(g)))return 'Die Formation braucht genügend Platz für ihre Truppen.';
      if(groups.reduce((n,g)=>n+g.count,0)!==total)return 'Verteile alle freien Truppen durch Vergrößern deiner Geschwader.';
    }else{
    if(groups.some(g=>!TYPES.includes(g.type)||!Number.isInteger(g.percent)||g.percent<1||g.percent>100))return 'Jedes Geschwader braucht 1 bis 100 %.';
    if(groups.reduce((n,g)=>n+g.percent,0)!==100)return 'Verteile genau 100 % deiner Truppen, bevor du startest.';
    }
    const counts=allocate(groups,total);
    for(let i=0;i<groups.length;i++){
      const g=groups[i];
      if(![g.x,g.y,g.w,g.h].every(Number.isFinite)||!inZone(g)||g.w<(g.spacingX||26)||g.h<26)return 'Rechtecke müssen vollständig auf deiner unteren Hälfte liegen.';
      if(counts[i]===0)return `Geschwader ${i+1} erhält keine Truppe. Erhöhe seinen Anteil.`;
      if(counts[i]>capacity(g))return `Geschwader ${i+1}: Rechteck vergrößern (${counts[i]} Truppen, Platz für ${capacity(g)}).`;
      if(groups.slice(i+1).some(b=>overlaps(g,b)))return 'Deine Geschwader dürfen sich nicht überlappen.';
    }
    return '';
  }
  function computerPlan(random=Math.random,total=150,ratio=1){
    const integer=(lo,hi)=>lo+Math.floor(random()*(hi-lo+1));
    const first=integer(20,40),second=integer(Math.max(20,60-first),Math.min(40,80-first));
    const percentages=[first,second,100-first-second],types=[...TYPES];
    for(let i=2;i>0;i--){const j=integer(0,i);[types[i],types[j]]=[types[j],types[i]];const k=integer(0,i);[percentages[i],percentages[k]]=[percentages[k],percentages[i]];}
    const counts=allocate(percentages.map(percent=>({percent})),total),spacing=26/ratio;
    return percentages.map((percent,i)=>{
      const maxCols=Math.max(1,Math.min(counts[i],Math.floor(180/spacing))),minCols=Math.min(maxCols,Math.max(1,Math.ceil(counts[i]/11),Math.floor(maxCols*.5)));
      const cols=integer(minCols,maxCols),g={x:0,y:0,w:cols*spacing,h:Math.ceil(counts[i]/cols)*26,spacingX:spacing,angle:(random()-.5)*.36,type:types[i],percent};
      let points=corners(g),bounds=()=>({left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))}),b=bounds();
      for(let n=0;n<12&&(b.right-b.left>184||b.bottom-b.top>350);n++){g.angle*=.5;points=corners(g);b=bounds();}
      g.x=i*200+8+random()*Math.max(0,184-(b.right-b.left))-b.left;
      g.y=12+random()*Math.max(0,350-(b.bottom-b.top))-b.top;
      return g;
    });
  }
  function verticalFormation(player,computer,total,random=Math.random){
    const sim=new Simulation([[0,0,0],[0,0,0]],600,800,random);
    sim.random=random;sim.vertical=true;sim.phase='march';sim.result=null;
    [player,computer].forEach((groups,team)=>{
      const counts=allocate(groups,total);
      groups.forEach((g,index)=>{
        const cols=Math.floor(g.w/(g.spacingX||26)+1e-8),rows=Math.floor(g.h/26),count=Math.min(counts[index],capacity(g));
        for(let i=0;i<count;i++){
          const col=i%cols,row=Math.floor(i/cols),rowCount=Math.min(cols,count-row*cols);
          const p=localPoint(g,g.w/2+(col-(rowCount-1)/2)*(g.spacingX||26),team===0?13+row*26:g.h-13-row*26),angle=g.angle||0;
          sim.agents.push({team,type:g.type,...p,vx:(team===0?65:-65)*Math.sin(angle),vy:(team===0?-65:65)*Math.cos(angle),flash:0});
        }
      });
    });
    return sim;
  }
  function frontFormation(group,start,end){
    const spacing=group.spacingX||26,ratio=26/spacing;
    const dx=(end.x-start.x)*ratio,dy=end.y-start.y,length=Math.hypot(dx,dy);
    const cols=Math.max(1,Math.min(group.count,Math.floor(length/26)));
    return {...group,w:Math.max(26,length)/ratio,h:Math.ceil(group.count/cols)*26,x:start.x,y:start.y,angle:Math.atan2(dy,dx)};
  }

  function battleViewport(width,height){
    const scale=Math.max(1e-6,Math.min(width/1600,height/800));
    return {scale,left:(width-1600*scale)/2,top:(height-800*scale)/2};
  }
  function fitBattle(sim,aspect){
    const width=sim.height*aspect,ratio=width/sim.width;
    for(const a of sim.agents)a.x*=ratio;
    sim.width=width;
  }
  function generateTerrain(random=Math.random){
    const forests=[{x:.2+random()*.1,y:.25,rx:.12,ry:.13},{x:.65+random()*.1,y:.72,rx:.14,ry:.12},{x:.72,y:.28,rx:.09,ry:.09}];
    const rocks=[.22,.49,.77].map(x=>({x:x+(random()-.5)*.04,y:.50,rx:.018+random()*.009,ry:.017}));
    const trees=[];forests.forEach(f=>{for(let i=0;i<42;i++){const a=random()*Math.PI*2,r=Math.sqrt(random())*.9;trees.push({x:f.x+Math.cos(a)*f.rx*r,y:f.y+Math.sin(a)*f.ry*r,size:.007+random()*.006});}});
    const patches=Array.from({length:40},()=>({x:random(),y:random(),rx:.03+random()*.13,ry:.03+random()*.12,light:random()>.5}));
    return {forests,rocks,trees,patches};
  }
  const api = {Simulation, generateTerrain, formation, verticalFormation, battleViewport, fitBattle, frontFormation, localPoint, corners, inZone, contains, computerPlan, allocate, capacity, overlaps, validatePlan, convert, outcome, TYPES};
  if (typeof module !== 'undefined') module.exports = api;
  else root.Rival = api;
})(typeof window !== 'undefined' ? window : this);


