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

const TURN_STAGES = [
  'Rough + Finish Combined',
  'Roughing Only (Dia & Len Leave)',
  'Finish Pass Only',
  'Chamfering Pass'
];

const MILL_AREA_TYPES = [
  'Blind Area (Solid Stock)',
  'Through Area (Open)',
  'Pre-Cast Wall Only'
];

const TURN_AREA_TYPES = [
  'Solid OD Bar Stock',
  'Blind ID (Need Drilling First)',
  'Pre-Drilled / Raw Hollow ID',
  'Pre-Machined Forging / Casting'
];

const COMP_MODES = [
  'G41 (Left Climb Comp)',
  'G42 (Right Conv Comp)'
];

const TURNING_INSERTS = [
  'CNMG 120408 (80° Diamond Rough/Finish)',
  'WNMG 080408 (80° Trigon Economy)',
  'DNMG 150608 (55° Diamond Profile)',
  'VNMG 160404 (35° Sharp Finish)',
  'TNMG 160408 (60° Triangle)',
  'CCMT 09T304 (80° Positive Boring)',
  'MGMN 300 (3mm Grooving / Parting)'
];

const DRILL_TYPES = [
  'U-Drill (Indexable Insert)',
  'Solid Carbide Drill',
  'HSS Twist Drill'
];

const STANDARD_TAPS = [
  { label: 'M6 × 1.0 (Standard Coarse)', dia: '6', pitch: '1.0' },
  { label: 'M8 × 1.25 (Standard Coarse)', dia: '8', pitch: '1.25' },
  { label: 'M10 × 1.5 (Standard Coarse)', dia: '10', pitch: '1.5' },
  { label: 'M12 × 1.75 (Standard Coarse)', dia: '12', pitch: '1.75' },
  { label: 'M14 × 2.0 (Standard Coarse)', dia: '14', pitch: '2.0' },
  { label: 'M16 × 2.0 (Standard Coarse)', dia: '16', pitch: '2.0' },
  { label: 'M20 × 2.5 (Standard Coarse)', dia: '20', pitch: '2.5' },
  { label: 'M24 × 3.0 (Standard Coarse)', dia: '24', pitch: '3.0' }
];

const STANDARD_THREADS = [
  { label: 'M1.6 × 0.35 (ISO Coarse)', dia: '1.6', pitch: '0.35' },
  { label: 'M2 × 0.4 (ISO Coarse)', dia: '2', pitch: '0.4' },
  { label: 'M2.5 × 0.45 (ISO Coarse)', dia: '2.5', pitch: '0.45' },
  { label: 'M3 × 0.5 (ISO Coarse)', dia: '3', pitch: '0.5' },
  { label: 'M4 × 0.7 (ISO Coarse)', dia: '4', pitch: '0.7' },
  { label: 'M5 × 0.8 (ISO Coarse)', dia: '5', pitch: '0.8' },
  { label: 'M6 × 1.0 (ISO Coarse)', dia: '6', pitch: '1.0' },
  { label: 'M8 × 1.25 (ISO Coarse)', dia: '8', pitch: '1.25' },
  { label: 'M10 × 1.5 (ISO Coarse)', dia: '10', pitch: '1.5' },
  { label: 'M12 × 1.75 (ISO Coarse)', dia: '12', pitch: '1.75' },
  { label: 'M14 × 2.0 (ISO Coarse)', dia: '14', pitch: '2.0' },
  { label: 'M16 × 2.0 (ISO Coarse)', dia: '16', pitch: '2.0' },
  { label: 'M18 × 2.5 (ISO Coarse)', dia: '18', pitch: '2.5' },
  { label: 'M20 × 2.5 (ISO Coarse)', dia: '20', pitch: '2.5' },
  { label: 'M22 × 2.5 (ISO Coarse)', dia: '22', pitch: '2.5' },
  { label: 'M24 × 3.0 (ISO Coarse)', dia: '24', pitch: '3.0' },
  { label: 'M27 × 3.0 (ISO Coarse)', dia: '27', pitch: '3.0' },
  { label: 'M30 × 3.5 (ISO Coarse)', dia: '30', pitch: '3.5' },
  { label: 'M33 × 3.5 (ISO Coarse)', dia: '33', pitch: '3.5' },
  { label: 'M36 × 4.0 (ISO Coarse)', dia: '36', pitch: '4.0' },
  { label: 'M39 × 4.0 (ISO Coarse)', dia: '39', pitch: '4.0' },
  { label: 'M42 × 4.5 (ISO Coarse)', dia: '42', pitch: '4.5' },
  { label: 'M45 × 4.5 (ISO Coarse)', dia: '45', pitch: '4.5' },
  { label: 'M48 × 5.0 (ISO Coarse)', dia: '48', pitch: '5.0' },
  { label: 'M52 × 5.0 (ISO Coarse)', dia: '52', pitch: '5.0' },
  { label: 'M56 × 5.5 (ISO Coarse)', dia: '56', pitch: '5.5' },
  { label: 'M60 × 5.5 (ISO Coarse)', dia: '60', pitch: '5.5' },
  { label: 'M64 × 6.0 (ISO Coarse)', dia: '64', pitch: '6.0' },
  { label: 'M72 × 6.0 (ISO Coarse)', dia: '72', pitch: '6.0' },
  { label: 'M80 × 6.0 (ISO Coarse)', dia: '80', pitch: '6.0' },
  { label: 'M90 × 6.0 (ISO Coarse)', dia: '90', pitch: '6.0' },
  { label: 'M100 × 6.0 (ISO Coarse)', dia: '100', pitch: '6.0' }
];

