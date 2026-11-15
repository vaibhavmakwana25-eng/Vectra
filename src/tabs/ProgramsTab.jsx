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


function buildFanucIfGotoMacro({
  isTurn = true,
  isID = false,
  isThread = false,
  isGroove = false,
  isFace = false,
  isDrill = false,
  isTap = false,
  operation = 'OD Turning',
  rawOD = 50,
  finOD = 32,
  partLen = 45,
  rawID = 18,
  depth = 10,
  peck = 5,
  pitch = 1.5,
  majDia = 24,
  minDia = 21.5,
  rpm = 1200,
  feed = 0.22,
  diaStock = 0.5,
  lenStock = 0.2,
  drillMode = '',
  tapMode = ''
}) {
  const lines = [
    '%',
    'O5001 (FANUC IF-GOTO MACRO - ' + String(operation).toUpperCase() + ')',
    'G21 G40 G80 G97 ' + (isTurn ? 'G99' : 'G94 G54 G90')
  ];
  if (isTurn) {
    lines.push('#101 = ' + rawOD.toFixed(3) + ' (RAW DIA)');
    lines.push('#102 = ' + finOD.toFixed(3) + ' (TARGET DIA)');
    lines.push('#103 = ' + partLen.toFixed(3) + ' (LENGTH Z)');
    lines.push('#104 = 1.500 (DOC STEP)');
    lines.push('#105 = ' + diaStock.toFixed(3) + ' (FINISH STOCK)');
    lines.push('T0101');
    lines.push('G96 S' + Math.min(450, Math.max(80, Math.round(rpm / 5))) + ' M03');
    if (isThread) {
      const tLen = Math.min(partLen - 2, 30);
      lines.push('#110 = ' + majDia.toFixed(3) + ' (MAJOR DIA)');
      lines.push('#111 = ' + minDia.toFixed(3) + ' (MINOR DIA)');
      lines.push('#112 = ' + pitch.toFixed(3) + ' (PITCH)');
      lines.push('#113 = 0.250 (PASS STEP)');
      lines.push('#114 = #110');
      lines.push('G97 S' + Math.min(1500, rpm) + ' M03');
      lines.push('G00 X' + (majDia + 5).toFixed(2) + ' Z4.0');
      lines.push('N10');
      lines.push('#114 = #114 - #113');
      lines.push('IF [#114 GE #111] GOTO 20');
      lines.push('#114 = #111');
      lines.push('N20');
      lines.push('G00 X' + (majDia + 3).toFixed(2));
      lines.push('G32 X#114 Z-' + tLen.toFixed(2) + ' F#112');
      lines.push('G00 X' + (majDia + 5).toFixed(2));
      lines.push('Z4.0');
      lines.push('IF [#114 GT #111] GOTO 10');
      lines.push('GOTO 90');
    } else if (isGroove) {
      const gZ = -Math.min(partLen - 4, 22);
      const gEnd = isID ? finOD + 4 : Math.max(6, finOD - 6);
      lines.push('#110 = ' + gZ.toFixed(2));
      lines.push('#111 = ' + gEnd.toFixed(2));
      lines.push('#112 = 1.200');
      lines.push('#113 = #101');
      lines.push('G00 X' + (rawOD + 4).toFixed(2) + ' Z#110');
      lines.push('N10');
      lines.push('#113 = #113 - #112');
      lines.push('IF [#113 GE #111] GOTO 20');
      lines.push('#113 = #111');
      lines.push('N20');
      lines.push('G01 X#113 F' + (feed * 0.4).toFixed(3));
      lines.push('G00 X' + (rawOD + 4).toFixed(2));
      lines.push('IF [#113 GT #111] GOTO 10');
      lines.push('GOTO 90');
    } else if (isDrill || isTap) {
      const hDepth = Math.min(partLen, Math.max(5, depth));
      lines.push('#120 = ' + peck.toFixed(2) + ' (PECK Q)');
      lines.push('#121 = ' + hDepth.toFixed(2) + ' (DEPTH Z)');
      lines.push('#122 = 0.0');
      lines.push('G97 S' + rpm + ' M03');
      lines.push('G00 X0.0 Z5.0');
      if (isTap && !tapMode.includes('Peck')) {
        lines.push('M29 S' + rpm);
        lines.push((tapMode.includes('G74') ? 'G74' : 'G84') + ' X0.0 Z-#121 R2.0 F' + pitch.toFixed(2));
        lines.push('G80');
        lines.push('GOTO 90');
      } else {
        lines.push('N10');
        lines.push('#122 = #122 + #120');
        lines.push('IF [#122 LE #121] GOTO 20');
        lines.push('#122 = #121');
        lines.push('N20');
        lines.push('G01 Z-[0 - #122] F' + (isTap ? pitch.toFixed(2) : feed.toFixed(3)));
        lines.push('G00 Z' + (drillMode.includes('G73') ? '[0 - #122 + 1.5]' : '3.0'));
        lines.push('IF [#122 LT #121] GOTO 10');
        lines.push('GOTO 90');
      }
    } else if (isFace) {
      const fDepth = Math.min(6, Math.max(1, depth));
      lines.push('#110 = 1.000');
      lines.push('#111 = ' + fDepth.toFixed(2));
      lines.push('#112 = 0.0');
      lines.push('N10');
      lines.push('#112 = #112 + #110');
      lines.push('IF [#112 LE #111] GOTO 20');
      lines.push('#112 = #111');
      lines.push('N20');
      lines.push('G00 X' + (rawOD + 3).toFixed(2) + ' Z-[0 - #112 - 1.0]');
      lines.push('G01 X' + (isID ? rawID : 0).toFixed(2) + ' F' + feed.toFixed(3));
      lines.push('G00 Z2.0');
      lines.push('IF [#112 LT #111] GOTO 10');
      lines.push('GOTO 90');
    } else {
      const roughTarget = isID ? Math.max(rawID, finOD - diaStock) : finOD + diaStock;
      const zCut = Math.max(5, partLen - lenStock);
      lines.push('#106 = #101');
      lines.push('#107 = ' + roughTarget.toFixed(3));
      lines.push('N10');
      lines.push('#106 = ' + (isID ? '#106 + #104' : '#106 - #104'));
      if (isID) {
        lines.push('IF [#106 LE #107] GOTO 20');
        lines.push('#106 = #107');
      } else {
        lines.push('IF [#106 GE #107] GOTO 20');
        lines.push('#106 = #107');
      }
      lines.push('N20');
      lines.push('G00 X' + (isID ? rawID - 2 : rawOD + 3).toFixed(2) + ' Z1.0');
      lines.push('G01 X#106 Z0.0 F' + feed.toFixed(3));
      lines.push('Z-' + zCut.toFixed(2) + ' F' + (feed * 0.85).toFixed(3));
      lines.push('G01 X' + (isID ? rawID - 2 : rawOD + 3).toFixed(2));
      lines.push('IF [' + (isID ? '#106 LT #107' : '#106 GT #107') + '] GOTO 10');
      lines.push('GOTO 50');
      lines.push('N50');
      lines.push('G00 X' + finOD.toFixed(3) + ' Z1.0');
      lines.push('G01 Z-' + partLen.toFixed(2) + ' F' + (feed * 0.5).toFixed(3));
      lines.push('GOTO 90');
    }
    lines.push('N90');
    lines.push('G00 X120.0 Z100.0 M05');
    lines.push('M30');
    lines.push('%');
    return lines.join('\n');
  }

  lines.push('#101 = ' + depth.toFixed(2) + ' (TOTAL Z DEPTH)');
  lines.push('#102 = ' + Math.max(1, peck).toFixed(2) + ' (Z STEP Q)');
  lines.push('#103 = ' + Math.max(5, finOD * 0.6).toFixed(2) + ' (RADIUS / HALF-W)');
  lines.push('#104 = 0.0');
  lines.push('T01 M06');
  lines.push('S' + rpm + ' M03');
  lines.push('G43 H01 Z20.0');
  if (isDrill || isTap) {
    lines.push('G00 X0.0 Y0.0 Z5.0');
    if (isTap && !tapMode.includes('Peck')) {
      lines.push('M29 S' + rpm);
      lines.push((tapMode.includes('G74') ? 'G74' : 'G84') + ' X0.0 Y0.0 Z-#101 R2.0 F' + pitch.toFixed(2));
      lines.push('G80');
      lines.push('GOTO 90');
    } else {
      lines.push('N10');
      lines.push('#104 = #104 + #102');
      lines.push('IF [#104 LE #101] GOTO 20');
      lines.push('#104 = #101');
      lines.push('N20');
      lines.push('G01 Z-[0 - #104] F' + (isTap ? pitch.toFixed(2) : Math.max(80, Math.round(feed * 0.5))));
      lines.push('G00 Z' + (drillMode.includes('G73') ? '[0 - #104 + 1.5]' : '3.0'));
      lines.push('IF [#104 LT #101] GOTO 10');
      lines.push('GOTO 90');
    }
  } else {
    lines.push('N10');
    lines.push('#104 = #104 + #102');
    lines.push('IF [#104 LE #101] GOTO 20');
    lines.push('#104 = #101');
    lines.push('N20');
    lines.push('G00 X-[0 - #103] Y0.0 Z2.0');
    lines.push('G01 Z-[0 - #104] F' + Math.max(80, Math.round(feed * 0.5)));
    lines.push('G02 I#103 J0.0 F' + feed);
    lines.push('IF [#104 LT #101] GOTO 10');
    lines.push('GOTO 90');
  }
  lines.push('N90');
  lines.push('G00 Z50.0 M05');
  lines.push('M30');
  lines.push('%');
  return lines.join('\n');
}

