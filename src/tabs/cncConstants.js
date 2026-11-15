export const JYOTI_MACHINE_CASCADE = {
  Turning: {
    'DX Series (Compact / Chucker)': ['DX 60', 'DX 100', 'Zebra', 'DX 135', 'DX 135nvu', 'DX 170nvu'],
    'DX 200 Series': ['DX 200-3', 'DX 200-4', 'DX 200-5', 'DX 200-7', 'DX 200-12', 'DX 200-5A nvu', 'DX 200-5B nvu'],
    'DX 250 Series': ['DX 250-500', 'DX 250-500nvu', 'DX 250-700', 'DX 250-1000'],
    'DX 350 Series': ['DX 350-700', 'DX 350-1000', 'DX 350-1500', 'DX 350-2000'],
    'DX 500 / 750 Heavy Duty': ['DX 500-1000', 'DX 500-1250', 'DX 500-2000', 'DX 750-1250', 'DX 750-3000'],
    'AX Turn-Mill Series': ['AX 200-M', 'AX 200-MY', 'AX 200-MSY', 'AX 300-M', 'AX 300-MY', 'AX 300-MSY'],
    'DXG Twin-Spindle Series': ['DXG 100', 'DXG 100i SP', 'DXG 200'],
    'AT / ATM / VST Series': ['AT 160', 'ATM 160', 'ATM 200', 'VST 160']
  },
  VMC: {
    'Tachyon Series (Drill-Tap)': ['Tachyon 4', 'Tachyon 5', 'Tachyon 7'],
    'Mill Tap Series': ['Mill Tap-10', 'Mill Tap-20', 'Mill Tap-30', 'Mill Tap-40'],
    'VMC Compact & Standard Series': [
      'VMC 430-3', 'VMC 430-4', 'VMC 430nvu',
      'VMC 640', 'VMC 850', 'VMC 850nvu',
      'VMC 1050', 'VMC 1060', 'VMC 1050 APC'
    ],
    'VMC Large Bed Series': ['VMC 1260nvu', 'VMC 1370nvu', 'VMC 1570', 'VMC 1580', 'VMC 1870', 'VMC 1880'],
    'PX / RX / RAX / RDX Series': [
      'PX 10', 'PX 20', 'PX 30', 'PX 40',
      'RX 10', 'RX 20', 'RX 30nvu', 'RAX 20',
      'RDX 10', 'RDX 20', 'RDX 30nvu'
    ],
    'K-Mill / K2X / KX High-Speed Series': ['K-Mill 8', 'K-Mill 10', 'K2X 8', 'K2X 10', 'K2X 20', 'KX 10', 'KX 30'],
    'EX / NX Gantry & Double Column': [
      'EX-F 1280', 'EX-F 1680', 'EX-F 2480',
      'EX-P / N-1280', 'EX-P / N-1680', 'EX-P / N-2480',
      'NX 2215', 'NX 3215', 'NX 3222', 'NX 4222',
      'NX 5232', 'NX 5240EY', 'NX 6232', 'NX 6240EY',
      'NX 8232', 'NX 8240EY', 'NX 10032', 'NX 10040EY'
    ]
  },
  HMC: {
    'HX Series': ['HX 400', 'HX 500', 'HX 510', 'HX 600', 'HX 610'],
    'HSX Series': ['HSX 860', 'HSX 1080', 'HSX 1210'],
    'HP Pallet Series': ['HP 4000', 'HP 5000', 'HP 6000']
  },
  VTL: {
    'VTL Compact Series': ['VTL 400', 'VTL 500-5', 'VTL 500-7'],
    'VTL Medium Series': ['VTL 750', 'VTL 750B'],
    'VTL Large RAM Series': ['VTL 900R', 'VTL 1200R', 'VTL 1600R']
  },
  '5-Axis / Multi-Tasking': {
    '5-Axis Machining Centers': [
      'Tachyon Beta', 'GU3 Five', 'GU5 Five', 'GU6 Five', 'GU8 Five',
      'ABX 40', 'ABX 60', 'U Mill 5', 'U Mill 6', 'K3X8 Five nvu', 'K2X10 Five'
    ],
    'KX / KXG 5-Axis Gantry': [
      'KX 50M', 'KX 50L', 'KX 100', 'KX 200', 'KX 300', 'KX 300L',
      'KXG 30-15', 'KXG 45-14', 'KXG 45-23', 'KXG 60-23', 'KXG 90-23'
    ],
    'MTX / MX / TMX Multi-Tasking': [
      'MTX 100-700', 'MTX 200-1050', 'MTX 200-1550',
      'MTX 300-1280', 'MTX 300-2150', 'MTX 300-3150',
      'MTX 400-2150', 'MTX 400-3150',
      'MX-8/MT', 'MX-10M/MT', 'MT-11M',
      'MX 12L M/MT', 'MX 16M/MT', 'MX20 M/MT',
      'TMX 200', 'AAX12'
    ]
  }
};

export const CONTROLLERS = ['Fanuc', 'Siemens', 'Mitsubishi'];

export const APPLICATION_PURPOSES = [
  'Component Trial',
  'Cycle Time Reduction',
  'Tooling / Process Trial',
  'Vibration / Chatter / Troubleshooting',
  'Programming / Macro',
  'Customer Training',
  'Fixture / Clamping Check'
];

export const CALL_TYPES = [
  'Site Visit',
  'Phone Call Support',
  'Online / WhatsApp Support',
  'Follow-up Visit',
];

export const CALL_STATUSES = [
  'Pending',
  'Solved / Closed',
  'Follow-up Required',
];

export const getMapTarget = (locationText) => {
  if (!locationText) return '';
  const coordMatch = locationText.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
  if (coordMatch) {
    return `${coordMatch[1]},${coordMatch[2]}`;
  }
  return locationText.trim();
};