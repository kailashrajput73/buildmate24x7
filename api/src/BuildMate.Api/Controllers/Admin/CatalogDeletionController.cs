using BuildMate.Domain.Common;
using BuildMate.Services.Auth;
using BuildMate.Services.Catalog;
using BuildMate.Services.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace BuildMate.Api.Controllers.Admin;

public record AdministratorDeleteRequest(string Password);

[Route("api/admin/catalog-deletion")]
public sealed class CatalogDeletionController : AdminControllerBase
{
    private readonly ICatalogDeletionService _deletions;
    private readonly IAuthService _auth;
    private readonly ICurrentUser _me;

    public CatalogDeletionController(ICatalogDeletionService deletions, IAuthService auth, ICurrentUser me)
    { _deletions = deletions; _auth = auth; _me = me; }

    [HttpGet("{kind}/{id:long}/preview"), Authorize(Policy = Permissions.AdministratorCatalogDelete)]
    public Task<CatalogDeleteImpact> Preview(string kind, long id, CancellationToken ct) => _deletions.PreviewAsync(kind, id, ct);

    [HttpPost("{kind}/{id:long}/delete"), Authorize(Policy = Permissions.AdministratorCatalogDelete), EnableRateLimiting("login")]
    public async Task<IActionResult> Delete(string kind, long id, AdministratorDeleteRequest body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Password) || !await _auth.VerifyAdministratorPasswordAsync(_me.RequireId(), body.Password, ct))
            throw new AppException("Administrator password is incorrect.", 400, "reauthentication_failed");
        await _deletions.DeleteAsync(kind, id, ct);
        return NoContent();
    }
}

[Route("api/admin/empty-catalog-masters")]
[Authorize(Policy = Permissions.CatalogManage)]
public sealed class EmptyCatalogMastersController : AdminControllerBase
{
    private readonly ICatalogDeletionService _deletions;
    public EmptyCatalogMastersController(ICatalogDeletionService deletions) => _deletions = deletions;

    [HttpDelete("{kind}/{id:long}")]
    public async Task<IActionResult> Delete(string kind, long id, CancellationToken ct)
    {
        await _deletions.DeleteEmptyMasterAsync(kind, id, ct);
        return NoContent();
    }
}
