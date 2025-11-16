// src/i18n.ts - minimal i18n helper for the app
export type Lang = 'en' | 'ar';
type DictVal = string | ((...args: any[]) => string);
type Dict = Record<string, DictVal>;

const dict: Record<Lang, Dict> = {
  en: {
    previewDate: 'Preview Date',
    previewDay: 'Preview Day',
    syncMonthToTimesheet: 'Sync Month to Timesheet',
    loadMonthNoWrite: 'Load Month (No Write)',
    dailyPreview: 'Daily Attendance Preview',
    employee: 'Employee',
    date: 'Date',
    justification: 'Justification (j)',
    result: 'Result (R)',
    in: 'In (E)',
    out: 'Out (S)',
    psWorkingHours: 'PS Working Hours (P0–P4)',
    savePsHours: 'Save PS Hours',
    manualPunchEntry: 'Manual Punch Entry',
    inE: 'In (E)',
    outS: 'Out (S)',
    saveManualPunch: 'Save Manual Punch',
    allEmployeesUpToToday: 'All Employees — Up to Today',
    from: 'From',
    toAutoToday: 'To (auto today)',
    psOptional: 'PS (optional)',
    filterEmployees: 'Filter employees (name or #)',
    loadUpToToday: 'Load Up To Today',
    psTodayTitle: (psLabel: string) => `PS ${psLabel} — Today's Attendance`,
    loading: 'Loading...',
    noEmployeesForPs: 'No employees found for this PS.',
    month: 'Month',
    year: 'Year',
  },
  ar: {
    
  },
};

let currentLang: Lang = (localStorage.getItem('lang') as Lang) || 'en';

export function t(key: string, ...args: any[]): string {
  const table = dict[currentLang] || dict.en;
  const val = table[key];
  if (typeof val === 'function') return String((val as any)(...args));
  if (typeof val === 'string') return val;
  // fallback to English
  const fallback = dict.en[key];
  return typeof fallback === 'function' ? String((fallback as any)(...args)) : (fallback as string) || key;
}

export function setLang(lang: Lang) {
  currentLang = lang;
  localStorage.setItem('lang', lang);
}

export function getLang(): Lang {
  return currentLang;
}