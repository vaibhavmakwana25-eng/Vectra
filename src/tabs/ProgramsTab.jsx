import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../db';
import { FileCode, Share2, Copy, Check, Save, Layers } from 'lucide-react';
import { JYOTI_MACHINE_CASCADE, CONTROLLERS } from './cncConstants';
import { CYCLE_TEMPLATES } from './cycleTemplatesData';
import CncSimulator from './CncSimulator';

const PROGRAM_MODES = [
  'Canned Cycle Program',
  'Macro Program (Custom Variables)',
  'ISO G-Code and M-Code',
  'ISO + Canned Cycle',
  'ISO + Macro Program',
  'Macro + Canned Cycle'
];

function classifyTemplate(domainKey, name) {
  const n = name.toUpperCase();
  if (domainKey === 'Turning') {
    let op = 'Turning';
    if (n.includes('THREAD')) op = 'Threading';
    else if (n.includes('GROOV') || n.includes('PARTING')) op = 'Grooving & Parting';
    else if (n.includes('FACING')) op = 'Facing';
    else if (n.includes('DRILL') || n.includes('TAP') || n.includes('REAM')) op = 'Drilling & Tapping';

    let side = 'OD';
    if (
      n.includes(' ID ') ||
      n.startsWith('G71 ID') ||
      n.startsWith('G70 ID') ||
      n.startsWith('G72 ID') ||
      n.startsWith('G75 ID') ||
      n.startsWith('G76 ID') ||
      n.startsWith('G90 SINGLE-PASS ID') ||
      n.startsWith('CYCLE95 ID') ||
      n.startsWith('CYCLE93 ID') ||
      n.startsWith('CYCLE97 ID')
    ) {
      side = 'ID';
    } else if (n.includes('FACE') || n.includes('FRONT') || n.includes('DRILL') || n.includes('TAP') || n.includes('REAM') || n.includes('G94')) {
      side = 'Face';
    }
    return { op, side };
  } else {
    let op = 'Drilling';
    if (n.includes('TAP')) op = 'Tapping';
    else if (n.includes('BOR') || n.includes('REAM')) op = 'Boring & Reaming';
    else if (n.includes('MILL') || n.includes('POCKET') || n.includes('SPIGOT') || n.includes('SLOT')) op = 'Milling & Pocket';

    let side = 'Standard';
    if (n.includes('POCKET') || n.includes('SLOT') || n.includes('SPIGOT')) side = 'Pocket & Boss';
    else if (n.includes('DEEP') || n.includes('PECK') || n.includes('CHIP') || n.includes('FINE') || n.includes('BACK')) side = 'Deep & Precision';
    return { op, side };
  }
}

