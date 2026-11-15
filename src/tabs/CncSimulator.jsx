import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Play, Pause, RotateCcw, Box, ZoomIn, ZoomOut, Scissors } from 'lucide-react';

function buildStepMoves(domainKey, workSide, operation, templateName = '', mfgCfg = {}) {
  const moves = [];
  const tName = (templateName + ' ' + workSide + ' ' + operation).toUpperCase();
  const stage = mfgCfg.machiningStage || 'Rough + Finish Combined';
  const diaStock = Number(mfgCfg.diaFinishStock ?? 0.5);
  const lenStock = Number(mfgCfg.lenFinishStock ?? 0.2);
  const wallAllow = Number(mfgCfg.wallAllowance ?? 0.3);
  const btmAllow = Number(mfgCfg.bottomAllowance ?? 0.2);
  const depth = Number(mfgCfg.featureDepth ?? 10);
  const chamfSize = Number(mfgCfg.chamferSize ?? 0.5);

  if (domainKey === 'Turning') {
    const rawOD = Number(mfgCfg.stockX || 50);
    const finOD = Number(mfgCfg.stockY || 32);
    const partLen = Math.max(12, Number(mfgCfg.stockZ || 45));
    const rawID = Number(mfgCfg.rawIdDia || 20);
    const isID = workSide === 'ID';
    const isFace = workSide === 'Face' || operation === 'Facing';

    const zSlices = 60;
    const odProfile = new Array(zSlices + 1).fill(rawOD);
    const idProfile = new Array(zSlices + 1).fill(isID ? Math.max(8, rawID) : 0);
    const passTagProfile = new Array(zSlices + 1).fill('raw');
    let threadProgressZ = 0;
    let threadDepthRatio = 0;
    let faceTrimZ = 0;

    const snapshot = (zVal, curDia, rapid, passType, gcode) => {
      const distFromFace = Math.max(0, Math.min(partLen, -zVal));
      const frac = Math.min(1, distFromFace / partLen);
      const sliceIdx = Math.min(zSlices, Math.round(frac * zSlices));

      if (!rapid && operation !== 'Threading' && operation !== 'Grooving' && operation !== 'Parting' && !isFace) {
        for (let i = 0; i <= sliceIdx; i++) {
          if (isID) {
            if (curDia >= idProfile[i]) {
              idProfile[i] = curDia;
              passTagProfile[i] = passType;
            }
          } else {
            if (curDia <= odProfile[i]) {
              odProfile[i] = curDia;
              passTagProfile[i] = passType;
            }
          }
        }
      }

      moves.push({
        x: curDia,
        y: 0,
        z: zVal,
        rapid,
        passType,
        odProfile: [...odProfile],
        idProfile: [...idProfile],
        passTagProfile: [...passTagProfile],
        threadProgressZ,
        threadDepthRatio,
        faceTrimZ,
        curOD: isID ? rawOD : odProfile[Math.max(0, sliceIdx)],
        curID: isID ? idProfile[Math.max(0, sliceIdx)] : 0,
        gcode
      });
    };

    if (operation === 'Drilling' || operation === 'Tapping') {
      const isTap = operation === 'Tapping';
      const drillDia = isTap
        ? Math.max(3, Number(mfgCfg.tapDia || 10) - Number(mfgCfg.tapPitch || 1.5))
        : Number(mfgCfg.drillDia || 16);
      const modeStr = isTap ? (mfgCfg.tapMode || '') : (mfgCfg.drillMode || 'Deep Hole Peck (G83 - Full Retract)');
      const isDirect = modeStr.includes('G81') || (isTap && !modeStr.includes('Peck'));
      const isChipBreak = modeStr.includes('G73') || (isTap && modeStr.includes('Peck'));
      const targetHoleZ = -Math.min(45, partLen);
      const peck = isDirect ? Math.abs(targetHoleZ) : Math.max(5, Number(mfgCfg.peckDepth || 10));

      snapshot(5, 0, true, 'rapid', `G00 X0.0 Z5.0 (${modeStr || operation})`);
      for (let d = -peck; d >= targetHoleZ - 0.1; d -= peck) {
        const zGoal = Math.max(targetHoleZ, d);
        for (let s = 1; s <= 5; s++) {
          const zNow = (zGoal * s) / 5;
          const frac = Math.min(1, Math.abs(zNow) / partLen);
          const sIdx = Math.min(zSlices, Math.round(frac * zSlices));
          for (let i = 0; i <= sIdx; i++) {
            idProfile[i] = Math.max(idProfile[i], drillDia);
            passTagProfile[i] = isTap ? 'finish' : 'rough';
          }
          if (isTap) {
            threadProgressZ = Math.max(threadProgressZ, Math.abs(zNow));
            threadDepthRatio = 1;
          }
          snapshot(zNow, 0, false, isTap ? 'finish' : 'rough', `${isTap ? 'G84' : isChipBreak ? 'G73' : isDirect ? 'G81' : 'G83'} Z${zNow.toFixed(1)} F${isTap ? (mfgCfg.tapPitch || 1.5) : '0.12'}`);
        }
        if (zGoal > targetHoleZ + 0.5) {
          if (isChipBreak) {
            // G73 Chip-Breaking: Small 1.5mm retract to break chips
            snapshot(zGoal + 1.8, 0, true, 'rapid', `G73 Z${(zGoal + 1.8).toFixed(1)} (CHIP BREAK)`);
          } else {
            // G83 Deep Hole Peck: Full retract to R-plane Z+4.0 to clear flutes
            snapshot(4, 0, true, 'rapid', `G83 Z4.0 (DEEP HOLE FULL RETRACT)`);
          }
        }
      }
      snapshot(18, 0, true, 'rapid', `G28 U0. W0. M05`);
    } else if (operation === 'Threading') {
      const majDia = Number(mfgCfg.threadMajorDia || 24);
      const minDia = Number(mfgCfg.threadMinorDia || 20.32);
      const baseOD = isID ? rawOD : majDia;
      for (let i = 0; i <= zSlices; i++) {
        odProfile[i] = baseOD;
        if (isID) idProfile[i] = minDia;
      }
      const safeX = isID ? minDia - 6 : majDia + 6;
      const targetLen = Math.min(35, partLen - 5);
      const passRatios = [0.35, 0.65, 0.88, 1.0];
      passRatios.forEach((ratio, idx) => {
        const px = isID
          ? minDia + (majDia - minDia) * ratio
          : majDia - (majDia - minDia) * ratio;
        snapshot(4, safeX, true, 'rapid', `G00 X${safeX.toFixed(1)} Z4.0 (THREAD PASS ${idx + 1}/4)`);
        snapshot(4, px, true, 'rapid', `G00 X${px.toFixed(3)}`);
        for (let s = 1; s <= 12; s++) {
          const zStep = -(targetLen * s) / 12;
          const absZ = Math.abs(zStep);
          threadProgressZ = Math.max(threadProgressZ, absZ);
          threadDepthRatio = ratio;
          const frac = Math.min(1, absZ / partLen);
          const sIdx = Math.min(zSlices, Math.round(frac * zSlices));
          for (let i = 0; i <= sIdx; i++) {
            passTagProfile[i] = idx === 3 ? 'finish' : 'rough';
          }
          snapshot(zStep, px, false, idx === 3 ? 'finish' : 'rough', `G76 X${px.toFixed(3)} Z${zStep.toFixed(1)} F${mfgCfg.threadPitch || 3.0}`);
        }
        snapshot(-targetLen, safeX, true, 'rapid', `G00 X${safeX.toFixed(1)} (RETRACT)`);
      });
      snapshot(16, safeX, true, 'rapid', `G28 U0. W0. M05`);
    } else if (isFace) {
      [-1.0, -2.0, -3.0].forEach((fz, idx) => {
        snapshot(fz, rawOD + 3, true, 'rapid', `G00 X${(rawOD + 3).toFixed(1)} Z${fz}`);
        for (let s = 1; s <= 8; s++) {
          const xStep = rawOD - ((rawOD - (isID ? rawID : 0)) * s) / 8;
          faceTrimZ = Math.abs(fz);
          passTagProfile[0] = idx === 2 ? 'finish' : 'rough';
          snapshot(fz, xStep, false, idx === 2 ? 'finish' : 'rough', `G01 X${xStep.toFixed(1)} Z${fz} F0.15`);
        }
        snapshot(fz + 2, rawOD + 3, true, 'rapid', `G00 RETRACT`);
      });
      snapshot(16, rawOD + 8, true, 'rapid', `G28 U0. W0. M05`);
    } else if (operation === 'Grooving' || operation === 'Parting') {
      const cutZ = -Math.min(26, partLen - 6);
      const targetX = operation === 'Parting' ? 4 : isID ? finOD + 6 : Math.max(12, finOD - 8);
      const startX = isID ? finOD - 4 : rawOD + 2;
      snapshot(cutZ, startX, true, 'rapid', `G00 X${startX.toFixed(1)} Z${cutZ}`);
      const gIdx = Math.min(zSlices - 3, Math.max(2, Math.round((Math.abs(cutZ) / partLen) * zSlices)));
      for (let s = 1; s <= 10; s++) {
        const curX = startX + ((targetX - startX) * s) / 10;
        for (let w = -1; w <= 2; w++) {
          const idxW = Math.min(zSlices, Math.max(0, gIdx + w));
          if (!isID) {
            odProfile[idxW] = Math.min(odProfile[idxW], Math.max(4, curX));
          } else {
            idProfile[idxW] = Math.max(idProfile[idxW], curX);
          }
          passTagProfile[idxW] = s >= 8 ? 'finish' : 'rough';
        }
        snapshot(cutZ, curX, false, s >= 8 ? 'finish' : 'rough', `G01 X${curX.toFixed(1)} F0.08`);
      }
      snapshot(16, startX + 4, true, 'rapid', `G28 U0. W0. M05`);
    } else if (isID) {
      let activeID = Math.max(10, rawID);
      const targetZ = Math.max(10, partLen - lenStock);
      if (stage.includes('Rough')) {
        const totalStock = Math.max(2, finOD - diaStock - activeID);
        const passes = 3;
        const step = totalStock / passes;
        for (let p = 1; p <= passes; p++) {
          const nextID = activeID + step;
          snapshot(2, rawID - 2, true, 'rapid', `G00 X${(rawID - 2).toFixed(1)} Z2.0 (ID PASS ${p})`);
          snapshot(2, nextID, true, 'rapid', `G00 X${nextID.toFixed(2)}`);
          for (let s = 1; s <= 15; s++) {
            const zProg = (targetZ * s) / 15;
            snapshot(-zProg, nextID, false, 'rough', `G01 X${nextID.toFixed(2)} Z-${zProg.toFixed(1)} F0.22`);
          }
          activeID = nextID;
          snapshot(-targetZ, rawID - 2, true, 'rapid', `G00 X${(rawID - 2).toFixed(1)} (RETRACT)`);
        }
      }
      if (stage.includes('Finish') || stage.includes('Combined')) {
        snapshot(2, finOD, true, 'rapid', `G00 X${finOD.toFixed(2)} Z2.0 (FINISH PASS)`);
        for (let s = 1; s <= 15; s++) {
          const zProg = (partLen * s) / 15;
          snapshot(-zProg, finOD, false, 'finish', `G41 G01 X${finOD.toFixed(2)} Z-${zProg.toFixed(1)} F0.12`);
        }
        activeID = finOD;
      }
      if (stage.includes('Chamfer')) {
        snapshot(1, finOD + chamfSize * 2, true, 'rapid', `G00 X${(finOD + chamfSize * 2).toFixed(1)} Z1.0`);
        snapshot(-chamfSize, finOD, false, 'chamfer', `G01 X${finOD.toFixed(1)} Z-${chamfSize} F0.10`);
      }
      snapshot(18, rawID - 2, true, 'rapid', `G40 G28 U0. W0. M05`);
    } else {
      let activeOD = rawOD;
      const targetZ = Math.max(10, partLen - lenStock);
      if (stage.includes('Rough')) {
        const totalStock = Math.max(2, rawOD - (finOD + diaStock));
        const passes = 3;
        const step = totalStock / passes;
        for (let p = 1; p <= passes; p++) {
          const nextOD = activeOD - step;
          snapshot(2, activeOD + 3, true, 'rapid', `G00 X${(activeOD + 3).toFixed(1)} Z2.0 (ROUGH PASS ${p})`);
          snapshot(2, nextOD, true, 'rapid', `G00 X${nextOD.toFixed(2)}`);
          for (let s = 1; s <= 15; s++) {
            const zProg = (targetZ * s) / 15;
            snapshot(-zProg, nextOD, false, 'rough', `G01 X${nextOD.toFixed(2)} Z-${zProg.toFixed(1)} F0.25`);
          }
          activeOD = nextOD;
          snapshot(-targetZ + 1, activeOD + 3, true, 'rapid', `G00 X${(activeOD + 3).toFixed(1)} (RETRACT)`);
        }
      }
      if (stage.includes('Finish') || stage.includes('Combined')) {
        snapshot(2, finOD, true, 'rapid', `G00 X${finOD.toFixed(2)} Z2.0 (FINISH PASS)`);
        for (let s = 1; s <= 15; s++) {
          const zProg = (partLen * s) / 15;
          snapshot(-zProg, finOD, false, 'finish', `G42 G01 X${finOD.toFixed(2)} Z-${zProg.toFixed(1)} F0.12`);
        }
        activeOD = finOD;
      }
      if (stage.includes('Chamfer')) {
        snapshot(1, finOD - chamfSize * 2, true, 'rapid', `G00 X${(finOD - chamfSize * 2).toFixed(1)} Z1.0`);
        snapshot(-chamfSize, finOD, false, 'chamfer', `G01 X${finOD.toFixed(1)} Z-${chamfSize} F0.10`);
      }
      snapshot(18, rawOD + 8, true, 'rapid', `G40 G28 U0. W0. M05`);
    }
  } else {
    // MILLING DOMAIN: Dedicated toolpaths for Face Milling, Pocket, Spigot, Contour, Slot, and Drilling/Tapping
    const isFaceMill = tName.includes('FACE') || operation === 'Face Milling';
    const isContourMill = tName.includes('CONTOUR') || tName.includes('PROFILE') || operation === 'Contour Milling';
    const isSlotMill = tName.includes('SLOT') || operation === 'Slot Milling';
    const isCircPocket = tName.includes('CIRCULAR POCKET') || (operation === 'Pocket Milling' && !tName.includes('RECTANGULAR'));
    const isRectPocket = tName.includes('RECTANGULAR POCKET');
    const isCircSpigot = tName.includes('CIRCULAR SPIGOT') || (operation === 'Spigot Milling' && !tName.includes('RECTANGULAR'));
    const isRectSpigot = tName.includes('RECTANGULAR SPIGOT');

    const circlePts = (r, steps = 20) => {
      const a = [];
      for (let i = 0; i <= steps; i++) {
        const ang = (i / steps) * Math.PI * 2;
        a.push({ x: Number((Math.cos(ang) * r).toFixed(2)), y: Number((Math.sin(ang) * r).toFixed(2)) });
      }
      return a;
    };
    const rectPts = (w, h) => [
      { x: -w, y: -h },
      { x: w, y: -h },
      { x: w, y: h },
      { x: -w, y: h },
      { x: -w, y: -h }
    ];

    let maxDepthSoFar = 0;

    if (isCircPocket || isRectPocket || isCircSpigot || isRectSpigot) {
      const isPocket = isCircPocket || isRectPocket;
      const isCirc = !isRectPocket && !isRectSpigot;

      if (stage.includes('Rough')) {
        const roughZ = -(depth - btmAllow);
        maxDepthSoFar = Math.max(maxDepthSoFar, Math.abs(roughZ));
        if (isPocket) {
          moves.push({ x: 0, y: 0, z: 6, rapid: true, passType: 'rapid', cutDepth: maxDepthSoFar, gcode: 'G43 H01 G00 X0.0 Y0.0 Z6.0' });
          moves.push({ x: 0, y: 0, z: roughZ, rapid: false, passType: 'rough', cutDepth: maxDepthSoFar, gcode: `G01 Z${roughZ.toFixed(2)} F200.0` });
          if (isCirc) {
            [11, Math.max(15, 22 - wallAllow * 2)].forEach((rad, ri) => {
              const pts = circlePts(rad, 16);
              pts.forEach((p) => moves.push({ x: p.x, y: p.y, z: roughZ, rapid: false, passType: 'rough', cutDepth: maxDepthSoFar, cutRad: rad, gcode: `G03 X${p.x} Y${p.y} R${rad} (RING ${ri + 1})` }));
            });
          } else {
            [{ w: 13, h: 9 }, { w: 26 - wallAllow, h: 16 - wallAllow }].forEach((bx, bi) => {
              const pts = rectPts(bx.w, bx.h);
              pts.forEach((p) => moves.push({ x: p.x, y: p.y, z: roughZ, rapid: false, passType: 'rough', cutDepth: maxDepthSoFar, cutW: bx.w, cutH: bx.h, gcode: `G01 X${p.x} Y${p.y} (PASS ${bi + 1})` }));
            });
          }
        } else {
          moves.push({ x: -34, y: 0, z: 6, rapid: true, passType: 'rapid', cutDepth: maxDepthSoFar, gcode: 'G43 H01 G00 X-34.0 Y0.0 Z6.0' });
          moves.push({ x: -34, y: 0, z: roughZ, rapid: false, passType: 'rough', cutDepth: maxDepthSoFar, gcode: `G01 Z${roughZ.toFixed(2)} F200.0` });
          if (isCirc) {
            [30, 20 + wallAllow * 2].forEach((rad) => {
              const pts = circlePts(rad, 16);
              pts.forEach((p) => moves.push({ x: p.x, y: p.y, z: roughZ, rapid: false, passType: 'rough', cutDepth: maxDepthSoFar, cutRad: rad, gcode: `G02 X${p.x} Y${p.y} R${rad}` }));
            });
          } else {
            [{ w: 32, h: 22 }, { w: 22 + wallAllow, h: 14 + wallAllow }].forEach((bx) => {
              const pts = rectPts(bx.w, bx.h);
              pts.forEach((p) => moves.push({ x: p.x, y: p.y, z: roughZ, rapid: false, passType: 'rough', cutDepth: maxDepthSoFar, cutW: bx.w, cutH: bx.h, gcode: `G01 X${p.x} Y${p.y}` }));
            });
          }
        }
      }

      if (stage.includes('Finish') || stage.includes('Combined')) {
        const finZ = stage === 'Wall Finish Only' ? -(depth - btmAllow) : -depth;
        maxDepthSoFar = Math.max(maxDepthSoFar, Math.abs(finZ));
        const wallPts = isCirc
          ? circlePts(isPocket ? 22 : 20, 18)
          : rectPts(isPocket ? 26 : 22, isPocket ? 16 : 14);
        wallPts.forEach((p) => moves.push({ x: p.x, y: p.y, z: finZ, rapid: false, passType: 'finish', cutDepth: maxDepthSoFar, cutRad: isPocket ? 22 : 20, cutW: isPocket ? 26 : 22, cutH: isPocket ? 16 : 14, gcode: `${mfgCfg.compMode?.slice(0, 3) || 'G41'} G01 X${p.x} Y${p.y} Z${finZ.toFixed(1)}` }));
      }

      if (stage.includes('Chamfer')) {
        const chZ = -chamfSize;
        const chPts = isCirc
          ? circlePts(isPocket ? 22.5 : 19.5, 18)
          : rectPts(isPocket ? 26.5 : 21.5, isPocket ? 16.5 : 13.5);
        chPts.forEach((p) => moves.push({ x: p.x, y: p.y, z: chZ, rapid: false, passType: 'chamfer', cutDepth: maxDepthSoFar, gcode: `CHAMFER C${chamfSize} X${p.x} Y${p.y}` }));
      }

      moves.push({ x: 0, y: 0, z: 25, rapid: true, passType: 'rapid', cutDepth: maxDepthSoFar, gcode: 'G40 G00 Z25.0 M05' });
    } else if (isFaceMill) {
      // Zig-Zag Face Milling Passes across entire top surface (NO 5 holes!)
      const faceZ = -Math.max(1.5, Math.min(6, depth));
      const yRows = [-24, -12, 0, 12, 24];
      moves.push({ x: -50, y: -24, z: 8, rapid: true, passType: 'rapid', cutDepth: 0, faceProg: 0, gcode: 'G43 H01 G00 X-50.0 Y-24.0 Z8.0' });
      moves.push({ x: -50, y: -24, z: faceZ, rapid: false, passType: 'rough', cutDepth: Math.abs(faceZ), faceProg: 0.04, gcode: `G01 Z${faceZ.toFixed(1)} F350.0` });
      yRows.forEach((ry, idx) => {
        const dir = idx % 2 === 0 ? 1 : -1;
        const xStart = dir === 1 ? -44 : 44;
        const xEnd = dir === 1 ? 44 : -44;
        if (idx > 0) {
          moves.push({ x: xStart, y: ry, z: faceZ, rapid: false, passType: 'rough', cutDepth: Math.abs(faceZ), faceProg: idx / yRows.length, gcode: `G01 Y${ry.toFixed(1)} F450.0` });
        }
        for (let s = 1; s <= 5; s++) {
          const curX = xStart + ((xEnd - xStart) * s) / 5;
          const prog = (idx + s / 5) / yRows.length;
          moves.push({ x: curX, y: ry, z: faceZ, rapid: false, passType: prog > 0.8 ? 'finish' : 'rough', cutDepth: Math.abs(faceZ), faceProg: prog, gcode: `G01 X${curX.toFixed(1)} Y${ry.toFixed(1)} F650.0` });
        }
      });
      moves.push({ x: 50, y: 24, z: 25, rapid: true, passType: 'rapid', cutDepth: Math.abs(faceZ), faceProg: 1, gcode: 'G00 Z25.0 M05 (FACE MILL COMPLETE)' });
    } else if (isContourMill) {
      const cZ = -Math.max(4, depth);
      const pts = rectPts(36, 26);
      moves.push({ x: -42, y: -26, z: 8, rapid: true, passType: 'rapid', cutDepth: 0, gcode: 'G43 H01 G00 X-42.0 Y-26.0 Z8.0' });
      moves.push({ x: -36, y: -26, z: cZ, rapid: false, passType: 'rough', cutDepth: Math.abs(cZ), gcode: `G01 Z${cZ.toFixed(1)} F250.0` });
      pts.forEach((p, idx) => {
        moves.push({ x: p.x, y: p.y, z: cZ, rapid: false, passType: idx >= 3 ? 'finish' : 'rough', cutDepth: Math.abs(cZ), cutW: 36, cutH: 26, gcode: `G41 G01 X${p.x} Y${p.y} F400.0` });
      });
      moves.push({ x: 0, y: 0, z: 25, rapid: true, passType: 'rapid', cutDepth: Math.abs(cZ), cutW: 36, cutH: 26, gcode: 'G40 G00 Z25.0 M05' });
    } else if (isSlotMill) {
      const sZ = -Math.max(4, depth);
      moves.push({ x: -30, y: 0, z: 8, rapid: true, passType: 'rapid', cutDepth: 0, gcode: 'G43 H01 G00 X-30.0 Y0.0 Z8.0' });
      moves.push({ x: -30, y: 0, z: sZ, rapid: false, passType: 'rough', cutDepth: Math.abs(sZ), slotLen: 0, gcode: `G01 Z${sZ.toFixed(1)} F200.0` });
      for (let s = 1; s <= 12; s++) {
        const curX = -30 + (60 * s) / 12;
        moves.push({ x: curX, y: 0, z: sZ, rapid: false, passType: s >= 9 ? 'finish' : 'rough', cutDepth: Math.abs(sZ), slotLen: (60 * s) / 12, gcode: `G01 X${curX.toFixed(1)} Y0.0 F350.0` });
      }
      moves.push({ x: 30, y: 0, z: 25, rapid: true, passType: 'rapid', cutDepth: Math.abs(sZ), slotLen: 60, gcode: 'G00 Z25.0 M05' });
    } else {
      // Drilling / Tapping / Boring / Reaming
      const holes = [
        { x: -24, y: -16 },
        { x: 24, y: -16 },
        { x: 24, y: 16 },
        { x: -24, y: 16 },
        { x: 0, y: 0 }
      ];
      holes.forEach((h, i) => {
        moves.push({ x: h.x, y: h.y, z: 6, rapid: true, passType: 'rapid', cutDepth: depth, gcode: `HOLE ${i + 1}: G00 X${h.x} Y${h.y}` });
        moves.push({ x: h.x, y: h.y, z: -depth, rapid: false, passType: 'rough', cutDepth: depth, gcode: `G43 CYCLE Z-${depth}.0` });
        moves.push({ x: h.x, y: h.y, z: 6, rapid: true, passType: 'rapid', cutDepth: depth, gcode: 'G00 R-PLANE Z6.0' });
      });
    }
  }

  return moves.length > 0 ? moves : [{ x: 0, y: 0, z: 10, rapid: true, passType: 'rapid', gcode: 'READY' }];
}

