export const fmtUSD = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

export const fmtInt = (n: number) =>
  new Intl.NumberFormat("en-US").format(Math.round(n));

export const fmtCompact = (n: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact" }).format(n);
