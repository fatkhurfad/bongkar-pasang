/* Katalog toko perangkat keras, pesanan klien bengkel PC, kalkulasi kompatibilitas daya/performa, dan penyimpanan dompet bengkel */

import type { BuildPresetId, PartId } from '../config';

export type BuyableSlotId =
  | 'cpu'
  | 'thermal_paste'
  | 'cpu_cooler'
  | 'ram_a2'
  | 'ram_b2'
  | 'ssd_nvme'
  | 'psu'
  | 'motherboard'
  | 'gpu';

export type ShopCategory =
  | 'all'
  | 'cpu'
  | 'cooling'
  | 'ram'
  | 'ssd_nvme'
  | 'gpu'
  | 'psu'
  | 'motherboard';

export type ClientOrderId =
  | 'kantor_hemat'
  | 'gaming_efisien'
  | 'streaming_rgb'
  | 'workstation_pro'
  | 'ai_dev_rig'
  | 'rakit_bebas';

export interface CatalogModuleSpec {
  skuId: string;
  slotFamily: Exclude<BuyableSlotId, 'ram_b2'>; // RAM memakai family 'ram_a2' untuk slot A2 & B2
  shopCategory: Exclude<ShopCategory, 'all'>;
  name: string;
  model: string;
  shortCode: string;
  specLine: string;
  price: number; // Rupiah bilangan bulat
  wattage: number; // Beban daya (Watt)
  psuCapacityWatts?: number;
  psuEfficiencyTier?: '80+ Bronze' | '80+ Gold' | '80+ Platinum' | '80+ Titanium';
  ramGb?: number;
  ramSpeedMhz?: number;
  ssdGb?: number;
  baseIdleTempC?: number;
  tempOffsetC?: number;
  performanceScore: number;
  tier: 'hemat' | 'menengah' | 'pro';
  note: string;
}

export interface SavedBuildRecord {
  id: string;
  completedAtIso: string;
  orderId: ClientOrderId;
  orderTitle: string;
  clientName: string;
  totalSpent: number;
  serviceFeeEarned: number;
  benchmarkScore: number;
  totalWatts: number;
  psuCapacityWatts: number;
  cpuModel: string;
  gpuModel: string;
  coolerModel: string;
  ramLabel: string;
  ssdModel: string;
}

export interface ClientOrderRequirements {
  minRamGb?: number;
  requireDualChannel?: boolean;
  minSsdGb?: number;
  minBenchmark?: number;
  minPsuWatts?: number;
  maxPsuLoadPercent?: number;
}

export interface ClientOrderSpec {
  id: ClientOrderId;
  clientName: string;
  title: string;
  shortLabel: string;
  brief: string;
  budget: number;
  serviceFee: number;
  isSandbox: boolean;
  requirements: ClientOrderRequirements;
  recommendedLoadout: Record<BuyableSlotId, string>;
}

export interface OrderRequirementCheck {
  id: string;
  label: string;
  met: boolean;
  detail: string;
}

export interface BuildEvaluation {
  ownedCount: number;
  totalRequiredCount: number;
  missingSlots: BuyableSlotId[];
  totalSpent: number;
  estimatedWattage: number;
  psuCapacityWatts: number;
  psuLoadPercent: number;
  isPsuOverloaded: boolean;
  totalRamGb: number;
  isDualChannelReady: boolean;
  ssdGb: number;
  estimatedIdleTempC: number;
  benchmarkScore: number;
  orderChecks: OrderRequirementCheck[];
  allOrderRequirementsMet: boolean;
}

export interface WorkshopWallet {
  totalEarnings: number;
  completedOrders: number;
}

export const WORKSHOP_STORAGE_KEY = 'rakitpc_lab_workshop_v1';

export const BUYABLE_SLOTS: BuyableSlotId[] = [
  'cpu',
  'thermal_paste',
  'cpu_cooler',
  'ram_a2',
  'ram_b2',
  'ssd_nvme',
  'psu',
  'motherboard',
  'gpu',
];

export const BUYABLE_SLOT_LABELS: Record<BuyableSlotId, string> = {
  cpu: 'Prosesor (CPU)',
  thermal_paste: 'Pasta Termal',
  cpu_cooler: 'Pendingin CPU',
  ram_a2: 'RAM Slot A2',
  ram_b2: 'RAM Slot B2',
  ssd_nvme: 'SSD NVMe M.2',
  psu: 'Power Supply (PSU)',
  motherboard: 'Motherboard ATX',
  gpu: 'Kartu Grafis (GPU)',
};

export const SHOP_CATEGORY_LABELS: Record<ShopCategory, string> = {
  all: 'Semua',
  cpu: 'CPU',
  cooling: 'Pendingin',
  ram: 'RAM DDR5',
  ssd_nvme: 'SSD NVMe',
  gpu: 'GPU',
  psu: 'PSU',
  motherboard: 'Motherboard',
};

