// Client-side offline support utilities

export interface OfflineAction {
  id: string;
  type: 'CREATE_REGISTRY' | 'UPDATE_ITEM' | 'ADD_ITEM' | 'DELETE_ITEM' | 'ANALYTICS_EVENT';
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  timestamp: number;
  retryCount: number;
}

export interface OfflineStorage {
  actions: OfflineAction[];
  analytics: any[];
  lastSync: number;
}

class OfflineManager {
  private dbName = 'wishcraft-offline';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;

  constructor() {
    this.initDB();
    this.setupEventListeners();
  }

  // Initialize IndexedDB
  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create stores
        if (!db.objectStoreNames.contains('actions')) {
          const actionsStore = db.createObjectStore('actions', { keyPath: 'id' });
          actionsStore.createIndex('timestamp', 'timestamp');
          actionsStore.createIndex('type', 'type');
        }

        if (!db.objectStoreNames.contains('analytics')) {
          const analyticsStore = db.createObjectStore('analytics', { keyPath: 'id', autoIncrement: true });
          analyticsStore.createIndex('timestamp', 'timestamp');
        }

        if (!db.objectStoreNames.contains('cache')) {
          const cacheStore = db.createObjectStore('cache', { keyPath: 'key' });
          cacheStore.createIndex('expiry', 'expiry');
        }
      };
    });
  }

  // Setup event listeners
  private setupEventListeners(): void {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      console.log('Connection restored, syncing offline actions...');
      this.syncOfflineActions();
    });

    window.addEventListener('offline', () => {
      console.log('Connection lost, switching to offline mode');
      this.showOfflineIndicator();
    });

    // Listen for service worker messages
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'BACKGROUND_SYNC') {
          this.syncOfflineActions();
        }
      });
    }

    // Periodic sync attempt
    setInterval(() => {
      if (navigator.onLine) {
        this.syncOfflineActions();
      }
    }, 30000); // Every 30 seconds
  }

  // Store action for offline sync
  async storeOfflineAction(action: Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    if (!this.db) await this.initDB();

    const offlineAction: OfflineAction = {
      ...action,
      id: this.generateId(),
      timestamp: Date.now(),
      retryCount: 0
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['actions'], 'readwrite');
      const store = transaction.objectStore('actions');
      const request = store.add(offlineAction);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Store analytics event for offline sync
  async storeOfflineAnalytics(event: any): Promise<void> {
    if (!this.db) await this.initDB();

    const analyticsEvent = {
      ...event,
      timestamp: Date.now(),
      synced: false
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['analytics'], 'readwrite');
      const store = transaction.objectStore('analytics');
      const request = store.add(analyticsEvent);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Sync offline actions
  async syncOfflineActions(): Promise<void> {
    if (!navigator.onLine || !this.db) return;

    const actions = await this.getOfflineActions();
    
    for (const action of actions) {
      try {
        const response = await fetch(action.url, {
          method: action.method,
          headers: action.headers,
          body: action.body
        });

        if (response.ok) {
          await this.removeOfflineAction(action.id);
          console.log('Synced offline action:', action.type);
        } else {
          // Increment retry count
          await this.updateActionRetryCount(action.id, action.retryCount + 1);
          
          // Remove action if retry limit exceeded
          if (action.retryCount >= 3) {
            await this.removeOfflineAction(action.id);
            console.warn('Removed failed action after max retries:', action.type);
          }
        }
      } catch (error) {
        console.error('Failed to sync action:', action.type, error);
        await this.updateActionRetryCount(action.id, action.retryCount + 1);
      }
    }

    // Sync analytics
    await this.syncOfflineAnalytics();
  }

  // Sync offline analytics
  private async syncOfflineAnalytics(): Promise<void> {
    if (!navigator.onLine || !this.db) return;

    const analytics = await this.getOfflineAnalytics();
    
    if (analytics.length === 0) return;

    try {
      const response = await fetch('/api/analytics/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: analytics })
      });

      if (response.ok) {
        await this.clearOfflineAnalytics();
        console.log('Synced offline analytics:', analytics.length, 'events');
      }
    } catch (error) {
      console.error('Failed to sync analytics:', error);
    }
  }

  // Get offline actions
  private async getOfflineActions(): Promise<OfflineAction[]> {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['actions'], 'readonly');
      const store = transaction.objectStore('actions');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Get offline analytics
  private async getOfflineAnalytics(): Promise<any[]> {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['analytics'], 'readonly');
      const store = transaction.objectStore('analytics');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result.filter(item => !item.synced));
      request.onerror = () => reject(request.error);
    });
  }

  // Remove offline action
  private async removeOfflineAction(id: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['actions'], 'readwrite');
      const store = transaction.objectStore('actions');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Update action retry count
  private async updateActionRetryCount(id: string, retryCount: number): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['actions'], 'readwrite');
      const store = transaction.objectStore('actions');
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const action = getRequest.result;
        if (action) {
          action.retryCount = retryCount;
          const putRequest = store.put(action);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // Clear offline analytics
  private async clearOfflineAnalytics(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['analytics'], 'readwrite');
      const store = transaction.objectStore('analytics');
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Cache data for offline access
  async cacheData(key: string, data: any, ttl: number = 3600000): Promise<void> {
    if (!this.db) await this.initDB();

    const cacheItem = {
      key,
      data,
      expiry: Date.now() + ttl,
      timestamp: Date.now()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const request = store.put(cacheItem);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Get cached data
  async getCachedData(key: string): Promise<any | null> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cache'], 'readonly');
      const store = transaction.objectStore('cache');
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        if (result && result.expiry > Date.now()) {
          resolve(result.data);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Show offline indicator
  private showOfflineIndicator(): void {
    const indicator = document.createElement('div');
    indicator.id = 'offline-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #ff6b6b;
      color: white;
      text-align: center;
      padding: 8px;
      font-size: 14px;
      font-weight: 500;
      z-index: 10000;
      transform: translateY(-100%);
      transition: transform 0.3s ease;
    `;
    indicator.textContent = '📡 You\'re offline - changes will sync when reconnected';
    
    document.body.appendChild(indicator);
    
    // Animate in
    setTimeout(() => {
      indicator.style.transform = 'translateY(0)';
    }, 100);

    // Remove when online
    const removeIndicator = () => {
      if (navigator.onLine) {
        indicator.style.transform = 'translateY(-100%)';
        setTimeout(() => {
          if (indicator.parentNode) {
            indicator.parentNode.removeChild(indicator);
          }
        }, 300);
        window.removeEventListener('online', removeIndicator);
      }
    };

    window.addEventListener('online', removeIndicator);
  }

  // Generate unique ID
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get sync status
  async getSyncStatus(): Promise<{
    pendingActions: number;
    pendingAnalytics: number;
    lastSync: number;
    isOnline: boolean;
  }> {
    const [actions, analytics] = await Promise.all([
      this.getOfflineActions(),
      this.getOfflineAnalytics()
    ]);

    return {
      pendingActions: actions.length,
      pendingAnalytics: analytics.length,
      lastSync: localStorage.getItem('lastSync') ? parseInt(localStorage.getItem('lastSync')!) : 0,
      isOnline: navigator.onLine
    };
  }
}

// Service Worker utilities
export class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;

  async register(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker not supported');
      return;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered successfully');

      // Handle updates
      this.registration.addEventListener('updatefound', () => {
        const newWorker = this.registration!.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              this.showUpdateAvailable();
            }
          });
        }
      });

    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }

  private showUpdateAvailable(): void {
    const banner = document.createElement('div');
    banner.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      right: 20px;
      background: #4285f4;
      color: white;
      padding: 16px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    
    banner.innerHTML = `
      <span>A new version is available!</span>
      <button id="update-btn" style="background: white; color: #4285f4; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: 500;">
        Update
      </button>
    `;
    
    document.body.appendChild(banner);
    
    banner.querySelector('#update-btn')?.addEventListener('click', () => {
      if (this.registration?.waiting) {
        this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
      }
    });
  }

  async getCacheStats(): Promise<any> {
    if (!this.registration) return null;

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = (event) => {
        resolve(event.data);
      };

      this.registration!.active?.postMessage(
        { type: 'GET_CACHE_STATS' },
        [messageChannel.port2]
      );
    });
  }
}

// Export singleton instances
export const offlineManager = new OfflineManager();
export const serviceWorkerManager = new ServiceWorkerManager();

// Initialize on load
if (typeof window !== 'undefined') {
  serviceWorkerManager.register();
}