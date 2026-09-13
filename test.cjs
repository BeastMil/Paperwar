const assert = require('node:assert/strict');
const {Simulation, convert, outcome, TYPES} = require('./simulation.js');
let checked = 0;
for (const teamA of [0,1]) for (const teamB of [0,1]) for (const typeA of TYPES) for (const typeB of TYPES) {
  const a = {team:teamA,type:typeA}, b = {team:teamB,type:typeB};
  const changes = teamA !== teamB && typeA !== typeB;
  assert.equal(convert(a,b), changes);
  if (changes) {
    const winnerA = (typeA==='rock' && typeB==='scissors') || (typeA==='scissors' && typeB==='paper') || (typeA==='paper' && typeB==='rock');
    assert.equal(a.team, winnerA ? teamA : teamB); assert.equal(a.type, winnerA ? typeA : typeB);
    assert.equal(a.team,b.team); assert.equal(a.type,b.type);
  } else {assert.deepEqual(a,{team:teamA,type:typeA});assert.deepEqual(b,{team:teamB,type:typeB});}
  checked++;
}
assert.equal(outcome([{team:0,type:'rock'},{team:1,type:'rock'}]),'draw');
assert.equal(outcome([{team:0,type:'rock'},{team:0,type:'paper'}]),'red');
assert.equal(outcome([{team:1,type:'scissors'}]),'blue');
const collision = new Simulation([[1,0,0],[0,1,0]]);
Object.assign(collision.agents[0],{x:100,y:100,vx:50,vy:0});
Object.assign(collision.agents[1],{x:123,y:100,vx:-50,vy:0});
collision.step(1/120); assert.equal(collision.result,'red');assert.equal(collision.conversions,1);
let seed=123;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
const stress = new Simulation([[50,50,50],[50,50,50]],1000,560,random);
for(let step=0;step<2400;step++) stress.step(1/120);
assert.equal(stress.agents.length,300);assert(stress.conversions>0);
for(const a of stress.agents) {assert(Number.isFinite(a.x+a.y+a.vx+a.vy));assert(a.x>=10&&a.x<=990&&a.y>=10&&a.y<=550);}
console.log(`Passed ${checked} rule combinations, collision conversion, victory, draw, and 300-agent stability.`);
const {formation}=require('./simulation.js');
const full=[[{type:'rock',count:50},{type:'scissors',count:50},{type:'paper',count:50}],[{type:'scissors',count:50},{type:'paper',count:50},{type:'rock',count:50}]];
const battle=formation(full,random);
assert.equal(battle.agents.length,300);
for(const a of battle.agents){assert(a.team===0?a.x<500:a.x>500);assert.equal(a.vy,0);}
for(let i=0;i<battle.agents.length;i++)for(let j=i+1;j<battle.agents.length;j++)assert(Math.hypot(battle.agents[i].x-battle.agents[j].x,battle.agents[i].y-battle.agents[j].y)>=24);
const before=battle.agents.map(a=>({x:a.x,y:a.y}));
for(let i=0;i<120;i++)battle.step(1/120);
assert.equal(battle.phase,'march');assert.equal(battle.conversions,0);
battle.agents.forEach((a,i)=>{assert.equal(a.y,before[i].y);assert(Math.abs(a.x-before[i].x-(a.team===0?65:-65))<1e-6);});
for(let i=0;i<180;i++)battle.step(1/120);
assert.equal(battle.phase,'chaos');assert(battle.conversions>0);assert(battle.agents.every(a=>a.vy===0));
const disjoint=formation([[{type:'rock',count:1},{type:'rock',count:0},{type:'rock',count:0}],[{type:'paper',count:0},{type:'paper',count:0},{type:'paper',count:1}]],random);
for(let i=0;i<1200;i++)disjoint.step(1/120);
assert.equal(disjoint.phase,'chaos');
const tie=formation([[{type:'rock',count:1}],[{type:'rock',count:1}]],random);
for(let i=0;i<240;i++)tie.step(1/120);
assert.equal(tie.result,'draw');
console.log('Passed formation separation, troop counts, straight march, first contact, chaos transition, empty-lane fallback, and battle draw.');
const {verticalFormation,computerPlan,allocate,validatePlan}=require('./simulation.js');
const player=[{x:15,y:460,w:180,h:260,type:'rock',percent:34},{x:210,y:490,w:180,h:260,type:'scissors',percent:33},{x:405,y:460,w:180,h:260,type:'paper',percent:33}];
assert.equal(validatePlan(player,101),'');assert.equal(allocate(player,101).reduce((a,b)=>a+b,0),101);
assert(validatePlan([{...player[0],y:300,percent:100}],100));
assert(validatePlan([{...player[0],percent:50},{...player[0],percent:50}],100));
assert(validatePlan([{...player[0],w:26,h:26,percent:100}],100));
assert(validatePlan([{...player[0],percent:90}],100));
for(let n=0;n<50;n++){
 const pc=computerPlan(random),v=verticalFormation(player,pc,150,random);
 assert.equal(v.agents.length,300);assert(v.agents.filter(a=>a.team===0).every(a=>a.y>420));assert(v.agents.filter(a=>a.team===1).every(a=>a.y<380));
 const positions=v.agents.map(a=>({x:a.x,y:a.y}));v.step(1/120);
 v.agents.forEach((a,i)=>{if(a.team===0)assert.equal(a.x,positions[i].x);assert(a.team===0?a.y<positions[i].y:a.y>positions[i].y);});
}
console.log('Passed vertical zones, percentage rounding, overlap/capacity/budget rejection, PC troop totals and vertical march.');
const {fitBattle}=require('./simulation.js');
const metric=new Simulation([[1,0,0],[0,1,0]],600,800);
fitBattle(metric,2);assert.equal(metric.width,1600);
Object.assign(metric.agents[0],{x:200,y:200,vx:65,vy:0});Object.assign(metric.agents[1],{x:1000,y:400,vx:0,vy:65});
metric.step(0.1);assert(Math.abs((metric.agents[0].x-200)-(metric.agents[1].y-400))<1e-9);
console.log('Passed equal horizontal/vertical movement in wide battle coordinates.');
const {frontFormation}=require('./simulation.js');
const front=frontFormation({type:'rock',count:34},{x:20,y:430},{x:280,y:430});
assert.equal(front.w,260);assert.equal(front.h,104);assert.equal(front.count,34);
const narrow=frontFormation(front,{x:20,y:430},{x:150,y:430});assert.equal(narrow.h,182);assert.equal(narrow.count,34);
const impact=new Simulation([[1,1,0],[0,1,0]],600,800);
impact.phase='march';impact.vertical=true;
Object.assign(impact.agents[0],{x:100,y:300,vx:0,vy:65});
Object.assign(impact.agents[1],{x:450,y:600,vx:0,vy:-65});
Object.assign(impact.agents[2],{x:110,y:321,vx:0,vy:-65});
const energy=()=>impact.agents.reduce((n,a)=>n+a.vx*a.vx+a.vy*a.vy,0);
const initialEnergy=energy();impact.step(1/120);
assert.equal(impact.phase,'chaos');assert.equal(impact.agents[1].vx,0);assert.equal(impact.agents[1].vy,-65);
assert(Math.abs(energy()-initialEnergy)<1e-6);assert(Math.abs(impact.agents[0].vx)>0);
assert(Math.abs(impact.agents[0].vx+impact.agents[2].vx)<1e-6);
console.log('Passed front width/automatic depth, conserved collision energy/momentum, glancing deflection and untouched forward velocity.');
const compactPlan=[{x:20,y:460,w:65,h:156,spacingX:13,type:'rock',count:25},{x:200,y:460,w:65,h:156,spacingX:13,type:'paper',count:25},{x:400,y:460,w:65,h:156,spacingX:13,type:'scissors',count:25}];
const compactSim=verticalFormation(compactPlan,computerPlan(random),75,random);fitBattle(compactSim,1.5);
assert.equal(compactSim.agents[1].x-compactSim.agents[0].x,26);
assert.equal(compactSim.agents[5].y-compactSim.agents[0].y,26);
console.log('Passed equal compact horizontal/vertical formation spacing.');

