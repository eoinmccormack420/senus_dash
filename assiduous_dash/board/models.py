from django.contrib.auth.models import User
from django.db import models
from pgvector.django import VectorField

class FinancialPeriod(models.Model):
    """Represents a reporting period — annual or half-year."""

    PERIOD_TYPES = [
        ("annual", "Annual"),
        ("half_year", "Half Year"),
    ]

    label = models.CharField(max_length=50)           # e.g. "FY2025", "HY2026"
    period_type = models.CharField(max_length=10, choices=PERIOD_TYPES)
    start_date = models.DateField()
    end_date = models.DateField()
    is_audited = models.BooleanField(default=False)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["end_date"]

    def __str__(self):
        return self.label

    @property
    def provenance(self):
        """
        Aggregate data-provenance signal across this period's extraction
        attempts, for the "AI-verified" trust badge in the dashboard.

        Takes the most recent attempt per statement kind (so retries
        don't get double-counted), then reports whether ANY of the
        period's figures went through the AI extraction pipeline at all,
        the average cross-check match rate across those attempts, and
        whether a human reviewer has verified all of them.
        """
        latest_by_kind = {}
        for attempt in self.extraction_attempts.order_by("created_at"):
            latest_by_kind[attempt.statement_kind] = attempt

        attempts = list(latest_by_kind.values())
        if not attempts:
            return {"source": "manual", "match_rate_pct": None, "verified": False}

        rates = [float(a.match_rate_pct) for a in attempts if a.match_rate_pct is not None]
        return {
            "source": "ai_extracted",
            "match_rate_pct": round(sum(rates) / len(rates), 1) if rates else None,
            "verified": all(a.verified for a in attempts),
        }

    @property
    def yoy_revenue_growth_pct(self):
        """
        Revenue growth vs. the same period one year prior — matched by
        period_type and exact year-prior end_date (HY2026 compares to
        HY2025, not to whatever row happens to be previous in a list,
        which could be a different period_type entirely and make the
        comparison meaningless). Returns None if no matching prior-year
        period exists yet (e.g. the earliest seeded period) rather than
        comparing against the wrong thing.
        """
        pl = getattr(self, "pl_statement", None)
        if pl is None or not pl.revenue:
            return None
        try:
            prior_year_end = self.end_date.replace(year=self.end_date.year - 1)
        except ValueError:
            # 29 Feb with no leap year one year prior
            prior_year_end = self.end_date.replace(year=self.end_date.year - 1, day=28)

        prior_period = FinancialPeriod.objects.filter(
            period_type=self.period_type, end_date=prior_year_end
        ).first()
        prior_pl = getattr(prior_period, "pl_statement", None) if prior_period else None
        if prior_pl is None or not prior_pl.revenue:
            return None

        return round(float((pl.revenue - prior_pl.revenue) / prior_pl.revenue) * 100, 1)

    @property
    def roce_pct(self):
        """
        Return on Capital Employed = EBIT / (Total Assets − Current
        Liabilities). Operating result (operating_loss) is used as the
        EBIT proxy — it already sits below gross profit and admin
        expenses, above interest and tax, matching EBIT's usual
        position in the P&L. Expected to be negative for Senus at its
        current pre-profitability stage — that's a true reading of the
        business, not a bug, and the frontend should present it as
        such rather than hide it.
        """
        pl = getattr(self, "pl_statement", None)
        bs = getattr(self, "balance_sheet", None)
        if pl is None or bs is None:
            return None
        capital_employed = (
            bs.total_fixed_assets + bs.total_current_assets - abs(bs.current_creditors)
        )
        if not capital_employed:
            return None
        return round(float(pl.operating_loss / capital_employed) * 100, 1)

    @property
    def dscr(self):
        """
        Debt Service Coverage Ratio = EBITDA / (interest + principal
        repaid). Principal repaid is approximated from
        CashFlow.loans_net: a negative value means net repayment of
        debt during the period, so its magnitude is used as the
        principal-repayment component; a positive value (net new
        borrowing) contributes nothing to debt SERVICE, which is a
        cash outflow concept, not a net-of-new-debt one. This is a
        reasonable approximation given available data, not a
        treasury-grade calculation — flagged as such rather than
        presented as precise.
        """
        pl = getattr(self, "pl_statement", None)
        cf = getattr(self, "cash_flow", None)
        if pl is None or cf is None:
            return None
        ebitda = pl.ebitda
        if ebitda is None:
            return None
        principal_repaid = abs(cf.loans_net) if cf.loans_net < 0 else 0
        debt_service = abs(pl.interest_expense) + principal_repaid
        if not debt_service:
            return None
        return round(float(ebitda / debt_service), 2)


