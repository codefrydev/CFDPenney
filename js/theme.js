// Theme Management
import { state } from './state.js';

function updateWhiteboardBackground() {
    const theme = document.documentElement.getAttribute('data-theme') || 'light';
    const whiteboardBg = document.getElementById('bg-whiteboard');
    if (whiteboardBg) {
        whiteboardBg.style.backgroundColor = theme === 'dark' ? '#1f2937' : '#ffffff';
    }
}

export const app = {
    initTheme: function() {
        const savedTheme = localStorage.getItem('codmegle_theme');
        const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        let theme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
        this.setTheme(theme);
        
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (!localStorage.getItem('codmegle_theme')) {
                    this.setTheme(e.matches ? 'dark' : 'light');
                }
            });
        }
    },
    
    setTheme: function(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('codmegle_theme', theme);
        
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            const lightIcon = themeToggle.querySelector('.theme-icon-light');
            const darkIcon = themeToggle.querySelector('.theme-icon-dark');
            if (lightIcon && darkIcon) {
                if (theme === 'dark') {
                    lightIcon.classList.add('hidden');
                    darkIcon.classList.remove('hidden');
                } else {
                    darkIcon.classList.add('hidden');
                    lightIcon.classList.remove('hidden');
                }
            }
        }
        
        if (window.lucide) {
            lucide.createIcons();
        }
        
        // Update whiteboard background based on theme
        updateWhiteboardBackground();
    },
    
    toggleTheme: function() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }
};

