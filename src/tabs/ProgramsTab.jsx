import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../db';
import { FileCode, Share2, Copy, Check, Save, Layers, Wrench } from 'lucide-react';
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

const MACHINING_STAGES = [
  'Rough + Finish Combined',
  'Roughing Only (Stock Leave)',
  'Wall Finish Only',
  'Wall + Bottom Finish',
  'Chamfering Pass'
];

const AREA_TYPES = [
  'Blind Area (Solid Stock)',
  'Through Area (Open)',
  'Pre-Cast Wall Only'
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
    if (n.includes('CIRCULAR POCKET')) side = 'Circular Pocket';
    else if (n.includes('RECTANGULAR POCKET')) side = 'Rectangular Pocket';
    else if (n.includes('CIRCULAR SPIGOT')) side = 'Circular Spigot';
    else if (n.includes('RECTANGULAR SPIGOT')) side = 'Rectangular Spigot';
    else if (n.includes('SLOT')) side = 'Slot Milling';
    else if (n.includes('DEEP') || n.includes('PECK') || n.includes('CHIP') || n.includes('FINE') || n.includes('BACK')) side = 'Deep & Precision';
    return { op, side };
  }
}

function generateProcessHeader(controller, domainKey, operation, workSide, mfgCfg) {
  const isS = controller === 'Siemens';
  const c = (t) => (isS ? `; ${t}` : `(${t})`);
  const lines = [
    c(`WORKPIECE: ${domainKey === 'Turning' ? `RAW OD=${mfgCfg.stockX}MM, FIN=${mfgCfg.stockY}MM, LEN=${mfgCfg.stockZ}MM` : `STOCK ${mfgCfg.stockX}X${mfgCfg.stockY}X${mfgCfg.stockZ}MM, DEPTH=${mfgCfg.featureDepth}MM`}`),
    c(`AREA: ${mfgCfg.areaType} | STAGE: ${mfgCfg.machiningStage}`),
    c(`MAIN TOOL: DIA ${mfgCfg.toolDia}MM | ${mfgCfg.toolFlutes} FLUTES | FLUTE LEN ${mfgCfg.toolLength}MM`),
    c(`FINISH ALLOWANCE: WALL=${mfgCfg.wallAllowance}MM | BOTTOM=${mfgCfg.bottomAllowance}MM`),
    c(`CHAMFER TOOL: DIA ${mfgCfg.chamferDia}MM | ${mfgCfg.chamferAngle} DEG | CHAMFER C${mfgCfg.chamferSize}MM`)
  ];
  return lines.join('\n');
}

