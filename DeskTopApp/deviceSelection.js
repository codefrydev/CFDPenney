// Device Selection Module for Desktop App
// Handles device enumeration, selection, and persistence
import { state } from './state.js';

const STORAGE_KEY_PREFIX = 'cfdpenney_device_';

// Cache for device lists
let devicesCache = {
    cameras: [],
    microphones: [],
    speakers: []
};

// Load device preferences from localStorage
export function loadDevicePreferences() {
    try {
        const cameraId = localStorage.getItem(STORAGE_KEY_PREFIX + 'camera');
        const microphoneId = localStorage.getItem(STORAGE_KEY_PREFIX + 'microphone');
        const speakerId = localStorage.getItem(STORAGE_KEY_PREFIX + 'speaker');
        
        if (cameraId) state.selectedCameraId = cameraId;
        if (microphoneId) state.selectedMicrophoneId = microphoneId;
        if (speakerId) state.selectedSpeakerId = speakerId;
    } catch (err) {
        console.error('Error loading device preferences:', err);
    }
}

// Save device preferences to localStorage
export function saveDevicePreferences() {
    try {
        if (state.selectedCameraId) {
            localStorage.setItem(STORAGE_KEY_PREFIX + 'camera', state.selectedCameraId);
        } else {
            localStorage.removeItem(STORAGE_KEY_PREFIX + 'camera');
        }
        
        if (state.selectedMicrophoneId) {
            localStorage.setItem(STORAGE_KEY_PREFIX + 'microphone', state.selectedMicrophoneId);
        } else {
            localStorage.removeItem(STORAGE_KEY_PREFIX + 'microphone');
        }
        
        if (state.selectedSpeakerId) {
            localStorage.setItem(STORAGE_KEY_PREFIX + 'speaker', state.selectedSpeakerId);
        } else {
            localStorage.removeItem(STORAGE_KEY_PREFIX + 'speaker');
        }
    } catch (err) {
        console.error('Error saving device preferences:', err);
    }
}

// Request permissions and enumerate devices
export async function enumerateDevices() {
    try {
        // Request permissions first to get device labels
        try {
            await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch (err) {
            // Permission denied or not available - we can still enumerate but labels may be empty
        }
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        devicesCache.cameras = devices.filter(device => device.kind === 'videoinput');
        devicesCache.microphones = devices.filter(device => device.kind === 'audioinput');
        devicesCache.speakers = devices.filter(device => device.kind === 'audiooutput');
        
        return {
            cameras: devicesCache.cameras,
            microphones: devicesCache.microphones,
            speakers: devicesCache.speakers
        };
    } catch (err) {
        console.error('Error enumerating devices:', err);
        return {
            cameras: [],
            microphones: [],
            speakers: []
        };
    }
}

// Get device label (with fallback for empty labels)
export function getDeviceLabel(device) {
    if (!device) return 'Unknown Device';
    
    if (device.label && device.label.trim() !== '') {
        return device.label;
    }
    
    // Fallback labels based on kind
    if (device.kind === 'videoinput') {
        return `Camera ${device.deviceId.substring(0, 8)}`;
    } else if (device.kind === 'audioinput') {
        return `Microphone ${device.deviceId.substring(0, 8)}`;
    } else if (device.kind === 'audiooutput') {
        return `Speaker ${device.deviceId.substring(0, 8)}`;
    }
    
    return 'Unknown Device';
}

// Populate device select dropdown
export function populateDeviceSelect(selectElement, devices, selectedDeviceId, defaultLabel = 'Default') {
    if (!selectElement) return;
    
    // Clear existing options
    selectElement.innerHTML = '';
    
    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = defaultLabel;
    selectElement.appendChild(defaultOption);
    
    // Add device options
    devices.forEach(device => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = getDeviceLabel(device);
        if (device.deviceId === selectedDeviceId) {
            option.selected = true;
        }
        selectElement.appendChild(option);
    });
}

// Populate all device selects in the modal
export async function populateDeviceSelects() {
    // Enumerate devices first
    await enumerateDevices();
    
    const cameraSelect = document.getElementById('select-camera');
    const microphoneSelect = document.getElementById('select-microphone');
    const speakerSelect = document.getElementById('select-speaker');
    
    if (cameraSelect) {
        populateDeviceSelect(cameraSelect, devicesCache.cameras, state.selectedCameraId, 'Default Camera');
    }
    
    if (microphoneSelect) {
        populateDeviceSelect(microphoneSelect, devicesCache.microphones, state.selectedMicrophoneId, 'Default Microphone');
    }
    
    if (speakerSelect) {
        populateDeviceSelect(speakerSelect, devicesCache.speakers, state.selectedSpeakerId, 'Default Speaker');
    }
}

// Get selected device IDs from modal
export function getSelectedDeviceIds() {
    const cameraSelect = document.getElementById('select-camera');
    const microphoneSelect = document.getElementById('select-microphone');
    const speakerSelect = document.getElementById('select-speaker');
    
    return {
        cameraId: cameraSelect ? cameraSelect.value || null : null,
        microphoneId: microphoneSelect ? microphoneSelect.value || null : null,
        speakerId: speakerSelect ? speakerSelect.value || null : null
    };
}

// Validate that selected devices still exist
export function validateSelectedDevices() {
    const cameraExists = !state.selectedCameraId || 
        devicesCache.cameras.some(d => d.deviceId === state.selectedCameraId);
    const microphoneExists = !state.selectedMicrophoneId || 
        devicesCache.microphones.some(d => d.deviceId === state.selectedMicrophoneId);
    const speakerExists = !state.selectedSpeakerId || 
        devicesCache.speakers.some(d => d.deviceId === state.selectedSpeakerId);
    
    if (!cameraExists) {
        state.selectedCameraId = null;
    }
    
    if (!microphoneExists) {
        state.selectedMicrophoneId = null;
    }
    
    if (!speakerExists) {
        state.selectedSpeakerId = null;
    }
    
    // Save updated preferences
    if (!cameraExists || !microphoneExists || !speakerExists) {
        saveDevicePreferences();
    }
}

// Listen for device changes
export function setupDeviceChangeListener() {
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
        navigator.mediaDevices.addEventListener('devicechange', async () => {
            await enumerateDevices();
            validateSelectedDevices();
            
            // If modal is open, refresh the selects
            const modal = document.getElementById('device-selection-modal-overlay');
            if (modal && !modal.classList.contains('hidden')) {
                populateDeviceSelects();
            }
        });
    }
}

// Initialize device selection module
export function initDeviceSelection() {
    loadDevicePreferences();
    setupDeviceChangeListener();
}

// Make functions available globally
window.enumerateDevices = enumerateDevices;
window.populateDeviceSelects = populateDeviceSelects;
window.getSelectedDeviceIds = getSelectedDeviceIds;
window.loadDevicePreferences = loadDevicePreferences;
window.saveDevicePreferences = saveDevicePreferences;

