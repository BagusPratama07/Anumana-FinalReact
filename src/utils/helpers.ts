// --- CONFIGURATION ---
export const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwiHueRtF1Kpn1ZpP_PdU_5Q6e4uHmh266VTsEOlyJdz1mR7vL4peQW1wOkC9Yz-Tn-/exec";

export const SEVERITY_WEIGHTS = { Fatality: 100, LTI: 75, RWDI: 50, MTC: 30, FAC: 15, PD: 10, NM: 5 };
export const SEVERITY_NORM = { Fatality: 1.0, LTI: 0.8, RWDI: 0.6, MTC: 0.4, FAC: 0.2, PD: 0.1, NM: 0.05 };

// HAZARD WEIGHTS
export const HAZARD_RISK_W = { low: 1, medium: 2, high: 3 };
export const HAZARD_STATUS_W = { submitted: 1.0, accepted: 1.0, reassign: 1.0, followup: 0.5, end: 0.1 };
export const HAZARD_TYPE_W = { tta: 1.5, kta: 1.0 };

// GOOGLE SHEETS HELPER (Membaca Data)
export const fetchSheetData = async (sheetName: string) => {
  try {
    const response = await fetch(`${SCRIPT_URL}?sheet=${sheetName}`);
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error(`Gagal memuat ${sheetName}:`, err);
    return [];
  }
};

// GOOGLE SHEETS HELPER (Menyimpan Data Baru)
export const appendSheetData = async (sheetName: string, dataObj: any) => {
  try {
    const response = await fetch(`${SCRIPT_URL}?sheet=${sheetName}`, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(dataObj),
    });
    const result = await response.json();
    if (result.error) {
      console.error(`Error dari Spreadsheet di tab ${sheetName}:`, result.error);
      alert(`Gagal menyimpan ke spreadsheet: ${result.error}`);
    }
  } catch (err) {
    console.error(`Gagal menghubungi Spreadsheet ${sheetName}:`, err);
  }
};

// SMART DATE PARSER
export const parseSafeDate = (dateStr: any) => {
  if (!dateStr) return new Date();
  const directDate = new Date(dateStr);
  if (!isNaN(directDate.getTime())) return directDate;

  const str = String(dateStr).trim();
  const parts = str.split(/[\s\-\/]+/);
  if (parts.length >= 3) {
    let day = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10) - 1;
    let year = parseInt(parts[2], 10);

    if (day > 1000) {
      year = day;
      day = parseInt(parts[2], 10);
    } else if (year < 100) {
      year += 2000;
    }

    if (isNaN(month)) {
      const monthStr = parts[1].toLowerCase();
      const months: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, mei: 4, jun: 5, jul: 6, aug: 7, ags: 7, sep: 8, oct: 9, okt: 9, nov: 10, dec: 11, des: 11 };
      month = months[monthStr.substring(0, 3)] !== undefined ? months[monthStr.substring(0, 3)] : 0;
    }
    return new Date(year, month, day);
  }
  return new Date();
};

// SAFE CSV SPLITTER
export const safeSplitCSV = (line: string, delimiter: string) => {
  if (delimiter === ";") return line.split(";");
  const regex = /(?:,|\n|^)("(?:(?:"")*[^"]*)*"|[^",\n]*|(?:\n|$))/g;
  let matches = [];
  let match;
  while ((match = regex.exec(line))) {
    let val = match[1];
    if (val !== undefined) {
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1).replace(/""/g, '"');
      matches.push(val);
    }
    if (match.index === regex.lastIndex) regex.lastIndex++;
  }
  return matches;
};