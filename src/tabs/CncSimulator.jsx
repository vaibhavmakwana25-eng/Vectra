import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Play, Pause, RotateCcw, Box, ZoomIn, ZoomOut, Scissors } from 'lucide-react';

function buildStepMoves(code, domainKey, workSide, operation, templateName = '', mfgCfg = {}) {
  const moves = [];
  const tName = (templateName + ' ' + workSide).toUpperCase();
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

    // Maintain monotonic cut progress along Z so cut material NEVER refills
    const zSlices = 18;
    const stepProfile = [];
    for (let k = 0; k <= zSlices; k++) {
      stepProfile.push(rawOD);
    }
    const boreProfile = [];
    for (let k = 0; k <= zSlices; k++) {
      boreProfile.push(isID ? Math.max(8, rawID) : 0);
    }
    let maxCutFraction = 0;

    const snapshot = (zVal, curDia, rapid, passType, gcode) => {
      const distFromFace = Math.max(0, Math.min(partLen, -zVal));
      const frac = Math.min(1, distFromFace / partLen);
      const sliceIdx = Math.min(zSlices, Math.floor(frac * zSlices));

      if (!rapid) {
        if (frac > maxCutFraction) maxCutFraction = frac;
        for (let i = 0; i <= sliceIdx; i++) {
          if (isID) {
            boreProfile[i] = Math.max(boreProfile[i], curDia);
          } else {
            stepProfile[i] = Math.min(stepProfile[i], curDia);
          }
        }
      }

      const activeCutFrac = Math.max(maxCutFraction, frac);
      moves.push({
        x: curDia,
        y: 0,
        z: zVal,
        rapid,
        passType,
        odProfile: [...stepProfile],
        idProfile: [...boreProfile],
        curOD: isID ? rawOD : stepProfile[Math.max(0, sliceIdx)],
        curID: isID ? boreProfile[Math.max(0, sliceIdx)] : 0,
        cutFrac: activeCutFrac,
        gcode
      });
    };

    if (operation === 'Drilling' || operation === 'Tapping') {
      const drillDia = operation === 'Tapping'
        ? Math.max(3, Number(mfgCfg.tapDia || 10) - Number(mfgCfg.tapPitch || 1.5))
        : Number(mfgCfg.drillDia || 16);
      const peck = Math.max(4, Number(mfgCfg.peckDepth || 10));
      snapshot(5, 0, true, 'rapid', `G00 X0.0 Z5.0 (${operation} Ø${drillDia.toFixed(1)})`);
      for (let d = -peck; d >= -Math.min(45, partLen); d -= peck) {
        for (let s = 1; s <= 6; s++) {
          const zNow = (d * s) / 6;
          for (let i = 0; i <= zSlices; i++) {
            if ((i / zSlices) * partLen <= Math.abs(zNow)) {
              boreProfile[i] = Math.max(boreProfile[i], drillDia);
            }
          }
          snapshot(zNow, 0, false, 'rough', `G01 Z${zNow.toFixed(1)} F0.12`);
        }
        snapshot(4, 0, true, 'rapid', `G00 Z4.0 (CHIP BREAK RETRACT)`);
      }
      snapshot(18, 0, true, 'rapid', `G28 U0. W0. M05`);
    } else if (operation === 'Threading') {
      const majDia = Number(mfgCfg.threadMajorDia || 24);
      const minDia = Number(mfgCfg.threadMinorDia || 20.32);
      const baseOD = isID ? rawOD : majDia;
      for (let i = 0; i <= zSlices; i++) stepProfile[i] = baseOD;
      const safeX = isID ? minDia - 6 : majDia + 6;
      const targetLen = Math.min(35, partLen - 5);
      const passRatios = [0.35, 0.65, 0.88, 1.0];
      passRatios.forEach((ratio, idx) => {
        const px = isID
          ? minDia + (majDia - minDia) * ratio
          : majDia - (majDia - minDia) * ratio;
        snapshot(4, safeX, true, 'rapid', `G00 X${safeX.toFixed(1)} Z4.0 (THREAD PASS ${idx + 1}/4)`);
        snapshot(4, px, true, 'rapid', `G00 X${px.toFixed(3)}`);
        for (let s = 1; s <= 8; s++) {
          const zStep = -(targetLen * s) / 8;
          snapshot(zStep, px, false, idx === 3 ? 'finish' : 'rough', `G76 X${px.toFixed(3)} Z${zStep.toFixed(1)} F${mfgCfg.threadPitch || 3.0}`);
        }
        snapshot(-targetLen, safeX, true, 'rapid', `G00 X${safeX.toFixed(1)} (RETRACT)`);
      });
      snapshot(16, safeX, true, 'rapid', `G28 U0. W0. M05`);
    } else if (isFace) {
      [-0.8, -1.6, -2.4].forEach((fz, idx) => {
        snapshot(fz, rawOD + 3, true, 'rapid', `G00 X${(rawOD + 3).toFixed(1)} Z${fz}`);
        for (let s = 1; s <= 8; s++) {
          const xStep = rawOD - ((rawOD - (isID ? rawID : 0)) * s) / 8;
          snapshot(fz, xStep, false, idx === 2 ? 'finish' : 'rough', `G01 X${xStep.toFixed(1)} Z${fz} F0.15`);
        }
        snapshot(fz + 2, rawOD + 3, true, 'rapid', `G00 RETRACT`);
      });
      snapshot(16, rawOD + 8, true, 'rapid', `G28 U0. W0. M05`);
    } else if (operation === 'Grooving' || operation === 'Parting') {
      const cutZ = -Math.min(28, partLen - 5);
      const targetX = operation === 'Parting' ? 0 : isID ? finOD + 6 : Math.max(12, finOD - 6);
      const startX = isID ? finOD - 4 : rawOD + 2;
      snapshot(cutZ, startX, true, 'rapid', `G00 X${startX.toFixed(1)} Z${cutZ}`);
      for (let s = 1; s <= 8; s++) {
        const curX = startX + ((targetX - startX) * s) / 8;
        snapshot(cutZ, curX, false, 'rough', `G01 X${curX.toFixed(1)} F0.08`);
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
          for (let s = 1; s <= 12; s++) {
            const zProg = (targetZ * s) / 12;
            snapshot(-zProg, nextID, false, 'rough', `G01 X${nextID.toFixed(2)} Z-${zProg.toFixed(1)} F0.22`);
          }
          activeID = nextID;
          snapshot(-targetZ, rawID - 2, true, 'rapid', `G00 X${(rawID - 2).toFixed(1)} (RETRACT)`);
        }
      }
      if (stage.includes('Finish') || stage.includes('Combined')) {
        snapshot(2, finOD, true, 'rapid', `G00 X${finOD.toFixed(2)} Z2.0 (FINISH PASS)`);
        for (let s = 1; s <= 12; s++) {
          const zProg = (partLen * s) / 12;
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
      // OD TURNING: Smooth 12-step Z feed per pass + cumulative OD profile (never refills!)
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
          for (let s = 1; s <= 12; s++) {
            const zProg = (targetZ * s) / 12;
            snapshot(-zProg, nextOD, false, 'rough', `G01 X${nextOD.toFixed(2)} Z-${zProg.toFixed(1)} F0.25`);
          }
          activeOD = nextOD;
          snapshot(-targetZ + 1, activeOD + 3, true, 'rapid', `G00 X${(activeOD + 3).toFixed(1)} (RETRACT)`);
        }
      }
      if (stage.includes('Finish') || stage.includes('Combined')) {
        snapshot(2, finOD, true, 'rapid', `G00 X${finOD.toFixed(2)} Z2.0 (FINISH PASS)`);
        for (let s = 1; s <= 12; s++) {
          const zProg = (partLen * s) / 12;
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
    const isCircPocket = tName.includes('CIRCULAR POCKET') || operation === 'Pocket Milling';
    const isRectPocket = tName.includes('RECTANGULAR POCKET');
    const isCircSpigot = tName.includes('CIRCULAR SPIGOT') || operation === 'Spigot Milling';
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
    } else {
      const holes = [
        { x: -24, y: -16 },
        { x: 24, y: -16 },
        { x: 24, y: 16 },
        { x: -24, y: 16 },
        { x: 0, y: 0 }
      ];
      holes.forEach((h, i) => {
        moves.push({ x: h.x, y: h.y, z: 6, rapid: true, passType: 'rapid', gcode: `HOLE ${i + 1}: G00 X${h.x} Y${h.y}` });
        moves.push({ x: h.x, y: h.y, z: -depth, rapid: false, passType: 'rough', gcode: `G43 CYCLE Z-${depth}.0` });
        moves.push({ x: h.x, y: h.y, z: 6, rapid: true, passType: 'rapid', gcode: 'G00 R-PLANE Z6.0' });
      });
    }
  }

  return moves.length > 0 ? moves : [{ x: 0, y: 0, z: 10, rapid: true, passType: 'rapid', gcode: 'READY' }];
}

