import React, { useState } from 'react';
import { db } from '../db';
import { Cpu, Sparkles } from 'lucide-react';

export default function ToolingTab({ toolingTrials, refreshAllData, askGeminiAI }) {
  const [form, setForm] = useState({
    customerName: '',
    operation: 'OD Turning',
    material: 'MS (Mild Steel)',
    dia: '',
    length: '',
    toolType: 'CNMG 120408',
    insertGrade: 'Carbide CVD',
    rpm: '',
    feed: '',
    doc: '',
    notes: '',
  });
  const [vc, setVc] = useState('180');
  const [aiAdvice, setAiAdvice] = useState('');

  const calcRPM = () => {
    const d = parseFloat(form.dia);
    const v = parseFloat(vc);
    if (d > 0 && v > 0) {
      const calculated = Math.round((v * 1000) / (Math.PI * d));
      setForm({ ...form, rpm: calculated.toString() });
    }
  };

  const getToolingAI = async () => {
    const res = await askGeminiAI(
      `Suggest optimal CNC cutting parameters (Vc, RPM, Feed, Depth of Cut, Coolant, Insert Grade) for:
      Operation: ${form.operation}, Material: ${form.material}, Diameter: ${form.dia}mm, Length: ${form.length}mm, Tool: ${form.toolType}.`
    );
    setAiAdvice(res);
  };

  const saveTrial = async (e) => {
    e.preventDefault();
    await db.toolingTrials.add({
      ...form,
      date: new Date().toISOString().split('T')[0],
      synced: false,
    });
    setForm({ ...form, dia: '', length: '', rpm: '', feed: '', doc: '', notes: '' });
    refreshAllData();
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
        <h2 className="text-base font-bold text-cyan-400 flex items-center gap-2">
          <Cpu className="w-5 h-5" /> Tooling & Cutting Parameters Calculator
        </h2>

        <form onSubmit={saveTrial} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <input
              type="text"
              placeholder="Customer Name"
              value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
            />
            <select
              value={form.operation}
              onChange={(e) => setForm({ ...form, operation: e.target.value })}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
            >
              <option>OD Turning</option>
              <option>ID Boring</option>
              <option>Facing</option>
              <option>Grooving / Parting</option>
              <option>Threading</option>
              <option>Face Milling</option>
              <option>End Milling / Pocket</option>
              <option>Drilling / Tapping</option>
            </select>
            <select
              value={form.material}
              onChange={(e) => setForm({ ...form, material: e.target.value })}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
            >
              <option>MS (Mild Steel)</option>
              <option>EN8 / EN19 / EN24</option>
              <option>SS 304</option>
              <option>SS 316</option>
              <option>SS 410 / 420</option>
              <option>Aluminium 6061 / 6082</option>
              <option>Cast Iron (CI / SG Iron)</option>
              <option>Brass / Copper</option>
              <option>Inconel / Titanium</option>
            </select>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <input
              type="number"
              placeholder="Workpiece/Tool Dia (mm)"
              value={form.dia}
              onChange={(e) => setForm({ ...form, dia: e.target.value })}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="number"
              placeholder="Length / Depth (mm)"
              value={form.length}
              onChange={(e) => setForm({ ...form, length: e.target.value })}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="Insert / Tool (e.g. CNMG120408)"
              value={form.toolType}
              onChange={(e) => setForm({ ...form, toolType: e.target.value })}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="Grade (e.g. TNMG / PVD)"
              value={form.insertGrade}
              onChange={(e) => setForm({ ...form, insertGrade: e.target.value })}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400">Cutting Speed (Vc m/min):</span>
            <input
              type="number"
              value={vc}
              onChange={(e) => setVc(e.target.value)}
              className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
            />
            <button
              type="button"
              onClick={calcRPM}
              className="bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 px-2.5 py-1 rounded text-xs font-semibold"
            >
              Auto-Calc RPM
            </button>
            <button
              type="button"
              onClick={getToolingAI}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded text-xs font-semibold ml-auto flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5" /> AI Tooling Advice
            </button>
          </div>

          {aiAdvice && (
            <div className="bg-indigo-950/50 border border-indigo-500/40 rounded-xl p-3 text-xs whitespace-pre-wrap">
              {aiAdvice}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2.5">
            <input
              type="text"
              placeholder="RPM (e.g. 1200)"
              value={form.rpm}
              onChange={(e) => setForm({ ...form, rpm: e.target.value })}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="Feed (mm/rev or mm/min)"
              value={form.feed}
              onChange={(e) => setForm({ ...form, feed: e.target.value })}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="DOC (mm)"
              value={form.doc}
              onChange={(e) => setForm({ ...form, doc: e.target.value })}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-500 py-2.5 rounded-lg font-semibold text-sm">
            Save Tooling Trial
          </button>
        </form>
      </div>

      <div className="space-y-2.5">
        <h3 className="text-sm font-bold text-slate-400 uppercase">Saved Tooling Trials ({toolingTrials.length})</h3>
        {toolingTrials.map((t) => (
          <div key={t.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs space-y-1">
            <div className="flex justify-between font-bold text-white">
              <span>{t.material} — {t.operation} (Ø{t.dia}mm)</span>
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