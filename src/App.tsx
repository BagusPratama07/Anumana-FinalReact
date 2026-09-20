// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, AreaChart, Area, PieChart, Pie, Legend,
} from "recharts";
import {
  ShieldAlert, Clock, Calendar, TrendingUp, AlertOctagon, Zap, Info, 
  ShieldCheck, ChevronRight, Activity, BarChart3, LogOut, Plus, X, 
  Upload, FileText, Trash2, Mail, Lock, User, KeyRound, Users, UserPlus, 
  UserMinus, Database, History, ChevronDown, ChevronUp, Filter, AlertTriangle, 
  MapPin, EyeOff, UserX,
} from "lucide-react";
import {
  SEVERITY_WEIGHTS, SEVERITY_NORM, HAZARD_RISK_W, HAZARD_STATUS_W, HAZARD_TYPE_W,
  fetchSheetData, appendSheetData, parseSafeDate, safeSplitCSV
} from "./utils/helpers";
import ImportModal from "./components/ImportModal";
import EntryModal from "./components/EntryModal";
import Login from "./components/Login";
import UserManagement from "./components/UserManagement";
import useAnalytics from "./hooks/useAnalytics";

export default function App() {
  const [user, setUser] = useState(null);
  const [sessionEmail, setSessionEmail] = useState(localStorage.getItem("anumana_v31_email") || "");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("dashboard");

  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");

  const [whitelist, setWhitelist] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [hazards, setHazards] = useState([]);
  const [observations, setObservations] = useState([]);

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [importType, setImportType] = useState("incident");

  const [newWhitelistedEmail, setNewWhitelistedEmail] = useState("");
  const [newWhitelistedPass, setNewWhitelistedPass] = useState("Anumana@2026");

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyMonth, setHistoryMonth] = useState("All");
  const [selectedArea, setSelectedArea] = useState("All PIT");
  const [dashboardSummary, setDashboardSummary] = useState(null);

