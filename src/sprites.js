// Sprite generator for retro pixel art (no external assets).
// Exports loadSprites(scale) -> Promise resolving to sprite set with images.
//
// Sprites are generated from tiny character maps and scaled up by `scale`
// using nearest-neighbor rendering to keep a crisp pixel look.

export async function loadSprites(scale = 4) {
  // simple palette (retro)
  const palette = {
    '.': null,
    '1': '#ffd559', // yellow / player accent
    '2': '#ff9b9b', // red
    '3': '#6ee6ff', // cyan
    '4': '#2b4b52', // slate
    '5': '#8b5a2b', // brown (platform)
    '6': '#ffffff', // white highlight
    '7': '#28414a', // dark outline
    '8': '#ffde9e'  // coin highlight
  };

  // Helper: create an Image from a char grid
  function charGridToImage(grid, paletteMap, sx = scale, sy = scale) {
    const h = grid.length;
    const w = grid[0].length;
    const cw = w * sx, ch = h * sy;
    const off = document.createElement('canvas');
    off.width = cw;
    off.height = ch;
    const c = off.getContext('2d');
    // disable smoothing when scaling up
    c.imageSmoothingEnabled = false;

    for (let y = 0; y < h; y++) {
      const row = grid[y];
      for (let x = 0; x < w; x++) {
        const chKey = row[x];
        const color = paletteMap[chKey] || null;
        if (!color) continue;
        c.fillStyle = color;
        c.fillRect(x * sx, y * sy, sx, sy);
      }
    }
    // convert to Image
    const img = new Image();
    img.src = off.toDataURL('image/png');
    return img;
  }

  // Sprite definitions (tiny pixel art maps)
  // Player: 3 frames (idle / walk1 / walk2) - 8x10
  const playerFrames = [
    [
      "........",
      "..7777..",
      ".777777.",
      ".77..77.",
      ".777777.",
      ".7.11.7.",
      ".7.11.7.",
      ".7.11.7.",
      ".7....7.",
      "........"
    ],
    [
      "........",
      "..7777..",
      ".777777.",
      ".77..77.",
      ".777777.",
      ".7.11.7.",
      ".7.11.7.",
      ".7.11.7.",
      ".7.1...7",
      "........"
    ],
    [
      "........",
      "..7777..",
      ".777777.",
      ".77..77.",
      ".777777.",
      ".7.11.7.",
      ".7.11.7.",
      ".7.11.7.",
      "7......7",
      "........"
    ]
  ];

  // Enemy (8x8)
  const enemy = [
    "........",
    "..2222..",
    ".222222.",
    ".2.22.2.",
    ".222222.",
    ".2.22.2.",
    ".2....2.",
    "........"
  ];

  // Coin (6x6)
  const coin = [
    "......",
    ".8888.",
    ".8..8.",
    ".8..8.",
    ".8888.",
    "......"
  ];

  // Ground tile (16x8) — simple repeated pattern
  const ground = [
    "................",
    "................",
    "................",
    "........555555..",
    ".......5555555..",
    "......55555555..",
    ".....555555555..",
    "................"
  ];

  // Background tile (cloud-ish small 8x6 block) for parallax accents
  const cloud = [
    "........",
    "...11...",
    ".11111..",
    ".11111..",
    "..111...",
    "........"
  ];

  // Build images
  const sprites = {
    player: { frames: playerFrames.map(f => charGridToImage(f, palette, scale, scale)) },
    enemy: charGridToImage(enemy, palette, scale, scale),
    coin: charGridToImage(coin, palette, scale, scale),
    ground: charGridToImage(ground, palette, scale, scale),
    cloud: charGridToImage(cloud, palette, scale, scale)
  };

  // Wait for all images to load (in practice dataURLs load immediately but keep robust)
  const allImages = [
    ...sprites.player.frames,
    sprites.enemy,
    sprites.coin,
    sprites.ground,
    sprites.cloud
  ];

  await Promise.all(allImages.map(img => new Promise((res) => {
    if (img.complete) return res();
    img.onload = () => res();
    img.onerror = () => res();
  })));

  return sprites;
}