const SPEED_OPTIONS = [0.25, 0.5, 1, 2, 4];

// Builds a smooth LatheGeometry from an array of { r, y } profile points
function buildProfileLathe(profileArray, rawOD, rawRad, stickout, isVTL) {
  const pts = [];
  const n = profileArray.length - 1;
  // Start at center axis on chuck side
  pts.push(new THREE.Vector2(0.01, -stickout / 2));
  for (let i = 0; i <= n; i++) {
    // i=0 is free face (+stickout/2), i=n is chuck face (-stickout/2)
    const fracFromFace = i / n;
    const yPos = stickout / 2 - fracFromFace * stickout;
    const dia = profileArray[i];
    const rad = Math.max(2, (dia / Math.max(10, rawOD)) * rawRad);
    pts.push(new THREE.Vector2(rad, yPos));
  }
  pts.push(new THREE.Vector2(0.01, -stickout / 2));

  const geo = new THREE.LatheGeometry(pts, 48);
  if (!isVTL) {
    geo.rotateZ(-Math.PI / 2);
  }
  return geo;
}

function createOperationTooling(operation, isID, isVTL, ringMat, pocketMat, holderMat, insertMat) {
  const assembly = new THREE.Group();

  const turretBody = new THREE.Group();
  if (isVTL) {
    const outerRing = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 6.5, 32, 1, true), ringMat);
    const topRing = new THREE.Mesh(new THREE.RingGeometry(10, 15, 32), ringMat);
    topRing.rotation.x = -Math.PI / 2;
    topRing.position.y = 3.25;
    turretBody.add(outerRing, topRing);

    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2;
      const st = new THREE.Mesh(new THREE.BoxGeometry(3.8, 7, 3.8), pocketMat);
      st.position.set(Math.cos(ang) * 12.5, 0, Math.sin(ang) * 12.5);
      st.rotation.y = -ang;
      turretBody.add(st);
    }
    turretBody.position.set(isID ? 18 : 22, 26, 0);
  } else {
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(10.5, 10.5, 9.5, 24), ringMat);
    drum.rotation.x = Math.PI / 2;
    drum.position.set(22, 22, 0);
    turretBody.add(drum);

    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const pk = new THREE.Mesh(new THREE.BoxGeometry(3.5, 3.5, 8), pocketMat);
      pk.position.set(22 + Math.cos(ang) * 10.8, 22 + Math.sin(ang) * 10.8, 0);
      pk.rotation.z = ang;
      turretBody.add(pk);
    }
  }
  assembly.add(turretBody);

  const toolPart = new THREE.Group();

  if (isID || operation === 'Boring' || operation === 'Drilling' || operation === 'Tapping') {
    const barLen = 22;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, barLen, 20), holderMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(barLen / 2, 0, 0);
    toolPart.add(bar);

    const riser = new THREE.Mesh(new THREE.BoxGeometry(4.5, 22, 4.5), holderMat);
    riser.position.set(barLen, 11, 0);
    toolPart.add(riser);

    const idInsert = new THREE.Mesh(new THREE.ConeGeometry(2.6, 5.5, 4), insertMat);
    idInsert.rotation.z = -Math.PI / 2;
    idInsert.position.set(2.2, 0, 0);
    toolPart.add(idInsert);
  } else {
    const vPost = new THREE.Mesh(
      new THREE.BoxGeometry(operation === 'Grooving' || operation === 'Parting' ? 2.0 : 4.5, 22, 4.5),
      holderMat
    );
    vPost.position.set(3.5, 11, 0);
    toolPart.add(vPost);

    const hArm = new THREE.Mesh(new THREE.BoxGeometry(18, 4.5, 4.5), holderMat);
    hArm.position.set(12.5, 22, 0);
    toolPart.add(hArm);

    if (operation === 'Threading') {
      const odThreadIns = new THREE.Mesh(new THREE.ConeGeometry(3.2, 6.5, 3), insertMat);
      odThreadIns.rotation.z = Math.PI / 2;
      odThreadIns.position.set(-1.5, 1.5, 0);
      toolPart.add(odThreadIns);
    } else if (operation === 'Grooving' || operation === 'Parting') {
      const odGrooveIns = new THREE.Mesh(new THREE.BoxGeometry(2.0, 5.2, 4.0), insertMat);
      odGrooveIns.position.set(-1.0, 2.0, 0);
      toolPart.add(odGrooveIns);
    } else {
      const odDiamondIns = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 2.2, 4), insertMat);
      odDiamondIns.rotation.x = Math.PI / 2;
      odDiamondIns.rotation.y = Math.PI / 4;
      odDiamondIns.position.set(-1.5, 2.0, 0);
      toolPart.add(odDiamondIns);
    }
  }

  assembly.add(toolPart);
  return assembly;
}

