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
address: 0x3a27d266A1a767373066ED4C256cA027ff34e84C
deployment tx: 0xd234248861e4cd869174d9c7407eb7484b9c6501ecff9e46c8e09e1d693036ea
deployer: 0x5B3661C576c7001e6d6279C67F3779705d334c89
source sha256: c0aa76284de7758a31e701264b5d38405d8df13efaa6d09a63f761a4ba492040
```

Raw `gen_getContractCode` Base64 bytes, after decoding, and GenLayerJS `getContractCode()` both hash to the frozen local source hash. `scripts/verify-deployed-source.mjs` reproduces that check.

## Live evidence and settlement proof

| Step | Transaction | Result |
|---|---|---|
| Create/fund Program 1 (10 GEN) | `0xa7c31068b59fe2e36945841fe370477444431c1cc239512466eb324c6aa2c6a4` | Accepted, GenVM SUCCESS |
| Submit Report 1 (1 GEN bond) | `0x621cf8463429f71088e0eebf8c7d22007a2f3f95cdd7d54f4f97e9a65b6080b9` | Accepted, GenVM SUCCESS |
| Adjudicate GHSA-qw6h-vgh9-j6wx | `0xa305e878583d13e147111d4af8021734891ce0645811938e3573d291fc41babd` | FINALIZED, Accepted, GenVM SUCCESS, empty stderr |
| Bond refund | `0x30dc5ed880bc5bd04c7d65620d428f665a19a5287aa6928476e869c58fea8855` | FINALIZED: 1 GEN to researcher |

Validators fetched the GitHub advisory API and pinned `lib/response.js` at commit `04bc62787be974874bc1467b23606c36bc9779ba`. The stored result is `KNOWN_ISSUE / NONE`, payout `0`, refund `1 GEN`, slash `0`, remaining sponsor pool `10 GEN`.
