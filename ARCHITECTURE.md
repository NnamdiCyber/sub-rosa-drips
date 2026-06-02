# Sub Rosa — Architecture

High-level map of the monorepo: components, trust boundaries, round lifecycle, and where each proof runs. For crypto and settlement detail see [docs/TECH_DESIGN.md](./docs/TECH_DESIGN.md).

---

## Problem and primitive

Sub Rosa is a **sealed commit–reveal coordination primitive** on Stellar Soroban. Participants commit now; a public Drand round **R** forces simultaneous opening later; the contract clears and settles without operator discretion.

| Phase | Who acts | What happens |
| --- | --- | --- |
| **Commit** | Bidder or agent session key | Lock escrow, post commitment `H`, store tlock ciphertext + auditor blob |
| **Wait R** | — | Bids undecryptable; only `H` and escrow are public |
| **Open reveal** | Anyone (keeper) | Submit Drand round-R BLS signature; verified **on-chain** |
| **Reveal** | Anyone (keeper) | Decrypt every seal; contract checks `H` binding |
| **Clear / settle** | Anyone (keeper) | Deterministic winner; SAC transfers; contract balance → 0 |

The operator does **not** need keys to open bids. After R, values are public; identities stay auditor-encrypted until opened with the round auditor key.

---

## System diagram

```
                         ┌─────────────────────────────────────────┐
                         │           Stellar Soroban               │
                         │  ┌───────────────────────────────────┐  │
  sealBid + commit ─────►│  │  contracts/round (Round WASM)     │  │
  (session key)          │  │  · create_round / commit / reveal │  │
                         │  │  · open_reveal (BLS verify)       │  │
                         │  │  · clear / settle (SAC)         │  │
                         │  └───────────────────────────────────┘  │
                         └─────────────────────────────────────────┘
        ▲                              ▲
        │ packages/tlock               │ packages/sdk (SubRosaClient)
        │ sealBid / openBid            │ bindings + RPC (+ optional OZ submitter)
        │                              │
 ┌──────┴──────┐                ┌──────┴──────┐
 │ services/   │   HTTP 402     │ services/   │
 │ agent       │───────────────►│ appraisal-  │
 │ mandate+caps│   x402 USDC    │ api         │
 └─────────────┘                └─────────────┘
        │
        │  services/keeper — permissionless keepRound / closeRound / watch
        ▼
 ┌─────────────┐     embedded trace      ┌─────────────┐
 │ Drand       │                         │ apps/web    │
 │ quicknet    │                         │ jury demo   │
 └─────────────┘                         └─────────────┘
```

---

## Round lifecycle

```mermaid
sequenceDiagram
  participant Op as Operator
  participant A as Agent / bidder
  participant C as Round contract
  participant X as x402 appraisal API
  participant D as Drand quicknet
  participant K as Keeper

  Op->>C: create_round(R, deadlines, auditor pubkey)
  A->>X: pay appraisal (x402, testnet USDC)
  X-->>A: fair value + suggested bid
  A->>C: commit(H, ciphertext, auditor blob, escrow)
  Note over C: Status Open — sealed
  D-->>K: publish round R + BLS sig
  K->>C: open_reveal(sig) — BLS verified on-chain
  K->>C: reveal(bidder, value) for each bidder
  Note over C: Status Revealing
  K->>C: clear() then settle()
  Note over C: Status Settled — balance 0
```

---

## Monorepo layout

| Path | Layer | Responsibility |
| --- | --- | --- |
| `contracts/round/` | On-chain | Soroban Round: storage tiers, BLS host verify, SAC settle |
| `packages/round-bindings/` | Generated | TypeScript bindings from WASM |
| `packages/tlock/` | Crypto (off-chain) | tlock seal/open, auditor identity blob |
| `packages/sdk/` | Client | `SubRosaClient`, encoding, optional OZ Relayer Channels submitter |
| `services/drand-tools/` | Harness | Live quicknet ↔ on-chain BLS constant validation |
| `services/keeper/` | Ops | Permissionless reveal/clear/settle; `keeper:watch` daemon |
| `services/appraisal-api/` | Service | x402-gated appraisal (SEP-41 USDC on testnet) |
| `services/agent/` | Agent support | Session mandate, cap checks, x402 + commit flow |
| `apps/web/` | UI | Jury demo; reads `demo-trace.generated.ts` from `agents:e2e` |

