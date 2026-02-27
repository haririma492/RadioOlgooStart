import { gregorianToJalali, type MonthType, type DayType } from "shamsi";

/** Modern Farsi weekday names (Sunday = 0 … Saturday = 6) */
const WEEKDAY_FARSI = [
  "یکشنبه",   // Sunday
  "دوشنبه",   // Monday
  "سه‌شنبه",  // Tuesday
  "چهارشنبه", // Wednesday
  "پنجشنبه",  // Thursday
  "آدینه",    // Friday
  "شنبه",     // Saturday
] as const;

/** Middle Persian weekday names (client-provided): modern name (Middle Persian) */
const WEEKDAY_MIDDLE_PERSIAN = [
  "مهرشید",      // Sunday — یکشنبه (مهرشید)
  "مهشید",       // Monday — دوشنبه (مهشید)
  "بهرام‌شید",   // Tuesday — سه‌شنبه (بهرام‌شید)
  "تیرشید",      // Wednesday — چهارشنبه (تیرشید)
  "اورمزد‌شید",  // Thursday — پنجشنبه (اورمزد‌شید)
  "ناهید‌شید",   // Friday — آدینه (ناهید‌شید)
  "کیوان‌شید",   // Saturday — شنبه (کیوان‌شید)
] as const;

const SHAMSI_MONTHS_FARSI = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
] as const;

const GREGORIAN_MONTHS_FARSI = [
  "ژانویه", "فوریه", "مارس", "آوریل", "مه", "ژوئن",
  "ژوئیه", "اوت", "سپتامبر", "اکتبر", "نوامبر", "دسامبر",
] as const;

function toFarsiDigits(n: number): string {
  const farsi = "۰۱۲۳۴۵۶۷۸۹";
  return String(n).replace(/\d/g, (d) => farsi[Number(d)]);
}

/** Separator between day, month, year for instant readability (exported for layout split) */
export const DATE_PART_SEP = "  ·  ";

/** Shamsi (Solar Hijri): e.g. "۱۴۰۴  ·  بهمن  ·  ۳۰" */
export function formatShamsi(date: Date): string {
  const month1Based = (date.getMonth() + 1) as MonthType;
  const day = date.getDate() as DayType;
  const [jy, jm, jd] = gregorianToJalali(
    date.getFullYear(),
    month1Based,
    day
  );
  const month = SHAMSI_MONTHS_FARSI[jm - 1];
  return `${toFarsiDigits(jy)}${DATE_PART_SEP}${month}${DATE_PART_SEP}${toFarsiDigits(jd)}`;
}

/** Georgian with Farsi month names: e.g. "۲۰۲۶  ·  ژانویه  ·  ۳۰" */
export function formatGeorgianFarsi(date: Date): string {
  const day = date.getDate();
  const month = GREGORIAN_MONTHS_FARSI[date.getMonth()];
  const year = date.getFullYear();
  return `${toFarsiDigits(year)}${DATE_PART_SEP}${month}${DATE_PART_SEP}${toFarsiDigits(day)}`;
}

/** Shahanshahi (Shamsi year + 1180): e.g. "۲۵۸۴  ·  بهمن  ·  ۱۰" */
export function formatShahanshahi(date: Date): string {
  const month1Based = (date.getMonth() + 1) as MonthType;
  const day = date.getDate() as DayType;
  const [jy, jm, jd] = gregorianToJalali(
    date.getFullYear(),
    month1Based,
    day
  );
  const month = SHAMSI_MONTHS_FARSI[jm - 1];
  const shahanshahiYear = jy + 1180;
  return `${toFarsiDigits(shahanshahiYear)}${DATE_PART_SEP}${month}${DATE_PART_SEP}${toFarsiDigits(jd)}`;
}

export interface ThreeCalendars {
  shamsi: string;
  georgianFarsi: string;
  shahanshahi: string;
}

/** Weekday with Middle Persian in parentheses, e.g. "شنبه (کیوان‌شید)" */
export function getWeekdayWithMiddlePersian(date: Date): string {
  const dayIndex = date.getDay(); // 0 = Sunday … 6 = Saturday
  const modern = WEEKDAY_FARSI[dayIndex];
  const middlePersian = WEEKDAY_MIDDLE_PERSIAN[dayIndex];
  return `${modern} (${middlePersian})`;
}

export function getThreeCalendars(date: Date): ThreeCalendars {
  return {
    shamsi: formatShamsi(date),
    georgianFarsi: formatGeorgianFarsi(date),
    shahanshahi: formatShahanshahi(date),
  };
}
