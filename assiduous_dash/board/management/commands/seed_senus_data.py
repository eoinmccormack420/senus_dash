"""
Management command to seed the database with Senus PLC financial data,
extracted from the FY2024/FY2025 annual reports and the HY2026 half-year
results (source: app.assiduous.tech/investor-relations/senus).

Usage:
        python manage.py seed_senus_data
"""

from django.core.management.base import BaseCommand
from django.db import transaction

# Adjust this import to match your app name, e.g.:
# from boardroom.models import (...)
from board.models import (
    FinancialPeriod,
    PLStatement,
    BalanceSheet,
    CashFlow,
    BusinessMetrics,
)


class Command(BaseCommand):
    help = "Seeds Senus PLC financial data (FY2024, FY2025, HY2025, HY2026)"

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write("Clearing existing seeded periods...")
        FinancialPeriod.objects.filter(
            label__in=["FY2024", "FY2025", "HY2025", "HY2026"]
        ).delete()

        periods = self._create_periods()
        self._create_pl_statements(periods)
        self._create_balance_sheets(periods)
        self._create_cash_flows(periods)
        self._create_business_metrics(periods)

        self.stdout.write(self.style.SUCCESS("Senus data seeded successfully."))

    # ------------------------------------------------------------------
    def _create_periods(self):
        self.stdout.write("Creating financial periods...")

        periods = {
            "FY2024": FinancialPeriod.objects.create(
                label="FY2024",
                period_type="annual",
                start_date="2023-07-01",
                end_date="2024-06-30",
                is_audited=True,
            ),
            "FY2025": FinancialPeriod.objects.create(
                label="FY2025",
                period_type="annual",
                start_date="2024-07-01",
                end_date="2025-06-30",
                is_audited=True,
            ),
            "HY2025": FinancialPeriod.objects.create(
                label="HY2025",
                period_type="half_year",
                start_date="2024-07-01",
                end_date="2024-12-31",
                is_audited=False,
            ),
            "HY2026": FinancialPeriod.objects.create(
                label="HY2026",
                period_type="half_year",
                start_date="2025-07-01",
                end_date="2025-12-31",
                is_audited=False,
                notes="Includes Loamin acquisition (goodwill €669,500; "
                "contingent consideration €850,000). Listing on Euronext "
                "Access completed Dec 2025.",
            ),
        }
        return periods

    # ------------------------------------------------------------------
    def _create_pl_statements(self, periods):
        self.stdout.write("Creating P&L statements...")

        # tax_expense left at 0 and loss_before_tax == loss_after_tax
        # since the source documents don't break out a separate tax line —
        # net loss for period was reported as a single figure.
        PLStatement.objects.create(
            period=periods["FY2024"],
            revenue=688317.00,
            cost_of_sales=255840.00,
            admin_expenses=1560853.00,
            gross_profit=432477.00,
            operating_loss=-1130729.00,
            loss_before_tax=-1098095.00,
            loss_after_tax=-1098095.00,
        )

        PLStatement.objects.create(
            period=periods["FY2025"],
            revenue=836991.00,
            cost_of_sales=188541.00,
            admin_expenses=1286058.00,
            gross_profit=648450.00,
            operating_loss=-633694.00,
            loss_before_tax=-590256.00,
            loss_after_tax=-590256.00,
        )

        PLStatement.objects.create(
            period=periods["HY2025"],
            revenue=340931.00,
            cost_of_sales=69600.00,
            admin_expenses=677908.00,
            gross_profit=272331.00,
            operating_loss=-405577.00,
            loss_before_tax=-406613.00,
            loss_after_tax=-406613.00,
        )

        PLStatement.objects.create(
            period=periods["HY2026"],
            revenue=354813.00,
            cost_of_sales=64861.00,
            admin_expenses=781975.00,
            gross_profit=289952.00,
            operating_loss=-483753.00,
            loss_before_tax=-485144.00,
            loss_after_tax=-485144.00,
            other_operating_income=8269.00,
            interest_expense=1391.00,
        )

    # ------------------------------------------------------------------
    def _create_balance_sheets(self, periods):
        self.stdout.write("Creating balance sheets (FY2024, FY2025, HY2026 only)...")

        # FY2024 — as at 30 Jun 2024
        # Total assets 639,369 = fixed assets (derived 40,000) + debtors + cash
        BalanceSheet.objects.create(
            period=periods["FY2024"],
            goodwill=0,
            development_costs=0,
            tangible_assets=40000.00,
            debtors=174730.00,
            cash=424639.00,
            current_creditors=-90078.00,
            contingent_consideration=0,
            long_term_debt=0,
            share_capital=0,
            share_premium=0,
            retained_earnings=574681.00,  # residual = reported net assets
        )

        # FY2025 — as at 30 Jun 2025
        # Total assets 311,923 = fixed assets (derived 48,785) + debtors + cash
        BalanceSheet.objects.create(
            period=periods["FY2025"],
            goodwill=0,
            development_costs=0,
            tangible_assets=48785.00,
            debtors=123003.00,
            cash=140135.00,
            current_creditors=-243846.00,
            contingent_consideration=0,
            long_term_debt=-83655.00,
            share_capital=0,
            share_premium=0,
            retained_earnings=-15575.00,  # residual = reported net assets (deficit)
        )

        # HY2026 — as at 31 Dec 2025
        # Total assets 1,874,660. Loamin goodwill 669,500 known explicitly;
        # remaining fixed assets (tangible + dev costs) derived as residual.
        BalanceSheet.objects.create(
            period=periods["HY2026"],
            goodwill=669550.00,          # was 669500 — rounding fix
            development_costs=239765.00,  # was 0 (placeholder)
            tangible_assets=42006.00,     # was 281822 (wrong residual guess)
            debtors=188149.00,
            cash=735189.00,
            current_creditors=-387105.00,
            contingent_consideration=-850000.00,
            long_term_debt=-76474.00,
            share_capital=25000.00,
            share_premium=300000.00,      # was 0 (placeholder)
            retained_earnings=236081.00,  # was 561081 — that was actually total net assets, not retained earnings alone
)

    # ------------------------------------------------------------------
    def _create_cash_flows(self, periods):
        self.stdout.write("Creating cash flow statements...")

        # net_investing_cash derived as:
        #   net_cash_movement - net_operating_cash - net_financing_cash
        CashFlow.objects.create(
            period=periods["FY2024"],
            net_operating_cash=-1166697.00,
            net_investing_cash=-33472.00,
            net_financing_cash=-3846.00,
            net_cash_movement=-1204015.00,
            opening_cash=1628654.00,
            closing_cash=424639.00,
        )

        CashFlow.objects.create(
            period=periods["FY2025"],
            net_operating_cash=-374820.00,
            net_investing_cash=-3451.00,
            net_financing_cash=93767.00,
            net_cash_movement=-284504.00,
            opening_cash=424639.00,
            closing_cash=140135.00,
        )

        CashFlow.objects.create(
            period=periods["HY2025"],
            net_operating_cash=-450181.00,
            net_investing_cash=0.00,
            net_financing_cash=97924.00,
            net_cash_movement=-352257.00,
            opening_cash=424639.00,
            closing_cash=72382.00,
        )

        CashFlow.objects.create(
            period=periods["HY2026"],
            net_operating_cash=-410291.00,
            depreciation=10014.00,              # was 0 (default)
            working_capital_movement=64839.00,  # was 0 (default)
            net_investing_cash=-8500.00,
            net_financing_cash=1013846.00,
            equity_raised=1138683.00,           # was 1013846 (wrong proxy)
            loans_net=-124837.00,               # was 0 (default)
            net_cash_movement=595055.00,
            opening_cash=140135.00,
            closing_cash=735189.00,             # was 735190, off-by-1 rounding fix
        )

    # ------------------------------------------------------------------
    def _create_business_metrics(self, periods):
        self.stdout.write("Creating business metrics...")

        # Customer/ACV/employee figures are only available for FY2025
        # (from the corporate presentation), not per-period.
        BusinessMetrics.objects.create(
            period=periods["FY2025"],
            total_customers=138,
            enterprise_customers=36,
            acv_soil_per_enterprise=12309.00,
            acv_era_per_enterprise=58900.00,
            revenue_ireland_pct=78.0,
            employees=18,
        )

        # Market cap at listing (Dec 2025) belongs against HY2026.
        BusinessMetrics.objects.create(
            period=periods["HY2026"],
            market_cap=13130000.00,
        )