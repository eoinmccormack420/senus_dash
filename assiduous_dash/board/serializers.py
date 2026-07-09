"""
DRF serializers for the Senus Board Report app.

Save as: <yourapp>/serializers.py

Design notes:
- Each statement serializer exposes both the raw stored fields AND the
  computed @property fields from models.py (gross_margin_pct, ebitda,
  cash_runway_months, etc.) as read-only SerializerMethodFields. This
  means the frontend never recalculates financial ratios itself — the
  backend is the single source of truth, which matters for a board-level
  tool where numbers need to be trustworthy.
- PeriodDetailSerializer nests everything under one period so the
  dashboard can fetch a full period's data (P&L + balance sheet + cash
  flow + business metrics + AI insights) in a single request.
- PeriodListSerializer is deliberately lightweight (label + dates only)
  for populating a period switcher/dropdown without over-fetching.
"""

from rest_framework import serializers

from .models import (
    FinancialPeriod,
    PLStatement,
    BalanceSheet,
    CashFlow,
    BusinessMetrics,
    AIInsight,
)


class PLStatementSerializer(serializers.ModelSerializer):
    gross_margin_pct = serializers.ReadOnlyField()
    ebitda = serializers.ReadOnlyField()
    admin_expense_pct = serializers.ReadOnlyField()
    ebitda_margin_pct = serializers.ReadOnlyField()

    class Meta:
        model = PLStatement
        fields = [
            "id",
            "revenue",
            "cost_of_sales",
            "distribution_costs",
            "admin_expenses",
            "other_operating_income",
            "interest_expense",
            "tax_expense",
            "gross_profit",
            "operating_loss",
            "loss_before_tax",
            "loss_after_tax",
            "gross_margin_pct",
            "ebitda",
            "admin_expense_pct",
            "ebitda_margin_pct",
        ]


class BalanceSheetSerializer(serializers.ModelSerializer):
    total_fixed_assets = serializers.ReadOnlyField()
    total_current_assets = serializers.ReadOnlyField()
    net_assets = serializers.ReadOnlyField()
    cash_runway_months = serializers.ReadOnlyField()
    current_ratio = serializers.ReadOnlyField()

    class Meta:
        model = BalanceSheet
        fields = [
            "id",
            "goodwill",
            "development_costs",
            "tangible_assets",
            "debtors",
            "cash",
            "current_creditors",
            "contingent_consideration",
            "long_term_debt",
            "share_capital",
            "share_premium",
            "retained_earnings",
            "total_fixed_assets",
            "total_current_assets",
            "net_assets",
            "cash_runway_months",
            "current_ratio",
        ]


class CashFlowSerializer(serializers.ModelSerializer):
    free_cash_flow = serializers.ReadOnlyField()

    class Meta:
        model = CashFlow
        fields = [
            "id",
            "net_operating_cash",
            "depreciation",
            "working_capital_movement",
            "net_investing_cash",
            "net_financing_cash",
            "equity_raised",
            "loans_net",
            "net_cash_movement",
            "opening_cash",
            "closing_cash",
            "free_cash_flow",
        ]


class BusinessMetricsSerializer(serializers.ModelSerializer):
    revenue_per_customer = serializers.ReadOnlyField()
    enterprise_revenue_concentration = serializers.ReadOnlyField()

    class Meta:
        model = BusinessMetrics
        fields = [
            "id",
            "total_customers",
            "enterprise_customers",
            "acv_soil_per_enterprise",
            "acv_era_per_enterprise",
            "revenue_ireland_pct",
            "pipeline_value",
            "pipeline_deals_count",
            "employees",
            "market_cap",
            "share_price",
            "revenue_per_customer",
            "enterprise_revenue_concentration",
        ]


class AIInsightSerializer(serializers.ModelSerializer):
    section_display = serializers.CharField(
        source="get_section_display", read_only=True
    )

    class Meta:
        model = AIInsight
        fields = [
            "id",
            "section",
            "section_display",
            "generated_text",
            "model_used",
            "generated_at",
        ]


class PeriodListSerializer(serializers.ModelSerializer):
    """Lightweight — for populating a period switcher dropdown."""

    provenance = serializers.ReadOnlyField()

    class Meta:
        model = FinancialPeriod
        fields = ["id", "label", "period_type", "start_date", "end_date", "is_audited", "provenance"]


class PeriodDetailSerializer(serializers.ModelSerializer):
    """
    Full aggregate payload for one period. This is the endpoint the
    dashboard should call on load/period-switch — everything it needs
    in one round trip.

    Nested statements use source= to follow the related_name set on each
    OneToOne field in models.py (pl_statement, balance_sheet, cash_flow,
    business_metrics). They're allow_null because not every period has
    every statement seeded yet (e.g. HY2025 has no balance sheet).
    """

    pl_statement = PLStatementSerializer(read_only=True, allow_null=True)
    balance_sheet = BalanceSheetSerializer(read_only=True, allow_null=True)
    cash_flow = CashFlowSerializer(read_only=True, allow_null=True)
    business_metrics = BusinessMetricsSerializer(read_only=True, allow_null=True)
    ai_insights = AIInsightSerializer(many=True, read_only=True)
    provenance = serializers.ReadOnlyField()
    # Cross-statement metrics (need pl_statement + balance_sheet/cash_flow
    # together, so they live on FinancialPeriod itself rather than any
    # single nested statement — see models.py for the calculations).
    yoy_revenue_growth_pct = serializers.ReadOnlyField()
    roce_pct = serializers.ReadOnlyField()
    dscr = serializers.ReadOnlyField()

    class Meta:
        model = FinancialPeriod
        fields = [
            "id",
            "label",
            "period_type",
            "start_date",
            "end_date",
            "is_audited",
            "notes",
            "pl_statement",
            "balance_sheet",
            "cash_flow",
            "business_metrics",
            "ai_insights",
            "provenance",
            "yoy_revenue_growth_pct",
            "roce_pct",
            "dscr",
        ]
