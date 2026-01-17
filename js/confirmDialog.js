// Confirmation Dialog System
// Elegant confirmation dialogs for destructive actions

class ConfirmDialog {
    constructor() {
        this.activeDialog = null;
        this.init();
    }
    
    init() {
        this.createContainer();
    }
    
    createContainer() {
        if (document.getElementById('confirm-dialog-container')) {
            return;
        }
        
        const container = document.createElement('div');
        container.id = 'confirm-dialog-container';
        container.className = 'confirm-dialog-overlay hidden';
        container.innerHTML = `
            <div class="confirm-dialog" role="alertdialog" aria-labelledby="confirm-title" aria-describedby="confirm-message" aria-modal="true">
                <div class="confirm-dialog-header">
                    <h3 id="confirm-title" class="confirm-dialog-title"></h3>
                </div>
                <div class="confirm-dialog-body">
                    <p id="confirm-message" class="confirm-dialog-message"></p>
                    <div id="confirm-checkbox-container" class="confirm-dialog-checkbox hidden">
                        <label class="flex items-center gap-2">
                            <input type="checkbox" id="confirm-checkbox" class="checkbox">
                            <span id="confirm-checkbox-label"></span>
                        </label>
                    </div>
                </div>
                <div class="confirm-dialog-footer">
                    <button id="confirm-cancel-btn" class="btn btn-secondary">Cancel</button>
                    <button id="confirm-confirm-btn" class="btn btn-danger">Confirm</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(container);
        
        // Event listeners
        const overlay = container;
        const cancelBtn = document.getElementById('confirm-cancel-btn');
        const confirmBtn = document.getElementById('confirm-confirm-btn');
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.close(false);
            }
        });
        
        cancelBtn.addEventListener('click', () => this.close(false));
        confirmBtn.addEventListener('click', () => this.close(true));
        
        // Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activeDialog) {
                this.close(false);
            }
        });
    }
    
    show(options = {}) {
        return new Promise((resolve) => {
            const {
                title = 'Are you sure?',
                message = 'This action cannot be undone.',
                confirmText = 'Confirm',
                cancelText = 'Cancel',
                confirmClass = 'btn-danger',
                checkbox = null
            } = options;
            
            this.activeDialog = { resolve };
            
            // Update content
            document.getElementById('confirm-title').textContent = title;
            document.getElementById('confirm-message').textContent = message;
            document.getElementById('confirm-confirm-btn').textContent = confirmText;
            document.getElementById('confirm-cancel-btn').textContent = cancelText;
            
            // Update confirm button class
            const confirmBtn = document.getElementById('confirm-confirm-btn');
            confirmBtn.className = `btn ${confirmClass}`;
            
            // Checkbox option
            const checkboxContainer = document.getElementById('confirm-checkbox-container');
            const checkboxInput = document.getElementById('confirm-checkbox');
            const checkboxLabel = document.getElementById('confirm-checkbox-label');
            
            if (checkbox) {
                checkboxContainer.classList.remove('hidden');
                checkboxLabel.textContent = checkbox.label || "Don't ask me again";
                checkboxInput.checked = false;
            } else {
                checkboxContainer.classList.add('hidden');
            }
            
            // Show dialog
            const container = document.getElementById('confirm-dialog-container');
            container.classList.remove('hidden');
            
            // Focus management
            setTimeout(() => {
                document.getElementById('confirm-cancel-btn').focus();
            }, 100);
            
            // Trap focus within dialog
            this.trapFocus();
        });
    }
    
    close(confirmed) {
        if (!this.activeDialog) return;
        
        const checkboxInput = document.getElementById('confirm-checkbox');
        const checkboxChecked = !document.getElementById('confirm-checkbox-container').classList.contains('hidden') 
            && checkboxInput.checked;
        
        this.activeDialog.resolve({ confirmed, checkboxChecked });
        this.activeDialog = null;
        
        // Hide dialog
        const container = document.getElementById('confirm-dialog-container');
        container.classList.add('hidden');
        
        // Return focus to triggering element
        document.activeElement.blur();
    }
    
    trapFocus() {
        const dialog = document.querySelector('.confirm-dialog');
        const focusableElements = dialog.querySelectorAll(
            'button, input, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        dialog.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab') return;
            
            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                }
            } else {
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        });
    }
}

// Global instance
let confirmDialogInstance = null;

export function initConfirmDialog() {
    if (!confirmDialogInstance) {
        confirmDialogInstance = new ConfirmDialog();
    }
    return confirmDialogInstance;
}

export function confirm(options) {
    if (!confirmDialogInstance) {
        confirmDialogInstance = new ConfirmDialog();
    }
    return confirmDialogInstance.show(options);
}

// Auto-initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initConfirmDialog);
} else {
    initConfirmDialog();
}
