import { pad2 } from "./format";

export interface MonthCalendar {
  year: number;
  month: number;
  calendarDays: number;
  sundayCount: number;
  workingDays: number;
  workingDates: string[];
}

export interface DateRangeCalendar {
  from: string;
  to: string;
  calendarDays: number;
  sundayCount: number;
  workingDays: number;
  months: {
    calendar: MonthCalendar;
    workingDates: string[];
  }[];
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

export function getDateRangeCalendar(
  from: string,
  to: string
): DateRangeCalendar {
  const fromMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(from);
  const toMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(to);
  if (!fromMatch || !toMatch || from > to) {
    throw new Error("Choose a valid date range.");
  }

  const fromDate = new Date(
    Number(fromMatch[1]),
    Number(fromMatch[2]) - 1,
    Number(fromMatch[3])
  );
  const toDate = new Date(
    Number(toMatch[1]),
    Number(toMatch[2]) - 1,
    Number(toMatch[3])
  );
  if (
    isoDate(fromDate.getFullYear(), fromDate.getMonth() + 1, fromDate.getDate()) !== from ||
    isoDate(toDate.getFullYear(), toDate.getMonth() + 1, toDate.getDate()) !== to
  ) {
    throw new Error("Choose a valid date range.");
  }

  const months: DateRangeCalendar["months"] = [];
  let year = fromDate.getFullYear();
  let month = fromDate.getMonth() + 1;
  while (
    year < toDate.getFullYear() ||
    (year === toDate.getFullYear() && month <= toDate.getMonth() + 1)
  ) {
    const calendar = getMonthCalendar(year, month);
    months.push({
      calendar,
      workingDates: calendar.workingDates.filter(
        (date) => date >= from && date <= to
      ),
    });
    if (month === 12) {
      year++;
      month = 1;
    } else {
      month++;
    }
  }

  let calendarDays = 0;
  let sundayCount = 0;
  const cursor = new Date(fromDate);
  while (cursor <= toDate) {
    calendarDays++;
    if (cursor.getDay() === 0) sundayCount++;
    cursor.setDate(cursor.getDate() + 1);
  }

  return {
    from,
    to,
    calendarDays,
    sundayCount,
    workingDays: calendarDays - sundayCount,
    months,
  };
}