class PLStatement(models.Model):
    """Consolidated Profit and Loss / Income Statement for a period."""

    period = models.OneToOneField(
        FinancialPeriod, on_delete=models.CASCADE, related_name="pl_statement"
    )

    # Revenue
    revenue = models.DecimalField(max_digits=12, decimal_places=2)
    cost_of_sales = models.DecimalField(max_digits=12, decimal_places=2)

    # Expenses
    distribution_costs = models.DecimalField(
        max_digits=12, decimal_places=2, default=0
    )
    admin_expenses = models.DecimalField(max_digits=12, decimal_places=2)
    other_operating_income = models.DecimalField(
        max_digits=12, decimal_places=2, default=0
    )

    # Below the line
    interest_expense = models.DecimalField(
        max_digits=12, decimal_places=2, default=0
    )
    tax_expense = models.DecimalField(
        max_digits=12, decimal_places=2, default=0
    )

    # Calculated fields — stored for query performance
    gross_profit = models.DecimalField(max_digits=12, decimal_places=2)
    operating_loss = models.DecimalField(max_digits=12, decimal_places=2)
    loss_before_tax = models.DecimalField(max_digits=12, decimal_places=2)
    loss_after_tax = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        ordering = ["period__end_date"]

    def __str__(self):
        return f"P&L — {self.period.label}"

    # Computed properties used in the dashboard
    @property
    def gross_margin_pct(self):
        if self.revenue and self.revenue != 0:
            return round((self.gross_profit / self.revenue) * 100, 1)
        return None

    @property
    def ebitda(self):
        """EBITDA = Operating Loss + Depreciation (sourced from CashFlow)."""
        try:
            return self.operating_loss + self.period.cash_flow.depreciation
        except Exception:
            return None

    @property
    def admin_expense_pct(self):
        if self.revenue and self.revenue != 0:
            return round((self.admin_expenses / self.revenue) * 100, 1)
        return None

    @property
    def ebitda_margin_pct(self):
        ebitda = self.ebitda
        if ebitda is None or not self.revenue:
            return None
        return round(float(ebitda / self.revenue) * 100, 1)


class BalanceSheet(models.Model):
    """Consolidated Balance Sheet as at period end date."""

    period = models.OneToOneField(
        FinancialPeriod, on_delete=models.CASCADE, related_name="balance_sheet"
    )

    # Fixed Assets
    goodwill = models.DecimalField(
        max_digits=12, decimal_places=2, default=0
    )
    development_costs = models.DecimalField(
        max_digits=12, decimal_places=2, default=0
    )
    tangible_assets = models.DecimalField(max_digits=12, decimal_places=2)

    # Current Assets
    debtors = models.DecimalField(max_digits=12, decimal_places=2)
    cash = models.DecimalField(max_digits=12, decimal_places=2)

    # Liabilities
    current_creditors = models.DecimalField(
        max_digits=12, decimal_places=2
    )   # stored as negative
    contingent_consideration = models.DecimalField(
        max_digits=12, decimal_places=2, default=0
    )   # Loamin acquisition liability
    long_term_debt = models.DecimalField(
        max_digits=12, decimal_places=2, default=0
    )   # stored as negative

    # Equity
    share_capital = models.DecimalField(max_digits=12, decimal_places=2)
    share_premium = models.DecimalField(
        max_digits=12, decimal_places=2, default=0
    )
    retained_earnings = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        ordering = ["period__end_date"]

    def __str__(self):
        return f"Balance Sheet — {self.period.label}"

    @property
    def total_fixed_assets(self):
        return self.goodwill + self.development_costs + self.tangible_assets

    @property
    def total_current_assets(self):
        return self.debtors + self.cash

    @property
    def net_assets(self):
        return (
            self.total_fixed_assets
            + self.total_current_assets
            + self.current_creditors
            + self.long_term_debt
            - self.contingent_consideration
        )

    @property
    def cash_runway_months(self):
        """Estimate months of runway based on latest operating cash burn."""
        try:
            monthly_burn = abs(self.period.cash_flow.net_operating_cash) / 6
            if monthly_burn > 0:
                return round(float(self.cash) / float(monthly_burn), 1)
        except Exception:
            return None

    @property
    def current_ratio(self):
        if self.current_creditors and self.current_creditors != 0:
            return round(
                float(self.total_current_assets) / abs(float(self.current_creditors)), 2
            )
        return None


