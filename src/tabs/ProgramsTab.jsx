import React, { useMemo, useState } from 'react';

const CONTROLLERS = ['Siemens', 'Fanuc', 'Mitsubishi'];
const CATEGORIES = ['VMC', 'Turning', 'Turn-Mill', 'VTL'];
const OPERATIONS_BY_CAT = {
  VMC: ['Drilling', 'Tapping', 'Face Milling', 'Pocket Milling', 'Contour Milling', 'Slot Milling'],
  Turning: ['OD Turning', 'ID Turning', 'Facing', 'Threading', 'Grooving', 'Drilling', 'Tapping'],
  'Turn-Mill': ['Cross Drilling', 'Axial Drilling', 'Live Tapping', 'C-Axis Pocket', 'Slot Milling'],
  VTL: ['OD Turning', 'ID Turning', 'Facing', 'Live Drilling', 'Live Tapping', 'Contour Milling']
};

function generateProgramCode({ controller, category, operation, mfgCfg }) {
  const ctrl = String(controller || 'Siemens').toUpperCase();
  const op = String(operation || 'Drilling').toUpperCase();
  const depth = Math.abs(Number(mfgCfg.featureDepth || 10));
  const peck = Math.max(0.5, Number(mfgCfg.peckDepth || 8));
  const pitch = Number(mfgCfg.tapPitch || mfgCfg.threadPitch || 1.5);
  const rpm = Number(mfgCfg.spindleRpm || 1200);
  const feed = Number(mfgCfg.feedRate || 220);
  const xVal = Number(mfgCfg.stockX || 100);
  const yVal = Number(mfgCfg.stockY || 80);
  const zVal = Number(mfgCfg.stockZ || 40);
  const drillMode = mfgCfg.drillMode || 'Deep Hole Peck Drilling (G83 - Full Retract)';
  const tapMode = mfgCfg.tapMode || 'Standard Rigid Tapping (G84 - Single Pass)';

  if (ctrl.includes('SIEMENS')) {
    const lines = [
      '; SIEMENS SINUMERIK - ' + category.toUpperCase() + ' / ' + op,
      'T1 D1',
      'G94 S' + rpm + ' M03'
    ];
    if (op.includes('TAP')) {
      lines.push('CYCLE84(5.0, 0.0, 2.0, -' + depth.toFixed(1) + ', , ' + pitch.toFixed(2) + ', 3, ' + rpm + ', ' + rpm + ', 0.0, 0, 1, 0)');
    } else if (op.includes('DRILL')) {
      const vari = drillMode.includes('G73') ? 0 : 1;
      const cyc = drillMode.includes('G81') ? 'CYCLE81' : 'CYCLE83';
      lines.push(cyc + '(5.0, 0.0, 2.0, -' + depth.toFixed(1) + ', , ' + peck.toFixed(1) + ', , , , , ' + vari + ')');
    } else {
      lines.push('G01 X' + xVal.toFixed(1) + ' Y' + yVal.toFixed(1) + ' Z-' + depth.toFixed(1) + ' F' + feed);
    }
    lines.push('G00 Z100.0 M05');
    lines.push('M30');
    return lines.join('\n');
  }

  if (ctrl.includes('MITSUBISHI')) {
    const lines = [
      '%',
      'O3002 (MITSUBISHI - ' + op + ')',
      'G21 G40 G80 G94 G54 G90',
      'T01 M06',
      'S' + rpm + ' M03',
      'G43 H01 Z20.0'
    ];
    if (op.includes('TAP')) {
      const gTap = tapMode.includes('G74') ? 'G74' : 'G84';
      lines.push(gTap + ' X0.0 Y0.0 Z-' + depth.toFixed(1) + (tapMode.includes('Peck') ? ' Q' + peck.toFixed(1) : '') + ' R2.0 F' + pitch.toFixed(2) + ' ,R1');
      lines.push('G80');
    } else if (op.includes('DRILL')) {
      const gDrill = drillMode.includes('G81') ? 'G81' : drillMode.includes('G82') ? 'G82' : drillMode.includes('G73') ? 'G73' : 'G83';
      lines.push(gDrill + ' X0.0 Y0.0 Z-' + depth.toFixed(1) + (gDrill === 'G81' ? '' : ' Q' + peck.toFixed(1)) + ' R2.0 F' + feed);
      lines.push('G80');
    } else {
      lines.push('G01 X' + xVal.toFixed(1) + ' Y' + yVal.toFixed(1) + ' Z-' + depth.toFixed(1) + ' F' + feed);
    }
    lines.push('G00 Z50.0 M05');
    lines.push('M30');
    lines.push('%');
    return lines.join('\n');
  }

  // FANUC IF / GOTO MACRO
  const lines = [
    '%',
    'O1001 (FANUC IF-GOTO MACRO - ' + op + ')',
    'G21 G40 G80 G94 G54 G90',
    '#101 = ' + depth.toFixed(2) + ' (TOTAL DEPTH Z)',
    '#102 = ' + peck.toFixed(2) + ' (PECK / STEP Q)',
    '#103 = 0.0 (CURRENT DEPTH)',
    'T01 M06',
    'S' + rpm + ' M03',
    'G43 H01 Z20.0',
    'G00 X0.0 Y0.0 Z5.0'
  ];

  if (op.includes('TAP') && !tapMode.includes('Peck')) {
    lines.push('M29 S' + rpm);
    lines.push((tapMode.includes('G74') ? 'G74' : 'G84') + ' X0.0 Y0.0 Z-#101 R2.0 F' + pitch.toFixed(2));
    lines.push('G80');
    lines.push('GOTO 90');
  } else {
    lines.push('N10');
    lines.push('#103 = #103 + #102');
    lines.push('IF [#103 LE #101] GOTO 20');
    lines.push('#103 = #101');
    lines.push('N20');
    lines.push('G01 Z-[0 - #103] F' + (op.includes('TAP') ? pitch.toFixed(2) : feed));
    if (drillMode.includes('G73')) {
      lines.push('G00 Z-[0 - #103 + 1.0] (CHIP REMOVAL G73)');
    } else if (drillMode.includes('G82')) {
      lines.push('G04 P500');
      lines.push('G00 Z5.0');
    } else {
      lines.push('G00 Z5.0 (PECK RETRACT G83)');
    }
    lines.push('IF [#103 LT #101] GOTO 10');
    lines.push('GOTO 90');
  }

  lines.push('N90');
  lines.push('G00 Z50.0 M05');
  lines.push('M30');
  lines.push('%');
  return lines.join('\n');
}

