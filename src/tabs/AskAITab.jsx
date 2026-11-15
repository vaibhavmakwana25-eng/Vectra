import React, { useState } from 'react';
import { Bot, Camera, Send, Share2 } from 'lucide-react';

export default function AskAITab({ askGeminiAI, fileToBase64, shareOnWhatsApp }) {
  const [messages, setMessages] = useState([
    {
      role: 'ai',
      text: 'Hello! I am VECTRA AI. Ask any CNC Applications, Tooling, Cycle Time, Parameter, or G-Code question — or upload a photo of the part, tooling, or machine screen.',
    },
  ]);
  const [input, setInput] = useState('');
  const [attachedPhoto, setAttachedPhoto] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePhoto = async (e) => {
    if (e.target.files[0]) {
      const b64 = await fileToBase64(e.target.files[0]);
      setAttachedPhoto(b64);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() && !attachedPhoto) return;

    const userMsg = { role: 'user', text: input || 'Analyze this image', photo: attachedPhoto };
    setMessages((prev) => [...prev, userMsg]);
    const currentInput = input;
    const currentPhoto = attachedPhoto;
    setInput('');
    setAttachedPhoto('');
    setLoading(true);

    const reply = await askGeminiAI(
      currentInput || 'Analyze this CNC machine/part/tooling photo and give short, practical application & troubleshooting steps.',
      currentPhoto || null
    );
    setMessages((prev) => [...prev, { role: 'ai', text: reply }]);
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-150px)] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
        <span className="text-sm font-bold text-cyan-400 flex items-center gap-2">
          <Bot className="w-5 h-5" /> VECTRA Field AI Assistant
        </span>
        <span className="text-[11px] text-slate-400">Uses Your Past Cases + Live Vision AI</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, idx) => (
          <div key={idx} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl p-3 text-xs sm:text-sm whitespace-pre-wrap ${
                m.role === 'user' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-100 border border-slate-700'
              }`}
            >
              {m.photo && <img src={m.photo} alt="Upload" className="w-40 rounded-lg mb-2" />}
              {m.text}
              {m.role === 'ai' && idx > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-700 flex justify-end">
                  <button
                    onClick={() => shareOnWhatsApp(`*VECTRA AI Solution:*\n\n${m.text}`)}
                    className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:underline"
                  >
                    <Share2 className="w-3.5 h-3.5" /> Share on WhatsApp
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && <div className="text-xs text-cyan-400 animate-pulse">VECTRA AI is analyzing...</div>}
      </div>

      <form onSubmit={handleSend} className="p-3 bg-slate-950 border-t border-slate-800 space-y-2">
        {attachedPhoto && (
          <div className="flex items-center gap-2 text-xs text-emerald-400">
            <span>📸 Photo ready to send</span>
            <button type="button" onClick={() => setAttachedPhoto('')} className="text-rose-400">Remove</button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <label className="cursor-pointer p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-cyan-400">
            <Camera className="w-5 h-5" />
            <input type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
          </label>
          <input
            type="text"
            placeholder="Ask any CNC application, tooling, cycle time, parameter, or program..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-cyan-500"
          />
          <button type="submit" className="p-2.5 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-white">
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
}