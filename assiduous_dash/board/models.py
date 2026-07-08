from django.db import models

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
