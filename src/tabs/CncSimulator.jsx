import React, { useState, useEffect, useMemo } from 'react';
import { Play, Pause, RotateCcw, Eye } from 'lucide-react';

function circlePoints(radius, steps = 20) {
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
    const isThread = operation === 'Threading';
    const isGroove = operation === 'Grooving & Parting';
    const isDrill = operation === 'Drilling & Tapping';

    if (isDrill) {
      moves.push({ x: 0, z: 3, rapid: true, passType: 'rapid', label: 'G00 X0.0 Z3.0' });
      for (let d = -10; d >= -Math.min(45, partLen); d -= 10) {
        moves.push({ x: 0, z: d, rapid: false, passType: 'rough', label: `PECK DRILL Z${d}.0` });
        moves.push({ x: 0, z: 3, rapid: true, passType: 'rapid', label: 'G00 Z3.0 RETRACT' });
      }
      moves.push({ x: 0, z: 15, rapid: true, passType: 'rapid', label: 'G00 HOME' });
    } else if (isGroove) {
      const gx = isID ? finOD + 6 : Math.max(12, finOD - 6);
      const startX = isID ? finOD - 4 : rawOD + 2;
      moves.push({ x: startX, z: -20, rapid: true, passType: 'rapid', label: `G00 X${startX} Z-20` });
      moves.push({ x: gx, z: -20, rapid: false, passType: 'rough', label: `GROOVE CUT X${gx}` });
      moves.push({ x: startX, z: -20, rapid: true, passType: 'rapid', label: `G00 X${startX}` });
      moves.push({ x: startX, z: 12, rapid: true, passType: 'rapid', label: 'G00 HOME' });
    } else if (isThread) {
      const passes = isID ? [finOD - 2.4, finOD - 1.2, finOD - 0.5, finOD] : [finOD + 2.4, finOD + 1.2, finOD + 0.5, finOD];
      const safeX = isID ? finOD - 5 : rawOD + 3;
      passes.forEach((px, idx) => {
        moves.push({ x: safeX, z: 4, rapid: true, passType: 'rapid', label: `THREAD PASS ${idx + 1}` });
        moves.push({ x: px, z: 4, rapid: true, passType: 'rapid', label: `G00 X${px.toFixed(1)}` });
        moves.push({ x: px, z: -Math.min(35, partLen - 5), rapid: false, passType: 'finish', label: `G76 X${px.toFixed(1)}` });
        moves.push({ x: safeX, z: -Math.min(35, partLen - 5), rapid: true, passType: 'rapid', label: `G00 X${safeX}` });
      });
      moves.push({ x: safeX, z: 12, rapid: true, passType: 'rapid', label: 'G00 HOME' });
    } else if (isID) {
      const startBore = Math.max(16, finOD - 12);
      if (stage.includes('Rough')) {
        for (let px = startBore + 3; px <= finOD - wallAllow * 2; px += 3) {
          moves.push({ x: startBore - 2, z: 2, rapid: true, passType: 'rapid', label: `ID ROUGH X${px.toFixed(1)}` });
          moves.push({ x: px, z: 2, rapid: true, passType: 'rapid', label: `G00 X${px.toFixed(1)}` });
          moves.push({ x: px, z: -partLen + 5, rapid: false, passType: 'rough', label: `G01 X${px.toFixed(1)} Z-${partLen - 5}` });
          moves.push({ x: startBore - 2, z: -partLen + 5, rapid: true, passType: 'rapid', label: 'G00 RETRACT' });
        }
      }
      if (stage.includes('Finish') || stage.includes('Combined')) {
        moves.push({ x: finOD, z: 2, rapid: true, passType: 'rapid', label: `ID FINISH X${finOD}` });
        moves.push({ x: finOD, z: -partLen + 5, rapid: false, passType: 'finish', label: `FINISH BORE X${finOD}` });
      }
      if (stage.includes('Chamfer')) {
        moves.push({ x: finOD + chamfSize * 2, z: 1, rapid: true, passType: 'rapid', label: 'CHAMFER START' });
        moves.push({ x: finOD, z: -chamfSize, rapid: false, passType: 'chamfer', label: `CHAMFER C${chamfSize}` });
      }
      moves.push({ x: startBore - 2, z: 15, rapid: true, passType: 'rapid', label: 'G00 HOME' });
    } else {
      if (stage.includes('Rough')) {
        for (let px = rawOD - 4; px >= finOD + wallAllow * 2; px -= 4) {
          moves.push({ x: rawOD + 3, z: 2, rapid: true, passType: 'rapid', label: `OD ROUGH X${px.toFixed(1)}` });
          moves.push({ x: px, z: 2, rapid: true, passType: 'rapid', label: `G00 X${px.toFixed(1)}` });
          moves.push({ x: px, z: -partLen + 5, rapid: false, passType: 'rough', label: `G01 X${px.toFixed(1)} Z-${partLen - 5}` });
          moves.push({ x: px + 2, z: -partLen + 6, rapid: true, passType: 'rapid', label: 'G00 RETRACT' });
        }
      }
      if (stage.includes('Finish') || stage.includes('Combined')) {
        moves.push({ x: finOD, z: 2, rapid: true, passType: 'rapid', label: `OD FINISH X${finOD}` });
        moves.push({ x: finOD, z: -partLen + 5, rapid: false, passType: 'finish', label: `FINISH OD X${finOD}` });
      }
      if (stage.includes('Chamfer')) {
        moves.push({ x: finOD - chamfSize * 2, z: 1, rapid: true, passType: 'rapid', label: 'CHAMFER APPROACH' });
        moves.push({ x: finOD, z: -chamfSize, rapid: false, passType: 'chamfer', label: `CHAMFER C${chamfSize}` });
      }
      moves.push({ x: rawOD + 6, z: 15, rapid: true, passType: 'rapid', label: 'G00 HOME' });
    }
  } else {
    const isCircPocket = tName.includes('CIRCULAR POCKET');
    const isRectPocket = tName.includes('RECTANGULAR POCKET');
    const isCircSpigot = tName.includes('CIRCULAR SPIGOT');
    const isRectSpigot = tName.includes('RECTANGULAR SPIGOT');

    if (isCircPocket || isRectPocket || isCircSpigot || isRectSpigot) {
      const isPocket = isCircPocket || isRectPocket;
      const isCirc = isCircPocket || isCircSpigot;

      // 1. ROUGHING PASS (leaves wallAllow & btmAllow)
      if (stage.includes('Rough')) {
        const roughZ = -(depth - btmAllow);
        if (isPocket) {
          moves.push({ x: 0, y: 0, z: 5, rapid: true, passType: 'rapid', label: 'G00 X0 Y0 Z5 (BLIND CENTER)' });
          moves.push({ x: 0, y: 0, z: roughZ, rapid: false, passType: 'rough', label: `ROUGH PLUNGE Z${roughZ.toFixed(2)} (LEAVE ${btmAllow} BTM)` });
          const r1 = 10;
          const r2 = Math.max(14, 22 - wallAllow * 2);
          if (isCirc) {
            [r1, r2].forEach((rad, ri) => {
              const pts = circlePoints(rad, 16);
              moves.push({ x: pts[0].x, y: pts[0].y, z: roughZ, rapid: false, passType: 'rough', label: `ROUGH RING ${ri + 1} (LEAVE ${wallAllow} WALL)` });
              pts.forEach((p) => moves.push({ x: p.x, y: p.y, z: roughZ, rapid: false, passType: 'rough', label: `ROUGH G03 X${p.x} Y${p.y}` }));
            });
          } else {
            [{ w: 12, h: 8 }, { w: 26 - wallAllow, h: 16 - wallAllow }].forEach((bx, bi) => {
              const pts = rectPoints(bx.w, bx.h);
              moves.push({ x: pts[0].x, y: pts[0].y, z: roughZ, rapid: false, passType: 'rough', label: `ROUGH PASS ${bi + 1} (LEAVE ${wallAllow} WALL)` });
              pts.forEach((p) => moves.push({ x: p.x, y: p.y, z: roughZ, rapid: false, passType: 'rough', label: `ROUGH G01 X${p.x} Y${p.y}` }));
            });
          }
        } else {
          // SPIGOT ROUGHING (Outside-in, leaving wallAllow around boss)
          moves.push({ x: -34, y: 0, z: 5, rapid: true, passType: 'rapid', label: 'G00 OUTSIDE STOCK' });
          moves.push({ x: -34, y: 0, z: roughZ, rapid: false, passType: 'rough', label: `SPIGOT ROUGH Z${roughZ.toFixed(2)}` });
          if (isCirc) {
            [30, 20 + wallAllow * 2].forEach((rad, ri) => {
              const pts = circlePoints(rad, 16);
              moves.push({ x: pts[0].x, y: pts[0].y, z: roughZ, rapid: false, passType: 'rough', label: `SPIGOT ROUGH STEP ${ri + 1}` });
              pts.forEach((p) => moves.push({ x: p.x, y: p.y, z: roughZ, rapid: false, passType: 'rough', label: `ROUGH G02 X${p.x} Y${p.y}` }));
            });
          } else {
            [{ w: 32, h: 22 }, { w: 22 + wallAllow, h: 14 + wallAllow }].forEach((bx, bi) => {
              const pts = rectPoints(bx.w, bx.h);
              moves.push({ x: pts[0].x, y: pts[0].y, z: roughZ, rapid: false, passType: 'rough', label: `SPIGOT ROUGH STEP ${bi + 1}` });
              pts.forEach((p) => moves.push({ x: p.x, y: p.y, z: roughZ, rapid: false, passType: 'rough', label: `ROUGH G01 X${p.x} Y${p.y}` }));
            });
          }
        }
      }

      // 2. FINISH PASS (Wall Only OR Wall + Bottom)
      if (stage.includes('Finish') || stage.includes('Combined')) {
        const finZ = stage === 'Wall Finish Only' ? -(depth - btmAllow) : -depth;
        if (stage === 'Wall + Bottom Finish' && isPocket) {
          // Bottom floor wipe pass
          const btmPts = isCirc ? circlePoints(14, 12) : rectPoints(16, 10);
          moves.push({ x: 0, y: 0, z: finZ, rapid: false, passType: 'finish', label: `BOTTOM FINISH Z${finZ.toFixed(2)}` });
          btmPts.forEach((p) => moves.push({ x: p.x, y: p.y, z: finZ, rapid: false, passType: 'finish', label: `FLOOR WIPE X${p.x} Y${p.y}` }));
        }
        // Final Wall Profile Pass
        const wallPts = isCirc
          ? circlePoints(isPocket ? 22 : 20, 20)
          : rectPoints(isPocket ? 26 : 22, isPocket ? 16 : 14);
        moves.push({ x: wallPts[0].x, y: wallPts[0].y, z: finZ, rapid: false, passType: 'finish', label: `WALL FINISH PASS Z${finZ.toFixed(2)}` });
        wallPts.forEach((p) => moves.push({ x: p.x, y: p.y, z: finZ, rapid: false, passType: 'finish', label: `FINISH WALL X${p.x} Y${p.y}` }));
      }

      // 3. CHAMFER PASS (Top edge C-chamfer)
      if (stage === 'Chamfering Pass' || stage === 'Rough + Finish Combined') {
        const chZ = -chamfSize;
        const chPts = isCirc
          ? circlePoints(isPocket ? 22.4 : 19.6, 20)
          : rectPoints(isPocket ? 26.4 : 21.6, isPocket ? 16.4 : 13.6);
        moves.push({ x: chPts[0].x, y: chPts[0].y, z: 3, rapid: true, passType: 'rapid', label: 'CHAMFER TOOL RAPID' });
        moves.push({ x: chPts[0].x, y: chPts[0].y, z: chZ, rapid: false, passType: 'chamfer', label: `CHAMFER C${chamfSize} Z${chZ}` });
        chPts.forEach((p) => moves.push({ x: p.x, y: p.y, z: chZ, rapid: false, passType: 'chamfer', label: `CHAMFER X${p.x} Y${p.y}` }));
      }

      moves.push({ x: 0, y: 0, z: 25, rapid: true, passType: 'rapid', label: 'G00 Z25.0 SAFE RETRACT' });
    } else {
      const holes = [
        { x: -25, y: -18 },
        { x: 25, y: -18 },
        { x: 25, y: 18 },
        { x: -25, y: 18 },
        { x: 0, y: 0 }
      ];
      holes.forEach((h, i) => {
        moves.push({ x: h.x, y: h.y, z: 5, rapid: true, passType: 'rapid', label: `HOLE ${i + 1}: G00 X${h.x} Y${h.y}` });
        moves.push({ x: h.x, y: h.y, z: -depth, rapid: false, passType: 'rough', label: `CYCLE Z-${depth}.0 (${operation})` });
        moves.push({ x: h.x, y: h.y, z: 5, rapid: true, passType: 'rapid', label: 'G00 R-PLANE Z5.0' });
      });
    }
  }

  return moves.length > 0 ? moves : [{ x: 0, y: 0, z: 10, rapid: true, passType: 'rapid', label: 'READY' }];
}