export default function CncSimulator({ code, domainKey, machineType, workSide, operation, templateName = '', mfgCfg = {} }) {
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
    () => buildStepMoves(code, domainKey, workSide, operation, templateName, mfgCfg),
    [code, domainKey, workSide, operation, templateName, mfgCfg]
  );

  useEffect(() => {
    setStepIdx(0);
    setPlaying(true);
  }, [moves]);

  useEffect(() => {
    if (!playing || moves.length === 0) return;
    const timer = setInterval(() => {
      setStepIdx((prev) => (prev + 1 >= moves.length ? 0 : prev + 1));
    }, Math.max(55, Math.round(240 / speed)));
    return () => clearInterval(timer);
  }, [playing, moves, speed]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 400;
    const height = 380;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#64748b');

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
    camera.position.set(145, 110, 165);
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

    const grid = new THREE.GridHelper(260, 26, 0x334155, 0x475569);
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
    if (view === 'iso') cam.position.set(145, 110, 165);
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
    const tName = (templateName + ' ' + workSide).toUpperCase();
    const planes = halfCut ? [clipPlaneRef.current] : [];

    const chuckMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.78,
      roughness: 0.28,
      clippingPlanes: planes,
      side: THREE.DoubleSide
    });
    const jawMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      metalness: 0.85,
      roughness: 0.22,
      clippingPlanes: planes
    });
    const rawStockMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.65,
      roughness: 0.35,
      clippingPlanes: planes,
      side: THREE.DoubleSide
    });
    const machinedMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0369a1,
      emissiveIntensity: 0.22,
      metalness: 0.6,
      roughness: 0.18,
      clippingPlanes: planes,
      side: THREE.DoubleSide
    });

    if (domainKey === 'Turning') {
      const rawOD = Number(mfgCfg.stockX || 50);
      const partLen = Math.max(12, Number(mfgCfg.stockZ || 45));
      const stickout = Math.min(64, Math.max(38, Number(mfgCfg.chuckStickout || 65) * 0.78));
      const rawRad = 24;

      const spindleGroup = new THREE.Group();
      if (!isVTL) {
        spindleGroup.rotation.z = -Math.PI / 2;
      }
      spindleGroupRef.current = spindleGroup;

      // 1. 3-Jaw Chuck + Steel Jaws
      const chuckMesh = new THREE.Mesh(new THREE.CylinderGeometry(rawRad + 11, rawRad + 11, 18, 48), chuckMat);
      chuckMesh.position.y = -stickout / 2 - 9;
      spindleGroup.add(chuckMesh);

      for (let j = 0; j < 3; j++) {
        const ang = (j * Math.PI * 2) / 3;
        const jawMesh = new THREE.Mesh(new THREE.BoxGeometry(8, 12, 11), jawMat);
        jawMesh.position.set(Math.cos(ang) * (rawRad + 3), -stickout / 2 + 4, Math.sin(ang) * (rawRad + 3));
        jawMesh.rotation.y = -ang;
        spindleGroup.add(jawMesh);
      }

      // 2. Smooth Lathe-Revolved Workpiece (Continuous slice-by-slice material removal!)
      const odProf = current.odProfile || [rawOD];
      const latheGeo = buildProfileLathe(odProf, rawOD, rawRad, stickout, isVTL);
      const jobMesh = new THREE.Mesh(latheGeo, machinedMat);
      spindleGroup.add(jobMesh);

      // Uncut outer collar reference on uncut region so raw vs machined transition is super sharp
      const cutFrac = current.cutFrac || 0;
      const uncutH = Math.max(0.2, stickout * (1 - cutFrac));
      if (uncutH > 0.5 && workSide !== 'ID') {
        const collarMesh = new THREE.Mesh(new THREE.CylinderGeometry(rawRad, rawRad, uncutH, 48), rawStockMat);
        collarMesh.position.y = -stickout / 2 + uncutH / 2;
        spindleGroup.add(collarMesh);
      }

      // Inner Bore if ID / Drilling
      const idProf = current.idProfile || [];
      const maxIdDia = idProf.length > 0 ? Math.max(...idProf) : 0;
      if (maxIdDia > 1 && cutFrac > 0.02) {
        const boreRad = Math.max(3, (maxIdDia / Math.max(10, rawOD)) * rawRad);
        const boreH = Math.max(2, stickout * cutFrac);
        const boreMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(boreRad, boreRad, boreH + 0.4, 36),
          new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5, clippingPlanes: planes })
        );
        boreMesh.position.y = stickout / 2 - boreH / 2 + 0.2;
        spindleGroup.add(boreMesh);
      }

      group.add(spindleGroup);

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
        const col = history[i].rapid ? 0xe11d48 : history[i].passType === 'finish' ? 0x0284c7 : 0x059669;
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([p1, p2]), new THREE.LineBasicMaterial({ color: col })));
      }

      const tip = mapTurnVec(current);
      const ringMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.78, roughness: 0.26 });
      const pocketMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, metalness: 0.55, roughness: 0.22 });
      const holderMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.22 });
      const insertMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xb45309, emissiveIntensity: 0.35, metalness: 0.65, roughness: 0.18 });

      const toolObj = createOperationTooling(operation, workSide === 'ID', isVTL, ringMat, pocketMat, holderMat, insertMat);
      toolObj.position.copy(tip);
      group.add(toolObj);
    } else {
      spindleGroupRef.current = null;
      const blkW = Math.min(96, Number(mfgCfg.stockX || 100) * 0.85);
      const blkD = Math.min(76, Number(mfgCfg.stockY || 80) * 0.85);
      const blkH = Math.min(34, Math.max(16, Number(mfgCfg.stockZ || 30) * 0.85));
      const cutD = Math.min(blkH - 3, (current.cutDepth || 0) * 0.95);

      const stockMesh = new THREE.Mesh(new THREE.BoxGeometry(blkW, blkH, blkD), rawStockMat);
      stockMesh.position.y = -blkH / 2;
      group.add(stockMesh);

      if (cutD > 0.5) {
        if (tName.includes('CIRCULAR POCKET') || operation === 'Pocket Milling') {
          const rad = current.cutRad || 22;
          const cavMesh = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, cutD + 0.4, 40), machinedMat);
          cavMesh.position.y = -cutD / 2 + 0.1;
          group.add(cavMesh);
        } else if (tName.includes('RECTANGULAR POCKET')) {
          const w = (current.cutW || 26) * 2;
          const d = (current.cutH || 16) * 2;
          const cavMesh = new THREE.Mesh(new THREE.BoxGeometry(w, cutD + 0.4, d), machinedMat);
          cavMesh.position.y = -cutD / 2 + 0.1;
          group.add(cavMesh);
        } else if (tName.includes('CIRCULAR SPIGOT') || operation === 'Spigot Milling') {
          const bossMesh = new THREE.Mesh(new THREE.CylinderGeometry(20, 20, cutD + 0.5, 40), machinedMat);
          bossMesh.position.y = cutD / 2;
          group.add(bossMesh);
        } else if (tName.includes('RECTANGULAR SPIGOT')) {
          const bossMesh = new THREE.Mesh(new THREE.BoxGeometry(44, cutD + 0.5, 28), machinedMat);
          bossMesh.position.y = cutD / 2;
          group.add(bossMesh);
        }
      }

      const mapMillVec = (pt) => new THREE.Vector3(pt.x || 0, pt.z || 0, -(pt.y || 0));
      for (let i = 1; i < history.length; i++) {
        const p1 = mapMillVec(history[i - 1]);
        const p2 = mapMillVec(history[i]);
        const col = history[i].rapid ? 0xe11d48 : history[i].passType === 'finish' ? 0x0284c7 : 0x059669;
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([p1, p2]), new THREE.LineBasicMaterial({ color: col })));
      }

      const tip = mapMillVec(current);
      const cutterRad = Math.max(3, Number(mfgCfg.toolDia || 12) * 0.45);
      const fluteLen = Math.max(18, Number(mfgCfg.toolLength || 35) * 0.65);

      const cutterGroup = new THREE.Group();
      const fluteMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(cutterRad, cutterRad, fluteLen, 24),
        new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.75, roughness: 0.2 })
      );
      fluteMesh.position.y = fluteLen / 2;
      cutterGroup.add(fluteMesh);

      const holderMesh = new THREE.Mesh(new THREE.CylinderGeometry(cutterRad * 1.7, cutterRad * 1.3, 20, 24), chuckMat);
      holderMesh.position.y = fluteLen + 10;
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
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col justify-between h-full min-h-[610px]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
          <Box className="w-4 h-4" />
          <span>3D {operation} ({workSide}) Step-by-Step Sim</span>
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

      <div className="my-2 bg-slate-500 border border-slate-600 rounded-xl overflow-hidden relative shadow-inner">
        <div ref={mountRef} className="w-full h-[380px] cursor-grab active:cursor-grabbing" />

        <div className="absolute top-2 left-2.5 right-2.5 flex justify-between items-center text-[10px] font-mono bg-slate-900/85 text-slate-100 px-2.5 py-1 rounded border border-slate-700 pointer-events-none">
          <span className="font-bold">
            {domainKey === 'Turning'
              ? `Live OD: Ø${activeOD.toFixed(1)}mm ${activeID > 0 ? `| ID: Ø${activeID.toFixed(1)}mm` : ''} • RPM: ${playing ? 'ON' : 'STOP'}`
              : `Cut Depth: ${(current.cutDepth || 0).toFixed(1)} / ${mfgCfg.featureDepth || 10}mm`}
          </span>
          <span className="text-cyan-300">Drag: Rotate • Scroll: Zoom</span>
        </div>

        <div className="absolute bottom-2 left-2 right-2 flex flex-wrap items-center gap-2.5 text-[10px] font-mono bg-slate-900/85 text-slate-100 px-2.5 py-1 rounded-md border border-slate-700 pointer-events-none">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-slate-700 border border-slate-400"></span> Raw Stock</span>
          <span className="flex items-center gap-1 text-sky-300"><span className="w-2.5 h-2.5 rounded-sm bg-sky-500"></span> Machined</span>
          <span className="flex items-center gap-1 text-cyan-300"><span className="w-2.5 h-2.5 rounded-sm bg-cyan-500"></span> Turret</span>
          <span className="flex items-center gap-1 text-amber-300"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500"></span> Insert Tip</span>
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
