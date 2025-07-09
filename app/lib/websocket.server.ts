import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { db } from './db.server';

// ============================================================================
// WEBSOCKET SERVER SETUP
// ============================================================================

interface WebSocketConnection {
  id: string;
  ws: WebSocket;
  userId?: string;
  registryId?: string;
  sessionId: string;
  lastActivity: Date;
  metadata: Record<string, any>;
}

interface WebSocketMessage {
  type: string;
  data?: any;
  registryId?: string;
  userId?: string;
  timestamp: Date;
}

class WishCraftWebSocketServer {
  private wss: WebSocketServer | null = null;
  private connections: Map<string, WebSocketConnection> = new Map();
  private registryViewers: Map<string, Set<string>> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  initialize(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    
    this.wss.on('connection', (ws, request) => {
      const connectionId = this.generateConnectionId();
      const url = new URL(request.url || '', `http://${request.headers.host}`);
      const registryId = url.searchParams.get('registryId');
      const userId = url.searchParams.get('userId');
      const sessionId = url.searchParams.get('sessionId') || this.generateSessionId();

      const connection: WebSocketConnection = {
        id: connectionId,
        ws,
        userId: userId || undefined,
        registryId: registryId || undefined,
        sessionId,
        lastActivity: new Date(),
        metadata: {}
      };

      this.connections.set(connectionId, connection);

      // Track registry viewer
      if (registryId) {
        this.addRegistryViewer(registryId, connectionId);
      }

      // Send welcome message
      this.sendMessage(connectionId, {
        type: 'connection_established',
        data: {
          connectionId,
          sessionId,
          registryId
        },
        timestamp: new Date()
      });

      // Handle incoming messages
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(connectionId, message);
        } catch (error) {
          console.error('Invalid WebSocket message:', error);
        }
      });

      // Handle connection close
      ws.on('close', () => {
        this.removeConnection(connectionId);
      });

      // Handle connection errors
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.removeConnection(connectionId);
      });
    });

    // Start heartbeat to keep connections alive
    this.startHeartbeat();

    console.log('✅ WebSocket server initialized');
  }

  private handleMessage(connectionId: string, message: any) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.lastActivity = new Date();

    switch (message.type) {
      case 'join_registry':
        this.handleJoinRegistry(connectionId, message.data);
        break;
      case 'leave_registry':
        this.handleLeaveRegistry(connectionId, message.data);
        break;
      case 'registry_activity':
        this.handleRegistryActivity(connectionId, message.data);
        break;
      case 'heartbeat':
        this.sendMessage(connectionId, {
          type: 'heartbeat_response',
          timestamp: new Date()
        });
        break;
      case 'user_presence':
        this.handleUserPresence(connectionId, message.data);
        break;
      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  private handleJoinRegistry(connectionId: string, data: { registryId: string; userId?: string }) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.registryId = data.registryId;
    connection.userId = data.userId;

    this.addRegistryViewer(data.registryId, connectionId);

    // Notify others about new viewer
    this.broadcastToRegistry(data.registryId, {
      type: 'viewer_joined',
      data: {
        userId: data.userId,
        connectionId,
        timestamp: new Date()
      },
      timestamp: new Date()
    }, connectionId);

    // Send current viewers to new connection
    const viewers = this.getRegistryViewers(data.registryId);
    this.sendMessage(connectionId, {
      type: 'registry_viewers',
      data: {
        viewers: viewers.length,
        activeViewers: viewers
      },
      timestamp: new Date()
    });
  }

  private handleLeaveRegistry(connectionId: string, data: { registryId: string }) {
    this.removeRegistryViewer(data.registryId, connectionId);

    // Notify others about viewer leaving
    this.broadcastToRegistry(data.registryId, {
      type: 'viewer_left',
      data: {
        connectionId,
        timestamp: new Date()
      },
      timestamp: new Date()
    }, connectionId);
  }

  private handleRegistryActivity(connectionId: string, data: any) {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.registryId) return;

    // Broadcast activity to all registry viewers
    this.broadcastToRegistry(connection.registryId, {
      type: 'registry_activity',
      data,
      timestamp: new Date()
    }, connectionId);
  }

  private handleUserPresence(connectionId: string, data: any) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.metadata = { ...connection.metadata, ...data };

    if (connection.registryId) {
      this.broadcastToRegistry(connection.registryId, {
        type: 'user_presence_update',
        data: {
          connectionId,
          userId: connection.userId,
          presence: data,
          timestamp: new Date()
        },
        timestamp: new Date()
      }, connectionId);
    }
  }

  // ============================================================================
  // REGISTRY VIEWER MANAGEMENT
  // ============================================================================

  private addRegistryViewer(registryId: string, connectionId: string) {
    if (!this.registryViewers.has(registryId)) {
      this.registryViewers.set(registryId, new Set());
    }
    this.registryViewers.get(registryId)!.add(connectionId);
  }

  private removeRegistryViewer(registryId: string, connectionId: string) {
    const viewers = this.registryViewers.get(registryId);
    if (viewers) {
      viewers.delete(connectionId);
      if (viewers.size === 0) {
        this.registryViewers.delete(registryId);
      }
    }
  }

  private getRegistryViewers(registryId: string): Array<{ connectionId: string; userId?: string; metadata?: any }> {
    const viewers = this.registryViewers.get(registryId);
    if (!viewers) return [];

    return Array.from(viewers)
      .map(connectionId => {
        const connection = this.connections.get(connectionId);
        return connection ? {
          connectionId,
          userId: connection.userId,
          metadata: connection.metadata
        } : null;
      })
      .filter(Boolean) as Array<{ connectionId: string; userId?: string; metadata?: any }>;
  }

  // ============================================================================
  // MESSAGE BROADCASTING
  // ============================================================================

  public broadcastToRegistry(registryId: string, message: WebSocketMessage, excludeConnectionId?: string) {
    const viewers = this.registryViewers.get(registryId);
    if (!viewers) return;

    const messageString = JSON.stringify(message);

    viewers.forEach(connectionId => {
      if (connectionId !== excludeConnectionId) {
        this.sendMessage(connectionId, message);
      }
    });
  }

  public broadcastInventoryUpdate(registryId: string, inventoryData: any) {
    this.broadcastToRegistry(registryId, {
      type: 'inventory_update',
      data: inventoryData,
      registryId,
      timestamp: new Date()
    });
  }

  public broadcastPurchaseNotification(registryId: string, purchaseData: any) {
    this.broadcastToRegistry(registryId, {
      type: 'purchase_notification',
      data: purchaseData,
      registryId,
      timestamp: new Date()
    });
  }

  public broadcastGroupGiftUpdate(registryId: string, groupGiftData: any) {
    this.broadcastToRegistry(registryId, {
      type: 'group_gift_update',
      data: groupGiftData,
      registryId,
      timestamp: new Date()
    });
  }

  private sendMessage(connectionId: string, message: WebSocketMessage) {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      connection.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
      this.removeConnection(connectionId);
    }
  }

  // ============================================================================
  // CONNECTION MANAGEMENT
  // ============================================================================

  private removeConnection(connectionId: string) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Remove from registry viewers
    if (connection.registryId) {
      this.removeRegistryViewer(connection.registryId, connectionId);
      
      // Notify others about viewer leaving
      this.broadcastToRegistry(connection.registryId, {
        type: 'viewer_left',
        data: {
          connectionId,
          userId: connection.userId,
          timestamp: new Date()
        },
        timestamp: new Date()
      }, connectionId);
    }

    // Remove connection
    this.connections.delete(connectionId);
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      const now = new Date();
      const staleConnections: string[] = [];

      this.connections.forEach((connection, connectionId) => {
        const timeSinceActivity = now.getTime() - connection.lastActivity.getTime();
        
        // Remove stale connections (no activity for 5 minutes)
        if (timeSinceActivity > 300000) {
          staleConnections.push(connectionId);
        } else {
          // Send heartbeat to active connections
          this.sendMessage(connectionId, {
            type: 'heartbeat',
            timestamp: new Date()
          });
        }
      });

      // Clean up stale connections
      staleConnections.forEach(connectionId => {
        this.removeConnection(connectionId);
      });
    }, 30000); // Check every 30 seconds
  }

  private generateConnectionId(): string {
    return 'conn_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private generateSessionId(): string {
    return 'sess_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  public getStats() {
    return {
      totalConnections: this.connections.size,
      activeRegistries: this.registryViewers.size,
      viewersByRegistry: Array.from(this.registryViewers.entries()).map(([registryId, viewers]) => ({
        registryId,
        viewerCount: viewers.size
      }))
    };
  }

  public getRegistryStats(registryId: string) {
    const viewers = this.getRegistryViewers(registryId);
    return {
      registryId,
      viewerCount: viewers.length,
      viewers: viewers.map(v => ({
        userId: v.userId,
        connectionId: v.connectionId,
        metadata: v.metadata
      }))
    };
  }

  public cleanup() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.connections.forEach((connection) => {
      if (connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.close();
      }
    });
    
    this.connections.clear();
    this.registryViewers.clear();
    
    if (this.wss) {
      this.wss.close();
    }
  }
}

