// Robust Arcade Depth Prototype - replacement script
// This script logs to the on-page console so you don't need DevTools.
// If src/levels/level1.json is missing it will fall back to an inline level.

function pageLog(...args){
  try {
    if (window.__pageConsole && typeof window.__pageConsole.write === 'function') {
      window.__pageConsole.write(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
    } else {
      console.log(...args);
    }
  } catch(e){ console.log(...args); }
}
pageLog("game.js loaded");

window.addEventListener('error', (ev) => {
  pageLog("Global error: " + (ev && ev.message ? ev.message : String(ev)), 'error');
});
window.addEventListener('unhandledrejection', (ev) => {
  pageLog("Unhandled rejection: " + (ev && ev.reason ? (ev.reason.message||ev.reason) : String(ev)), 'error');
});

const canvas = document.getElementById('game');
if (!canvas) { pageLog("Canvas #game not found"); }
const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
if (!ctx) { pageLog("2D context not available"); }

const W = canvas ? canvas.width : 1024;
const H = canvas ? canvas.height : 576;
const hudScore = document.getElementById('score');
const hudLives = document.getElementById('lives');

const state = { score: 0, lives: 3, paused: false };
const camera = { x: 0, y: 0, width: W, height: H, lerp: 0.08 };
const input = { left:false, right:false, jump:false, fire:false, touchLeft:false, touchRight:false, touchJump:false, touchFire:false };

window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === 'arrowleft' || k === 'a') input.left = true;
  if (k === 'arrowright' || k === 'd') input.right = true;
  if (k === 'z' || k === ' ') input.jump = true;
  if (k === 'x') input.fire = true;
  if (k === 'p') state.paused = !state.paused;
});
window.addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  if (k === 'arrowleft' || k === 'a') input.left = false;
  if (k === 'arrowright' || k === 'd') input.right = false;
  if (k === 'z' || k === ' ') input.jump = false;
  if (k === 'x') input.fire = false;
});

function makeTouchButtons(){
  const overlay = document.getElementById('controls-overlay');
  if (!overlay) return;
  overlay.innerHTML = '';
  const makeBtn = (cls, text, onStart, onEnd) => {
    const d = document.createElement('div');
    d.className = 'touch-button ' + cls;
    d.innerText = text;
    d.style.fontSize = '24px';
    d.addEventListener('touchstart', e => { e.preventDefault(); onStart(); }, {passive:false});
    d.addEventListener('touchend', e => { onEnd(); });
    overlay.appendChild(d);
  };
  makeBtn('touch-left','◀', ()=>input.touchLeft=true, ()=>input.touchLeft=false);
  makeBtn('touch-right','▶', ()=>input.touchRight=true, ()=>input.touchRight=false);
  makeBtn('touch-jump','⭡', ()=>input.touchJump=true, ()=>input.touchJump=false);
  makeBtn('touch-fire','●', ()=>input.touchFire=true, ()=>input.touchFire=false);
}
makeTouchButtons();

let level = null;
const INLINE_LEVEL = {
  "meta": { "name": "Tutorial Ridge", "gravityZ": 1400 },
  "spawn": { "x": 120, "y": 0, "z": 0 },
  "platforms": [
    { "x": -400, "y": 520, "w": 2400, "z": 0 },
    { "x": 380, "y": 420, "w": 160, "z": 60 },
    { "x": 700, "y": 360, "w": 140, "z": 120 },
    { "x": 1100, "y": 430, "w": 160, "z": 40 },
    { "x": 1500, "y": 380, "w": 200, "z": 100 }
  ],
  "enemies": [
    { "type":"patrol", "x": 520, "y": 420, "z":60, "range":80 },
    { "type":"ranged", "x": 900, "y": 360, "z":120, "range":200 }
  ],
  "collectibles": [
    { "x": 760, "y": 320, "z":140 },
    { "x": 1140, "y": 380, "z":60 }
  ]
};

const world = { platforms: [], enemies: [], bullets: [], particles: [], collectibles: [] };
const player = {
  x:120, y:0, z:0, vx:0, vy:0, vz:0,
  width:36, height:56, speed:320, accel:2200, drag:1200,
  jumpForce:520, grounded:true, facing:1, color:'#ffd559', shotCooldown:0
};
const CAMERA_DEPTH = 900;
let GRAV = 1400;

function initLevelFromObject(lvl) {
  level = lvl || INLINE_LEVEL;
  GRAV = (level.meta && level.meta.gravityZ) || GRAV;
  player.x = (level.spawn && level.spawn.x) || player.x;
  player.z = (level.spawn && level.spawn.z) || player.z;
  world.platforms = (level.platforms || []).map(p => ({...p}));
  world.enemies = (level.enemies || []).map(e => ({...e, vx: (e.type==='patrol'? 40:0), cooldown: 0, x0: e.x }));
  world.collectibles = (level.collectibles || []).map(c => ({...c, collected:false}));
  pageLog("Initialized level:", level.meta && level.meta.name);
}

