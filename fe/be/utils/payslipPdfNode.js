// utils/payslipPdfNode.js
const { jsPDF } = require('jspdf');
const dayjs = require('dayjs');
const fs = require('fs');
const path = require('path');

// Try to load your logo from frontend public folder
function loadLogoBase64() {
  const candidates = [
    path.resolve(__dirname, '../../GAJA-FrontEnd/public/Gaja Black.png'),
    path.resolve(__dirname, '../../GAJA-FrontEnd/public/GJ LOGO.png'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const buf = fs.readFileSync(p);
      const b64 = buf.toString('base64');
      return { data: `data:image/png;base64,${b64}`, type: 'PNG' };
    }
  }
  return null;
}

// Very small helper: safe number
function num(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

/**
 * Build a payslip PDF buffer using jsPDF (NODE version).
 * This is not a 1:1 copy of your browser code (no canvas, no day grid),
 * but it follows the same visual structure:
 * - grey header with logo, Gaja Jewelry, branch, month, big PAYSLIP
 * - Name / ID / Position / PS boxes
 * - EARNINGS and DEDUCTIONS tables
 * - Net Pay box at bottom
 */
async function makePayslipPdfBufferFromSlip({ slip, period, companyName = 'Gaja Jewelry' }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 36;

  const monthStr = dayjs(period.start).format('MMMM, YYYY');
  const printedOnStr = `Printed on: ${dayjs().format('DD/MM/YYYY')}`;
  const branchName = slip.psBranch || slip.branch || ''; // optional, see below

  // ===== Page background =====
  try {
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageW, pageH, 'F');
  } catch {}

  // ===== Header grey bar =====
  const headerH = 95;
  try {
    doc.setFillColor(205, 205, 205);
    doc.rect(0, 0, pageW, headerH, 'F');
  } catch {}

  // ===== Logo on the right =====
  let logoX = 0;
  let logoW = 0;
  let logoY = margin - 16;
  const logo = loadLogoBase64();
  if (logo) {
    try {
      const logoH = 80;
      // assume 1280x315 aspect-ish => width ~ 3.5 * height
      const w = logoH * 3.5;
      const x = pageW - margin - w;
      logoX = x;
      logoW = w;
      doc.addImage(logo.data, logo.type, x, logoY, w, logoH);
    } catch (e) {
      console.warn('[payslipPdfNode] failed to draw logo:', e?.message || e);
    }
  } else {
    logoX = pageW - margin;
    logoW = 0;
  }

  // ===== Left header text: Company + Branch + Month =====
  try {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);

    const topY = (logoY || margin) + 44;
    doc.text(companyName, margin, Math.max(10, topY - 18));
    if (branchName) {
      doc.text(branchName, margin, topY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(monthStr, margin, topY + 12);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(monthStr, margin, topY);
    }
  } catch {}

  // ===== BIG centered PAYSLIP title between left header & logo =====
  try {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    const cap = 'PAYSLIP';
    const leftX = margin;
    const rightX = logoX + logoW || (pageW - margin);
    const centerX = (leftX + rightX) / 2;
    const capW = doc.getTextWidth(cap);
    const capY = headerH / 2 + 4;
    doc.text(cap, centerX - capW / 2, capY);
  } catch {}

  // ===== Separator line under header =====
  try {
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(1);
    doc.line(0, headerH, pageW, headerH);
  } catch {}

  // ===== Employee info mini-tables under header =====
  const infoTopY = headerH + 10;
  const areaPre = pageW - margin * 2;
  const colWPre = areaPre / 2 - 8;
  const leftX = margin;
  const rightX = margin + colWPre + 16;
  const rowH = 18;
  const labW = Math.floor(colWPre * 0.34);
  const valW = Math.max(0, Math.floor(colWPre) - labW);

  const leftRows = [
    ['Name', String(slip.name || slip.id_emp || '')],
    ['ID', String(slip.id_emp || '')],
  ];
  const rightRows = [
    ['Position', slip.designation || slip.TITLE || '-'],
    ['PS', slip.PS != null ? String(slip.PS) : '-'],
  ];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setDrawColor('#999999');

  let infoBottomY = infoTopY;

  // Left small box
  leftRows.forEach(([label, value], i) => {
    const y0 = infoTopY + i * rowH;
    doc.setFillColor(240, 240, 240);
    doc.rect(leftX, y0, labW, rowH, 'F');
    doc.rect(leftX, y0, labW, rowH);
    doc.rect(leftX + labW, y0, valW, rowH, 'F');
    doc.rect(leftX + labW, y0, valW, rowH);
    doc.text(label, leftX + 6, y0 + 12);
    doc.text(String(value || ''), leftX + labW + 6, y0 + 12);
    infoBottomY = Math.max(infoBottomY, y0 + rowH);
  });

  // Right small box
  rightRows.forEach(([label, value], i) => {
    const y0 = infoTopY + i * rowH;
    doc.setFillColor(240, 240, 240);
    doc.rect(rightX, y0, labW, rowH, 'F');
    doc.rect(rightX, y0, labW, rowH);
    doc.rect(rightX + labW, y0, valW, rowH, 'F');
    doc.rect(rightX + labW, y0, valW, rowH);
    doc.text(label, rightX + 6, y0 + 12);
    doc.text(String(value || ''), rightX + labW + 6, y0 + 12);
    infoBottomY = Math.max(infoBottomY, y0 + rowH);
  });

  // ===== Earnings / Deductions dual column block =====
  const startY = infoBottomY + 16;
  const blockW = (pageW - margin * 2) / 2 - 8;
  const earnX = margin;
  const dedX = margin + blockW + 16;
  const colW = blockW;

  // Base pieces from slip (backend computePayslip)
  const baseSalaryLyd = num(slip.baseSalary);
  const allowancePerDay = num(slip.allowancePerDay);
  const workingDays = num(slip.workingDays);
  const foodDays = num(slip.foodDays || workingDays);
  const allowancePay = num(slip.components?.allowancePay);
  const basePay = num(slip.components?.basePay);
  const adj = slip.components?.adjustments || {};
  const bonus = num(adj.bonus);
  const otherDed = num(adj.deduction);
  const advance = num(adj.advance);
  const loanPayment = num(adj.loanPayment);
  const totalNet = num(slip.total);

  // EARNINGS header
  doc.setDrawColor('#999999');
  doc.setFillColor(240, 240, 240);
  doc.rect(earnX, startY, colW, 26, 'F');
  doc.rect(earnX, startY, colW, 26);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('EARNINGS', earnX + 6, startY + 16);
  doc.text('LYD', earnX + colW - 80, startY + 16);
  doc.setFont('helvetica', 'normal');

  const row = (label, value, yy) => {
    doc.setFillColor(240, 240, 240);
    doc.rect(earnX, yy, colW, 24, 'F');
    doc.rect(earnX, yy, colW, 24);
    doc.text(label, earnX + 6, yy + 15);
    const v = num(value);
    if (v > 0) {
      const txt = v.toLocaleString(undefined, { maximumFractionDigits: 2 });
      doc.setTextColor(34, 139, 34);
      doc.text(txt, earnX + colW - 80, yy + 15);
      doc.setTextColor(0, 0, 0);
    }
  };

  let ey = startY + 28;
  let earningsTotal = 0;

  if (baseSalaryLyd > 0) {
    row('Base Salary', baseSalaryLyd, ey);
    earningsTotal += baseSalaryLyd;
    ey += 24;
  }
  if (allowancePay > 0) {
    row('Food / Allowances', allowancePay, ey);
    earningsTotal += allowancePay;
    ey += 24;
  }
  if (bonus > 0) {
    row('Bonus', bonus, ey);
    earningsTotal += bonus;
    ey += 24;
  }

  // Total Earnings row
  if (earningsTotal > 0) {
    const ty = ey + 4;
    doc.setDrawColor('#555555');
    doc.setFillColor(230, 230, 230);
    doc.rect(earnX, ty, colW, 20, 'F');
    doc.rect(earnX, ty, colW, 20);
    doc.setFont('helvetica', 'bold');
    doc.text('Total Earnings', earnX + 6, ty + 13);
    const txt = earningsTotal.toLocaleString(undefined, { maximumFractionDigits: 2 });
    doc.setTextColor(34, 139, 34);
    doc.text(txt, earnX + colW - 80, ty + 13);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    ey = ty + 20;
  }

  // DEDUCTIONS header
  const dy = startY;
  doc.setDrawColor('#787575');
  doc.setFillColor(240, 240, 240);
  doc.rect(dedX, dy, colW, 26, 'F');
  doc.rect(dedX, dy, colW, 26);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('DEDUCTIONS', dedX + 6, dy + 16);
  doc.text('LYD', dedX + colW - 80, dy + 16);
  doc.setFont('helvetica', 'normal');

  const dedRows = [];
  if (advance > 0) dedRows.push({ label: 'Salary Advance', val: advance });
  if (loanPayment > 0) dedRows.push({ label: 'Loan Repayment', val: loanPayment });
  if (otherDed > 0) dedRows.push({ label: 'Other Deductions', val: otherDed });

  let ddy = dy + 28;
  let dedTotal = 0;
  dedRows.forEach((r) => {
    doc.setDrawColor('#999999');
    doc.setFillColor(240, 240, 240);
    doc.rect(dedX, ddy, colW, 24, 'F');
    doc.rect(dedX, ddy, colW, 24);
    doc.text(r.label, dedX + 6, ddy + 15);
    const v = num(r.val);
    if (v > 0) {
      const txt = v.toLocaleString(undefined, { maximumFractionDigits: 2 });
      doc.setTextColor(220, 53, 69);
      doc.text(txt + ' LYD', dedX + colW - 80, ddy + 15);
      doc.setTextColor(0, 0, 0);
    }
    dedTotal += v;
    ddy += 24;
  });

  if (dedTotal > 0) {
    const ty = ddy + 4;
    doc.setDrawColor('#555555');
    doc.setFillColor(230, 230, 230);
    doc.rect(dedX, ty, colW, 20, 'F');
    doc.rect(dedX, ty, colW, 20);
    doc.setFont('helvetica', 'bold');
    doc.text('Total Deductions', dedX + 6, ty + 13);
    const txt = dedTotal.toLocaleString(undefined, { maximumFractionDigits: 2 });
    doc.setTextColor(220, 53, 69);
    doc.text(txt + ' LYD', dedX + colW - 80, ty + 13);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    ddy = ty + 20;
  }

  const contentBottom = Math.max(ey, ddy) + 20;

  // ===== Net Pay box at bottom =====
  const boxH = 40;
  const neededHeight = boxH + 60;
  let finalY = pageH - margin - neededHeight;
  if (contentBottom + neededHeight > pageH - margin) {
    doc.addPage();
    finalY = doc.internal.pageSize.getHeight() - margin - neededHeight;
  }

  const boxW = pageW - margin * 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);

  doc.setFillColor(205, 205, 205);
  doc.rect(margin, finalY, boxW, boxH, 'F');
  doc.rect(margin, finalY, boxW, boxH);
  doc.text('Net Pay (LYD)', margin + 8, finalY + 16);

  doc.setFontSize(14);
  const netStr = totalNet.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const netW = doc.getTextWidth(netStr);
  doc.text(netStr, margin + boxW - netW - 8, finalY + 28);

  // Printed on bottom-left
  try {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const footerY = doc.internal.pageSize.getHeight() - Math.max(12, margin / 2);
    doc.text(printedOnStr, margin, footerY);
  } catch {}

  // Employee signature line
  const sigY = finalY + boxH + 30;
  const sigLabel = 'Employee signature';
  const sigLabelX = margin;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text(sigLabel, sigLabelX, sigY);
  try {
    const tw = doc.getTextWidth(sigLabel);
    const x1 = sigLabelX + tw + 6;
    const x2 = pageW - margin;
    doc.setDrawColor('#999999');
    doc.setLineWidth(1);
    if (x2 > x1) doc.line(x1, sigY + 2, x2, sigY + 2);
  } catch {}

  // jsPDF -> Buffer
  const arrBuf = doc.output('arraybuffer');
  return Buffer.from(arrBuf);
}

module.exports = {
  makePayslipPdfBufferFromSlip,
};
