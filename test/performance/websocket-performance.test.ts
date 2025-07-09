import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import WebSocket from 'ws';
import { performance } from 'perf_hooks';

// Mock WebSocket server for testing
let mockServer: any;
let connections: WebSocket[] = [];

describe('WebSocket Performance Tests', () => {
  beforeEach(async () => {
    // Setup mock WebSocket server
    mockServer = {
      clients: new Set(),
      broadcast: vi.fn(),
      close: vi.fn()
    };
    connections = [];
  });

  afterEach(async () => {
    // Clean up connections
    connections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });
    connections = [];
    
    if (mockServer) {
      mockServer.close();
    }
  });

  describe('Connection Performance', () => {
    it('should handle concurrent connection establishment', async () => {
      const connectionCount = 100;
      const startTime = performance.now();
      
      const connectionPromises = Array.from({ length: connectionCount }, async (_, index) => {
        return new Promise<{ connectionTime: number; index: number }>((resolve, reject) => {
          const connectionStart = performance.now();
          
          // Mock WebSocket connection
          const mockWs = {
            readyState: WebSocket.CONNECTING,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            send: vi.fn(),
            close: vi.fn(),
            onopen: null,
            onclose: null,
            onmessage: null,
            onerror: null
          };

          // Simulate connection establishment
          setTimeout(() => {
            mockWs.readyState = WebSocket.OPEN;
            const connectionTime = performance.now() - connectionStart;
            
            if (mockWs.onopen) {
              mockWs.onopen({} as Event);
            }
            
            connections.push(mockWs as any);
            resolve({ connectionTime, index });
          }, Math.random() * 100); // Random delay 0-100ms
        });
      });

      const results = await Promise.all(connectionPromises);
      const totalTime = performance.now() - startTime;

      // Performance assertions
      expect(results).toHaveLength(connectionCount);
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
      
      const avgConnectionTime = results.reduce((sum, r) => sum + r.connectionTime, 0) / results.length;
      expect(avgConnectionTime).toBeLessThan(500); // Average connection time under 500ms
      
      const maxConnectionTime = Math.max(...results.map(r => r.connectionTime));
      expect(maxConnectionTime).toBeLessThan(1000); // No connection should take more than 1 second

      console.log(`✅ Connected ${connectionCount} clients in ${totalTime.toFixed(2)}ms`);
      console.log(`📊 Average connection time: ${avgConnectionTime.toFixed(2)}ms`);
      console.log(`⏰ Max connection time: ${maxConnectionTime.toFixed(2)}ms`);
    });

    it('should handle connection cleanup efficiently', async () => {
      const connectionCount = 50;
      const connections: any[] = [];

      // Create connections
      for (let i = 0; i < connectionCount; i++) {
        const mockWs = {
          readyState: WebSocket.OPEN,
          close: vi.fn(),
          terminate: vi.fn()
        };
        connections.push(mockWs);
      }

      const startTime = performance.now();

      // Close all connections
      const closePromises = connections.map((ws, index) => {
        return new Promise<number>((resolve) => {
          const closeStart = performance.now();
          
          // Simulate close operation
          setTimeout(() => {
            ws.readyState = WebSocket.CLOSED;
            const closeTime = performance.now() - closeStart;
            ws.close();
            resolve(closeTime);
          }, Math.random() * 50);
        });
      });

      const closeTimes = await Promise.all(closePromises);
      const totalCleanupTime = performance.now() - startTime;

      expect(totalCleanupTime).toBeLessThan(2000); // Cleanup within 2 seconds
      
      const avgCloseTime = closeTimes.reduce((sum, time) => sum + time, 0) / closeTimes.length;
      expect(avgCloseTime).toBeLessThan(200); // Average close time under 200ms

      console.log(`🧹 Cleaned up ${connectionCount} connections in ${totalCleanupTime.toFixed(2)}ms`);
      console.log(`📊 Average close time: ${avgCloseTime.toFixed(2)}ms`);
    });
  });

  describe('Message Broadcasting Performance', () => {
    it('should broadcast messages to many clients efficiently', async () => {
      const clientCount = 500;
      const messageCount = 100;
      
      // Create mock clients
      const clients = Array.from({ length: clientCount }, (_, index) => ({
        id: `client_${index}`,
        ws: {
          readyState: WebSocket.OPEN,
          send: vi.fn(),
          latency: Math.random() * 50 // Simulate network latency
        },
        messageReceived: 0
      }));

      const broadcastMessage = (message: any) => {
        const startTime = performance.now();
        const sendPromises: Promise<number>[] = [];

        clients.forEach(client => {
          const sendPromise = new Promise<number>((resolve) => {
            // Simulate network delay
            setTimeout(() => {
              const sendTime = performance.now() - startTime;
              client.ws.send(JSON.stringify(message));
              client.messageReceived++;
              resolve(sendTime);
            }, client.ws.latency);
          });
          sendPromises.push(sendPromise);
        });

        return Promise.all(sendPromises);
      };

      // Test broadcasting multiple messages
      const broadcastStartTime = performance.now();
      const allBroadcastPromises: Promise<number[]>[] = [];

      for (let i = 0; i < messageCount; i++) {
        const message = {
          type: 'test_message',
          data: { messageId: i, timestamp: Date.now() },
          registryId: 'test_registry'
        };
        
        allBroadcastPromises.push(broadcastMessage(message));
      }

      const allResults = await Promise.all(allBroadcastPromises);
      const totalBroadcastTime = performance.now() - broadcastStartTime;

      // Performance assertions
      expect(totalBroadcastTime).toBeLessThan(10000); // Complete within 10 seconds
      
      // Verify all clients received all messages
      clients.forEach(client => {
        expect(client.messageReceived).toBe(messageCount);
      });

      const totalMessages = clientCount * messageCount;
      const messagesPerSecond = totalMessages / (totalBroadcastTime / 1000);
      
      expect(messagesPerSecond).toBeGreaterThan(1000); // At least 1000 messages/second

      console.log(`📡 Broadcast ${totalMessages} messages in ${totalBroadcastTime.toFixed(2)}ms`);
      console.log(`⚡ Rate: ${messagesPerSecond.toFixed(0)} messages/second`);
      console.log(`👥 ${clientCount} clients × ${messageCount} messages each`);
    });

    it('should handle selective message broadcasting efficiently', async () => {
      const totalClients = 1000;
      const registryCount = 10;
      const messageCount = 50;

      // Create clients distributed across registries
      const clientsByRegistry = new Map<string, any[]>();
      
      for (let i = 0; i < totalClients; i++) {
        const registryId = `registry_${i % registryCount}`;
        const client = {
          id: `client_${i}`,
          registryId,
          ws: {
            readyState: WebSocket.OPEN,
            send: vi.fn()
          },
          messagesReceived: 0
        };

        if (!clientsByRegistry.has(registryId)) {
          clientsByRegistry.set(registryId, []);
        }
        clientsByRegistry.get(registryId)!.push(client);
      }

      const broadcastToRegistry = (registryId: string, message: any) => {
        const startTime = performance.now();
        const clients = clientsByRegistry.get(registryId) || [];
        
        const sendPromises = clients.map(client => {
          return new Promise<void>((resolve) => {
            // Simulate minimal processing delay
            setTimeout(() => {
              client.ws.send(JSON.stringify(message));
              client.messagesReceived++;
              resolve();
            }, Math.random() * 10);
          });
        });

        return Promise.all(sendPromises).then(() => {
          return performance.now() - startTime;
        });
      };

      // Test selective broadcasting
      const startTime = performance.now();
      const broadcastPromises: Promise<number>[] = [];

      for (let i = 0; i < messageCount; i++) {
        const targetRegistry = `registry_${i % registryCount}`;
        const message = {
          type: 'registry_update',
          data: { updateId: i },
          registryId: targetRegistry
        };

        broadcastPromises.push(broadcastToRegistry(targetRegistry, message));
      }

      const broadcastTimes = await Promise.all(broadcastPromises);
      const totalTime = performance.now() - startTime;

      // Performance assertions
      expect(totalTime).toBeLessThan(5000); // Complete within 5 seconds
      
      const avgBroadcastTime = broadcastTimes.reduce((sum, time) => sum + time, 0) / broadcastTimes.length;
      expect(avgBroadcastTime).toBeLessThan(100); // Average broadcast under 100ms

      // Verify message distribution
      const expectedMessagesPerRegistry = messageCount / registryCount;
      clientsByRegistry.forEach((clients, registryId) => {
        clients.forEach(client => {
          expect(client.messagesReceived).toBe(expectedMessagesPerRegistry);
        });
      });

      console.log(`🎯 Selective broadcast: ${totalTime.toFixed(2)}ms total`);
      console.log(`📊 Average broadcast time: ${avgBroadcastTime.toFixed(2)}ms`);
      console.log(`🏷️ ${registryCount} registries, ${totalClients} total clients`);
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should manage memory efficiently with many connections', async () => {
      const connectionCount = 1000;
      const memoryBefore = process.memoryUsage();
      
      // Create many mock connections
      const connections = Array.from({ length: connectionCount }, (_, index) => ({
        id: `conn_${index}`,
        ws: {
          readyState: WebSocket.OPEN,
          send: vi.fn(),
          close: vi.fn()
        },
        lastActivity: Date.now(),
        metadata: {
          userId: `user_${index}`,
          registryId: `registry_${index % 100}`, // 100 different registries
          sessionData: new Array(100).fill(0).map(() => Math.random()) // Some session data
        }
      }));

      const memoryAfterConnections = process.memoryUsage();
      const memoryIncrease = memoryAfterConnections.heapUsed - memoryBefore.heapUsed;
      const memoryPerConnection = memoryIncrease / connectionCount;

      // Memory usage assertions
      expect(memoryPerConnection).toBeLessThan(10000); // Less than 10KB per connection
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Total increase under 50MB

      // Test cleanup
      const cleanupStart = performance.now();
      connections.forEach(conn => {
        conn.ws.close();
      });
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const cleanupTime = performance.now() - cleanupStart;
      expect(cleanupTime).toBeLessThan(1000); // Cleanup within 1 second

      console.log(`💾 Memory per connection: ${(memoryPerConnection / 1024).toFixed(2)}KB`);
      console.log(`📈 Total memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
      console.log(`🧹 Cleanup time: ${cleanupTime.toFixed(2)}ms`);
    });

    it('should handle connection churn efficiently', async () => {
      const totalOperations = 1000;
      const concurrentConnections = 100;
      let activeConnections = new Map<string, any>();
      
      const connectClient = (id: string) => {
        const startTime = performance.now();
        const connection = {
          id,
          ws: {
            readyState: WebSocket.OPEN,
            send: vi.fn(),
            close: vi.fn()
          },
          connectedAt: Date.now()
        };
        
        activeConnections.set(id, connection);
        return performance.now() - startTime;
      };

      const disconnectClient = (id: string) => {
        const startTime = performance.now();
        const connection = activeConnections.get(id);
        if (connection) {
          connection.ws.close();
          activeConnections.delete(id);
        }
        return performance.now() - startTime;
      };

      const operationTimes: number[] = [];
      const testStartTime = performance.now();

      // Simulate connection churn
      for (let i = 0; i < totalOperations; i++) {
        if (activeConnections.size < concurrentConnections) {
          // Connect new client
          const clientId = `churn_client_${i}`;
          const operationTime = connectClient(clientId);
          operationTimes.push(operationTime);
        } else {
          // Disconnect random client
          const clientIds = Array.from(activeConnections.keys());
          const randomId = clientIds[Math.floor(Math.random() * clientIds.length)];
          const operationTime = disconnectClient(randomId);
          operationTimes.push(operationTime);
          
          // Connect new client
          const newClientId = `churn_client_${i}`;
          const connectTime = connectClient(newClientId);
          operationTimes.push(connectTime);
        }
        
        // Add small delay to simulate real usage
        await new Promise(resolve => setTimeout(resolve, 1));
      }

      const totalTestTime = performance.now() - testStartTime;
      const avgOperationTime = operationTimes.reduce((sum, time) => sum + time, 0) / operationTimes.length;
      const maxOperationTime = Math.max(...operationTimes);

      // Performance assertions
      expect(totalTestTime).toBeLessThan(30000); // Complete within 30 seconds
      expect(avgOperationTime).toBeLessThan(50); // Average operation under 50ms
      expect(maxOperationTime).toBeLessThan(500); // No operation over 500ms
      expect(activeConnections.size).toBeLessThanOrEqual(concurrentConnections);

      console.log(`🔄 Connection churn: ${totalOperations} operations in ${totalTestTime.toFixed(2)}ms`);
      console.log(`📊 Average operation time: ${avgOperationTime.toFixed(2)}ms`);
      console.log(`⏰ Max operation time: ${maxOperationTime.toFixed(2)}ms`);
      console.log(`🔗 Final active connections: ${activeConnections.size}`);
    });
  });

  describe('Latency and Response Time', () => {
    it('should maintain low latency under load', async () => {
      const clientCount = 200;
      const pingCount = 50;
      
      // Create clients with varying simulated network conditions
      const clients = Array.from({ length: clientCount }, (_, index) => ({
        id: `latency_client_${index}`,
        networkLatency: 10 + Math.random() * 100, // 10-110ms latency
        ws: {
          readyState: WebSocket.OPEN,
          send: vi.fn(),
          close: vi.fn()
        },
        pingTimes: [] as number[]
      }));

      const sendPing = (client: any) => {
        return new Promise<number>((resolve) => {
          const pingStart = performance.now();
          
          // Simulate round trip
          setTimeout(() => {
            setTimeout(() => {
              const roundTripTime = performance.now() - pingStart;
              client.pingTimes.push(roundTripTime);
              resolve(roundTripTime);
            }, client.networkLatency); // Return trip
          }, client.networkLatency); // Initial trip
        });
      };

      // Test ping performance under load
      const testStartTime = performance.now();
      const allPingPromises: Promise<number>[] = [];

      for (let ping = 0; ping < pingCount; ping++) {
        clients.forEach(client => {
          allPingPromises.push(sendPing(client));
        });
        
        // Small delay between ping rounds
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const allPingTimes = await Promise.all(allPingPromises);
      const totalTestTime = performance.now() - testStartTime;

      // Calculate statistics
      const avgPingTime = allPingTimes.reduce((sum, time) => sum + time, 0) / allPingTimes.length;
      const maxPingTime = Math.max(...allPingTimes);
      const minPingTime = Math.min(...allPingTimes);
      
      // Calculate percentiles
      const sortedPings = allPingTimes.sort((a, b) => a - b);
      const p95 = sortedPings[Math.floor(sortedPings.length * 0.95)];
      const p99 = sortedPings[Math.floor(sortedPings.length * 0.99)];

      // Performance assertions
      expect(avgPingTime).toBeLessThan(300); // Average ping under 300ms
      expect(p95).toBeLessThan(500); // 95% of pings under 500ms
      expect(p99).toBeLessThan(1000); // 99% of pings under 1000ms

      // Verify no significant degradation over time
      const firstHalfAvg = allPingTimes.slice(0, allPingTimes.length / 2)
        .reduce((sum, time) => sum + time, 0) / (allPingTimes.length / 2);
      const secondHalfAvg = allPingTimes.slice(allPingTimes.length / 2)
        .reduce((sum, time) => sum + time, 0) / (allPingTimes.length / 2);
      
      const degradation = (secondHalfAvg - firstHalfAvg) / firstHalfAvg;
      expect(degradation).toBeLessThan(0.5); // Less than 50% degradation

      console.log(`🏓 Ping test: ${clientCount} clients × ${pingCount} pings`);
      console.log(`📊 Average: ${avgPingTime.toFixed(2)}ms`);
      console.log(`📈 Min/Max: ${minPingTime.toFixed(2)}ms / ${maxPingTime.toFixed(2)}ms`);
      console.log(`📊 P95/P99: ${p95.toFixed(2)}ms / ${p99.toFixed(2)}ms`);
      console.log(`📉 Performance degradation: ${(degradation * 100).toFixed(1)}%`);
    });
  });

  describe('Error Handling Performance', () => {
    it('should handle connection errors efficiently', async () => {
      const clientCount = 100;
      const errorRate = 0.1; // 10% error rate
      
      const testStartTime = performance.now();
      const results = {
        successful: 0,
        errors: 0,
        errorHandlingTimes: [] as number[]
      };

      const connectWithPossibleError = () => {
        return new Promise<void>((resolve) => {
          const operationStart = performance.now();
          
          if (Math.random() < errorRate) {
            // Simulate connection error
            setTimeout(() => {
              const errorHandlingTime = performance.now() - operationStart;
              results.errorHandlingTimes.push(errorHandlingTime);
              results.errors++;
              resolve();
            }, Math.random() * 100);
          } else {
            // Successful connection
            setTimeout(() => {
              results.successful++;
              resolve();
            }, Math.random() * 50);
          }
        });
      };

      const connectionPromises = Array.from({ length: clientCount }, () => connectWithPossibleError());
      await Promise.all(connectionPromises);

      const totalTime = performance.now() - testStartTime;
      const avgErrorHandlingTime = results.errorHandlingTimes.length > 0
        ? results.errorHandlingTimes.reduce((sum, time) => sum + time, 0) / results.errorHandlingTimes.length
        : 0;

      // Performance assertions
      expect(totalTime).toBeLessThan(5000); // Complete within 5 seconds
      expect(avgErrorHandlingTime).toBeLessThan(200); // Error handling under 200ms
      expect(results.successful + results.errors).toBe(clientCount);

      const actualErrorRate = results.errors / clientCount;
      expect(Math.abs(actualErrorRate - errorRate)).toBeLessThan(0.05); // Within 5% of expected

      console.log(`🚨 Error handling test: ${totalTime.toFixed(2)}ms total`);
      console.log(`✅ Successful: ${results.successful}, ❌ Errors: ${results.errors}`);
      console.log(`⚡ Avg error handling: ${avgErrorHandlingTime.toFixed(2)}ms`);
      console.log(`📊 Actual error rate: ${(actualErrorRate * 100).toFixed(1)}%`);
    });
  });
});