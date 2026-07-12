from django.contrib import admin
from django.contrib import admin
from django.utils.html import format_html

from .extraction.pipeline import promote_attempt

from board.models import *

admin.site.register(FinancialPeriod)
admin.site.register(PLStatement)
admin.site.register(BalanceSheet)
admin.site.register(CashFlow)
admin.site.register(BusinessMetrics)
admin.site.register(AIInsight)
admin.site.register(AllowedGoogleEmail)
admin.site.register(UserPreferences)

 
@admin.register(ExtractionAttempt)
class ExtractionAttemptAdmin(admin.ModelAdmin):
    list_display = [
        "period",
        "statement_kind",
        "status",
        "match_rate_display",
        "verified",
        "created_at",
    ]
    list_filter = ["statement_kind", "status", "verified", "period"]
    readonly_fields = [
        "period",
        "statement_kind",
        "source_document",
        "model_used",
        "raw_response",
        "status",
        "error_message",
        "cross_check_results",
        "match_rate_pct",
        "created_at",
    ]
    actions = ["promote_selected"]
 
    def match_rate_display(self, obj):
        if obj.match_rate_pct is None:
            return "—"
        color = "green" if obj.match_rate_pct >= 95 else "orange" if obj.match_rate_pct >= 80 else "red"
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}%</span>',
            color, obj.match_rate_pct,
        )
    match_rate_display.short_description = "Match Rate"
 
    @admin.action(description="Mark verified and promote selected attempts to live data")
    def promote_selected(self, request, queryset):
        promoted, skipped = 0, 0
        for attempt in queryset:
            if attempt.status not in ("cross_check_pass", "schema_valid"):
                skipped += 1
                continue
            attempt.verified = True
            attempt.save()
            try:
                promote_attempt(attempt)
                promoted += 1
            except Exception as exc:  # noqa: BLE001
                self.message_user(request, f"Failed to promote {attempt}: {exc}", level="error")
                skipped += 1
 
        self.message_user(
            request,
            f"Promoted {promoted} attempt(s) to live data. Skipped {skipped} "
            f"(not schema_valid/cross_check_pass, or failed on promotion)."
        )