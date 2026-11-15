import React, { useState } from 'react';
import { db } from '../db';
import { FileCode, Share2 } from 'lucide-react';

export default function ProgramsTab({ programs, refreshAllData, askGeminiAI, shareOnWhatsApp }) {
  const [form, setForm] = useState({
    title: '',
    machineType: 'Turning',
    controller: 'Fanuc',
    operation: 'OD Profile + Threading',
    code: '',
    notes: '',
  });
  const [aiPrompt, setAiPrompt] = useState('');
  const [generating, setGenerating] = useState(false);

  const generateProgram = async () => {
    if (!aiPrompt) return;
    setGenerating(true);
    const res = await askGeminiAI(
      `Write a clean, safe, production-ready CNC G-Code / M-Code program for ${form.machineType} (${form.controller} controller).
      Requirement: ${aiPrompt}. Include clear comments in parentheses.`
    );
    setForm({ ...form, code: res });
    setGenerating(false);
  };

  const saveProgram = async (e) => {
    e.preventDefault();
    if (!form.title || !form.code) return;
    await db.programs.add({
      ...form,
      createdAt: new Date().toISOString().split('T')[0],
      synced: false,
    });
    setForm({ title: '', machineType: 'Turning', controller: 'Fanuc', operation: '', code: '', notes: '' });
    refreshAllData();
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
        <h2 className="text-base font-bold text-cyan-400 flex items-center gap-2">
          <FileCode className="w-5 h-5" /> CNC Program Generator & Vault
        </h2>

        <div className="bg-slate-950 border border-indigo-500/30 rounded-xl p-3 space-y-2">
          <label className="text-xs font-semibold text-indigo-300">✨ Generate CNC Program with AI:</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. G71 OD roughing & G76 M20x2.5 threading on Fanuc Turning"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs"
            />
            <button
              type="button"
              onClick={generateProgram}
              disabled={generating}
              className="bg-indigo-600 hover:bg-indigo-500 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap"
            >
              {generating ? 'Writing...' : 'Generate Code'}
            </button>
          </div>
        </div>

        <form onSubmit={saveProgram} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <input
              type="text"
              placeholder="Program Name / Part No *"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
              required
            />
            <select
              value={form.machineType}
              onChange={(e) => setForm({ ...form, machineType: e.target.value })}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
            >
              <option>Turning</option>
              <option>VMC Milling</option>
              <option>HMC</option>
              <option>Automation / Macro</option>
            </select>
            <select
              value={form.controller}
              onChange={(e) => setForm({ ...form, controller: e.target.value })}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
            >
              <option>Fanuc</option>
              <option>Siemens</option>
              <option>Mitsubishi</option>
            </select>
          </div>

          <textarea
            rows="7"
            placeholder="Paste or edit G-Code / M-Code here *"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs font-mono text-emerald-300"
            required
          />

          <button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-500 py-2.5 rounded-lg font-semibold text-sm">
            Save Program to Vault
          </button>
        </form>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-400 uppercase">Saved Programs ({programs.length})</h3>
        {programs.map((p) => (
          <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-bold text-white">{p.title}</h4>
                <span className="text-xs text-cyan-400">{p.machineType} • {p.controller}</span>
              </div>
              <button
                onClick={() => shareOnWhatsApp(`*CNC Program: ${p.title}* (${p.controller})\n\n${p.code}`)}
                className="p-2 bg-emerald-600/20 text-emerald-400 rounded-lg"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
            <pre className="bg-slate-950 p-3 rounded-lg text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-48">
              {p.code}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}