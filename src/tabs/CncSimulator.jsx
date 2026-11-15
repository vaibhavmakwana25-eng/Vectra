import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Play, Pause, RotateCcw, Box, ZoomIn, ZoomOut, Scissors } from 'lucide-react';

function parseToolpath(domainKey, workSide, operation, templateName = '', mfgCfg = {}) {
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
    const partLen = Number(mfgCfg.stockZ || 45);
    const rawID = Number(mfgCfg.rawIdDia || 20);
    const isID = workSide === 'ID';
    const isFace = workSide === 'Face' || operation === 'Facing';

    if (operation === 'Drilling' || operation === 'Tapping') {
      const drillDia = operation === 'Tapping'
        ? Math.max(2, Number(mfgCfg.tapDia || 10) - Number(mfgCfg.tapPitch || 1.5))
        : Number(mfgCfg.drillDia || 16);
      const peck = Math.max(4, Number(mfgCfg.peckDepth || 10));
      moves.push({ x: 0, y: 0, z: 4, rapid: true, passType: 'rapid', curOD: rawOD, curID: 0, cutZ: 0, label: `G00 X0.0 Z4.0 (${operation} Ø${drillDia.toFixed(1)}MM)` });
      for (let d = -peck; d >= -Math.min(45, partLen); d -= peck) {
        moves.push({ x: 0, y: 0, z: d, rapid: false, passType: 'rough', curOD: rawOD, curID: drillDia, cutZ: Math.abs(d), label: `${operation.toUpperCase()} Z${d}.0` });
        moves.push({ x: 0, y: 0, z: 4, rapid: true, passType: 'rapid', curOD: rawOD, curID: drillDia, cutZ: Math.abs(d), label: 'G00 Z4.0 RETRACT' });
      }
      moves.push({ x: 0, y: 0, z: 15, rapid: true, passType: 'rapid', curOD: rawOD, curID: drillDia, cutZ: Math.min(45, partLen), label: 'G00 HOME' });
    } else if (operation === 'Threading') {
      const majDia = Number(mfgCfg.threadMajorDia || 24);
      const minDia = Number(mfgCfg.threadMinorDia || 20.32);
      const safeX = isID ? minDia - 6 : majDia + 6;
      const targetLen = Math.min(35, partLen - 5);
      const passRatios = [0.4, 0.7, 0.9, 1.0];
      passRatios.forEach((ratio, idx) => {
        const px = isID
          ? minDia + (majDia - minDia) * ratio
          : majDia - (majDia - minDia) * ratio;
        moves.push({ x: safeX, y: 0, z: 4, rapid: true, passType: 'rapid', curOD: isID ? rawOD : majDia, curID: isID ? minDia : 0, cutZ: 0, label: `THREAD PASS ${idx + 1}/4` });
        moves.push({ x: px, y: 0, z: 4, rapid: true, passType: 'rapid', curOD: isID ? rawOD : majDia, curID: isID ? minDia : 0, cutZ: 0, label: `G00 X${px.toFixed(2)}` });
        for (let s = 1; s <= 4; s++) {
          const zStep = -(targetLen * s) / 4;
          moves.push({ x: px, y: 0, z: zStep, rapid: false, passType: idx === 3 ? 'finish' : 'rough', curOD: isID ? rawOD : majDia, curID: isID ? minDia : 0, cutZ: Math.abs(zStep), isThread: true, label: `G76 X${px.toFixed(2)} Z${zStep.toFixed(1)}` });
        }
        moves.push({ x: safeX, y: 0, z: -targetLen, rapid: true, passType: 'rapid', curOD: isID ? rawOD : majDia, curID: isID ? minDia : 0, cutZ: targetLen, label: 'G00 RETRACT' });
      });
      moves.push({ x: safeX, y: 0, z: 12, rapid: true, passType: 'rapid', curOD: isID ? rawOD : majDia, curID: isID ? minDia : 0, cutZ: targetLen, label: 'THREADING COMPLETE' });
    } else if (isFace) {
      [-1.0, -2.0, -3.0].forEach((fz, idx) => {
        moves.push({ x: rawOD + 2, y: 0, z: fz, rapid: true, passType: 'rapid', curOD: rawOD, curID: isID ? rawID : 0, cutZ: 0, label: `FACE PASS ${idx + 1} Z${fz}` });
        moves.push({ x: rawOD / 2, y: 0, z: fz, rapid: false, passType: idx === 2 ? 'finish' : 'rough', curOD: rawOD, curID: isID ? rawID : 0, cutZ: Math.abs(fz), label: `FACING X${(rawOD / 2).toFixed(1)} Z${fz}` });
        moves.push({ x: isID ? rawID : -1, y: 0, z: fz, rapid: false, passType: idx === 2 ? 'finish' : 'rough', curOD: rawOD, curID: isID ? rawID : 0, cutZ: Math.abs(fz), label: `FACING CENTER Z${fz}` });
        moves.push({ x: rawOD + 2, y: 0, z: fz + 1.5, rapid: true, passType: 'rapid', curOD: rawOD, curID: isID ? rawID : 0, cutZ: Math.abs(fz), label: 'G00 RETRACT' });
      });
      moves.push({ x: rawOD + 6, y: 0, z: 12, rapid: true, passType: 'rapid', curOD: rawOD, curID: isID ? rawID : 0, cutZ: 3, label: 'G00 HOME' });
    } else if (operation === 'Grooving' || operation === 'Parting') {
      const cutZ = -Math.min(30, partLen - 5);
      const targetX = operation === 'Parting' ? 0 : isID ? finOD + 6 : Math.max(12, finOD - 6);
      const startX = isID ? finOD - 4 : rawOD + 2;
      moves.push({ x: startX, y: 0, z: cutZ, rapid: true, passType: 'rapid', curOD: rawOD, curID: isID ? rawID : 0, cutZ: 0, label: `G00 X${startX} Z${cutZ}` });
      for (let s = 1; s <= 4; s++) {
        const curX = startX + ((targetX - startX) * s) / 4;
        moves.push({ x: curX, y: 0, z: cutZ, rapid: false, passType: 'rough', curOD: rawOD, curID: isID ? rawID : 0, cutZ: 4, label: `${operation.toUpperCase()} X${curX.toFixed(1)}` });
      }
      moves.push({ x: startX, y: 0, z: cutZ, rapid: true, passType: 'rapid', curOD: rawOD, curID: isID ? rawID : 0, cutZ: 4, label: 'G00 RETRACT' });
      moves.push({ x: startX, y: 0, z: 12, rapid: true, passType: 'rapid', curOD: rawOD, curID: isID ? rawID : 0, cutZ: 4, label: 'G00 HOME' });
    } else if (isID) {
      let activeID = Math.max(10, rawID);
      const targetZ = Math.max(10, partLen - lenStock);
      if (stage.includes('Rough')) {
        const step = Math.max(2, (finOD - diaStock - activeID) / 3);
        for (let px = activeID + step; px <= finOD - diaStock + 0.01; px += step) {
          moves.push({ x: activeID - 2, y: 0, z: 2, rapid: true, passType: 'rapid', curOD: rawOD, curID: activeID, cutZ: 0, label: `ID ROUGH APPROACH X${px.toFixed(1)}` });
          moves.push({ x: px, y: 0, z: 2, rapid: true, passType: 'rapid', curOD: rawOD, curID: activeID, cutZ: 0, label: `G00 X${px.toFixed(1)}` });
          for (let s = 1; s <= 4; s++) {
            const zProg = (targetZ * s) / 4;
            moves.push({ x: px, y: 0, z: -zProg, rapid: false, passType: 'rough', curOD: rawOD, curID: px, cutZ: zProg, label: `ID ROUGH X${px.toFixed(1)} Z-${zProg.toFixed(1)}` });
          }
          activeID = px;
          moves.push({ x: rawID - 2, y: 0, z: -targetZ, rapid: true, passType: 'rapid', curOD: rawOD, curID: activeID, cutZ: targetZ, label: 'G00 RETRACT' });
        }
      }
      if (stage.includes('Finish') || stage.includes('Combined')) {
        moves.push({ x: finOD, y: 0, z: 2, rapid: true, passType: 'rapid', curOD: rawOD, curID: activeID, cutZ: 0, label: `ID FINISH G41/G42 X${finOD}` });
        for (let s = 1; s <= 4; s++) {
          const zProg = (partLen * s) / 4;
          moves.push({ x: finOD, y: 0, z: -zProg, rapid: false, passType: 'finish', curOD: rawOD, curID: finOD, cutZ: zProg, label: `FINISH BORE X${finOD} Z-${zProg.toFixed(1)}` });
        }
        activeID = finOD;
      }
      if (stage.includes('Chamfer')) {
        moves.push({ x: finOD + chamfSize * 2, y: 0, z: 1, rapid: true, passType: 'rapid', curOD: rawOD, curID: activeID, cutZ: partLen, label: 'ID CHAMFER APPROACH' });
        moves.push({ x: finOD, y: 0, z: -chamfSize, rapid: false, passType: 'chamfer', curOD: rawOD, curID: activeID, cutZ: partLen, label: `ID CHAMFER C${chamfSize}` });
      }
      moves.push({ x: rawID - 2, y: 0, z: 15, rapid: true, passType: 'rapid', curOD: rawOD, curID: activeID, cutZ: partLen, label: 'G00 HOME' });
    } else {
      let activeOD = rawOD;
      const targetZ = Math.max(10, partLen - lenStock);
      if (stage.includes('Rough')) {
        const step = Math.max(2, (rawOD - (finOD + diaStock)) / 3);
        for (let px = rawOD - step; px >= finOD + diaStock - 0.01; px -= step) {
          moves.push({ x: activeOD + 3, y: 0, z: 2, rapid: true, passType: 'rapid', curOD: activeOD, curID: 0, cutZ: 0, label: `OD ROUGH APPROACH X${px.toFixed(1)}` });
          moves.push({ x: px, y: 0, z: 2, rapid: true, passType: 'rapid', curOD: activeOD, curID: 0, cutZ: 0, label: `G00 X${px.toFixed(1)}` });
          for (let s = 1; s <= 4; s++) {
            const zProg = (targetZ * s) / 4;
            moves.push({ x: px, y: 0, z: -zProg, rapid: false, passType: 'rough', curOD: px, curID: 0, cutZ: zProg, label: `OD CUT X${px.toFixed(1)} Z-${zProg.toFixed(1)}` });
          }
          activeOD = px;
          moves.push({ x: px + 2, y: 0, z: -targetZ + 1, rapid: true, passType: 'rapid', curOD: activeOD, curID: 0, cutZ: targetZ, label: 'G00 RETRACT' });
        }
      }
      if (stage.includes('Finish') || stage.includes('Combined')) {
        moves.push({ x: finOD, y: 0, z: 2, rapid: true, passType: 'rapid', curOD: activeOD, curID: 0, cutZ: 0, label: `OD FINISH G42 X${finOD}` });
        for (let s = 1; s <= 4; s++) {
          const zProg = (partLen * s) / 4;
          moves.push({ x: finOD, y: 0, z: -zProg, rapid: false, passType: 'finish', curOD: finOD, curID: 0, cutZ: zProg, label: `FINISH OD X${finOD} Z-${zProg.toFixed(1)}` });
        }
        activeOD = finOD;
      }
      if (stage.includes('Chamfer')) {
        moves.push({ x: finOD - chamfSize * 2, y: 0, z: 1, rapid: true, passType: 'rapid', curOD: activeOD, curID: 0, cutZ: partLen, label: 'OD CHAMFER APPROACH' });
        moves.push({ x: finOD, y: 0, z: -chamfSize, rapid: false, passType: 'chamfer', curOD: activeOD, curID: 0, cutZ: partLen, label: `OD CHAMFER C${chamfSize}` });
      }
      moves.push({ x: rawOD + 6, y: 0, z: 15, rapid: true, passType: 'rapid', curOD: activeOD, curID: 0, cutZ: partLen, label: 'G00 HOME' });
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

    if (isCircPocket || isRectPocket || isCircSpigot || isRectSpigot) {
      const isPocket = isCircPocket || isRectPocket;
      const isCirc = !isRectPocket && !isRectSpigot;
      let curCutDepth = 0;

      if (stage.includes('Rough')) {
        const roughZ = -(depth - btmAllow);
        if (isPocket) {
          moves.push({ x: 0, y: 0, z: 6, rapid: true, passType: 'rapid', cutDepth: 0, label: 'G00 X0 Y0 Z6 (G43 H01)' });
          curCutDepth = Math.abs(roughZ);
          moves.push({ x: 0, y: 0, z: roughZ, rapid: false, passType: 'rough', cutDepth: curCutDepth, label: `PLUNGE Z${roughZ.toFixed(2)}` });
          if (isCirc) {
            [11, Math.max(15, 22 - wallAllow * 2)].forEach((rad, ri) => {
              const pts = circlePts(rad, 16);
              moves.push({ x: pts[0].x, y: pts[0].y, z: roughZ, rapid: false, passType: 'rough', cutDepth: curCutDepth, cutRad: rad, label: `ROUGH RING ${ri + 1} (R${rad})` });
              pts.forEach((p) => moves.push({ x: p.x, y: p.y, z: roughZ, rapid: false, passType: 'rough', cutDepth: curCutDepth, cutRad: rad, label: `G03 X${p.x} Y${p.y}` }));
            });
          } else {
            [{ w: 13, h: 9 }, { w: 26 - wallAllow, h: 16 - wallAllow }].forEach((bx, bi) => {
              const pts = rectPts(bx.w, bx.h);
              moves.push({ x: pts[0].x, y: pts[0].y, z: roughZ, rapid: false, passType: 'rough', cutDepth: curCutDepth, cutW: bx.w, cutH: bx.h, label: `ROUGH RECT PASS ${bi + 1}` });
              pts.forEach((p) => moves.push({ x: p.x, y: p.y, z: roughZ, rapid: false, passType: 'rough', cutDepth: curCutDepth, cutW: bx.w, cutH: bx.h, label: `G01 X${p.x} Y${p.y}` }));
            });
          }
        } else {
          moves.push({ x: -34, y: 0, z: 6, rapid: true, passType: 'rapid', cutDepth: 0, label: 'G00 OUTSIDE STOCK (G43)' });
          curCutDepth = Math.abs(roughZ);
          moves.push({ x: -34, y: 0, z: roughZ, rapid: false, passType: 'rough', cutDepth: curCutDepth, label: `SPIGOT ROUGH Z${roughZ.toFixed(2)}` });
          if (isCirc) {
            [30, 20 + wallAllow * 2].forEach((rad, ri) => {
              const pts = circlePts(rad, 16);
              moves.push({ x: pts[0].x, y: pts[0].y, z: roughZ, rapid: false, passType: 'rough', cutDepth: curCutDepth, cutRad: rad, label: `SPIGOT STEP ${ri + 1}` });
              pts.forEach((p) => moves.push({ x: p.x, y: p.y, z: roughZ, rapid: false, passType: 'rough', cutDepth: curCutDepth, cutRad: rad, label: `G02 X${p.x} Y${p.y}` }));
            });
          } else {
            [{ w: 32, h: 22 }, { w: 22 + wallAllow, h: 14 + wallAllow }].forEach((bx, bi) => {
              const pts = rectPts(bx.w, bx.h);
              moves.push({ x: pts[0].x, y: pts[0].y, z: roughZ, rapid: false, passType: 'rough', cutDepth: curCutDepth, cutW: bx.w, cutH: bx.h, label: `SPIGOT RECT STEP ${bi + 1}` });
              pts.forEach((p) => moves.push({ x: p.x, y: p.y, z: roughZ, rapid: false, passType: 'rough', cutDepth: curCutDepth, cutW: bx.w, cutH: bx.h, label: `G01 X${p.x} Y${p.y}` }));
            });
          }
        }
      }

      if (stage.includes('Finish') || stage.includes('Combined')) {
        const finZ = stage === 'Wall Finish Only' ? -(depth - btmAllow) : -depth;
        curCutDepth = Math.abs(finZ);
        const wallPts = isCirc
          ? circlePts(isPocket ? 22 : 20, 20)
          : rectPts(isPocket ? 26 : 22, isPocket ? 16 : 14);
        moves.push({ x: wallPts[0].x, y: wallPts[0].y, z: finZ, rapid: false, passType: 'finish', cutDepth: curCutDepth, cutRad: isPocket ? 22 : 20, cutW: isPocket ? 26 : 22, cutH: isPocket ? 16 : 14, label: `${mfgCfg.compMode || 'G41'} FINISH Z${finZ.toFixed(2)}` });
        wallPts.forEach((p) => moves.push({ x: p.x, y: p.y, z: finZ, rapid: false, passType: 'finish', cutDepth: curCutDepth, cutRad: isPocket ? 22 : 20, cutW: isPocket ? 26 : 22, cutH: isPocket ? 16 : 14, label: `FINISH X${p.x} Y${p.y}` }));
      }

      if (stage.includes('Chamfer')) {
        const chZ = -chamfSize;
        const chPts = isCirc
          ? circlePts(isPocket ? 22.5 : 19.5, 20)
          : rectPts(isPocket ? 26.5 : 21.5, isPocket ? 16.5 : 13.5);
        moves.push({ x: chPts[0].x, y: chPts[0].y, z: 4, rapid: true, passType: 'rapid', cutDepth: curCutDepth, label: 'CHAMFER RAPID G43 H03' });
        moves.push({ x: chPts[0].x, y: chPts[0].y, z: chZ, rapid: false, passType: 'chamfer', cutDepth: curCutDepth, label: `CHAMFER C${chamfSize}` });
        chPts.forEach((p) => moves.push({ x: p.x, y: p.y, z: chZ, rapid: false, passType: 'chamfer', cutDepth: curCutDepth, label: `CHAMFER X${p.x} Y${p.y}` }));
      }

      moves.push({ x: 0, y: 0, z: 25, rapid: true, passType: 'rapid', cutDepth: curCutDepth, label: 'G40 G00 Z25.0 HOME' });
    } else {
      const holes = [
        { x: -24, y: -16 },
        { x: 24, y: -16 },
        { x: 24, y: 16 },
        { x: -24, y: 16 },
        { x: 0, y: 0 }
      ];
      holes.forEach((h, i) => {
        moves.push({ x: h.x, y: h.y, z: 6, rapid: true, passType: 'rapid', label: `HOLE ${i + 1}: G00 X${h.x} Y${h.y}` });
        moves.push({ x: h.x, y: h.y, z: -depth, rapid: false, passType: 'rough', label: `G43 CYCLE Z-${depth}.0` });
        moves.push({ x: h.x, y: h.y, z: 6, rapid: true, passType: 'rapid', label: 'G00 R-PLANE Z6.0' });
      });
    }
  }

  return moves.length > 0 ? moves : [{ x: 0, y: 0, z: 10, rapid: true, passType: 'rapid', label: 'READY' }];
}