class CashFlow(models.Model):
    """Consolidated Cash Flow Statement for a period."""

    period = models.OneToOneField(
        FinancialPeriod, on_delete=models.CASCADE, related_name="cash_flow"
    )

    # Operating
    net_operating_cash = models.DecimalField(
        max_digits=12, decimal_places=2
    )   # stored as negative outflow
    depreciation = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    working_capital_movement = models.DecimalField(
        max_digits=12, decimal_places=2, default=0
    )

    # Investing
    net_investing_cash = models.DecimalField(
        max_digits=12, decimal_places=2, default=0
    )

    # Financing
    net_financing_cash = models.DecimalField(max_digits=12, decimal_places=2)
    equity_raised = models.DecimalField(
        max_digits=12, decimal_places=2, default=0
    )
    loans_net = models.DecimalField(
        max_digits=12, decimal_places=2, default=0
    )

    # Summary
    net_cash_movement = models.DecimalField(max_digits=12, decimal_places=2)
    opening_cash = models.DecimalField(max_digits=12, decimal_places=2)
    closing_cash = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        ordering = ["period__end_date"]

    def __str__(self):
        return f"Cash Flow — {self.period.label}"

    @property
    def free_cash_flow(self):
        return self.net_operating_cash + self.net_investing_cash


class BusinessMetrics(models.Model):
    """Operational KPIs and business metrics for a period."""

    period = models.OneToOneField(
        FinancialPeriod, on_delete=models.CASCADE, related_name="business_metrics"
    )

    # Customers
    total_customers = models.IntegerField(null=True, blank=True)
    enterprise_customers = models.IntegerField(null=True, blank=True)

    # Contract values
    acv_soil_per_enterprise = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    acv_era_per_enterprise = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )

    # Geography
    revenue_ireland_pct = models.DecimalField(
        max_digits=5, decimal_places=1, null=True, blank=True
    )   # e.g. 78.0

    # Pipeline (from half-year reports)
    pipeline_value = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    pipeline_deals_count = models.IntegerField(null=True, blank=True)

    # Company
    employees = models.IntegerField(null=True, blank=True)
    market_cap = models.DecimalField(
        max_digits=14, decimal_places=2, null=True, blank=True
    )
    share_price = models.DecimalField(
        max_digits=8, decimal_places=3, null=True, blank=True
    )

    class Meta:
        ordering = ["period__end_date"]

    def __str__(self):
        return f"Business Metrics — {self.period.label}"

    @property
    def revenue_per_customer(self):
        try:
            pl = self.period.pl_statement
            if self.total_customers and self.total_customers > 0:
                return round(float(pl.revenue) / self.total_customers, 2)
        except Exception:
            return None

    @property
    def enterprise_revenue_concentration(self):
        """Percentage of customers that are enterprise accounts."""
        if self.total_customers and self.enterprise_customers:
            return round(
                (self.enterprise_customers / self.total_customers) * 100, 1
            )
        return None


class AIInsight(models.Model):
    """AI-generated board-level commentary for each dashboard section."""

    SECTION_CHOICES = [
        ("executive_summary", "Executive Summary"),
        ("revenue_growth", "Revenue & Growth"),
        ("profitability", "Profitability"),
        ("cash_liquidity", "Cash & Liquidity"),
        ("solvency_leverage", "Solvency & Leverage"),
        ("returns", "Returns"),
        ("outlook", "Outlook & Strategy"),
    ]

    period = models.ForeignKey(
        FinancialPeriod,
        on_delete=models.CASCADE,
        related_name="ai_insights",
    )
    section = models.CharField(max_length=30, choices=SECTION_CHOICES)
    generated_text = models.TextField()
    model_used = models.CharField(max_length=50, default="gemini-3.5-flash")
    generated_at = models.DateTimeField(auto_now_add=True)
    # SHA-256 of the exact figures fed into the prompt for this
    # commentary (see generate_insights.py). Lets generate_insights skip
    # the Gemini call on a re-run when the underlying financial data
    # hasn't changed since the last generation, rather than re-spending
    # an API call to (deterministically) re-narrate the same numbers.
    source_data_hash = models.CharField(max_length=64, blank=True)

    class Meta:
        ordering = ["-generated_at"]
        unique_together = ["period", "section"]

    def __str__(self):
        return f"AI Insight — {self.period.label} — {self.get_section_display()}"
    