function buildUniversalControllerProgram({
  controller = 'Siemens',
  domainKey = 'Turning',
  machineType = 'CNC Lathe',
  workSide = 'OD',
  operation = 'OD Turning',
  templateName = '',
  mfgCfg = {}
}) {
  const ctrl = String(controller || 'Siemens').toUpperCase();
  const isTurn = domainKey === 'Turning' || machineType === 'VTL';
  const isID = workSide === 'ID' || String(operation || '').toUpperCase().includes('ID');
  const opUp = (String(operation || '') + ' ' + String(templateName || '') + ' ' + String(workSide || '')).toUpperCase();

  const rawOD = Number(mfgCfg.stockX || 50);
  const finOD = Number(mfgCfg.stockY || 32);
  const partLen = Math.max(10, Number(mfgCfg.stockZ || 45));
  const rawID = Number(mfgCfg.rawIdDia || 18);
  const depth = Math.abs(Number(mfgCfg.featureDepth || 10));
  const peck = Math.max(1, Number(mfgCfg.peckDepth || 8));
  const pitch = Number(mfgCfg.threadPitch || mfgCfg.tapPitch || 1.5);
  const majDia = Number(mfgCfg.threadMajorDia || mfgCfg.tapDia || 24);
  const minDia = Number(mfgCfg.threadMinorDia || Math.max(4, majDia - pitch * 1.25));
  const rpm = Number(mfgCfg.spindleRpm || 1200);
  const feed = Number(mfgCfg.feedRate || (isTurn ? 0.22 : 250));
  const drillMode = mfgCfg.drillMode || 'Deep Hole Peck Drilling (G83 - Full Retract)';
  const tapMode = mfgCfg.tapMode || 'Standard Rigid Tapping (G84 - Single Pass)';

  const isThread = opUp.includes('THREAD');
  const isGroove = opUp.includes('GROOVE') || opUp.includes('PART');
  const isFace = opUp.includes('FACE') || opUp === 'FACING';
  const isDrill = opUp.includes('DRILL') || opUp.includes('BORE') || opUp.includes('REAM');
  const isTap = opUp.includes('TAP');
  const isPocket = opUp.includes('POCKET');
  const isSpigot = opUp.includes('SPIGOT') || opUp.includes('CONTOUR') || opUp.includes('PROFILE');

  if (ctrl.includes('SIEMENS')) {
    const lines = [
      '; CONTROLLER : SIEMENS SINUMERIK 828D / 840D',
      '; OPERATION  : ' + operation,
      'WORKPIECE(,,,"CYLINDER",0,-' + partLen.toFixed(1) + ',-' + (partLen + 15).toFixed(1) + ',' + rawOD.toFixed(1) + ')',
      'T1 D1',
      'G95 S' + rpm + ' M03'
    ];
    if (isTurn) {
      if (isThread) {
        lines.push('CYCLE97(' + pitch.toFixed(2) + ', 2.0, 1.0, 2.0, ' + majDia.toFixed(2) + ', ' + minDia.toFixed(2) + ', 0.0, -' + Math.min(partLen - 2, 30).toFixed(1) + ', 0.0, 0.0, 1, 1, 3, 0, 1)');
      } else if (isGroove) {
        lines.push('CYCLE93(-' + Math.min(partLen - 4, 22).toFixed(1) + ', ' + (isID ? finOD + 4 : Math.max(6, finOD - 6)).toFixed(2) + ', 3.0, 1.5, 0.2, 0.1, 0.1, ' + feed + ', 1, 0)');
      } else if (isDrill) {
        const cName = drillMode.includes('G81') ? 'CYCLE81' : 'CYCLE83';
        const vari = drillMode.includes('G73') ? 0 : 1;
        lines.push(cName + '(5.0, 0.0, 2.0, -' + Math.min(partLen, 40).toFixed(1) + ', , ' + peck.toFixed(1) + ', , , , , ' + vari + ')');
      } else if (isTap) {
        lines.push('CYCLE84(5.0, 0.0, 2.0, -' + Math.min(partLen, 35).toFixed(1) + ', , ' + pitch.toFixed(2) + ', 3, ' + rpm + ', ' + rpm + ', 0.0, 0, 1, 0)');
      } else {
        lines.push('CYCLE95("ROUGH_PROF", ' + Number(mfgCfg.diaFinishStock ?? 0.5).toFixed(2) + ', ' + Number(mfgCfg.lenFinishStock ?? 0.2).toFixed(2) + ', 0.1, ' + feed + ', ' + (feed * 0.6) + ', ' + feed + ', ' + (isID ? 102 : 101) + ', 0, 0, 0)');
        lines.push('ROUGH_PROF:');
        lines.push('G01 X' + finOD.toFixed(2) + ' Z0.0');
        lines.push('Z-' + partLen.toFixed(1));
      }
      lines.push('G00 X120.0 Z100.0 M05');
      lines.push('M30');
    } else {
      lines.push('G94 G54');
      if (isFace) {
        lines.push('CYCLE61(5.0, 0.0, 2.0, -' + Math.min(6, depth).toFixed(1) + ', ' + rawOD.toFixed(1) + ', ' + finOD.toFixed(1) + ', 0.0, 0.0, 0.0, 0.2, 75.0, ' + feed + ', 1, 1)');
      } else if (isPocket) {
        const pCycle = opUp.includes('CIRCULAR') ? 'POCKET4' : 'POCKET3';
        lines.push(pCycle + '(5.0, 0.0, 2.0, -' + depth.toFixed(1) + ', ' + rawOD.toFixed(1) + ', ' + finOD.toFixed(1) + ', 0.0, 0.0, 0.0, ' + peck.toFixed(1) + ', 0.3, 0.2, ' + feed + ', ' + (feed * 0.7) + ', 1, 21)');
      } else if (isSpigot) {
        lines.push('CYCLE76(5.0, 0.0, 2.0, -' + depth.toFixed(1) + ', ' + rawOD.toFixed(1) + ', ' + finOD.toFixed(1) + ', 0.0, 0.0, 0.0, 0.3, 0.2, ' + feed + ', ' + (feed * 0.7) + ', 1, 0, 1)');
      } else if (isTap) {
        lines.push('CYCLE84(5.0, 0.0, 2.0, -' + depth.toFixed(1) + ', , ' + pitch.toFixed(2) + ', 3, ' + rpm + ', ' + rpm + ', 0.0, 0, 1, 0)');
      } else {
        const cName = drillMode.includes('G81') ? 'CYCLE81' : 'CYCLE83';
        const vari = drillMode.includes('G73') ? 0 : 1;
        lines.push(cName + '(5.0, 0.0, 2.0, -' + depth.toFixed(1) + ', , ' + peck.toFixed(1) + ', , , , , ' + vari + ')');
      }
      lines.push('G00 Z100.0 M05');
      lines.push('M30');
    }
    return lines.join('\n');
  }

  if (ctrl.includes('MITSUBISHI')) {
    const gDrill = drillMode.includes('G81') ? 'G81' : drillMode.includes('G73') ? 'G73' : 'G83';
    const gTap = tapMode.includes('G74') ? 'G74' : 'G84';
    const lines = [
      '%',
      'O2002 (MITSUBISHI M80 - ' + String(operation).toUpperCase() + ')',
      'G21 G40 G80 G97 ' + (isTurn ? 'G99' : 'G94 G54 G90'),
      'T0101',
      'S' + rpm + ' M03'
    ];
    if (isTap) {
      lines.push(gTap + ' X0.0 ' + (isTurn ? '' : 'Y0.0 ') + 'Z-' + Math.min(partLen, depth).toFixed(1) + (tapMode.includes('Peck') ? ' Q' + peck.toFixed(1) : '') + ' R2.0 F' + pitch.toFixed(2) + ' ,R1');
      lines.push('G80');
    } else if (isDrill) {
      lines.push(gDrill + ' X0.0 ' + (isTurn ? '' : 'Y0.0 ') + 'Z-' + Math.min(partLen, depth).toFixed(1) + (gDrill === 'G81' ? '' : ' Q' + peck.toFixed(1)) + ' R2.0 F' + feed);
      lines.push('G80');
    } else if (isTurn) {
      lines.push('G71 U1.5 R0.5');
      lines.push('G71 P10 Q20 U0.3 W0.1 F' + feed);
      lines.push('N10 G00 X' + finOD.toFixed(2));
      lines.push('G01 Z-' + partLen.toFixed(1) + ' F' + (feed * 0.6).toFixed(2));
      lines.push('N20 G01 X' + (rawOD + 2).toFixed(2));
    } else {
      lines.push('G00 X-35.0 Y0.0 Z2.0');
      lines.push('G01 Z-' + depth.toFixed(1) + ' F' + Math.max(80, Math.round(feed * 0.5)));
      lines.push('G41 G01 X0.0 Y0.0 F' + feed);
      lines.push('G40 G00 Z50.0 M05');
    }
    lines.push((isTurn ? 'G28 U0. W0. ' : '') + 'M30');
    lines.push('%');
    return lines.join('\n');
  }

  return buildFanucIfGotoMacro({
    isTurn,
    isID,
    isThread,
    isGroove,
    isFace,
    isDrill,
    isTap,
    operation,
    rawOD,
    finOD,
    partLen,
    rawID,
    depth,
    peck,
    pitch,
    majDia,
    minDia,
    rpm,
    feed,
    diaStock: Number(mfgCfg.diaFinishStock ?? 0.5),
    lenStock: Number(mfgCfg.lenFinishStock ?? 0.2),
    drillMode,
    tapMode
  });
}


