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

    if (operation === 'Drilling' || operation === 'Tapping') {
      const drillDia = operation === 'Tapping'
        ? Math.max(3, Number(mfgCfg.tapDia || 10) - Number(mfgCfg.tapPitch || 1.5))
        : Number(mfgCfg.drillDia || 16);
      const peck = Math.max(4, Number(mfgCfg.peckDepth || 10));
      moves.push({ x: 0, y: 0, z: 5, rapid: true, passType: 'rapid', curOD: rawOD, curID: 0, cutZ: 0, gcode: `G00 X0.0 Z5.0 (SPINDLE M03 ON)` });
      for (let d = -peck; d >= -Math.min(45, partLen); d -= peck) {
        const subSteps = 3;
        for (let s = 1; s <= subSteps; s++) {
          const zNow = (d * s) / subSteps;
          moves.push({ x: 0, y: 0, z: zNow, rapid: false, passType: 'rough', curOD: rawOD, curID: drillDia, cutZ: Math.abs(zNow), gcode: `G01 Z${zNow.toFixed(1)} F0.12 (${operation.toUpperCase()} Ø${drillDia.toFixed(1)})` });
        }
        moves.push({ x: 0, y: 0, z: 4, rapid: true, passType: 'rapid', curOD: rawOD, curID: drillDia, cutZ: Math.abs(d), gcode: `G00 Z4.0 (PECK CHIP BREAK)` });
      }
      moves.push({ x: 0, y: 0, z: 18, rapid: true, passType: 'rapid', curOD: rawOD, curID: drillDia, cutZ: Math.min(45, partLen), gcode: `G28 U0. W0. M05` });
    } else if (operation === 'Threading') {
      const majDia = Number(mfgCfg.threadMajorDia || 24);
      const minDia = Number(mfgCfg.threadMinorDia || 20.32);
      const baseOD = isID ? rawOD : majDia;
      const safeX = isID ? minDia - 6 : majDia + 6;
      const targetLen = Math.min(35, partLen - 5);
      const passRatios = [0.35, 0.65, 0.88, 1.0];
      passRatios.forEach((ratio, idx) => {
        const px = isID
          ? minDia + (majDia - minDia) * ratio
          : majDia - (majDia - minDia) * ratio;
        moves.push({ x: safeX, y: 0, z: 4, rapid: true, passType: 'rapid', curOD: baseOD, curID: isID ? minDia : 0, cutZ: 0, gcode: `G00 X${safeX.toFixed(1)} Z4.0 (PASS ${idx + 1}/4)` });
        moves.push({ x: px, y: 0, z: 4, rapid: true, passType: 'rapid', curOD: baseOD, curID: isID ? minDia : 0, cutZ: 0, gcode: `G00 X${px.toFixed(3)}` });
        for (let s = 1; s <= 5; s++) {
          const zStep = -(targetLen * s) / 5;
          moves.push({ x: px, y: 0, z: zStep, rapid: false, passType: idx === 3 ? 'finish' : 'rough', curOD: baseOD, curID: isID ? minDia : 0, cutZ: Math.abs(zStep), gcode: `G76 X${px.toFixed(3)} Z${zStep.toFixed(1)} F${mfgCfg.threadPitch || 3.0}` });
        }
        moves.push({ x: safeX, y: 0, z: -targetLen, rapid: true, passType: 'rapid', curOD: baseOD, curID: isID ? minDia : 0, cutZ: targetLen, gcode: `G00 X${safeX.toFixed(1)} (RETRACT)` });
      });
      moves.push({ x: safeX, y: 0, z: 16, rapid: true, passType: 'rapid', curOD: baseOD, curID: isID ? minDia : 0, cutZ: targetLen, gcode: `G28 U0. W0. M05` });
    } else if (isFace) {
      [-0.8, -1.6, -2.4].forEach((fz, idx) => {
        moves.push({ x: rawOD + 3, y: 0, z: fz, rapid: true, passType: 'rapid', curOD: rawOD, curID: isID ? rawID : 0, cutZ: Math.abs(fz), gcode: `G00 X${(rawOD + 3).toFixed(1)} Z${fz}` });
        for (let s = 1; s <= 4; s++) {
          const xStep = rawOD - ((rawOD - (isID ? rawID : 0)) * s) / 4;
          moves.push({ x: xStep, y: 0, z: fz, rapid: false, passType: idx === 2 ? 'finish' : 'rough', curOD: rawOD, curID: isID ? rawID : 0, cutZ: Math.abs(fz), gcode: `G01 X${xStep.toFixed(1)} Z${fz} F0.15` });
        }
        moves.push({ x: rawOD + 3, y: 0, z: fz + 2, rapid: true, passType: 'rapid', curOD: rawOD, curID: isID ? rawID : 0, cutZ: Math.abs(fz), gcode: `G00 X${(rawOD + 3).toFixed(1)} Z${(fz + 2).toFixed(1)}` });
      });
      moves.push({ x: rawOD + 8, y: 0, z: 16, rapid: true, passType: 'rapid', curOD: rawOD, curID: isID ? rawID : 0, cutZ: 2.4, gcode: `G28 U0. W0. M05` });
    } else if (operation === 'Grooving' || operation === 'Parting') {
      const cutZ = -Math.min(28, partLen - 5);
      const targetX = operation === 'Parting' ? 0 : isID ? finOD + 6 : Math.max(12, finOD - 6);
      const startX = isID ? finOD - 4 : rawOD + 2;
      moves.push({ x: startX, y: 0, z: cutZ, rapid: true, passType: 'rapid', curOD: rawOD, curID: isID ? rawID : 0, cutZ: 0, gcode: `G00 X${startX.toFixed(1)} Z${cutZ}` });
      for (let s = 1; s <= 5; s++) {
        const curX = startX + ((targetX - startX) * s) / 5;
        moves.push({ x: curX, y: 0, z: cutZ, rapid: false, passType: 'rough', curOD: rawOD, curID: isID ? rawID : 0, cutZ: 4, gcode: `G01 X${curX.toFixed(1)} F0.08 (${operation.toUpperCase()})` });
      }
      moves.push({ x: startX, y: 0, z: cutZ, rapid: true, passType: 'rapid', curOD: rawOD, curID: isID ? rawID : 0, cutZ: 4, gcode: `G00 X${startX.toFixed(1)}` });
      moves.push({ x: startX + 4, y: 0, z: 16, rapid: true, passType: 'rapid', curOD: rawOD, curID: isID ? rawID : 0, cutZ: 4, gcode: `G28 U0. W0. M05` });
    } else if (isID) {
      let activeID = Math.max(10, rawID);
      const targetZ = Math.max(10, partLen - lenStock);
      if (stage.includes('Rough')) {
        const totalStock = Math.max(2, finOD - diaStock - activeID);
        const passes = 3;
        const step = totalStock / passes;
        for (let p = 1; p <= passes; p++) {
          const px = activeID + step * p;
          moves.push({ x: rawID - 2, y: 0, z: 2, rapid: true, passType: 'rapid', curOD: rawOD, curID: px - step, cutZ: 0, gcode: `G00 X${(rawID - 2).toFixed(1)} Z2.0 (PASS ${p})` });
          moves.push({ x: px, y: 0, z: 2, rapid: true, passType: 'rapid', curOD: rawOD, curID: px - step, cutZ: 0, gcode: `G00 X${px.toFixed(2)}` });
          for (let s = 1; s <= 5; s++) {
            const zProg = (targetZ * s) / 5;
            moves.push({ x: px, y: 0, z: -zProg, rapid: false, passType: 'rough', curOD: rawOD, curID: px, cutZ: zProg, gcode: `G01 X${px.toFixed(2)} Z-${zProg.toFixed(1)} F0.22` });
          }
          moves.push({ x: rawID - 2, y: 0, z: -targetZ, rapid: true, passType: 'rapid', curOD: rawOD, curID: px, cutZ: targetZ, gcode: `G00 X${(rawID - 2).toFixed(1)} (RETRACT)` });
        }
        activeID = finOD - diaStock;
      }
      if (stage.includes('Finish') || stage.includes('Combined')) {
        moves.push({ x: finOD, y: 0, z: 2, rapid: true, passType: 'rapid', curOD: rawOD, curID: activeID, cutZ: 0, gcode: `G00 X${finOD.toFixed(2)} Z2.0 (FINISH PASS)` });
        for (let s = 1; s <= 5; s++) {
          const zProg = (partLen * s) / 5;
          moves.push({ x: finOD, y: 0, z: -zProg, rapid: false, passType: 'finish', curOD: rawOD, curID: finOD, cutZ: zProg, gcode: `G41 G01 X${finOD.toFixed(2)} Z-${zProg.toFixed(1)} F0.12` });
        }
        activeID = finOD;
      }
      if (stage.includes('Chamfer')) {
        moves.push({ x: finOD + chamfSize * 2, y: 0, z: 1, rapid: true, passType: 'rapid', curOD: rawOD, curID: activeID, cutZ: partLen, gcode: `G00 X${(finOD + chamfSize * 2).toFixed(1)} Z1.0` });
        moves.push({ x: finOD, y: 0, z: -chamfSize, rapid: false, passType: 'chamfer', curOD: rawOD, curID: activeID, cutZ: partLen, gcode: `G01 X${finOD.toFixed(1)} Z-${chamfSize} F0.10` });
      }
      moves.push({ x: rawID - 2, y: 0, z: 18, rapid: true, passType: 'rapid', curOD: rawOD, curID: activeID, cutZ: partLen, gcode: `G40 G28 U0. W0. M05` });
    } else {
      // OD TURNING (Progressive step-by-step Z cutting)
      let activeOD = rawOD;
      const targetZ = Math.max(10, partLen - lenStock);
      if (stage.includes('Rough')) {
        const totalStock = Math.max(2, rawOD - (finOD + diaStock));
        const passes = 3;
        const step = totalStock / passes;
        for (let p = 1; p <= passes; p++) {
          const px = rawOD - step * p;
          moves.push({ x: activeOD + 3, y: 0, z: 2, rapid: true, passType: 'rapid', curOD: activeOD, curID: 0, cutZ: 0, gcode: `G00 X${(activeOD + 3).toFixed(1)} Z2.0 (ROUGH PASS ${p})` });
          moves.push({ x: px, y: 0, z: 2, rapid: true, passType: 'rapid', curOD: activeOD, curID: 0, cutZ: 0, gcode: `G00 X${px.toFixed(2)}` });
          for (let s = 1; s <= 5; s++) {
            const zProg = (targetZ * s) / 5;
            moves.push({ x: px, y: 0, z: -zProg, rapid: false, passType: 'rough', curOD: px, curID: 0, cutZ: zProg, gcode: `G01 X${px.toFixed(2)} Z-${zProg.toFixed(1)} F0.25` });
          }
          activeOD = px;
          moves.push({ x: px + 3, y: 0, z: -targetZ + 1, rapid: true, passType: 'rapid', curOD: activeOD, curID: 0, cutZ: targetZ, gcode: `G00 X${(px + 3).toFixed(1)} (RETRACT)` });
        }
      }
      if (stage.includes('Finish') || stage.includes('Combined')) {
        moves.push({ x: finOD, y: 0, z: 2, rapid: true, passType: 'rapid', curOD: activeOD, curID: 0, cutZ: 0, gcode: `G00 X${finOD.toFixed(2)} Z2.0 (FINISH PASS)` });
        for (let s = 1; s <= 5; s++) {
          const zProg = (partLen * s) / 5;
          moves.push({ x: finOD, y: 0, z: -zProg, rapid: false, passType: 'finish', curOD: finOD, curID: 0, cutZ: zProg, gcode: `G42 G01 X${finOD.toFixed(2)} Z-${zProg.toFixed(1)} F0.12` });
        }
        activeOD = finOD;
      }
      if (stage.includes('Chamfer')) {
        moves.push({ x: finOD - chamfSize * 2, y: 0, z: 1, rapid: true, passType: 'rapid', curOD: activeOD, curID: 0, cutZ: partLen, gcode: `G00 X${(finOD - chamfSize * 2).toFixed(1)} Z1.0` });
        moves.push({ x: finOD, y: 0, z: -chamfSize, rapid: false, passType: 'chamfer', curOD: activeOD, curID: 0, cutZ: partLen, gcode: `G01 X${finOD.toFixed(1)} Z-${chamfSize} F0.10` });
      }
      moves.push({ x: rawOD + 8, y: 0, z: 18, rapid: true, passType: 'rapid', curOD: activeOD, curID: 0, cutZ: partLen, gcode: `G40 G28 U0. W0. M05` });
    }
  } else {
    const isCircPocket = tName.includes('CIRCULAR POCKET') || operation === 'Pocket Milling';
    const isRectPocket = tName.includes('RECTANGULAR POCKET');
    const isCircSpigot = tName.includes('CIRCULAR SPIGOT') || operation === 'Spigot Milling';
    const isRectSpigot = tName.includes('RECTANGULAR SPIGOT');

    const circlePts = (r, steps = 16) => {
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

    if (isCircPocket || isRectPocket || isCircSpigot || isRectSpigot) {
      const isPocket = isCircPocket || isRectPocket;
      const isCirc = !isRectPocket && !isRectSpigot;
      let curCutDepth = 0;

      if (stage.includes('Rough')) {
        const roughZ = -(depth - btmAllow);
        if (isPocket) {
          moves.push({ x: 0, y: 0, z: 6, rapid: true, passType: 'rapid', cutDepth: 0, gcode: 'G43 H01 G00 X0.0 Y0.0 Z6.0' });
          curCutDepth = Math.abs(roughZ);
          moves.push({ x: 0, y: 0, z: roughZ, rapid: false, passType: 'rough', cutDepth: curCutDepth, gcode: `G01 Z${roughZ.toFixed(2)} F200.0` });
          if (isCirc) {
            [11, Math.max(15, 22 - wallAllow * 2)].forEach((rad, ri) => {
              const pts = circlePts(rad, 14);
              pts.forEach((p) => moves.push({ x: p.x, y: p.y, z: roughZ, rapid: false, passType: 'rough', cutDepth: curCutDepth, cutRad: rad, gcode: `G03 X${p.x} Y${p.y} R${rad} (RING ${ri + 1})` }));
            });
          } else {
            [{ w: 13, h: 9 }, { w: 26 - wallAllow, h: 16 - wallAllow }].forEach((bx, bi) => {
              const pts = rectPts(bx.w, bx.h);
              pts.forEach((p) => moves.push({ x: p.x, y: p.y, z: roughZ, rapid: false, passType: 'rough', cutDepth: curCutDepth, cutW: bx.w, cutH: bx.h, gcode: `G01 X${p.x} Y${p.y} (PASS ${bi + 1})` }));
            });
          }
        } else {
          moves.push({ x: -34, y: 0, z: 6, rapid: true, passType: 'rapid', cutDepth: 0, gcode: 'G43 H01 G00 X-34.0 Y0.0 Z6.0' });
          curCutDepth = Math.abs(roughZ);
          moves.push({ x: -34, y: 0, z: roughZ, rapid: false, passType: 'rough', cutDepth: curCutDepth, gcode: `G01 Z${roughZ.toFixed(2)} F200.0` });
          if (isCirc) {
            [30, 20 + wallAllow * 2].forEach((rad) => {
              const pts = circlePts(rad, 14);
              pts.forEach((p) => moves.push({ x: p.x, y: p.y, z: roughZ, rapid: false, passType: 'rough', cutDepth: curCutDepth, cutRad: rad, gcode: `G02 X${p.x} Y${p.y} R${rad}` }));
            });
          } else {
            [{ w: 32, h: 22 }, { w: 22 + wallAllow, h: 14 + wallAllow }].forEach((bx) => {
              const pts = rectPts(bx.w, bx.h);
              pts.forEach((p) => moves.push({ x: p.x, y: p.y, z: roughZ, rapid: false, passType: 'rough', cutDepth: curCutDepth, cutW: bx.w, cutH: bx.h, gcode: `G01 X${p.x} Y${p.y}` }));
            });
          }
        }
      }

      if (stage.includes('Finish') || stage.includes('Combined')) {
        const finZ = stage === 'Wall Finish Only' ? -(depth - btmAllow) : -depth;
        curCutDepth = Math.abs(finZ);
        const wallPts = isCirc
          ? circlePts(isPocket ? 22 : 20, 16)
          : rectPts(isPocket ? 26 : 22, isPocket ? 16 : 14);
        wallPts.forEach((p) => moves.push({ x: p.x, y: p.y, z: finZ, rapid: false, passType: 'finish', cutDepth: curCutDepth, cutRad: isPocket ? 22 : 20, cutW: isPocket ? 26 : 22, cutH: isPocket ? 16 : 14, gcode: `${mfgCfg.compMode?.slice(0, 3) || 'G41'} G01 X${p.x} Y${p.y} Z${finZ.toFixed(1)}` }));
      }

      if (stage.includes('Chamfer')) {
        const chZ = -chamfSize;
        const chPts = isCirc
          ? circlePts(isPocket ? 22.5 : 19.5, 16)
          : rectPts(isPocket ? 26.5 : 21.5, isPocket ? 16.5 : 13.5);
        chPts.forEach((p) => moves.push({ x: p.x, y: p.y, z: chZ, rapid: false, passType: 'chamfer', cutDepth: curCutDepth, gcode: `CHAMFER C${chamfSize} X${p.x} Y${p.y}` }));
      }

      moves.push({ x: 0, y: 0, z: 25, rapid: true, passType: 'rapid', cutDepth: curCutDepth, gcode: 'G40 G00 Z25.0 M05' });
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
    }, Math.max(90, Math.round(480 / speed)));
    return () => clearInterval(timer);
  }, [playing, moves, speed]);

  // Initialize Clean LIGHT STUDIO WebGL 3D Engine
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 400;
    const height = 370;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#e2e8f0'); // Clean Light CAD Studio Background

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(125, 92, 138);
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
    controlsRef.current = controls;

    // Bright CAD Studio Three-Point Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    keyLight.position.set(140, 200, 160);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xbae6fd, 0.7);
    fillLight.position.set(-140, 60, -120);
    scene.add(fillLight);

    // Light Studio Reference Floor Grid
    const grid = new THREE.GridHelper(240, 24, 0x94a3b8, 0xcbd5e1);
    grid.position.y = -48;
    scene.add(grid);

    const dynGroup = new THREE.Group();
    scene.add(dynGroup);
    dynamicGroupRef.current = dynGroup;

    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      // Continuous Live RPM Rotation of Chuck & Workpiece when Playing!
      if (playingRef.current && spindleGroupRef.current) {
        spindleGroupRef.current.rotation.y += 0.14 * speedRef.current;
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
    ctrl.target.set(0, 0, 0);
    if (view === 'iso') cam.position.set(125, 92, 138);
    else if (view === 'top') cam.position.set(0, 195, 0.1);
    else if (view === 'front') cam.position.set(0, 12, 195);
    else if (view === 'side') cam.position.set(195, 12, 0);
    ctrl.update();
  };

  const adjustZoom = (factor) => {
    const cam = cameraRef.current;
    if (cam) cam.position.multiplyScalar(factor);
  };

  // Build 3D Chuck, Workpiece, Jyoti Turret & Operation-Specific Insert
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

    // High-Contrast Metallic Materials for Light CAD Studio Theme
    const chuckMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.78,
      roughness: 0.28,
      clippingPlanes: planes,
      side: THREE.DoubleSide
    });
    const jawMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.85,
      roughness: 0.22,
      clippingPlanes: planes
    });
    const rawStockMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.65,
      roughness: 0.32,
      clippingPlanes: planes,
      side: THREE.DoubleSide
    });
    const machinedMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      metalness: 0.55,
      roughness: 0.18,
      clippingPlanes: planes,
      side: THREE.DoubleSide
    });
    const boreMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.4,
      roughness: 0.4,
      clippingPlanes: planes,
      side: THREE.DoubleSide
    });

    if (domainKey === 'Turning') {
      const rawOD = Number(mfgCfg.stockX || 50);
      const partLen = Math.max(12, Number(mfgCfg.stockZ || 45));
      const stickout = Math.min(72, Math.max(38, Number(mfgCfg.chuckStickout || 65) * 0.85));
      const activeOD = current.curOD ?? rawOD;
      const activeID = current.curID ?? (workSide === 'ID' ? Number(mfgCfg.rawIdDia || 20) : 0);
      const cutRatio = Math.min(1, Math.max(0, (current.cutZ || 0) / partLen));
      const cutLen = cutRatio * (stickout * 0.85);
      const uncutLen = Math.max(0.5, stickout - cutLen);

      const rawRad = 27;
      const machRad = Math.max(7, (activeOD / Math.max(10, rawOD)) * rawRad);
      const boreRad = activeID > 0 ? Math.min(machRad - 2, Math.max(4, (activeID / Math.max(10, rawOD)) * rawRad)) : 0;

      // Orientation Wrapper: Horizontal Lathe (-X Chuck -> +X Face) vs VTL (-Y Table -> +Y Face)
      const orientGroup = new THREE.Group();
      if (!isVTL) {
        orientGroup.rotation.z = -Math.PI / 2;
      }

      // Rotating Spindle Group (Chuck + Jaws + Workpiece spin together with RPM!)
      const spindleGroup = new THREE.Group();
      spindleGroupRef.current = spindleGroup;

      // 1. Heavy 3-Jaw Chuck Body
      const chuckGeo = new THREE.CylinderGeometry(rawRad + 12, rawRad + 12, 22, 48);
      const chuckMesh = new THREE.Mesh(chuckGeo, chuckMat);
      chuckMesh.position.y = -stickout / 2 - 11;
      spindleGroup.add(chuckMesh);

      // 3 Chuck Jaws (Makes RPM rotation unmistakably visible!)
      for (let j = 0; j < 3; j++) {
        const ang = (j * Math.PI * 2) / 3;
        const jawGeo = new THREE.BoxGeometry(9, 13, 14);
        const jawMesh = new THREE.Mesh(jawGeo, jawMat);
        jawMesh.position.set(Math.cos(ang) * (rawRad + 3), -stickout / 2 + 4.5, Math.sin(ang) * (rawRad + 3));
        jawMesh.rotation.y = -ang;
        spindleGroup.add(jawMesh);
      }

      // 2. Uncut Raw Stock Portion
      const rawGeo = new THREE.CylinderGeometry(rawRad, rawRad, uncutLen, 48);
      const rawMesh = new THREE.Mesh(rawGeo, rawStockMat);
      rawMesh.position.y = -stickout / 2 + uncutLen / 2;
      spindleGroup.add(rawMesh);

      // 3. Machined Reduced OD Portion (Stepped Bright Blue Metallic Finish)
      if (cutLen > 0.3) {
        const machGeo = new THREE.CylinderGeometry(machRad, machRad, cutLen, 48);
        const machMesh = new THREE.Mesh(machGeo, machinedMat);
        machMesh.position.y = stickout / 2 - cutLen / 2;
        spindleGroup.add(machMesh);
      }

      // 4. Inner Bore Cavity
      if (boreRad > 1) {
        const boreDepth = Math.max(6, cutLen);
        const boreGeo = new THREE.CylinderGeometry(boreRad, boreRad, boreDepth + 0.4, 36);
        const boreMesh = new THREE.Mesh(boreGeo, boreMat);
        boreMesh.position.y = stickout / 2 - boreDepth / 2 + 0.2;
        spindleGroup.add(boreMesh);
      }

      orientGroup.add(spindleGroup);
      group.add(orientGroup);

      // Map Tool Tip Position in 3D
      const mapTurnVec = (pt) => {
        const zNorm = ((pt.z || 0) / partLen) * (stickout * 0.85);
        const rad = ((pt.x || 0) / Math.max(10, rawOD)) * rawRad;
        if (isVTL) {
          return new THREE.Vector3(rad, stickout / 2 + zNorm, 0);
        }
        return new THREE.Vector3(stickout / 2 + zNorm, rad, 0);
      };

      // Toolpath Trajectory Lines
      for (let i = 1; i < history.length; i++) {
        const p1 = mapTurnVec(history[i - 1]);
        const p2 = mapTurnVec(history[i]);
        const col = history[i].rapid ? 0xe11d48 : history[i].passType === 'finish' ? 0x0284c7 : 0x059669;
        const lineGeo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
        group.add(new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: col })));
      }

      // JYOTI CNC TURRET + PROPER TOOL ORIENTATION + OPERATION-SPECIFIC INSERT
      const tip = mapTurnVec(current);
      const turretAssembly = new THREE.Group();

      const turretBodyMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.75, roughness: 0.3 });
      const jyotiCyanMat = new THREE.MeshStandardMaterial({ color: 0x0891b2, metalness: 0.5, roughness: 0.25 });
      const holderMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.82, roughness: 0.25 });
      const goldInsertMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0x92400e, metalness: 0.65, roughness: 0.18 });

      const isFacingOp = operation === 'Facing' || workSide === 'Face';
      const isBoringOp = workSide === 'ID' || operation === 'Boring';
      const isDrillOrTap = operation === 'Drilling' || operation === 'Tapping';

      if (isVTL) {
        if (isFacingOp) {
          // VTL Horizontal Facing Arm coming from right side
          const shank = new THREE.Mesh(new THREE.BoxGeometry(36, 7, 7), holderMat);
          shank.position.set(18, 0, 0);
          turretAssembly.add(shank);

          const turretDrum = new THREE.Mesh(new THREE.CylinderGeometry(16, 16, 18, 8), turretBodyMat);
          turretDrum.rotation.x = Math.PI / 2;
          turretDrum.position.set(42, 0, 0);
          turretAssembly.add(turretDrum);

          const accentRing = new THREE.Mesh(new THREE.CylinderGeometry(16.4, 16.4, 4, 8), jyotiCyanMat);
          accentRing.rotation.x = Math.PI / 2;
          accentRing.position.set(42, 0, 0);
          turretAssembly.add(accentRing);
        } else {
          // VTL Vertical Heavy Ram & Turret coming straight down from top (+Y)
          const shank = new THREE.Mesh(new THREE.BoxGeometry(7, 36, 7), holderMat);
          shank.position.set(0, 18, 0);
          turretAssembly.add(shank);

          const ramHead = new THREE.Mesh(new THREE.BoxGeometry(24, 26, 24), turretBodyMat);
          ramHead.position.set(0, 48, 0);
          turretAssembly.add(ramHead);

          const jyotiBand = new THREE.Mesh(new THREE.BoxGeometry(25, 5, 25), jyotiCyanMat);
          jyotiBand.position.set(0, 38, 0);
          turretAssembly.add(jyotiBand);
        }
      } else {
        // Horizontal Turning Lathe (Jyoti DX / AX / Tachyon):
        if (isBoringOp || isDrillOrTap) {
          // Axial Boring Bar / Drill pointing horizontally into +X -> -X spindle
          const bar = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 38, 20), holderMat);
          bar.rotation.z = Math.PI / 2;
          bar.position.set(19, 0, 0);
          turretAssembly.add(bar);

          const turretOct = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 16, 8), turretBodyMat);
          turretOct.rotation.x = Math.PI / 2;
          turretOct.position.set(46, 6, 0);
          turretAssembly.add(turretOct);

          const jyotiBand = new THREE.Mesh(new THREE.CylinderGeometry(18.4, 18.4, 4, 8), jyotiCyanMat);
          jyotiBand.rotation.x = Math.PI / 2;
          jyotiBand.position.set(46, 6, 0);
          turretAssembly.add(jyotiBand);
        } else {
          // Radial Turning Tool Holder pointing vertically down onto OD (90 deg to spindle axis, NO slant!)
          const shank = new THREE.Mesh(new THREE.BoxGeometry(7, 32, 7), holderMat);
          shank.position.set(0, 16, 0);
          turretAssembly.add(shank);

          // Jyoti Octagonal 8-Station BMT Turret Disc mounted above tool
          const turretOct = new THREE.Mesh(new THREE.CylinderGeometry(19, 19, 16, 8), turretBodyMat);
          turretOct.rotation.x = Math.PI / 2;
          turretOct.position.set(6, 44, 0);
          turretAssembly.add(turretOct);

          const jyotiBand = new THREE.Mesh(new THREE.CylinderGeometry(19.4, 19.4, 4.5, 8), jyotiCyanMat);
          jyotiBand.rotation.x = Math.PI / 2;
          jyotiBand.position.set(6, 44, 0);
          turretAssembly.add(jyotiBand);
        }
      }

      // Operation-Specific Insert Geometry at Tip (0,0,0)
      if (operation === 'Threading') {
        // 60-degree Sharp V-Thread Insert
        const vInsert = new THREE.Mesh(new THREE.ConeGeometry(3.8, 8, 3), goldInsertMat);
        vInsert.rotation.z = isVTL && isFacingOp ? Math.PI / 2 : Math.PI;
        vInsert.position.set(isVTL && isFacingOp ? 3 : 0, isVTL && isFacingOp ? 0 : 3, 0);
        turretAssembly.add(vInsert);
      } else if (operation === 'Grooving' || operation === 'Parting') {
        // Thin Blade Grooving / Parting Insert
        const blade = new THREE.Mesh(new THREE.BoxGeometry(1.8, 9, 4.5), goldInsertMat);
        blade.position.set(0, 3.5, 0);
        turretAssembly.add(blade);
      } else if (isDrillOrTap) {
        // Drill / Tap Tip Cone
        const drillTip = new THREE.Mesh(new THREE.ConeGeometry(3.5, 10, 16), goldInsertMat);
        drillTip.rotation.z = isVTL ? Math.PI : Math.PI / 2;
        drillTip.position.set(isVTL ? 0 : 4, isVTL ? 4 : 0, 0);
        turretAssembly.add(drillTip);
      } else {
        // Standard CNMG / CCMT Diamond Carbide Insert
        const diamond = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 2.2, 4), goldInsertMat);
        diamond.rotation.x = Math.PI / 2;
        diamond.position.set(0, 2, 0);
        turretAssembly.add(diamond);
      }

      turretAssembly.position.copy(tip);
      group.add(turretAssembly);
    } else {
      // MILLING 3D SOLID WORKPIECE BLOCK
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
      {/* Dark Header + Playback & Multi-Speed Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
          <Box className="w-4 h-4" />
          <span>3D Jyoti CAD/CAM Simulator ({isVTL ? 'VTL' : domainKey})</span>
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

      {/* Camera Views, Zoom & Half-Cut Toolbar */}
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

      {/* LIGHT STUDIO THEME 3D VIEWPORT */}
      <div className="my-2 bg-slate-200 border border-slate-400 rounded-xl overflow-hidden relative shadow-inner">
        <div ref={mountRef} className="w-full h-[370px] cursor-grab active:cursor-grabbing" />

        <div className="absolute top-2 left-2.5 right-2.5 flex justify-between items-center text-[10px] font-mono bg-white/90 text-slate-800 px-2.5 py-1 rounded border border-slate-300 shadow-sm pointer-events-none">
          <span className="font-bold">
            {domainKey === 'Turning'
              ? `Live OD: Ø${activeOD.toFixed(1)}mm ${activeID > 0 ? `| ID: Ø${activeID.toFixed(1)}mm` : ''} • RPM: ${playing ? 'ON' : 'STOP'}`
              : `Cut Depth: ${(current.cutDepth || 0).toFixed(1)} / ${mfgCfg.featureDepth || 10}mm`}
          </span>
          <span className="text-sky-700 font-semibold">Drag: Rotate • Scroll: Zoom</span>
        </div>

        <div className="absolute bottom-2 left-2 right-2 flex flex-wrap items-center gap-2.5 text-[10px] font-mono bg-white/90 text-slate-800 px-2.5 py-1 rounded-md border border-slate-300 shadow-sm pointer-events-none">
          <span className="flex items-center gap-1 font-semibold"><span className="w-2.5 h-2.5 rounded-sm bg-slate-500"></span> Raw Stock</span>
          <span className="flex items-center gap-1 font-semibold text-sky-700"><span className="w-2.5 h-2.5 rounded-sm bg-sky-600"></span> Machined</span>
          <span className="flex items-center gap-1 font-semibold text-amber-700"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500"></span> Insert</span>
          <span className="flex items-center gap-1 font-semibold text-rose-600"><span className="w-2.5 h-0.5 bg-rose-600"></span> Rapid</span>
        </div>
      </div>

      {/* Dark Live G-Code Step & Coordinate Readout */}
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
