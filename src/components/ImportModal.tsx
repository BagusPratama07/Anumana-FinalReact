// @ts-nocheck
import React from "react";
import { FileText, Upload } from "lucide-react";

export default function ImportModal({ onClose, importType, setImportType, handleFileUpload, importStatus }) {
  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[3rem] w-full max-w-md p-10 text-center shadow-2xl animate-in zoom-in-95">
        
        {/* HEADER MODAL IMPORT */}
        <div className="bg-slate-900 w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl">
          <FileText className="text-amber-400 w-10 h-10" />
        </div>
        <h3 className="text-2xl font-black uppercase text-slate-800 mb-2">Import CSV Data</h3>
        <p className="text-xs text-slate-400 mb-6 font-medium italic">Pilih jenis data yang akan diunggah</p>
        
        {/* PILIHAN JENIS DATA (RADIO BUTTONS TERSAMAR) */}
        {/* Tombol-tombol ini menentukan tabel mana (di Google Sheets) yang akan menerima data */}
        <div className="flex justify-center gap-3 mb-8 flex-wrap">
          <label className={`cursor-pointer flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-4 py-3 rounded-2xl transition-all ${importType === "incident" ? "bg-slate-900 text-white shadow-lg" : "bg-slate-100 text-slate-400 hover:bg-slate-200"}`}>
            <input type="radio" name="importType" value="incident" checked={importType === "incident"} onChange={() => setImportType("incident")} className="hidden" />Insiden
          </label>
          <label className={`cursor-pointer flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-4 py-3 rounded-2xl transition-all ${importType === "hazard" ? "bg-amber-500 text-slate-900 shadow-lg" : "bg-slate-100 text-slate-400 hover:bg-slate-200"}`}>
            <input type="radio" name="importType" value="hazard" checked={importType === "hazard"} onChange={() => setImportType("hazard")} className="hidden" />Hazard
          </label>
          <label className={`cursor-pointer flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-4 py-3 rounded-2xl transition-all ${importType === "observasi" ? "bg-indigo-500 text-white shadow-lg" : "bg-slate-100 text-slate-400 hover:bg-slate-200"}`}>
            <input type="radio" name="importType" value="observasi" checked={importType === "observasi"} onChange={() => setImportType("observasi")} className="hidden" />Observasi
          </label>
        </div>
        
        {/* AREA UNGGAH FILE (DRAG & DROP / CLICK) */}
        {/* Kotak putus-putus tempat pengguna memasukkan file CSV */}
        <div className="relative border-4 border-dashed border-slate-100 rounded-[2.5rem] p-12 hover:border-indigo-400 bg-slate-50 group transition-all">
          {/* Input file disembunyikan (opacity-0) tapi memenuhi kotak (inset-0) agar bisa diklik */}
          <input type="file" accept=".csv" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
          <Upload className="w-10 h-10 text-slate-300 mx-auto mb-4 group-hover:text-indigo-600 group-hover:scale-110 transition-all" />
          
          {/* Menampilkan status unggahan (misal: "Memproses data..." atau "Pilih File") */}
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{importStatus || "Pilih File .CSV Anda"}</p>
        </div>
        
        <button onClick={onClose} className="mt-10 text-[10px] font-black text-slate-400 uppercase hover:text-rose-600 transition-colors tracking-widest outline-none">
          Tutup Panel
        </button>
      </div>
    </div>
  );
}