/* eslint-disable */
// One-off asset generator for the 7-Card Rummy app icon.
// Designs a fanned playing-card motif with a bold "7" on casino-felt green,
// then rasterizes the SVG into the PNGs Expo needs.
//
//   node scripts/generate-icon.js
//
// Requires `sharp` (install with: npm i --no-save sharp).

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const OUT = path.join(__dirname, "..", "assets", "images");
fs.mkdirSync(OUT, { recursive: true });

const FELT = "#0c7a43"; // casino felt green
const FELT_DARK = "#064d29";
const GOLD = "#e7c15a";
const RED = "#d4243f";
const INK = "#15233f";

// --- Suit symbols (paths centered roughly on origin) -------------------------
const heart = (fill) =>
  `<path d="M0,52 C0,52 -52,16 -52,-16 C-52,-40 -26,-46 0,-20 C26,-46 52,-40 52,-16 C52,16 0,52 0,52 Z" fill="${fill}"/>`;

const spade = (fill) =>
  `<g fill="${fill}"><path d="M0,-52 C0,-52 52,-6 52,22 C52,44 30,52 14,44 C18,56 26,64 36,70 L-36,70 C-26,64 -18,56 -14,44 C-30,52 -52,44 -52,22 C-52,-6 0,-52 0,-52 Z"/></g>`;

const diamond = (fill) =>
  `<path d="M0,-56 L40,0 L0,56 L-40,0 Z" fill="${fill}"/>`;

// Bold blocky "7" inside a 160x220 box, top-left at origin.
const sevenPath = (fill) =>
  `<path d="M0,0 L160,0 L160,44 L78,220 L26,220 L108,44 L0,44 Z" fill="${fill}"/>`;

// --- A single playing card ----------------------------------------------------
function card({ x, y, w = 300, h = 440, rot = 0, pivotX, pivotY, face }) {
  const transform =
    rot !== 0 ? `rotate(${rot} ${pivotX} ${pivotY})` : "";
  return `
  <g transform="${transform}">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="30" ry="30"
          fill="#ffffff" stroke="${GOLD}" stroke-width="5"/>
    ${face(x, y, w, h)}
  </g>`;
}

// Center card face: small corner hearts + big red 7 + heart accent.
function centerFace(x, y, w, h) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  return `
    <g transform="translate(${x + 36} ${y + 40}) scale(0.32)">${heart(RED)}</g>
    <g transform="translate(${x + w - 36} ${y + h - 40}) scale(0.32) rotate(180)">${heart(RED)}</g>
    <g transform="translate(${cx - 80} ${cy - 150})">${sevenPath(RED)}</g>
    <g transform="translate(${cx} ${cy + 120}) scale(0.85)">${heart(RED)}</g>`;
}

function spadeFace(x, y, w, h) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  return `
    <g transform="translate(${x + 36} ${y + 44}) scale(0.30)">${spade(INK)}</g>
    <g transform="translate(${cx} ${cy}) scale(1.0)">${spade(INK)}</g>`;
}

function diamondFace(x, y, w, h) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  return `
    <g transform="translate(${x + 36} ${y + 44}) scale(0.30)">${diamond(RED)}</g>
    <g transform="translate(${cx} ${cy}) scale(1.1)">${diamond(RED)}</g>`;
}

// --- The fanned card cluster (used by both full and foreground variants) ------
function cluster() {
  const px = 512;
  const py = 740; // fan pivot near bottom-center
  // back-left and back-right are drawn first, center on top
  return `
    <!-- soft shadow under the fan -->
    <ellipse cx="512" cy="800" rx="300" ry="46" fill="#000000" opacity="0.22"/>
    ${card({ x: 362, y: 300, rot: -22, pivotX: px, pivotY: py, face: spadeFace })}
    ${card({ x: 362, y: 300, rot: 22, pivotX: px, pivotY: py, face: diamondFace })}
    ${card({ x: 362, y: 290, rot: 0, face: centerFace })}`;
}

// --- Full-bleed icon (iOS / web / splash) ------------------------------------
const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="felt" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${FELT}"/>
      <stop offset="1" stop-color="${FELT_DARK}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.4" r="0.7">
      <stop offset="0" stop-color="#19a35e" stop-opacity="0.9"/>
      <stop offset="1" stop-color="#19a35e" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" rx="220" ry="220" fill="url(#felt)"/>
  <rect width="1024" height="1024" rx="220" ry="220" fill="url(#glow)"/>
  <rect x="40" y="40" width="944" height="944" rx="188" ry="188"
        fill="none" stroke="${GOLD}" stroke-width="10" opacity="0.85"/>
  ${cluster()}
</svg>`;

// --- Android adaptive foreground (transparent, logo in safe zone) ------------
// Scale the cluster down to ~66% and recenter so nothing is clipped by masks.
const foregroundSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <g transform="translate(512 540) scale(0.68) translate(-512 -540)">
    ${cluster()}
  </g>
</svg>`;

async function render(svg, file, size) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(path.join(OUT, file));
  console.log("wrote", file, `${size}x${size}`);
}

(async () => {
  await render(fullSvg, "icon.png", 1024);
  await render(fullSvg, "splash-icon.png", 1024);
  await render(foregroundSvg, "adaptive-icon.png", 1024);
  await render(fullSvg, "favicon.png", 48);
  console.log("done");
})();