useEffect(() => {
  const initApp = async () => {
    setLoading(true);
    try {
      // KITA HANYA AMBIL 3 DATA INI SEKARANG (Jauh lebih ringan!)
      const [wData, iData, summaryData] = await Promise.all([
        fetchSheetData("whitelist"),
        fetchSheetData("incidents"), // Data insiden ukurannya kecil, aman ditarik semua
        fetchSheetData("Dashboard_Summary"),
      ]);

      setWhitelist(wData);
      setIncidents(iData.sort((a, b) => parseSafeDate(b.date).getTime() - parseSafeDate(a.date).getTime()));

      // Data dari Google Sheets biasanya ada di array pertama, index key pertama
      if (summaryData && summaryData.length > 0) {
        // Karena format doGet kita mengembalikan array of object, kita ambil string JSON-nya
        const rawJsonStr = Object.values(summaryData[0])[0]; 
        setDashboardSummary(JSON.parse(rawJsonStr).data);
      }

      // KOSONGKAN Hazard dan Observasi (Beban 215k baris hilang!)
      setHazards([]); 
      setObservations([]);

      // ... logika sesi email login ...
    } catch (e) {
      console.error("Gagal sinkronisasi dengan Spreadsheet", e);
    }
    setLoading(false);
  };

  initApp();
}, [sessionEmail]);

  const { analytics, historicalLogs } = useAnalytics({
    incidents, hazards, observations, selectedArea, dashboardSummary, historyMonth
  }); [incidents, hazards, observations, selectedArea, dashboardSummary]; // <--- Pastikan dashboardSummary ditambahkan di sini

  const { analytics, historicalLogs } = useAnalytics({
    incidents, hazards, observations, selectedArea, dashboardSummary, historyMonth
  });
  
  const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

  const getBarColor = (weight, avg, redThreshold) => {
    if (weight > redThreshold && weight > 0) return "#e11d48";
    if (weight > avg && weight > 0) return "#3b82f6";
    return "#94a3b8";
  };

  const getProbColor = (prob) => {
    if (prob > 64) return "text-rose-600 bg-rose-100 border-rose-200";
    if (prob > 36) return "text-orange-600 bg-orange-100 border-orange-200";
    if (prob > 16) return "text-amber-600 bg-amber-100 border-amber-200";
    return "text-emerald-600 bg-emerald-100 border-emerald-200";
  };

  const getProbLabel = (prob) => {
    if (prob > 64) return "EXTREME";
    if (prob > 36) return "HIGH";
    if (prob > 16) return "MODERATE";
    return "LOW";
  };

  const handleLogin = (e) => {
    e.preventDefault();
    setAuthError("");
    const emailLower = emailInput.toLowerCase();

    const foundUser = whitelist.find((u) => u.email === emailLower);

    if (foundUser && String(foundUser.password) === String(passwordInput)) {
      setSessionEmail(emailLower);
      localStorage.setItem("anumana_v31_email", emailLower);
      setUser({ email: emailLower, role: foundUser.role });
    } else {
      setAuthError("Email atau password tidak terdaftar / salah.");
    }
  };

  const handleLogout = () => {
    setSessionEmail("");
    localStorage.removeItem("anumana_v31_email");
    setUser(null);
    setView("dashboard");
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const labelMapping = { incident: "Insiden", hazard: "Hazard", observasi: "Observasi" };
    setImportStatus(`Memproses Data ${labelMapping[importType]}...`);
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
        if (lines.length < 2) { setImportStatus("File CSV kosong."); return; }

        const header = lines[0];
        const delimiter = header.includes(";") ? ";" : ",";
        const rows = lines.slice(1);
        let validRecords = [];

        if (importType === "hazard") {
          // Normalisasi header menjadi huruf kecil semua untuk pencarian presisi
          const headers = header.split(delimiter).map((h) => h.trim().toLowerCase());
          
          // Pencarian indeks berdasarkan struktur kolom terbaru
          const idxHazardId = headers.findIndex((h) => h === "hazard id");
          const idxCompany = headers.findIndex((h) => h === "perusahaan pelapor");
          const idxType = headers.findIndex((h) => h.includes("jenis temuan"));
          const idxRisk = headers.findIndex((h) => h === "resiko temuan");
          const idxDate = headers.findIndex((h) => h === "tanggal laporan");
          const idxLoc = headers.findIndex((h) => h === "lokasi laporan");
          const idxSubLoc = headers.findIndex((h) => h.includes("sub lokasi"));
          const idxStatus = headers.findIndex((h) => h === "status laporan");
          const idxJudul = headers.findIndex((h) => h === "judul laporan");

          rows.forEach((line) => {
            const cols = safeSplitCSV(line, delimiter);
            if (cols.length < 5) return;

            // 1. Filter Perusahaan: Membaca "pt cipta kridatama" dari kolom Perusahaan Pelapor
            const company = cols[idxCompany]?.trim().toLowerCase();
            if (!company || !company.includes("cipta")) return;

            // 2. Deteksi Area PIT: Memasukkan KGB ke dalam keranjang KSB
            const lokasi = cols[idxLoc]?.trim();
            let pit = "All PIT"; 
            if (lokasi) {
              const locLower = lokasi.toLowerCase();
              if (locLower.includes("grb") || locLower.includes("girimulya")) {pit = "GRB";}
              // Tambahkan "kgb" di baris ini agar diakui sebagai KSB
              else if (locLower.includes("ksb") || locLower.includes("kusan") || locLower.includes("kgb")) {pit = "KSB";}
            }

            // 3. Ekstraksi Nilai Tambahan
            const jenis = cols[idxType]?.trim();
            const resiko = cols[idxRisk]?.trim();
            const subLokasi = cols[idxSubLoc]?.trim();
            const status = cols[idxStatus]?.trim(); // Mengambil dari 'Status Laporan', bukan kolom 'Status' paling akhir
            const judul = cols[idxJudul]?.trim() || "Hazard Report";
            let rawDate = cols[idxDate]?.trim();

            // Memotong jam dari tanggal (Contoh: "2026-09-01 02:51:00" menjadi "2026-09-01")
            if (rawDate && rawDate.includes(" ")) rawDate = rawDate.split(" ")[0];

            if (pit && rawDate) {
              // 4. Pembentukan Primary Key Menggunakan Hazard ID Asli
              const rawHazardId = cols[idxHazardId]?.trim();
              const deterministicId = rawHazardId 
                ? `hz_${rawHazardId}`.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase()
                : `hz_${rawDate}_${pit}_${jenis}_${lokasi}`.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

              const existingData = hazards.find(h => h.id === deterministicId);

              // 5. Logika Upsert: Abaikan jika data sama persis, update jika status berubah
              if (existingData) {
                if (existingData.status?.toLowerCase() !== status?.toLowerCase()) {
                  validRecords.push({
                    id: deterministicId, pit, judul, date: rawDate,
                    jenis, resiko, lokasi, subLokasi, status, timestamp: Date.now(), type: "hazard",
                  });
                }
                return;
              }

              // Input data baru jika Hazard ID belum pernah ada
              validRecords.push({
                id: deterministicId, pit, judul, date: rawDate,
                jenis, resiko, lokasi, subLokasi, status, timestamp: Date.now(), type: "hazard",
              });
            }
          });
        } else if (importType === "observasi") {
          const headers = header.split(delimiter).map((h) => h.trim().toLowerCase());
          const idxDate = headers.findIndex((h) => h.includes("tanggal observasi"));
          const idxSubLoc = headers.findIndex((h) => h === "sublokasi observasi" || h.includes("sub lokasi") || h.includes("sublokasi"));
          const idxTemuan = headers.findIndex((h) => h.includes("jumlah temuan"));
          const idxPelapor = headers.findIndex((h) => h === "nama pelapor");

          rows.forEach((line) => {
            const cols = safeSplitCSV(line, delimiter);
            if (cols.length < 5) return;
            const rawLineStr = line.toLowerCase();
            if (!rawLineStr.includes("cipta kridatama")) return;

            let pit = "";
            if (rawLineStr.includes("girimulya")) pit = "GRB";
            else if (rawLineStr.includes("kusan")) pit = "KSB";
            else return;

            const subLokasi = cols[idxSubLoc]?.trim() || "Unknown";
            const temuan = cols[idxTemuan]?.trim() || "0";
            const pelapor = cols[idxPelapor]?.trim() || "Unknown User";
            let rawDate = cols[idxDate]?.trim();

            if (rawDate && rawDate.includes(" ")) rawDate = rawDate.split(" ")[0];

            if (pit && rawDate) {
              // LOGIKA ANTI DOUBLING OBSERVASI
              const deterministicId = `ob_${rawDate}_${pit}_${pelapor}_${subLokasi}`.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
              const existingData = observations.find(o => o.id === deterministicId);

              if (existingData) return; // Abaikan jika sama persis

              validRecords.push({
                id: deterministicId, pit, date: rawDate,
                subLokasi, temuan, pelapor, timestamp: Date.now(), type: "observasi",
              });
            }
          });
        } else {
          rows.forEach((line) => {
            const cols = line.split(delimiter);
            const category = cols[1]?.trim();
            const pit = cols[2]?.trim() || "All PIT";
            const judul = cols[3]?.trim() || "Import CSV Data";
            const rawDate = cols[4]?.trim() || cols[3]?.trim();

            if (category && rawDate && SEVERITY_WEIGHTS[category]) {
              validRecords.push({
                id: `in_${Date.now()}_${Math.random()}`, category, pit, judul, date: rawDate, timestamp: Date.now(), type: "incident",
              });
            }
          });
        }

        if (validRecords.length > 0) {
          setImportStatus(`Menyimpan ${validRecords.length} record ter-update ke Spreadsheet...`);
          const targetSheet = importType === "incident" ? "incidents" : importType === "hazard" ? "hazards" : "observations";

          // UPDATE LAYAR UI AGAR TIDAK TUMPNANG TINDIH
          if (importType === "hazard") {
            setHazards((prev) => {
              const newIds = validRecords.map(r => r.id);
              return [...prev.filter(p => !newIds.includes(p.id)), ...validRecords];
            });
          } else if (importType === "observasi") {
            setObservations((prev) => {
              const newIds = validRecords.map(r => r.id);
              return [...prev.filter(p => !newIds.includes(p.id)), ...validRecords];
            });
          } else {
            setIncidents((prev) => [...prev, ...validRecords].sort((a, b) => parseSafeDate(b.date).getTime() - parseSafeDate(a.date).getTime()));
          }

          await appendSheetData(targetSheet, validRecords);

          setImportStatus(`Sukses: ${validRecords.length} data ter-update di Spreadsheet!`);
          setTimeout(() => { setIsImportModalOpen(false); setImportStatus(""); }, 2000);
        } else {
          setImportStatus("Semua data sudah ada (Tidak ada yang di-update).");
        }
      } catch (err) {
        setImportStatus(`Gagal: ${err.message.slice(0, 30)}...`);
      }
    };
    reader.readAsText(file);
  };

  const submitManual = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newIncident = {
      id: `in_manual_${Date.now()}`, judul: formData.get("judul"), pit: formData.get("pit"),
      category: formData.get("category"), date: formData.get("date"), timestamp: Date.now(), type: "incident",
    };

    setIncidents((prev) => [newIncident, ...prev].sort((a, b) => parseSafeDate(b.date).getTime() - parseSafeDate(a.date).getTime()));
    setIsEntryModalOpen(false);
    await appendSheetData("incidents", newIncident);
  };

  const handleDeleteIncident = (id) => {
    if (window.confirm("Perhatian: Aplikasi ini hanya menghapus data di layar Anda. Untuk menghapus permanen, Anda harus menghapus barisnya langsung di Google Spreadsheet.\n\nLanjutkan sembunyikan dari layar?")) {
      setIncidents((prev) => prev.filter((i) => i.id !== id));
    }
  };

  const handleAddUser = async () => {
    if (!newWhitelistedEmail) return;
    const emailLower = newWhitelistedEmail.toLowerCase();
    if (whitelist.find((u) => u.email === emailLower)) { alert("User sudah terdaftar"); return; }

    const newUser = { email: emailLower, password: newWhitelistedPass, role: "member", addedBy: user.email, addedAt: Date.now() };
    setWhitelist((prev) => [...prev, newUser]);
    setNewWhitelistedEmail("");
    await appendSheetData("whitelist", newUser);
  };

  const handleDeleteUser = (emailToRemove) => {
    if (window.confirm("Perhatian: Aplikasi ini hanya menyembunyikan akses sementara. Untuk mencabut akses permanen, hapus baris email ini di tab 'whitelist' Google Spreadsheet.\n\nLanjutkan?")) {
      setWhitelist((prev) => prev.filter((u) => u.email !== emailToRemove));
    }
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-950 text-white font-black uppercase tracking-[0.5em] text-[10px]">
      Memuat Anumana...
    </div>
  );

  if (!user) {
    return (
      <Login 
        handleLogin={handleLogin}
        emailInput={emailInput}
        setEmailInput={setEmailInput}
        passwordInput={passwordInput}
        setPasswordInput={setPasswordInput}
        authError={authError}
      />
    );
  }

  const COLORS = ["#e11d48", "#f59e0b", "#10b981"];

  return (
    <div className="min-h-screen bg-[#F1F5F9] font-sans text-slate-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 mb-8 gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-slate-900 p-3 rounded-2xl shadow-xl"><Zap className="text-amber-400 w-6 h-6" /></div>
            <div>
              <h1 className="text-xl font-black text-slate-800 tracking-tight uppercase leading-none">Anumana CK-BIB</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1 italic">Knowledge After Perception</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-slate-100 p-1.5 rounded-2xl flex shadow-inner">
              <button onClick={() => setView("dashboard")} className={`px-5 py-2 rounded-xl text-[10px] font-black transition-all ${view === "dashboard" ? "bg-white shadow-sm text-slate-900" : "text-slate-400"}`}>DASHBOARD</button>
              {user.role === "admin" && (
                <button onClick={() => setView("users")} className={`px-5 py-2 rounded-xl text-[10px] font-black transition-all ${view === "users" ? "bg-white shadow-sm text-slate-900" : "text-slate-400"}`}>KELOLA AKSES</button>
              )}
            </div>
            {view === "dashboard" && (
              <div className="bg-slate-100 p-1.5 rounded-2xl flex mr-2">
                {["All PIT", "GRB", "KSB"].map((area) => (
                  <button key={area} onClick={() => setSelectedArea(area)} className={`px-5 py-2 rounded-xl text-[10px] font-black transition-all ${selectedArea === area ? "bg-white shadow-sm text-slate-900" : "text-slate-400"}`}>{area}</button>
                ))}
              </div>
            )}
            {(user.role === "admin" || user.role === "member") && (
              <button onClick={() => setIsImportModalOpen(true)} className="bg-indigo-600 text-white text-[10px] font-black px-5 py-3 rounded-xl flex items-center gap-2 hover:bg-indigo-700 shadow-lg transition-all"><Upload className="w-4 h-4" /> CSV DATA</button>
            )}
            <button onClick={() => setIsEntryModalOpen(true)} className="bg-slate-900 text-white text-[10px] font-black px-5 py-3 rounded-xl flex items-center gap-2 hover:bg-slate-800 shadow-lg transition-all active:scale-95"><Plus className="w-4 h-4" /> MANUAL LOG</button>
            <div className="flex items-center gap-1 ml-2">
              <button onClick={() => setIsProfileOpen(true)} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:text-slate-900 transition-all"><User className="w-4 h-4" /></button>
              <button onClick={handleLogout} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:text-rose-600 transition-all shadow-sm"><LogOut className="w-4 h-4" /></button>
            </div>
          </div>
        </header>

        {view === "dashboard" ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
              <div className="lg:col-span-2 bg-slate-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden flex flex-col justify-between shadow-2xl">
                <div className="relative z-10">
                  <div className="flex justify-between items-start">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Live Probabilitas ({selectedArea})</p>
                    <span className="bg-white/10 text-emerald-400 px-3 py-1 rounded-full text-[9px] font-bold tracking-widest uppercase">Total: {analytics.dataCount} Data Log</span>
                  </div>
                  <h2 className="text-8xl font-black tracking-tighter leading-none mt-2">{analytics.forecast[0].prob}%</h2>
                  <div className={`mt-8 inline-flex items-center gap-3 px-6 py-3 rounded-2xl border-2 ${getProbColor(analytics.forecast[0].prob)}`}>
                    <div className="w-3 h-3 rounded-full animate-pulse bg-current"></div>
                    <span className="text-[11px] font-black uppercase tracking-widest">{getProbLabel(analytics.forecast[0].prob)} LEVEL</span>
                  </div>
                </div>
                <Activity className="absolute -right-12 -bottom-12 w-64 h-64 text-white/5 rotate-12" />
              </div>
              <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm flex flex-col justify-between">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Exposure Days</p>
                  <h3 className="text-6xl font-black text-slate-800 tracking-tighter leading-none">{analytics.dayCount} <span className="text-xl text-slate-300">Days</span></h3>
                </div>
                <div className="mt-4 border-t pt-6 text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
                  Siklus Ke: <span className="text-rose-600 font-bold text-sm">#{Math.floor(analytics.dayCount / analytics.maxCycleLength) + 1}</span><br />
                  Hari Efektif Siklus: <span className="text-slate-900 font-bold">{analytics.dayCount % analytics.maxCycleLength} / {analytics.maxCycleLength}</span>
                </div>
              </div>
              <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm flex flex-col justify-between overflow-hidden relative">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Rata-Rata Area ({selectedArea})</p>
                  <h3 className="text-6xl font-black text-slate-800 tracking-tighter leading-none">{analytics.avgInterval || 0} <span className="text-xl text-slate-300">d</span></h3>
                </div>
                <div className="mt-4 border-t pt-6 text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
                  Standar Deviasi: <span className="text-indigo-600 font-bold">±{analytics.stdDevInterval} Hari</span>
                </div>
                <Database className="absolute bottom-6 right-6 text-slate-50 w-12 h-12" />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2"><EyeOff className="w-4 h-4 text-slate-900" /> Titik Buta Pengawasan (Blind Spots)</h3>
                </div>
                <div className="flex-1 overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <tr>
                        <th className="px-4 py-3">Lokasi Rawan (Top Hazard)</th>
                        <th className="px-4 py-3 text-center">Jumlah Hazard</th>
                        <th className="px-4 py-3 text-center">Frekuensi Observasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {analytics.blindSpots.length > 0 ? (
                        analytics.blindSpots.map((spot, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 text-xs font-bold text-slate-700 truncate max-w-[150px]">{spot.loc}</td>
                            <td className="px-4 py-3 text-center"><span className="text-xs font-black text-rose-600 bg-rose-50 px-2 py-1 rounded-md">{spot.hazCount}</span></td>
                            <td className="px-4 py-3 text-center"><span className={`text-xs font-black px-2 py-1 rounded-md ${spot.obsCount === 0 ? "bg-slate-800 text-white" : spot.obsCount < 3 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{spot.obsCount}</span></td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan="3" className="px-4 py-8 text-center text-xs text-slate-400 font-bold">Belum ada data Blind Spot di {selectedArea}.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100 text-[9px] font-medium text-slate-400 uppercase tracking-widest text-center">Sub-lokasi di atas memiliki Hazard Tinggi namun diabaikan pengawas.</div>
              </div>
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2"><UserX className="w-4 h-4 text-slate-900" /> Top 5 Pelapor Pasif (0 Temuan)</h3>
                </div>
                <div className="flex-1 overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <tr>
                        <th className="px-4 py-3">Nama Pelapor</th>
                        <th className="px-4 py-3 text-right">Observasi Tanpa Temuan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {analytics.topPasif.length > 0 ? (
                        analytics.topPasif.map((person, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 text-xs font-bold text-slate-700">{person[0]}</td>
                            <td className="px-4 py-3 text-right"><span className="text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg">{person[1]} Laporan</span></td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan="2" className="px-4 py-8 text-center text-xs text-slate-400 font-bold">Belum ada data pelapor pasif di {selectedArea}.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100 text-[9px] font-medium text-slate-400 uppercase tracking-widest text-center">Data ini menjadi penyumbang Penalty m5 (Kualitas Pengawasan).</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col items-center">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-2 w-full"><AlertTriangle className="w-4 h-4 text-amber-500" /> Rasio Hazard KTA vs TTA</h3>
                <div className="w-full h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={[{ name: "KTA (Kondisi)", value: analytics.hazardStats.ktaCount }, { name: "TTA (Tindakan)", value: analytics.hazardStats.ttaCount }]} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value"><Cell fill="#f59e0b" /><Cell fill="#e11d48" /></Pie>
                      <Tooltip contentStyle={{ borderRadius: "15px", border: "none", fontSize: "10px", fontWeight: "bold" }} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col items-center">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-2 w-full"><ShieldCheck className="w-4 h-4 text-emerald-500" /> Status Penyelesaian Hazard</h3>
                <div className="w-full h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={[{ name: "Open (High Risk)", value: analytics.hazardStats.statOpen }, { name: "Followup", value: analytics.hazardStats.statFollow }, { name: "Closed (END)", value: analytics.hazardStats.statEnd }]} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                        {COLORS.map((color, index) => (<Cell key={`cell-${index}`} fill={color} />))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: "15px", border: "none", fontSize: "10px", fontWeight: "bold" }} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 h-96 flex flex-col">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                  <div><h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2"><BarChart3 className="w-4 h-4 text-slate-900" /> Bobot Risiko Area ({selectedArea})</h3></div>
                </div>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.dist} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 800 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: "#cbd5e1", fontSize: 10 }} />
                      <Tooltip cursor={{ fill: "#f1f5f9" }} contentStyle={{ borderRadius: "20px", border: "none", boxShadow: "0 10px 30px rgba(0,0,0,0.05)" }} />
                      <Bar dataKey="weighted" name="Total Bobot Insiden" radius={[8, 8, 8, 8]} barSize={40}>
                        {analytics.dist.map((entry, index) => (<Cell key={`cell-${index}`} fill={getBarColor(entry.weighted, analytics.avgWeighted, analytics.redThreshold)} />))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100 text-[10px] font-medium text-slate-400 leading-relaxed text-center sm:text-left"><span className="font-bold text-slate-700">Formula Ambang Batas {selectedArea}:</span><br />Avg ({analytics.avgWeighted.toFixed(0)}) + StdDev ({analytics.stdDevWeighted.toFixed(0)}) = <strong className="text-rose-600">Batas Anomali: {analytics.redThreshold.toFixed(0)}</strong></div>
              </div>
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 h-96 flex flex-col">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-slate-900" /> Prediksi 7 Hari (Integrated 5-Pillar)</h3>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analytics.forecast} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorP" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#1e293b" stopOpacity={0.2} /><stop offset="95%" stopColor="#1e293b" stopOpacity={0} /></linearGradient>
                      </defs>
                      <XAxis dataKey="date" hide />
                      <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: "#cbd5e1", fontSize: 10 }} />
                      <Tooltip contentStyle={{ borderRadius: "20px", border: "none" }} />
                      <Area type="monotone" dataKey="prob" name="Probabilitas %" stroke="#1e293b" strokeWidth={5} fillOpacity={1} fill="url(#colorP)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100 text-[10px] font-medium text-slate-400 leading-relaxed text-center sm:text-left">Sistem 5 Pilar: Exposure Day (m1), Anomali Insiden (m2), Category Incident (m3), Hazard Status Open (m4), dan Pelaksanaan Observasi (m5).</div>
              </div>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden mb-8">
              <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row justify-between items-center bg-slate-50/50 gap-6">
                <h3 className="font-black text-slate-800 uppercase tracking-tight text-sm">Matrix Forecasting : Area {selectedArea}</h3>
                <div className="flex items-center gap-2 px-4 py-1.5 bg-white border border-slate-100 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-widest shadow-sm"><Activity className="w-3 h-3 text-emerald-500" /> Integrated Risk Index (5 Parameters)</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-white text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    <tr><th className="px-10 py-6">Hari / Tanggal</th><th className="px-10 py-6">Status Risiko</th><th className="px-10 py-6">Probabilitas Akhir</th><th className="px-10 py-6">Detail Parameter (m1 - m5) & Sigma</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {analytics.forecast.map((row, idx) => {
                      const style = getProbColor(row.prob);
                      const label = getProbLabel(row.prob);
                      return (
                        <tr key={`f-${idx}`} className="hover:bg-slate-50 transition-colors">
                          <td className="px-10 py-6"><div className="font-black text-slate-800">{row.day}</div><div className="text-[10px] text-slate-400 font-bold">{row.date}</div></td>
                          <td className="px-10 py-6"><span className={`px-4 py-1.5 rounded-full text-[10px] font-black border uppercase ${style}`}>{label}</span></td>
                          <td className="px-10 py-6">
                            <div className="flex items-center gap-4">
                              <span className="font-black text-slate-800 text-xl w-12">{row.prob}%</span>
                              <div className="w-24 bg-slate-100 h-1.5 rounded-full hidden sm:block overflow-hidden"><div className={`h-full transition-all duration-500 ${row.prob > 64 ? "bg-rose-500" : row.prob > 36 ? "bg-orange-500" : row.prob > 16 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${row.prob}%` }}></div></div>
                            </div>
                          </td>
                          <td className="px-10 py-6">
                            <div className="text-[11px] font-bold text-slate-800 bg-slate-100 inline-block px-2 py-0.5 rounded mb-1">Σ = {row.sigma} | Siklus {row.currentCycle} (Hari Ke-{row.effectiveDay})</div>
                            <div className="text-[9px] font-medium text-slate-500 uppercase tracking-widest leading-relaxed">m1 (ED): {row.m1} | m2 (AI): {row.m2} | m3 (CI): {row.m3} <br /><span className="text-amber-600 font-bold">m4 (HO): {row.m4}</span> | <span className="text-rose-600 font-bold">m5 (PO): {row.m5}</span></div>
                            <div className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mt-1">FK 1: {row.penaltyScore}% | FK 2: {row.dayScore}%</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden mb-12">
              <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row justify-between items-center bg-slate-50/50 gap-6 cursor-pointer hover:bg-slate-100/50 transition-colors" onClick={() => setIsHistoryOpen(!isHistoryOpen)}>
                <div className="flex items-center gap-4"><div className="bg-slate-900 p-2.5 rounded-xl text-white"><History className="w-5 h-5" /></div><h3 className="font-black text-slate-800 uppercase tracking-tight text-sm">Log Insiden Historikal ({selectedArea})</h3></div>
                <div className="flex items-center gap-4"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 py-1 bg-white border border-slate-200 rounded-full">{historicalLogs.length} Data Terbaca</span>{isHistoryOpen ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}</div>
              </div>
              {isHistoryOpen && (
                <div className="p-8 animate-in slide-in-from-top-4 duration-300">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest"><Filter className="w-4 h-4" /> Filter Bulan:</div>
                    <select className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-4 py-2.5 outline-none focus:border-slate-400 focus:bg-white transition-all cursor-pointer" value={historyMonth} onChange={(e) => setHistoryMonth(e.target.value)}>
                      <option value="All">Semua Bulan Data</option>
                      {monthNames.map((m, idx) => (<option key={idx} value={idx}>{m}</option>))}
                    </select>
                  </div>
                  <div className="overflow-x-auto rounded-2xl border border-slate-100">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                        <tr><th className="px-6 py-4">Tanggal</th><th className="px-6 py-4">Kategori</th><th className="px-6 py-4">Prediksi Pra-Insiden</th><th className="px-6 py-4">Deskripsi Insiden</th><th className="px-6 py-4 text-center">PIT Area</th><th className="px-6 py-4 text-right">Aksi</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {historicalLogs.length > 0 ? (
                          historicalLogs.map((log) => {
                            const preStyle = getProbColor(log.preRisk);
                            const preLabel = getProbLabel(log.preRisk);
                            return (
                              <tr key={log.id} className="hover:bg-slate-50 transition-colors group">
                                <td className="px-6 py-5 text-xs font-bold text-slate-700 whitespace-nowrap">{log.date}</td>
                                <td className="px-6 py-5"><span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${["Fatality", "LTI"].includes(log.category) ? "bg-rose-100 text-rose-600" : ["RWDI", "MTC"].includes(log.category) ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-600"}`}>{log.category}</span></td>
                                <td className="px-6 py-5"><span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border ${preStyle}`}>{log.preRisk}% ({preLabel})</span></td>
                                <td className="px-6 py-5 text-xs font-medium text-slate-600 min-w-[200px] max-w-sm truncate" title={log.judul}>{log.judul}</td>
                                <td className="px-6 py-5 text-center"><span className="px-3 py-1 bg-white border border-slate-200 rounded-md text-[10px] font-black text-slate-500 uppercase tracking-widest">{log.pit}</span></td>
                                <td className="px-6 py-5 text-right">
                                  {user.role === "admin" && (
                                    <button onClick={() => handleDeleteIncident(log.id)} className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr><td colSpan="6" className="px-6 py-12 text-center"><div className="flex flex-col items-center justify-center text-slate-400"><Database className="w-8 h-8 mb-3 opacity-20" /><span className="text-xs font-bold uppercase tracking-widest">Tidak ada insiden tercatat pada filter ini.</span></div></td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <UserManagement 
            whitelist={whitelist}
            newWhitelistedEmail={newWhitelistedEmail}
            setNewWhitelistedEmail={setNewWhitelistedEmail}
            newWhitelistedPass={newWhitelistedPass}
            setNewWhitelistedPass={setNewWhitelistedPass}
            handleAddUser={handleAddUser}
            handleDeleteUser={handleDeleteUser}
          />
        )}
      </div>

      {isProfileOpen && (
        <ProfileModal 
          user={user} 
          onClose={() => setIsProfileOpen(false)} 
        />
      )}

      {isImportModalOpen && (
        <ImportModal 
          onClose={() => { setIsImportModalOpen(false); setImportStatus(""); }}
          importType={importType}
          setImportType={setImportType}
          handleFileUpload={handleFileUpload}
          importStatus={importStatus}
        />
      )}      
      {isEntryModalOpen && (
        <EntryModal 
          onClose={() => setIsEntryModalOpen(false)} 
          submitManual={submitManual} 
        />
      )}
    </div>
  );
}
