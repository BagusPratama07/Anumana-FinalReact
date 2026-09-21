// @ts-nocheck
import React from "react";
import { X } from "lucide-react";
import { SEVERITY_WEIGHTS } from "../utils/helpers";

export default function EntryModal({ onClose, submitManual }) {
  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8">
        
        {/* HEADER MODAL ENTRY */}
        <div className="bg-slate-900 p-10 text-white flex justify-between items-center">
          <div>
            <h3 className="text-2xl font-black uppercase tracking-tight">Manual Log</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">Input Data Insiden Baru</p>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-2xl transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        {/* FORM INPUT DATA */}
        <form onSubmit={submitManual} className="p-10 space-y-6">
          
          {/* Judul/Deskripsi Insiden */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Deskripsi Singkat</label>
            <input type="text" name="judul" required className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-5 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900 transition-all" />
          </div>
          
          <div className="grid grid-cols-2 gap-6">
            {/* Pilihan Area/PIT */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Area</label>
              <select name="pit" className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-5 text-sm font-bold outline-none">
                <option>KSB</option>
                <option>GRB</option>
              </select>
            </div>
            
            {/* Tanggal Insiden */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Tanggal</label>
              <input type="date" name="date" required className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-5 text-sm font-bold outline-none" />
            </div>
          </div>
          
          {/* PILIHAN KATEGORI KEPARAHAN (SEVERITY) */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase mb-4 block tracking-widest">Severity Kategori</label>
            <div className="grid grid-cols-4 gap-3">
              {/* Looping dari objek SEVERITY_WEIGHTS di helpers untuk membuat pilihan secara otomatis */}
              {Object.keys(SEVERITY_WEIGHTS).map((cat) => (
                <label key={cat} className="cursor-pointer group">
                  {/* Input radio disembunyikan (sr-only), diganti dengan styling kotak yang bisa diklik */}
                  <input type="radio" name="category" value={cat} required className="peer sr-only" />
                  <div className="bg-slate-50 p-3 rounded-2xl border-2 border-slate-50 peer-checked:border-slate-900 peer-checked:bg-slate-900/5 text-center transition-all">
                    <p className="text-[10px] font-black text-slate-800 leading-none">{cat}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          
          <button type="submit" className="w-full bg-slate-900 text-white font-black py-6 rounded-[2rem] shadow-xl uppercase tracking-widest outline-none hover:bg-slate-800 transition-all active:scale-95">
            Simpan Data
          </button>
        </form>
      </div>
    </div>
  );
}