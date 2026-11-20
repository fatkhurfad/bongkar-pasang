/* Data komponen perangkat keras, langkah perakitan, dan dialog edukatif BIMO */

export type PartId =
  | 'cpu'
  | 'thermal_paste'
  | 'cpu_cooler'
  | 'ram_a2'
  | 'ram_b2'
  | 'ssd_nvme'
  | 'psu'
  | 'motherboard'
  | 'gpu'
  | 'cable_24pin'
  | 'cable_8pin_cpu'
  | 'cable_8pin_gpu';

export type SlotId =
  | 'socket_cpu'
  | 'cpu_ihs'
  | 'cooler_mount'
  | 'dimm_a2'
  | 'dimm_b2'
  | 'm2_slot'
  | 'psu_bay'
  | 'case_standoffs'
  | 'pcie_x16'
  | 'header_24pin'
  | 'header_8pin_cpu'
  | 'gpu_power_8pin';

export type WorkbenchPhase = 'bench' | 'case';

export type GameMode = 'belajar' | 'mandiri';

export type BuildPresetId = 'efisien' | 'hemat' | 'berat';

export interface BuildPresetSpec {
  id: BuildPresetId;
  label: string;
  shortLabel: string;
  description: string;
  cpuModel: string;
  cpuShortCode: string;
  cpuWattage: number;
  cpuSpecLine: string;
  gpuModel: string;
  gpuShortLabel: string;
  gpuWattage: number;
  gpuSpecLine: string;
  idleTempC: number;
  isPeakEfficient: boolean;
}

export const BUILD_PRESETS: Record<BuildPresetId, BuildPresetSpec> = {
  efisien: {
    id: 'efisien',
    label: 'Paket Efisien (80+ Gold)',
    shortLabel: 'Efisien · 380 W',
    description: 'Beban 58% PSU 650 W — tepat di titik efisiensi puncak.',
    cpuModel: 'Core i5-14600K',
    cpuShortCode: 'i5-14K',
    cpuWattage: 125,
    cpuSpecLine: 'Soket LGA1700 · 14 Core · 125 W',
    gpuModel: 'RTX 4070 Dual 12 GB',
    gpuShortLabel: 'RTX 4070 12GB',
    gpuWattage: 200,
    gpuSpecLine: 'PCIe 4.0 x16 · 200 W',
    idleTempC: 36,
    isPeakEfficient: true,
  },
  hemat: {
    id: 'hemat',
    label: 'Paket Hemat Daya',
    shortLabel: 'Hemat · 230 W',
    description: 'Beban 35% PSU 650 W — irit listrik, kapasitas PSU terlalu longgar.',
    cpuModel: 'Core i3-14100',
    cpuShortCode: 'i3-141',
    cpuWattage: 60,
    cpuSpecLine: 'Soket LGA1700 · 4 Core · 60 W',
    gpuModel: 'RTX 4060 Compact 8 GB',
    gpuShortLabel: 'RTX 4060 8GB',
    gpuWattage: 115,
    gpuSpecLine: 'PCIe 4.0 x16 · 115 W',
    idleTempC: 32,
    isPeakEfficient: false,
  },
  berat: {
    id: 'berat',
    label: 'Paket Beban Tinggi',
    shortLabel: 'Berat · 565 W',
    description: 'Beban 87% PSU 650 W — kencang, tetapi mendekati batas daya PSU.',
    cpuModel: 'Core i7-14700K',
    cpuShortCode: 'i7-14K',
    cpuWattage: 190,
    cpuSpecLine: 'Soket LGA1700 · 20 Core · 190 W',
    gpuModel: 'RTX 4080 Super 16 GB',
    gpuShortLabel: 'RTX 4080 16GB',
    gpuWattage: 320,
    gpuSpecLine: 'PCIe 4.0 x16 · 320 W',
    idleTempC: 42,
    isPeakEfficient: false,
  },
};

export const BUILD_PRESET_LIST: BuildPresetSpec[] = [
  BUILD_PRESETS.efisien,
  BUILD_PRESETS.hemat,
  BUILD_PRESETS.berat,
];

