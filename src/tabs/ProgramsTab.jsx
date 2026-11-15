import React, { useMemo, useState } from 'react';

const CONTROLLERS = ['Siemens', 'Fanuc (IF/GOTO Macro)', 'Mitsubishi'];
const CATEGORIES = ['VMC', 'Turning', 'Turn-Mill', 'VTL'];
const OPS_BY_CAT = {
  VMC: ['Drilling', 'Tapping', 'Face Milling', 'Pocket Milling', 'Contour Milling', 'Slot Milling'],
  Turning: ['OD Turning', 'ID Turning', 'Facing', 'Threading', 'Grooving', 'Drilling', 'Tapping'],
  'Turn-Mill': ['Cross Drilling', 'Axial Drilling', 'Live Tapping', 'C-Axis Pocket', 'Slot Milling'],
  VTL: ['OD Turning', 'ID Turning', 'Facing', 'Live Drilling', 'Live Tapping', 'Contour Milling']
};

function buildFreshProgram({ controller, category, operation, cfg }) {
  const ctrl = String(controller || 'Fanuc (IF/GOTO Macro)').toUpperCase();
  const cat = String(category || 'VMC').toUpperCase();
  const op = String(operation || 'Drilling').toUpperCase();

  const xVal = Number(cfg.x || 100);
  const yVal = Number(cfg.y || 80);
  const zLen = Math.max(5, Number(cfg.zLen || 40));
  const depth = Math.abs(Number(cfg.depth || 20));
  const peck = Math.max(0.5, Number(cfg.peck || 8));
  const pitch = Number(cfg.pitch || 1.5);
  const rpm = Number(cfg.rpm || 1200);
  const feed = Number(cfg.feed || 220);
  const drillMode = cfg.drillMode || 'G83';
  const tapMode = cfg.tapMode || 'G84';

  if (ctrl.includes('SIEMENS')) {
    const out = [
      '; SIEMENS SINUMERIK | ' + cat + ' | ' + op,
      'T1 D1',
      'G94 S' + rpm + ' M03'
    ];
    if (cat.includes('TURN-MILL') || (cat === 'VTL' && op.includes('LIVE'))) {
      out.push('SPOS=0');
      out.push('M13');
    }
    if (op.includes('TAP')) {
      out.push('CYCLE84(5.0, 0.0, 2.0, -' + depth.toFixed(1) + ', , ' + pitch.toFixed(2) + ', 3, ' + rpm + ', ' + rpm + ', 0.0, 0, 1, 0)');
    } else if (op.includes('DRILL')) {
      const vari = drillMode === 'G73' ? 0 : 1;
      const cyc = drillMode === 'G81' ? 'CYCLE81' : 'CYCLE83';
      out.push(cyc + '(5.0, 0.0, 2.0, -' + depth.toFixed(1) + ', , ' + peck.toFixed(1) + ', , , , , ' + vari + ')');
    } else if (op.includes('POCKET') || op.includes('SLOT')) {
      out.push('POCKET4(5.0, 0.0, 2.0, -' + depth.toFixed(1) + ', ' + Math.max(10, yVal * 0.4).toFixed(1) + ', ' + Math.max(10, xVal * 0.4).toFixed(1) + ', 0.0, 0.0, ' + peck.toFixed(1) + ', 0.2, 0.1, ' + feed + ', ' + Math.round(feed * 0.7) + ', 1, 21)');
    } else {
      out.push('G01 X' + xVal.toFixed(1) + ' Y' + yVal.toFixed(1) + ' Z-' + depth.toFixed(1) + ' F' + feed);
    }
    out.push('G00 Z100.0 M05');
    out.push('M30');
    return out.join('\n');
  }

  if (ctrl.includes('MITSUBISHI')) {
    const out = [
      '%',
      'O4002 (MITSUBISHI ' + cat + ' - ' + op + ')',
      'G21 G40 G80 G94 G54 G90',
      'T01 M06',
      'S' + rpm + (cat.includes('TURN-MILL') || (cat === 'VTL' && op.includes('LIVE')) ? ' M13' : ' M03'),
      'G43 H01 Z20.0'
    ];
    if (cat.includes('TURN-MILL')) {
      out.push('G00 C0.0');
    }
    if (op.includes('TAP')) {
      const gTap = tapMode === 'G74' ? 'G74' : 'G84';
      out.push(gTap + ' X0.0 Y0.0 Z-' + depth.toFixed(1) + (tapMode === 'G84Q' ? ' Q' + peck.toFixed(1) : '') + ' R2.0 F' + pitch.toFixed(2) + ' ,R1');
      out.push('G80');
    } else if (op.includes('DRILL')) {
      const gDrill = ['G81', 'G82', 'G73', 'G83'].includes(drillMode) ? drillMode : 'G83';
      out.push(gDrill + ' X0.0 Y0.0 Z-' + depth.toFixed(1) + (gDrill === 'G81' ? '' : ' Q' + peck.toFixed(1)) + ' R2.0 F' + feed);
      out.push('G80');
    } else {
      out.push('G01 X' + xVal.toFixed(1) + ' Y' + yVal.toFixed(1) + ' Z-' + depth.toFixed(1) + ' F' + feed);
    }
    out.push('G00 Z50.0 M05');
    out.push('M30');
    out.push('%');
    return out.join('\n');
  }

  // FANUC IF / GOTO MACRO (VMC, TURNING, TURN-MILL, VTL)
  const out = [
    '%',
    'O5001 (FANUC IF-GOTO MACRO | ' + cat + ' | ' + op + ')',
    'G21 G40 G80 G94 G54 G90',
    '#101 = ' + depth.toFixed(2) + ' (TARGET DEPTH / STROKE)',
    '#102 = ' + peck.toFixed(2) + ' (PECK / STEP Q)',
    '#103 = ' + xVal.toFixed(2) + ' (X / DIA SPAN)',
    '#104 = ' + yVal.toFixed(2) + ' (Y / TARGET)',
    '#105 = ' + zLen.toFixed(2) + ' (Z LENGTH)',
    '#106 = 0.0 (LOOP STEP COUNTER)',
    'T01 M06',
    'S' + rpm + (cat.includes('TURN-MILL') || (cat === 'VTL' && op.includes('LIVE')) ? ' M13' : ' M03'),
    'G43 H01 Z20.0'
  ];

  if (cat.includes('TURN-MILL')) {
    out.push('#107 = 4.0 (INDEX COUNT)');
    out.push('#108 = 90.0 (C STEP DEG)');
    out.push('#109 = 0.0 (CURRENT C ANGLE)');
    out.push('G00 C0.0 X0.0 Y0.0 Z5.0');
    out.push('N10');
    out.push('G00 C#109');
    out.push('G01 Z-[0 - #101] F' + (op.includes('TAP') ? pitch.toFixed(2) : feed));
    out.push('G00 Z5.0');
    out.push('#109 = #109 + #108');
    out.push('IF [#109 LT 360.0] GOTO 10');
    out.push('GOTO 90');
  } else if (op.includes('TAP') && tapMode === 'G84') {
    out.push('G00 X0.0 Y0.0 Z5.0');
    out.push('M29 S' + rpm);
    out.push('G84 X0.0 Y0.0 Z-#101 R2.0 F' + pitch.toFixed(2));
    out.push('G80');
    out.push('GOTO 90');
  } else if (op.includes('DRILL') || op.includes('TAP')) {
    out.push('G00 X0.0 Y0.0 Z5.0');
    out.push('N10');
    out.push('#106 = #106 + #102');
    out.push('IF [#106 LE #101] GOTO 20');
    out.push('#106 = #101');
    out.push('N20');
    out.push('G01 Z-[0 - #106] F' + (op.includes('TAP') ? pitch.toFixed(2) : feed));
    if (drillMode === 'G73') {
      out.push('G00 Z-[0 - #106 + 1.0] (CHIP REMOVAL G73)');
    } else if (drillMode === 'G82') {
      out.push('G04 P500');
      out.push('G00 Z5.0');
    } else {
      out.push('G00 Z5.0 (PECK RETRACT G83)');
    }
    out.push('IF [#106 LT #101] GOTO 10');
    out.push('GOTO 90');
  } else {
    out.push('N10');
    out.push('#106 = #106 + #102');
    out.push('IF [#106 LE #101] GOTO 20');
    out.push('#106 = #101');
    out.push('N20');
    out.push('G00 X0.0 Y0.0 Z2.0');
    out.push('G01 Z-[0 - #106] F' + Math.max(60, Math.round(feed * 0.6)));
    out.push('G01 X#103 Y#104 F' + feed);
    out.push('G00 Z5.0');
    out.push('IF [#106 LT #101] GOTO 10');
    out.push('GOTO 90');
  }

  out.push('N90');
  out.push('G00 Z50.0 M05');
  out.push('M30');
  out.push('%');
  return out.join('\n');
}

