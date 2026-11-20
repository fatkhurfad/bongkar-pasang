/* Generator log terminal BIOS POST dan status LED diagnostik bertahap untuk simulasi nyala komputer */

import { BUILD_PRESETS, PSU_CAPACITY_WATTS } from '../config';
import type { AssemblyState, PostDiagnosticResult, PostLedKey } from './assemblyEngine';
import { getTotalWattage } from './assemblyEngine';

export type PostStage = 'POWER' | 'CPU' | 'DRAM' | 'VGA' | 'BOOT' | 'BIOS';

export type PostLineStatus = 'info' | 'ok' | 'fail';

export interface PostLogLine {
  id: string;
  stage: PostStage;
  tag: string;
  text: string;
  resultLabel?: string;
  status: PostLineStatus;
  delayMs: number;
}

export type LedVisualState = 'off' | 'checking' | 'ok' | 'fail';

export function buildPostLogSequence(
  state: AssemblyState,
  result: PostDiagnosticResult,
): PostLogLine[] {
  const preset = BUILD_PRESETS[state.buildPreset];
  const watts = getTotalWattage(state);

  const lines: PostLogLine[] = [
    {
      id: 'header',
      stage: 'POWER',
      tag: 'UEFI',
      text: 'RakitPC Lab UEFI Firmware Rev. 2.4 — Power-On Self-Test',
      status: 'info',
      delayMs: 110,
    },
  ];

  // Kasus 1: Tidak ada daya (PSU belum dipasang / OFF / kabel 24-Pin belum colok)
  if (!result.passed && result.faultLed === null) {
    lines.push(
      {
        id: 'pwr_check',
        stage: 'POWER',
        tag: 'PWR ',
        text: `Memeriksa tegangan siaga 5VSB dari PSU ${PSU_CAPACITY_WATTS} W...`,
        status: 'info',
        delayMs: 200,
      },
      {
        id: 'pwr_fail',
        stage: 'POWER',
        tag: 'HALT',
        text: `${result.headline} (${result.beepCode})`,
        resultLabel: 'FAIL',
        status: 'fail',
        delayMs: 220,
      },
    );
    return lines;
  }

  // Daya utama aktif
  lines.push({
    id: 'pwr_ok',
    stage: 'POWER',
    tag: 'PWR ',
    text: `Power Good (PG) +12.02V / +5.01V / +3.32V · Beban ${watts} W`,
    resultLabel: 'OK',
    status: 'ok',
    delayMs: 150,
  });

  // Kasus 2: Gagal di tahap CPU (misal kabel EPS 8-Pin CPU belum colok)
  if (!result.passed && result.faultLed === 'CPU') {
    lines.push(
      {
        id: 'cpu_init',
        stage: 'CPU',
        tag: 'CPU ',
        text: `Menginisialisasi ${preset.cpuModel} pada soket LGA1700...`,
        status: 'info',
        delayMs: 190,
      },
      {
        id: 'cpu_fail',
        stage: 'CPU',
        tag: 'HALT',
        text: `EZ-Debug LED [CPU] MERAH — ${result.explanation}`,
        resultLabel: 'FAIL',
        status: 'fail',
        delayMs: 220,
      },
    );
    return lines;
  }

  // CPU lulus
  lines.push({
    id: 'cpu_ok',
    stage: 'CPU',
    tag: 'CPU ',
    text: `${preset.cpuModel} (LGA1700) · Suhu Idle ${preset.idleTempC}°C · PWM 1150 RPM`,
    resultLabel: 'OK',
    status: 'ok',
    delayMs: 160,
  });

  // Kasus 2b: Gagal di tahap DRAM (misal modul RAM berstatus Part Rusak)
  if (!result.passed && result.faultLed === 'DRAM') {
    lines.push(
      {
        id: 'dram_scan',
        stage: 'DRAM',
        tag: 'DRAM',
        text: 'Memindai modul memori DDR5 pada jalur Dual-Channel (A2 + B2)...',
        status: 'info',
        delayMs: 185,
      },
      {
        id: 'dram_fail',
        stage: 'DRAM',
        tag: 'HALT',
        text: `EZ-Debug LED [DRAM] MERAH — ${result.explanation}`,
        resultLabel: 'FAIL',
        status: 'fail',
        delayMs: 220,
      },
    );
    return lines;
  }

  // RAM lulus
  lines.push({
    id: 'dram_ok',
    stage: 'DRAM',
    tag: 'DRAM',
    text: '32768 MB DDR5-5600 Dual-Channel (DIMM_A2 + DIMM_B2)',
    resultLabel: 'OK',
    status: 'ok',
    delayMs: 165,
  });

  // Kasus 3: Gagal di tahap VGA (GPU belum dipasang, kabel 8-Pin GPU belum colok, atau GPU rusak)
  if (!result.passed && result.faultLed === 'VGA') {
    lines.push(
      {
        id: 'vga_scan',
        stage: 'VGA',
        tag: 'VGA ',
        text: 'Memindai jalur grafis PCIe 4.0 x16 & daya tambahan 8-Pin...',
        status: 'info',
        delayMs: 190,
      },
      {
        id: 'vga_fail',
        stage: 'VGA',
        tag: 'HALT',
        text: `EZ-Debug LED [VGA] — ${result.explanation}`,
        resultLabel: 'FAIL',
        status: 'fail',
        delayMs: 220,
      },
    );
    return lines;
  }

  // Kasus 3b: Gagal di tahap BOOT (misal SSD NVMe rusak)
  if (!result.passed && result.faultLed === 'BOOT') {
    lines.push(
      {
        id: 'vga_ok_preboot',
        stage: 'VGA',
        tag: 'VGA ',
        text: `PCIe 4.0 x16 · ${preset.gpuModel} · VBIOS Verified`,
        resultLabel: 'OK',
        status: 'ok',
        delayMs: 155,
      },
      {
        id: 'boot_fail',
        stage: 'BOOT',
        tag: 'HALT',
        text: `EZ-Debug LED [BOOT] — ${result.explanation}`,
        resultLabel: 'FAIL',
        status: 'fail',
        delayMs: 220,
      },
    );
    return lines;
  }

  // Kasus 4: Seluruh uji POST lulus sempurna
  lines.push(
    {
      id: 'vga_ok',
      stage: 'VGA',
      tag: 'VGA ',
      text: `PCIe 4.0 x16 · ${preset.gpuModel} · VBIOS Verified`,
      resultLabel: 'OK',
      status: 'ok',
      delayMs: 165,
    },
    {
      id: 'boot_ok',
      stage: 'BOOT',
      tag: 'NVMe',
      text: 'M.2_1 PCIe Gen4 x4 · 1000 GB NVMe SSD Terdeteksi',
      resultLabel: 'OK',
      status: 'ok',
      delayMs: 160,
    },
    {
      id: 'post_beep',
      stage: 'BIOS',
      tag: 'POST',
      text: '1 Beep Singkat · Semua Perangkat Lulus Power-On Self-Test',
      resultLabel: 'PASS',
      status: 'ok',
      delayMs: 170,
    },
    {
      id: 'bios_enter',
      stage: 'BIOS',
      tag: 'BIOS',
      text: 'Memuat RakitPC UEFI BIOS Summary...',
      status: 'info',
      delayMs: 180,
    },
  );

  return lines;
}

export function getPostLedStates(
  lines: PostLogLine[],
  visibleCount: number,
): Record<PostLedKey, LedVisualState> {
  const leds: Record<PostLedKey, LedVisualState> = {
    CPU: 'off',
    DRAM: 'off',
    VGA: 'off',
    BOOT: 'off',
  };

  const shown = lines.slice(0, Math.max(0, visibleCount));
  for (const line of shown) {
    if (line.stage === 'CPU' || line.stage === 'DRAM' || line.stage === 'VGA' || line.stage === 'BOOT') {
      if (line.status === 'fail') {
        leds[line.stage] = 'fail';
      } else if (line.status === 'ok') {
        leds[line.stage] = 'ok';
      } else if (leds[line.stage] === 'off') {
        leds[line.stage] = 'checking';
      }
    }
  }

  return leds;
}