function adaptCodeForMode(baseCode, mode, controller, domainKey, operation, workSide) {
  if (!baseCode || mode === 'Canned Cycle Program') return baseCode;

  const isSiemens = controller === 'Siemens';
  const cmt = (txt) => (isSiemens ? `; ${txt}` : `(${txt})`);

  if (mode === 'Macro Program (Custom Variables)') {
    if (isSiemens) {
      if (domainKey === 'Turning') {
        return `; SIEMENS R-VARIABLE IF-GOTOB MACRO - ${operation.toUpperCase()} (${workSide})
R1=50.0  ; START DIAMETER
R2=36.0  ; FINAL DIAMETER
R3=1.5   ; RADIAL DEPTH OF CUT
R4=-45.0 ; TARGET Z LENGTH
R5=0.25  ; FEED RATE MM/REV
G21 G90 G95 G40
G75 X0 Z0
T="CNMG_ROUGH" D1
G96 S180 LIMS=2500 M3
R10=R1
LOOP_CUT:
R10=R10-(R3*2)
IF R10<R2
  R10=R2
ENDIF
G00 X=R10+2 Z2 M8
G01 X=R10 F=R5
G01 Z=R4
G00 X=R10+3
G00 Z2
IF R10>R2 GOTOB LOOP_CUT
G75 X0 Z0 M9
M5
M30`;
      }
      return `; SIEMENS R-VARIABLE IF-GOTOB MACRO - ${operation.toUpperCase()}
R1=-30.0 ; TARGET DEPTH Z
R2=4.0   ; PECK STEP
R3=3.0   ; R-PLANE CLEARANCE
R4=220.0 ; FEED RATE
R10=0.0  ; CURRENT Z DEPTH
G21 G17 G90 G94 G40
G75 Z0
T="TOOL_01" D1
M6
G54 G00 X0 Y0
S1800 M3 M8
G00 Z=R3
NEXT_PECK:
R10=R10-R2
IF R10<R1
  R10=R1
ENDIF
G01 Z=R10 F=R4
G00 Z=R3
IF R10>R1 GOTOB NEXT_PECK
G75 Z0 M9
M5
M30`;
    } else {
      if (domainKey === 'Turning') {
        return `O9001 (${controller.toUpperCase()} IF-GOTO MACRO - ${operation.toUpperCase()} ${workSide})
#101 = 50.0  (START DIAMETER)
#102 = 36.0  (FINAL DIAMETER)
#103 = 1.5   (RADIAL DEPTH OF CUT)
#104 = -45.0 (TARGET Z LENGTH)
#105 = 0.25  (FEED MM PER REV)
G21 G40 G99
G28 U0. W0.
T0101
G50 S2500
G96 S180 M03
#110 = #101
N10 (LOOP START)
#110 = #110 - [#103 * 2.0]
IF [#110 LT #102] THEN #110 = #102
G00 X[#110 + 2.0] Z2.0 M08
G01 X#110 F#105
G01 Z#104
G00 X[#110 + 3.0]
G00 Z2.0
IF [#110 GT #102] GOTO10
G00 X100.0 Z100.0 M09
G28 U0. W0.
M05
M30`;
      }
      return `O9002 (${controller.toUpperCase()} IF-GOTO MACRO - ${operation.toUpperCase()})
#101 = -30.0 (TARGET DEPTH Z)
#102 = 4.0   (PECK STEP Q)
#103 = 3.0   (R-PLANE CLEARANCE)
#104 = 220.0 (FEED RATE)
G21 G17 G40 G49 G80 G90
G91 G28 Z0.0
T01 M06
G90 G54 G00 X0.0 Y0.0
S1800 M03
G43 H01 Z10.0 M08
#110 = 0.0
N10 (PECK LOOP)
#110 = #110 - #102
IF [#110 LT #101] THEN #110 = #101
G00 Z[#110 + #102 + 1.0]
G01 Z#110 F#104
G00 Z#103
IF [#110 GT #101] GOTO10
G00 Z50.0 M09
G91 G28 Z0.0
M05
M30`;
    }
  }

  if (mode === 'ISO G-Code and M-Code') {
    if (domainKey === 'Turning') {
      return `${cmt(`ISO G-CODE & M-CODE (${controller.toUpperCase()} - ${workSide})`)}
${isSiemens ? 'G21 G90 G95 G40\nG75 X0 Z0\nT="ISO_TOOL" D1\nG96 S200 LIMS=2800 M3' : 'O3001 (ISO LINEAR G01 G02 G03)\nG21 G40 G99\nG28 U0. W0.\nT0101\nG50 S2800\nG96 S200 M03'}
G00 X52.0 Z2.0 M08
G01 X20.0 Z0.0 F0.15
G01 X24.0 Z-2.0
G01 Z-25.0
G02 X34.0 Z-30.0 R5.0
G01 X40.0
G01 Z-50.0
G00 X55.0 Z10.0 M09
${isSiemens ? 'G75 X0 Z0\nM5\nM30' : 'G28 U0. W0.\nM05\nM30'}`;
    }
    return `${cmt(`ISO G-CODE & M-CODE MILLING (${controller.toUpperCase()})`)}
${isSiemens ? 'G21 G17 G90 G94 G40\nG75 Z0\nT="ENDMILL_12" D1\nM6\nG54 G00 X0 Y0\nS2400 M3 M8\nG00 Z10' : 'O3002 (ISO LINEAR & CIRCULAR MILLING)\nG21 G17 G40 G49 G80 G90\nG91 G28 Z0.0\nT01 M06\nG90 G54 G00 X0.0 Y0.0\nS2400 M03\nG43 H01 Z10.0 M08'}
G01 Z-5.0 F200.0
G41 D01 X25.0 Y0.0 F450.0
G01 Y40.0
G02 X35.0 Y50.0 R10.0
G01 X70.0
G01 Y0.0
G40 G01 X0.0 Y0.0
G00 Z50.0 M09
${isSiemens ? 'G75 Z0\nM5\nM30' : 'G91 G28 Z0.0\nM05\nM30'}`;
  }

  if (mode === 'ISO + Canned Cycle') {
    const isoHeader = isSiemens
      ? `; ISO FACE PASS + CANNED CYCLE\nG00 X52 Z2 M8\nG01 X-1 Z0 F0.15\n`
      : `(ISO FACE PASS + CANNED CYCLE)\nG00 X52.0 Z2.0 M08\nG01 X-1.0 Z0.0 F0.15\n`;
    return `${isoHeader}${baseCode}`;
  }

  if (mode === 'ISO + Macro Program') {
    const vars = isSiemens
      ? `; SIEMENS R-VARIABLES + ISO G-CODE\nR1=0.0 ; X SHIFT OFFSET\nR2=0.0 ; Z SHIFT OFFSET\n`
      : `(${controller.toUpperCase()} MACRO VARIABLES + ISO G-CODE)\n#501 = 0.0 (X SHIFT OFFSET)\n#502 = 0.0 (Z SHIFT OFFSET)\n`;
    return `${vars}${adaptCodeForMode(baseCode, 'ISO G-Code and M-Code', controller, domainKey, operation, workSide)}`;
  }

  if (mode === 'Macro + Canned Cycle') {
    if (isSiemens) {
      return `; SIEMENS R-VARIABLE IF-GOTOB + CANNED CYCLE\nR1=5 ; BATCH QUANTITY\nR2=1 ; CURRENT PART\nLOOP_PART:\n${baseCode.replace(/\nM30\s*$/, '')}\nR2=R2+1\nIF R2<=R1 GOTOB LOOP_PART\nM30`;
    }
    return `(${controller.toUpperCase()} IF-GOTO MACRO + CANNED CYCLE)\n#500 = 5 (BATCH QUANTITY)\n#501 = 1 (CURRENT PART)\nN10 (BATCH LOOP)\n${baseCode.replace(/\nM30\s*$/, '')}\n#501 = #501 + 1\nIF [#501 LE #500] GOTO10\nM30`;
  }

  return baseCode;
}