function generateIfGotoMacroFromTable({
  domainKey = 'Turning',
  machineType = 'CNC Lathe',
  workSide = 'OD',
  operation = 'OD Turning',
  mfgCfg = {}
}) {
  const isTurn = domainKey === 'Turning' || machineType === 'VTL';
  const isID = workSide === 'ID' || String(operation || '').toUpperCase().includes('ID');
  const op = String(operation || '').toUpperCase();

  const rawDia = Number(mfgCfg.stockX || 50);
  const finDia = Number(mfgCfg.stockY || 32);
  const lenZ = Math.max(5, Number(mfgCfg.stockZ || 45));
  const rawIdDia = Number(mfgCfg.rawIdDia || 18);
  const depthZ = Math.abs(Number(mfgCfg.featureDepth || 10));
  const peckQ = Math.max(0.5, Number(mfgCfg.peckDepth || 4));
  const stepDoc = Math.max(0.2, Number(mfgCfg.docStep || 1.5));
  const finStock = Number(mfgCfg.diaFinishStock ?? 0.5);
  const lenStock = Number(mfgCfg.lenFinishStock ?? 0.2);
  const pitch = Number(mfgCfg.threadPitch || mfgCfg.tapPitch || 1.5);
  const majDia = Number(mfgCfg.threadMajorDia || mfgCfg.tapDia || 24);
  const minDia = Number(mfgCfg.threadMinorDia || Math.max(4, majDia - pitch * 1.25));
  const rpm = Number(mfgCfg.spindleRpm || 1200);
  const feed = Number(mfgCfg.feedRate || (isTurn ? 0.22 : 250));

  const out = [
    '%',
    'O6001 (FANUC IF-GOTO MACRO - ' + op + ')',
    '(GENERATED FROM DATA TABLE)',
    'G21 G40 G80 G97 ' + (isTurn ? 'G99' : 'G94 G54 G90')
  ];

  if (isTurn) {
    out.push('#101 = ' + rawDia.toFixed(3) + ' (RAW / START DIA)');
    out.push('#102 = ' + finDia.toFixed(3) + ' (FINISH DIA)');
    out.push('#103 = ' + lenZ.toFixed(3) + ' (TOTAL Z LENGTH)');
    out.push('#104 = ' + stepDoc.toFixed(3) + ' (STEP / DOC)');
    out.push('#105 = ' + finStock.toFixed(3) + ' (FINISH STOCK)');
    out.push('T0101');
    out.push('G96 S' + Math.min(450, Math.max(80, Math.round(rpm / 5))) + ' M03');

    if (op.includes('THREAD')) {
      const tZ = Math.min(lenZ - 2, 30);
      out.push('#110 = ' + majDia.toFixed(3) + ' (MAJOR DIA)');
      out.push('#111 = ' + minDia.toFixed(3) + ' (MINOR DIA)');
      out.push('#112 = ' + pitch.toFixed(3) + ' (PITCH)');
      out.push('#113 = 0.250 (THREAD INFEED)');
      out.push('#114 = #110 (CURRENT DIA)');
      out.push('G97 S' + Math.min(1500, rpm) + ' M03');
      out.push('G00 X' + (majDia + 5).toFixed(2) + ' Z4.0');
      out.push('N10');
      out.push('#114 = #114 - #113');
      out.push('IF [#114 GE #111] GOTO 20');
      out.push('#114 = #111');
      out.push('N20');
      out.push('G00 X' + (majDia + 3).toFixed(2));
      out.push('G32 X#114 Z-' + tZ.toFixed(2) + ' F#112');
      out.push('G00 X' + (majDia + 5).toFixed(2));
      out.push('Z4.0');
      out.push('IF [#114 GT #111] GOTO 10');
      out.push('GOTO 90');
    } else if (op.includes('GROOVE') || op.includes('PART')) {
      const gZ = -Math.min(lenZ - 3, 22);
      const gTarget = op.includes('PART') ? 2.0 : (isID ? finDia + 4 : Math.max(6, finDia - 5));
      out.push('#110 = ' + gZ.toFixed(2) + ' (GROOVE Z)');
      out.push('#111 = ' + gTarget.toFixed(2) + ' (TARGET X)');
      out.push('#112 = ' + peckQ.toFixed(2) + ' (PECK X)');
      out.push('#113 = #101 (CURRENT X)');
      out.push('G00 X' + (rawDia + 4).toFixed(2) + ' Z#110');
      out.push('N10');
      out.push('#113 = #113 - #112');
      out.push('IF [#113 GE #111] GOTO 20');
      out.push('#113 = #111');
      out.push('N20');
      out.push('G01 X#113 F' + (feed * 0.4).toFixed(3));
      out.push('G00 X' + (rawDia + 4).toFixed(2));
      out.push('IF [#113 GT #111] GOTO 10');
      out.push('GOTO 90');
    } else if (op.includes('FACE')) {
      const fDepth = Math.min(8, Math.max(1, depthZ));
      out.push('#110 = ' + peckQ.toFixed(2) + ' (FACE STEP Z)');
      out.push('#111 = ' + fDepth.toFixed(2) + ' (TOTAL FACE Z)');
      out.push('#112 = 0.0 (CURRENT Z)');
      out.push('N10');
      out.push('#112 = #112 + #110');
      out.push('IF [#112 LE #111] GOTO 20');
      out.push('#112 = #111');
      out.push('N20');
      out.push('G00 X' + (rawDia + 3).toFixed(2) + ' Z-[0 - #112 - 1.0]');
      out.push('G01 X' + (isID ? rawIdDia : 0).toFixed(2) + ' F' + feed.toFixed(3));
      out.push('G00 Z2.0');
      out.push('IF [#112 LT #111] GOTO 10');
      out.push('GOTO 90');
    } else if (op.includes('DRILL') || op.includes('TAP') || op.includes('BORE')) {
      const hDepth = Math.min(lenZ, Math.max(4, depthZ));
      out.push('#120 = ' + peckQ.toFixed(2) + ' (PECK Q)');
      out.push('#121 = ' + hDepth.toFixed(2) + ' (HOLE DEPTH)');
      out.push('#122 = 0.0 (CURRENT Z)');
      out.push('G97 S' + rpm + ' M03');
      out.push('G00 X0.0 Z5.0');
      out.push('N10');
      out.push('#122 = #122 + #120');
      out.push('IF [#122 LE #121] GOTO 20');
      out.push('#122 = #121');
      out.push('N20');
      out.push('G01 Z-[0 - #122] F' + (op.includes('TAP') ? pitch.toFixed(2) : feed.toFixed(3)));
      out.push('G00 Z' + ((mfgCfg.drillMode || '').includes('G73') ? '[0 - #122 + 1.5]' : '3.0'));
      out.push('IF [#122 LT #121] GOTO 10');
      out.push('GOTO 90');
    } else {
      const roughTarget = isID ? Math.max(rawIdDia, finDia - finStock) : finDia + finStock;
      const zCut = Math.max(4, lenZ - lenStock);
      out.push('#106 = #101 (WORKING DIA)');
      out.push('#107 = ' + roughTarget.toFixed(3) + ' (ROUGH LIMIT)');
      out.push('N10');
      out.push('#106 = ' + (isID ? '#106 + #104' : '#106 - #104'));
      if (isID) {
        out.push('IF [#106 LE #107] GOTO 20');
        out.push('#106 = #107');
      } else {
        out.push('IF [#106 GE #107] GOTO 20');
        out.push('#106 = #107');
      }
      out.push('N20');
      out.push('G00 X' + (isID ? rawIdDia - 2 : rawDia + 3).toFixed(2) + ' Z1.0');
      out.push('G01 X#106 Z0.0 F' + feed.toFixed(3));
      out.push('Z-' + zCut.toFixed(2) + ' F' + (feed * 0.85).toFixed(3));
      out.push('G01 X' + (isID ? rawIdDia - 2 : rawIdDia ? rawDia + 3 : rawDia + 3).toFixed(2));
      out.push('IF [' + (isID ? '#106 LT #107' : '#106 GT #107') + '] GOTO 10');
      out.push('GOTO 50');
      out.push('N50');
      out.push('G00 X' + finDia.toFixed(3) + ' Z1.0');
      out.push('G01 Z-' + lenZ.toFixed(2) + ' F' + (feed * 0.5).toFixed(3));
      out.push('GOTO 90');
    }

    out.push('N90');
    out.push('G00 X120.0 Z100.0 M05');
    out.push('M30');
    out.push('%');
    return out.join('\n');
  }

  // MILLING IF-GOTO MACRO (Face, Contour, Slot, Pocket, Spigot, Drilling, Tapping)
  out.push('#101 = ' + depthZ.toFixed(2) + ' (TOTAL Z DEPTH)');
  out.push('#102 = ' + peckQ.toFixed(2) + ' (Z STEP Q)');
  out.push('#103 = ' + Math.max(5, finDia * 0.6).toFixed(2) + ' (RADIUS / HALF-W)');
  out.push('#104 = 0.0 (CURRENT Z)');
  out.push('T01 M06');
  out.push('S' + rpm + ' M03');
  out.push('G43 H01 Z20.0');

  if (op.includes('DRILL') || op.includes('TAP') || op.includes('BORE')) {
    out.push('G00 X0.0 Y0.0 Z5.0');
    out.push('N10');
    out.push('#104 = #104 + #102');
    out.push('IF [#104 LE #101] GOTO 20');
    out.push('#104 = #101');
    out.push('N20');
    out.push('G01 Z-[0 - #104] F' + (op.includes('TAP') ? pitch.toFixed(2) : Math.max(80, Math.round(feed * 0.5))));
    out.push('G00 Z' + ((mfgCfg.drillMode || '').includes('G73') ? '[0 - #104 + 1.5]' : '3.0'));
    out.push('IF [#104 LT #101] GOTO 10');
    out.push('GOTO 90');
  } else if (op.includes('FACE')) {
    const xSpan = Math.max(25, rawDia * 0.45);
    const ySpan = Math.max(15, lenZ * 0.4);
    out.push('#105 = ' + xSpan.toFixed(2) + ' (X HALF-SPAN)');
    out.push('#106 = ' + ySpan.toFixed(2) + ' (Y HALF-SPAN)');
    out.push('#107 = 0 - #106 (CURRENT Y)');
    out.push('N10');
    out.push('#104 = #104 + #102');
    out.push('IF [#104 LE #101] GOTO 20');
    out.push('#104 = #101');
    out.push('N20');
    out.push('G00 X-[0 - #105] Y#107 Z2.0');
    out.push('G01 Z-[0 - #104] F' + Math.max(100, Math.round(feed * 0.5)));
    out.push('G01 X#105 F' + feed);
    out.push('#107 = #107 + 10.0');
    out.push('G01 Y#107 F' + feed);
    out.push('G01 X-[0 - #105] F' + feed);
    out.push('IF [#104 LT #101] GOTO 10');
    out.push('GOTO 90');
  } else {
    out.push('N10');
    out.push('#104 = #104 + #102');
    out.push('IF [#104 LE #101] GOTO 20');
    out.push('#104 = #101');
    out.push('N20');
    out.push('G00 X-[0 - #103] Y0.0 Z2.0');
    out.push('G01 Z-[0 - #104] F' + Math.max(80, Math.round(feed * 0.5)));
    out.push('G02 I#103 J0.0 F' + feed + ' (' + op + ')');
    out.push('IF [#104 LT #101] GOTO 10');
    out.push('GOTO 90');
  }

  out.push('N90');
  out.push('G00 Z50.0 M05');
  out.push('M30');
  out.push('%');
  return out.join('\n');
}

