// @ts-nocheck
import { useMemo } from "react";
import {
  SEVERITY_WEIGHTS,
  SEVERITY_NORM,
  HAZARD_RISK_W,
  HAZARD_STATUS_W,
  HAZARD_TYPE_W,
  parseSafeDate
} from "../utils/helpers";

export default function useAnalytics({
  incidents,
  hazards,
  observations,
  selectedArea,
  dashboardSummary,
  historyMonth
}) {
  
  // 1. ANALITIK UTAMA (DASHBOARD & PREDIKSI MASA DEPAN)
  // Blok ini menghitung status hari ini dan prediksi 7 hari ke depan
  const analytics = useMemo(() => {
    // A. FILTER DATA BERDASARKAN AREA (PIT)
    const filteredIncidents = selectedArea === "All PIT" ? incidents : incidents.filter((i) => i.pit === selectedArea);
    const filteredHazards = selectedArea === "All PIT" ? hazards : hazards.filter((h) => h.pit === selectedArea);
    const filteredObs = selectedArea === "All PIT" ? observations : observations.filter((o) => o.pit === selectedArea);

    // Urutkan insiden dari yang paling baru ke yang paling lama
    const sortedForMath = [...filteredIncidents].sort((a, b) => parseSafeDate(b.date).getTime() - parseSafeDate(a.date).getTime());
    const dataCount = sortedForMath.length;
    const today = new Date();

    // B. PERHITUNGAN EXPOSURE DAYS (Jarak Hari)
    // Dapatkan insiden terakhir, hitung sudah berapa hari kita bebas insiden
    const lastIncident = sortedForMath[0];
    const absoluteDayCount = lastIncident ? Math.floor((today - parseSafeDate(lastIncident.date)) / (1000 * 60 * 60 * 24)) : 0;

    // Hitung rata-rata siklus insiden (setiap berapa hari insiden biasanya terjadi)
    let avgInterval = 0, stdDevInterval = 0;
    if (sortedForMath.length > 0) {
      const gaps = [];
      if (sortedForMath.length > 1) {
        // Cari selisih hari antar insiden yang pernah terjadi
        for (let i = 0; i < sortedForMath.length - 1; i++) {
          const d1 = parseSafeDate(sortedForMath[i].date);
          const d2 = parseSafeDate(sortedForMath[i + 1].date);
          gaps.push(Math.abs((d1 - d2) / (1000 * 60 * 60 * 24)));
        }
      }
      // Gabungkan selisih hari masa lalu dengan jarak hari saat ini
      const allGaps = [...gaps, absoluteDayCount];
      avgInterval = allGaps.reduce((a, b) => a + b, 0) / allGaps.length; // Rata-rata jarak hari
      const variance = allGaps.reduce((a, b) => a + Math.pow(b - avgInterval, 2), 0) / allGaps.length;
      stdDevInterval = Math.sqrt(variance); // Standar Deviasi
    } else {
      // Jika belum ada data historis sama sekali
      avgInterval = absoluteDayCount > 0 ? absoluteDayCount : 10;
      stdDevInterval = avgInterval * 0.3;
    }
    // Batas maksimal siklus sebelum risiko memuncak
    const maxCycleLength = Math.max(1, Math.ceil(avgInterval + stdDevInterval));

    // C. ANALISIS HISTORIS HARI DALAM SEMINGGU
    // Mencari tahu hari apa yang paling rawan terjadi insiden (Senin-Minggu)
    const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const dist = dayNames.map((day) => {
      const dayData = sortedForMath.filter((i) => dayNames[parseSafeDate(i.date).getDay()] === day);
      const weighted = dayData.reduce((acc, curr) => acc + (SEVERITY_WEIGHTS[curr.category] || 0), 0);
      return { day, freq: dayData.length, weighted };
    });

    // Menentukan ambang batas bahaya (Red Threshold) per hari
    const avgWeighted = dist.reduce((a, b) => a + b.weighted, 0) / 7;
    const varianceWeighted = dist.reduce((a, b) => a + Math.pow(b.weighted - avgWeighted, 2), 0) / 7;
    const stdDevWeighted = Math.sqrt(varianceWeighted);
    const redThreshold = avgWeighted + stdDevWeighted;

    // D. CEK KONDISI INSIDEN TERAKHIR
    let m2_base = 0, m3_base = 0;
    if (sortedForMath.length > 0) {
      const lastDateMs = parseSafeDate(sortedForMath[0].date).getTime();
      const latestIncidents = sortedForMath.filter((i) => parseSafeDate(i.date).getTime() === lastDateMs);
      
      // Jika ada >1 insiden di hari yang sama, nilainya 1.0 (Anomali)
      m2_base = latestIncidents.length > 1 ? 1.0 : 0.0;
      
      // Ambil bobot keparahan terbesar dari insiden terakhir (m3)
      latestIncidents.forEach((inc) => {
        const val = SEVERITY_NORM[inc.category] || 0.05;
        if (val > m3_base) m3_base = val;
      });
    }

    // E. KALKULASI PREDIKSI 7 HARI KE DEPAN (KONSEP 5 PILAR)
    const forecast = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(); d.setDate(d.getDate() + i);
      const dTime = d.getTime();
      const dayName = dayNames[d.getDay()];
      const dayData = dist.find((x) => x.day === dayName);

      const daysSinceLastIncident = absoluteDayCount + i;
      
      // Pilar 1 (m1): Semakin lama tidak ada insiden (mendekati max cycle), skornya membesar
      const m1 = Math.min(1.0, daysSinceLastIncident / maxCycleLength);
      
      // Efek Pudar (Decay): Efek insiden terakhir akan memudar seiring berjalannya waktu
      const decayFactor = Math.pow(0.7, daysSinceLastIncident);
      const m2 = m2_base * decayFactor; // Pilar 2 (Anomali Insiden)
      const m3 = m3_base * decayFactor; // Pilar 3 (Keparahan Insiden Terakhir)

      // Pilar 4 (m4): Menghitung hazard (bahaya) yang masih open dalam 7 hari terakhir
      const sevDaysAgo = dTime - 7 * 24 * 60 * 60 * 1000;
      const activeHazards = filteredHazards.filter((h) => {
        const ht = parseSafeDate(h.date).getTime();
        return ht <= dTime && ht > sevDaysAgo;
      });
      let m4_raw = 0;
      activeHazards.forEach((h) => {
        const r = HAZARD_RISK_W[h.resiko?.toLowerCase()] || 1;
        const s = HAZARD_STATUS_W[h.status?.toLowerCase()] || 1.0;
        const t = HAZARD_TYPE_W[h.jenis?.toLowerCase()] || 1.0;
        m4_raw += r * s * t; // Kali lipatkan faktor risiko, status, dan jenis
      });
      const m4 = Math.min(1.0, m4_raw / 15); // Normalisasi maksimal 1.0

      // Pilar 5 (m5): Kualitas Observasi (mendeteksi pelapor yang sering ngisi angka 0/tanpa temuan)
      const activeObs = filteredObs.filter((o) => {
        const ot = parseSafeDate(o.date).getTime();
        return ot <= dTime && ot > sevDaysAgo;
      });
      let m5 = 1.0;
      if (activeObs.length > 0) {
        const zeroCount = activeObs.filter((o) => parseInt(o.temuan || 0) === 0).length;
        m5 = zeroCount / activeObs.length; // Persentase laporan yang "kosong" (0 temuan)
      }

      // Penggabungan 5 Pilar (Sigma) dengan persentase bobotnya masing-masing
      const w1 = 0.15, w2 = 0.15, w3 = 0.25, w4 = 0.25, w5 = 0.2;
      const sigma = w1 * m1 + w2 * m2 + w3 * m3 + w4 * m4 + w5 * m5;
      const penaltyScore = sigma * 60; // Faktor Penalti Harian

      // Skor Dasar Hari Ini (Faktor Historis)
      let dayScore = 15; // Base normal
      const weight = dayData ? dayData.weighted : 0;
      if (weight > redThreshold && weight > 0) dayScore = 40; // Sangat bahaya (di atas ambang)
      else if (weight > avgWeighted && weight > 0) dayScore = 25; // Bahaya menengah (di atas rata-rata)

      // Total Probabilitas Akhir (%)
      let finalProb = Math.round(penaltyScore + dayScore);
      if (sortedForMath.length === 0) finalProb = 5; // Default jika data kosong
      finalProb = Math.min(98, Math.max(5, finalProb)); // Kunci di rentang 5% hingga 98%

      return {
        date: d.toISOString().split("T")[0], day: dayName, prob: finalProb,
        m1: m1.toFixed(2), m2: m2.toFixed(2), m3: m3.toFixed(2), m4: m4.toFixed(2), m5: m5.toFixed(2),
        sigma: sigma.toFixed(3), penaltyScore: penaltyScore.toFixed(1), dayScore,
        currentCycle: Math.floor(daysSinceLastIncident / maxCycleLength) + 1,
        effectiveDay: daysSinceLastIncident % maxCycleLength,
      };
    });

    // F. STATISTIK HAZARD & BLIND SPOTS
    const locCounts = {};
    let ktaCount = 0, ttaCount = 0;
    let statOpen = 0, statFollow = 0, statEnd = 0;

    filteredHazards.forEach((h) => {
      const loc = h.subLokasi || h.lokasi || "Unknown";
      locCounts[loc] = (locCounts[loc] || 0) + 1;
      
      // Hitung KTA (Kondisi Tidak Aman) vs TTA (Tindakan Tidak Aman)
      if (h.jenis?.toLowerCase() === "kta") ktaCount++;
      else if (h.jenis?.toLowerCase() === "tta") ttaCount++;

      // Hitung status penyelesaian
      const s = h.status?.toLowerCase();
      if (s === "end") statEnd++;
      else if (s === "followup") statFollow++;
      else statOpen++;
    });
    // Ambil 5 lokasi dengan hazard terbanyak
    const top5Hazards = Object.entries(locCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // Titik Buta (Blind Spots): Sublokasi dengan hazard tinggi TAPI observasinya sangat sedikit
    const blindSpots = top5Hazards.map((haz) => {
      const loc = haz[0];
      const hazCount = haz[1];
      const obsCount = filteredObs.filter((o) => (o.subLokasi || "").toLowerCase() === loc.toLowerCase()).length;
      return { loc, hazCount, obsCount };
    }).sort((a, b) => a.obsCount - b.obsCount);

    // Pelapor Pasif: Pelapor yang sering membuat laporan observasi tapi selalu "0 temuan"
    const pelaporCounts = {};
    filteredObs.forEach((o) => {
      if (parseInt(o.temuan || 0) === 0) pelaporCounts[o.pelapor] = (pelaporCounts[o.pelapor] || 0) + 1;
    });
    const topPasif = Object.entries(pelaporCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    let finalHazardStats = { top5Hazards, ktaCount, ttaCount, statOpen, statFollow, statEnd };
    let finalBlindSpots = blindSpots;
    let finalTopPasif = topPasif;

    // Gunakan pre-calculated summary dari Google Sheets jika tersedia agar performa lebih cepat
    if (dashboardSummary && dashboardSummary[selectedArea]) {
      const sumArea = dashboardSummary[selectedArea];
      finalHazardStats = {
        top5Hazards: [],
        ktaCount: sumArea.hazardStats.kta,
        ttaCount: sumArea.hazardStats.tta,
        statOpen: sumArea.hazardStats.open,
        statFollow: sumArea.hazardStats.follow,
        statEnd: sumArea.hazardStats.end
      };
      finalBlindSpots = sumArea.blindSpots;
      finalTopPasif = sumArea.topPasif;
    }

    return {
      dataCount, dayCount: absoluteDayCount, avgInterval: parseFloat(avgInterval.toFixed(1)),
      stdDevInterval: parseFloat(stdDevInterval.toFixed(1)), maxCycleLength, lastIncident, forecast,
      dist, avgWeighted, stdDevWeighted, redThreshold, 
      hazardStats: finalHazardStats,
      blindSpots: finalBlindSpots, 
      topPasif: finalTopPasif,
    };
  }, [incidents, hazards, observations, selectedArea, dashboardSummary]);


  // 2. ANALITIK HISTORIS (BACKTESTING)
  // Blok ini menghitung seberapa akurat prediksi sistem tepat SEBELUM
  // sebuah insiden di masa lalu benar-benar terjadi.
  const historicalLogs = useMemo(() => {
    let data = selectedArea === "All PIT" ? incidents : incidents.filter((i) => i.pit === selectedArea);
    const hazardDataFiltered = selectedArea === "All PIT" ? hazards : hazards.filter((h) => h.pit === selectedArea);
    const obsDataFiltered = selectedArea === "All PIT" ? observations : observations.filter((o) => o.pit === selectedArea);

    data = [...data].sort((a, b) => parseSafeDate(b.date).getTime() - parseSafeDate(a.date).getTime());
    if (historyMonth !== "All") data = data.filter((i) => parseSafeDate(i.date).getMonth() === parseInt(historyMonth));

    // Looping melalui setiap insiden di masa lalu
    const logsWithPreRisk = data.map((log) => {
      const targetTime = parseSafeDate(log.date).getTime();
      
      // Saring hanya kejadian yang terjadi SEBELUM insiden ini (Simulasi ke masa lalu)
      const pastLogs = data.filter((p) => parseSafeDate(p.date).getTime() < targetTime);

      if (pastLogs.length === 0) return { ...log, preRisk: 5 };

      // Mulai simulasi perhitungan ulang 5 pilar khusus untuk tanggal tersebut
      const lastIncident = pastLogs[0];
      const absoluteDayCount = Math.floor((targetTime - parseSafeDate(lastIncident.date).getTime()) / (1000 * 60 * 60 * 24));

      let avgInt = 0, stdDevInt = 0;
      if (pastLogs.length > 0) {
        const gaps = [];
        if (pastLogs.length > 1) {
          for (let i = 0; i < pastLogs.length - 1; i++) gaps.push(Math.abs((parseSafeDate(pastLogs[i].date) - parseSafeDate(pastLogs[i + 1].date)) / (1000 * 60 * 60 * 24)));
        }
        const allGaps = [...gaps, absoluteDayCount];
        avgInt = allGaps.reduce((a, b) => a + b, 0) / allGaps.length;
        const variance = allGaps.reduce((a, b) => a + Math.pow(b - avgInt, 2), 0) / allGaps.length;
        stdDevInt = Math.sqrt(variance);
      } else {
        avgInt = absoluteDayCount > 0 ? absoluteDayCount : 10;
        stdDevInt = avgInt * 0.3;
      }
      const maxCycle = Math.max(1, Math.ceil(avgInt + stdDevInt));
      const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      const dist = dayNames.map((day) => {
        const dayData = pastLogs.filter((i) => dayNames[parseSafeDate(i.date).getDay()] === day);
        const weighted = dayData.reduce((acc, curr) => acc + (SEVERITY_WEIGHTS[curr.category] || 0), 0);
        return { day, weighted };
      });
      const avgW = dist.reduce((a, b) => a + b.weighted, 0) / 7;
      const varW = dist.reduce((a, b) => a + Math.pow(b.weighted - avgW, 2), 0) / 7;
      const stdDevW = Math.sqrt(varW);
      const redThreshold = avgW + stdDevW;

      let m2_base = 0; let m3_base = 0;
      const lastDateMs = parseSafeDate(pastLogs[0].date).getTime();
      const latestIncidents = pastLogs.filter((i) => parseSafeDate(i.date).getTime() === lastDateMs);
      m2_base = latestIncidents.length > 1 ? 1.0 : 0.0;
      latestIncidents.forEach((inc) => {
        const val = SEVERITY_NORM[inc.category] || 0.05;
        if (val > m3_base) m3_base = val;
      });

      const decayFactor = Math.pow(0.7, absoluteDayCount);
      const m1 = Math.min(1.0, absoluteDayCount / maxCycle); // m1 masa lalu
      const m2 = m2_base * decayFactor; // m2 masa lalu
      const m3 = m3_base * decayFactor; // m3 masa lalu

      const sevDaysAgo = targetTime - 7 * 24 * 60 * 60 * 1000;
      const activeHazards = hazardDataFiltered.filter((h) => {
        const ht = parseSafeDate(h.date).getTime();
        return ht <= targetTime && ht > sevDaysAgo;
      });
      let m4_raw = 0;
      activeHazards.forEach((h) => {
        const r = HAZARD_RISK_W[h.resiko?.toLowerCase()] || 1;
        const s = HAZARD_STATUS_W[h.status?.toLowerCase()] || 1.0;
        const t = HAZARD_TYPE_W[h.jenis?.toLowerCase()] || 1.0;
        m4_raw += r * s * t;
      });
      const m4 = Math.min(1.0, m4_raw / 15); // m4 masa lalu

      const activeObs = obsDataFiltered.filter((o) => {
        const ot = parseSafeDate(o.date).getTime();
        return ot <= targetTime && ot > sevDaysAgo;
      });
      let m5 = 1.0;
      if (activeObs.length > 0) {
        const zeroCount = activeObs.filter((o) => parseInt(o.temuan || 0) === 0).length;
        m5 = zeroCount / activeObs.length;
      }

      // Hitung probabilitas tepat sebelum hari kejadian
      const sigma = 0.15 * m1 + 0.15 * m2 + 0.25 * m3 + 0.25 * m4 + 0.2 * m5;
      const penaltyScore = sigma * 60;

      const dayName = dayNames[parseSafeDate(log.date).getDay()];
      const dayData = dist.find((x) => x.day === dayName);
      let dayScore = 15;
      const weight = dayData ? dayData.weighted : 0;
      if (weight > redThreshold && weight > 0) dayScore = 40;
      else if (weight > avgW && weight > 0) dayScore = 25;

      let finalProb = Math.round(penaltyScore + dayScore);
      finalProb = Math.min(98, Math.max(5, finalProb));

      // Gabungkan data log dengan hasil "prediksi sebelum terjadi" (preRisk)
      return { ...log, preRisk: finalProb };
    });

    return logsWithPreRisk;
  }, [incidents, hazards, observations, selectedArea, historyMonth]);

  return { analytics, historicalLogs };
}