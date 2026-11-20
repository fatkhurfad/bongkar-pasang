/* Mesin manajemen suara Web Audio API multi-kanal dengan profil akustik unik untuk setiap komponen PC */

import {
  computeEffectiveGain,
  type SoundEvent,
  type SoundSettings,
} from './soundSettings';

export type { SoundEvent, SoundSettings } from './soundSettings';

class PcSoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private fanSource: AudioBufferSourceNode | null = null;
  private fanHumOsc: OscillatorNode | null = null;
  private fanActive = false;

  private ensureGraph(settings: SoundSettings): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;

    if (!this.ctx) {
      this.ctx = new Ctx();
      this.masterGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.ambientGain = this.ctx.createGain();

      this.sfxGain.connect(this.masterGain);
      this.ambientGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      // Alokasi buffer white noise sekali pakai ulang untuk efek desis, gesekan, dan aliran udara kipas
      const sampleRate = this.ctx.sampleRate;
      const length = sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buffer;
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    this.applySettings(settings);
    return this.ctx;
  }

  public applySettings(settings: SoundSettings): void {
    if (!this.ctx || !this.masterGain || !this.sfxGain || !this.ambientGain) return;
    const now = this.ctx.currentTime;
    const master = settings.muted ? 0 : Math.max(0, Math.min(1, settings.masterVolume / 100));
    const sfx = Math.max(0, Math.min(1, settings.sfxVolume / 100));
    const ambient = Math.max(0, Math.min(1, settings.ambientVolume / 100));

    this.masterGain.gain.setTargetAtTime(master, now, 0.015);
    this.sfxGain.gain.setTargetAtTime(sfx, now, 0.015);
    this.ambientGain.gain.setTargetAtTime(this.fanActive ? ambient * 0.14 : 0, now, 0.06);
  }

  private jitter(base: number, spread = 0.045): number {
    return base * (1 + (Math.random() * 2 - 1) * spread);
  }

  private playOsc(
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    delay = 0,
    attack = 0.005,
  ): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(30, freqStart), now);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnd), now + duration);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + Math.min(attack, duration * 0.4));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  private playFilteredNoise(
    filterType: BiquadFilterType,
    freqStart: number,
    freqEnd: number,
    q: number,
    duration: number,
    volume: number,
    delay = 0,
    attack = 0.008,
  ): void {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.Q.setValueAtTime(q, now);
    filter.frequency.setValueAtTime(Math.max(60, freqStart), now);
    if (freqEnd !== freqStart) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(60, freqEnd), now + duration);
    }

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + Math.min(attack, duration * 0.4));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    src.start(now, Math.random() * 0.8);
    src.stop(now + duration + 0.02);
  }

  public play(event: SoundEvent, settings: SoundSettings): void {
    if (computeEffectiveGain(settings.masterVolume, settings.sfxVolume, settings.muted) <= 0) {
      return;
    }
    const ctx = this.ensureGraph(settings);
    if (!ctx) return;

    switch (event) {
      case 'select':
        // Sentuhan halus saat mengangkat komponen dari baki
        this.playOsc(this.jitter(640), 760, 0.032, 'sine', 0.06);
        this.playFilteredNoise('highpass', 3200, 2600, 1.2, 0.022, 0.03);
        break;

      case 'rotate':
        // Detik presisi memutar orientasi CPU 90 derajat
        this.playOsc(this.jitter(520), 690, 0.045, 'triangle', 0.08);
        this.playFilteredNoise('bandpass', 2400, 3000, 3.0, 0.03, 0.05);
        break;

      case 'latch_open':
        // Lepasan pegas logam tuas LGA1700 ke atas
        this.playFilteredNoise('bandpass', 1800, 3600, 3.5, 0.055, 0.14);
        this.playOsc(this.jitter(420), 780, 0.055, 'triangle', 0.12);
        this.playOsc(this.jitter(1420), 1180, 0.04, 'square', 0.045, 0.025);
        break;

      case 'latch_close':
        // Tekanan pegas logam berat mengunci CPU pada soket
        this.playFilteredNoise('bandpass', 2800, 1100, 2.5, 0.06, 0.16);
        this.playOsc(this.jitter(720), 280, 0.075, 'triangle', 0.15);
        this.playOsc(this.jitter(1240), 860, 0.045, 'square', 0.055, 0.04);
        break;

      case 'psu_switch_on':
        // Sakelar rocker AC PSU klik mantap menyala (I)
        this.playFilteredNoise('bandpass', 2200, 4200, 2.2, 0.035, 0.22);
        this.playOsc(this.jitter(360), 620, 0.045, 'square', 0.08);
        this.playOsc(this.jitter(1150), 920, 0.03, 'triangle', 0.11, 0.015);
        break;

      case 'psu_switch_off':
        // Sakelar rocker AC PSU klik lebih rendah saat mati (O)
        this.playFilteredNoise('bandpass', 1600, 900, 2.0, 0.038, 0.18);
        this.playOsc(this.jitter(460), 220, 0.05, 'triangle', 0.11);
        break;

      case 'install_cpu':
        // Dudukan halus & presisi chip keramik di atas pin emas LGA1700
        this.playFilteredNoise('highpass', 3800, 2400, 1.5, 0.035, 0.09);
        this.playOsc(this.jitter(1480), 980, 0.05, 'sine', 0.11);
        this.playOsc(this.jitter(2240), 1860, 0.045, 'triangle', 0.06, 0.028);
        break;

      case 'install_thermal_paste':
        // Tekanan kental lembut suntikan pasta termal di tengah IHS
        this.playFilteredNoise('lowpass', 950, 320, 4.2, 0.16, 0.22, 0, 0.025);
        this.playOsc(this.jitter(290), 155, 0.14, 'sine', 0.1, 0.01, 0.02);
        break;

      case 'install_cpu_cooler':
        // Bunyi 'desis' kontak heatsink + pasta termal diikuti dua klik baut braket logam
        this.playFilteredNoise('bandpass', 4600, 1900, 1.8, 0.24, 0.22, 0, 0.035);
        this.playFilteredNoise('highpass', 5400, 3200, 1.2, 0.18, 0.1, 0.02, 0.02);
        this.playOsc(this.jitter(210), 140, 0.12, 'sine', 0.11, 0.04);
        // Dua klik baut braket mengencang
        this.playFilteredNoise('bandpass', 3200, 2400, 4.0, 0.028, 0.16, 0.19);
        this.playOsc(this.jitter(1120), 760, 0.035, 'triangle', 0.1, 0.19);
        this.playFilteredNoise('bandpass', 3500, 2700, 4.0, 0.028, 0.17, 0.26);
        this.playOsc(this.jitter(1280), 880, 0.035, 'triangle', 0.11, 0.26);
        break;

      case 'install_ram':
        // Bunyi 'klik' halus ganda khas pengait plastik slot DIMM DDR5
        this.playFilteredNoise('bandpass', 4200, 2800, 4.5, 0.026, 0.15, 0);
        this.playOsc(this.jitter(1680), 1240, 0.032, 'triangle', 0.1, 0);
        // Klik halus kedua 55ms kemudian (pengait sisi berlawanan mengunci)
        this.playFilteredNoise('bandpass', 4800, 3100, 4.8, 0.028, 0.17, 0.055);
        this.playOsc(this.jitter(1920), 1460, 0.035, 'triangle', 0.11, 0.055);
        break;

      case 'install_ssd_nvme':
        // Gesekan lembut konektor emas M-Key + klik baut mikro standoff
        this.playFilteredNoise('bandpass', 2600, 3900, 2.6, 0.075, 0.1, 0);
        this.playOsc(this.jitter(920), 1320, 0.04, 'sine', 0.07, 0.02);
        this.playFilteredNoise('highpass', 4200, 3000, 3.2, 0.024, 0.15, 0.09);
        this.playOsc(this.jitter(2150), 1650, 0.03, 'triangle', 0.09, 0.09);
        break;

      case 'install_psu':
        // Hentakan berat & mantap bodi PSU baja ke shroud bawah casing
        this.playOsc(this.jitter(135), 54, 0.18, 'sine', 0.28, 0);
        this.playOsc(this.jitter(240), 110, 0.12, 'triangle', 0.14, 0.01);
        this.playFilteredNoise('lowpass', 650, 220, 1.5, 0.14, 0.22, 0);
        this.playFilteredNoise('bandpass', 1800, 1200, 3.0, 0.04, 0.12, 0.08);
        break;

      case 'install_motherboard':
        // Dudukan papan PCB besar pada 9 standoff kuningan casing
        this.playOsc(this.jitter(210), 115, 0.12, 'triangle', 0.16, 0);
        this.playFilteredNoise('bandpass', 1100, 720, 2.0, 0.08, 0.14, 0);
        this.playOsc(this.jitter(1560), 1180, 0.035, 'sine', 0.08, 0.07);
        this.playOsc(this.jitter(1720), 1320, 0.035, 'sine', 0.08, 0.125);
        break;

      case 'install_gpu':
        // Dorongan bodi GPU solid diikuti klik kokoh kait pengunci PCIe x16
        this.playFilteredNoise('bandpass', 1200, 2100, 1.8, 0.09, 0.16, 0);
        this.playOsc(this.jitter(190), 95, 0.11, 'sine', 0.2, 0.01);
        // Klik pengunci slot PCIe mantap
        this.playFilteredNoise('bandpass', 3000, 1800, 3.6, 0.045, 0.22, 0.095);
        this.playOsc(this.jitter(960), 540, 0.055, 'triangle', 0.16, 0.095);
        this.playOsc(this.jitter(1580), 1120, 0.038, 'square', 0.055, 0.105);
        break;

      case 'install_cable_24pin':
        // Colokan konektor 24-pin padat + pengunci klip plastik besar
        this.playFilteredNoise('bandpass', 1400, 900, 2.0, 0.065, 0.18, 0);
        this.playOsc(this.jitter(310), 175, 0.075, 'triangle', 0.16, 0);
        this.playFilteredNoise('bandpass', 3400, 2200, 3.8, 0.032, 0.2, 0.06);
        this.playOsc(this.jitter(1320), 920, 0.035, 'triangle', 0.12, 0.06);
        break;

      case 'install_cable_8pin_cpu':
        // Klik klip konektor daya EPS 8-pin CPU (sedikit lebih cerah)
        this.playFilteredNoise('bandpass', 2800, 1900, 3.4, 0.035, 0.16, 0);
        this.playOsc(this.jitter(1180), 820, 0.04, 'triangle', 0.12, 0);
        this.playOsc(this.jitter(1640), 1290, 0.028, 'sine', 0.08, 0.025);
        break;

      case 'install_cable_8pin_gpu':
        // Klik klip konektor daya PCIe 6+2 pin GPU (sedikit lebih tebal)
        this.playFilteredNoise('bandpass', 2400, 1500, 3.0, 0.04, 0.17, 0);
        this.playOsc(this.jitter(980), 660, 0.045, 'triangle', 0.13, 0);
        this.playOsc(this.jitter(1420), 1080, 0.03, 'sine', 0.085, 0.028);
        break;

      case 'error':
        // Umpan balik lembut saat salah slot atau prasyarat belum terpenuhi
        this.playOsc(225, 165, 0.14, 'sawtooth', 0.09, 0);
        this.playOsc(180, 140, 0.15, 'sawtooth', 0.075, 0.085);
        break;

      case 'part_damaged':
        // Suara percikan statis ESD / pin bengkok untuk status Part Rusak
        this.playFilteredNoise('highpass', 3400, 1200, 2.2, 0.14, 0.24, 0, 0.003);
        this.playFilteredNoise('bandpass', 1800, 620, 3.8, 0.19, 0.22, 0.04, 0.004);
        this.playOsc(195, 78, 0.22, 'sawtooth', 0.14, 0);
        this.playOsc(140, 62, 0.24, 'square', 0.09, 0.09);
        break;

      case 'part_repaired':
        // Bunyi segar penggantian unit cadangan baru (RMA)
        this.playFilteredNoise('bandpass', 2400, 3600, 2.5, 0.04, 0.1, 0);
        this.playOsc(587.33, 587.33, 0.09, 'triangle', 0.11, 0);
        this.playOsc(880, 880, 0.14, 'sine', 0.11, 0.075);
        break;

      case 'post_tick':
        // Detik halus log pemeriksaan BIOS POST
        this.playOsc(this.jitter(1420, 0.03), 1240, 0.022, 'square', 0.025, 0, 0.002);
        break;

      case 'post_fail':
        // Pola beep diagnostik BIOS gagal (2 pendek + 1 rendah)
        this.playOsc(760, 760, 0.11, 'square', 0.08, 0);
        this.playOsc(760, 760, 0.11, 'square', 0.08, 0.17);
        this.playOsc(510, 470, 0.24, 'square', 0.08, 0.34);
        break;

      case 'post_ok':
        // 1 Beep POST tunggal autentik diikuti akor keberhasilan hangat
        this.playOsc(990, 990, 0.11, 'square', 0.08, 0);
        this.playOsc(523.25, 523.25, 0.16, 'triangle', 0.12, 0.22);
        this.playOsc(659.25, 659.25, 0.16, 'triangle', 0.12, 0.34);
        this.playOsc(783.99, 783.99, 0.26, 'triangle', 0.13, 0.46);
        this.playOsc(1046.5, 1046.5, 0.32, 'sine', 0.09, 0.56);
        break;
    }
  }

  public setAmbientFanRunning(running: boolean, settings: SoundSettings): void {
    this.fanActive = running;

    if (!running) {
      if (this.ctx && this.ambientGain) {
        this.ambientGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
      }
      if (this.fanSource) {
        try {
          this.fanSource.stop();
          this.fanSource.disconnect();
        } catch {
          // Abaikan jika sudah berhenti
        }
        this.fanSource = null;
      }
      if (this.fanHumOsc) {
        try {
          this.fanHumOsc.stop();
          this.fanHumOsc.disconnect();
        } catch {
          // Abaikan jika sudah berhenti
        }
        this.fanHumOsc = null;
      }
      return;
    }

    if (computeEffectiveGain(settings.masterVolume, settings.ambientVolume, settings.muted) <= 0) {
      return;
    }

    const ctx = this.ensureGraph(settings);
    if (!ctx || !this.ambientGain || !this.noiseBuffer) return;

    if (!this.fanSource) {
      const now = ctx.currentTime;
      // Aliran udara kipas PWM lembut (noise terfilter bandpass rendah)
      const airSrc = ctx.createBufferSource();
      airSrc.buffer = this.noiseBuffer;
      airSrc.loop = true;

      const airFilter = ctx.createBiquadFilter();
      airFilter.type = 'bandpass';
      airFilter.frequency.setValueAtTime(340, now);
      airFilter.Q.setValueAtTime(1.1, now);

      airSrc.connect(airFilter);
      airFilter.connect(this.ambientGain);
      airSrc.start(now);
      this.fanSource = airSrc;

      // Dengung halus motor kipas 1150 RPM
      const motorOsc = ctx.createOscillator();
      const motorGain = ctx.createGain();
      motorOsc.type = 'sine';
      motorOsc.frequency.setValueAtTime(92, now);
      motorGain.gain.setValueAtTime(0.28, now);
      motorOsc.connect(motorGain);
      motorGain.connect(this.ambientGain);
      motorOsc.start(now);
      this.fanHumOsc = motorOsc;
    }

    this.applySettings(settings);
  }
}

export const soundManager = new PcSoundManager();

export function playSoundFx(event: SoundEvent, settings: SoundSettings): void {
  soundManager.play(event, settings);
}

export function updateSoundSettings(settings: SoundSettings): void {
  soundManager.applySettings(settings);
}

export function setAmbientFanRunning(running: boolean, settings: SoundSettings): void {
  soundManager.setAmbientFanRunning(running, settings);
}
