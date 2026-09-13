'use strict';
const $=id=>document.getElementById(id),canvas=$('arena'),ctx=canvas.getContext('2d');
const net=window.Multiplayer;
let cursorInside=false,networkApplying=false,networkSignature='';
const ownTeam=()=>net.active?net.seat:0, teamColor=t=>t===0?'#f27f76':'#78b1ff', teamName=t=>t===0?'Rot':'Blau';
const teamLabels=()=>[0,1].map(t=>(t===ownTeam()?'Du':net.active?'Freund':'PC')+' · '+teamName(t));
const symbols={rock:'⬡ Stein',scissors:'✂ Schere',paper:'▤ Papier'};
let groups=[{x:15,y:470,w:156,h:156,type:'rock',count:34},{x:215,y:500,w:156,h:156,type:'scissors',count:33},{x:415,y:470,w:156,h:156,type:'paper',count:33}];
let computer=Rival.computerPlan(),selected=0,total=100,planning=true,sim,paused=false,last=performance.now(),accumulator=0,lastStats=0,gesture=null,frontMode=false;
function compact(list){
 const ratio=net.active?1600/600:Math.max(.2,canvas.clientWidth/canvas.clientHeight*800/600),spacing=26/ratio;
 for(const g of list){if(Math.abs((g.spacingX||0)-spacing)<1e-8)continue;const cols=Math.max(1,Math.floor(g.w/(g.spacingX||26)+1e-8));g.spacingX=spacing;g.w=Math.min(600,cols*spacing);g.x=Math.min(g.x,600-g.w);}
}
function rebuild(){compact(groups);compact(computer);sim=Rival.verticalFormation(groups,computer,total);renderSetup();updateStats();}
function renderSetup(){
 $('setup-panel').hidden=!planning;$('combat-panel').hidden=planning;
 $('combat-speed').value=$('speed').value;$('combat-speed-out').textContent=$('speed').value+'×';
 const used=groups.reduce((n,g)=>n+g.count,0),sum=used/total*100,numbers=Rival.allocate(groups,total),g=groups[selected];
 $('army-total').textContent=used+' / '+total+' Truppen';$('reserve').textContent=(total-used)+' freie Truppen · '+(100-sum).toFixed(1)+' %';
 $('squad-list').replaceChildren();groups.forEach((g,i)=>{const b=document.createElement('button');b.type='button';b.className='squad-row'+(i===selected?' active':'');b.textContent=(i+1)+'. '+symbols[g.type]+' · '+(g.count/total*100).toFixed(1)+' % · '+numbers[i]+' Truppen';b.disabled=!planning;b.onclick=()=>{selected=i;renderSetup();};$('squad-list').append(b);});
 $('selected-lane').textContent=g?'GESCHWADER '+(selected+1):'NEUES RECHTECK AUFZIEHEN';
 $('troop-type').value=g?.type||'rock';$('troop-count').value=(g.count/total*100).toFixed(1);
 $('actual-count').textContent=numbers[selected]+' Truppen · '+(g.count/total*100).toFixed(1)+' % · '+Math.floor(g.w/(g.spacingX||26)+1e-8)+' breit × '+Math.ceil(g.count/Math.floor(g.w/(g.spacingX||26)+1e-8))+' tief · '+Math.round((g.angle||0)*180/Math.PI)+'°';
 for(const id of ['troop-type','troop-count'])$(id).disabled=!planning||!g;
 for(const id of ['army-size','place-front'])$(id).disabled=!planning;
 $('battle').disabled=!planning;$('reset').disabled=planning;
 $('error').textContent=planning?Rival.validatePlan(groups,total):'';
 if(net.active){$('army-size').disabled=true;$('speed').disabled=true;$('combat-speed').disabled=true;$('battle').textContent=net.ready?'Bereitschaft zurücknehmen':'Bereit für die Schlacht';$('battle').disabled=!planning||!net.joined;for(const id of ['troop-type','troop-count','place-front'])$(id).disabled=!planning||net.ready;for(const b of $('squad-list').children)b.disabled=!planning||net.ready;}
}
function prepare(){if(net.active&&!networkApplying){net.send({type:'reset'});return;}planning=true;paused=false;gesture=null;accumulator=0;$('result').hidden=true;rebuild();}
function startBattle(e){e.preventDefault();if(!planning)return;const error=Rival.validatePlan(groups,total);if(error){$('error').textContent=error;return;}if(net.active){if(net.ready){net.send({type:'unready'});return;}sessionStorage.setItem('rival-plan-'+net.room,JSON.stringify(groups));net.send({type:'ready',groups});return;}computer=Rival.computerPlan();compact(computer);sim=Rival.verticalFormation(groups,computer,total);Rival.fitBattle(sim,canvas.clientWidth/canvas.clientHeight);planning=false;paused=false;accumulator=0;last=performance.now();renderSetup();updateStats();}
function point(e){const r=canvas.getBoundingClientRect();return {x:Math.max(0,Math.min(600,(e.clientX-r.left)*600/r.width)),y:Math.max(420,Math.min(800,(e.clientY-r.top)*800/r.height))};}
function followCursor(e){cursorInside=true;$('impulse-cursor').style.left=e.clientX+'px';$('impulse-cursor').style.top=e.clientY+'px';}
canvas.addEventListener('pointerenter',followCursor);canvas.addEventListener('pointermove',followCursor);canvas.addEventListener('pointerleave',()=>{cursorInside=false;});
canvas.addEventListener('pointerdown',e=>{
 followCursor(e);
 if(!planning){
  if(e.button!==0||paused||sim.result)return;
  const r=canvas.getBoundingClientRect(),scale=Math.min(r.width/sim.width,r.height/sim.height);
  const x=(e.clientX-r.left-(r.width-sim.width*scale)/2)/scale,y=(e.clientY-r.top-(r.height-sim.height*scale)/2)/scale;
  if(net.active){net.send({type:'pulse',x:net.seat?sim.width-x:x,y:net.seat?sim.height-y:y});return;}
  if(sim.pulse(x,y)){e.preventDefault();updateStats();}return;
 }
 if(e.button!==0||(net.active&&net.ready))return;const r=canvas.getBoundingClientRect();if((e.clientY-r.top)*800/r.height<420)return;
 const p=point(e);const hit=groups.findIndex(g=>Rival.contains(g,p));
 if(hit>=0&&!frontMode){selected=hit;const g=groups[hit];gesture={mode:'move',start:p,original:{...g}};renderSetup();}
 else {gesture={mode:'front',start:p,original:{...groups[selected]}};}
 canvas.setPointerCapture(e.pointerId);e.preventDefault();
});
canvas.addEventListener('pointermove',e=>{
 if(!gesture)return;const p=point(e),s=gesture.start,o=gesture.original;
 let g={...o};
 if(gesture.mode==='move'){g.x=o.x+p.x-s.x;g.y=o.y+p.y-s.y;if(!Rival.inZone(g))return;}
 else{g=Rival.frontFormation(o,s,p);if(!Rival.inZone(g)){$('error').textContent='Diese Front ist zu schmal oder liegt zu nah am Rand. Ziehe breiter oder beginne weiter oben.';return;}}
 const usedElsewhere=groups.reduce((n,b,i)=>n+(i===selected?0:b.count),0);
 if(g.count+usedElsewhere>total){$('error').textContent='Nicht genügend freie Truppen. Ziehe zuerst ein anderes Geschwader kleiner.';return;}
 if(groups.some((b,i)=>i!==selected&&Rival.overlaps(g,b))){$('error').textContent='Hier steht bereits ein anderes Geschwader.';return;}
 groups[selected]=g;rebuild();
});
function endGesture(e,cancel=false){if(!gesture)return;if(cancel)groups[selected]=gesture.original;gesture=null;rebuild();}
canvas.addEventListener('pointerup',e=>endGesture(e));canvas.addEventListener('pointercancel',e=>endGesture(e,true));
function sizeGroup(index,count){
 const original=groups[index],cols=Math.min(count,Math.max(1,Math.floor(original.w/(original.spacingX||26)+1e-8))),w=cols*(original.spacingX||26),h=Math.ceil(count/cols)*26;
 const candidate={...original,count,w,h,x:Math.min(original.x,600-w),y:Math.min(original.y,800-h)};
 const fits=g=>Rival.inZone(g)&&!groups.some((b,i)=>i!==index&&Rival.overlaps(g,b));
 if(!fits(candidate)){
  const slots=[];for(let y=420;y<=800-h;y+=5)for(let x=0;x<=600-w;x+=5)slots.push({x,y});
  slots.sort((a,b)=>Math.hypot(a.x-original.x,a.y-original.y)-Math.hypot(b.x-original.x,b.y-original.y));
  const slot=slots.find(p=>fits({...candidate,...p}));if(!slot)return false;Object.assign(candidate,slot);
 }
 groups[index]=candidate;return true;
}
$('troop-count').addEventListener('input',()=>{
 const available=total-groups.reduce((n,g,i)=>n+(i===selected?0:g.count),0);
 const requested=Math.max(1,Math.round(total*Number($('troop-count').value)/100));
 const count=Math.min(available,requested);
 if(!sizeGroup(selected,count)){renderSetup();$('error').textContent='Für diese Formation fehlt Platz. Verschiebe ein Geschwader.';return;}
 rebuild();if(requested>available)$('error').textContent='Keine freien Truppen. Reduziere zuerst den Anteil eines anderen Geschwaders.';
});
$('army-size').addEventListener('change',()=>{
 const n=Number($('army-size').value);if(!Number.isInteger(n)||n<10||n>150){$('army-size').value=total;return;}
 const old=groups.map(g=>({...g})),oldTotal=total;
 const counts=Rival.allocate(groups.map(g=>({percent:g.count/total*100})),n);
 total=n;groups=groups.map((g,i)=>({...g,count:Math.max(1,counts[i]),w:26,h:26}));
 for(let i=0;i<3;i++)if(!sizeGroup(i,groups[i].count)){groups=old;total=oldTotal;$('army-size').value=total;break;}
 rebuild();
});
$('troop-type').addEventListener('change',()=>{groups[selected].type=$('troop-type').value;rebuild();});
$('place-front').onclick=()=>{frontMode=!frontMode;$('place-front').textContent=frontMode?'↔ Frontmodus aktiv · Ausschalten':'↔ Frontmodus einschalten';$('place-front').setAttribute('aria-pressed',String(frontMode));};
$('settings').addEventListener('submit',startBattle);$('reset').onclick=prepare;$('again').onclick=prepare;
$('return-plan').onclick=prepare;
$('combat-speed').oninput=()=>{$('speed').value=$('combat-speed').value;$('speed-out').textContent=$('speed').value+'×';$('combat-speed-out').textContent=$('speed').value+'×';};
$('pause').onclick=()=>{paused=!paused;accumulator=0;updateStats();};
$('speed').oninput=()=>{$('speed-out').textContent=$('speed').value+'×';};
document.addEventListener('visibilitychange',()=>{last=performance.now();accumulator=0;});
function updateStats() {
 const labels=teamLabels();$('red-heading').textContent=labels[0];$('opponent-heading').textContent=labels[1];
 $('opponent-setup').textContent=labels[1-ownTeam()]+' · obere Hälfte';$('opponent-setup').style.color=teamColor(1-ownTeam());
 const cooldown=Math.max(0,(sim.pulseReadyAt||0)-performance.now()/1000);
 $('pulse-status').textContent=planning?'Impuls · im Gefecht':sim.result?'Impuls · Runde beendet':paused?'Impuls · pausiert':cooldown>0?'Impuls · '+cooldown.toFixed(1)+' s':'✦ Impuls bereit · klicken';
 $('pulse-status').classList.toggle('ready',!planning&&!paused&&!sim.result&&cooldown===0);
 $('pulse-status').title='Klick stößt beide Teams im Umkreis weg. 1,25 reale Sekunden Cooldown.';
  const c = [[0,0,0],[0,0,0]];
  for (const a of sim.agents) c[planning&&ownTeam()===1?1-a.team:a.team][Rival.TYPES.indexOf(a.type)]++;
  const totals = c.map(t => t.reduce((a,b) => a+b,0));
  if(!planning){
    $('combat-teams').replaceChildren();
    teamLabels().forEach((name,i)=>{
      const card=document.createElement('section');card.className='army-card '+(i===0?'player-card':'enemy-card');
      const heading=document.createElement('h3');heading.textContent=name;
      const number=document.createElement('strong');number.className='army-number';number.textContent=totals[i];
      const share=document.createElement('span');share.className='army-share';share.textContent=Math.round(totals[i]/sim.agents.length*100)+' % des Feldes';
      card.append(heading,number,share);
      ['⬡ Stein','✂ Schere','▤ Papier'].forEach((label,j)=>{
        const row=document.createElement('div');row.className='type-row';
        const text=document.createElement('span');text.textContent=label;const value=document.createElement('b');value.textContent=c[i][j];
        const bar=document.createElement('progress');bar.max=sim.agents.length;bar.value=c[i][j];bar.setAttribute('aria-label',name+' '+label);row.append(text,value,bar);card.append(row);
      });$('combat-teams').append(card);
    });$('combat-conversions').textContent=sim.conversions;
  }
  ['red','blue'].forEach((team,i) => {
    $(team+'-count').textContent = totals[i];
    $(team+'-types').textContent = planning && i!==ownTeam() ? 'Aufstellung verborgen' : `⬡ ${c[i][0]}  ✂ ${c[i][1]}  ▤ ${c[i][2]}`;
    $(team+'-percent').textContent = Math.round(totals[i] / Math.max(1,sim.agents.length) * 100) + ' %';
  });
  $('red-bar').style.width = totals[0] / Math.max(1,sim.agents.length) * 100 + '%';
  $('conversions').textContent = sim.conversions;
  $('time').textContent = `${Math.floor(sim.elapsed/60).toString().padStart(2,'0')}:${Math.floor(sim.elapsed%60).toString().padStart(2,'0')}`;
  $('pause').textContent = paused ? '▶ Weiter' : 'Ⅱ Pause';
  $('pause').setAttribute('aria-label', paused ? 'Simulation fortsetzen' : 'Simulation pausieren');
  $('pause').disabled = net.active || planning || Boolean(sim.result);
  $('status').textContent = planning ? 'Aufstellung · Drei Geschwader frei platzieren' : sim.result ? 'Runde beendet' : paused ? 'Simulation pausiert' : sim.phase === 'march' ? 'Vormarsch · Fronten nähern sich' : 'Chaos · Jeder Kontakt zählt';
  $('status-dot').style.background = paused || sim.result ? '#899180' : '#d0ed8a';
  if (sim.result) {
    $('result').hidden = false;
    $('result-title').textContent = sim.result === 'draw' ? 'Unentschieden.' : `Team ${sim.result === 'red' ? 'Rot' : 'Blau'} gewinnt.`;
    $('result-title').style.color = sim.result === 'draw' ? '#d0ed8a' : sim.result === 'red' ? '#f27f76' : '#78b1ff';
    $('result-detail').textContent = sim.result === 'draw' ? 'Beide Teams haben nur dasselbe Symbol. Keine Übernahme mehr möglich.' : `${sim.agents.length} Verbündete · ${sim.conversions} Übernahmen · ${Math.floor(sim.elapsed)} Sekunden`;
  }
}