const SPEED_OPTIONS = [0.25, 0.5, 1, 2, 4];

function buildSolidVerifyWorkpiece(current, operation, isID, rawOD, rawRad, partLen, stickout, planes) {
  const workGroup = new THREE.Group();
  const odProfile = current.odProfile || [rawOD];
  const idProfile = current.idProfile || [0];
  const passTagProfile = current.passTagProfile || ['raw'];
  const faceTrim = Math.min(6, (current.faceTrimZ || 0) * 1.4);

  const n = odProfile.length - 1;
  const effStickout = Math.max(12, stickout - faceTrim);
  const sliceH = effStickout / n;

  const rawMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    metalness: 0.72,
    roughness: 0.28,
    clippingPlanes: planes,
    side: THREE.DoubleSide
  });
  const roughMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    emissive: 0x0369a1,
    emissiveIntensity: 0.18,
    metalness: 0.55,
    roughness: 0.22,
    clippingPlanes: planes,
    side: THREE.DoubleSide
  });
  const finishMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0x047857,
    emissiveIntensity: 0.18,
    metalness: 0.5,
    roughness: 0.16,
    clippingPlanes: planes,
    side: THREE.DoubleSide
  });
  const threadRidgeMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0x92400e,
    emissiveIntensity: 0.22,
    metalness: 0.78,
    roughness: 0.2,
    clippingPlanes: planes,
    side: THREE.DoubleSide
  });

  let startIdx = 0;
  while (startIdx < n) {
    let endIdx = startIdx + 1;
    const curOD = odProfile[startIdx];
    const curID = idProfile[startIdx] || 0;
    const curTag = passTagProfile[startIdx] || 'raw';

    while (
      endIdx < n &&
      Math.abs(odProfile[endIdx] - curOD) < 0.05 &&
      Math.abs((idProfile[endIdx] || 0) - curID) < 0.05 &&
      passTagProfile[endIdx] === curTag
    ) {
      endIdx++;
    }

    const segCount = endIdx - startIdx;
    const segH = segCount * sliceH + 0.06;
    const yTop = stickout / 2 - faceTrim - startIdx * sliceH;
    const yCenter = yTop - segH / 2;

    const outerR = Math.max(3, (curOD / Math.max(10, rawOD)) * rawRad);
    const innerR = curID > 0.5 ? Math.min(outerR - 1.5, Math.max(2, (curID / Math.max(10, rawOD)) * rawRad)) : 0;

    const mat = curTag === 'finish' ? finishMat : curTag === 'rough' || curTag === 'chamfer' ? roughMat : rawMat;

    if (innerR > 0.5) {
      const shape = new THREE.Shape();
      shape.absarc(0, 0, outerR, 0, Math.PI * 2, false);
      const hole = new THREE.Path();
      hole.absarc(0, 0, innerR, 0, Math.PI * 2, true);
      shape.holes.push(hole);

      const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
        depth: segH,
        bevelEnabled: false,
        curveSegments: 40
      });
      extrudeGeo.rotateX(Math.PI / 2);
      const mesh = new THREE.Mesh(extrudeGeo, mat);
      mesh.position.y = yTop;
      workGroup.add(mesh);

      const boreWall = new THREE.Mesh(
        new THREE.CylinderGeometry(innerR - 0.1, innerR - 0.1, segH, 36, 1, true),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6, side: THREE.BackSide, clippingPlanes: planes })
      );
      boreWall.position.y = yCenter;
      workGroup.add(boreWall);
    } else {
      const cylGeo = new THREE.CylinderGeometry(outerR, outerR, segH, 48);
      const mesh = new THREE.Mesh(cylGeo, mat);
      mesh.position.y = yCenter;
      workGroup.add(mesh);
    }

    startIdx = endIdx;
  }

  const tProgZ = current.threadProgressZ || 0;
  const tDepthRatio = current.threadDepthRatio || 0;
  if ((operation === 'Threading' || operation === 'Tapping') && tProgZ > 0.5 && tDepthRatio > 0) {
    const threadLenWorld = Math.min(effStickout * 0.85, (tProgZ / Math.max(10, partLen)) * (stickout * 0.88));
    const pitchWorld = 2.1;
    const ridgeCount = Math.max(1, Math.floor(threadLenWorld / pitchWorld));
    const ridgeThickness = 0.45 + tDepthRatio * 0.65;

    const baseOD = odProfile[0] || rawOD;
    const baseID = idProfile[0] || 14;
    const baseRad = isID || operation === 'Tapping'
      ? Math.max(2.5, (baseID / Math.max(10, rawOD)) * rawRad - ridgeThickness * 0.7)
      : Math.max(4, (baseOD / Math.max(10, rawOD)) * rawRad + ridgeThickness * 0.5);

    for (let r = 0; r < ridgeCount; r++) {
      const yPos = stickout / 2 - faceTrim - 1.2 - r * pitchWorld;
      const torus = new THREE.Mesh(
        new THREE.TorusGeometry(baseRad, ridgeThickness, 10, 40),
        threadRidgeMat
      );
      torus.rotation.x = Math.PI / 2;
      torus.position.y = yPos;
      workGroup.add(torus);
    }
  }

  return workGroup;
}

