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
    AdvisoryGoal,
    FundingRoadmapStep,
    EcosystemChecklistItem,
    ReportSpec,
    ExtractionAttempt,
    AllowedGoogleEmail,
    UserPreferences,
    NotificationSettings,
    BoardAlertSettings,
    DriveSettings,
    IncubatorSettings,
    NearbyIncubator,
)
from .alerts import evaluate_board_alerts
from .readiness import compute_readiness_score, compute_funding_milestones


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


class AdvisoryGoalSerializer(serializers.ModelSerializer):
    """
    Read-only from the outside — mutations (commit/dismiss/complete) go
    through AdvisoryGoalViewSet's actions, not a PATCH body, same
    approve/reject-as-actions shape as ExtractionAttemptViewSet.
    """

    class Meta:
        model = AdvisoryGoal
        fields = [
            "id",
            "order",
            "title",
            "description",
            "rationale",
            "status",
            "model_used",
            "generated_at",
            "committed_at",
        ]


class FundingRoadmapStepSerializer(serializers.ModelSerializer):
    """
    Read-only — no commit/dismiss workflow (see FundingRoadmapStep's
    docstring), the whole set is regenerated wholesale via
    GenerateFundingRoadmapView.
    """

    class Meta:
        model = FundingRoadmapStep
        fields = ["id", "order", "timeframe", "title", "description", "model_used", "generated_at"]


class ExtractionAttemptPeriodSerializer(serializers.ModelSerializer):
    """Minimal nested period reference for the Governance Center — just
    enough to label a row and drive the period filter dropdown."""

    class Meta:
        model = FinancialPeriod
        fields = ["id", "label"]


class ExtractionAttemptListSerializer(serializers.ModelSerializer):
    """Governance Center list view — omits cross_check_results (can be a
    sizeable per-field dict) to keep the list payload small."""

    period = ExtractionAttemptPeriodSerializer(read_only=True)

    class Meta:
        model = ExtractionAttempt
        fields = [
            "id",
            "period",
            "statement_kind",
            "source_document",
            "model_used",
            "status",
            "match_rate_pct",
            "verified",
            "created_at",
        ]


class ExtractionAttemptSerializer(serializers.ModelSerializer):
    """Full detail, including cross_check_results — used for the
    Governance Center's retrieve/approve/reject responses."""

    period = ExtractionAttemptPeriodSerializer(read_only=True)

    class Meta:
        model = ExtractionAttempt
        fields = [
            "id",
            "period",
            "statement_kind",
            "source_document",
            "model_used",
            "status",
            "match_rate_pct",
            "cross_check_results",
            "verified",
            "created_at",
        ]


class EcosystemChecklistItemSerializer(serializers.ModelSerializer):
    """
    key/title/description are fixed benchmark definitions, not
    admin-authorable — only status/notes are writable (see
    EcosystemChecklistItemViewSet.get_permissions for who can PATCH).
    """

    class Meta:
        model = EcosystemChecklistItem
        fields = ["id", "key", "order", "title", "description", "status", "notes", "updated_at"]
        read_only_fields = ["key", "order", "title", "description", "updated_at"]


class ReportSpecSerializer(serializers.ModelSerializer):
    """
    Mutations to tailored_narrative/narrative_* happen only through
    ReportSpecViewSet's generate_narrative/approve_narrative actions,
    not this serializer's PATCH body — same read-only-from-outside
    rule as AdvisoryGoalSerializer.
    """

    period_label = serializers.CharField(source="period.label", read_only=True)
    created_by_username = serializers.SerializerMethodField()
    narrative_approved_by_username = serializers.SerializerMethodField()

    def get_created_by_username(self, obj):
        return obj.created_by.username if obj.created_by else None

    def get_narrative_approved_by_username(self, obj):
        return obj.narrative_approved_by.username if obj.narrative_approved_by else None

    class Meta:
        model = ReportSpec
        fields = [
            "id",
            "period",
            "period_label",
            "title",
            "audience_label",
            "context_note",
            "include_revenue_growth",
            "include_profitability",
            "include_cash_liquidity",
            "include_solvency_leverage",
            "include_returns",
            "include_outlook",
            "use_tailored_narrative",
            "tailored_narrative",
            "narrative_generated_at",
            "narrative_approved",
            "narrative_approved_by_username",
            "narrative_approved_at",
            "created_by_username",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "tailored_narrative",
            "narrative_generated_at",
            "narrative_approved",
            "narrative_approved_at",
            "created_at",
            "updated_at",
        ]


