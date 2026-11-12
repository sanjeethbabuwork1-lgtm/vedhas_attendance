import { pad2 } from "./format";

export interface MonthCalendar {
  year: number;
  month: number;
  calendarDays: number;
  sundayCount: number;
  workingDays: number;
  workingDates: string[];
}

export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function getMonthCalendar(
  year: number,
  month: number
): MonthCalendar {
  const calendarDays = new Date(year, month, 0).getDate();
  const workingDates: string[] = [];
  let sundayCount = 0;

  for (let day = 1; day <= calendarDays; day++) {
    const dow = new Date(year, month - 1, day).getDay();
    if (dow === 0) {
      sundayCount++;
    } else {
      workingDates.push(isoDate(year, month, day));
    }
  }

  return {
    year,
    month,
    calendarDays,
    sundayCount,
    workingDays: workingDates.length,
    workingDates,
  };
}

export function monthPrefix(year: number, month: number): string {
  return `${year}-${pad2(month)}`;
}