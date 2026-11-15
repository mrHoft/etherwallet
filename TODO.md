# Display settings
- Add a new "Balance delta period" section to the PageSettings with options: 24h, 7d, 30d, off.
The period is hardcoded in two places: include_24hr_change=true (marketChange.ts:28) and the literal 24h label (CardBalance.vue:42).
calculatePortfolioDelta is already period-agnostic, so it needs no change. The real work is CoinGecko: /simple/price only gives 24h; 7d/30d requires /coins/markets?price_change_percentage=7d,30d and a cache keyed by window. This is the highest-value item and roughly a medium-size change.
- Add a new "Token visibility" section to the PageSettings.
WalletBalance.vue:212 and CardBalance.vue:79 always fetch every symbol in TOKEN_INFO. Make a settings.hiddenTokens list, that lets users hide tokens they don't care about (and could skip those balance calls).
+ Theme override. Light/dark/system. Today only prefers-color-scheme in style.css; this is a small CSS-variable swap.
- Add a new "Gas display" section to the PageSettings: gwei only, gwei + USD
- Add a new "Block explorer" section to the PageSettings: base URL — https://etherscan.io/tx/ is hardcoded in TransactionsHistory.vue and PageExchange.vue.

# Security
- Extend src/components/Password.vue to 8 symbols. Leave min length 3 as is.
- !Separate encryption and wallet passwords.

# Network
At the PageSettings "Mainnet providers" section:
- Add ability to change order of providers using dnd. src/api/provider getProvider will automatically create FallbackProvider with given order (no need to reset cachedProvider for simplicity).
- Make checkProviderHealthy() to return and show latency.
- Add "Restore default" button to reset providers to RPC_URLS (const.ts:20).

Is Etherscan api actually need? Can it be replaced by RPS providers?

# Home page
Add a new "Decoy page" section to the PageSettings with options:
- Toggle the decoy landing page. / currently always renders PageTipCalculator (routes.ts:19); turning it off should route / to /home.
- Add "Unlock code" field. UNLOCK_CODE = '256' is a literal (PageTipCalculator.vue:36).

# Behavior
- Make PageTransfer.vue, PageExchange.vue to remember last used form values.
- Add to PageHome ability to change wallet order using dnd.
- !Export/import encrypted wallets — there is no backup path today; this is arguably more valuable than half of the list above.
