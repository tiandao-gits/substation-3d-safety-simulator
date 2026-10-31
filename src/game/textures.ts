import * as THREE from 'three';
import { SCENE_SIGN_TEXT } from '../config/gameText';

// Deterministic pseudo-random helper for consistent procedural textures
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SubstationTextures {
  skybox: THREE.CanvasTexture;
  roadAlbedo: THREE.CanvasTexture;
  roadBump: THREE.CanvasTexture;
  gravelAlbedo: THREE.CanvasTexture;
  gravelBump: THREE.CanvasTexture;
  wallAlbedo: THREE.CanvasTexture;
  signNoClimb: THREE.CanvasTexture;
  signHighVoltage: THREE.CanvasTexture;
  conservatorCap: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  dispose: () => void;
}

export function createSubstationTextures(maxAnisotropy = 4): SubstationTextures {
  const skybox = createSkyboxTexture();
  const { albedo: roadAlbedo, bump: roadBump } = createConcreteRoadTextures(maxAnisotropy);
  const { albedo: gravelAlbedo, bump: gravelBump } = createGravelTextures(maxAnisotropy);
  const wallAlbedo = createPerimeterWallTexture(maxAnisotropy);
  const signNoClimb = createWarningSignTexture('prohibit-climb', maxAnisotropy);
  const signHighVoltage = createWarningSignTexture('high-voltage', maxAnisotropy);
  const conservatorCap = createConservatorCapTexture(maxAnisotropy);
  const contactShadow = createContactShadowTexture();

  return {
    skybox,
    roadAlbedo,
    roadBump,
    gravelAlbedo,
    gravelBump,
    wallAlbedo,
    signNoClimb,
    signHighVoltage,
    conservatorCap,
    contactShadow,
    dispose() {
      skybox.dispose();
      roadAlbedo.dispose();
      roadBump.dispose();
      gravelAlbedo.dispose();
      gravelBump.dispose();
      wallAlbedo.dispose();
      signNoClimb.dispose();
      signHighVoltage.dispose();
      conservatorCap.dispose();
      contactShadow.dispose();
    },
  };
}

function createSkyboxTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  const rand = mulberry32(20261028);

  // Sky zenith to horizon gradient (Note: equirectangular horizon is y=512; camera FOV sees y=310..512)
  const skyGrad = ctx.createLinearGradient(0, 0, 0, 524);
  skyGrad.addColorStop(0.0, '#0c3268');
  skyGrad.addColorStop(0.55, '#1b5bb8');
  skyGrad.addColorStop(0.76, '#2d74d6');
  skyGrad.addColorStop(0.92, '#5396eb');
  skyGrad.addColorStop(1.0, '#8dc0f6');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, canvas.width, 524);

  // Lower hemisphere ground bounce
  const groundGrad = ctx.createLinearGradient(0, 524, 0, canvas.height);
  groundGrad.addColorStop(0.0, '#7c8792');
  groundGrad.addColorStop(0.15, '#5a626a');
  groundGrad.addColorStop(1.0, '#363b40');
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, 524, canvas.width, canvas.height - 524);

  // Fluffy cumulus clouds concentrated in the 8°..35° elevation band (y = 330..475) visible to camera
  for (let c = 0; c < 34; c++) {
    const cx = rand() * canvas.width;
    const cy = 335 + rand() * 135;
    const scale = 0.55 + rand() * 0.85;
    const puffs = 5 + Math.floor(rand() * 5);

    // Cloud base shadow
    for (let p = 0; p < puffs; p++) {
      const px = (cx + (p - puffs / 2) * 26 * scale + canvas.width) % canvas.width;
      const py = cy + 9 * scale + (rand() - 0.5) * 8 * scale;
      const r = (18 + rand() * 22) * scale;
      const g = ctx.createRadialGradient(px, py, r * 0.15, px, py, r);
      g.addColorStop(0, 'rgba(135, 165, 204, 0.52)');
      g.addColorStop(1, 'rgba(135, 165, 204, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Crisp sunlit white cloud puffs
    for (let p = 0; p < puffs; p++) {
      const px = (cx + (p - puffs / 2) * 24 * scale + canvas.width) % canvas.width;
      const py = cy - Math.sin((p / puffs) * Math.PI) * 16 * scale + (rand() - 0.5) * 8;
      const r = (20 + rand() * 26) * scale;
      const g = ctx.createRadialGradient(px, py - r * 0.2, r * 0.1, px, py, r);
      g.addColorStop(0, 'rgba(255, 255, 255, 0.96)');
      g.addColorStop(0.55, 'rgba(246, 251, 255, 0.75)');
      g.addColorStop(1, 'rgba(240, 248, 255, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Distant mountain range silhouette along horizon (y around 520..545)
  ctx.fillStyle = '#7e8c99';
  ctx.beginPath();
  ctx.moveTo(0, 545);
  for (let x = 0; x <= canvas.width; x += 16) {
    const t = (x / canvas.width) * Math.PI * 2;
    const h =
      Math.sin(t * 3) * 18 +
      Math.cos(t * 7 + 1.2) * 11 +
      Math.sin(t * 15) * 5 +
      26;
    ctx.lineTo(x, 542 - Math.max(4, h));
  }
  ctx.lineTo(canvas.width, 545);
  ctx.closePath();
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createConcreteRoadTextures(maxAnisotropy: number): {
  albedo: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
} {
  const width = 512;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = width;
  bumpCanvas.height = height;
  const bCtx = bumpCanvas.getContext('2d')!;

  const rand = mulberry32(991122);

  // Base brushed concrete color matching reference road
  ctx.fillStyle = '#c2c5c8';
  ctx.fillRect(0, 0, width, height);

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, width, height);

  // Subtle concrete grain & weathering
  for (let i = 0; i < 9000; i++) {
    const x = rand() * width;
    const y = rand() * height;
    const v = 175 + Math.floor((rand() - 0.5) * 38);
    ctx.fillStyle = `rgb(${v},${v + 1},${v + 2})`;
    ctx.fillRect(x, y, 2, 2);

    const bv = 128 + Math.floor((rand() - 0.5) * 44);
    bCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
    bCtx.fillRect(x, y, 2, 2);
  }

  // Subtle longitudinal tire/equipment wear bands
  const leftTrack = ctx.createLinearGradient(0, 0, width, 0);
  leftTrack.addColorStop(0, 'rgba(90,95,100,0.08)');
  leftTrack.addColorStop(0.28, 'rgba(80,84,88,0.12)');
  leftTrack.addColorStop(0.5, 'rgba(255,255,255,0.03)');
  leftTrack.addColorStop(0.72, 'rgba(80,84,88,0.12)');
  leftTrack.addColorStop(1, 'rgba(90,95,100,0.08)');
  ctx.fillStyle = leftTrack;
  ctx.fillRect(0, 0, width, height);

  // Transverse expansion joint seams
  ctx.fillStyle = 'rgba(75, 80, 85, 0.55)';
  ctx.fillRect(0, 0, width, 3);
  ctx.fillRect(0, height / 2, width, 2);
  bCtx.fillStyle = '#303030';
  bCtx.fillRect(0, 0, width, 3);
  bCtx.fillRect(0, height / 2, width, 2);

  // Center subtle seam
  ctx.fillStyle = 'rgba(90, 95, 100, 0.3)';
  ctx.fillRect(width / 2 - 1, 0, 2, height);

  // Crisp Twin Yellow Safety Lines inset from road curbs (matching reference photo!)
  ctx.fillStyle = '#eab308';
  ctx.fillRect(34, 0, 14, height);
  ctx.fillRect(width - 48, 0, 14, height);

  // Subtle road grit over yellow paint so it looks painted on concrete
  for (let i = 0; i < 450; i++) {
    const isLeft = rand() > 0.5;
    const x = (isLeft ? 34 : width - 48) + rand() * 14;
    const y = rand() * height;
    ctx.fillStyle = 'rgba(180, 140, 20, 0.35)';
    ctx.fillRect(x, y, 2, 3);
  }

  const albedo = new THREE.CanvasTexture(canvas);
  albedo.colorSpace = THREE.SRGBColorSpace;
  albedo.wrapS = THREE.RepeatWrapping;
  albedo.wrapT = THREE.RepeatWrapping;
  albedo.repeat.set(1, 14);
  albedo.anisotropy = maxAnisotropy;

  const bump = new THREE.CanvasTexture(bumpCanvas);
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(1, 14);
  bump.anisotropy = maxAnisotropy;

  return { albedo, bump };
}

function createGravelTextures(maxAnisotropy: number): {
  albedo: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
} {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;

  const rand = mulberry32(445566);

  // Dark interstitial shadow between crushed gravel stones
  ctx.fillStyle = '#33302c';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#181818';
  bCtx.fillRect(0, 0, size, size);

  const stonePalette = [
    '#7c7670',
    '#948d85',
    '#635e59',
    '#a8a199',
    '#524d49',
    '#877f75',
    '#b5aea4',
  ];

  // Draw dense angular crushed ballast stones (wrapped across tile borders)
  for (let i = 0; i < 2600; i++) {
    const cx = rand() * size;
    const cy = rand() * size;
    const rx = 4 + rand() * 8;
    const ry = 3 + rand() * 7;
    const rot = rand() * Math.PI;
    const baseColor = stonePalette[Math.floor(rand() * stonePalette.length)];
    const bumpVal = 140 + Math.floor(rand() * 110);

    // Tile wrapping offsets for seamless repeat
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const px = cx + ox;
        const py = cy + oy;
        if (px < -20 || px > size + 20 || py < -20 || py > size + 20) continue;

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(rot);
        ctx.fillStyle = baseColor;
        ctx.beginPath();
        ctx.moveTo(-rx, -ry * 0.4);
        ctx.lineTo(-rx * 0.3, -ry);
        ctx.lineTo(rx * 0.8, -ry * 0.6);
        ctx.lineTo(rx, ry * 0.3);
        ctx.lineTo(rx * 0.2, ry);
        ctx.lineTo(-rx * 0.7, ry * 0.7);
        ctx.closePath();
        ctx.fill();

        // Top-left sunlit bevel highlight on each stone
        ctx.fillStyle = 'rgba(255, 250, 242, 0.22)';
        ctx.beginPath();
        ctx.arc(-rx * 0.2, -ry * 0.2, rx * 0.45, 0, Math.PI * 2);
        ctx.fill();

        // Dark bottom edge
        ctx.strokeStyle = 'rgba(25, 22, 20, 0.65)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();

        // Bump height
        bCtx.save();
        bCtx.translate(px, py);
        bCtx.rotate(rot);
        bCtx.fillStyle = `rgb(${bumpVal},${bumpVal},${bumpVal})`;
        bCtx.beginPath();
        bCtx.arc(0, 0, (rx + ry) * 0.42, 0, Math.PI * 2);
        bCtx.fill();
        bCtx.restore();
      }
    }
  }

  const albedo = new THREE.CanvasTexture(canvas);
  albedo.colorSpace = THREE.SRGBColorSpace;
  albedo.wrapS = THREE.RepeatWrapping;
  albedo.wrapT = THREE.RepeatWrapping;
  albedo.repeat.set(22, 28);
  albedo.anisotropy = maxAnisotropy;

  const bump = new THREE.CanvasTexture(bumpCanvas);
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(22, 28);
  bump.anisotropy = maxAnisotropy;

  return { albedo, bump };
}

function createPerimeterWallTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Precast industrial concrete panel wall with safety yellow/black hazard stripe at base
  ctx.fillStyle = '#cfd4d8';
  ctx.fillRect(0, 0, 512, 256);

  // Panel vertical pilasters & horizontal reveals
  ctx.fillStyle = '#aeb5bc';
  ctx.fillRect(0, 0, 512, 18);
  ctx.fillRect(0, 210, 512, 46);
  for (let x = 0; x < 512; x += 128) {
    ctx.fillStyle = '#b6bdc4';
    ctx.fillRect(x, 0, 12, 256);
    ctx.fillStyle = '#8d959e';
    ctx.fillRect(x + 12, 0, 2, 256);
  }

  // Subtle horizontal groove lines
  ctx.fillStyle = 'rgba(110, 118, 126, 0.35)';
  for (let y = 48; y < 200; y += 36) {
    ctx.fillRect(0, y, 512, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(16, 1);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createWarningSignTexture(
  variant: 'prohibit-climb' | 'high-voltage',
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 384;
  const ctx = canvas.getContext('2d')!;

  // White baked-enamel aluminum sign plate
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 512, 384);

  // Outer red border
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 14;
  ctx.strokeRect(14, 14, 484, 356);

  if (variant === 'prohibit-climb') {
    // Left: Yellow Triangle Lightning Warning
    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(145, 52);
    ctx.lineTo(235, 208);
    ctx.lineTo(55, 208);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Lightning bolt inside triangle
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.moveTo(152, 88);
    ctx.lineTo(122, 144);
    ctx.lineTo(148, 144);
    ctx.lineTo(132, 194);
    ctx.lineTo(176, 132);
    ctx.lineTo(148, 132);
    ctx.closePath();
    ctx.fill();

    // Right: Red Prohibition Circle (No Climbing)
    const cx = 365;
    const cy = 132;
    const r = 74;
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // Ladder / figure icon inside prohibition circle
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(cx - 24, cy - 42);
    ctx.lineTo(cx - 24, cy + 42);
    ctx.moveTo(cx + 24, cy - 42);
    ctx.lineTo(cx + 24, cy + 42);
    for (let ry = -26; ry <= 26; ry += 18) {
      ctx.moveTo(cx - 24, cy + ry);
      ctx.lineTo(cx + 24, cy + ry);
    }
    ctx.stroke();

    // Diagonal slash
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.moveTo(cx - 52, cy - 52);
    ctx.lineTo(cx + 52, cy + 52);
    ctx.stroke();

    // Bottom Red Banner with Bold White Text: "禁止攀登，高压有电"
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(28, 242, 456, 114);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 46px "Plus Jakarta Sans", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(SCENE_SIGN_TEXT.noClimbBanner, 256, 299);
  } else {
    // High-Voltage Danger Plaque ("高压危险") matching right foreground sign in reference photo
    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(256, 40);
    ctx.lineTo(372, 224);
    ctx.lineTo(140, 224);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Lightning bolt
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.moveTo(266, 78);
    ctx.lineTo(226, 148);
    ctx.lineTo(260, 148);
    ctx.lineTo(240, 210);
    ctx.lineTo(296, 134);
    ctx.lineTo(262, 134);
    ctx.closePath();
    ctx.fill();

    // Bottom Red Box: "高压危险"
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(28, 244, 456, 112);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 68px "Plus Jakarta Sans", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(SCENE_SIGN_TEXT.highVoltageDanger, 256, 302);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createConservatorCapTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#9aa3a0';
  ctx.fillRect(0, 0, 256, 256);

  // Outer bolt ring
  ctx.strokeStyle = '#5a6360';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(128, 128, 114, 0, Math.PI * 2);
  ctx.stroke();

  // White industrial nameplate rectangle in center (matching the conservator tank cap in photo)
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(48, 78, 160, 100);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 3;
  ctx.strokeRect(48, 78, 160, 100);

  // Red & Teal industrial emblem + text
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.arc(92, 115, 16, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#0f766e';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(SCENE_SIGN_TEXT.conservatorTitle, 114, 122);

  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(SCENE_SIGN_TEXT.conservatorSubtitle, 128, 156);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
  grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.22)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}
