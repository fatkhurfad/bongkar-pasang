/* Ilustrasi vektor SVG miniatur yang realistis untuk setiap komponen perangkat keras PC */

import type { PartId } from '../config';

interface PartThumbnailProps {
  partId: PartId;
  rotation?: number;
  className?: string;
}

export function PartThumbnail({ partId, rotation = 0, className = 'w-12 h-12' }: PartThumbnailProps) {
  switch (partId) {
    case 'cpu':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
          <g transform={`rotate(${rotation} 32 32)`}>
            {/* Substrat PCB hijau tua */}
            <rect x="10" y="10" width="44" height="44" rx="4" fill="#14532d" stroke="#0f172a" strokeWidth="2" />
            {/* Pelat logam IHS perak */}
            <rect x="16" y="16" width="32" height="32" rx="3" fill="#cbd5e1" stroke="#475569" strokeWidth="1.5" />
            <rect x="20" y="20" width="24" height="24" rx="2" fill="#e2e8f0" />
            {/* Label kecil IHS */}
            <text x="32" y="34" textAnchor="middle" fontSize="7" fontWeight="700" fill="#334155" fontFamily="monospace">
              i5-14K
            </text>
            {/* Segitiga emas Pin 1 di pojok kiri bawah saat 0 derajat */}
            <polygon points="12,52 21,52 12,43" fill="#f59e0b" stroke="#78350f" strokeWidth="1" />
            {/* Takik penyelarasan samping */}
            <rect x="8" y="29" width="4" height="6" rx="1" fill="#f8fafc" />
            <rect x="52" y="29" width="4" height="6" rx="1" fill="#f8fafc" />
          </g>
        </svg>
      );

    case 'thermal_paste':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
          {/* Suntikan pasta termal */}
          <g transform="rotate(-35 32 32)">
            <rect x="18" y="24" width="24" height="14" rx="2" fill="#e2e8f0" stroke="#334155" strokeWidth="2" />
            <rect x="24" y="26" width="14" height="10" fill="#64748b" />
            <rect x="8" y="28" width="10" height="6" rx="1" fill="#94a3b8" stroke="#334155" strokeWidth="1.5" />
            <rect x="4" y="24" width="4" height="14" rx="1" fill="#1d4ed8" />
            <polygon points="42,27 54,30 54,32 42,35" fill="#475569" stroke="#1e293b" strokeWidth="1.5" />
            <circle cx="57" cy="31" r="2.5" fill="#64748b" />
          </g>
        </svg>
      );

    case 'cpu_cooler':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
          {/* Blok sirip aluminium + kipas 120mm */}
          <rect x="10" y="10" width="44" height="44" rx="6" fill="#1e293b" stroke="#0f172a" strokeWidth="2" />
          <circle cx="32" cy="32" r="17" fill="#334155" stroke="#64748b" strokeWidth="1.5" />
          {/* Bilah kipas */}
          <path d="M32 32 L32 17 A15 15 0 0 1 45 25 Z" fill="#94a3b8" />
          <path d="M32 32 L46 37 A15 15 0 0 1 35 47 Z" fill="#94a3b8" />
          <path d="M32 32 L21 43 A15 15 0 0 1 18 28 Z" fill="#94a3b8" />
          <circle cx="32" cy="32" r="5" fill="#0f172a" stroke="#cbd5e1" strokeWidth="1.5" />
          {/* Ujung heatpipe tembaga */}
          <circle cx="16" cy="15" r="2" fill="#d97706" />
          <circle cx="48" cy="15" r="2" fill="#d97706" />
          <circle cx="16" cy="49" r="2" fill="#d97706" />
          <circle cx="48" cy="49" r="2" fill="#d97706" />
        </svg>
      );

    case 'ram_a2':
    case 'ram_b2':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
          {/* Modul RAM DDR5 dengan heatsink gelap & pin emas */}
          <rect x="6" y="20" width="52" height="20" rx="2" fill="#1e293b" stroke="#0f172a" strokeWidth="2" />
          <rect x="10" y="23" width="44" height="6" rx="1" fill="#334155" />
          <rect x="10" y="31" width="14" height="4" rx="1" fill="#2563eb" />
          <text x="41" y="35" textAnchor="middle" fontSize="6" fontWeight="700" fill="#e2e8f0" fontFamily="monospace">
            DDR5
          </text>
          {/* Pin kontak emas dengan lekukan kunci */}
          <rect x="9" y="40" width="21" height="4" fill="#eab308" />
          <rect x="33" y="40" width="22" height="4" fill="#eab308" />
        </svg>
      );

    case 'ssd_nvme':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
          {/* Papan M.2 2280 */}
          <rect x="8" y="23" width="48" height="18" rx="2" fill="#0f172a" stroke="#334155" strokeWidth="2" />
          {/* Konektor emas M-key */}
          <rect x="6" y="26" width="5" height="12" fill="#eab308" />
          {/* Chip pengontrol & NAND */}
          <rect x="16" y="27" width="9" height="10" rx="1" fill="#475569" />
          <rect x="28" y="26" width="12" height="12" rx="1" fill="#1d4ed8" />
          <rect x="43" y="27" width="8" height="10" rx="1" fill="#334155" />
          {/* Cekungan baut kanan */}
          <circle cx="55" cy="32" r="2.5" fill="#f8fafc" />
        </svg>
      );

    case 'psu':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
          <rect x="8" y="16" width="48" height="32" rx="3" fill="#1e293b" stroke="#0f172a" strokeWidth="2" />
          {/* Kisi kipas PSU */}
          <circle cx="24" cy="32" r="10" fill="#0f172a" stroke="#64748b" strokeWidth="1.5" />
          <circle cx="24" cy="32" r="6" fill="none" stroke="#475569" strokeWidth="1" />
          <circle cx="24" cy="32" r="2.5" fill="#94a3b8" />
          {/* Label kapasitas */}
          <rect x="38" y="22" width="14" height="10" rx="1.5" fill="#f59e0b" />
          <text x="45" y="29" textAnchor="middle" fontSize="6" fontWeight="700" fill="#0f172a" fontFamily="monospace">
            650W
          </text>
          {/* Sakelar kecil */}
          <rect x="40" y="36" width="10" height="6" rx="1" fill="#334155" stroke="#94a3b8" strokeWidth="1" />
        </svg>
      );

    case 'motherboard':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
          <rect x="11" y="8" width="42" height="48" rx="3" fill="#1e293b" stroke="#0f172a" strokeWidth="2" />
          {/* Rear I/O */}
          <rect x="13" y="10" width="7" height="18" rx="1" fill="#94a3b8" />
          {/* Pendingin terpasang */}
          <rect x="23" y="14" width="14" height="14" rx="2" fill="#334155" stroke="#cbd5e1" strokeWidth="1.2" />
          {/* RAM terpasang */}
          <rect x="41" y="13" width="3" height="16" fill="#2563eb" />
          <rect x="46" y="13" width="3" height="16" fill="#2563eb" />
          {/* Slot PCIe */}
          <rect x="18" y="36" width="24" height="4" rx="1" fill="#cbd5e1" />
          <rect x="18" y="44" width="18" height="3" rx="1" fill="#475569" />
          {/* Heatsink chipset */}
          <rect x="40" y="42" width="9" height="9" rx="1.5" fill="#475569" />
        </svg>
      );

    case 'gpu':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
          <rect x="6" y="18" width="52" height="24" rx="3" fill="#1e293b" stroke="#0f172a" strokeWidth="2" />
          {/* Dua kipas GPU */}
          <circle cx="22" cy="30" r="8" fill="#0f172a" stroke="#64748b" strokeWidth="1.5" />
          <circle cx="42" cy="30" r="8" fill="#0f172a" stroke="#64748b" strokeWidth="1.5" />
          <circle cx="22" cy="30" r="2.5" fill="#94a3b8" />
          <circle cx="42" cy="30" r="2.5" fill="#94a3b8" />
          {/* Braket belakang kiri */}
          <rect x="4" y="15" width="3" height="31" rx="1" fill="#94a3b8" />
          {/* Konektor PCIe emas */}
          <rect x="14" y="42" width="28" height="4" fill="#eab308" />
        </svg>
      );

    case 'cable_24pin':
    case 'cable_8pin_cpu':
    case 'cable_8pin_gpu': {
      const accent =
        partId === 'cable_24pin' ? '#2563eb' : partId === 'cable_8pin_cpu' ? '#059669' : '#d97706';
      const label = partId === 'cable_24pin' ? '24P' : partId === 'cable_8pin_cpu' ? 'CPU' : 'GPU';
      return (
        <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
          {/* Jalur kabel anyaman */}
          <path d="M12 52 C14 34, 24 28, 34 26" fill="none" stroke="#1e293b" strokeWidth="6" strokeLinecap="round" />
          <path d="M18 52 C20 38, 28 32, 36 30" fill="none" stroke="#334155" strokeWidth="4" strokeLinecap="round" />
          {/* Kepala konektor */}
          <rect x="31" y="16" width="22" height="20" rx="3" fill="#0f172a" stroke={accent} strokeWidth="2" />
          <text x="42" y="29" textAnchor="middle" fontSize="7" fontWeight="700" fill="#f8fafc" fontFamily="monospace">
            {label}
          </text>
        </svg>
      );
    }
  }
}
