import React, { useState, useMemo } from 'react';
import { db } from '../db';
import { FileCode, Share2, Copy, Check, Save, Layers } from 'lucide-react';
import { JYOTI_MACHINE_CASCADE, CONTROLLERS } from './cncConstants';

const CYCLE_TEMPLATES = {
  Turning: {
    Fanuc: [
      {
        name: 'G71 OD Rough & G70 Finish Cycle',
        code: `O1001 (FANUC OD ROUGH & FINISH)
G21 G40 G99
G28 U0. W0.
T0101 (CNMG 120408 ROUGH)
G50 S2500
G96 S180 M03
G00 X52.0 Z2.0 M08
G71 U1.5 R0.5
G71 P10 Q20 U0.4 W0.1 F0.28
N10 G00 X20.0
G01 Z0.0 F0.15
G01 X24.0 Z-2.0
G01 Z-25.0
G01 X38.0
G01 X40.0 Z-26.0
G01 Z-50.0
N20 G01 X52.0
G00 X100.0 Z100.0 M09
M05
T0202 (DNMG 150404 FINISH)
G50 S3000
G96 S220 M03
G00 X52.0 Z2.0 M08
G70 P10 Q20
G28 U0. W0. M09
M05
M30`
      },
      {
        name: 'G76 External Threading Cycle',
        code: `O1002 (FANUC G76 THREADING M20X2.5)
G21 G40 G99
G28 U0. W0.
T0303 (EXTERNAL THREAD INSERT)
G97 S800 M03
G00 X22.0 Z5.0 M08
G76 P020060 Q100 R0.05
G76 X16.93 Z-30.0 P1534 Q350 F2.5
G00 X100.0 Z100.0 M09
G28 U0. W0.
M05
M30`
      },
      {
        name: 'G74 Deep Hole Peck Drilling',
        code: `O1003 (FANUC G74 PECK DRILLING)
G21 G40 G99
G28 U0. W0.
T0404 (DRILL DIA 12.0MM)
G97 S1100 M03
G00 X0.0 Z3.0 M08
G74 R1.0
G74 Z-45.0 Q4000 F0.12
G00 Z10.0 M09
G28 U0. W0.
M05
M30`
      },
      {
        name: 'G84 Rigid Tapping Cycle',
        code: `O1004 (FANUC G84 RIGID TAPPING M10X1.5)
G21 G40 G99
G28 U0. W0.
T0505 (TAP M10X1.5)
G97 S300 M03
G00 X0.0 Z5.0 M08
M29 S300
G84 Z-20.0 R3.0 F1.5
G80
G00 Z15.0 M09
G28 U0. W0.
M05
M30`
      },
      {
        name: 'G75 OD Grooving / Parting Cycle',
        code: `O1005 (FANUC G75 OD GROOVING)
G21 G40 G99
G28 U0. W0.
T0606 (3MM GROOVING TOOL)
G97 S900 M03
G00 X42.0 Z-20.0 M08
G75 R0.5
G75 X30.0 Z-25.0 P2000 Q2500 F0.08
G00 X50.0 M09
G28 U0. W0.
M05
M30`
      }
    ],
    Siemens: [
      {
        name: 'CYCLE95 Stock Removal (Rough & Finish)',
        code: `; SIEMENS 828D/840D TURNING CYCLE95
G21 G90 G95 G40
G75 X0 Z0
T="CNMG_ROUGH" D1
G96 S180 LIMS=2500 M3
G00 X52 Z2 M8
CYCLE95("CONTOUR_1",1.5,0.4,0.1,0.1,0.28,0.18,0.15,9,0,0,0)
G75 X0 Z0 M9
M5
M30

; SUBPROGRAM CONTOUR_1.SPF
; G1 X20 Z0
; G1 Z-25
; G1 X40
; G1 Z-50
; RET`
      },
      {
        name: 'CYCLE97 External Threading',
        code: `; SIEMENS CYCLE97 THREADING M20X2.5
G21 G90 G95 G40
G75 X0 Z0
T="EXT_THREAD" D1
G97 S800 M3
G00 X22 Z5 M8
CYCLE97(2.5,0,0,-30,20,20,5,2,1.53,0.05,30,0,8,2,3,1)
G75 X0 Z0 M9
M5
M30`
      },
      {
        name: 'CYCLE83 Deep Hole Peck Drilling',
        code: `; SIEMENS CYCLE83 PECK DRILLING
G21 G90 G95 G40
G75 X0 Z0
T="DRILL_12" D1
G97 S1100 M3
G00 X0 Z3 M8
CYCLE83(3,0,2,-45,0,-8,0,0,0,0,1,0,0,4,0,0,1,0)
G75 X0 Z0 M9
M5
M30`
      },
      {
        name: 'CYCLE84 Rigid Tapping',
        code: `; SIEMENS CYCLE84 RIGID TAPPING M10X1.5
G21 G90 G95 G40
G75 X0 Z0
T="TAP_M10" D1
G97 S300 M3
G00 X0 Z5 M8
CYCLE84(5,0,3,-20,0,0,3,1.5,0,300,300,0,1,0,0,0)
G75 X0 Z0 M9
M5
M30`
      }
    ],
    Mitsubishi: [
      {
        name: 'G71 OD Roughing & G70 Finishing',
        code: `O1001 (MITSUBISHI OD ROUGH & FINISH)
G21 G40 G99
G28 U0. W0.
T0101
G50 S2500
G96 S180 M03
G00 X52.0 Z2.0 M08
G71 U1.5 R0.5
G71 P10 Q20 U0.4 W0.1 F0.28
N10 G00 X20.0
G01 Z0.0 F0.15
G01 Z-25.0
G01 X40.0
G01 Z-50.0
N20 G01 X52.0
G70 P10 Q20
G28 U0. W0. M09
M05
M30`
      },
      {
        name: 'G76 Threading & G84 Tapping',
        code: `O1002 (MITSUBISHI RIGID TAPPING M10X1.5)
G21 G40 G99
G28 U0. W0.
T0505
G97 S300 M03
G00 X0.0 Z5.0 M08
G84 Z-20.0 R3.0 F1.5 ,R1
G80
G28 U0. W0. M09
M05
M30`
      }
    ]
  },
  Milling: {
    Fanuc: [
      {
        name: 'Face Milling (G54 Work Offset)',
        code: `O2001 (FANUC VMC FACE MILLING)
G21 G17 G40 G49 G80 G90
G91 G28 Z0.0
T01 M06 (63MM FACE MILL)
G90 G54 G00 X-45.0 Y25.0
S1400 M03
G43 H01 Z10.0 M08
G01 Z-1.0 F300.0
G01 X110.0 F650.0
G00 Y-25.0
G01 X-45.0
G00 Z50.0 M09
G91 G28 Z0.0
M05
M30`
      },
      {
        name: 'G83 Deep Hole Peck Drilling',
        code: `O2002 (FANUC VMC G83 PECK DRILLING)
G21 G17 G40 G49 G80 G90
G91 G28 Z0.0
T02 M06 (10.2MM CARBIDE DRILL)
G90 G54 G00 X0.0 Y0.0
S1800 M03
G43 H02 Z10.0 M08
G98 G83 Z-32.0 R3.0 Q4.0 F220.0
X40.0 Y0.0
X40.0 Y40.0
X0.0 Y40.0
G80
G00 Z50.0 M09
G91 G28 Z0.0
M05
M30`
      },
      {
        name: 'G84 Rigid Tapping Cycle',
        code: `O2003 (FANUC VMC G84 RIGID TAPPING M12X1.75)
G21 G17 G40 G49 G80 G90
G91 G28 Z0.0
T03 M06 (M12X1.75 TAP)
G90 G54 G00 X0.0 Y0.0
G43 H03 Z10.0 M08
M29 S350
G98 G84 Z-22.0 R3.0 F612.5
X40.0 Y0.0
G80
G00 Z50.0 M09
G91 G28 Z0.0
M05
M30`
      },
      {
        name: 'Helical Circular Pocket Milling',
        code: `O2004 (FANUC HELICAL BORE DIA 30MM)
G21 G17 G40 G49 G80 G90
G91 G28 Z0.0
T04 M06 (12MM ENDMILL)
G90 G54 G00 X0.0 Y0.0
S2800 M03
G43 H04 Z5.0 M08
G01 Z0.0 F300.0
G01 X9.0 F450.0
G03 I-9.0 Z-2.0
G03 I-9.0 Z-4.0
G03 I-9.0 Z-6.0
G03 I-9.0 Z-6.0
G01 X0.0 Y0.0
G00 Z50.0 M09
G91 G28 Z0.0
M05
M30`
      }
    ],
    Siemens: [
      {
        name: 'CYCLE71 Face Milling',
        code: `; SIEMENS 828D/840D FACE MILLING CYCLE71
G21 G17 G90 G94 G40
G75 Z0
T="FACE_MILL_63" D1
M6
G54 G00 X0 Y0
S1400 M3 M8
G00 Z10
CYCLE71(10,0,2,-1.5,0,0,100,60,0,1.5,40,0.4,650,11,5,2)
G75 Z0 M9
M5
M30`
      },
      {
        name: 'CYCLE83 Deep Hole Peck Drilling',
        code: `; SIEMENS VMC CYCLE83 PECK DRILLING
G21 G17 G90 G94 G40
G75 Z0
T="DRILL_10_2" D1
M6
G54 G00 X0 Y0
S1800 M3 M8
G00 Z10
MCALL CYCLE83(10,0,3,-32,0,-4,0,0,0,0,1,0,0,4,0,0,1,220)
X0 Y0
X40 Y0
X40 Y40
X0 Y40
MCALL
G75 Z0 M9
M5
M30`
      },
      {
        name: 'CYCLE84 Rigid Tapping',
        code: `; SIEMENS VMC CYCLE84 RIGID TAPPING M12X1.75
G21 G17 G90 G94 G40
G75 Z0
T="TAP_M12" D1
M6
G54 G00 X0 Y0
S350 M3 M8
G00 Z10
MCALL CYCLE84(10,0,3,-22,0,0,3,1.75,0,350,350,0,1,0,0,0)
X0 Y0
X40 Y0
MCALL
G75 Z0 M9
M5
M30`
      },
      {
        name: 'POCKET4 Circular Pocket Milling',
        code: `; SIEMENS POCKET4 CIRCULAR POCKET DIA 30MM
G21 G17 G90 G94 G40
G75 Z0
T="ENDMILL_12" D1
M6
G54 G00 X0 Y0
S2800 M3 M8
G00 Z10
POCKET4(10,0,2,-8,15,0,0,2,0.2,0.1,450,250,0,11,4,0,0,2,2)
G75 Z0 M9
M5
M30`
      }
    ],
    Mitsubishi: [
      {
        name: 'G83 Peck Drilling & G84 Rigid Tapping',
        code: `O2001 (MITSUBISHI VMC DRILL & TAP)
G21 G17 G40 G49 G80 G90
G91 G28 Z0.0
T02 M06 (DRILL 10.2MM)
G90 G54 G00 X0.0 Y0.0
S1800 M03
G43 H02 Z10.0 M08
G98 G83 Z-30.0 R3.0 Q4.0 F220.0
X40.0 Y0.0
G80
G00 Z50.0 M09
G91 G28 Z0.0
M05
M30`
      }
    ]
  }
};