class ExtractionAttempt(models.Model):
    """Records a single Gemini extraction attempt for one statement/period."""
 
    STATEMENT_CHOICES = [
        ("pl_statement", "P&L Statement"),
        ("balance_sheet", "Balance Sheet"),
        ("cash_flow", "Cash Flow"),
        ("business_metrics", "Business Metrics"),
    ]
 
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("schema_valid", "Schema Valid"),
        ("schema_invalid", "Schema Invalid"),
        ("cross_check_pass", "Cross-Check Pass"),
        ("cross_check_fail", "Cross-Check Fail"),
        ("api_error", "API Error"),
    ]
 
    period = models.ForeignKey(
        "FinancialPeriod",
        on_delete=models.CASCADE,
        related_name="extraction_attempts",
    )
    statement_kind = models.CharField(max_length=30, choices=STATEMENT_CHOICES)
    source_document = models.CharField(
        max_length=255, help_text="Filename or path of the source PDF"
    )
    source_content_hash = models.CharField(
        max_length=64, blank=True,
        help_text="SHA-256 of the source PDF bytes, used to skip re-calling Gemini "
                   "when the same document is re-run against the same period/kind",
    )
    model_used = models.CharField(max_length=50, default="gemini-1.5-flash")

    raw_response = models.JSONField(
        null=True, blank=True, help_text="Raw JSON returned by Gemini"
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    error_message = models.TextField(blank=True)
 
    # Cross-check results: {"revenue": {"extracted": 688317.0, "actual": 688317.0,
    # "diff_pct": 0.0, "match": true}, ...}
    cross_check_results = models.JSONField(null=True, blank=True)
    match_rate_pct = models.DecimalField(
        max_digits=5, decimal_places=1, null=True, blank=True,
        help_text="Percentage of fields that matched ground truth within tolerance",
    )
 
    # Human approval gate — nothing writes to the real statement models
    # until this is set to True by a reviewer.
    verified = models.BooleanField(default=False)
 
    created_at = models.DateTimeField(auto_now_add=True)
 
    class Meta:
        ordering = ["-created_at"]
 
    def __str__(self):
        return f"{self.statement_kind} — {self.period.label} — {self.status}"


class AdvisoryGoal(models.Model):
    """
    An AI-suggested SMART goal for improving funding/investor readiness
    (see board/extraction/advisory.py's "Strategic Advisory Agent").
    Mirrors ExtractionAttempt's human-approval-gate philosophy: nothing
    surfaces as a committed board goal until a reviewer explicitly
    commits it (AdvisoryGoalViewSet.commit in views.py) — a "suggested"
    row is just an AI proposal, not yet anything the board has adopted.
    """

    STATUS_CHOICES = [
        ("suggested", "Suggested"),
        ("committed", "Committed"),
        ("completed", "Completed"),
        ("dismissed", "Dismissed"),
    ]

    period = models.ForeignKey(
        FinancialPeriod, on_delete=models.CASCADE, related_name="advisory_goals"
    )
    order = models.PositiveSmallIntegerField()
    title = models.CharField(max_length=200)
    description = models.TextField()
    rationale = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="suggested")
    model_used = models.CharField(max_length=50, blank=True)
    # SHA-256 of the exact figures fed into the prompt (see
    # board/extraction/advisory.py) — lets generate_goals_for_period skip
    # regenerating "suggested" goals when the underlying financial data
    # hasn't changed since the last generation. Same pattern as
    # AIInsight.source_data_hash.
    source_data_hash = models.CharField(max_length=64, blank=True)
    generated_at = models.DateTimeField(auto_now_add=True)
    committed_at = models.DateTimeField(null=True, blank=True)
    committed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ["period__end_date", "order"]

    def __str__(self):
        return f"{self.title} — {self.period.label} ({self.status})"


