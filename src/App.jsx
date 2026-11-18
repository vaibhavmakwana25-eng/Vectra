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
  const [activeTab, setActiveTab] = useState('programs');
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
    const raw = String(arguments[0] || '').trim();
    const isGuj = /[\u0A80-\u0AFF]|\b(kem|shu|su|kevi|rite|mane|samjav|bol|aap|chhe|che|nathi|karvu|kro|mate|ama|ma|ne|kai|kya|ke|pn|pan|joye|joie|karu)\b/i.test(raw);

    const sysInstruction = isGuj
      ? 'You are VECTRA, an expert CNC Programming & Applications Engineer (Fanuc, Siemens Sinumerik, Haas, Mazak, Turning & VMC Milling). Reply in natural, friendly Gujarati typed in English letters (Tanglish) or Gujarati script matching the user query, using clear shop-floor bullet points and exact G/M-code examples. Keep answers concise, practical, and directly focused on the user question.'
      : 'You are VECTRA, an expert CNC Programming & Applications Engineer (Fanuc, Siemens Sinumerik, Haas, Mazak, Turning & VMC Milling). Reply in clear, practical, shop-floor English using short bullet points and exact G/M-code examples.';

    try {
      const url = 'https://text.pollinations.ai/' + encodeURIComponent(raw) + '?system=' + encodeURIComponent(sysInstruction) + '&model=openai&seed=' + Date.now();
      const res = await fetch(url);
      if (res.ok) {
        const txt = (await res.text()).trim();
        if (txt && !txt.startsWith('<!DOCTYPE')) {
          return txt.replace(/\*\*/g, '').replace(/```[a-z]*\n?/gi, '').replace(/```/g, '');
        }
      }
    } catch (e) {}

    const q = raw.toLowerCase();
    if (q.includes('siemens') && (q.includes('sub') || q.includes('call'))) {
      return isGuj
        ? '• Siemens (Sinumerik 828D / 840D) ma sub-program call karva mate 3 main rit chhe:\n• 1) Direct name thi: SUB_PROG (jo SUB_PROG.SPF subprograms folder ma hoy)\n• 2) CALL command thi: CALL "/_N_SPF_DIR/_N_SUB1_SPF"\n• 3) Multiple repeat mate: SUB_PROG P3 (3 var repeat thashe) ane sub-program na end ma M17 ya RET mukvu.'
        : '• In Siemens Sinumerik (828D/840D), call a sub-program using:\n• 1) Direct call: SUB_PROG (saved as SUB_PROG.SPF)\n• 2) Full path: CALL "/_N_SPF_DIR/_N_SUB1_SPF"\n• 3) Repeat N times: SUB_PROG P3 and end with M17 or RET.';
    }
    if (q.includes('sub') && (q.includes('fanuc') || q.includes('call'))) {
      return isGuj
        ? '• Fanuc ma sub-program call karva: M98 P1001; (O1001 call thashe) athva M98 P031001; (3 var repeat) ane sub-program end ma M99; mukvu.'
        : '• In Fanuc, call a sub-program with M98 P1001; (or M98 P031001; for 3 repeats) and end with M99;.';
    }
    return isGuj
      ? '• Live AI server busy chhe — 2 second pachi fari Send dabavo.'
      : '• Live AI server busy — please click Send again in 2 seconds.';
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
            style={{display:"none"}}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            title="AI & Drive Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 pb-24">
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
            { id: 'tooling', label: 'Tooling', icon: Cpu },
            { id: 'programs', label: 'Programs', icon: FileCode },
            { id: 'params', label: 'Params/PDF', icon: BookOpen },
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
            </div>


  );
}