export const SHOP_CATALOG: CatalogModuleSpec[] = [
  // PROSESOR (CPU)
  {
    skuId: 'cpu_i3_14100',
    slotFamily: 'cpu',
    shopCategory: 'cpu',
    name: 'Prosesor Core i3-14100',
    model: 'Core i3-14100',
    shortCode: 'i3-141',
    specLine: 'LGA1700 · 4 Core · 60 W',
    price: 2150000,
    wattage: 60,
    baseIdleTempC: 32,
    performanceScore: 58,
    tier: 'hemat',
    note: 'Irit daya dan dingin, pas untuk kerja kantor dan desain ringan.',
  },
  {
    skuId: 'cpu_i5_14600k',
    slotFamily: 'cpu',
    shopCategory: 'cpu',
    name: 'Prosesor Core i5-14600K',
    model: 'Core i5-14600K',
    shortCode: 'i5-14K',
    specLine: 'LGA1700 · 14 Core · 125 W',
    price: 4850000,
    wattage: 125,
    baseIdleTempC: 36,
    performanceScore: 84,
    tier: 'menengah',
    note: 'Seimbang untuk gim 1440p, kompilasi, dan efisiensi daya 80+ Gold.',
  },
  {
    skuId: 'cpu_i7_14700k',
    slotFamily: 'cpu',
    shopCategory: 'cpu',
    name: 'Prosesor Core i7-14700K',
    model: 'Core i7-14700K',
    shortCode: 'i7-14K',
    specLine: 'LGA1700 · 20 Core · 190 W',
    price: 6600000,
    wattage: 190,
    baseIdleTempC: 42,
    performanceScore: 96,
    tier: 'pro',
    note: '20 core bertenaga untuk render 4K; butuh pendingin dan PSU besar.',
  },
  {
    skuId: 'cpu_i9_14900k',
    slotFamily: 'cpu',
    shopCategory: 'cpu',
    name: 'Prosesor Core i9-14900K',
    model: 'Core i9-14900K',
    shortCode: 'i9-14K',
    specLine: 'LGA1700 · 24 Core · 253 W',
    price: 9400000,
    wattage: 253,
    baseIdleTempC: 45,
    performanceScore: 100,
    tier: 'pro',
    note: 'Prosesor kelas puncak 24 core; wajib dipasangkan Liquid AIO 240 mm atau Dual-Tower.',
  },

  // PASTA TERMAL
  {
    skuId: 'paste_std',
    slotFamily: 'thermal_paste',
    shopCategory: 'cooling',
    name: 'Pasta Termal Standar',
    model: 'Silicone Thermal 2 g',
    shortCode: 'STD-2G',
    specLine: 'Konduktivitas Standar · Non-Konduktif',
    price: 75000,
    wattage: 0,
    tempOffsetC: 2,
    performanceScore: 2,
    tier: 'hemat',
    note: 'Cukup untuk CPU kelas hemat hingga menengah.',
  },
  {
    skuId: 'paste_nth2',
    slotFamily: 'thermal_paste',
    shopCategory: 'cooling',
    name: 'Pasta Termal NT-H2 Pro',
    model: 'NT-H2 Pro 3,5 g',
    shortCode: 'NT-H2',
    specLine: 'Konduktivitas Tinggi · Non-Konduktif',
    price: 165000,
    wattage: 0,
    tempOffsetC: 0,
    performanceScore: 4,
    tier: 'pro',
    note: 'Menurunkan suhu kontak IHS lebih baik pada beban kerja tinggi.',
  },

  // PENDINGIN CPU (AIR COOLER)
  {
    skuId: 'cooler_stock',
    slotFamily: 'cpu_cooler',
    shopCategory: 'cooling',
    name: 'Pendingin Air 92 mm',
    model: 'Compact Air 92 PWM',
    shortCode: 'AIR-92',
    specLine: '2 Heatpipe · Kipas 92 mm · 3 W',
    price: 250000,
    wattage: 3,
    tempOffsetC: 5,
    performanceScore: 3,
    tier: 'hemat',
    note: 'Ringkas dan ekonomis untuk CPU TDP rendah.',
  },
  {
    skuId: 'cooler_tower_120',
    slotFamily: 'cpu_cooler',
    shopCategory: 'cooling',
    name: 'Pendingin Tower 120 PWM',
    model: 'Tower Air 120 PWM',
    shortCode: 'TWR-120',
    specLine: '4 Heatpipe Tembaga · Kipas 120 mm · 5 W',
    price: 550000,
    wattage: 5,
    tempOffsetC: 0,
    performanceScore: 6,
    tier: 'menengah',
    note: 'Pendingin menara populer dengan suhu stabil dan senyap.',
  },
  {
    skuId: 'cooler_dual_240',
    slotFamily: 'cpu_cooler',
    shopCategory: 'cooling',
    name: 'Pendingin Dual-Tower Pro',
    model: 'Dual-Tower Pro 240',
    shortCode: 'PRO-240',
    specLine: '6 Heatpipe · Kipas Ganda · 8 W',
    price: 1150000,
    wattage: 8,
    tempOffsetC: -5,
    performanceScore: 8,
    tier: 'pro',
    note: 'Menjaga suhu CPU 20 core tetap rendah saat render berat.',
  },
  {
    skuId: 'cooler_aio_240',
    slotFamily: 'cpu_cooler',
    shopCategory: 'cooling',
    name: 'Liquid Cooler AIO 240 mm',
    model: 'HydroFrost AIO 240 RGB',
    shortCode: 'AIO-240',
    specLine: 'Radiator 240 mm · Pompa RGB · 12 W',
    price: 1850000,
    wattage: 12,
    tempOffsetC: -9,
    performanceScore: 10,
    tier: 'pro',
    note: 'Pendingin cair all-in-one dengan selang braided dan radiator atas untuk suhu paling dingin.',
  },

  // MEMORI RAM DDR5 (DIJUAL PER KEPING / BISA BELI 2 KEPING DUAL-CHANNEL)
  {
    skuId: 'ram_8gb_4800',
    slotFamily: 'ram_a2',
    shopCategory: 'ram',
    name: 'RAM 8 GB DDR5-4800',
    model: '8 GB DDR5-4800',
    shortCode: '8G-4800',
    specLine: 'DDR5-4800 · 3 W · 1 Keping',
    price: 475000,
    wattage: 3,
    ramGb: 8,
    ramSpeedMhz: 4800,
    performanceScore: 4,
    tier: 'hemat',
    note: 'Pasang 2 keping (16 GB Dual-Channel) untuk kerja harian yang mulus.',
  },
  {
    skuId: 'ram_16gb_5600',
    slotFamily: 'ram_a2',
    shopCategory: 'ram',
    name: 'RAM 16 GB DDR5-5600',
    model: '16 GB DDR5-5600',
    shortCode: '16G-5600',
    specLine: 'DDR5-5600 · 4 W · 1 Keping',
    price: 875000,
    wattage: 4,
    ramGb: 16,
    ramSpeedMhz: 5600,
    performanceScore: 7,
    tier: 'menengah',
    note: 'Standar ideal gim modern dan multitasking (32 GB Dual-Channel).',
  },
  {
    skuId: 'ram_32gb_6400',
    slotFamily: 'ram_a2',
    shopCategory: 'ram',
    name: 'RAM 32 GB DDR5-6400 Pro',
    model: '32 GB DDR5-6400 Pro',
    shortCode: '32G-6400',
    specLine: 'DDR5-6400 · 5 W · 1 Keping',
    price: 1700000,
    wattage: 5,
    ramGb: 32,
    ramSpeedMhz: 6400,
    performanceScore: 10,
    tier: 'pro',
    note: 'Kapasitas lega 64 GB (2 keping) untuk video 4K dan proyek 3D.',
  },

  // PENYIMPANAN SSD NVMe M.2
  {
    skuId: 'ssd_512_gen3',
    slotFamily: 'ssd_nvme',
    shopCategory: 'ssd_nvme',
    name: 'SSD NVMe 512 GB Gen3',
    model: 'Gen3 NVMe 512 GB',
    shortCode: 'NVMe 512G',
    specLine: 'M.2 2280 · PCIe 3.0 x4 · 5 W',
    price: 650000,
    wattage: 5,
    ssdGb: 512,
    performanceScore: 4,
    tier: 'hemat',
    note: 'Cukup cepat untuk sistem operasi dan dokumen kerja.',
  },
  {
    skuId: 'ssd_1tb_gen4',
    slotFamily: 'ssd_nvme',
    shopCategory: 'ssd_nvme',
    name: 'SSD NVMe 1 TB Gen4',
    model: 'Gen4 NVMe 1 TB',
    shortCode: 'NVMe 1TB',
    specLine: 'M.2 2280 · PCIe 4.0 x4 · 7 W',
    price: 1250000,
    wattage: 7,
    ssdGb: 1000,
    performanceScore: 7,
    tier: 'menengah',
    note: 'Kecepatan baca tinggi hingga 5.000 MB/s untuk gim dan aplikasi.',
  },
  {
    skuId: 'ssd_2tb_gen4',
    slotFamily: 'ssd_nvme',
    shopCategory: 'ssd_nvme',
    name: 'SSD NVMe 2 TB Gen4 Pro',
    model: 'Gen4 Pro NVMe 2 TB',
    shortCode: 'NVMe 2TB',
    specLine: 'M.2 2280 · PCIe 4.0 x4 · 8 W',
    price: 2350000,
    wattage: 8,
    ssdGb: 2000,
    performanceScore: 9,
    tier: 'pro',
    note: 'Ruang simpan ekstra luas untuk bahan video 4K dan pustaka besar.',
  },
  {
    skuId: 'ssd_4tb_gen4',
    slotFamily: 'ssd_nvme',
    shopCategory: 'ssd_nvme',
    name: 'SSD NVMe 4 TB Gen4 Ultra',
    model: 'Gen4 Ultra NVMe 4 TB',
    shortCode: 'NVMe 4TB',
    specLine: 'M.2 2280 · 7.350 MB/s · 9 W',
    price: 4400000,
    wattage: 9,
    ssdGb: 4000,
    performanceScore: 10,
    tier: 'pro',
    note: 'Kapasitas masif 4 TB dengan heatsink aluminium untuk dataset AI dan arsip RAW.',
  },

  // POWER SUPPLY (PSU)
  {
    skuId: 'psu_550_bronze',
    slotFamily: 'psu',
    shopCategory: 'psu',
    name: 'PSU 550 W 80+ Bronze',
    model: '550 W 80+ Bronze',
    shortCode: '550W BRZ',
    specLine: 'ATX · 550 W · Efisiensi 85%',
    price: 850000,
    wattage: 0,
    psuCapacityWatts: 550,
    psuEfficiencyTier: '80+ Bronze',
    performanceScore: 3,
    tier: 'hemat',
    note: 'Cukup untuk PC hemat daya; berisiko overload bila dipasangkan GPU kelas atas.',
  },
  {
    skuId: 'psu_650_gold',
    slotFamily: 'psu',
    shopCategory: 'psu',
    name: 'PSU 650 W 80+ Gold',
    model: '650 W 80+ Gold Modular',
    shortCode: '650W GLD',
    specLine: 'ATX · 650 W · Efisiensi 90%',
    price: 1450000,
    wattage: 0,
    psuCapacityWatts: 650,
    psuEfficiencyTier: '80+ Gold',
    performanceScore: 6,
    tier: 'menengah',
    note: 'Titik efisiensi terbaik di beban 50%–65% dengan kabel modular rapi.',
  },
  {
    skuId: 'psu_850_plat',
    slotFamily: 'psu',
    shopCategory: 'psu',
    name: 'PSU 850 W 80+ Platinum',
    model: '850 W 80+ Platinum Modular',
    shortCode: '850W PLT',
    specLine: 'ATX · 850 W · Efisiensi 92%',
    price: 2450000,
    wattage: 0,
    psuCapacityWatts: 850,
    psuEfficiencyTier: '80+ Platinum',
    performanceScore: 8,
    tier: 'pro',
    note: 'Cadangan daya luas dan stabil untuk prosesor i7 serta RTX 4080 Super.',
  },
  {
    skuId: 'psu_1000_titanium',
    slotFamily: 'psu',
    shopCategory: 'psu',
    name: 'PSU 1000 W 80+ Titanium',
    model: '1000 W 80+ Titanium Modular',
    shortCode: '1000W TI',
    specLine: 'ATX 3.0 · 1000 W · Efisiensi 94%',
    price: 3650000,
    wattage: 0,
    psuCapacityWatts: 1000,
    psuEfficiencyTier: '80+ Titanium',
    performanceScore: 10,
    tier: 'pro',
    note: 'Efisiensi tertinggi dan daya penuh 1000 W untuk Core i9 dan RTX 4090.',
  },

  // MOTHERBOARD ATX (TERMASUK SET KABEL DAYA MODULAR)
  {
    skuId: 'mobo_b760m',
    slotFamily: 'motherboard',
    shopCategory: 'motherboard',
    name: 'Motherboard B760M Essentials',
    model: 'B760M Essentials ATX',
    shortCode: 'B760M',
    specLine: 'LGA1700 · DDR5 · 9 Standoff · 30 W',
    price: 2200000,
    wattage: 30,
    performanceScore: 5,
    tier: 'hemat',
    note: 'Papan utama fungsional dengan 4 slot DDR5 dan 1 slot M.2 Gen4.',
  },
  {
    skuId: 'mobo_b760_pro',
    slotFamily: 'motherboard',
    shopCategory: 'motherboard',
    name: 'Motherboard B760 Pro Wi-Fi',
    model: 'B760 Pro ATX Wi-Fi',
    shortCode: 'B760 PRO',
    specLine: 'LGA1700 · VRM Heatsink · 9 Standoff · 35 W',
    price: 3100000,
    wattage: 35,
    performanceScore: 8,
    tier: 'pro',
    note: 'Pendingin VRM lebih tebal dan jalur daya kokoh untuk beban tinggi.',
  },

  // KARTU GRAFIS (GPU)
  {
    skuId: 'gpu_4060',
    slotFamily: 'gpu',
    shopCategory: 'gpu',
    name: 'GPU RTX 4060 Compact',
    model: 'RTX 4060 Compact 8 GB',
    shortCode: 'RTX 4060',
    specLine: 'PCIe 4.0 x16 · 8 GB · 115 W',
    price: 4950000,
    wattage: 115,
    performanceScore: 66,
    tier: 'hemat',
    note: 'Efisien untuk layar 1080p dan akselerasi grafis harian.',
  },
  {
    skuId: 'gpu_4070',
    slotFamily: 'gpu',
    shopCategory: 'gpu',
    name: 'GPU RTX 4070 Dual',
    model: 'RTX 4070 Dual 12 GB',
    shortCode: 'RTX 4070',
    specLine: 'PCIe 4.0 x16 · 12 GB · 200 W',
    price: 9250000,
    wattage: 200,
    performanceScore: 86,
    tier: 'menengah',
    note: 'Performa tinggi untuk 1440p dengan konsumsi daya 200 W yang seimbang.',
  },
  {
    skuId: 'gpu_4070ti',
    slotFamily: 'gpu',
    shopCategory: 'gpu',
    name: 'GPU RTX 4070 Ti Super',
    model: 'RTX 4070 Ti Super 16 GB',
    shortCode: 'RTX 4070Ti',
    specLine: 'PCIe 4.0 x16 · 16 GB · 285 W',
    price: 13200000,
    wattage: 285,
    performanceScore: 92,
    tier: 'pro',
    note: 'Tiga kipas dengan VRAM 16 GB, tangguh untuk esports 240Hz dan streaming 1440p.',
  },
  {
    skuId: 'gpu_4080s',
    slotFamily: 'gpu',
    shopCategory: 'gpu',
    name: 'GPU RTX 4080 Super',
    model: 'RTX 4080 Super 16 GB',
    shortCode: 'RTX 4080',
    specLine: 'PCIe 4.0 x16 · 16 GB · 320 W',
    price: 16500000,
    wattage: 320,
    performanceScore: 98,
    tier: 'pro',
    note: 'Kelas workstation & 4K dengan kebutuhan daya besar (rekomendasi PSU 850 W).',
  },
  {
    skuId: 'gpu_4090',
    slotFamily: 'gpu',
    shopCategory: 'gpu',
    name: 'GPU RTX 4090 Flagship',
    model: 'RTX 4090 Flagship 24 GB',
    shortCode: 'RTX 4090',
    specLine: 'PCIe 4.0 x16 · 24 GB · 450 W',
    price: 26500000,
    wattage: 450,
    performanceScore: 100,
    tier: 'pro',
    note: 'Kartu grafis paling bertenaga dengan 24 GB VRAM untuk AI lokal & 4K Ray Tracing (wajib PSU 1000 W).',
  },
];