export default function ProgramsTab({ programs = [], refreshAllData, shareOnWhatsApp }) {
  const categories = Object.keys(JYOTI_MACHINE_CASCADE);
  const initialCategory = categories[0] || 'Turning';
  const initialSeries = Object.keys(JYOTI_MACHINE_CASCADE[initialCategory])[0];
  const initialModel = JYOTI_MACHINE_CASCADE[initialCategory][initialSeries][0];

  const [controllerBrand, setControllerBrand] = useState('Siemens');
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
      return ['Turning', 'Facing', 'Boring', 'Threading', 'Grooving', 'Parting', 'Drilling', 'Tapping'];
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
      setCode(adaptCodeForMode(filteredTemplates[0].code, programMode, controller, domainKey, operation, workSide, mfgCfg));
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

      <div className="my-3 p-3 rounded-xl bg-slate-900/95 border border-cyan-500/30">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="text-xs font-bold text-cyan-300">IF / GOTO Macro Data Table (Turning & Milling)</div>
          <span className="text-[10px] text-slate-400">Enter values to auto-update IF/GOTO macro</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400">
                <th className="py-1.5 px-2">Raw/Span X</th>
                <th className="py-1.5 px-2">Target/Dia Y</th>
                <th className="py-1.5 px-2">Length/Z</th>
                <th className="py-1.5 px-2">Depth Z</th>
                <th className="py-1.5 px-2">Peck/Step Q</th>
                <th className="py-1.5 px-2">Pitch</th>
                <th className="py-1.5 px-2">RPM</th>
                <th className="py-1.5 px-2">Feed</th>
              </tr>
            </thead>
            <tbody>
              <tr className="text-slate-100">
                <td className="p-1"><input type="number" value={mfgCfg.stockX || '50'} onChange={(e) => setMfgCfg({ ...mfgCfg, stockX: e.target.value })} className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs" /></td>
                <td className="p-1"><input type="number" value={mfgCfg.stockY || '32'} onChange={(e) => setMfgCfg({ ...mfgCfg, stockY: e.target.value })} className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs" /></td>
                <td className="p-1"><input type="number" value={mfgCfg.stockZ || '45'} onChange={(e) => setMfgCfg({ ...mfgCfg, stockZ: e.target.value })} className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs" /></td>
                <td className="p-1"><input type="number" value={mfgCfg.featureDepth || '10'} onChange={(e) => setMfgCfg({ ...mfgCfg, featureDepth: e.target.value })} className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs" /></td>
                <td className="p-1"><input type="number" step="0.5" value={mfgCfg.peckDepth || '4'} onChange={(e) => setMfgCfg({ ...mfgCfg, peckDepth: e.target.value })} className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs" /></td>
                <td className="p-1"><input type="number" step="0.25" value={mfgCfg.threadPitch || mfgCfg.tapPitch || '1.5'} onChange={(e) => setMfgCfg({ ...mfgCfg, threadPitch: e.target.value, tapPitch: e.target.value })} className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs" /></td>
                <td className="p-1"><input type="number" value={mfgCfg.spindleRpm || '1200'} onChange={(e) => setMfgCfg({ ...mfgCfg, spindleRpm: e.target.value })} className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs" /></td>
                <td className="p-1"><input type="number" step="0.05" value={mfgCfg.feedRate || '200'} onChange={(e) => setMfgCfg({ ...mfgCfg, feedRate: e.target.value })} className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs" /></td>
              </tr>
            </tbody>
          </table>
        </div>
        <pre className="mt-2.5 p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-64">{generateIfGotoMacroFromTable({ domainKey, machineType, workSide, operation, mfgCfg })}</pre>
      </div>

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
        <div className="mb-3 p-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 flex flex-wrap items-center justify-between gap-2"><div className="text-xs font-bold text-slate-300">CNC Controller Syntax</div><div className="flex items-center gap-1.5">{['Siemens', 'Fanuc', 'Mitsubishi'].map((brand) => (<button key={brand} type="button" onClick={() => setControllerBrand(brand)} className={`px-3 py-1 rounded-lg text-xs font-bold border ${controllerBrand === brand ? 'bg-cyan-500/25 text-cyan-200 border-cyan-400' : 'bg-slate-950 text-slate-400 border-slate-800'}`}>{brand === 'Siemens' ? 'Siemens (CYCLE)' : brand === 'Fanuc' ? 'Fanuc (IF/GOTO Macro)' : 'Mitsubishi (M80)'}</button>))}</div></div>
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
                      {TURNING_INSERTS.map((ins) => (
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
            <pre className="bg-slate-950 p-3 rounded-lg text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-60">
              {p.code}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}




