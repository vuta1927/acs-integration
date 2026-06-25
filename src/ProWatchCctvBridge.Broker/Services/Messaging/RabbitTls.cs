using System.Net.Security;
using System.Security.Authentication;
using System.Security.Cryptography.X509Certificates;
using ProWatchCctvBridge.Broker.Configuration;
using RabbitMQ.Client;

namespace ProWatchCctvBridge.Broker.Services.Messaging;

/// <summary>Builds the RabbitMQ <see cref="SslOption"/> (TLS 1.3 AMQPS) from configuration.</summary>
public static class RabbitTls
{
    public static SslOption Build(RabbitMqOptions opt)
    {
        var ssl = new SslOption
        {
            Enabled = true,
            ServerName = string.IsNullOrWhiteSpace(opt.ServerName) ? opt.HostName : opt.ServerName,
            Version = ParseVersion(opt.TlsVersion),
        };

        // Client certificate for mutual TLS (optional).
        if (!string.IsNullOrWhiteSpace(opt.ClientCertPath))
        {
            var clientCert = X509CertificateLoader.LoadPkcs12FromFile(opt.ClientCertPath, opt.ClientCertPassword);
            ssl.Certs = new X509CertificateCollection { clientCert };
        }

        if (opt.AllowUntrustedRoot)
        {
            // TEST ONLY: accept self-signed server cert / name mismatch.
            ssl.AcceptablePolicyErrors =
                SslPolicyErrors.RemoteCertificateChainErrors | SslPolicyErrors.RemoteCertificateNameMismatch;
        }
        else if (!string.IsNullOrWhiteSpace(opt.CaCertPath))
        {
            // Validate the server cert against a specific (self-signed) CA via custom trust.
            var caPath = opt.CaCertPath!;
            ssl.CertificateValidationCallback = (object _, X509Certificate? cert, X509Chain? _, SslPolicyErrors errors) =>
            {
                if (errors == SslPolicyErrors.None) return true;
                if (cert is null) return false;
                // Still enforce hostname + presence; only tolerate an untrusted-root chain error,
                // which the custom CA below resolves. (Prevents MITM with a CA-signed cert for another host.)
                if (errors.HasFlag(SslPolicyErrors.RemoteCertificateNameMismatch)) return false;
                if (errors.HasFlag(SslPolicyErrors.RemoteCertificateNotAvailable)) return false;
                using var ca = X509Certificate2.CreateFromPemFile(caPath);
                using var chain = new X509Chain();
                chain.ChainPolicy.TrustMode = X509ChainTrustMode.CustomRootTrust;
                chain.ChainPolicy.RevocationMode = X509RevocationMode.NoCheck;
                chain.ChainPolicy.CustomTrustStore.Add(ca);
                using var leaf = new X509Certificate2(cert);
                return chain.Build(leaf);
            };
        }

        return ssl;
    }

    // Maps the configured TLS version to an SslProtocols flag set.
    // NOTE: pinning Tls13 *alone* throws PlatformNotSupportedException on platforms whose SslStream
    // backend cannot negotiate TLS 1.3 in isolation (e.g. macOS SecureTransport). So "Tls13" allows
    // 1.2 as a fallback — against a 1.3-only broker the handshake still negotiates 1.3.
    // Any other/blank value defers to the OS default (SslProtocols.None), which picks the best shared version.
    private static SslProtocols ParseVersion(string version) => version?.Trim().ToLowerInvariant() switch
    {
        "tls12" => SslProtocols.Tls12,
        "tls13" => SslProtocols.Tls13 | SslProtocols.Tls12,
        _ => SslProtocols.None,
    };
}
