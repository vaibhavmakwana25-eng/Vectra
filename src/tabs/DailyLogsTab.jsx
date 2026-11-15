import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { db } from '../db';
import {
  CalendarCheck, Navigation, Pencil, Trash2,
  Building2, Home, Factory, Clock, Filter, FileSpreadsheet
} from 'lucide-react';
import { JYOTI_MACHINE_CASCADE, CONTROLLERS } from './cncConstants';

const MONTHS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const ENGINEER_DEPARTMENTS = ['Application', 'Service', 'Sales', 'H/O'];
const SERVICE_SUB_DEPARTMENTS = ['Electrical', 'Mechanical'];

const CALL_CONTROLLERS =
  CONTROLLERS && CONTROLLERS.length > 0
    ? CONTROLLERS.filter((c) => ['Siemens', 'Fanuc', 'Mitsubishi'].includes(c))
    : ['Siemens', 'Fanuc', 'Mitsubishi'];

const splitAreaAndCity = (locationStr) => {
  if (!locationStr) return { area: '', city: '' };
  const parts = locationStr.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return {
      area: parts.slice(0, -1).join(', '),
      city: parts[parts.length - 1],
    };
  }
  return { area: parts[0] || '', city: parts[0] || '' };
};

const buildYearWorkbook = (allLogs, targetYear, activeMonthCode) => {
  const wb = XLSX.utils.book_new();
  const yearLogs = allLogs.filter((l) => (l.date || '').startsWith(`${targetYear}-`));

  const orderedMonths = activeMonthCode
    ? [
        ...MONTHS.filter((m) => m.value === activeMonthCode),
        ...MONTHS.filter((m) => m.value !== activeMonthCode),
      ]
    : MONTHS;

  orderedMonths.forEach((m) => {
    const monthPrefix = `${targetYear}-${m.value}-`;
    const rows = yearLogs
      .filter((l) => (l.date || '').startsWith(monthPrefix))
      .sort((a, b) => {
        const dCmp = (a.date || '').localeCompare(b.date || '');
        if (dCmp !== 0) return dCmp;
        return (a.time || '').localeCompare(b.time || '');
      })
      .map((item) => {
        const { area, city } = splitAreaAndCity(item.location || '');
        return {
          Date: item.date || '',
          Time: item.time || '',
          'Activity Type': item.logType || '',
          'Customer / Engineer': item.customerName || '',
          Area: item.area || area || '',
          City: item.city || city || '',
          'Machine / Department': item.machineType || '',
          Controller: item.controller || '',
          'Problem / Discussion': item.issue || '',
          'Solution / Action Taken': item.solution || '',
          Status: item.status || '',
        };
      });

    const headers = [
      'Date',
      'Time',
      'Activity Type',
      'Customer / Engineer',
      'Area',
      'City',
      'Machine / Department',
      'Controller',
      'Problem / Discussion',
      'Solution / Action Taken',
      'Status',
    ];

    const ws =
      rows.length > 0
        ? XLSX.utils.json_to_sheet(rows, { header: headers })
        : XLSX.utils.aoa_to_sheet([headers]);

    XLSX.utils.book_append_sheet(wb, ws, m.label);
  });

  return wb;
};
export default function DailyLogsTab({
  dailyLogs,
  siteVisits,
  refreshAllData,
  openGoogleMapsRoute,
  captureCurrentGPS,
}) {
  const getTodayDate = () => new Date().toISOString().split('T')[0];
  const getNowTime = () => new Date().toTimeString().slice(0, 5);

  const defaultMachineType = Object.keys(JYOTI_MACHINE_CASCADE)[0] || 'Turning';
  const defaultSeriesList = Object.keys(JYOTI_MACHINE_CASCADE[defaultMachineType] || {});
  const defaultSeries = defaultSeriesList[0] || '';
  const defaultModels = (JYOTI_MACHINE_CASCADE[defaultMachineType]?.[defaultSeries]) || [];
  const defaultModel = defaultModels[0] || '';

  const todayStr = getTodayDate();
  const [selectedYear, setSelectedYear] = useState(todayStr.slice(0, 4));
  const [selectedMonth, setSelectedMonth] = useState(todayStr.slice(5, 7));
  const [selectedDay, setSelectedDay] = useState(todayStr.slice(8, 10));

  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterMachine, setFilterMachine] = useState('');
  const [filterArea, setFilterArea] = useState('');
  const [filterCity, setFilterCity] = useState('');

  const [autoSaveExcel, setAutoSaveExcel] = useState(true);
  const lastSavedCountRef = useRef(null);

  const [form, setForm] = useState({
    logType: 'Phone Call with Customer',
    customerName: '',
    engineerName: '',
    department: 'Application',
    serviceSubDept: 'Electrical',
    area: '',
    city: '',
    machineType: defaultMachineType,
    machineSeries: defaultSeries,
    machineModel: defaultModel,
    controller: CALL_CONTROLLERS[0] || 'Siemens',
    issue: '',
    solution: '',
    status: 'Done',
  });
  const [editingLogId, setEditingLogId] = useState(null);
  const [checkingIn, setCheckingIn] = useState('');

  const isEngineerCall = form.logType === 'Phone Call with Engineer';
  const isServiceDept = form.department === 'Service';

  const seriesOptions = useMemo(() => {
    return Object.keys(JYOTI_MACHINE_CASCADE[form.machineType] || {});
  }, [form.machineType]);

  const modelOptions = useMemo(() => {
    return JYOTI_MACHINE_CASCADE[form.machineType]?.[form.machineSeries] || [];
  }, [form.machineType, form.machineSeries]);

  const handleMachineTypeChange = (newType) => {
    const nextSeriesList = Object.keys(JYOTI_MACHINE_CASCADE[newType] || {});
    const nextSeries = nextSeriesList[0] || '';
    const nextModelList = JYOTI_MACHINE_CASCADE[newType]?.[nextSeries] || [];
    setForm((prev) => ({
      ...prev,
      machineType: newType,
      machineSeries: nextSeries,
      machineModel: nextModelList[0] || '',
    }));
  };

  const handleMachineSeriesChange = (newSeries) => {
    const nextModelList = JYOTI_MACHINE_CASCADE[form.machineType]?.[newSeries] || [];
    setForm((prev) => ({
      ...prev,
      machineSeries: newSeries,
      machineModel: nextModelList[0] || '',
    }));
  };

  const resetLogForm = () => {
    setForm({
      logType: 'Phone Call with Customer',
      customerName: '',
      engineerName: '',
      department: 'Application',
      serviceSubDept: 'Electrical',
      area: '',
      city: '',
      machineType: defaultMachineType,
      machineSeries: defaultSeries,
      machineModel: defaultModel,
      controller: CALL_CONTROLLERS[0] || 'Siemens',
      issue: '',
      solution: '',
      status: 'Done',
    });
    setEditingLogId(null);
  };

  // 1. Available Years
  const availableYears = useMemo(() => {
    const years = new Set([new Date().getFullYear().toString()]);
    dailyLogs.forEach((l) => {
      if (l.date && l.date.length >= 4) years.add(l.date.slice(0, 4));
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [dailyLogs]);

  // 2. Days in selected Year + Month
  const availableDays = useMemo(() => {
    const y = parseInt(selectedYear, 10) || new Date().getFullYear();
    const m = parseInt(selectedMonth, 10) || (new Date().getMonth() + 1);
    const totalDays = new Date(y, m, 0).getDate();
    const list = [];
    for (let d = 1; d <= totalDays; d++) {
      const dd = String(d).padStart(2, '0');
      const iso = `${selectedYear || y}-${selectedMonth || String(m).padStart(2, '0')}-${dd}`;
      const hasLog = dailyLogs.some((l) => l.date === iso);
      list.push({ dd, hasLog });
    }
    return list;
  }, [selectedYear, selectedMonth, dailyLogs]);

  // 4 Filter Dropdown Lists: Customer Name, Machine, Area, City
  const filterOptions = useMemo(() => {
    const customers = new Set();
    const machines = new Set();
    const areas = new Set();
    const cities = new Set();

    dailyLogs.forEach((l) => {
      if (l.customerName) customers.add(l.customerName.trim());
      if (l.machineType) machines.add(l.machineType.trim());
      if (l.location) {
        const { area, city } = splitAreaAndCity(l.location);
        if (area) areas.add(area);
        if (city) cities.add(city);
      }
      if (l.area) areas.add(l.area.trim());
      if (l.city) cities.add(l.city.trim());
    });

    return {
      customers: Array.from(customers).sort((a, b) => a.localeCompare(b)),
      machines: Array.from(machines).sort((a, b) => a.localeCompare(b)),
      areas: Array.from(areas).sort((a, b) => a.localeCompare(b)),
      cities: Array.from(cities).sort((a, b) => a.localeCompare(b)),
    };
  }, [dailyLogs]);

  const selectedFullDate =
    selectedYear && selectedMonth && selectedDay
      ? `${selectedYear}-${selectedMonth}-${selectedDay}`
      : '';

  const targetExcelYear = selectedYear || new Date().getFullYear().toString();

  const downloadYearExcelWorkbook = (logsSource, yearStr, monthCode = selectedMonth) => {
    if (!logsSource || logsSource.length === 0) return;
    const wb = buildYearWorkbook(logsSource, yearStr, monthCode);
    XLSX.writeFile(wb, `VECTRA_${yearStr}_Daily_Logs.xlsx`);
  };

  // Automatically update Year Excel (.xlsx) whenever new entries are added
  useEffect(() => {
    if (lastSavedCountRef.current === null) {
      lastSavedCountRef.current = dailyLogs.length;
      return;
    }
    if (autoSaveExcel && dailyLogs.length > lastSavedCountRef.current) {
      const latestLog = dailyLogs[dailyLogs.length - 1];
      const yr = (latestLog?.date && latestLog.date.slice(0, 4)) || targetExcelYear;
      downloadYearExcelWorkbook(dailyLogs, yr, selectedMonth);
    }
    lastSavedCountRef.current = dailyLogs.length;
  }, [dailyLogs, autoSaveExcel, targetExcelYear]);

  const handleYearChange = (yr) => {
    setSelectedYear(yr);
    setSelectedDay('');
  };

  const handleMonthChange = (mo) => {
    setSelectedMonth(mo);
    setSelectedDay('');
  };

  const handleDayChange = (dd) => {
    setSelectedDay(dd);
  };

  const handleResetFilters = () => {
    setSelectedYear('');
    setSelectedMonth('');
    setSelectedDay('');
    setFilterCustomer('');
    setFilterMachine('');
    setFilterArea('');
    setFilterCity('');
  };

  const handleJumpToToday = () => {
    const nowIso = getTodayDate();
    setSelectedYear(nowIso.slice(0, 4));
    setSelectedMonth(nowIso.slice(5, 7));
    setSelectedDay(nowIso.slice(8, 10));
  };

  // One-Tap Movement Check-In (Reached Site / Reached Office / Reached Home - Day End)
  const handleQuickMovement = (movementType, titleText, detailText) => {
    if (checkingIn) return;
    setCheckingIn(movementType);

    let alreadySaved = false;
    const saveMovementEntry = async (detectedLocation) => {
      if (alreadySaved) return;
      alreadySaved = true;
      const nowIso = getTodayDate();
      await db.dailyLogs.add({
        logType: movementType,
        customerName: titleText,
        location: detectedLocation || '',
        machineType: '',
        issue: detailText,
        solution: '',
        status: 'Done',
        date: nowIso,
        time: getNowTime(),
        synced: false,
      });
      setSelectedYear(nowIso.slice(0, 4));
      setSelectedMonth(nowIso.slice(5, 7));
      setSelectedDay(nowIso.slice(8, 10));
      setCheckingIn('');
      refreshAllData();
    };

    captureCurrentGPS(
      '',
      (pinnedLoc) => saveMovementEntry(pinnedLoc),
      (errMsg) => {
        if (errMsg) saveMovementEntry('');
      },
      () => {}
    );
  };

  const handleEditLog = (l) => {
    const isEng = l.logType === 'Phone Call with Engineer';
    const { area, city } = splitAreaAndCity(l.location || '');
    setForm({
      logType: isEng ? 'Phone Call with Engineer' : 'Phone Call with Customer',
      customerName: isEng ? '' : (l.customerName || ''),
      engineerName: isEng ? (l.engineerName || l.customerName || '') : '',
      department: l.department || 'Application',
      serviceSubDept: l.serviceSubDept || 'Electrical',
      area: l.area || area || '',
      city: l.city || city || '',
      machineType: l.rawMachineType || defaultMachineType,
      machineSeries: l.machineSeries || defaultSeries,
      machineModel: l.machineModel || defaultModel,
      controller: l.controller || CALL_CONTROLLERS[0] || 'Siemens',
      issue: l.issue || '',
      solution: l.solution || '',
      status: l.status || 'Done',
    });
    setEditingLogId(l.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteLog = async (l) => {
    if (!window.confirm(`Delete log for "${l.customerName}"?`)) return;
    await db.dailyLogs.delete(l.id);
    if (editingLogId === l.id) resetLogForm();
    refreshAllData();
  };

  const addOrUpdateLog = async (e) => {
    e.preventDefault();

    const targetDate = selectedFullDate || getTodayDate();

    let payload;
    if (isEngineerCall) {
      if (!form.engineerName.trim() || !form.issue.trim()) return;
      const engName = form.engineerName.trim();
      const dept = (form.department || 'Application').trim();
      const subDept = dept === 'Service' ? (form.serviceSubDept || '').trim() : '';
      const fullDeptLabel = subDept ? `${dept} (${subDept})` : dept;
      const cityVal = (form.city || '').trim();

      payload = {
        logType: 'Phone Call with Engineer',
        customerName: `${engName} • ${fullDeptLabel}`,
        engineerName: engName,
        department: dept,
        serviceSubDept: subDept,
        area: '',
        city: cityVal,
        location: cityVal,
        machineType: fullDeptLabel,
        rawMachineType: '',
        machineSeries: '',
        machineModel: '',
        controller: '',
        issue: form.issue.trim(),
        solution: form.solution.trim(),
        status: form.status || 'Done',
      };
    } else {
      if (!form.customerName.trim() || !form.issue.trim()) return;
      const areaVal = (form.area || '').trim();
      const cityVal = (form.city || '').trim();
      const locText = [areaVal, cityVal].filter(Boolean).join(', ');
      const machSummary = [
        form.machineType,
        form.machineModel || form.machineSeries,
        form.controller,
      ]
        .filter(Boolean)
        .join(' • ');

      payload = {
        logType: 'Phone Call with Customer',
        customerName: form.customerName.trim(),
        engineerName: '',
        department: '',
        serviceSubDept: '',
        area: areaVal,
        city: cityVal,
        location: locText,
        machineType: machSummary,
        rawMachineType: form.machineType,
        machineSeries: form.machineSeries,
        machineModel: form.machineModel,
        controller: form.controller,
        issue: form.issue.trim(),
        solution: form.solution.trim(),
        status: form.status || 'Done',
      };
    }

    if (editingLogId !== null) {
      await db.dailyLogs.update(editingLogId, payload);
      const existingLog = dailyLogs.find((l) => l.id === editingLogId);
      if (existingLog?.siteVisitId && !isEngineerCall) {
        const linkedVisit = siteVisits.find((v) => v.id === existingLog.siteVisitId);
        if (linkedVisit) {
          await db.siteVisits.update(linkedVisit.id, {
            customerName: payload.customerName,
            location: payload.location,
            solution: payload.solution,
            status: payload.status === 'Done' ? 'Solved / Closed' : 'Pending',
          });
        }
      }
    } else {
      await db.dailyLogs.add({
        ...payload,
        date: targetDate,
        time: getNowTime(),
        synced: false,
      });
      setSelectedYear(targetDate.slice(0, 4));
      setSelectedMonth(targetDate.slice(5, 7));
      setSelectedDay(targetDate.slice(8, 10));
    }

    resetLogForm();
    refreshAllData();
  };

  const toggleStatus = async (log) => {
    const nextStatus = log.status === 'Done' ? 'Pending' : 'Done';
    await db.dailyLogs.update(log.id, { status: nextStatus });
    if (log.siteVisitId) {
      const linkedVisit = siteVisits.find((v) => v.id === log.siteVisitId);
      if (linkedVisit) {
        await db.siteVisits.update(linkedVisit.id, {
          status: nextStatus === 'Done' ? 'Solved / Closed' : 'Pending',
        });
      }
    }
    refreshAllData();
  };

  const filtered = dailyLogs
    .filter((l) => {
      const d = l.date || '';
      if (selectedYear && !d.startsWith(`${selectedYear}-`)) return false;
      if (selectedMonth && d.slice(5, 7) !== selectedMonth) return false;
      if (selectedDay && d.slice(8, 10) !== selectedDay) return false;

      if (filterCustomer && (l.customerName || '').trim() !== filterCustomer) return false;
      if (filterMachine && (l.machineType || '').trim() !== filterMachine) return false;

      const { area, city } = splitAreaAndCity(l.location || '');
      const rowArea = (l.area || area || '').trim();
      const rowCity = (l.city || city || '').trim();
      if (filterArea && rowArea !== filterArea) return false;
      if (filterCity && rowCity !== filterCity) return false;

      return true;
    })
    .sort((a, b) => {
      const dateCmp = (b.date || '').localeCompare(a.date || '');
      if (dateCmp !== 0) return dateCmp;
      return (a.time || '').localeCompare(b.time || '');
    });

  const isMovementLog = (type) =>
    type === 'Reached Office' || type === 'Reached Site' || type === 'Day End';

  return (
    <div className="space-y-5">
      {/* One-Tap Day Movement Check-In Bar */}
      <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs sm:text-sm font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-4 h-4" /> Quick Day Check-In (Auto Time + GPS)
          </h2>
          <span className="text-[11px] text-slate-400">1-Tap Log</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            disabled={Boolean(checkingIn)}
            onClick={() =>
              handleQuickMovement('Reached Site', 'Reached Customer Site', 'Arrived at site for application work')
            }
            className="bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 rounded-xl py-2.5 px-2 flex flex-col items-center justify-center gap-1 text-xs font-semibold"
          >
            <Factory className="w-4 h-4" />
            <span>{checkingIn === 'Reached Site' ? 'Saving...' : 'Reached Site'}</span>
          </button>

          <button
            type="button"
            disabled={Boolean(checkingIn)}
            onClick={() =>
              handleQuickMovement('Reached Office', 'Reached Office', 'Returned from site to office')
            }
            className="bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 rounded-xl py-2.5 px-2 flex flex-col items-center justify-center gap-1 text-xs font-semibold"
          >
            <Building2 className="w-4 h-4" />
            <span>{checkingIn === 'Reached Office' ? 'Saving...' : 'Reached Office'}</span>
          </button>

          <button
            type="button"
            disabled={Boolean(checkingIn)}
            onClick={() =>
              handleQuickMovement('Day End', 'Reached Home (Day End)', 'Completed all site & office calls for the day')
            }
            className="bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 rounded-xl py-2.5 px-2 flex flex-col items-center justify-center gap-1 text-xs font-semibold"
          >
            <Home className="w-4 h-4" />
            <span>{checkingIn === 'Day End' ? 'Saving...' : 'Home / Day End'}</span>
          </button>
        </div>
      </div>

      {/* Quick Phone Call / Activity Log Form */}
      <div className={`bg-slate-900 border ${editingLogId !== null ? 'border-amber-500/60' : 'border-slate-800'} rounded-2xl p-4 space-y-3`}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-cyan-400 flex items-center gap-2">
            <CalendarCheck className="w-5 h-5" />
            {editingLogId !== null ? 'Edit Daily Log Entry' : 'Quick Phone Call / Activity Log'}
          </h2>
          {editingLogId !== null && (
            <button
              type="button"
              onClick={resetLogForm}
              className="text-xs bg-slate-800 text-amber-300 px-2.5 py-1 rounded-lg border border-amber-500/30"
            >
              Cancel Edit
            </button>
          )}
        </div>

        <form onSubmit={addOrUpdateLog} className="space-y-2.5">
          {isEngineerCall ? (
            <>
              <div className={`grid grid-cols-1 ${isServiceDept ? 'sm:grid-cols-5' : 'sm:grid-cols-4'} gap-2`}>
                <select
                  value={form.logType}
                  onChange={(e) => setForm({ ...form, logType: e.target.value })}
                  className="bg-slate-950 border border-cyan-500/50 rounded-lg px-2.5 py-2 text-xs text-cyan-300 font-semibold"
                >
                  <option value="Phone Call with Customer">Phone Call with Customer</option>
                  <option value="Phone Call with Engineer">Phone Call with Engineer</option>
                </select>

                <input
                  type="text"
                  placeholder="Engineer Name *"
                  value={form.engineerName}
                  onChange={(e) => setForm({ ...form, engineerName: e.target.value })}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs"
                  required
                />

                <select
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
                >
                  {ENGINEER_DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>

                {isServiceDept && (
                  <select
                    value={form.serviceSubDept}
                    onChange={(e) => setForm({ ...form, serviceSubDept: e.target.value })}
                    className="bg-slate-950 border border-cyan-500/40 rounded-lg px-2.5 py-2 text-xs text-cyan-300 font-semibold"
                  >
                    {SERVICE_SUB_DEPARTMENTS.map((sub) => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                )}

                <input
                  type="text"
                  placeholder="City"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Problem / Discussion *"
                  value={form.issue}
                  onChange={(e) => setForm({ ...form, issue: e.target.value })}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs"
                  required
                />
                <input
                  type="text"
                  placeholder="Solution / Action Taken"
                  value={form.solution}
                  onChange={(e) => setForm({ ...form, solution: e.target.value })}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs"
                />
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <select
                  value={form.logType}
                  onChange={(e) => setForm({ ...form, logType: e.target.value })}
                  className="bg-slate-950 border border-cyan-500/50 rounded-lg px-2.5 py-2 text-xs text-cyan-300 font-semibold"
                >
                  <option value="Phone Call with Customer">Phone Call with Customer</option>
                  <option value="Phone Call with Engineer">Phone Call with Engineer</option>
                </select>

                <input
                  type="text"
                  placeholder="Customer Name *"
                  value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs"
                  required
                />

                <input
                  type="text"
                  placeholder="Area"
                  value={form.area}
                  onChange={(e) => setForm({ ...form, area: e.target.value })}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs"
                />

                <input
                  type="text"
                  placeholder="City"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <select
                  value={form.machineType}
                  onChange={(e) => handleMachineTypeChange(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
                  title="Machine Type"
                >
                  {Object.keys(JYOTI_MACHINE_CASCADE).map((mType) => (
                    <option key={mType} value={mType}>{mType}</option>
                  ))}
                </select>

                <select
                  value={form.machineSeries}
                  onChange={(e) => handleMachineSeriesChange(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
                  title="Machine Series"
                >
                  {seriesOptions.map((ser) => (
                    <option key={ser} value={ser}>{ser}</option>
                  ))}
                </select>

                <select
                  value={form.machineModel}
                  onChange={(e) => setForm({ ...form, machineModel: e.target.value })}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
                  title="Machine Model"
                >
                  {modelOptions.map((mdl) => (
                    <option key={mdl} value={mdl}>{mdl}</option>
                  ))}
                </select>

                <select
                  value={form.controller}
                  onChange={(e) => setForm({ ...form, controller: e.target.value })}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-cyan-300 font-semibold"
                  title="Controller"
                >
                  {CALL_CONTROLLERS.map((ctrl) => (
                    <option key={ctrl} value={ctrl}>{ctrl}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Problem / Discussion *"
                  value={form.issue}
                  onChange={(e) => setForm({ ...form, issue: e.target.value })}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs"
                  required
                />
                <input
                  type="text"
                  placeholder="Solution / Action Taken"
                  value={form.solution}
                  onChange={(e) => setForm({ ...form, solution: e.target.value })}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs"
                />
              </div>
            </>
          )}

          <button
            type="submit"
            className={`w-full ${editingLogId !== null ? 'bg-amber-600 hover:bg-amber-500' : 'bg-cyan-600 hover:bg-cyan-500'} py-2 rounded-lg text-xs font-bold`}
          >
            {editingLogId !== null ? 'Update Log Entry' : "+ Add to Today's Log"}
          </button>
        </form>
      </div>

      {/* Filter & Year-Month Excel Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-cyan-400" />
            <span className="text-xs sm:text-sm font-bold text-slate-200 uppercase tracking-wider">
              Filter & Search ({filtered.length} Entries)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 text-xs bg-slate-800 text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-500/30 cursor-pointer">
              <input
                type="checkbox"
                checked={autoSaveExcel}
                onChange={(e) => setAutoSaveExcel(e.target.checked)}
                className="accent-emerald-500"
              />
              Auto-Save Year Excel
            </label>

            <button
              type="button"
              onClick={handleJumpToToday}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-cyan-300 px-2.5 py-1 rounded-lg border border-slate-700"
            >
              Today
            </button>

            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700"
            >
              Reset All
            </button>

            <button
              type="button"
              onClick={() => downloadYearExcelWorkbook(dailyLogs, targetExcelYear)}
              disabled={dailyLogs.length === 0}
              className="inline-flex items-center gap-1 bg-cyan-600/20 hover:bg-cyan-600/30 disabled:opacity-40 text-cyan-300 border border-cyan-500/30 px-2.5 py-1 rounded-lg text-xs font-semibold"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Save {targetExcelYear} Excel
            </button>
          </div>
        </div>

        {/* 1st Line: 3 Cascade Dropdowns (Year -> Month -> Date) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Select Year</label>
            <select
              value={selectedYear}
              onChange={(e) => handleYearChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-semibold"
            >
              <option value="">All Years</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Select Month</label>
            <select
              value={selectedMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-semibold"
            >
              <option value="">All Months</option>
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Select Date</label>
            <select
              value={selectedDay}
              onChange={(e) => handleDayChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-cyan-300 font-semibold"
            >
              <option value="">All Dates in Month</option>
              {availableDays.map((item) => (
                <option key={item.dd} value={item.dd}>
                  {item.dd} {item.hasLog ? '• (Has Data)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 2nd Line: 4 Dropdowns (Customer Name, Machine, Area, City) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Search by Customer Name</label>
            <select
              value={filterCustomer}
              onChange={(e) => setFilterCustomer(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
            >
              <option value="">All Customers</option>
              {filterOptions.customers.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Search by Machine</label>
            <select
              value={filterMachine}
              onChange={(e) => setFilterMachine(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
            >
              <option value="">All Machines</option>
              {filterOptions.machines.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Search by Area</label>
            <select
              value={filterArea}
              onChange={(e) => setFilterArea(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
            >
              <option value="">All Areas</option>
              {filterOptions.areas.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Search by City</label>
            <select
              value={filterCity}
              onChange={(e) => setFilterCity(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
            >
              <option value="">All Cities</option>
              {filterOptions.cities.map((ct) => (
                <option key={ct} value={ct}>{ct}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Chronological Timeline List */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 text-center text-xs text-slate-400">
            No activity logged for this selection yet.
          </div>
        )}

        {filtered.map((l) => {
          const movement = isMovementLog(l.logType);
          return (
            <div
              key={l.id}
              className={`border rounded-xl p-3 flex items-start justify-between gap-3 ${
                l.logType === 'Day End'
                  ? 'bg-emerald-950/30 border-emerald-500/40'
                  : movement
                  ? 'bg-cyan-950/25 border-cyan-500/30'
                  : 'bg-slate-900 border-slate-800'
              }`}
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-mono text-cyan-400 font-bold">
                    ⏰ {l.time || '--:--'} • {l.date}
                  </span>
                  <span className="text-[11px] bg-slate-800 px-2 py-0.5 rounded text-slate-200">
                    {l.logType}
                  </span>
                  {l.machineType && (
                    <span className="text-[11px] bg-cyan-500/15 text-cyan-300 px-2 py-0.5 rounded">
                      {l.machineType}
                    </span>
                  )}
                </div>

                <h4 className="font-bold text-sm text-white flex flex-wrap items-center gap-2">
                  <span>{l.customerName}</span>
                  {l.location && (
                    <button
                      type="button"
                      onClick={() => openGoogleMapsRoute(l.location)}
                      className="inline-flex items-center gap-1 text-xs font-normal text-cyan-400 hover:text-cyan-300 underline"
                    >
                      <Navigation className="w-3 h-3" /> {l.location}
                    </button>
                  )}
                </h4>

                <p className="text-xs text-slate-300">
                  {l.issue} {l.solution && <span className="text-emerald-300 font-medium">→ {l.solution}</span>}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {!movement && (
                  <button
                    type="button"
                    onClick={() => toggleStatus(l)}
                    className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      l.status === 'Done'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {l.status === 'Done' ? '✓ Done' : '⏳ Pending'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleEditLog(l)}
                  className="p-1.5 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 rounded-lg"
                  title="Edit Log"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteLog(l)}
                  className="p-1.5 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 rounded-lg"
                  title="Delete Log"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}