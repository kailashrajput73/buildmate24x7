using BuildMate.Domain.Enums;

namespace BuildMate.Services.Common;

/// <summary>Business rule violation. Translated to an HTTP 4xx ProblemDetails by the API.</summary>
public class AppException : Exception
{
    public int StatusCode { get; }
    public string? Code { get; }
    public AppException(string message, int statusCode = 400, string? code = null) : base(message)
    {
        StatusCode = statusCode;
        Code = code;
    }
}

public class NotFoundException : AppException
{
    public NotFoundException(string what) : base($"{what} not found.", 404, "not_found") { }
}

public class ForbiddenException : AppException
{
    public ForbiddenException(string message = "You don't have access to this.") : base(message, 403, "forbidden") { }
}

/// <summary>The authenticated caller, resolved from the JWT by the API layer.</summary>
public interface ICurrentUser
{
    long? Id { get; }
    string? Name { get; }
    UserType? UserType { get; }
    bool HasPermission(string permission);
    long RequireId();
}

public record PageRequest(int Page = 1, int PageSize = 25)
{
    public int SafePage => Page < 1 ? 1 : Page;
    public int SafeSize => PageSize is < 1 or > 200 ? 25 : PageSize;
    public int Skip => (SafePage - 1) * SafeSize;
}

public record PagedResult<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize);

public static class QueryableExtensions
{
    public static IQueryable<T> Page<T>(this IQueryable<T> q, PageRequest p) => q.Skip(p.Skip).Take(p.SafeSize);
}

public static class Phone
{
    /// <summary>Normalizes "+91 98xxx xxxxx" / "098xxxxxxxx" to a 10-digit Indian mobile number.</summary>
    public static string Normalize(string input)
    {
        var digits = new string((input ?? "").Where(char.IsDigit).ToArray());
        if (digits.Length == 12 && digits.StartsWith("91")) digits = digits[2..];
        if (digits.Length == 11 && digits.StartsWith('0')) digits = digits[1..];
        if (digits.Length != 10 || digits[0] < '6')
            throw new AppException("Enter a valid 10-digit mobile number.");
        return digits;
    }
}

public static class Clock
{
    public static readonly TimeZoneInfo India = ResolveIndia();

    private static TimeZoneInfo ResolveIndia()
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById("Asia/Kolkata"); }
        catch { return TimeZoneInfo.FindSystemTimeZoneById("India Standard Time"); }
    }

    public static DateTime ToIst(DateTime utc) => TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), India);
    public static DateTime TodayIst => ToIst(DateTime.UtcNow).Date;
    /// <summary>UTC instant at which the given IST calendar date begins.</summary>
    public static DateTime IstDateStartUtc(DateTime istDate) =>
        TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(istDate.Date, DateTimeKind.Unspecified), India);

    /// <summary>Financial year as printed on invoices, e.g. "26-27" for Apr 2026 – Mar 2027.</summary>
    public static string FinancialYearLabel(DateTime istDate) => FinancialYear(istDate).Insert(2, "-");

    /// <summary>Indian financial year label, e.g. "2627" for Apr 2026 – Mar 2027.</summary>
    public static string FinancialYear(DateTime istDate)
    {
        var start = istDate.Month >= 4 ? istDate.Year : istDate.Year - 1;
        return $"{start % 100:D2}{(start + 1) % 100:D2}";
    }
}
