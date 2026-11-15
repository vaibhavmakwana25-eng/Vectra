import React, { useState, useMemo } from 'react';
import { db } from '../db';
import { Wrench, Sparkles, Save } from 'lucide-react';

const OPERATIONS = {
  Turning: [
    'OD Rough Turning',
    'OD Finish Turning',
    'ID Rough Boring',
    'ID Finish Boring',
    'Facing',
    'OD Grooving',
    'ID Grooving',
    'Face Grooving',
    'Parting Off',
    'External Threading',
    'Internal Threading',
    'Center Drilling',
    'HSS Drilling',
    'Solid Carbide Drilling',
    'U-Drilling',
    'Tapping',
    'Reaming'
  ],
  Milling: [
    'Face Milling',
    'Rough Shoulder Milling',
    'Finish Shoulder Milling',
    'Pocket Milling',
    'Slot Milling',
    'Chamfering',
    'Center Drilling',
    'Spot Drilling',
    'HSS Drilling',
    'Solid Carbide Drilling',
    'U-Drilling',
    'Rigid Tapping',
    'Thread Milling',
    'Reaming',
    'Rough Boring',
    'Fine Boring'
  ]
};

const MATERIALS = [
  { name: 'Mild Steel', vc: 180, feedFactor: 1.0 },
  { name: 'EN8', vc: 165, feedFactor: 0.95 },
  { name: 'EN19', vc: 145, feedFactor: 0.85 },
  { name: 'EN24', vc: 130, feedFactor: 0.80 },
  { name: 'SS 304', vc: 120, feedFactor: 0.75 },
  { name: 'SS 316', vc: 105, feedFactor: 0.70 },
  { name: 'SS 410', vc: 140, feedFactor: 0.85 },
  { name: 'SS 420', vc: 135, feedFactor: 0.80 },
  { name: 'Aluminium 6061', vc: 450, feedFactor: 1.3 },
  { name: 'Aluminium 6082', vc: 420, feedFactor: 1.25 },
  { name: 'Cast Iron', vc: 170, feedFactor: 1.1 },
  { name: 'SG Iron', vc: 150, feedFactor: 1.0 },
  { name: 'Brass', vc: 300, feedFactor: 1.2 },
  { name: 'Copper', vc: 260, feedFactor: 1.1 },
  { name: 'Inconel', vc: 45, feedFactor: 0.5 },
  { name: 'Titanium', vc: 55, feedFactor: 0.55 }
];

const TAP_SIZES = [
  { label: 'M3', dia: 3, defaultPitch: '0.5', pitches: ['0.5', '0.35'] },
  { label: 'M4', dia: 4, defaultPitch: '0.7', pitches: ['0.7', '0.5'] },
  { label: 'M5', dia: 5, defaultPitch: '0.8', pitches: ['0.8', '0.5'] },
  { label: 'M6', dia: 6, defaultPitch: '1.0', pitches: ['1.0', '0.75'] },
  { label: 'M8', dia: 8, defaultPitch: '1.25', pitches: ['1.25', '1.0', '0.75'] },
  { label: 'M10', dia: 10, defaultPitch: '1.5', pitches: ['1.5', '1.25', '1.0', '0.75'] },
  { label: 'M12', dia: 12, defaultPitch: '1.75', pitches: ['1.75', '1.5', '1.25', '1.0'] },
  { label: 'M14', dia: 14, defaultPitch: '2.0', pitches: ['2.0', '1.5', '1.25', '1.0'] },
  { label: 'M16', dia: 16, defaultPitch: '2.0', pitches: ['2.0', '1.5', '1.0'] },
  { label: 'M18', dia: 18, defaultPitch: '2.5', pitches: ['2.5', '2.0', '1.5', '1.0'] },
  { label: 'M20', dia: 20, defaultPitch: '2.5', pitches: ['2.5', '2.0', '1.5', '1.0'] },
  { label: 'M22', dia: 22, defaultPitch: '2.5', pitches: ['2.5', '2.0', '1.5', '1.0'] },
  { label: 'M24', dia: 24, defaultPitch: '3.0', pitches: ['3.0', '2.0', '1.5'] },
  { label: 'M27', dia: 27, defaultPitch: '3.0', pitches: ['3.0', '2.0', '1.5'] },
  { label: 'M30', dia: 30, defaultPitch: '3.5', pitches: ['3.5', '3.0', '2.0', '1.5'] },
  { label: 'M36', dia: 36, defaultPitch: '4.0', pitches: ['4.0', '3.0', '2.0'] }
];