// ============================================================================
// WEBHOOK INTEGRATION
// ============================================================================

export async function notifyInventoryUpdate(registryId: string, productId: string, inventoryData: any) {
  // Update database
  await db.registryItem.updateMany({
    where: {
      registryId,
      productId
    },
    data: {
      inventoryQuantity: inventoryData.available,
      inventoryTracking: inventoryData.tracking,
      updatedAt: new Date()
    }
  });

  // Broadcast to WebSocket clients
  wsServer.broadcastInventoryUpdate(registryId, {
    productId,
    ...inventoryData,
    timestamp: new Date()
  });

  // Log activity
  await db.registryActivity.create({
    data: {
      registryId,
      type: 'inventory_update',
      description: `Inventory updated for product ${productId}`,
      actorType: 'system',
      metadata: {
        productId,
        inventoryData
      }
    }
  });
}

export async function notifyPurchase(registryId: string, purchaseData: any) {
  // Broadcast to WebSocket clients
  wsServer.broadcastPurchaseNotification(registryId, {
    ...purchaseData,
    timestamp: new Date()
  });

  // Log activity
  await db.registryActivity.create({
    data: {
      registryId,
      type: 'item_purchased',
      description: `Item purchased: ${purchaseData.productTitle}`,
      actorType: 'buyer',
      actorEmail: purchaseData.buyerEmail,
      actorName: purchaseData.buyerName,
      metadata: {
        purchaseData
      }
    }
  });
}

export async function notifyGroupGiftUpdate(registryId: string, groupGiftData: any) {
  // Broadcast to WebSocket clients
  wsServer.broadcastGroupGiftUpdate(registryId, {
    ...groupGiftData,
    timestamp: new Date()
  });

  // Log activity
  await db.registryActivity.create({
    data: {
      registryId,
      type: 'group_gift_update',
      description: `Group gift updated: ${groupGiftData.title}`,
      actorType: 'system',
      metadata: {
        groupGiftData
      }
    }
  });
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const wsServer = new WishCraftWebSocketServer();

// Export for server initialization
export { WishCraftWebSocketServer };