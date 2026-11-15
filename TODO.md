1. Display settings
- Balance delta period — 24h / 7d / 30d / off. The period is hardcoded in two places: include_24hr_change=true (marketChange.ts:28) and the literal 24h label (CardBalance.vue:42). Good news: calculatePortfolioDelta is already period-agnostic, so it needs no change. The real work is CoinGecko: /simple/price only gives 24h; 7d/30d requires /coins/markets?price_change_percentage=7d,30d and a cache keyed by window. This is the highest-value item and roughly a medium-size change.
- Token visibility filter. WalletBalance.vue:212 and CardBalance.vue:79 always fetch every symbol in TOKEN_INFO. A settings.hiddenTokens list lets users hide tokens they don't care about (and could skip those balance calls).
+ Theme override. Light/dark/system. Today only prefers-color-scheme in style.css; this is a small CSS-variable swap.

2. Transaction & gas defaults
- Confirmations to wait for — defaults to 1 in transfer.ts:157 and exchange.ts:324.
- Gas display — gwei + USD vs gwei only (gasPrice.ts:14-29).
- Block explorer base URL — https://etherscan.io/tx/ is hardcoded in TransactionsHistory.vue:34 and PageExchange.vue:127,131. Useful for users on a different explorer.

3. Cache & network (expand the existing section)
- Price cache TTL — MAX_PRICE_AGE_SECONDS = 4h (const.ts:26). Expose a range (e.g. 15m–24h); it also controls stale-price warnings.
- "Clear price cache" button — tokenValue.clearPriceCache() already exists (tokenPrice.ts:42) and is called nowhere. This is an almost free addition.
- Market-change cache — 5-minute TTL (marketChange.ts:4); add clear + TTL.
- Reset scope — resetAccountBalance() wipes every wallet's snapshot (accountBalance.ts:57). Add per-wallet reset and keep an "all wallets" option.
- Provider request timeout — REQUEST_TIMEOUT_MS = 2500 (provider.ts:5). Slow RPC users would benefit from 5–10s.
- Provider ordering / priority — getRpcUrls() order is the fallback order. Drag-to-reorder or "move to top" is more useful than add/remove alone.
- "Check all providers" + latency — checkProviderHealthy() returns only a boolean today; showing ms per provider is a small extension.
- Restore default providers — RPC_URLS (const.ts:20). Once the list is emptied there's no way back without re-typing.
- Etherscan pacing — 400ms queue delay (etherscan.ts:72). I'd show it read-only/advanced rather than invite users to lower it.

4. Add a new "Decoy page" section to the PageSettings with options:
- Toggle the decoy landing page. / currently always renders PageTipCalculator (routes.ts:19); turning it off should route / to /home.
- Custom unlock code. UNLOCK_CODE = '256' is a literal (PageTipCalculator.vue:36).

5. Behavior / data
- Auto-refresh interval for balances (currently manual only, WalletBalance.vue:286) and refresh on window focus.
- Default wallet preselected for Transfer/Exchange (PageTransfer.vue:75, PageExchange.vue:172 both start empty).
- Wallet sort/pin — getWallets() returns insertion order.
- Export/import encrypted wallets — there is no backup path today; this is arguably more valuable than half of the list above.
- "Reset all app data" as a separate danger-zone action, distinct from cache resets.

# A shortlist
1. Balance delta period (24h/7d/30d/off) — your example, and the utility already supports any window.
2. Price-cache TTL + "Clear price cache" — one already-wired method, plus makes the existing "Reset cache" section honest.
3. Default slippage + confirmations + gas preset — small, self-contained, high daily-use value.
4. Decoy toggle + custom unlock code — matches your second example and is mostly local state.
5. Theme override (light/dark/system) — small CSS-variable change with broad appeal.