Package manager: **pnpm** workspace. Contract build: **Stellar CLI** + Rust (`wasm32v1-none`).

---

## Trust boundaries

| Component | Trusted for | Not trusted for |
| --- | --- | --- |
| **Round contract** | Escrow, `H` binding, BLS gate, clearing rule | Off-chain mandate caps |
| **Drand quicknet** | Unbiased future randomness / round-R sig | Liveness (keeper can void after grace) |
| **Operator** | Creating rounds, receiving winner payment | Reading sealed bids before R |
| **Keeper** | Liveness (open/reveal/clear) | Secrecy after R (all bids must reveal) |
| **Agent software** | Enforcing mandate caps off-chain | Honesty if compromised or buggy |
| **Auditor** | Identity disclosure when given secret | Must not learn bid values before R |
| **Appraisal API** | Valuation after x402 pay | Unbiased pricing (economic trust) |

Full adversary analysis: [docs/THREAT_MODEL.md](./docs/THREAT_MODEL.md).

---

## Two payment rails (same SEP-41 asset, different jobs)

On **testnet**, both appraisal and prize settlement use **USDC SAC**. They are intentionally separate:

| Rail | Path | Used for |
| --- | --- | --- |
| **x402** | Agent → appraisal server via HTTP 402 + facilitator | Appraisal micro-payment only |
| **SAC `settle()`** | Round contract escrow → operator + refunds | Winner prize — **not** x402 |

**Mainnet smoke** uses **native XLM SAC** (1 / 5 XLM), not USDC — see [docs/LIMITATIONS.md](./docs/LIMITATIONS.md).

---

## Agent authorization model

```
Principal (G-address)
    │ signs mandate JSON (maxBid, maxEscrow, maxAppraisalSpend, contract, round)
    ▼
Session Ed25519 key  ──► x402 pay + Soroban commit (never principal on-chain)
```

- **Off-chain:** agent verifies mandate signature and caps before any payment or commit.
- **On-chain:** `valid = value > 0 && value ≤ escrow` at reveal.

Production mapping (Passkey / Smart Account Kit / OZ Relayer): [docs/ECOSYSTEM.md](./docs/ECOSYSTEM.md). Not on the critical path for this submission.

---

## Demo and proof artifacts

| Network | Contract | UI / trace |
| --- | --- | --- |
| **Testnet** | `CAPTODBCDEVIK23ALBJBS2TXRTIK47ZA5MBTHYF4XLHG2BK7JPYUCU2Y` | `apps/web/src/demo/demo-trace.generated.ts` |
| **Mainnet** | `CA7KSDEYJEPGZEB2ZROTLUWKQQ6GIRIQNGG6Z745MZ34QHP4UJPWODEX` | Mainnet proof card in UI; `pnpm mainnet:verify` |

Canonical end-to-end testnet run (agents → x402 → commits → keeper → settle → 0):

```bash
pnpm agents:e2e
```

Other proofs: `pnpm lifecycle:e2e`, `pnpm appraisal:e2e`, `pnpm mainnet:verify`. See README **Proof at a glance**.

The web UI is **read-mostly**: embedded trace + optional live RPC poll. No wallet connect in the jury demo.

---

## Storage model (on-chain)

| Tier | Contents | Lifetime |
| --- | --- | --- |
| **Instance** | Drand pubkey, DST, genesis, period, token SAC | Contract lifetime |
| **Persistent** | Round record, per-bidder escrow / revealed value | Until settle or void |
| **Temporary** | Ciphertext + auditor blob | Expires after reveal window |

---

## Related documentation

| Document | Focus |
| --- | --- |
| [docs/TECH_DESIGN.md](./docs/TECH_DESIGN.md) | Cryptography, storage, settlement rails, relayer hook |
| [docs/THREAT_MODEL.md](./docs/THREAT_MODEL.md) | Adversaries and mitigations |
| [docs/DEPLOY.md](./docs/DEPLOY.md) | UI build vs runtime secrets |
| [docs/DEMO_SCRIPT.md](./docs/DEMO_SCRIPT.md) | 5-minute jury walkthrough |
| [docs/TRACK_ANSWERS.md](./docs/TRACK_ANSWERS.md) | Hackathon track mapping |
| [docs/LIMITATIONS.md](./docs/LIMITATIONS.md) | Honest scope boundaries |
| [docs/ECOSYSTEM.md](./docs/ECOSYSTEM.md) | Passkey, Smart Account Kit, OZ Relayer |
