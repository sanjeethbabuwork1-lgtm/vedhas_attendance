import { jsPDF } from "jspdf";
import type { PayrollRow } from "@/lib/data";
import type { EmployeePayrollDetails } from "@/types";
import { formatDateFull } from "@/lib/format";

const COMPANY_ADDRESS =
  "87/17, Saravana Complex, Meenakshinayakanpatti, Dindigul - 624001, Tamil Nadu";

function formatAmount(value: number): string {
  return `INR ${value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const smallNumbers = [
  "Zero",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const tens = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function wordsBelowThousand(value: number): string {
  const parts: string[] = [];
  if (value >= 100) {
    parts.push(`${smallNumbers[Math.floor(value / 100)]} Hundred`);
    value %= 100;
  }
  if (value >= 20) {
    parts.push(tens[Math.floor(value / 10)]);
    if (value % 10) parts.push(smallNumbers[value % 10]);
  } else if (value > 0) {
    parts.push(smallNumbers[value]);
  }
  return parts.join(" ");
}

function amountInWords(value: number): string {
  const totalPaise = Math.round(value * 100);
  const rupees = Math.floor(totalPaise / 100);
  const paise = totalPaise % 100;
  const groups = [
    { divisor: 10000000, label: "Crore" },
    { divisor: 100000, label: "Lakh" },
    { divisor: 1000, label: "Thousand" },
    { divisor: 1, label: "" },
  ];
  let remainder = rupees;
  const parts: string[] = [];

  for (const group of groups) {
    const count = Math.floor(remainder / group.divisor);
    if (count > 0) {
      parts.push(
        `${wordsBelowThousand(count)}${group.label ? ` ${group.label}` : ""}`
      );
      remainder %= group.divisor;
    }
  }

  const main = parts.join(" ") || "Zero";
  const minor = paise > 0 ? ` and ${wordsBelowThousand(paise)} Paise` : "";
  return `Indian Rupees ${main}${minor} Only`;
}

function drawField(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  maxWidth: number
) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(label, x, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(value || "-", x, y + 4.5, { maxWidth });
}

function drawTable(
  doc: jsPDF,
  input: {
    x: number;
    y: number;
    width: number;
    columnWidths: number[];
    headers: string[];
    rows: { cells: string[]; emphasis?: boolean; accent?: boolean }[];
  }
): void {
  const { x, y, width, columnWidths, headers, rows } = input;
  const headerHeight = 8;
  const rowHeight = 8;
  const height = headerHeight + rows.length * rowHeight;

  doc.setDrawColor(190, 196, 204);
  doc.setLineWidth(0.25);
  doc.setFillColor(224, 224, 224);
  doc.rect(x, y, width, headerHeight, "F");
  rows.forEach((row, index) => {
    if (row.emphasis) {
      doc.setFillColor(232, 232, 232);
      doc.rect(x, y + headerHeight + index * rowHeight, width, rowHeight, "F");
    }
  });
  doc.rect(x, y, width, height);

  let columnX = x;
  for (let index = 0; index < columnWidths.length - 1; index++) {
    columnX += columnWidths[index];
    doc.line(columnX, y, columnX, y + height);
  }
  for (let index = 0; index <= rows.length; index++) {
    doc.line(x, y + headerHeight + index * rowHeight, x + width, y + headerHeight + index * rowHeight);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(35, 35, 35);
  let headerX = x;
  headers.forEach((header, index) => {
    doc.text(header, headerX + columnWidths[index] / 2, y + 5.3, {
      align: "center",
      maxWidth: columnWidths[index] - 2,
    });
    headerX += columnWidths[index];
  });

  rows.forEach((row, rowIndex) => {
    const baseline = y + headerHeight + rowIndex * rowHeight + 5.3;
    doc.setFont("helvetica", row.emphasis ? "bold" : "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(row.accent ? 22 : 35, row.accent ? 101 : 35, row.accent ? 52 : 35);
    let cellX = x;
    row.cells.forEach((cell, cellIndex) => {
      const isLabel = cellIndex === 0;
      doc.text(cell, isLabel ? cellX + 2 : cellX + columnWidths[cellIndex] - 2, baseline, {
        align: isLabel ? "left" : "right",
        maxWidth: columnWidths[cellIndex] - 4,
      });
      cellX += columnWidths[cellIndex];
    });
  });

}

async function loadLogo(): Promise<string> {
  const response = await fetch("/vc_logo.png");
  if (!response.ok) {
    throw new Error("Unable to load the Vedhas Chemicals logo.");
  }
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Unable to read the Vedhas Chemicals logo."));
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("Unable to read the Vedhas Chemicals logo."));
    reader.readAsDataURL(blob);
  });
}

export async function downloadSalarySlip(input: {
  row: PayrollRow;
  details: EmployeePayrollDetails | null;
  from: string;
  to: string;
  calendarDays: number;
}): Promise<void> {
  const { row, details, from, to, calendarDays } = input;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const logo = await loadLogo();

  doc.setDrawColor(55, 55, 55);
  doc.setLineWidth(0.3);
  doc.rect(6, 6, pageWidth - 12, 177);

  const logoWidth = 36;
  const logoHeight = 34.8;
  doc.addImage(logo, "PNG", (pageWidth - logoWidth) / 2, 8, logoWidth, logoHeight);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(35, 35, 35);
  doc.text(COMPANY_ADDRESS, pageWidth / 2, 47, {
    align: "center",
    maxWidth: pageWidth - 32,
  });

  doc.setDrawColor(55, 55, 55);
  doc.setLineWidth(0.45);
  doc.line(6, 51, pageWidth - 6, 51);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text("SALARY SLIP", pageWidth / 2, 58, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`${formatDateFull(from)} to ${formatDateFull(to)}`, pageWidth / 2, 63, {
    align: "center",
  });

  doc.setDrawColor(160, 160, 160);
  doc.setLineWidth(0.25);
  doc.line(6, 68, pageWidth - 6, 68);

  const employeeId = row.profile.employee_id;
  const columns = [
    { x: 12, width: 82 },
    { x: 107, width: 82 },
    { x: 202, width: 82 },
  ];
  drawField(doc, "Employee Name", row.profile.full_name, columns[0].x, 74, columns[0].width);
  drawField(doc, "Employee ID", employeeId, columns[0].x, 85, columns[0].width);
  drawField(
    doc,
    "Designation",
    row.profile.designation ?? "",
    columns[0].x,
    96,
    columns[0].width
  );
  drawField(
    doc,
    "Joining Date",
    details?.joining_date ? formatDateFull(details.joining_date) : "",
    columns[0].x,
    107,
    columns[0].width
  );
  drawField(doc, "PAN", details?.pan ?? "", columns[1].x, 74, columns[1].width);
  const bankValue = [
    details?.bank_account_no,
    details?.bank_name
      ? details.bank_account_no
        ? `(${details.bank_name})`
        : details.bank_name
      : null,
  ]
    .filter(Boolean)
    .join(" ");
  drawField(
    doc,
    "Bank Account",
    bankValue,
    columns[1].x,
    85,
    columns[1].width
  );
  drawField(
    doc,
    "IFSC",
    details?.ifsc ?? "",
    columns[1].x,
    96,
    columns[1].width
  );
  drawField(
    doc,
    "Paid Days",
    `${row.paidDays} / ${calendarDays}`,
    columns[2].x,
    74,
    columns[2].width
  );
  drawField(
    doc,
    "Monthly Salary",
    formatAmount(row.salary),
    columns[2].x,
    85,
    columns[2].width
  );

  const tableY = 117;
  const totalDeductions = row.fineAmount + row.advance;
  const totalEarnings = row.paidSalary + row.allowance;
  const payslipNetPay = Math.max(0, totalEarnings - totalDeductions);
  drawTable(doc, {
    x: 12,
    y: tableY,
    width: 101,
    columnWidths: [53, 24, 24],
    headers: ["EARNINGS", "MONTHLY", "EARNED"],
    rows: [
      { cells: ["Base monthly salary", formatAmount(row.salary), "-"] },
      { cells: ["Salary earned for period", "-", formatAmount(row.paidSalary)] },
      {
        cells: ["Allowance", "-", formatAmount(row.allowance)],
        accent: true,
      },
      {
        cells: ["Total earnings", "-", formatAmount(totalEarnings)],
        emphasis: true,
      },
    ],
  });
  drawTable(doc, {
    x: 118,
    y: tableY,
    width: 76,
    columnWidths: [52, 24],
    headers: ["DEDUCTIONS", "AMOUNT"],
    rows: [
      { cells: ["Late fines", formatAmount(row.fineAmount)] },
      { cells: ["Advance", formatAmount(row.advance)] },
      {
        cells: ["Total deductions", formatAmount(totalDeductions)],
        emphasis: true,
      },
    ],
  });
  drawTable(doc, {
    x: 199,
    y: tableY,
    width: 86,
    columnWidths: [56, 30],
    headers: ["NET SALARY", "AMOUNT"],
    rows: [
      { cells: ["Total earnings", formatAmount(totalEarnings)] },
      { cells: ["Total deductions", formatAmount(totalDeductions)] },
      {
        cells: ["Net salary payable", formatAmount(payslipNetPay)],
        emphasis: true,
      },
    ],
  });

  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.25);
  doc.line(12, 161, pageWidth - 12, 161);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(35, 35, 35);
  doc.text("Net Salary Payable:", 12, 169);
  doc.text(formatAmount(payslipNetPay), pageWidth - 12, 169, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(55, 55, 55);
  doc.text(amountInWords(payslipNetPay), 12, 176);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text(
    "Note: This is a system generated salary slip and does not require any signature and/or company seal.",
    pageWidth / 2,
    190,
    { align: "center" }
  );

  const filename = `${employeeId}-${from}-to-${to}`.replace(/[^a-z0-9_-]/gi, "_");
  doc.save(`salary-slip-${filename}.pdf`);
}
