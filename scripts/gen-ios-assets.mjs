/*
 * Génère les PNG iOS de Kola depuis icons/icon.svg (source vectorielle unique) :
 *  - icons/icon-512.png, icon-192.png, apple-touch-icon-180.png (palette PNG, ~5–12 Ko)
 *  - icons/splash/splash-{w}x{h}[-dark].png — écrans de démarrage iOS,
 *    une taille exacte par appareil (Safari exige les dimensions natives en px).
 *
 * Script DEV uniquement — n'est pas déployé (l'app reste zéro dépendance).
 * Usage :  npm i sharp  &&  node scripts/gen-ios-assets.mjs
 */
import sharp from "sharp";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const icons = join(root, "icons");
const out = join(icons, "splash");
mkdirSync(out, { recursive: true });

const OPTS = { palette: true, colors: 192, compressionLevel: 9, effort: 10 };

// Icônes applicatives
await sharp(join(icons, "icon.svg")).resize(512, 512).png(OPTS).toFile(join(icons, "icon-512.png"));
await sharp(join(icons, "icon.svg")).resize(192, 192).png(OPTS).toFile(join(icons, "icon-192.png"));
await sharp(join(icons, "icon.svg")).resize(180, 180).png(OPTS).toFile(join(icons, "apple-touch-icon-180.png"));

// Écrans de démarrage : [largeur, hauteur, dpr] (portrait, tailles d'appareils iOS en px)
const DEVICES = [
  [750, 1334, 2],    // iPhone SE / 8
  [828, 1792, 2],    // iPhone XR / 11
  [1125, 2436, 3],   // iPhone X / XS / 11 Pro
  [1170, 2532, 3],   // iPhone 12 / 13 / 14
  [1284, 2778, 3],   // iPhone 12/13/14 Plus
  [1179, 2556, 3],   // iPhone 14 Pro / 15 / 15 Pro / 16
  [1290, 2796, 3],   // iPhone 14/15/16 Pro Max / Plus
  [1206, 2622, 3],   // iPhone 16 Pro
  [1668, 2388, 2],   // iPad Air 3 / Pro 10.5 / 11"
  [2048, 2732, 2],   // iPad Pro 12.9"
];

for (const [w, h, dpr] of DEVICES){
  for (const dark of [false, true]){
    // fond uni = app background ; icône centrée ~1/7 du petit côté
    const icSize = Math.max(256, Math.round(Math.min(w, h) / 7));
    const iconPng = await sharp(join(icons, "icon.svg")).resize(icSize, icSize).png().toBuffer();
    await sharp({ create: { width: w, height: h, channels: 4, background: dark ? "#000000" : "#f2f2f7" } })
      .composite([{ input: iconPng, left: Math.round((w - icSize) / 2), top: Math.round((h - icSize) / 2) }])
      .png({ palette: true, colors: 200, compressionLevel: 9, effort: 10 })
      .toFile(join(out, `splash-${w}x${h}${dark ? "-dark" : ""}.png`));
  }
}
console.log("✓ Icônes + 20 splash screens générés dans", out);