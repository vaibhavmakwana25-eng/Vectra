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

function parseToolpath(code, domainKey, workSide, operation, templateName = '') {
  const moves = [];
  const tName = (templateName + ' ' + workSide).toUpperCase();

  if (domainKey === 'Turning') {
    const isID = workSide === 'ID';
    const isThread = operation === 'Threading';
    const isGroove = operation === 'Grooving & Parting';
    const isDrill = operation === 'Drilling & Tapping';

    if (isDrill) {
      moves.push({ x: 0, z: 3, rapid: true, label: 'G00 X0.0 Z3.0' });
      for (let d = -10; d >= -45; d -= 10) {
        moves.push({ x: 0, z: d, rapid: false, label: `G01 Z${d}.0` });
        moves.push({ x: 0, z: 3, rapid: true, label: 'G00 Z3.0 (PECK RETRACT)' });
      }
      moves.push({ x: 0, z: -45, rapid: false, label: 'G01 Z-45.0' });
      moves.push({ x: 0, z: 15, rapid: true, label: 'G00 Z15.0' });
    } else if (isGroove) {
      const gx = isID ? 36 : 30;
      const startX = isID ? 26 : 44;
      moves.push({ x: startX, z: -20, rapid: true, label: `G00 X${startX}.0 Z-20.0` });
      moves.push({ x: gx, z: -20, rapid: false, label: `G01 X${gx}.0` });
      moves.push({ x: startX, z: -20, rapid: true, label: `G00 X${startX}.0` });
      moves.push({ x: startX, z: -25, rapid: true, label: `G00 Z-25.0` });
      moves.push({ x: gx, z: -25, rapid: false, label: `G01 X${gx}.0` });
      moves.push({ x: startX, z: 10, rapid: true, label: 'G00 RETRACT' });
    } else if (isThread) {
      const passes = isID ? [27.2, 28.4, 29.3, 30.0] : [23.2, 22.0, 21.0, 20.3];
      const safeX = isID ? 25 : 27;
      passes.forEach((px, idx) => {
        moves.push({ x: safeX, z: 4, rapid: true, label: `PASS ${idx + 1}: G00 X${safeX}` });
        moves.push({ x: px, z: 4, rapid: true, label: `G00 X${px}` });
        moves.push({ x: px, z: -32, rapid: false, label: `G76 THREAD X${px} Z-32.0` });
        moves.push({ x: safeX, z: -32, rapid: true, label: `G00 X${safeX}` });
      });
      moves.push({ x: safeX, z: 12, rapid: true, label: 'G00 HOME' });
    } else if (isID) {
      const passes = [28, 32, 36, 40];
      passes.forEach((px, idx) => {
        const zEnd = px > 32 ? -25 : -45;
        moves.push({ x: 24, z: 2, rapid: true, label: `PASS ${idx + 1}: G00 X24 Z2` });
        moves.push({ x: px, z: 2, rapid: true, label: `G00 X${px}.0` });
        moves.push({ x: px, z: zEnd, rapid: false, label: `G01 X${px}.0 Z${zEnd}.0` });
        moves.push({ x: 24, z: zEnd, rapid: true, label: 'G00 X24.0' });
      });
      moves.push({ x: 24, z: 15, rapid: true, label: 'G00 Z15.0' });
    } else {
      const passes = [46, 40, 34, 28, 22];
      passes.forEach((px, idx) => {
        const zEnd = px < 26 ? -25 : -50;
        moves.push({ x: 54, z: 2, rapid: true, label: `PASS ${idx + 1}: G00 X54 Z2` });
        moves.push({ x: px, z: 2, rapid: true, label: `G00 X${px}.0` });
        moves.push({ x: px, z: zEnd, rapid: false, label: `G01 X${px}.0 Z${zEnd}.0` });
        moves.push({ x: px + 3, z: zEnd + 1, rapid: true, label: 'G00 RETRACT' });
      });
      moves.push({ x: 60, z: 15, rapid: true, label: 'G00 X60 Z15' });
    }
  } else {
    const isCircPocket = tName.includes('CIRCULAR POCKET');
    const isRectPocket = tName.includes('RECTANGULAR POCKET');
    const isCircSpigot = tName.includes('CIRCULAR SPIGOT');
    const isRectSpigot = tName.includes('RECTANGULAR SPIGOT');

    if (isCircPocket) {
      // Inside-out spiral circular pocket
      moves.push({ x: 0, y: 0, z: 5, rapid: true, label: 'G00 X0.0 Y0.0 Z5.0 (CENTER)' });
      moves.push({ x: 0, y: 0, z: -6, rapid: false, label: 'G01 Z-6.0 (HELICAL PLUNGE)' });
      [11, 22].forEach((rad, ri) => {
        const pts = circlePoints(rad, 16);
        moves.push({ x: pts[0].x, y: pts[0].y, z: -6, rapid: false, label: `SPIRAL RING ${ri + 1}: R${rad}` });
        pts.forEach((p) => {
          moves.push({ x: p.x, y: p.y, z: -6, rapid: false, label: `G03 X${p.x} Y${p.y} R${rad}` });
        });
      });
      moves.push({ x: 0, y: 0, z: 20, rapid: true, label: 'G00 Z20.0 (POCKET DONE)' });
    } else if (isRectPocket) {
      // Inside-out rectangular pocket
      moves.push({ x: 0, y: 0, z: 5, rapid: true, label: 'G00 X0.0 Y0.0 Z5.0 (CENTER)' });
      moves.push({ x: 0, y: 0, z: -6, rapid: false, label: 'G01 Z-6.0 (PLUNGE)' });
      [
        { w: 14, h: 9 },
        { w: 28, h: 18 }
      ].forEach((box, bi) => {
        const pts = rectPoints(box.w, box.h);
        moves.push({ x: pts[0].x, y: pts[0].y, z: -6, rapid: false, label: `INNER PASS ${bi + 1}` });
        pts.forEach((p) => {
          moves.push({ x: p.x, y: p.y, z: -6, rapid: false, label: `G01 X${p.x} Y${p.y}` });
        });
      });
      moves.push({ x: 0, y: 0, z: 20, rapid: true, label: 'G00 Z20.0 (RECT POCKET DONE)' });
    } else if (isCircSpigot) {
      // Outside-in circular spigot (boss remaining in center)
      moves.push({ x: -34, y: 0, z: 5, rapid: true, label: 'G00 X-34.0 Y0.0 Z5.0 (OUTSIDE)' });
      moves.push({ x: -34, y: 0, z: -8, rapid: false, label: 'G01 Z-8.0 (OUTSIDE PLUNGE)' });
      [30, 20].forEach((rad, ri) => {
        const pts = circlePoints(rad, 16);
        moves.push({ x: pts[0].x, y: pts[0].y, z: -8, rapid: false, label: `SPIGOT STEP ${ri + 1}: R${rad}` });
        pts.forEach((p) => {
          moves.push({ x: p.x, y: p.y, z: -8, rapid: false, label: `G02 X${p.x} Y${p.y} R${rad}` });
        });
      });
      moves.push({ x: -34, y: 0, z: 20, rapid: true, label: 'G00 Z20.0 (CIRC SPIGOT DONE)' });
    } else if (isRectSpigot) {
      // Outside-in rectangular spigot (rectangular boss remaining in center)
      moves.push({ x: -35, y: -24, z: 5, rapid: true, label: 'G00 X-35.0 Y-24.0 Z5.0 (OUTSIDE)' });
      moves.push({ x: -35, y: -24, z: -8, rapid: false, label: 'G01 Z-8.0 (OUTSIDE PLUNGE)' });
      [
        { w: 32, h: 22 },
        { w: 22, h: 14 }
      ].forEach((box, bi) => {
        const pts = rectPoints(box.w, box.h);
        moves.push({ x: pts[0].x, y: pts[0].y, z: -8, rapid: false, label: `SPIGOT STEP ${bi + 1}` });
        pts.forEach((p) => {
          moves.push({ x: p.x, y: p.y, z: -8, rapid: false, label: `G01 X${p.x} Y${p.y}` });
        });
      });
      moves.push({ x: -35, y: -24, z: 20, rapid: true, label: 'G00 Z20.0 (RECT SPIGOT DONE)' });
    } else {
      const holes = [
        { x: -25, y: -18 },
        { x: 25, y: -18 },
        { x: 25, y: 18 },
        { x: -25, y: 18 },
        { x: 0, y: 0 }
      ];
      holes.forEach((h, i) => {
        moves.push({ x: h.x, y: h.y, z: 5, rapid: true, label: `HOLE ${i + 1}: G00 X${h.x} Y${h.y}` });
        moves.push({ x: h.x, y: h.y, z: -20, rapid: false, label: `CYCLE Z-20.0 (${operation})` });
        moves.push({ x: h.x, y: h.y, z: 5, rapid: true, label: 'G00 R-PLANE Z5.0' });
      });
    }
  }

  return moves.length > 0 ? moves : [{ x: 0, y: 0, z: 10, rapid: true, label: 'READY' }];
}

