// Typing Indicator Module
import { sendTypingIndicator, clearTypingIndicator } from './chatPage.js';

let typingTimeout = null;
let isTyping = false;
const TYPING_DEBOUNCE_DELAY = 500; // 500ms delay before sending typing indicator
const TYPING_CLEAR_DELAY = 3000; // 3 seconds before clearing typing indicator

export function handleTyping(inputElement, sessionCode) {
    if (!inputElement || !sessionCode) return;
    
    // Clear existing timeout
    if (typingTimeout) {
        clearTimeout(typingTimeout);
    }
    
    // If not currently typing, send typing indicator after debounce
    if (!isTyping) {
        typingTimeout = setTimeout(() => {
            sendTypingIndicator(sessionCode);
            isTyping = true;
            
            // Auto-clear typing after 3 seconds
            typingTimeout = setTimeout(() => {
                clearTypingIndicator(sessionCode);
                isTyping = false;
            }, TYPING_CLEAR_DELAY);
        }, TYPING_DEBOUNCE_DELAY);
    } else {
        // Reset the clear timeout if user continues typing
        typingTimeout = setTimeout(() => {
            clearTypingIndicator(sessionCode);
            isTyping = false;
        }, TYPING_CLEAR_DELAY);
    }
}

export function stopTyping(sessionCode) {
    if (typingTimeout) {
        clearTimeout(typingTimeout);
        typingTimeout = null;
    }
    
    if (isTyping) {
        clearTypingIndicator(sessionCode);
        isTyping = false;
    }
}

export function resetTypingState() {
    if (typingTimeout) {
        clearTimeout(typingTimeout);
        typingTimeout = null;
    }
    isTyping = false;
}
