# Display settings
- Add a new "Token visibility" section (as external component) to the PageSettings.
WalletBalance.vue:212 and CardBalance.vue:79 always fetch every symbol in TOKEN_INFO. Make a settings.hiddenTokens list, that lets users hide tokens they don't care about (and could skip those balance calls).

# Security
- Separate encryption and wallet passwords.
- Export/import encrypted wallets - there is no backup path today.

# Network
- Add a new "Block explorer" section (as external component) to the PageSettings: base URL — https://etherscan.io/tx/ is hardcoded in TransactionsHistory.vue and PageExchange.vue.

# Pages
PageInterest.vue with one for this moment "aToken" section (make section as outer src/components/interest/Aave.vue component):
- aEthUSDC balance
- no USDC equivalent is needed
- Deposit, Withdraw tabs that switches corresponding forms

Deposit form:
- amount in USDC, or MAX
- estimated aEthUSDC received (1:1)
- approve Pool, then supply
- stages: approving, waitingApproval, supplying, waitingConfirmation
Withdraw form:
- amount in aEthUSDC, or MAX
- withdraw with MaxUint256 for MAX
- stages: withdrawing, waitingConfirmation