async function loadLevelWithFallback(url) {
  try {
    pageLog("Attempting to fetch level:", url);
    const res = await fetch(url, {cache: "no-store"});
    if (!res.ok) throw new Error(`Fetch returned ${res.status}`);
    const data = await res.json();
    initLevelFromObject(data);
    pageLog("Loaded level from", url);
  } catch (err) {
    pageLog("Level load failed, using inline level. Error: " + (err && err.message ? err.message : String(err)));
    initLevelFromObject(INLINE_LEVEL);
  }
}
loadLevelWithFallback('src/levels/level1.json').catch(err => { pageLog("Level load unexpected error: " + err); initLevelFromObject(INLINE_LEVEL); });

function worldPlatformUnder(x){ for (const p of world.platforms){ if (x >= p.x && x <= p.x + p.w) return p; } return null; }
function spawnBullet(x,y,z,dir,speed=520,owner='player'){ world.bullets.push({x,y,z,vx:dir*speed,vz:0,owner,ttl:3}); }
function spawnParticle(x,y,life=0.5,color='#fff'){ world.particles.push({x,y,life,age:0,color,vy:-30+Math.random()*-60,vx:(Math.random()-0.5)*80}); }
function spawnExplosion(x,y,z){ for (let i=0;i<12;i++) spawnParticle(x - camera.x + (Math.random()-0.5)*30, y + (Math.random()-0.5)*30, 0.8, '#ffcc66'); }

function checkBulletHit(b){
  if (b.owner === 'player'){
    for (const e of world.enemies){
      if (e.dead) continue;
      const dx = b.x - e.x, dz = Math.abs(b.z - (e.z||0));
      if (Math.abs(dx) < 30 && dz < 40){ e.dead = true; state.score += 150; spawnParticle(e.x - camera.x, e.y - 8, 0.8, '#ff6e6e'); b.ttl = 0; return; }
    }
  } else {
    const dx = b.x - player.x, dz = Math.abs(b.z - player.z);
    if (Math.abs(dx) < 30 && dz < 40){ b.ttl = 0; state.lives -= 1; state.score = Math.max(0,state.score-200); spawnExplosion(player.x, player.y, player.z); player.x = level.spawn.x; player.z = level.spawn.z || 0; player.vx = player.vz = 0; return; }
  }
}

let last = performance.now();

