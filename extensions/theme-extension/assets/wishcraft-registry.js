/**
 * WishCraft Registry - Lightweight Storefront Script
 * Minimal implementation for Shopify theme blocks
 */
(function() {
  'use strict';

  const CONFIG = {
    apiPath: '/apps/wishcraft/api',
    debounceDelay: 300
  };

  // Utility functions
  const utils = {
    debounce(func, wait) {
      let timeout;
      return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
      };
    },

    async apiCall(endpoint, options = {}) {
      try {
        const response = await fetch(`${CONFIG.apiPath}${endpoint}`, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            ...options.headers
          }
        });
        return response.ok ? await response.json() : { error: 'Request failed' };
      } catch (error) {
        return { error: error.message };
      }
    },

    formatMoney(cents) {
      return '$' + (cents / 100).toFixed(2);
    },

    showMessage(element, message, type = 'info') {
      element.className = `wishcraft-message ${type}`;
      element.textContent = message;
      element.style.display = 'block';
      setTimeout(() => element.style.display = 'none', 3000);
    }
  };

  // Registry List Component
  class RegistryList {
    constructor(blockId) {
      this.blockId = blockId;
      this.container = document.querySelector(`[data-block-id="${blockId}"]`);
      this.itemsContainer = document.getElementById(`registry-items-${blockId}`);
      this.init();
    }

    async init() {
      await this.loadItems();
      this.bindEvents();
    }

    async loadItems() {
      const registryId = this.container.dataset.registryId;
      if (!registryId) return;

      const result = await utils.apiCall(`/registries/${registryId}/items`);
      if (result.error) {
        this.itemsContainer.innerHTML = `<p class="error">Failed to load registry items</p>`;
        return;
      }

      this.renderItems(result.items || []);
    }

    renderItems(items) {
      if (!items.length) {
        this.itemsContainer.innerHTML = '<p class="empty">No items in this registry yet.</p>';
        return;
      }

      this.itemsContainer.innerHTML = items.map(item => `
        <div class="registry-item" data-item-id="${item.id}">
          <img src="${item.image}" alt="${item.title}" loading="lazy">
          <h3>${item.title}</h3>
          <p class="price">${utils.formatMoney(item.price)}</p>
          <button class="purchase-btn" data-product-id="${item.productId}">
            Purchase Gift
          </button>
        </div>
      `).join('');
    }

    bindEvents() {
      this.itemsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('purchase-btn')) {
          const productId = e.target.dataset.productId;
          this.purchaseItem(productId);
        }
      });
    }

    async purchaseItem(productId) {
      // Add to cart and redirect
      try {
        await fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: productId,
            quantity: 1
          })
        });
        window.location.href = '/cart';
      } catch (error) {
        console.error('Failed to add to cart:', error);
      }
    }
  }

  // Add to Registry Component
  class AddToRegistry {
    constructor(blockId) {
      this.blockId = blockId;
      this.container = document.querySelector(`[data-block-id="${blockId}"]`);
      this.init();
    }

    async init() {
      await this.loadRegistries();
      this.bindEvents();
    }

    async loadRegistries() {
      const result = await utils.apiCall('/registries');
      if (result.error) return;

      const select = this.container.querySelector('select');
      if (!select) return;

      select.innerHTML = result.registries.map(registry => 
        `<option value="${registry.id}">${registry.title}</option>`
      ).join('');
    }

    bindEvents() {
      const addBtn = this.container.querySelector('.add-to-registry-btn');
      if (addBtn) {
        addBtn.addEventListener('click', () => this.addToRegistry());
      }
    }

    async addToRegistry() {
      const registryId = this.container.querySelector('select')?.value;
      const productId = this.container.dataset.productId;
      
      if (!registryId || !productId) return;

      const result = await utils.apiCall('/registry-items', {
        method: 'POST',
        body: JSON.stringify({
          registryId,
          productId,
          quantity: 1
        })
      });

      const messageEl = this.container.querySelector('.message');
      if (messageEl) {
        utils.showMessage(messageEl, 
          result.error ? 'Failed to add item' : 'Item added to registry!',
          result.error ? 'error' : 'success'
        );
      }
    }
  }

  // Initialize components
  window.WishCraftRegistry = {
    initRegistryList(blockId) {
      new RegistryList(blockId);
    },
    
    initAddToRegistry(blockId) {
      new AddToRegistry(blockId);
    }
  };
})();