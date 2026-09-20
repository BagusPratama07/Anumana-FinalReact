// @ts-nocheck
import React from "react";
import { Users, UserPlus, UserMinus } from "lucide-react";

export default function UserManagement({
  whitelist,
  newWhitelistedEmail,
  setNewWhitelistedEmail,
  newWhitelistedPass,
  setNewWhitelistedPass,
  handleAddUser,
  handleDeleteUser
}) {
  return (
    <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-10 animate-in slide-in-from-bottom-4">
      <h3 className="text-xl font-black mb-10 flex items-center gap-4 text-slate-800 uppercase tracking-tight">
        <Users className="text-indigo-600 w-8 h-8" /> Whitelist Akses Tim
      </h3>
      
      <div className="flex flex-col sm:flex-row gap-4 mb-10 pb-10 border-b border-slate-50">
        <input 
          type="email" 
          placeholder="Email Baru..." 
          className="flex-1 bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500" 
          value={newWhitelistedEmail} 
          onChange={(e) => setNewWhitelistedEmail(e.target.value)} 
        />
        <input 
          type="password" 
          placeholder="Pass Awal" 
          className="w-full sm:w-40 bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500" 
          value={newWhitelistedPass} 
          onChange={(e) => setNewWhitelistedPass(e.target.value)} 
        />
        <button 
          onClick={handleAddUser} 
          className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase shadow-lg active:scale-95 transition-all">
          <UserPlus className="w-5 h-5 mx-auto" />
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {whitelist.map((item, index) => (
          <div key={index} className="bg-slate-50 p-8 rounded-[2rem] flex items-center justify-between shadow-sm group hover:border-slate-300 transition-all border border-transparent">
            <span className="text-sm font-black text-slate-700 truncate">{item.email}</span>
            <button 
              onClick={() => handleDeleteUser(item.email)} 
              className="p-3 text-slate-300 hover:text-rose-600 transition-all">
              <UserMinus className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}