class FundingRoadmapStep(models.Model):
    """
    An AI-generated phase of the "Funding Readiness Roadmap" (see
    board/extraction/roadmap.py's Strategic Advisory Agent variant) —
    an ordered, time-sequenced narrative toward investor readiness,
    grounded in the same already-validated figures AdvisoryGoal's
    suggestions use.

    Unlike AdvisoryGoal, there's no commit/dismiss workflow and no
    per-step status: these are AI-authored narrative/sequencing, not
    verifiable facts like FundingMilestone, so they stay purely
    advisory (same as the Outlook narrative) rather than presenting an
    inferred "status" as if it were real tracked progress. The whole
    set is replaced wholesale on each regeneration, same as
    NearbyIncubator.
    """

    period = models.ForeignKey(
        FinancialPeriod, on_delete=models.CASCADE, related_name="funding_roadmap_steps"
    )
    order = models.PositiveSmallIntegerField()
    timeframe = models.CharField(max_length=100)
    title = models.CharField(max_length=200)
    description = models.TextField()
    model_used = models.CharField(max_length=50, blank=True)
    # SHA-256 of the exact figures fed into the prompt — same caching
    # pattern as AdvisoryGoal.source_data_hash.
    source_data_hash = models.CharField(max_length=64, blank=True)
    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["period__end_date", "order"]

    def __str__(self):
        return f"{self.timeframe}: {self.title} — {self.period.label}"


class EcosystemChecklistItem(models.Model):
    """
    Tracks the company against fixed Irish startup-ecosystem benchmarks
    (Enterprise Ireland HPSU status, Euronext Market Access, NovaUCD
    engagement — seeded by a data migration, see board/migrations/).
    Not period-scoped: unlike AIInsight/AdvisoryGoal, this is a standing
    company attribute rather than something tied to a specific
    FinancialPeriod's figures, so it isn't nested under PeriodDetailSerializer.
    key/title/description are fixed (read-only from the API) — this is a
    checklist against 3 named benchmarks, not a general-purpose todo list.
    """

    STATUS_CHOICES = [
        ("not_started", "Not Started"),
        ("in_progress", "In Progress"),
        ("complete", "Complete"),
    ]

    key = models.SlugField(max_length=50, unique=True)
    order = models.PositiveSmallIntegerField(default=0)
    title = models.CharField(max_length=200)
    description = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="not_started")
    notes = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ["order"]

    def __str__(self):
        return f"{self.title} ({self.status})"


class ReportSpec(models.Model):
    """
    A configured board report — which sections, for whom, and why (see
    board/extraction/report_pdf.py / report_deck.py / report_narrative.py).
    Reusable/regeneratable rather than a one-shot export: the same spec
    can be re-downloaded as a PDF or a slide deck, and its tailored
    narrative can be regenerated without losing the rest of the config.

    tailored_narrative/narrative_* mirror ExtractionAttempt.verified /
    AdvisoryGoal.commit's human-approval-gate shape: generating narrative
    never auto-approves it, and regenerating resets narrative_approved
    to False — a stale approval on newly-generated text would defeat
    the point of the gate.
    """

    period = models.ForeignKey(
        "FinancialPeriod", on_delete=models.CASCADE, related_name="report_specs"
    )
    title = models.CharField(max_length=200, blank=True)
    audience_label = models.CharField(max_length=200)
    context_note = models.TextField(blank=True)

    include_revenue_growth = models.BooleanField(default=True)
    include_profitability = models.BooleanField(default=True)
    include_cash_liquidity = models.BooleanField(default=True)
    include_solvency_leverage = models.BooleanField(default=True)
    include_returns = models.BooleanField(default=True)
    include_outlook = models.BooleanField(default=True)

    use_tailored_narrative = models.BooleanField(default=False)
    tailored_narrative = models.JSONField(null=True, blank=True)
    narrative_model_used = models.CharField(max_length=50, blank=True)
    narrative_source_hash = models.CharField(max_length=64, blank=True)
    narrative_generated_at = models.DateTimeField(null=True, blank=True)
    narrative_approved = models.BooleanField(default=False)
    narrative_approved_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    narrative_approved_at = models.DateTimeField(null=True, blank=True)

    created_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Section keys in fixed display order, paired with their include_*
    # field name — the one place this mapping is defined, so
    # report_pdf.py/report_deck.py/report_narrative.py all iterate the
    # same list rather than three independently-hand-kept ones.
    SECTION_FIELDS = [
        ("revenue_growth", "include_revenue_growth"),
        ("profitability", "include_profitability"),
        ("cash_liquidity", "include_cash_liquidity"),
        ("solvency_leverage", "include_solvency_leverage"),
        ("returns", "include_returns"),
        ("outlook", "include_outlook"),
    ]

    class Meta:
        ordering = ["-created_at"]

    def included_sections(self) -> list[str]:
        return [key for key, field in self.SECTION_FIELDS if getattr(self, field)]

    def __str__(self):
        return f"{self.title or self.audience_label} — {self.period.label}"


