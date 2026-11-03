using System.Security.Cryptography;
using System.Text;
using BuildMate.Services.Common;
using Microsoft.Extensions.Configuration;

namespace BuildMate.Services.Payments;

/// <summary>Encrypts Cashfree credential versions with a deployment supplied, rotatable AES-256 key ring.</summary>
public sealed class PaymentSecrets(IConfiguration configuration)
{
    public string Encrypt(string plaintext, string binding)
    {
        var keyId = configuration["PaymentEncryption:ActiveKeyId"];
        if (string.IsNullOrWhiteSpace(keyId)) throw Unavailable();
        var key = ReadKey(keyId);
        var nonce = RandomNumberGenerator.GetBytes(12);
        var tag = new byte[16];
        var data = Encoding.UTF8.GetBytes(plaintext);
        var cipher = new byte[data.Length];
        using (var aes = new AesGcm(key, tag.Length))
            aes.Encrypt(nonce, data, cipher, tag, Encoding.UTF8.GetBytes(binding));
        return $"{keyId}.{Convert.ToBase64String(nonce)}.{Convert.ToBase64String(tag)}.{Convert.ToBase64String(cipher)}";
    }

    public string Decrypt(string encrypted, string binding)
    {
        try
        {
            var parts = encrypted.Split('.');
            if (parts.Length != 4) throw new FormatException();
            var key = ReadKey(parts[0]);
            var nonce = Convert.FromBase64String(parts[1]);
            var tag = Convert.FromBase64String(parts[2]);
            var cipher = Convert.FromBase64String(parts[3]);
            var plain = new byte[cipher.Length];
            using (var aes = new AesGcm(key, tag.Length))
                aes.Decrypt(nonce, cipher, tag, plain, Encoding.UTF8.GetBytes(binding));
            return Encoding.UTF8.GetString(plain);
        }
        catch (AppException) { throw; }
        catch (Exception ex) when (ex is FormatException or CryptographicException or ArgumentException)
        { throw Unavailable(); }
    }

    private byte[] ReadKey(string id)
    {
        var encoded = configuration[$"PaymentEncryption:Keys:{id}"];
        try
        {
            var key = Convert.FromBase64String(encoded ?? "");
            if (key.Length != 32) throw new FormatException();
            return key;
        }
        catch (FormatException) { throw Unavailable(); }
    }

    private static AppException Unavailable() => new("Payment credential encryption is unavailable. Configure the server encryption key ring.", 503, "payment_encryption_unavailable");
}
