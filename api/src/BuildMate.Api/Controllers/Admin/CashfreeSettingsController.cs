using BuildMate.Domain.Common;
using BuildMate.Services.Payments;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BuildMate.Api.Controllers.Admin;

[Route("api/admin/settings/cashfree")]
[Authorize(Policy = Permissions.SettingsManage)]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class CashfreeSettingsController(CashfreeSettingsService settings) : AdminControllerBase
{
    [HttpGet]
    public Task<CashfreeSettingsStatus> Get(CancellationToken ct) => settings.GetAsync(ct);

    [HttpPut, RequestSizeLimit(8192)]
    public Task<CashfreeSettingsStatus> Save(SaveCashfreeSettings request, CancellationToken ct) => settings.SaveAsync(request, ct);

    [HttpGet("audit")]
    public Task<IReadOnlyList<CashfreeAudit>> Audit(CancellationToken ct) => settings.AuditAsync(ct);
}