export default function ProgramsTab({ programs = [], refreshAllData, shareOnWhatsApp }) {
  const categories = Object.keys(JYOTI_MACHINE_CASCADE);
  const initialCategory = categories[0] || 'Turning';
  const initialSeries = Object.keys(JYOTI_MACHINE_CASCADE[initialCategory])[0];
  const initialModel = JYOTI_MACHINE_CASCADE[initialCategory][initialSeries][0];

  const [controller, setController] = useState(CONTROLLERS[0] || 'Fanuc');
  const [machineType, setMachineType] = useState(initialCategory);
  const [machineSeries, setMachineSeries] = useState(initialSeries);
  const [machineModel, setMachineModel] = useState(initialModel);
  const [operation, setOperation] = useState('Turning');
  const [workSide, setWorkSide] = useState('OD');
  const [programMode, setProgramMode] = useState(PROGRAM_MODES[0]);
  const [selectedTemplateIdx, setSelectedTemplateIdx] = useState(0);
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);

  const domainKey = machineType === 'Turning' ? 'Turning' : 'Milling';

  const enrichedTemplates = useMemo(() => {
    const byDomain = CYCLE_TEMPLATES[domainKey] || CYCLE_TEMPLATES.Turning;
    const rawList = byDomain[controller] || byDomain.Fanuc || [];
    return rawList.map((item) => ({
      ...item,
      ...classifyTemplate(domainKey, item.name)
    }));
  }, [domainKey, controller]);

  const operationOptions = useMemo(() => {
    return [...new Set(enrichedTemplates.map((t) => t.op))];
  }, [enrichedTemplates]);

  useEffect(() => {
    if (!operationOptions.includes(operation) && operationOptions.length > 0) {
      setOperation(operationOptions[0]);
    }
  }, [operationOptions, operation]);

  const sideOptions = useMemo(() => {
    const filteredByOp = enrichedTemplates.filter((t) => t.op === operation);
    const sides = [...new Set(filteredByOp.map((t) => t.side))];
    return sides.length > 0 ? sides : ['OD'];
  }, [enrichedTemplates, operation]);

  useEffect(() => {
    if (!sideOptions.includes(workSide) && sideOptions.length > 0) {
      setWorkSide(sideOptions[0]);
    }
  }, [sideOptions, workSide]);

  const filteredTemplates = useMemo(() => {
    const exact = enrichedTemplates.filter((t) => t.op === operation && t.side === workSide);
    if (exact.length > 0) return exact;
    const byOp = enrichedTemplates.filter((t) => t.op === operation);
    return byOp.length > 0 ? byOp : enrichedTemplates;
  }, [enrichedTemplates, operation, workSide]);

  useEffect(() => {
    setSelectedTemplateIdx(0);
    if (filteredTemplates[0]) {
      setTitle(filteredTemplates[0].name + ' [' + programMode + ']');
      setCode(adaptCodeForMode(filteredTemplates[0].code, programMode, controller, domainKey, operation, workSide));
    }
  }, [filteredTemplates, programMode, controller, domainKey, operation, workSide]);

  const handleCategoryChange = (cat) => {
    setMachineType(cat);
    const firstSeries = Object.keys(JYOTI_MACHINE_CASCADE[cat])[0];
    const firstModel = JYOTI_MACHINE_CASCADE[cat][firstSeries][0];
    setMachineSeries(firstSeries);
    setMachineModel(firstModel);
  };

  const handleSeriesChange = (ser) => {
    setMachineSeries(ser);
    setMachineModel(JYOTI_MACHINE_CASCADE[machineType][ser][0]);
  };

  const handleTemplateChange = (idx) => {
    const i = Number(idx);
    setSelectedTemplateIdx(i);
    if (filteredTemplates[i]) {
      setTitle(filteredTemplates[i].name + ' [' + programMode + ']');
      setCode(adaptCodeForMode(filteredTemplates[i].code, programMode, controller, domainKey, operation, workSide));
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
      machineType: machineType + ' (' + machineModel + ')',
      controller,
      operation: operation + ' • ' + workSide + ' • ' + programMode,
      code,
      notes: '',
      createdAt: new Date().toISOString().split('T')[0],
      synced: false
    });
    if (refreshAllData) refreshAllData();
  };

  return (
    <div className="space-y-4 pb-24">
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3.5 shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-base">
            <FileCode className="w-5 h-5" />
            <span>CNC Program Studio & Vault</span>
          </div>
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
            {controller} • {machineModel}
          </span>
        </div>

        {/* LINE 1: Controller | Machine Category | Machine Series */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Controller</label>
            <select
              value={controller}
              onChange={(e) => setController(e.target.value)}
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
        </div>

        {/* LINE 2: Machine Model | Operation | OD / ID Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Operation</label>
            <select
              value={operation}
              onChange={(e) => setOperation(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-cyan-500 outline-none"
            >
              {operationOptions.map((op) => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              {domainKey === 'Turning' ? 'Machining Side (OD / ID)' : 'Cycle Type'}
            </label>
            <select
              value={workSide}
              onChange={(e) => setWorkSide(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-cyan-500 outline-none"
            >
              {sideOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* LINE 3: Program Structure Mode Cascade */}
        <div>
          <label className="block text-[11px] font-semibold text-cyan-300 mb-1">
            Program Structure Mode (Cycle • Macro • ISO G-Code & M-Code)
          </label>
          <select
            value={programMode}
            onChange={(e) => setProgramMode(e.target.value)}
            className="w-full bg-slate-950 border border-cyan-500/40 rounded-xl px-3 py-2.5 text-sm text-white focus:border-cyan-400 outline-none"
          >
            {PROGRAM_MODES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* Quick Cycle Template Box */}
        <div className="bg-slate-950/80 border border-cyan-500/30 rounded-xl p-3 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
            <Layers className="w-4 h-4" />
            <span>Quick Template ({controller} • {operation} • {workSide} • {programMode})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Select Cycle Sample</label>
              <select
                value={selectedTemplateIdx}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-cyan-500 outline-none"
              >
                {filteredTemplates.map((tpl, idx) => (
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

        {/* G-Code Editor + Action Bar (Full Expanded View) */}
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 items-stretch">
            <textarea
              rows="28"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full min-h-[560px] bg-slate-950 border border-slate-700 rounded-xl p-4 text-xs font-mono text-emerald-300 leading-relaxed focus:border-cyan-500 outline-none"
              required
            />
            <CncSimulator
              code={code}
              domainKey={domainKey}
              workSide={workSide}
              operation={operation}
              controller={controller}
            />
          </div>

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
                    onClick={() => shareOnWhatsApp('*CNC Program: ' + p.title + '* (' + p.controller + ')\n\n' + p.code)}
                    className="p-2 bg-emerald-600/20 text-emerald-400 rounded-lg"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <pre className="bg-slate-950 p-3 rounded-lg text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-60">
              {p.code}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}

