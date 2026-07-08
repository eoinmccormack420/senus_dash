"""
Pydantic schemas defining the exact JSON shape Gemini must return for
each statement type. These mirror the Django models field-for-field
(excluding computed @property fields, FKs, and audit metadata) so the
extracted JSON can be validated before it ever touches the database.


Why Pydantic and not just trusting the JSON: Gemini's JSON mode
guarantees syntactically valid JSON, not that the *fields* are correct.
It can still omit a required field, return a string where a number is
expected, or invent a field name that doesn't exist in your schema.
Pydantic catches all of that immediately, with a clear error message
you can log and act on — rather than a KeyError three layers into your
view logic.
"""

from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field


class ExtractedPLStatement(BaseModel):
    revenue: Decimal
    cost_of_sales: Decimal
    distribution_costs: Decimal = Decimal("0")
    admin_expenses: Decimal
    other_operating_income: Decimal = Decimal("0")
    interest_expense: Decimal = Decimal("0")
    tax_expense: Decimal = Decimal("0")
    gross_profit: Decimal
    operating_loss: Decimal
    loss_before_tax: Decimal
    loss_after_tax: Decimal


class ExtractedBalanceSheet(BaseModel):
    goodwill: Decimal = Decimal("0")
    development_costs: Decimal = Decimal("0")
    tangible_assets: Decimal
    debtors: Decimal
    cash: Decimal
    current_creditors: Decimal  # negative
    contingent_consideration: Decimal = Decimal("0")  # negative if present
    long_term_debt: Decimal = Decimal("0")  # negative
    share_capital: Decimal = Decimal("0")
    share_premium: Decimal = Decimal("0")
    retained_earnings: Decimal


class ExtractedCashFlow(BaseModel):
    net_operating_cash: Decimal
    depreciation: Decimal = Decimal("0")
    working_capital_movement: Decimal = Decimal("0")
    net_investing_cash: Decimal = Decimal("0")
    net_financing_cash: Decimal
    equity_raised: Decimal = Decimal("0")
    loans_net: Decimal = Decimal("0")
    net_cash_movement: Decimal
    opening_cash: Decimal
    closing_cash: Decimal


class ExtractedBusinessMetrics(BaseModel):
    total_customers: Optional[int] = None
    enterprise_customers: Optional[int] = None
    acv_soil_per_enterprise: Optional[Decimal] = None
    acv_era_per_enterprise: Optional[Decimal] = None
    revenue_ireland_pct: Optional[Decimal] = None
    pipeline_value: Optional[Decimal] = None
    pipeline_deals_count: Optional[int] = None
    employees: Optional[int] = None
    market_cap: Optional[Decimal] = None
    share_price: Optional[Decimal] = None


# Maps a statement "kind" string (used throughout the pipeline and CLI)
# to its Pydantic schema and the Django field-set it corresponds to.
SCHEMA_REGISTRY = {
    "pl_statement": ExtractedPLStatement,
    "balance_sheet": ExtractedBalanceSheet,
    "cash_flow": ExtractedCashFlow,
    "business_metrics": ExtractedBusinessMetrics,
}