export default function CncSimulator({ code, domainKey, workSide, operation, templateName = '' }) {
  const [playing, setPlaying] = useState(true);
  const [stepIdx, setStepIdx] = useState(0);
  const [speed, setSpeed] = useState(1);

  const moves = useMemo(
    () => parseToolpath(code, domainKey, workSide, operation, templateName),
    [code, domainKey, workSide, operation, templateName]
  );

  useEffect(() => {
    setStepIdx(0);
    setPlaying(true);
  }, [moves]);

  useEffect(() => {
    if (!playing || moves.length === 0) return;
    const timer = setInterval(() => {
      setStepIdx((prev) => (prev + 1 >= moves.length ? 0 : prev + 1));
    }, Math.max(120, 480 / speed));
    return () => clearInterval(timer);
  }, [playing, moves, speed]);

  const current = moves[stepIdx] || moves[0];
  const history = moves.slice(0, stepIdx + 1);
  const tName = (templateName + ' ' + workSide).toUpperCase();

  const mapTurn = (pt) => {
    const svgX = 270 + (pt.z || 0) * 3.3;
    const svgY = 165 - (pt.x || 0) * 1.9;
    return { x: Math.max(78, Math.min(345, svgX)), y: Math.max(25, Math.min(165, svgY)) };
  };

  const mapMill = (pt) => {
    const svgX = 180 + (pt.x || 0) * 2.8;
    const svgY = 150 - (pt.y || 0) * 2.8;
    return { x: Math.max(40, Math.min(320, svgX)), y: Math.max(40, Math.min(260, svgY)) };
  };

  const toolPos = domainKey === 'Turning' ? mapTurn(current) : mapMill(current);

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col justify-between h-full min-h-[560px]">
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

      <div className="my-2 bg-[#060b16] border border-slate-800/90 rounded-xl overflow-hidden flex items-center justify-center relative">
        <svg viewBox="0 0 360 290" className="w-full h-[340px]">
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
                    stroke={m.rapid ? '#f43f5e' : '#10b981'}
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

              {/* Target Feature Outline (Pocket vs Spigot) */}
              {tName.includes('CIRCULAR POCKET') && (
                <circle cx="180" cy="150" r="62" fill="#060b16" fillOpacity="0.55" stroke="#38bdf8" strokeDasharray="4,3" strokeWidth="1.2" />
              )}
              {tName.includes('RECTANGULAR POCKET') && (
                <rect x="102" y="100" width="156" height="100" rx="4" fill="#060b16" fillOpacity="0.55" stroke="#38bdf8" strokeDasharray="4,3" strokeWidth="1.2" />
              )}
              {tName.includes('CIRCULAR SPIGOT') && (
                <circle cx="180" cy="150" r="46" fill="#38bdf8" fillOpacity="0.18" stroke="#38bdf8" strokeWidth="1.6" />
              )}
              {tName.includes('RECTANGULAR SPIGOT') && (
                <rect x="124" y="114" width="112" height="72" rx="4" fill="#38bdf8" fillOpacity="0.18" stroke="#38bdf8" strokeWidth="1.6" />
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
                      stroke={m.rapid ? '#f43f5e' : '#10b981'}
                      strokeWidth={m.rapid ? '1.2' : '2.8'}
                      strokeDasharray={m.rapid ? '4,3' : '0'}
                    />
                    {!m.rapid && operation !== 'Milling & Pocket' && (
                      <circle cx={p2.x} cy={p2.y} r="5" fill="#10b981" fillOpacity="0.35" stroke="#34d399" />
                    )}
                  </g>
                );
              })}

              <g transform={`translate(${toolPos.x}, ${toolPos.y})`}>
                <circle cx="0" cy="0" r="11" fill="#f59e0b" fillOpacity="0.25" stroke="#f59e0b" strokeWidth="1.8" />
                <line x1="-8" y1="-8" x2="8" y2="8" stroke="#fef08a" strokeWidth="1.5" />
                <line x1="8" y1="-8" x2="-8" y2="8" stroke="#fef08a" strokeWidth="1.5" />
                <circle cx="0" cy="0" r="3" fill="#10b981" />
              </g>
            </>
          )}
        </svg>

        <div className="absolute bottom-2 left-2.5 flex items-center gap-3 text-[10px] font-mono bg-slate-950/85 px-2.5 py-1 rounded-md border border-slate-800">
          <span className="flex items-center gap-1 text-rose-400">
            <span className="w-3 h-0.5 bg-rose-400 inline-block"></span> Rapid (G00)
          </span>
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="w-3 h-0.5 bg-emerald-400 inline-block"></span> Feed Cut (G01)
          </span>
          <span className="flex items-center gap-1 text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span> Tool
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
