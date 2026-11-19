# AGENTS.md

## Commands

- `npm run dev` — Vite dev server on port **3000**. The app is served under `/funds/` (`base` in `vite.config.ts`, `<base>` in `index.html`); keep that base intact.
- `npm run build` — the only typecheck and full verification: `vue-tsc -b && vite build`.
- `npx jest <path>` — run one suite; `npx jest -t '<name>'` — run one test.
- There is no `npm test`, `lint`, or `format` script. Don't invent one.
- `npx jest` runs the full suite, including `src/api/gasPrice.test.ts`, and passes. Treat any failure as a regression.
- Jest is `testEnvironment: 'node'` and only matches `src/**/*.test.ts`. There is no jsdom or `@vue/test-utils` installed, so component tests are not set up.
- Avoid `npm run deploy:pages` unless explicitly asked. It checks out `gh-pages` in the current worktree, copies `dist/`, commits, and pushes.

## Routing and app shell

- There is **no vue-router and no Pinia**, despite what `docs/prompt.md` recommends. Don't introduce them.
- Routing is hand-rolled:
  - `src/routes.ts` maps exact paths to page components, with `**` as the 404 catch-all.
  - `src/App.vue` swaps the page component on `popstate`.
  - `src/composables/useNavigation.ts` calls `history.pushState` and then dispatches `new PopStateEvent('popstate')`.
- Add new pages to `routes.ts`. If the page also belongs in the bottom navigation, add it to the separate `navigationRoutes` list in `Navigation.vue`.
- `Navigation.vue` has a `/settings` item but `routes.ts` has no `/settings` route, so it renders the 404 page. Not every nav item has a page.
- Wallet detail links are `/wallet?address=...`; `PageWallet.vue` parses `window.location.search` manually. There are no route params.

## Network and API

- `src/api/const.ts` is the single source of truth for supported tokens, Chainlink feeds, the multicall3 address, RPC URLs, and `NETWORK_ID`.
- `.env` is gitignored but required locally: `VITE_ETHERSCAN_API_KEY`, `VITE_APP_ENV`. Only `VITE_*` variables reach the browser via `import.meta.env`. The Etherscan API base URL lives in `src/api/config.ts`.
- `VITE_APP_ENV=hardhat` switches to chain id `31337`, RPC `http://127.0.0.1:8545`, and deletes all non-ETH tokens at module load. Otherwise hardcoded addresses are Ethereum mainnet.
- `rpcProvider` (`src/api/provider.ts`) is a singleton `FallbackProvider` with a 2.5s health-check race across RPCs. Call `ensureProviderHealthy()` before multicall work, as `multicall3.ts` does.
- Etherscan calls in `src/api/etherscan.ts` are serialized through a global queue with a ~400ms minimum delay. Don't bypass or fan out requests; the free API key is rate-limited.
- UI balances use `src/api/multicall3.ts`. `src/api/rpc.ts` is an older non-multicall implementation and `src/api/history.ts` is explicitly unused; don't wire the unused one in.

## Conventions

- `~/*` aliases to `src/*` in both Vite and `tsconfig.app.json`.
- do not use backward imports (`../*`), use direct imports instead (`~/*`).
- `tsconfig.app.json` enables `noUnusedLocals`, `noUnusedParameters`, and `erasableSyntaxOnly`: unused imports/vars fail the build, and `enum`, `namespace`, and constructor parameter properties are not allowed.
- Styling uses the CSS variables in `src/style.css` (`--color00`…`--color90`, `--color-accent*`, `--border-thickness`, font vars). Light/dark is handled by the `data-theme` attribute on `<html>` (`src/utils/theme.ts`, preferences `light`/`dark`/`system`); prefer variables over hardcoded colors.
- Wallet secrets are stored only as ethers-encrypted JSON in `localStorage` under the `Funds` key via `src/utils/storage.ts`. Entries live under `wallet.<name>`, and names are normalized by replacing spaces with `_`. Never add plaintext private keys or mnemonics to storage or logs.
- `docs/prompt.md` is the original frontend style prompt (Composition API, typed props/emits, relative units, CSS variables). Follow its UI guidance, but ignore its Pinia/vue-router advice.
