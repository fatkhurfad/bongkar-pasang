/* Mesin adegan 3D WebGL (Three.js) realistis dengan material PBR, model perangkat keras dinamis sesuai modul yang dibeli, panel kaca tempered, aliran udara 3D, dan mode tampilan terurai */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { type PartId, type SlotId } from '../config';
import {
  getActiveHintTarget,
  getEffectivePartInfo,
  getPsuCapacityWatts,
  getPurchasedSku,
  hasPart,
  isPartDamaged,
  type AssemblyState,
  type PostLedKey,
} from './assemblyEngine';
import {
  createDynamicBadgeTexture,
  createDynamicCpuIhsTexture,
  createProceduralTexturePack,
  disposeProceduralTexturePack,
} from './workbench3dTextures';
import { computeDynamicLightingRig, RGB_THEME_COLORS } from './workbenchLighting';

export type CameraPresetId = 'isometric' | 'top' | 'detail' | 'side';
export type CaseFinishId = 'carbon' | 'white' | 'titanium';
export type RgbThemeId = 'blue' | 'cyan' | 'emerald' | 'amber' | 'off';
export type StudioLightId = 'studio' | 'dark_rgb';

export interface SceneVisualOptions {
  caseFinish: CaseFinishId;
  rgbTheme: RgbThemeId;
  studioLight: StudioLightId;
  glassPanelClosed: boolean;
  showAirflow: boolean;
  explodedAmount: number; // 0.0 - 1.0
}

export const DEFAULT_SCENE_VISUAL_OPTIONS: SceneVisualOptions = {
  caseFinish: 'carbon',
  rgbTheme: 'blue',
  studioLight: 'studio',
  glassPanelClosed: false,
  showAirflow: false,
  explodedAmount: 0,
};

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
  setVisualOptions: (nextOptions: SceneVisualOptions) => void;
  setCameraPreset: (preset: CameraPresetId) => void;
  handleExternalDrop: (clientX: number, clientY: number, partId: PartId) => void;
  dispose: () => void;
}

// Helper matematika sekali alokasi agar render loop bebas GC
const _pointer = new THREE.Vector2();
const _targetPos = new THREE.Vector3();
const _targetLook = new THREE.Vector3();
const _tmpObj = new THREE.Object3D();
const _tmpColor = new THREE.Color();
const _rgbColor = new THREE.Color();

const RGB_THEME_HEX: Record<RgbThemeId, number> = RGB_THEME_COLORS;

const CASE_FINISH_COLORS: Record<
  CaseFinishId,
  { chassis: number; accent: number; shroud: number; roughness: number; metalness: number }
> = {
  carbon: {
    chassis: 0x141b26,
    accent: 0x263244,
    shroud: 0x0f1520,
    roughness: 0.46,
    metalness: 0.56,
  },
  white: {
    chassis: 0xe2e8f0,
    accent: 0xcbd5e1,
    shroud: 0xdbe3ee,
    roughness: 0.36,
    metalness: 0.18,
  },
  titanium: {
    chassis: 0x475569,
    accent: 0x64748b,
    shroud: 0x334155,
    roughness: 0.32,
    metalness: 0.78,
  },
};

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

// Bilah kipas aksial 9-blade berlekuk realistis + cincin frame & LED ring opsional
function createDetailedFan(
  radius: number,
  bladeMat: THREE.Material,
  hubMat: THREE.Material,
  ringMat?: THREE.Material,
): { group: THREE.Group; rotor: THREE.Group } {
  const group = new THREE.Group();
  const rotor = new THREE.Group();

  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.28, radius * 0.28, 0.09, 20),
    hubMat,
  );
  hub.rotation.x = Math.PI / 2;
  rotor.add(hub);

  const hubCap = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.16, radius * 0.16, 0.1, 16),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.25, metalness: 0.85 }),
  );
  hubCap.rotation.x = Math.PI / 2;
  rotor.add(hubCap);

  const bladeCount = 9;
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(0, 0);
  bladeShape.quadraticCurveTo(radius * 0.24, radius * 0.22, radius * 0.16, radius * 0.68);
  bladeShape.quadraticCurveTo(radius * 0.02, radius * 0.74, -radius * 0.08, radius * 0.64);
  bladeShape.quadraticCurveTo(-radius * 0.05, radius * 0.3, 0, 0);

  const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, {
    depth: 0.018,
    bevelEnabled: false,
  });
  bladeGeo.center();

  for (let i = 0; i < bladeCount; i++) {
    const angle = (i / bladeCount) * Math.PI * 2;
    const pivot = new THREE.Group();
    pivot.rotation.z = angle;
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.y = radius * 0.52;
    blade.rotation.y = 0.42;
    blade.rotation.x = 0.08;
    pivot.add(blade);
    rotor.add(pivot);
  }
  group.add(rotor);

  if (ringMat) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.96, 0.028, 10, 28), ringMat);
    group.add(ring);
  }

  return { group, rotor };
}

function createHighlightFrame(width: number, height: number, depth: number): {
  group: THREE.Group;
  material: THREE.MeshBasicMaterial;
} {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color: 0x3b82f6,
    transparent: true,
    opacity: 0.88,
  });
  const t = 0.036;

  const topBar = new THREE.Mesh(new THREE.BoxGeometry(width + t, t, t), mat);
  topBar.position.set(0, height / 2, depth / 2);
  const botBar = new THREE.Mesh(new THREE.BoxGeometry(width + t, t, t), mat);
  botBar.position.set(0, -height / 2, depth / 2);
  const leftBar = new THREE.Mesh(new THREE.BoxGeometry(t, height, t), mat);
  leftBar.position.set(-width / 2, 0, depth / 2);
  const rightBar = new THREE.Mesh(new THREE.BoxGeometry(t, height, t), mat);
  rightBar.position.set(width / 2, 0, depth / 2);

  group.add(topBar, botBar, leftBar, rightBar);
  return { group, material: mat };
}

// Bangun model 3D Tower Air Cooler realistis (fins InstancedMesh + bent U-shaped copper heatpipes + fan)
function buildCoolerVariantGroup(
  variant: 'stock' | 'tower' | 'dual' | 'aio',
  mats: {
    aluminum: THREE.Material;
    brushedDark: THREE.Material;
    copper: THREE.Material;
    plastic: THREE.Material;
    fanBlade: THREE.Material;
    rgbMat: THREE.Material;
  },
  castShadows: boolean,
): { group: THREE.Group; rotors: THREE.Group[] } {
  const group = new THREE.Group();
  const rotors: THREE.Group[] = [];

  if (variant === 'stock') {
    // Low-profile radial aluminum downdraft cooler
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.32, 18), mats.copper);
    core.position.y = 0.16;
    group.add(core);

    const finCount = 24;
    const finGeo = new THREE.BoxGeometry(0.03, 0.28, 0.26);
    const fins = new THREE.InstancedMesh(finGeo, mats.aluminum, finCount);
    for (let i = 0; i < finCount; i++) {
      const a = (i / finCount) * Math.PI * 2;
      _tmpObj.position.set(Math.cos(a) * 0.34, 0.17, Math.sin(a) * 0.34);
      _tmpObj.rotation.set(0, -a + Math.PI / 2, 0);
      _tmpObj.scale.set(1, 1, 1);
      _tmpObj.updateMatrix();
      fins.setMatrixAt(i, _tmpObj.matrix);
    }
    fins.instanceMatrix.needsUpdate = true;
    fins.computeBoundingSphere();
    group.add(fins);

    const shroud = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.045, 10, 28), mats.plastic);
    shroud.rotation.x = Math.PI / 2;
    shroud.position.y = 0.34;
    group.add(shroud);

    const fan = createDetailedFan(0.41, mats.fanBlade, mats.plastic);
    fan.group.rotation.x = -Math.PI / 2;
    fan.group.position.y = 0.36;
    group.add(fan.group);
    rotors.push(fan.rotor);
    return { group, rotors };
  }

  if (variant === 'aio') {
    // Liquid Cooler AIO 240 mm: CNC cylindrical pump block + dual infinity RGB rings + copper coldplate
    const coldplate = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.42, 0.12, 24), mats.copper);
    coldplate.position.y = 0.06;
    const pumpBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.43, 0.43, 0.36, 28),
      mats.brushedDark,
    );
    pumpBody.position.y = 0.3;
    pumpBody.castShadow = castShadows;
    const pumpBezel = new THREE.Mesh(
      new THREE.TorusGeometry(0.41, 0.025, 10, 28),
      mats.aluminum,
    );
    pumpBezel.rotation.x = Math.PI / 2;
    pumpBezel.position.y = 0.48;
    const pumpRingOuter = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.036, 12, 28),
      mats.rgbMat,
    );
    pumpRingOuter.rotation.x = Math.PI / 2;
    pumpRingOuter.position.y = 0.485;
    const pumpRingInner = new THREE.Mesh(
      new THREE.TorusGeometry(0.17, 0.02, 10, 24),
      mats.rgbMat,
    );
    pumpRingInner.rotation.x = Math.PI / 2;
    pumpRingInner.position.y = 0.49;
    const pumpCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.04, 24),
      new THREE.MeshPhysicalMaterial({
        color: 0x090d16,
        roughness: 0.08,
        metalness: 0.2,
        clearcoat: 1.0,
      }),
    );
    pumpCap.position.y = 0.475;
    // Fitting siku selang kanan
    const fit1 = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.16, 12), mats.brushedDark);
    fit1.rotation.z = Math.PI / 2;
    fit1.position.set(0.44, 0.28, -0.09);
    const fit2 = fit1.clone();
    fit2.position.set(0.44, 0.28, 0.09);

    // Bracket pengunci 4 sudut
    const bracketGeo = new THREE.BoxGeometry(0.96, 0.045, 0.12);
    const b1 = new THREE.Mesh(bracketGeo, mats.aluminum);
    b1.position.set(0, 0.08, -0.42);
    const b2 = b1.clone();
    b2.position.set(0, 0.08, 0.42);

    group.add(
      coldplate,
      pumpBody,
      pumpBezel,
      pumpRingOuter,
      pumpRingInner,
      pumpCap,
      fit1,
      fit2,
      b1,
      b2,
    );
    return { group, rotors };
  }

  const isDual = variant === 'dual';
  // Coldplate tembaga + blok mounting aluminium
  const coldplate = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.1, 0.76), mats.copper);
  coldplate.position.y = 0.05;
  const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.11, 0.84), mats.brushedDark);
  clamp.position.y = 0.15;
  group.add(coldplate, clamp);

  // Sirip aluminium tipis (InstancedMesh)
  const stackOffsets = isDual ? [-0.31, 0.31] : [0];
  const finDepth = isDual ? 0.46 : 0.72;
  const finCountPerStack = 14;
  const finGeo = new THREE.BoxGeometry(1.08, 0.022, finDepth);
  const finInst = new THREE.InstancedMesh(
    finGeo,
    mats.aluminum,
    finCountPerStack * stackOffsets.length,
  );
  let idx = 0;
  for (const sz of stackOffsets) {
    for (let i = 0; i < finCountPerStack; i++) {
      _tmpObj.position.set(0, 0.28 + i * 0.068, sz);
      _tmpObj.rotation.set(0, 0, 0);
      _tmpObj.scale.set(1, 1, 1);
      _tmpObj.updateMatrix();
      finInst.setMatrixAt(idx++, _tmpObj.matrix);
    }
  }
  finInst.instanceMatrix.needsUpdate = true;
  finInst.computeBoundingSphere();
  finInst.castShadow = castShadows;
  group.add(finInst);

  // Top cover plate anodized hitam/titanium + ujung heatpipe tembaga
  for (const sz of stackOffsets) {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.055, finDepth + 0.03), mats.brushedDark);
    cap.position.set(0, 1.24, sz);
    cap.castShadow = castShadows;
    group.add(cap);
  }

  // Heatpipe tembaga berbentuk U (TubeGeometry) keluar dari coldplate menembus sirip
  const pipeXs = isDual ? [-0.42, -0.25, -0.08, 0.08, 0.25, 0.42] : [-0.34, -0.11, 0.11, 0.34];
  for (const px of pipeXs) {
    const zSpan = isDual ? 0.31 : 0.18;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(px, 1.29, -zSpan),
      new THREE.Vector3(px, 0.42, -zSpan),
      new THREE.Vector3(px * 0.72, 0.08, 0),
      new THREE.Vector3(px, 0.42, zSpan),
      new THREE.Vector3(px, 1.29, zSpan),
    ]);
    const pipeMesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 18, 0.034, 8, false),
      mats.copper,
    );
    group.add(pipeMesh);
  }

  // Kipas PWM 120 mm (1 pada Tower, 2 push-pull pada Dual-Tower)
  const fanZPositions = isDual ? [0.02, 0.62] : [0.46];
  for (const fz of fanZPositions) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.02, 1.02, 0.16), mats.plastic);
    frame.position.set(0, 0.74, fz);
    group.add(frame);

    const fan = createDetailedFan(0.45, mats.fanBlade, mats.plastic, isDual ? mats.rgbMat : undefined);
    fan.group.position.set(0, 0.74, fz + 0.085);
    group.add(fan.group);
    rotors.push(fan.rotor);
  }

  return { group, rotors };
}

