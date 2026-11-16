# Display settings
- Add a new "Token visibility" section (as external component) to the PageSettings.
WalletBalance.vue:212 and CardBalance.vue:79 always fetch every symbol in TOKEN_INFO. Make a settings.hiddenTokens list, that lets users hide tokens they don't care about (and could skip those balance calls).
- Add a new "Block explorer" section (as external component) to the PageSettings: base URL — https://etherscan.io/tx/ is hardcoded in TransactionsHistory.vue and PageExchange.vue.

# Security
- !Separate encryption and wallet passwords.
- !Export/import encrypted wallets — there is no backup path today; this is arguably more valuable than half of the list above.

# Network
- Add a new "Etherscan" section (as external component) to the PageSettings with description "Used to request transaction history" and field for ETHERSCAN_API_KEY.