const rotated=frontFormation({type:'rock',count:12,spacingX:13},{x:200,y:550},{x:265,y:615});
assert(Math.abs(rotated.angle-Math.atan2(65,130))<1e-9);

const geom=require('./simulation.js');
assert(geom.inZone(rotated));assert(geom.contains(rotated,geom.localPoint(rotated,rotated.w/2,rotated.h/2)));
assert(geom.overlaps(rotated,{...rotated,x:rotated.x+1}));assert(!geom.inZone({...rotated,y:790}));
const oriented=verticalFormation([rotated],computerPlan(random),12,random);fitBattle(oriented,1.5);
const soldier=oriented.agents[0];assert(soldier.vx>0&&soldier.vy<0);assert(Math.abs(Math.hypot(soldier.vx,soldier.vy)-65)<1e-9);
const spacing=Math.hypot(oriented.agents[1].x-soldier.x,oriented.agents[1].y-soldier.y);assert(Math.abs(spacing-26)<1e-9);
console.log('Passed rotated placement, polygon bounds, hit testing, overlap, oriented march and compact spacing.');

const pulseSim=new Simulation([[2,0,0],[0,1,0]],600,800);
Object.assign(pulseSim.agents[0],{x:280,y:400,vx:0,vy:0});
Object.assign(pulseSim.agents[1],{x:500,y:700,vx:12,vy:20});
Object.assign(pulseSim.agents[2],{x:340,y:400,vx:0,vy:0});
assert.equal(pulseSim.pulse(300,400,10),true);
assert(pulseSim.agents[0].vx<0);assert(pulseSim.agents[2].vx>0);
assert(Math.abs(pulseSim.agents[0].vx)>Math.abs(pulseSim.agents[2].vx));
assert.equal(pulseSim.agents[1].vx,12);assert.equal(pulseSim.agents[1].vy,20);
const velocities=pulseSim.agents.map(a=>[a.vx,a.vy]);assert.equal(pulseSim.pulse(300,400,10),false);assert.deepEqual(pulseSim.agents.map(a=>[a.vx,a.vy]),velocities);
pulseSim.elapsed=999;assert.equal(pulseSim.pulse(300,400,11.249),false);assert.equal(pulseSim.pulse(300,400,11.25),true);
pulseSim.elapsed=6;assert.equal(pulseSim.pulse(-1,0),false);pulseSim.result='red';assert.equal(pulseSim.pulse(300,400,10),false);
console.log('Passed radial impulse, both teams, falloff, unaffected distant troops, cooldown and ended-round rejection.');
const ground=new Simulation([[1,0,0],[0,1,0]],1000,800);ground.phase='march';ground.terrain={forests:[{x:.2,y:.5,rx:.1,ry:.1}],rocks:[]};
Object.assign(ground.agents[0],{x:200,y:400,vx:100,vy:0});Object.assign(ground.agents[1],{x:800,y:400,vx:100,vy:0});ground.step(.1);assert.equal(ground.agents[0].x,205.5);assert.equal(ground.agents[1].x,810);assert.equal(ground.agents[0].vx,100);
ground.agents[0].x=350;ground.step(.1);assert.equal(ground.agents[0].x,360);
const cliff=new Simulation([[1,0,0],[0,1,0]],1000,800);cliff.terrain={forests:[],rocks:[{x:.5,y:.5,rx:.03,ry:.03}]};Object.assign(cliff.agents[0],{x:459,y:400,vx:65,vy:0});Object.assign(cliff.agents[1],{x:800,y:600,vx:0,vy:0});cliff.step(1/120);assert.equal(cliff.agents[0].vx,-65);assert(cliff.agents[0].x<459);
const generated=require('./simulation.js').generateTerrain(random);assert.equal(generated.forests.length,3);assert(generated.rocks.every(r=>r.y-r.ry>.475&&r.y+r.ry<.525));
console.log('Passed forest slowdown, normal speed on exit, cliff reflection, and rocks outside deployment zones.');
// Each rank stays centered, including short ranks and rotated formations.
for(const angle of [0,.6])for(const count of [1,4,8,12]){
 const R=require('./simulation.js'),g={x:200,y:500,w:60,h:104,spacingX:10,angle,type:'rock',count};
 const s=R.verticalFormation([g],[],count);
 for(let row=0;row<Math.ceil(count/6);row++){
  const rank=s.agents.slice(row*6,(row+1)*6),center=R.localPoint(g,g.w/2,13+row*26);
  assert(Math.abs(rank.reduce((n,a)=>n+a.x,0)/rank.length-center.x)<1e-8);
  assert(Math.abs(rank.reduce((n,a)=>n+a.y,0)/rank.length-center.y)<1e-8);
 }
}
console.log('Passed centered full, partial and single-unit ranks in straight and rotated formations.');
const pcOrders=new Set(),pcWidths=new Set();
for(const ratio of [.8,1,1.5,2.7,4])for(const total of [10,75,100,150])for(let sample=0;sample<30;sample++){
 const R=require('./simulation.js'),plan=R.computerPlan(random,total,ratio);
 assert.equal(plan.reduce((n,g)=>n+g.percent,0),100);assert(plan.every(g=>g.percent>=20&&g.percent<=40));assert.equal(new Set(plan.map(g=>g.type)).size,3);
 for(const g of plan){assert(Math.abs(g.angle)<=.18);assert(R.corners(g).every(p=>p.x>=0&&p.x<=600&&p.y>=0&&p.y<=380));}
 for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)assert(!R.overlaps(plan[i],plan[j]));
 const troops=R.verticalFormation([],plan,total,random).agents;assert.equal(troops.length,total);assert(troops.every(a=>a.vy>60));
 pcOrders.add(plan.map(g=>g.type).join(','));pcWidths.add(plan[0].w);
}
assert.equal(pcOrders.size,6);assert(pcWidths.size>5);
console.log('Passed 600 randomized PC plans: 20–40% shares, all type orders, varied widths, zone bounds, no overlap, complete armies and forward heading.');
const tracked=new Simulation([[2,1,1],[1,2,1]],1000,800);tracked.phase='march';tracked.result=null;tracked.recordHistory(true);
tracked.agents[0].team=1;tracked.elapsed=.5;tracked.recordHistory();
assert.deepEqual(tracked.history[0].counts,[2,1,1,1,2,1]);assert.deepEqual(tracked.history[1].counts,[1,1,1,2,2,1]);
for(let i=1;i<=3000;i++){tracked.elapsed=i;tracked.recordHistory();}
tracked.elapsed=3000.125;tracked.recordHistory(true);assert(tracked.history.length<=600);assert.equal(tracked.history[0].time,0);assert.equal(tracked.history.at(-1).time,3000.125);
assert(tracked.history.every(p=>p.counts.reduce((a,b)=>a+b,0)===8));assert(tracked.history.every((p,i)=>!i||p.time>tracked.history[i-1].time));
console.log('Passed six-series history: exact team/type counts, conserved totals, bounded long-game storage, start and final samples.');
const extinct=new Simulation([[1,1,1],[1,1,1]],1000,800);extinct.recordHistory(true);assert.equal(extinct.deathEvents.length,0);
extinct.agents.find(a=>a.team===0&&a.type==='rock').team=1;extinct.agents.find(a=>a.team===1&&a.type==='paper').team=0;extinct.elapsed=.125;extinct.recordHistory();
assert.deepEqual(extinct.deathEvents.map(e=>[e.team,e.type,e.time]),[[0,'rock',.125],[1,'paper',.125]]);assert.equal(extinct.history.at(-1).time,.125);
extinct.recordHistory(true);assert.equal(extinct.deathEvents.length,2);
for(let i=1;i<2000;i++){extinct.elapsed=i;extinct.recordHistory();}assert.equal(extinct.deathEvents[0].time,.125);assert.equal(extinct.deathEvents.length,2);
console.log('Passed exact extinction markers: simultaneous losses, no duplicates, event samples and persistence after history reduction.');
