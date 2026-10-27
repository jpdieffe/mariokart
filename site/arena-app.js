import {ArenaWorld,TERRAIN,PICKUPS,COLORS,NAMES} from './arena-world.js';
import {ArenaRenderer} from './arena-render.js';
import {Room} from './room.js';
import {setupControls} from './controls.js';
import {parseRoomCode} from './protocol.js';

const $=s=>document.querySelector(s),debug=new URLSearchParams(location.search).has('debug');
let world=null,view=null,room=null,state=null,mode=null,inputs=[0,0],overview=false,settings={},opening=false,session=0,last=performance.now(),acc=0,sendClock=0,hudClock=0,received=0,sound=false,audio=null,engine=null,volume=null,previousHp=3,previousItem=null;
const controls=setupControls(mask=>{inputs[mode==='guest'?1:0]=mask;if(mode==='guest')room?.setInput(mask);});
const status=text=>{$('#status').textContent=text;};
function expose(){if(debug)window.arena={get world(){return world;},get view(){return view;},get room(){return room;},get state(){return state;},get mode(){return mode;},get inputs(){return inputs;}};}
expose();
function beep(frequency,duration=.12){if(!sound||!audio||audio.state!=='running')return;const osc=audio.createOscillator(),gain=audio.createGain();osc.frequency.value=frequency;gain.gain.setValueAtTime(.08,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);osc.connect(gain).connect(audio.destination);osc.start();osc.stop(audio.currentTime+duration);osc.onended=()=>{osc.disconnect();gain.disconnect();};}
async function toggleSound(){try{if(!audio){audio=new AudioContext();engine=audio.createOscillator();engine.type='triangle';volume=audio.createGain();volume.gain.value=0;engine.connect(volume).connect(audio.destination);engine.start();}await audio.resume();sound=!sound;$('#sound-button').textContent=sound?'Mute':'Sound on';$('#sound-button').setAttribute('aria-pressed',String(sound));if(!sound)volume.gain.value=0;}catch{status('Sound could not start. Driving is still available.');}}
function closeSession(){session++;room?.close();room=null;controls.enable(false);view?.dispose();view=null;world=null;state=null;mode=null;inputs=[0,0];acc=0;if(volume)volume.gain.value=0;}
function refreshButtons(){const host=mode!=='guest';$('#rematch-button').hidden=!host;$('#invite-button').hidden=mode!=='host'||!room?.code;$('#room-label').textContent=room?.code?`ROOM ${room.code}`:'PRACTICE';$('#player-label').textContent=mode==='guest'?'LUIGI / P2':'MARIO / P1';}
async function launch(next,code){
  if(opening)return;opening=true;closeSession();const token=session;mode=next;overview=false;received=0;previousHp=3;previousItem=null;
  $('#view-button').textContent='Arena view';$('#retry-button').hidden=true;$('#lobby').hidden=true;$('#play-area').hidden=false;document.body.classList.add('playing');$('#result').hidden=true;
  try{
    view=new ArenaRenderer($('#screen'));
    if(next!=='guest'){world=new ArenaWorld($('#game-mode').value==='teams');state=world.snapshot();}
    refreshButtons();controls.enable(true);status(next==='solo'?'Practice: collect a box, take a ramp, and pop the bots’ balloons.':'Connecting to the room service…');
    if(next!=='solo'){
      const current=new Room({
        status:text=>{if(token===session)status(text);},
        error:text=>{if(token!==session)return;status(text);$('#retry-button').hidden=false;},
        connected:()=>{if(token!==session)return;if(world){world.guestActive(true);current.send({type:'arena',frame:world.snapshot()});}status('Two players connected. You each have your own camera.');$('#retry-button').hidden=true;},
        input:mask=>{if(token===session)inputs[1]=mask;},
        arena:frame=>{if(token!==session)return;if(!received)status('Battle live. You’re Luigi, with your own camera.');state=frame;received=performance.now();},
        disconnected:()=>{if(token!==session)return;inputs[1]=0;if(world)world.guestActive(false);status(world?'Your friend disconnected. The room stays open for them.':'Disconnected from the host. Tap Reconnect to rejoin.');$('#retry-button').hidden=!!world;},
        latency:ms=>{$('#latency').textContent=`${ms} ms`;},
      },{...settings,mode:'arena3d'});room=current;
      await current.open(next==='host',code);if(token!==session)return;refreshButtons();
      if(!current.accepted)status(next==='host'?`Room ${current.code} is open. Send the invite link to your friend.`:'Connecting to your friend…');
      if(next==='host')history.replaceState(null,'',`${location.pathname}${location.search}#room=${current.code}`);
    }
  }catch(error){if(token===session){status(error.message||'The arena could not start. Try a browser with WebGL 2 enabled.');$('#retry-button').hidden=false;}}
  finally{if(token===session)opening=false;}
}
$('#host-button').onclick=()=>launch('host');$('#solo-button').onclick=()=>launch('solo');
$('#join-form').onsubmit=e=>{e.preventDefault();const raw=$('#room-code').value,code=parseRoomCode(raw);if(!code){status('Enter the two-character code from a 3D arena room.');return;}if(/^https?:/i.test(raw)){try{const url=new URL(raw);if(!url.pathname.endsWith('arena.html')){status('That invite is for the original game. Open it in the original SNES game.');return;}}catch{}}
  history.replaceState(null,'',`${location.pathname}${location.search}#room=${code}`);launch('guest',code);};
