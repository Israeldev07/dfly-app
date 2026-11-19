const usd = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

/** Montos guardados en centavos de USD. */
export function formatUsd(cents: number) {
  return usd.format(cents / 100);
}
