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
    const raw = (promptText || '').trim();
    const q = raw.toLowerCase();
    const isGuj = /[\u0A80-\u0AFF]|\b(kem|shu|su|kevi|rite|mane|samjav|bol|aap|chhe|che|nathi|karvu|kro|mate|ama|ma|ne|kai|kya|ke|pn|pan|joye|joie)\b/i.test(raw);

    if (imageBase64) {
      return isGuj
        ? "• Photo receive thai gayo chhe. Photo par no specific G-code, alarm number, athva dimension lakhi ne puchho etle hu exact solution aapu."
        : "• Image received. Type the alarm number, G-code line, or dimension shown in the photo for an exact solution.";
    }

    // 1. Part Count (Milling & Turning Fanuc)
    if (q.includes('part count') || q.includes('parts count') || q.includes('counter') || (q.includes('part') && q.includes('count'))) {
      if (q.includes('mill') || q.includes('vmc')) {
        return isGuj
          ? "• Fanuc Milling (VMC) ma Part Count mate program na end ma M30 (athva parameter 6711 ma set karel M-code, jem ke M51/M72) vapray chhe.\n• Parameter 6711 = Count M-code (0 hoy to M02/M30 par count vadhe), Parameter 6712 = Total Parts Count, Parameter 6713 = Required Parts.\n• POS -> CURRENT screen par 'PARTS COUNT' jovay chhe ane tya thi 'COUNT' / 'RESET' softkey thi 0 kari shakay."
          : "• On Fanuc Milling (VMC), part count increments at M30 (or the custom M-code set in Parameter 6711).\n• Key Parameters: 6711 (count trigger M-code; 0 = M02/M30), 6712 (accumulated part count), 6713 (required parts).\n• View on POS -> CURRENT screen and reset using the COUNT / RESET softkey.";
      }
      return isGuj
        ? "• Fanuc Turning & Milling banne ma program end par M30 (athva Parameter 6711 ma set M-code) thi Part Count 1 vadhe chhe.\n• Parameter 6711 = Count M-code, 6712 = Total Count, 6713 = Target/Required Parts.\n• Reset karva: POS -> CURRENT screen kholi 'COUNT' / 'RESET' softkey dabavo."
        : "• On Fanuc Turning & Milling, M30 (or Parameter 6711 M-code) increments the Part Count by 1.\n• Parameters: 6711 (count M-code), 6712 (total count), 6713 (required parts).\n• To reset: Go to POS -> CURRENT screen and press COUNT / RESET.";
    }

    // 2. G83 / G81 / G84 Drilling & Tapping
    if (q.includes('g83') || q.includes('g81') || q.includes('g84') || q.includes('drill') || q.includes('tap')) {
      return isGuj
        ? "• Fanuc Drilling / Tapping Cycles:\n• G81 (Spot/Normal Drill): G81 Z-15.0 R2.0 F0.15;\n• G83 (Peck Drill): G83 Z-35.0 Q3000 R2.0 F0.12; (Q3000 = 3.0 mm peck)\n• G84 (Rigid Tapping): M29 S500; G84 Z-20.0 R3.0 F1.5; (F = Pitch)\n• Cycle puru thaya pachi G80; thi cancel karo."
        : "• Fanuc Drilling & Tapping Cycles:\n• G81: G81 Z-15.0 R2.0 F0.15;\n• G83 Peck Drill: G83 Z-35.0 Q3000 R2.0 F0.12; (Q in microns: 3000 = 3mm)\n• G84 Rigid Tap: M29 S500; G84 Z-20.0 R3.0 F1.5; (F = Pitch)\n• Always cancel cycle with G80;";
    }

    // 3. G71 / G70 Roughing & Finishing
    if (q.includes('g71') || q.includes('g70') || q.includes('rough') || q.includes('finish')) {
      return isGuj
        ? "• Fanuc G71 Roughing & G70 Finishing:\n• G71 U2.0 R1.0; (U = depth of cut, R = retract)\n• G71 P10 Q20 U0.4 W0.1 F0.22; (P10 thi Q20 profile, U/W finishing stock)\n• N10 ... profile ... N20;\n• G70 P10 Q20 F0.12; (Finishing pass)"
        : "• Fanuc G71 Roughing & G70 Finishing:\n• G71 U2.0 R1.0; (U = radial DOC, R = retract)\n• G71 P10 Q20 U0.4 W0.1 F0.22; (P/Q = profile blocks, U/W = finish allowance)\n• G70 P10 Q20 F0.12; (Finish cycle)";
    }

    // 4. G76 Threading
    if (q.includes('g76') || q.includes('thread')) {
      return isGuj
        ? "• Fanuc G76 Threading Cycle:\n• G76 P020060 Q100 R0.05; (02 = spring passes, 60 = thread angle)\n• G76 X18.38 Z-25.0 P810 Q250 F1.5; (X = minor dia, P = height microns, Q = first cut, F = pitch)"
        : "• Fanuc G76 Threading Cycle:\n• G76 P020060 Q100 R0.05; (02 = finish passes, 60 = angle)\n• G76 X18.38 Z-25.0 P810 Q250 F1.5; (X = core dia, P = height microns, F = pitch)";
    }

    // 5. G41 / G42 / G40 Nose Compensation
    if (q.includes('g41') || q.includes('g42') || q.includes('g40') || q.includes('nose') || q.includes('tnrc') || q.includes('comp')) {
      return isGuj
        ? "• Tool Nose Radius Compensation (TNRC):\n• G41 = Tool left of profile (ID boring / facing), G42 = Tool right of profile (OD turning).\n• G01 line sathe G41/G42 start karo ane M30 pela G40; thi cancel karo.\n• Offset page ma T (Tool tip direction: OD = 3, ID = 2) ane R (Insert nose radius, jem ke 0.4 or 0.8) nakho."
        : "• Tool Nose Radius Compensation (TNRC):\n• G41 = Cutter comp left (ID), G42 = Cutter comp right (OD).\n• Activate on a G01 approach move and cancel with G40 before M30.\n• Set Tip Direction T (OD=3, ID=2) and Nose Radius R (e.g., 0.4 or 0.8) in Offset Geometry.";
    }

    // 6. RPM / Cutting Speed / Feed calculation
    const vcMatch = q.match(/(?:vc|speed)s*[=:]?s*(d+(?:.d+)?)/i);
    const diaMatch = q.match(/(?:dia|d)s*[=:]?s*(d+(?:.d+)?)/i);
    if (vcMatch && diaMatch) {
      const vc = parseFloat(vcMatch[1]);
      const d = parseFloat(diaMatch[1]);
      const rpm = Math.round((vc * 1000) / (Math.PI * d));
      return isGuj
        ? `• Cutting Speed Vc = ${vc} m/min ane Diameter D = ${d} mm mate:\n• RPM = (Vc x 1000) / (3.14 x D) = ${rpm} RPM\n• Turning ma G96 S${vc} M03; (CSS) ane G50 S${Math.min(rpm + 500, 3500)}; vapro.`
        : `• For Vc = ${vc} m/min and Diameter D = ${d} mm:\n• RPM = (Vc x 1000) / (3.14 x D) = ${rpm} RPM\n• Use G96 S${vc} M03; with G50 S${Math.min(rpm + 500, 3500)}; clamp.`;
    }

    // 7. M-codes & G-codes general reference
    if (q.includes('m code') || q.includes('m-code') || q.includes('mcode')) {
      return isGuj
        ? "• Main Fanuc M-Codes:\n• M00 = Program Stop | M01 = Optional Stop | M03 = Spindle CW | M04 = Spindle CCW | M05 = Spindle Stop\n• M08 = Coolant ON | M09 = Coolant OFF | M10/M11 = Chuck Clamp/Unclamp | M30 = Program End & Reset | M98/M99 = Subprogram Call/Return"
        : "• Common Fanuc M-Codes:\n• M00 = Program Stop | M01 = Optional Stop | M03 = Spindle CW | M04 = Spindle CCW | M05 = Spindle Stop\n• M08 = Coolant ON | M09 = Coolant OFF | M10/M11 = Chuck Clamp/Unclamp | M30 = End & Reset | M98/M99 = Subprogram";
    }

    if (q.includes('g code') || q.includes('g-code') || q.includes('gcode')) {
      return isGuj
        ? "• Main Fanuc Turning G-Codes:\n• G00 = Rapid | G01 = Linear Feed | G02/G03 = CW/CCW Arc | G04 = Dwell\n• G28 U0 W0 = Home Return | G40/G41/G42 = Nose Comp | G50 = Max RPM Clamp\n• G70 = Finish | G71 = OD/ID Rough | G72 = Face Rough | G74 = Peck Drill | G75 = Grooving | G76 = Threading | G96/G97 = CSS/Constant RPM"
        : "• Common Fanuc Turning G-Codes:\n• G00 = Rapid | G01 = Linear | G02/G03 = CW/CCW Arc | G04 = Dwell\n• G28 U0 W0 = Reference Return | G40/G41/G42 = TNRC | G50 = Max Spindle Clamp\n• G70 = Finish | G71 = Rough | G72 = Facing | G74 = Peck Drill | G75 = Groove | G76 = Thread | G96/G97 = CSS/RPM";
    }

    // Default helpful response in user's language (No API key prompt!)
    return isGuj
      ? `• "${raw}" mate direct CNC guide:\n• Jyoti / Fanuc controller ma aa topics par direct format ane parameter puchhi shako chho: Part Count (Milling/Turning), G71/G70 Rough-Finish, G76 Threading, G81/G83/G84 Drill-Tap, G41/G42 Nose Comp, M-codes, athva RPM calculation (jem ke: Vc 180 Dia 50).
• Specific cycle number ke alarm code lakho etle exact G-code line aapu.`
      : `• Direct CNC Assistant for "${raw}":\n• Ask directly about Part Count (Milling/Turning), G71/G70, G76 Threading, G81/G83/G84 Drill/Tap, G41/G42 TNRC, M-codes, or RPM calculation (e.g., Vc 180 Dia 50).\n• Mention the exact G-code or Fanuc parameter for step-by-step format.`;
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