function classifyTemplate(domainKey, name) {
  const n = name.toUpperCase();
  if (domainKey === 'Turning') {
    let op = 'Turning';
    if (n.includes('THREAD')) op = 'Threading';
    else if (n.includes('PARTING')) op = 'Parting';
    else if (n.includes('GROOV')) op = 'Grooving';
    else if (n.includes('FACING') || n.includes('G94') || n.includes('G72')) op = 'Facing';
    else if (n.includes('TAP')) op = 'Tapping';
    else if (n.includes('DRILL')) op = 'Drilling';
    else if (n.includes('BOR') || n.includes(' ID ')) op = 'Boring';

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
    } else if (n.includes('FACE') || n.includes('FRONT') || n.includes('DRILL') || n.includes('TAP') || n.includes('G94')) {
      side = 'Face';
    }
    return { op, side };
  } else {
    let op = 'Drilling';
    if (n.includes('TAP')) op = 'Tapping';
    else if (n.includes('REAM')) op = 'Reaming';
    else if (n.includes('BOR')) op = 'Boring';
    else if (n.includes('SPIGOT')) op = 'Spigot Milling';
    else if (n.includes('POCKET')) op = 'Pocket Milling';
    else if (n.includes('SLOT')) op = 'Slot Milling';
    else if (n.includes('MILL')) op = 'Face Milling';

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
  const gComp = mfgCfg.compMode.startsWith('G42') ? 'G42' : 'G41';

  const lines = [
    c(`WORKPIECE: ${domainKey === 'Turning' ? `RAW OD=${mfgCfg.stockX}MM, FIN=${mfgCfg.stockY}MM, LEN=${mfgCfg.stockZ}MM, STICKOUT=${mfgCfg.chuckStickout}MM` : `STOCK ${mfgCfg.stockX}X${mfgCfg.stockY}X${mfgCfg.stockZ}MM, DEPTH=${mfgCfg.featureDepth}MM`}`),
    c(`CONDITION: ${mfgCfg.areaType} | STAGE: ${mfgCfg.machiningStage}`)
  ];

  if (domainKey === 'Turning') {
    if (operation === 'Drilling') {
      lines.push(c(`DRILL DATA: ${mfgCfg.drillType} | DIA=${mfgCfg.drillDia}MM | PECK Q=${mfgCfg.peckDepth}MM`));
    } else if (operation === 'Tapping') {
      lines.push(c(`TAP DATA: ${mfgCfg.tapStandard} | M${mfgCfg.tapDia} X PITCH ${mfgCfg.tapPitch}MM`));
    } else if (operation === 'Threading') {
      lines.push(c(`THREAD DATA: ${mfgCfg.threadStandard} | M${mfgCfg.threadDia} X PITCH ${mfgCfg.threadPitch}MM | AUTO HEIGHT H=${mfgCfg.threadHeight}MM`));
    } else {
      lines.push(c(`INSERT & COMP: ${mfgCfg.insertType} | NOSE R=${mfgCfg.noseRadius}MM | ${gComp}`));
    }
    lines.push(c(`TURNING FINISH LEAVE: DIA X=${mfgCfg.diaFinishStock}MM | LENGTH Z=${mfgCfg.lenFinishStock}MM`));
  } else {
    lines.push(c(`TOOL & COMP: DIA ${mfgCfg.toolDia}MM (${mfgCfg.toolFlutes}FL, L=${mfgCfg.toolLength}MM) | G43 H01 + ${gComp} D01`));
    lines.push(c(`FINISH LEAVE: WALL=${mfgCfg.wallAllowance}MM | BOTTOM=${mfgCfg.bottomAllowance}MM`));
  }

  if (mfgCfg.machiningStage === 'Chamfering Pass') {
    lines.push(c(`CHAMFER TOOL: DIA ${mfgCfg.chamferDia}MM | ${mfgCfg.chamferAngle} DEG | C${mfgCfg.chamferSize}MM`));
  }
  return lines.join('\n');
}

