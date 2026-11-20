/* Generator tekstur PBR prosedural (albedo, bump, logam disikat, PCB, kabel braided, dan label komponen) tanpa ketergantungan berkas eksternal */

import * as THREE from 'three';

export interface ProceduralTexturePack {
  esdAlbedo: THREE.CanvasTexture;
  esdBump: THREE.CanvasTexture;
  pcbAlbedo: THREE.CanvasTexture;
  pcbBump: THREE.CanvasTexture;
  lgaPinsAlbedo: THREE.CanvasTexture;
  brushedMetalBump: THREE.CanvasTexture;
  braidedCableBump: THREE.CanvasTexture;
  honeycombVentAlbedo: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  deskWoodAlbedo: THREE.CanvasTexture;
  rgbDeskGlow: THREE.CanvasTexture;
}

export function createProceduralTexturePack(maxAnisotropy: number): ProceduralTexturePack {
  return {
    esdAlbedo: createEsdMatAlbedo(maxAnisotropy),
    esdBump: createEsdMatBump(maxAnisotropy),
    pcbAlbedo: createMotherboardPcbAlbedo(maxAnisotropy),
    pcbBump: createMotherboardPcbBump(maxAnisotropy),
    lgaPinsAlbedo: createLgaPinGridTexture(maxAnisotropy),
    brushedMetalBump: createBrushedMetalBump(maxAnisotropy),
    braidedCableBump: createBraidedCableBump(maxAnisotropy),
    honeycombVentAlbedo: createHoneycombVentTexture(maxAnisotropy),
    contactShadow: createContactShadowTexture(),
    deskWoodAlbedo: createWorkshopDeskAlbedo(maxAnisotropy),
    rgbDeskGlow: createRgbDeskGlowTexture(),
  };
}

export function disposeProceduralTexturePack(pack: ProceduralTexturePack): void {
  Object.values(pack).forEach((tex) => tex.dispose());
}

function createWorkshopDeskAlbedo(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1f242d';
  ctx.fillRect(0, 0, 512, 512);

  // Serat meja kerja karbon / laminasi gelap halus
  for (let y = 0; y < 512; y += 2) {
    const shade = 28 + Math.round(Math.sin(y * 0.14) * 4 + ((y * 17) % 5));
    ctx.fillStyle = `rgb(${shade}, ${shade + 4}, ${shade + 11})`;
    ctx.fillRect(0, y, 512, 1.5);
  }
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)';
  ctx.lineWidth = 1;
  for (let x = 0; x < 512; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  return tex;
}

