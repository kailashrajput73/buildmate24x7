using QRCoder;

namespace BuildMate.Services.Catalog;

public interface IQrService
{
    /// <summary>PNG QR code. Product QR codes encode the product code (e.g. BM000123) so any scanner app can read them.</summary>
    byte[] Png(string content, int pixelsPerModule = 10);
}

public class QrService : IQrService
{
    public byte[] Png(string content, int pixelsPerModule = 10)
    {
        using var gen = new QRCodeGenerator();
        using var data = gen.CreateQrCode(content, QRCodeGenerator.ECCLevel.Q);
        return new PngByteQRCode(data).GetGraphic(Math.Clamp(pixelsPerModule, 2, 40));
    }
}
