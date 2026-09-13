const {randomBytes}=require('node:crypto');
const Rival=require('./simulation.js');
const WIDTH=1600,HEIGHT=800,TOTAL=100;
function cleanPlan(input){
  if(!Array.isArray(input)||input.length!==3)throw Error('Genau drei Geschwader erforderlich.');
  const groups=input.map(g=>{
    if(!g||!Rival.TYPES.includes(g.type))throw Error('Ungültiger Truppentyp.');
    const result={type:g.type};
    for(const field of ['x','y','w','h','count','angle','spacingX']){
      const value=g[field]??(field==='angle'?0:NaN);
      if(typeof value!=='number'||!Number.isFinite(value))throw Error('Ungültige Formation.');
      result[field]=value;
    }
    if(!Number.isInteger(result.count)||result.count<1||result.count>100||Math.abs(result.spacingX-9.75)>1e-6||Math.abs(result.angle)>Math.PI*2)throw Error('Ungültige Truppenanzahl oder Abstände.');
    return result;
  });
  const error=Rival.validatePlan(groups,TOTAL);if(error)throw Error(error);
  return groups;
}
function createBattle(plans){
  const sim=Rival.verticalFormation(plans[0],[],TOTAL);Rival.fitBattle(sim,2);
  const opponent=Rival.verticalFormation(plans[1],[],TOTAL);Rival.fitBattle(opponent,2);
  sim.agents.push(...opponent.agents.map(a=>({...a,team:1,x:WIDTH-a.x,y:HEIGHT-a.y,vx:-a.vx,vy:-a.vy})));
  return sim;
}
class Room {
  constructor(){this.id=randomBytes(9).toString('base64url');this.seats=[null,null];this.phase='setup';this.sim=null;this.updated=Date.now();this.cooldowns=[0,0];this.round=0;}
  connect(socket,token){
    let seat=this.seats.findIndex(s=>s&&s.token===token);
    if(seat<0){seat=this.seats.findIndex(s=>!s);if(seat<0)throw Error('Dieser Raum ist bereits voll.');this.seats[seat]={token:randomBytes(24).toString('base64url'),socket:null,plan:null};}
    const player=this.seats[seat];if(player.socket&&player.socket!==socket)player.socket.close(4000,'Auf anderem Tab geöffnet.');
    player.socket=socket;player.absentAt=0;this.updated=Date.now();return {seat,token:player.token};
  }
  ready(seat,plan){if(this.phase!=='setup')throw Error('Die Schlacht läuft bereits.');this.seats[seat].plan=cleanPlan(plan);
    if(this.seats.every(s=>s?.socket&&s.plan)){this.sim=createBattle(this.seats.map(s=>s.plan));this.cooldowns=[0,0];this.phase='battle';this.round++;}
  }
  reset(){this.phase='setup';this.sim=null;for(const s of this.seats)if(s)s.plan=null;this.updated=Date.now();}
  connected(){return this.seats.every(s=>s?.socket?.readyState===1);}
  pulse(seat,x,y,now){
    if(this.phase!=='battle'||!this.connected()||this.sim.result)return false;
    if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>WIDTH||y>HEIGHT)return false;
    this.sim.pulseReadyAt=this.cooldowns[seat];const applied=this.sim.pulse(x,y,now);
    if(applied){this.cooldowns[seat]=now+1.25;this.sim.pulseWaves.at(-1).team=seat;}return applied;
  }
  snapshot(seat,now){
    const base={type:'state',phase:this.phase,round:this.round,connected:this.seats.map(s=>Boolean(s?.socket?.readyState===1)),ready:this.seats.map(s=>Boolean(s?.plan)),cooldown:Math.max(0,this.cooldowns[seat]-now)};
    if(this.phase!=='battle')return base;
    const s=this.sim;return {...base,width:s.width,height:s.height,elapsed:s.elapsed,result:s.result,battlePhase:s.phase,conversions:s.conversions,agents:s.agents,waves:(s.pulseWaves||[]).filter(w=>now-w.createdAt<.9).map(w=>({x:w.x,y:w.y,radius:w.radius,team:w.team,age:now-w.createdAt}))};
  }
}
module.exports={Room,cleanPlan,createBattle};
