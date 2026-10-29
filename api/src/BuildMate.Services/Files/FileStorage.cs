using Amazon.S3;
using Amazon.S3.Model;
using BuildMate.Services.Common;
using Microsoft.Extensions.Options;

namespace BuildMate.Services.Files;

public class StorageOptions
{
    /// <summary>"Local" (VPS / dev) or "S3" (AWS).</summary>
    public string Provider { get; set; } = "Local";
    public string LocalRoot { get; set; } = "storage";
    /// <summary>Public URL prefix for public files, e.g. https://api.buildmate24x7.in/files</summary>
    public string PublicBaseUrl { get; set; } = "/files";
    public string? S3Bucket { get; set; }
    public string? S3Region { get; set; } = "ap-south-1";
    /// <summary>Optional CDN / CloudFront base for public objects.</summary>
    public string? S3PublicBaseUrl { get; set; }
    public long MaxUploadBytes { get; set; } = 8 * 1024 * 1024;
}

public interface IFileStorage
{
    /// <summary>Stores a file and returns its key. Private files (KYC) are never publicly addressable.</summary>
    Task<string> SaveAsync(Stream content, string fileName, string contentType, string folder, bool isPrivate, CancellationToken ct = default);
    string PublicUrl(string key);
    Task<(Stream Stream, string ContentType)> OpenAsync(string key, CancellationToken ct = default);
}

public static class UploadRules
{
    private static readonly Dictionary<string, string> Allowed = new(StringComparer.OrdinalIgnoreCase)
    {
        [".jpg"] = "image/jpeg", [".jpeg"] = "image/jpeg", [".png"] = "image/png",
        [".webp"] = "image/webp", [".pdf"] = "application/pdf"
    };

    public static string Validate(string fileName, long length, long max)
    {
        var ext = Path.GetExtension(fileName);
        if (!Allowed.TryGetValue(ext, out var type)) throw new AppException("Only JPG, PNG, WEBP or PDF files are allowed.");
        if (length <= 0 || length > max) throw new AppException($"File must be smaller than {max / 1024 / 1024} MB.");
        return type;
    }

    public static string NewKey(string folder, string fileName, bool isPrivate) =>
        $"{(isPrivate ? "private" : "public")}/{folder.Trim('/')}/{DateTime.UtcNow:yyyy/MM}/{Guid.NewGuid():N}{Path.GetExtension(fileName).ToLowerInvariant()}";

    public static string ContentTypeFor(string key) =>
        Allowed.TryGetValue(Path.GetExtension(key), out var t) ? t : "application/octet-stream";
}

public class LocalFileStorage : IFileStorage
{
    private readonly StorageOptions _opt;
    public LocalFileStorage(IOptions<StorageOptions> opt) => _opt = opt.Value;

    public async Task<string> SaveAsync(Stream content, string fileName, string contentType, string folder, bool isPrivate, CancellationToken ct = default)
    {
        var key = UploadRules.NewKey(folder, fileName, isPrivate);
        var path = FullPath(key);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        await using var fs = File.Create(path);
        await content.CopyToAsync(fs, ct);
        return key;
    }

    public string PublicUrl(string key) =>
        key.StartsWith("public/") ? $"{_opt.PublicBaseUrl.TrimEnd('/')}/{key["public/".Length..]}" : throw new AppException("File is private.");

    public Task<(Stream, string)> OpenAsync(string key, CancellationToken ct = default)
    {
        var path = FullPath(key);
        if (!File.Exists(path)) throw new NotFoundException("File");
        return Task.FromResult<(Stream, string)>((File.OpenRead(path), UploadRules.ContentTypeFor(key)));
    }

    private string FullPath(string key)
    {
        var root = Path.GetFullPath(_opt.LocalRoot);
        var full = Path.GetFullPath(Path.Combine(root, key));
        if (!full.StartsWith(root, StringComparison.Ordinal)) throw new AppException("Invalid file key.");
        return full;
    }
}

public class S3FileStorage : IFileStorage
{
    private readonly StorageOptions _opt;
    private readonly IAmazonS3 _s3;

    public S3FileStorage(IOptions<StorageOptions> opt, IAmazonS3 s3)
    {
        _opt = opt.Value;
        _s3 = s3;
    }

    public async Task<string> SaveAsync(Stream content, string fileName, string contentType, string folder, bool isPrivate, CancellationToken ct = default)
    {
        var key = UploadRules.NewKey(folder, fileName, isPrivate);
        await _s3.PutObjectAsync(new PutObjectRequest
        {
            BucketName = _opt.S3Bucket,
            Key = key,
            InputStream = content,
            ContentType = contentType,
            ServerSideEncryptionMethod = ServerSideEncryptionMethod.AES256
        }, ct);
        return key;
    }

    public string PublicUrl(string key)
    {
        if (!key.StartsWith("public/")) throw new AppException("File is private.");
        var baseUrl = _opt.S3PublicBaseUrl ?? $"https://{_opt.S3Bucket}.s3.{_opt.S3Region}.amazonaws.com";
        return $"{baseUrl.TrimEnd('/')}/{key}";
    }

    public async Task<(Stream, string)> OpenAsync(string key, CancellationToken ct = default)
    {
        var obj = await _s3.GetObjectAsync(_opt.S3Bucket!, key, ct);
        return (obj.ResponseStream, obj.Headers.ContentType ?? UploadRules.ContentTypeFor(key));
    }
}