export default function ProgramsTab() {
  const [controller, setController] = useState('Fanuc (IF/GOTO Macro)');
  const [category, setCategory] = useState('VMC');
  const [operation, setOperation] = useState('Drilling');
  const [copied, setCopied] = useState(false);

  const [cfg, setCfg] = useState({
    x: '100',
    y: '80',
    zLen: '40',
    depth: '20',
    peck: '8',
    pitch: '1.5',
    rpm: '1200',
    feed: '220',
    drillMode: 'G83',
    tapMode: 'G84'
  });

  const ops = OPS_BY_CAT[category] || OPS_BY_CAT.VMC;
  const activeOp = ops.includes(operation) ? operation : ops[0];

  const programText = useMemo(
    () => buildFreshProgram({ controller, category, operation: activeOp, cfg }),
    [controller, category, activeOp, cfg]
  );

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(programText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-4 p-3 md:p-4 text-slate-100">
      <div className="rounded-2xl bg-slate-900/95 border border-slate-800 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-cyan-300">CNC Program Studio & Vault</h2>
          <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-slate-300">
            {controller} • {category} • {activeOp}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">Controller</label>
            <select
              value={controller}
              onChange={(e) => setController(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-100 outline-none"
            >
              {CONTROLLERS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">Machine Category</label>
            <select
              value={category}
              onChange={(e) => {
                const next = e.target.value;
                setCategory(next);
                const nextOps = OPS_BY_CAT[next] || ['Drilling'];
                setOperation(nextOps[0]);
              }}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-100 outline-none"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">Operation</label>
            <select
              value={activeOp}
              onChange={(e) => setOperation(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-100 outline-none"
            >
              {ops.map((op) => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2 border-t border-slate-800">
          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">Depth Z (mm)</label>
            <input
              type="number"
              step="0.5"
              value={cfg.depth}
              onChange={(e) => setCfg({ ...cfg, depth: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">Peck / Step Q</label>
            <input
              type="number"
              step="0.5"
              value={cfg.peck}
              onChange={(e) => setCfg({ ...cfg, peck: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">X / Y Span</label>
            <div className="flex gap-1.5">
              <input
                type="number"
                value={cfg.x}
                onChange={(e) => setCfg({ ...cfg, x: e.target.value })}
                className="w-1/2 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 outline-none"
              />
              <input
                type="number"
                value={cfg.y}
                onChange={(e) => setCfg({ ...cfg, y: e.target.value })}
                className="w-1/2 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">RPM / Feed</label>
            <div className="flex gap-1.5">
              <input
                type="number"
                value={cfg.rpm}
                onChange={(e) => setCfg({ ...cfg, rpm: e.target.value })}
                className="w-1/2 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 outline-none"
              />
              <input
                type="number"
                value={cfg.feed}
                onChange={(e) => setCfg({ ...cfg, feed: e.target.value })}
                className="w-1/2 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 outline-none"
              />
            </div>
          </div>

          {activeOp.includes('Tap') ? (
            <div>
              <label className="text-[11px] font-semibold text-amber-400 block mb-1">Tapping Cycle</label>
              <select
                value={cfg.tapMode}
                onChange={(e) => setCfg({ ...cfg, tapMode: e.target.value })}
                className="w-full bg-slate-950 border border-amber-500/50 rounded-lg px-2.5 py-1.5 text-xs text-amber-300 font-semibold outline-none"
              >
                <option value="G84">Rigid Tapping (G84)</option>
                <option value="G84Q">Peck Tapping (G84 Q)</option>
                <option value="G74">Left-Hand Tap (G74)</option>
              </select>
            </div>
          ) : (
            <div>
              <label className="text-[11px] font-semibold text-cyan-400 block mb-1">Drilling Cycle</label>
              <select
                value={cfg.drillMode}
                onChange={(e) => setCfg({ ...cfg, drillMode: e.target.value })}
                className="w-full bg-slate-950 border border-cyan-500/50 rounded-lg px-2.5 py-1.5 text-xs text-cyan-300 font-semibold outline-none"
              >
                <option value="G81">Standard Drill (G81)</option>
                <option value="G82">Spot / Dwell (G82)</option>
                <option value="G73">Chip Removal (G73)</option>
                <option value="G83">Peck Drill (G83)</option>
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-300">Generated NC Program</span>
          <button
            type="button"
            onClick={onCopy}
            className="px-3 py-1 rounded-lg text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
          >
            {copied ? 'Copied' : 'Copy Code'}
          </button>
        </div>
        <pre className="text-xs font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap">{programText}</pre>
      </div>
    </div>
  );
}