class AllowedGoogleEmailSerializer(serializers.ModelSerializer):
    added_by_username = serializers.SerializerMethodField()

    def get_added_by_username(self, obj):
        return obj.added_by.username if obj.added_by else None

    class Meta:
        model = AllowedGoogleEmail
        fields = ["id", "email", "added_by_username", "created_at"]
        read_only_fields = ["added_by_username", "created_at"]


class UserPreferencesSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserPreferences
        fields = ["notify_on_new_insights", "notify_on_board_alerts"]


class BoardAlertSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = BoardAlertSettings
        fields = [
            "cash_runway_enabled",
            "cash_runway_months_min",
            "ebitda_margin_enabled",
            "ebitda_margin_min_pct",
            "admin_expense_ratio_enabled",
            "admin_expense_ratio_max_pct",
            "current_ratio_enabled",
            "current_ratio_min",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]


class DriveSettingsSerializer(serializers.ModelSerializer):
    """
    refresh_token is a credential like NotificationSettings.gmail_refresh_token
    — deliberately not in fields at all, never read back over the API.

    folder_name is a plain writable field, not a live Drive API lookup —
    the folder picker (DriveFoldersView) already has the name in hand
    from the listing it's rendering when "Select this folder" is
    clicked, so it's saved then rather than looked up on every GET
    (a live external call on every Settings load is slow, and would
    actually hang if Drive auth is misconfigured).
    """

    class Meta:
        model = DriveSettings
        fields = [
            "folder_id",
            "folder_name",
            "connected_email",
            "last_sync_status",
            "last_sync_summary",
            "last_synced_at",
            "updated_at",
        ]
        read_only_fields = [
            "connected_email",
            "last_sync_status",
            "last_sync_summary",
            "last_synced_at",
            "updated_at",
        ]


class IncubatorSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = IncubatorSettings
        fields = ["search_location", "last_refreshed_at", "last_refresh_error"]
        read_only_fields = ["last_refreshed_at", "last_refresh_error"]


class NearbyIncubatorSerializer(serializers.ModelSerializer):
    class Meta:
        model = NearbyIncubator
        fields = ["place_id", "name", "address", "website", "rating", "maps_url"]
        read_only_fields = fields


class NotificationSettingsSerializer(serializers.ModelSerializer):
    # smtp_password is a real credential, unlike the webhook URLs and
    # the rest of the SMTP fields — write_only so a GET never echoes it
    # back; smtp_password_set tells the UI whether one is stored at all.
    smtp_password_set = serializers.SerializerMethodField()

    class Meta:
        model = NotificationSettings
        fields = [
            "slack_webhook_url",
            "teams_webhook_url",
            "smtp_host",
            "smtp_port",
            "smtp_username",
            "smtp_password",
            "smtp_password_set",
            "smtp_use_tls",
            "from_email",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]
        extra_kwargs = {"smtp_password": {"write_only": True}}

    def get_smtp_password_set(self, obj) -> bool:
        return bool(obj.smtp_password)


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
    advisory_goals = AdvisoryGoalSerializer(many=True, read_only=True)
    funding_roadmap = FundingRoadmapStepSerializer(many=True, read_only=True, source="funding_roadmap_steps")
    provenance = serializers.ReadOnlyField()
    # Cross-statement metrics (need pl_statement + balance_sheet/cash_flow
    # together, so they live on FinancialPeriod itself rather than any
    # single nested statement — see models.py for the calculations).
    yoy_revenue_growth_pct = serializers.ReadOnlyField()
    roce_pct = serializers.ReadOnlyField()
    dscr = serializers.ReadOnlyField()
    # Evaluated against the admin-configured BoardAlertSettings singleton
    # (board/alerts.py) rather than stored — thresholds can change at any
    # time, so this always reflects the current configuration.
    board_alerts = serializers.SerializerMethodField()
    funding_readiness = serializers.SerializerMethodField()

    def get_board_alerts(self, obj):
        return evaluate_board_alerts(obj, BoardAlertSettings.get_solo())

    def get_funding_readiness(self, obj):
        readiness = compute_readiness_score(obj)
        return {**readiness, "milestones": compute_funding_milestones(obj)}

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
            "advisory_goals",
            "funding_roadmap",
            "provenance",
            "yoy_revenue_growth_pct",
            "roce_pct",
            "dscr",
            "board_alerts",
            "funding_readiness",
        ]
