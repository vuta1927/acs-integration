namespace ProWatchCctvBridge.Broker.Dtos;

public record ProWatchConfigDto(
    string BaseUrl,
    string HubPath,
    string? AccessToken,
    bool AccessTokenSet,
    string? UserName,
    string? WorkstationName,
    bool AutoConnect,
    int ReconnectSeconds);

public record RabbitConfigDto(
    bool Enabled,
    string HostName,
    int Port,
    string VirtualHost,
    string UserName,
    string? Password,
    bool PasswordSet,
    bool UseTls,
    string TlsVersion,
    string? ServerName,
    string? CaCertPath,
    string? ClientCertPath,
    string? ClientCertPassword,
    bool ClientCertPasswordSet,
    bool AllowUntrustedRoot,
    string Exchange,
    string ExchangeType,
    string DefaultRoutingKey);

public record TestResultDto(bool Success, string? Error);