function adaptCodeForMode(baseCode, mode, controller, domainKey, operation, workSide, mfgCfg) {
  if (!baseCode) return '';
  const isSiemens = controller === 'Siemens';
  const cmt = (txt) => (isSiemens ? `; ${txt}` : `(${txt})`);
  const header = generateProcessHeader(controller, domainKey, operation, workSide, mfgCfg);
  const stage = mfgCfg.machiningStage;
  const gComp = mfgCfg.compMode.startsWith('G42') ? 'G42' : 'G41';
  const isID = workSide === 'ID';

  // Dedicated Threading Program with Auto-Calculated Thread Height H
  if (domainKey === 'Turning' && operation === 'Threading') {
    const majDia = Number(mfgCfg.threadMajorDia || 24);
    const minDia = Number(mfgCfg.threadMinorDia || 20.319);
    const thPitch = Number(mfgCfg.threadPitch || 3.0);
    const thH = Number(mfgCfg.threadHeight || (0.61343 * thPitch).toFixed(3));
    const targetX = isID ? majDia.toFixed(3) : minDia.toFixed(3);
    const pHeightMicron = Math.round(thH * 1000);
    const lenZ = Math.min(35, Number(mfgCfg.stockZ || 45) - 5);

    if (isSiemens) {
      return `${header}
; SIEMENS CYCLE97 ${workSide} THREADING (MAJOR=${majDia}, MINOR=${minDia}, H=${thH}MM)
G21 G90 G95 G40
G75 X0 Z0
T="THREAD_TOOL_${workSide}" D1
G97 S800 M3
G00 X${isID ? (minDia - 5).toFixed(1) : (majDia + 5).toFixed(1)} Z5 M8
CYCLE97(${thPitch}, 0, 0, -${lenZ}, ${majDia}, ${minDia}, 5, 2, ${thH}, 0.05, 30, 0, 6, 1, 3, ${isID ? 2 : 1})
G75 X0 Z0 M9
M5
M30`;
    }
    return `O7601 (${controller.toUpperCase()} G76 ${workSide} THREADING - MAJOR ${majDia} / MINOR ${minDia} / H=${thH}MM)
${header}
G21 G40 G99
G28 U0. W0.
T0404 (60 DEG ${workSide} THREADING INSERT)
G97 S800 M03
G00 X${isID ? (minDia - 5).toFixed(1) : (majDia + 5).toFixed(1)} Z5.0 M08
G76 P020060 Q100 R0.05
G76 X${targetX} Z-${lenZ}.0 P${pHeightMicron} Q250 F${thPitch}
G28 U0. W0. M09
M05
M30`;
  }

  // Dedicated Tapping Program in Turning / VTL
  if (domainKey === 'Turning' && operation === 'Tapping') {
    const tDia = mfgCfg.tapDia || 10;
    const tPitch = mfgCfg.tapPitch || 1.5;
    const lenZ = Math.min(25, Number(mfgCfg.stockZ || 45) - 10);
    if (isSiemens) {
      return `${header}
; SIEMENS RIGID TAPPING M${tDia} X ${tPitch}
G21 G90 G95 G40
G75 X0 Z0
T="TAP_M${tDia}" D1
G00 X0 Z5 M8
CYCLE84(5, 0, 2, -${lenZ}, , 0, 3, , ${tPitch}, 0, 400, 400)
G75 X0 Z0 M9
M5
M30`;
    }
    return `O8401 (${controller.toUpperCase()} RIGID TAPPING M${tDia} X ${tPitch})
${header}
G21 G40 G99
G28 U0. W0.
T0505 (TAP M${tDia} PITCH ${tPitch})
G97 S400 M03
G00 X0.0 Z5.0 M08
M29 S400
G84 Z-${lenZ}.0 R3.0 F${tPitch}
G80
G28 U0. W0. M09
M05
M30`;
  }

  // Dedicated Drilling Program in Turning / VTL
  if (domainKey === 'Turning' && operation === 'Drilling') {
    const dDia = mfgCfg.drillDia || 16;
    const peckMicron = Math.round(Number(mfgCfg.peckDepth || 10) * 1000);
    const lenZ = Math.min(40, Number(mfgCfg.stockZ || 45));
    if (isSiemens) {
      return `${header}
; SIEMENS CENTER DRILLING DIA ${dDia}MM
G21 G90 G95 G40
G75 X0 Z0
T="DRILL_D${dDia}" D1
G97 S1200 M3
G00 X0 Z5 M8
CYCLE83(5, 0, 2, -${lenZ}, 0, -${mfgCfg.peckDepth || 10}, , 0, , , 1, 1)
G75 X0 Z0 M9
M5
M30`;
    }
    return `O7401 (${controller.toUpperCase()} G74 PECK DRILLING DIA ${dDia}MM)
${header}
G21 G40 G99
G28 U0. W0.
T0303 (${mfgCfg.drillType} DIA ${dDia}MM)
G97 S1200 M03
G00 X0.0 Z5.0 M08
G74 R1.0
G74 Z-${lenZ}.0 Q${peckMicron} F0.12
G28 U0. W0. M09
M05
M30`;
  }

  if (stage === 'Wall Finish Only' || stage === 'Wall + Bottom Finish' || stage === 'Finish Pass Only') {
    if (domainKey === 'Turning') {
      const finX = mfgCfg.stockY || 32;
      const finZ = mfgCfg.stockZ || 45;
      if (isSiemens) {
        return `${header}
; SIEMENS TURNING FINISH PASS (${gComp})
G21 G90 G95 G40
G75 X0 Z0
T="FIN_INSERT" D1
G96 S240 LIMS=3000 M3
G00 X${isID ? Number(finX) - 4 : Number(finX) + 4} Z2 M8
${gComp} G01 X${finX} Z0 F0.12
G01 Z-${finZ}
G40 G00 X${isID ? Number(finX) - 6 : Number(finX) + 6} Z10 M9
M5
M30`;
      }
      return `O7001 (${controller.toUpperCase()} TURNING FINISH PASS - ${gComp})
${header}
G21 G40 G99
G28 U0. W0.
T0202 (${mfgCfg.insertType})
G50 S3000
G96 S240 M03
G00 X${isID ? Number(finX) - 4 : Number(finX) + 4}.0 Z2.0 M08
${gComp} G01 X${finX}.0 Z0.0 F0.12
G01 Z-${finZ}.0
G40 G00 X${isID ? Number(finX) - 6 : Number(finX) + 6}.0 Z10.0 M09
G28 U0. W0.
M05
M30`;
    }

    const finDepth = stage === 'Wall Finish Only'
      ? -(Number(mfgCfg.featureDepth) - Number(mfgCfg.bottomAllowance)).toFixed(2)
      : -Number(mfgCfg.featureDepth).toFixed(2);
    return `O4101 (${controller.toUpperCase()} ${stage.toUpperCase()} - G43 & ${gComp})
${header}
G21 G17 G40 G49 G80 G90
G91 G28 Z0.0
T02 M06 (FINISH CUTTER DIA ${mfgCfg.toolDia}MM ${mfgCfg.toolFlutes}FL)
G90 G54 G00 X0.0 Y0.0
S3200 M03
G43 H02 Z5.0 M08
G01 Z${finDepth} F180.0
${gComp} D02 G01 X22.0 Y0.0 F380.0
G03 I-22.0
G40 G01 X0.0 Y0.0
G00 Z50.0 M09
G91 G28 Z0.0
M05
M30`;
  }

  if (stage === 'Chamfering Pass') {
    const cDepth = -(Number(mfgCfg.chamferSize) + 0.3).toFixed(2);
    return `O4201 (${controller.toUpperCase()} CHAMFERING PASS C${mfgCfg.chamferSize}MM - G43 & ${gComp})
${header}
G21 G17 G40 G49 G80 G90
G91 G28 Z0.0
T03 M06 (CHAMFER MILL DIA ${mfgCfg.chamferDia}MM ${mfgCfg.chamferAngle}DEG)
G90 G54 G00 X0.0 Y0.0
S3600 M03
G43 H03 Z5.0 M08
G01 Z${cDepth} F250.0
${gComp} D03 G01 X22.5 Y0.0 F450.0
G03 I-22.5
G40 G01 X0.0 Y0.0
G00 Z50.0 M09
G91 G28 Z0.0
M05
M30`;
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
R6=${mfgCfg.diaFinishStock}  ; DIA FINISH LEAVE X
R7=${mfgCfg.lenFinishStock}  ; LEN FINISH LEAVE Z
G21 G90 G95 G40
G75 X0 Z0
T="ROUGH_INSERT" D1
G96 S180 LIMS=2500 M3
R10=R1
LOOP_CUT:
R10=R10-(R3*2)
IF R10<(R2+R6)
  R10=R2+R6
ENDIF
G00 X=R10+2 Z2 M8
${gComp} G01 X=R10 F=R5
G01 Z=R4+R7
G40 G00 X=R10+3
G00 Z2
IF R10>(R2+R6) GOTOB LOOP_CUT
G75 X0 Z0 M9
M5
M30`;
      }
      return `${header}
; SIEMENS R-VARIABLE IF-GOTOB MACRO (${gComp} COMP)
R1=-${mfgCfg.featureDepth} ; TARGET DEPTH Z
R2=3.0   ; STEP DOWN
R3=3.0   ; R-PLANE
R4=240.0 ; FEED RATE
R5=${mfgCfg.wallAllowance}  ; WALL FINISH LEAVE
R6=${mfgCfg.bottomAllowance}  ; BOTTOM FINISH LEAVE
R10=0.0  ; CURRENT Z
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
${gComp} G01 X=22-R5 Y0 F450
G03 I=-(22-R5) J0
G40 G01 X0 Y0
IF R10>(R1+R6) GOTOB NEXT_PECK
G75 Z0 M9
M5
M30`;
    } else {
      if (domainKey === 'Turning') {
        return `O9001 (${controller.toUpperCase()} IF-GOTO MACRO - ${gComp} NOSE COMP)
${header}
#101 = ${mfgCfg.stockX}  (START DIAMETER)
#102 = ${mfgCfg.stockY}  (FINAL DIAMETER)
#103 = 1.5   (RADIAL DEPTH OF CUT)
#104 = -${mfgCfg.stockZ} (TARGET Z LENGTH)
#105 = 0.25  (FEED MM PER REV)
#106 = ${mfgCfg.diaFinishStock}  (DIA FINISH LEAVE X)
#107 = ${mfgCfg.lenFinishStock}  (LEN FINISH LEAVE Z)
G21 G40 G99
G28 U0. W0.
T0101
G50 S2500
G96 S180 M03
#110 = #101
N10 (LOOP START)
#110 = #110 - [#103 * 2.0]
IF [#110 LT [#102 + #106]] THEN #110 = [#102 + #106]
G00 X[#110 + 2.0] Z2.0 M08
${gComp} G01 X#110 F#105
G01 Z[#104 + #107]
G40 G00 X[#110 + 3.0]
G00 Z2.0
IF [#110 GT [#102 + #106]] GOTO10
G00 X100.0 Z100.0 M09
G28 U0. W0.
M05
M30`;
      }
      return `O9002 (${controller.toUpperCase()} IF-GOTO MACRO - G43 H01 & ${gComp} D01)
${header}
#101 = -${mfgCfg.featureDepth} (TARGET DEPTH Z)
#102 = 3.0   (STEP DOWN Q)
#103 = 3.0   (R-PLANE)
#104 = 240.0 (FEED RATE)
#105 = ${mfgCfg.wallAllowance}  (WALL ALLOWANCE)
#106 = ${mfgCfg.bottomAllowance}  (BOTTOM ALLOWANCE)
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
${gComp} D01 G01 X[22.0 - #105] Y0.0 F450.0
G03 I-[22.0 - #105]
G40 G01 X0.0 Y0.0
IF [#110 GT [#101 + #106]] GOTO10
G00 Z50.0 M09
G91 G28 Z0.0
M05
M30`;
    }
  }

  const compensatedBase = baseCode.replace(/\bG41\b/g, gComp);
  return `${header}\n${compensatedBase}`;
}



const applyNoseCompToCode = (rawCode, compVal) => {
  if (!rawCode) return rawCode;
  let out = String(rawCode);
  const up = String(compVal || '').toUpperCase();
  let mode = '';
  if (up.includes('G41')) mode = 'G41';
  else if (up.includes('G42')) mode = 'G42';
  else if (up.includes('G40')) mode = 'G40';
  if (!mode) return out;

  out = out.split('| G42)').join('| ' + mode + ')').split('| G41)').join('| ' + mode + ')').split('| G40)').join('| ' + mode + ')');
  out = out.split('G42 G01').join('G01').split('G41 G01').join('G01').split('G42 G1').join('G1').split('G41 G1').join('G1');

  const cancelTag = 'G40 (CANCEL TOOL NOSE COMPENSATION)';
  while (out.includes(cancelTag)) {
    out = out.split(cancelTag + '\r\n').join('').split(cancelTag + '\n').join('').split(cancelTag + '\\n').join('').split(cancelTag).join('');
  }

  if (mode === 'G40') {
    return out.split('G42').join('G40').split('G41').join('G40');
  }

  const targets = ['G01 Z', 'G01 X', 'G01 C', 'G1 Z', 'G1 X', 'G1 C', 'g01 z', 'g01 x', 'g01 c'];
  let bestIdx = -1;
  let matchedTarget = '';
  for (const t of targets) {
    const idx = out.indexOf(t);
    if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) {
      bestIdx = idx;
      matchedTarget = t;
    }
  }

  if (bestIdx !== -1) {
    const parts = matchedTarget.trim().split(/\s+/);
    const gWord = parts[0].toUpperCase();
    const axisWord = parts[1].toUpperCase();
    out = out.slice(0, bestIdx) + mode + ' ' + gWord + ' ' + axisWord + out.slice(bestIdx + matchedTarget.length);
  }

  const m30Idx = out.lastIndexOf('M30');
  if (m30Idx !== -1 && !out.includes(cancelTag)) {
    const sep = out.includes('\r\n') ? '\r\n' : (out.includes('\n') ? '\n' : '\\n');
    out = out.slice(0, m30Idx) + cancelTag + sep + out.slice(m30Idx);
  }

  return out;
};
const formatTurnMillByController = (rawCode, ctrlName) => {
  const codeStr = String(rawCode || '');
  const u = String(ctrlName || 'Fanuc').toUpperCase();
  if (u.includes('SIEMENS')) {
    return codeStr
      .replace(/^%\r?\n?/, '')
      .replace(/\r?\n?%$/, '')
      .replace(/^O\d+\s*/m, '; SIEMENS SINUMERIK ');
  }
  if (u.includes('MITSUBISHI')) {
    return codeStr.replace(/\(FANUC\s*/gi, '(MITSUBISHI ');
  }
  return codeStr;
};

const TURN_MILL_LIVE_TOOLS = [
  "T0202 - Radial Endmill Live Tool (OD Pocket / Slot)",
  "T0303 - Radial Drill Live Tool (OD PCD Drilling)",
  "T0404 - Radial Tap Live Tool (OD Live Tapping)",
  "T0303 - Face Drill Live Tool (VTL Face PCD Drilling)",
  "T0404 - Face Tap Live Tool (VTL Face Tapping)",
  "T0202 - Face Slot Endmill Live Tool (VTL C + X)",
  "T0505 - Angular / Cross Live Tool (VTL OD / Side)"
];

const TURN_MILL_SAMPLES = [
  {
    "name": "OD Pocket Milling (C + X Radial Live Tool)",
    "title": "OD Pocket Milling - C + X Radial Live Tool",
    "code": "%\nO7001 (OD POCKET MILLING - C AND X RADIAL LIVE TOOL)\nG21 G40 G80 G99 G90\nG28 U0. W0.\nT0202 (RADIAL ENDMILL LIVE TOOL)\nG00 X46.0 Z-15.0 C0.0\nS2500 M13\n#101 = 3.0 (RADIAL DEPTH STEP IN X)\n#102 = 38.0 (FINAL X TARGET)\n#103 = 42.0 (CURRENT X START)\nN10\n#103 = #103 - #101\nIF [#103 GE #102] GOTO 20\n#103 = #102\nN20\nG01 X#103 F180\nG01 C25.0 F400\nG01 X[#103 + 1.5] F300\nG01 C0.0 F400\nIF [#103 GT #102] GOTO 10\nG00 X75.0\nM15\nG28 U0. W0.\nM30\n%"
  },
  {
    "name": "OD PCD Radial Drilling (C-Axis IF/GOTO)",
    "title": "OD PCD Radial Drilling - C-Axis Loop",
    "code": "%\nO7002 (OD PCD RADIAL DRILLING - C AXIS LOOP)\nG21 G40 G80 G99 G90\nG28 U0. W0.\nT0303 (RADIAL DRILL LIVE TOOL)\n#110 = 0.0 (START C ANGLE)\n#111 = 90.0 (ANGLE STEP = 360 / NO OF HOLES)\n#112 = 360.0 (END ANGLE)\n#113 = -18.0 (Z POSITION ON OD)\n#114 = 32.0 (FINAL RADIAL DRILL DEPTH X)\nS1800 M13\nG00 Z#113 X55.0 C#110\nN10\nG00 C#110\nG01 X#114 F140\nG00 X55.0\n#110 = #110 + #111\nIF [#110 LT #112] GOTO 10\nG00 X75.0\nM15\nG28 U0. W0.\nM30\n%"
  },
  {
    "name": "OD Radial Live Tapping (C + X)",
    "title": "OD Radial Live Tapping - C + X",
    "code": "%\nO7003 (OD RADIAL LIVE TAPPING)\nG21 G40 G80 G99 G90\nG28 U0. W0.\nT0404 (RADIAL TAP LIVE TOOL)\nG00 C0.0 Z-18.0 X55.0\nS400 M13\nG01 X34.0 F0.8 (PITCH 0.8 MM/REV)\nG01 X55.0 F1.6\nM15\nG28 U0. W0.\nM30\n%"
  },
  {
    "name": "VTL Face PCD Drilling (C-Axis IF/GOTO)",
    "title": "VTL Face PCD Drilling - C-Axis Loop",
    "code": "%\nO8001 (VTL FACE PCD DRILLING - C AXIS LOOP)\nG21 G40 G80 G94 G54 G90\nT0303 (VTL FACE DRILL LIVE TOOL)\n#110 = 0.0 (START C ANGLE)\n#111 = 60.0 (STEP ANGLE = 360 / 6 HOLES)\n#112 = 360.0 (END ANGLE)\n#113 = 180.0 (PCD RADIUS / X POSITION)\n#114 = 22.0 (DRILL DEPTH Z)\nS1500 M13\nG00 X#113 C#110 Z10.0\nN10\nG00 C#110\nG01 Z-[0 - #114] F180\nG00 Z10.0\n#110 = #110 + #111\nIF [#110 LT #112] GOTO 10\nG00 Z150.0 M15\nM30\n%"
  },
  {
    "name": "VTL Face Tapping (Live Tool)",
    "title": "VTL Face Live Tapping",
    "code": "%\nO8002 (VTL FACE LIVE TAPPING)\nG21 G40 G80 G94 G54 G90\nT0404 (VTL FACE TAP LIVE TOOL)\nG00 X180.0 C0.0 Z20.0\nS450 M13\nG01 Z-18.0 F1.25 (PITCH 1.25 MM)\nG01 Z20.0 F2.5\nG00 Z150.0 M15\nM30\n%"
  },
  {
    "name": "VTL Face Slot & Pocket (C + X)",
    "title": "VTL Face Slot & Pocket - C + X",
    "code": "%\nO8003 (VTL FACE SLOT & POCKET - C + X)\nG21 G40 G80 G94 G54 G90\nT0202 (VTL ENDMILL LIVE TOOL)\n#120 = 6.0 (TOTAL FACE DEPTH Z)\n#121 = 2.0 (Z STEP DEPTH)\n#122 = 0.0 (CURRENT Z STEP)\nS2200 M13\nG00 X160.0 C0.0 Z10.0\nN10\n#122 = #122 + #121\nIF [#122 LE #120] GOTO 20\n#122 = #120\nN20\nG01 Z-[0 - #122] F150\nG01 X200.0 C15.0 F320\nG01 X160.0 C0.0 F320\nIF [#122 LT #120] GOTO 10\nG00 Z150.0 M15\nM30\n%"
  },
  {
    "name": "VTL OD / Side Live Tool (Angular / Cross)",
    "title": "VTL OD / Side Live Tool",
    "code": "%\nO8004 (VTL OD / SIDE LIVE TOOL)\nG21 G40 G80 G94 G54 G90\nT0505 (VTL ANGULAR / RADIAL LIVE TOOL)\nS1600 M13\nG00 X260.0 C0.0 Z-25.0\nG01 X220.0 F180\nG00 X265.0\nG00 C90.0\nG01 X220.0 F180\nG00 X320.0 Z150.0 M15\nM30\n%"
  }
];

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

  // Milling Tool States
  const [toolDia, setToolDia] = useState('12');
  const [toolFlutes, setToolFlutes] = useState('4');
  const [toolLength, setToolLength] = useState('35');
  const [compMode, setCompMode] = useState(COMP_MODES[1]);

  // Turning Tool / Insert / Drill / Tap / Thread States
  const [insertType, setInsertType] = useState(TURNING_INSERTS[0]);
  const [noseRadius, setNoseRadius] = useState('0.8');

  const [drillType, setDrillType] = useState(DRILL_TYPES[0]);
  const [drillDia, setDrillDia] = useState('16');
  const [peckDepth, setPeckDepth] = useState('8');

  const [tapStandard, setTapStandard] = useState('Standard Metric Coarse');
  const [selectedStdTap, setSelectedStdTap] = useState(STANDARD_TAPS[2].label);
  const [tapDia, setTapDia] = useState('10');
  const [tapPitch, setTapPitch] = useState('1.5');

  const [threadStandard, setThreadStandard] = useState('Standard Metric ISO');
  const [selectedStdThread, setSelectedStdThread] = useState('M24 × 3.0 (ISO Coarse)');
  const [threadPitch, setThreadPitch] = useState('3.0');
  const [threadMajorDia, setThreadMajorDia] = useState('24.000');
  const [threadMinorDia, setThreadMinorDia] = useState('20.319');

  // Auto-calculated Thread Single Depth Height H = 0.61343 * Pitch
  const threadHeight = useMemo(() => {
    const p = Number(threadPitch) || 0;
    return (0.61343 * p).toFixed(3);
  }, [threadPitch]);

  const handleThreadPitchChange = (newPitch) => {
    setThreadPitch(newPitch);
    const h = 0.61343 * (Number(newPitch) || 0);
    if (workSide === 'ID') {
      const maj = (Number(threadMinorDia) || 0) + 2 * h;
      setThreadMajorDia(maj.toFixed(3));
    } else {
      const min = Math.max(0, (Number(threadMajorDia) || 0) - 2 * h);
      setThreadMinorDia(min.toFixed(3));
    }
  };

  const handleThreadMajorChange = (newMaj) => {
    setThreadMajorDia(newMaj);
    const h = 0.61343 * (Number(threadPitch) || 0);
    setThreadMinorDia(Math.max(0, (Number(newMaj) || 0) - 2 * h).toFixed(3));
  };

  const handleThreadMinorChange = (newMin) => {
    setThreadMinorDia(newMin);
    const h = 0.61343 * (Number(threadPitch) || 0);
    setThreadMajorDia(((Number(newMin) || 0) + 2 * h).toFixed(3));
  };

  // Chamfer Tool States
  const [chamferDia, setChamferDia] = useState('10');
  const [chamferAngle, setChamferAngle] = useState('90');
  const [chamferSize, setChamferSize] = useState('0.5');

  // Workpiece Stock States
  const [stockX, setStockX] = useState('50');
  const [stockY, setStockY] = useState('32');
  const [stockZ, setStockZ] = useState('45');
  const [featureDepth, setFeatureDepth] = useState('10');
  const [chuckStickout, setChuckStickout] = useState('65');
  const [rawIdDia, setRawIdDia] = useState('20');

  // Allowances & Stage
  const [areaType, setAreaType] = useState(TURN_AREA_TYPES[0]);
  const [machiningStage, setMachiningStage] = useState(TURN_STAGES[0]);
  const [diaFinishStock, setDiaFinishStock] = useState('0.5');
  const [lenFinishStock, setLenFinishStock] = useState('0.2');
  const [wallAllowance, setWallAllowance] = useState('0.3');
  const [bottomAllowance, setBottomAllowance] = useState('0.2');

  const domainKey = (machineType === 'Turning' || machineType === 'VTL') ? 'Turning' : 'Milling';
  const showChamferCascade = machiningStage === 'Chamfering Pass';

  const mfgCfg = useMemo(
    () => ({
      toolDia,
      toolFlutes,
      toolLength,
      compMode,
      insertType,
      noseRadius,
      drillType,
      drillDia,
      peckDepth,
      tapStandard,
      tapDia,
      tapPitch,
      threadStandard,
      threadMajorDia,
      threadMinorDia,
      threadPitch,
      threadHeight,
      chamferDia,
      chamferAngle,
      chamferSize,
      stockX,
      stockY,
      stockZ,
      featureDepth,
      chuckStickout,
      rawIdDia,
      areaType,
      machiningStage,
      diaFinishStock,
      lenFinishStock,
      wallAllowance,
      bottomAllowance
    }),
    [
      toolDia,
      toolFlutes,
      toolLength,
      compMode,
      insertType,
      noseRadius,
      drillType,
      drillDia,
      peckDepth,
      tapStandard,
      tapDia,
      tapPitch,
      threadStandard,
      threadMajorDia,
      threadMinorDia,
      threadPitch,
      threadHeight,
      chamferDia,
      chamferAngle,
      chamferSize,
      stockX,
      stockY,
      stockZ,
      featureDepth,
      chuckStickout,
      rawIdDia,
      areaType,
      machiningStage,
      diaFinishStock,
      lenFinishStock,
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
    if (domainKey === 'Turning') {
      return ['Turning', 'Facing', 'Boring', 'Threading', 'Grooving', 'Parting', 'Drilling', 'Tapping', 'Turn-Mill'];
    }
    return ['Pocket Milling', 'Spigot Milling', 'Slot Milling', 'Face Milling', 'Drilling', 'Tapping', 'Boring', 'Reaming'];
  }, [domainKey]);

  useEffect(() => {
    if (!operationOptions.includes(operation) && operationOptions.length > 0) {
      setOperation(operationOptions[0]);
    }
  }, [operationOptions, operation]);

  const sideOptions = useMemo(() => {
    if (domainKey === 'Turning') {
      return ['OD', 'ID', 'Face'];
    }
    if (operation === 'Pocket Milling') return ['Circular Pocket', 'Rectangular Pocket'];
    if (operation === 'Spigot Milling') return ['Circular Spigot', 'Rectangular Spigot'];
    const filteredByOp = enrichedTemplates.filter((t) => t.op === operation);
    const sides = [...new Set(filteredByOp.map((t) => t.side))];
    return sides.length > 0 ? sides : ['Standard'];
  }, [domainKey, enrichedTemplates, operation]);

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
      setCode((operation === 'Turn-Mill' && Array.isArray(TURN_MILL_SAMPLES) && TURN_MILL_SAMPLES.length > 0) ? formatTurnMillByController((TURN_MILL_SAMPLES[Number(typeof selectedTemplateIdx !== 'undefined' ? selectedTemplateIdx : 0) % TURN_MILL_SAMPLES.length] || TURN_MILL_SAMPLES[0]).code, controller) : adaptCodeForMode(filteredTemplates[0].code, programMode, controller, domainKey, operation, workSide, mfgCfg));
    }
  }, [filteredTemplates, programMode, controller, domainKey, operation, workSide, mfgCfg, machiningStage]);

  const handleCategoryChange = (cat) => {
    setMachineType(cat);
    const firstSeries = Object.keys(JYOTI_MACHINE_CASCADE[cat])[0];
    const firstModel = JYOTI_MACHINE_CASCADE[cat][firstSeries][0];
    setMachineSeries(firstSeries);
    setMachineModel(firstModel);
    if (cat === 'Turning' || cat === 'VTL') {
      setStockX(cat === 'VTL' ? '220' : '50');
      setStockY(cat === 'VTL' ? '160' : '32');
      setStockZ(cat === 'VTL' ? '120' : '45');
      setChuckStickout(cat === 'VTL' ? '140' : '65');
      setAreaType(TURN_AREA_TYPES[0]);
      setMachiningStage(TURN_STAGES[0]);
    } else {
      setStockX('100');
      setStockY('80');
      setStockZ('30');
      setAreaType(MILL_AREA_TYPES[0]);
      setMachiningStage(MACHINING_STAGES[0]);
    }
  };

  const handleSeriesChange = (ser) => {
    setMachineSeries(ser);
    setMachineModel(JYOTI_MACHINE_CASCADE[machineType][ser][0]);
  };

  const handleTemplateChange = (idx) => {
    const i = Number(idx);
    if (operation === 'Turn-Mill') {
      const safeIdx = Number.isFinite(i) && i >= 0 && i < TURN_MILL_SAMPLES.length ? i : 0;
      const item = TURN_MILL_SAMPLES[safeIdx];
      if (item) {
        try { if (typeof setSelectedTemplateIdx === 'function') setSelectedTemplateIdx(safeIdx); } catch {}
        try { if (typeof setTitle === 'function') setTitle(item.title || item.name); } catch {}
        try { if (typeof setCode === 'function') setCode(formatTurnMillByController(item.code, controller)); } catch {}
      }
      return;
    }
    const item = filteredTemplates[i];
    if (!item) return;
    if (typeof setSelectedTemplateIdx === 'function') setSelectedTemplateIdx(i);
    if (typeof setTitle === 'function') setTitle(item.name);
    if (typeof setCode === 'function') {
      setCode((operation === 'Turn-Mill' && Array.isArray(TURN_MILL_SAMPLES) && TURN_MILL_SAMPLES.length > 0) ? formatTurnMillByController((TURN_MILL_SAMPLES[Number(typeof selectedTemplateIdx !== 'undefined' ? selectedTemplateIdx : 0) % TURN_MILL_SAMPLES.length] || TURN_MILL_SAMPLES[0]).code, controller) : adaptCodeForMode(item.code, programMode, controller, domainKey, operation, workSide, mfgCfg));
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

        {/* LINE 2: Machine Model | Operation | OD / ID / Face or Pocket / Spigot */}
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
              {domainKey === 'Turning' ? 'Machining Side (OD / ID / Face)' : 'Feature Shape (Pocket / Spigot)'}
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

        {/* Dynamic Operation-Aware Tooling, Workpiece Stock & Allowances Panel */}
        <div className="bg-slate-950/90 border border-amber-500/35 rounded-xl p-3.5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
              <Wrench className="w-4 h-4" />
              <span>
                {domainKey === 'Turning'
                  ? `${machineType} • ${operation} Tooling, Stock & Finish Allowance`
                  : 'Milling Cutter Data (G43 + G41/G42), Stock & Pass Strategy'}
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">3D Sim & G-Code Linked</span>
          </div>

          {/* Row A: Strategy, Stock Condition, Finish Stock (Dia X & Len Z for Turning vs Wall & Bottom for Milling) */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            <div>
              <label className="block text-[10px] font-semibold text-amber-300 mb-1">Machining Pass / Program</label>
              <select
                value={machiningStage}
                onChange={(e) => setMachiningStage(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white focus:border-amber-400 outline-none"
              >
                {(domainKey === 'Turning' ? TURN_STAGES : MACHINING_STAGES).map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                {domainKey === 'Turning' ? 'Job / ID Stock Condition' : 'Pocket / Spigot Area'}
              </label>
              <select
                value={areaType}
                onChange={(e) => setAreaType(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white focus:border-amber-400 outline-none"
              >
                {(domainKey === 'Turning' ? TURN_AREA_TYPES : MILL_AREA_TYPES).map((ar) => (
                  <option key={ar} value={ar}>{ar}</option>
                ))}
              </select>
            </div>

            {domainKey === 'Turning' ? (
              <>
                <div>
                  <label className="block text-[10px] font-semibold text-cyan-300 mb-1">Dia Finish Stock X (mm)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={diaFinishStock}
                    onChange={(e) => setDiaFinishStock(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white focus:border-cyan-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-cyan-300 mb-1">Length Finish Stock Z (mm)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={lenFinishStock}
                    onChange={(e) => setLenFinishStock(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white focus:border-cyan-400 outline-none"
                  />
                </div>
              </>
            ) : (
              <>
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
              </>
            )}
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
                {domainKey === 'Turning' ? 'Part Cut Length Z (mm)' : 'Workpiece Height Z (mm)'}
              </label>
              <input
                type="number"
                value={stockZ}
                onChange={(e) => setStockZ(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white outline-none"
              />
            </div>

            {domainKey === 'Turning' ? (
              <div>
                <label className="block text-[10px] font-semibold text-amber-300 mb-1">
                  {workSide === 'ID' ? 'Raw ID Bore Dia (mm)' : 'Chuck Stickout (mm)'}
                </label>
                <input
                  type="number"
                  value={workSide === 'ID' ? rawIdDia : chuckStickout}
                  onChange={(e) => (workSide === 'ID' ? setRawIdDia(e.target.value) : setChuckStickout(e.target.value))}
                  className="w-full bg-slate-900 border border-amber-500/40 rounded-lg px-2.5 py-2 text-xs text-white outline-none"
                />
              </div>
            ) : (
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 mb-1">Pocket / Cut Depth (mm)</label>
                <input
                  type="number"
                  value={featureDepth}
                  onChange={(e) => setFeatureDepth(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white outline-none"
                />
              </div>
            )}
          </div>

          {/* Row C: Dynamic Operation-Specific Tooling Cascade */}
          {domainKey === 'Turning' ? (
            <>
              {operation === 'Drilling' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-800">
                  <div>
                    <label className="block text-[10px] font-semibold text-emerald-300 mb-1">Drill Tool Type</label>
                    <select
                      value={drillType}
                      onChange={(e) => setDrillType(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white outline-none"
                    >
                      {DRILL_TYPES.map((dt) => (
                        <option key={dt} value={dt}>{dt}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-emerald-300 mb-1">Drill Diameter (mm)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={drillDia}
                      onChange={(e) => setDrillDia(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-emerald-300 mb-1">Peck Depth Q (mm)</label>
                    <input
                      type="number"
                      step="1"
                      value={peckDepth}
                      onChange={(e) => setPeckDepth(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white outline-none"
                    />
                  </div>
                </div>
              )}

              {operation === 'Tapping' && (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-800">
                  <div>
                    <label className="block text-[10px] font-semibold text-emerald-300 mb-1">Tap Standard Mode</label>
                    <select
                      value={tapStandard}
                      onChange={(e) => setTapStandard(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white outline-none"
                    >
                      <option value="Standard Metric Coarse">Standard Metric Coarse</option>
                      <option value="Non-Standard / Fine Tap">Non-Standard / Fine Tap</option>
                    </select>
                  </div>
                  {tapStandard === 'Standard Metric Coarse' ? (
                    <div>
                      <label className="block text-[10px] font-semibold text-cyan-300 mb-1">Select Standard Tap</label>
                      <select
                        value={selectedStdTap}
                        onChange={(e) => {
                          setSelectedStdTap(e.target.value);
                          const found = STANDARD_TAPS.find((t) => t.label === e.target.value);
                          if (found) {
                            setTapDia(found.dia);
                            setTapPitch(found.pitch);
                          }
                        }}
                        className="w-full bg-slate-900 border border-cyan-500/40 rounded-lg px-2.5 py-2 text-xs text-white outline-none"
                      >
                        {STANDARD_TAPS.map((t) => (
                          <option key={t.label} value={t.label}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[10px] font-semibold text-amber-300 mb-1">Custom Tap Dia M (mm)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={tapDia}
                        onChange={(e) => setTapDia(e.target.value)}
                        className="w-full bg-slate-900 border border-amber-500/40 rounded-lg px-2.5 py-2 text-xs text-white outline-none"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-[10px] font-semibold text-emerald-300 mb-1">Tap Size (M)</label>
                    <input
                      type="number"
                      value={tapDia}
                      onChange={(e) => setTapDia(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-emerald-300 mb-1">Tap Pitch (mm)</label>
                    <input
                      type="number"
                      step="0.05"
                      value={tapPitch}
                      onChange={(e) => setTapPitch(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white outline-none"
                    />
                  </div>
                </div>
              )}

              {operation === 'Threading' && (
                <div className="grid grid-cols-1 sm:grid-cols-6 gap-2.5 pt-2 border-t border-amber-500/30 bg-amber-500/5 p-2.5 rounded-lg">
                  <div>
                    <label className="block text-[10px] font-semibold text-amber-300 mb-1">Thread Standard</label>
                    <select
                      value={threadStandard}
                      onChange={(e) => setThreadStandard(e.target.value)}
                      className="w-full bg-slate-900 border border-amber-500/40 rounded-lg px-2.5 py-2 text-xs text-white outline-none"
                    >
                      <option value="Standard Metric ISO">Standard (M1.6 – M100)</option>
                      <option value="Non-Standard Pitch">Non-Standard Pitch</option>
                    </select>
                  </div>

                  {threadStandard === 'Standard Metric ISO' ? (
                    <>
                      <div>
                        <label className="block text-[10px] font-semibold text-cyan-300 mb-1">Standard Size (M1.6–M100)</label>
                        <select
                          value={selectedStdThread}
                          onChange={(e) => {
                            setSelectedStdThread(e.target.value);
                            const found = STANDARD_THREADS.find((th) => th.label === e.target.value);
                            if (found) {
                              setThreadPitch(found.pitch);
                              const h = 0.61343 * Number(found.pitch);
                              setThreadMajorDia(Number(found.dia).toFixed(3));
                              setThreadMinorDia(Math.max(0, Number(found.dia) - 2 * h).toFixed(3));
                            }
                          }}
                          className="w-full bg-slate-900 border border-cyan-500/40 rounded-lg px-2.5 py-2 text-xs text-white outline-none"
                        >
                          {STANDARD_THREADS.map((th) => (
                            <option key={th.label} value={th.label}>{th.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-emerald-300 mb-1">Pitch P (mm)</label>
                        <input
                          type="number"
                          step="0.05"
                          value={threadPitch}
                          onChange={(e) => handleThreadPitchChange(e.target.value)}
                          className="w-full bg-slate-900 border border-emerald-500/40 rounded-lg px-2.5 py-2 text-xs text-white outline-none"
                        />
                      </div>
                    </>
                  ) : (
                    <div>
                      <label className="block text-[10px] font-semibold text-amber-300 mb-1">1. Custom Pitch P (mm)</label>
                      <input
                        type="number"
                        step="0.05"
                        value={threadPitch}
                        onChange={(e) => handleThreadPitchChange(e.target.value)}
                        className="w-full bg-slate-900 border border-amber-500/50 rounded-lg px-2.5 py-2 text-xs text-white outline-none"
                      />
                    </div>
                  )}

                  {workSide === 'ID' ? (
                    <>
                      <div>
                        <label className="block text-[10px] font-semibold text-cyan-300 mb-1">ID Minor Dia (Bore X)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={threadMinorDia}
                          onChange={(e) => handleThreadMinorChange(e.target.value)}
                          className="w-full bg-slate-900 border border-cyan-500/40 rounded-lg px-2.5 py-2 text-xs text-white outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-emerald-300 mb-1">ID Major Dia (Root X)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={threadMajorDia}
                          onChange={(e) => handleThreadMajorChange(e.target.value)}
                          className="w-full bg-slate-900 border border-emerald-500/40 rounded-lg px-2.5 py-2 text-xs text-white outline-none"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-[10px] font-semibold text-cyan-300 mb-1">OD Major Dia (Start X)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={threadMajorDia}
                          onChange={(e) => handleThreadMajorChange(e.target.value)}
                          className="w-full bg-slate-900 border border-cyan-500/40 rounded-lg px-2.5 py-2 text-xs text-white outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-emerald-300 mb-1">OD Minor Dia (Core X)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={threadMinorDia}
                          onChange={(e) => handleThreadMinorChange(e.target.value)}
                          className="w-full bg-slate-900 border border-emerald-500/40 rounded-lg px-2.5 py-2 text-xs text-white outline-none"
                        />
                      </div>
                    </>
                  )}

                  <div className={`${threadStandard === 'Standard Metric ISO' ? 'sm:col-span-1' : 'sm:col-span-2'} bg-slate-900 border border-cyan-500/50 rounded-lg px-2.5 py-1.5 flex flex-col justify-center`}>
                    <span className="text-[9px] font-semibold text-cyan-300">Auto Height H (0.6134×P)</span>
                    <span className="text-[11px] font-mono font-bold text-emerald-300">
                      H={threadHeight} (P{Math.round(Number(threadHeight) * 1000)})
                    </span>
                  </div>
                </div>
              )}

              {operation !== 'Drilling' && operation !== 'Tapping' && operation !== 'Threading' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-800">
                  <div>
                    <label className="block text-[10px] font-semibold text-emerald-300 mb-1">Turning / Boring Insert Type</label>
                    <select
                      value={insertType}
                      onChange={(e) => setInsertType(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white outline-none"
                    >
                      {(typeof operation !== 'undefined' && operation === 'Turn-Mill' ? TURN_MILL_LIVE_TOOLS : TURNING_INSERTS).map((ins) => (
                        <option key={ins} value={ins}>{ins}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-emerald-300 mb-1">Insert Nose Radius R (mm)</label>
                    <select
                      value={noseRadius}
                      onChange={(e) => setNoseRadius(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white outline-none"
                    >
                      <option value="0.2">R0.2 mm (Fine Finish)</option>
                      <option value="0.4">R0.4 mm (Semi-Finish / Finish)</option>
                      <option value="0.8">R0.8 mm (Medium Roughing)</option>
                      <option value="1.2">R1.2 mm (Heavy Roughing)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-cyan-300 mb-1">Tool Nose Comp (G41 / G42)</label>
                    <select
                      value={compMode}
                      onChange={(e) => setCompMode(e.target.value)}
                      className="w-full bg-slate-900 border border-cyan-500/40 rounded-lg px-2.5 py-2 text-xs text-white outline-none"
                    >
                      {COMP_MODES.map((cm) => (
                        <option key={cm} value={cm}>{cm}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-800">
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
                <label className="block text-[10px] font-semibold text-cyan-300 mb-1">Cutter Comp (G43 + G41/G42)</label>
                <select
                  value={compMode}
                  onChange={(e) => setCompMode(e.target.value)}
                  className="w-full bg-slate-900 border border-cyan-500/40 rounded-lg px-2.5 py-2 text-xs text-white outline-none"
                >
                  {COMP_MODES.map((cm) => (
                    <option key={cm} value={cm}>{cm}</option>
                  ))}
                </select>
              </div>
              {(operation === 'Drilling' || operation === 'Tapping') && (
                <div>
                  <label className="text-[11px] font-semibold text-amber-400 block mb-1">
                    {operation === 'Drilling' ? 'Drilling Cycle Mode (G81/G73/G83)' : 'Tapping Cycle Mode (G84/G74)'}
                  </label>
                  {operation === 'Drilling' ? (
                    <select
                      value={mfgCfg.drillMode || 'Deep Hole Peck Drilling (G83 - Full Retract)'}
                      onChange={(e) => setMfgCfg({ ...mfgCfg, drillMode: e.target.value })}
                      className="w-full bg-slate-900 border border-cyan-500/50 rounded-lg px-2.5 py-1.5 text-xs text-cyan-300 font-bold outline-none"
                    >
                      <option value="Standard Drilling (G81 - Direct)">Standard Drilling (G81 - Direct)</option>
                      <option value="Spot / Dwell Drilling (G82 - Bottom Dwell)">Spot / Dwell Drilling (G82 - Bottom Dwell)</option>
                      <option value="Chip-Breaking Peck Drilling (G73 - 1mm Retract)">Chip-Breaking Peck Drilling (G73 - 1mm Retract)</option>
                      <option value="Deep Hole Peck Drilling (G83 - Full Retract)">Deep Hole Peck Drilling (G83 - Full Retract)</option>
                    </select>
                  ) : (
                    <select
                      value={mfgCfg.tapMode || 'Standard Rigid Tapping (G84 - Single Pass)'}
                      onChange={(e) => setMfgCfg({ ...mfgCfg, tapMode: e.target.value })}
                      className="w-full bg-slate-900 border border-amber-500/50 rounded-lg px-2.5 py-1.5 text-xs text-amber-300 font-bold outline-none"
                    >
                      <option value="Standard Rigid Tapping (G84 - Single Pass)">Standard Rigid Tapping (G84 - Single Pass)</option>
                      <option value="Peck Chip-Break Tapping (G84 Q - Deep Hole)">Peck Chip-Break Tapping (G84 Q - Deep Hole)</option>
                      <option value="Left-Hand Reverse Tapping (G74)">Left-Hand Reverse Tapping (G74)</option>
                    </select>
                  )}
                </div>
              )}

              {(operation === 'Drilling' || operation === 'Tapping') && (
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Peck Depth Q (mm)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={mfgCfg.peckDepth || '8'}
                    onChange={(e) => setMfgCfg({ ...mfgCfg, peckDepth: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 outline-none"
                  />
                </div>
              )}
            </div>
          )}

          {/* Conditional Chamfer Cascade (ONLY opens when Chamfering Pass is selected!) */}
          {showChamferCascade && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-amber-500/30 bg-amber-500/5 p-2.5 rounded-lg">
              <div>
                <label className="block text-[10px] font-semibold text-amber-300 mb-1">Chamfer Tool Dia (mm)</label>
                <input
                  type="number"
                  value={chamferDia}
                  onChange={(e) => setChamferDia(e.target.value)}
                  className="w-full bg-slate-900 border border-amber-500/50 rounded-lg px-2.5 py-2 text-xs text-white outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-amber-300 mb-1">Chamfer Tip Angle (°)</label>
                <input
                  type="number"
                  value={chamferAngle}
                  onChange={(e) => setChamferAngle(e.target.value)}
                  className="w-full bg-slate-900 border border-amber-500/50 rounded-lg px-2.5 py-2 text-xs text-white outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-amber-300 mb-1">Chamfer Size C (mm)</label>
                <input
                  type="number"
                  step="0.1"
                  value={chamferSize}
                  onChange={(e) => setChamferSize(e.target.value)}
                  className="w-full bg-slate-900 border border-amber-500/50 rounded-lg px-2.5 py-2 text-xs text-white outline-none"
                />
              </div>
            </div>
          )}
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
                {(operation === 'Turn-Mill' ? TURN_MILL_SAMPLES : filteredTemplates).map((tpl, idx) => (
  <option key={(tpl && tpl.name) || idx} value={idx}>{(tpl && tpl.name) || tpl}</option>
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

        {/* Side-by-Side G-Code Editor & Live 3D Tooling Animation */}
        <form onSubmit={saveProgram} className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Sample / Active G-Code & 3D Simulation</span>
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
              className="w-full min-h-[600px] bg-slate-950 border border-slate-700 rounded-xl p-4 text-xs font-mono text-emerald-300 leading-relaxed focus:border-cyan-500 outline-none"
              required
            />
            <CncSimulator
              code={code}
              domainKey={domainKey}
              machineType={machineType}
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
            <pre className="bg-slate-950 p-3 rounded-lg text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-60">{applyNoseCompToCode((typeof operation !== 'undefined' && operation === 'Turn-Mill') ? formatTurnMillByController((TURN_MILL_SAMPLES[Number(typeof selectedTemplateIdx !== 'undefined' ? selectedTemplateIdx : 0) % TURN_MILL_SAMPLES.length] || TURN_MILL_SAMPLES[0]).code, typeof controller !== 'undefined' ? controller : 'Fanuc') : (p.code), typeof compMode !== 'undefined' ? compMode : '')}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}