const TURNING_INSERTS = ['CNMG', 'TNMG', 'WNMG', 'DNMG', 'VNMG', 'CCMT', 'DCMT', 'Grooving Insert', 'Threading Insert'];
const NOSE_RADII = ['0.2', '0.4', '0.8', '1.2'];
const MILLING_TOOLS = ['Indexable Face Mill', 'Indexable Endmill', 'Solid Carbide Endmill', 'Chamfer Cutter', 'Boring Bar'];
const FLUTE_COUNTS = ['2', '3', '4', '5', '6', '8'];
const PITCH_OPTIONS = ['0.5', '0.7', '0.8', '1.0', '1.25', '1.5', '1.75', '2.0', '2.5', '3.0', '3.5', '4.0'];

export default function ToolingTab({ toolingTrials = [], refreshAllData, askGeminiAI }) {
  const [customerName, setCustomerName] = useState('');
  const [processType, setProcessType] = useState('Turning');
  const [operation, setOperation] = useState('OD Rough Turning');
  const [material, setMaterial] = useState('Mild Steel');
  const [dia, setDia] = useState('50');
  const [tapSize, setTapSize] = useState('M10');
  const [length, setLength] = useState('60');
  const [insertShape, setInsertShape] = useState('CNMG');
  const [noseRadius, setNoseRadius] = useState('0.8');
  const [millingTool, setMillingTool] = useState('Indexable Face Mill');
  const [flutes, setFlutes] = useState('4');
  const [pitch, setPitch] = useState('1.5');
  const [doc, setDoc] = useState('1.5');
  const [aiAdvice, setAiAdvice] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);

  const isTapping = operation.includes('Tapping');
  const isThreading = operation.includes('Threading');
  const isHoleOp = operation.includes('Drilling') || isTapping || operation === 'Reaming';
  const isTapOrThread = isTapping || isThreading;

  const selectedTapObj = TAP_SIZES.find(t => t.label === tapSize) || TAP_SIZES[5];

  const handleProcessChange = (val) => {
    setProcessType(val);
    setOperation(OPERATIONS[val][0]);
  };

  const handleOperationChange = (val) => {
    setOperation(val);
    if (val.includes('Tapping')) {
      const tObj = TAP_SIZES.find(t => t.label === tapSize) || TAP_SIZES[5];
      setDia(String(tObj.dia));
      setPitch(tObj.defaultPitch);
    }
  };

  const handleTapSizeChange = (val) => {
    setTapSize(val);
    const tObj = TAP_SIZES.find(t => t.label === val);
    if (tObj) {
      setDia(String(tObj.dia));
      setPitch(tObj.defaultPitch);
    }
  };

  const calc = useMemo(() => {
    const matObj = MATERIALS.find(m => m.name === material) || MATERIALS[0];
    const d = Math.max(isTapping ? selectedTapObj.dia : (parseFloat(dia) || 0), 0.1);
    const len = parseFloat(length) || 0;
    const depthCut = parseFloat(doc) || 0.5;
    const p = parseFloat(pitch) || 1.0;
    const r = parseFloat(noseRadius) || 0.8;
    const z = parseInt(flutes, 10) || 4;

    let vc = matObj.vc;
    let fRev = 0.2 * matObj.feedFactor;

    if (operation.includes('Finish') || operation === 'Fine Boring') {
      vc = Math.round(vc * 1.25);
      fRev = +(r * 0.22 * matObj.feedFactor).toFixed(3);
    } else if (operation.includes('Rough') || operation === 'Facing') {
      vc = Math.round(vc * 0.9);
      fRev = +(r * 0.38 * matObj.feedFactor).toFixed(3);
    } else if (operation.includes('Grooving') || operation === 'Parting Off') {
      vc = Math.round(vc * 0.75);
      fRev = +(0.08 * matObj.feedFactor).toFixed(3);
    } else if (operation.includes('HSS Drilling') || operation === 'Center Drilling' || operation === 'Spot Drilling') {
      vc = Math.round(vc * 0.22);
      fRev = +(Math.min(0.015 * d, 0.35) * matObj.feedFactor).toFixed(3);
    } else if (operation === 'Solid Carbide Drilling') {
      vc = Math.round(vc * 0.55);
      fRev = +(Math.min(0.02 * d, 0.45) * matObj.feedFactor).toFixed(3);
    } else if (operation === 'U-Drilling') {
      vc = Math.round(vc * 0.85);
      fRev = +(0.1 * matObj.feedFactor).toFixed(3);
    } else if (operation === 'Reaming') {
      vc = Math.round(vc * 0.2);
      fRev = +(0.25 * matObj.feedFactor).toFixed(3);
    } else if (operation === 'Thread Milling') {
      vc = Math.round(vc * 0.65);
      fRev = +(0.05 * z * matObj.feedFactor).toFixed(3);
    }

    if (depthCut > 2.5 && !isHoleOp && !isTapOrThread) {
      vc = Math.round(vc * 0.88);
    }
    if (len > d * 3 && len > 0) {
      vc = Math.round(vc * 0.85);
      fRev = +(fRev * 0.85).toFixed(3);
    }

    let rpm = Math.round((vc * 1000) / (Math.PI * d));

    if (isTapping) {
      vc = Math.round(matObj.vc * 0.08);
      rpm = Math.min(Math.max(Math.round((vc * 1000) / (Math.PI * d)), 80), 450);
      fRev = p;
    } else if (isThreading) {
      vc = Math.round(matObj.vc * 0.45);
      rpm = Math.min(Math.round((vc * 1000) / (Math.PI * d)), 1200);
      fRev = p;
    } else if (processType === 'Milling' && !isHoleOp && !isTapOrThread) {
      const fz = operation.includes('Finish') ? 0.06 : 0.12;
      fRev = +(fz * z * matObj.feedFactor).toFixed(3);
    }

    const fMin = Math.round(rpm * fRev);
    return { vc, rpm, fRev, fMin };
  }, [material, dia, tapSize, selectedTapObj, length, doc, pitch, noseRadius, flutes, operation, processType, isTapping, isThreading, isHoleOp, isTapOrThread]);

  const diaLabel = isTapping
    ? 'Tap Size'
    : operation === 'Reaming'
    ? 'Reamer Dia (mm)'
    : isHoleOp
    ? 'Drill Dia (mm)'
    : processType === 'Turning'
    ? 'Workpiece Dia (mm)'
    : 'Cutter Dia (mm)';

  const lengthLabel = isHoleOp
    ? 'Hole Depth (mm)'
    : processType === 'Turning'
    ? 'Workpiece Length (mm)'
    : 'Tool Stickout Length (mm)';

  const handleSave = async () => {
    await db.toolingTrials.add({
      customerName: customerName || 'General',
      operation: `${processType} - ${operation}`,
      material,
      dia: isTapping ? `${tapSize} x ${pitch}` : dia,
      length,
      toolType: isTapping ? `${tapSize} Tap` : isHoleOp ? operation : processType === 'Turning' ? `${insertShape} R${noseRadius}` : `${millingTool} ${flutes}F`,
      doc: isTapOrThread ? `Pitch ${pitch}` : doc,
      rpm: calc.rpm.toString(),
      feed: `${calc.fRev} mm/rev (${calc.fMin} mm/min)`
    });
    if (refreshAllData) refreshAllData();
  };

  const handleAI = async () => {
    if (!askGeminiAI) return;
    setLoadingAI(true);
    try {
      const spec = isTapping ? `${tapSize} x ${pitch}mm` : `Dia: ${dia}mm, DOC: ${doc}mm`;
      const prompt = `CNC ${processType} - ${operation} on ${material}, ${spec}, Length: ${length}mm. Calculated RPM: ${calc.rpm}, Feed: ${calc.fRev} mm/rev (${calc.fMin} mm/min). Give brief practical shop-floor advice.`;
      const res = await askGeminiAI(prompt);
      setAiAdvice(res);
    } catch {
      setAiAdvice('Unable to fetch AI advice right now.');
    }
    setLoadingAI(false);
  };

  return (
    <div className="space-y-4 pb-24">
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-4 shadow-lg">
        <div className="flex items-center gap-2 text-cyan-400 font-bold text-base border-b border-slate-800 pb-2.5">
          <Wrench className="w-5 h-5" />
          <span>Tooling & Cutting Parameters</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Customer Name</label>
            <input
              type="text"
              placeholder="Enter customer name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-cyan-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Process Type</label>
            <select
              value={processType}
              onChange={(e) => handleProcessChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-cyan-500 outline-none"
            >
              <option value="Turning">Turning</option>
              <option value="Milling">Milling</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Operation</label>
            <select
              value={operation}
              onChange={(e) => handleOperationChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-cyan-500 outline-none"
            >
              {OPERATIONS[processType].map((op) => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Material</label>
            <select
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-cyan-500 outline-none"
            >
              {MATERIALS.map((m) => (
                <option key={m.name} value={m.name}>{m.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">{diaLabel}</label>
            {isTapping ? (
              <select
                value={tapSize}
                onChange={(e) => handleTapSizeChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-cyan-500 outline-none"
              >
                {TAP_SIZES.map((t) => (
                  <option key={t.label} value={t.label}>{t.label}</option>
                ))}
              </select>
            ) : (
              <input
                type="number"
                value={dia}
                onChange={(e) => setDia(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-cyan-500 outline-none"
              />
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">{lengthLabel}</label>
            <input
              type="number"
              value={length}
              onChange={(e) => setLength(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-cyan-500 outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {isTapping ? (
            <>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Thread Pitch (mm)</label>
                <select
                  value={pitch}
                  onChange={(e) => setPitch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-cyan-500 outline-none"
                >
                  {selectedTapObj.pitches.map((p) => (
                    <option key={p} value={p}>
                      {p} mm {p === selectedTapObj.defaultPitch ? '(Standard)' : '(Fine)'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Tap Drill Size (mm)</label>
                <input
                  type="text"
                  readOnly
                  value={`${+(selectedTapObj.dia - parseFloat(pitch)).toFixed(2)} mm`}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-cyan-300 font-semibold outline-none"
                />
              </div>
            </>
          ) : isThreading ? (
            <>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Thread Pitch (mm)</label>
                <select
                  value={pitch}
                  onChange={(e) => setPitch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-cyan-500 outline-none"
                >
                  {PITCH_OPTIONS.map((p) => (
                    <option key={p} value={p}>{p} mm</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Custom Pitch (mm)</label>
                <input
                  type="number"
                  step="0.05"
                  value={pitch}
                  onChange={(e) => setPitch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-cyan-500 outline-none"
                />
              </div>
            </>
          ) : isHoleOp ? (
            <>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Tool Type</label>
                <input
                  type="text"
                  readOnly
                  value={operation}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-cyan-300 outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Peck Depth (mm)</label>
                <input
                  type="number"
                  step="0.5"
                  value={doc}
                  onChange={(e) => setDoc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-cyan-500 outline-none"
                />
              </div>
            </>
          ) : processType === 'Turning' ? (
            <>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Insert Shape</label>
                <select
                  value={insertShape}
                  onChange={(e) => setInsertShape(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-cyan-500 outline-none"
                >
                  {TURNING_INSERTS.map((ins) => (
                    <option key={ins} value={ins}>{ins}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Nose Radius (mm)</label>
                <select
                  value={noseRadius}
                  onChange={(e) => setNoseRadius(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-cyan-500 outline-none"
                >
                  {NOSE_RADII.map((r) => (
                    <option key={r} value={r}>{r} mm</option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Cutter Type</label>
                <select
                  value={millingTool}
                  onChange={(e) => setMillingTool(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-cyan-500 outline-none"
                >
                  {MILLING_TOOLS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Number of Flutes</label>
                <select
                  value={flutes}
                  onChange={(e) => setFlutes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-cyan-500 outline-none"
                >
                  {FLUTE_COUNTS.map((f) => (
                    <option key={f} value={f}>{f} Flutes</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {!isHoleOp && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Depth of Cut - DOC (mm)</label>
              <input
                type="number"
                step="0.1"
                value={doc}
                onChange={(e) => setDoc(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-cyan-500 outline-none"
              />
            </div>
          )}
        </div>

        <div className="bg-slate-950 border border-cyan-500/40 rounded-2xl p-3.5 grid grid-cols-3 gap-2 text-center shadow-inner">
          <div className="border-r border-slate-800 pr-1">
            <div className="text-[10px] text-slate-400 uppercase tracking-wide">Cutting Speed</div>
            <div className="text-lg sm:text-xl font-extrabold text-white mt-0.5">{calc.vc}</div>
            <div className="text-[10px] text-cyan-400">m/min</div>
          </div>
          <div className="border-r border-slate-800 px-1">
            <div className="text-[10px] text-slate-400 uppercase tracking-wide">Spindle Speed</div>
            <div className="text-lg sm:text-xl font-extrabold text-cyan-400 mt-0.5">{calc.rpm}</div>
            <div className="text-[10px] text-slate-400">RPM</div>
          </div>
          <div className="pl-1">
            <div className="text-[10px] text-slate-400 uppercase tracking-wide">Feed Rate</div>
            <div className="text-sm sm:text-base font-extrabold text-emerald-400 mt-0.5">{calc.fRev} <span className="text-[10px] font-normal">mm/rev</span></div>
            <div className="text-xs sm:text-sm font-bold text-white">{calc.fMin} <span className="text-[10px] font-normal text-slate-400">mm/min</span></div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleSave}
            className="w-full py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition"
          >
            <Save className="w-4 h-4" /> Save Tooling Trial
          </button>
          <button
            type="button"
            onClick={handleAI}
            disabled={loadingAI}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-cyan-500/40 text-cyan-300 font-semibold text-sm flex items-center justify-center gap-2 transition"
          >
            <Sparkles className="w-4 h-4" /> {loadingAI ? 'Analyzing...' : 'Ask AI Advice'}
          </button>
        </div>

        {aiAdvice && (
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 whitespace-pre-wrap">
            {aiAdvice}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
          Saved Tooling Trials ({toolingTrials.length})
        </h3>
        {toolingTrials.map((t) => (
          <div key={t.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs space-y-1">
            <div className="flex justify-between font-bold text-white">
              <span>{t.material} - {t.operation} ({t.dia})</span>
              <span className="text-cyan-400">{t.toolType}</span>
            </div>
            <div className="text-slate-300">
              RPM: <strong>{t.rpm}</strong> | Feed: <strong>{t.feed}</strong> | DOC: <strong>{t.doc}</strong> | Customer: {t.customerName}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
