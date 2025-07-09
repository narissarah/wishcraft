/**
 * WishCraft Registry - Storefront JavaScript (2025-10RC Compatible)
 * Handles all registry interactions on the storefront using Polaris Web Components
 */

// Import Polaris Web Components for 2025 compliance
import '@shopify/polaris-web-components';

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    apiPath: '/apps/wishcraft/api',
    debounceDelay: 300,
    animationDuration: 200,
    maxRetries: 3
  };

  // Utility functions
  const utils = {
    debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    },

    async fetchWithRetry(url, options = {}, retries = CONFIG.maxRetries) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            ...options.headers
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
      } catch (error) {
        if (retries > 0) {
          console.warn(`API request failed, retrying... (${retries} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          return this.fetchWithRetry(url, options, retries - 1);
        }
        throw error;
      }
    },

    formatMoney(cents, format = '${{amount}}') {
      const amount = (cents / 100).toFixed(2);
      return format.replace('{{amount}}', amount);
    },

    showMessage(element, type, message, duration = 5000) {
      element.className = `wishcraft-message ${type}`;
      element.textContent = message;
      element.style.display = 'block';
      
      if (duration > 0) {
        setTimeout(() => {
          element.style.display = 'none';
        }, duration);
      }
    },

    animate(element, animation, duration = CONFIG.animationDuration) {
      return new Promise(resolve => {
        element.style.animation = `${animation} ${duration}ms ease-in-out`;
        setTimeout(() => {
          element.style.animation = '';
          resolve();
        }, duration);
      });
    }
  };

  // Registry API wrapper
  class RegistryAPI {
    constructor() {
      this.baseUrl = CONFIG.apiPath;
    }

    async getCustomerRegistries() {
      try {
        return await utils.fetchWithRetry(`${this.baseUrl}/registries`);
      } catch (error) {
        console.error('Failed to fetch customer registries:', error);
        throw new Error('Unable to load your registries. Please try again.');
      }
    }

    async addToRegistry(registryId, productData) {
      try {
        return await utils.fetchWithRetry(`${this.baseUrl}/registries/${registryId}/items`, {
          method: 'POST',
          body: JSON.stringify({
            product_id: productData.productId,
            variant_id: productData.variantId,
            quantity: productData.quantity,
            priority: productData.priority,
            notes: productData.notes,
            product_title: productData.productTitle,
            product_handle: productData.productHandle,
            product_image: productData.productImage,
            product_url: productData.productUrl
          })
        });
      } catch (error) {
        console.error('Failed to add item to registry:', error);
        throw new Error('Unable to add item to registry. Please try again.');
      }
    }

    async createRegistry(registryData) {
      try {
        return await utils.fetchWithRetry(`${this.baseUrl}/registries`, {
          method: 'POST',
          body: JSON.stringify(registryData)
        });
      } catch (error) {
        console.error('Failed to create registry:', error);
        throw new Error('Unable to create registry. Please try again.');
      }
    }

    async checkProductInRegistries(productId) {
      try {
        return await utils.fetchWithRetry(`${this.baseUrl}/products/${productId}/registries`);
      } catch (error) {
        console.error('Failed to check product in registries:', error);
        return { registries: [] };
      }
    }
  }

  // Add to Registry Component
  class AddToRegistryComponent {
    constructor(blockId) {
      this.blockId = blockId;
      this.container = document.querySelector(`[data-block-id="${blockId}"]`);
      this.api = new RegistryAPI();
      this.registries = [];
      this.isLoading = false;

      if (!this.container) {
        console.warn(`AddToRegistry container not found for block ${blockId}`);
        return;
      }

      this.initElements();
      this.bindEvents();
      this.loadRegistries();
    }

    initElements() {
      // Core elements
      this.registrySelect = this.container.querySelector(`#registry-select-${this.blockId}`);
      this.variantSelect = this.container.querySelector(`#variant-select-${this.blockId}`);
      this.quantityInput = this.container.querySelector(`#quantity-input-${this.blockId}`);
      this.notesInput = this.container.querySelector(`#notes-input-${this.blockId}`);
      this.addButton = this.container.querySelector(`#add-to-registry-btn-${this.blockId}`);
      this.createButton = this.container.querySelector(`#create-registry-btn-${this.blockId}`);
      this.messageElement = this.container.querySelector(`#message-${this.blockId}`);

      // Priority radio buttons
      this.priorityInputs = this.container.querySelectorAll(`input[name="priority-${this.blockId}"]`);
      
      // Quantity controls
      this.qtyDecreaseBtn = this.container.querySelector('[data-action="decrease"]');
      this.qtyIncreaseBtn = this.container.querySelector('[data-action="increase"]');

      // Button elements
      this.buttonText = this.addButton?.querySelector('.wishcraft-button-text');
      this.buttonLoader = this.addButton?.querySelector('.wishcraft-button-loader');
    }

    bindEvents() {
      // Add to registry button
      if (this.addButton) {
        this.addButton.addEventListener('click', this.handleAddToRegistry.bind(this));
      }

      // Create new registry button
      if (this.createButton) {
        this.createButton.addEventListener('click', this.handleCreateRegistry.bind(this));
      }

      // Quantity controls
      if (this.qtyDecreaseBtn) {
        this.qtyDecreaseBtn.addEventListener('click', () => this.updateQuantity(-1));
      }
      if (this.qtyIncreaseBtn) {
        this.qtyIncreaseBtn.addEventListener('click', () => this.updateQuantity(1));
      }

      // Quantity input validation
      if (this.quantityInput) {
        this.quantityInput.addEventListener('input', this.validateQuantity.bind(this));
        this.quantityInput.addEventListener('blur', this.normalizeQuantity.bind(this));
      }

      // Registry selection change
      if (this.registrySelect) {
        this.registrySelect.addEventListener('change', this.handleRegistryChange.bind(this));
      }

      // Variant selection change  
      if (this.variantSelect) {
        this.variantSelect.addEventListener('change', this.handleVariantChange.bind(this));
      }

      // Form validation
      const inputs = [this.registrySelect, this.variantSelect, this.quantityInput];
      inputs.forEach(input => {
        if (input) {
          input.addEventListener('change', utils.debounce(this.validateForm.bind(this), CONFIG.debounceDelay));
        }
      });
    }

    async loadRegistries() {
      if (!this.registrySelect) return;

      try {
        this.setLoadingState(true, 'Loading registries...');
        
        const response = await this.api.getCustomerRegistries();
        this.registries = response.registries || [];
        
        this.populateRegistrySelect();
        this.validateForm();
      } catch (error) {
        this.showError(error.message);
        this.registrySelect.innerHTML = '<option value="" disabled>Failed to load registries</option>';
      } finally {
        this.setLoadingState(false);
      }
    }

    populateRegistrySelect() {
      if (!this.registrySelect || !this.registries) return;

      this.registrySelect.innerHTML = '';

      if (this.registries.length === 0) {
        this.registrySelect.innerHTML = '<option value="" disabled>No registries found</option>';
        return;
      }

      // Add default option
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = 'Choose a registry...';
      defaultOption.disabled = true;
      defaultOption.selected = true;
      this.registrySelect.appendChild(defaultOption);

      // Add registry options
      this.registries.forEach(registry => {
        const option = document.createElement('option');
        option.value = registry.id;
        option.textContent = `${registry.title} (${registry.itemCount || 0} items)`;
        this.registrySelect.appendChild(option);
      });
    }

    async handleAddToRegistry(event) {
      event.preventDefault();
      
      if (this.isLoading || !this.validateForm()) {
        return;
      }

      try {
        this.setLoadingState(true);
        
        const productData = this.getProductData();
        const registryId = this.registrySelect.value;
        
        const response = await this.api.addToRegistry(registryId, productData);
        
        this.showSuccess('Item added to registry successfully!');
        this.trackEvent('add_to_registry', {
          product_id: productData.productId,
          registry_id: registryId,
          quantity: productData.quantity
        });

        // Optional: Reset form or update UI
        this.resetForm();
        
      } catch (error) {
        this.showError(error.message);
      } finally {
        this.setLoadingState(false);
      }
    }

    async handleCreateRegistry() {
      // For now, redirect to account page where they can create registries
      // In a full implementation, this might open a modal
      const returnUrl = encodeURIComponent(window.location.href);
      window.location.href = `/account/registries/new?return_url=${returnUrl}`;
    }

    handleRegistryChange() {
      this.validateForm();
      
      // Clear any previous messages
      if (this.messageElement) {
        this.messageElement.style.display = 'none';
      }
    }

    handleVariantChange() {
      this.validateForm();
      
      // Update quantity limits based on variant inventory
      if (this.variantSelect && this.quantityInput) {
        const selectedOption = this.variantSelect.selectedOptions[0];
        if (selectedOption) {
          const isAvailable = selectedOption.dataset.available === 'true';
          this.quantityInput.disabled = !isAvailable;
          
          if (!isAvailable) {
            this.showError('Selected variant is out of stock');
          }
        }
      }
    }

    updateQuantity(delta) {
      if (!this.quantityInput) return;

      const currentValue = parseInt(this.quantityInput.value) || 1;
      const newValue = Math.max(1, Math.min(99, currentValue + delta));
      
      this.quantityInput.value = newValue;
      this.validateForm();
    }

    validateQuantity() {
      if (!this.quantityInput) return;

      const value = parseInt(this.quantityInput.value);
      if (isNaN(value) || value < 1) {
        this.quantityInput.value = 1;
      } else if (value > 99) {
        this.quantityInput.value = 99;
      }
    }

    normalizeQuantity() {
      if (!this.quantityInput) return;
      
      const value = parseInt(this.quantityInput.value) || 1;
      this.quantityInput.value = Math.max(1, Math.min(99, value));
      this.validateForm();
    }

    validateForm() {
      if (!this.addButton) return false;

      const isValid = this.registrySelect?.value && 
                     this.quantityInput?.value && 
                     parseInt(this.quantityInput.value) > 0 &&
                     (!this.variantSelect || this.variantSelect.value || this.variantSelect.options.length <= 1);

      this.addButton.disabled = !isValid || this.isLoading;
      
      return isValid;
    }

    getProductData() {
      const selectedPriority = [...this.priorityInputs].find(input => input.checked);
      
      return {
        productId: this.addButton.dataset.productId,
        productTitle: this.addButton.dataset.productTitle,
        productHandle: this.addButton.dataset.productHandle,
        productImage: this.addButton.dataset.productImage,
        productUrl: this.addButton.dataset.productUrl,
        variantId: this.variantSelect?.value || null,
        quantity: parseInt(this.quantityInput?.value) || 1,
        priority: selectedPriority?.value || 'medium',
        notes: this.notesInput?.value?.trim() || null
      };
    }

    setLoadingState(loading, message = '') {
      this.isLoading = loading;
      
      if (!this.addButton) return;

      this.addButton.disabled = loading;
      this.addButton.classList.toggle('loading', loading);
      
      if (loading && message && this.registrySelect) {
        this.registrySelect.innerHTML = `<option value="" disabled selected>${message}</option>`;
      }
    }

    showSuccess(message) {
      if (this.messageElement) {
        utils.showMessage(this.messageElement, 'success', message);
      }
    }

    showError(message) {
      if (this.messageElement) {
        utils.showMessage(this.messageElement, 'error', message);
      }
    }

    showInfo(message) {
      if (this.messageElement) {
        utils.showMessage(this.messageElement, 'info', message);
      }
    }

    resetForm() {
      // Reset to default values after successful addition
      if (this.quantityInput) {
        this.quantityInput.value = 1;
      }
      
      if (this.notesInput) {
        this.notesInput.value = '';
      }
      
      // Reset priority to medium
      const mediumPriority = [...this.priorityInputs].find(input => input.value === 'medium');
      if (mediumPriority) {
        mediumPriority.checked = true;
      }
    }

    trackEvent(eventName, data = {}) {
      // Analytics tracking - integrate with your analytics service
      if (window.gtag) {
        window.gtag('event', eventName, {
          event_category: 'registry',
          event_label: data.product_id,
          value: data.quantity,
          ...data
        });
      }
      
      // Also track via Shopify Analytics if available
      if (window.ShopifyAnalytics) {
        window.ShopifyAnalytics.track(eventName, data);
      }
    }
  }

  // Registry List Component (for viewing registries)
  class RegistryListComponent {
    constructor(blockId) {
      this.blockId = blockId;
      this.container = document.querySelector(`[data-block-id="${blockId}"]`);
      this.api = new RegistryAPI();

      if (!this.container) {
        console.warn(`RegistryList container not found for block ${blockId}`);
        return;
      }

      this.initElements();
      this.loadRegistry();
    }

    initElements() {
      this.itemsContainer = this.container.querySelector(`#registry-items-${this.blockId}`);
      this.registryId = this.container.dataset.registryId;
    }

    async loadRegistry() {
      if (!this.registryId || !this.itemsContainer) return;

      try {
        this.itemsContainer.innerHTML = '<div class="loading">Loading registry items...</div>';
        
        const response = await utils.fetchWithRetry(`${CONFIG.apiPath}/registries/${this.registryId}/public`);
        
        this.renderRegistryItems(response.items || []);
      } catch (error) {
        this.itemsContainer.innerHTML = `<div class="error">Failed to load registry: ${error.message}</div>`;
      }
    }

    renderRegistryItems(items) {
      if (!this.itemsContainer) return;

      if (items.length === 0) {
        this.itemsContainer.innerHTML = '<div class="empty">This registry is empty.</div>';
        return;
      }

      const itemsHtml = items.map(item => this.renderRegistryItem(item)).join('');
      this.itemsContainer.innerHTML = `<div class="registry-items-grid">${itemsHtml}</div>`;
      
      // Bind purchase buttons
      this.bindPurchaseButtons();
    }

    renderRegistryItem(item) {
      const progress = item.quantity > 0 ? Math.round((item.quantityPurchased / item.quantity) * 100) : 0;
      const isCompleted = item.quantityPurchased >= item.quantity;
      const remaining = Math.max(0, item.quantity - item.quantityPurchased);

      return `
        <shopify-card class="registry-item" data-item-id="${item.id}">
          <div class="registry-item__image">
            <img src="${item.productImage || '/assets/placeholder.png'}" 
                 alt="${item.productTitle}" 
                 loading="lazy">
          </div>
          <div class="registry-item__content">
            <shopify-text variant="headingMd" as="h4">${item.productTitle}</shopify-text>
            ${item.notes ? `<shopify-text variant="bodyMd" color="subdued">${item.notes}</shopify-text>` : ''}
            <shopify-text variant="bodyLg" weight="semibold">
              ${utils.formatMoney(item.price * 100)}
              ${item.quantity > 1 ? ` × ${item.quantity}` : ''}
            </shopify-text>
            <div class="registry-item__progress">
              <shopify-progress-bar progress="${progress}" size="medium"></shopify-progress-bar>
              <shopify-text variant="bodySm" color="subdued">
                ${item.quantityPurchased} of ${item.quantity} purchased
              </shopify-text>
            </div>
            ${!isCompleted ? `
              <shopify-button variant="primary" 
                             data-item-id="${item.id}"
                             data-product-handle="${item.productHandle}"
                             data-variant-id="${item.variantId}"
                             class="registry-item__purchase-btn">
                ${remaining === 1 ? 'Purchase This Gift' : `Purchase (${remaining} remaining)`}
              </shopify-button>
            ` : `
              <shopify-badge tone="success">
                <span>✓ Fully purchased</span>
              </shopify-badge>
            `}
          </div>
        </shopify-card>
      `;
    }

    bindPurchaseButtons() {
      const purchaseButtons = this.container.querySelectorAll('.registry-item__purchase-btn');
      purchaseButtons.forEach(button => {
        button.addEventListener('click', this.handlePurchase.bind(this));
      });
    }

    async handlePurchase(event) {
      const button = event.target;
      const itemId = button.dataset.itemId;
      const productHandle = button.dataset.productHandle;
      const variantId = button.dataset.variantId;

      // Track the purchase intent
      this.trackEvent('purchase_intent', {
        item_id: itemId,
        registry_id: this.registryId
      });

      // Add to cart and redirect to checkout
      try {
        // Add to Shopify cart
        const cartData = {
          id: variantId,
          quantity: 1,
          properties: {
            '_registry_id': this.registryId,
            '_registry_item_id': itemId,
            '_gift_purchase': 'true'
          }
        };

        const response = await fetch('/cart/add.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(cartData)
        });

        if (response.ok) {
          // Redirect to cart/checkout
          window.location.href = '/cart';
        } else {
          throw new Error('Failed to add to cart');
        }
      } catch (error) {
        console.error('Purchase failed:', error);
        alert('Failed to add item to cart. Please try again.');
      }
    }

    trackEvent(eventName, data = {}) {
      // Same tracking as AddToRegistryComponent
      if (window.gtag) {
        window.gtag('event', eventName, {
          event_category: 'registry',
          ...data
        });
      }
      
      if (window.ShopifyAnalytics) {
        window.ShopifyAnalytics.track(eventName, data);
      }
    }
  }

  // Global WishCraft Registry object
  window.WishCraftRegistry = {
    // Component instances
    components: new Map(),

    // Initialize Add to Registry component
    initAddToRegistry(blockId) {
      if (!this.components.has(blockId)) {
        this.components.set(blockId, new AddToRegistryComponent(blockId));
      }
      return this.components.get(blockId);
    },

    // Initialize Registry List component
    initRegistryList(blockId) {
      if (!this.components.has(blockId)) {
        this.components.set(blockId, new RegistryListComponent(blockId));
      }
      return this.components.get(blockId);
    },

    // Utility functions
    utils,
    RegistryAPI,

    // Configuration
    config: CONFIG
  };

  // Auto-initialize components when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeComponents);
  } else {
    initializeComponents();
  }

  function initializeComponents() {
    // Auto-detect and initialize Add to Registry components
    const addToRegistryBlocks = document.querySelectorAll('.wishcraft-add-to-registry[data-block-id]');
    addToRegistryBlocks.forEach(block => {
      const blockId = block.dataset.blockId;
      window.WishCraftRegistry.initAddToRegistry(blockId);
    });

    // Auto-detect and initialize Registry List components
    const registryListBlocks = document.querySelectorAll('.registry-list[data-block-id]');
    registryListBlocks.forEach(block => {
      const blockId = block.dataset.blockId;
      window.WishCraftRegistry.initRegistryList(blockId);
    });
  }

  // Debug mode
  if (window.location.search.includes('wishcraft_debug=true')) {
    window.WishCraftRegistry.debug = true;
    console.log('WishCraft Registry Debug Mode Enabled');
  }

})();