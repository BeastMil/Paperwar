(()=>{
 const room=new URLSearchParams(location.search).get('room');
 const net=window.Multiplayer={active:Boolean(room),room,seat:0,joined:false,ready:false,connected:false,peer:false,socket:null,onState:()=>{},onChange:()=>{},lastRound:-1};
 let retry=0,closed=false;
 net.send=data=>{if(net.socket?.readyState===WebSocket.OPEN)net.socket.send(JSON.stringify(data));};
 net.connect=()=>{
  if(!net.active)return;
  net.onChange('Verbinde mit dem Spielraum …');
  const ws=net.socket=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/play');
  ws.onopen=()=>{retry=0;net.connected=true;ws.send(JSON.stringify({type:'join',room,token:sessionStorage.getItem('rival-seat-'+room)}));};
  ws.onmessage=e=>{
   let msg;try{msg=JSON.parse(e.data);}catch{return;}
   if(msg.type==='joined'){net.seat=msg.seat;net.joined=true;sessionStorage.setItem('rival-seat-'+room,msg.token);net.onChange('Verbunden. Teile den Raumlink mit deinem Freund.');}
   else if(msg.type==='state'){net.ready=msg.ready[net.seat];net.peer=msg.connected[1-net.seat];net.onState(msg);}
   else if(msg.type==='error'){net.onChange(msg.message);if(/voll|nicht gefunden|abgelaufen/.test(msg.message)){closed=true;ws.close();}}
  };
  ws.onclose=e=>{net.connected=false;net.joined=false;if(e.code===4000)closed=true;net.onChange(closed?'Verbindung beendet. Öffne einen neuen Raum oder kehre zum Einzelspiel zurück.':'Verbindung verloren. Verbinde erneut …');if(!closed)setTimeout(net.connect,Math.min(5000,500*2**retry++));};
  ws.onerror=()=>{};
 };
 net.create=async()=>{
  const res=await fetch('/api/rooms',{method:'POST'});if(!res.ok)throw Error('Raum konnte nicht erstellt werden. Bitte später erneut versuchen.');
  const data=await res.json();location.href='/?room='+encodeURIComponent(data.id);
 };
 net.share=async()=>{const url=location.origin+'/?room='+encodeURIComponent(room);try{await navigator.clipboard.writeText(url);net.onChange('Einladungslink kopiert.');}catch{net.onChange('Kopiere den Link aus dem Raumlink-Feld.');}return url;};
})();
