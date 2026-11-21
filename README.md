# JAMROOM — เว็บซ้อมดนตรีกับเพื่อน

เว็บซ้อมดนตรีที่รองรับ YouTube embed, metronome แบบ Web Audio, ห้องรวมเพื่อน, การควบคุมร่วมกันผ่าน Socket.IO และการประมาณเวลาเซิร์ฟเวอร์เพื่อให้ซิงก์ใกล้เคียงกัน

## เริ่มต้นบน Windows 11

1. ติดตั้ง Node.js LTS จาก https://nodejs.org/
2. แตก ZIP แล้วเปิด Terminal / PowerShell ในโฟลเดอร์ `jamroom`
3. รันคำสั่ง:

   ```bash
   npm install
   npm start
   ```

4. เข้า `http://localhost:3000` ใน Chrome
5. กด **สร้างห้อง** วางลิงก์เพลง YouTube แล้วกด **โหลดเพลง**
6. กด **คัดลอกลิงก์ชวนเพื่อน** หากเว็บอยู่บนโฮสต์สาธารณะ เพื่อนจะใช้ลิงก์นี้เข้าห้องได้

## ให้เพื่อนเข้าออนไลน์จากคนละบ้าน

`localhost` ใช้ได้เฉพาะเครื่องที่รันเซิร์ฟเวอร์ หากต้องการให้เพื่อนเข้าจากคนละบ้าน ให้ deploy แอป Node.js ที่รองรับ WebSocket (เช่น Render, Railway, VPS) และใช้ HTTPS ของโฮสต์นั้น เริ่มด้วยคำสั่ง `npm start` โดยระบบใช้ตัวแปร `PORT` จากโฮสต์อัตโนมัติ บริการฟรีบางแห่งพักการทำงานเมื่อไม่มีผู้ใช้งานและอาจมีความหน่วงช่วงปลุกเซิร์ฟเวอร์

## ข้อควรทราบ

- YouTube เล่นผ่าน **YouTube IFrame Player API** ไม่ดาวน์โหลดหรือส่งต่อเสียงผ่านเซิร์ฟเวอร์
- ทุกเครื่องต้องโหลด YouTube วิดีโอและอาจต้องกดเล่นเพื่อปลดล็อก autoplay ก่อน
- การเล่น YouTube **ไม่สามารถรับประกันว่าตรงกันระดับมิลลิวินาที** เพราะ buffer, โฆษณา, เครือข่าย, autoplay, เวลาโหลดและข้อจำกัด IFrame API
- เมโทรนอมสร้างเสียงเฉพาะเครื่องด้วย Web Audio scheduling และใช้เวลาเซิร์ฟเวอร์เพื่อจัดแนวจังหวะได้ดีขึ้น แต่ **ยังไม่ใช่ clock sync ระดับเครื่องเสียงมืออาชีพ** การเร่ง/ชะลอเมื่อเปลี่ยน BPM จะรีเซ็ตห้องจังหวะ
- ทุกคนในห้องกดควบคุมร่วมกันได้ ยังไม่มี role host หรือระบบบัญชี
- ข้อมูลห้องเก็บในหน่วยความจำเท่านั้น เมื่อเซิร์ฟเวอร์รีสตาร์ตจะหาย; ห้องว่างถูกลบเมื่อผ่านไปราว 1 ชั่วโมง
- แนะนำใช้ Chrome/Edge บนคอมพิวเตอร์และสวมหูฟัง เพื่อป้องกันเสียงย้อนเข้าการคุยเสียงแยก (เช่น Discord)


## v2 — Auto / Manual metronome alignment

- **Manual:** play a YouTube song, set BPM (or Tap Tempo), then tap **Manual — แตะตรงบีต 1** when you hear a strong downbeat. Fine-tune by ±50ms. The alignment is shared with the room.
- **Auto (experimental):** play the song out loud through **speakers**, tap **Auto — ฟังเพลง 12 วิ**, and allow the microphone. JAMROOM estimates BPM and a beat phase from 12 seconds of microphone audio. It cannot analyze raw audio directly from the YouTube embedded player. Headphones and quiet/complex music will not work reliably. For best results, start on a steady drum groove.
- Metro follows the same song timeline on play, restart, and seek. For any late-buffering device, use the existing local YouTube resync button.
- Microphone audio is processed locally; JAMROOM sends **only the estimated BPM/phase** to the room. No microphone recording is uploaded or saved.
- The system cannot ensure sample-accurate synchronization with YouTube playback due to buffering, speaker/microphone latency, and browser autoplay.

### Update an existing GitHub → Render site
1. Unzip this package.
2. Open the existing `jamroom` GitHub repository.
3. Upload **the unpacked files**, replacing `server.js`, `public/app.js`, `public/index.html`, and optionally `README.md`. Keep `package.json` at repository root.
4. Commit changes. Render typically redeploys automatically if Auto Deploy is enabled.
