import { Payslip } from "../api/payroll";

// payrollMath.ts
export type PayrollLine = {
  empId: number;

  // attendance
  workingDays: number;
  foodDays: number;

  // money components
  baseLyd: number;
  baseUsd: number;

  foodLyd: number;
  fuelLyd: number;
  commLyd: number;

  absenceLyd: number;
  absenceUsd: number;

  goldLyd: number;
  goldUsd: number;
  diamondLyd: number;
  diamondUsd: number;

  advancesLyd: number;   // negative
  loanThisMonthLyd: number; // negative
  loanRemainingLyd: number;

  grossLyd: number;
  grossUsd: number;

  netLyd: number;
  netUsd: number;
};

export function computePayrollLine(
  e: Payslip,
  vr: any,
  sales: any,
  advMap: Record<number, number>
): PayrollLine {

  const W = Math.max(1, e.workingDays || 1);
  const foodDays = Number(e.presentWorkdays ?? 0);

  // BASE
  const baseLyd = Number(e.baseSalary || 0);
  const baseUsd = Number(e.baseSalaryUsd || 0);

  // FOOD (per working day)
  const foodPerDay =
    Number((e as any).FOOD_ALLOWANCE) ||
    (() => {
      const total = Number(vr?.wd_food_lyd ?? 0);
      return W ? total / W : 0;
    })();
  const foodLyd = foodPerDay * foodDays;

  // FUEL & COMMUNICATION (PER MONTH)
  const fuelLyd = Number((e as any).FUEL ?? vr?.FUEL ?? 0);
  const commLyd = Number((e as any).COMMUNICATION ?? vr?.COMMUNICATION ?? 0);

  // ABSENCE (MONEY)
  const absenceLyd = Number(vr?.absence_lyd ?? 0);
  const absenceUsd = Number(vr?.absence_usd ?? 0);

  // COMMISSIONS
  const goldLyd = Number(vr?.gold_bonus_lyd ?? 0);
  const goldUsd = Number(vr?.gold_bonus_usd ?? 0);
  const diamondLyd = Number(vr?.diamond_bonus_lyd ?? 0);
  const diamondUsd = Number(vr?.diamond_bonus_usd ?? 0);

  // ADVANCES (negative)
  const adv = Number(advMap[e.id_emp] ?? e.components?.adjustments?.advance ?? 0);
  const advancesLyd = adv ? -Math.abs(adv) : 0;

  // LOANS
  const loanThisMonth = Number(vr?.loan_credit_lyd ?? 0);
  const loanThisMonthLyd = loanThisMonth ? -Math.abs(loanThisMonth) : 0;
  const loanRemainingLyd = Number(vr?.remaining ?? vr?.principal ?? 0);

  // GROSS
  const grossLyd =
    baseLyd +
    foodLyd +
    fuelLyd +
    commLyd +
    goldLyd +
    diamondLyd -
    absenceLyd;

  const grossUsd =
    baseUsd +
    goldUsd +
    diamondUsd -
    absenceUsd;

  // NET
  const netLyd = Math.max(
    0,
    grossLyd + advancesLyd + loanThisMonthLyd
  );

  const netUsd = Math.max(0, grossUsd);

  return {
    empId: e.id_emp,
    workingDays: W,
    foodDays,

    baseLyd,
    baseUsd,

    foodLyd,
    fuelLyd,
    commLyd,

    absenceLyd,
    absenceUsd,

    goldLyd,
    goldUsd,
    diamondLyd,
    diamondUsd,

    advancesLyd,
    loanThisMonthLyd,
    loanRemainingLyd,

    grossLyd,
    grossUsd,
    netLyd,
    netUsd,
  };
}