export default function ProgramsTab({ programs = [], refreshAllData, shareOnWhatsApp }) {
  const categories = Object.keys(JYOTI_MACHINE_CASCADE);
  const initialCategory = categories[0] || 'Turning';
  const initialSeries = Object.keys(JYOTI_MACHINE_CASCADE[initialCategory])[0];
  const initialModel = JYOTI_MACHINE_CASCADE[initialCategory][initialSeries][0];

  const [controller, setController] = useState(CONTROLLERS[0] || 'Fanuc');
  const [machineType, setMachineType] = useState(initialCategory);
  const [machineSeries, setMachineSeries] = useState(initialSeries);
  const [machineModel, setMachineModel] = useState(initialModel);
  const [selectedTemplateIdx, setSelectedTemplateIdx] = useState(0);
  const [title, setTitle] = useState('G71 OD Rough & G70 Finish Cycle');
  const [code, setCode] = useState(CYCLE_TEMPLATES.Turning.Fanuc[0].code);
  const [copied, setCopied] = useState(false);

  const domainKey = machineType === 'Turning' ? 'Turning' : 'Milling';
  const availableTemplates = useMemo(() => {
    const byDomain = CYCLE_TEMPLATES[domainKey] || CYCLE_TEMPLATES.Turning;
    return byDomain[controller] || byDomain.Fanuc;
  }, [domainKey, controller]);

  const handleControllerChange = (val) => {
    setController(val);
    const byDomain = CYCLE_TEMPLATES[domainKey] || CYCLE_TEMPLATES.Turning;
    const list = byDomain[val] || byDomain.Fanuc;
    setSelectedTemplateIdx(0);
    setTitle(list[0].name);
    setCode(list[0].code);
  };

  const handleCategoryChange = (cat) => {
    setMachineType(cat);
    const firstSeries = Object.keys(JYOTI_MACHINE_CASCADE[cat])[0];
    const firstModel = JYOTI_MACHINE_CASCADE[cat][firstSeries][0];
    setMachineSeries(firstSeries);
    setMachineModel(firstModel);

    const newDomain = cat === 'Turning' ? 'Turning' : 'Milling';
    const list = CYCLE_TEMPLATES[newDomain][controller] || CYCLE_TEMPLATES[newDomain].Fanuc;
    setSelectedTemplateIdx(0);
    setTitle(list[0].name);
    setCode(list[0].code);
  };

  const handleSeriesChange = (ser) => {
    setMachineSeries(ser);
    setMachineModel(JYOTI_MACHINE_CASCADE[machineType][ser][0]);
  };

  const handleTemplateChange = (idx) => {
    const i = Number(idx);
    setSelectedTemplateIdx(i);
    if (availableTemplates[i]) {
      setTitle(availableTemplates[i].name);
      setCode(availableTemplates[i].code);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const saveProgram = async (e) => {
    e.preventDefault();
    if (!title || !code) return;
    await db.programs.add({
      title,
      machineType: `${machineType} (${machineModel})`,
      controller,
      operation: availableTemplates[selectedTemplateIdx]?.name || 'Custom',
      code,
      notes: '',
      createdAt: new Date().toISOString().split('T')[0],
      synced: false
    });
    if (refreshAllData) refreshAllData();
  };

  return (
    <div className="space-y-4 pb-24">
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-4 shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-base">
            <FileCode className="w-5 h-5" />
            <span>CNC Program Studio & Vault</span>
          </div>
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
            {controller} • {machineModel}
          </span>
        </div>

        {/* Cascading Controller & Jyoti Machine Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Controller</label>
            <select
              value={controller}
              onChange={(e) => handleControllerChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-cyan-500 outline-none"
            >
              {CONTROLLERS.map((ctrl) => (
                <option key={ctrl} value={ctrl}>{ctrl}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Machine Category</label>
            <select
              value={machineType}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-cyan-500 outline-none"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Machine Series</label>
            <select
              value={machineSeries}
              onChange={(e) => handleSeriesChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-cyan-500 outline-none"
            >
              {Object.keys(JYOTI_MACHINE_CASCADE[machineType]).map((ser) => (
                <option key={ser} value={ser}>{ser}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Machine Model</label>
            <select
              value={machineModel}
              onChange={(e) => setMachineModel(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-cyan-500 outline-none"
            >
              {JYOTI_MACHINE_CASCADE[machineType][machineSeries].map((mod) => (
                <option key={mod} value={mod}>{mod}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Cycle Template Cascade */}
        <div className="bg-slate-950/80 border border-cyan-500/30 rounded-xl p-3 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
            <Layers className="w-4 h-4" />
            <span>Quick Cycle Template ({controller} - {domainKey})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Select Operation Sample</label>
              <select
                value={selectedTemplateIdx}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-cyan-500 outline-none"
              >
                {availableTemplates.map((tpl, idx) => (
                  <option key={tpl.name} value={idx}>{tpl.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Program Name / Part No</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter Part No or Program Title"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-cyan-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* G-Code Editor + Action Bar */}
        <form onSubmit={saveProgram} className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Sample / Active G-Code</span>
            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-cyan-300 font-semibold flex items-center gap-1.5 border border-slate-700"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy Code'}
            </button>
          </div>

          <textarea
            rows="11"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-xs font-mono text-emerald-300 leading-relaxed focus:border-cyan-500 outline-none"
            required
          />

          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition"
          >
            <Save className="w-4 h-4" /> Save Program to Vault
          </button>
        </form>
      </div>

      {/* Saved Programs Vault */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
          Saved Programs Vault ({programs.length})
        </h3>
        {programs.map((p) => (
          <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-bold text-white text-sm">{p.title}</h4>
                <span className="text-xs text-cyan-400">{p.machineType} • {p.controller}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTitle(p.title);
                    setCode(p.code);
                  }}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-lg text-xs font-semibold"
                >
                  Load
                </button>
                {shareOnWhatsApp && (
                  <button
                    type="button"
                    onClick={() => shareOnWhatsApp(`*CNC Program: ${p.title}* (${p.controller})\n\n${p.code}`)}
                    className="p-2 bg-emerald-600/20 text-emerald-400 rounded-lg"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <pre className="bg-slate-950 p-3 rounded-lg text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-40">
              {p.code}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