function buildIsoInsertMesh(insertType = 'CNMG', noseRadius = '0.8', operation = 'Turning', insertMat, darkMat) {
  const insGroup = new THREE.Group();
  const code = (insertType || 'CNMG').toUpperCase();
  const rVal = Math.max(0.15, Math.min(1.4, Number(noseRadius) || 0.8));
  const fillet = 0.25 + rVal * 0.85;

  if (operation === 'Grooving' || operation === 'Parting' || code.includes('MGMN')) {
    const bladeTip = new THREE.Mesh(new THREE.BoxGeometry(2.2, 4.8, 3.8), insertMat);
    insGroup.add(bladeTip);
    return insGroup;
  }

  let pts = [];
  if (operation === 'Threading') {
    pts = [
      new THREE.Vector2(0, -3.5),
      new THREE.Vector2(3.1, 2.2),
      new THREE.Vector2(-3.1, 2.2)
    ];
  } else if (code.startsWith('TNMG')) {
    const rad = 3.7;
    for (let i = 0; i < 3; i++) {
      const ang = -Math.PI / 2 + (i * Math.PI * 2) / 3;
      pts.push(new THREE.Vector2(Math.cos(ang) * rad, Math.sin(ang) * rad));
    }
  } else if (code.startsWith('WNMG')) {
    const rOut = 3.7;
    const rIn = 2.9;
    for (let i = 0; i < 6; i++) {
      const ang = -Math.PI / 2 + (i * Math.PI) / 3;
      const r = i % 2 === 0 ? rOut : rIn;
      pts.push(new THREE.Vector2(Math.cos(ang) * r, Math.sin(ang) * r));
    }
  } else if (code.startsWith('VNMG')) {
    pts = [
      new THREE.Vector2(0, -4.5),
      new THREE.Vector2(1.45, 0),
      new THREE.Vector2(0, 4.5),
      new THREE.Vector2(-1.45, 0)
    ];
  } else if (code.startsWith('DNMG')) {
    pts = [
      new THREE.Vector2(0, -4.1),
      new THREE.Vector2(2.15, 0),
      new THREE.Vector2(0, 4.1),
      new THREE.Vector2(-2.15, 0)
    ];
  } else {
    pts = [
      new THREE.Vector2(0, -3.7),
      new THREE.Vector2(3.1, 0),
      new THREE.Vector2(0, 3.7),
      new THREE.Vector2(-3.1, 0)
    ];
  }

  const shape = new THREE.Shape();
  const count = pts.length;
  for (let i = 0; i < count; i++) {
    const prev = pts[(i - 1 + count) % count];
    const curr = pts[i];
    const next = pts[(i + 1) % count];

    const v1 = new THREE.Vector2().subVectors(prev, curr);
    const v2 = new THREE.Vector2().subVectors(next, curr);
    const maxF = Math.min(v1.length() * 0.42, v2.length() * 0.42, fillet);

    const pStart = new THREE.Vector2().copy(curr).addScaledVector(v1.normalize(), maxF);
    const pEnd = new THREE.Vector2().copy(curr).addScaledVector(v2.normalize(), maxF);

    if (i === 0) shape.moveTo(pStart.x, pStart.y);
    else shape.lineTo(pStart.x, pStart.y);

    shape.quadraticCurveTo(curr.x, curr.y, pEnd.x, pEnd.y);
  }
  shape.closePath();

  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.85, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 1.5,
    bevelEnabled: true,
    bevelThickness: 0.14,
    bevelSize: 0.12,
    bevelSegments: 2,
    curveSegments: 16
  });
  extrudeGeo.center();

  const insertMesh = new THREE.Mesh(extrudeGeo, insertMat);
  insGroup.add(insertMesh);

  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.9, 16), darkMat);
  pin.rotation.x = Math.PI / 2;
  insGroup.add(pin);

  return insGroup;
}