function draw(){
 const r=canvas.getBoundingClientRect(),dpr=devicePixelRatio||1;
 if(canvas.width!==Math.round(r.width*dpr)||canvas.height!==Math.round(r.height*dpr)){canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);}
 ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
 const scale=Math.min(r.width/sim.width,r.height/sim.height);
 if(planning)ctx.setTransform(canvas.width/600,0,0,canvas.height/800,0,0);else ctx.setTransform(dpr*scale,0,0,dpr*scale,dpr*(r.width-sim.width*scale)/2,dpr*(r.height-sim.height*scale)/2);
 ctx.fillStyle='#49613a';ctx.fillRect(0,0,planning?600:sim.width,800);
 const textAt=(text,x,y)=>{ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.font='12px Arial';ctx.fillText(text,x*r.width/600,y*r.height/800);ctx.restore();};
 if(planning){
 ctx.fillStyle=teamColor(1-ownTeam())+'09';ctx.fillRect(0,0,600,380);ctx.fillStyle=teamColor(ownTeam())+'09';ctx.fillRect(0,420,600,380);
 ctx.strokeStyle='#576349';ctx.setLineDash([5,7]);ctx.strokeRect(1,1,598,378);ctx.strokeRect(1,420,598,379);ctx.setLineDash([]);
 ctx.font='12px Arial';ctx.fillStyle=teamColor(1-ownTeam());textAt(teamLabels()[1-ownTeam()].toUpperCase()+' · AUFSTELLUNG VERBORGEN',15,20);ctx.fillStyle=teamColor(ownTeam());textAt('DEINE AUFSTELLUNGSZONE · '+teamName(ownTeam()).toUpperCase(),15,440);
 ctx.fillStyle='#849080';ctx.font='16px Arial';ctx.textAlign='center';textAt('?',300,174);textAt('Der Gegner zeigt sich beim Schlachtstart.',300,206);ctx.textAlign='left';
 groups.forEach((g,i)=>{
 const pts=Rival.corners(g);ctx.beginPath();pts.forEach((p,k)=>k?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=i===selected?'#d0ed8a15':teamColor(ownTeam())+'08';ctx.fill();ctx.strokeStyle=i===selected?'#d0ed8a':teamColor(ownTeam())+'80';ctx.stroke();
 const front=Rival.localPoint(g,g.w/2,0),tip=Rival.localPoint(g,g.w/2,-32);ctx.beginPath();ctx.moveTo(front.x,front.y);ctx.lineTo(tip.x,tip.y);const l=Rival.localPoint(g,g.w/2-5,-22),r=Rival.localPoint(g,g.w/2+5,-22);ctx.moveTo(l.x,l.y);ctx.lineTo(tip.x,tip.y);ctx.lineTo(r.x,r.y);ctx.stroke();
 ctx.fillStyle='#edf0e4';textAt((i+1)+' · '+(g.count/total*100).toFixed(1)+' %',pts[0].x,pts[0].y-5);
 });
 if(gesture?.mode==='new'){const g=gesture.rect;ctx.strokeStyle='#d0ed8a';ctx.strokeRect(g.x,g.y,g.w,g.h);}
 }
 if(!planning)for(const p of sim.pulseWaves||[]){
   const t=Math.max(0,(performance.now()/1000-p.createdAt)/.9);
   if(t>=1)continue;
   const radius=Math.max(1,p.radius*(1-Math.pow(1-t,2))),fade=Math.pow(1-t,2);
   ctx.save();
   const rgb=p.team===1?'120,177,255':'242,127,118';
   const glow=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,radius);
   glow.addColorStop(0,'rgba('+rgb+','+(.14*fade)+')');
   glow.addColorStop(.65,'rgba('+rgb+','+(.07*fade)+')');
   glow.addColorStop(1,'rgba('+rgb+',0)');
   ctx.fillStyle=glow;ctx.beginPath();ctx.arc(p.x,p.y,radius,0,Math.PI*2);ctx.fill();
   const wave=ctx.createRadialGradient(p.x,p.y,radius*.72,p.x,p.y,radius);
   wave.addColorStop(0,'rgba('+rgb+',0)');
   wave.addColorStop(.55,'rgba('+rgb+','+(.8*fade)+')');
   wave.addColorStop(1,'rgba('+rgb+',0)');
   ctx.fillStyle=wave;ctx.beginPath();ctx.arc(p.x,p.y,radius,0,Math.PI*2);ctx.fill();ctx.restore();
 }
  for (const a of (net.active&&!planning?(net.displayAgents||sim.agents):sim.agents)) { if(planning && a.team === 1) continue;
    ctx.save(); ctx.translate(a.x,a.y); const unit=Math.min(r.width/600,r.height/800);if(planning)ctx.scale(unit/(r.width/600),unit/(r.height/800)); const visibleTeam=planning?ownTeam():a.team,color=teamColor(visibleTeam);
    ctx.beginPath();ctx.arc(0,0,11,0,Math.PI*2);ctx.fillStyle=visibleTeam===0?'#482a29':'#233b56';ctx.fill();
    ctx.strokeStyle=color;ctx.lineWidth=1;ctx.globalAlpha=.55;ctx.stroke();ctx.globalAlpha=1;
    if(a.flash){ctx.beginPath();ctx.arc(0,0,12+(1-a.flash/.28)*10,0,Math.PI*2);ctx.globalAlpha=a.flash/.28;ctx.stroke();ctx.globalAlpha=1;}
    ctx.strokeStyle=color;ctx.lineWidth=1.6;ctx.lineCap='round';ctx.lineJoin='round';
    ctx.beginPath();
    if(a.type==='rock'){ctx.moveTo(-6,3);ctx.lineTo(-5,-3);ctx.lineTo(0,-6);ctx.lineTo(5,-4);ctx.lineTo(6,3);ctx.lineTo(2,6);ctx.lineTo(-6,3);ctx.stroke();}
    else if(a.type==='paper'){ctx.rect(-4.5,-6,9,12);ctx.moveTo(-2,-2);ctx.lineTo(2,-2);ctx.moveTo(-2,1);ctx.lineTo(2,1);ctx.moveTo(-2,4);ctx.lineTo(1,4);ctx.stroke();}
    else {ctx.arc(-3,4,2,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(3,4,2,0,Math.PI*2);ctx.moveTo(-2,2);ctx.lineTo(4,-6);ctx.moveTo(2,2);ctx.lineTo(-4,-6);ctx.stroke();}
    ctx.restore();
  }
}


