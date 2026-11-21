const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: false } });
app.use(express.static(path.join(__dirname, 'public')));
const rooms = new Map();
const randomRoom = () => Math.random().toString(36).slice(2, 8).toUpperCase();
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function getRoom(code) {
  if (!rooms.has(code)) rooms.set(code, { videoId:'', bpm:120, beats:4, playing:false, startedAt:0, position:0, metro:false, metroStart:0, members:new Map() });
  return rooms.get(code);
}
function currentPosition(room, now=Date.now()) {
  return Math.max(0, room.position + (room.playing ? Math.max(0, now-room.startedAt)/1000 : 0));
}
function publicState(room) {
  return { videoId: room.videoId, bpm:room.bpm, beats:room.beats, playing:room.playing, startedAt:room.startedAt, position:room.position, metro:room.metro, metroStart:room.metroStart, members:[...room.members.values()] };
}
function publish(code) { io.to(code).emit('room:state', publicState(getRoom(code))); }
io.on('connection', socket => {
  let roomCode = null;
  socket.on('clock:ping', (clientSent, ack) => { if (typeof ack === 'function') ack({ serverTime:Date.now(), clientSent }); });
  socket.on('room:join', (data, ack) => {
    const code = String(data?.room || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{4,12}$/.test(code)) return ack?.({ok:false,error:'รหัสห้องต้องเป็นตัวอักษร/ตัวเลข 4–12 ตัว'});
    if (roomCode) { socket.leave(roomCode); const old=getRoom(roomCode); old.members.delete(socket.id); publish(roomCode); }
    roomCode=code;
    const room=getRoom(code);
    socket.join(code);
    const name=String(data?.name||'เพื่อนนักดนตรี').trim().slice(0,24);
    room.members.set(socket.id, { id:socket.id, name });
    ack?.({ok:true, room:code, state:publicState(room), serverTime:Date.now()});
    publish(code);
  });
  socket.on('room:update', (update, ack) => {
    if (!roomCode) return ack?.({ok:false,error:'ยังไม่ได้เข้าห้อง'});
    const room=getRoom(roomCode), now=Date.now();
    switch(update?.type) {
      case 'video': {
        if (!/^[a-zA-Z0-9_-]{11}$/.test(String(update.videoId||''))) return ack?.({ok:false,error:'ลิงก์ YouTube ไม่ถูกต้อง'});
        room.videoId=update.videoId; room.playing=false; room.position=0; room.startedAt=0;
        break;
      }
      case 'play':
        if (!room.videoId) return ack?.({ok:false,error:'ใส่ลิงก์เพลงก่อน'});
        room.position=clamp(Number.isFinite(Number(update.position)) ? Number(update.position) : currentPosition(room,now),0,86400);
        room.startedAt=now+2000;
        room.playing=true;
        break;
      case 'pause':
        room.position=currentPosition(room,now); room.playing=false; room.startedAt=0; break;
      case 'seek':
        room.position=clamp(Number(update.position)||0,0,86400);
        if (room.playing) room.startedAt=now+1400;
        break;
      case 'bpm': {
        room.bpm=clamp(Math.round(Number(update.bpm)||120),30,300);
        if (room.metro) room.metroStart=now+1800;
        break;
      }
      case 'beats':
        room.beats=clamp(Math.round(Number(update.beats)||4),1,12);
        if (room.metro) room.metroStart=now+1800;
        break;
      case 'metro':
        room.metro=!!update.enabled;
        room.metroStart=room.metro?now+1800:0;
        break;
      case 'restart':
        room.position=0;
        if (room.playing) room.startedAt=now+2000;
        break;
      default: return ack?.({ok:false,error:'คำสั่งไม่ถูกต้อง'});
    }
    publish(roomCode);
    ack?.({ok:true});
  });
  socket.on('disconnect', () => {
    if (!roomCode) return;
    const room=getRoom(roomCode); room.members.delete(socket.id); publish(roomCode);
    if (!room.members.size) { const departedCode=roomCode; setTimeout(() => { if (rooms.get(departedCode) === room && !room.members.size) rooms.delete(departedCode); }, 60*60*1000); }
  });
});
const port=process.env.PORT||3000;
server.listen(port, '0.0.0.0', () => console.log(`JamRoom http://localhost:${port}`));
