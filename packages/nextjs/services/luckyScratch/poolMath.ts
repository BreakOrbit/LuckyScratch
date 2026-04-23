export const MICRO_USDC = 1_000_000;
export const PLATFORM_FEE_BPS = 800;
export const MAX_TICKETS_PER_ROUND = 256;
export const MIN_TOTAL_PRIZE_BUDGET_USDC = 50;
export const MAX_TOTAL_PRIZE_BUDGET_USDC = 2_000;
export const MIN_HIT_RATE_BPS = 2_000;
export const MAX_HIT_RATE_BPS = 7_000;
export const MIN_RTP_BPS = 5_000;
export const MAX_RTP_BPS = 9_500;
export const MAX_PRIZE_SHARE_BPS = 3_000;
export const SUPPORTED_TICKET_PRICES_USDC = [1, 2, 5, 10, 15, 20] as const;

export const toMicroUsdc = (value: number) => Math.round(value * MICRO_USDC);

export const fromMicroUsdc = (value?: number | bigint | null) => {
  if (value == null) {
    return 0;
  }
  return Number(value) / MICRO_USDC;
};

export const formatUsdcFromMicro = (value?: number | bigint | null, maximumFractionDigits = 2) =>
  fromMicroUsdc(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits,
  });

export const formatPercentFromBps = (value?: number | null, maximumFractionDigits = 1) =>
  ((value ?? 0) / 100).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });

export const computeBondRequirementMicro = (totalPrizeBudgetMicro: number) => {
  if (totalPrizeBudgetMicro <= 200 * MICRO_USDC) {
    return totalPrizeBudgetMicro + Math.floor((totalPrizeBudgetMicro * 20) / 100);
  }
  if (totalPrizeBudgetMicro <= 500 * MICRO_USDC) {
    return totalPrizeBudgetMicro + Math.floor((totalPrizeBudgetMicro * 15) / 100);
  }
  return totalPrizeBudgetMicro + Math.floor(totalPrizeBudgetMicro / 10);
};
