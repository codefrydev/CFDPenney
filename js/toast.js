// Toast Notification System
// Elegant, accessible toast notifications to replace basic alerts

class ToastManager {
    constructor(options = {}) {
        this.options = {
            position: options.position || 'top-right',
            maxToasts: options.maxToasts || 5,
            defaultDuration: options.defaultDuration || 3000,
            ...options
        };
        
        this.toasts = [];
        this.container = null;
        
        this.init();
    }
    
    init() {
        this.createContainer();
    }
    
    createContainer() {
        this.container = document.createElement('div');
        this.container.className = `toast-container toast-${this.options.position}`;
        this.container.setAttribute('aria-live', 'polite');
        this.container.setAttribute('aria-atomic', 'false');
        document.body.appendChild(this.container);
    }
    
    show(message, options = {}) {
        const type = options.type || 'info';
        const duration = options.duration !== undefined ? options.duration : this.options.defaultDuration;
        const action = options.action || null;
        const dismissible = options.dismissible !== false;
        
        // Remove oldest toast if at max capacity
        if (this.toasts.length >= this.options.maxToasts) {
            const oldestToast = this.toasts[0];
            this.remove(oldestToast.id);
        }
        
        // Create toast
        const toast = this.createToast(message, type, duration, action, dismissible);
        this.toasts.push(toast);
        this.container.appendChild(toast.element);
        
        // Animate in
        requestAnimationFrame(() => {
            toast.element.classList.add('toast-show');
        });
        
        // Auto-dismiss
        if (duration > 0) {
            toast.timeout = setTimeout(() => {
                this.remove(toast.id);
            }, duration);
        }
        
        return toast.id;
    }
    
    createToast(message, type, duration, action, dismissible) {
        const id = 'toast-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        
        const element = document.createElement('div');
        element.className = `toast toast-${type}`;
        element.setAttribute('role', 'status');
        element.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
        element.id = id;
        
        // Icon
        const icons = {
            success: 'check-circle',
            error: 'x-circle',
            warning: 'alert-triangle',
            info: 'info'
        };
        
        const iconHtml = `<i data-lucide="${icons[type] || 'info'}" class="toast-icon"></i>`;
        
        // Message
        const messageHtml = `<div class="toast-message">${message}</div>`;
        
        // Action button
        let actionHtml = '';
        if (action) {
            actionHtml = `<button class="toast-action" data-action="${action.id || 'action'}">${action.label || 'Action'}</button>`;
        }
        
        // Dismiss button
        let dismissHtml = '';
        if (dismissible) {
            dismissHtml = `<button class="toast-dismiss" aria-label="Dismiss notification"><i data-lucide="x" class="w-4 h-4"></i></button>`;
        }
        
        element.innerHTML = `
            <div class="toast-content">
                ${iconHtml}
                ${messageHtml}
            </div>
            <div class="toast-actions">
                ${actionHtml}
                ${dismissHtml}
            </div>
        `;
        
        // Event listeners
        if (dismissible) {
            const dismissBtn = element.querySelector('.toast-dismiss');
            dismissBtn.addEventListener('click', () => this.remove(id));
        }
        
        if (action) {
            const actionBtn = element.querySelector('.toast-action');
            actionBtn.addEventListener('click', () => {
                if (action.onClick) {
                    action.onClick();
                }
                this.remove(id);
            });
        }
        
        // Swipe to dismiss on touch devices
        this.setupSwipeDismiss(element, id);
        
        // Initialize Lucide icons
        if (window.lucide) {
            window.lucide.createIcons({nameAttr: 'data-lucide'});
        }
        
        return { id, element, timeout: null };
    }
    
    setupSwipeDismiss(element, id) {
        let startX = 0;
        let currentX = 0;
        let isDragging = false;
        
        element.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            isDragging = true;
        }, { passive: true });
        
        element.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            currentX = e.touches[0].clientX;
            const diff = currentX - startX;
            
            if (Math.abs(diff) > 10) {
                element.style.transform = `translateX(${diff}px)`;
                element.style.opacity = 1 - Math.abs(diff) / 200;
            }
        }, { passive: true });
        
        element.addEventListener('touchend', () => {
            if (!isDragging) return;
            isDragging = false;
            
            const diff = currentX - startX;
            
            if (Math.abs(diff) > 100) {
                // Dismiss
                element.style.transform = `translateX(${diff > 0 ? '100%' : '-100%'})`;
                element.style.opacity = '0';
                setTimeout(() => this.remove(id), 200);
            } else {
                // Reset
                element.style.transform = '';
                element.style.opacity = '';
            }
        });
    }
    
    remove(id) {
        const toastIndex = this.toasts.findIndex(t => t.id === id);
        if (toastIndex === -1) return;
        
        const toast = this.toasts[toastIndex];
        
        // Clear timeout
        if (toast.timeout) {
            clearTimeout(toast.timeout);
        }
        
        // Animate out
        toast.element.classList.remove('toast-show');
        toast.element.classList.add('toast-hide');
        
        setTimeout(() => {
            if (toast.element.parentNode) {
                toast.element.parentNode.removeChild(toast.element);
            }
            this.toasts.splice(toastIndex, 1);
        }, 300);
    }
    
    removeAll() {
        [...this.toasts].forEach(toast => this.remove(toast.id));
    }
    
    // Convenience methods
    success(message, options = {}) {
        return this.show(message, { ...options, type: 'success' });
    }
    
    error(message, options = {}) {
        return this.show(message, { ...options, type: 'error', duration: options.duration || 5000 });
    }
    
    warning(message, options = {}) {
        return this.show(message, { ...options, type: 'warning', duration: options.duration || 4000 });
    }
    
    info(message, options = {}) {
        return this.show(message, { ...options, type: 'info' });
    }
    
    destroy() {
        this.removeAll();
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}

// Global toast instance
let toastManager = null;

export function initToast(options = {}) {
    if (toastManager) {
        toastManager.destroy();
    }
    toastManager = new ToastManager(options);
    return toastManager;
}

export function showToast(message, options = {}) {
    if (!toastManager) {
        toastManager = new ToastManager();
    }
    return toastManager.show(message, options);
}

export function toast(message, options = {}) {
    return showToast(message, options);
}

// Convenience exports
export const toastSuccess = (message, options = {}) => {
    if (!toastManager) toastManager = new ToastManager();
    return toastManager.success(message, options);
};

export const toastError = (message, options = {}) => {
    if (!toastManager) toastManager = new ToastManager();
    return toastManager.error(message, options);
};

export const toastWarning = (message, options = {}) => {
    if (!toastManager) toastManager = new ToastManager();
    return toastManager.warning(message, options);
};

export const toastInfo = (message, options = {}) => {
    if (!toastManager) toastManager = new ToastManager();
    return toastManager.info(message, options);
};

export function removeToast(id) {
    if (toastManager) {
        toastManager.remove(id);
    }
}

export function removeAllToasts() {
    if (toastManager) {
        toastManager.removeAll();
    }
}

// Auto-initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initToast());
} else {
    initToast();
}
