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
