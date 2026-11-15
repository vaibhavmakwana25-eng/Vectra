import React, { useState, useRef } from 'react';
import { db } from '../db';
import * as pdfjsLib from 'pdfjs-dist';
import { BookOpen, Upload, Image as ImageIcon, Search, Share2 } from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export default function ParametersManualsTab({ parameters, manuals, refreshAllData, shareOnWhatsApp }) {
  const [form, setForm] = useState({
    controller: 'Fanuc',
    machineType: 'VMC',
    model: '0i-MF Plus',
    taskName: '',
    paramNumber: '',
    defaultValue: '',
    newValue: '',
    steps: '',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);
  const [pdfPageNum, setPdfPageNum] = useState(1);
  const [pdfTotalPages, setPdfTotalPages] = useState(0);
  const [activePdfDoc, setActivePdfDoc] = useState(null);
  const canvasRef = useRef(null);

  const saveParam = async (e) => {
    e.preventDefault();
    if (!form.taskName || !form.paramNumber) return;
    await db.parameters.add({ ...form, synced: false });
    setForm({ ...form, taskName: '', paramNumber: '', defaultValue: '', newValue: '', steps: '' });
    refreshAllData();
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    setActivePdfDoc(pdf);
    setPdfTotalPages(pdf.numPages);
    setPdfPageNum(1);
    renderPdfPage(pdf, 1);

    await db.manuals.add({
      title: file.name.replace('.pdf', ''),
      controller: form.controller,
      machineType: form.machineType,
      fileName: file.name,
      totalPages: pdf.numPages,
      uploadedAt: new Date().toISOString().split('T')[0],
    });
    refreshAllData();
  };

  const renderPdfPage = async (pdfDoc, pageNum) => {
    if (!pdfDoc || !canvasRef.current) return;
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    await page.render({ canvasContext: context, viewport }).promise;
    setPdfPreviewUrl(canvas.toDataURL('image/png'));
  };

  const changePage = (delta) => {
    const next = pdfPageNum + delta;
    if (next >= 1 && next <= pdfTotalPages) {
      setPdfPageNum(next);
      renderPdfPage(activePdfDoc, next);
    }
  };

  const downloadPageImage = () => {
    if (!pdfPreviewUrl) return;
    const link = document.createElement('a');
    link.download = `VECTRA_Manual_Page_${pdfPageNum}.png`;
    link.href = pdfPreviewUrl;
    link.click();
  };

  const filteredParams = parameters.filter(
    (p) =>
      p.taskName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.paramNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.controller.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-cyan-400 flex items-center gap-2">
            <BookOpen className="w-5 h-5" /> PDF Catalogue / Manual Page Extractor
          </h2>
          <label className="cursor-pointer bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5">
            <Upload className="w-4 h-4" /> Open PDF Manual / Catalogue
            <input type="file" accept="application/pdf" onChange={handlePdfUpload} className="hidden" />
          </label>
        </div>

        {activePdfDoc && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between bg-slate-950 p-2 rounded-lg border border-slate-800">
              <button onClick={() => changePage(-1)} className="px-3 py-1 bg-slate-800 rounded text-xs">◀ Prev</button>
              <span className="text-xs font-bold text-cyan-300">Page {pdfPageNum} of {pdfTotalPages}</span>
              <button onClick={() => changePage(1)} className="px-3 py-1 bg-slate-800 rounded text-xs">Next ▶</button>
              <button
                onClick={downloadPageImage}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded text-xs font-semibold flex items-center gap-1"
              >
                <ImageIcon className="w-3.5 h-3.5" /> Save Page Photo
              </button>
            </div>
            <div className="overflow-auto max-h-96 bg-white rounded-lg p-1">
              <canvas ref={canvasRef} className="mx-auto max-w-full h-auto" />
            </div>
          </div>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <h3 className="text-sm font-bold text-white">Add Parameter & Key-Sequence Guide</h3>
        <form onSubmit={saveParam} className="space-y-2.5">
          <div className="grid grid-cols-3 gap-2">
            <select
              value={form.controller}
              onChange={(e) => setForm({ ...form, controller: e.target.value })}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs"
            >
              <option>Fanuc</option>
              <option>Siemens</option>
              <option>Mitsubishi</option>
            </select>
            <select
              value={form.machineType}
              onChange={(e) => setForm({ ...form, machineType: e.target.value })}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs"
            >
              <option>VMC</option>
              <option>Turning</option>
              <option>HMC</option>
            </select>
            <input
              type="text"
              placeholder="Model (e.g. 0i-MF)"
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              placeholder="Setting Name (e.g. Spindle Orientation) *"
              value={form.taskName}
              onChange={(e) => setForm({ ...form, taskName: e.target.value })}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs"
              required
            />
            <input
              type="text"
              placeholder="Parameter No (e.g. 4077) *"
              value={form.paramNumber}
              onChange={(e) => setForm({ ...form, paramNumber: e.target.value })}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs"
              required
            />
            <input
              type="text"
              placeholder="New Value (e.g. Bit 1 = 1)"
              value={form.newValue}
              onChange={(e) => setForm({ ...form, newValue: e.target.value })}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs"
            />
          </div>

          <textarea
            rows="2"
            placeholder="Step-by-step buttons to press..."
            value={form.steps}
            onChange={(e) => setForm({ ...form, steps: e.target.value })}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs"
          />

          <button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-500 py-2 rounded-lg text-xs font-bold">
            Save Parameter Guide
          </button>
        </form>
      </div>

      <div className="space-y-2.5">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search parameter number, setting name, or controller..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs"
          />
        </div>

        {filteredParams.map((p) => (
          <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-bold text-sm text-white">{p.taskName}</h4>
                <span className="text-xs text-cyan-400 font-mono">
                  {p.controller} ({p.model}) • Param #{p.paramNumber} → {p.newValue}
                </span>
              </div>
              <button
                onClick={() =>
                  shareOnWhatsApp(
                    `*VECTRA Parameter Guide*\nController: ${p.controller} (${p.model})\nTask: ${p.taskName}\nParameter: *${p.paramNumber}* → *${p.newValue}*\n\n*Steps:*\n${p.steps}`
                  )
                }
                className="p-2 bg-emerald-600/20 text-emerald-400 rounded-lg"
                title="Share steps on WhatsApp"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-300 whitespace-pre-wrap bg-slate-950 p-2.5 rounded-lg">{p.steps}</p>
          </div>
        ))}
      </div>
    </div>
  );
}