class AllowedGoogleEmail(models.Model):
    """
    Admin-managed allowlist for Google Sign-In (see board/views.py's
    GoogleLoginView). Replaces the GOOGLE_ALLOWED_EMAILS env var so the
    admin can manage it from the app instead of editing Railway config.
    """

    email = models.EmailField(unique=True)
    added_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["email"]

    def __str__(self):
        return self.email


class UserPreferences(models.Model):
    """Per-user notification preferences for published board updates."""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="preferences")
    notify_on_new_insights = models.BooleanField(default=False)
    notify_on_board_alerts = models.BooleanField(default=False)

    def __str__(self):
        return f"Preferences for {self.user.username}"


class BoardAlertSettings(models.Model):
    """Singleton thresholds that turn the board's key risk signals into alerts."""

    cash_runway_enabled = models.BooleanField(default=True)
    cash_runway_months_min = models.DecimalField(max_digits=5, decimal_places=1, default=12)
    ebitda_margin_enabled = models.BooleanField(default=True)
    ebitda_margin_min_pct = models.DecimalField(max_digits=5, decimal_places=1, default=-25)
    admin_expense_ratio_enabled = models.BooleanField(default=True)
    admin_expense_ratio_max_pct = models.DecimalField(max_digits=5, decimal_places=1, default=100)
    current_ratio_enabled = models.BooleanField(default=True)
    current_ratio_min = models.DecimalField(max_digits=4, decimal_places=2, default=1)
    updated_at = models.DateTimeField(auto_now=True)

    @classmethod
    def get_solo(cls) -> "BoardAlertSettings":
        obj, _created = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return "Board alert settings"


class NotificationSettings(models.Model):
    """
    Singleton row (always pk=1) for admin-configured Slack/Teams webhook
    URLs and SMTP settings, set from Settings > Notifications instead
    of requiring env var access on the deployment platform — the same
    role AllowedGoogleEmail plays for GOOGLE_ALLOWED_EMAILS. A blank
    field here falls back to the matching env var (SLACK_WEBHOOK_URL /
    TEAMS_WEBHOOK_URL / EMAIL_BACKEND+friends — see
    board/extraction/notifications.py, teams_notifications.py and
    email_notifications.py), so existing env-var-only deployments keep
    working unchanged.

    smtp_password is a real credential, unlike the webhook URLs, so
    NotificationSettingsSerializer marks it write_only — it's never
    read back over the API once saved, only whether one is set.
    """

    slack_webhook_url = models.URLField(blank=True)
    teams_webhook_url = models.URLField(blank=True)

    smtp_host = models.CharField(max_length=255, blank=True)
    smtp_port = models.PositiveIntegerField(null=True, blank=True)
    smtp_username = models.CharField(max_length=255, blank=True)
    smtp_password = models.CharField(max_length=255, blank=True)
    smtp_use_tls = models.BooleanField(default=True)
    from_email = models.CharField(max_length=255, blank=True)

    # Set via the "Connect Gmail" flow (board/extraction/gmail_oauth.py,
    # views.ConnectGmailView) rather than typed in directly — an admin
    # authorizes Gmail API send access for their own Google account, and
    # notifications get sent through the Gmail API using this refresh
    # token instead of SMTP. Takes precedence over smtp_host when set.
    # gmail_refresh_token is a credential like smtp_password — never
    # read back over the API; gmail_connected_email is just the
    # display label ("Connected as ...") and is safe to return.
    gmail_connected_email = models.CharField(max_length=255, blank=True)
    gmail_refresh_token = models.CharField(max_length=1024, blank=True)

    updated_at = models.DateTimeField(auto_now=True)

    @classmethod
    def get_solo(cls) -> "NotificationSettings":
        obj, _created = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return "Notification settings"