export const CATALOG_BY_SKU: Record<string, CatalogModuleSpec> = Object.fromEntries(
  SHOP_CATALOG.map((item) => [item.skuId, item]),
);

export const CLIENT_ORDERS: Record<ClientOrderId, ClientOrderSpec> = {
  kantor_hemat: {
    id: 'kantor_hemat',
    clientName: 'Studio Arsitek Nusantara',
    title: 'PC Kantor & Desain Ringan',
    shortLabel: 'Kantor · Rp13,5 jt',
    brief: 'Butuh PC hemat listrik untuk gambar kerja 2D dan kantor dengan RAM minimal 16 GB Dual-Channel.',
    budget: 13500000,
    serviceFee: 1500000,
    isSandbox: false,
    requirements: {
      minRamGb: 16,
      requireDualChannel: true,
      minSsdGb: 512,
      minBenchmark: 55,
      maxPsuLoadPercent: 85,
    },
    recommendedLoadout: {
      cpu: 'cpu_i3_14100',
      thermal_paste: 'paste_std',
      cpu_cooler: 'cooler_stock',
      ram_a2: 'ram_8gb_4800',
      ram_b2: 'ram_8gb_4800',
      ssd_nvme: 'ssd_512_gen3',
      psu: 'psu_550_bronze',
      motherboard: 'mobo_b760m',
      gpu: 'gpu_4060',
    },
  },
  gaming_efisien: {
    id: 'gaming_efisien',
    clientName: 'Raka — Kreator Gim',
    title: 'PC Gaming 1440p Efisien',
    shortLabel: 'Gaming · Rp23,5 jt',
    brief: 'Ingin PC 1440p yang senyap, RAM 32 GB Dual-Channel, SSD 1 TB, dan daya efisien dengan PSU minimal 650 W.',
    budget: 23500000,
    serviceFee: 2500000,
    isSandbox: false,
    requirements: {
      minRamGb: 32,
      requireDualChannel: true,
      minSsdGb: 1000,
      minBenchmark: 80,
      minPsuWatts: 650,
      maxPsuLoadPercent: 80,
    },
    recommendedLoadout: {
      cpu: 'cpu_i5_14600k',
      thermal_paste: 'paste_nth2',
      cpu_cooler: 'cooler_tower_120',
      ram_a2: 'ram_16gb_5600',
      ram_b2: 'ram_16gb_5600',
      ssd_nvme: 'ssd_1tb_gen4',
      psu: 'psu_650_gold',
      motherboard: 'mobo_b760_pro',
      gpu: 'gpu_4070',
    },
  },
  streaming_rgb: {
    id: 'streaming_rgb',
    clientName: 'Nadia — Streamer Esports',
    title: 'PC Streaming & Esports 240Hz',
    shortLabel: 'Streaming · Rp30 jt',
    brief: 'Butuh PC dingin dengan Liquid AIO, RAM 32 GB Dual-Channel, SSD 2 TB, dan performa tinggi untuk gim + live stream.',
    budget: 30000000,
    serviceFee: 3000000,
    isSandbox: false,
    requirements: {
      minRamGb: 32,
      requireDualChannel: true,
      minSsdGb: 2000,
      minBenchmark: 88,
      minPsuWatts: 850,
      maxPsuLoadPercent: 80,
    },
    recommendedLoadout: {
      cpu: 'cpu_i5_14600k',
      thermal_paste: 'paste_nth2',
      cpu_cooler: 'cooler_aio_240',
      ram_a2: 'ram_16gb_5600',
      ram_b2: 'ram_16gb_5600',
      ssd_nvme: 'ssd_2tb_gen4',
      psu: 'psu_850_plat',
      motherboard: 'mobo_b760_pro',
      gpu: 'gpu_4070ti',
    },
  },
  workstation_pro: {
    id: 'workstation_pro',
    clientName: 'Lensa Produksi 4K',
    title: 'Workstation Editing 4K',
    shortLabel: 'Editing 4K · Rp38 jt',
    brief: 'Perlu mesin render 4K dengan performa puncak, penyimpanan 2 TB, RAM minimal 32 GB, dan PSU 850 W.',
    budget: 38000000,
    serviceFee: 4000000,
    isSandbox: false,
    requirements: {
      minRamGb: 32,
      requireDualChannel: true,
      minSsdGb: 2000,
      minBenchmark: 92,
      minPsuWatts: 850,
      maxPsuLoadPercent: 80,
    },
    recommendedLoadout: {
      cpu: 'cpu_i7_14700k',
      thermal_paste: 'paste_nth2',
      cpu_cooler: 'cooler_dual_240',
      ram_a2: 'ram_32gb_6400',
      ram_b2: 'ram_32gb_6400',
      ssd_nvme: 'ssd_2tb_gen4',
      psu: 'psu_850_plat',
      motherboard: 'mobo_b760_pro',
      gpu: 'gpu_4080s',
    },
  },
  ai_dev_rig: {
    id: 'ai_dev_rig',
    clientName: 'Lab Riset Data Nusantara',
    title: 'Mesin Kompilasi & AI Lokal',
    shortLabel: 'AI Flagship · Rp58 jt',
    brief: 'Membutuhkan RAM 64 GB Dual-Channel, SSD 4 TB, performa 96+, dan PSU 1000 W untuk pelatihan model AI lokal.',
    budget: 58000000,
    serviceFee: 5500000,
    isSandbox: false,
    requirements: {
      minRamGb: 64,
      requireDualChannel: true,
      minSsdGb: 4000,
      minBenchmark: 96,
      minPsuWatts: 1000,
      maxPsuLoadPercent: 80,
    },
    recommendedLoadout: {
      cpu: 'cpu_i9_14900k',
      thermal_paste: 'paste_nth2',
      cpu_cooler: 'cooler_aio_240',
      ram_a2: 'ram_32gb_6400',
      ram_b2: 'ram_32gb_6400',
      ssd_nvme: 'ssd_4tb_gen4',
      psu: 'psu_1000_titanium',
      motherboard: 'mobo_b760_pro',
      gpu: 'gpu_4090',
    },
  },
  rakit_bebas: {
    id: 'rakit_bebas',
    clientName: 'Meja Eksperimen Pribadi',
    title: 'Rakit Bebas (Sandbox)',
    shortLabel: 'Rakit Bebas · Rp65 jt',
    brief: 'Anggaran lega Rp65 jt untuk meracik kombinasi impian (termasuk Core i9, Liquid AIO, dan RTX 4090) tanpa tekanan waktu.',
    budget: 65000000,
    serviceFee: 0,
    isSandbox: true,
    requirements: {},
    recommendedLoadout: {
      cpu: 'cpu_i5_14600k',
      thermal_paste: 'paste_nth2',
      cpu_cooler: 'cooler_tower_120',
      ram_a2: 'ram_16gb_5600',
      ram_b2: 'ram_16gb_5600',
      ssd_nvme: 'ssd_1tb_gen4',
      psu: 'psu_650_gold',
      motherboard: 'mobo_b760_pro',
      gpu: 'gpu_4070',
    },
  },
};

