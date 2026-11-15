import React, { useState, useEffect, useMemo } from 'react';
import { Play, Pause, RotateCcw, Box, ZoomIn, ZoomOut, Scissors } from 'lucide-react';

function circlePoints(radius, steps = 24) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const ang = (i / steps) * Math.PI * 2;
    pts.push({
      x: Number((Math.cos(ang) * radius).toFixed(2)),
      y: Number((Math.sin(ang) * radius).toFixed(2))
    });
  }
  return pts;
}

function rectPoints(halfW, halfH) {
  return [
    { x: -halfW, y: -halfH },
    { x: halfW, y: -halfH },
    { x: halfW, y: halfH },
    { x: -halfW, y: halfH },
    { x: -halfW, y: -halfH }
  ];
}

function parseToolpath(domainKey, workSide, operation, templateName = '', mfgCfg = {}) {
  const moves = [];
  const tName = (templateName + ' ' + workSide).toUpperCase();
  const stage = mfgCfg.machiningStage || 'Rough + Finish Combined';
  const wallAllow = Number(mfgCfg.wallAllowance ?? 0.3);
  const btmAllow = Number(mfgCfg.bottomAllowance ?? 0.2);
  const depth = Number(mfgCfg.featureDepth ?? 10);
  const chamfSize = Number(mfgCfg.chamferSize ?? 0.5);

  if (domainKey === 'Turning') {
    const rawOD = Number(mfgCfg.stockX || 50);
    const finOD = Number(mfgCfg.stockY || 32);
    const partLen = Number(mfgCfg.stockZ || 50);
    const isID = workSide === 'ID';

    if (operation === 'Drilling & Tapping') {
      moves.push({ x: 0, y: 0, z: 4, rapid: true, passType: 'rapid', label: 'G00 X0.0 Z4.0' });
      for (let d = -10; d >= -Math.min(45, partLen); d -= 10) {
        moves.push({ x: 0, y: 0, z: d, rapid: false, passType: 'rough', label: `PECK DRILL Z${d}.0` });
        moves.push({ x: 0, y: 0, z: 4, rapid: true, passType: 'rapid', label: 'G00 Z4.0 RETRACT' });
      }
      moves.push({ x: 0, y: 0, z: 15, rapid: true, passType: 'rapid', label: 'G00 HOME' });
    } else if (isID) {
      const startBore = Math.max(16, finOD - 12);
      if (stage.includes('Rough')) {
        for (let px = startBore + 3; px <= finOD - wallAllow * 2; px += 3) {
          moves.push({ x: startBore - 2, y: 0, z: 2, rapid: true, passType: 'rapid', label: `ID ROUGH X${px.toFixed(1)}` });
          moves.push({ x: px, y: 0, z: 2, rapid: true, passType: 'rapid', label: `G00 X${px.toFixed(1)}` });
          moves.push({ x: px, y: 0, z: -partLen + 5, rapid: false, passType: 'rough', label: `G01 X${px.toFixed(1)} Z-${partLen - 5}` });
          moves.push({ x: startBore - 2, y: 0, z: -partLen + 5, rapid: true, passType: 'rapid', label: 'G00 RETRACT' });
        }
      }
      if (stage.includes('Finish') || stage.includes('Combined')) {
        moves.push({ x: finOD, y: 0, z: 2, rapid: true, passType: 'rapid', label: `ID FINISH G41/G42 X${finOD}` });
        moves.push({ x: finOD, y: 0, z: -partLen + 5, rapid: false, passType: 'finish', label: `FINISH BORE X${finOD}` });
      }
      if (stage.includes('Chamfer')) {
        moves.push({ x: finOD + chamfSize * 2, y: 0, z: 1, rapid: true, passType: 'rapid', label: 'CHAMFER APPROACH' });
        moves.push({ x: finOD, y: 0, z: -chamfSize, rapid: false, passType: 'chamfer', label: `CHAMFER C${chamfSize}` });
      }
      moves.push({ x: startBore - 2, y: 0, z: 15, rapid: true, passType: 'rapid', label: 'G00 HOME' });
    } else {
      if (stage.includes('Rough')) {
        for (let px = rawOD - 4; px >= finOD + wallAllow * 2; px -= 4) {
          moves.push({ x: rawOD + 3, y: 0, z: 2, rapid: true, passType: 'rapid', label: `OD ROUGH X${px.toFixed(1)}` });
          moves.push({ x: px, y: 0, z: 2, rapid: true, passType: 'rapid', label: `G00 X${px.toFixed(1)}` });
          moves.push({ x: px, y: 0, z: -partLen + 5, rapid: false, passType: 'rough', label: `G01 X${px.toFixed(1)} Z-${partLen - 5}` });
          moves.push({ x: px + 2, y: 0, z: -partLen + 6, rapid: true, passType: 'rapid', label: 'G00 RETRACT' });
        }
      }
      if (stage.includes('Finish') || stage.includes('Combined')) {
        moves.push({ x: finOD, y: 0, z: 2, rapid: true, passType: 'rapid', label: `OD FINISH G42 X${finOD}` });
        moves.push({ x: finOD, y: 0, z: -partLen + 5, rapid: false, passType: 'finish', label: `FINISH OD X${finOD}` });
      }
      if (stage.includes('Chamfer')) {
        moves.push({ x: finOD - chamfSize * 2, y: 0, z: 1, rapid: true, passType: 'rapid', label: 'CHAMFER APPROACH' });
        moves.push({ x: finOD, y: 0, z: -chamfSize, rapid: false, passType: 'chamfer', label: `CHAMFER C${chamfSize}` });
      }
      moves.push({ x: rawOD + 6, y: 0, z: 15, rapid: true, passType: 'rapid', label: 'G00 HOME' });
    }
  } else {
    const isCircPocket = tName.includes('CIRCULAR POCKET');
    const isRectPocket = tName.includes('RECTANGULAR POCKET');
    const isCircSpigot = tName.includes('CIRCULAR SPIGOT');
    const isRectSpigot = tName.includes('RECTANGULAR SPIGOT');

    if (isCircPocket || isRectPocket || isCircSpigot || isRectSpigot) {
      const isPocket = isCircPocket || isRectPocket;
      const isCirc = isCircPocket || isCircSpigot;

      if (stage.includes('Rough')) {
        const roughZ = -(depth - btmAllow);
        if (isPocket) {
          moves.push({ x: 0, y: 0, z: 6, rapid: true, passType: 'rapid', label: 'G00 X0 Y0 Z6 (G43 H01)' });
          moves.push({ x: 0, y: 0, z: roughZ, rapid: false, passType: 'rough', label: `PLUNGE Z${roughZ.toFixed(2)}` });
          if (isCirc) {
            [10, Math.max(14, 22 - wallAllow * 2)].forEach((rad, ri) => {
              const pts = circlePoints(rad, 18);
              moves.push({ x: pts[0].x, y: pts[0].y, z: roughZ, rapid: false, passType: 'rough', label: `ROUGH RING ${ri + 1} (R${rad})` });
              pts.forEach((p) => moves.push({ x: p.x, y: p.y, z: roughZ, rapid: false, passType: 'rough', label: `G03 X${p.x} Y${p.y}` }));
            });
          } else {
            [{ w: 12, h: 8 }, { w: 26 - wallAllow, h: 16 - wallAllow }].forEach((bx, bi) => {
              const pts = rectPoints(bx.w, bx.h);
              moves.push({ x: pts[0].x, y: pts[0].y, z: roughZ, rapid: false, passType: 'rough', label: `ROUGH RECT PASS ${bi + 1}` });
              pts.forEach((p) => moves.push({ x: p.x, y: p.y, z: roughZ, rapid: false, passType: 'rough', label: `G01 X${p.x} Y${p.y}` }));
            });
          }
        } else {
          moves.push({ x: -34, y: 0, z: 6, rapid: true, passType: 'rapid', label: 'G00 OUTSIDE STOCK (G43)' });
          moves.push({ x: -34, y: 0, z: roughZ, rapid: false, passType: 'rough', label: `SPIGOT ROUGH Z${roughZ.toFixed(2)}` });
          if (isCirc) {
            [30, 20 + wallAllow * 2].forEach((rad, ri) => {
              const pts = circlePoints(rad, 18);
              moves.push({ x: pts[0].x, y: pts[0].y, z: roughZ, rapid: false, passType: 'rough', label: `SPIGOT STEP ${ri + 1}` });
              pts.forEach((p) => moves.push({ x: p.x, y: p.y, z: roughZ, rapid: false, passType: 'rough', label: `G02 X${p.x} Y${p.y}` }));
            });
          } else {
            [{ w: 32, h: 22 }, { w: 22 + wallAllow, h: 14 + wallAllow }].forEach((bx, bi) => {
              const pts = rectPoints(bx.w, bx.h);
              moves.push({ x: pts[0].x, y: pts[0].y, z: roughZ, rapid: false, passType: 'rough', label: `SPIGOT RECT STEP ${bi + 1}` });
              pts.forEach((p) => moves.push({ x: p.x, y: p.y, z: roughZ, rapid: false, passType: 'rough', label: `G01 X${p.x} Y${p.y}` }));
            });
          }
        }
      }

      if (stage.includes('Finish') || stage.includes('Combined')) {
        const finZ = stage === 'Wall Finish Only' ? -(depth - btmAllow) : -depth;
        if (stage === 'Wall + Bottom Finish' && isPocket) {
          const btmPts = isCirc ? circlePoints(14, 14) : rectPoints(16, 10);
          moves.push({ x: 0, y: 0, z: finZ, rapid: false, passType: 'finish', label: `BOTTOM WIPE Z${finZ.toFixed(2)}` });
          btmPts.forEach((p) => moves.push({ x: p.x, y: p.y, z: finZ, rapid: false, passType: 'finish', label: `FLOOR X${p.x} Y${p.y}` }));
        }
        const wallPts = isCirc
          ? circlePoints(isPocket ? 22 : 20, 22)
          : rectPoints(isPocket ? 26 : 22, isPocket ? 16 : 14);
        moves.push({ x: wallPts[0].x, y: wallPts[0].y, z: finZ, rapid: false, passType: 'finish', label: `${mfgCfg.compMode || 'G41'} WALL FINISH Z${finZ.toFixed(2)}` });
        wallPts.forEach((p) => moves.push({ x: p.x, y: p.y, z: finZ, rapid: false, passType: 'finish', label: `COMP WALL X${p.x} Y${p.y}` }));
      }

      if (stage.includes('Chamfer')) {
        const chZ = -chamfSize;
        const chPts = isCirc
          ? circlePoints(isPocket ? 22.5 : 19.5, 22)
          : rectPoints(isPocket ? 26.5 : 21.5, isPocket ? 16.5 : 13.5);
        moves.push({ x: chPts[0].x, y: chPts[0].y, z: 4, rapid: true, passType: 'rapid', label: 'CHAMFER RAPID G43 H03' });
        moves.push({ x: chPts[0].x, y: chPts[0].y, z: chZ, rapid: false, passType: 'chamfer', label: `${mfgCfg.compMode || 'G41'} CHAMFER C${chamfSize}` });
        chPts.forEach((p) => moves.push({ x: p.x, y: p.y, z: chZ, rapid: false, passType: 'chamfer', label: `CHAMFER X${p.x} Y${p.y}` }));
      }

      moves.push({ x: 0, y: 0, z: 25, rapid: true, passType: 'rapid', label: 'G40 G00 Z25.0 CANCEL & HOME' });
    } else {
      const holes = [
        { x: -25, y: -18 },
        { x: 25, y: -18 },
        { x: 25, y: 18 },
        { x: -25, y: 18 },
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

export default function CncSimulator({ domainKey, workSide, operation, templateName = '', mfgCfg = {} }) {
  const [playing, setPlaying] = useState(true);
  const [stepIdx, setStepIdx] = useState(0);
  const [speed, setSpeed] = useState(1);

  // 3D Camera States: yaw (Z rotation), pitch (tilt), zoom, halfCut
  const [yaw, setYaw] = useState(-35);
  const [pitch, setPitch] = useState(58);
  const [zoom, setZoom] = useState(1.0);
  const [halfCut, setHalfCut] = useState(false);
  const [dragStart, setDragStart] = useState(null);

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
    }, Math.max(100, 420 / speed));
    return () => clearInterval(timer);
  }, [playing, moves, speed]);

  const current = moves[stepIdx] || moves[0];
  const history = moves.slice(0, stepIdx + 1);
  const tName = (templateName + ' ' + workSide).toUpperCase();

  // True 3D Orthographic-Perspective Projection (X, Y, Z -> Screen 2D)
  const project3D = (x, y, z) => {
    const radYaw = (yaw * Math.PI) / 180;
    const radPitch = (pitch * Math.PI) / 180;

    // Rotate around Z axis (yaw)
    const x1 = x * Math.cos(radYaw) - y * Math.sin(radYaw);
    const y1 = x * Math.sin(radYaw) + y * Math.cos(radYaw);

    // Tilt around X axis (pitch)
    const screenX = 190 + x1 * 2.2 * zoom;
    const screenY = 165 + (y1 * Math.cos(radPitch) - z * Math.sin(radPitch)) * 2.2 * zoom;
    return { x: screenX, y: screenY };
  };

  // Map Turning (X=Diameter, Z=Axis) into 3D space (Axis along X, Radius in Y/Z)
  const mapPoint3D = (pt) => {
    if (domainKey === 'Turning') {
      const zAxis = (pt.z || 0) + 25; // shift workpiece center
      const rad = (pt.x || 0) / 2;
      return project3D(zAxis, -rad, 0);
    }
    return project3D(pt.x || 0, pt.y || 0, pt.z || 0);
  };

  const handlePointerDown = (e) => {
    setDragStart({ x: e.clientX, y: e.clientY, yaw, pitch });
  };

  const handlePointerMove = (e) => {
    if (!dragStart) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    setYaw(dragStart.yaw + dx * 0.6);
    setPitch(Math.max(0, Math.min(90, dragStart.pitch + dy * 0.5)));
  };

  const handlePointerUp = () => setDragStart(null);

  const handleWheel = (e) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.5, Math.min(2.4, Number((z - e.deltaY * 0.001).toFixed(2)))));
  };

  const getStroke = (m) => {
    if (m.rapid || m.passType === 'rapid') return '#f43f5e';
    if (m.passType === 'finish') return '#38bdf8';
    if (m.passType === 'chamfer') return '#f59e0b';
    return '#10b981';
  };

  // 3D Stock Box Geometry
  const halfX = domainKey === 'Turning' ? 32 : Math.min(48, Number(mfgCfg.stockX || 100) / 2.2);
  const halfY = domainKey === 'Turning' ? 24 : Math.min(38, Number(mfgCfg.stockY || 80) / 2.2);
  const stockH = domainKey === 'Turning' ? 24 : Math.min(26, Number(mfgCfg.stockZ || 30) * 0.8);
  const featDepth = Math.min(stockH - 2, Number(mfgCfg.featureDepth || 10) * 0.9);

  // Half-Cut clips positive Y (front half removed so inner depth/wall is visible)
  const yFront = halfCut ? 0 : -halfY;
  const yBack = halfY;

  const topCorners = [
    project3D(-halfX, yFront, 0),
    project3D(halfX, yFront, 0),
    project3D(halfX, yBack, 0),
    project3D(-halfX, yBack, 0)
  ];
  const btmCorners = [
    project3D(-halfX, yFront, -stockH),
    project3D(halfX, yFront, -stockH),
    project3D(halfX, yBack, -stockH),
    project3D(-halfX, yBack, -stockH)
  ];

  const polyStr = (pts) => pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const toolTip = mapPoint3D(current);
  const toolTop = domainKey === 'Turning'
    ? project3D((current.z || 0) + 25, -((current.x || 0) / 2) - 22, 14)
    : project3D(current.x || 0, current.y || 0, (current.z || 0) + 26);

  const cutterDia = Number(mfgCfg.toolDia || 12);
  const cutterRadPx = Math.max(5, Math.min(16, cutterDia * 0.65 * zoom));

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col justify-between h-full min-h-[600px]">
      {/* Header + Playback Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
          <Box className="w-4 h-4" />
          <span>3D Interactive CNC Simulator</span>
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
          <button
            type="button"
            onClick={() => setSpeed(speed === 1 ? 2 : 1)}
            className="px-2 py-1 rounded-lg bg-slate-800 text-[11px] font-bold text-amber-300 border border-slate-700"
          >
            {speed}x
          </button>
        </div>
      </div>

      {/* 3D View Angle, Zoom & Half-Cut Toolbar */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5 text-[10px] font-semibold">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => { setYaw(-35); setPitch(58); }}
            className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700"
          >
            3D Iso
          </button>
          <button
            type="button"
            onClick={() => { setYaw(0); setPitch(0); }}
            className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700"
          >
            Top
          </button>
          <button
            type="button"
            onClick={() => { setYaw(0); setPitch(88); }}
            className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700"
          >
            Front
          </button>
          <button
            type="button"
            onClick={() => { setYaw(-90); setPitch(88); }}
            className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700"
          >
            Side
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setHalfCut(!halfCut)}
            className={`px-2 py-1 rounded flex items-center gap-1 border ${
              halfCut
                ? 'bg-amber-500/25 text-amber-300 border-amber-500/60'
                : 'bg-slate-900 text-slate-300 border-slate-700'
            }`}
            title="Half-Cut Section View"
          >
            <Scissors className="w-3 h-3" /> ½ Cut
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2.4, Number((z + 0.2).toFixed(2))))}
            className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.2).toFixed(2))))}
            className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Interactive 3D Viewport */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
        className="my-2 bg-[#050914] border border-slate-800 rounded-xl overflow-hidden flex items-center justify-center relative cursor-grab active:cursor-grabbing select-none"
      >
        <svg viewBox="0 0 380 320" className="w-full h-[340px]">
          <defs>
            <pattern id="grid3d" width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#1e293b" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="380" height="320" fill="url(#grid3d)" />

          {/* 3D Workpiece Faces */}
          {/* Bottom Face */}
          <polygon points={polyStr(btmCorners)} fill="#1e293b" fillOpacity="0.55" stroke="#475569" strokeWidth="1" />
          {/* Back Face */}
          <polygon
            points={polyStr([topCorners[2], topCorners[3], btmCorners[3], btmCorners[2]])}
            fill="#334155"
            fillOpacity="0.45"
            stroke="#64748b"
            strokeWidth="1"
          />
          {/* Left & Right Side Faces */}
          <polygon
            points={polyStr([topCorners[0], topCorners[3], btmCorners[3], btmCorners[0]])}
            fill="#334155"
            fillOpacity="0.4"
            stroke="#64748b"
            strokeWidth="1"
          />
          <polygon
            points={polyStr([topCorners[1], topCorners[2], btmCorners[2], btmCorners[1]])}
            fill="#1e293b"
            fillOpacity="0.5"
            stroke="#64748b"
            strokeWidth="1"
          />
          {/* Top Face */}
          <polygon points={polyStr(topCorners)} fill="#475569" fillOpacity="0.35" stroke="#94a3b8" strokeWidth="1.4" />

          {/* Front Section Cut Face (Highlighted Hatching when Half-Cut is ON) */}
          <polygon
            points={polyStr([topCorners[0], topCorners[1], btmCorners[1], btmCorners[0]])}
            fill={halfCut ? '#f59e0b' : '#334155'}
            fillOpacity={halfCut ? '0.18' : '0.35'}
            stroke={halfCut ? '#f59e0b' : '#94a3b8'}
            strokeWidth={halfCut ? '1.6' : '1.2'}
          />

          {/* Half-Cut Internal Pocket / Spigot Depth Cavity */}
          {halfCut && domainKey !== 'Turning' && (
            <polygon
              points={polyStr([
                project3D(-22, 0, 0),
                project3D(22, 0, 0),
                project3D(22, 0, -featDepth),
                project3D(-22, 0, -featDepth)
              ])}
              fill="#050914"
              stroke="#38bdf8"
              strokeWidth="1.5"
              strokeDasharray="3,2"
            />
          )}

          {/* 3D Feature Outline on Top Surface */}
          {domainKey !== 'Turning' && (tName.includes('CIRCULAR POCKET') || tName.includes('CIRCULAR SPIGOT')) && (
            <polygon
              points={polyStr(
                circlePoints(tName.includes('POCKET') ? 22 : 20, 28)
                  .filter((p) => !halfCut || p.y >= 0)
                  .map((p) => project3D(p.x, p.y, 0))
              )}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="1.4"
              strokeDasharray="3,2"
            />
          )}

          {domainKey !== 'Turning' && (tName.includes('RECTANGULAR POCKET') || tName.includes('RECTANGULAR SPIGOT')) && (
            <polygon
              points={polyStr(
                rectPoints(tName.includes('POCKET') ? 26 : 22, tName.includes('POCKET') ? 16 : 14).map((p) =>
                  project3D(p.x, halfCut && p.y < 0 ? 0 : p.y, 0)
                )
              )}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="1.4"
              strokeDasharray="3,2"
            />
          )}

          {/* 3D Axes Indicator (X, Y, Z) */}
          {(() => {
            const o = project3D(-halfX - 8, -halfY - 6, -stockH);
            const axX = project3D(-halfX + 6, -halfY - 6, -stockH);
            const axY = project3D(-halfX - 8, -halfY + 8, -stockH);
            const axZ = project3D(-halfX - 8, -halfY - 6, -stockH + 14);
            return (
              <g fontSize="9" fontFamily="monospace" fontWeight="bold">
                <line x1={o.x} y1={o.y} x2={axX.x} y2={axX.y} stroke="#ef4444" strokeWidth="1.6" />
                <text x={axX.x + 2} y={axX.y} fill="#ef4444">X</text>
                <line x1={o.x} y1={o.y} x2={axY.x} y2={axY.y} stroke="#22c55e" strokeWidth="1.6" />
                <text x={axY.x + 2} y={axY.y} fill="#22c55e">Y</text>
                <line x1={o.x} y1={o.y} x2={axZ.x} y2={axZ.y} stroke="#38bdf8" strokeWidth="1.6" />
                <text x={axZ.x + 2} y={axZ.y} fill="#38bdf8">Z</text>
              </g>
            );
          })()}

          {/* 3D Toolpath Trajectory */}
          {history.map((m, idx) => {
            if (idx === 0) return null;
            const p1 = mapPoint3D(history[idx - 1]);
            const p2 = mapPoint3D(m);
            return (
              <line
                key={idx}
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke={getStroke(m)}
                strokeWidth={m.rapid ? '1.1' : '2.4'}
                strokeDasharray={m.rapid ? '3,3' : '0'}
              />
            );
          })}

          {/* 3D Rotating Endmill / Turning Tool */}
          <g>
            <line
              x1={toolTip.x}
              y1={toolTip.y}
              x2={toolTop.x}
              y2={toolTop.y}
              stroke="#cbd5e1"
              strokeWidth={cutterRadPx * 1.1}
              strokeLinecap="round"
              strokeOpacity="0.45"
            />
            <line
              x1={toolTip.x}
              y1={toolTip.y}
              x2={toolTop.x}
              y2={toolTop.y}
              stroke="#f59e0b"
              strokeWidth={Math.max(2, cutterRadPx * 0.45)}
              strokeLinecap="round"
            />
            <circle cx={toolTip.x} cy={toolTip.y} r={Math.max(3.5, cutterRadPx * 0.45)} fill="#f59e0b" stroke="#fef08a" strokeWidth="1" />
          </g>
        </svg>

        {/* Drag Hint & Zoom Badge */}
        <div className="absolute top-2 left-2.5 text-[10px] font-mono text-slate-400 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800">
          Drag: Rotate 360° • Scroll: Zoom ({Math.round(zoom * 100)}%)
        </div>

        {/* Pass Legend */}
        <div className="absolute bottom-2 left-2 right-2 flex flex-wrap items-center gap-2.5 text-[10px] font-mono bg-slate-950/90 px-2.5 py-1 rounded-md border border-slate-800">
          <span className="flex items-center gap-1 text-rose-400"><span className="w-2.5 h-0.5 bg-rose-400"></span> Rapid</span>
          <span className="flex items-center gap-1 text-emerald-400"><span className="w-2.5 h-0.5 bg-emerald-400"></span> Rough</span>
          <span className="flex items-center gap-1 text-sky-400"><span className="w-2.5 h-0.5 bg-sky-400"></span> Finish</span>
          <span className="flex items-center gap-1 text-amber-400"><span className="w-2.5 h-0.5 bg-amber-400"></span> Chamfer</span>
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
