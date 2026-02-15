import { gregorianToJalali, type MonthType, type DayType } from "shamsi";

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

/** Shamsi (Solar Hijri): e.g. "۱۰ بهمن ۱۴۰۴" */
export function formatShamsi(date: Date): string {
  const month1Based = (date.getMonth() + 1) as MonthType;
  const day = date.getDate() as DayType;
  const [jy, jm, jd] = gregorianToJalali(
    date.getFullYear(),
    month1Based,
    day
  );
  const month = SHAMSI_MONTHS_FARSI[jm - 1];
  return `${toFarsiDigits(jd)} ${month} ${toFarsiDigits(jy)}`;
}

/** Georgian with Farsi month names: e.g. "۳۰ ژانویه ۲۰۲۶" */
export function formatGeorgianFarsi(date: Date): string {
  const day = date.getDate();
  const month = GREGORIAN_MONTHS_FARSI[date.getMonth()];
  const year = date.getFullYear();
  return `${toFarsiDigits(day)} ${month} ${toFarsiDigits(year)}`;
}

/** Shahanshahi (Shamsi year + 1180): e.g. "۱۰ بهمن ۲۵۸۴" */
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
  return `${toFarsiDigits(jd)} ${month} ${toFarsiDigits(shahanshahiYear)}`;
}

export interface ThreeCalendars {
  shamsi: string;
  georgianFarsi: string;
  shahanshahi: string;
}

export function getThreeCalendars(date: Date): ThreeCalendars {
  return {
    shamsi: formatShamsi(date),
    georgianFarsi: formatGeorgianFarsi(date),
    shahanshahi: formatShahanshahi(date),
  };
}
