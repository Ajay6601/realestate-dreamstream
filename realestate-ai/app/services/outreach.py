"""Outreach drafting: deterministic template, optionally polished by an LLM.

Drafts are always grounded in numbers from the valuation model - the LLM never
invents figures. Its output is accepted only if every figure we supplied survives
and the compliance footer is intact; otherwise we silently keep the template.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field

from app.config import Settings

log = logging.getLogger(__name__)


@dataclass
class OutreachContext:
    audience: str  # owner | lead
    address: str
    city: str
    beds: int
    baths: float
    sqft: int
    list_price: float
    estimate: float
    low: float
    high: float
    discount: float  # (estimate - list) / estimate
    recipient_name: str | None = None
    reasons: list[str] = field(default_factory=list)


def _usd(x: float) -> str:
    return f"${x:,.0f}"


def _first_name(name: str | None) -> str:
    return (name or "").strip().split(" ")[0] or "there"


def footer(settings: Settings) -> str:
    return (
        f"\n--\n{settings.sender_name}, {settings.sender_company}\n{settings.sender_address}\n"
        "Not interested? Reply STOP and we will not contact you again."
    )


def template_draft(ctx: OutreachContext, settings: Settings) -> tuple[str, str]:
    rng = f"{_usd(ctx.low)}-{_usd(ctx.high)}"
    if ctx.audience == "owner":
        subject = f"What {ctx.address} could sell for"
        if ctx.discount >= 0.08:
            insight = (
                f"Our model values it at about {_usd(ctx.estimate)}, which is "
                f"{ctx.discount:.0%} above the {_usd(ctx.list_price)} price on record - "
                "there may be real upside in repricing."
            )
        elif ctx.discount <= -0.08:
            insight = (
                f"Our model values it at about {_usd(ctx.estimate)}, below the {_usd(ctx.list_price)} price on record. "
                "Homes priced above market tend to sit longer, so it may be worth revisiting the strategy."
            )
        else:
            insight = (
                f"Our model values it at about {_usd(ctx.estimate)}, right in line with the "
                f"{_usd(ctx.list_price)} price on record."
            )
        body = (
            f"Hi {_first_name(ctx.recipient_name)},\n\n"
            f"I'm {settings.sender_name} with {settings.sender_company}. We ran {ctx.address}, {ctx.city} "
            f"({ctx.beds} bd / {ctx.baths:g} ba, {ctx.sqft:,} sqft) through our pricing model.\n\n"
            f"{insight} The likely range is {rng}.\n\n"
            "If it would help, I can share the full breakdown and what comparable homes are doing right now. "
            "Would a quick call this week work?"
        )
    else:
        subject = f"{ctx.beds}-bed in {ctx.city} for {_usd(ctx.list_price)} - fits what you asked for"
        why = "".join(f"- {r[0].upper() + r[1:]}\n" for r in ctx.reasons)
        value_line = (
            f"Our model puts its value at about {_usd(ctx.estimate)} (range {rng}), "
            f"so the asking price is {abs(ctx.discount):.0%} {'below' if ctx.discount >= 0 else 'above'} that."
        )
        body = (
            f"Hi {_first_name(ctx.recipient_name)},\n\n"
            f"A new match for your search: {ctx.address}, {ctx.city} - {ctx.beds} bd / {ctx.baths:g} ba, "
            f"{ctx.sqft:,} sqft, listed at {_usd(ctx.list_price)}.\n\n"
            + (f"Why it fits:\n{why}\n" if why else "")
            + f"{value_line}\n\nWant me to set up a showing?"
        )
    return subject, body + "\n" + footer(settings)


_MONEY = re.compile(r"\$\d+(?:,\d{3})*")


def _llm_ok(original: str, rewritten: str, settings: Settings) -> bool:
    required = set(_MONEY.findall(original))
    return required <= set(_MONEY.findall(rewritten)) and "STOP" in rewritten and settings.sender_address in rewritten


def polish_with_llm(subject: str, body: str, settings: Settings) -> str | None:
    """Return a more natural rewrite, or None if unavailable / rejected by the guardrails."""
    if not settings.anthropic_api_key:
        return None
    try:
        import anthropic

        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        msg = client.messages.create(
            model=settings.outreach_llm_model,
            max_tokens=700,
            system=(
                "You edit real-estate outreach emails. Make the email warm and concise. "
                "Keep every dollar figure, address, and the footer exactly as written. "
                "Do not add facts, promises, or urgency. Return only the email body."
            ),
            messages=[{"role": "user", "content": f"Subject: {subject}\n\n{body}"}],
        )
        text = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text").strip()
        return text if _llm_ok(body, text, settings) else None
    except Exception:  # network, auth, quota - never block drafting on the LLM
        log.warning("LLM polish failed; using template", exc_info=True)
        return None


def compose(ctx: OutreachContext, settings: Settings) -> tuple[str, str, str]:
    subject, body = template_draft(ctx, settings)
    polished = polish_with_llm(subject, body, settings)
    if polished:
        return subject, polished, f"llm:{settings.outreach_llm_model}"
    return subject, body, "template"