function update(dt){
  if (state.paused) return;
  const left = input.left || input.touchLeft;
  const right = input.right || input.touchRight;
  const jump = input.jump || input.touchJump;
  const fire = input.fire || input.touchFire;

  let targetVx = 0;
  if (left) targetVx -= player.speed;
  if (right) targetVx += player.speed;
  if (player.vx < targetVx) player.vx = Math.min(targetVx, player.vx + player.accel * dt);
  if (player.vx > targetVx) player.vx = Math.max(targetVx, player.vx - player.accel * dt);
  if (!left && !right) { if (player.vx > 0) player.vx = Math.max(0, player.vx - player.drag*dt); if (player.vx < 0) player.vx = Math.min(0, player.vx + player.drag*dt); }
  player.x += player.vx * dt;
  if (player.vx !== 0) player.facing = Math.sign(player.vx);

  if ((jump && player.grounded) ) { player.vz = player.jumpForce; player.grounded = false; }
  player.vz -= GRAV * dt;
  player.z += player.vz * dt;

  const footX = player.x;
  const platform = worldPlatformUnder(footX);
  const groundZ = platform ? platform.z : 0;
  const groundYScreen = platform ? (platform.y - platform.z*0.6) : (H - 56 - 24);

  if (player.z <= groundZ){ player.z = groundZ; player.vz = 0; player.grounded = true; } else { player.grounded = false; }
  player.y = groundYScreen - player.height - player.z * 0.6;

  const targetCamX = player.x - W*0.36;
  camera.x += (targetCamX - camera.x) * camera.lerp;
  camera.x = Math.max(-800, Math.min(camera.x, 2200));

  player.shotCooldown = Math.max(0, player.shotCooldown - dt);
  if ((fire) && player.shotCooldown <= 0){ const bx = player.x + player.facing * 28; const by = player.y + player.height*0.5; spawnBullet(bx, by, player.z, player.facing, 560, 'player'); player.shotCooldown = 0.28; }

  for (const b of world.bullets){ b.x += b.vx * dt; b.z += (b.vz || 0) * dt; b.ttl -= dt; try { checkBulletHit(b); } catch(err) { pageLog("Bullet check error: "+err); } }
  world.bullets = world.bullets.filter(b=>b.ttl>0 && Math.abs(b.x - camera.x) < 3000);

  for (const e of world.enemies){
    if (e.dead) continue;
    if (e.type === 'patrol'){ e.x += e.vx * dt; if (!e.x0) e.x0 = e.x; if (e.x < e.x0 - (e.range||80)) e.vx = Math.abs(e.vx); if (e.x > e.x0 + (e.range||80)) e.vx = -Math.abs(e.vx); }
    if (e.type === 'ranged'){ e.cooldown = Math.max(0, e.cooldown - dt); if (!e.x0) e.x0 = e.x; const dist = Math.abs(e.x - player.x); if (dist < (e.range||200) && e.cooldown <= 0){ const dir = (player.x < e.x) ? -1 : 1; spawnBullet(e.x, e.y - 8, e.z, dir, 420, 'enemy'); e.cooldown = 1.2; } }
  }

  for (const c of world.collectibles){ if (c.collected) continue; const dx = c.x - player.x; const dz = Math.abs((c.z||0) - player.z); if (Math.abs(dx) < 28 && dz < 40){ c.collected = true; state.score += 50; spawnParticle(c.x - camera.x, c.y - 8, 0.8, '#ffd559'); } }

  for (const p of world.particles){ p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  world.particles = world.particles.filter(p=>p.age < p.life);

  hudScore && (hudScore.innerText = `Score: ${state.score}`);
  hudLives && (hudLives.innerText = `Lives: ${state.lives}`);
}

function draw(){
  if (!ctx) return;
  ctx.clearRect(0,0,W,H);

  ctx.fillStyle = '#87c5ff'; ctx.fillRect(0,0,W,H);

  const layers = [ { color:'#7fc3ff', speed:0.15, y:80 }, { color:'#6ab0c9', speed:0.35, y:220 }, { color:'#2b4b52', speed:0.65, y:360 } ];
  for (const L of layers){ const ox = - (camera.x * L.speed) % (W*2); ctx.fillStyle = L.color; ctx.fillRect(ox - W, L.y, W*3, H - L.y); }

  for (const p of world.platforms){ const sx = Math.round(p.x - camera.x); const sy = Math.round(p.y - p.z*0.6); ctx.fillStyle = '#5a3a16'; ctx.fillRect(sx, sy, p.w, 10); ctx.fillStyle = '#8b5a2b'; ctx.fillRect(sx, sy-8, p.w, 6); }

  for (const c of world.collectibles){ if (c.collected) continue; const scale = CAMERA_DEPTH / (CAMERA_DEPTH + c.z); const w = 12*scale, h = 12*scale; const sx = c.x - camera.x - w/2; const sy = (c.y - c.z*0.6) - h; ctx.fillStyle = '#ffd559'; ctx.beginPath(); ctx.ellipse(Math.round(sx + w/2), Math.round(sy + h/2), Math.round(w/2), Math.round(h/2), 0,0,Math.PI*2); ctx.fill(); }

  function drawEntity(x,y,z,w,h,color,extra){ const scale = CAMERA_DEPTH / (CAMERA_DEPTH + z); const dw = w * scale; const dh = h * scale; const sx = Math.round(x - camera.x - dw/2 + w/2); const sy = Math.round(y - dh + (h - dh)); ctx.fillStyle = 'rgba(0,0,0,0.36)'; ctx.beginPath(); ctx.ellipse(Math.round(x - camera.x), Math.round((y - z*0.6)+8), 18*scale, 7*scale, 0,0,Math.PI*2); ctx.fill(); ctx.fillStyle = color; ctx.fillRect(sx, sy, Math.round(dw), Math.round(dh)); if (extra) extra(sx,sy,scale); }

  drawEntity(player.x, player.y, player.z, player.width, player.height, player.color, (sx,sy,scale)=>{ ctx.fillStyle = '#000'; ctx.fillRect(Math.round(sx + Math.max(4,6*scale)), Math.round(sy + Math.max(6,8*scale)), Math.max(2,Math.round(4*scale)), Math.max(2,Math.round(4*scale))); });

  for (const e of world.enemies){ if (e.dead) { drawEntity(e.x, e.y, e.z, 28, 36, '#8b5a5a'); continue; } const color = e.type === 'ranged' ? '#ff6e6e' : '#6ee6ff'; drawEntity(e.x, e.y, e.z, 28, 36, color); }

  for (const b of world.bullets){ const scale = CAMERA_DEPTH / (CAMERA_DEPTH + b.z); const sw = 8*scale, sh = 6*scale; const sx = b.x - camera.x - sw/2; const sy = (H - 80) - b.z*0.6 - sh; ctx.fillStyle = b.owner === 'player' ? '#fff' : '#f66'; ctx.fillRect(Math.round(sx), Math.round(sy), Math.round(sw), Math.round(sh)); }

  for (const p of world.particles){ ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(0, 1 - p.age / p.life); ctx.fillRect(Math.round(p.x), Math.round(p.y), 4,4); ctx.globalAlpha = 1; }
}

function loop(now){
  const dt = Math.min(0.033, (now - last)/1000);
  last = now;
  try { update(dt); draw(); } catch(err) { pageLog("Error in loop: " + err); }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function pollGamepad(){ const gps = navigator.getGamepads ? navigator.getGamepads() : []; if (gps && gps[0]){ const g = gps[0]; input.left = g.axes[0] < -0.3; input.right = g.axes[0] > 0.3; input.jump = input.jump || g.buttons[0].pressed; input.fire = input.fire || g.buttons[1].pressed; } requestAnimationFrame(pollGamepad); }
pollGamepad();

pageLog("Game script initialized. If something fails you'll see messages in the status box.");