const SPEED_OPTIONS = [0.25, 0.5, 1, 2, 4];

export default function CncSimulator({ domainKey, machineType, workSide, operation, templateName = '', mfgCfg = {} }) {
  const [playing, setPlaying] = useState(true);
  const [stepIdx, setStepIdx] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [halfCut, setHalfCut] = useState(false);

  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const dynamicGroupRef = useRef(null);
  const clipPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 0, -1), 0));

  const isVTL = machineType === 'VTL';

  const moves = useMemo(
    () => parseToolpath(domainKey, workSide, operation, templateName, mfgCfg),
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
    }, Math.max(85, Math.round(450 / speed)));
    return () => clearInterval(timer);
  }, [playing, moves, speed]);

  // Initialize True WebGL Three.js Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 380;
    const height = 350;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#060b16');
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
    camera.position.set(115, 85, 125);
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

    // CAD Studio Three-Point Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
    keyLight.position.set(120, 180, 140);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.65);
    rimLight.position.set(-120, -60, -100);
    scene.add(rimLight);

    // Subtle Machine Bed Grid
    const grid = new THREE.GridHelper(220, 22, 0x1e293b, 0x0f172a);
    grid.position.y = -45;
    scene.add(grid);

    const dynGroup = new THREE.Group();
    scene.add(dynGroup);
    dynamicGroupRef.current = dynGroup;

    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 380;
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

  // Camera View Presets
  const setCameraView = (view) => {
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    if (!cam || !ctrl) return;
    ctrl.target.set(0, 0, 0);
    if (view === 'iso') cam.position.set(115, 85, 125);
    else if (view === 'top') cam.position.set(0, 185, 0.1);
    else if (view === 'front') cam.position.set(0, 10, 185);
    else if (view === 'side') cam.position.set(185, 10, 0);
    ctrl.update();
  };

  const adjustZoom = (factor) => {
    const cam = cameraRef.current;
    if (!cam) return;
    cam.position.multiplyScalar(factor);
  };

  // Rebuild 3D Solid Meshes & Toolpath on Every Step
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

    // Metallic PBR Materials
    const chuckMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.85,
      roughness: 0.3,
      clippingPlanes: planes,
      side: THREE.DoubleSide
    });
    const rawStockMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.72,
      roughness: 0.28,
      clippingPlanes: planes,
      side: THREE.DoubleSide
    });
    const machinedMat = new THREE.MeshStandardMaterial({
      color: 0x14b8a6,
      emissive: 0x042f2e,
      metalness: 0.65,
      roughness: 0.18,
      clippingPlanes: planes,
      side: THREE.DoubleSide
    });
    const boreMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      metalness: 0.7,
      roughness: 0.22,
      clippingPlanes: planes,
      side: THREE.DoubleSide
    });

    if (domainKey === 'Turning') {
      const rawOD = Number(mfgCfg.stockX || 50);
      const partLen = Math.max(10, Number(mfgCfg.stockZ || 45));
      const stickout = Math.min(72, Math.max(36, Number(mfgCfg.chuckStickout || 65) * 0.85));
      const activeOD = current.curOD ?? rawOD;
      const activeID = current.curID ?? (workSide === 'ID' ? Number(mfgCfg.rawIdDia || 20) : 0);
      const cutRatio = Math.min(1, Math.max(0, (current.cutZ || 0) / partLen));
      const cutLen = cutRatio * (stickout * 0.85);
      const uncutLen = Math.max(0.5, stickout - cutLen);

      const rawRad = 28;
      const machRad = Math.max(8, (activeOD / Math.max(10, rawOD)) * rawRad);
      const boreRad = activeID > 0 ? Math.min(machRad - 2, Math.max(4, (activeID / Math.max(10, rawOD)) * rawRad)) : 0;

      const rootGroup = new THREE.Group();
      // For Horizontal Lathe: rotate cylinder axis to X (-X = Chuck, +X = Face)
      // For VTL: keep cylinder axis along Y (-Y = Bottom Table, +Y = Top Face)
      if (!isVTL) {
        rootGroup.rotation.z = -Math.PI / 2;
      }

      // 1. 3-Jaw Chuck Body + 3 Jaws
      const chuckGeo = new THREE.CylinderGeometry(rawRad + 12, rawRad + 12, 22, 40);
      const chuckMesh = new THREE.Mesh(chuckGeo, chuckMat);
      chuckMesh.position.y = -stickout / 2 - 11;
      rootGroup.add(chuckMesh);

      for (let j = 0; j < 3; j++) {
        const ang = (j * Math.PI * 2) / 3;
        const jawGeo = new THREE.BoxGeometry(8, 12, 14);
        const jawMesh = new THREE.Mesh(jawGeo, rawStockMat);
        jawMesh.position.set(Math.cos(ang) * (rawRad + 3), -stickout / 2 + 4, Math.sin(ang) * (rawRad + 3));
        jawMesh.rotation.y = -ang;
        rootGroup.add(jawMesh);
      }

      // 2. Uncut Raw Stock Portion
      const rawGeo = new THREE.CylinderGeometry(rawRad, rawRad, uncutLen, 48);
      const rawMesh = new THREE.Mesh(rawGeo, rawStockMat);
      rawMesh.position.y = -stickout / 2 + uncutLen / 2;
      rootGroup.add(rawMesh);

      // 3. Machined Reduced OD Portion (Glowing Teal Metallic Finish)
      if (cutLen > 0.4) {
        const machGeo = new THREE.CylinderGeometry(machRad, machRad, cutLen, 48);
        const machMesh = new THREE.Mesh(machGeo, machinedMat);
        machMesh.position.y = stickout / 2 - cutLen / 2;
        rootGroup.add(machMesh);
      }

      // 4. Inner Bore Sleeve (Visible in Half-Cut & Front View)
      if (boreRad > 1) {
        const boreDepth = Math.max(6, cutLen);
        const boreGeo = new THREE.CylinderGeometry(boreRad, boreRad, boreDepth + 0.4, 36, 1, true);
        const boreMesh = new THREE.Mesh(boreGeo, boreMat);
        boreMesh.position.y = stickout / 2 - boreDepth / 2;
        rootGroup.add(boreMesh);
      }

      group.add(rootGroup);

      // Map Tool & Toolpath Coordinates
      const mapTurnVec = (pt) => {
        const zNorm = ((pt.z || 0) / partLen) * (stickout * 0.85);
        const rad = ((pt.x || 0) / Math.max(10, rawOD)) * rawRad;
        if (isVTL) {
          return new THREE.Vector3(rad, stickout / 2 + zNorm, 0);
        }
        return new THREE.Vector3(stickout / 2 + zNorm, rad, 0);
      };

      // 3D Toolpath Lines
      for (let i = 1; i < history.length; i++) {
        const p1 = mapTurnVec(history[i - 1]);
        const p2 = mapTurnVec(history[i]);
        const col = history[i].rapid ? 0xf43f5e : history[i].passType === 'finish' ? 0x38bdf8 : 0x10b981;
        const lineGeo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
        const lineMat = new THREE.LineBasicMaterial({ color: col });
        group.add(new THREE.Line(lineGeo, lineMat));
      }

      // 3D Cutting Tool Holder + Carbide Insert
      const tip = mapTurnVec(current);
      const toolGroup = new THREE.Group();
      const shankGeo = new THREE.BoxGeometry(8, 34, 8);
      const shankMesh = new THREE.Mesh(shankGeo, new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 }));
      shankMesh.position.set(isVTL ? 14 : 6, isVTL ? 14 : 18, 0);
      if (isVTL) shankMesh.rotation.z = -0.5;
      toolGroup.add(shankMesh);

      const insertGeo = new THREE.ConeGeometry(4.5, 9, 4);
      const insertMesh = new THREE.Mesh(insertGeo, new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0x78350f, metalness: 0.5, roughness: 0.2 }));
      insertMesh.rotation.z = isVTL ? Math.PI / 2 : Math.PI;
      insertMesh.position.set(isVTL ? 4 : 0, isVTL ? 0 : 4, 0);
      toolGroup.add(insertMesh);

      toolGroup.position.copy(tip);
      group.add(toolGroup);
    } else {
      // MILLING 3D SOLID WORKPIECE BLOCK
      const blkW = Math.min(96, Number(mfgCfg.stockX || 100) * 0.85);
      const blkD = Math.min(76, Number(mfgCfg.stockY || 80) * 0.85);
      const blkH = Math.min(34, Math.max(16, Number(mfgCfg.stockZ || 30) * 0.85));
      const cutD = Math.min(blkH - 3, (current.cutDepth || 0) * 0.95);

      const stockGeo = new THREE.BoxGeometry(blkW, blkH, blkD);
      const stockMesh = new THREE.Mesh(stockGeo, rawStockMat);
      stockMesh.position.y = -blkH / 2;
      group.add(stockMesh);

      // Machined Pocket Cavity or Spigot Boss in 3D
      if (cutD > 0.5) {
        if (tName.includes('CIRCULAR POCKET') || operation === 'Pocket Milling') {
          const rad = current.cutRad || 22;
          const cavGeo = new THREE.CylinderGeometry(rad, rad, cutD + 0.4, 40);
          const cavMesh = new THREE.Mesh(cavGeo, machinedMat);
          cavMesh.position.y = -cutD / 2 + 0.1;
          group.add(cavMesh);
        } else if (tName.includes('RECTANGULAR POCKET')) {
          const w = (current.cutW || 26) * 2;
          const d = (current.cutH || 16) * 2;
          const cavGeo = new THREE.BoxGeometry(w, cutD + 0.4, d);
          const cavMesh = new THREE.Mesh(cavGeo, machinedMat);
          cavMesh.position.y = -cutD / 2 + 0.1;
          group.add(cavMesh);
        } else if (tName.includes('CIRCULAR SPIGOT') || operation === 'Spigot Milling') {
          const bossGeo = new THREE.CylinderGeometry(20, 20, cutD + 0.5, 40);
          const bossMesh = new THREE.Mesh(bossGeo, machinedMat);
          bossMesh.position.y = cutD / 2;
          group.add(bossMesh);
        } else if (tName.includes('RECTANGULAR SPIGOT')) {
          const bossGeo = new THREE.BoxGeometry(44, cutD + 0.5, 28);
          const bossMesh = new THREE.Mesh(bossGeo, machinedMat);
          bossMesh.position.y = cutD / 2;
          group.add(bossMesh);
        }
      }

      const mapMillVec = (pt) => new THREE.Vector3(pt.x || 0, pt.z || 0, -(pt.y || 0));

      for (let i = 1; i < history.length; i++) {
        const p1 = mapMillVec(history[i - 1]);
        const p2 = mapMillVec(history[i]);
        const col = history[i].rapid ? 0xf43f5e : history[i].passType === 'finish' ? 0x38bdf8 : history[i].passType === 'chamfer' ? 0xf59e0b : 0x10b981;
        const lineGeo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
        group.add(new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: col })));
      }

      // 3D Solid Carbide Endmill Cutter
      const tip = mapMillVec(current);
      const cutterRad = Math.max(3, Number(mfgCfg.toolDia || 12) * 0.45);
      const fluteLen = Math.max(18, Number(mfgCfg.toolLength || 35) * 0.65);

      const cutterGroup = new THREE.Group();
      const fluteGeo = new THREE.CylinderGeometry(cutterRad, cutterRad, fluteLen, 24);
      const fluteMesh = new THREE.Mesh(fluteGeo, new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.75, roughness: 0.2 }));
      fluteMesh.position.y = fluteLen / 2;
      cutterGroup.add(fluteMesh);

      const holderGeo = new THREE.CylinderGeometry(cutterRad * 1.6, cutterRad * 1.3, 18, 24);
      const holderMesh = new THREE.Mesh(holderGeo, chuckMat);
      holderMesh.position.y = fluteLen + 9;
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
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col justify-between h-full min-h-[600px]">
      {/* Header + Playback & Speed Selector */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
          <Box className="w-4 h-4" />
          <span>3D CAD/CAM WebGL Simulator ({isVTL ? 'VTL' : domainKey})</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPlaying(!playing)}
            className="px-2 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-bold flex items-center gap-1 border border-cyan-500/40"
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

      {/* Camera Views, Zoom & True WebGL Half-Cut Toolbar */}
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

      {/* True WebGL 3D Canvas Container */}
      <div className="my-2 bg-[#060b16] border border-slate-800 rounded-xl overflow-hidden relative">
        <div ref={mountRef} className="w-full h-[350px] cursor-grab active:cursor-grabbing" />

        <div className="absolute top-2 left-2.5 right-2.5 flex justify-between items-center text-[10px] font-mono bg-slate-950/85 px-2.5 py-1 rounded border border-slate-800 pointer-events-none">
          <span className="text-slate-200">
            {domainKey === 'Turning'
              ? `Live OD: Ø${activeOD.toFixed(1)}mm ${activeID > 0 ? `| ID: Ø${activeID.toFixed(1)}mm` : ''}`
              : `Cut Depth: ${(current.cutDepth || 0).toFixed(1)} / ${mfgCfg.featureDepth || 10}mm`}
          </span>
          <span className="text-amber-300">Drag: Rotate • Scroll: Zoom</span>
        </div>

        <div className="absolute bottom-2 left-2 right-2 flex flex-wrap items-center gap-2.5 text-[10px] font-mono bg-slate-950/90 px-2.5 py-1 rounded-md border border-slate-800 pointer-events-none">
          <span className="flex items-center gap-1 text-slate-300"><span className="w-2.5 h-2.5 rounded-sm bg-slate-500"></span> Raw Stock</span>
          <span className="flex items-center gap-1 text-teal-300"><span className="w-2.5 h-2.5 rounded-sm bg-teal-500"></span> Machined</span>
          <span className="flex items-center gap-1 text-rose-400"><span className="w-2.5 h-0.5 bg-rose-400"></span> Rapid</span>
          <span className="flex items-center gap-1 text-sky-400"><span className="w-2.5 h-0.5 bg-sky-400"></span> Finish</span>
        </div>
      </div>

      {/* Live Coordinate Readout */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 space-y-1.5">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-cyan-300 font-bold">
            {domainKey === 'Turning'
              ? `X: ${(current.x ?? 0).toFixed(1)}   Z: ${(current.z ?? 0).toFixed(1)}`
              : `X: ${(current.x ?? 0).toFixed(1)}   Y: ${(current.y ?? 0).toFixed(1)}   Z: ${(current.z ?? 0).toFixed(1)}`}
          </span>
          <span className="text-[11px] text-slate-400">
            Step {stepIdx + 1} / {moves.length}
          </span>
        </div>
        <div className="text-[11px] font-mono text-emerald-300 truncate bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
          ACTIVE: {current.label}
        </div>
      </div>
    </div>
  );
}