$('#leave-button').onclick=()=>{closeSession();opening=false;$('#play-area').hidden=true;$('#lobby').hidden=false;document.body.classList.remove('playing');history.replaceState(null,'',location.pathname+location.search);status('Back in the pit stop.');};
$('#retry-button').onclick=()=>{if(mode==='host'&&room?.peer?.open){status(`Room ${room.code} is still open. Ask your friend to join again.`);$('#retry-button').hidden=true;return;}launch(mode||'solo',room?.code||parseRoomCode($('#room-code').value));};
$('#rematch-button').onclick=()=>{world?.reset();inputs=[0,0];controls.clear();state=world?.snapshot();previousHp=3;previousItem=null;status('New battle! All drivers start with empty item slots.');};
$('#view-button').onclick=()=>{overview=!overview;$('#view-button').textContent=overview?'Your camera':'Arena view';};
$('#sound-button').onclick=toggleSound;
$('#fullscreen-button').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('#play-area').requestFullscreen();}catch{status('Fullscreen is unavailable here. Rotate your phone sideways for a wider view.');}};
$('#invite-button').onclick=async()=>{const url=new URL('arena.html',location.href);url.hash=`room=${room.code}`;try{if(navigator.share)await navigator.share({title:'Sky Plaza — join my battle',url:url.href});else{await navigator.clipboard.writeText(url.href);status('Invite link copied.');}}catch{status(`Invite your friend: ${url.href}`);}};
$('#help-button').onclick=()=>{$('#help-dialog').showModal();controls.clear();};$('#close-help').onclick=()=>$('#help-dialog').close();
$('#network-form').onsubmit=e=>{e.preventDefault();settings=Object.fromEntries(new FormData(e.target));if(settings.port)settings.port=Number(settings.port);$('#help-dialog').close();status('Connection settings saved for the next room.');};
document.addEventListener('visibilitychange',()=>{controls.clear();if(document.hidden&&volume)volume.gain.value=0;if(world)room?.broadcast(document.hidden?'Host paused. Ask them to return to the game tab.':'Host returned. Battle resumed.');last=performance.now();acc=0;});
window.addEventListener('pagehide',()=>room?.close());
const code=parseRoomCode(new URLSearchParams(location.hash.slice(1)).get('room')||'');if(code){$('#room-code').value=code;status(`Room ${code} is ready to join. Tap Join.`);}
const map=$('#minimap').getContext('2d');
function hud(s){
  const player=mode==='guest'?1:0,k=s.karts[player];$('#speed').textContent=Math.round(Math.abs(k.speed)*3);$('#height-label').textContent=k.y>12?'SKY DECK · 14 M':k.y>5?'TERRACE · 7 M':'GROUND';$('#item-label').textContent=k.item?`${k.item.toUpperCase()} · X / ITEM`:'Find an item box';
  const score=$('#match-score');score.replaceChildren(...s.karts.filter(p=>p.active).map(p=>{const span=document.createElement('span');span.style.color=`#${COLORS[p.id].toString(16).padStart(6,'0')}`;span.textContent=`${NAMES[p.id]} ${p.hp?'●'.repeat(p.hp):'OUT'}`;return span;}));
  $('#result').hidden=!s.winner&&k.hp>0;$('#winner').textContent=s.winner||'You’re out — spectating';$('#result-detail').textContent=s.winner?(mode==='guest'?'Your host can restart the battle.':'Tap Restart for another battle.'):'Your camera follows a surviving driver.';
  map.clearRect(0,0,180,180);map.save();map.translate(90,90);map.scale(.94,.94);map.fillStyle='#b6b69b';map.fillRect(-88,-88,176,176);
  for(const t of TERRAIN){map.fillStyle=t.axis?'#eea664':t.id==='sky'?'#f8d369':'#69b4a2';map.fillRect(t.x,t.z,t.w,t.d);}
  for(let i=0;i<PICKUPS.length;i++)if(s.pickups[i].ready){const p=PICKUPS[i];map.fillStyle='#21699a';map.fillRect(p.x-2,p.z-2,4,4);}
  for(const p of s.karts)if(p.active&&p.hp){map.save();map.translate(p.x,p.z);map.rotate(-p.angle);map.fillStyle=`#${COLORS[p.id].toString(16).padStart(6,'0')}`;map.strokeStyle=p.id===player?'white':'#174138';map.lineWidth=1.4;map.beginPath();map.moveTo(0,5);map.lineTo(4,-4);map.lineTo(-4,-4);map.closePath();map.fill();map.stroke();map.restore();}map.restore();
  if(k.hp<previousHp)beep(140,.3);if(k.item&&!previousItem)beep(740,.1);previousHp=k.hp;previousItem=k.item;
  if(volume){volume.gain.setTargetAtTime(sound&&k.hp&&!s.winner&&!document.hidden ? .018 : 0,audio.currentTime,.1);engine.frequency.setTargetAtTime(45+Math.abs(k.speed)*3,audio.currentTime,.08);}
}
function frame(now){
  requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.1);last=now;
  if(!view||document.hidden)return;
  if(world){acc+=dt;while(acc>=1/60){world.step(1/60,inputs);acc-=1/60;}state=world.snapshot();sendClock+=dt;if(sendClock>=1/20){sendClock=0;if(room?.accepted&&(room.connection?.bufferSize||0)<3)room.send({type:'arena',frame:state});}}
  if(state){view.render(state,mode==='guest'?1:0,dt,overview);hudClock+=dt;if(hudClock>.1){hudClock=0;hud(state);}}
  if(mode==='guest'&&room?.accepted&&received&&now-received>3000){status('Waiting for the host to return to the game…');received=0;}
}
requestAnimationFrame(frame);