class DriveSettings(models.Model):
    """
    Singleton row (always pk=1) for the Google Drive ingestion folder
    ID and last-sync status, set from Settings > Google Drive instead
    of requiring a --folder-id CLI flag every run — same role
    NotificationSettings/BoardAlertSettings play for their integrations.

    last_sync_status lets the settings panel show "running" across
    polls/reloads while a sync is in progress in a background thread
    (see board/extraction/drive_sync.py) — a real sync can take minutes
    (many sequential Gemini calls, paced to respect rate limits), too
    long to hold open a synchronous request/response.

    connected_email/refresh_token are set via the "Connect Google Drive"
    OAuth flow (board/extraction/gmail_oauth.py's exchange_code_for_tokens,
    reused as-is — it's generic, not Gmail-specific — see
    ConnectDriveView in views.py), same shape as
    NotificationSettings.gmail_connected_email/gmail_refresh_token.
    refresh_token is a credential like that field — never exposed by
    DriveSettingsSerializer. When set, drive_client.py's _get_service()
    prefers it over the service-account file fallback.
    """

    STATUS_CHOICES = [
        ("idle", "Idle"),
        ("running", "Running"),
        ("success", "Success"),
        ("error", "Error"),
    ]

    folder_id = models.CharField(max_length=255, blank=True)
    # Stored at selection time (the folder picker already has the name
    # in hand from the listing it's rendering) rather than looked up
    # live on every Settings load — a live Drive API call on every GET
    # is slow and, worse, would actually hang for minutes if Drive
    # auth is misconfigured (found via a very slow test run).
    folder_name = models.CharField(max_length=255, blank=True)
    connected_email = models.CharField(max_length=255, blank=True)
    refresh_token = models.CharField(max_length=1024, blank=True)
    last_sync_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="idle")
    last_sync_summary = models.TextField(blank=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    @classmethod
    def get_solo(cls) -> "DriveSettings":
        obj, _created = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return "Drive settings"


class IncubatorSettings(models.Model):
    """
    Singleton row (always pk=1) for the Google Places (New) search used
    to populate the "Nearby Startup Incubators" card on /readiness —
    same get_solo() shape as DriveSettings/NotificationSettings.

    Replaces the old manually-entered Ecosystem Checklist on that page:
    the user explicitly wants only real, sourced facts there, not
    self-reported status fields (see board/readiness.py's absence of
    any HPSU/Euronext/NovaUCD proxy — there is no honest one).
    """

    search_location = models.CharField(max_length=255, default="Dublin, Ireland")
    last_refreshed_at = models.DateTimeField(null=True, blank=True)
    last_refresh_error = models.TextField(blank=True)

    @classmethod
    def get_solo(cls) -> "IncubatorSettings":
        obj, _created = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return "Incubator settings"


class NearbyIncubator(models.Model):
    """
    Cache table for Google Places (New) results, wiped and rebuilt
    wholesale on each refresh (see places_client.refresh_nearby_incubators)
    rather than diffed/updated in place — a full text search result set
    naturally supersedes the prior one entirely.
    """

    place_id = models.CharField(max_length=255, unique=True)
    name = models.CharField(max_length=255)
    address = models.CharField(max_length=500, blank=True)
    website = models.URLField(blank=True)
    rating = models.FloatField(null=True, blank=True)
    maps_url = models.URLField(blank=True)

    class Meta:
        ordering = ["-rating", "name"]

    def __str__(self):
        return self.name


class VectorDocumentChunk(models.Model):
    """
    One embedded text snippet from a real source document (prospectus
    footnote, Euronext rulebook page, EI criteria doc) — the vector half
    of the hybrid RAG layer (board/extraction/retrieval.py).

    embedding is a pgvector column (1536-dim, gemini-embedding-001
    truncated via MRL and re-normalized — see extraction/embeddings.py).
    On the SQLite dev database the column stores as text and similarity
    is computed in Python (retrieval._nearest_chunks); the HNSW index
    exists only on Postgres, created by a vendor-guarded migration.

    period is nullable on purpose: a rulebook or listing-criteria
    document isn't tied to any FinancialPeriod, while an annual-report
    footnote is. statement_kind narrows a chunk to one statement the
    same way ExtractionAttempt.statement_kind does — statements are
    OneToOne with period, so no GenericForeignKey is needed.
    """

    period = models.ForeignKey(
        FinancialPeriod, on_delete=models.CASCADE, null=True, blank=True, related_name="document_chunks"
    )
    statement_kind = models.CharField(
        max_length=20, choices=ExtractionAttempt.STATEMENT_CHOICES, blank=True
    )
    source_document = models.CharField(max_length=500)
    page_number = models.PositiveIntegerField(null=True, blank=True)
    chunk_index = models.PositiveIntegerField()
    text = models.TextField()
    embedding = VectorField(dimensions=1536)
    embedding_model = models.CharField(max_length=50, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ["source_document", "chunk_index"]
        ordering = ["source_document", "chunk_index"]

    def __str__(self):
        return f"{self.source_document} [chunk {self.chunk_index}]"


class KnowledgeGraphNode(models.Model):
    """
    An ecosystem entity in the regulatory knowledge graph: a specific
    Euronext rule, an Enterprise Ireland benchmark, a subsidiary, a
    regulator. Curated via Django admin or shell — never fabricated by
    a seed migration, per this project's real-facts-only rule; the
    optional source_chunk FK ties a node back to the actual document
    text it came from, so every graph fact stays traceable to a source.
    """

    NODE_TYPE_CHOICES = [
        ("euronext_rule", "Euronext Rule"),
        ("ei_benchmark", "EI Benchmark"),
        ("subsidiary", "Subsidiary Company"),
        ("regulator", "Regulator"),
        ("requirement", "Requirement"),
        ("other", "Other"),
    ]

    node_type = models.CharField(max_length=30, choices=NODE_TYPE_CHOICES)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    source_chunk = models.ForeignKey(
        VectorDocumentChunk, on_delete=models.SET_NULL, null=True, blank=True, related_name="graph_nodes"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ["node_type", "name"]
        ordering = ["node_type", "name"]

    def __str__(self):
        return f"{self.get_node_type_display()}: {self.name}"


class KnowledgeGraphEdge(models.Model):
    """
    A directed, typed relationship between two graph nodes, e.g.
    (Senus PLC) -[COMPLIES_WITH]-> (Euronext Rule 2.1), with free-form
    metadata for qualifiers (thresholds, effective dates). Traversed
    breadth-first by retrieval.execute_hybrid_rag_query to pull the
    regulatory dependencies around whatever the vector search surfaced.
    """

    EDGE_TYPE_CHOICES = [
        ("COMPLIES_WITH", "Complies with"),
        ("PARENT_OF", "Parent of"),
        ("REQUIRES_AUDIT_YEARS", "Requires audit years"),
        ("REQUIRES", "Requires"),
        ("GOVERNED_BY", "Governed by"),
        ("RELATED_TO", "Related to"),
    ]

    source = models.ForeignKey(KnowledgeGraphNode, on_delete=models.CASCADE, related_name="outgoing_edges")
    target = models.ForeignKey(KnowledgeGraphNode, on_delete=models.CASCADE, related_name="incoming_edges")
    edge_type = models.CharField(max_length=30, choices=EDGE_TYPE_CHOICES)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ["source", "target", "edge_type"]

    def __str__(self):
        return f"{self.source.name} -[{self.edge_type}]-> {self.target.name}"


class BoardQuestion(models.Model):
    """
    Audit log of every "Ask the Data" question and its grounded answer
    (board/extraction/qa.py) — same log-everything philosophy as
    ExtractionAttempt/AIInsight: the board should always be able to see
    what was asked, what the AI answered, and exactly what data grounded
    that answer.

    The snapshot fields copy the retrieval results (chunks, figures,
    graph triples) at answer time rather than FK-ing them, so the log
    stays truthful even after a re-ingestion replaces the vector store
    or the underlying figures change.
    """

    period = models.ForeignKey(FinancialPeriod, on_delete=models.CASCADE, related_name="board_questions")
    asked_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    question = models.TextField()
    answer = models.TextField()
    context_chunks = models.JSONField(default=list, blank=True)
    figures_snapshot = models.JSONField(default=dict, blank=True)
    graph_triples = models.JSONField(default=list, blank=True)
    model_used = models.CharField(max_length=50, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # -id tiebreaker: questions asked in quick succession can share
        # a created_at timestamp, and "newest first" must stay stable.
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"Q: {self.question[:60]} — {self.period.label}"
