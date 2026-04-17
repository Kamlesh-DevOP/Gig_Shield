"""
GIC Payout Service — RazorpayX Payouts Integration.

Handles automatic disbursement of insurance claim payouts to workers
via their registered UPI VPA or bank account.

Workflow:
  1. Create a Razorpay Contact (or reuse cached contact_id)
  2. Create a Fund Account linked to UPI/Bank (or reuse cached)
  3. Initiate Payout via RazorpayX

Falls back to **demo mode** when RAZORPAYX_KEY_ID is not configured.
"""

from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


def is_auto_payout_enabled() -> bool:
    """Check if automatic payout is enabled (triggers immediately on claim approval)."""
    return os.getenv("AUTO_PAYOUT_ENABLED", "false").strip().lower() in ("1", "true", "yes", "on")


def _is_demo_mode() -> bool:
    """Check if we're in demo mode (no RazorpayX credentials)."""
    return not os.getenv("RAZORPAYX_KEY_ID")


def _get_razorpayx_client():
    """Initialize a Razorpay client with RazorpayX credentials."""
    import razorpay

    key_id = os.getenv("RAZORPAYX_KEY_ID")
    key_secret = os.getenv("RAZORPAYX_KEY_SECRET")
    if not key_id or not key_secret:
        return None
    return razorpay.Client(auth=(key_id, key_secret))


def _get_supabase():
    """Get a Supabase client instance."""
    supabase_url = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL", "")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("VITE_SUPABASE_ANON_KEY", "")
    if not supabase_url or not supabase_key:
        return None
    from supabase import create_client
    return create_client(supabase_url, supabase_key)


# ── Demo Mode Generators ──────────────────────────────────────────────────────

def _demo_contact_id() -> str:
    return f"cont_demo_{uuid.uuid4().hex[:12]}"


def _demo_fund_account_id() -> str:
    return f"fa_demo_{uuid.uuid4().hex[:12]}"


def _demo_payout_id() -> str:
    return f"pout_demo_{uuid.uuid4().hex[:12]}"


def _demo_utr() -> str:
    import random
    return f"UTR{random.randint(100000000, 999999999)}"


# ── Core Payout Functions ─────────────────────────────────────────────────────

def create_contact(
    client,
    name: str,
    phone: str = "",
    email: str = "",
    worker_id: int = 0,
) -> Dict[str, Any]:
    """
    Step 1: Create a RazorpayX contact for the worker.
    Returns { "id": "cont_...", ... }
    """
    if _is_demo_mode() or client is None:
        cid = _demo_contact_id()
        logger.info("[DEMO] Created contact: %s for worker %s", cid, worker_id)
        return {"id": cid, "name": name, "type": "employee", "demo": True}

    payload = {
        "name": name,
        "type": "employee",
        "reference_id": f"gic_worker_{worker_id}",
    }
    if phone:
        payload["contact"] = phone
    if email:
        payload["email"] = email

    contact = client.contact.create(payload)
    logger.info("Created RazorpayX contact: %s for worker %s", contact["id"], worker_id)
    return contact


