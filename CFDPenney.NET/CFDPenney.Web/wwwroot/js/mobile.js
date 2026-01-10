/**
 * Mobile-specific functionality and touch handling
 * Handles FAB, mobile toolbar, gestures, and touch optimizations
 */

export class MobileManager {
    constructor() {
        this.isMobile = window.innerWidth < 768;
        this.isTouch = 'ontouchstart' in window;
        this.fab = null;
        this.toolbar = null;
        this.toolbarVisible = false;
        
        // Touch state
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchStartTime = 0;
        this.lastTouchEnd = 0;
        
        // Gesture thresholds
        this.SWIPE_THRESHOLD = 50;
        this.SWIPE_MAX_TIME = 500;
        this.DOUBLE_TAP_TIME = 300;
        this.LONG_PRESS_TIME = 500;
        
        this.init();
    }
    
    init() {
        if (!this.isMobile) return;
        
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
        
        // Handle window resize
        window.addEventListener('resize', () => this.handleResize());
    }
    
    setup() {
        this.fab = document.getElementById('mobile-fab');
        this.toolbar = document.getElementById('mobile-toolbar');
        
        if (this.fab) {
            this.setupFAB();
        }
        
        if (this.toolbar) {
            this.setupMobileToolbar();
            this.syncToolbarContent();
        }
        
        this.setupTouchOptimizations();
        this.setupMobileButtons();
    }
    
