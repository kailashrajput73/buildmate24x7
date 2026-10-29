using BuildMate.Data;
using BuildMate.Domain.Entities;
using BuildMate.Services.Common;
using Microsoft.EntityFrameworkCore;

namespace BuildMate.Services.Inventory;

public record RackUpsert(string Code, string? Name, int Rows, int Columns, bool IsActive);
public record RackDto(long Id, string Code, string? Name, int Rows, int Columns, bool IsActive, int LocationCount, int OccupiedCount);
public record RackLocationDto(long Id, string Label, int RowNo, int ColumnNo, List<RackProductDto> Products);
public record RackProductDto(long ProductId, string Code, string Name, decimal Quantity);
public record RackLocationRef(long Id, string Label);

public interface IRackService
{
    Task<List<RackDto>> ListAsync(CancellationToken ct = default);
    Task<RackDto> SaveAsync(long? id, RackUpsert dto, CancellationToken ct = default);
    Task<List<RackLocationDto>> LocationsAsync(long rackId, CancellationToken ct = default);
    Task<List<RackLocationRef>> AllLocationsAsync(CancellationToken ct = default);
    Task<List<RackLocationDto>> FindProductAsync(string search, CancellationToken ct = default);
}

public class RackService : IRackService
{
    private readonly AppDbContext _db;
    private readonly ICurrentUser _me;

    public RackService(AppDbContext db, ICurrentUser me)
    {
        _db = db;
        _me = me;
    }

    public Task<List<RackDto>> ListAsync(CancellationToken ct = default) =>
        _db.Racks.AsNoTracking().OrderBy(r => r.Code)
            .Select(r => new RackDto(r.Id, r.Code, r.Name, r.Rows, r.Columns, r.IsActive, r.Locations.Count,
                r.Locations.Count(l => l.Products.Any(p => p.Quantity > 0))))
            .ToListAsync(ct);

    /// <summary>
    /// Creates or resizes a rack. Locations are generated as {rack}-{row letter}{column}:
    /// rack "R1" with 3 rows x 4 columns gives R1-A1 … R1-A4, R1-B1 … R1-C4.
    /// </summary>
    public async Task<RackDto> SaveAsync(long? id, RackUpsert dto, CancellationToken ct = default)
    {
        var code = (dto.Code ?? "").Trim().ToUpperInvariant();
        if (code.Length is 0 or > 6 || !code.All(char.IsLetterOrDigit)) throw new AppException("Rack code must be 1–6 letters or digits, e.g. A or R12.");
        if (dto.Rows is < 1 or > 50 || dto.Columns is < 1 or > 50) throw new AppException("Rows and columns must be between 1 and 50.");
        if (await _db.Racks.AnyAsync(r => r.Code == code && r.Id != (id ?? 0), ct)) throw new AppException($"Rack {code} already exists.", 409, "duplicate");

        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        var rack = id == null ? new Rack { CreatedById = _me.Id }
            : await _db.Racks.Include(r => r.Locations).ThenInclude(l => l.Products).FirstOrDefaultAsync(r => r.Id == id, ct)
              ?? throw new NotFoundException("Rack");

        if (id != null && rack.Code != code && rack.Locations.Any(l => l.Products.Any()))
            throw new AppException("Can't rename a rack that already holds stock — labels are printed on shelves.");

        rack.Code = code;
        rack.Name = dto.Name?.Trim();
        rack.Rows = dto.Rows;
        rack.Columns = dto.Columns;
        rack.IsActive = dto.IsActive;
        rack.UpdatedById = _me.Id;
        if (id == null) _db.Racks.Add(rack);

        // Build the desired grid and reconcile.
        var desired = new List<(int Row, int Col, string Label)>();
        for (var r = 1; r <= dto.Rows; r++)
            for (var c = 1; c <= dto.Columns; c++)
                desired.Add((r, c, $"{code}-{RowLetter(r)}{c}"));

        foreach (var loc in rack.Locations.ToList())
        {
            var match = desired.FirstOrDefault(d => d.Row == loc.RowNo && d.Col == loc.ColumnNo);
            if (match.Label == null)
            {
                if (loc.Products.Any(p => p.Quantity > 0))
                    throw new AppException($"Location {loc.Label} still holds stock. Move it before shrinking the rack.");
                _db.RackLocations.Remove(loc);
            }
            else loc.Label = match.Label;
        }
        foreach (var d in desired.Where(d => !rack.Locations.Any(l => l.RowNo == d.Row && l.ColumnNo == d.Col)))
            rack.Locations.Add(new RackLocation { RowNo = d.Row, ColumnNo = d.Col, Label = d.Label });

        await _db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return (await ListAsync(ct)).First(r => r.Id == rack.Id);
    }

    /// <summary>1 → A, 26 → Z, 27 → AA.</summary>
    private static string RowLetter(int n)
    {
        var s = "";
        while (n > 0) { n--; s = (char)('A' + n % 26) + s; n /= 26; }
        return s;
    }

    public Task<List<RackLocationDto>> LocationsAsync(long rackId, CancellationToken ct = default) =>
        _db.RackLocations.AsNoTracking().Where(l => l.RackId == rackId).OrderBy(l => l.RowNo).ThenBy(l => l.ColumnNo)
            .Select(l => new RackLocationDto(l.Id, l.Label, l.RowNo, l.ColumnNo,
                l.Products.Where(p => p.Quantity > 0).Select(p => new RackProductDto(p.ProductId, p.Product.Code, p.Product.Name, p.Quantity)).ToList()))
            .ToListAsync(ct);

    public Task<List<RackLocationRef>> AllLocationsAsync(CancellationToken ct = default) =>
        _db.RackLocations.AsNoTracking().Where(l => l.Rack.IsActive).OrderBy(l => l.Rack.Code).ThenBy(l => l.RowNo).ThenBy(l => l.ColumnNo)
            .Select(l => new RackLocationRef(l.Id, l.Label)).ToListAsync(ct);

    public Task<List<RackLocationDto>> FindProductAsync(string search, CancellationToken ct = default)
    {
        var s = $"%{(search ?? "").Trim()}%";
        return _db.RackLocations.AsNoTracking()
            .Where(l => l.Products.Any(p => p.Quantity > 0 && (EF.Functions.ILike(p.Product.Name, s) || EF.Functions.ILike(p.Product.Code, s))))
            .OrderBy(l => l.Label)
            .Select(l => new RackLocationDto(l.Id, l.Label, l.RowNo, l.ColumnNo,
                l.Products.Where(p => p.Quantity > 0 && (EF.Functions.ILike(p.Product.Name, s) || EF.Functions.ILike(p.Product.Code, s)))
                    .Select(p => new RackProductDto(p.ProductId, p.Product.Code, p.Product.Name, p.Quantity)).ToList()))
            .Take(50).ToListAsync(ct);
    }
}
