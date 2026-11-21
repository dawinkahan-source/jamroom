'use strict';
const $=id=>document.getElementById(id);
const socket=io({reconnection:true});
let code='', state=null, player=null, ytReady=false, playerReady=false, loadedId='', offsetMs=0, rttMs=0, audio=null, localVolume=.65, nextBeat=-1, metroTimer=null, appliedPlayKey='', latestVideo='', toastTimeout=null, tapTimes=[], autoSession=null, initialRoom=(new URLSearchParams(location.search)).get('room');
let userName=localStorage.getItem('jamroom-name')||''; $('name').value=userName; if(initialRoom) $('roomInput').value=initialRoom;
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('toast').classList.remove('show'),3300)}
function serverNow(){return Date.now()+offsetMs}
function send(type,extra={}){if(!code)return toast('เข้าห้องก่อนนะ');socket.emit('room:update',{type,...extra},reply=>{if(!reply?.ok)toast(reply?.error||'เกิดข้อผิดพลาด')})}
function extractVideoId(raw){try{let url=new URL(raw.trim());let host=url.hostname.toLowerCase().replace(/^www\./,'').replace(/^m\./,'');if(host==='youtu.be')return valid(url.pathname.split('/')[1]);if(host==='youtube.com'||host==='music.youtube.com'||host==='youtube-nocookie.com'){if(url.pathname==='/watch')return valid(url.searchParams.get('v'));let bits=url.pathname.split('/');if(['embed','shorts','live'].includes(bits[1]))return valid(bits[2])}}catch{}return valid(raw.trim())}
function valid(id){return /^[a-zA-Z0-9_-]{11}$/.test(id||'')?id:null}
function join(room){const name=($('name').value.trim()||'เพื่อนนักดนตรี').slice(0,24);localStorage.setItem('jamroom-name',name);socket.emit('room:join',{room,name},response=>{if(!response?.ok)return toast(response?.error||'เข้าห้องไม่ได้');code=response.room;history.replaceState(null,'',`${location.pathname}?room=${encodeURIComponent(code)}`);$('roomInput').value=code;renderRoom();applyState(response.state);toast(`เข้าห้อง ${code} แล้ว`);ensureAudio()})}
$('create').onclick=()=>join(Math.random().toString(36).slice(2,8).toUpperCase());$('join').onclick=()=>join($('roomInput').value);$('roomInput').addEventListener('keydown',e=>{if(e.key==='Enter')join($('roomInput').value)});
$('copy').onclick=async()=>{if(!code)return toast('สร้างห้องก่อน');try{await navigator.clipboard.writeText(`${location.origin}${location.pathname}?room=${code}`);toast('คัดลอกลิงก์ชวนเพื่อนแล้ว')}catch{toast('คัดลอกไม่ได้ ลองคัดลอกจากช่อง URL')}};
$('copyCode').onclick=async()=>{if(!code)return toast('สร้างห้องก่อน');try{await navigator.clipboard.writeText(code);toast('คัดลอกรหัสห้องแล้ว')}catch{toast(code)}};
$('load').onclick=()=>{let id=extractVideoId($('youtube').value);if(!id)return toast('ลิงก์ YouTube ไม่ถูกต้อง');send('video',{videoId:id})};
$('youtube').addEventListener('keydown',e=>{if(e.key==='Enter')$('load').click()});
$('play').onclick=()=>{ensureAudio();send('play',{position:state?.playing?estimatedPosition():playerReady?player.getCurrentTime():state?.position||0})};
$('pause').onclick=()=>send('pause');$('restart').onclick=()=>send('restart');$('resync').onclick=()=>{appliedPlayKey='';syncVideo(true);toast('พยายามซิงก์ YouTube เครื่องนี้แล้ว')};
$('seek').addEventListener('change',()=>{const duration=playerReady?player.getDuration():0;if(duration)send('seek',{position:Number($('seek').value)})});
$('minus').onclick=()=>send('bpm',{bpm:(state?.bpm||120)-1});$('plus').onclick=()=>send('bpm',{bpm:(state?.bpm||120)+1});
$('bpmSlider').onchange=()=>send('bpm',{bpm:Number($('bpmSlider').value)});
$('timeSig').onchange=()=>send('beats',{beats:Number($('timeSig').value)});
$('metro').onclick=()=>{ensureAudio();send('metro',{enabled:!state?.metro})};
$('volume').oninput=()=>{localVolume=Number($('volume').value)/100};
$('markBeat').onclick=()=>{if(!state?.videoId||!state.playing||!playerReady)return toast('เปิดเพลงให้เล่นก่อน แล้วแตะตรงบีตที่ได้ยิน');const current=player.getCurrentTime();send('align',{beatOffsetMs:Math.round(current*1000),alignMode:'manual'});toast('ตั้งจุดลงบีตจากตำแหน่งเพลงแล้ว')};
$('nudgeEarly').onclick=()=>send('nudge',{ms:-50});
$('nudgeLate').onclick=()=>send('nudge',{ms:50});
$('autoAnalyze').onclick=()=>analyzeFromMicrophone();
$('autoCancel').onclick=()=>stopAuto('ยกเลิกการวิเคราะห์');
$('tap').onclick=()=>{const t=performance.now();tapTimes=tapTimes.filter(x=>t-x<2500);tapTimes.push(t);if(tapTimes.length>1){let gaps=tapTimes.slice(1).map((x,i)=>x-tapTimes[i]);let average=gaps.reduce((a,b)=>a+b,0)/gaps.length;send('bpm',{bpm:Math.round(60000/average)})}};
function renderRoom(){ $('code').textContent=code||'—';$('roomLabel').textContent=code?`ห้อง ${code}`:'ยังไม่ได้เข้าห้อง' }
function applyState(next){if(!next)return;const old=state;state=next;$('bpm').textContent=state.bpm;$('bpmSlider').value=state.bpm;$('timeSig').value=String(state.beats);$('metro').textContent=state.metro?'■ ปิดเมโทรนอมทั้งห้อง':'▶ เปิดเมโทรนอมทั้งห้อง';$('metro').classList.toggle('orange',!state.metro);$('alignStatus').textContent=`โหมด ${state.alignMode==='auto'?'Auto':'Manual'} · BPM ${state.bpm} · ตำแหน่งบีต ${((state.beatOffsetMs||0)/1000).toFixed(2)}s`;$('members').replaceChildren(...state.members.map(member=>{let node=document.createElement('span');node.className='chip';node.textContent='● '+member.name;return node}));renderBeats();if(state.videoId!==latestVideo){latestVideo=state.videoId;loadedId='';appliedPlayKey='';if(state.videoId){$('placeholder').classList.add('hide');$('youtube').value=`https://www.youtube.com/watch?v=${state.videoId}`;loadVideo(state.videoId)}else{$('placeholder').classList.remove('hide')}}if(!old||old.playing!==state.playing||old.startedAt!==state.startedAt||old.videoId!==state.videoId||old.position!==state.position)syncVideo();if(!old||old.metroStart!==state.metroStart||old.metro!==state.metro||old.bpm!==state.bpm||old.beats!==state.beats||old.beatOffsetMs!==state.beatOffsetMs)nextBeat=-1;}
function renderBeats(){const prev=$('beats').children.length;if(prev!==state.beats){$('beats').replaceChildren(...Array.from({length:state.beats},(_,i)=>{let dot=document.createElement('div');dot.className='beat '+(i===0?'first':'');return dot}))}}
function estimatedPosition(){if(!state)return 0;return Math.max(0,state.position+(state.playing?Math.max(0,serverNow()-state.startedAt)/1000:0))}
window.onYouTubeIframeAPIReady=()=>{ytReady=true;if(latestVideo)loadVideo(latestVideo)};
function loadVideo(videoId){if(!ytReady||!videoId)return;if(!player){playerReady=false;player=new YT.Player('player',{height:'360',width:'640',videoId,playerVars:{playsinline:1,rel:0,origin:location.origin},events:{onReady:()=>{playerReady=true;loadedId=videoId;syncVideo(true)},onError:e=>toast(`YouTube เล่นวิดีโอนี้ไม่ได้ (ข้อผิดพลาด ${e.data})`),onAutoplayBlocked:()=>toast('เบราว์เซอร์บล็อก Autoplay โปรดกด ▶ ในกรอบ YouTube')}})}else if(playerReady){player.cueVideoById(videoId);loadedId=videoId;appliedPlayKey='';setTimeout(()=>syncVideo(true),350)}}
function syncVideo(force=false){if(!state?.videoId||!playerReady||loadedId!==state.videoId)return;const key=`${state.videoId}:${state.startedAt}:${state.position}:${state.playing}`;const target=estimatedPosition();if(!state.playing){if(force||key!==appliedPlayKey){player.pauseVideo();player.seekTo(target,true);appliedPlayKey=key}return}if(!force&&key===appliedPlayKey)return;appliedPlayKey=key;const countdown=state.startedAt-serverNow();if(countdown>70){setTimeout(()=>{if(appliedPlayKey!==key)return;startYouTubeAt(target+Math.max(0,serverNow()-state.startedAt)/1000)},countdown);$('ytState').textContent=`เริ่มพร้อมกันใน ${(countdown/1000).toFixed(1)} วิ`;}else startYouTubeAt(estimatedPosition())}
function startYouTubeAt(target){if(!state?.playing||!playerReady)return;const actual=estimatedPosition();player.seekTo(actual,true);player.playVideo();$('ytState').textContent='กำลังเล่น'}
function ensureAudio(){const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext)return;audio ||= new AudioContext();if(audio.state==='suspended')audio.resume().catch(()=>{});}
function playClick(time,accent){if(!audio)return;let osc=audio.createOscillator(),gain=audio.createGain();const style=$('sound').value;osc.type=style==='wood'?'triangle':style==='beep'?'sine':'square';osc.frequency.setValueAtTime(style==='wood'?(accent?680:420):accent?1100:820,time);gain.gain.setValueAtTime(Math.max(.0001,localVolume*(accent?.23:.14)),time);gain.gain.exponentialRampToValueAtTime(.0001,time+(style==='beep'?.085:.045));osc.connect(gain);gain.connect(audio.destination);osc.start(time);osc.stop(time+.09)}
function runMetronome(){if(!state?.metro||!state.metroStart||!audio||audio.state!=='running'){nextBeat=-1;return}const msPerBeat=60000/state.bpm;const now=serverNow();if(nextBeat<0)nextBeat=Math.ceil((now-state.metroStart)/msPerBeat);const horizon=now+120;let loops=0;while(state.metroStart+nextBeat*msPerBeat<=horizon&&loops++<15){const beatTime=state.metroStart+nextBeat*msPerBeat;const audioTime=audio.currentTime+(beatTime-now)/1000;if(audioTime>=audio.currentTime-.03)playClick(Math.max(audio.currentTime, audioTime),((nextBeat%state.beats)+state.beats)%state.beats===0);nextBeat++}let active=Math.floor((now-state.metroStart)/msPerBeat);Array.from($('beats').children).forEach((el,i)=>el.classList.toggle('active',((active%state.beats)+state.beats)%state.beats===i&&((now-state.metroStart)%msPerBeat)<130));}
// Auto mode measures a microphone feed (not protected YouTube iframe audio).
// Features: positive spectral-energy transients and normalized interval matching.
function stopAuto(message){if(!autoSession)return;const session=autoSession;autoSession=null;clearInterval(session.timer);try{session.stream.getTracks().forEach(t=>t.stop());session.source.disconnect();session.analyser.disconnect()}catch{}$('autoAnalyze').disabled=false;$('autoCancel').disabled=true;if(message)$('alignStatus').textContent=message}
function inferBeatGrid(samples){
  const frameMs=20, n=samples.length;
  if(n<300)return null;
  const smooth=samples.map((v,i)=>Math.max(0,v-(samples[Math.max(0,i-3)]+samples[Math.min(n-1,i+3)])*.5));
  const mean=smooth.reduce((a,b)=>a+b,0)/n;
  const centered=smooth.map(x=>Math.max(0,x-mean*.6));
  let candidates=[];
  for(let bpm=60;bpm<=200;bpm++){
    const period=60000/bpm/frameMs;let score=0, count=0;
    for(let i=0;i<n-period*2;i++){
      const j=Math.round(i+period);if(j<n){score+=centered[i]*centered[j];count++}
    }
    candidates.push({bpm,score:score/Math.max(1,count)});
  }
  candidates.sort((a,b)=>b.score-a.score);
  const best=candidates[0];const energy=centered.reduce((a,b)=>a+b*b,0)/n;
  if(!best||energy<1e-10||best.score<energy*.025)return null;
  const period=60000/best.bpm;let peak={score:-Infinity,phase:0};
  for(let phase=0;phase<period;phase+=frameMs){let score=0, count=0;
    for(let t=phase;t<n*frameMs;t+=period){const at=Math.round(t/frameMs);for(let d=-2;d<=2;d++){const idx=at+d;if(idx>=0&&idx<n)score+=centered[idx]*(3-Math.abs(d))/3}count++}
    score/=Math.max(1,count);if(score>peak.score)peak={score,phase};
  }
  return {bpm:best.bpm,phaseMs:peak.phase,confidence:Math.min(100,Math.round(100*best.score/Math.max(1e-8,energy)))};
}
async function analyzeFromMicrophone(){
  if(autoSession)return;
  if(!code||!state?.videoId||!state.playing||!playerReady)return toast('เข้าห้องและเปิดเพลงก่อนใช้ Auto');
  if(!navigator.mediaDevices?.getUserMedia)return toast('เบราว์เซอร์นี้ใช้ไมโครโฟนไม่ได้');
  ensureAudio();if(!audio)return toast('เครื่องนี้ไม่รองรับ Web Audio');
  $('alignStatus').textContent='กำลังขอใช้ไมโครโฟน…';
  let stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}})}catch(e){$('alignStatus').textContent='ไม่สามารถเปิดไมโครโฟน: '+e.name;return}
  const source=audio.createMediaStreamSource(stream),analyser=audio.createAnalyser();analyser.fftSize=2048;source.connect(analyser);const arr=new Float32Array(analyser.fftSize);
  const videoId=state.videoId, startAt=performance.now(), songPos=player.getCurrentTime(), samples=[];
  const session={stream,source,analyser,timer:null};autoSession=session;
  $('autoAnalyze').disabled=true;$('autoCancel').disabled=false;
  session.timer=setInterval(()=>{
    if(autoSession!==session)return;
    if(!state?.playing||state.videoId!==videoId){stopAuto('เพลงเปลี่ยนหรือหยุด วิเคราะห์ใหม่ได้');return}
    analyser.getFloatTimeDomainData(arr);let rms=0;for(let i=0;i<arr.length;i++)rms+=arr[i]*arr[i];samples.push(Math.sqrt(rms/arr.length));
    const elapsed=performance.now()-startAt;
    $('alignStatus').textContent=`กำลังฟังเสียงจากลำโพง ${(elapsed/1000).toFixed(1)} / 12 วินาที…`;
    if(elapsed<12000)return;
    stopAuto();
    // Resample irregular timer samples to 20 ms grid for beat inference.
    const result=inferBeatGrid(samples);
    if(!result){$('alignStatus').textContent='จับบีตไม่ชัด ลองเพิ่มเสียงลำโพง ลดเสียงรบกวน หรือใช้ Manual';return}
    // A 20ms tick estimate; latency from speakers/microphone remains uncalibrated.
    const offset=Math.round(songPos*1000+result.phaseMs);
    send('align',{bpm:result.bpm,beatOffsetMs:offset,alignMode:'auto'});
    toast(`Auto ประมาณ ${result.bpm} BPM — ลองฟังแล้วปรับละเอียดด้วย ±50ms`);
  },20);
}
metroTimer=setInterval(runMetronome,25);
setInterval(()=>{if(!state||!playerReady)return;let duration=player.getDuration()||0;const pos=Math.max(0,estimatedPosition());$('position').textContent=`${format(pos)} / ${format(duration)}`;$('seek').max=Math.max(1,duration);if(document.activeElement!==$('seek'))$('seek').value=Math.min(pos,duration||0);if(state.playing&&serverNow()>state.startedAt+1500&&player.getPlayerState()===YT.PlayerState.PLAYING){const delta=Math.abs(player.getCurrentTime()-pos);if(delta>1.3){player.seekTo(pos,true);$('ytState').textContent=`กำลังปรับซิงก์ (${delta.toFixed(1)}s)`}}},1000);
function format(s){s=Math.floor(Number(s)||0);return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`}
function pingClock(){if(!socket.connected)return;const sent=Date.now();socket.emit('clock:ping',sent,response=>{if(!response)return;const received=Date.now(),roundtrip=received-sent;const estimated=response.serverTime-(sent+received)/2;if(roundtrip<rttMs||rttMs===0){offsetMs=estimated;rttMs=roundtrip}else{offsetMs=offsetMs*.8+estimated*.2;rttMs=rttMs*.75+roundtrip*.25}$('ping').textContent=Math.round(rttMs)+' ms';$('offset').textContent=Math.round(offsetMs)+' ms'})}
setInterval(pingClock,4000);
socket.on('connect',()=>{$('connectionDot').classList.add('on');$('connection').textContent='เชื่อมต่อแล้ว';pingClock();if(code)join(code);else if(initialRoom)join(initialRoom)});
socket.on('disconnect',()=>{$('connectionDot').classList.remove('on');$('connection').textContent='ขาดการเชื่อมต่อ'});
socket.on('room:state',applyState);
document.addEventListener('pointerdown',()=>{if(audio?.state==='suspended')audio.resume().catch(()=>{})},{passive:true});
