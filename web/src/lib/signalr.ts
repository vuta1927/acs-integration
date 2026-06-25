import * as signalR from '@microsoft/signalr'

// Singleton hub connection — created once, shared via useBridgeHub hook.
let connection: signalR.HubConnection | null = null

export function getConnection(): signalR.HubConnection {
  if (!connection) {
    connection = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/bridge')
      .withAutomaticReconnect([0, 1000, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build()
  }
  return connection
}

export type HubConnectionState = signalR.HubConnectionState
export const ConnectionState = signalR.HubConnectionState
