namespace ProWatchCctvBridge.Broker.Configuration;

/// <summary>
/// RabbitMQ publisher settings for forwarding mapped CCTV commands over AMQPS (TLS).
/// Defaults target the AMQPS port 5671 with TLS 1.3.
/// </summary>
public sealed class RabbitMqOptions
{
    public bool Enabled { get; set; } = true;

    public string HostName { get; set; } = "localhost";

    /// <summary>AMQPS port (TLS). Plain AMQP is 5672; AMQPS is 5671.</summary>
    public int Port { get; set; } = 5671;

    public string VirtualHost { get; set; } = "/";
    public string UserName { get; set; } = "guest";
    public string Password { get; set; } = "guest";

    // --- TLS ---
    public bool UseTls { get; set; } = true;

    /// <summary>Tls13 | Tls12. Maps to System.Security.Authentication.SslProtocols.</summary>
    public string TlsVersion { get; set; } = "Tls13";

    /// <summary>Expected server certificate CN/SAN. Defaults to HostName when empty.</summary>
    public string? ServerName { get; set; }

    /// <summary>PEM CA certificate to trust (for a self-signed test CA).</summary>
    public string? CaCertPath { get; set; }

    /// <summary>PKCS#12 (.pfx) client certificate for mutual TLS.</summary>
    public string? ClientCertPath { get; set; }
    public string? ClientCertPassword { get; set; }

    /// <summary>Accept self-signed / chain errors (TEST ONLY).</summary>
    public bool AllowUntrustedRoot { get; set; }

    // --- Routing ---
    public string Exchange { get; set; } = "cctv.events";
    public string ExchangeType { get; set; } = "topic";
    /// <summary>The single routing key used for ALL CCTV messages.</summary>
    public string DefaultRoutingKey { get; set; } = "cctv.sacs.queue";
}