function createOperationTooling(operation, isID, isVTL, discMat, cyanMat, steelShankMat, darkClampMat, insertMat, insertType = 'CNMG', noseRadius = '0.8') {
  const assembly = new THREE.Group();

  const isGroove = operation === 'Grooving' || operation === 'Parting';
  const isInternal = isID || operation === 'Boring' || operation === 'Drilling' || operation === 'Tapping';

  if (isVTL) {
    const turretCenter = new THREE.Vector3(isInternal ? 16 : 18, 38, 0);

    const outerRing = new THREE.Mesh(new THREE.CylinderGeometry(16, 16, 6.5, 36), discMat);
    outerRing.position.copy(turretCenter);
    assembly.add(outerRing);

    const cyanBand = new THREE.Mesh(new THREE.CylinderGeometry(16.3, 16.3, 2.2, 36), cyanMat);
    cyanBand.position.copy(turretCenter);
    assembly.add(cyanBand);

    for (let i = 0; i < 12; i++) {
      const ang = Math.PI + (i / 12) * Math.PI * 2;
      const bmt = new THREE.Mesh(new THREE.BoxGeometry(5.5, 7.5, 5.5), darkClampMat);
      bmt.position.set(
        turretCenter.x + Math.cos(ang) * 16,
        turretCenter.y,
        turretCenter.z + Math.sin(ang) * 16
      );
      bmt.rotation.y = -ang;
      assembly.add(bmt);
    }

    if (isInternal) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 38, 24), steelShankMat);
      bar.position.set(0, 19, 0);
      assembly.add(bar);

      const ins = buildIsoInsertMesh(insertType, noseRadius, operation, insertMat, darkClampMat);
      ins.rotation.z = Math.PI / 2;
      ins.position.set(1.8, 2.2, 0);
      assembly.add(ins);
    } else {
      const shankW = isGroove ? 2.2 : 4.8;
      const shank = new THREE.Mesh(new THREE.BoxGeometry(shankW, 38, 5.2), steelShankMat);
      shank.position.set(2.0, 19, 0);
      assembly.add(shank);

      const clamp = new THREE.Mesh(new THREE.BoxGeometry(3.6, 4.5, 3.8), darkClampMat);
      clamp.position.set(1.8, 5.8, 0.8);
      assembly.add(clamp);

      const ins = buildIsoInsertMesh(insertType, noseRadius, operation, insertMat, darkClampMat);
      ins.position.set(-0.6, 2.6, 0.6);
      assembly.add(ins);
    }
  } else {
    if (isInternal) {
      const turretCenter = new THREE.Vector3(36, 0, 0);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 9, 24), discMat);
      disc.rotation.z = Math.PI / 2;
      disc.position.copy(turretCenter);
      assembly.add(disc);

      const cyanRing = new THREE.Mesh(new THREE.CylinderGeometry(14.3, 14.3, 2.4, 24), cyanMat);
      cyanRing.rotation.z = Math.PI / 2;
      cyanRing.position.set(32, 0, 0);
      assembly.add(cyanRing);

      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        const bmt = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 5), darkClampMat);
        bmt.position.set(35, Math.cos(ang) * 14.5, Math.sin(ang) * 14.5);
        bmt.rotation.x = ang;
        assembly.add(bmt);
      }

      const bar = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 32, 24), steelShankMat);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(16, 0, 0);
      assembly.add(bar);

      const ins = buildIsoInsertMesh(insertType, noseRadius, operation, insertMat, darkClampMat);
      ins.rotation.z = Math.PI;
      ins.position.set(1.8, 1.8, 0);
      assembly.add(ins);
    } else {
      const turretCenter = new THREE.Vector3(2.2, 33, -2);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 10, 24), discMat);
      disc.rotation.z = Math.PI / 2;
      disc.position.copy(turretCenter);
      assembly.add(disc);

      const cyanRing = new THREE.Mesh(new THREE.CylinderGeometry(14.3, 14.3, 2.5, 24), cyanMat);
      cyanRing.rotation.z = Math.PI / 2;
      cyanRing.position.set(-1.8, 33, -2);
      assembly.add(cyanRing);

      for (let i = 0; i < 8; i++) {
        const ang = Math.PI + (i / 8) * Math.PI * 2;
        const bmt = new THREE.Mesh(new THREE.BoxGeometry(8.5, 5.2, 5.5), darkClampMat);
        bmt.position.set(
          turretCenter.x,
          turretCenter.y + Math.cos(ang) * 14.5,
          turretCenter.z + Math.sin(ang) * 14.5
        );
        bmt.rotation.x = ang;
        assembly.add(bmt);
      }

      const shankW = isGroove ? 2.2 : 5.0;
      const shank = new THREE.Mesh(new THREE.BoxGeometry(shankW, 20, 5.5), steelShankMat);
      shank.position.set(2.2, 10, 0);
      assembly.add(shank);

      const clamp = new THREE.Mesh(new THREE.BoxGeometry(3.8, 4.2, 3.6), darkClampMat);
      clamp.position.set(1.8, 5.2, 1.2);
      assembly.add(clamp);

      const ins = buildIsoInsertMesh(insertType, noseRadius, operation, insertMat, darkClampMat);
      ins.position.set(-0.2, 2.4, 1.2);
      assembly.add(ins);
    }
  }

  return assembly;
}

