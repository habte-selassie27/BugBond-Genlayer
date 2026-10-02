"""Integration tests: the real `gl.eq_principle.prompt_comparative` path.

Direct Mode stubs the whole consensus block, so the comparative round is never
executed there. These tests deploy to a live node and drive the genuine path,
using mock validators so results stay deterministic.

Requires a running node. They skip (rather than fail) when none is reachable:

    genlayer node                     # or: docker compose up
    gltest --network localnet

Set BUGBOND_INTEGRATION=1 to make an unreachable node a hard failure.
"""
import json
import os
import socket
from urllib.parse import urlparse

import pytest

from gltest.contracts import get_contract_factory
from gltest.types import TransactionStatus

ONE = 1_000_000_000_000_000_000
BODY = "bounded public security evidence body for deterministic testing"
LOCALNET = os.getenv("BUGBOND_RPC_URL", "http://127.0.0.1:4000/api")

def _node_reachable(url: str) -> bool:
    parsed = urlparse(url)
    host = parsed.hostname or "127.0.0.1"
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    try:
        with socket.create_connection((host, port), timeout=2):
            return True
    except OSError:
        return False

pytestmark = pytest.mark.skipif(
    not _node_reachable(LOCALNET) and os.getenv("BUGBOND_INTEGRATION") != "1",
    reason=f"No GenLayer node at {LOCALNET}; start one and use --network localnet",
)

def verdict(outcome, severity="NONE", duplicate_of=0):
    return {"outcome": outcome, "severity": severity, "duplicate_of": duplicate_of,
            "reasoning": f"Integration evidence supports {outcome}.",
            "evidence_summary": f"Integration evidence digest for {outcome}."}

def mock_context(outcome, severity="NONE", duplicate_of=0, body=BODY):
    """Virtual validators that answer the real comparative round deterministically."""
    prompt = "Bugbond's public-security adjudicator"
    return {
        "validators": [{
            "provider": "openai", "model": "gpt-4o",
            "config": {"temperature": 0.0, "max_tokens": 500},
            "plugin": "openai-compatible",
            "plugin_config": {"api_key_env_var": "OPENAIKEY", "api_url": "https://api.openai.com"},
        }],
        "genvm_datetime": "2026-08-14T12:00:00Z",
        "mock_llm_response": {
            "nondet_exec_prompt": {prompt: json.dumps(verdict(outcome, severity, duplicate_of))},
            "eq_principle_prompt_comparative": {prompt: True},
        },
        "mock_web_response": {
            "nondet_web_request": {"*": {"method": "GET", "status": 200, "body": body}},
        },
    }

def deploy(default_account):
    return get_contract_factory(contract_file_path="contracts/bugbond.py").deploy(account=default_account)

def create_program(contract, default_account, value=20*ONE):
    return contract.create_program(
        "Integration Scope", "https://example.com", "abc123",
        "Public security issues in src only.",
        "2026-01-01T00:00:00Z", "2027-08-01T00:00:00Z",
        ONE, 2500, ONE, 2*ONE, 3*ONE, 4*ONE,
    ).transact(value=value, account=default_account, wait_transaction_status=TransactionStatus.FINALIZED)

def submit_report(contract, default_account, program_id, title="issue"):
    return contract.submit_report(
        program_id, title, "bounded security synopsis",
        "https://example.com/report", "src/auth", "HIGH",
    ).transact(value=ONE, account=default_account, wait_transaction_status=TransactionStatus.FINALIZED)

def test_program_and_report_lifecycle(default_account):
    contract = deploy(default_account)
    created = create_program(contract, default_account)
    program_id = int(created.get("contract_state") or 1)
    dossier = contract.get_program(program_id).call(transaction_context=mock_context("VALID"))
    assert dossier["name"] == "Integration Scope" and int(dossier["remaining_pool"]) == 20*ONE

    submitted = submit_report(contract, default_account, program_id)
    report = contract.get_report(1).call(transaction_context=mock_context("VALID"))
    assert int(report["status"]) == 1 and report["bond"] == str(ONE)
    assert submitted["status"] in ("accepted", "finalized")

def test_adjudicate_settles_through_real_consensus(default_account):
    contract = deploy(default_account)
    create_program(contract, default_account)
    submit_report(contract, default_account, 1)

    contract.adjudicate(1).transact(
        account=default_account, wait_transaction_status=TransactionStatus.FINALIZED,
        transaction_context=mock_context("VALID", "HIGH"),
    )
    report = contract.get_report(1).call(transaction_context=mock_context("VALID", "HIGH"))
    assert report["verdict"] == "VALID" and int(report["status"]) == 3
    assert report["payout"] == str(3*ONE) and report["refund"] == str(ONE)
    # The digest is produced by the leader inside the real consensus block.
    digests = json.loads(report["evidence_digests"])
    assert digests["disclosure"] and digests["target"]

def test_no_consensus_reverts_and_leaves_report_submitted(default_account):
    """The no-consensus path the direct suite cannot reach."""
    contract = deploy(default_account)
    create_program(contract, default_account)
    submit_report(contract, default_account, 1)

    context = mock_context("VALID", "HIGH")
    context["mock_llm_response"]["eq_principle_prompt_comparative"] = {
        "Bugbond's public-security adjudicator": False,
    }
    with pytest.raises(Exception):
        contract.adjudicate(1).transact(
            account=default_account, wait_transaction_status=TransactionStatus.FINALIZED,
            transaction_context=context,
        )
    report = contract.get_report(1).call(transaction_context=mock_context("VALID", "HIGH"))
    assert int(report["status"]) == 1 and report["verdict"] == "NONE"