def create_fund_account(
    client,
    contact_id: str,
    payout_method: str,
    upi_id: Optional[str] = None,
    bank_name: Optional[str] = None,
    account_number: Optional[str] = None,
    ifsc_code: Optional[str] = None,
    account_holder: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Step 2: Create a fund account linked to UPI VPA or bank account.
    Returns { "id": "fa_...", ... }
    """
    if _is_demo_mode() or client is None:
        faid = _demo_fund_account_id()
        mode = "UPI" if payout_method == "upi" else "IMPS"
        dest = upi_id if payout_method == "upi" else f"****{(account_number or '')[-4:]}"
        logger.info("[DEMO] Created fund account: %s (%s → %s)", faid, mode, dest)
        return {"id": faid, "account_type": payout_method, "demo": True}

    if payout_method == "upi":
        payload = {
            "contact_id": contact_id,
            "account_type": "vpa",
            "vpa": {
                "address": upi_id,
            },
        }
    else:
        payload = {
            "contact_id": contact_id,
            "account_type": "bank_account",
            "bank_account": {
                "name": account_holder or "Account Holder",
                "ifsc": ifsc_code or "",
                "account_number": account_number or "",
            },
        }

    fund_account = client.fund_account.create(payload)
    logger.info("Created RazorpayX fund account: %s", fund_account["id"])
    return fund_account


def initiate_payout(
    client,
    fund_account_id: str,
    amount_inr: float,
    mode: str = "UPI",
    purpose: str = "payout",
    reference_id: str = "",
    narration: str = "GIC Insurance Claim Payout",
) -> Dict[str, Any]:
    """
    Step 3: Create the actual payout.
    Amount is in INR — converted to paise internally.
    Returns { "id": "pout_...", "status": "processing", "utr": "...", ... }
    """
    if _is_demo_mode() or client is None:
        pid = _demo_payout_id()
        utr = _demo_utr()
        logger.info("[DEMO] Payout initiated: %s, ₹%.2f, UTR: %s", pid, amount_inr, utr)
        return {
            "id": pid,
            "status": "processed",
            "amount": int(amount_inr * 100),
            "currency": "INR",
            "mode": mode,
            "utr": utr,
            "fund_account_id": fund_account_id,
            "purpose": purpose,
            "reference_id": reference_id,
            "narration": narration,
            "demo": True,
        }

    account_number = os.getenv("RAZORPAYX_ACCOUNT_NUMBER", "")
    payout_data = {
        "account_number": account_number,
        "fund_account_id": fund_account_id,
        "amount": int(amount_inr * 100),  # Convert to paise
        "currency": "INR",
        "mode": mode,
        "purpose": purpose,
        "reference_id": reference_id or f"gic_claim_{uuid.uuid4().hex[:8]}",
        "narration": narration,
    }

    idempotency_key = str(uuid.uuid4())
    payout = client.payout.create(payout_data, {"idempotency_key": idempotency_key})
    logger.info("RazorpayX payout created: %s, status: %s", payout["id"], payout.get("status"))
    return payout


def fetch_payout_status(client, payout_id: str) -> Dict[str, Any]:
    """Fetch the current status of a payout."""
    if _is_demo_mode() or client is None:
        # Demo payouts are always "processed"
        return {
            "id": payout_id,
            "status": "processed",
            "utr": _demo_utr() if payout_id.startswith("pout_demo_") else None,
            "demo": True,
        }

    return client.payout.fetch(payout_id)


# ── High-Level Orchestrator Function ──────────────────────────────────────────

async def process_claim_payout(
    worker_id: int,
    amount: float,
    claim_trace_id: str,
    reason: str = "Parametric insurance claim payout",
) -> Dict[str, Any]:
    """
    End-to-end payout processing for an approved claim.

    1. Fetches worker payout details from Supabase
    2. Creates/reuses Razorpay Contact + Fund Account
    3. Initiates payout
    4. Logs transaction to payout_transactions table
    5. Returns payout result

    Works in demo mode when RazorpayX credentials are not configured.
    """
    demo = _is_demo_mode()
    client = _get_razorpayx_client()
    sb = _get_supabase()

    # ── 1. Fetch worker payout details ────────────────────────────────────
    worker_data = None
    if sb:
        try:
            res = sb.table("gic_workers").select(
                "worker_id, payout_method, upi_id, bank_name, account_number, "
                "ifsc_code, account_holder, razorpay_contact_id, razorpay_fund_account_id, record"
            ).eq("worker_id", worker_id).single().execute()
            worker_data = res.data
        except Exception as e:
            logger.warning("Could not fetch worker %s from Supabase: %s", worker_id, e)

    if not worker_data:
        # Fallback: return demo payout with minimal info
        logger.warning("Worker %s not found in DB. Using demo fallback.", worker_id)
        worker_data = {
            "payout_method": "upi",
            "upi_id": "demo@upi",
            "razorpay_contact_id": None,
            "razorpay_fund_account_id": None,
        }

    payout_method = worker_data.get("payout_method") or "upi"
    worker_record = worker_data.get("record") or {}
    worker_name = worker_record.get("name") or worker_data.get("account_holder") or f"Worker {worker_id}"

    # ── 2. Create or reuse Contact ────────────────────────────────────────
    contact_id = worker_data.get("razorpay_contact_id")
    if not contact_id:
        contact = create_contact(
            client=client,
            name=worker_name,
            worker_id=worker_id,
        )
        contact_id = contact["id"]

        # Cache contact_id in DB
        if sb and not demo:
            try:
                sb.table("gic_workers").update(
                    {"razorpay_contact_id": contact_id}
                ).eq("worker_id", worker_id).execute()
            except Exception as e:
                logger.warning("Failed to cache contact_id: %s", e)

    # ── 3. Create or reuse Fund Account ───────────────────────────────────
    fund_account_id = worker_data.get("razorpay_fund_account_id")
    if not fund_account_id:
        fund_account = create_fund_account(
            client=client,
            contact_id=contact_id,
            payout_method=payout_method,
            upi_id=worker_data.get("upi_id"),
            bank_name=worker_data.get("bank_name"),
            account_number=worker_data.get("account_number"),
            ifsc_code=worker_data.get("ifsc_code"),
            account_holder=worker_data.get("account_holder"),
        )
        fund_account_id = fund_account["id"]

        # Cache fund_account_id in DB
        if sb and not demo:
            try:
                sb.table("gic_workers").update(
                    {"razorpay_fund_account_id": fund_account_id}
                ).eq("worker_id", worker_id).execute()
            except Exception as e:
                logger.warning("Failed to cache fund_account_id: %s", e)

    # ── 4. Initiate Payout ────────────────────────────────────────────────
    mode = "UPI" if payout_method == "upi" else "IMPS"
    payout = initiate_payout(
        client=client,
        fund_account_id=fund_account_id,
        amount_inr=amount,
        mode=mode,
        reference_id=f"gic_claim_{claim_trace_id[:8]}",
        narration=reason,
    )

    payout_id = payout.get("id", "")
    payout_status = payout.get("status", "unknown")
    payout_utr = payout.get("utr", "")

    # ── 5. Log transaction to Supabase ────────────────────────────────────
    if sb:
        try:
            sb.table("payout_transactions").insert({
                "worker_id": worker_id,
                "claim_trace_id": claim_trace_id,
                "razorpay_payout_id": payout_id,
                "razorpay_contact_id": contact_id,
                "razorpay_fund_account_id": fund_account_id,
                "amount": amount,
                "mode": mode,
                "status": "demo_success" if demo else payout_status,
                "utr": payout_utr,
                "reason": reason,
            }).execute()
        except Exception as e:
            logger.warning("Failed to log payout transaction: %s", e)

    # ── 6. Return result ──────────────────────────────────────────────────
    dest_display = (
        worker_data.get("upi_id", "***@upi")
        if payout_method == "upi"
        else f"****{(worker_data.get('account_number') or '')[-4:]}"
    )

    return {
        "payout_id": payout_id,
        "status": "demo_success" if demo else payout_status,
        "amount": amount,
        "mode": mode,
        "utr": payout_utr,
        "fund_account_id": fund_account_id,
        "contact_id": contact_id,
        "worker_id": worker_id,
        "claim_trace_id": claim_trace_id,
        "destination": dest_display,
        "payout_method": payout_method,
        "demo": demo,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ── Debug / Reset Functions ───────────────────────────────────────────────────

async def reset_payout(
    worker_id: Optional[int] = None,
    payout_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Reset payout state for debugging.

    - If worker_id is provided: deletes all payout_transactions for that worker
      and clears cached razorpay_contact_id / razorpay_fund_account_id.
    - If payout_id is provided: deletes that specific transaction.
    - If neither: deletes ALL payout_transactions (full reset).

    Only works when called explicitly — intended for development/debugging.
    """
    sb = _get_supabase()
    deleted_count = 0
    details = []

    if sb:
        try:
            if payout_id:
                # Delete specific payout
                sb.table("payout_transactions").delete().eq(
                    "razorpay_payout_id", payout_id
                ).execute()
                deleted_count = 1
                details.append(f"Deleted payout: {payout_id}")

            elif worker_id:
                # Delete all payouts for this worker
                res = sb.table("payout_transactions").delete().eq(
                    "worker_id", worker_id
                ).execute()
                deleted_count = len(res.data) if res.data else 0
                details.append(f"Deleted {deleted_count} payout(s) for worker {worker_id}")

                # Clear cached Razorpay IDs
                try:
                    sb.table("gic_workers").update({
                        "razorpay_contact_id": None,
                        "razorpay_fund_account_id": None,
                    }).eq("worker_id", worker_id).execute()
                    details.append(f"Cleared cached Razorpay IDs for worker {worker_id}")
                except Exception as e:
                    details.append(f"Warning: could not clear cached IDs: {e}")

            else:
                # Full reset — delete ALL payout transactions
                res = sb.table("payout_transactions").delete().neq(
                    "id", "00000000-0000-0000-0000-000000000000"
                ).execute()
                deleted_count = len(res.data) if res.data else 0
                details.append(f"Deleted ALL {deleted_count} payout transaction(s)")

        except Exception as e:
            logger.warning("Reset payout failed: %s", e)
            return {"status": "error", "error": str(e), "deleted_count": 0}

    return {
        "status": "reset_complete",
        "deleted_count": deleted_count,
        "details": details,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

