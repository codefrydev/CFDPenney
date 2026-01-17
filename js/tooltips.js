// Universal Tooltip System
// Provides consistent, accessible tooltips across the application

class TooltipManager {
    constructor(options = {}) {
        this.options = {
            delay: options.delay || 500,
            instantOnFocus: options.instantOnFocus !== false,
            position: options.position || 'top',
            offset: options.offset || 8,
            maxWidth: options.maxWidth || 300,
            ...options
        };
        
        this.activeTooltip = null;
        this.showTimeout = null;
        this.hideTimeout = null;
        
        this.init();
    }
    
    init() {
        // Create tooltip container
        this.createTooltipElement();
        
        // Setup event listeners using delegation
        document.addEventListener('mouseenter', this.handleMouseEnter.bind(this), true);
        document.addEventListener('mouseleave', this.handleMouseLeave.bind(this), true);
        document.addEventListener('focus', this.handleFocus.bind(this), true);
        document.addEventListener('blur', this.handleBlur.bind(this), true);
        
        // Hide tooltip on scroll
        window.addEventListener('scroll', this.hideTooltip.bind(this), true);
    }
    
    createTooltipElement() {
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'tooltip';
        this.tooltip.setAttribute('role', 'tooltip');
        this.tooltip.style.cssText = `
            position: fixed;
            z-index: 10000;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.2s ease;
        `;
        document.body.appendChild(this.tooltip);
    }
    
    handleMouseEnter(e) {
        const target = e.target.closest('[data-tooltip]');
        if (!target) return;
        
        clearTimeout(this.hideTimeout);
        
        this.showTimeout = setTimeout(() => {
            this.showTooltip(target);
        }, this.options.delay);
    }
    
    handleMouseLeave(e) {
        const target = e.target.closest('[data-tooltip]');
        if (!target) return;
        
        clearTimeout(this.showTimeout);
        
        this.hideTimeout = setTimeout(() => {
            this.hideTooltip();
        }, 100);
    }
    
    handleFocus(e) {
        const target = e.target.closest('[data-tooltip]');
        if (!target) return;
        
        clearTimeout(this.hideTimeout);
        
        // Show instantly on focus for keyboard navigation
        if (this.options.instantOnFocus) {
            this.showTooltip(target);
        } else {
            this.showTimeout = setTimeout(() => {
                this.showTooltip(target);
            }, this.options.delay);
        }
    }
    
    handleBlur(e) {
        const target = e.target.closest('[data-tooltip]');
        if (!target) return;
        
        clearTimeout(this.showTimeout);
        this.hideTooltip();
    }
    
    showTooltip(element) {
        const text = element.getAttribute('data-tooltip');
        const position = element.getAttribute('data-tooltip-position') || this.options.position;
        const disabled = element.hasAttribute('disabled') || element.classList.contains('disabled');
        
        if (!text || disabled) return;
        
        // Update tooltip content
        this.tooltip.textContent = text;
        this.tooltip.style.opacity = '0';
        this.tooltip.style.display = 'block';
        
        // Calculate position
        const pos = this.calculatePosition(element, position);
        this.tooltip.style.left = pos.left + 'px';
        this.tooltip.style.top = pos.top + 'px';
        
        // Set max width
        this.tooltip.style.maxWidth = this.options.maxWidth + 'px';
        
        // Show tooltip
        requestAnimationFrame(() => {
            this.tooltip.style.opacity = '1';
        });
        
        // Set ARIA attributes
        const tooltipId = 'tooltip-' + Date.now();
        this.tooltip.id = tooltipId;
        element.setAttribute('aria-describedby', tooltipId);
        
        this.activeTooltip = element;
    }
    
    hideTooltip() {
        if (!this.activeTooltip) return;
        
        this.tooltip.style.opacity = '0';
        
        setTimeout(() => {
            this.tooltip.style.display = 'none';
            if (this.activeTooltip) {
                this.activeTooltip.removeAttribute('aria-describedby');
            }
            this.activeTooltip = null;
        }, 200);
    }
    
    calculatePosition(element, position) {
        const rect = element.getBoundingClientRect();
        const tooltipRect = this.tooltip.getBoundingClientRect();
        const offset = this.options.offset;
        
        let left, top;
        
        // Try preferred position first
        switch (position) {
            case 'top':
                left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
                top = rect.top - tooltipRect.height - offset;
                
                // Fallback to bottom if not enough space
                if (top < 0) {
                    top = rect.bottom + offset;
                }
                break;
                
            case 'bottom':
                left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
                top = rect.bottom + offset;
                
                // Fallback to top if not enough space
                if (top + tooltipRect.height > window.innerHeight) {
                    top = rect.top - tooltipRect.height - offset;
                }
                break;
                
            case 'left':
                left = rect.left - tooltipRect.width - offset;
                top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
                
                // Fallback to right if not enough space
                if (left < 0) {
                    left = rect.right + offset;
                }
                break;
                
            case 'right':
                left = rect.right + offset;
                top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
                
                // Fallback to left if not enough space
                if (left + tooltipRect.width > window.innerWidth) {
                    left = rect.left - tooltipRect.width - offset;
                }
                break;
                
            default:
                // Auto position
                left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
                top = rect.top - tooltipRect.height - offset;
                
                if (top < 0) {
                    top = rect.bottom + offset;
                }
        }
        
        // Ensure tooltip stays within viewport horizontally
        if (left < 10) {
            left = 10;
        } else if (left + tooltipRect.width > window.innerWidth - 10) {
            left = window.innerWidth - tooltipRect.width - 10;
        }
        
        // Ensure tooltip stays within viewport vertically
        if (top < 10) {
            top = 10;
        } else if (top + tooltipRect.height > window.innerHeight - 10) {
            top = window.innerHeight - tooltipRect.height - 10;
        }
        
        return { left, top };
    }
    
    destroy() {
        clearTimeout(this.showTimeout);
        clearTimeout(this.hideTimeout);
        
        if (this.tooltip && this.tooltip.parentNode) {
            this.tooltip.parentNode.removeChild(this.tooltip);
        }
        
        document.removeEventListener('mouseenter', this.handleMouseEnter, true);
        document.removeEventListener('mouseleave', this.handleMouseLeave, true);
        document.removeEventListener('focus', this.handleFocus, true);
        document.removeEventListener('blur', this.handleBlur, true);
        window.removeEventListener('scroll', this.hideTooltip, true);
    }
}

// Initialize tooltip manager globally
let tooltipManager = null;

export function initTooltips(options = {}) {
    if (tooltipManager) {
        tooltipManager.destroy();
    }
    tooltipManager = new TooltipManager(options);
    return tooltipManager;
}

export function destroyTooltips() {
    if (tooltipManager) {
        tooltipManager.destroy();
        tooltipManager = null;
    }
}

// Auto-initialize on module load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initTooltips());
} else {
    initTooltips();
}
