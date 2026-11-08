/**
 * Small-Shop Inventory Tracker
 * Vanilla JavaScript implementation using localStorage
 */

(function () {
  'use strict';

  // Constants & Storage Key
  const STORAGE_KEY = 'shop_inventory_items_v1';

  // State
  let products = [];
  let searchQuery = '';
  let productToDeleteId = null;

  // DOM Elements - Form & Inputs
  const addForm = document.getElementById('add-product-form');
  const nameInput = document.getElementById('product-name');
  const qtyInput = document.getElementById('product-qty');
  const priceInput = document.getElementById('product-price');
  const nameError = document.getElementById('name-error');
  const qtyError = document.getElementById('qty-error');
  const priceError = document.getElementById('price-error');

  // DOM Elements - Search
  const searchInput = document.getElementById('search-input');
  const clearSearchBtn = document.getElementById('clear-search-btn');

  // DOM Elements - Inventory Container & Stats
  const inventoryContainer = document.getElementById('inventory-container');
  const totalProductsCount = document.getElementById('total-products-count');
  const totalUnitsCount = document.getElementById('total-units-count');
  const totalInventoryValue = document.getElementById('total-inventory-value');
  const inventorySubtext = document.getElementById('inventory-subtext');

  // DOM Elements - Edit Modal
  const editModal = document.getElementById('edit-modal');
  const editForm = document.getElementById('edit-product-form');
  const editIdInput = document.getElementById('edit-product-id');
  const editNameInput = document.getElementById('edit-product-name');
  const editQtyInput = document.getElementById('edit-product-qty');
  const editPriceInput = document.getElementById('edit-product-price');
  const editNameError = document.getElementById('edit-name-error');
  const editQtyError = document.getElementById('edit-qty-error');
  const editPriceError = document.getElementById('edit-price-error');
  const closeEditModalBtn = document.getElementById('close-edit-modal-btn');
  const cancelEditBtn = document.getElementById('cancel-edit-btn');

  // DOM Elements - Delete Modal
  const deleteModal = document.getElementById('delete-modal');
  const deleteModalMsg = document.getElementById('delete-modal-message');
  const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
  const confirmDeleteBtn = document.getElementById('confirm-delete-btn');

  // Currency Formatter
  const currencyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Number Formatter (with commas)
  const integerFormatter = new Intl.NumberFormat('en-US');

  /**
   * Safe HTML Escaper to prevent XSS
   */
  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Load products from localStorage
   */
  function loadProducts() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          products = parsed;
          return;
        }
      }
    } catch (e) {
      console.error('Failed to parse inventory from localStorage', e);
    }
    products = [];
  }

  /**
   * Save products to localStorage
   */
  function saveProducts() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    } catch (e) {
      console.error('Failed to save inventory to localStorage', e);
      alert('Warning: Storage is full or unavailable. Changes could not be saved.');
    }
  }

  /**
   * Update top summary stats
   */
  function updateStats() {
    const totalCount = products.length;
    const totalUnits = products.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
    const totalValue = products.reduce((sum, p) => sum + (Number(p.quantity) || 0) * (Number(p.price) || 0), 0);

    totalProductsCount.textContent = integerFormatter.format(totalCount);
    totalUnitsCount.textContent = integerFormatter.format(totalUnits);
    totalInventoryValue.textContent = currencyFormatter.format(totalValue);

    if (totalCount === 1) {
      inventorySubtext.textContent = 'Showing 1 product in inventory';
    } else {
      inventorySubtext.textContent = `Managing ${integerFormatter.format(totalCount)} products in inventory`;
    }
  }

  /**
   * Determine stock status badge markup
   */
  function getStockBadge(qty) {
    const quantity = Number(qty) || 0;
    if (quantity === 0) {
      return `<span class="stock-badge stock-out">Out of Stock (0)</span>`;
    }
    if (quantity <= 5) {
      return `<span class="stock-badge stock-low">Low Stock (${integerFormatter.format(quantity)})</span>`;
    }
    return `<span class="stock-badge stock-in">In Stock (${integerFormatter.format(quantity)})</span>`;
  }

  /**
   * Render the product list or appropriate empty state
   */
  function render() {
    updateStats();

    // Determine filtered products
    const query = searchQuery.trim().toLowerCase();
    const filtered = query
      ? products.filter((p) => p.name.toLowerCase().includes(query))
      : products;

    // Toggle Clear Search Button
    if (query) {
      clearSearchBtn.classList.remove('hidden');
    } else {
      clearSearchBtn.classList.add('hidden');
    }

    // State 1: Global inventory is completely empty
    if (products.length === 0) {
      inventoryContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon" aria-hidden="true">📦</div>
          <h3>Your inventory is empty</h3>
          <p>You haven't added any products yet. Use the form above to add your first product to start tracking your shop's stock and prices!</p>
        </div>
      `;
      return;
    }

    // State 2: Active search has no results
    if (filtered.length === 0) {
      inventoryContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon" aria-hidden="true">🔍</div>
          <h3>No matching products found</h3>
          <p>No products in your inventory match <strong>"${escapeHtml(query)}"</strong>.</p>
          <button type="button" class="btn btn-secondary" id="reset-search-btn" style="margin-top: 0.5rem;">
            Clear Search
          </button>
        </div>
      `;
      const resetSearchBtn = document.getElementById('reset-search-btn');
      if (resetSearchBtn) {
        resetSearchBtn.addEventListener('click', () => {
          searchInput.value = '';
          searchQuery = '';
          render();
          searchInput.focus();
        });
      }
      return;
    }

    // State 3: Render list of products
    let html = `
      <div class="inventory-table-header col-desktop">
        <span>Product Name</span>
        <span>Stock Status</span>
        <span>Selling Price</span>
        <span>Total Value</span>
        <span style="text-align: right; padding-right: 0.5rem;">Actions</span>
      </div>
    `;
    filtered.forEach((product) => {
      const escapedName = escapeHtml(product.name);
      const qtyNum = Number(product.quantity) || 0;
      const priceNum = Number(product.price) || 0;
      const totalNum = qtyNum * priceNum;

      const formattedPrice = currencyFormatter.format(priceNum);
      const formattedTotal = currencyFormatter.format(totalNum);
      const badgeHtml = getStockBadge(qtyNum);

      html += `
        <article class="product-row" data-id="${product.id}">
          <!-- Column 1: Name & Mobile details -->
          <div class="product-name-col">
            <span class="product-title">${escapedName}</span>
            <div class="product-meta-mobile">
              ${badgeHtml}
              <div class="product-meta-item">
                <span>Price:</span>
                <strong>${formattedPrice}</strong>
              </div>
              <div class="product-meta-item">
                <span>Total:</span>
                <strong>${formattedTotal}</strong>
              </div>
            </div>
          </div>

          <!-- Column 2 (Desktop): Stock Badge -->
          <div class="col-desktop">
            ${badgeHtml}
          </div>

          <!-- Column 3 (Desktop): Unit Price -->
          <div class="col-desktop product-price">
            ${formattedPrice}
          </div>

          <!-- Column 4 (Desktop): Total Value -->
          <div class="col-desktop product-total">
            ${formattedTotal}
          </div>

          <!-- Column 5: Action Buttons -->
          <div class="product-actions">
            <button 
              type="button" 
              class="btn btn-action btn-edit" 
              data-action="edit" 
              data-id="${product.id}"
              aria-label="Edit ${escapedName}"
            >
              ✏️ Edit
            </button>
            <button 
              type="button" 
              class="btn btn-action btn-delete" 
              data-action="delete" 
              data-id="${product.id}"
              aria-label="Delete ${escapedName}"
            >
              🗑️ Delete
            </button>
          </div>
        </article>
      `;
    });

    inventoryContainer.innerHTML = html;
  }

  /**
   * Form Validation Helpers
   */
  function clearErrors() {
    nameError.textContent = '';
    qtyError.textContent = '';
    priceError.textContent = '';
    nameInput.classList.remove('input-error');
    qtyInput.classList.remove('input-error');
    priceInput.classList.remove('input-error');
  }

  function validateProductInput(name, qty, price, targets) {
    let isValid = true;

    // Validate Name
    if (!name || name.trim() === '') {
      targets.nameError.textContent = 'Please enter a product name.';
      targets.nameInput.classList.add('input-error');
      isValid = false;
    } else {
      targets.nameError.textContent = '';
      targets.nameInput.classList.remove('input-error');
    }

    // Validate Quantity (must be integer >= 0)
    const qtyNum = Number(qty);
    if (qty === '' || isNaN(qtyNum) || !Number.isInteger(qtyNum) || qtyNum < 0) {
      targets.qtyError.textContent = 'Quantity must be a whole number (0 or greater).';
      targets.qtyInput.classList.add('input-error');
      isValid = false;
    } else {
      targets.qtyError.textContent = '';
      targets.qtyInput.classList.remove('input-error');
    }

    // Validate Price (must be number >= 0)
    const priceNum = Number(price);
    if (price === '' || isNaN(priceNum) || priceNum < 0) {
      targets.priceError.textContent = 'Price must be a valid positive amount ($0.00 or greater).';
      targets.priceInput.classList.add('input-error');
      isValid = false;
    } else {
      targets.priceError.textContent = '';
      targets.priceInput.classList.remove('input-error');
    }

    return isValid;
  }

  /**
   * Handle Add Product
   */
  function handleAddProduct(e) {
    e.preventDefault();

    const name = nameInput.value;
    const qty = qtyInput.value;
    const price = priceInput.value;

    const isValid = validateProductInput(name, qty, price, {
      nameInput,
      nameError,
      qtyInput,
      qtyError,
      priceInput,
      priceError,
    });

    if (!isValid) return;

    const newProduct = {
      id: 'prod_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      name: name.trim(),
      quantity: parseInt(qty, 10),
      price: parseFloat(parseFloat(price).toFixed(2)),
      createdAt: Date.now(),
    };

    // Add to top of list
    products.unshift(newProduct);
    saveProducts();
    render();

    // Reset Form
    addForm.reset();
    clearErrors();
    nameInput.focus();
  }

  /**
   * Open Edit Modal
   */
  function openEditModal(productId) {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    // Reset edit errors
    editNameError.textContent = '';
    editQtyError.textContent = '';
    editPriceError.textContent = '';
    editNameInput.classList.remove('input-error');
    editQtyInput.classList.remove('input-error');
    editPriceInput.classList.remove('input-error');

    // Populate inputs
    editIdInput.value = product.id;
    editNameInput.value = product.name;
    editQtyInput.value = product.quantity;
    editPriceInput.value = product.price;

    // Show modal
    editModal.classList.remove('hidden');
    editNameInput.focus();
  }

  /**
   * Close Edit Modal
   */
  function closeEditModal() {
    editModal.classList.add('hidden');
    editForm.reset();
  }

  /**
   * Handle Save Edit
   */
  function handleSaveEdit(e) {
    e.preventDefault();

    const id = editIdInput.value;
    const name = editNameInput.value;
    const qty = editQtyInput.value;
    const price = editPriceInput.value;

    const isValid = validateProductInput(name, qty, price, {
      nameInput: editNameInput,
      nameError: editNameError,
      qtyInput: editQtyInput,
      qtyError: editQtyError,
      priceInput: editPriceInput,
      priceError: editPriceError,
    });

    if (!isValid) return;

    const productIndex = products.findIndex((p) => p.id === id);
    if (productIndex !== -1) {
      products[productIndex].name = name.trim();
      products[productIndex].quantity = parseInt(qty, 10);
      products[productIndex].price = parseFloat(parseFloat(price).toFixed(2));
      products[productIndex].updatedAt = Date.now();

      saveProducts();
      render();
      closeEditModal();
    }
  }

  /**
   * Open Delete Confirmation Modal
   */
  function openDeleteModal(productId) {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    productToDeleteId = productId;
    deleteModalMsg.innerHTML = `Are you sure you want to delete <strong>"${escapeHtml(product.name)}"</strong>? This action cannot be undone.`;
    deleteModal.classList.remove('hidden');
    confirmDeleteBtn.focus();
  }

  /**
   * Close Delete Modal
   */
  function closeDeleteModal() {
    deleteModal.classList.add('hidden');
    productToDeleteId = null;
  }

  /**
   * Handle Confirm Delete
   */
  function handleConfirmDelete() {
    if (!productToDeleteId) return;

    products = products.filter((p) => p.id !== productToDeleteId);
    saveProducts();
    render();
    closeDeleteModal();
  }

  /**
   * Event Delegation for Edit & Delete buttons in inventory list
   */
  function handleInventoryActions(e) {
    const target = e.target.closest('button[data-action]');
    if (!target) return;

    const action = target.getAttribute('data-action');
    const id = target.getAttribute('data-id');

    if (action === 'edit') {
      openEditModal(id);
    } else if (action === 'delete') {
      openDeleteModal(id);
    }
  }

  /**
   * Bind all event listeners
   */
  function initEvents() {
    // Add product form
    addForm.addEventListener('submit', handleAddProduct);

    // Real-time input clearing of errors
    nameInput.addEventListener('input', () => {
      if (nameInput.value.trim() !== '') {
        nameError.textContent = '';
        nameInput.classList.remove('input-error');
      }
    });
    qtyInput.addEventListener('input', () => {
      if (qtyInput.value !== '' && Number(qtyInput.value) >= 0) {
        qtyError.textContent = '';
        qtyInput.classList.remove('input-error');
      }
    });
    priceInput.addEventListener('input', () => {
      if (priceInput.value !== '' && Number(priceInput.value) >= 0) {
        priceError.textContent = '';
        priceInput.classList.remove('input-error');
      }
    });

    // Real-time search
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      render();
    });

    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      render();
      searchInput.focus();
    });

    // Inventory list delegated actions
    inventoryContainer.addEventListener('click', handleInventoryActions);

    // Edit modal events
    editForm.addEventListener('submit', handleSaveEdit);
    closeEditModalBtn.addEventListener('click', closeEditModal);
    cancelEditBtn.addEventListener('click', closeEditModal);

    // Delete modal events
    confirmDeleteBtn.addEventListener('click', handleConfirmDelete);
    cancelDeleteBtn.addEventListener('click', closeDeleteModal);

    // Close modals on clicking outside / backdrop
    editModal.addEventListener('click', (e) => {
      if (e.target === editModal) closeEditModal();
    });
    deleteModal.addEventListener('click', (e) => {
      if (e.target === deleteModal) closeDeleteModal();
    });

    // Keyboard support: Escape key closes active modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!editModal.classList.contains('hidden')) {
          closeEditModal();
        }
        if (!deleteModal.classList.contains('hidden')) {
          closeDeleteModal();
        }
      }
    });
  }

  /**
   * Application Initialization
   */
  function init() {
    loadProducts();
    initEvents();
    render();
  }

  // Start app when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
