interface BalanceWithUsdValue {
  usdValue?: number
}

export interface PortfolioDelta {
  deltaUsd: number
  deltaPercent: number | null
  coveredUsd: number
}

/**
 * Calculates the change of the current holdings over the given price-change window.
 * Both sides of the comparison use the current balance, so the result reflects
 * market movement only (not deposits or withdrawals).
 */
export const calculatePortfolioDelta = (
  balances: Record<string, BalanceWithUsdValue>,
  changes: Record<string, number>
): PortfolioDelta => {
  let deltaUsd = 0
  let baseUsd = 0

  for (const [symbol, balance] of Object.entries(balances)) {
    const usdValue = balance?.usdValue
    const change = changes[symbol]

    if (!usdValue || usdValue <= 0) continue
    if (change === undefined || !Number.isFinite(change) || change <= -100) continue

    const valueThen = usdValue / (1 + change / 100)
    baseUsd += valueThen
    deltaUsd += usdValue - valueThen
  }

  return {
    deltaUsd,
    deltaPercent: baseUsd > 0 ? (deltaUsd / baseUsd) * 100 : null,
    coveredUsd: baseUsd
  }
}