export type RobotMood =
  | 'idle'
  | 'guiding'
  | 'happy'
  | 'warning'
  | 'thinking'
  | 'celebrate';

export interface HardwarePartSpec {
  id: PartId;
  name: string;
  shortName: string;
  category: 'Prosesor' | 'Pendinginan' | 'Memori' | 'Penyimpanan' | 'Daya' | 'Utama' | 'Grafis' | 'Kabel';
  model: string;
  specLine: string;
  wattage: number;
  phase: WorkbenchPhase;
  targetSlot: SlotId;
  needsAlignment?: boolean;
  summary: string;
  eduFunction: string;
  eduSafetyTip: string;
}

export interface AssemblyStepDef {
  id: string;
  stepNumber: number;
  phase: WorkbenchPhase;
  title: string;
  shortTitle: string;
  requiredAction: string;
  bimoPrompt: string;
  whyItMatters: string;
  targetSlotHint?: SlotId;
  targetPartHint?: PartId;
  targetControlHint?: 'cpu_latch' | 'rotate_cpu' | 'psu_switch' | 'power_button';
}

export const STORAGE_KEY = 'rakitpc_lab_best_v1';

export const PSU_CAPACITY_WATTS = 650;

export const HARDWARE_PARTS: HardwarePartSpec[] = [
  {
    id: 'cpu',
    name: 'Prosesor (CPU)',
    shortName: 'CPU Core i5',
    category: 'Prosesor',
    model: 'Core i5-14600K',
    specLine: 'Soket LGA1700 · 14 Core · 125 W',
    wattage: 125,
    phase: 'bench',
    targetSlot: 'socket_cpu',
    needsAlignment: true,
    summary: 'Otak pemrosesan utama komputer untuk mengeksekusi instruksi sistem.',
    eduFunction:
      'CPU menjalankan jutaan perhitungan per detik untuk sistem operasi, aplikasi, dan gim. Soket LGA1700 memiliki 1.700 pin mikro di papan induk.',
    eduSafetyTip:
      'Selalu sejajarkan segitiga emas di sudut kiri bawah CPU dengan tanda soket, lalu jatuhkan perlahan tanpa ditekan paksa.',
  },
  {
    id: 'thermal_paste',
    name: 'Pasta Termal',
    shortName: 'Pasta Termal',
    category: 'Pendinginan',
    model: 'NT-H2 Pro 3,5 g',
    specLine: 'Konduktivitas Tinggi · Non-Konduktif',
    wattage: 0,
    phase: 'bench',
    targetSlot: 'cpu_ihs',
    summary: 'Mengisi celah mikroskopis antara permukaan CPU dan pelat pendingin.',
    eduFunction:
      'Permukaan logam CPU dan heatsink tidak sepenuhnya rata pada skala mikro. Pasta termal mengusir udara agar perpindahan panas optimal.',
    eduSafetyTip:
      'Cukup teteskan seukuran biji kacang polong di tengah tutup logam CPU (IHS). Terlalu banyak bisa meluber ke tepi soket.',
  },
  {
    id: 'cpu_cooler',
    name: 'Pendingin CPU (Air Cooler)',
    shortName: 'Pendingin CPU',
    category: 'Pendinginan',
    model: 'Tower Air 120 PWM',
    specLine: '4 Heatpipe Tembaga · Kipas 120 mm · 5 W',
    wattage: 5,
    phase: 'bench',
    targetSlot: 'cooler_mount',
    summary: 'Menyerap panas dari CPU dan membuangnya melalui sirip aluminium dan kipas.',
    eduFunction:
      'Pipa tembaga (heatpipe) menyalurkan panas CPU ke tumpukan sirip aluminium, lalu kipas PWM mengatur kecepatan putaran sesuai suhu.',
    eduSafetyTip:
      'Pastikan pasta termal sudah dioleskan dan plastik pelindung bawah heatsink sudah dilepas sebelum memasang pendingin.',
  },
  {
    id: 'ram_a2',
    name: 'RAM DDR5 (Modul 1)',
    shortName: 'RAM Slot A2',
    category: 'Memori',
    model: '16 GB DDR5-5600',
    specLine: 'Slot A2 · Dual-Channel · 4 W',
    wattage: 4,
    phase: 'bench',
    targetSlot: 'dimm_a2',
    summary: 'Memori kerja cepat untuk menampung data program yang sedang aktif.',
    eduFunction:
      'RAM jauh lebih cepat dari SSD untuk membaca data aktif. Memasang modul pertama di slot A2 mengikuti jalur sinyal utama motherboard.',
    eduSafetyTip:
      'Cocokkan lekukan kunci (notch) di bagian bawah keping RAM dengan tonjolan slot DIMM sebelum menekan hingga berbunyi klik.',
  },
  {
    id: 'ram_b2',
    name: 'RAM DDR5 (Modul 2)',
    shortName: 'RAM Slot B2',
    category: 'Memori',
    model: '16 GB DDR5-5600',
    specLine: 'Slot B2 · Dual-Channel · 4 W',
    wattage: 4,
    phase: 'bench',
    targetSlot: 'dimm_b2',
    summary: 'Modul RAM kedua untuk mengaktifkan mode Dual-Channel 32 GB.',
    eduFunction:
      'Memasang dua keping RAM pada slot A2 dan B2 menggandakan jalur lebar pita memori (Dual-Channel) dibanding memasangnya bersebelahan.',
    eduSafetyTip:
      'Tekan kedua ujung modul secara merata hingga pengait plastik atas dan bawah mengunci otomatis.',
  },
  {
    id: 'ssd_nvme',
    name: 'SSD NVMe M.2',
    shortName: 'SSD NVMe 1 TB',
    category: 'Penyimpanan',
    model: 'Gen4 NVMe 1 TB',
    specLine: 'M.2 2280 · PCIe 4.0 x4 · 7 W',
    wattage: 7,
    phase: 'bench',
    targetSlot: 'm2_slot',
    summary: 'Penyimpanan permanen berkecepatan tinggi untuk sistem operasi dan berkas.',
    eduFunction:
      'SSD NVMe terhubung langsung ke jalur PCIe motherboard tanpa kabel SATA, membuat waktu nyala sistem hanya beberapa detik.',
    eduSafetyTip:
      'Masukkan keping M.2 pada sudut miring tipis, lalu turunkan perlahan dan kencangkan baut penahan agar tidak melengkung.',
  },
  {
    id: 'psu',
    name: 'Power Supply (PSU)',
    shortName: 'PSU 650 W',
    category: 'Daya',
    model: '650 W 80+ Gold Modular',
    specLine: 'ATX · 650 W · Efisiensi 90%',
    wattage: 0,
    phase: 'case',
    targetSlot: 'psu_bay',
    summary: 'Mengubah listrik AC dari stopkontak menjadi tegangan DC stabil untuk PC.',
    eduFunction:
      'PSU menyuplai jalur tegangan +12V, +5V, dan +3,3V yang presisi ke motherboard, prosesor, dan kartu grafis dengan proteksi arus pendek.',
    eduSafetyTip:
      'Pastikan sakelar belakang PSU dalam posisi mati (O) selama merakit, dan nyalakan ke posisi (I) hanya saat semua kabel terpasang.',
  },
  {
    id: 'motherboard',
    name: 'Motherboard Terakit',
    shortName: 'Motherboard ATX',
    category: 'Utama',
    model: 'B760 ATX + CPU/RAM/SSD',
    specLine: 'ATX · 9 Titik Standoff · 35 W',
    wattage: 35,
    phase: 'case',
    targetSlot: 'case_standoffs',
    summary: 'Papan sirkuit utama yang menghubungkan seluruh komponen di dalam casing.',
    eduFunction:
      'Motherboard menyediakan jalur data (bus), sirkuit VRM pengatur daya CPU, dan port I/O belakang. Standoff kuningan mencegah korsleting ke pelat logam casing.',
    eduSafetyTip:
      'Pegang motherboard pada tepinya dan sejajarkan port belakang dengan panel I/O casing sebelum meletakkan di atas standoff.',
  },
  {
    id: 'gpu',
    name: 'Kartu Grafis (GPU)',
    shortName: 'GPU RTX 4070',
    category: 'Grafis',
    model: 'RTX 4070 Dual 12 GB',
    specLine: 'PCIe 4.0 x16 · 200 W',
    wattage: 200,
    phase: 'case',
    targetSlot: 'pcie_x16',
    summary: 'Prosesor khusus pemrosesan grafis 3D, tampilan layar, dan komputasi paralel.',
    eduFunction:
      'Slot PCIe x16 teratas terhubung langsung ke CPU untuk kecepatan transfer grafis maksimum tanpa hambatan jalur chipset.',
    eduSafetyTip:
      'Pastikan pengait ujung slot PCIe x16 terbuka, tekan lurus hingga terdengar klik, lalu pastikan braket belakang sejajar.',
  },
  {
    id: 'cable_24pin',
    name: 'Kabel ATX 24-Pin',
    shortName: 'Kabel 24-Pin ATX',
    category: 'Kabel',
    model: 'Daya Utama Motherboard',
    specLine: 'Konektor 24-Pin · Kunci Klip Samping',
    wattage: 0,
    phase: 'case',
    targetSlot: 'header_24pin',
    summary: 'Menyalurkan daya utama dari PSU ke seluruh papan motherboard.',
    eduFunction:
      'Kabel 24-Pin adalah sumber tenaga utama chipset, slot RAM, slot M.2, dan sirkuit pemicu tombol daya casing.',
    eduSafetyTip:
      'Dorong konektor hingga klip pengunci samping mengait sempurna agar tidak ada celah yang memicu panas berlebih.',
  },
  {
    id: 'cable_8pin_cpu',
    name: 'Kabel EPS 8-Pin CPU',
    shortName: 'Kabel 8-Pin CPU',
    category: 'Kabel',
    model: 'Daya Khusus Prosesor',
    specLine: 'Konektor 4+4 Pin · Pojok Kiri Atas',
    wattage: 0,
    phase: 'case',
    targetSlot: 'header_8pin_cpu',
    summary: 'Menyalurkan daya +12V khusus ke sirkuit VRM prosesor.',
    eduFunction:
      'Prosesor modern membutuhkan pasokan arus besar tersendiri. Tanpa kabel EPS 8-Pin, LED diagnostik CPU akan menyala merah saat POST.',
    eduSafetyTip:
      'Jangan tertukar dengan kabel PCIe 6+2 Pin milik GPU. Bentuk lubang pin kabel CPU (4+4) berbeda untuk mencegah salah colok.',
  },
  {
    id: 'cable_8pin_gpu',
    name: 'Kabel PCIe 8-Pin GPU',
    shortName: 'Kabel 8-Pin GPU',
    category: 'Kabel',
    model: 'Daya Tambahan Grafis',
    specLine: 'Konektor 6+2 Pin · Maks. 150 W',
    wattage: 0,
    phase: 'case',
    targetSlot: 'gpu_power_8pin',
    summary: 'Memberikan daya tambahan yang dibutuhkan kartu grafis performa tinggi.',
    eduFunction:
      'Slot PCIe di motherboard hanya menyuplai maksimal 75 W. Kartu grafis 200 W memerlukan kabel daya PCIe 8-Pin agar dapat menampilkan gambar.',
    eduSafetyTip:
      'Gunakan kabel bertanda PCIe atau VGA dari PSU, dan pastikan kedua bagian 6+2 pin menyatu rata saat dicolokkan.',
  },
];

