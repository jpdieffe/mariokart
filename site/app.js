import { Game } from './emulator.js';
import { Room } from './room.js';
import { parseRoomCode } from './protocol.js';
import { setupControls } from './controls.js';
import { levels, levelData } from './levels.js';
import {NativeMemory,teamScores} from './native-memory.js';
import {Presentation} from './presentation.js';
import {NativeBattle} from './native-battle.js';

const $ = selector => document.querySelector(selector);
const game = new Game();
const presentation=new Presentation();
let memory=null,matchMode='classic',arena='original',battle=null,matchFinished=false,changingRace=false;
function matchState(){
 const s=memory?.inspect();if(!s)return null;
 const racing=[2,14].includes(s.phase)&&s.players===0;
 let lines=[];
 let winner=null;
 const b=battle?.state();
 if(b?.active){lines=b.racers.map(r=>`${r.player?'P'+r.player:'CPU'} ${r.name}: ${r.hp}/3`);winner=b.winner;if(winner)lines.unshift(winner);}
 if(matchMode==='team-gp'&&s.mode===0&&[2,10,12].includes(s.phase))lines=teamScores(s.racers).map(t=>`${t.name}: ${t.points} pts`);
 return{mode:matchMode,racing,track:Math.min(23,s.track),lines,winner};
}
function showMatch(data){presentation.racing=data.racing;const panel=$('#match-score');panel.replaceChildren();for(const text of data.lines){const line=document.createElement('span');line.textContent=text;panel.append(line);}panel.hidden=!data.lines.length;$('#rematch-button').hidden=!data.winner||mode==='guest';}
let room = null;
let mode = 'lobby';
let networkSettings = {};
let muted = false;
let busy = false;
let wakeLock;
let remoteStream;
let videoStartTimeout;
let hostNeedsAudio = false;
let lastJoinedCode;
function announceHostAudio() {
  if (mode !== 'host' || !room?.accepted) return;
  room.broadcast(game.audioBlocked ? 'The host needs to tap “Enable game sound” on their phone to start the game.' : 'Connected. Player two uses controller port two.',game.audioBlocked ? 'audio-blocked' : 'playing');
}
function showHostAudioWait() {
  screenMessage('Waiting for a tap on the host phone.','Ask the host to tap “Enable game sound”. Your room is connected.');
  status('The host needs to enable game sound before play can begin.');
}
function refreshHostAudio() {
  if (!game.ready || mode === 'guest') return;
  $('#resume-audio').hidden = !game.audioBlocked || muted;
  $('#sound-button').textContent = muted ? 'Sound off' : game.audioBlocked ? 'Enable sound' : 'Sound on';
  $('#sound-button').setAttribute('aria-pressed',String(muted));
  announceHostAudio();
}
game.onAudioStateChange = refreshHostAudio;
const controls = setupControls(mask => { if (mode === 'guest') room?.setInput(mask); else game.input(0,mask); });
function status(message, kind = '') { $('#status').textContent = message; $('#status').className = `status ${kind}`; }
function connection(message) { $('#connection').lastChild.textContent = ` ${message}`; }
function screenMessage(message, detail = '') { $('#screen-message').hidden = false; $('#screen-status').textContent = message; $('#screen-detail').textContent = detail; }
function error(error) { status(error.message || error,'error'); }
function guard(fn) { return (...args) => Promise.resolve().then(() => fn(...args)).catch(error); }
async function wake() {
  try { if (navigator.wakeLock && document.visibilityState === 'visible') wakeLock = await navigator.wakeLock.request('screen'); } catch {}
}
function showPlayer() {
  document.body.classList.add('playing'); $('#lobby').hidden = true; $('#play-area').hidden = false;
  $('#player-label').textContent = mode === 'guest' ? 'PLAYER 2' : 'PLAYER 1';
  $('#levels-button').hidden = mode === 'guest';
  $('#remote-video').hidden = mode !== 'guest'; $('#emulator').hidden = mode === 'guest';
  $('#sound-button').textContent = mode === 'guest' ? 'Enable sound' : 'Sound on';
  $('#retry-button').hidden = true;
  controls.enable(true); wake();
}
function busyLobby(value) {
  busy = value;
  for (const id of ['host-button','solo-button','join-button']) $(`#${id}`).disabled = value;
}
function streamToGuest() {
  if (!game.ready || !room?.accepted || mode !== 'host') return;
  try { game.resumeAudio(); room.stream(game.capture()); announceHostAudio(); }
  catch (e) { error(e); room.broadcast(e.message); }
}
function makeRoom() {
  const instance = new Room({
    match:showMatch,
    status: (message, phase) => {
      if (room !== instance) return;
      status(message);
      if (mode !== 'guest') return;
      if (phase) hostNeedsAudio = phase === 'audio-blocked';
      if (hostNeedsAudio) showHostAudioWait();
      else if (!remoteStream || $('#remote-video').readyState < 2) screenMessage(instance.accepted ? 'Room connected. Waiting for game…' : 'Connecting to the host…',message);
      else if (phase === 'playing') $('#screen-message').hidden = true;
    },
    error: message => {
      if (room === instance) {
        error(message); connection('Connection needs attention');
        if (mode === 'guest') $('#retry-button').hidden = false;
        if (mode === 'guest' && !remoteStream) screenMessage('Could not connect to the game.',message);
      }
    },
    input: mask => { if (room === instance && mode === 'host') game.input(1,document.hidden || document.querySelector('dialog[open]') ? 0 : mask); },
    connected: () => {
      if (room !== instance) return;
      connection('Two players connected');
      status(mode === 'host' ? 'Player two joined. Choose 2P GAME in the original menu.' : 'Connected! Waiting for the host’s game stream…','success');
      if (mode === 'host') {
        if (!game.ready) room.broadcast('The host is still loading the game. Keep the host tab open.');
        streamToGuest();
      } else screenMessage('Room connected. Waiting for game…','Keep the host’s game visible. Video can start before sound is enabled.');
    },
    stream: stream => {
      if (room !== instance || mode !== 'guest') return;
      remoteStream = stream;
      const video = $('#remote-video'); video.srcObject = stream; video.muted = true;
      presentation.setSource(video,1);
      clearTimeout(videoStartTimeout);
      videoStartTimeout = setTimeout(() => {
        if (room === instance && !hostNeedsAudio && video.readyState < 2) screenMessage('Connected, but no game picture yet.','Ask the host to return to the game. If this persists, leave and try a new room on Wi-Fi.');
      },20000);
      video.onplaying = () => { clearTimeout(videoStartTimeout); if (hostNeedsAudio) showHostAudioWait(); else $('#screen-message').hidden = true; };
      video.play().catch(() => { $('#resume-video').hidden = false; });
      $('#resume-video').hidden = false;
      status('You are player two. Select your driver with the D-pad and B.','success');
      if (hostNeedsAudio) showHostAudioWait();
    },
    mediaClosed: () => { if (room === instance && mode === 'guest') { $('#retry-button').hidden = false; screenMessage('Game stream stopped.','Tap Retry to reconnect to the host.'); } },
    disconnected: () => {
      if (room !== instance) return;
      clearTimeout(videoStartTimeout);
      hostNeedsAudio = false;
      controls.clear(); game.input(1,0);
      connection(mode === 'host' ? 'Waiting for player two' : 'Disconnected');
      $('#latency').textContent = 'DISCONNECTED';
      if (mode === 'host') { game.stopCapture(); status('Player two left. You can keep playing; your room link still works.'); }
      else { $('#remote-video').srcObject = null; remoteStream = null; $('#retry-button').hidden = false; screenMessage('The other player disconnected.','Tap Retry when your host is ready.'); status('The room connection closed. Tap Retry to join again.','error'); }
    },
    latency: ms => { if (room === instance) $('#latency').textContent = `${ms} MS · ROUND TRIP`; },
  }, networkSettings);
  room = instance; return instance;
}
async function launch(modeToUse, code) {
  if (busy) return;
  busyLobby(true); mode = modeToUse; showPlayer();
  if(mode!=='guest'){
    matchMode=$('#game-mode').value;arena=$('#arena-choice').value;
    if(matchMode==='team-gp')arena='original';
    game.romUrl=matchMode.startsWith('battle-')||arena!=='original'?`./roms/enhanced-${arena}.sfc`:'./roms/super-mario-kart.zip';
  }
  if (mode === 'guest') lastJoinedCode = code;
  try {
    if (mode === 'guest' || mode === 'host') {
      connection('Opening room…');
      screenMessage(mode === 'guest' ? 'Finding your race…' : 'Making room for two…','Connecting to the room service.');
      const instance = makeRoom();
      const roomCode = await instance.open(mode === 'host',code);
      if (instance !== room) return;
      $('#room-label').textContent = `ROOM ${roomCode}`;
      if (mode === 'host') {
        $('#invite-button').hidden = false;
        connection('Waiting for player two');
        status('Your room is ready. Tap Invite to send its link to your friend.');
      } else {
        connection('Joining room…');
        screenMessage('Waiting for the host…','The game will appear here when the direct connection is ready.');
        return;
      }
    } else {
      $('#room-label').textContent = 'Solo game'; connection('Solo game');
      status('Use Start to begin, or open Race menu for a quick start.');
    }
    screenMessage('Starting Super Mario Kart…','Loading the SNES emulator. The first start can take a few moments.');
    // Let EmulatorJS show its own progress, then remove its loading UI on start.
    $('#screen-message').hidden = true;
    await game.start();
    game.resumeAudio();
    presentation.setSource(game.emulator.canvas,0);
    if(mode==='host')streamToGuest();
    await new Promise(resolve=>setTimeout(resolve,1600));
    for(let attempt=0;attempt<120;attempt++){try{memory=new NativeMemory(game.manager);break;}catch(e){if(!e.notReady)throw e;await new Promise(resolve=>setTimeout(resolve,250));}}
    if(!memory)throw Error('Tap Enable game sound, then reload if the game does not start.');
    if(matchMode.startsWith('battle-'))battle=new NativeBattle(memory,{teams:matchMode==='battle-teams'});
    if(matchMode!=='classic')await startRace(matchMode==='team-gp'?'grand-prix':`battle-${arena}`);
    if (document.hidden) game.pause(true);
  } catch (e) {
    room?.close(); room = null;
    connection('Could not start');
    screenMessage('Could not start the game.',e.message);
    error(e);
    if (mode === 'guest') $('#retry-button').hidden = false;
    if (!game.startPromise) {
      mode = 'lobby'; document.body.classList.remove('playing'); $('#lobby').hidden = false; $('#play-area').hidden = true; controls.enable(false);
    }
  } finally { busyLobby(false); }
}
$('#host-button').addEventListener('click',() => launch('host'));
$('#solo-button').addEventListener('click',() => launch('solo'));
$('#retry-button').addEventListener('click',() => {
  if (busy || mode !== 'guest' || !lastJoinedCode) return;
  controls.clear(); const previousRoom=room;room=null;previousRoom?.close();
  clearTimeout(videoStartTimeout);remoteStream=null;hostNeedsAudio=false;
  $('#remote-video').pause();$('#remote-video').srcObject=null;$('#resume-video').hidden=true;
  launch('guest',lastJoinedCode);
});
$('#join-form').addEventListener('submit',e => {
  e.preventDefault();
  const code = parseRoomCode($('#room-code').value);
  if (!code) { status('Enter the 2-character room code, or paste the full invite link.','error'); $('#room-code').focus(); return; }
  launch('guest',code);
});
$('#invite-button').addEventListener('click',guard(async () => {
  const url = new URL(location.href); url.hash = new URLSearchParams({room:room.code}).toString();
  if (navigator.share && matchMedia('(pointer:coarse)').matches) {
    try { await navigator.share({title:'Super Mario Kart · Join my race',url:url.href}); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(url.href); status('Invite link copied. Send it to your player two.','success'); }
  catch { status(`Invite your friend with this room code: ${room.code}`); }
}));
$('#leave-button').addEventListener('click',() => {
  controls.clear(); room?.close(); game.release(); game.stopCapture(); wakeLock?.release();
  location.replace(location.pathname + location.search);
});
async function enableVideo() {
  const video = $('#remote-video');
  video.muted = false; await video.play();
  muted = false; $('#sound-button').textContent = 'Sound on'; $('#sound-button').setAttribute('aria-pressed','false'); $('#resume-video').hidden = true;
}
$('#resume-video').addEventListener('click',guard(enableVideo));
$('#resume-audio').addEventListener('click',() => game.resumeAudio());
$('#sound-button').addEventListener('click',guard(async () => {
  if (mode === 'guest') {
    if (!remoteStream) { status('Sound will be available when the host’s stream arrives.'); return; }
    if ($('#remote-video').muted) { await enableVideo(); return; }
    muted = true; $('#remote-video').muted = true;
  } else {
    const needsAudio = game.audioBlocked;
    game.resumeAudio();
    muted = needsAudio ? false : !muted;
    game.setMuted(muted);
    refreshHostAudio();
    if (mode === 'host' && muted) status('Game sound is muted for both players.');
    return;
  }
  $('#sound-button').textContent = muted ? 'Sound off' : 'Sound on'; $('#sound-button').setAttribute('aria-pressed',String(muted));
}));
$('#fullscreen-button').addEventListener('click',guard(async () => {
  if (document.fullscreenElement) { await document.exitFullscreen(); return; }
  if (document.documentElement.requestFullscreen) {
    await document.documentElement.requestFullscreen();
    try { await screen.orientation?.lock?.('landscape'); } catch {}
  } else status('On iPhone, rotate sideways. Add to Home Screen from Safari’s Share menu for more space.');
}));
$('#portrait-continue').addEventListener('click',() => document.body.classList.add('allow-portrait'));
function openDialog(selector) {
  controls.clear(); game.release(); $(selector).showModal();
  if (game.ready && mode !== 'guest') { game.pause(true); room?.broadcast('The host opened a menu. The game is paused.'); }
}
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('close',() => {
  if (game.ready && mode !== 'guest' && !document.hidden && !document.querySelector('dialog[open]') && !matchFinished) { game.pause(false); room?.broadcast('The host is back. Let’s play!'); }
}));
$('#help-button').addEventListener('click',() => openDialog('#help-dialog'));
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click',() => button.closest('dialog').close()));
$('#network-form').addEventListener('submit',e => {
  e.preventDefault();
  const settings = Object.fromEntries(new FormData(e.target));
  if (settings.turn && !/^turns?:[^\s]+$/.test(settings.turn)) { status('Enter a TURN URL beginning with turn: or turns:.','error'); return; }
  if (settings.host && /[\s/:]/.test(settings.host)) { status('Enter just the PeerServer hostname, without https:// or a path.','error'); return; }
  networkSettings = {...settings,port:Number(settings.port) || 443};
  $('#help-dialog').close(); status('Connection settings updated for the next room.','success');
});
async function startRace(id){
  controls.clear();game.pause(true);changingRace=true;
  try {
    if(id==='original')game.manager.restart();
    else game.load(await levelData(id));
    battle?.reset();matchFinished=false;
  } finally {changingRace=false;}
  $('#levels-dialog').close();
  if(!document.hidden)game.pause(false);
  status(id==='original'?'Choose your drivers and mode in the original menus.':'Ready to drive. Hold B / GAS to accelerate.','success');
}
async function renderRaces(){
 const list=$('#checkpoint-list');list.replaceChildren();
 const choices=[{id:'original',name:'Original menus',description:'Choose drivers, cups, and courses'},...levels.filter(l=>l.id==='grand-prix'||l.id===`battle-${arena}`)];
 for(const entry of choices){const row=document.createElement('div');row.className='checkpoint-row';const name=document.createElement('div');name.className='checkpoint-name';const title=document.createElement('b');title.textContent=entry.name;const description=document.createElement('small');description.textContent=entry.description;name.append(title,description);const button=document.createElement('button');button.textContent='Play';button.setAttribute('aria-label','Play '+entry.name);button.onclick=guard(async()=>{button.disabled=true;try{await startRace(entry.id);}finally{button.disabled=false;}});row.append(name,button);list.append(row);}
}
$('#levels-button').addEventListener('click',guard(async()=>{if(!game.ready)return;openDialog('#levels-dialog');await renderRaces();}));
document.addEventListener('visibilitychange',() => {
  if (mode === 'lobby') return;
  if (mode !== 'guest') {
    game.pause(matchFinished || document.hidden || !!document.querySelector('dialog[open]'));
    room?.broadcast(document.hidden ? 'The host switched tabs. Waiting for the host to return…' : 'The host is back. Let’s play!');
  }
  if (!document.hidden) wake();
});
window.addEventListener('pagehide',() => { room?.close(); game.release(); game.stopCapture(); wakeLock?.release(); });
window.addEventListener('pointerdown',event => { if (game.ready && mode !== 'guest' && !event.target.closest('#sound-button')) game.resumeAudio(); },{passive:true});
const invite = parseRoomCode(new URLSearchParams(location.hash.slice(1)).get('room') || '');
if (invite) { $('#room-code').value = invite; status('You have an invite. Tap Join to play as player two.'); }
$('#view-button').onclick=()=>{presentation.mode=presentation.mode==='driver'?'full':'driver';$('#view-button').textContent=presentation.mode==='driver'?'Both screens':'Your view';};
setInterval(()=>{if(memory&&mode!=='guest'){const data=matchState();showMatch(data);room?.send({type:'match',match:data});}},150);
if(new URLSearchParams(location.search).has('debug'))window.kart={game,get memory(){return memory;},get room(){return room;},get match(){return matchState();},get battle(){return battle;},presentation};
$('#rematch-button').onclick=guard(()=>startRace(`battle-${arena}`));
function tickBattle(){if(battle&&!matchFinished&&!changingRace){battle.tick();if(battle.winner){matchFinished=true;game.pause(true);showMatch(matchState());}}requestAnimationFrame(tickBattle);}requestAnimationFrame(tickBattle);

$('#game-mode').onchange=()=>{$('#arena-choice').disabled=$('#game-mode').value==='team-gp';};