export const CLIENT_ORDER_LIST: ClientOrderSpec[] = [
  CLIENT_ORDERS.gaming_efisien,
  CLIENT_ORDERS.kantor_hemat,
  CLIENT_ORDERS.streaming_rgb,
  CLIENT_ORDERS.workstation_pro,
  CLIENT_ORDERS.ai_dev_rig,
  CLIENT_ORDERS.rakit_bebas,
];

export function isBuyableSlot(partId: PartId): partId is BuyableSlotId {
  return BUYABLE_SLOTS.includes(partId as BuyableSlotId);
}

export function getShopCategoryForPart(partId: PartId): Exclude<ShopCategory, 'all'> {
  switch (partId) {
    case 'cpu':
      return 'cpu';
    case 'thermal_paste':
    case 'cpu_cooler':
      return 'cooling';
    case 'ram_a2':
    case 'ram_b2':
      return 'ram';
    case 'ssd_nvme':
      return 'ssd_nvme';
    case 'gpu':
    case 'cable_8pin_gpu':
      return 'gpu';
    case 'psu':
    case 'cable_24pin':
    case 'cable_8pin_cpu':
      return 'psu';
    case 'motherboard':
      return 'motherboard';
  }
}

export function getStarterLoadoutForPreset(
  presetId: BuildPresetId,
): Record<BuyableSlotId, string> {
  if (presetId === 'hemat') {
    return {
      cpu: 'cpu_i3_14100',
      thermal_paste: 'paste_nth2',
      cpu_cooler: 'cooler_tower_120',
      ram_a2: 'ram_16gb_5600',
      ram_b2: 'ram_16gb_5600',
      ssd_nvme: 'ssd_1tb_gen4',
      psu: 'psu_650_gold',
      motherboard: 'mobo_b760_pro',
      gpu: 'gpu_4060',
    };
  }
  if (presetId === 'berat') {
    return {
      cpu: 'cpu_i7_14700k',
      thermal_paste: 'paste_nth2',
      cpu_cooler: 'cooler_tower_120',
      ram_a2: 'ram_16gb_5600',
      ram_b2: 'ram_16gb_5600',
      ssd_nvme: 'ssd_1tb_gen4',
      psu: 'psu_650_gold',
      motherboard: 'mobo_b760_pro',
      gpu: 'gpu_4080s',
    };
  }
  return {
    cpu: 'cpu_i5_14600k',
    thermal_paste: 'paste_nth2',
    cpu_cooler: 'cooler_tower_120',
    ram_a2: 'ram_16gb_5600',
    ram_b2: 'ram_16gb_5600',
    ssd_nvme: 'ssd_1tb_gen4',
    psu: 'psu_650_gold',
    motherboard: 'mobo_b760_pro',
    gpu: 'gpu_4070',
  };
}

