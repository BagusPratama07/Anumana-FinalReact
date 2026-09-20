// @ts-nocheck
import React from "react";
import { X } from "lucide-react";

export default function ProfileModal({ user, onClose }) {
  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden">
        <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
          <h3 className="text-xl font-black uppercase tracking-tight">Akun Profil</h3>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-8 space-y-6">
          <div className="text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Email Aktif</p>
            <p className="text-sm font-black text-slate-800 break-all leading-tight">{user?.email}</p>
            {user?.role === "admin" && (
              <p className="text-[10px] font-black text-emerald-600 bg-emerald-50 inline-block px-3 py-1 rounded-full mt-2 uppercase">
                Akses Admin
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}