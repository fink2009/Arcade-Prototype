// src/sprites.js
// Larger pixel-art sprite generator to approximate a 16-bit "run-and-gun" aesthetic.
// Returns images scaled by `scale`. Use scale 3..6 for chunky pixels.
//
// Note: These are programmatic pixel art pieces (not hand-drawn Metal Slug assets).
// They are intended as a direct-in-repo upgrade from the tiny sprites; you can
// later replace these with artist-made PNG sprite sheets if you want fully-authentic art.

export async function loadSprites(scale = 4) {
  const palette = {
    '.': null,
    '1': '#ffd559', // yellow accent
    '2': '#ff9b9b', // red
    '3': '#6ee6ff', // cyan / blue
    '4': '#2b4b52', // dark slate outline
    '5': '#8b5a2b', // brown (platform)
    '6': '#ffffff', // white highlight
    '7': '#28414a', // dark interior
    '8': '#b47a2d', // bronze highlight
    '9': '#a3a3a3', // metallic gray
    'A': '#1f2a2f', // dark shadow
    'B': '#ffd0a6'  // skin tone
  };

  function charGridToImage(grid, paletteMap, sx = scale, sy = scale) {
    const h = grid.length;
    const w = grid[0].length;
    const cw = w * sx, ch = h * sy;
    const off = document.createElement('canvas');
    off.width = cw;
    off.height = ch;
    const c = off.getContext('2d');
    c.imageSmoothingEnabled = false;
    for (let y = 0; y < h; y++) {
      const row = grid[y];
      for (let x = 0; x < w; x++) {
        const key = row[x];
        const color = paletteMap[key] || null;
        if (!color) continue;
        c.fillStyle = color;
        c.fillRect(x * sx, y * sy, sx, sy);
      }
    }
    const img = new Image();
    img.src = off.toDataURL('image/png');
    return img;
  }

  // Larger, more detailed player frames (16x24)
  const playerFrames = [
    // Idle / standing (16x24)
    [
      "................",
      ".......44.......",
      "......4444......",
      ".....447744.....",
      "....4477744.....",
      "....47777744....",
      "...4477BB774....",
      "...447BBBB74....",
      "..4477BBBB774...",
      "..4477B11B774...",
      "..4477B11B774...",
      "..4477B11B774...",
      "..4477B11B774...",
      "...447111774....",
      "....4777774.....",
      "....4777774.....",
      ".....44444......",
      ".....4..4.......",
      ".....4..4.......",
      ".....4..4.......",
      ".....4..4.......",
      "................",
      "................",
      "................"
    ],
    // Run frame A
    [
      "................",
      ".......44.......",
      "......4444......",
      ".....447744.....",
      "....4477744.....",
      "....47777744....",
      "...4477BB774....",
      "...447BBBB74....",
      "..4477BBBB774...",
      ".44477B11B774...",
      ".44477711B774...",
      "..4477B11B774...",
      "...447111774....",
      "....4777774.....",
      ".....477774.....",
      "......4774......",
      "......4444......",
      "......4..4......",
      "......4..4......",
      "......4..4......",
      "......4..4......",
      "................",
      "................",
      "................"
    ],
    // Run frame B (legs forward)
    [
      "................",
      ".......44.......",
      "......4444......",
      ".....447744.....",
      "....4477744.....",
      "....47777744....",
      "...4477BB774....",
      "...447BBBB74....",
      "..4477BBBB774...",
      "..4477B11B774...",
      ".44477B11B774...",
      ".44477B11B774...",
      "..4477111774....",
      "...47777774.....",
      "....477774......",
      ".....4774.......",
      ".....4444.......",
      ".....4..4.......",
      ".....4..4.......",
      ".....4..4.......",
      ".....4..4.......",
      "................",
      "................",
      "................"
    ],
    // Shooting pose (crouch-ish)
    [
      "................",
      ".......44.......",
      "......4444......",
      ".....447744.....",
      "....4477744.....",
      "....47777744....",
      "...4477BB774....",
      "...447BBBB74....",
      "..4477BBBB774...",
      "..4477B11B774...",
      "..4477B11B774...",
      "..4477B11B774...",
      "...447111774....",
      "..4477777774....",
      ".444777777774...",
      ".444777777774...",
      ".444444444444...",
      ".44..4444..44...",
      ".44..4..4..44...",
      ".44..4..4..44...",
      ".44..4..4..44...",
      "................",
      "................",
      "................"
    ]
  ];

  // Enemy (sturdy grunt) 14x18 (we'll pad to 16x24 for simplicity)
  const enemy = [
    "................",
    ".......22.......",
    "......2222......",
    ".....222222.....",
    "....22222222....",
    "....22A222222...",
    "...222A22A222...",
    "...22AA22AA22...",
    "..2222AA22222...",
    "..2222AA22222...",
    "..22A22222A22...",
    "..22A2B22A2.2...",
    "...222222222....",
    "...22.22222.....",
    "....2.2222......",
    "....2..22.......",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................"
  ];

  // Coin (8x8)
  const coin = [
    "........",
    "..8888..",
    ".888888.",
    ".88..88.",
    ".88..88.",
    ".888888.",
    "..8888..",
    "........"
  ];

  // Ground tile (16x8) - more detail
  const ground = [
    "................",
    "................",
    "................",
    "....555555555...",
    "...55A55A55A5....",
    "..55A55A55A55....",
    ".55A55A55A55A....",
    "................"
  ];

  // Background cloud / detail (16x8)
  const cloud = [
    "................",
    "......11........",
    "....111111......",
    "...11111111.....",
    "....111111......",
    "......11........",
    "................",
    "................"
  ];

  // Generate images
  const sprites = {
    player: { frames: playerFrames.map(f => charGridToImage(f, palette, scale, scale)) },
    enemy: charGridToImage(enemy, palette, scale, scale),
    coin: charGridToImage(coin, palette, scale, scale),
    ground: charGridToImage(ground, palette, scale, scale),
    cloud: charGridToImage(cloud, palette, scale, scale)
  };

  const allImages = [
    ...sprites.player.frames,
    sprites.enemy,
    sprites.coin,
    sprites.ground,
    sprites.cloud
  ];

  await Promise.all(allImages.map(img => new Promise(res => {
    if (img.complete) return res();
    img.onload = () => res();
    img.onerror = () => res();
  })));

  return sprites;
}