export default function ProgramsTab() {
  const [controller, setController] = useState('Fanuc');
  const [category, setCategory] = useState('VMC');
  const [operation, setOperation] = useState('Drilling');
  const [copied, setCopied] = useState(false);

  const [mfgCfg, setMfgCfg] = useState({
    stockX: '100',
    stockY: '80',
    stockZ: '40',
    featureDepth: '20',
    peckDepth: '8',
    tapPitch: '1.5',
    threadPitch: '1.5',
    spindleRpm: '1200',
    feedRate: '220',
    toolLength: '35',
    drillMode: 'Deep Hole Peck Drilling (G83 - Full Retract)',
    tapMode: 'Standard Rigid Tapping (G84 - Single Pass)'
  });

  const availableOps = OPERATIONS_BY_CAT[category] || OPERATIONS_BY_CAT.VMC;
  const activeOp = availableOps.includes(operation) ? operation : availableOps[0];

  const generatedCode = useMemo(
    () => generateProgramCode({ controller, category, operation: activeOp, mfgCfg }),
    [controller, category, activeOp, mfgCfg]
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedCode);
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
                const nextCat = e.target.value;
                setCategory(nextCat);
                const ops = OPERATIONS_BY_CAT[nextCat] || ['Drilling'];
                setOperation(ops[0]);
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
              {availableOps.map((op) => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-800">
          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">Depth Z (mm)</label>
            <input
              type="number"
              step="0.5"
              value={mfgCfg.featureDepth}
              onChange={(e) => setMfgCfg({ ...mfgCfg, featureDepth: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 outline-none"
            />
          </div>

          {(activeOp === 'Drilling' || activeOp.includes('Drill') || activeOp === 'Tapping' || activeOp.includes('Tap')) && (
            <div>
              <label className="text-[11px] font-semibold text-amber-400 block mb-1">
                {activeOp.includes('Tap') ? 'Tapping Cycle' : 'Drilling / Chip Removal Cycle'}
              </label>
              {activeOp.includes('Tap') ? (
                <select
                  value={mfgCfg.tapMode}
                  onChange={(e) => setMfgCfg({ ...mfgCfg, tapMode: e.target.value })}
                  className="w-full bg-slate-950 border border-amber-500/50 rounded-lg px-2.5 py-1.5 text-xs text-amber-300 font-semibold outline-none"
                >
                  <option value="Standard Rigid Tapping (G84 - Single Pass)">Standard Rigid Tapping (G84 - Single Pass)</option>
                  <option value="Peck Chip-Break Tapping (G84 Q - Deep Hole)">Peck Chip-Break Tapping (G84 Q - Deep Hole)</option>
                  <option value="Left-Hand Reverse Tapping (G74)">Left-Hand Reverse Tapping (G74)</option>
                </select>
              ) : (
                <select
                  value={mfgCfg.drillMode}
                  onChange={(e) => setMfgCfg({ ...mfgCfg, drillMode: e.target.value })}
                  className="w-full bg-slate-950 border border-cyan-500/50 rounded-lg px-2.5 py-1.5 text-xs text-cyan-300 font-semibold outline-none"
                >
                  <option value="Standard Drilling (G81 - Direct)">Standard Drilling (G81 - Direct)</option>
                  <option value="Spot / Dwell Drilling (G82 - Bottom Dwell)">Spot / Dwell Drilling (G82 - Bottom Dwell)</option>
                  <option value="Chip-Breaking Peck Drilling (G73 - 1mm Retract)">Chip Removal / Chip-Break (G73)</option>
                  <option value="Deep Hole Peck Drilling (G83 - Full Retract)">Peck Drilling Retract (G83)</option>
                </select>
              )}
            </div>
          )}

          {(activeOp.includes('Drill') || activeOp.includes('Tap')) && (
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Peck Depth Q (mm)</label>
              <input
                type="number"
                step="0.5"
                value={mfgCfg.peckDepth}
                onChange={(e) => setMfgCfg({ ...mfgCfg, peckDepth: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 outline-none"
              />
            </div>
          )}

          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">RPM / Feed</label>
            <div className="flex gap-1.5">
              <input
                type="number"
                value={mfgCfg.spindleRpm}
                onChange={(e) => setMfgCfg({ ...mfgCfg, spindleRpm: e.target.value })}
                className="w-1/2 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 outline-none"
              />
              <input
                type="number"
                value={mfgCfg.feedRate}
                onChange={(e) => setMfgCfg({ ...mfgCfg, feedRate: e.target.value })}
                className="w-1/2 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-300">Generated NC Program</span>
          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-1 rounded-lg text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
          >
            {copied ? 'Copied' : 'Copy Code'}
          </button>
        </div>
        <pre className="text-xs font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap">{generatedCode}</pre>
      </div>
    </div>
  );
}
