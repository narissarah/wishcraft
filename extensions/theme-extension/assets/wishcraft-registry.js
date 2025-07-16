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
          const registryId = e.target.dataset.registryId;
          this.openGiftModal(productId, registryId);
        }
      });
    }

    openGiftModal(productId, registryId) {
      // Look for existing gift modal or create one
      let modal = document.querySelector('.gift-modal');
      if (!modal) {
        modal = this.createGiftModal();
        document.body.appendChild(modal);
      }
      
      // Set product and registry info
      modal.dataset.productId = productId;
      modal.dataset.registryId = registryId;
      
      // Show modal
      modal.style.display = 'flex';
      
      // Focus on first input
      const firstInput = modal.querySelector('input, textarea');
      if (firstInput) {
        firstInput.focus();
      }
    }

    createGiftModal() {
      const modal = document.createElement('div');
      modal.className = 'gift-modal';
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: none;
        justify-content: center;
        align-items: center;
        z-index: 10000;
      `;
      
      modal.innerHTML = `
        <div class="gift-modal-content" style="
          background: white;
          padding: 30px;
          border-radius: 10px;
          max-width: 500px;
          width: 90%;
          max-height: 80vh;
          overflow-y: auto;
          position: relative;
        ">
          <button class="close-modal" style="
            position: absolute;
            top: 15px;
            right: 20px;
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #666;
          ">&times;</button>
          
          <h2 style="margin-bottom: 20px; color: #333;">Add Gift Message</h2>
          
          <form class="gift-form">
            <div style="margin-bottom: 20px;">
              <label style="display: block; margin-bottom: 5px; font-weight: bold;">Gift Message:</label>
              <textarea 
                name="giftMessage" 
                placeholder="Write a personal message for this gift..." 
                style="
                  width: 100%;
                  min-height: 100px;
                  padding: 10px;
                  border: 1px solid #ddd;
                  border-radius: 5px;
                  font-family: inherit;
                  resize: vertical;
                  box-sizing: border-box;
                "
                maxlength="2000"
              ></textarea>
              <small style="color: #666; font-size: 12px;">Optional - Maximum 2000 characters</small>
            </div>
            
            <div style="margin-bottom: 20px;">
              <label style="display: block; margin-bottom: 5px; font-weight: bold;">Your Name:</label>
              <input 
                type="text" 
                name="purchaserName" 
                placeholder="Your name (optional)" 
                style="
                  width: 100%;
                  padding: 10px;
                  border: 1px solid #ddd;
                  border-radius: 5px;
                  font-family: inherit;
                  box-sizing: border-box;
                "
              />
            </div>
            
            <div style="margin-bottom: 20px;">
              <label style="display: block; margin-bottom: 5px; font-weight: bold;">Your Email:</label>
              <input 
                type="email" 
                name="purchaserEmail" 
                placeholder="your.email@example.com (optional)" 
                style="
                  width: 100%;
                  padding: 10px;
                  border: 1px solid #ddd;
                  border-radius: 5px;
                  font-family: inherit;
                  box-sizing: border-box;
                "
              />
            </div>
            
            <div style="margin-bottom: 20px;">
              <label style="display: flex; align-items: center; cursor: pointer;">
                <input type="checkbox" name="isAnonymous" style="margin-right: 10px;" />
                <span>Give this gift anonymously</span>
              </label>
            </div>
            
            <div style="margin-bottom: 20px;">
              <label style="display: block; margin-bottom: 5px; font-weight: bold;">Quantity:</label>
              <input 
                type="number" 
                name="quantity" 
                value="1" 
                min="1" 
                style="
                  width: 100px;
                  padding: 10px;
                  border: 1px solid #ddd;
                  border-radius: 5px;
                  font-family: inherit;
                  box-sizing: border-box;
                "
              />
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
              <button type="button" class="cancel-btn" style="
                padding: 12px 24px;
                border: 1px solid #ddd;
                background: white;
                color: #333;
                border-radius: 5px;
                cursor: pointer;
                font-family: inherit;
              ">Cancel</button>
              
              <button type="submit" class="add-to-cart-btn" style="
                padding: 12px 24px;
                background: #007bff;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-family: inherit;
                font-weight: bold;
              ">Add to Cart</button>
            </div>
          </form>
        </div>
      `;
      
      // Bind modal events
      this.bindModalEvents(modal);
      
      return modal;
    }

    bindModalEvents(modal) {
      // Close modal events
      const closeBtn = modal.querySelector('.close-modal');
      const cancelBtn = modal.querySelector('.cancel-btn');
      
      closeBtn.addEventListener('click', () => this.closeModal(modal));
      cancelBtn.addEventListener('click', () => this.closeModal(modal));
      
      // Click outside to close
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeModal(modal);
        }
      });
      
      // Form submission
      const form = modal.querySelector('.gift-form');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleGiftFormSubmit(modal);
      });
      
      // Character counter for gift message
      const textarea = modal.querySelector('textarea[name="giftMessage"]');
      const charCounter = document.createElement('div');
      charCounter.style.cssText = 'font-size: 12px; color: #666; text-align: right; margin-top: 5px;';
      textarea.parentNode.appendChild(charCounter);
      
      textarea.addEventListener('input', () => {
        const remaining = 2000 - textarea.value.length;
        charCounter.textContent = `${remaining} characters remaining`;
        charCounter.style.color = remaining < 100 ? '#dc3545' : '#666';
      });
      
      // Initial character count
      charCounter.textContent = '2000 characters remaining';
    }

    closeModal(modal) {
      modal.style.display = 'none';
      
      // Clear form
      const form = modal.querySelector('.gift-form');
      form.reset();
      
      // Reset character counter
      const charCounter = modal.querySelector('div[style*="text-align: right"]');
      if (charCounter) {
        charCounter.textContent = '2000 characters remaining';
        charCounter.style.color = '#666';
      }
    }

    handleGiftFormSubmit(modal) {
      const form = modal.querySelector('.gift-form');
      const formData = new FormData(form);
      const productId = modal.dataset.productId;
      const registryId = modal.dataset.registryId;
      
      // Prepare gift options
      const giftOptions = {
        registryId: registryId,
        giftMessage: formData.get('giftMessage'),
        purchaserName: formData.get('purchaserName'),
        purchaserEmail: formData.get('purchaserEmail'),
        isAnonymous: formData.get('isAnonymous') === 'on',
        quantity: parseInt(formData.get('quantity')) || 1
      };
      
      // Close modal first
      this.closeModal(modal);
      
      // Add to cart with gift options
      this.purchaseItem(productId, giftOptions);
    }

    async purchaseItem(productId, giftOptions = {}) {
      // Add to cart with gift message support
      try {
        // Prepare line item properties for gift message
        const properties = {};
        
        // Add registry identification
        if (giftOptions.registryId) {
          properties['_registry_id'] = giftOptions.registryId;
        }
        
        // Add gift message if provided
        if (giftOptions.giftMessage && giftOptions.giftMessage.trim()) {
          // Validate gift message length
          if (giftOptions.giftMessage.length > 2000) {
            throw new Error('Gift message is too long (max 2000 characters)');
          }
          
          // Sanitize gift message (basic client-side sanitization)
          const sanitizedMessage = giftOptions.giftMessage
            .replace(/<script[^>]*>.*?<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '')
            .trim();
          
          properties['_gift_message'] = sanitizedMessage;
        }
        
        // Add purchaser information
        if (giftOptions.purchaserName) {
          properties['_purchaser_name'] = giftOptions.purchaserName;
        }
        
        if (giftOptions.purchaserEmail) {
          properties['_purchaser_email'] = giftOptions.purchaserEmail;
        }
        
        // Add anonymous gift flag
        if (giftOptions.isAnonymous) {
          properties['_is_anonymous'] = 'true';
        }
        
        // Prepare cart item
        const cartItem = {
          id: productId,
          quantity: giftOptions.quantity || 1
        };
        
        // Add properties if any exist
        if (Object.keys(properties).length > 0) {
          cartItem.properties = properties;
        }
        
        const response = await fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cartItem)
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to add to cart');
        }

        // Show success message
        this.showSuccessMessage('Item added to cart with gift message!');
        
        // Redirect to cart after short delay
        setTimeout(() => {
          window.location.href = '/cart';
        }, 1500);
        
      } catch (error) {
        console.error('Failed to add to cart:', error);
        this.showErrorMessage(error.message || 'Failed to add to cart');
      }
    }

    showSuccessMessage(message) {
      this.showMessage(message, 'success');
    }

    showErrorMessage(message) {
      this.showMessage(message, 'error');
    }

    showMessage(message, type = 'info') {
      // Create or update notification
      let notification = document.querySelector('.wishcraft-notification');
      if (!notification) {
        notification = document.createElement('div');
        notification.className = 'wishcraft-notification';
        notification.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          padding: 15px 20px;
          border-radius: 5px;
          color: white;
          font-weight: bold;
          z-index: 10000;
          max-width: 300px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          transition: all 0.3s ease;
        `;
        document.body.appendChild(notification);
      }

      // Set background color based on type
      const colors = {
        success: '#28a745',
        error: '#dc3545',
        info: '#17a2b8'
      };
      
      notification.style.backgroundColor = colors[type] || colors.info;
      notification.textContent = message;
      notification.style.display = 'block';

      // Auto-hide after 3 seconds
      setTimeout(() => {
        notification.style.display = 'none';
      }, 3000);
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