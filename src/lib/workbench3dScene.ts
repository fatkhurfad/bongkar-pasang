/* Mesin adegan 3D WebGL (Three.js) prosedural untuk meja anti-statis motherboard dan interior casing ATX */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { BUILD_PRESETS, type PartId, type SlotId } from '../config';
import {
  getActiveHintTarget,
  hasPart,
  isPartDamaged,
  type AssemblyState,
  type PostLedKey,
} from './assemblyEngine';

export type CameraPresetId = 'isometric' | 'top' | 'detail';

export type HitTargetAction =
  | { type: 'slot'; slotId: SlotId; label: string }
  | { type: 'cpu_latch'; label: string }
  | { type: 'psu_switch'; label: string }
  | { type: 'power_button'; label: string };

export interface Workbench3DCallbacks {
  onSlotInteract: (slotId: SlotId, droppedPartId?: PartId) => void;
  onToggleCpuLatch: () => void;
  onTogglePsuSwitch: () => void;
  onRunPost: () => void;
  onHoverChange: (label: string | null) => void;
}

export interface Workbench3DController {
  syncState: (nextState: AssemblyState) => void;
  setCameraPreset: (preset: CameraPresetId) => void;
  handleExternalDrop: (clientX: number, clientY: number, partId: PartId) => void;
  dispose: () => void;
}

// Helper matematika sekali alokasi agar render loop bebas GC
const _pointer = new THREE.Vector2();
const _targetPos = new THREE.Vector3();
const _targetLook = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  if (typeof document === 'undefined') return true;
  const probeCanvas = document.createElement('canvas');
  const gl = probeCanvas.getContext('webgl2');
  if (!gl) return true;
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
  const gpu = String(gl.getParameter(param) ?? '');
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
}

function createEsdMatTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1b2638';
  ctx.fillRect(0, 0, 1024, 1024);

  // Grid milimeter anti-statis ESD
  ctx.strokeStyle = '#2b3b54';
  ctx.lineWidth = 1.5;
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

  ctx.strokeStyle = '#3b5173';
  ctx.lineWidth = 2.5;
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

  ctx.fillStyle = '#64748b';
  ctx.font = '600 22px monospace';
  ctx.fillText('ESD ANTI-STATIC WORKBENCH · RAKITPC LAB 3D', 44, 56);
  ctx.fillText('GROUNDED MAT · 1M OHM', 44, 988);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createMotherboardPcbTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0d1526';
  ctx.fillRect(0, 0, 1024, 1024);

  // Jalur tembaga halus PCB
  ctx.strokeStyle = '#1b3559';
  ctx.lineWidth = 3;
  for (let i = 0; i < 14; i++) {
    ctx.beginPath();
    ctx.moveTo(430, 260 + i * 16);
    ctx.lineTo(590, 260 + i * 16);
    ctx.stroke();
  }
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo(270 + i * 18, 490);
    ctx.lineTo(270 + i * 18, 610);
    ctx.lineTo(390 + i * 14, 650);
    ctx.stroke();
  }

  // Border PCB & silkscreen teknis
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, 996, 996);

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 26px monospace';
  ctx.fillText('RAKITPC B760 ATX REV 2.4', 60, 965);
  ctx.font = '600 20px monospace';
  ctx.fillText('DDR5 DUAL-CH (A2* / B2*)', 610, 140);
  ctx.fillText('M.2_1 GEN4 x4', 250, 620);
  ctx.fillText('PCIe 4.0 x16', 235, 785);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createLabelTexture(
  title: string,
  subtitle: string,
  bg: string,
  fg: string,
  maxAnisotropy: number,
  triangleCorner = false,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 512);

  if (triangleCorner) {
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(16, 496);
    ctx.lineTo(96, 496);
    ctx.lineTo(16, 416);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.font = 'bold 56px monospace';
  ctx.fillText(title, 256, 236);
  ctx.font = '600 34px monospace';
  ctx.fillText(subtitle, 256, 300);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createFanAssembly(radius: number, bladeColor: number, hubColor: number): THREE.Group {
  const rotor = new THREE.Group();
  const hubMat = new THREE.MeshStandardMaterial({
    color: hubColor,
    roughness: 0.45,
    metalness: 0.4,
  });
  const bladeMat = new THREE.MeshStandardMaterial({
    color: bladeColor,
    roughness: 0.38,
    metalness: 0.25,
  });

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.3, radius * 0.3, 0.08, 18), hubMat);
  hub.rotation.x = Math.PI / 2;
  rotor.add(hub);

  const bladeCount = 7;
  const bladeGeo = new THREE.BoxGeometry(radius * 0.28, radius * 0.68, 0.025);
  for (let i = 0; i < bladeCount; i++) {
    const angle = (i / bladeCount) * Math.PI * 2;
    const pivot = new THREE.Group();
    pivot.rotation.z = angle;
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.y = radius * 0.56;
    blade.rotation.y = 0.38;
    pivot.add(blade);
    rotor.add(pivot);
  }
  return rotor;
}

function createHighlightFrame(width: number, height: number, depth: number): {
  group: THREE.Group;
  material: THREE.MeshBasicMaterial;
} {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color: 0x3b82f6,
    transparent: true,
    opacity: 0.85,
  });
  const thickness = 0.04;

  const topBar = new THREE.Mesh(new THREE.BoxGeometry(width + thickness, thickness, thickness), mat);
  topBar.position.set(0, height / 2, depth / 2);
  const botBar = new THREE.Mesh(new THREE.BoxGeometry(width + thickness, thickness, thickness), mat);
  botBar.position.set(0, -height / 2, depth / 2);
  const leftBar = new THREE.Mesh(new THREE.BoxGeometry(thickness, height, thickness), mat);
  leftBar.position.set(-width / 2, 0, depth / 2);
  const rightBar = new THREE.Mesh(new THREE.BoxGeometry(thickness, height, thickness), mat);
  rightBar.position.set(width / 2, 0, depth / 2);

  group.add(topBar, botBar, leftBar, rightBar);
  return { group, material: mat };
}