function drawCursor(){
 const remaining=Math.max(0,(sim.pulseReadyAt||0)-performance.now()/1000),ring=$('impulse-cursor');
 ring.style.setProperty('--impulse-color',teamColor(ownTeam()));
 ring.hidden=planning||!cursorInside||Boolean(sim.result);
 $('cursor-progress').style.strokeDashoffset=String(remaining/1.25*100);
 ring.classList.toggle('ready',remaining===0&&!paused);ring.classList.toggle('paused',paused);
 ring.setAttribute('aria-label',paused?'Impuls pausiert':remaining>0?'Impuls in '+remaining.toFixed(1)+' Sekunden':'Impuls bereit');
}
function frame(now){const dt=Math.min((now-last)/1000,.1);last=now;if(!net.active&&!planning&&!paused&&!sim.result){accumulator+=dt*.5*Number($('speed').value);while(accumulator>=1/120&&!sim.result){sim.step(1/120);accumulator-=1/120;}}if(net.active&&!planning&&net.displayAgents){const blend=1-Math.exp(-dt*30);net.displayAgents.forEach((a,i)=>{const target=sim.agents[i];if(!target)return;a.x+=(target.x-a.x)*blend;a.y+=(target.y-a.y)*blend;a.type=target.type;a.team=target.team;a.flash=target.flash;});}draw();drawCursor();if(now-lastStats>100){updateStats();lastStats=now;}requestAnimationFrame(frame);}
networkApplying=true;prepare();networkApplying=false;
$('invite').onclick=async()=>{try{if(net.active)await net.share();else await net.create();}catch(e){$('room-status').textContent=e.message;}};
if(net.active){
 $('opponent-heading').textContent='Freund · Blau';$('opponent-setup').textContent='Freund · obere Hälfte';$('opponent-hint').textContent='Die Aufstellung deines Freundes bleibt bis zum gemeinsamen Start verborgen. Zurück zur Aufstellung startet die Planung für beide neu.';
 $('invite').textContent='Einladungslink kopieren';$('room-link').hidden=false;$('room-link').value=location.origin+'/?room='+encodeURIComponent(net.room);$('solo-link').hidden=false;
 const saved=sessionStorage.getItem('rival-plan-'+net.room);if(saved){try{const plan=JSON.parse(saved);if(Array.isArray(plan)&&plan.length===3&&!Rival.validatePlan(plan,100)){groups=plan;rebuild();}}catch{}}
 net.onChange=message=>{$('room-status').textContent=message;if(!net.connected&&!planning)paused=true;renderSetup();};
 net.onState=message=>{
  const notice=$('ready-notice');notice.hidden=message.phase!=='setup';notice.classList.toggle('opponent-ready',Boolean(message.ready[1-net.seat]));notice.style.setProperty('--opponent-color',teamColor(1-ownTeam()));
  notice.textContent=!net.peer?'Gegner noch nicht verbunden':message.ready[1-net.seat]?'✓ Gegner ist bereit!'+(net.ready?'':' Stelle deine Truppen auf und bestätige deine Bereitschaft.'):'Gegner stellt seine Truppen auf …';
  $('room-status').textContent='Du bist '+teamName(ownTeam())+' · '+(message.phase==='battle'?(!message.connected.every(Boolean)?'Verbindung unterbrochen · Schlacht pausiert':'Gemeinsame Schlacht · 100 Truppen je Spieler'):!net.peer?'Warte auf deinen Freund …':net.ready?'Du bist bereit · warte auf deinen Freund':message.ready[1-net.seat]?'Dein Freund ist bereit. Stelle deine Truppen auf.':'Beide verbunden · stellt eure Truppen auf.');
  if(message.phase==='setup'){
   if(!planning){networkApplying=true;prepare();networkApplying=false;}
   const signature=JSON.stringify([message.ready,message.connected]);if(signature!==networkSignature){renderSetup();networkSignature=signature;}return;
  }
  const first=planning;networkSignature='';planning=false;paused=!message.connected.every(Boolean);
  const localNow=performance.now()/1000;
  const flip=a=>net.seat?{...a,x:message.width-a.x,y:message.height-a.y,vx:-a.vx,vy:-a.vy}:a;
  sim.width=message.width;sim.height=message.height;sim.agents=message.agents.map(flip);if(first||!net.displayAgents||net.displayAgents.length!==sim.agents.length)net.displayAgents=sim.agents.map(a=>({...a}));sim.elapsed=message.elapsed;sim.phase=message.battlePhase;sim.conversions=message.conversions;
  sim.result=message.result;
  sim.pulseReadyAt=localNow+message.cooldown;sim.pulseWaves=message.waves.map(w=>({...w,x:net.seat?message.width-w.x:w.x,y:net.seat?message.height-w.y:w.y,createdAt:localNow-w.age}));
  if(first){$('result').hidden=true;renderSetup();}updateStats();
 };
 net.connect();
}
requestAnimationFrame(frame);



