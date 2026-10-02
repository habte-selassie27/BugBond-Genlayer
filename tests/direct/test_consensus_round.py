"""Direct tests for the comparative consensus round itself.

The settlement suite drives adjudication through mocks, which pins the leader
result and never executes a validator. These tests go one level deeper: after
`adjudicate` captures the SDK's real `prompt_comparative` validator, they
re-run it with `vm.run_validator()` while controlling what the second
validator sees.

Boundary, stated honestly: the EqComparative LLM judge cannot run without a
node, so it is replaced by `install_equivalence_hook`, a deterministic
implementation of exactly what the contract's principle string demands
(outcome, VALID severity, DUPLICATE duplicate_of, and the per-source
evidence digests must match exactly). Everything else is real: the contract's
`leader` executes twice over mocked bytes, the SDK's validator closure
compares the two answers, and the stored settlement follows.

Same rules as the other direct suites: no GenLayer SDK import here.
"""
import ast
import json

ONE = 1_000_000_000_000_000_000
RESEARCHER = bytes.fromhex("11" * 20)
OTHER = bytes.fromhex("22" * 20)
SDK_VERSION = "v0.2.12"
BODY_A = "bounded public security evidence body for deterministic testing"
BODY_B = "a validator-fetched revision of the disclosure with different bytes"

def deploy(direct_deploy): return direct_deploy("contracts/bugbond.py", sdk_version=SDK_VERSION)

def create(contract, vm):
    vm.warp("2026-08-14T12:00:00Z"); vm.value = 20 * ONE
    return contract.create_program("Scope", "https://example.com", "abc123", "Public security issues in src only.", "2026-08-01T00:00:00Z", "2027-08-01T00:00:00Z", ONE, 2500, ONE, 2*ONE, 3*ONE, 4*ONE)

def submit(contract, vm, title="issue", researcher=RESEARCHER):
    vm.value = ONE
    with vm.prank(researcher): rid = contract.submit_report(1, title, "bounded security synopsis", "https://example.com/report", "src/auth", "HIGH")
    vm.value = 0
    return rid

def mock_outcome(vm, outcome, severity="NONE", duplicate_of=0, body=BODY_A):
    vm.clear_mocks()
    vm.mock_web(r"https://example\.com", {"status": 200, "body": body})
    vm.mock_llm(r"Bugbond's public-security adjudicator", json.dumps({"outcome":outcome,"severity":severity,"duplicate_of":duplicate_of,"reasoning":f"Direct evidence supports {outcome}.","evidence_summary":f"Evidence digest for {outcome}."}))

def parse_answer(text):
    try: return json.loads(text)
    except Exception: pass
    try:
        value = ast.literal_eval(text)
        if isinstance(value, (bytes, bytearray)): return json.loads(bytes(value).decode("utf-8"))
        return json.loads(str(value))
    except Exception: return None

def install_equivalence_hook(vm):
    """Deterministic stand-in for the EqComparative judge.

    Returns the installed hook's call log. Each entry is (leader, follower,
    equivalent). The hook answers {"ok": bool} so the SDK decode path
    resolves the validator comparison to a real boolean.
    """
    calls = []
    def hook(vm_ctx, request):
        payload = request.get("ExecPromptTemplate", {})
        if payload.get("template") != "EqComparative": return None
        leader = parse_answer(payload.get("leader_answer", ""))
        follower = parse_answer(payload.get("validator_answer", ""))
        equivalent = (
            isinstance(leader, dict) and isinstance(follower, dict)
            and leader.get("ok") is True and follower.get("ok") is True
            and leader.get("outcome") == follower.get("outcome")
            and leader.get("severity") == follower.get("severity")
            and leader.get("duplicate_of") == follower.get("duplicate_of")
            and leader.get("evidence_digests") == follower.get("evidence_digests")
        )
        calls.append((leader, follower, bool(equivalent)))
        return {"ok": bool(equivalent)}
    vm._gl_call_hook = hook
    return calls

def remove_equivalence_hook(vm): vm._gl_call_hook = None

def setup_settled(vm, direct_deploy, outcome="VALID", severity="HIGH"):
    contract = deploy(direct_deploy); create(contract, vm); rid = submit(contract, vm)
    mock_outcome(vm, outcome, severity); contract.adjudicate(rid)
    return contract, rid

def test_validator_agrees_when_evidence_is_identical(direct_vm, direct_deploy):
    contract, rid = setup_settled(direct_vm, direct_deploy)
    calls = install_equivalence_hook(direct_vm)
    try: assert direct_vm.run_validator() is True
    finally: remove_equivalence_hook(direct_vm)
    assert len(calls) == 1 and calls[0][2] is True
    assert contract.get_report(rid)["status"] == 3

def test_validator_rejects_divergent_evidence_bytes(direct_vm, direct_deploy):
    """A validator that fetched different bytes must not agree.

    Only the web mock is swapped: the second run fetches BODY_B while the
    mocked adjudicator returns the same verdict shape. Agreement must fail
    on the code-computed evidence digests alone, which is the entire point
    of carrying them in the compared envelope.
    """
    contract, rid = setup_settled(direct_vm, direct_deploy)
    leader_digests = json.loads(contract.get_report(rid)["evidence_digests"])
    direct_vm.clear_mocks()
    direct_vm.mock_web(r"https://example\.com", {"status": 200, "body": BODY_B})
    direct_vm.mock_llm(r"Bugbond's public-security adjudicator", json.dumps({"outcome":"VALID","severity":"HIGH","duplicate_of":0,"reasoning":"Direct evidence supports VALID.","evidence_summary":"Evidence digest for VALID."}))
    calls = install_equivalence_hook(direct_vm)
    try: assert direct_vm.run_validator() is False
    finally: remove_equivalence_hook(direct_vm)
    assert len(calls) == 1
    leader, follower, _ = calls[0]
    assert leader["evidence_digests"] == leader_digests
    assert follower["evidence_digests"] != leader_digests
    assert follower["evidence_digests"]["target"] != leader_digests["target"]
    # The re-run is read-only: the leader's settlement stands untouched.
    assert contract.get_report(rid)["status"] == 3
    assert contract.get_report(rid)["evidence_digests"] == json.dumps(leader_digests, sort_keys=True)

def test_evidence_fetch_failure_is_transient_and_moves_no_funds(direct_vm, direct_deploy):
    """No mocks at all: the fetch fails, adjudication reverts, nothing moves."""
    contract = deploy(direct_deploy); create(contract, direct_vm); rid = submit(contract, direct_vm)
    with direct_vm.expect_revert("TRANSIENT"): contract.adjudicate(rid)
    item = contract.get_report(rid)
    assert item["status"] == 1 and item["verdict"] == "" and item["refund"] == "0"
    assert contract.get_program(1)["remaining_pool"] == str(20 * ONE)
    assert contract.get_program(1)["open_report_count"] == 1