    setupFAB() {
        this.fab.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleToolbar();
        });
    }
    
    toggleToolbar() {
        this.toolbarVisible = !this.toolbarVisible;
        
        if (this.toolbar) {
            if (this.toolbarVisible) {
                this.toolbar.classList.add('mobile-visible');
                this.fab.classList.add('fab-active');
            } else {
                this.toolbar.classList.remove('mobile-visible');
                this.fab.classList.remove('fab-active');
            }
        }
    }
    
    setupMobileToolbar() {
        // Close toolbar when tapping outside
        document.addEventListener('click', (e) => {
            if (this.toolbarVisible && 
                !this.toolbar.contains(e.target) && 
                !this.fab.contains(e.target)) {
                this.toggleToolbar();
            }
        });
        
        // Swipe down to close
        if (this.toolbar) {
            let startY = 0;
            
            this.toolbar.addEventListener('touchstart', (e) => {
                startY = e.touches[0].clientY;
                this.touchStartTime = Date.now();
            }, { passive: true });
            
            this.toolbar.addEventListener('touchend', (e) => {
                const endY = e.changedTouches[0].clientY;
                const deltaY = endY - startY;
                const deltaTime = Date.now() - this.touchStartTime;
                
                // Swipe down to close (only if scrolled to top)
                if (this.toolbar.scrollTop === 0 && 
                    deltaY > this.SWIPE_THRESHOLD && 
                    deltaTime < this.SWIPE_MAX_TIME) {
                    this.toggleToolbar();
                }
            }, { passive: true });
        }
    }
    
    syncToolbarContent() {
        // Use requestAnimationFrame for better performance
        requestAnimationFrame(() => {
            // Wait for tools to be rendered
            setTimeout(() => {
                this.cloneToolsToMobile();
                this.cloneColorsToMobile();
                this.setupModeButtons();
                this.setupStrokeSlider();
                
                // Re-sync when tools or colors change
                this.observeToolChanges();
            }, 150);
        });
    }
    
    cloneToolsToMobile() {
        const desktopTools = document.querySelector('#main-toolbar #tool-container');
        const mobileTools = document.getElementById('mobile-tool-container');
        
        if (desktopTools && mobileTools) {
            // Only update if content has changed (prevent unnecessary updates)
            const newHTML = desktopTools.innerHTML;
            if (mobileTools.innerHTML !== newHTML) {
                mobileTools.innerHTML = newHTML;
                
                // Re-initialize lucide icons only for new content
                if (window.lucide) {
                    requestAnimationFrame(() => {
                        lucide.createIcons();
                    });
                }
                
                // Attach click handlers to mobile tool buttons
                this.attachMobileToolHandlers();
            }
        }
    }
    
    attachMobileToolHandlers() {
        const mobileTools = document.getElementById('mobile-tool-container');
        if (!mobileTools || mobileTools.dataset.handlersAttached) return;
        
        // Mark as having handlers to prevent duplicate attachment
        mobileTools.dataset.handlersAttached = 'true';
        
        // Use event delegation for better performance
        mobileTools.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const toolBtn = e.target.closest('[data-tool]');
            if (!toolBtn) return;
            
            const toolId = toolBtn.getAttribute('data-tool');
            
            // Find corresponding desktop button and click it
            const desktopBtn = document.querySelector(`#main-toolbar [data-tool="${toolId}"]`);
            if (desktopBtn) {
                desktopBtn.click();
                this.vibrate(10);
                
                // For tools that don't open pickers, auto-close toolbar
                // Don't close for shapes and stickers (they open pickers)
                if (toolId !== 'shapes' && toolId !== 'sticker') {
                    setTimeout(() => {
                        if (this.toolbarVisible) {
                            this.toggleToolbar();
                        }
                    }, 200);
                }
            }
        });
    }
    
    cloneColorsToMobile() {
        const desktopColors = document.querySelector('#main-toolbar #color-container');
        const mobileColors = document.getElementById('mobile-color-container');
        
        if (desktopColors && mobileColors) {
            // Only update if content has changed
            const newHTML = desktopColors.innerHTML;
            if (mobileColors.innerHTML !== newHTML) {
                mobileColors.innerHTML = newHTML;
                
                // Re-initialize lucide icons for color picker
                if (window.lucide) {
                    requestAnimationFrame(() => {
                        lucide.createIcons();
                    });
                }
                
                // Setup mobile custom color picker
                requestAnimationFrame(() => {
                    const mobileCustomPicker = mobileColors.querySelector('#custom-color-picker');
                    if (mobileCustomPicker) {
                        mobileCustomPicker.id = 'mobile-custom-color-picker';
                        
                        const desktopPicker = desktopColors.querySelector('#custom-color-picker');
                        if (desktopPicker) {
                            mobileCustomPicker.addEventListener('input', (e) => {
                                desktopPicker.value = e.target.value;
                                desktopPicker.dispatchEvent(new Event('input'));
                            }, { once: false });
                        }
                    }
                });
                
                // Attach click handlers to mobile color buttons
                this.attachMobileColorHandlers();
            }
        }
    }
    
    attachMobileColorHandlers() {
        const mobileColors = document.getElementById('mobile-color-container');
        if (!mobileColors || mobileColors.dataset.handlersAttached) return;
        
        // Mark as having handlers to prevent duplicate attachment
        mobileColors.dataset.handlersAttached = 'true';
        
        // Use event delegation for better performance
        mobileColors.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const colorBtn = e.target.closest('[data-color]');
            if (!colorBtn) return;
            
            const color = colorBtn.getAttribute('data-color');
            
            // Find corresponding desktop button and click it
            const desktopBtn = document.querySelector(`#main-toolbar [data-color="${color}"]`);
            if (desktopBtn) {
                desktopBtn.click();
                this.vibrate(10);
            }
        });
    }
    
    setupModeButtons() {
        const mobileModeBoard = document.getElementById('mobile-btn-mode-board');
        const mobileModeScreen = document.getElementById('mobile-btn-mode-screen');
        const mobileModeImage = document.getElementById('mobile-btn-mode-image');
        
        const desktopModeBoard = document.getElementById('btn-mode-board');
        const desktopModeScreen = document.getElementById('btn-mode-screen');
        const desktopModeImage = document.getElementById('btn-mode-image');
        
        if (mobileModeBoard && desktopModeBoard) {
            mobileModeBoard.addEventListener('click', () => {
                desktopModeBoard.click();
                this.updateModeButtonState('board');
            });
        }
        
        if (mobileModeScreen && desktopModeScreen) {
            mobileModeScreen.addEventListener('click', () => {
                desktopModeScreen.click();
                this.updateModeButtonState('screen');
            });
        }
        
        if (mobileModeImage && desktopModeImage) {
            mobileModeImage.addEventListener('click', () => {
                desktopModeImage.click();
                this.updateModeButtonState('image');
            });
        }
    }
    
    updateModeButtonState(mode) {
        const buttons = ['mobile-btn-mode-board', 'mobile-btn-mode-screen', 'mobile-btn-mode-image'];
        buttons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.classList.remove('active');
            }
        });
        
        const activeBtn = document.getElementById(`mobile-btn-mode-${mode}`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
    }
    
    setupStrokeSlider() {
        const mobileSlider = document.getElementById('mobile-stroke-slider');
        const mobileIndicator = document.getElementById('mobile-stroke-indicator');
        const desktopSlider = document.getElementById('stroke-slider');
        const desktopIndicator = document.getElementById('stroke-indicator');
        
        if (mobileSlider && desktopSlider) {
            // Sync initial values
            mobileSlider.value = desktopSlider.value;
            
            // Sync mobile to desktop
            mobileSlider.addEventListener('input', (e) => {
                desktopSlider.value = e.target.value;
                desktopSlider.dispatchEvent(new Event('input'));
                
                // Update mobile indicator
                if (mobileIndicator) {
                    mobileIndicator.style.height = `${e.target.value}px`;
                }
            });
            
            // Listen for desktop changes to sync back
            desktopSlider.addEventListener('input', (e) => {
                mobileSlider.value = e.target.value;
                if (mobileIndicator) {
                    mobileIndicator.style.height = `${e.target.value}px`;
                }
            });
            
            // Set initial indicator height
            if (mobileIndicator) {
                mobileIndicator.style.height = `${mobileSlider.value}px`;
            }
        }
    }
    
    observeToolChanges() {
        // Watch for changes to desktop toolbar and sync to mobile
        const desktopToolContainer = document.querySelector('#main-toolbar #tool-container');
        
        if (desktopToolContainer) {
            // Debounce the mutation observer to prevent too many updates
            let toolTimeout;
            const observer = new MutationObserver(() => {
                clearTimeout(toolTimeout);
                toolTimeout = setTimeout(() => {
                    this.cloneToolsToMobile();
                }, 100);
            });
            
            observer.observe(desktopToolContainer, {
                childList: true,
                attributes: true,
                attributeFilter: ['class'],
                subtree: false // Only watch direct children, not deep
            });
        }
        
        // Watch for color changes
        const desktopColorContainer = document.querySelector('#main-toolbar #color-container');
        
        if (desktopColorContainer) {
            // Debounce the mutation observer to prevent too many updates
            let colorTimeout;
            const observer = new MutationObserver(() => {
                clearTimeout(colorTimeout);
                colorTimeout = setTimeout(() => {
                    this.cloneColorsToMobile();
                }, 100);
            });
            
            observer.observe(desktopColorContainer, {
                childList: true,
                attributes: true,
                attributeFilter: ['class'],
                subtree: false // Only watch direct children, not deep
            });
        }
    }
    
    setupMobileButtons() {
        // Sync mobile-specific buttons with desktop equivalents
        const mobileUndo = document.getElementById('mobile-btn-undo');
        const desktopUndo = document.getElementById('btn-undo');
        
        const mobileRedo = document.getElementById('mobile-btn-redo');
        const desktopRedo = document.getElementById('btn-redo');
        
        const mobileSnapshot = document.getElementById('mobile-btn-snapshot');
        const desktopSnapshot = document.getElementById('btn-snapshot');
        
        const mobileClear = document.getElementById('mobile-btn-clear');
        const desktopClear = document.getElementById('btn-clear');
        
        if (mobileUndo && desktopUndo) {
            mobileUndo.addEventListener('click', (e) => {
                e.preventDefault();
                desktopUndo.click();
                this.vibrate(10);
            });
            
            // Sync disabled state
            this.syncButtonState(desktopUndo, mobileUndo);
        }
        
        if (mobileRedo && desktopRedo) {
            mobileRedo.addEventListener('click', (e) => {
                e.preventDefault();
                desktopRedo.click();
                this.vibrate(10);
            });
            
            // Sync disabled state
            this.syncButtonState(desktopRedo, mobileRedo);
        }
        
        if (mobileSnapshot && desktopSnapshot) {
            mobileSnapshot.addEventListener('click', (e) => {
                e.preventDefault();
                desktopSnapshot.click();
                this.vibrate(50);
                // Auto-close toolbar after snapshot
                setTimeout(() => {
                    if (this.toolbarVisible) {
                        this.toggleToolbar();
                    }
                }, 300);
            });
        }
        
        if (mobileClear && desktopClear) {
            mobileClear.addEventListener('click', (e) => {
                e.preventDefault();
                desktopClear.click();
                this.vibrate([30, 50, 30]);
            });
        }
    }
    
    syncButtonState(sourceBtn, targetBtn) {
        // Initial sync
        if (sourceBtn.disabled) {
            targetBtn.disabled = true;
        }
        
        // Watch for changes with debouncing
        let syncTimeout;
        const observer = new MutationObserver(() => {
            clearTimeout(syncTimeout);
            syncTimeout = setTimeout(() => {
                if (targetBtn.disabled !== sourceBtn.disabled) {
                    targetBtn.disabled = sourceBtn.disabled;
                }
            }, 50);
        });
        
        observer.observe(sourceBtn, {
            attributes: true,
            attributeFilter: ['disabled']
        });
    }
    
    setupTouchOptimizations() {
        // Prevent default touch behaviors on canvas
        const canvas = document.getElementById('main-canvas');
        if (canvas) {
            canvas.style.touchAction = 'none';
            // Touch drawing is handled in ui.js, no need to add extra handlers here
        }
        
        // Optimize scroll performance with passive listeners
        document.addEventListener('touchmove', (e) => {
            // Allow toolbar to scroll
            if (this.toolbar && this.toolbar.contains(e.target)) {
                return;
            }
            // Don't prevent on canvas - ui.js handles it
            if (e.target === canvas) {
                return;
            }
        }, { passive: true });
        
        // Prevent iOS bounce/overscroll on body
        document.body.addEventListener('touchmove', (e) => {
            if (e.target === document.body) {
                e.preventDefault();
            }
        }, { passive: false });
    }
    
    handleResize() {
        const wasMobile = this.isMobile;
        this.isMobile = window.innerWidth < 768;
        
        // If switching from mobile to desktop or vice versa
        if (wasMobile !== this.isMobile) {
            if (!this.isMobile && this.toolbarVisible) {
                // Close mobile toolbar when switching to desktop
                this.toggleToolbar();
            }
        }
    }
    
    // Gesture detection utilities
    detectSwipe(startX, startY, endX, endY, startTime) {
        const deltaX = endX - startX;
        const deltaY = endY - startY;
        const deltaTime = Date.now() - startTime;
        
        if (deltaTime > this.SWIPE_MAX_TIME) return null;
        
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);
        
        if (Math.max(absX, absY) < this.SWIPE_THRESHOLD) return null;
        
        if (absX > absY) {
            return deltaX > 0 ? 'right' : 'left';
        } else {
            return deltaY > 0 ? 'down' : 'up';
        }
    }
    
    isDoubleTap() {
        const now = Date.now();
        const timeSinceLastTap = now - this.lastTouchEnd;
        this.lastTouchEnd = now;
        
        return timeSinceLastTap < this.DOUBLE_TAP_TIME;
    }
    
    // Haptic feedback (if supported)
    vibrate(pattern = 10) {
        if ('vibrate' in navigator) {
            navigator.vibrate(pattern);
        }
    }
}

// Initialize on mobile devices
let mobileManager;
if (window.innerWidth < 768 || 'ontouchstart' in window) {
    mobileManager = new MobileManager();
}

export default mobileManager;

