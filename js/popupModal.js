// Popup Modal System for Alerts and Confirmations
// Replaces native alert() and confirm() with styled modals

let currentResolve = null;
let currentModal = null;

/**
 * Show an alert modal with a message and optional title
 * @param {string} message - The message to display
 * @param {string} [title='Alert'] - Optional title for the modal
 * @returns {Promise<void>} - Resolves when the user clicks OK
 */
export function showAlert(message, title = 'Alert') {
    return new Promise((resolve) => {
        // Close any existing modal
        closeModal();
        
        const overlay = document.getElementById('popup-modal-overlay');
        const modal = document.getElementById('popup-modal');
        const titleEl = document.getElementById('popup-modal-title');
        const messageEl = document.getElementById('popup-modal-message');
        const footer = document.getElementById('popup-modal-footer');
        const iconEl = document.querySelector('#popup-modal .modal-icon-container i');
        
        if (!overlay || !modal || !titleEl || !messageEl || !footer) {
            // Fallback to native alert if modal elements don't exist
            alert(message);
            resolve();
            return;
        }
        
        // Set content
        titleEl.textContent = title;
        messageEl.textContent = message;
        
        // Update icon for alert - use alert-triangle for better visibility
        if (iconEl) {
            iconEl.setAttribute('data-lucide', 'alert-triangle');
        }
        
        // Set up footer for alert (single OK button)
        footer.innerHTML = `
            <button id="popup-modal-ok" class="px-6 py-3 rounded-xl font-semibold text-white transition-all hover:shadow-lg popup-modal-btn-primary">
                OK
            </button>
        `;
        
        // Show modal
        overlay.classList.remove('hidden');
        modal.classList.remove('hidden');
        currentModal = { type: 'alert', resolve };
        
        // Refresh lucide icons
        if (window.lucide) {
            lucide.createIcons();
        }
        
        // Focus the OK button
        setTimeout(() => {
            const okBtn = document.getElementById('popup-modal-ok');
            if (okBtn) okBtn.focus();
        }, 100);
        
        // Set up event handlers
        const okBtn = document.getElementById('popup-modal-ok');
        const closeBtn = document.getElementById('popup-modal-close');
        
        if (okBtn) {
            okBtn.onclick = () => {
                closeModal();
                resolve();
            };
        }
        
        if (closeBtn) {
            closeBtn.onclick = () => {
                closeModal();
                resolve();
            };
        }
        
        // Handle ESC key
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                resolve();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
        
        // Store handler for cleanup
        if (!currentModal.handlers) currentModal.handlers = [];
        currentModal.handlers.push({ type: 'keydown', handler: escHandler });
    });
}

/**
 * Show a confirmation modal with a message and optional title
 * @param {string} message - The message to display
 * @param {string} [title='Confirm'] - Optional title for the modal
 * @returns {Promise<boolean>} - Resolves to true if OK clicked, false if Cancel clicked
 */
export function showConfirm(message, title = 'Confirm') {
    return new Promise((resolve) => {
        // Close any existing modal
        closeModal();
        
        const overlay = document.getElementById('popup-modal-overlay');
        const modal = document.getElementById('popup-modal');
        const titleEl = document.getElementById('popup-modal-title');
        const messageEl = document.getElementById('popup-modal-message');
        const footer = document.getElementById('popup-modal-footer');
        const iconEl = document.querySelector('#popup-modal .modal-icon-container i');
        
        if (!overlay || !modal || !titleEl || !messageEl || !footer) {
            // Fallback to native confirm if modal elements don't exist
            const result = confirm(message);
            resolve(result);
            return;
        }
        
        // Set content
        titleEl.textContent = title;
        messageEl.textContent = message;
        
        // Update icon for confirmation
        if (iconEl) {
            iconEl.setAttribute('data-lucide', 'help-circle');
        }
        
        // Set up footer for confirmation (OK and Cancel buttons)
        footer.innerHTML = `
            <button id="popup-modal-cancel" class="px-6 py-3 rounded-xl font-semibold transition-all hover:shadow-lg popup-modal-btn-secondary">
                Cancel
            </button>
            <button id="popup-modal-ok" class="px-6 py-3 rounded-xl font-semibold text-white transition-all hover:shadow-lg popup-modal-btn-primary">
                OK
            </button>
        `;
        
        // Show modal
        overlay.classList.remove('hidden');
        modal.classList.remove('hidden');
        currentModal = { type: 'confirm', resolve };
        
        // Refresh lucide icons
        if (window.lucide) {
            lucide.createIcons();
        }
        
        // Focus the Cancel button (safer default)
        setTimeout(() => {
            const cancelBtn = document.getElementById('popup-modal-cancel');
            if (cancelBtn) cancelBtn.focus();
        }, 100);
        
        // Set up event handlers
        const okBtn = document.getElementById('popup-modal-ok');
        const cancelBtn = document.getElementById('popup-modal-cancel');
        const closeBtn = document.getElementById('popup-modal-close');
        
        if (okBtn) {
            okBtn.onclick = () => {
                closeModal();
                resolve(true);
            };
        }
        
        if (cancelBtn) {
            cancelBtn.onclick = () => {
                closeModal();
                resolve(false);
            };
        }
        
        if (closeBtn) {
            closeBtn.onclick = () => {
                closeModal();
                resolve(false); // Close button acts as Cancel for confirmations
            };
        }
        
        // Handle ESC key (acts as Cancel)
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                resolve(false);
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
        
        // Store handler for cleanup
        if (!currentModal.handlers) currentModal.handlers = [];
        currentModal.handlers.push({ type: 'keydown', handler: escHandler });
    });
}

/**
 * Close the current modal
 */
function closeModal() {
    const overlay = document.getElementById('popup-modal-overlay');
    const modal = document.getElementById('popup-modal');
    
    if (overlay) overlay.classList.add('hidden');
    if (modal) modal.classList.add('hidden');
    
    // Clean up event handlers
    if (currentModal && currentModal.handlers) {
        currentModal.handlers.forEach(({ type, handler }) => {
            document.removeEventListener(type, handler);
        });
    }
    
    currentModal = null;
    currentResolve = null;
}

/**
 * Handle overlay click to close modal (only for alerts, not confirmations)
 */
export function handlePopupModalOverlayClick(event) {
    const overlay = document.getElementById('popup-modal-overlay');
    if (event.target === overlay && currentModal && currentModal.type === 'alert') {
        // Only close alerts on overlay click, not confirmations
        closeModal();
        if (currentModal.resolve) {
            currentModal.resolve();
        }
    }
}

// Make functions globally available for inline handlers
window.showAlert = showAlert;
window.showConfirm = showConfirm;
window.handlePopupModalOverlayClick = handlePopupModalOverlayClick;

