```markdown
# Arcade Depth — Prototype

A single-page browser playable prototype demonstrating a 2D classic-arcade aesthetic with advanced mechanics:
- Simulated Z axis (elevation) with gravity
- Perspective scaling and depth-sorted rendering
- Parallax background layers
- Platforms with different heights (z) and collisions
- Player: movement, jump, dash (tunable)
- Enemies: patrol and ranged with simple AI
- Projectiles that are Z-aware (hit only if within Z tolerance)
- Collectibles (coins)
- Particles, HUD, score/lives
- Touch and gamepad support
- Level data as JSON (simple loader)

No build step required. Works by opening index.html or hosting on static hosts like GitHub Pages, Netlify, or Vercel.

How to push to GitHub (quick):
1. Create a new empty repository on GitHub named `arcade-depth-game` (or any name).
2. On your machine:
   git init
   git add .
   git commit -m "Initial arcade-depth-game prototype"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/arcade-depth-game.git
   git push -u origin main

Enable GitHub Pages:
- In the repository settings > Pages > Source: choose branch main and root folder. Save. The site will be available at https://YOUR_USERNAME.github.io/arcade-depth-game/ within minutes.

Or deploy to Netlify / Vercel by dragging the project folder into the dashboard or connecting the repo.

If you'd like, I can:
- Prepare a complete ZIP of the repo contents in this chat (so you can download).
- Scaffold a repository for you (I can prepare instructions for pushing or — if you create an empty repo and share the URL — I can push files for you).
- Convert to a Phaser or Pixi project with an asset pipeline and tilemap support.

Enjoy! Open index.html to play the prototype.
```