export default function CncSimulator({ domainKey, machineType, workSide, operation, templateName = '', mfgCfg = {} }) {
  const [playing, setPlaying] = useState(true);
  const [stepIdx, setStepIdx] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [halfCut, setHalfCut] = useState(false);

  const mountRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const dynamicGroupRef = useRef(null);
  const spindleGroupRef = useRef(null);
  const playingRef = useRef(playing);
  const speedRef = useRef(speed);
  const clipPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 0, -1), 0));

  useEffect(() => {
    playingRef.current = playing;
    speedRef.current = speed;
  }, [playing, speed]);

  const isVTL = machineType === 'VTL';

  const moves = useMemo(
    () => buildStepMoves(domainKey, workSide, operation, templateName, mfgCfg),
    [domainKey, workSide, operation, templateName, mfgCfg]
  );

  useEffect(() => {
    setStepIdx(0);
    setPlaying(true);
  }, [moves]);

  useEffect(() => {
    if (!playing || moves.length === 0) return;
    const timer = setInterval(() => {
      setStepIdx((prev) => (prev + 1 >= moves.length ? 0 : prev + 1));
    }, Math.max(50, Math.round(220 / speed)));
    return () => clearInterval(timer);
  }, [playing, moves, speed]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 400;
    const height = 385;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#cbd5e1');

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(145, 108, 162);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.localClippingEnabled = true;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(6, 6, 0);
    controlsRef.current = controls;

    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
    keyLight.position.set(150, 220, 170);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xe0f2fe, 0.75);
    fillLight.position.set(-140, 80, -130);
    scene.add(fillLight);

    const grid = new THREE.GridHelper(260, 26, 0x64748b, 0x94a3b8);
    grid.position.y = -48;
    scene.add(grid);

    const dynGroup = new THREE.Group();
    scene.add(dynGroup);
    dynamicGroupRef.current = dynGroup;

    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (playingRef.current && spindleGroupRef.current) {
        spindleGroupRef.current.rotation.y += 0.16 * speedRef.current;
      }
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 400;
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      renderer.setSize(w, height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  const setCameraView = (view) => {
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    if (!cam || !ctrl) return;
    ctrl.target.set(6, 6, 0);
    if (view === 'iso') cam.position.set(145, 108, 162);
    else if (view === 'top') cam.position.set(6, 225, 0.1);
    else if (view === 'front') cam.position.set(6, 12, 220);
    else if (view === 'side') cam.position.set(220, 12, 0);
    ctrl.update();
  };

  const adjustZoom = (factor) => {
    const cam = cameraRef.current;
    if (cam) cam.position.multiplyScalar(factor);
  };

  useEffect(() => {
    const group = dynamicGroupRef.current;
    if (!group) return;

    while (group.children.length > 0) {
      const obj = group.children[0];
      if (obj.geometry) obj.geometry.dispose();
      group.remove(obj);
    }

    const current = moves[stepIdx] || moves[0];
    const history = moves.slice(0, stepIdx + 1);
    const tName = (templateName + ' ' + workSide + ' ' + operation).toUpperCase();
    const planes = halfCut ? [clipPlaneRef.current] : [];

    const chuckMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.78,
      roughness: 0.28,
      clippingPlanes: planes,
      side: THREE.DoubleSide
    });
    const jawMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      metalness: 0.85,
      roughness: 0.22,
      clippingPlanes: planes
    });

    if (domainKey === 'Turning') {
      const rawOD = Number(mfgCfg.stockX || 50);
      const partLen = Math.max(12, Number(mfgCfg.stockZ || 45));
      const stickout = Math.min(64, Math.max(38, Number(mfgCfg.chuckStickout || 65) * 0.78));
      const rawRad = 24;

      const orientWrapper = new THREE.Group();
      if (!isVTL) {
        orientWrapper.rotation.z = -Math.PI / 2;
      }

      const spindleGroup = new THREE.Group();
      spindleGroupRef.current = spindleGroup;

      const chuckRad = isVTL ? rawRad + 15 : rawRad + 10;
      const chuckH = isVTL ? 12 : 18;
      const chuckMesh = new THREE.Mesh(new THREE.CylinderGeometry(chuckRad, chuckRad, chuckH, 48), chuckMat);
      chuckMesh.position.y = -stickout / 2 - chuckH / 2;
      spindleGroup.add(chuckMesh);

      const numJaws = isVTL ? 4 : 3;
      for (let j = 0; j < numJaws; j++) {
        const ang = (j * Math.PI * 2) / numJaws;
        const jawMesh = new THREE.Mesh(new THREE.BoxGeometry(8, 10, 10), jawMat);
        jawMesh.position.set(Math.cos(ang) * (rawRad + 3.5), -stickout / 2 + 3.5, Math.sin(ang) * (rawRad + 3.5));
        jawMesh.rotation.y = -ang;
        spindleGroup.add(jawMesh);
      }

      const solidWorkpiece = buildSolidVerifyWorkpiece(
        current,
        operation,
        workSide === 'ID',
        rawOD,
        rawRad,
        partLen,
        stickout,
        planes
      );
      spindleGroup.add(solidWorkpiece);

      orientWrapper.add(spindleGroup);
      group.add(orientWrapper);

      const mapTurnVec = (pt) => {
        const zNorm = ((pt.z || 0) / partLen) * (stickout * 0.88);
        const rad = ((pt.x || 0) / Math.max(10, rawOD)) * rawRad;
        if (isVTL) {
          return new THREE.Vector3(rad, stickout / 2 + zNorm, 0);
        }
        return new THREE.Vector3(stickout / 2 + zNorm, rad, 0);
      };

      for (let i = 1; i < history.length; i++) {
        const p1 = mapTurnVec(history[i - 1]);
        const p2 = mapTurnVec(history[i]);
        const col = history[i].rapid ? 0xe11d48 : history[i].passType === 'finish' ? 0x059669 : 0x0284c7;
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([p1, p2]), new THREE.LineBasicMaterial({ color: col })));
      }

      const tip = mapTurnVec(current);
      const discMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.78, roughness: 0.28 });
      const cyanMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, metalness: 0.55, roughness: 0.22 });
      const steelShankMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.88, roughness: 0.2 });
      const darkClampMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.3 });
      const insertMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xb45309, emissiveIntensity: 0.35, metalness: 0.65, roughness: 0.16 });

      const toolObj = createOperationTooling(
        operation,
        workSide === 'ID',
        isVTL,
        discMat,
        cyanMat,
        steelShankMat,
        darkClampMat,
        insertMat,
        mfgCfg.insertType,
        mfgCfg.noseRadius
      );
      toolObj.position.copy(tip);
      group.add(toolObj);
    } else {
      // SolidWorks CAM Level 3D Milling Simulation
      spindleGroupRef.current = null;
      const blkW = Math.min(96, Number(mfgCfg.stockX || 100) * 0.85);
      const blkD = Math.min(76, Number(mfgCfg.stockY || 80) * 0.85);
      const blkH = Math.min(34, Math.max(18, Number(mfgCfg.stockZ || 30) * 0.88));
      const maxFeatD = Math.min(blkH - 4, Math.max(4, Number(mfgCfg.featureDepth || 10) * 0.95));
      const cutD = Math.min(maxFeatD, (current.cutDepth || 0) * 0.95);
      const isFinPass = current.passType === 'finish' || current.passType === 'chamfer';

      const baseFixtureMat = new THREE.MeshStandardMaterial({
        color: 0x9a3412,
        metalness: 0.45,
        roughness: 0.45,
        clippingPlanes: planes
      });
      const stockWallMat = new THREE.MeshStandardMaterial({
        color: 0x475569,
        metalness: 0.65,
        roughness: 0.3,
        clippingPlanes: planes,
        side: THREE.DoubleSide
      });
      const topCopperMat = new THREE.MeshStandardMaterial({
        color: 0xb45309,
        metalness: 0.55,
        roughness: 0.32,
        clippingPlanes: planes
      });
      const cavityFloorMat = new THREE.MeshStandardMaterial({
        color: isFinPass ? 0x10b981 : 0x65a30d,
        emissive: isFinPass ? 0x047857 : 0x3f6212,
        emissiveIntensity: 0.2,
        metalness: 0.5,
        roughness: 0.22,
        clippingPlanes: planes,
        side: THREE.DoubleSide
      });
      const cavityWallMat = new THREE.MeshStandardMaterial({
        color: isFinPass ? 0x059669 : 0x0284c7,
        metalness: 0.55,
        roughness: 0.22,
        clippingPlanes: planes,
        side: THREE.DoubleSide
      });

      const basePlate = new THREE.Mesh(new THREE.BoxGeometry(blkW + 8, 4, blkD + 8), baseFixtureMat);
      basePlate.position.y = -blkH - 2;
      group.add(basePlate);

      const isFaceOp = tName.includes('FACE') || operation === 'Face Milling';
      const isContourOp = tName.includes('CONTOUR') || tName.includes('PROFILE') || operation === 'Contour Milling';
      const isSlotOp = tName.includes('SLOT') || operation === 'Slot Milling';
      const isPocketOp = tName.includes('POCKET') || operation === 'Pocket Milling';
      const isSpigotOp = tName.includes('SPIGOT') || operation === 'Spigot Milling' || isContourOp;
      const isCircShape = !tName.includes('RECTANGULAR') && !isContourOp;

      if (isPocketOp && cutD > 0.3) {
        const outerShape = new THREE.Shape();
        outerShape.moveTo(-blkW / 2, -blkD / 2);
        outerShape.lineTo(blkW / 2, -blkD / 2);
        outerShape.lineTo(blkW / 2, blkD / 2);
        outerShape.lineTo(-blkW / 2, blkD / 2);
        outerShape.closePath();

        const holePath = new THREE.Path();
        if (isCircShape) {
          const r = current.cutRad || 22;
          holePath.absarc(0, 0, r, 0, Math.PI * 2, true);
        } else {
          const hw = current.cutW || 26;
          const hh = current.cutH || 16;
          holePath.moveTo(-hw, -hh);
          holePath.lineTo(-hw, hh);
          holePath.lineTo(hw, hh);
          holePath.lineTo(hw, -hh);
          holePath.closePath();
        }
        outerShape.holes.push(holePath);

        const upperWallGeo = new THREE.ExtrudeGeometry(outerShape, {
          depth: cutD,
          bevelEnabled: false,
          curveSegments: 40
        });
        upperWallGeo.rotateX(Math.PI / 2);
        const upperWallMesh = new THREE.Mesh(upperWallGeo, stockWallMat);
        upperWallMesh.position.y = 0;
        group.add(upperWallMesh);

        const topSkinGeo = new THREE.ShapeGeometry(outerShape, 40);
        topSkinGeo.rotateX(-Math.PI / 2);
        const topSkinMesh = new THREE.Mesh(topSkinGeo, topCopperMat);
        topSkinMesh.position.y = 0.05;
        group.add(topSkinMesh);

        const lowerH = Math.max(2, blkH - cutD);
        const lowerBlock = new THREE.Mesh(new THREE.BoxGeometry(blkW, lowerH, blkD), stockWallMat);
        lowerBlock.position.y = -cutD - lowerH / 2;
        group.add(lowerBlock);

        if (isCircShape) {
          const r = current.cutRad || 22;
          const floorDisk = new THREE.Mesh(new THREE.CircleGeometry(r, 40), cavityFloorMat);
          floorDisk.rotation.x = -Math.PI / 2;
          floorDisk.position.y = -cutD + 0.08;
          group.add(floorDisk);

          const innerCylWall = new THREE.Mesh(new THREE.CylinderGeometry(r, r, cutD, 40, 1, true), cavityWallMat);
          innerCylWall.position.y = -cutD / 2;
          group.add(innerCylWall);
        } else {
          const hw = current.cutW || 26;
          const hh = current.cutH || 16;
          const floorRect = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, hh * 2), cavityFloorMat);
          floorRect.rotation.x = -Math.PI / 2;
          floorRect.position.y = -cutD + 0.08;
          group.add(floorRect);
        }
      } else if (isSpigotOp && cutD > 0.3) {
        const lowerH = Math.max(2, blkH - cutD);
        const lowerBlock = new THREE.Mesh(new THREE.BoxGeometry(blkW, lowerH, blkD), stockWallMat);
        lowerBlock.position.y = -cutD - lowerH / 2;
        group.add(lowerBlock);

        const stepFloor = new THREE.Mesh(new THREE.PlaneGeometry(blkW, blkD), cavityFloorMat);
        stepFloor.rotation.x = -Math.PI / 2;
        stepFloor.position.y = -cutD + 0.06;
        group.add(stepFloor);

        if (isCircShape) {
          const bossRad = current.cutRad || 20;
          const bossMesh = new THREE.Mesh(new THREE.CylinderGeometry(bossRad, bossRad, cutD, 40), cavityWallMat);
          bossMesh.position.y = -cutD / 2;
          group.add(bossMesh);

          const bossTop = new THREE.Mesh(new THREE.CircleGeometry(bossRad, 40), topCopperMat);
          bossTop.rotation.x = -Math.PI / 2;
          bossTop.position.y = 0.05;
          group.add(bossTop);
        } else {
          const bw = (current.cutW || 22) * 2;
          const bd = (current.cutH || 14) * 2;
          const bossMesh = new THREE.Mesh(new THREE.BoxGeometry(bw, cutD, bd), cavityWallMat);
          bossMesh.position.y = -cutD / 2;
          group.add(bossMesh);

          const bossTop = new THREE.Mesh(new THREE.PlaneGeometry(bw, bd), topCopperMat);
          bossTop.rotation.x = -Math.PI / 2;
          bossTop.position.y = 0.05;
          group.add(bossTop);
        }
      } else if (isFaceOp) {
        const remH = Math.max(8, blkH - cutD);
        const stockMesh = new THREE.Mesh(new THREE.BoxGeometry(blkW, remH, blkD), stockWallMat);
        stockMesh.position.y = -cutD - remH / 2;
        group.add(stockMesh);

        const fProg = current.faceProg || 0;
        if (fProg < 0.98) {
          const uncutD = blkD * (1 - fProg);
          const unCutSkin = new THREE.Mesh(new THREE.PlaneGeometry(blkW, uncutD), topCopperMat);
          unCutSkin.rotation.x = -Math.PI / 2;
          unCutSkin.position.set(0, 0.04, -(blkD / 2 - uncutD / 2));
          group.add(unCutSkin);
        }
        if (fProg > 0.01) {
          const cutDepthZ = blkD * fProg;
          const milledSkin = new THREE.Mesh(new THREE.PlaneGeometry(blkW, cutDepthZ), cavityFloorMat);
          milledSkin.rotation.x = -Math.PI / 2;
          milledSkin.position.set(0, -cutD + 0.06, blkD / 2 - cutDepthZ / 2);
          group.add(milledSkin);
        }
      } else if (isSlotOp) {
        const stockMesh = new THREE.Mesh(new THREE.BoxGeometry(blkW, blkH, blkD), stockWallMat);
        stockMesh.position.y = -blkH / 2;
        group.add(stockMesh);

        const topSkin = new THREE.Mesh(new THREE.PlaneGeometry(blkW, blkD), topCopperMat);
        topSkin.rotation.x = -Math.PI / 2;
        topSkin.position.y = 0.04;
        group.add(topSkin);

        const sLen = current.slotLen || 0;
        if (sLen > 1 && cutD > 0.3) {
          const slotW = Math.max(8, Number(mfgCfg.toolDia || 12) * 0.85);
          const slotFloor = new THREE.Mesh(new THREE.BoxGeometry(sLen, cutD + 0.2, slotW), cavityFloorMat);
          slotFloor.position.set(-30 + sLen / 2, -cutD / 2 + 0.08, 0);
          group.add(slotFloor);
        }
      } else {
        const stockMesh = new THREE.Mesh(new THREE.BoxGeometry(blkW, blkH, blkD), stockWallMat);
        stockMesh.position.y = -blkH / 2;
        group.add(stockMesh);

        const topSkin = new THREE.Mesh(new THREE.PlaneGeometry(blkW, blkD), topCopperMat);
        topSkin.rotation.x = -Math.PI / 2;
        topSkin.position.y = 0.05;
        group.add(topSkin);

        const holeRadius = Math.max(2.2, Number(mfgCfg.drillDia || mfgCfg.tapDia || 10) * 0.35);
        history.forEach((hMove) => {
          if (!hMove.rapid && (hMove.z || 0) < -0.5) {
            const hDepth = Math.min(blkH - 2, Math.abs(hMove.z));
            const holeRim = new THREE.Mesh(
              new THREE.CircleGeometry(holeRadius, 24),
              new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6, clippingPlanes: planes })
            );
            holeRim.rotation.x = -Math.PI / 2;
            holeRim.position.set(hMove.x || 0, 0.08, -(hMove.y || 0));
            group.add(holeRim);

            const holeCyl = new THREE.Mesh(
              new THREE.CylinderGeometry(holeRadius, holeRadius, hDepth, 24),
              cavityWallMat
            );
            holeCyl.position.set(hMove.x || 0, -hDepth / 2 + 0.04, -(hMove.y || 0));
            group.add(holeCyl);
          }
        });
      }

      const mapMillVec = (pt) => new THREE.Vector3(pt.x || 0, pt.z || 0, -(pt.y || 0));
      for (let i = 1; i < history.length; i++) {
        const p1 = mapMillVec(history[i - 1]);
        const p2 = mapMillVec(history[i]);
        const col = history[i].rapid ? 0xe11d48 : history[i].passType === 'finish' ? 0x059669 : 0x0284c7;
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([p1, p2]), new THREE.LineBasicMaterial({ color: col })));
      }

      const tip = mapMillVec(current);
      const cutterRad = isFaceOp ? Math.max(7.5, Number(mfgCfg.toolDia || 50) * 0.22) : Math.max(2.6, Number(mfgCfg.toolDia || 12) * 0.42);
      const fluteLen = isFaceOp ? 10 : Math.max(16, Number(mfgCfg.toolLength || 35) * 0.55);

      const cutterGroup = new THREE.Group();
      const fluteMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(cutterRad, cutterRad, fluteLen, 28),
        new THREE.MeshStandardMaterial({ color: isFaceOp ? 0x334155 : 0x0284c7, metalness: 0.78, roughness: 0.2 })
      );
      fluteMesh.position.y = fluteLen / 2;
      cutterGroup.add(fluteMesh);

      if (isFaceOp) {
        // Golden Indexable Face Mill Inserts around bottom periphery
        for (let k = 0; k < 6; k++) {
          const ang = (k / 6) * Math.PI * 2;
          const ins = new THREE.Mesh(
            new THREE.BoxGeometry(2.2, 2.6, 2.2),
            new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.7, roughness: 0.2 })
          );
          ins.position.set(Math.cos(ang) * (cutterRad - 0.5), 1.3, Math.sin(ang) * (cutterRad - 0.5));
          cutterGroup.add(ins);
        }
      }

      const shankMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(cutterRad * (isFaceOp ? 0.55 : 1.05), cutterRad * (isFaceOp ? 0.55 : 1.05), 18, 28),
        new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.88, roughness: 0.2 })
      );
      shankMesh.position.y = fluteLen + 9;
      cutterGroup.add(shankMesh);

      const holderMesh = new THREE.Mesh(new THREE.CylinderGeometry(cutterRad * (isFaceOp ? 1.1 : 2.2), cutterRad * (isFaceOp ? 0.8 : 1.5), 16, 28), chuckMat);
      holderMesh.position.y = fluteLen + 26;
      cutterGroup.add(holderMesh);

      cutterGroup.position.copy(tip);
      group.add(cutterGroup);
    }
  }, [moves, stepIdx, domainKey, isVTL, workSide, operation, templateName, mfgCfg, halfCut]);

  const current = moves[stepIdx] || moves[0];
  const rawOD = Number(mfgCfg.stockX || 50);
  const activeOD = current.curOD ?? rawOD;
  const activeID = current.curID ?? (workSide === 'ID' ? Number(mfgCfg.rawIdDia || 20) : 0);

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col justify-between h-full min-h-[615px]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
          <Box className="w-4 h-4" />
          <span>SolidCAM 3D Verify ({operation} • {isVTL ? 'VTL' : domainKey})</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPlaying(!playing)}
            className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-bold flex items-center gap-1 border border-cyan-500/40"
          >
            {playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {playing ? 'Pause' : 'Play'}
          </button>
          <button
            type="button"
            onClick={() => setStepIdx(0)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
            title="Reset"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="px-1.5 py-1 rounded-lg bg-slate-900 text-[11px] font-bold text-amber-300 border border-slate-700 outline-none"
          >
            {SPEED_OPTIONS.map((sp) => (
              <option key={sp} value={sp}>{sp}x</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5 text-[10px] font-semibold">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setCameraView('iso')} className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700">3D Iso</button>
          <button type="button" onClick={() => setCameraView('top')} className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700">Top</button>
          <button type="button" onClick={() => setCameraView('front')} className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700">Front</button>
          <button type="button" onClick={() => setCameraView('side')} className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700">Side</button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setHalfCut(!halfCut)}
            className={`px-2 py-1 rounded flex items-center gap-1 border ${halfCut ? 'bg-amber-500/25 text-amber-300 border-amber-500/60' : 'bg-slate-900 text-slate-300 border-slate-700'}`}
          >
            <Scissors className="w-3 h-3" /> ½ Section
          </button>
          <button type="button" onClick={() => adjustZoom(0.82)} className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700" title="Zoom In"><ZoomIn className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={() => adjustZoom(1.22)} className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700" title="Zoom Out"><ZoomOut className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      <div className="my-2 bg-slate-300 border border-slate-400 rounded-xl overflow-hidden relative shadow-inner">
        <div ref={mountRef} className="w-full h-[385px] cursor-grab active:cursor-grabbing" />

        <div className="absolute top-2 left-2.5 right-2.5 flex justify-between items-center text-[10px] font-mono bg-slate-900/85 text-slate-100 px-2.5 py-1 rounded border border-slate-700 pointer-events-none">
          <span className="font-bold">
            {domainKey === 'Turning'
              ? `Live OD: Ø${activeOD.toFixed(1)}mm ${activeID > 0 ? `| ID: Ø${activeID.toFixed(1)}mm` : ''} • RPM: ${playing ? 'ON' : 'STOP'}`
              : `Cut Depth: ${(current.cutDepth || 0).toFixed(1)} / ${mfgCfg.featureDepth || 10}mm`}
          </span>
          <span className="text-cyan-300">Drag: Rotate • Scroll: Zoom</span>
        </div>

        <div className="absolute bottom-2 left-2 right-2 flex flex-wrap items-center gap-2.5 text-[10px] font-mono bg-slate-900/85 text-slate-100 px-2.5 py-1 rounded-md border border-slate-700 pointer-events-none">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-slate-400"></span> Raw Stock</span>
          <span className="flex items-center gap-1 text-sky-300"><span className="w-2.5 h-2.5 rounded-sm bg-sky-600"></span> Rough Cut</span>
          <span className="flex items-center gap-1 text-emerald-300"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span> Finish Cut</span>
          <span className="flex items-center gap-1 text-amber-300"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500"></span> {domainKey === 'Milling' ? `${operation} (Ø${mfgCfg.toolDia || 12}mm)` : operation === 'Threading' ? '3D Threads' : `${mfgCfg.insertType || 'CNMG'} R${mfgCfg.noseRadius || '0.8'}`}</span>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 space-y-1.5">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-cyan-300 font-bold">
            {domainKey === 'Turning'
              ? `X: ${(current.x ?? 0).toFixed(2)}   Z: ${(current.z ?? 0).toFixed(2)}`
              : `X: ${(current.x ?? 0).toFixed(1)}   Y: ${(current.y ?? 0).toFixed(1)}   Z: ${(current.z ?? 0).toFixed(1)}`}
          </span>
          <span className="text-[11px] text-slate-400">
            Block {stepIdx + 1} / {moves.length}
          </span>
        </div>
        <div className="text-[11px] font-mono text-emerald-300 truncate bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
          EXEC: {current.gcode}
        </div>
      </div>
    </div>
  );
}