export function computeLoadoutCost(
  purchasedModules: Partial<Record<BuyableSlotId, string>>,
): number {
  return BUYABLE_SLOTS.reduce((sum, slot) => {
    const skuId = purchasedModules[slot];
    if (!skuId) return sum;
    return sum + (CATALOG_BY_SKU[skuId]?.price ?? 0);
  }, 0);
}

export function evaluateBuildLoadout(
  purchasedModules: Partial<Record<BuyableSlotId, string>>,
  orderId: ClientOrderId,
): BuildEvaluation {
  const order = CLIENT_ORDERS[orderId];
  const missingSlots = BUYABLE_SLOTS.filter((slot) => !purchasedModules[slot]);
  const ownedCount = BUYABLE_SLOTS.length - missingSlots.length;
  const totalSpent = computeLoadoutCost(purchasedModules);

  const cpuSku = purchasedModules.cpu ? CATALOG_BY_SKU[purchasedModules.cpu] : undefined;
  const pasteSku = purchasedModules.thermal_paste
    ? CATALOG_BY_SKU[purchasedModules.thermal_paste]
    : undefined;
  const coolerSku = purchasedModules.cpu_cooler
    ? CATALOG_BY_SKU[purchasedModules.cpu_cooler]
    : undefined;
  const ramA2Sku = purchasedModules.ram_a2 ? CATALOG_BY_SKU[purchasedModules.ram_a2] : undefined;
  const ramB2Sku = purchasedModules.ram_b2 ? CATALOG_BY_SKU[purchasedModules.ram_b2] : undefined;
  const ssdSku = purchasedModules.ssd_nvme ? CATALOG_BY_SKU[purchasedModules.ssd_nvme] : undefined;
  const psuSku = purchasedModules.psu ? CATALOG_BY_SKU[purchasedModules.psu] : undefined;
  const moboSku = purchasedModules.motherboard
    ? CATALOG_BY_SKU[purchasedModules.motherboard]
    : undefined;
  const gpuSku = purchasedModules.gpu ? CATALOG_BY_SKU[purchasedModules.gpu] : undefined;

  const estimatedWattage = BUYABLE_SLOTS.reduce((sum, slot) => {
    const skuId = purchasedModules[slot];
    if (!skuId) return sum;
    return sum + (CATALOG_BY_SKU[skuId]?.wattage ?? 0);
  }, 0);

  const psuCapacityWatts = psuSku?.psuCapacityWatts ?? 650;
  const psuLoadPercent =
    psuCapacityWatts > 0 ? Math.round((estimatedWattage / psuCapacityWatts) * 100) : 0;
  const isPsuOverloaded = Boolean(psuSku) && estimatedWattage > psuCapacityWatts;

  const totalRamGb = (ramA2Sku?.ramGb ?? 0) + (ramB2Sku?.ramGb ?? 0);
  const isDualChannelReady = Boolean(ramA2Sku && ramB2Sku);
  const ssdGb = ssdSku?.ssdGb ?? 0;

  const baseTemp = cpuSku?.baseIdleTempC ?? 36;
  const tempAdjust = (pasteSku?.tempOffsetC ?? 0) + (coolerSku?.tempOffsetC ?? 0);
  const estimatedIdleTempC = Math.max(26, baseTemp + tempAdjust);

  // Skor benchmark terukur (0–100) berdasarkan bobot CPU (40%), GPU (45%), RAM+SSD+Cooler (15%)
  const cpuScore = cpuSku?.performanceScore ?? 0;
  const gpuScore = gpuSku?.performanceScore ?? 0;
  const supportRaw =
    (ramA2Sku?.performanceScore ?? 0) +
    (ramB2Sku?.performanceScore ?? 0) +
    (ssdSku?.performanceScore ?? 0) +
    (coolerSku?.performanceScore ?? 0);
  const supportNormalized = Math.min(100, Math.round((supportRaw / 32) * 100));
  const benchmarkScore =
    cpuSku && gpuSku
      ? Math.min(100, Math.round(cpuScore * 0.4 + gpuScore * 0.45 + supportNormalized * 0.15))
      : Math.round((cpuScore * 0.4 + gpuScore * 0.45) * 0.6);

  const orderChecks: OrderRequirementCheck[] = [];
  const req = order.requirements;

  if (req.minRamGb) {
    const met = totalRamGb >= req.minRamGb && (!req.requireDualChannel || isDualChannelReady);
    orderChecks.push({
      id: 'ram',
      label: req.requireDualChannel
        ? `RAM minimal ${req.minRamGb} GB Dual-Channel`
        : `RAM minimal ${req.minRamGb} GB`,
      met,
      detail: `${totalRamGb} GB${isDualChannelReady ? ' (Dual-Ch)' : ''}`,
    });
  }

  if (req.minSsdGb) {
    const labelCap = req.minSsdGb >= 1000 ? `${req.minSsdGb / 1000} TB` : `${req.minSsdGb} GB`;
    const curCap = ssdGb >= 1000 ? `${ssdGb / 1000} TB` : `${ssdGb} GB`;
    orderChecks.push({
      id: 'ssd',
      label: `SSD NVMe minimal ${labelCap}`,
      met: ssdGb >= req.minSsdGb,
      detail: ssdGb > 0 ? curCap : 'Belum dibeli',
    });
  }

  if (req.minBenchmark) {
    orderChecks.push({
      id: 'benchmark',
      label: `Skor Performa minimal ${req.minBenchmark}`,
      met: benchmarkScore >= req.minBenchmark,
      detail: `${benchmarkScore}/100`,
    });
  }

  if (req.minPsuWatts) {
    orderChecks.push({
      id: 'psu_cap',
      label: `PSU minimal ${req.minPsuWatts} W`,
      met: Boolean(psuSku) && psuCapacityWatts >= req.minPsuWatts,
      detail: psuSku ? `${psuCapacityWatts} W` : 'Belum dibeli',
    });
  }

  if (req.maxPsuLoadPercent) {
    orderChecks.push({
      id: 'psu_load',
      label: `Beban PSU aman (≤ ${req.maxPsuLoadPercent}%)`,
      met: Boolean(psuSku) && !isPsuOverloaded && psuLoadPercent <= req.maxPsuLoadPercent,
      detail: psuSku ? `${psuLoadPercent}%` : 'Belum dibeli',
    });
  }

  const allOrderRequirementsMet =
    missingSlots.length === 0 &&
    !isPsuOverloaded &&
    orderChecks.every((check) => check.met);

  return {
    ownedCount,
    totalRequiredCount: BUYABLE_SLOTS.length,
    missingSlots,
    totalSpent,
    estimatedWattage,
    psuCapacityWatts,
    psuLoadPercent,
    isPsuOverloaded,
    totalRamGb,
    isDualChannelReady,
    ssdGb,
    estimatedIdleTempC,
    benchmarkScore,
    orderChecks,
    allOrderRequirementsMet,
  };
}

