import React, { useState, useEffect } from 'react';
import { db } from './db';
import {
  Wrench, Cpu, FileCode, BookOpen, CalendarCheck, Bot, Settings, X
} from 'lucide-react';
import { getMapTarget } from './tabs/cncConstants';
import SiteVisitTab from './tabs/SiteVisitTab';
import ToolingTab from './tabs/ToolingTab';
import ProgramsTab from './tabs/ProgramsTab';
import ParametersManualsTab from './tabs/ParametersManualsTab';
import DailyLogsTab from './tabs/DailyLogsTab';
import AskAITab from './tabs/AskAITab';

export default function App() {
  const [activeTab, setActiveTab] = useState('site');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('vectra_gemini_key') || '');
  const [showSettings, setShowSettings] = useState(false);

  // Database States
  const [siteVisits, setSiteVisits] = useState([]);
  const [toolingTrials, setToolingTrials] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [parameters, setParameters] = useState([]);
  const [manuals, setManuals] = useState([]);
  const [dailyLogs, setDailyLogs] = useState([]);

  const refreshAllData = async () => {
    setSiteVisits(await db.siteVisits.reverse().toArray());
    setToolingTrials(await db.toolingTrials.reverse().toArray());
    setPrograms(await db.programs.reverse().toArray());
    setParameters(await db.parameters.reverse().toArray());
    setManuals(await db.manuals.reverse().toArray());
    setDailyLogs(await db.dailyLogs.reverse().toArray());
  };

  useEffect(() => {
    refreshAllData();
  }, []);

  const saveApiKey = (key) => {
    setApiKey(key);
    localStorage.setItem('vectra_gemini_key', key);
  };

  const shareOnWhatsApp = (text) => {
    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  const openGoogleMapsPin = (locationText) => {
    const target = getMapTarget(locationText);
    if (!target) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(target)}`;
    window.open(url, '_blank');
  };

  const openGoogleMapsRoute = (locationText) => {
    const target = getMapTarget(locationText);
    if (!target) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(target)}`;
    window.open(url, '_blank');
  };

  const captureCurrentGPS = (currentText, onSuccess, onError, setPinning) => {
    if (!navigator.geolocation) {
      onError('GPS is not supported in this browser.');
      return;
    }
    setPinning(true);
    onError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        let area = '';
        let city = '';

        try {
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
          );
          if (res.ok) {
            const data = await res.json();
            area = (data.locality || '').trim();
            city = (data.city || data.principalSubdivision || '').trim();
          }
        } catch {
          // Fallback below
        }

        if (!area || area.toLowerCase() === city.toLowerCase()) {
          try {
            const nomRes = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`
            );
            if (nomRes.ok) {
              const nomData = await nomRes.json();
              const addr = nomData.address || {};
              area = (
                addr.suburb ||
                addr.neighbourhood ||
                addr.industrial ||
                addr.village ||
                addr.town ||
                addr.road ||
                area
              ).trim();
              city = (city || addr.city || addr.state_district || addr.county || '').trim();
            }
          } catch {
            // Keep available info
          }
        }

        let placeName = '';
        if (area && city && area.toLowerCase() !== city.toLowerCase()) {
          placeName = `${area}, ${city}`;
        } else if (area || city) {
          placeName = area || city;
        } else {
          placeName = `${lat}, ${lng}`;
        }

        onSuccess(placeName);
        setPinning(false);
      },
      (err) => {
        setPinning(false);
        if (err.code === 1) {
          onError('Location permission denied. Please allow Location access in your browser.');
        } else if (err.code === 2) {
          onError('GPS position unavailable. Turn on device Location / GPS and try again.');
        } else {
          onError('GPS timeout. Try again in an open area.');
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  // Fast Auto-Discovery + 8s Timeout per model (Short, Simple & Direct English Output)
  const askGeminiAI = async (promptText, imageBase64 = null) => {
    const cleanKey = apiKey.trim();
    if (!cleanKey) {
      setShowSettings(true);
      return '⚠️ Please click the Settings (⚙️) icon at the top right and enter your Free Gemini API Key.';
    }

    const pastKnowledge = siteVisits
      .slice(0, 15)
      .map((v) => `[${v.machineType} ${v.machineSeries || ''} ${v.machineModel || ''} - ${v.controller}] Purpose: ${v.callPurpose} | Detail: ${v.issue} -> Solution: ${v.solution}`)
      .join('\n');

    const paramKnowledge = parameters
      .slice(0, 15)
      .map((p) => `[${p.controller} ${p.model}] ${p.taskName}: Param ${p.paramNumber} (${p.defaultValue} -> ${p.newValue}) Steps: ${p.steps}`)
      .join('\n');

    const fullPrompt = `You are VECTRA, an expert CNC Applications, Tooling, Cycle Time & Programming Engineer Assistant for Jyoti CNC machines.
Always respond strictly in clear, simple technical English.
Keep answers short, direct, and easy to understand with practical steps, parameters, variables, or G-code directly unless detailed breakdown is requested.
--- PAST SITE RECORDS ---
${pastKnowledge || 'None yet'}
--- SAVED PARAMETERS ---
${paramKnowledge || 'None yet'}
--- USER QUERY ---
${promptText}`;

    const parts = [{ text: fullPrompt }];
    if (imageBase64) {
      const base64Data = imageBase64.split(',')[1];
      const mimeType = imageBase64.split(';')[0].split(':')[1];
      parts.push({ inline_data: { mime_type: mimeType, data: base64Data } });
    }

    try {
      const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`);
      const listData = await listRes.json();

      if (!listRes.ok) {
        return `❌ API Key Error: ${listData?.error?.message || listRes.statusText}`;
      }

      const fastModels = (listData.models || [])
        .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map((m) => m.name.replace('models/', ''))
        .filter((name) =>
          name.includes('gemini') &&
          !name.includes('pro') &&
          !name.includes('thinking') &&
          !name.includes('research') &&
          !name.includes('audio') &&
          !name.includes('tts') &&
          !name.includes('image')
        );

      const modelsToTry = fastModels.length > 0 ? fastModels : ['gemini-2.5-flash'];

      let lastError = '';
      for (const modelName of modelsToTry) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);

          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${cleanKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: [{ parts }] }),
              signal: controller.signal,
            }
          );
          clearTimeout(timeoutId);

          const data = await response.json();
          if (response.ok && data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            return data.candidates[0].content.parts[0].text;
          }
          lastError = `${modelName}: ${data?.error?.message || response.status}`;
        } catch (e) {
          lastError = `${modelName}: ${e.name === 'AbortError' ? 'Timeout' : e.message}`;
        }
      }

      return `❌ All fast models busy right now (${lastError}). Please click Send again in 5 seconds.`;
    } catch (err) {
      return `❌ Network Error: ${err.message}`;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-black text-white shadow-lg shadow-cyan-500/20">
            V
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-wider text-white leading-none">VECTRA</h1>
            <p className="text-[11px] text-cyan-400 font-medium">CNC Applications & AI Command</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Offline Ready
          </span>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            title="AI & Drive Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 pb-24">
        {activeTab === 'site' && (
          <SiteVisitTab
            siteVisits={siteVisits}
            dailyLogs={dailyLogs}
            refreshAllData={refreshAllData}
            askGeminiAI={askGeminiAI}
            fileToBase64={fileToBase64}
            shareOnWhatsApp={shareOnWhatsApp}
            openGoogleMapsPin={openGoogleMapsPin}
            openGoogleMapsRoute={openGoogleMapsRoute}
            captureCurrentGPS={captureCurrentGPS}
          />
        )}
        {activeTab === 'tooling' && (
          <ToolingTab
            toolingTrials={toolingTrials}
            refreshAllData={refreshAllData}
            askGeminiAI={askGeminiAI}
          />
        )}
        {activeTab === 'programs' && (
          <ProgramsTab
            programs={programs}
            refreshAllData={refreshAllData}
            askGeminiAI={askGeminiAI}
            shareOnWhatsApp={shareOnWhatsApp}
          />
        )}
        {activeTab === 'params' && (
          <ParametersManualsTab
            parameters={parameters}
            manuals={manuals}
            refreshAllData={refreshAllData}
            shareOnWhatsApp={shareOnWhatsApp}
          />
        )}
        {activeTab === 'logs' && (
          <DailyLogsTab
            dailyLogs={dailyLogs}
            siteVisits={siteVisits}
            refreshAllData={refreshAllData}
            openGoogleMapsPin={openGoogleMapsPin}
            openGoogleMapsRoute={openGoogleMapsRoute}
            captureCurrentGPS={captureCurrentGPS}
            shareOnWhatsApp={shareOnWhatsApp}
          />
        )}
        {activeTab === 'ai' && (
          <AskAITab
            askGeminiAI={askGeminiAI}
            fileToBase64={fileToBase64}
            shareOnWhatsApp={shareOnWhatsApp}
          />
        )}
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur border-t border-slate-800 z-30">
        <div className="max-w-5xl mx-auto flex overflow-x-auto sm:grid sm:grid-cols-6">
          {[
            { id: 'site', label: 'Site & AI', icon: Wrench },
            { id: 'tooling', label: 'Tooling', icon: Cpu },
            { id: 'programs', label: 'Programs', icon: FileCode },
            { id: 'params', label: 'Params/PDF', icon: BookOpen },
            { id: 'logs', label: 'Daily Logs', icon: CalendarCheck },
            { id: 'ai', label: 'Ask AI', icon: Bot },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`min-w-[76px] flex-1 flex flex-col items-center justify-center py-2.5 px-2 shrink-0 transition-colors ${
                  active ? 'text-cyan-400 bg-cyan-500/10 border-t-2 border-cyan-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-5 h-5 mb-1" />
                <span className="text-[10px] sm:text-xs font-medium truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {showSettings && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-cyan-400" /> VECTRA Settings
              </h2>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase">Google Gemini API Key (Free)</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => saveApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:border-cyan-500 outline-none"
              />
              <p className="text-xs text-slate-400">
                Get your free API key from Google AI Studio (aistudio.google.com) and paste it here.
              </p>
            </div>

            <button
              onClick={() => setShowSettings(false)}
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-2.5 rounded-lg"
            >
              Save & Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
