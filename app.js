'use strict';
const $=id=>document.getElementById(id),canvas=$('arena'),ctx=canvas.getContext('2d');
const net=window.Multiplayer;
document.body.classList.add('planning');
$('combat-tempo').hidden=net.active;
let timelineKey='',battleCountdown=0;
let matchScore={wins:[0,0],draws:0},scoredSimulation=null;
let cursorInside=false,networkApplying=false,networkSignature='';
const ownTeam=()=>net.active?net.seat:0, teamColor=t=>t===0?'#f27f76':'#78b1ff', teamName=t=>t===0?'Rot':'Blau';
const teamLabels=()=>[0,1].map(t=>(t===ownTeam()?'Du':net.active?'Freund':'PC')+' · '+teamName(t));
const symbols={rock:'⬡ Stein',scissors:'✂ Schere',paper:'▤ Papier'};
let groups=[{x:15,y:470,w:156,h:156,type:'rock',count:34},{x:215,y:500,w:156,h:156,type:'scissors',count:33},{x:415,y:470,w:156,h:156,type:'paper',count:33}];
let computer=Rival.computerPlan(),selected=0,total=100,planning=true,sim,paused=false,last=performance.now(),accumulator=0,lastStats=0,gesture=null;
function compact(list){
 const ratio=1600/600,spacing=26/ratio;
 for(const g of list){if(Math.abs((g.spacingX||0)-spacing)<1e-8)continue;const cols=Math.max(1,Math.floor(g.w/(g.spacingX||26)+1e-8));g.spacingX=spacing;g.w=Math.min(600,cols*spacing);g.x=Math.min(g.x,600-g.w);}
}
function rebuild(){compact(groups);compact(computer);sim=Rival.verticalFormation(groups,computer,total);renderSetup();updateStats();}
function renderSetup(){
 document.body.classList.toggle('planning',planning);
 $('setup-panel').hidden=!planning;$('combat-panel').hidden=planning;$('return-plan').hidden=planning;
 $('planning-options').hidden=!planning;$('options-hint').textContent=net.active?(net.settingsLocked?'Für diesen Raum festgelegt':net.seat===0?'Für beide Spieler · gesperrt ab der ersten Bereitschaft':'Der Gastgeber legt die Optionen fest'):'Truppenstärke vor der Schlacht · Tempo jederzeit änderbar';
 $('combat-speed').value=$('speed').value;$('combat-speed-out').textContent=$('speed').value+'×';
 const used=groups.reduce((n,g)=>n+g.count,0),sum=used/total*100,numbers=Rival.allocate(groups,total),g=groups[selected];
 $('army-total').textContent=used+' / '+total+' Truppen';$('reserve').textContent=used<total?'Noch '+(total-used)+' Truppen nicht platziert · '+(100-sum).toFixed(1)+' % frei':'Alle '+total+' Truppen platziert';$('reserve').classList.toggle('unassigned',used<total);
 $('squad-list').replaceChildren();groups.forEach((g,i)=>{const b=document.createElement('button');b.type='button';b.className='squad-row'+(i===selected?' active':'');b.textContent=symbols[g.type]+' · '+(g.count/total*100).toFixed(0)+' %';b.setAttribute('aria-label','Formation '+symbols[g.type]+' auswählen');b.disabled=!planning;b.onclick=()=>{selected=i;renderSetup();};$('squad-list').append(b);});
 $('selected-lane').textContent='GESCHWADER '+(selected+1)+' · '+symbols[g.type];
 const available=total-used+g.count;$('troop-count').min=1;$('troop-count').step=1;$('troop-count').max=available;$('troop-count').value=g.count;$('troop-count').setAttribute('aria-valuetext',(g.count/total*100).toFixed(1)+' Prozent · '+g.count+' Truppen');$('formation-percent').textContent=(g.count/total*100).toFixed(1)+' %';
 $('actual-count').textContent=numbers[selected]+' Truppen · '+(g.count/total*100).toFixed(1)+' % · '+Math.floor(g.w/(g.spacingX||26)+1e-8)+' breit × '+Math.ceil(g.count/Math.floor(g.w/(g.spacingX||26)+1e-8))+' tief · '+Math.round((g.angle||0)*180/Math.PI)+'°';
 for(const id of ['troop-count'])$(id).disabled=!planning||!g;
 for(const id of ['army-size'])$(id).disabled=!planning;
 $('battle').disabled=!planning;$('reset').disabled=planning;
 $('error').textContent=planning&&used===total?Rival.validatePlan(groups,total):'';$('battle').disabled=!planning||used!==total;
 if(net.active){const locked=!net.joined||net.seat!==0||net.settingsLocked;$('army-size').disabled=locked;$('speed').disabled=locked;$('combat-speed').disabled=true;$('battle').textContent=net.ready?'Bereitschaft zurücknehmen':'Bereit für die Schlacht';$('battle').disabled=!planning||!net.joined||(!net.ready&&used!==total);for(const id of ['troop-count'])$(id).disabled=!planning||net.ready;for(const b of $('squad-list').children)b.disabled=!planning||net.ready;}
}
function prepare(){if(net.active&&!networkApplying){net.send({type:!planning&&!sim.result?'surrender':'reset'});return;}planning=true;timelineKey='';battleCountdown=0;$('battle-countdown').hidden=true;document.body.classList.add('planning');paused=false;gesture=null;accumulator=0;$('result').hidden=true;rebuild();}
function startBattle(e){e.preventDefault();if(!planning)return;const error=Rival.validatePlan(groups,total);if(error){$('error').textContent=error;return;}if(net.active){if(net.ready){net.send({type:'unready'});return;}sessionStorage.setItem('rival-plan-'+net.room,JSON.stringify(groups));net.send({type:'ready',groups});return;}computer=Rival.computerPlan(Math.random,total,1600/600);compact(computer);sim=Rival.verticalFormation(groups,computer,total);planning=false;renderSetup();Rival.fitBattle(sim,2);paused=false;accumulator=0;last=performance.now();renderSetup();updateStats();}
function viewport(){return Rival.battleViewport(canvas.clientWidth,canvas.clientHeight);}
function fieldPoint(e){const r=canvas.getBoundingClientRect(),v=viewport();return {x:(e.clientX-r.left-v.left)/v.scale,y:(e.clientY-r.top-v.top)/v.scale};}
function point(e){const p=fieldPoint(e);return {x:Math.max(0,Math.min(600,p.x*600/1600)),y:Math.max(420,Math.min(800,p.y))};}
function followCursor(e){cursorInside=true;$('impulse-cursor').style.left=e.clientX+'px';$('impulse-cursor').style.top=e.clientY+'px';}
canvas.addEventListener('pointerenter',followCursor);canvas.addEventListener('pointermove',followCursor);canvas.addEventListener('pointerleave',()=>{cursorInside=false;});
canvas.addEventListener('pointerdown',e=>{
 followCursor(e);
 if(!planning){
  if(e.button!==0||paused||sim.result)return;
  const {x,y}=fieldPoint(e);
  if(x<0||x>sim.width||y<0||y>sim.height)return;
  if(net.active){net.send({type:'pulse',x:net.seat?sim.width-x:x,y:net.seat?sim.height-y:y});return;}
  if(sim.pulse(x,y)){e.preventDefault();updateStats();}return;
 }
 if(e.button!==0||(net.active&&net.ready))return;const raw=fieldPoint(e);if(raw.x<0||raw.x>1600||raw.y<420||raw.y>800)return;
 const p=point(e);const hit=groups.findIndex(g=>Rival.contains(g,p));
 if(hit>=0){selected=hit;const g=groups[hit];gesture={mode:'move',start:p,original:{...g}};renderSetup();}
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
new ResizeObserver(()=>{if(gesture)endGesture(null,true);sliderDragging=false;}).observe(canvas);
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
 const requested=Math.max(1,Math.round(Number($('troop-count').value)));
 const count=Math.min(available,requested);
 if(!sizeGroup(selected,count)){renderSetup();$('error').textContent='Für diese Formation fehlt Platz. Verschiebe ein Geschwader.';return;}
 rebuild();if(requested>available)$('error').textContent='Keine freien Truppen. Reduziere zuerst den Anteil eines anderen Geschwaders.';
});
$('army-size').addEventListener('change',()=>{
 if(net.active){net.send({type:'configure',settings:{total:Number($('army-size').value),speed:Number($('speed').value)}});return;}
 const n=Number($('army-size').value);if(!Number.isInteger(n)||n<10||n>150){$('army-size').value=total;return;}
 const old=groups.map(g=>({...g})),oldTotal=total;
 const counts=Rival.allocate(groups.map(g=>({percent:g.count/total*100})),n);
 total=n;groups=groups.map((g,i)=>({...g,count:Math.max(1,counts[i]),w:26,h:26}));
 for(let i=0;i<3;i++)if(!sizeGroup(i,groups[i].count)){groups=old;total=oldTotal;$('army-size').value=total;break;}
 rebuild();
});