export function loadWorkshopWallet(): WorkshopWallet {
  if (typeof window === 'undefined') {
    return { totalEarnings: 0, completedOrders: 0 };
  }
  try {
    const raw = window.localStorage.getItem(WORKSHOP_STORAGE_KEY);
    if (!raw) return { totalEarnings: 0, completedOrders: 0 };
    const parsed = JSON.parse(raw) as Partial<WorkshopWallet>;
    return {
      totalEarnings:
        typeof parsed.totalEarnings === 'number' && Number.isFinite(parsed.totalEarnings)
          ? Math.max(0, Math.round(parsed.totalEarnings))
          : 0,
      completedOrders:
        typeof parsed.completedOrders === 'number' && Number.isFinite(parsed.completedOrders)
          ? Math.max(0, Math.round(parsed.completedOrders))
          : 0,
    };
  } catch {
    return { totalEarnings: 0, completedOrders: 0 };
  }
}

export function saveWorkshopWallet(wallet: WorkshopWallet): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      WORKSHOP_STORAGE_KEY,
      JSON.stringify({
        totalEarnings: Math.max(0, Math.round(wallet.totalEarnings)),
        completedOrders: Math.max(0, Math.round(wallet.completedOrders)),
      }),
    );
  } catch {
    // Abaikan jika penyimpanan lokal tidak tersedia
  }
}

export const BUILD_GALLERY_STORAGE_KEY = 'rakitpc_lab_gallery_v1';

export function loadSavedBuilds(): SavedBuildRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(BUILD_GALLERY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 12) as SavedBuildRecord[];
  } catch {
    return [];
  }
}

export function saveCompletedBuild(record: SavedBuildRecord): SavedBuildRecord[] {
  const existing = loadSavedBuilds();
  const next = [record, ...existing].slice(0, 12);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(BUILD_GALLERY_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Abaikan jika penyimpanan lokal tidak tersedia
    }
  }
  return next;
}

