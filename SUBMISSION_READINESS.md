# Bugbond submission readiness

## Pavel review remediation

Official review from Pavel Kolosov, Aug 14, 2026:

> "Please add application write paths for adjudication and the supplementary-evidence and expiry flow so a submitted report can reach settlement or recover from a request for more evidence. Add direct tests for those report-state transitions and settlement outcomes."

Implemented in the disclosure dossier using the existing injected-wallet architecture:

- `SUBMITTED`: any connected account can call `adjudicate(report_id)`.
- `NEEDS_EVIDENCE` before deadline: only the recorded researcher sees the public HTTPS supplementary-evidence form and can call `add_supplementary_evidence(report_id, url)`.
- Successful supplementation refreshes the on-chain report to `SUBMITTED`, making adjudication available again.
- `NEEDS_EVIDENCE` after deadline: any connected account can call `expire_needs_evidence(report_id)` and refresh the full-bond refund / `EXPIRED` state.
- Terminal reports show settlement details and no additional lifecycle write.
- Every write waits for `FINALIZED`, requires `FINISHED_WITH_RETURN`, and then refreshes `get_report`; finality without successful GenVM execution is shown as failure.

Direct Mode result: **14 passed, 0 failed**. Coverage includes VALID/HIGH payout and refund, KNOWN_ISSUE, exact OUT_OF_SCOPE slash arithmetic, EXPLOITABILITY_NOT_ESTABLISHED, NEEDS_EVIDENCE with funds still locked, researcher-only supplementary evidence, recovery and re-adjudication, premature expiry rejection, post-deadline expiry/full refund by any caller, invalid duplicate-reference rejection, double-adjudication protection, and all four original basic invariants. A positive DUPLICATE settlement was not fabricated because the contract requires a real VecDB-selected settled-valid precedent; the direct suite verifies the settlement-critical invalid-reference guard. Fresh execution context, tool versions, and release-gate results are recorded in [`docs/RESUBMISSION_VERIFICATION.md`](docs/RESUBMISSION_VERIFICATION.md); GitHub Actions/CI are intentionally not used.

Application flow:

```text
create program -> submit bonded disclosure -> RUN ADJUDICATION
  -> terminal verdict -> deterministic settlement
  -> NEEDS_EVIDENCE -> researcher supplements public evidence
       -> SUBMITTED -> RUN ADJUDICATION -> settlement
  OR deadline passes -> anyone expires request -> full bond refund
```

## Source and candidate proof

The earlier OriginalityBond submission was rejected because tracked pytest helpers were detected as GenVM candidates. Bugbond’s audit now finds exactly one candidate, `contracts/bugbond.py`; it passes lint and semantic validation. The direct-test compatibility shim contains no contract runtime import.

Final StudioNet deployment:

```text
address: 0x425327dD3b5216cB7f0581242aaa1F87e202Cb26
deployment tx: 0x61f45965500fa85c1c32110925e018e964374dbed7af8235dc2ac61e1b99100a
deployer: 0x37cDbd86743e2b80486413E89ca4c70A58147889
source sha256: c0aa76284de7758a31e701264b5d38405d8df13efaa6d09a63f761a4ba492040
```

Raw `gen_getContractCode` Base64 bytes, after decoding, and GenLayerJS `getContractCode()` both hash to the frozen local source hash. `scripts/verify-deployed-source.mjs` reproduces that check.

## Live evidence and settlement proof

All four steps ran on the official deployment `0x425327dD3b5216cB7f0581242aaa1F87e202Cb26`, signed by sponsor/researcher `0x5B3661C576c7001e6d6279C67F3779705d334c89`.

| Step | Transaction | Result |
|---|---|---|
| Create/fund Program 1 (10 GEN) | `0x669a4aa540934ec925fd239c91b3a3424fe0bff3916826646d07179f99d6898b` | FINALIZED, `MAJORITY_AGREE`, 1 round (4 agree / 1 idle) |
| Submit Report 1 (1 GEN bond) | `0x0bd73694951bd47b39b304b02409d68c996bb8938748c91ebaaec7aee1c20f1e` | FINALIZED, `MAJORITY_AGREE`, 1 round (3 agree / 2 idle), status `SUBMITTED` |
| Adjudicate GHSA-qw6h-vgh9-j6wx | `0x2e809469ba95fe379c7b3991c36ca41d17a05dc218757ffc35a3b66a36826fe1` | FINALIZED, `MAJORITY_AGREE`, 3 rounds (3 agree / 2 idle), status `SETTLED_KNOWN` |
| Bond refund (internal, triggered by adjudicate) | `0x40fe986fce86251ecf3a2c8b19893eeed51737ede35cac1f4bdb9d977e4f3346` | FINALIZED: 1 GEN from Program 1 to researcher `0x5B36…c89` |

Validators fetched the GitHub advisory API and pinned `lib/response.js` at commit `04bc62787be974874bc1467b23606c36bc9779ba`. The stored result is `KNOWN_ISSUE / NONE`, payout `0`, refund `1 GEN`, slash `0`, remaining sponsor pool `10 GEN`. The `idle` rows in each round are validators cancelled after quorum, which is expected behaviour.