$('settings').addEventListener('submit',startBattle);$('reset').onclick=prepare;$('again').onclick=prepare;
$('return-plan').onclick=()=>{if(!net.active&&!planning&&!sim.result){sim.result='blue';sim.surrenderedBy=0;sim.recordHistory(true);updateStats();}else prepare();};
$('combat-speed').oninput=()=>{$('speed').value=$('combat-speed').value;$('speed-out').textContent=$('speed').value+'×';$('combat-speed-out').textContent=$('speed').value+'×';};
$('pause').onclick=()=>{paused=!paused;accumulator=0;updateStats();};
$('speed').oninput=()=>{$('speed-out').textContent=$('speed').value+'×';if(net.active)net.send({type:'configure',settings:{total:Number($('army-size').value),speed:Number($('speed').value)}});};
document.addEventListener('visibilitychange',()=>{last=performance.now();accumulator=0;});
let previousTroops=null;
function updateBattleEvents(counts){
 const feed=$('battle-events');
 if(planning||sim.result){previousTroops=planning?null:counts.map(t=>[...t]);feed.replaceChildren();return;}
 const now=performance.now();
 for(const event of [...feed.children])if(now>=Number(event.dataset.expires))event.remove();
 if(previousTroops)counts.forEach((types,team)=>types.forEach((count,type)=>{
  if(count!==0||previousTroops[team][type]===0)return;
  const event=document.createElement('div');event.className='battle-event';event.style.setProperty('--event-color',teamColor(team));event.dataset.expires=String(now+5000);
  const icon=document.createElement('span');icon.className='event-icon';icon.textContent=['⬡','✂','▤'][type];
  const text=document.createElement('span');text.textContent=teamName(team)+' hat '+['keinen Stein','keine Schere','kein Papier'][type]+' mehr!';
  event.append(icon,text);feed.append(event);
 }));
 previousTroops=counts.map(t=>[...t]);
}
function renderHistory(){
 const history=sim.history||[],key=(sim.deathEvents?.length||0)+':'+sim.result+':'+history.length+':'+(history.at(-1)?.time||0);
 if(key===timelineKey)return;timelineKey=key;
 const source=history.length?history:[{time:0,counts:[0,0,0,0,0,0]}];
 const duration=source.at(-1).time,points=source.length===1?[source[0],{...source[0],time:duration||1}]:source;
 const colors=['#a64043','#e67470','#ffc0a4','#b8dfff','#6aa9ed','#315f9a'];
 const names=['Rot · Stein','Rot · Schere','Rot · Papier','Blau · Stein','Blau · Schere','Blau · Papier'];
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 600 180');svg.setAttribute('role','img');svg.setAttribute('aria-label','Gestapelter Verlauf der sechs Truppentypen. Zusammen immer 100 Prozent. Dauer '+duration.toFixed(1)+' Simulationssekunden.');
 const make=(tag,attrs,text)=>{const e=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;svg.append(e);return e;};
 const x=p=>94+456*p.time/(duration||1),y=(p,n)=>152-140*p.counts.slice(0,n).reduce((a,b)=>a+b,0)/Math.max(1,p.counts.reduce((a,b)=>a+b,0));
 // Shared, bounded curves keep adjacent areas flush without overshooting the data.
 const boundary=(samples,n,command='M')=>samples.reduce((path,p,i)=>{
  if(!i)return command+x(p)+','+y(p,n);
  const previous=samples[i-1],dx=(x(p)-x(previous))/3;
  return path+' C'+(x(previous)+dx)+','+y(previous,n)+' '+(x(p)-dx)+','+y(p,n)+' '+x(p)+','+y(p,n);
 },'');
 for(let i=0;i<6;i++){
  make('path',{d:boundary(points,i)+boundary([...points].reverse(),i+1,'L')+' Z',fill:colors[i]});
 }
 for(let i=1;i<6;i++)make('path',{d:boundary(points,i),fill:'none',stroke:colors[i],'stroke-width':1,'vector-effect':'non-scaling-stroke','stroke-linejoin':'round'});
 make('rect',{x:94,y:12,width:456,height:140,fill:'none',stroke:'#ffffff45'});
 make('line',{x1:94,y1:82,x2:550,y2:82,stroke:'#ffffff50','stroke-dasharray':'4 5'});
 for(const [value,py]of [['100%',16],['50%',86],['0%',152]])make('text',{x:558,y:py,'text-anchor':'start',fill:'#a9b4a5','font-size':10},value);
 const format=t=>Math.floor(t/60)+':'+Math.floor(t%60).toString().padStart(2,'0');
 for(const [t,px]of [[0,94],[duration/2,322],[duration,550]])make('text',{x:px,y:173,'text-anchor':px===94?'start':px===550?'end':'middle',fill:'#a9b4a5','font-size':11},format(t));
 const labels=names.map((name,i)=>({name,i,target:(y(points[0],i)+y(points[0],i+1))/2})).sort((a,b)=>a.target-b.target);
 labels.forEach((label,i)=>label.position=Math.max(label.target,i?labels[i-1].position+14:18));
 for(let i=labels.length-1;i>=0;i--)labels[i].position=Math.min(labels[i].position,i===labels.length-1?146:labels[i+1].position-14);
 for(const label of labels){
  if(Math.abs(label.position-label.target)>3)make('line',{x1:86,y1:label.position,x2:93,y2:label.target,stroke:colors[label.i],'stroke-width':.7});
  const text=make('text',{x:82,y:label.position,'dominant-baseline':'middle','text-anchor':'end',fill:colors[label.i],'font-size':12,'font-weight':600},['Stein','Schere','Papier'][label.i%3]);
  const title=document.createElementNS(ns,'title');title.textContent=label.name;text.append(title);
 }
 const markers=[];
 for(const event of sim.deathEvents||[]){
  const index=event.team*3+Rival.TYPES.indexOf(event.type),px=x(event),anchor=y(event,index);
  let py=Math.max(27,Math.min(134,anchor));
  for(const candidate of [py,27,55,83,111,134])if(!markers.some(m=>Math.abs(m.x-px)<23&&Math.abs(m.y-candidate)<26)){py=candidate;break;}
  markers.push({x:px,y:py});const color=teamColor(event.team);
  make('line',{x1:px,y1:anchor,x2:px,y2:py,stroke:color,'stroke-width':1,'stroke-dasharray':'2 2'});
  make('circle',{cx:px,cy:anchor,r:2,fill:color});
  const marker=make('g',{transform:'translate('+px+' '+py+')',tabindex:0,role:'img','aria-label':teamName(event.team)+' verliert '+symbols[event.type]+' bei '+event.time.toFixed(1)+' Sekunden'});
  const title=document.createElementNS(ns,'title');title.textContent=teamName(event.team)+' hat '+['keinen Stein','keine Schere','kein Papier'][index%3]+' mehr · '+event.time.toFixed(1)+' s';marker.append(title);
  const stone=document.createElementNS(ns,'path');stone.setAttribute('d','M -9 11 V -3 A 9 9 0 0 1 9 -3 V 11 Z');stone.setAttribute('fill',event.team===0?'#482a29':'#233b56');stone.setAttribute('stroke',color);stone.setAttribute('stroke-width','1.5');marker.append(stone);
  const symbol=document.createElementNS(ns,'text');symbol.setAttribute('x','0');symbol.setAttribute('y','4');symbol.setAttribute('text-anchor','middle');symbol.setAttribute('fill',color);symbol.setAttribute('font-size','13');symbol.textContent=['⬡','✂','▤'][index%3];marker.append(symbol);
 }
 $('history-chart').replaceChildren(svg);
}
function updateStats() {
 if(!net.active&&!planning&&sim.result&&scoredSimulation!==sim){
  if(sim.result==='draw')matchScore.draws++;else matchScore.wins[sim.result==='red'?0:1]++;
  scoredSimulation=sim;
 }
 for(const prefix of ['series','result-series']){
  $(prefix+'-red').textContent='Rot '+matchScore.wins[0];
  $(prefix+'-blue').textContent=matchScore.wins[1]+' Blau';
  $(prefix+'-draws').textContent=matchScore.draws?matchScore.draws+' unentschieden':'';
 }

 const labels=teamLabels();$('red-heading').textContent=labels[0];$('opponent-heading').textContent=labels[1];
 $('opponent-setup').textContent=labels[1-ownTeam()]+' · obere Hälfte';$('opponent-setup').style.color=teamColor(1-ownTeam());
 const cooldown=Math.max(0,(sim.pulseReadyAt||0)-performance.now()/1000);
 $('pulse-status').textContent=planning?'Impuls · im Gefecht':sim.result?'Impuls · Runde beendet':paused?'Impuls · pausiert':cooldown>0?'Impuls · '+cooldown.toFixed(1)+' s':'✦ Impuls bereit · klicken';
 $('pulse-status').classList.toggle('ready',!planning&&!paused&&!sim.result&&cooldown===0);
 $('pulse-status').title='Klick stößt beide Teams im Umkreis weg. 1,25 reale Sekunden Cooldown.';
  const c = [[0,0,0],[0,0,0]];
  for (const a of sim.agents) c[planning&&ownTeam()===1?1-a.team:a.team][Rival.TYPES.indexOf(a.type)]++;
  updateBattleEvents(c);
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
    const redPercent=Math.round(totals[0]/Math.max(1,sim.agents.length)*100);$(team+'-percent').textContent=(i===0?redPercent:100-redPercent)+' %';
  });
  $('red-bar').style.width = totals[0] / Math.max(1,sim.agents.length) * 100 + '%';
  $('conversions').textContent = sim.conversions;
  $('time').textContent = `${Math.floor(sim.elapsed/60).toString().padStart(2,'0')}:${Math.floor(sim.elapsed%60).toString().padStart(2,'0')}`;
  $('pause').textContent = paused ? '▶ Weiter' : 'Ⅱ Pause';
  $('pause').setAttribute('aria-label', paused ? 'Simulation fortsetzen' : 'Simulation pausieren');
  $('pause').disabled = net.active || planning || Boolean(sim.result);
  $('status').textContent = planning ? 'Aufstellung · Drei Geschwader frei platzieren' : sim.result ? 'Runde beendet' : battleCountdown > 0 ? 'Schlacht startet in '+Math.ceil(battleCountdown)+' …' : paused ? 'Simulation pausiert' : sim.phase === 'march' ? 'Vormarsch · Fronten nähern sich' : 'Chaos · Jeder Kontakt zählt';
  $('status-dot').style.background = paused || sim.result ? '#899180' : '#d0ed8a';
  if(!net.active){$('return-plan').textContent=sim.result?'↻ Revanche':'⚑ Aufgeben';$('again').textContent='Revanche · neu aufstellen ↗';}
  if(net.active){const waiting=Boolean(net.rematch?.[net.seat]);$('return-plan').textContent=sim.result?(waiting?'Warte auf den Gegner …':'↻ Revanche'):'⚑ Aufgeben';$('return-plan').disabled=waiting;$('again').textContent=waiting?'Revanche angefragt …':'Revanche · neu aufstellen ↗';$('again').disabled=waiting;}
  if (sim.result) {
    $('result').hidden = false;renderHistory();
    const won=sim.result===(ownTeam()===0?'red':'blue');
    $('result-title').textContent = sim.result === 'draw' ? 'Unentschieden.' : sim.surrenderedBy===ownTeam()?'You Lose':net.active?(won?'You Won':'You Lose'):`Team ${sim.result === 'red' ? 'Rot' : 'Blau'} gewinnt.`;
    $('result-title').style.color = sim.result === 'draw' ? '#d0ed8a' : sim.result === 'red' ? '#f27f76' : '#78b1ff';
    $('result-detail').textContent = !net.active&&sim.surrenderedBy===0?'Du hast aufgegeben.':net.active?(sim.surrenderedBy!==undefined?(sim.surrenderedBy===ownTeam()?'Du hast aufgegeben.':'Dein Gegner hat aufgegeben.'):(sim.result==='draw'?'Keine Übernahme mehr möglich.':won?'Du hast die Schlacht gewonnen.':'Du hast die Schlacht verloren.'))+' '+(net.rematch?.[1-net.seat]?'Dein Gegner möchte eine Revanche.':'Die Revanche beginnt mit neuer Aufstellung, sobald beide zustimmen.') : sim.result === 'draw' ? 'Beide Teams haben nur dasselbe Symbol. Keine Übernahme mehr möglich.' : `${sim.agents.length} Verbündete · ${sim.conversions} Übernahmen · ${Math.floor(sim.elapsed)} Sekunden`;
  }
}