function createEsdMatAlbedo(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Warna matras silikon anti-statis biru-slate teknisi
  ctx.fillStyle = '#152236';
  ctx.fillRect(0, 0, 1024, 1024);

  // Noise karet silikon mikro
  ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
  for (let i = 0; i < 1800; i++) {
    const x = (i * 197) % 1024;
    const y = (i * 419) % 1024;
    ctx.fillRect(x, y, 2, 2);
  }

  // Grid milimeter presisi
  ctx.strokeStyle = '#223552';
  ctx.lineWidth = 1.25;
  for (let i = 0; i <= 1024; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 1024);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(1024, i);
    ctx.stroke();
  }

  ctx.strokeStyle = '#334f78';
  ctx.lineWidth = 2.2;
  for (let i = 0; i <= 1024; i += 128) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 1024);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(1024, i);
    ctx.stroke();
  }

  // Tepi bingkai & tanda penggaris sentimeter
  ctx.strokeStyle = '#476999';
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, 984, 984);

  ctx.fillStyle = '#7c96bd';
  ctx.font = '600 18px monospace';
  for (let cm = 0; cm <= 14; cm++) {
    const x = 64 + cm * 64;
    ctx.fillRect(x, 968, 2, 18);
    if (cm % 2 === 0) {
      ctx.fillText(`${cm * 5}`, x - 8, 960);
    }
  }

  ctx.fillStyle = '#93adc9';
  ctx.font = 'bold 22px monospace';
  ctx.fillText('RAKITPC LAB · ESD ANTI-STATIC MAT (1M OHM)', 44, 58);
  ctx.font = '600 17px monospace';
  ctx.fillText('ATX / mATX MOUNTING ZONE · GROUNDED WORKSTATION', 44, 86);

  // Tanda sudut kancing grounding ESD
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(956, 72, 22, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#eab308';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('GND', 942, 77);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createEsdMatBump(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 512, 512);

  // Tekstur bintik halus matras silikon
  for (let i = 0; i < 4500; i++) {
    const x = (i * 97 + (i % 7) * 13) % 512;
    const y = (i * 211 + (i % 5) * 19) % 512;
    ctx.fillStyle = i % 2 === 0 ? '#929292' : '#6e6e6e';
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.strokeStyle = '#606060';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 512; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createMotherboardPcbAlbedo(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Soldermask matte hitam-biru gelap realistis
  ctx.fillStyle = '#0a101d';
  ctx.fillRect(0, 0, 1024, 1024);

  // Poligon aksen desain papan induk modern
  ctx.fillStyle = '#111b2e';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(420, 0);
  ctx.lineTo(260, 1024);
  ctx.lineTo(0, 1024);
  ctx.closePath();
  ctx.fill();

  // Jalur tembaga bus memori (CPU -> DIMM)
  ctx.strokeStyle = '#1e3a5f';
  ctx.lineWidth = 2.6;
  for (let i = 0; i < 18; i++) {
    const y = 215 + i * 13;
    ctx.beginPath();
    ctx.moveTo(435, y);
    ctx.lineTo(500, y);
    ctx.lineTo(525, y + (i % 2 === 0 ? -8 : 8));
    ctx.lineTo(615, y + (i % 2 === 0 ? -8 : 8));
    ctx.stroke();
  }

  // Jalur tembaga PCIe & M.2 (CPU -> M.2 -> PCIe x16)
  ctx.strokeStyle = '#1b3554';
  ctx.lineWidth = 2.4;
  for (let i = 0; i < 12; i++) {
    const x = 250 + i * 16;
    ctx.beginPath();
    ctx.moveTo(x, 465);
    ctx.lineTo(x, 600);
    ctx.lineTo(x + 28, 635);
    ctx.lineTo(x + 28, 790);
    ctx.stroke();
  }

  // Jalur audio terisolasi di sudut kiri bawah (garis tembaga keemasan tipis)
  ctx.strokeStyle = '#785a28';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(145, 740);
  ctx.lineTo(145, 995);
  ctx.stroke();

  // Titik solder via mikro (gold/tin pads)
  ctx.fillStyle = '#b48a3e';
  for (let i = 0; i < 42; i++) {
    const vx = 470 + (i % 6) * 20;
    const vy = 225 + Math.floor(i / 6) * 34;
    ctx.beginPath();
    ctx.arc(vx, vy, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 36; i++) {
    const vx = 180 + (i % 12) * 26;
    const vy = 855 + Math.floor(i / 12) * 24;
    ctx.beginPath();
    ctx.arc(vx, vy, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // 9 Lubang mounting baut dengan cincin solder tembaga
  const mountXs = [48, 512, 976];
  const mountYs = [52, 512, 972];
  for (const mx of mountXs) {
    for (const my of mountYs) {
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(mx, my, 15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#05080f';
      ctx.beginPath();
      ctx.arc(mx, my, 9, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Border & Silkscreen teknis autentik
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 5;
  ctx.strokeRect(12, 12, 1000, 1000);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 26px monospace';
  ctx.fillText('RAKITPC B760 PRO ATX · REV 3.0', 180, 968);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 18px monospace';
  ctx.fillText('CPU_PWR1 8-PIN', 120, 44);
  ctx.fillText('DIMM A1  A2*  B1  B2*', 618, 128);
  ctx.fillText('ATX_24P', 880, 325);
  ctx.fillText('M.2_1 PCIe 4.0 x4', 255, 622);
  ctx.fillText('PCIEX16_GEN4 ARMOR', 240, 774);
  ctx.fillText('AUDIO ISOLATED', 24, 980);
  ctx.fillText('JFP1 · USB3 · SATA', 610, 968);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createMotherboardPcbBump(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#707070';
  ctx.fillRect(0, 0, 512, 512);

  // Relief jalur tembaga & via solder agar memantulkan cahaya studio pada sudut miring
  ctx.strokeStyle = '#a8a8a8';
  ctx.lineWidth = 2;
  for (let i = 0; i < 18; i++) {
    const y = 108 + i * 6.5;
    ctx.beginPath();
    ctx.moveTo(217, y);
    ctx.lineTo(308, y);
    ctx.stroke();
  }
  for (let i = 0; i < 12; i++) {
    const x = 125 + i * 8;
    ctx.beginPath();
    ctx.moveTo(x, 232);
    ctx.lineTo(x, 395);
    ctx.stroke();
  }

  ctx.fillStyle = '#d4d4d4';
  for (let i = 0; i < 42; i++) {
    const vx = 235 + (i % 6) * 10;
    const vy = 112 + Math.floor(i / 6) * 17;
    ctx.fillRect(vx, vy, 2, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createLgaPinGridTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#6b4f15';
  ctx.fillRect(0, 0, 256, 256);

  // Kisi pin emas mikro LGA1700 + ruang kapasitor tengah
  for (let y = 10; y < 246; y += 6) {
    for (let x = 10; x < 246; x += 6) {
      const inCenter = x > 92 && x < 164 && y > 84 && y < 172;
      if (inCenter) continue;
      ctx.fillStyle = (x + y) % 12 === 0 ? '#facc15' : '#ca8a04';
      ctx.fillRect(x, y, 3, 3);
    }
  }

  ctx.fillStyle = '#14532d';
  ctx.fillRect(96, 88, 64, 80);
  ctx.fillStyle = '#d97706';
  for (let y = 96; y < 160; y += 12) {
    for (let x = 104; x < 152; x += 12) {
      ctx.fillRect(x, y, 6, 4);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createBrushedMetalBump(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);

  for (let y = 0; y < 256; y++) {
    const v = 112 + ((y * 29 + (y % 5) * 11) % 34);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(0, y, 256, 1);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = maxAnisotropy;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createBraidedCableBump(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#686868';
  ctx.fillRect(0, 0, 128, 128);

  // Anyaman silang nilon sleeved cable
  ctx.strokeStyle = '#c8c8c8';
  ctx.lineWidth = 4;
  for (let i = -128; i < 256; i += 14) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 128, 128);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(i + 128, 0);
    ctx.lineTo(i, 128);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = maxAnisotropy;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 2);
  return tex;
}

function createHoneycombVentTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = '#070b14';
  const r = 8;
  const dx = 18;
  const dy = 16;
  for (let row = 0; row < 18; row++) {
    for (let col = 0; col < 16; col++) {
      const cx = col * dx + (row % 2 === 0 ? 0 : dx / 2);
      const cy = row * dy;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (Math.PI / 3) * k + Math.PI / 6;
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 28, 128, 128, 124);
  grad.addColorStop(0, 'rgba(2, 6, 23, 0.65)');
  grad.addColorStop(0.65, 'rgba(2, 6, 23, 0.25)');
  grad.addColorStop(1, 'rgba(2, 6, 23, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

// Tekstur pantulan cahaya RGB lembut pada permukaan matras ESD & meja bengkel
function createRgbDeskGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 256);

  // Gradien radial inti cahaya + pendar halus memudar mulus ke tepi nol
  const grad = ctx.createRadialGradient(128, 128, 6, 128, 128, 124);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.92)');
  grad.addColorStop(0.28, 'rgba(255, 255, 255, 0.56)');
  grad.addColorStop(0.58, 'rgba(255, 255, 255, 0.2)');
  grad.addColorStop(0.84, 'rgba(255, 255, 255, 0.04)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createDynamicCpuIhsTexture(
  shortCode: string,
  modelLine: string,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Tutup logam IHS nikel-tembaga disikat
  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, '#d8e0ea');
  grad.addColorStop(0.5, '#b8c4d4');
  grad.addColorStop(1, '#cfd8e4');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Garis sapuan logam halus
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 2;
  for (let y = 0; y < 512; y += 6) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  // Bingkai laser-etched
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 6;
  ctx.strokeRect(24, 24, 464, 464);

  // Segitiga emas Pin 1 sudut kiri bawah
  ctx.fillStyle = '#eab308';
  ctx.beginPath();
  ctx.moveTo(24, 488);
  ctx.lineTo(112, 488);
  ctx.lineTo(24, 400);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#1e293b';
  ctx.textAlign = 'center';
  ctx.font = 'bold 34px monospace';
  ctx.fillText('INTEL / RAKITPC', 256, 152);
  ctx.font = 'bold 74px monospace';
  ctx.fillText(shortCode, 256, 252);
  ctx.font = '600 30px monospace';
  ctx.fillStyle = '#334155';
  ctx.fillText(modelLine, 256, 316);
  ctx.font = '600 24px monospace';
  ctx.fillText('SRLGA1700 · BATCH 26A', 256, 386);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createDynamicBadgeTexture(
  title: string,
  subtitle: string,
  bg: string,
  accent: string,
  fg: string,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 256);

  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 22, 256);
  ctx.fillRect(490, 0, 22, 256);

  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, 492, 236);

  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.font = 'bold 64px monospace';
  ctx.fillText(title, 256, 118);

  ctx.fillStyle = accent;
  ctx.font = 'bold 34px monospace';
  ctx.fillText(subtitle, 256, 178);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export interface MonitorScreenTextureOptions {
  mode: 'off' | 'standby' | 'post' | 'error' | 'desktop';
  osId: 'windows' | 'macos';
  cpuModel: string;
  gpuModel: string;
  ramLabel: string;
  biosSummary: string;
  benchmarkScore: number;
  cpuTempC: number;
  faultLed: string | null;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

/**
 * Menghasilkan tekstur layar monitor IPS 16:9 (1024x576) secara prosedural
 * untuk kondisi mati, standby, UEFI POST, error, Desktop Windows 11, dan Desktop macOS.
 */
export function createMonitorScreenTexture(
  opts: MonitorScreenTextureOptions,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 576;
  const ctx = canvas.getContext('2d')!;

  if (opts.mode === 'off') {
    const grad = ctx.createLinearGradient(0, 0, 1024, 576);
    grad.addColorStop(0, '#070b12');
    grad.addColorStop(0.5, '#0b101a');
    grad.addColorStop(1, '#06090f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 576);

    // Kilau anti-glare diagonal lembut pada panel mati
    ctx.fillStyle = 'rgba(148, 163, 184, 0.035)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(420, 0);
    ctx.lineTo(140, 576);
    ctx.lineTo(0, 576);
    ctx.closePath();
    ctx.fill();
  } else if (opts.mode === 'standby') {
    ctx.fillStyle = '#060a14';
    ctx.fillRect(0, 0, 1024, 576);

    drawRoundedRect(ctx, 262, 206, 500, 164, 18);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.textAlign = 'center';
    ctx.font = 'bold 26px monospace';
    ctx.fillText('DISPLAYPORT 1.4 · STANDBY', 512, 268);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '600 19px sans-serif';
    ctx.fillText('Arus PSU Siaga Terdeteksi — Tekan Tombol Power PC', 512, 314);
    ctx.fillStyle = '#64748b';
    ctx.font = '500 16px monospace';
    ctx.fillText(`Target OS: ${opts.osId === 'windows' ? 'Windows 11 Pro' : 'macOS Sequoia'}`, 512, 346);
  } else if (opts.mode === 'post') {
    ctx.fillStyle = '#040812';
    ctx.fillRect(0, 0, 1024, 576);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 1024, 62);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('RAKITPC UEFI BIOS VER 2.6 — POWER-ON SELF-TEST', 34, 40);

    const lines = [
      `[CPU]   ${opts.cpuModel} — OK`,
      `[MEM]   ${opts.ramLabel} — DUAL-CHANNEL OK`,
      `[GPU]   ${opts.gpuModel} — DISPLAYPORT OUTPUT ACTIVE`,
      `[BIOS]  ${opts.biosSummary}`,
      `[BOOT]  Memuat ${opts.osId === 'windows' ? 'Windows 11 Boot Manager' : 'OpenCore EFI (macOS Sequoia)'}...`,
    ];
    ctx.font = '600 21px monospace';
    lines.forEach((line, idx) => {
      ctx.fillStyle = idx === lines.length - 1 ? '#34d399' : '#e2e8f0';
      ctx.fillText(line, 38, 128 + idx * 48);
    });

    // Bar progres boot bawah
    drawRoundedRect(ctx, 38, 430, 948, 20, 10);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    drawRoundedRect(ctx, 38, 430, 740, 20, 10);
    ctx.fillStyle = '#38bdf8';
    ctx.fill();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 18px monospace';
    ctx.fillText('Tekan DEL atau F2 untuk masuk ke Advanced BIOS Settings', 38, 514);
  } else if (opts.mode === 'error') {
    ctx.fillStyle = '#14060a';
    ctx.fillRect(0, 0, 1024, 576);

    drawRoundedRect(ctx, 180, 160, 664, 256, 20);
    ctx.fillStyle = '#240b12';
    ctx.fill();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = '#f87171';
    ctx.textAlign = 'center';
    ctx.font = 'bold 34px monospace';
    ctx.fillText('POST HALTED · NO VIDEO SIGNAL', 512, 240);
    ctx.fillStyle = '#fecaca';
    ctx.font = '600 22px sans-serif';
    ctx.fillText(
      opts.faultLed
        ? `Periksa LED Diagnostik ${opts.faultLed} pada motherboard`
        : 'Periksa pemasangan komponen dan kabel daya casing',
      512,
      305,
    );
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 18px monospace';
    ctx.fillText('RakitPC UEFI Diagnostic Guard', 512, 362);
  } else if (opts.osId === 'windows') {
    // =====================================================================
    // DESKTOP WINDOWS 11 PRO (Wallpaper Bloom Biru + Taskbar Tengah + Panel Monitor)
    // =====================================================================
    const bg = ctx.createLinearGradient(0, 0, 1024, 576);
    bg.addColorStop(0, '#091a3a');
    bg.addColorStop(0.5, '#123a78');
    bg.addColorStop(1, '#08152e');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1024, 576);

    // Kelopak cahaya Bloom khas Windows 11
    const bloom1 = ctx.createRadialGradient(560, 275, 25, 560, 275, 290);
    bloom1.addColorStop(0, 'rgba(96, 165, 250, 0.92)');
    bloom1.addColorStop(0.45, 'rgba(37, 99, 235, 0.58)');
    bloom1.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = bloom1;
    ctx.fillRect(160, 0, 820, 520);

    const bloom2 = ctx.createRadialGradient(470, 245, 20, 470, 245, 210);
    bloom2.addColorStop(0, 'rgba(125, 211, 252, 0.85)');
    bloom2.addColorStop(0.55, 'rgba(56, 189, 248, 0.35)');
    bloom2.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = bloom2;
    ctx.fillRect(200, 20, 600, 460);

    // Ikon desktop di kiri
    const deskIcons = [
      { label: 'This PC', color: '#38bdf8' },
      { label: 'Benchmark', color: '#34d399' },
      { label: 'BIOS Info', color: '#fbbf24' },
    ];
    deskIcons.forEach((ic, idx) => {
      const iy = 34 + idx * 88;
      drawRoundedRect(ctx, 28, iy, 46, 44, 10);
      ctx.fillStyle = ic.color;
      ctx.fill();
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.font = '600 13px sans-serif';
      ctx.fillText(ic.label, 51, iy + 64);
    });

    // Jendela Aplikasi RakitPC System Monitor bergaya Windows 11 Mica
    drawRoundedRect(ctx, 188, 56, 650, 404, 16);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.42)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Titlebar Windows 11
    ctx.fillStyle = 'rgba(30, 41, 59, 0.92)';
    drawRoundedRect(ctx, 188, 56, 650, 46, 16);
    ctx.fill();
    ctx.fillStyle = '#e2e8f0';
    ctx.textAlign = 'left';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('Windows 11 Pro · RakitPC Hardware Monitor', 214, 85);

    // Tombol kontrol kanan atas Windows (-, □, ×)
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('—   □   ×', 742, 85);

    // Kartu Skor Benchmark + Status Aktif
    drawRoundedRect(ctx, 214, 122, 206, 134, 12);
    ctx.fillStyle = 'rgba(30, 58, 138, 0.65)';
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    ctx.fillStyle = '#93c5fd';
    ctx.font = '600 15px sans-serif';
    ctx.fillText('SKOR BENCHMARK', 232, 152);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 54px monospace';
    ctx.fillText(`${opts.benchmarkScore}`, 232, 214);
    ctx.fillStyle = '#7dd3fc';
    ctx.font = '600 20px monospace';
    ctx.fillText('/100', 318, 214);
    ctx.fillStyle = '#34d399';
    ctx.font = '600 14px monospace';
    ctx.fillText(`Suhu Beban: ${opts.cpuTempC}°C`, 232, 242);

    // Kartu Spesifikasi Sistem Aktif
    drawRoundedRect(ctx, 438, 122, 376, 134, 12);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.5)';
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('SPESIFIKASI PERANGKAT AKTIF', 456, 148, 344);
    ctx.fillStyle = '#f1f5f9';
    ctx.font = '600 15px monospace';
    ctx.fillText(`CPU: ${opts.cpuModel}`, 456, 180, 344);
    ctx.fillText(`GPU: ${opts.gpuModel}`, 456, 208, 344);
    ctx.fillText(`RAM: ${opts.ramLabel}`, 456, 236, 344);

    // Bar BIOS & Status Semua Komponen Menyala
    drawRoundedRect(ctx, 214, 276, 600, 72, 12);
    ctx.fillStyle = 'rgba(6, 78, 59, 0.45)';
    ctx.fill();
    ctx.strokeStyle = '#10b981';
    ctx.stroke();
    ctx.fillStyle = '#6ee7b7';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('● SEMUA SISTEM MENYALA NORMAL (WINDOWS 11)', 234, 308, 560);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 14px monospace';
    ctx.fillText(`BIOS: ${opts.biosSummary}`, 234, 334, 560);

    // Grafik pemakaian CPU/GPU real-time statis bergaya Task Manager
    drawRoundedRect(ctx, 214, 364, 600, 74, 10);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.stroke();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const graphY = [418, 412, 405, 398, 402, 390, 384, 388, 378, 382, 376];
    graphY.forEach((gy, i) => {
      const gx = 230 + i * 56;
      if (i === 0) ctx.moveTo(gx, gy);
      else ctx.lineTo(gx, gy);
    });
    ctx.stroke();
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 13px monospace';
    ctx.fillText('CPU & GPU TELEMETRY · 144Hz DISPLAYPORT', 232, 384);

    // Taskbar Windows 11 di bagian bawah
    ctx.fillStyle = 'rgba(11, 18, 32, 0.94)';
    ctx.fillRect(0, 514, 1024, 62);
    ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.fillRect(0, 514, 1024, 1.5);

    // Logo Start 4-kotak Windows biru di tengah taskbar
    const sx = 414;
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(sx, 531, 12, 12);
    ctx.fillRect(sx + 15, 531, 12, 12);
    ctx.fillRect(sx, 546, 12, 12);
    ctx.fillRect(sx + 15, 546, 12, 12);

    // Ikon aplikasi taskbar tengah
    const tbColors = ['#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6'];
    tbColors.forEach((col, i) => {
      drawRoundedRect(ctx, 464 + i * 44, 529, 30, 30, 7);
      ctx.fillStyle = col;
      ctx.fill();
    });

    // Jam & status tray kanan
    ctx.fillStyle = '#e2e8f0';
    ctx.textAlign = 'right';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('22:30', 996, 542);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 12px sans-serif';
    ctx.fillText('19/11/2026', 996, 560);
  } else {
    // =====================================================================
    // DESKTOP macOS SEQUOIA (Menu Bar Atas + Wallpaper Senja + Floating Dock + About This Mac)
    // =====================================================================
    const macBg = ctx.createLinearGradient(0, 0, 1024, 576);
    macBg.addColorStop(0, '#1e1b4b');
    macBg.addColorStop(0.45, '#581c87');
    macBg.addColorStop(0.78, '#be185d');
    macBg.addColorStop(1, '#f97316');
    ctx.fillStyle = macBg;
    ctx.fillRect(0, 0, 1024, 576);

    // Siluet pegunungan & cahaya aurora khas wallpaper macOS
    ctx.fillStyle = 'rgba(15, 23, 42, 0.38)';
    ctx.beginPath();
    ctx.moveTo(0, 420);
    ctx.quadraticCurveTo(240, 250, 520, 370);
    ctx.quadraticCurveTo(780, 460, 1024, 300);
    ctx.lineTo(1024, 576);
    ctx.lineTo(0, 576);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(30, 27, 75, 0.45)';
    ctx.beginPath();
    ctx.moveTo(0, 470);
    ctx.quadraticCurveTo(320, 340, 660, 430);
    ctx.quadraticCurveTo(860, 480, 1024, 390);
    ctx.lineTo(1024, 576);
    ctx.lineTo(0, 576);
    ctx.closePath();
    ctx.fill();

    // Menu Bar macOS atas dengan emblem vektor (bebas kotak glyph hilang di semua OS)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.76)';
    ctx.fillRect(0, 0, 1024, 38);

    // Emblem buah/daun vektor macOS di kiri atas
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(28, 22, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(30, 12.5, 3.2, 1.8, -0.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('Finder   File   Edit   View   Go   Window   Help', 48, 25);
    ctx.textAlign = 'right';
    ctx.font = '600 15px sans-serif';
    ctx.fillText('Wi-Fi   100%   Kam 22:30', 1000, 25);

    // Jendela macOS (About This Mac & RakitPC Monitor)
    drawRoundedRect(ctx, 178, 72, 668, 386, 20);
    ctx.fillStyle = 'rgba(17, 24, 39, 0.86)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Traffic lights khas macOS (Merah, Kuning, Hijau)
    const dots = ['#ef4444', '#f59e0b', '#22c55e'];
    dots.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(208 + i * 24, 98, 7.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = '#e2e8f0';
    ctx.textAlign = 'center';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText('macOS Sequoia 15 · RakitPC Workstation Monitor', 512, 104);

    // Divider titlebar
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.fillRect(178, 122, 668, 1.5);

    // Kolom kiri: Lingkaran status & Skor Benchmark
    ctx.beginPath();
    ctx.arc(306, 246, 76, 0, Math.PI * 2);
    const badgeGrad = ctx.createLinearGradient(230, 170, 382, 322);
    badgeGrad.addColorStop(0, '#a855f7');
    badgeGrad.addColorStop(1, '#38bdf8');
    ctx.fillStyle = badgeGrad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(306, 246, 62, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 44px monospace';
    ctx.fillText(`${opts.benchmarkScore}`, 306, 256);
    ctx.fillStyle = '#c084fc';
    ctx.font = '600 15px monospace';
    ctx.fillText('SKOR /100', 306, 282);

    ctx.fillStyle = '#6ee7b7';
    ctx.font = 'bold 15px monospace';
    ctx.fillText(`Suhu Beban ${opts.cpuTempC}°C`, 306, 354);

    // Kolom kanan: Detail Mac / OpenCore Hardware
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('RakitPC Pro Tower', 420, 176);
    ctx.fillStyle = '#d8b4fe';
    ctx.font = '600 15px monospace';
    ctx.fillText('macOS Sequoia 15 · OpenCore EFI Active', 420, 202);

    const rows = [
      ['Prosesor', opts.cpuModel],
      ['Grafis', opts.gpuModel],
      ['Memori', opts.ramLabel],
      ['BIOS', opts.biosSummary],
    ];
    rows.forEach(([k, v], i) => {
      const ry = 244 + i * 32;
      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 14px sans-serif';
      ctx.fillText(k, 420, ry);
      ctx.fillStyle = '#f8fafc';
      ctx.font = '600 14px monospace';
      ctx.fillText(v, 504, ry, 318);
    });

    // Status pill bawah jendela
    drawRoundedRect(ctx, 420, 384, 392, 42, 10);
    ctx.fillStyle = 'rgba(16, 185, 129, 0.22)';
    ctx.fill();
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#6ee7b7';
    ctx.font = 'bold 15px monospace';
    ctx.fillText('● SEMUA KOMPONEN & LAYAR AKTIF', 440, 410);

    // Floating macOS Glass Dock di bawah tengah
    drawRoundedRect(ctx, 272, 492, 480, 68, 22);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const dockApps = [
      { bg: '#2563eb', glyph: 'F' },
      { bg: '#0ea5e9', glyph: 'S' },
      { bg: '#10b981', glyph: 'M' },
      { bg: '#111827', glyph: '>_' },
      { bg: '#f59e0b', glyph: 'B' },
      { bg: '#ec4899', glyph: 'A' },
      { bg: '#64748b', glyph: '⚙' },
    ];
    dockApps.forEach((app, i) => {
      const ax = 296 + i * 64;
      drawRoundedRect(ctx, ax, 504, 46, 46, 12);
      ctx.fillStyle = app.bg;
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.font = 'bold 20px monospace';
      ctx.fillText(app.glyph, ax + 23, 534);
    });
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}
