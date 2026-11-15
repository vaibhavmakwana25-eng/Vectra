import React, { useState } from 'react';
import { db } from '../db';
import {
  Wrench, Camera, Sparkles, Save, MapPin, Navigation,
  Wand2, LocateFixed, Pencil, Trash2, Share2
} from 'lucide-react';
import {
  JYOTI_MACHINE_CASCADE,
  CONTROLLERS,
  APPLICATION_PURPOSES,
  CALL_TYPES,
  CALL_STATUSES,
} from './cncConstants';

export default function SiteVisitTab({
  siteVisits,
  dailyLogs,
  refreshAllData,
  askGeminiAI,
  fileToBase64,
  shareOnWhatsApp,
  openGoogleMapsPin,
  openGoogleMapsRoute,
  captureCurrentGPS,
}) {
  const getTodayDate = () => new Date().toISOString().split('T')[0];
  const getNowTime = () => new Date().toTimeString().slice(0, 5);

  const initialCategory = 'Turning';
  const initialSeries = Object.keys(JYOTI_MACHINE_CASCADE[initialCategory])[0];
  const initialModel = JYOTI_MACHINE_CASCADE[initialCategory][initialSeries][0];

  const [form, setForm] = useState({
    date: getTodayDate(),
    time: getNowTime(),
    callType: 'Site Visit',
    callStatus: 'Pending',
    customerName: '',
    location: '',
    machineType: initialCategory,
    machineSeries: initialSeries,
    machineModel: initialModel,
    controller: 'Fanuc',
    warranty: 'Under Warranty',
    callPurpose: 'Component Trial',
    issue: '',
    solution: '',
    photo: '',
  });

  const [editingId, setEditingId] = useState(null);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);
  const [detectingMenu, setDetectingMenu] = useState(false);
  const [menuStatus, setMenuStatus] = useState('');
  const [pinningGPS, setPinningGPS] = useState(false);
  const [gpsError, setGpsError] = useState('');

  // Filters: Year, Month, Date, Status
  const [filterYear, setFilterYear] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const resetForm = () => {
    setForm({
      date: getTodayDate(),
      time: getNowTime(),
      callType: 'Site Visit',
      callStatus: 'Pending',
      customerName: '',
      location: '',
      machineType: initialCategory,
      machineSeries: initialSeries,
      machineModel: initialModel,
      controller: 'Fanuc',
      warranty: 'Under Warranty',
      callPurpose: 'Component Trial',
      issue: '',
      solution: '',
      photo: '',
    });
    setEditingId(null);
    setAiSuggestion('');
    setMenuStatus('');
    setGpsError('');
  };

  const clearAllFilters = () => {
    setFilterYear('');
    setFilterMonth('');
    setFilterDate('');
    setFilterStatus('');
  };

  const handleCategoryChange = (newCategory) => {
    const seriesMap = JYOTI_MACHINE_CASCADE[newCategory] || {};
    const firstSeries = Object.keys(seriesMap)[0] || '';
    const firstModel = (seriesMap[firstSeries] || [])[0] || '';
    setForm({
      ...form,
      machineType: newCategory,
      machineSeries: firstSeries,
      machineModel: firstModel,
    });
  };

  const handleSeriesChange = (newSeries) => {
    const models = (JYOTI_MACHINE_CASCADE[form.machineType] || {})[newSeries] || [];
    setForm({
      ...form,
      machineSeries: newSeries,
      machineModel: models[0] || '',
    });
  };

  const handleModelChange = (newModel) => {
    setForm({ ...form, machineModel: newModel });
  };

  const handlePinHere = () => {
    captureCurrentGPS(
      form.location,
      (pinnedLoc) => setForm((prev) => ({ ...prev, location: pinnedLoc })),
      (errMsg) => setGpsError(errMsg),
      setPinningGPS
    );
  };

  const handlePhoto = async (e) => {
    if (e.target.files[0]) {
      const b64 = await fileToBase64(e.target.files[0]);
      setForm({ ...form, photo: b64 });
    }
  };

  const autoDetectMenuFromDescription = async () => {
    const desc = form.issue.trim();
    if (!desc) return;
    setDetectingMenu(true);
    setMenuStatus('');

    const lower = desc.toLowerCase();
    let nextCat = form.machineType;
    let nextSeries = form.machineSeries;
    let nextModel = form.machineModel;
    let nextCtrl = form.controller;
    let nextPurp = form.callPurpose;

    if (
      lower.includes('vibrat') ||
      lower.includes('chatter') ||
      lower.includes('noise') ||
      lower.includes('finish') ||
      lower.includes('rough') ||
      lower.includes('taper') ||
      lower.includes('oval') ||
      lower.includes('burr') ||
      lower.includes('accuracy') ||
      lower.includes('alarm') ||
      lower.includes('error') ||
      lower.includes('issue') ||
      lower.includes('problem') ||
      lower.includes('troubleshoot')
    ) {
      nextPurp = 'Vibration / Chatter / Troubleshooting';
    } else if (lower.includes('train') || lower.includes('operator') || lower.includes('sikha')) {
      nextPurp = 'Customer Training';
    } else if (lower.includes('cycle') || lower.includes('time') || lower.includes('fast') || lower.includes('reduc')) {
      nextPurp = 'Cycle Time Reduction';
    } else if (lower.includes('program') || lower.includes('macro') || lower.includes('g-code') || lower.includes('gcode') || lower.includes('subprogram')) {
      nextPurp = 'Programming / Macro';
    } else if (lower.includes('fixture') || lower.includes('clamp') || lower.includes('chuck') || lower.includes('jaw')) {
      nextPurp = 'Fixture / Clamping Check';
    } else if (
      lower.includes('tool') ||
      lower.includes('insert') ||
      lower.includes('cut') ||
      lower.includes('grade') ||
      lower.includes('thread') ||
      lower.includes('groov') ||
      lower.includes('parting') ||
      lower.includes('drill') ||
      lower.includes('tap') ||
      lower.includes('boring')
    ) {
      nextPurp = 'Tooling / Process Trial';
    } else if (lower.includes('trial') || lower.includes('component') || lower.includes('part') || lower.includes('prove')) {
      nextPurp = 'Component Trial';
    }

    if (lower.includes('siemens') || lower.includes('828d') || lower.includes('840d')) {
      nextCtrl = 'Siemens';
    } else if (lower.includes('mitsubishi') || lower.includes('m80') || lower.includes('m70')) {
      nextCtrl = 'Mitsubishi';
    } else if (lower.includes('fanuc') || lower.includes('0i')) {
      nextCtrl = 'Fanuc';
    }

    let modelMatched = false;
    for (const [cat, seriesObj] of Object.entries(JYOTI_MACHINE_CASCADE)) {
      for (const [ser, models] of Object.entries(seriesObj)) {
        for (const mdl of models) {
          if (lower.includes(mdl.toLowerCase())) {
            nextCat = cat;
            nextSeries = ser;
            nextModel = mdl;
            modelMatched = true;
            break;
          }
        }
        if (modelMatched) break;
      }
      if (modelMatched) break;
    }

    if (!modelMatched) {
      let detectedCat = '';
      if (lower.includes('5-axis') || lower.includes('5 axis') || lower.includes('five') || lower.includes('mtx') || lower.includes('abx')) {
        detectedCat = '5-Axis / Multi-Tasking';
      } else if (lower.includes('hmc') || lower.includes('horizontal')) {
        detectedCat = 'HMC';
      } else if (lower.includes('vtl') || lower.includes('vertical turret')) {
        detectedCat = 'VTL';
      } else if (lower.includes('vmc') || lower.includes('tachyon') || lower.includes('milling') || lower.includes('pocket') || lower.includes('face mill')) {
        detectedCat = 'VMC';
      } else if (lower.includes('turn') || lower.includes('lathe') || lower.includes('dx') || lower.includes('thread') || lower.includes('od ') || lower.includes('id ')) {
        detectedCat = 'Turning';
      }
      if (detectedCat && detectedCat !== form.machineType) {
        nextCat = detectedCat;
        const sMap = JYOTI_MACHINE_CASCADE[nextCat] || {};
        nextSeries = Object.keys(sMap)[0] || '';
        nextModel = (sMap[nextSeries] || [])[0] || '';
      }
    }

    setForm((prev) => ({
      ...prev,
      machineType: nextCat,
      machineSeries: nextSeries,
      machineModel: nextModel,
      controller: nextCtrl,
      callPurpose: nextPurp,
    }));

    const hasKey = Boolean(localStorage.getItem('vectra_gemini_key')?.trim());
    if (!hasKey) {
      setMenuStatus(`✅ Selected: ${nextCat} • ${nextModel} • ${nextCtrl} • ${nextPurp}`);
      setDetectingMenu(false);
      return;
    }

    const allCategories = Object.keys(JYOTI_MACHINE_CASCADE);
    const prompt = `Pick closest match from lists for: "${desc}"
Categories: ${JSON.stringify(allCategories)}
Cascade: ${JSON.stringify(JYOTI_MACHINE_CASCADE)}
Controllers: ${JSON.stringify(CONTROLLERS)}
Purposes: ${JSON.stringify(APPLICATION_PURPOSES)}
Return ONLY valid JSON: {"category":"","series":"","model":"","controller":"","purpose":""}`;

    const raw = await askGeminiAI(prompt, form.photo || null);
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (allCategories.includes(parsed.category)) nextCat = parsed.category;
        const seriesMap = JYOTI_MACHINE_CASCADE[nextCat] || {};
        const allSeries = Object.keys(seriesMap);
        if (allSeries.includes(parsed.series)) nextSeries = parsed.series;
        else if (!allSeries.includes(nextSeries)) nextSeries = allSeries[0] || '';
        const models = seriesMap[nextSeries] || [];
        if (models.includes(parsed.model)) nextModel = parsed.model;
        else if (!models.includes(nextModel)) nextModel = models[0] || '';
        if (CONTROLLERS.includes(parsed.controller)) nextCtrl = parsed.controller;
        if (APPLICATION_PURPOSES.includes(parsed.purpose)) nextPurp = parsed.purpose;

        setForm((prev) => ({
          ...prev,
          machineType: nextCat,
          machineSeries: nextSeries,
          machineModel: nextModel,
          controller: nextCtrl,
          callPurpose: nextPurp,
        }));
      }
      setMenuStatus(`✅ Auto-selected: ${nextCat} • ${nextModel} • ${nextCtrl} • ${nextPurp}`);
    } catch {
      setMenuStatus(`✅ Selected: ${nextCat} • ${nextModel} • ${nextCtrl} • ${nextPurp}`);
    }
    setDetectingMenu(false);
  };

  const checkPastAndAI = async () => {
    if (!form.issue) return;
    setLoadingAI(true);
    const res = await askGeminiAI(
      `Machine: ${form.machineType} | ${form.machineSeries} | ${form.machineModel}, Controller: ${form.controller}, Purpose: ${form.callPurpose}. Issue/Detail: ${form.issue}`
    );
    setAiSuggestion(res);
    setLoadingAI(false);
  };

  const handleEditRecord = (v) => {
    const validCat = JYOTI_MACHINE_CASCADE[v.machineType] ? v.machineType : initialCategory;
    const seriesMap = JYOTI_MACHINE_CASCADE[validCat];
    const validSeries = seriesMap[v.machineSeries] ? v.machineSeries : Object.keys(seriesMap)[0];
    const models = seriesMap[validSeries] || [];
    const validModel = models.includes(v.machineModel) ? v.machineModel : (models[0] || '');

    const normalizedStatus =
      v.status === 'Solved' ? 'Solved / Closed' : (v.status || 'Pending');

    setForm({
      date: v.date || getTodayDate(),
      time: v.time || getNowTime(),
      callType: v.callType || 'Site Visit',
      callStatus: CALL_STATUSES.includes(normalizedStatus) ? normalizedStatus : 'Pending',
      customerName: v.customerName || '',
      location: v.location || '',
      machineType: validCat,
      machineSeries: validSeries,
      machineModel: validModel,
      controller: v.controller || 'Fanuc',
      warranty: v.warranty || 'Under Warranty',
      callPurpose: v.callPurpose || 'Component Trial',
      issue: v.issue || '',
      solution: v.solution || '',
      photo: v.photo || '',
    });
    setEditingId(v.id);
    setAiSuggestion('');
    setMenuStatus('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleQuickStatusChange = async (v, newStatus) => {
    await db.siteVisits.update(v.id, { status: newStatus });
    const linkedLog = dailyLogs.find((l) => l.siteVisitId === v.id);
    if (linkedLog) {
      await db.dailyLogs.update(linkedLog.id, {
        status: newStatus === 'Solved / Closed' ? 'Done' : 'Pending',
      });
    }
    refreshAllData();
  };

  const handleDeleteRecord = async (v) => {
    if (!window.confirm(`Delete application record for "${v.customerName}"?`)) return;
    await db.siteVisits.delete(v.id);
    const linkedLog = dailyLogs.find((l) => l.siteVisitId === v.id);
    if (linkedLog) {
      await db.dailyLogs.delete(linkedLog.id);
    }
    if (editingId === v.id) {
      resetForm();
    }
    refreshAllData();
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.customerName || !form.issue) return;

    const visitDate = form.date || getTodayDate();
    const visitTime = form.time || getNowTime();
    const finalStatus =
      form.solution && form.solution.trim() && form.callStatus === 'Pending'
        ? 'Solved / Closed'
        : form.callStatus;
    const logStatus = finalStatus === 'Solved / Closed' ? 'Done' : 'Pending';

    const visitPayload = {
      date: visitDate,
      time: visitTime,
      callType: form.callType,
      customerName: form.customerName,
      location: form.location,
      machineType: form.machineType,
      machineSeries: form.machineSeries,
      machineModel: form.machineModel,
      controller: form.controller,
      warranty: form.warranty,
      callPurpose: form.callPurpose,
      issue: form.issue,
      solution: form.solution,
      photo: form.photo,
      status: finalStatus,
    };

    const dailyLogPayload = {
      logType: form.callType === 'Site Visit' ? 'Application Visit' : form.callType,
      customerName: form.customerName,
      location: form.location,
      machineType: `${form.machineType} • ${form.machineModel}`,
      issue: `[${form.callPurpose}] ${form.issue}`,
      solution: form.solution,
      status: logStatus,
      date: visitDate,
      time: visitTime,
    };

    if (editingId !== null) {
      await db.siteVisits.update(editingId, visitPayload);
      const linkedLog = dailyLogs.find((l) => l.siteVisitId === editingId);
      if (linkedLog) {
        await db.dailyLogs.update(linkedLog.id, dailyLogPayload);
      } else {
        await db.dailyLogs.add({
          ...dailyLogPayload,
          siteVisitId: editingId,
          synced: false,
        });
      }
    } else {
      const newVisitId = await db.siteVisits.add({
        ...visitPayload,
        synced: false,
      });
      await db.dailyLogs.add({
        ...dailyLogPayload,
        siteVisitId: newVisitId,
        synced: false,
      });
    }

    resetForm();
    refreshAllData();
  };

  const currentSeriesList = Object.keys(JYOTI_MACHINE_CASCADE[form.machineType] || {});
  const currentModelsList = (JYOTI_MACHINE_CASCADE[form.machineType] || {})[form.machineSeries] || [];

  const availableYears = Array.from(
    new Set([
      new Date().getFullYear().toString(),
      ...siteVisits.map((v) => (v.date || '').slice(0, 4)).filter(Boolean),
    ])
  ).sort((a, b) => b.localeCompare(a));

  const hasActiveFilter = Boolean(
    filterYear || filterMonth || filterDate || filterStatus
  );

  const filteredVisits = siteVisits.filter((v) => {
    const d = v.date || '';
    const vStatus = v.status === 'Solved' ? 'Solved / Closed' : (v.status || 'Pending');

    if (filterDate && d !== filterDate) return false;
    if (!filterDate && filterYear && !d.startsWith(filterYear)) return false;
    if (!filterDate && filterMonth && d.slice(5, 7) !== filterMonth) return false;
    if (filterStatus && vStatus !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className={`bg-slate-900 border ${editingId !== null ? 'border-amber-500/60' : 'border-slate-800'} rounded-2xl p-4 space-y-4`}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-cyan-400 flex items-center gap-2">
            <Wrench className="w-5 h-5" />
            {editingId !== null ? 'Edit Application Call / Visit' : 'New Application Call / Visit'}
          </h2>
          {editingId !== null && (
            <button
              type="button"
              onClick={resetForm}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-amber-300 px-2.5 py-1 rounded-lg border border-amber-500/30"
            >
              Cancel Edit
            </button>
          )}
        </div>

        <form onSubmit={handleSave} className="space-y-3">
          {/* Top Row: Date, Time, Call Type Dropdown, Status Dropdown */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5">
              <span className="text-[11px] text-slate-400">Date:</span>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="flex-1 bg-transparent text-xs text-white outline-none min-w-0"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5">
              <span className="text-[11px] text-slate-400">Time:</span>
              <input
                type="time"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
                className="flex-1 bg-transparent text-xs text-white outline-none min-w-0"
              />
            </div>

            <select
              value={form.callType}
              onChange={(e) => setForm({ ...form, callType: e.target.value })}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
              title="Call Type"
            >
              {CALL_TYPES.map((ct) => (
                <option key={ct} value={ct}>{ct}</option>
              ))}
            </select>

            <select
              value={form.callStatus}
              onChange={(e) => setForm({ ...form, callStatus: e.target.value })}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs font-semibold text-amber-300"
              title="Call Status"
            >
              {CALL_STATUSES.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Customer / Company Name *"
              value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
              required
            />
            <div className="space-y-1">
              <div className="flex flex-wrap sm:flex-nowrap gap-2">
                <input
                  type="text"
                  placeholder="Area, City or tap Pin Here →"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="w-full sm:flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={handlePinHere}
                  disabled={pinningGPS}
                  className="flex-1 sm:flex-initial justify-center py-2 px-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg flex items-center gap-1 text-xs font-semibold shrink-0"
                  title="Capture current Area & City right here"
                >
                  <LocateFixed className={`w-4 h-4 ${pinningGPS ? 'animate-spin' : ''}`} />
                  {pinningGPS ? 'Pinning...' : 'Pin Here'}
                </button>
                <button
                  type="button"
                  onClick={() => openGoogleMapsPin(form.location)}
                  disabled={!form.location.trim()}
                  className="flex-1 sm:flex-initial justify-center py-2 px-3 bg-emerald-600/20 hover:bg-emerald-600/30 disabled:opacity-40 text-emerald-300 border border-emerald-500/30 rounded-lg flex items-center gap-1 text-xs font-semibold shrink-0"
                  title="Open location in Google Maps"
                >
                  <MapPin className="w-4 h-4" /> Map
                </button>
              </div>
              {gpsError && <p className="text-[11px] text-rose-400">{gpsError}</p>}
            </div>
          </div>

          <textarea
            rows="2"
            placeholder="Write call description / trial requirement first *"
            value={form.issue}
            onChange={(e) => setForm({ ...form, issue: e.target.value })}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
            required
          />

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-slate-400">Auto-select menu from description:</span>
              <button
                type="button"
                onClick={autoDetectMenuFromDescription}
                disabled={detectingMenu || !form.issue.trim()}
                className="inline-flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-semibold"
              >
                <Wand2 className="w-3.5 h-3.5" />
                {detectingMenu ? 'Selecting...' : 'AI Auto-Select Menu'}
              </button>
            </div>
            {menuStatus && <p className="text-[11px] text-emerald-400">{menuStatus}</p>}
          </div>

          {/* 3-Level Jyoti Machine Cascade: Category -> Series -> Model + Controller + Purpose */}
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select
                value={form.machineType}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-sm"
                title="Machine Category"
              >
                {Object.keys(JYOTI_MACHINE_CASCADE).map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              <select
                value={form.machineSeries}
                onChange={(e) => handleSeriesChange(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-sm"
                title="Machine Series"
              >
                {currentSeriesList.map((ser) => (
                  <option key={ser} value={ser}>{ser}</option>
                ))}
              </select>

              <select
                value={form.machineModel}
                onChange={(e) => handleModelChange(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-sm font-semibold text-cyan-300"
                title="Machine Model"
              >
                {currentModelsList.map((mdl) => (
                  <option key={mdl} value={mdl}>{mdl}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select
                value={form.controller}
                onChange={(e) => setForm({ ...form, controller: e.target.value })}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-sm"
                title="CNC Controller"
              >
                {CONTROLLERS.map((ctrl) => (
                  <option key={ctrl} value={ctrl}>{ctrl}</option>
                ))}
              </select>

              <select
                value={form.callPurpose}
                onChange={(e) => setForm({ ...form, callPurpose: e.target.value })}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-sm"
                title="Call Purpose"
              >
                {APPLICATION_PURPOSES.map((purp) => (
                  <option key={purp} value={purp}>{purp}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="cursor-pointer inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-2 rounded-lg text-xs font-medium">
              <Camera className="w-4 h-4 text-cyan-400" />
              {form.photo ? 'Photo Attached ✅' : 'Add Machine / Diagram Photo'}
              <input type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
            </label>

            <button
              type="button"
              onClick={checkPastAndAI}
              disabled={loadingAI}
              className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 px-3 py-2 rounded-lg text-xs font-semibold"
            >
              <Sparkles className="w-4 h-4" />
              {loadingAI ? 'Checking...' : 'Get AI & Past Solution'}
            </button>
          </div>

          {aiSuggestion && (
            <div className="bg-indigo-950/50 border border-indigo-500/40 rounded-xl p-3 text-xs text-slate-200 whitespace-pre-wrap space-y-2">
              <div>{aiSuggestion}</div>
              <button
                type="button"
                onClick={() => setForm({ ...form, solution: aiSuggestion })}
                className="text-cyan-400 underline font-medium"
              >
                Copy to Outcome ↓
              </button>
            </div>
          )}

          <textarea
            rows="2"
            placeholder="Final Application Outcome / Remarks"
            value={form.solution}
            onChange={(e) => setForm({ ...form, solution: e.target.value })}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
          />

          <button
            type="submit"
            className={`w-full ${editingId !== null ? 'bg-amber-600 hover:bg-amber-500' : 'bg-cyan-600 hover:bg-cyan-500'} text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2`}
          >
            <Save className="w-4 h-4" />
            {editingId !== null ? 'Update Application Record & Daily Log' : 'Save Application Record'}
          </button>
        </form>
      </div>

      {/* Filter Panel + Saved Records */}
      <div className="space-y-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-bold text-slate-300 uppercase tracking-wider">
              Call / Visit Records ({filteredVisits.length} of {siteVisits.length})
            </h3>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-xs text-cyan-400 hover:underline font-medium"
              >
                Reset Filters
              </button>
            )}
          </div>

          {/* Single Row: Year, Month, Date, Status */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <select
              value={filterYear}
              onChange={(e) => {
                setFilterYear(e.target.value);
                setFilterDate('');
              }}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
            >
              <option value="">All Years</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>

            <select
              value={filterMonth}
              onChange={(e) => {
                setFilterMonth(e.target.value);
                setFilterDate('');
              }}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
            >
              <option value="">All Months</option>
              <option value="01">Jan</option>
              <option value="02">Feb</option>
              <option value="03">Mar</option>
              <option value="04">Apr</option>
              <option value="05">May</option>
              <option value="06">Jun</option>
              <option value="07">Jul</option>
              <option value="08">Aug</option>
              <option value="09">Sep</option>
              <option value="10">Oct</option>
              <option value="11">Nov</option>
              <option value="12">Dec</option>
            </select>

            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
              title="Filter by Exact Date"
            />

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
            >
              <option value="">All Status</option>
              {CALL_STATUSES.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>
        </div>

        {filteredVisits.length === 0 && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 text-center text-xs text-slate-400">
            No records found.
          </div>
        )}

        {filteredVisits.map((v) => {
          const displayStatus = v.status === 'Solved' ? 'Solved / Closed' : (v.status || 'Pending');
          return (
            <div key={v.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-[11px] font-mono text-cyan-400">
                      📅 {v.date}{v.time ? ` • ⏰ ${v.time}` : ''}
                    </span>
                    <span className="text-[11px] bg-slate-800 text-slate-200 px-2 py-0.5 rounded">
                      {v.callType || 'Site Visit'}
                    </span>
                  </div>

                  <h4 className="font-bold text-white flex flex-wrap items-center gap-2">
                    <span>{v.customerName}</span>
                    {v.location && (
                      <button
                        type="button"
                        onClick={() => openGoogleMapsRoute(v.location)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-cyan-400 hover:text-cyan-300 underline"
                        title="Open location in Google Maps"
                      >
                        <Navigation className="w-3.5 h-3.5" /> {v.location} (Map)
                      </button>
                    )}
                  </h4>

                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    <span className="text-[11px] bg-cyan-500/15 text-cyan-300 px-2 py-0.5 rounded">
                      {v.machineType}{v.machineSeries ? ` • ${v.machineSeries}` : ''} • {v.machineModel}
                    </span>
                    <span className="text-[11px] bg-blue-500/15 text-blue-300 px-2 py-0.5 rounded">{v.controller}</span>
                    <span className="text-[11px] bg-indigo-500/15 text-indigo-300 px-2 py-0.5 rounded">{v.callPurpose}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
                  <select
                    value={displayStatus}
                    onChange={(e) => handleQuickStatusChange(v, e.target.value)}
                    className={`text-[11px] font-bold px-2 py-1 rounded-lg border outline-none ${
                      displayStatus === 'Solved / Closed'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : displayStatus === 'Follow-up Required'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    }`}
                    title="Change Call Status"
                  >
                    {CALL_STATUSES.map((st) => (
                      <option key={st} value={st} className="bg-slate-900 text-white">
                        {st}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => handleEditRecord(v)}
                    className="p-2 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 rounded-lg"
                    title="Edit Record"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteRecord(v)}
                    className="p-2 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 rounded-lg"
                    title="Delete Record"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      shareOnWhatsApp(
                        `*VECTRA Application Report*\nDate: ${v.date} ${v.time || ''}\nCall Type: ${v.callType || 'Site Visit'} (${displayStatus})\nCustomer: ${v.customerName}\nLocation: ${v.location || 'N/A'}\nMachine: ${v.machineType} - ${v.machineSeries ? v.machineSeries + ' - ' : ''}${v.machineModel} (${v.controller})\nPurpose: ${v.callPurpose}\nDetails: ${v.issue}\nOutcome: ${v.solution || 'In Progress'}`
                      )
                    }
                    className="p-2 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 rounded-lg"
                    title="Share on WhatsApp"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-rose-300"><strong>Call Detail:</strong> {v.issue}</p>
              {v.solution && <p className="text-xs text-emerald-300"><strong>Outcome:</strong> {v.solution}</p>}
              {v.photo && <img src={v.photo} alt="Machine" className="w-28 h-20 object-cover rounded-lg border border-slate-700" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
