// Clipboard Operations
import { getShareableURL } from './urlUtils.js';

// Copy code to clipboard
export async function copyCodeToClipboard(code) {
    if (!code) return false;
    
    try {
        // Use modern Clipboard API if available
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(code);
            return true;
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = code;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            document.body.appendChild(textArea);
            textArea.select();
            const success = document.execCommand('copy');
            document.body.removeChild(textArea);
            return success;
        }
    } catch (err) {
        console.error('Failed to copy code:', err);
        return false;
    }
}

// Handle copy button click with visual feedback
export function handleCopyCode(code) {
    const copyBtn = document.getElementById('btn-copy-code');
    if (!copyBtn) return;
    
    // Copy the full URL with code parameter instead of just the code
    const shareableURL = getShareableURL(code);
    const textToCopy = shareableURL || code;
    
    copyCodeToClipboard(textToCopy).then(success => {
        if (success) {
            // Change icon to checkmark
            const icon = copyBtn.querySelector('i');
            if (icon) {
                icon.setAttribute('data-lucide', 'check');
                if (window.lucide) {
                    lucide.createIcons();
                }
            }
            
            // Reset icon back to copy after 2 seconds
            setTimeout(() => {
                if (icon) {
                    icon.setAttribute('data-lucide', 'copy');
                    if (window.lucide) {
                        lucide.createIcons();
                    }
                }
            }, 2000);
        }
    });
}

