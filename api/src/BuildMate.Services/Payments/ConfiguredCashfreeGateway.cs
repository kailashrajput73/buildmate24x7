namespace BuildMate.Services.Payments;

/// <summary>Routes each operation through the immutable configuration bound to that payment attempt.</summary>
public sealed class ConfiguredCashfreeGateway(CashfreeSettingsService settings) : IPaymentGateway
{
    public async Task<GatewayOrderResult> CreateOrderAsync(GatewayOrderRequest req, CancellationToken ct = default)
    {
        var options = await settings.BindAsync(req.GatewayOrderId, ct);
        return await settings.Gateway(options).CreateOrderAsync(req, ct);
    }
    public async Task<string> EnvironmentAsync(string orderId, CancellationToken ct = default) => (await settings.ResolveAsync(orderId, ct)).Environment;
    public async Task<GatewayStatus> GetStatusAsync(string orderId, CancellationToken ct = default) =>
        await settings.Gateway(await settings.ResolveAsync(orderId, ct)).GetStatusAsync(orderId, ct);
    public async Task<string> RefundAsync(string orderId, decimal amount, string refundId, string note, CancellationToken ct = default) =>
        await settings.Gateway(await settings.ResolveAsync(orderId, ct)).RefundAsync(orderId, amount, refundId, note, ct);
    public async Task<bool> VerifyWebhookAsync(string rawBody, string? signature, string? timestamp, CancellationToken ct = default)
    {
        var orderId = ExtractOrderIdFromWebhook(rawBody);
        if (orderId == null) return false;
        return await settings.Gateway(await settings.ResolveAsync(orderId, ct)).VerifyWebhookAsync(rawBody, signature, timestamp, ct);
    }
    public async Task<(bool Ok, string Message)> TestConnectionAsync(CancellationToken ct = default) =>
        await settings.Gateway(await settings.ResolveAsync(null, ct)).TestConnectionAsync(ct);
    public string? ExtractOrderIdFromWebhook(string rawBody)
    {
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(rawBody);
            return doc.RootElement.GetProperty("data").GetProperty("order").GetProperty("order_id").GetString();
        }
        catch (Exception e) when (e is System.Text.Json.JsonException or KeyNotFoundException or InvalidOperationException) { return null; }
    }
}
