// src/game.js
// Updated game.js to use larger sprites generated in src/sprites.js
// Paste/replace this file in your repo. Adjust spriteScale for larger/smaller sprites.

import { loadSprites } from './sprites.js';

function pageLog(...args){
  try {
    if (window.__pageConsole && typeof window.__pageConsole.write === 'function') {
      window.__pageConsole.write(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
    } else {
      console.log(...args);
    }
  } catch(e){ console.log(...args); }
}
pageLog("game.js (metal-ish) loaded");

const canvas = document.getElementById('game');
const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
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

// touch
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

// Player default; actual width/height will be set after sprites load
const player = {
  x:120, y:0, z:0, vx:0, vy:0, vz:0,
  width:36, height:56, speed:320, accel:2200, drag:1200,
  jumpForce:520, grounded:true, facing:1, color:'#ffd559', shotCooldown:0,
  animTimer:0
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

let sprites = null;
let spriteScale = 4; // increase to 5 or 6 for chunkier art

async function boot() {
  try {
    sprites = await loadSprites(spriteScale);
    pageLog("Sprites generated");
    // set player size to sprite size so physics & visuals match
    if (sprites && sprites.player && sprites.player.frames && sprites.player.frames[0]) {
      const img = sprites.player.frames[0];
      player.width = img.width;
      player.height = img.height;
      pageLog("Player sprite size:", player.width, player.height);
    }
  } catch(err) {
    pageLog("Sprite load error:", err);
    sprites = null;
  }

  // try load JSON level, fallback to inline
  try {
    pageLog("Loading level JSON...");
    const res = await fetch('src/levels/level1.json', {cache:'no-store'});
    if (res.ok) {
      const data = await res.json();
      initLevelFromObject(data);
    } else {
      pageLog("Level JSON not found; using inline level.");
      initLevelFromObject(INLINE_LEVEL);
    }
  } catch(err) {
    pageLog("Level fetch failed; using inline. Error: " + err);
    initLevelFromObject(INLINE_LEVEL);
  }

  last = performance.now();
  requestAnimationFrame(loop);
}
boot();

function worldPlatformUnder(x){
  for (const p of world.platforms){
    if (x >= p.x && x <= p.x + p.w) return p;
  }
  return null;
}
function spawnBullet(x,y,z,dir,speed=520,owner='player'){ world.bullets.push({x,y,z,vx:dir*speed,vz:0,owner,ttl:3}); }
function spawnParticle(x,y,life=0.5,color='#fff'){ world.particles.push({x,y,life,age:0,color,vy:-30+Math.random()*-60,vx:(Math.random()-0.5)*80}); }
function spawnExplosion(x,y,z){ for (let i=0;i<12;i++) spawnParticle(x - camera.x + (Math.random()-0.5)*30, y + (Math.random()-0.5)*30, 0.8, '#ffcc66'); }

function checkBulletHit(b){
  if (b.owner === 'player'){
    for (const e of world.enemies){
      if (e.dead) continue;
      const dx = b.x - e.x;
      const dz = Math.abs(b.z - (e.z||0));
      if (Math.abs(dx) < 30 && dz < 40){
        e.dead = true;
        state.score += 150;
        spawnParticle(e.x - camera.x, e.y - 8, 0.8, '#ff6e6e');
        b.ttl = 0;
        return;
      }
    }
  } else {
    const dx = b.x - player.x;
    const dz = Math.abs(b.z - player.z);
    if (Math.abs(dx) < 30 && dz < 40){
      b.ttl = 0;
      state.lives -= 1;
      state.score = Math.max(0, state.score - 200);
      spawnExplosion(player.x, player.y, player.z);
      player.x = level.spawn.x;
      player.z = level.spawn.z || 0;
      player.vx = player.vz = 0;
      return;
    }
  }
}

// draw helpers
function drawSpriteImage(img, x, y, z, w, h) {
  if (!img || !ctx) return;
  const scale = CAMERA_DEPTH / (CAMERA_DEPTH + z);
  const dw = w * scale;
  const dh = h * scale;
  const sx = Math.round(x - camera.x - dw/2 + w/2);
  const sy = Math.round(y - dh + (h - dh));
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, sx, sy, Math.round(dw), Math.round(dh));
  ctx.imageSmoothingEnabled = true;
}

function drawEntityWithSprite(x,y,z,w,h,img){
  if (img) {
    drawSpriteImage(img, x, y, z, w, h);
  } else {
    const scale = CAMERA_DEPTH / (CAMERA_DEPTH + z);
    const dw = w * scale, dh = h * scale;
    const sx = Math.round(x - camera.x - dw/2 + w/2);
    const sy = Math.round(y - dh + (h - dh));
    ctx.fillStyle = 'rgba(0,0,0,0.36)';
    ctx.beginPath();
    ctx.ellipse(Math.round(x - camera.x), Math.round((y - z*0.6)+8), 18*scale, 7*scale, 0,0,Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#ffd559';
    ctx.fillRect(sx, sy, Math.round(dw), Math.round(dh));
  }
}

// main update/draw loop
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
  if (!left && !right){
    if (player.vx > 0) player.vx = Math.max(0, player.vx - player.drag*dt);
    if (player.vx < 0) player.vx = Math.min(0, player.vx + player.drag*dt);
  }
  player.x += player.vx * dt;
  if (player.vx !== 0) player.facing = Math.sign(player.vx);

  if ((jump && player.grounded) ) {
    player.vz = player.jumpForce;
    player.grounded = false;
  }
  player.vz -= GRAV * dt;
  player.z += player.vz * dt;

  const footX = player.x;
  const platform = worldPlatformUnder(footX);
  const groundZ = platform ? platform.z : 0;
  const groundYScreen = platform ? (platform.y - platform.z*0.6) : (H - 56 - 24);

  if (player.z <= groundZ){
    player.z = groundZ;
    player.vz = 0;
    player.grounded = true;
  } else {
    player.grounded = false;
  }
  player.y = groundYScreen - player.height - player.z * 0.6;

  const targetCamX = player.x - W*0.36;
  camera.x += (targetCamX - camera.x) * camera.lerp;
  camera.x = Math.max(-800, Math.min(camera.x, 2200));

  player.shotCooldown = Math.max(0, player.shotCooldown - dt);
  if ((fire) && player.shotCooldown <= 0){
    const bx = player.x + player.facing * 28;
    const by = player.y + player.height*0.5;
    spawnBullet(bx, by, player.z, player.facing, 560, 'player');
    player.shotCooldown = 0.28;
  }

  for (const b of world.bullets){
    b.x += b.vx * dt;
    b.z += (b.vz || 0) * dt;
    b.ttl -= dt;
    try { checkBulletHit(b); } catch(err) { pageLog("Bullet check error: "+err); }
  }
  world.bullets = world.bullets.filter(b=>b.ttl>0 && Math.abs(b.x - camera.x) < 3000);

  for (const e of world.enemies){
    if (e.dead) continue;
    if (e.type === 'patrol'){
      e.x += e.vx * dt;
      if (!e.x0) e.x0 = e.x;
      if (e.x < e.x0 - (e.range||80)) e.vx = Math.abs(e.vx);
      if (e.x > e.x0 + (e.range||80)) e.vx = -Math.abs(e.vx);
    }
    if (e.type === 'ranged'){
      e.cooldown = Math.max(0, e.cooldown - dt);
      if (!e.x0) e.x0 = e.x;
      const dist = Math.abs(e.x - player.x);
      if (dist < (e.range||200) && e.cooldown <= 0){
        const dir = (player.x < e.x) ? -1 : 1;
        spawnBullet(e.x, e.y - 8, e.z, dir, 420, 'enemy');
        e.cooldown = 1.2;
      }
    }
  }

  for (const c of world.collectibles){
    if (c.collected) continue;
    const dx = c.x - player.x;
    const dz = Math.abs((c.z||0) - player.z);
    if (Math.abs(dx) < 28 && dz < 40){
      c.collected = true;
      state.score += 50;
      spawnParticle(c.x - camera.x, c.y - 8, 0.8, '#ffd559');
    }
  }

  for (const p of world.particles){
    p.age += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  world.particles = world.particles.filter(p=>p.age < p.life);

  hudScore && (hudScore.innerText = `Score: ${state.score}`);
  hudLives && (hudLives.innerText = `Lives: ${state.lives}`);

  player.animTimer += dt;
}

function draw(){
  if (!ctx) return;
  ctx.clearRect(0,0,W,H);

  // darker sky for retro mood
  ctx.fillStyle = '#0f1620';
  ctx.fillRect(0,0,W,H);

  // parallax cloud details
  if (sprites && sprites.cloud) {
    ctx.imageSmoothingEnabled = false;
    const cloudImg = sprites.cloud;
    for (let i=-1;i<6;i++){
      const cx = Math.round((i*320) - (camera.x * 0.12 % 320));
      const cy = 80 + (i%2)*24;
      ctx.globalAlpha = 0.75;
      ctx.drawImage(cloudImg, cx, cy);
      ctx.globalAlpha = 1;
    }
  }

  // platforms tiled
  for (const p of world.platforms){
    const sx = Math.round(p.x - camera.x);
    const sy = Math.round(p.y - p.z*0.6);
    if (sprites && sprites.ground) {
      const tileW = sprites.ground.width;
      let tx = sx;
      while (tx < sx + p.w) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sprites.ground, tx, sy - 16);
        ctx.imageSmoothingEnabled = true;
        tx += tileW;
      }
    } else {
      ctx.fillStyle = '#5a3a16';
      ctx.fillRect(sx, sy, p.w, 10);
      ctx.fillStyle = '#8b5a2b';
      ctx.fillRect(sx, sy-8, p.w, 6);
    }
  }

  // collectibles (coins)
  for (const c of world.collectibles){
    if (c.collected) continue;
    if (sprites && sprites.coin) {
      drawSpriteImage(sprites.coin, c.x, (c.y - c.z*0.6), c.z, 16, 16);
    } else {
      const scale = CAMERA_DEPTH / (CAMERA_DEPTH + c.z);
      const w = 12*scale, h = 12*scale;
      const sx = c.x - camera.x - w/2;
      const sy = (c.y - c.z*0.6) - h;
      ctx.fillStyle = '#ffd559';
      ctx.beginPath();
      ctx.ellipse(Math.round(sx + w/2), Math.round(sy + h/2), Math.round(w/2), Math.round(h/2), 0,0,Math.PI*2);
      ctx.fill();
    }
  }

  // player sprite (select frame)
  const playerSprite = sprites && sprites.player && sprites.player.frames && sprites.player.frames.length
    ? sprites.player.frames[Math.floor((player.animTimer * 8) % sprites.player.frames.length)]
    : null;
  drawEntityWithSprite(player.x, player.y, player.z, player.width, player.height, playerSprite);

  // enemies
  for (const e of world.enemies){
    if (e.dead) {
      drawEntityWithSprite(e.x, e.y, e.z, 28, 36, null);
      continue;
    }
    drawEntityWithSprite(e.x, e.y, e.z, sprites && sprites.enemy ? sprites.enemy.width : 28, sprites && sprites.enemy ? sprites.enemy.height : 36, sprites ? sprites.enemy : null);
  }

  // bullets
  for (const b of world.bullets){
    const scale = CAMERA_DEPTH / (CAMERA_DEPTH + b.z);
    const sw = 8*scale, sh = 6*scale;
    const sx = b.x - camera.x - sw/2;
    const sy = (H - 80) - b.z*0.6 - sh;
    ctx.fillStyle = b.owner === 'player' ? '#fff' : '#f66';
    ctx.fillRect(Math.round(sx), Math.round(sy), Math.round(sw), Math.round(sh));
  }

  // particles
  for (const p of world.particles){
    ctx.fillStyle = p.color;
    ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
    ctx.fillRect(Math.round(p.x), Math.round(p.y), 4,4);
    ctx.globalAlpha = 1;
  }
}

function loop(now){
  const dt = Math.min(0.033, (now - last)/1000);
  last = now;
  try { update(dt); draw(); } catch(err) { pageLog("Error in loop: " + err); }
  requestAnimationFrame(loop);
}

// gamepad
function pollGamepad(){
  const gps = navigator.getGamepads ? navigator.getGamepads() : [];
  if (gps && gps[0]){
    const g = gps[0];
    input.left = g.axes[0] < -0.3;
    input.right = g.axes[0] > 0.3;
    input.jump = input.jump || g.buttons[0].pressed;
    input.fire = input.fire || g.buttons[1].pressed;
  }
  requestAnimationFrame(pollGamepad);
}
pollGamepad();

pageLog("Sprites will be visible once generated. Adjust spriteScale in src/game.js to change chunkiness.");