export const PARTS_BY_ID: Record<PartId, HardwarePartSpec> = Object.fromEntries(
  HARDWARE_PARTS.map((part) => [part.id, part]),
) as Record<PartId, HardwarePartSpec>;

export const ASSEMBLY_STEPS: AssemblyStepDef[] = [
  {
    id: 'open_latch',
    stepNumber: 1,
    phase: 'bench',
    title: 'Buka Tuas Soket CPU',
    shortTitle: 'Buka Soket LGA',
    requiredAction: 'Klik tuas pengunci soket LGA1700 di motherboard untuk membukanya.',
    bimoPrompt:
      'Halo! Aku BIMO, pendamping rakitmu. Kita mulai di meja anti-statis dulu. Klik tuas logam di samping soket CPU agar tutup penguncinya terbuka.',
    whyItMatters:
      'Merakit CPU, RAM, dan SSD sebelum memasukkan motherboard ke casing jauh lebih aman dan lapang untuk tanganmu.',
    targetControlHint: 'cpu_latch',
  },
  {
    id: 'install_cpu',
    stepNumber: 2,
    phase: 'bench',
    title: 'Sejajarkan & Pasang CPU',
    shortTitle: 'Pasang CPU',
    requiredAction: 'Pilih CPU Core i5, putar hingga segitiga emas di kiri bawah (0°), lalu pasang ke soket LGA1700.',
    bimoPrompt:
      'Pilih CPU Core i5 di baki kiri. Cek segitiga emasnya! Putar pakai tombol Putar (atau tombol R) sampai sejajar ke pojok kiri bawah, lalu pasang ke soket.',
    whyItMatters:
      'Posisi pin LGA1700 sangat presisi. Segitiga emas (Pin 1) mencegah prosesor terbalik dan menjaga pin soket tidak bengkok.',
    targetPartHint: 'cpu',
    targetSlotHint: 'socket_cpu',
  },
  {
    id: 'close_latch',
    stepNumber: 3,
    phase: 'bench',
    title: 'Kunci Tuas Soket CPU',
    shortTitle: 'Kunci Soket',
    requiredAction: 'Klik tuas soket LGA1700 kembali untuk mengunci prosesor dengan aman.',
    bimoPrompt:
      'Pas sekali! Sekarang klik kembali tuas soket LGA1700 untuk menekan dan mengunci prosesor agar semua kontak pin tersambung merata.',
    whyItMatters:
      'Tekanan pengunci memastikan ribuan kontak emas di bawah CPU menempel stabil sebelum pendingin dipasang.',
    targetControlHint: 'cpu_latch',
  },
  {
    id: 'apply_paste',
    stepNumber: 4,
    phase: 'bench',
    title: 'Oleskan Pasta Termal',
    shortTitle: 'Pasta Termal',
    requiredAction: 'Pilih Pasta Termal lalu oleskan ke bagian tengah tutup logam CPU.',
    bimoPrompt:
      'Sebelum pendingin dipasang, pilih Pasta Termal lalu klik tepat di tengah tutup logam CPU. Cukup satu titik seukuran kacang polong.',
    whyItMatters:
      'Tanpa pasta termal, celah udara mikroskopis menahan panas dan suhu CPU bisa melampaui 100°C dalam hitungan detik.',
    targetPartHint: 'thermal_paste',
    targetSlotHint: 'cpu_ihs',
  },
  {
    id: 'install_cooler',
    stepNumber: 5,
    phase: 'bench',
    title: 'Pasang Pendingin CPU',
    shortTitle: 'Pendingin CPU',
    requiredAction: 'Pilih Pendingin CPU lalu pasang di atas braket soket prosesor.',
    bimoPrompt:
      'Pasta termal sudah siap! Sekarang pilih Pendingin CPU dan pasang tepat di atas prosesor untuk menyerap panas kerja.',
    whyItMatters:
      'Heatsink tembaga dan kipas PWM menjaga suhu CPU tetap dingin di bawah beban kerja berat.',
    targetPartHint: 'cpu_cooler',
    targetSlotHint: 'cooler_mount',
  },
  {
    id: 'install_ram',
    stepNumber: 6,
    phase: 'bench',
    title: 'Pasang RAM Dual-Channel (A2 & B2)',
    shortTitle: 'RAM A2 & B2',
    requiredAction: 'Pasang kedua keping RAM DDR5 pada slot A2 dan B2 agar Dual-Channel aktif.',
    bimoPrompt:
      'Lanjut ke memori! Pasang RAM Modul 1 ke slot A2 dan RAM Modul 2 ke slot B2. Selang satu slot adalah kunci mengaktifkan mode Dual-Channel.',
    whyItMatters:
      'Konfigurasi Dual-Channel menggandakan kecepatan komunikasi memori dibanding memasang RAM di dua slot bersebelahan.',
    targetPartHint: 'ram_a2',
    targetSlotHint: 'dimm_a2',
  },
  {
    id: 'install_ssd',
    stepNumber: 7,
    phase: 'bench',
    title: 'Pasang SSD NVMe M.2',
    shortTitle: 'SSD NVMe',
    requiredAction: 'Pilih SSD NVMe 1 TB lalu pasang ke slot M.2 di bawah prosesor.',
    bimoPrompt:
      'Terakhir di meja ini: pilih SSD NVMe 1 TB lalu pasang ke slot M.2 Gen4. Setelah terpasang, kita pindah merakit ke dalam casing ATX!',
    whyItMatters:
      'Slot M.2 teratas mendapat jalur PCIe langsung dari CPU sehingga transfer data sistem operasi sangat responsif.',
    targetPartHint: 'ssd_nvme',
    targetSlotHint: 'm2_slot',
  },
  {
    id: 'install_psu_and_mobo',
    stepNumber: 8,
    phase: 'case',
    title: 'Pasang PSU & Motherboard ke Casing',
    shortTitle: 'PSU & Motherboard',
    requiredAction: 'Pasang PSU 650 W di ruang bawah casing, lalu pasang Motherboard Terakit ke standoff casing.',
    bimoPrompt:
      'Selamat datang di interior casing ATX! Pasang dulu PSU 650 W di kompartemen bawah, lalu masukkan Motherboard Terakit ke baut standoff.',
    whyItMatters:
      'Memasang PSU lebih dulu memudahkan pengaturan jalur kabel sebelum papan motherboard memenuhi ruang utama casing.',
    targetPartHint: 'psu',
    targetSlotHint: 'psu_bay',
  },
  {
    id: 'install_gpu',
    stepNumber: 9,
    phase: 'case',
    title: 'Pasang Kartu Grafis (GPU)',
    shortTitle: 'Kartu Grafis',
    requiredAction: 'Pilih GPU RTX 4070 lalu pasang ke slot PCIe 4.0 x16 utama.',
    bimoPrompt:
      'Sekarang saatnya komponen utama visual! Pilih GPU RTX 4070 lalu pasang lurus ke slot PCIe x16 teratas hingga terkunci.',
    whyItMatters:
      'Kartu grafis berukuran besar dipasang setelah motherboard terpasang di casing agar beratnya tertopang oleh braket besi casing.',
    targetPartHint: 'gpu',
    targetSlotHint: 'pcie_x16',
  },
  {
    id: 'cables_and_post',
    stepNumber: 10,
    phase: 'case',
    title: 'Sambung Kabel Daya & Uji Nyala (POST)',
    shortTitle: 'Kabel & Uji POST',
    requiredAction: 'Colokkan Kabel 24-Pin ATX, 8-Pin CPU, dan 8-Pin GPU, nyalakan sakelar PSU (I), lalu tekan Tombol Power.',
    bimoPrompt:
      'Langkah penentuan! Colokkan ketiga kabel daya (24-Pin ATX, 8-Pin CPU, dan 8-Pin GPU), ubah sakelar PSU ke posisi I, lalu tekan Tombol Power untuk uji POST!',
    whyItMatters:
      'POST (Power-On Self-Test) memeriksa apakah prosesor, RAM, grafis, dan penyimpanan merespons normal sebelum sistem masuk BIOS.',
    targetPartHint: 'cable_24pin',
    targetSlotHint: 'header_24pin',
  },
];

export const MODE_DESCRIPTIONS: Record<
  GameMode,
  { label: string; shortNote: string; hintPenalty: number }
> = {
  belajar: {
    label: 'Mode Belajar',
    shortNote: 'Sorotan slot gratis dan panduan aktif dari BIMO.',
    hintPenalty: 0,
  },
  mandiri: {
    label: 'Mode Mandiri',
    shortNote: 'Tanpa sorotan otomatis. Bantuan BIMO mengurangi 25 poin.',
    hintPenalty: 25,
  },
};