let sliderDragging=false;
$('troop-count').addEventListener('pointerdown',()=>sliderDragging=true);
window.addEventListener('pointerup',()=>sliderDragging=false);
window.addEventListener('pointercancel',()=>sliderDragging=false);
function positionFormationControls(){
 if(!planning)return;
 const w=canvas.clientWidth,h=canvas.clientHeight,v=viewport(),control=$('formation-control');
 const screenX=x=>v.left+x*1600/600*v.scale,screenY=y=>v.top+y*v.scale;
 const center=document.querySelector('.setup-center');
 center.style.top=(v.top>center.offsetHeight+24?v.top-center.offsetHeight/2-12:screenY(220))+'px';
 control.hidden=Boolean(gesture)||(net.active&&net.ready);
 groups.forEach((g,i)=>{const pts=Rival.corners(g),x=screenX(pts.reduce((n,p)=>n+p.x,0)/4),y=screenY(Math.min(...pts.map(p=>p.y))),b=$('squad-list').children[i];if(b){b.style.left=Math.max(b.offsetWidth/2+4,Math.min(w-b.offsetWidth/2-4,x))+'px';b.style.top=Math.max(0,y-31)+'px';}});
 if(sliderDragging)return;
 const pts=Rival.corners(groups[selected]),cx=screenX(pts.reduce((n,p)=>n+p.x,0)/4),bottom=screenY(Math.max(...pts.map(p=>p.y)));
 control.style.left=Math.max(8,Math.min(w-control.offsetWidth-8,cx-control.offsetWidth/2))+'px';
 control.style.top=Math.max(8,Math.min(h-control.offsetHeight-8,bottom+9))+'px';
 control.style.setProperty('--formation-color',teamColor(ownTeam()));
}
function draw(){positionFormationControls();
 const r=canvas.getBoundingClientRect(),dpr=devicePixelRatio||1;
 if(canvas.width!==Math.round(r.width*dpr)||canvas.height!==Math.round(r.height*dpr)){canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);}
 ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
 const v=viewport(),scale=v.scale;
 ctx.fillStyle='#18251b';ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.setTransform(dpr*scale*(planning?1600/600:1),0,0,dpr*scale,dpr*v.left,dpr*v.top);
 ctx.fillStyle='#49613a';ctx.fillRect(0,0,planning?600:sim.width,800);
 const textAt=(text,x,y)=>{ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.font='12px Arial';ctx.fillText(text,v.left+x*1600/600*scale,v.top+y*scale);ctx.restore();};
 if(planning){
 ctx.fillStyle=teamColor(1-ownTeam())+'09';ctx.fillRect(0,0,600,380);ctx.fillStyle=teamColor(ownTeam())+'09';ctx.fillRect(0,420,600,380);
 ctx.strokeStyle='#576349';ctx.setLineDash([5,7]);ctx.strokeRect(1,1,598,378);ctx.strokeRect(1,420,598,379);ctx.setLineDash([]);
 if(scale>=.4){ctx.font='12px Arial';ctx.fillStyle=teamColor(1-ownTeam());textAt(teamLabels()[1-ownTeam()].toUpperCase()+' · AUFSTELLUNG VERBORGEN',15,20);ctx.fillStyle=teamColor(ownTeam());textAt('DEINE AUFSTELLUNGSZONE · '+teamName(ownTeam()).toUpperCase(),15,405);}
 
 groups.forEach((g,i)=>{
 const pts=Rival.corners(g);ctx.beginPath();pts.forEach((p,k)=>k?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=i===selected?'#d0ed8a15':teamColor(ownTeam())+'08';ctx.fill();ctx.strokeStyle=i===selected?'#d0ed8a':teamColor(ownTeam())+'80';ctx.stroke();
 const front=Rival.localPoint(g,g.w/2,0),tip=Rival.localPoint(g,g.w/2,-32);ctx.beginPath();ctx.moveTo(front.x,front.y);ctx.lineTo(tip.x,tip.y);const l=Rival.localPoint(g,g.w/2-5,-22),r=Rival.localPoint(g,g.w/2+5,-22);ctx.moveTo(l.x,l.y);ctx.lineTo(tip.x,tip.y);ctx.lineTo(r.x,r.y);ctx.stroke();
 
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
    ctx.save(); ctx.translate(a.x,a.y); if(planning)ctx.scale(600/1600,1); const visibleTeam=planning?ownTeam():a.team,color=teamColor(visibleTeam);
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
 ring.hidden=planning||battleCountdown>0||!cursorInside||Boolean(sim.result);
 $('cursor-progress').style.strokeDashoffset=String(remaining/1.25*100);
 ring.classList.toggle('ready',remaining===0&&!paused);ring.classList.toggle('paused',paused);
 ring.setAttribute('aria-label',paused?'Impuls pausiert':remaining>0?'Impuls in '+remaining.toFixed(1)+' Sekunden':'Impuls bereit');
}
function frame(now){const dt=Math.min((now-last)/1000,.1);last=now;if(!net.active&&!planning&&!paused&&!sim.result){accumulator+=dt*.5*Number($('speed').value);while(accumulator>=1/120&&!sim.result){sim.step(1/120);accumulator-=1/120;}}if(net.active&&!planning&&net.displayAgents){const blend=1-Math.exp(-dt*30);net.displayAgents.forEach((a,i)=>{const target=sim.agents[i];if(!target)return;a.x+=(target.x-a.x)*blend;a.y+=(target.y-a.y)*blend;a.type=target.type;a.team=target.team;a.flash=target.flash;});}draw();drawCursor();if(now-lastStats>100){updateStats();lastStats=now;}requestAnimationFrame(frame);}
networkApplying=true;prepare();networkApplying=false;
$('invite').onclick=async()=>{try{if(net.active)await net.share();else await net.create();}catch(e){$('room-status').textContent=e.message;}};
if(net.active){
 $('opponent-heading').textContent='Freund · Blau';$('opponent-setup').textContent='Freund · obere Hälfte';$('opponent-hint').textContent='Die Aufstellung deines Freundes bleibt bis zum gemeinsamen Start verborgen. Aufgeben beendet die Schlacht als Niederlage. Danach wechseln beide gemeinsam zurück zur Aufstellung.';
 $('invite').textContent='Einladungslink kopieren';$('room-link').hidden=false;$('room-link').value=location.origin+'/?room='+encodeURIComponent(net.room);$('solo-link').hidden=false;
 const saved=sessionStorage.getItem('rival-plan-'+net.room);if(saved){try{const stored=JSON.parse(saved);const plan=Array.isArray(stored)?stored.map((g,i)=>({...g,type:Rival.TYPES[i]})):stored;if(Array.isArray(plan)&&plan.length===3&&!Rival.validatePlan(plan,100)){groups=plan;rebuild();}}catch{}}
 net.onChange=message=>{$('room-status').textContent=message;if(!net.connected&&!planning)paused=true;renderSetup();};
 net.onState=message=>{
  net.rematch=message.rematch;
  if(message.score)matchScore=message.score;
  net.settingsLocked=Boolean(message.settingsLocked);
  if(message.settings){
   $('speed').value=message.settings.speed;$('speed-out').textContent=message.settings.speed+'×';
   if(total!==message.settings.total){
    total=message.settings.total;$('army-size').value=total;
    const counts=Rival.allocate([{percent:34},{percent:33},{percent:33}],total);
    groups=counts.map((count,i)=>({x:15+i*200,y:470,w:58.5,h:Math.ceil(count/6)*26,spacingX:9.75,angle:0,type:Rival.TYPES[i],count}));
    try{const saved=JSON.parse(sessionStorage.getItem('rival-plan-'+net.room));if(Array.isArray(saved)&&saved.length===3&&new Set(saved.map(g=>g.type)).size===3&&!Rival.validatePlan(saved,total))groups=saved;}catch{}
    if(planning)rebuild();
   }
  }
  const notice=$('ready-notice');notice.hidden=message.phase!=='setup';notice.classList.toggle('opponent-ready',Boolean(message.ready[1-net.seat]));notice.style.setProperty('--opponent-color',teamColor(1-ownTeam()));
  notice.textContent=!net.peer?'Gegner noch nicht verbunden':message.ready[1-net.seat]?'✓ Gegner ist bereit!'+(net.ready?'':' Stelle deine Truppen auf und bestätige deine Bereitschaft.'):'Gegner stellt seine Truppen auf …';
  $('room-status').textContent='Du bist '+teamName(ownTeam())+' · '+(message.phase==='battle'?(message.result?'Runde beendet':!message.connected.every(Boolean)?'Verbindung unterbrochen · Schlacht pausiert':'Gemeinsame Schlacht · '+total+' Truppen je Spieler'):!net.peer?'Warte auf deinen Freund …':net.ready?'Du bist bereit · warte auf deinen Freund':message.ready[1-net.seat]?'Dein Freund ist bereit. Stelle deine Truppen auf.':'Beide verbunden · stellt eure Truppen auf.');
  if(message.phase==='setup'){
   if(!planning){networkApplying=true;prepare();networkApplying=false;}
   const signature=JSON.stringify([message.ready,message.connected,message.settings,message.settingsLocked]);if(signature!==networkSignature){renderSetup();networkSignature=signature;}return;
  }
  const first=planning;networkSignature='';planning=false;battleCountdown=message.countdown||0;paused=!message.connected.every(Boolean)||battleCountdown>0;
  const countdown=$('battle-countdown');countdown.hidden=battleCountdown<=0||Boolean(message.result);
  $('countdown-number').textContent=Math.ceil(battleCountdown);
  $('countdown-label').textContent=message.connected.every(Boolean)?'Die Schlacht beginnt':'Warte auf Wiederverbindung';
  const localNow=performance.now()/1000;
  const flip=a=>net.seat?{...a,x:message.width-a.x,y:message.height-a.y,vx:-a.vx,vy:-a.vy}:a;
  sim.width=message.width;sim.height=message.height;sim.agents=message.agents.map(flip);if(first||!net.displayAgents||net.displayAgents.length!==sim.agents.length)net.displayAgents=sim.agents.map(a=>({...a}));sim.elapsed=message.elapsed;sim.phase=message.battlePhase;sim.conversions=message.conversions;
  sim.result=message.result;sim.history=message.history||[];sim.deathEvents=message.deathEvents||[];sim.surrenderedBy=message.surrenderedBy;net.rematch=message.rematch;
  sim.pulseReadyAt=localNow+message.cooldown;sim.pulseWaves=message.waves.map(w=>({...w,x:net.seat?message.width-w.x:w.x,y:net.seat?message.height-w.y:w.y,createdAt:localNow-w.age}));
  if(first){$('result').hidden=true;renderSetup();}updateStats();
 };
 net.connect();
}
requestAnimationFrame(frame);





