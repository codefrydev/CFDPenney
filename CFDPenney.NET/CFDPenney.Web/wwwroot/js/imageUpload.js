// Image Upload Handling
import { state } from './state.js';
import { stopScreenShareLogic, setMode } from './screenShare.js';

let imgElem = null;
let imgPlaceholder = null;

export function initImageUpload(imgEl, placeholderEl) {
    imgElem = imgEl;
    imgPlaceholder = placeholderEl;
}

export function handleImageUpload(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
            state.backgroundImageSrc = evt.target.result;
            if (imgElem) {
                imgElem.src = state.backgroundImageSrc;
                imgElem.classList.remove('hidden');
            }
            if (imgPlaceholder) {
                imgPlaceholder.classList.add('hidden');
            }
            
            // Stop screen share if active
            if (state.mode === 'screen') {
                stopScreenShareLogic();
            }
            
            setMode('image');
        };
        reader.readAsDataURL(file);
    }
    e.target.value = ''; // Reset input
}