export function createWorkbench3DController(
  container: HTMLElement,
  initialState: AssemblyState,
  callbacksRef: { current: Workbench3DCallbacks },
  initialVisualOptions: SceneVisualOptions = DEFAULT_SCENE_VISUAL_OPTIONS,
): Workbench3DController {
  const isSoftwareGl = detectSoftwareWebGL();
  let currentState = initialState;
  let visualOpts: SceneVisualOptions = { ...initialVisualOptions };

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0c1322);
  scene.fog = new THREE.FogExp2(0x0c1322, 0.026);

  const width = Math.max(container.clientWidth, 320);
  const height = Math.max(container.clientHeight, 240);
  const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 70);

  const renderer = new THREE.WebGLRenderer({
    antialias: !isSoftwareGl,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);
  renderer.shadowMap.enabled = !isSoftwareGl;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
  container.appendChild(renderer.domElement);

  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const texPack = createProceduralTexturePack(maxAniso);
  const dynamicTextures: THREE.Texture[] = [];

  // Studio Environment Reflection (RoomEnvironment) pada semua perangkat
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  pmremGenerator.dispose();

  // Pencahayaan Studio PBR 3-titik + Softbox (GPU) + Interior RGB PointLight
  const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.92);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xfff5e4, 1.95);
  keyLight.position.set(5.8, 10.2, 6.4);
  if (!isSoftwareGl) {
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.left = -7.2;
    keyLight.shadow.camera.right = 7.2;
    keyLight.shadow.camera.top = 7.2;
    keyLight.shadow.camera.bottom = -7.2;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 26;
    keyLight.shadow.bias = -0.0004;
    keyLight.shadow.normalBias = 0.02;
  }
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x7dd3fc, 0.8);
  rimLight.position.set(-6.5, 5.5, -5.8);
  scene.add(rimLight);

  // Softbox studio elongated specular highlight pada GPU asli
  let overheadSoftbox: THREE.RectAreaLight | null = null;
  if (!isSoftwareGl) {
    RectAreaLightUniformsLib.init();
    overheadSoftbox = new THREE.RectAreaLight(0xeef6ff, 2.4, 7.5, 3.2);
    overheadSoftbox.position.set(0, 7.8, 2.2);
    overheadSoftbox.lookAt(0, 1.2, 0);
    scene.add(overheadSoftbox);
  }

  // Sistem lampu dinamis RGB komponen (interior casing + pantulan ke meja depan/samping & kipas intake)
  const caseRgbLight = new THREE.PointLight(0x3b82f6, 0, 9.8, 1.7);
  caseRgbLight.position.set(0.15, 2.75, 0.72);
  scene.add(caseRgbLight);

  const deskBounceLight = new THREE.PointLight(0x3b82f6, 0, 10.5, 1.65);
  deskBounceLight.position.set(-0.1, 1.35, 2.45);
  scene.add(deskBounceLight);

  const frontFanSpillLight = new THREE.PointLight(0x3b82f6, 0, 9.2, 1.7);
  frontFanSpillLight.position.set(3.45, 1.95, 0.35);
  scene.add(frontFanSpillLight);

  // OrbitControls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !isSoftwareGl;
  controls.dampingFactor = 0.08;
  controls.minDistance = 3.0;
  controls.maxDistance = 15.5;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.enablePan = false;

  // =========================================================================
  // MEJA BENGKEL TEKNISI + MATRAS ESD + PANTULAN CAHAYA RGB + PROPS BAUT
  // =========================================================================
  const workshopDesk = new THREE.Mesh(
    new THREE.BoxGeometry(24, 0.4, 18),
    new THREE.MeshPhysicalMaterial({
      map: texPack.deskWoodAlbedo,
      roughness: 0.56,
      metalness: 0.14,
      clearcoat: 0.28,
      clearcoatRoughness: 0.36,
    }),
  );
  workshopDesk.position.set(0, -0.22, 0);
  workshopDesk.receiveShadow = !isSoftwareGl;
  scene.add(workshopDesk);

  // Matras Anti-Statis ESD satin di atas meja kerja (menangkap pantulan specular cahaya RGB)
  const esdMatMesh = new THREE.Mesh(
    new THREE.BoxGeometry(11.4, 0.05, 8.2),
    new THREE.MeshPhysicalMaterial({
      map: texPack.esdAlbedo,
      bumpMap: texPack.esdBump,
      bumpScale: 0.012,
      roughness: 0.52,
      metalness: 0.08,
      clearcoat: 0.18,
      clearcoatRoughness: 0.42,
    }),
  );
  esdMatMesh.position.set(0, 0.005, 0);
  esdMatMesh.receiveShadow = !isSoftwareGl;
  scene.add(esdMatMesh);

  // Soft contact grounding shadow (offset +0.032 agar bebas z-fighting)
  const contactPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(7.6, 6.4),
    new THREE.MeshBasicMaterial({
      map: texPack.contactShadow,
      transparent: true,
      depthWrite: false,
      opacity: 0.82,
    }),
  );
  contactPlane.rotation.x = -Math.PI / 2;
  contactPlane.position.y = 0.032;
  scene.add(contactPlane);

  // Bidang pantulan cahaya RGB komponen (RAM, AIO/Cooler, GPU, & Kipas) di atas matras ESD & meja
  const deskSideGlowMat = new THREE.MeshBasicMaterial({
    map: texPack.rgbDeskGlow,
    color: 0x3b82f6,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const deskSideGlowPlane = new THREE.Mesh(new THREE.PlaneGeometry(7.8, 4.6), deskSideGlowMat);
  deskSideGlowPlane.rotation.x = -Math.PI / 2;
  deskSideGlowPlane.position.set(-0.2, 0.038, 2.35);
  deskSideGlowPlane.visible = false;
  scene.add(deskSideGlowPlane);

  const deskFrontGlowMat = new THREE.MeshBasicMaterial({
    map: texPack.rgbDeskGlow,
    color: 0x3b82f6,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const deskFrontGlowPlane = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 5.2), deskFrontGlowMat);
  deskFrontGlowPlane.rotation.x = -Math.PI / 2;
  deskFrontGlowPlane.position.set(3.85, 0.039, 0.15);
  deskFrontGlowPlane.visible = false;
  scene.add(deskFrontGlowPlane);

  // Pendar bawah kaki casing (underglow lembut ke permukaan matras)
  const caseUnderglowMat = new THREE.MeshBasicMaterial({
    map: texPack.rgbDeskGlow,
    color: 0x3b82f6,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const caseUnderglowPlane = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 3.6), caseUnderglowMat);
  caseUnderglowPlane.rotation.x = -Math.PI / 2;
  caseUnderglowPlane.position.set(0.05, 0.036, 0.35);
  caseUnderglowPlane.visible = false;
  scene.add(caseUnderglowPlane);

  // Material PBR Bersama (variasi roughness & metalness nyata antar logam, PCB, dan plastik)
  const pcbMat = new THREE.MeshStandardMaterial({
    map: texPack.pcbAlbedo,
    bumpMap: texPack.pcbBump,
    bumpScale: 0.015,
    roughness: 0.62,
    metalness: 0.14,
  });
  const aluminumMat = new THREE.MeshPhysicalMaterial({
    color: 0xb8c4d4,
    bumpMap: texPack.brushedMetalBump,
    bumpScale: 0.006,
    roughness: 0.22,
    metalness: 0.9,
    clearcoat: 0.2,
  });
  const brushedDarkMetalMat = new THREE.MeshPhysicalMaterial({
    color: 0x263142,
    bumpMap: texPack.brushedMetalBump,
    bumpScale: 0.008,
    roughness: 0.34,
    metalness: 0.82,
    clearcoat: 0.25,
  });
  const copperMat = new THREE.MeshPhysicalMaterial({
    color: 0xd97706,
    roughness: 0.2,
    metalness: 0.94,
    clearcoat: 0.15,
  });
  const goldMat = new THREE.MeshPhysicalMaterial({
    color: 0xfacc15,
    roughness: 0.22,
    metalness: 0.92,
  });
  const darkPlasticMat = new THREE.MeshStandardMaterial({
    color: 0x161f2e,
    roughness: 0.72,
    metalness: 0.06,
  });
  const fanBladeMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.36,
    metalness: 0.22,
  });
  const ramHeatspreaderMat = new THREE.MeshPhysicalMaterial({
    color: 0x1d4ed8,
    bumpMap: texPack.brushedMetalBump,
    bumpScale: 0.005,
    roughness: 0.28,
    metalness: 0.72,
    clearcoat: 0.3,
  });
  const rgbEmissiveMat = new THREE.MeshStandardMaterial({
    color: 0x3b82f6,
    emissive: 0x3b82f6,
    emissiveIntensity: 0.9,
    roughness: 0.22,
    metalness: 0.1,
  });
  const caseChassisMat = new THREE.MeshStandardMaterial({
    color: CASE_FINISH_COLORS.carbon.chassis,
    roughness: CASE_FINISH_COLORS.carbon.roughness,
    metalness: CASE_FINISH_COLORS.carbon.metalness,
  });
  const caseShroudMat = new THREE.MeshStandardMaterial({
    color: CASE_FINISH_COLORS.carbon.shroud,
    roughness: 0.56,
    metalness: 0.42,
  });
  const psuSteelMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    bumpMap: texPack.brushedMetalBump,
    bumpScale: 0.004,
    roughness: 0.44,
    metalness: 0.62,
  });
  const ventMeshMat = new THREE.MeshStandardMaterial({
    map: texPack.honeycombVentAlbedo,
    roughness: 0.62,
    metalness: 0.48,
  });

  // Props Bengkel Realistis di pinggir matras ESD (Baki magnet baut M3 + Obeng presisi + Kancing grounding ESD)
  const propsGroup = new THREE.Group();
  scene.add(propsGroup);

  // Baki magnet baut bundar stainless steel + 12 baut M3 (InstancedMesh)
  const screwTrayRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.46, 0.045, 10, 28),
    aluminumMat,
  );
  screwTrayRim.rotation.x = Math.PI / 2;
  screwTrayRim.position.set(3.85, 0.075, 2.25);
  const screwTrayBottom = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.42, 0.04, 24),
    brushedDarkMetalMat,
  );
  screwTrayBottom.position.set(3.85, 0.05, 2.25);
  propsGroup.add(screwTrayRim, screwTrayBottom);

  const screwInst = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.032, 0.018, 0.08, 8),
    aluminumMat,
    12,
  );
  for (let i = 0; i < 12; i++) {
    const a = i * 2.1;
    const r = 0.08 + ((i * 7) % 10) * 0.026;
    _tmpObj.position.set(3.85 + Math.cos(a) * r, 0.085, 2.25 + Math.sin(a) * r);
    _tmpObj.rotation.set(Math.PI / 2, a, 0.25);
    _tmpObj.scale.set(1, 1, 1);
    _tmpObj.updateMatrix();
    screwInst.setMatrixAt(i, _tmpObj.matrix);
  }
  screwInst.instanceMatrix.needsUpdate = true;
  screwInst.computeBoundingSphere();
  propsGroup.add(screwInst);

  // Obeng presisi Phillips di kanan matras
  const screwdriverGroup = new THREE.Group();
  screwdriverGroup.position.set(4.1, 0.11, -0.8);
  screwdriverGroup.rotation.y = 0.28;
  const sdHandle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.072, 0.85, 12),
    new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.62, metalness: 0.1 }),
  );
  sdHandle.rotation.x = Math.PI / 2;
  const sdGrip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 0.32, 12),
    darkPlasticMat,
  );
  sdGrip.rotation.x = Math.PI / 2;
  sdGrip.position.z = 0.1;
  const sdShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.02, 1.15, 10), aluminumMat);
  sdShaft.rotation.x = Math.PI / 2;
  sdShaft.position.z = -0.95;
  screwdriverGroup.add(sdHandle, sdGrip, sdShaft);
  propsGroup.add(screwdriverGroup);

  // Kancing & kabel koil grounding ESD di pojok kanan atas matras
  const esdSnap = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.06, 16), goldMat);
  esdSnap.position.set(4.85, 0.06, -3.2);
  propsGroup.add(esdSnap);

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
  // FASE 1: MEJA ANTI-STATIS & MOTHERBOARD B760 ATX REALISTIS (benchGroup)
  // =========================================================================
  const benchGroup = new THREE.Group();
  scene.add(benchGroup);

  // 9 Standoff kuningan (InstancedMesh)
  const standoffInst = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.075, 0.075, 0.16, 12),
    copperMat,
    9,
  );
  let sIdx = 0;
  for (const sx of [-2.05, 0, 2.05]) {
    for (const sz of [-1.65, 0, 1.65]) {
      _tmpObj.position.set(sx, 0.1, sz);
      _tmpObj.rotation.set(0, 0, 0);
      _tmpObj.scale.set(1, 1, 1);
      _tmpObj.updateMatrix();
      standoffInst.setMatrixAt(sIdx++, _tmpObj.matrix);
    }
  }
  standoffInst.instanceMatrix.needsUpdate = true;
  standoffInst.computeBoundingSphere();
  benchGroup.add(standoffInst);

  // Papan PCB Motherboard B760 ATX
  const moboBaseY = 0.21;
  const moboBoard = new THREE.Mesh(new THREE.BoxGeometry(4.65, 0.095, 3.85), pcbMat);
  moboBoard.position.set(0, moboBaseY, 0);
  moboBoard.castShadow = !isSoftwareGl;
  moboBoard.receiveShadow = !isSoftwareGl;
  benchGroup.add(moboBoard);

  // Rear I/O Armor + Port Cluster (USB, RJ45, HDMI, Audio Jacks)
  const ioShroud = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.54, 1.6), brushedDarkMetalMat);
  ioShroud.position.set(-1.98, moboBaseY + 0.32, -0.84);
  ioShroud.castShadow = !isSoftwareGl;
  const ioAccentStrip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.48), aluminumMat);
  ioAccentStrip.position.set(-1.72, moboBaseY + 0.58, -0.84);
  benchGroup.add(ioShroud, ioAccentStrip);

  // Port USB biru & merah di sisi kiri Rear I/O
  const usbBlueMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.4, metalness: 0.2 });
  const usbRedMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4, metalness: 0.2 });
  [-1.35, -1.05, -0.75, -0.45].forEach((uz, idx) => {
    const portHousing = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.24, 0.22), aluminumMat);
    portHousing.position.set(-2.26, moboBaseY + 0.24, uz);
    const tongue = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.14, 0.14),
      idx === 3 ? usbRedMat : usbBlueMat,
    );
    tongue.position.set(-2.31, moboBaseY + 0.24, uz);
    benchGroup.add(portHousing, tongue);
  });

  // Heatsink VRM atas & kiri (sirip beralur aluminium)
  const vrmTopBase = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.36, 0.4), brushedDarkMetalMat);
  vrmTopBase.position.set(-0.62, moboBaseY + 0.23, -1.5);
  vrmTopBase.castShadow = !isSoftwareGl;
  const vrmTopTrim = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.06, 0.14), aluminumMat);
  vrmTopTrim.position.set(-0.62, moboBaseY + 0.42, -1.44);
  benchGroup.add(vrmTopBase, vrmTopTrim);

  const vrmLeftBase = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.38, 1.2), brushedDarkMetalMat);
  vrmLeftBase.position.set(-1.46, moboBaseY + 0.24, -0.58);
  vrmLeftBase.castShadow = !isSoftwareGl;
  const vrmLeftTrim = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 1.12), aluminumMat);
  vrmLeftTrim.position.set(-1.42, moboBaseY + 0.44, -0.58);
  benchGroup.add(vrmLeftBase, vrmLeftTrim);

  // 12 Ferrite VRM Chokes + 14 Solid Capacitors (InstancedMesh — detail teknis papan induk!)
  const chokeInst = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.13, 0.12, 0.13),
    brushedDarkMetalMat,
    12,
  );
  const capInst = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.15, 10),
    aluminumMat,
    14,
  );
  for (let i = 0; i < 7; i++) {
    _tmpObj.position.set(-1.18 + i * 0.19, moboBaseY + 0.11, -1.2);
    _tmpObj.rotation.set(0, 0, 0);
    _tmpObj.scale.set(1, 1, 1);
    _tmpObj.updateMatrix();
    chokeInst.setMatrixAt(i, _tmpObj.matrix);

    _tmpObj.position.set(-1.18 + i * 0.19, moboBaseY + 0.12, -1.04);
    _tmpObj.updateMatrix();
    capInst.setMatrixAt(i, _tmpObj.matrix);
  }
  for (let i = 0; i < 5; i++) {
    _tmpObj.position.set(-1.18, moboBaseY + 0.11, -0.92 + i * 0.19);
    _tmpObj.updateMatrix();
    chokeInst.setMatrixAt(7 + i, _tmpObj.matrix);
  }
  for (let i = 0; i < 7; i++) {
    _tmpObj.position.set(-1.95, moboBaseY + 0.12, 0.4 + i * 0.18);
    _tmpObj.updateMatrix();
    capInst.setMatrixAt(7 + i, _tmpObj.matrix);
  }
  chokeInst.instanceMatrix.needsUpdate = true;
  chokeInst.computeBoundingSphere();
  capInst.instanceMatrix.needsUpdate = true;
  capInst.computeBoundingSphere();
  benchGroup.add(chokeInst, capInst);

  // Header EPS 8-Pin & ATX 24-Pin
  const benchEps = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.24, 0.22), darkPlasticMat);
  benchEps.position.set(-1.55, moboBaseY + 0.17, -1.68);
  const benchAtx24 = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 1.14), darkPlasticMat);
  benchAtx24.position.set(2.08, moboBaseY + 0.18, -0.48);
  benchGroup.add(benchEps, benchAtx24);

  // SOKET CPU LGA1700 + Kisi Pin Emas + Tuas Stainless Berengsel
  const cpuCenterX = -0.58;
  const cpuCenterZ = -0.52;
  const socketHousing = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.085, 1.16), brushedDarkMetalMat);
  socketHousing.position.set(cpuCenterX, moboBaseY + 0.09, cpuCenterZ);
  const pinGridPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.86, 0.032, 0.9),
    new THREE.MeshStandardMaterial({
      map: texPack.lgaPinsAlbedo,
      roughness: 0.3,
      metalness: 0.84,
    }),
  );
  pinGridPlate.position.set(cpuCenterX, moboBaseY + 0.14, cpuCenterZ);
  const socketPin1Marker = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.04, 3), goldMat);
  socketPin1Marker.position.set(cpuCenterX - 0.45, moboBaseY + 0.155, cpuCenterZ + 0.46);
  socketPin1Marker.rotation.y = Math.PI / 4;
  benchGroup.add(socketHousing, pinGridPlate, socketPin1Marker);

  // Engsel rangka ILM & tuas beban stainless LGA1700
  const latchPivot = new THREE.Group();
  latchPivot.position.set(cpuCenterX, moboBaseY + 0.155, cpuCenterZ - 0.57);
  benchGroup.add(latchPivot);

  const ilmTop = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.048, 0.1), aluminumMat);
  ilmTop.position.set(0, 0.03, 0.05);
  const ilmBot = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.048, 0.1), aluminumMat);
  ilmBot.position.set(0, 0.03, 1.1);
  const ilmLeft = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.048, 1.05), aluminumMat);
  ilmLeft.position.set(-0.47, 0.03, 0.575);
  const ilmRight = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.048, 1.05), aluminumMat);
  ilmRight.position.set(0.47, 0.03, 0.575);
  const leverCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.55, 0.04, 0.06),
    new THREE.Vector3(0.64, 0.05, 0.58),
    new THREE.Vector3(0.64, 0.05, 1.08),
    new THREE.Vector3(0.74, 0.06, 1.16),
  ]);
  const leverArm = new THREE.Mesh(new THREE.TubeGeometry(leverCurve, 16, 0.024, 8, false), aluminumMat);
  const leverTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.058, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.3, metalness: 0.25 }),
  );
  leverTip.position.set(0.74, 0.06, 1.16);
  latchPivot.add(ilmTop, ilmBot, ilmLeft, ilmRight, leverArm, leverTip);

  // Komposit 3D CPU (PCB hijau + kapasitor tepi + IHS nikel dinamis sesuai SKU yang dibeli)
  const cpuGroup = new THREE.Group();
  cpuGroup.position.set(cpuCenterX, moboBaseY + 0.165, cpuCenterZ);
  const cpuSub = new THREE.Mesh(
    new THREE.BoxGeometry(0.84, 0.042, 0.88),
    new THREE.MeshStandardMaterial({ color: 0x146c43, roughness: 0.48, metalness: 0.16 }),
  );
  const initCpuInfo = getEffectivePartInfo(initialState, 'cpu');
  let activeCpuCode = initCpuInfo.shortCode;
  let cpuIhsTex = createDynamicCpuIhsTexture(initCpuInfo.shortCode, initCpuInfo.model, maxAniso);
  dynamicTextures.push(cpuIhsTex);
  const cpuIhsMat = new THREE.MeshPhysicalMaterial({
    map: cpuIhsTex,
    bumpMap: texPack.brushedMetalBump,
    bumpScale: 0.004,
    roughness: 0.2,
    metalness: 0.86,
    clearcoat: 0.2,
  });
  const cpuIhs = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.065, 0.74), cpuIhsMat);
  cpuIhs.position.y = 0.052;
  cpuIhs.castShadow = !isSoftwareGl;
  cpuGroup.add(cpuSub, cpuIhs);
  cpuGroup.visible = false;
  benchGroup.add(cpuGroup);

  // Komposit Pasta Termal (tetesan abu metalik realistis di tengah IHS)
  const pasteMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.135, 18, 14),
    new THREE.MeshPhysicalMaterial({
      color: 0x738294,
      roughness: 0.24,
      metalness: 0.35,
      clearcoat: 0.6,
    }),
  );
  pasteMesh.scale.set(1.25, 0.34, 1.25);
  pasteMesh.position.set(cpuCenterX, moboBaseY + 0.26, cpuCenterZ);
  pasteMesh.visible = false;
  benchGroup.add(pasteMesh);

  // 4 Varian 3D Pendingin CPU di Meja (stock / tower / dual / aio)
  const benchCoolerAnchor = new THREE.Group();
  benchCoolerAnchor.position.set(cpuCenterX, moboBaseY + 0.24, cpuCenterZ);
  benchCoolerAnchor.visible = false;
  benchGroup.add(benchCoolerAnchor);

  const coolerMats = {
    aluminum: aluminumMat,
    brushedDark: brushedDarkMetalMat,
    copper: copperMat,
    plastic: darkPlasticMat,
    fanBlade: fanBladeMat,
    rgbMat: rgbEmissiveMat,
  };
  const benchCoolerVariants = {
    stock: buildCoolerVariantGroup('stock', coolerMats, !isSoftwareGl),
    tower: buildCoolerVariantGroup('tower', coolerMats, !isSoftwareGl),
    dual: buildCoolerVariantGroup('dual', coolerMats, !isSoftwareGl),
    aio: buildCoolerVariantGroup('aio', coolerMats, !isSoftwareGl),
  };
  Object.values(benchCoolerVariants).forEach((v) => {
    v.group.visible = false;
    benchCoolerAnchor.add(v.group);
  });

  // 4 Slot RAM DDR5 dengan klip pengunci + 2 Modul RAM dengan RGB Lightbar
  const dimmXs = [0.7, 0.98, 1.26, 1.54];
  dimmXs.forEach((dx, idx) => {
    const isPrimary = idx === 1 || idx === 3;
    const slotRail = new THREE.Mesh(
      new THREE.BoxGeometry(0.115, 0.15, 1.62),
      isPrimary
        ? new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.48, metalness: 0.25 })
        : darkPlasticMat,
    );
    slotRail.position.set(dx, moboBaseY + 0.125, -0.45);
    const clipTop = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.12, 0.08), aluminumMat);
    clipTop.position.set(dx, moboBaseY + 0.18, -1.28);
    const clipBot = clipTop.clone();
    clipBot.position.set(dx, moboBaseY + 0.18, 0.38);
    benchGroup.add(slotRail, clipTop, clipBot);
  });

  const makeDetailedRamStick = (x: number) => {
    const stick = new THREE.Group();
    stick.position.set(x, moboBaseY + 0.44, -0.45);
    const goldEdge = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.09, 1.48), goldMat);
    goldEdge.position.y = -0.26;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.48, 1.54), ramHeatspreaderMat);
    body.castShadow = !isSoftwareGl;
    const accentFin = new THREE.Mesh(new THREE.BoxGeometry(0.126, 0.12, 1.46), brushedDarkMetalMat);
    accentFin.position.y = 0.08;
    const rgbDiffuser = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.085, 1.52), rgbEmissiveMat);
    rgbDiffuser.position.y = 0.275;
    stick.add(goldEdge, body, accentFin, rgbDiffuser);
    stick.visible = false;
    benchGroup.add(stick);
    return stick;
  };
  const benchRamA2 = makeDetailedRamStick(dimmXs[1]);
  const benchRamB2 = makeDetailedRamStick(dimmXs[3]);

  // Slot M.2 NVMe & SSD Multi-Part dengan Heatsink Dinamis
  const m2Connector = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.13, 0.36), darkPlasticMat);
  m2Connector.position.set(-1.38, moboBaseY + 0.115, 0.58);
  const m2Standoff = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.12, 10), copperMat);
  m2Standoff.position.set(0.32, moboBaseY + 0.11, 0.58);
  benchGroup.add(m2Connector, m2Standoff);

  const benchSsdGroup = new THREE.Group();
  benchSsdGroup.position.set(-0.52, moboBaseY + 0.185, 0.58);
  const ssdPcb = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.04, 0.35), darkPlasticMat);
  const ssdGoldPins = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.042, 0.3), goldMat);
  ssdGoldPins.position.set(-0.82, 0, 0);
  const ssdController = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.036, 0.22), aluminumMat);
  ssdController.position.set(-0.52, 0.03, 0);
  const ssdNand1 = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.032, 0.26), brushedDarkMetalMat);
  ssdNand1.position.set(-0.08, 0.028, 0);
  const ssdNand2 = ssdNand1.clone();
  ssdNand2.position.set(0.34, 0.028, 0);
  const ssdProHeatsink = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.075, 0.34), brushedDarkMetalMat);
  ssdProHeatsink.position.set(0.02, 0.055, 0);
  const ssdScrew = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.045, 12), aluminumMat);
  ssdScrew.position.set(0.82, 0.035, 0);
  benchSsdGroup.add(ssdPcb, ssdGoldPins, ssdController, ssdNand1, ssdNand2, ssdProHeatsink, ssdScrew);
  benchSsdGroup.visible = false;
  benchGroup.add(benchSsdGroup);

  // Slot PCIe x16 Berlapis Baja, Slot PCIe x1, Chipset B760 Beveled, Baterai CMOS CR2032
  const benchPcieArmor = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.165, 0.2), aluminumMat);
  benchPcieArmor.position.set(-0.45, moboBaseY + 0.13, 1.12);
  const benchPcieLatch = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.24), darkPlasticMat);
  benchPcieLatch.position.set(0.66, moboBaseY + 0.14, 1.12);
  const benchPcieX1 = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.13, 0.14), darkPlasticMat);
  benchPcieX1.position.set(-1.15, moboBaseY + 0.11, 1.54);
  const chipsetSink = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.22, 0.9), brushedDarkMetalMat);
  chipsetSink.position.set(1.4, moboBaseY + 0.16, 1.14);
  const chipsetStripe = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.03, 0.12), aluminumMat);
  chipsetStripe.position.set(1.4, moboBaseY + 0.28, 1.14);
  const cmosHolder = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.07, 18), darkPlasticMat);
  cmosHolder.position.set(0.58, moboBaseY + 0.08, 1.48);
  const cmosBattery = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.08, 20), aluminumMat);
  cmosBattery.position.set(0.58, moboBaseY + 0.095, 1.48);
  benchGroup.add(
    benchPcieArmor,
    benchPcieLatch,
    benchPcieX1,
    chipsetSink,
    chipsetStripe,
    cmosHolder,
    cmosBattery,
  );

  // Daftarkan hitbox raycasting Fase 1
  const benchLatchHit = registerInteractiveBox(
    benchGroup,
    'bench',
    'cpu_latch',
    [0.38, 0.36, 1.28],
    [cpuCenterX + 0.64, moboBaseY + 0.22, cpuCenterZ],
    { type: 'cpu_latch', label: 'Tuas Pengunci Soket LGA1700' },
  );
  const benchCpuZoneHit = registerInteractiveBox(
    benchGroup,
    'bench',
    'cpu_zone',
    [1.22, 0.9, 1.22],
    [cpuCenterX, moboBaseY + 0.44, cpuCenterZ],
    { type: 'slot', slotId: 'socket_cpu', label: 'Soket CPU LGA1700' },
  );
  registerInteractiveBox(
    benchGroup,
    'bench',
    'dimm_a2',
    [0.24, 0.62, 1.66],
    [dimmXs[1], moboBaseY + 0.34, -0.45],
    { type: 'slot', slotId: 'dimm_a2', label: 'Slot RAM DDR5 A2*' },
  );
  registerInteractiveBox(
    benchGroup,
    'bench',
    'dimm_b2',
    [0.24, 0.62, 1.66],
    [dimmXs[3], moboBaseY + 0.34, -0.45],
    { type: 'slot', slotId: 'dimm_b2', label: 'Slot RAM DDR5 B2*' },
  );
  registerInteractiveBox(
    benchGroup,
    'bench',
    'm2_slot',
    [1.82, 0.28, 0.5],
    [-0.52, moboBaseY + 0.18, 0.58],
    { type: 'slot', slotId: 'm2_slot', label: 'Slot M.2 NVMe Gen4' },
  );

  // =========================================================================
  // FASE 2: INTERIOR CASING MID-TOWER ATX REALISTIS (caseGroup)
  // =========================================================================
  const caseGroup = new THREE.Group();
  caseGroup.visible = false;
  scene.add(caseGroup);

  const caseW = 5.6;
  const caseH = 4.75;
  const caseD = 2.4;

  // Rangka baja Mid-Tower dengan kaki karet anti-getar
  const backPanel = new THREE.Mesh(new THREE.BoxGeometry(caseW, caseH, 0.14), caseChassisMat);
  backPanel.position.set(0, caseH / 2 + 0.14, -caseD / 2);
  backPanel.receiveShadow = !isSoftwareGl;
  const bottomPanel = new THREE.Mesh(new THREE.BoxGeometry(caseW, 0.16, caseD), caseChassisMat);
  bottomPanel.position.set(0, 0.22, 0);
  const topPanel = new THREE.Mesh(new THREE.BoxGeometry(caseW, 0.18, caseD), caseChassisMat);
  topPanel.position.set(0, caseH + 0.05, 0);
  const topDustFilter = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.65), ventMeshMat);
  topDustFilter.rotation.x = -Math.PI / 2;
  topDustFilter.position.set(-0.3, caseH + 0.145, 0);
  const leftPanel = new THREE.Mesh(new THREE.BoxGeometry(0.16, caseH, caseD), caseChassisMat);
  leftPanel.position.set(-caseW / 2 + 0.08, caseH / 2 + 0.14, 0);
  const rightPanel = new THREE.Mesh(new THREE.BoxGeometry(0.16, caseH, caseD), caseChassisMat);
  rightPanel.position.set(caseW / 2 - 0.08, caseH / 2 + 0.14, 0);
  const frontMeshPanel = new THREE.Mesh(new THREE.BoxGeometry(0.06, caseH - 0.35, caseD - 0.25), ventMeshMat);
  frontMeshPanel.position.set(caseW / 2 + 0.02, caseH / 2 + 0.14, 0);

  // 4 Kaki karet aluminium casing
  for (const fx of [-2.25, 2.25]) {
    for (const fz of [-0.85, 0.85]) {
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.14, 16), brushedDarkMetalMat);
      foot.position.set(fx, 0.07, fz);
      caseGroup.add(foot);
    }
  }

  // Shroud bawah PSU + Grommet karet manajemen kabel pada back tray
  const shroudTop = new THREE.Mesh(new THREE.BoxGeometry(caseW - 0.32, 0.1, caseD - 0.16), caseShroudMat);
  shroudTop.position.set(0, 1.15, 0);
  const shroudFront = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.88, 0.08), caseShroudMat);
  shroudFront.position.set(1.3, 0.72, caseD / 2 - 0.12);
  caseGroup.add(
    backPanel,
    bottomPanel,
    topPanel,
    topDustFilter,
    leftPanel,
    rightPanel,
    frontMeshPanel,
    shroudTop,
    shroudFront,
  );

  // 3 Grommet karet jalur kabel vertikal di sebelah motherboard
  [1.85, 2.85, 3.85].forEach((gy) => {
    const grommet = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.56, 0.08), darkPlasticMat);
    grommet.position.set(1.42, gy, -caseD / 2 + 0.1);
    caseGroup.add(grommet);
  });

  // 3 Kipas intake depan + 1 Kipas exhaust belakang dengan cincin ARGB!
  const caseFans: THREE.Group[] = [];
  [1.75, 2.75, 3.75].forEach((fy) => {
    const fanFrame = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.9, 0.9), darkPlasticMat);
    fanFrame.position.set(2.5, fy, 0.06);
    caseGroup.add(fanFrame);
    const fan = createDetailedFan(0.4, fanBladeMat, darkPlasticMat, rgbEmissiveMat);
    fan.group.rotation.y = -Math.PI / 2;
    fan.group.position.set(2.38, fy, 0.06);
    caseGroup.add(fan.group);
    caseFans.push(fan.rotor);
  });

  // 1 Kipas exhaust belakang kiri atas
  const rearFanFrame = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.86, 0.86), darkPlasticMat);
  rearFanFrame.position.set(-2.54, 3.62, -0.1);
  caseGroup.add(rearFanFrame);
  const rearFan = createDetailedFan(0.37, fanBladeMat, darkPlasticMat, rgbEmissiveMat);
  rearFan.group.rotation.y = Math.PI / 2;
  rearFan.group.position.set(-2.43, 3.62, -0.1);
  caseGroup.add(rearFan.group);
  caseFans.push(rearFan.rotor);

  // Tombol POWER iluminasi & port Front I/O USB-C di atas kanan casing
  const powerBtnMat = new THREE.MeshStandardMaterial({
    color: 0x3b82f6,
    emissive: 0x1d4ed8,
    emissiveIntensity: 0.65,
    roughness: 0.25,
    metalness: 0.35,
  });
  const powerBtnRing = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.08, 22), brushedDarkMetalMat);
  powerBtnRing.position.set(2.08, caseH + 0.15, 0.68);
  const powerBtnMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.11, 20), powerBtnMat);
  powerBtnMesh.position.set(2.08, caseH + 0.16, 0.68);
  const frontUsbC = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.1), aluminumMat);
  frontUsbC.position.set(1.55, caseH + 0.15, 0.68);
  caseGroup.add(powerBtnRing, powerBtnMesh, frontUsbC);

  // 9 Standoff motherboard vertikal di back tray
  const caseStandoffs = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.06, 0.06, 0.16, 10),
    copperMat,
    9,
  );
  let csIdx = 0;
  for (const sx of [-1.95, -0.5, 0.95]) {
    for (const sy of [1.58, 2.88, 4.18]) {
      _tmpObj.position.set(sx, sy, -1.04);
      _tmpObj.rotation.set(Math.PI / 2, 0, 0);
      _tmpObj.scale.set(1, 1, 1);
      _tmpObj.updateMatrix();
      caseStandoffs.setMatrixAt(csIdx++, _tmpObj.matrix);
    }
  }
  caseStandoffs.instanceMatrix.needsUpdate = true;
  caseStandoffs.computeBoundingSphere();
  caseGroup.add(caseStandoffs);

  // Komposit 3D PSU dengan Badge Wattage Dinamis + Sakelar Rocker Tilting + Port Modular
  const psuGroup = new THREE.Group();
  const psuBasePos = new THREE.Vector3(-1.38, 0.68, 0.06);
  psuGroup.position.copy(psuBasePos);
  const psuBody = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.82, 1.5), psuSteelMat);
  psuBody.castShadow = !isSoftwareGl;
  const psuGrille = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.62), ventMeshMat);
  psuGrille.rotation.y = -Math.PI / 2;
  psuGrille.position.set(-1.02, 0, 0);

  let activePsuCap = getPsuCapacityWatts(initialState);
  let psuBadgeTex = createDynamicBadgeTexture(
    `${activePsuCap}W`,
    '80+ GOLD',
    '#0f172a',
    '#f59e0b',
    '#f8fafc',
    maxAniso,
  );
  dynamicTextures.push(psuBadgeTex);
  const psuBadgeMat = new THREE.MeshStandardMaterial({
    map: psuBadgeTex,
    roughness: 0.34,
    metalness: 0.3,
  });
  const psuBadge = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 0.52), psuBadgeMat);
  psuBadge.position.set(-0.28, 0.02, 0.758);

  const psuSwitchMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    emissive: 0x000000,
    roughness: 0.4,
    metalness: 0.25,
  });
  const psuSwitchBezel = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.08), darkPlasticMat);
  psuSwitchBezel.position.set(0.62, 0, 0.74);
  const psuSwitchMesh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.24, 0.14), psuSwitchMat);
  psuSwitchMesh.position.set(0.62, 0, 0.76);
  psuGroup.add(psuBody, psuGrille, psuBadge, psuSwitchBezel, psuSwitchMesh);
  psuGroup.visible = false;
  caseGroup.add(psuGroup);

  // Komposit 3D Motherboard Terakit (Vertikal di dalam Casing)
  const caseMoboGroup = new THREE.Group();
  const caseMoboBasePos = new THREE.Vector3(-0.5, 2.9, -0.88);
  caseMoboGroup.position.copy(caseMoboBasePos);

  const casePcb = new THREE.Mesh(new THREE.BoxGeometry(3.3, 3.0, 0.1), pcbMat);
  casePcb.castShadow = !isSoftwareGl;
  caseMoboGroup.add(casePcb);

  // VRM heatsinks & I/O armor pada motherboard di casing
  const cIoShroud = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.12, 0.32), brushedDarkMetalMat);
  cIoShroud.position.set(-1.38, 0.65, 0.21);
  const cVrmTop = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.28, 0.24), brushedDarkMetalMat);
  cVrmTop.position.set(-0.42, 1.24, 0.17);
  caseMoboGroup.add(cIoShroud, cVrmTop);

  // 4 Varian Pendingin CPU di dalam Casing (termasuk Liquid AIO 240 mm + Radiator Atas + Selang Coolant!)
  const caseCoolerAnchor = new THREE.Group();
  caseCoolerAnchor.position.set(-0.35, 0.44, 0.12);
  caseCoolerAnchor.rotation.x = Math.PI / 2;
  caseMoboGroup.add(caseCoolerAnchor);

  const caseCoolerVariants = {
    stock: buildCoolerVariantGroup('stock', coolerMats, !isSoftwareGl),
    tower: buildCoolerVariantGroup('tower', coolerMats, !isSoftwareGl),
    dual: buildCoolerVariantGroup('dual', coolerMats, !isSoftwareGl),
    aio: buildCoolerVariantGroup('aio', coolerMats, !isSoftwareGl),
  };
  Object.values(caseCoolerVariants).forEach((v) => {
    v.group.visible = false;
    caseCoolerAnchor.add(v.group);
    v.rotors.forEach((r) => caseFans.push(r));
  });

  // Radiator Atas 240 mm + 2 Kipas RGB + 2 Selang Braided untuk Liquid AIO (hanya tampak jika cooler_aio_240)
  const aioRadiatorGroup = new THREE.Group();
  const radBody = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.28, 1.05), brushedDarkMetalMat);
  radBody.position.set(-0.35, caseH - 0.14, 0.05);
  aioRadiatorGroup.add(radBody);
  [-0.9, 0.2].forEach((rx) => {
    const rFanFrame = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.16, 0.92), darkPlasticMat);
    rFanFrame.position.set(rx, caseH - 0.34, 0.05);
    aioRadiatorGroup.add(rFanFrame);
    const rFan = createDetailedFan(0.4, fanBladeMat, darkPlasticMat, rgbEmissiveMat);
    rFan.group.rotation.x = Math.PI / 2;
    rFan.group.position.set(rx, caseH - 0.43, 0.05);
    aioRadiatorGroup.add(rFan.group);
    caseFans.push(rFan.rotor);
  });
  const aioTubeMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    bumpMap: texPack.braidedCableBump,
    bumpScale: 0.025,
    roughness: 0.72,
    metalness: 0.1,
  });
  const aioHose1 = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.46, 3.36, -0.45),
        new THREE.Vector3(0.18, 3.45, 0.22),
        new THREE.Vector3(0.56, 4.02, 0.25),
        new THREE.Vector3(0.55, caseH - 0.28, 0.12),
      ]),
      24,
      0.055,
      10,
      false,
    ),
    aioTubeMat,
  );
  const aioHose2 = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.46, 3.24, -0.45),
        new THREE.Vector3(0.28, 3.26, 0.32),
        new THREE.Vector3(0.72, 3.92, 0.28),
        new THREE.Vector3(0.7, caseH - 0.28, 0.06),
      ]),
      24,
      0.055,
      10,
      false,
    ),
    aioTubeMat,
  );
  aioRadiatorGroup.add(aioHose1, aioHose2);
  aioRadiatorGroup.visible = false;
  caseGroup.add(aioRadiatorGroup);

  // RAM Dual-Channel RGB & SSD NVMe terpasang pada motherboard casing
  [0.54, 0.78].forEach((rx) => {
    const rBody = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.08, 0.34), ramHeatspreaderMat);
    rBody.position.set(rx, 0.42, 0.22);
    const rRgb = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.04, 0.06), rgbEmissiveMat);
    rRgb.position.set(rx, 0.42, 0.4);
    caseMoboGroup.add(rBody, rRgb);
  });
  const caseSsd = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.22, 0.09), brushedDarkMetalMat);
  caseSsd.position.set(-0.35, -0.22, 0.09);
  caseMoboGroup.add(caseSsd);

  // Header 24-Pin & 8-Pin CPU
  const caseHeader24Mat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6, metalness: 0.2 });
  const caseHeader24 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.78, 0.22), caseHeader24Mat);
  caseHeader24.position.set(1.38, 0.26, 0.16);
  const caseHeader8CpuMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6, metalness: 0.2 });
  const caseHeader8Cpu = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.22), caseHeader8CpuMat);
  caseHeader8Cpu.position.set(-1.12, 1.24, 0.16);
  const casePcieSlot = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.14, 0.16), aluminumMat);
  casePcieSlot.position.set(-0.42, -0.62, 0.13);
  caseMoboGroup.add(caseHeader24, caseHeader8Cpu, casePcieSlot);

  // EZ-Debug POST LED Strip 3D (CPU, DRAM, VGA, BOOT)
  const ledBoard = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.22, 0.08), psuSteelMat);
  ledBoard.position.set(1.02, 1.22, 0.09);
  caseMoboGroup.add(ledBoard);

  const postLedMaterials = new Map<PostLedKey, THREE.MeshStandardMaterial>();
  (['CPU', 'DRAM', 'VGA', 'BOOT'] as PostLedKey[]).forEach((ledKey, idx) => {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      emissive: 0x000000,
      emissiveIntensity: 0,
      roughness: 0.25,
      metalness: 0.1,
    });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), mat);
    bulb.position.set(0.74 + idx * 0.185, 1.22, 0.14);
    caseMoboGroup.add(bulb);
    postLedMaterials.set(ledKey, mat);
  });

  caseMoboGroup.visible = false;
  caseGroup.add(caseMoboGroup);

  // Komposit 3D Kartu Grafis Dinamis (Compact Dual-Fan / Mid Dual-Fan / Flagship Triple-Fan 4080/4090!)
  const caseGpuGroup = new THREE.Group();
  const caseGpuBasePos = new THREE.Vector3(-0.48, 2.22, 0.04);
  caseGpuGroup.position.copy(caseGpuBasePos);

  const gpuPort8PinMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4, metalness: 0.25 });

  const buildGpuVariant = (tier: 'compact' | 'dual' | 'triple') => {
    const g = new THREE.Group();
    const len = tier === 'compact' ? 2.05 : tier === 'dual' ? 2.48 : 3.05;
    const thick = tier === 'compact' ? 0.36 : tier === 'dual' ? 0.46 : 0.58;
    const depth = tier === 'triple' ? 1.32 : 1.22;
    const xShift = (len - 2.48) * 0.5;

    const shroud = new THREE.Mesh(new THREE.BoxGeometry(len, thick, depth), brushedDarkMetalMat);
    shroud.position.x = xShift;
    shroud.castShadow = !isSoftwareGl;

    // Sirip heatsink aluminium terbuka di sisi depan bawah shroud
    const finCore = new THREE.Mesh(
      new THREE.BoxGeometry(len - 0.14, thick * 0.52, depth - 0.08),
      aluminumMat,
    );
    finCore.position.set(xShift, -thick * 0.1, 0.02);

    // Backplate aluminium disikat dengan ventilasi
    const backplate = new THREE.Mesh(new THREE.BoxGeometry(len + 0.02, 0.05, depth), aluminumMat);
    backplate.position.set(xShift, thick / 2 + 0.025, 0);

    // Pipa tembaga tampak di sisi kartu
    const gpuPipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.028, len * 0.72, 10),
      copperMat,
    );
    gpuPipe.rotation.z = Math.PI / 2;
    gpuPipe.position.set(xShift, -0.02, depth / 2 + 0.01);

    // Strip LED RGB di sisi depan GPU
    const ledBar = new THREE.Mesh(new THREE.BoxGeometry(len * 0.48, 0.055, 0.04), rgbEmissiveMat);
    ledBar.position.set(xShift - 0.25, thick * 0.22, depth / 2 + 0.015);

    // Braket PCIe logam belakang (kiri)
    const ioBracket = new THREE.Mesh(new THREE.BoxGeometry(0.06, thick + 0.26, depth + 0.04), aluminumMat);
    ioBracket.position.set(-2.48 / 2 - 0.03, 0.05, 0);

    // Konektor 8-Pin daya GPU
    const port8 = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.2, 0.12), gpuPort8PinMat);
    port8.position.set(0.72, 0.04, depth / 2 + 0.02);

    g.add(shroud, finCore, backplate, gpuPipe, ledBar, ioBracket, port8);

    // Kipas aksial di bagian bawah shroud (2 kipas untuk Compact/Dual, 3 kipas untuk Flagship Triple!)
    const fanXs =
      tier === 'triple' ? [-0.62, 0.28, 1.18] : tier === 'dual' ? [-0.52, 0.42] : [-0.46, 0.34];
    const fanRad = tier === 'compact' ? 0.33 : 0.38;
    for (const fx of fanXs) {
      const fan = createDetailedFan(fanRad, fanBladeMat, darkPlasticMat);
      fan.group.rotation.x = Math.PI / 2;
      fan.group.position.set(fx, -thick / 2 - 0.02, 0.02);
      g.add(fan.group);
      caseFans.push(fan.rotor);
    }

    return g;
  };

  const gpuVariants = {
    compact: buildGpuVariant('compact'),
    dual: buildGpuVariant('dual'),
    triple: buildGpuVariant('triple'),
  };
  Object.values(gpuVariants).forEach((g) => {
    g.visible = false;
    caseGpuGroup.add(g);
  });
  caseGpuGroup.visible = false;
  caseGroup.add(caseGpuGroup);

  // 3D Braided Sleeved Cables dengan Bump Anyaman + Cable Combs + Konektor Molded!
  const createCableBundle = (
    points: THREE.Vector3[],
    colorHex: number,
    radius: number,
    combIndices: number[],
  ) => {
    const group = new THREE.Group();
    const curve = new THREE.CatmullRomCurve3(points);
    const mat = new THREE.MeshStandardMaterial({
      color: colorHex,
      bumpMap: texPack.braidedCableBump,
      bumpScale: 0.022,
      roughness: 0.65,
      metalness: 0.1,
    });
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 28, radius, 10, false), mat);
    group.add(tube);

    // Cable combs organizer di sepanjang lengkungan kabel
    for (const t of combIndices) {
      const pt = curve.getPoint(t);
      const tangent = curve.getTangent(t);
      const comb = new THREE.Mesh(
        new THREE.BoxGeometry(radius * 2.6, radius * 2.6, 0.07),
        darkPlasticMat,
      );
      comb.position.copy(pt);
      comb.lookAt(pt.clone().add(tangent));
      group.add(comb);
    }

    // Plug konektor di ujung target
    const endPt = points[points.length - 1];
    const plug = new THREE.Mesh(
      new THREE.BoxGeometry(radius * 2.8, radius * 2.8, radius * 3.1),
      darkPlasticMat,
    );
    plug.position.copy(endPt);
    group.add(plug);

    group.visible = false;
    caseGroup.add(group);
    return group;
  };

  const cable24Mesh = createCableBundle(
    [
      new THREE.Vector3(-0.32, 0.85, -0.18),
      new THREE.Vector3(1.42, 1.35, -0.3),
      new THREE.Vector3(1.52, 2.55, -0.48),
      new THREE.Vector3(0.88, 3.16, -0.68),
    ],
    0x2563eb,
    0.082,
    [0.38, 0.68],
  );
  const cable8CpuMesh = createCableBundle(
    [
      new THREE.Vector3(-0.42, 0.88, -0.52),
      new THREE.Vector3(1.62, 1.65, -0.94),
      new THREE.Vector3(1.54, 4.32, -0.94),
      new THREE.Vector3(-1.62, 4.32, -0.7),
      new THREE.Vector3(-1.62, 4.14, -0.7),
    ],
    0x10b981,
    0.058,
    [0.5, 0.82],
  );
  const cable8GpuMesh = createCableBundle(
    [
      new THREE.Vector3(-0.18, 1.05, 0.36),
      new THREE.Vector3(0.46, 1.38, 0.82),
      new THREE.Vector3(0.56, 1.88, 0.92),
      new THREE.Vector3(0.24, 2.26, 0.7),
    ],
    0xf59e0b,
    0.072,
    [0.42, 0.72],
  );

  // Panel Kaca Samping Tempered Glass (Dapat dibuka/ditutup dari dok 3D!)
  const glassGroup = new THREE.Group();
  const glassPaneMat = new THREE.MeshPhysicalMaterial({
    color: 0x0f172a,
    roughness: 0.08,
    metalness: 0.05,
    transmission: isSoftwareGl ? 0 : 0.78,
    thickness: 0.14,
    ior: 1.52,
    clearcoat: 1.0,
    transparent: true,
    opacity: isSoftwareGl ? 0.24 : 0.92,
    depthWrite: false,
  });
  const glassPane = new THREE.Mesh(
    new THREE.BoxGeometry(caseW - 0.2, caseH - 0.16, 0.05),
    glassPaneMat,
  );
  glassPane.renderOrder = 10;
  glassGroup.add(glassPane);

  // Bingkai keramik hitam + 4 baut jempol stainless steel (knurled thumbscrews)
  const borderMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.4, metalness: 0.3 });
  const gbTop = new THREE.Mesh(new THREE.BoxGeometry(caseW - 0.16, 0.14, 0.065), borderMat);
  gbTop.position.y = (caseH - 0.16) / 2 - 0.07;
  const gbBot = gbTop.clone();
  gbBot.position.y = -(caseH - 0.16) / 2 + 0.07;
  const gbLeft = new THREE.Mesh(new THREE.BoxGeometry(0.14, caseH - 0.16, 0.065), borderMat);
  gbLeft.position.x = -(caseW - 0.16) / 2 + 0.07;
  const gbRight = gbLeft.clone();
  gbRight.position.x = (caseW - 0.16) / 2 - 0.07;
  glassGroup.add(gbTop, gbBot, gbLeft, gbRight);

  for (const tx of [-(caseW / 2 - 0.28), caseW / 2 - 0.28]) {
    for (const ty of [-(caseH / 2 - 0.3), caseH / 2 - 0.3]) {
      const thumb = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.12, 14), aluminumMat);
      thumb.rotation.x = Math.PI / 2;
      thumb.position.set(tx, ty, 0.04);
      glassGroup.add(thumb);
    }
  }
  glassGroup.position.set(0, caseH / 2 + 0.14, caseD / 2 + 0.05);
  glassGroup.visible = false;
  caseGroup.add(glassGroup);

  // Visualisasi Aliran Udara 3D (Intake Biru Sejuk -> Exhaust Oranye Hangat)
  const airflowGroup = new THREE.Group();
  const airflowArrows: { mesh: THREE.Mesh; curve: THREE.CatmullRomCurve3; phase: number }[] = [];
  const coolArrowMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.85,
  });
  const warmArrowMat = new THREE.MeshBasicMaterial({
    color: 0xf97316,
    transparent: true,
    opacity: 0.85,
  });
  const airflowCurves: { curve: THREE.CatmullRomCurve3; warm: boolean }[] = [
    {
      curve: new THREE.CatmullRomCurve3([
        new THREE.Vector3(2.9, 3.7, 0.1),
        new THREE.Vector3(1.1, 3.6, 0.15),
        new THREE.Vector3(-0.7, 3.55, 0.05),
        new THREE.Vector3(-2.7, 3.65, -0.05),
      ]),
      warm: false,
    },
    {
      curve: new THREE.CatmullRomCurve3([
        new THREE.Vector3(2.9, 2.65, 0.15),
        new THREE.Vector3(0.9, 2.45, 0.2),
        new THREE.Vector3(-0.6, 2.7, 0.15),
        new THREE.Vector3(-2.7, 3.5, -0.1),
      ]),
      warm: true,
    },
    {
      curve: new THREE.CatmullRomCurve3([
        new THREE.Vector3(2.9, 1.7, 0.15),
        new THREE.Vector3(0.8, 1.85, 0.25),
        new THREE.Vector3(-0.4, 2.9, 0.2),
        new THREE.Vector3(-0.5, 4.95, 0.05),
      ]),
      warm: true,
    },
  ];
  const arrowConeGeo = new THREE.ConeGeometry(0.11, 0.34, 10);
  arrowConeGeo.rotateX(Math.PI / 2);

  for (const entry of airflowCurves) {
    const ribbon = new THREE.Mesh(
      new THREE.TubeGeometry(entry.curve, 26, 0.025, 6, false),
      new THREE.MeshBasicMaterial({
        color: entry.warm ? 0xfb923c : 0x38bdf8,
        transparent: true,
        opacity: 0.35,
      }),
    );
    airflowGroup.add(ribbon);
    for (let k = 0; k < 3; k++) {
      const cone = new THREE.Mesh(arrowConeGeo, entry.warm ? warmArrowMat : coolArrowMat);
      airflowGroup.add(cone);
      airflowArrows.push({ mesh: cone, curve: entry.curve, phase: k / 3 });
    }
  }
  airflowGroup.visible = false;
  caseGroup.add(airflowGroup);

  // Daftarkan hitbox raycasting Fase 2
  const casePsuHit = registerInteractiveBox(
    caseGroup,
    'case',
    'psu_bay',
    [2.12, 0.92, 1.56],
    [-1.38, 0.68, 0.06],
    { type: 'slot', slotId: 'psu_bay', label: 'Ruang PSU ATX' },
    'vertical',
  );
  const caseMoboHit = registerInteractiveBox(
    caseGroup,
    'case',
    'case_standoffs',
    [3.38, 3.08, 0.4],
    [-0.5, 2.9, -0.88],
    { type: 'slot', slotId: 'case_standoffs', label: '9 Standoff Motherboard ATX' },
    'vertical',
  );
  const caseGpuHit = registerInteractiveBox(
    caseGroup,
    'case',
    'pcie_x16',
    [2.65, 0.65, 1.28],
    [-0.48, 2.22, -0.02],
    { type: 'slot', slotId: 'pcie_x16', label: 'Slot PCIe 4.0 x16 (GPU)' },
    'vertical',
  );
  const case24Hit = registerInteractiveBox(
    caseGroup,
    'case',
    'header_24pin',
    [0.54, 0.96, 0.56],
    [0.88, 3.16, -0.68],
    { type: 'slot', slotId: 'header_24pin', label: 'Header ATX 24-Pin' },
    'vertical',
  );
  const case8CpuHit = registerInteractiveBox(
    caseGroup,
    'case',
    'header_8pin_cpu',
    [0.64, 0.46, 0.56],
    [-1.62, 4.14, -0.68],
    { type: 'slot', slotId: 'header_8pin_cpu', label: 'Header EPS 8-Pin CPU' },
    'vertical',
  );
  const case8GpuHit = registerInteractiveBox(
    caseGroup,
    'case',
    'gpu_power_8pin',
    [0.6, 0.5, 0.48],
    [0.24, 2.26, 0.72],
    { type: 'slot', slotId: 'gpu_power_8pin', label: 'Port Daya PCIe 8-Pin GPU' },
    'vertical',
  );
  registerInteractiveBox(
    caseGroup,
    'case',
    'power_button',
    [0.74, 0.36, 0.58],
    [2.08, caseH + 0.16, 0.68],
    { type: 'power_button', label: 'Tombol Power Casing (Uji POST)' },
    'horizontal',
  );

  // =========================================================================
  // KAMERA, ANIMASI DROP-IN, EXPLODED VIEW & RENDER LOOP
  // =========================================================================
  let cameraTransitionActive = false;
  let activeCameraPreset: CameraPresetId = 'isometric';
  let lastPhase = initialState.phase;
  let latchCurrentAngle = initialState.cpuLatchOpen ? -1.18 : 0;
  let explodedCurrent = visualOpts.explodedAmount;
  let glassSlideCurrent = visualOpts.glassPanelClosed ? 0 : 1;
  let powerLightBlend = initialState.fansSpinning && initialState.phase === 'case' ? 1 : 0;
  let rgbPulseClock = 0;
  let airflowClock = 0;
  let hoveredKey: string | null = null;
  let disposed = false;

  // Pelacakan animasi drop-in halus saat komponen baru dipasang
  const installDropProgress = new Map<string, number>();
  let prevInstalledSet = new Set<PartId>(initialState.installedParts);

  const computeCameraPresetTargets = (phase: 'bench' | 'case', preset: CameraPresetId) => {
    if (phase === 'bench') {
      if (preset === 'top') {
        _targetPos.set(0, 7.6, 0.75);
        _targetLook.set(0, 0.25, 0);
      } else if (preset === 'detail') {
        _targetPos.set(-1.35, 3.1, 2.3);
        _targetLook.set(-0.35, 0.36, -0.45);
      } else if (preset === 'side') {
        _targetPos.set(4.6, 2.55, 3.4);
        _targetLook.set(0, 0.38, 0);
      } else {
        _targetPos.set(0.45, 5.1, 5.35);
        _targetLook.set(0, 0.25, 0);
      }
    } else {
      if (preset === 'top') {
        _targetPos.set(0, 2.45, 9.9);
        _targetLook.set(0, 2.25, -0.1);
      } else if (preset === 'detail') {
        _targetPos.set(0.55, 2.65, 5.4);
        _targetLook.set(-0.32, 2.45, -0.15);
      } else if (preset === 'side') {
        _targetPos.set(-4.2, 3.1, 7.8);
        _targetLook.set(0, 2.25, -0.1);
      } else {
        _targetPos.set(2.65, 3.25, 10.85);
        _targetLook.set(0, 1.72, -0.1);
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
  let paceTimerId = 0;
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
        paceTimerId = window.setTimeout(poll, 4);
      } else {
        if (sync) gl.deleteSync(sync);
        // Jika ada perubahan state baru (pemasangan komponen), render segera tanpa jeda 80 ms
        const delayMs = renderDirty ? 0 : 80;
        if (delayMs === 0) {
          cb();
        } else {
          paceTimerId = window.setTimeout(cb, delayMs);
        }
      }
    };
    paceTimerId = window.setTimeout(poll, 4);
  };

  const hasActiveDropAnims = (): boolean => {
    for (const v of installDropProgress.values()) {
      if (v > 0.005) return true;
    }
    return false;
  };

  const needsContinuousFrames = (): boolean => {
    const latchTarget = currentState.cpuLatchOpen ? -1.18 : 0;
    const latchMoving = Math.abs(latchCurrentAngle - latchTarget) > 0.008;
    const explodeMoving = Math.abs(explodedCurrent - visualOpts.explodedAmount) > 0.005;
    const glassTarget = visualOpts.glassPanelClosed ? 0 : 1;
    const glassMoving = Math.abs(glassSlideCurrent - glassTarget) > 0.008;
    const powerTarget = currentState.fansSpinning && currentState.phase === 'case' ? 1 : 0;
    const lightingTransitioning = Math.abs(powerLightBlend - powerTarget) > 0.006;
    const airflowActive = visualOpts.showAirflow && currentState.phase === 'case';
    return (
      cameraTransitionActive ||
      latchMoving ||
      explodeMoving ||
      glassMoving ||
      lightingTransitioning ||
      hasActiveDropAnims() ||
      airflowActive ||
      (currentState.fansSpinning && currentState.phase === 'case')
    );
  };

  // Sinkronisasi pencahayaan dinamis ruangan + efek pantulan cahaya RGB komponen ke meja 3D
  const updateDynamicLighting = () => {
    const rig = computeDynamicLightingRig({
      phase: currentState.phase,
      studioLight: visualOpts.studioLight,
      rgbTheme: visualOpts.rgbTheme,
      isPcPoweredOn: currentState.fansSpinning,
      glassPanelClosed: visualOpts.glassPanelClosed,
      powerBlend: powerLightBlend,
      pulsePhase: rgbPulseClock,
    });

    _tmpColor.setHex(rig.bgColorHex);
    if (scene.background instanceof THREE.Color) {
      scene.background.copy(_tmpColor);
    } else {
      scene.background = _tmpColor.clone();
    }
    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.color.copy(_tmpColor);
    } else {
      scene.fog = new THREE.FogExp2(rig.bgColorHex, 0.025);
    }

    keyLight.intensity = rig.keyLightIntensity;
    hemiLight.intensity = rig.hemiLightIntensity;
    rimLight.intensity = rig.rimLightIntensity;
    if (overheadSoftbox) {
      overheadSoftbox.intensity = rig.softboxIntensity;
    }
    renderer.toneMappingExposure = rig.toneMappingExposure;

    const rgbHex = RGB_THEME_HEX[visualOpts.rgbTheme];
    const rgbOn = visualOpts.rgbTheme !== 'off';

    // Warna rim light bergeser lembut menuju warna RGB saat PC menyala untuk kilau tepi casing
    if (rgbOn && rig.rgbActive) {
      _rgbColor.setHex(rgbHex);
      _tmpColor.setHex(0x7dd3fc).lerp(_rgbColor, 0.35 * rig.roomDimFactor);
      rimLight.color.copy(_tmpColor);
    } else {
      rimLight.color.setHex(0x7dd3fc);
    }

    rgbEmissiveMat.color.setHex(rgbHex);
    rgbEmissiveMat.emissive.setHex(rgbOn ? rgbHex : 0x000000);
    rgbEmissiveMat.emissiveIntensity = rig.rgbEmissiveIntensity;

    caseRgbLight.color.setHex(rgbHex);
    caseRgbLight.intensity = rig.interiorRgbLightIntensity;

    deskBounceLight.color.setHex(rgbHex);
    deskBounceLight.intensity = rig.deskBounceLightIntensity;

    frontFanSpillLight.color.setHex(rgbHex);
    frontFanSpillLight.intensity = rig.frontFanSpillLightIntensity;

    // Bidang pantulan cahaya RGB di permukaan matras ESD & meja bengkel
    deskSideGlowMat.color.setHex(rgbHex);
    deskSideGlowMat.opacity = rig.deskReflectionOpacity;
    deskSideGlowPlane.visible = rig.deskReflectionOpacity > 0.01;

    deskFrontGlowMat.color.setHex(rgbHex);
    deskFrontGlowMat.opacity = rig.frontReflectionOpacity;
    deskFrontGlowPlane.visible = rig.frontReflectionOpacity > 0.01;

    caseUnderglowMat.color.setHex(rgbHex);
    caseUnderglowMat.opacity = Number((rig.deskReflectionOpacity * 0.58).toFixed(3));
    caseUnderglowPlane.visible = rig.deskReflectionOpacity > 0.01;
  };

  const applyDynamicTransforms = (dt: number) => {
    // Engsel tuas soket LGA1700
    const latchTarget = currentState.cpuLatchOpen ? -1.18 : 0;
    latchCurrentAngle = isSoftwareGl
      ? latchTarget
      : THREE.MathUtils.damp(latchCurrentAngle, latchTarget, 10, dt);
    latchPivot.rotation.x = latchCurrentAngle;

    // Exploded view damping
    explodedCurrent = isSoftwareGl
      ? visualOpts.explodedAmount
      : THREE.MathUtils.damp(explodedCurrent, visualOpts.explodedAmount, 8, dt);

    // Slide-open tempered glass panel damping
    const glassTarget = visualOpts.glassPanelClosed ? 0 : 1;
    glassSlideCurrent = isSoftwareGl
      ? glassTarget
      : THREE.MathUtils.damp(glassSlideCurrent, glassTarget, 8, dt);

    // Transisi peredupan ruangan & pantulan RGB dinamis saat simulasi nyala PC aktif
    const powerTarget = currentState.fansSpinning && currentState.phase === 'case' ? 1 : 0;
    powerLightBlend = isSoftwareGl
      ? powerTarget
      : THREE.MathUtils.damp(powerLightBlend, powerTarget, 4.5, dt);
    if (currentState.fansSpinning && currentState.phase === 'case') {
      rgbPulseClock = (rgbPulseClock + dt * 2.4) % (Math.PI * 2);
    } else {
      rgbPulseClock = 0;
    }
    updateDynamicLighting();

    // Update drop-in spring progress
    installDropProgress.forEach((val, key) => {
      const next = isSoftwareGl ? 0 : THREE.MathUtils.damp(val, 0, 11, dt);
      installDropProgress.set(key, next < 0.004 ? 0 : next);
    });

    const drop = (id: string) => installDropProgress.get(id) ?? 0;

    // Posisi komponen Fase 1 dengan Exploded View + Drop-in animation
    const cpuInstalled = hasPart(currentState, 'cpu');
    cpuGroup.position.y = cpuInstalled
      ? moboBaseY + 0.165 + explodedCurrent * 0.45 + drop('cpu') * 0.85
      : moboBaseY + 0.44;
    pasteMesh.position.y = moboBaseY + 0.26 + explodedCurrent * 0.72 + drop('thermal_paste') * 0.45;
    benchCoolerAnchor.position.y =
      moboBaseY + 0.24 + explodedCurrent * 1.15 + drop('cpu_cooler') * 1.1;
    benchRamA2.position.y = moboBaseY + 0.44 + explodedCurrent * 0.8 + drop('ram_a2') * 0.75;
    benchRamB2.position.y = moboBaseY + 0.44 + explodedCurrent * 0.8 + drop('ram_b2') * 0.75;
    benchSsdGroup.position.y = moboBaseY + 0.185 + explodedCurrent * 0.55 + drop('ssd_nvme') * 0.55;

    // Posisi komponen Fase 2 dengan Exploded View + Drop-in animation
    psuGroup.position.set(
      psuBasePos.x - explodedCurrent * 0.55,
      psuBasePos.y,
      psuBasePos.z + explodedCurrent * 0.7 + drop('psu') * 0.9,
    );
    caseMoboGroup.position.set(
      caseMoboBasePos.x,
      caseMoboBasePos.y,
      caseMoboBasePos.z + explodedCurrent * 0.35 + drop('motherboard') * 0.9,
    );
    caseGpuGroup.position.set(
      caseGpuBasePos.x,
      caseGpuBasePos.y,
      caseGpuBasePos.z + explodedCurrent * 1.05 + drop('gpu') * 1.1,
    );

    // Kaca samping tempered glass
    glassGroup.visible = currentState.phase === 'case' && glassSlideCurrent < 0.98;
    glassGroup.position.set(
      glassSlideCurrent * 1.1,
      caseH / 2 + 0.14,
      caseD / 2 + 0.08 + explodedCurrent * 1.45 + glassSlideCurrent * 1.6,
    );
    glassPaneMat.opacity = (isSoftwareGl ? 0.24 : 0.92) * (1 - glassSlideCurrent);

    // Aliran udara 3D animasi (panah bergerak sepanjang kurva intake -> exhaust)
    airflowGroup.visible = visualOpts.showAirflow && currentState.phase === 'case';
    if (airflowGroup.visible) {
      airflowClock = (airflowClock + dt * (currentState.fansSpinning ? 0.78 : 0.36)) % 1;
      for (const item of airflowArrows) {
        const t = (item.phase + airflowClock) % 1;
        const pos = item.curve.getPoint(t);
        const tangent = item.curve.getTangent(t);
        item.mesh.position.copy(pos);
        item.mesh.lookAt(pos.x + tangent.x, pos.y + tangent.y, pos.z + tangent.z);
      }
    }

    // Putaran kipas casing, cooler, & GPU saat POST berhasil
    if (currentState.fansSpinning && currentState.phase === 'case') {
      for (const rotor of caseFans) {
        rotor.rotation.z -= dt * 13.5;
      }
    }
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

      applyDynamicTransforms(dt);

      if (cameraTransitionActive) {
        if (isSoftwareGl) {
          camera.position.copy(_targetPos);
          controls.target.copy(_targetLook);
          cameraTransitionActive = false;
        } else {
          camera.position.x = THREE.MathUtils.damp(camera.position.x, _targetPos.x, 7.5, dt);
          camera.position.y = THREE.MathUtils.damp(camera.position.y, _targetPos.y, 7.5, dt);
          camera.position.z = THREE.MathUtils.damp(camera.position.z, _targetPos.z, 7.5, dt);
          controls.target.x = THREE.MathUtils.damp(controls.target.x, _targetLook.x, 7.5, dt);
          controls.target.y = THREE.MathUtils.damp(controls.target.y, _targetLook.y, 7.5, dt);
          controls.target.z = THREE.MathUtils.damp(controls.target.z, _targetLook.z, 7.5, dt);

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

  const applyVisualOptions = () => {
    // Tema warna casing
    const finish = CASE_FINISH_COLORS[visualOpts.caseFinish];
    caseChassisMat.color.setHex(finish.chassis);
    caseChassisMat.roughness = finish.roughness;
    caseChassisMat.metalness = finish.metalness;
    caseShroudMat.color.setHex(finish.shroud);

    updateDynamicLighting();
  };

  // Sinkronisasi state React -> 3D Scene + model dinamis sesuai SKU
  const syncSceneVisuals = (state: AssemblyState) => {
    // Deteksi part yang baru saja dipasang untuk memicu animasi drop-in halus
    for (const partId of state.installedParts) {
      if (!prevInstalledSet.has(partId)) {
        installDropProgress.set(partId, 1.0);
      }
    }
    prevInstalledSet = new Set(state.installedParts);

    currentState = state;
    const isBench = state.phase === 'bench';
    benchGroup.visible = isBench;
    caseGroup.visible = !isBench;
    propsGroup.visible = isBench;

    if (state.phase !== lastPhase) {
      lastPhase = state.phase;
      activeCameraPreset = 'isometric';
      computeCameraPresetTargets(state.phase, 'isometric');
      cameraTransitionActive = true;
    }

    // 1. Update label CPU IHS jika SKU CPU berubah
    const cpuInfo = getEffectivePartInfo(state, 'cpu');
    if (cpuInfo.shortCode !== activeCpuCode) {
      activeCpuCode = cpuInfo.shortCode;
      const nextTex = createDynamicCpuIhsTexture(cpuInfo.shortCode, cpuInfo.model, maxAniso);
      dynamicTextures.push(nextTex);
      cpuIhsMat.map = nextTex;
      cpuIhsMat.needsUpdate = true;
    }

    // 2. Update label PSU jika kapasitas PSU berubah
    const psuCap = getPsuCapacityWatts(state);
    if (psuCap !== activePsuCap) {
      activePsuCap = psuCap;
      const psuSku = getPurchasedSku(state, 'psu');
      const tierText = (psuSku?.psuEfficiencyTier ?? '80+ Gold').toUpperCase();
      const accentColor =
        psuCap >= 1000 ? '#38bdf8' : psuCap >= 850 ? '#e2e8f0' : psuCap >= 650 ? '#f59e0b' : '#b45309';
      const nextPsuTex = createDynamicBadgeTexture(
        `${psuCap}W`,
        tierText,
        '#0f172a',
        accentColor,
        '#f8fafc',
        maxAniso,
      );
      dynamicTextures.push(nextPsuTex);
      psuBadgeMat.map = nextPsuTex;
      psuBadgeMat.needsUpdate = true;
    }

    // 3. Pilih varian 3D Pendingin CPU sesuai SKU yang dibeli
    const coolerSkuId = state.purchasedModules.cpu_cooler;
    const coolerVariant: 'stock' | 'tower' | 'dual' | 'aio' =
      coolerSkuId === 'cooler_stock'
        ? 'stock'
        : coolerSkuId === 'cooler_dual_240'
          ? 'dual'
          : coolerSkuId === 'cooler_aio_240'
            ? 'aio'
            : 'tower';
    (['stock', 'tower', 'dual', 'aio'] as const).forEach((key) => {
      benchCoolerVariants[key].group.visible = key === coolerVariant;
      caseCoolerVariants[key].group.visible = key === coolerVariant;
    });

    // 4. Pilih warna heatspreader RAM sesuai kelas SKU
    const ramSku = getPurchasedSku(state, 'ram_a2') ?? getPurchasedSku(state, 'ram_b2');
    if (ramSku?.tier === 'hemat') {
      ramHeatspreaderMat.color.setHex(0x1e293b);
    } else if (ramSku?.tier === 'pro') {
      ramHeatspreaderMat.color.setHex(0xcbd5e1);
    } else {
      ramHeatspreaderMat.color.setHex(0x1d4ed8);
    }

    // 5. Heatsink SSD Pro hanya muncul pada SSD 2 TB / 4 TB
    const ssdSku = getPurchasedSku(state, 'ssd_nvme');
    ssdProHeatsink.visible = (ssdSku?.ssdGb ?? 0) >= 2000;

    // 6. Varian 3D GPU sesuai SKU yang dibeli (Compact / Dual / Flagship Triple-Fan)
    const gpuSkuId = state.purchasedModules.gpu;
    const gpuTier: 'compact' | 'dual' | 'triple' =
      gpuSkuId === 'gpu_4060'
        ? 'compact'
        : gpuSkuId === 'gpu_4070ti' || gpuSkuId === 'gpu_4080s' || gpuSkuId === 'gpu_4090'
          ? 'triple'
          : 'dual';
    (['compact', 'dual', 'triple'] as const).forEach((key) => {
      gpuVariants[key].visible = key === gpuTier;
    });

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

    // Fase 1 visibilitas
    const showCpuPreview = isBench && !cpuInstalled && state.selectedPart === 'cpu';
    cpuGroup.visible = cpuInstalled || showCpuPreview;
    cpuGroup.rotation.y = THREE.MathUtils.degToRad(cpuInstalled ? 0 : -state.cpuRotation);
    pasteMesh.visible = pasteApplied && !coolerInstalled;
    benchCoolerAnchor.visible = coolerInstalled;
    benchRamA2.visible = ramA2Installed;
    benchRamB2.visible = ramB2Installed;
    benchSsdGroup.visible = ssdInstalled;

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
          ? 'Dudukan Pendingin CPU — Pasang Pendingin'
          : 'Pendingin CPU Terpasang';
    benchCpuZoneHit.userData.action = {
      type: 'slot',
      slotId: activeCpuSlot,
      label: activeCpuLabel,
    };
    benchLatchHit.visible = !coolerInstalled;

    // Fase 2 visibilitas
    psuGroup.visible = psuInstalled;
    psuSwitchMat.color.setHex(state.psuSwitchOn ? 0x22c55e : 0x475569);
    psuSwitchMat.emissive.setHex(state.psuSwitchOn ? 0x16a34a : 0x000000);
    psuSwitchMat.emissiveIntensity = state.psuSwitchOn ? 0.95 : 0;
    psuSwitchMesh.rotation.x = state.psuSwitchOn ? -0.22 : 0.22;

    caseMoboGroup.visible = moboInstalled;
    aioRadiatorGroup.visible = moboInstalled && coolerVariant === 'aio';
    caseGpuGroup.visible = gpuInstalled;
    cable24Mesh.visible = cable24Installed;
    cable8CpuMesh.visible = cable8CpuInstalled;
    cable8GpuMesh.visible = cable8GpuInstalled;

    caseHeader24Mat.color.setHex(cable24Installed ? 0x2563eb : 0x334155);
    caseHeader8CpuMat.color.setHex(cable8CpuInstalled ? 0x10b981 : 0x334155);
    gpuPort8PinMat.color.setHex(cable8GpuInstalled ? 0xd97706 : 0xf59e0b);

    powerBtnMat.color.setHex(state.fansSpinning ? 0x10b981 : 0x3b82f6);
    powerBtnMat.emissive.setHex(state.fansSpinning ? 0x059669 : 0x1d4ed8);

    casePsuHit.userData.action = psuInstalled
      ? {
          type: 'psu_switch',
          label: `Sakelar PSU ${psuCap} W (${state.psuSwitchOn ? 'ON' : 'OFF'}) — Klik untuk mengubah`,
        }
      : { type: 'slot', slotId: 'psu_bay', label: `Ruang PSU ATX (${psuCap} W)` };
    caseMoboHit.visible = !moboInstalled;
    caseGpuHit.visible = moboInstalled && !gpuInstalled;
    case24Hit.visible = moboInstalled;
    case8CpuHit.visible = moboInstalled;
    case8GpuHit.visible = gpuInstalled;

    // EZ-Debug POST LED 3D
    (['CPU', 'DRAM', 'VGA', 'BOOT'] as PostLedKey[]).forEach((ledKey) => {
      const mat = postLedMaterials.get(ledKey);
      if (!mat) return;
      const isFault =
        state.postResult && !state.postResult.passed && state.postResult.faultLed === ledKey;
      const isPass = state.postResult?.passed;
      if (isFault) {
        mat.color.setHex(0xef4444);
        mat.emissive.setHex(0xdc2626);
        mat.emissiveIntensity = 1.5;
      } else if (isPass) {
        mat.color.setHex(0x10b981);
        mat.emissive.setHex(0x059669);
        mat.emissiveIntensity = 1.2;
      } else {
        mat.color.setHex(0x334155);
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      }
    });

    // Update highlight frame hint / hover / error / Part Rusak
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

    applyVisualOptions();
    requestRender();
  };

  // =========================================================================
  // RAYCASTING INTERAKSI
  // =========================================================================
  const raycaster = new THREE.Raycaster();
  raycaster.layers.set(1);

  const pickHitTarget = (
    clientX: number,
    clientY: number,
  ): { key: string; action: HitTargetAction } | null => {
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
    if (Math.hypot(dx, dy) > 6) return;

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

  if (!isSoftwareGl) {
    renderer.compile(scene, camera);
  }
  syncSceneVisuals(initialState);

  return {
    syncState: (nextState: AssemblyState) => {
      syncSceneVisuals(nextState);
    },
    setVisualOptions: (nextOptions: SceneVisualOptions) => {
      visualOpts = { ...nextOptions };
      applyVisualOptions();
      requestRender();
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
      window.clearTimeout(paceTimerId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      controls.dispose();
      envTex.dispose();
      disposeProceduralTexturePack(texPack);
      dynamicTextures.forEach((t) => t.dispose());
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