function adaptCodeForMode(baseCode, mode, controller, domainKey, operation, workSide, mfgCfg) {
  if (!baseCode) return '';
  const isSiemens = controller === 'Siemens';
  const cmt = (txt) => (isSiemens ? `; ${txt}` : `(${txt})`);
  const header = generateProcessHeader(controller, domainKey, operation, workSide, mfgCfg);
  const stage = mfgCfg.machiningStage;

  // Dedicated Stage Programs (Wall Finish / Wall+Bottom Finish / Chamfering)
  if (stage === 'Wall Finish Only' || stage === 'Wall + Bottom Finish') {
    const finDepth = stage === 'Wall Finish Only'
      ? -(Number(mfgCfg.featureDepth) - Number(mfgCfg.bottomAllowance)).toFixed(2)
      : -Number(mfgCfg.featureDepth).toFixed(2);
    if (isSiemens) {
      return `${header}
; SIEMENS ${stage.toUpperCase()} PROGRAM
G21 G17 G90 G94 G40
G75 Z0
T="FIN_CUTTER_D${mfgCfg.toolDia}" D1
M6
G54 G00 X0 Y0
S3200 M3 M8
G00 Z5
G01 Z=${finDepth} F180
${stage === 'Wall + Bottom Finish' ? `; BOTTOM FLOOR WIPE PASS\nG01 X15 Y0 F420\nG03 I-15 J0\n` : `; SKIP BOTTOM FLOOR (WALL FINISH ONLY)\n`}; SIDE WALL FINISH PASS (REMOVING ${mfgCfg.wallAllowance}MM STOCK)
G41 G01 X22 Y0 F380
G03 I-22 J0
G40 G01 X0 Y0
G00 Z50 M9
M5
M30`;
    }
    return `O4101 (${controller.toUpperCase()} ${stage.toUpperCase()} PROGRAM)
${header}
G21 G17 G40 G49 G80 G90
G91 G28 Z0.0
T02 M06 (FINISH CUTTER DIA ${mfgCfg.toolDia}MM ${mfgCfg.toolFlutes}FL)
G90 G54 G00 X0.0 Y0.0
S3200 M03
G43 H02 Z5.0 M08
G01 Z${finDepth} F180.0
${stage === 'Wall + Bottom Finish' ? `(BOTTOM FLOOR FINISH WIPE)\nG01 X15.0 Y0.0 F420.0\nG03 I-15.0\n` : `(WALL ONLY - BOTTOM ALLOWANCE ${mfgCfg.bottomAllowance}MM KEPT)\n`}(WALL FINISH PASS - REMOVING ${mfgCfg.wallAllowance}MM ALLOWANCE)
G41 D02 X22.0 Y0.0 F380.0
G03 I-22.0
G40 G01 X0.0 Y0.0
G00 Z50.0 M09
G91 G28 Z0.0
M05
M30`;
  }

  if (stage === 'Chamfering Pass') {
    const cDepth = -(Number(mfgCfg.chamferSize) + 0.3).toFixed(2);
    if (isSiemens) {
      return `${header}
; SIEMENS CHAMFERING PASS (C${mfgCfg.chamferSize}MM)
G21 G17 G90 G94 G40
G75 Z0
T="CHAMFER_D${mfgCfg.chamferDia}_${mfgCfg.chamferAngle}DEG" D1
M6
G54 G00 X0 Y0
S3600 M3 M8
G00 Z5
G01 Z=${cDepth} F250
G41 G01 X22.4 Y0 F450
G03 I-22.4 J0
G40 G01 X0 Y0
G00 Z50 M9
M5
M30`;
    }
    return `O4201 (${controller.toUpperCase()} CHAMFERING PASS C${mfgCfg.chamferSize}MM)
${header}
G21 G17 G40 G49 G80 G90
G91 G28 Z0.0
T03 M06 (CHAMFER MILL DIA ${mfgCfg.chamferDia}MM ${mfgCfg.chamferAngle}DEG)
G90 G54 G00 X0.0 Y0.0
S3600 M03
G43 H03 Z5.0 M08
G01 Z${cDepth} F250.0
G41 D03 X22.4 Y0.0 F450.0
G03 I-22.4
G40 G01 X0.0 Y0.0
G00 Z50.0 M09
G91 G28 Z0.0
M05
M30`;
  }

  if (mode === 'Canned Cycle Program') {
    return `${header}\n${baseCode}`;
  }

  if (mode === 'Macro Program (Custom Variables)') {
    if (isSiemens) {
      if (domainKey === 'Turning') {
        return `${header}
; SIEMENS R-VARIABLE IF-GOTOB MACRO - ${operation.toUpperCase()} (${workSide})
R1=${mfgCfg.stockX}   ; START DIAMETER
R2=${mfgCfg.stockY}   ; FINAL DIAMETER
R3=1.5   ; RADIAL DEPTH OF CUT
R4=-${mfgCfg.stockZ}  ; TARGET Z LENGTH
R5=0.25  ; FEED RATE MM/REV
R6=${mfgCfg.wallAllowance}  ; FINISH STOCK ALLOWANCE
G21 G90 G95 G40
G75 X0 Z0
T="CNMG_ROUGH" D1
G96 S180 LIMS=2500 M3
R10=R1
LOOP_CUT:
R10=R10-(R3*2)
IF R10<(R2+(R6*2))
  R10=R2+(R6*2)
ENDIF
G00 X=R10+2 Z2 M8
G01 X=R10 F=R5
G01 Z=R4
G00 X=R10+3
G00 Z2
IF R10>(R2+(R6*2)) GOTOB LOOP_CUT
G75 X0 Z0 M9
M5
M30`;
      }
      return `${header}
; SIEMENS R-VARIABLE IF-GOTOB MACRO - ${operation.toUpperCase()} (${workSide})
R1=-${mfgCfg.featureDepth} ; TARGET DEPTH Z
R2=3.0   ; PECK / STEP DOWN
R3=3.0   ; R-PLANE CLEARANCE
R4=240.0 ; FEED RATE
R5=${mfgCfg.wallAllowance}  ; WALL FINISH ALLOWANCE
R6=${mfgCfg.bottomAllowance}  ; BOTTOM FINISH ALLOWANCE
R7=${mfgCfg.toolDia}  ; CUTTER DIAMETER
R10=0.0  ; CURRENT Z DEPTH
G21 G17 G90 G94 G40
G75 Z0
T="CUTTER_D${mfgCfg.toolDia}" D1
M6
G54 G00 X0 Y0
S2400 M3 M8
G00 Z=R3
NEXT_PECK:
R10=R10-R2
IF R10<(R1+R6)
  R10=R1+R6
ENDIF
G01 Z=R10 F=R4
G01 X=20-R5 F450
G03 I=-(20-R5) J0
G00 X0 Y0
IF R10>(R1+R6) GOTOB NEXT_PECK
G75 Z0 M9
M5
M30`;
    } else {
      if (domainKey === 'Turning') {
        return `O9001 (${controller.toUpperCase()} IF-GOTO MACRO - ${operation.toUpperCase()} ${workSide})
${header}
#101 = ${mfgCfg.stockX}  (START DIAMETER)
#102 = ${mfgCfg.stockY}  (FINAL DIAMETER)
#103 = 1.5   (RADIAL DEPTH OF CUT)
#104 = -${mfgCfg.stockZ} (TARGET Z LENGTH)
#105 = 0.25  (FEED MM PER REV)
#106 = ${mfgCfg.wallAllowance}  (FINISH STOCK ALLOWANCE)
G21 G40 G99
G28 U0. W0.
T0101
G50 S2500
G96 S180 M03
#110 = #101
N10 (LOOP START)
#110 = #110 - [#103 * 2.0]
IF [#110 LT [#102 + [#106 * 2.0]]] THEN #110 = [#102 + [#106 * 2.0]]
G00 X[#110 + 2.0] Z2.0 M08
G01 X#110 F#105
G01 Z#104
G00 X[#110 + 3.0]
G00 Z2.0
IF [#110 GT [#102 + [#106 * 2.0]]] GOTO10
G00 X100.0 Z100.0 M09
G28 U0. W0.
M05
M30`;
      }
      return `O9002 (${controller.toUpperCase()} IF-GOTO MACRO - ${operation.toUpperCase()} ${workSide})
${header}
#101 = -${mfgCfg.featureDepth} (TARGET DEPTH Z)
#102 = 3.0   (STEP DOWN Q)
#103 = 3.0   (R-PLANE CLEARANCE)
#104 = 240.0 (FEED RATE)
#105 = ${mfgCfg.wallAllowance}  (WALL ALLOWANCE)
#106 = ${mfgCfg.bottomAllowance}  (BOTTOM ALLOWANCE)
#107 = ${mfgCfg.toolDia}  (CUTTER DIA)
G21 G17 G40 G49 G80 G90
G91 G28 Z0.0
T01 M06
G90 G54 G00 X0.0 Y0.0
S2400 M03
G43 H01 Z10.0 M08
#110 = 0.0
N10 (DEPTH LOOP)
#110 = #110 - #102
IF [#110 LT [#101 + #106]] THEN #110 = [#101 + #106]
G01 Z#110 F#104
G01 X[20.0 - #105] F450.0
G03 I-[20.0 - #105]
G00 X0.0 Y0.0
IF [#110 GT [#101 + #106]] GOTO10
G00 Z50.0 M09
G91 G28 Z0.0
M05
M30`;
    }
  }

  if (mode === 'ISO G-Code and M-Code') {
    if (domainKey === 'Turning') {
      return `${header}
${cmt(`ISO G-CODE & M-CODE (${controller.toUpperCase()} - ${workSide})`)}
${isSiemens ? 'G21 G90 G95 G40\nG75 X0 Z0\nT="ISO_TOOL" D1\nG96 S200 LIMS=2800 M3' : 'O3001 (ISO LINEAR G01 G02 G03)\nG21 G40 G99\nG28 U0. W0.\nT0101\nG50 S2800\nG96 S200 M03'}
G00 X${Number(mfgCfg.stockX) + 2}.0 Z2.0 M08
G01 X${mfgCfg.stockY}.0 Z0.0 F0.15
G01 Z-${mfgCfg.stockZ}.0
G00 X${Number(mfgCfg.stockX) + 4}.0 Z10.0 M09
${isSiemens ? 'G75 X0 Z0\nM5\nM30' : 'G28 U0. W0.\nM05\nM30'}`;
    }
    return `${header}
${cmt(`ISO G-CODE & M-CODE MILLING (${controller.toUpperCase()})`)}
${isSiemens ? `G21 G17 G90 G94 G40\nG75 Z0\nT="ENDMILL_D${mfgCfg.toolDia}" D1\nM6\nG54 G00 X0 Y0\nS2400 M3 M8\nG00 Z10` : `O3002 (ISO LINEAR & CIRCULAR MILLING)\nG21 G17 G40 G49 G80 G90\nG91 G28 Z0.0\nT01 M06\nG90 G54 G00 X0.0 Y0.0\nS2400 M03\nG43 H01 Z10.0 M08`}
G01 Z-${mfgCfg.featureDepth}.0 F200.0
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
      ? `; ISO FACE PASS + CANNED CYCLE\nG00 X${Number(mfgCfg.stockX) + 2} Z2 M8\nG01 X-1 Z0 F0.15\n`
      : `(ISO FACE PASS + CANNED CYCLE)\nG00 X${Number(mfgCfg.stockX) + 2}.0 Z2.0 M08\nG01 X-1.0 Z0.0 F0.15\n`;
    return `${header}\n${isoHeader}${baseCode}`;
  }

  if (mode === 'ISO + Macro Program') {
    const vars = isSiemens
      ? `; SIEMENS R-VARIABLES + ISO G-CODE\nR1=${mfgCfg.wallAllowance} ; WALL ALLOWANCE\nR2=${mfgCfg.bottomAllowance} ; BOTTOM ALLOWANCE\n`
      : `(${controller.toUpperCase()} MACRO VARIABLES + ISO G-CODE)\n#501 = ${mfgCfg.wallAllowance} (WALL ALLOWANCE)\n#502 = ${mfgCfg.bottomAllowance} (BOTTOM ALLOWANCE)\n`;
    return `${vars}${adaptCodeForMode(baseCode, 'ISO G-Code and M-Code', controller, domainKey, operation, workSide, mfgCfg)}`;
  }

  if (mode === 'Macro + Canned Cycle') {
    if (isSiemens) {
      return `${header}
; SIEMENS R-VARIABLE IF-GOTOB + CANNED CYCLE
R1=5 ; BATCH QUANTITY
R2=1 ; CURRENT PART
LOOP_PART:
${baseCode.replace(/\nM30\s*$/, '')}
R2=R2+1
IF R2<=R1 GOTOB LOOP_PART
M30`;
    }
    return `${header}
(${controller.toUpperCase()} IF-GOTO MACRO + CANNED CYCLE)
#500 = 5 (BATCH QUANTITY)
#501 = 1 (CURRENT PART)
N10 (BATCH LOOP)
${baseCode.replace(/\nM30\s*$/, '')}
#501 = #501 + 1
IF [#501 LE #500] GOTO10
M30`;
  }

  return `${header}\n${baseCode}`;
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

  // Tooling, Workpiece & Strategy States
  const [toolDia, setToolDia] = useState('12');
  const [toolFlutes, setToolFlutes] = useState('4');
  const [toolLength, setToolLength] = useState('35');
  const [chamferDia, setChamferDia] = useState('10');
  const [chamferAngle, setChamferAngle] = useState('90');
  const [chamferSize, setChamferSize] = useState('0.5');

  const [stockX, setStockX] = useState('100');
  const [stockY, setStockY] = useState('80');
  const [stockZ, setStockZ] = useState('30');
  const [featureDepth, setFeatureDepth] = useState('10');

  const [areaType, setAreaType] = useState(AREA_TYPES[0]);
  const [machiningStage, setMachiningStage] = useState(MACHINING_STAGES[0]);
  const [wallAllowance, setWallAllowance] = useState('0.3');
  const [bottomAllowance, setBottomAllowance] = useState('0.2');

  const domainKey = machineType === 'Turning' ? 'Turning' : 'Milling';

  const mfgCfg = useMemo(
    () => ({
      toolDia,
      toolFlutes,
      toolLength,
      chamferDia,
      chamferAngle,
      chamferSize,
      stockX,
      stockY,
      stockZ,
      featureDepth,
      areaType,
      machiningStage,
      wallAllowance,
      bottomAllowance
    }),
    [
      toolDia,
      toolFlutes,
      toolLength,
      chamferDia,
      chamferAngle,
      chamferSize,
      stockX,
      stockY,
      stockZ,
      featureDepth,
      areaType,
      machiningStage,
      wallAllowance,
      bottomAllowance
    ]
  );

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
      setTitle(filteredTemplates[0].name + ' [' + machiningStage + ']');
      setCode(adaptCodeForMode(filteredTemplates[0].code, programMode, controller, domainKey, operation, workSide, mfgCfg));
    }
  }, [filteredTemplates, programMode, controller, domainKey, operation, workSide, mfgCfg, machiningStage]);

  const handleCategoryChange = (cat) => {
    setMachineType(cat);
    const firstSeries = Object.keys(JYOTI_MACHINE_CASCADE[cat])[0];
    const firstModel = JYOTI_MACHINE_CASCADE[cat][firstSeries][0];
    setMachineSeries(firstSeries);
    setMachineModel(firstModel);
    if (cat === 'Turning') {
      setStockX('50');
      setStockY('32');
      setStockZ('50');
    } else {
      setStockX('100');
      setStockY('80');
      setStockZ('30');
    }
  };

  const handleSeriesChange = (ser) => {
    setMachineSeries(ser);
    setMachineModel(JYOTI_MACHINE_CASCADE[machineType][ser][0]);
  };

  const handleTemplateChange = (idx) => {
    const i = Number(idx);
    setSelectedTemplateIdx(i);
    if (filteredTemplates[i]) {
      setTitle(filteredTemplates[i].name + ' [' + machiningStage + ']');
      setCode(adaptCodeForMode(filteredTemplates[i].code, programMode, controller, domainKey, operation, workSide, mfgCfg));
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
      operation: operation + ' • ' + workSide + ' • ' + machiningStage,
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

        {/* LINE 2: Machine Model | Operation | OD / ID / Pocket / Spigot Selection */}
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
              {domainKey === 'Turning' ? 'Machining Side (OD / ID)' : 'Feature Shape (Pocket / Spigot)'}
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

        {/* NEW SECTION ABOVE QUICK TEMPLATE: Tooling, Workpiece Stock, Allowances & Pass Strategy */}
        <div className="bg-slate-950/90 border border-amber-500/35 rounded-xl p-3.5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
              <Wrench className="w-4 h-4" />
              <span>Tool Data, Workpiece Stock & Rough / Finish / Chamfer Strategy</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">Syncs with Code & 2D Sim</span>
          </div>

          {/* Row A: Strategy, Area Type, Wall & Bottom Finish Allowance */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            <div>
              <label className="block text-[10px] font-semibold text-amber-300 mb-1">Machining Pass / Program</label>
              <select
                value={machiningStage}
                onChange={(e) => setMachiningStage(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white focus:border-amber-400 outline-none"
              >
                {MACHINING_STAGES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-400 mb-1">Pocket / Spigot Area</label>
              <select
                value={areaType}
                onChange={(e) => setAreaType(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white focus:border-amber-400 outline-none"
              >
                {AREA_TYPES.map((ar) => (
                  <option key={ar} value={ar}>{ar}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-cyan-300 mb-1">Wall Finish Leave (mm)</label>
              <input
                type="number"
                step="0.05"
                value={wallAllowance}
                onChange={(e) => setWallAllowance(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white focus:border-cyan-400 outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-cyan-300 mb-1">Bottom Finish Leave (mm)</label>
              <input
                type="number"
                step="0.05"
                value={bottomAllowance}
                onChange={(e) => setBottomAllowance(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white focus:border-cyan-400 outline-none"
              />
            </div>
          </div>

          {/* Row B: Workpiece Stock Dimensions */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                {domainKey === 'Turning' ? 'Raw Bar OD (mm)' : 'Workpiece Length X (mm)'}
              </label>
              <input
                type="number"
                value={stockX}
                onChange={(e) => setStockX(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                {domainKey === 'Turning' ? 'Finish Dia OD/ID (mm)' : 'Workpiece Width Y (mm)'}
              </label>
              <input
                type="number"
                value={stockY}
                onChange={(e) => setStockY(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                {domainKey === 'Turning' ? 'Part Length Z (mm)' : 'Workpiece Height Z (mm)'}
              </label>
              <input
                type="number"
                value={stockZ}
                onChange={(e) => setStockZ(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-400 mb-1">Pocket / Cut Depth (mm)</label>
              <input
                type="number"
                value={featureDepth}
                onChange={(e) => setFeatureDepth(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white outline-none"
              />
            </div>
          </div>

          {/* Row C: Main Cutter Data + Chamfer Tool Data */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
            <div>
              <label className="block text-[10px] font-semibold text-emerald-300 mb-1">Cutter Dia (mm)</label>
              <input
                type="number"
                value={toolDia}
                onChange={(e) => setToolDia(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-emerald-300 mb-1">No. of Flutes</label>
              <input
                type="number"
                value={toolFlutes}
                onChange={(e) => setToolFlutes(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-emerald-300 mb-1">Flute Length (mm)</label>
              <input
                type="number"
                value={toolLength}
                onChange={(e) => setToolLength(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-amber-300 mb-1">Chamfer Tool Dia</label>
              <input
                type="number"
                value={chamferDia}
                onChange={(e) => setChamferDia(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-amber-300 mb-1">Chamfer Angle (°)</label>
              <input
                type="number"
                value={chamferAngle}
                onChange={(e) => setChamferAngle(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-amber-300 mb-1">Chamfer Size C (mm)</label>
              <input
                type="number"
                step="0.1"
                value={chamferSize}
                onChange={(e) => setChamferSize(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white outline-none"
              />
            </div>
          </div>
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

        {/* Side-by-Side G-Code Editor & Live 2D Tooling Animation */}
        <form onSubmit={saveProgram} className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Sample / Active G-Code & Live Simulation</span>
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
              className="w-full min-h-[580px] bg-slate-950 border border-slate-700 rounded-xl p-4 text-xs font-mono text-emerald-300 leading-relaxed focus:border-cyan-500 outline-none"
              required
            />
            <CncSimulator
              domainKey={domainKey}
              workSide={workSide}
              operation={operation}
              templateName={filteredTemplates[selectedTemplateIdx]?.name || title}
              mfgCfg={mfgCfg}
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
