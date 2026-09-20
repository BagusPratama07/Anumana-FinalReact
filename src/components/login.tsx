// @ts-nocheck
import React from "react";
import { ShieldCheck, Mail, Lock, Database } from "lucide-react";

export default function Login({ 
  handleLogin, 
  emailInput, 
  setEmailInput, 
  passwordInput, 
  setPasswordInput, 
  authError 
}) {
  return (
    <div className="h-screen flex items-center justify-center bg-slate-950 p-6 font-sans">
      <div className="bg-white p-10 rounded-[3.5rem] shadow-2xl w-full max-w-sm border border-white/5 animate-in zoom-in-95 duration-500">
        <div className="bg-slate-900 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-slate-900/40">
          <ShieldCheck className="text-amber-400 w-8 h-8" />
        </div>
        <h2 className="text-3xl font-black text-slate-800 uppercase mb-1 text-center tracking-tighter leading-none">Anumana</h2>
        <p className="text-slate-400 text-[10px] text-center mb-10 font-black uppercase tracking-widest italic leading-tight text-nowrap">Analitik Nuansa & Manajemen Ancaman</p>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="relative group">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
            <input 
              type="email" 
              placeholder="Email Terdaftar" 
              className="w-full bg-slate-50 border-2 border-transparent rounded-2xl pl-12 pr-6 py-4 text-sm font-bold focus:border-slate-900 focus:bg-white transition-all outline-none" 
              value={emailInput} 
              onChange={(e) => setEmailInput(e.target.value)} 
              required 
            />
          </div>
          <div className="relative group">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
            <input 
              type="password" 
              placeholder="Password" 
              className="w-full bg-slate-50 border-2 border-transparent rounded-2xl pl-12 pr-6 py-4 text-sm font-bold focus:border-slate-900 focus:bg-white transition-all outline-none" 
              value={passwordInput} 
              onChange={(e) => setPasswordInput(e.target.value)} 
              required 
            />
          </div>
          
          {authError && <p className="text-rose-500 text-[10px] font-black text-center uppercase leading-tight px-2">{authError}</p>}
          
          <button type="submit" className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl hover:bg-slate-800 transition-all shadow-xl active:scale-[0.98] uppercase tracking-widest text-xs">
            Masuk Dashboard
          </button>
        </form>
        
        <div className="mt-6 text-center flex items-center justify-center gap-2 text-emerald-500">
          <Database className="w-3 h-3" />
          <p className="text-[9px] font-bold uppercase tracking-widest">Google Sheets Connected</p>
        </div>
      </div>
    </div>
  );
}