export function createWorkbench3DController(
  container: HTMLElement,
  initialState: AssemblyState,
  callbacksRef: { current: Workbench3DCallbacks },
): Workbench3DController {
  const isSoftwareGl = detectSoftwareWebGL();
  let currentState = initialState;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f172a);
  scene.fog = new THREE.Fog(0x0f172a, 15, 30);

  const width = Math.max(container.clientWidth, 320);
  const height = Math.max(container.clientHeight, 240);
  const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 60);

  const renderer = new THREE.WebGLRenderer({
    antialias: !isSoftwareGl,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);
  renderer.shadowMap.enabled = !isSoftwareGl;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
  container.appendChild(renderer.domElement);

  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  // Studio Environment Map (RoomEnvironment) pada semua perangkat
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  pmremGenerator.dispose();

  // Pencahayaan studio 3-titik: Key hangat + Hemisphere sejuk + Rim belakang
  const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.95);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xfff6e8, 1.85);
  keyLight.position.set(5.5, 9.5, 6.2);
  if (!isSoftwareGl) {
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -6.5;
    keyLight.shadow.camera.right = 6.5;
    keyLight.shadow.camera.top = 6.5;
    keyLight.shadow.camera.bottom = -6.5;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 24;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
  }
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.72);
  rimLight.position.set(-6.0, 5.2, -5.5);
  scene.add(rimLight);

  // OrbitControls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !isSoftwareGl;
  controls.dampingFactor = 0.08;
  controls.minDistance = 3.2;
  controls.maxDistance = 14.5;
  controls.maxPolarAngle = Math.PI * 0.485;
  controls.enablePan = false;

  // Meja ESD dasar (y = 0)
  const esdTex = createEsdMatTexture(maxAniso);
  const tableGeo = new THREE.BoxGeometry(16, 0.3, 12);
  const tableMat = new THREE.MeshStandardMaterial({
    map: esdTex,
    roughness: 0.78,
    metalness: 0.06,
  });
  const tableMesh = new THREE.Mesh(tableGeo, tableMat);
  tableMesh.position.set(0, -0.15, 0);
  tableMesh.receiveShadow = !isSoftwareGl;
  scene.add(tableMesh);

  // Soft contact grounding shadow di atas meja (offset +0.01 agar bebas z-fighting)
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 256;
  shadowCanvas.height = 256;
  const sCtx = shadowCanvas.getContext('2d')!;
  const grad = sCtx.createRadialGradient(128, 128, 22, 128, 128, 124);
  grad.addColorStop(0, 'rgba(2, 6, 23, 0.55)');
  grad.addColorStop(1, 'rgba(2, 6, 23, 0)');
  sCtx.fillStyle = grad;
  sCtx.fillRect(0, 0, 256, 256);
  const contactTex = new THREE.CanvasTexture(shadowCanvas);
  const contactPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(7.2, 6.2),
    new THREE.MeshBasicMaterial({
      map: contactTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.75,
    }),
  );
  contactPlane.rotation.x = -Math.PI / 2;
  contactPlane.position.y = 0.01;
  scene.add(contactPlane);

  // Material bersama (variasi roughness >= 0.25 antar logam & plastik)
  const pcbTex = createMotherboardPcbTexture(maxAniso);
  const pcbMat = new THREE.MeshStandardMaterial({
    map: pcbTex,
    roughness: 0.74,
    metalness: 0.08,
  });
  const aluminumMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.24,
    metalness: 0.86,
  });
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.42,
    metalness: 0.68,
  });
  const copperMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.22,
    metalness: 0.92,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xeab308,
    roughness: 0.25,
    metalness: 0.88,
  });
  const darkPlasticMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.72,
    metalness: 0.08,
  });
  const ramBlueMat = new THREE.MeshStandardMaterial({
    color: 0x1d4ed8,
    roughness: 0.34,
    metalness: 0.62,
  });
  const steelChassisMat = new THREE.MeshStandardMaterial({
    color: 0x182234,
    roughness: 0.58,
    metalness: 0.44,
  });
  const psuSteelMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.55,
    metalness: 0.52,
  });

  // Daftar proxy raycast per fase & highlight ring
  const benchHitboxes: THREE.Mesh[] = [];
  const caseHitboxes: THREE.Mesh[] = [];
  const slotHighlightMap = new Map<string, { group: THREE.Group; material: THREE.MeshBasicMaterial }>();

  const registerInteractiveBox = (
    parent: THREE.Object3D,
    phase: 'bench' | 'case',
    key: string,
    size: [number, number, number],
    pos: [number, number, number],
    action: HitTargetAction,
    frameOrientation: 'horizontal' | 'vertical' = 'horizontal',
  ) => {
    const hitMesh = new THREE.Mesh(
      new THREE.BoxGeometry(size[0], size[1], size[2]),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hitMesh.position.set(pos[0], pos[1], pos[2]);
    hitMesh.layers.set(1);
    hitMesh.userData = { action, key };
    parent.add(hitMesh);

    if (phase === 'bench') benchHitboxes.push(hitMesh);
    else caseHitboxes.push(hitMesh);

    const frame =
      frameOrientation === 'horizontal'
        ? createHighlightFrame(size[0], size[2], 0.02)
        : createHighlightFrame(size[0], size[1], 0.02);
    if (frameOrientation === 'horizontal') {
      frame.group.rotation.x = -Math.PI / 2;
      frame.group.position.set(pos[0], pos[1] + size[1] * 0.45, pos[2]);
    } else {
      frame.group.position.set(pos[0], pos[1], pos[2] + size[2] * 0.52);
    }
    frame.group.visible = false;
    parent.add(frame.group);
    slotHighlightMap.set(key, frame);
    return hitMesh;
  };

  // =========================================================================
  // FASE 1: MEJA ANTI-STATIS & MOTHERBOARD B760 ATX (benchGroup)
  // =========================================================================
  const benchGroup = new THREE.Group();
  scene.add(benchGroup);

  // 9 Standoff kuningan (InstancedMesh)
  const standoffGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.14, 10);
  const standoffInst = new THREE.InstancedMesh(standoffGeo, copperMat, 9);
  const standoffXs = [-2.05, 0, 2.05];
  const standoffZs = [-1.65, 0, 1.65];
  const dummy = new THREE.Object3D();
  let sIdx = 0;
  for (const sx of standoffXs) {
    for (const sz of standoffZs) {
      dummy.position.set(sx, 0.07, sz);
      dummy.updateMatrix();
      standoffInst.setMatrixAt(sIdx++, dummy.matrix);
    }
  }
  standoffInst.instanceMatrix.needsUpdate = true;
  standoffInst.computeBoundingSphere();
  benchGroup.add(standoffInst);

  // Papan PCB Motherboard B760 ATX
  const moboBaseY = 0.18;
  const moboBoard = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.1, 3.8), pcbMat);
  moboBoard.position.set(0, moboBaseY, 0);
  moboBoard.castShadow = !isSoftwareGl;
  moboBoard.receiveShadow = !isSoftwareGl;
  benchGroup.add(moboBoard);

  // Penutup Rear I/O aluminium kiri atas
  const ioShroud = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.52, 1.55), darkMetalMat);
  ioShroud.position.set(-1.95, moboBaseY + 0.31, -0.82);
  ioShroud.castShadow = !isSoftwareGl;
  benchGroup.add(ioShroud);

  // Heatsink VRM atas & kiri CPU (komposit sirip aluminium)
  const vrmTop = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.34, 0.36), aluminumMat);
  vrmTop.position.set(-0.62, moboBaseY + 0.22, -1.48);
  vrmTop.castShadow = !isSoftwareGl;
  benchGroup.add(vrmTop);

  const vrmLeft = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 1.15), aluminumMat);
  vrmLeft.position.set(-1.45, moboBaseY + 0.22, -0.58);
  vrmLeft.castShadow = !isSoftwareGl;
  benchGroup.add(vrmLeft);

  // Header EPS 8-Pin & ATX 24-Pin referensi
  const benchEps = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.22), darkPlasticMat);
  benchEps.position.set(-1.55, moboBaseY + 0.16, -1.65);
  benchGroup.add(benchEps);

  const benchAtx24 = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 1.1), darkPlasticMat);
  benchAtx24.position.set(2.05, moboBaseY + 0.17, -0.5);
  benchGroup.add(benchAtx24);

  // SOKET CPU LGA1700 + Tuas Logam Berengsel (latchPivot)
  const cpuCenterX = -0.62;
  const cpuCenterZ = -0.55;
  const socketFrame = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.08, 1.12), darkMetalMat);
  socketFrame.position.set(cpuCenterX, moboBaseY + 0.09, cpuCenterZ);
  benchGroup.add(socketFrame);

  const pinPlate = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.03, 0.86), goldMat);
  pinPlate.position.set(cpuCenterX, moboBaseY + 0.135, cpuCenterZ);
  benchGroup.add(pinPlate);

  // Tanda segitiga emas Pin 1 pada pojok kiri bawah soket
  const socketMarker = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.04, 3), goldMat);
  socketMarker.position.set(cpuCenterX - 0.45, moboBaseY + 0.15, cpuCenterZ + 0.45);
  socketMarker.rotation.y = Math.PI / 4;
  benchGroup.add(socketMarker);

  // Engsel tutup pengunci logam (ILM) soket
  const latchPivot = new THREE.Group();
  latchPivot.position.set(cpuCenterX, moboBaseY + 0.15, cpuCenterZ - 0.56);
  benchGroup.add(latchPivot);

  const ilmBarTop = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.05, 0.1), aluminumMat);
  ilmBarTop.position.set(0, 0.03, 0.05);
  const ilmBarBot = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.05, 0.1), aluminumMat);
  ilmBarBot.position.set(0, 0.03, 1.07);
  const ilmBarLeft = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 1.02), aluminumMat);
  ilmBarLeft.position.set(-0.46, 0.03, 0.56);
  const ilmBarRight = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 1.02), aluminumMat);
  ilmBarRight.position.set(0.46, 0.03, 0.56);
  const leverArm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.05, 8), aluminumMat);
  leverArm.rotation.x = Math.PI / 2;
  leverArm.position.set(0.62, 0.05, 0.56);
  const leverKnob = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.35, metalness: 0.3 }),
  );
  leverKnob.position.set(0.62, 0.05, 1.08);
  latchPivot.add(ilmBarTop, ilmBarBot, ilmBarLeft, ilmBarRight, leverArm, leverKnob);

  // Komposit 3D CPU (Substrate + IHS Nickel + Label + Segitiga Emas)
  const cpuGroup = new THREE.Group();
  cpuGroup.position.set(cpuCenterX, moboBaseY + 0.16, cpuCenterZ);
  const cpuSub = new THREE.Mesh(
    new THREE.BoxGeometry(0.84, 0.04, 0.84),
    new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.55, metalness: 0.15 }),
  );
  const presetInit = BUILD_PRESETS[initialState.buildPreset];
  const cpuLabelTex = createLabelTexture(
    presetInit.cpuShortCode,
    'LGA1700',
    '#cbd5e1',
    '#0f172a',
    maxAniso,
    true,
  );
  const cpuIhs = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.06, 0.7),
    new THREE.MeshStandardMaterial({
      map: cpuLabelTex,
      roughness: 0.22,
      metalness: 0.85,
    }),
  );
  cpuIhs.position.y = 0.05;
  cpuGroup.add(cpuSub, cpuIhs);
  cpuGroup.visible = false;
  benchGroup.add(cpuGroup);

  // Komposit Pasta Termal (tetesan abu termal realistis di tengah IHS)
  const pasteMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.34, metalness: 0.2 }),
  );
  pasteMesh.scale.set(1.2, 0.32, 1.2);
  pasteMesh.position.set(cpuCenterX, moboBaseY + 0.245, cpuCenterZ);
  pasteMesh.visible = false;
  benchGroup.add(pasteMesh);

  // Komposit 3D Pendingin CPU (Tower Air Cooler: Base + 4 Copper Heatpipes + 8 Aluminum Fins + Fan Shroud + Rotor)
  const benchCoolerGroup = new THREE.Group();
  benchCoolerGroup.position.set(cpuCenterX, moboBaseY + 0.23, cpuCenterZ);
  const coolerBase = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.12, 0.82), darkMetalMat);
  coolerBase.position.y = 0.06;
  benchCoolerGroup.add(coolerBase);

  for (let i = 0; i < 8; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.035, 0.86), aluminumMat);
    fin.position.y = 0.24 + i * 0.11;
    fin.castShadow = !isSoftwareGl;
    benchCoolerGroup.add(fin);
  }
  const pipeOffsets = [-0.32, -0.11, 0.11, 0.32];
  for (const px of pipeOffsets) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.05, 10), copperMat);
    pipe.position.set(px, 0.62, 0);
    benchCoolerGroup.add(pipe);
  }
  const benchCoolerFanFrame = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.96, 0.16), darkPlasticMat);
  benchCoolerFanFrame.position.set(0, 0.62, 0.52);
  benchCoolerGroup.add(benchCoolerFanFrame);
  const benchCoolerRotor = createFanAssembly(0.42, 0x475569, 0x1e293b);
  benchCoolerRotor.position.set(0, 0.62, 0.61);
  benchCoolerGroup.add(benchCoolerRotor);
  benchCoolerGroup.visible = false;
  benchGroup.add(benchCoolerGroup);

  // 4 Slot RAM DDR5 + 2 Modul RAM Terpasang (A2 & B2)
  const dimmXs = [0.68, 0.96, 1.24, 1.52];
  dimmXs.forEach((dx, idx) => {
    const isPrimary = idx === 1 || idx === 3;
    const slotRail = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.14, 1.58),
      isPrimary
        ? new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.55, metalness: 0.2 })
        : darkPlasticMat,
    );
    slotRail.position.set(dx, moboBaseY + 0.12, -0.45);
    benchGroup.add(slotRail);
  });

  const makeRamStick = (x: number) => {
    const stick = new THREE.Group();
    stick.position.set(x, moboBaseY + 0.42, -0.45);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.48, 1.52), ramBlueMat);
    body.castShadow = !isSoftwareGl;
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 1.5), aluminumMat);
    topBar.position.y = 0.25;
    stick.add(body, topBar);
    stick.visible = false;
    benchGroup.add(stick);
    return stick;
  };
  const benchRamA2 = makeRamStick(dimmXs[1]);
  const benchRamB2 = makeRamStick(dimmXs[3]);

  // Slot M.2 NVMe & SSD Terpasang
  const m2Connector = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.34), darkPlasticMat);
  m2Connector.position.set(-1.38, moboBaseY + 0.11, 0.58);
  benchGroup.add(m2Connector);
  const m2Standoff = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 10), copperMat);
  m2Standoff.position.set(0.32, moboBaseY + 0.11, 0.58);
  benchGroup.add(m2Standoff);

  const benchSsdGroup = new THREE.Group();
  benchSsdGroup.position.set(-0.52, moboBaseY + 0.18, 0.58);
  const ssdPcb = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.04, 0.34), darkPlasticMat);
  const ssdLabel = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.02, 0.28), ramBlueMat);
  ssdLabel.position.set(0.1, 0.03, 0);
  const ssdChip = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.22), darkMetalMat);
  ssdChip.position.set(-0.54, 0.025, 0);
  const ssdScrew = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.04, 10), aluminumMat);
  ssdScrew.position.set(0.82, 0.03, 0);
  benchSsdGroup.add(ssdPcb, ssdLabel, ssdChip, ssdScrew);
  benchSsdGroup.visible = false;
  benchGroup.add(benchSsdGroup);

  // Slot PCIe x16, Heatsink Chipset B760, Baterai CMOS CR2032
  const benchPcie = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.15, 0.18), aluminumMat);
  benchPcie.position.set(-0.45, moboBaseY + 0.12, 1.12);
  benchGroup.add(benchPcie);

  const chipsetSink = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.22, 0.85), darkMetalMat);
  chipsetSink.position.set(1.38, moboBaseY + 0.16, 1.15);
  benchGroup.add(chipsetSink);

  const cmosBattery = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.06, 18), aluminumMat);
  cmosBattery.position.set(0.62, moboBaseY + 0.08, 1.38);
  benchGroup.add(cmosBattery);

  // Daftarkan hitbox raycasting Fase 1
  const benchLatchHit = registerInteractiveBox(
    benchGroup,
    'bench',
    'cpu_latch',
    [0.36, 0.35, 1.25],
    [cpuCenterX + 0.64, moboBaseY + 0.22, cpuCenterZ],
    { type: 'cpu_latch', label: 'Tuas Pengunci Soket LGA1700' },
  );
  const benchCpuZoneHit = registerInteractiveBox(
    benchGroup,
    'bench',
    'cpu_zone',
    [1.18, 0.85, 1.18],
    [cpuCenterX, moboBaseY + 0.44, cpuCenterZ],
    { type: 'slot', slotId: 'socket_cpu', label: 'Soket CPU LGA1700' },
  );
  registerInteractiveBox(
    benchGroup,
    'bench',
    'dimm_a2',
    [0.24, 0.6, 1.64],
    [dimmXs[1], moboBaseY + 0.34, -0.45],
    { type: 'slot', slotId: 'dimm_a2', label: 'Slot RAM DDR5 A2*' },
  );
  registerInteractiveBox(
    benchGroup,
    'bench',
    'dimm_b2',
    [0.24, 0.6, 1.64],
    [dimmXs[3], moboBaseY + 0.34, -0.45],
    { type: 'slot', slotId: 'dimm_b2', label: 'Slot RAM DDR5 B2*' },
  );
  registerInteractiveBox(
    benchGroup,
    'bench',
    'm2_slot',
    [1.82, 0.26, 0.48],
    [-0.52, moboBaseY + 0.18, 0.58],
    { type: 'slot', slotId: 'm2_slot', label: 'Slot M.2 NVMe Gen4' },
  );

  // =========================================================================
  // FASE 2: INTERIOR CASING MID-TOWER ATX (caseGroup)
  // =========================================================================
  const caseGroup = new THREE.Group();
  caseGroup.visible = false;
  scene.add(caseGroup);

  // Rangka baja Mid-Tower ATX (terbuka di sisi depan +Z agar mudah diakses)
  const caseW = 5.4;
  const caseH = 4.6;
  const caseD = 2.3;
  const backPanel = new THREE.Mesh(new THREE.BoxGeometry(caseW, caseH, 0.14), steelChassisMat);
  backPanel.position.set(0, caseH / 2, -caseD / 2);
  backPanel.receiveShadow = !isSoftwareGl;
  const bottomPanel = new THREE.Mesh(new THREE.BoxGeometry(caseW, 0.16, caseD), steelChassisMat);
  bottomPanel.position.set(0, 0.08, 0);
  const topPanel = new THREE.Mesh(new THREE.BoxGeometry(caseW, 0.16, caseD), steelChassisMat);
  topPanel.position.set(0, caseH - 0.08, 0);
  const leftPanel = new THREE.Mesh(new THREE.BoxGeometry(0.16, caseH, caseD), steelChassisMat);
  leftPanel.position.set(-caseW / 2 + 0.08, caseH / 2, 0);
  const rightPanel = new THREE.Mesh(new THREE.BoxGeometry(0.16, caseH, caseD), steelChassisMat);
  rightPanel.position.set(caseW / 2 - 0.08, caseH / 2, 0);

  // Sekat shroud bawah PSU
  const shroudTop = new THREE.Mesh(new THREE.BoxGeometry(caseW - 0.32, 0.1, caseD - 0.2), darkPlasticMat);
  shroudTop.position.set(0, 1.02, 0);
  caseGroup.add(backPanel, bottomPanel, topPanel, leftPanel, rightPanel, shroudTop);

  // 3 Kipas intake depan di sisi kanan dalam casing
  const caseFans: THREE.Group[] = [];
  [1.65, 2.65, 3.65].forEach((fy) => {
    const fanFrame = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.86, 0.86), darkPlasticMat);
    fanFrame.position.set(2.42, fy, 0.08);
    caseGroup.add(fanFrame);
    const rotor = createFanAssembly(0.38, 0x64748b, 0x1e293b);
    rotor.rotation.y = -Math.PI / 2;
    rotor.position.set(2.3, fy, 0.08);
    caseGroup.add(rotor);
    caseFans.push(rotor);
  });

  // Tombol POWER di bagian atas kanan casing
  const powerBtnMat = new THREE.MeshStandardMaterial({
    color: 0x3b82f6,
    emissive: 0x1d4ed8,
    emissiveIntensity: 0.45,
    roughness: 0.35,
    metalness: 0.3,
  });
  const powerBtnMesh = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.38), powerBtnMat);
  powerBtnMesh.position.set(2.05, caseH + 0.04, 0.65);
  caseGroup.add(powerBtnMesh);

  // 9 Standoff motherboard vertikal di back tray
  const caseStandoffs = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.06, 0.06, 0.16, 10),
    copperMat,
    9,
  );
  let csIdx = 0;
  for (const sx of [-1.95, -0.5, 0.95]) {
    for (const sy of [1.45, 2.75, 4.05]) {
      dummy.position.set(sx, sy, -0.98);
      dummy.rotation.set(Math.PI / 2, 0, 0);
      dummy.updateMatrix();
      caseStandoffs.setMatrixAt(csIdx++, dummy.matrix);
    }
  }
  dummy.rotation.set(0, 0, 0);
  caseStandoffs.instanceMatrix.needsUpdate = true;
  caseStandoffs.computeBoundingSphere();
  caseGroup.add(caseStandoffs);

  // Komposit 3D PSU 650 W 80+ Gold
  const psuGroup = new THREE.Group();
  psuGroup.position.set(-1.35, 0.55, 0.05);
  const psuBody = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.78, 1.45), psuSteelMat);
  psuBody.castShadow = !isSoftwareGl;
  const psuTex = createLabelTexture('650W', '80+ GOLD', '#f59e0b', '#0f172a', maxAniso);
  const psuBadge = new THREE.Mesh(
    new THREE.PlaneGeometry(0.86, 0.44),
    new THREE.MeshStandardMaterial({ map: psuTex, roughness: 0.38, metalness: 0.25 }),
  );
  psuBadge.position.set(-0.32, 0, 0.735);
  const psuSwitchMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    emissive: 0x000000,
    roughness: 0.45,
    metalness: 0.2,
  });
  const psuSwitchMesh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.28, 0.12), psuSwitchMat);
  psuSwitchMesh.position.set(0.55, 0, 0.72);
  psuGroup.add(psuBody, psuBadge, psuSwitchMesh);
  psuGroup.visible = false;
  caseGroup.add(psuGroup);

  // Komposit 3D Motherboard Terakit (Vertikal di dalam Casing)
  const caseMoboGroup = new THREE.Group();
  caseMoboGroup.position.set(-0.5, 2.75, -0.82);
  const casePcb = new THREE.Mesh(new THREE.BoxGeometry(3.25, 2.95, 0.1), pcbMat);
  casePcb.castShadow = !isSoftwareGl;
  caseMoboGroup.add(casePcb);

  // Tower Cooler terpasang vertikal + kipas berputar saat POST
  const caseCoolerBody = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.92, 0.65), aluminumMat);
  caseCoolerBody.position.set(-0.35, 0.42, 0.38);
  caseMoboGroup.add(caseCoolerBody);
  const caseCoolerRotor = createFanAssembly(0.36, 0x475569, 0x1e293b);
  caseCoolerRotor.position.set(-0.35, 0.42, 0.72);
  caseMoboGroup.add(caseCoolerRotor);
  caseFans.push(caseCoolerRotor);

  // RAM Dual-Channel & SSD NVMe terpasang pada motherboard casing
  [0.52, 0.76].forEach((rx) => {
    const rMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.05, 0.34), ramBlueMat);
    rMesh.position.set(rx, 0.42, 0.22);
    caseMoboGroup.add(rMesh);
  });
  const caseSsd = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.22, 0.08), ramBlueMat);
  caseSsd.position.set(-0.35, -0.22, 0.09);
  caseMoboGroup.add(caseSsd);

  // Header 24-Pin & 8-Pin CPU
  const caseHeader24Mat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6, metalness: 0.2 });
  const caseHeader24 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.76, 0.22), caseHeader24Mat);
  caseHeader24.position.set(1.36, 0.26, 0.16);
  caseMoboGroup.add(caseHeader24);

  const caseHeader8CpuMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6, metalness: 0.2 });
  const caseHeader8Cpu = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.22), caseHeader8CpuMat);
  caseHeader8Cpu.position.set(-1.12, 1.24, 0.16);
  caseMoboGroup.add(caseHeader8Cpu);

  // Slot PCIe x16
  const casePcieSlot = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.14, 0.16), aluminumMat);
  casePcieSlot.position.set(-0.42, -0.62, 0.13);
  caseMoboGroup.add(casePcieSlot);

  // EZ-Debug POST LED Strip 3D (CPU, DRAM, VGA, BOOT) di kanan atas motherboard
  const ledBoard = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.22, 0.08), psuSteelMat);
  ledBoard.position.set(1.02, 1.2, 0.09);
  caseMoboGroup.add(ledBoard);

  const postLedMaterials = new Map<PostLedKey, THREE.MeshStandardMaterial>();
  (['CPU', 'DRAM', 'VGA', 'BOOT'] as PostLedKey[]).forEach((ledKey, idx) => {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      emissive: 0x000000,
      emissiveIntensity: 0,
      roughness: 0.3,
      metalness: 0.1,
    });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.048, 12, 12), mat);
    bulb.position.set(0.74 + idx * 0.185, 1.2, 0.14);
    caseMoboGroup.add(bulb);
    postLedMaterials.set(ledKey, mat);
  });

  caseMoboGroup.visible = false;
  caseGroup.add(caseMoboGroup);

  // Komposit 3D Kartu Grafis (GPU Dual-Fan + Backplate + Port Daya 8-Pin)
  const caseGpuGroup = new THREE.Group();
  caseGpuGroup.position.set(-0.52, 2.08, 0.02);
  const gpuShroud = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.42, 1.22), darkMetalMat);
  gpuShroud.castShadow = !isSoftwareGl;
  const gpuBackplate = new THREE.Mesh(new THREE.BoxGeometry(2.46, 0.05, 1.22), aluminumMat);
  gpuBackplate.position.y = 0.23;
  const gpuFrontTrim = new THREE.Mesh(new THREE.BoxGeometry(2.42, 0.12, 0.04), ramBlueMat);
  gpuFrontTrim.position.set(0, 0.08, 0.62);
  const gpuPort8PinMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.45, metalness: 0.25 });
  const gpuPort8Pin = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.2, 0.12), gpuPort8PinMat);
  gpuPort8Pin.position.set(0.76, 0.02, 0.63);
  caseGpuGroup.add(gpuShroud, gpuBackplate, gpuFrontTrim, gpuPort8Pin);

  // 2 Kipas aksial GPU (terlihat di bawah shroud)
  [-0.55, 0.35].forEach((gx) => {
    const gRotor = createFanAssembly(0.36, 0x64748b, 0x0f172a);
    gRotor.rotation.x = Math.PI / 2;
    gRotor.position.set(gx, -0.22, 0.02);
    caseGpuGroup.add(gRotor);
    caseFans.push(gRotor);
  });
  caseGpuGroup.visible = false;
  caseGroup.add(caseGpuGroup);

  // 3D Braided Power Cables menggunakan TubeGeometry + CatmullRomCurve3
  const cable24Mesh = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.35, 0.72, -0.15),
        new THREE.Vector3(1.45, 1.15, -0.25),
        new THREE.Vector3(1.52, 2.35, -0.42),
        new THREE.Vector3(0.86, 3.01, -0.62),
      ]),
      24,
      0.08,
      10,
      false,
    ),
    new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.68, metalness: 0.12 }),
  );
  cable24Mesh.visible = false;
  caseGroup.add(cable24Mesh);

  const cable8CpuMesh = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.45, 0.75, -0.5),
        new THREE.Vector3(1.65, 1.45, -0.88),
        new THREE.Vector3(1.55, 4.18, -0.88),
        new THREE.Vector3(-1.62, 4.18, -0.64),
        new THREE.Vector3(-1.62, 3.99, -0.64),
      ]),
      28,
      0.06,
      8,
      false,
    ),
    new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.68, metalness: 0.12 }),
  );
  cable8CpuMesh.visible = false;
  caseGroup.add(cable8CpuMesh);

  const cable8GpuMesh = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.2, 0.92, 0.35),
        new THREE.Vector3(0.45, 1.25, 0.78),
        new THREE.Vector3(0.55, 1.75, 0.88),
        new THREE.Vector3(0.24, 2.1, 0.66),
      ]),
      22,
      0.072,
      8,
      false,
    ),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.62, metalness: 0.14 }),
  );
  cable8GpuMesh.visible = false;
  caseGroup.add(cable8GpuMesh);

  // Daftarkan hitbox raycasting Fase 2
  const casePsuHit = registerInteractiveBox(
    caseGroup,
    'case',
    'psu_bay',
    [2.1, 0.9, 1.55],
    [-1.35, 0.55, 0.05],
    { type: 'slot', slotId: 'psu_bay', label: 'Ruang PSU ATX (650 W)' },
    'vertical',
  );
  const caseMoboHit = registerInteractiveBox(
    caseGroup,
    'case',
    'case_standoffs',
    [3.35, 3.05, 0.4],
    [-0.5, 2.75, -0.82],
    { type: 'slot', slotId: 'case_standoffs', label: '9 Standoff Motherboard ATX' },
    'vertical',
  );
  const caseGpuHit = registerInteractiveBox(
    caseGroup,
    'case',
    'pcie_x16',
    [2.4, 0.6, 1.2],
    [-0.52, 2.1, -0.05],
    { type: 'slot', slotId: 'pcie_x16', label: 'Slot PCIe 4.0 x16 (GPU)' },
    'vertical',
  );
  const case24Hit = registerInteractiveBox(
    caseGroup,
    'case',
    'header_24pin',
    [0.52, 0.95, 0.55],
    [0.86, 3.01, -0.62],
    { type: 'slot', slotId: 'header_24pin', label: 'Header ATX 24-Pin' },
    'vertical',
  );
  const case8CpuHit = registerInteractiveBox(
    caseGroup,
    'case',
    'header_8pin_cpu',
    [0.62, 0.45, 0.55],
    [-1.62, 3.99, -0.62],
    { type: 'slot', slotId: 'header_8pin_cpu', label: 'Header EPS 8-Pin CPU' },
    'vertical',
  );
  const case8GpuHit = registerInteractiveBox(
    caseGroup,
    'case',
    'gpu_power_8pin',
    [0.58, 0.48, 0.45],
    [0.24, 2.1, 0.68],
    { type: 'slot', slotId: 'gpu_power_8pin', label: 'Port Daya PCIe 8-Pin GPU' },
    'vertical',
  );
  registerInteractiveBox(
    caseGroup,
    'case',
    'power_button',
    [0.72, 0.34, 0.56],
    [2.05, caseH + 0.04, 0.65],
    { type: 'power_button', label: 'Tombol Power Casing (Uji POST)' },
    'horizontal',
  );

  // =========================================================================
  // KAMERA, ANIMASI & RENDER LOOP (ON-DEMAND + AFTERDRAW SOFTWARE WEBGL)
  // =========================================================================
  let cameraTransitionActive = false;
  let activeCameraPreset: CameraPresetId = 'isometric';
  let lastPhase = initialState.phase;
  let latchCurrentAngle = initialState.cpuLatchOpen ? -1.15 : 0;
  let hoveredKey: string | null = null;
  let disposed = false;

  const computeCameraPresetTargets = (phase: 'bench' | 'case', preset: CameraPresetId) => {
    if (phase === 'bench') {
      if (preset === 'top') {
        _targetPos.set(0, 7.6, 0.85);
        _targetLook.set(0, 0.2, 0);
      } else if (preset === 'detail') {
        _targetPos.set(-1.35, 3.3, 2.35);
        _targetLook.set(-0.35, 0.32, -0.45);
      } else {
        _targetPos.set(0.35, 5.1, 5.2);
        _targetLook.set(0, 0.25, 0);
      }
    } else {
      if (preset === 'top') {
        _targetPos.set(0, 2.25, 9.8);
        _targetLook.set(0, 2.0, -0.1);
      } else if (preset === 'detail') {
        _targetPos.set(0.55, 2.45, 5.4);
        _targetLook.set(-0.35, 2.25, -0.2);
      } else {
        _targetPos.set(2.35, 3.25, 9.6);
        _targetLook.set(0, 1.95, -0.1);
      }
    }
  };

  computeCameraPresetTargets(initialState.phase, 'isometric');
  camera.position.copy(_targetPos);
  controls.target.copy(_targetLook);
  controls.update();

  controls.addEventListener('start', () => {
    cameraTransitionActive = false;
  });

  // Render pacing & software WebGL fenceSync
  let frameId = 0;
  let renderBusy = false;
  let renderDirty = false;
  let lastTickTime = performance.now();

  const afterDraw = (cb: () => void) => {
    if (disposed) return;
    const gl = renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const status = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (status === gl.UNSIGNALED) {
        frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        frameId = window.setTimeout(cb, 80);
      }
    };
    frameId = window.setTimeout(poll, 5);
  };

  const needsContinuousFrames = (): boolean => {
    const latchTarget = currentState.cpuLatchOpen ? -1.15 : 0;
    const latchMoving = Math.abs(latchCurrentAngle - latchTarget) > 0.008;
    return (
      cameraTransitionActive ||
      latchMoving ||
      (currentState.fansSpinning && currentState.phase === 'case')
    );
  };

  const requestRender = () => {
    if (disposed) return;
    if (renderBusy) {
      renderDirty = true;
      return;
    }
    renderBusy = true;
    frameId = requestAnimationFrame(() => {
      if (disposed) return;
      renderDirty = false;
      const now = performance.now();
      const dt = Math.min((now - lastTickTime) / 1000, 0.1);
      lastTickTime = now;

      // Animasi engsel tuas soket LGA1700
      const latchTarget = currentState.cpuLatchOpen ? -1.15 : 0;
      latchCurrentAngle = isSoftwareGl
        ? latchTarget
        : THREE.MathUtils.damp(latchCurrentAngle, latchTarget, 10, dt);
      latchPivot.rotation.x = latchCurrentAngle;

      // Putaran kipas casing & GPU saat POST berhasil
      if (currentState.fansSpinning && currentState.phase === 'case') {
        for (const rotor of caseFans) {
          rotor.rotation.z -= dt * 11.5;
        }
      }

      // Transisi preset kamera halus (snap langsung pada software WebGL agar bebas jeda frame)
      if (cameraTransitionActive) {
        if (isSoftwareGl) {
          camera.position.copy(_targetPos);
          controls.target.copy(_targetLook);
          cameraTransitionActive = false;
        } else {
          camera.position.x = THREE.MathUtils.damp(camera.position.x, _targetPos.x, 7, dt);
          camera.position.y = THREE.MathUtils.damp(camera.position.y, _targetPos.y, 7, dt);
          camera.position.z = THREE.MathUtils.damp(camera.position.z, _targetPos.z, 7, dt);
          controls.target.x = THREE.MathUtils.damp(controls.target.x, _targetLook.x, 7, dt);
          controls.target.y = THREE.MathUtils.damp(controls.target.y, _targetLook.y, 7, dt);
          controls.target.z = THREE.MathUtils.damp(controls.target.z, _targetLook.z, 7, dt);

          if (
            camera.position.distanceToSquared(_targetPos) < 0.0008 &&
            controls.target.distanceToSquared(_targetLook) < 0.0008
          ) {
            camera.position.copy(_targetPos);
            controls.target.copy(_targetLook);
            cameraTransitionActive = false;
          }
        }
      }

      controls.update();
      renderer.render(scene, camera);

      const finish = () => {
        if (disposed) return;
        renderBusy = false;
        if (renderDirty || needsContinuousFrames()) {
          requestRender();
        }
      };

      if (isSoftwareGl) {
        afterDraw(finish);
      } else {
        finish();
      }
    });
  };

  controls.addEventListener('change', () => {
    requestRender();
  });

  // Sinkronisasi state React -> 3D Scene
  const syncSceneVisuals = (state: AssemblyState) => {
    currentState = state;
    const isBench = state.phase === 'bench';
    benchGroup.visible = isBench;
    caseGroup.visible = !isBench;

    if (state.phase !== lastPhase) {
      lastPhase = state.phase;
      activeCameraPreset = 'isometric';
      computeCameraPresetTargets(state.phase, 'isometric');
      cameraTransitionActive = true;
    }

    const cpuInstalled = hasPart(state, 'cpu');
    const pasteApplied = hasPart(state, 'thermal_paste');
    const coolerInstalled = hasPart(state, 'cpu_cooler');
    const ramA2Installed = hasPart(state, 'ram_a2');
    const ramB2Installed = hasPart(state, 'ram_b2');
    const ssdInstalled = hasPart(state, 'ssd_nvme');

    const psuInstalled = hasPart(state, 'psu');
    const moboInstalled = hasPart(state, 'motherboard');
    const gpuInstalled = hasPart(state, 'gpu');
    const cable24Installed = hasPart(state, 'cable_24pin');
    const cable8CpuInstalled = hasPart(state, 'cable_8pin_cpu');
    const cable8GpuInstalled = hasPart(state, 'cable_8pin_gpu');

    // Fase 1 visibilitas komponen
    const showCpuPreview = isBench && !cpuInstalled && state.selectedPart === 'cpu';
    cpuGroup.visible = cpuInstalled || showCpuPreview;
    cpuGroup.position.y = cpuInstalled ? moboBaseY + 0.16 : moboBaseY + 0.42;
    cpuGroup.rotation.y = THREE.MathUtils.degToRad(cpuInstalled ? 0 : -state.cpuRotation);

    pasteMesh.visible = pasteApplied && !coolerInstalled;
    benchCoolerGroup.visible = coolerInstalled;
    benchRamA2.visible = ramA2Installed;
    benchRamB2.visible = ramB2Installed;
    benchSsdGroup.visible = ssdInstalled;

    // Update target slot CPU zone sesuai progres
    const activeCpuSlot: SlotId = !cpuInstalled
      ? 'socket_cpu'
      : !pasteApplied
        ? 'cpu_ihs'
        : 'cooler_mount';
    const activeCpuLabel = !cpuInstalled
      ? 'Soket CPU LGA1700 — Pasang Prosesor'
      : !pasteApplied
        ? 'Permukaan CPU (IHS) — Oleskan Pasta Termal'
        : !coolerInstalled
          ? 'Dudukan Pendingin CPU — Pasang Air Cooler'
          : 'Pendingin CPU Terpasang';
    benchCpuZoneHit.userData.action = {
      type: 'slot',
      slotId: activeCpuSlot,
      label: activeCpuLabel,
    };
    benchLatchHit.visible = !coolerInstalled;

    // Fase 2 visibilitas komponen
    psuGroup.visible = psuInstalled;
    psuSwitchMat.color.setHex(state.psuSwitchOn ? 0x22c55e : 0x475569);
    psuSwitchMat.emissive.setHex(state.psuSwitchOn ? 0x16a34a : 0x000000);
    psuSwitchMat.emissiveIntensity = state.psuSwitchOn ? 0.95 : 0;

    caseMoboGroup.visible = moboInstalled;
    caseGpuGroup.visible = gpuInstalled;
    cable24Mesh.visible = cable24Installed;
    cable8CpuMesh.visible = cable8CpuInstalled;
    cable8GpuMesh.visible = cable8GpuInstalled;

    caseHeader24Mat.color.setHex(cable24Installed ? 0x2563eb : 0x334155);
    caseHeader8CpuMat.color.setHex(cable8CpuInstalled ? 0x10b981 : 0x334155);
    gpuPort8PinMat.color.setHex(cable8GpuInstalled ? 0xd97706 : 0xf59e0b);

    powerBtnMat.color.setHex(state.fansSpinning ? 0x10b981 : 0x3b82f6);
    powerBtnMat.emissive.setHex(state.fansSpinning ? 0x059669 : 0x1d4ed8);

    // Hitbox fase 2 yang aktif sesuai urutan fisik
    casePsuHit.userData.action = psuInstalled
      ? {
          type: 'psu_switch',
          label: `Sakelar PSU (${state.psuSwitchOn ? 'ON' : 'OFF'}) — Klik untuk mengubah`,
        }
      : { type: 'slot', slotId: 'psu_bay', label: 'Ruang PSU ATX (650 W)' };
    caseMoboHit.visible = !moboInstalled;
    caseGpuHit.visible = moboInstalled && !gpuInstalled;
    case24Hit.visible = moboInstalled;
    case8CpuHit.visible = moboInstalled;
    case8GpuHit.visible = gpuInstalled;

    // EZ-Debug POST LED 3D
    (['CPU', 'DRAM', 'VGA', 'BOOT'] as PostLedKey[]).forEach((ledKey) => {
      const mat = postLedMaterials.get(ledKey);
      if (!mat) return;
      const isFault = state.postResult && !state.postResult.passed && state.postResult.faultLed === ledKey;
      const isPass = state.postResult?.passed;
      if (isFault) {
        mat.color.setHex(0xef4444);
        mat.emissive.setHex(0xdc2626);
        mat.emissiveIntensity = 1.4;
      } else if (isPass) {
        mat.color.setHex(0x10b981);
        mat.emissive.setHex(0x059669);
        mat.emissiveIntensity = 1.1;
      } else {
        mat.color.setHex(0x334155);
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      }
    });

    // Update highlight frame untuk hint BIMO, hover, error, dan Part Rusak
    const hint = getActiveHintTarget(state);
    const slotKeyToPart: Record<string, PartId | undefined> = {
      cpu_zone: !cpuInstalled ? 'cpu' : !pasteApplied ? 'thermal_paste' : 'cpu_cooler',
      dimm_a2: 'ram_a2',
      dimm_b2: 'ram_b2',
      m2_slot: 'ssd_nvme',
      psu_bay: 'psu',
      case_standoffs: 'motherboard',
      pcie_x16: 'gpu',
      header_24pin: 'cable_24pin',
      header_8pin_cpu: 'cable_8pin_cpu',
      gpu_power_8pin: 'cable_8pin_gpu',
    };

    slotHighlightMap.forEach((frame, key) => {
      const relatedPart = slotKeyToPart[key];
      const damaged = relatedPart ? isPartDamaged(state, relatedPart) : false;
      const isHint =
        (key === 'cpu_latch' && hint.control === 'cpu_latch') ||
        (key === 'cpu_zone' &&
          (hint.slot === 'socket_cpu' || hint.slot === 'cpu_ihs' || hint.slot === 'cooler_mount')) ||
        (key === 'power_button' && hint.control === 'power_button') ||
        (key === 'psu_bay' && (hint.slot === 'psu_bay' || hint.control === 'psu_switch')) ||
        hint.slot === key;
      const isError =
        state.lastErrorSlot === key ||
        (key === 'cpu_zone' &&
          (state.lastErrorSlot === 'socket_cpu' ||
            state.lastErrorSlot === 'cpu_ihs' ||
            state.lastErrorSlot === 'cooler_mount'));
      const isHovered = hoveredKey === key;

      if (damaged || isError) {
        frame.group.visible = true;
        frame.material.color.setHex(0xef4444);
      } else if (key === 'power_button' && isHint) {
        frame.group.visible = true;
        frame.material.color.setHex(0x10b981);
      } else if (isHovered || isHint) {
        frame.group.visible = true;
        frame.material.color.setHex(isHovered ? 0x38bdf8 : 0x3b82f6);
      } else {
        frame.group.visible = false;
      }
    });

    requestRender();
  };

  // =========================================================================
  // RAYCASTING INTERAKSI (HOVER, KLIK, DAN DROP KOMPONEN KE 3D)
  // =========================================================================
  const raycaster = new THREE.Raycaster();
  raycaster.layers.set(1);

  const pickHitTarget = (clientX: number, clientY: number): { key: string; action: HitTargetAction } | null => {
    const rect = renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    _pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    _pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(_pointer, camera);

    const activeList = (currentState.phase === 'bench' ? benchHitboxes : caseHitboxes).filter(
      (mesh) => mesh.visible,
    );
    const hits = raycaster.intersectObjects(activeList, false);
    if (hits.length === 0) return null;
    const hitObj = hits[0].object;
    return {
      key: String(hitObj.userData.key ?? ''),
      action: hitObj.userData.action as HitTargetAction,
    };
  };

  let pointerDownX = 0;
  let pointerDownY = 0;
  let lastMoveTime = 0;

  const onPointerDown = (event: PointerEvent) => {
    pointerDownX = event.clientX;
    pointerDownY = event.clientY;
  };

  const onPointerMove = (event: PointerEvent) => {
    const now = performance.now();
    if (now - lastMoveTime < 45) return;
    lastMoveTime = now;

    const hit = pickHitTarget(event.clientX, event.clientY);
    const nextKey = hit ? hit.key : null;
    if (nextKey !== hoveredKey) {
      hoveredKey = nextKey;
      renderer.domElement.style.cursor = hit ? 'pointer' : 'grab';
      callbacksRef.current.onHoverChange(hit ? hit.action.label : null);
      syncSceneVisuals(currentState);
    }
  };

  const onPointerUp = (event: PointerEvent) => {
    const dx = event.clientX - pointerDownX;
    const dy = event.clientY - pointerDownY;
    if (Math.hypot(dx, dy) > 6) return; // Abaikan jika pengguna sedang memutar orbit kamera

    const hit = pickHitTarget(event.clientX, event.clientY);
    if (!hit) return;

    const { action } = hit;
    if (action.type === 'cpu_latch') {
      callbacksRef.current.onToggleCpuLatch();
    } else if (action.type === 'psu_switch') {
      callbacksRef.current.onTogglePsuSwitch();
    } else if (action.type === 'power_button') {
      callbacksRef.current.onRunPost();
    } else {
      callbacksRef.current.onSlotInteract(action.slotId);
    }
  };

  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerup', onPointerUp);

  // ResizeObserver menjaga ukuran & rasio aspek tetap tajam
  const resizeObserver = new ResizeObserver(() => {
    if (disposed) return;
    const w = Math.max(container.clientWidth, 300);
    const h = Math.max(container.clientHeight, 220);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    requestRender();
  });
  resizeObserver.observe(container);

  // Pre-warm shader pada GPU asli
  if (!isSoftwareGl) {
    renderer.compile(scene, camera);
  }
  syncSceneVisuals(initialState);

  return {
    syncState: (nextState: AssemblyState) => {
      syncSceneVisuals(nextState);
    },
    setCameraPreset: (preset: CameraPresetId) => {
      activeCameraPreset = preset;
      computeCameraPresetTargets(currentState.phase, activeCameraPreset);
      cameraTransitionActive = true;
      requestRender();
    },
    handleExternalDrop: (clientX: number, clientY: number, partId: PartId) => {
      const hit = pickHitTarget(clientX, clientY);
      if (hit && hit.action.type === 'slot') {
        callbacksRef.current.onSlotInteract(hit.action.slotId, partId);
        return;
      }
      // Jika dilepas di dekat area papan 3D tapi meleset sedikit, jatuhkan ke slot sesuai part bila berada di fase aktif
      const fallbackSlot: SlotId | null =
        currentState.phase === 'bench'
          ? partId === 'cpu'
            ? 'socket_cpu'
            : partId === 'thermal_paste'
              ? 'cpu_ihs'
              : partId === 'cpu_cooler'
                ? 'cooler_mount'
                : partId === 'ram_a2'
                  ? 'dimm_a2'
                  : partId === 'ram_b2'
                    ? 'dimm_b2'
                    : partId === 'ssd_nvme'
                      ? 'm2_slot'
                      : null
          : partId === 'psu'
            ? 'psu_bay'
            : partId === 'motherboard'
              ? 'case_standoffs'
              : partId === 'gpu'
                ? 'pcie_x16'
                : partId === 'cable_24pin'
                  ? 'header_24pin'
                  : partId === 'cable_8pin_cpu'
                    ? 'header_8pin_cpu'
                    : partId === 'cable_8pin_gpu'
                      ? 'gpu_power_8pin'
                      : null;
      if (fallbackSlot) {
        callbacksRef.current.onSlotInteract(fallbackSlot, partId);
      }
    },
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      controls.dispose();
      envTex.dispose();
      esdTex.dispose();
      pcbTex.dispose();
      cpuLabelTex.dispose();
      psuTex.dispose();
      contactTex.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    },
  };
}
