# Display settings
- Add a new "Token visibility" section (as external component) to the PageSettings.
WalletBalance.vue:212 and CardBalance.vue:79 always fetch every symbol in TOKEN_INFO. Make a settings.hiddenTokens list, that lets users hide tokens they don't care about (and could skip those balance calls).

# Security
- Separate encryption and wallet passwords.
- Export/import encrypted wallets - there is no backup path today.

# Network
- Add a new "Block explorer" section (as external component) to the PageSettings: base URL — https://etherscan.io/tx/ is hardcoded in TransactionsHistory.vue and PageExchange.vue.

# Interest-bearing TRC-20
Add gas-reserve correction for deposit operations in:
src/components/interest/sTRX.vue, stUSDT.vue