export default function CncSimulator({ domainKey, workSide, operation, templateName = '', mfgCfg = {} }) {
  const [playing, setPlaying] = useState(true);
  const [stepIdx, setStepIdx] = useState(0);
  const [speed, setSpeed] = useState(1);

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
    }, Math.max(110, 440 / speed));
    return () => clearInterval(timer);
  }, [playing, moves, speed]);

  const current = moves[stepIdx] || moves[0];
  const history = moves.slice(0, stepIdx + 1);
  const tName = (templateName + ' ' + workSide).toUpperCase();

  const cutterDia = Number(mfgCfg.toolDia || 12);
  const toolRadiusPx = Math.max(6, Math.min(18, cutterDia * 0.75));

  const mapTurn = (pt) => {
    const svgX = 270 + (pt.z || 0) * 3.1;
    const svgY = 165 - (pt.x || 0) * 1.8;
    return { x: Math.max(78, Math.min(345, svgX)), y: Math.max(25, Math.min(165, svgY)) };
  };

  const mapMill = (pt) => {
    const svgX = 180 + (pt.x || 0) * 2.8;
    const svgY = 150 - (pt.y || 0) * 2.8;
    return { x: Math.max(40, Math.min(320, svgX)), y: Math.max(40, Math.min(260, svgY)) };
  };

  const toolPos = domainKey === 'Turning' ? mapTurn(current) : mapMill(current);

  const getStroke = (m) => {
    if (m.rapid || m.passType === 'rapid') return '#f43f5e';
    if (m.passType === 'finish') return '#38bdf8';
    if (m.passType === 'chamfer') return '#f59e0b';
    return '#10b981';
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col justify-between h-full min-h-[580px]">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
          <Eye className="w-4 h-4" />
          <span>2D Live Tooling & Workpiece Sim</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPlaying(!playing)}
            className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-bold flex items-center gap-1 border border-cyan-500/40"
          >
            {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {playing ? 'Pause' : 'Play'}
          </button>
          <button
            type="button"
            onClick={() => setStepIdx(0)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
            title="Reset Simulation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
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

      {/* Tool & Stock Spec Badge Strip */}
      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-mono text-slate-300">
        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
          Stock: {mfgCfg.stockX || 100}×{mfgCfg.stockY || 80}×{mfgCfg.stockZ || 30}mm
        </span>
        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-amber-300">
          Tool: Ø{mfgCfg.toolDia || 12}mm • {mfgCfg.toolFlutes || 4}FL • L{mfgCfg.toolLength || 35}mm
        </span>
        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-300">
          Allow: W{mfgCfg.wallAllowance ?? 0.3} / B{mfgCfg.bottomAllowance ?? 0.2}
        </span>
      </div>

      <div className="my-2 bg-[#060b16] border border-slate-800/90 rounded-xl overflow-hidden flex items-center justify-center relative">
        <svg viewBox="0 0 360 290" className="w-full h-[330px]">
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="0.6" />
            </pattern>
            <linearGradient id="billetGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#64748b" />
              <stop offset="50%" stopColor="#94a3b8" />
              <stop offset="100%" stopColor="#475569" />
            </linearGradient>
          </defs>
          <rect width="360" height="290" fill="url(#grid)" />

          {domainKey === 'Turning' ? (
            <>
              <rect x="18" y="65" width="56" height="200" rx="4" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
              <rect x="52" y="52" width="24" height="32" rx="2" fill="#334155" stroke="#64748b" />
              <rect x="52" y="246" width="24" height="32" rx="2" fill="#334155" stroke="#64748b" />
              <text x="24" y="169" fill="#94a3b8" fontSize="9" fontFamily="monospace">CHUCK</text>

              <rect x="74" y="70" width="196" height="190" fill="url(#billetGrad)" fillOpacity="0.32" stroke="#94a3b8" strokeWidth="1.5" />
              {workSide === 'ID' && (
                <rect x="74" y="122" width="196" height="86" fill="#060b16" stroke="#38bdf8" strokeDasharray="3,3" strokeWidth="1" />
              )}

              <line x1="12" y1="165" x2="348" y2="165" stroke="#ef4444" strokeWidth="1" strokeDasharray="6,4" />
              <text x="275" y="161" fill="#ef4444" fontSize="9" fontFamily="monospace">Z0 / CL</text>

              {history.map((m, idx) => {
                if (idx === 0) return null;
                const p1 = mapTurn(history[idx - 1]);
                const p2 = mapTurn(m);
                return (
                  <line
                    key={idx}
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke={getStroke(m)}
                    strokeWidth={m.rapid ? '1.2' : '2.4'}
                    strokeDasharray={m.rapid ? '4,3' : '0'}
                  />
                );
              })}

              <g transform={`translate(${toolPos.x}, ${toolPos.y})`}>
                <polygon points="0,0 14,-38 30,-38 16,0" fill="#334155" stroke="#94a3b8" strokeWidth="1.2" />
                <polygon points="0,0 8,-10 13,-3 4,4" fill="#f59e0b" stroke="#fef08a" strokeWidth="1" />
                {!current.rapid && <circle cx="0" cy="0" r="4" fill="#34d399" fillOpacity="0.85" />}
              </g>
            </>
          ) : (
            <>
              <rect x="65" y="55" width="230" height="190" rx="6" fill="url(#billetGrad)" fillOpacity="0.28" stroke="#94a3b8" strokeWidth="1.5" />

              {tName.includes('CIRCULAR POCKET') && (
                <circle cx="180" cy="150" r="62" fill="#060b16" fillOpacity="0.55" stroke="#38bdf8" strokeDasharray="4,3" strokeWidth="1.2" />
              )}
              {tName.includes('RECTANGULAR POCKET') && (
                <rect x="102" y="100" width="156" height="100" rx="4" fill="#060b16" fillOpacity="0.55" stroke="#38bdf8" strokeDasharray="4,3" strokeWidth="1.2" />
              )}
              {tName.includes('CIRCULAR SPIGOT') && (
                <circle cx="180" cy="150" r="52" fill="#38bdf8" fillOpacity="0.18" stroke="#38bdf8" strokeWidth="1.6" />
              )}
              {tName.includes('RECTANGULAR SPIGOT') && (
                <rect x="118" y="110" width="124" height="80" rx="4" fill="#38bdf8" fillOpacity="0.18" stroke="#38bdf8" strokeWidth="1.6" />
              )}

              <line x1="180" y1="40" x2="180" y2="260" stroke="#475569" strokeDasharray="4,4" />
              <line x1="50" y1="150" x2="310" y2="150" stroke="#475569" strokeDasharray="4,4" />
              <text x="184" y="146" fill="#94a3b8" fontSize="9" fontFamily="monospace">G54 (X0,Y0)</text>

              {history.map((m, idx) => {
                if (idx === 0) return null;
                const p1 = mapMill(history[idx - 1]);
                const p2 = mapMill(m);
                return (
                  <g key={idx}>
                    <line
                      x1={p1.x}
                      y1={p1.y}
                      x2={p2.x}
                      y2={p2.y}
                      stroke={getStroke(m)}
                      strokeWidth={m.rapid ? '1.2' : '2.8'}
                      strokeDasharray={m.rapid ? '4,3' : '0'}
                    />
                    {!m.rapid && operation !== 'Milling & Pocket' && (
                      <circle cx={p2.x} cy={p2.y} r="5" fill="#10b981" fillOpacity="0.35" stroke="#34d399" />
                    )}
                  </g>
                );
              })}

              {/* Dynamic Diameter Cutter */}
              <g transform={`translate(${toolPos.x}, ${toolPos.y})`}>
                <circle cx="0" cy="0" r={toolRadiusPx} fill="#f59e0b" fillOpacity="0.25" stroke="#f59e0b" strokeWidth="1.8" />
                <line x1={-toolRadiusPx * 0.7} y1={-toolRadiusPx * 0.7} x2={toolRadiusPx * 0.7} y2={toolRadiusPx * 0.7} stroke="#fef08a" strokeWidth="1.4" />
                <line x1={toolRadiusPx * 0.7} y1={-toolRadiusPx * 0.7} x2={-toolRadiusPx * 0.7} y2={toolRadiusPx * 0.7} stroke="#fef08a" strokeWidth="1.4" />
                <circle cx="0" cy="0" r="2.5" fill="#10b981" />
              </g>
            </>
          )}
        </svg>

        <div className="absolute bottom-2 left-2 right-2 flex flex-wrap items-center gap-2.5 text-[10px] font-mono bg-slate-950/90 px-2.5 py-1 rounded-md border border-slate-800">
          <span className="flex items-center gap-1 text-rose-400">
            <span className="w-2.5 h-0.5 bg-rose-400 inline-block"></span> Rapid
          </span>
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="w-2.5 h-0.5 bg-emerald-400 inline-block"></span> Rough
          </span>
          <span className="flex items-center gap-1 text-sky-400">
            <span className="w-2.5 h-0.5 bg-sky-400 inline-block"></span> Finish
          </span>
          <span className="flex items-center gap-1 text-amber-400">
            <span className="w-2.5 h-0.5 bg-amber-400 inline-block"></span> Chamfer
          </span>
        </div>
      </div>

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
