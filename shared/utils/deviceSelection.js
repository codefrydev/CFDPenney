// Device Selection Utilities
// Shared module for managing camera, microphone, and speaker device selection

// Cache for enumerated devices
const devicesCache = {
    cameras: [],
    microphones: [],
    speakers: []
};

/**
 * Load device preferences from localStorage
 * @param {Object} state - The application state
 */
export function loadDevicePreferences(state) {
    try {
        const savedCameraId = localStorage.getItem('selectedCameraId');
        const savedMicrophoneId = localStorage.getItem('selectedMicrophoneId');
        const savedSpeakerId = localStorage.getItem('selectedSpeakerId');
        
        if (savedCameraId) {
            state.selectedCameraId = savedCameraId;
        }
        if (savedMicrophoneId) {
            state.selectedMicrophoneId = savedMicrophoneId;
        }
        if (savedSpeakerId) {
            state.selectedSpeakerId = savedSpeakerId;
        }
    } catch (err) {
        console.error('Error loading device preferences:', err);
    }
}

/**
 * Save device preferences to localStorage
 * @param {Object} state - The application state
 */
export function saveDevicePreferences(state) {
    try {
        if (state.selectedCameraId) {
            localStorage.setItem('selectedCameraId', state.selectedCameraId);
        }
        if (state.selectedMicrophoneId) {
            localStorage.setItem('selectedMicrophoneId', state.selectedMicrophoneId);
        }
        if (state.selectedSpeakerId) {
            localStorage.setItem('selectedSpeakerId', state.selectedSpeakerId);
        }
    } catch (err) {
        console.error('Error saving device preferences:', err);
    }
}

/**
 * Request permissions and enumerate devices
 * @returns {Promise<Object>} Object containing cameras, microphones, and speakers arrays
 */
export async function enumerateDevices() {
    try {
        // Request permissions first to get device labels
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            // Stop the stream immediately - we just needed permissions
            stream.getTracks().forEach(track => track.stop());
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

/**
 * Get device label (with fallback for empty labels)
 * @param {MediaDeviceInfo} device - The device info
 * @returns {string} The device label
 */
export function getDeviceLabel(device) {
    if (!device) return 'Unknown Device';
    
    if (device.label && device.label.trim()) {
        return device.label;
    }
    
    // Fallback labels when permission not granted
    if (device.kind === 'videoinput') {
        return `Camera ${device.deviceId.substring(0, 5)}`;
    } else if (device.kind === 'audioinput') {
        return `Microphone ${device.deviceId.substring(0, 5)}`;
    } else if (device.kind === 'audiooutput') {
        return `Speaker ${device.deviceId.substring(0, 5)}`;
    }
    
    return 'Unknown Device';
}

/**
 * Populate a device select element
 * @param {HTMLSelectElement} selectElement - The select element to populate
 * @param {Array} devices - Array of device info objects
 * @param {string|null} selectedDeviceId - The currently selected device ID
 * @param {string} defaultLabel - Label for the default option
 */
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

/**
 * Populate all device selects in the modal
 * @param {Object} state - The application state
 */
export async function populateDeviceSelects(state) {
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

/**
 * Get selected device IDs from modal
 * @returns {Object} Object containing cameraId, microphoneId, and speakerId
 */
export function getSelectedDeviceIds() {
    const cameraSelect = document.getElementById('select-camera');
    const microphoneSelect = document.getElementById('select-microphone');
    const speakerSelect = document.getElementById('select-speaker');
    
    return {
        cameraId: cameraSelect ? cameraSelect.value : null,
        microphoneId: microphoneSelect ? microphoneSelect.value : null,
        speakerId: speakerSelect ? speakerSelect.value : null
    };
}

/**
 * Get the devices cache
 * @returns {Object} The devices cache
 */
export function getDevicesCache() {
    return devicesCache;
}

/**
 * Validate that selected devices still exist
 * @param {Object} state - The application state
 * @returns {Promise<void>}
 */
export async function validateSelectedDevices(state) {
    // Enumerate devices to get current list
    const devices = await enumerateDevices();
    
    // Check if selected camera still exists
    if (state.selectedCameraId) {
        const cameraExists = devices.cameras.some(d => d.deviceId === state.selectedCameraId);
        if (!cameraExists) {
            state.selectedCameraId = null;
        }
    }
    
    // Check if selected microphone still exists
    if (state.selectedMicrophoneId) {
        const micExists = devices.microphones.some(d => d.deviceId === state.selectedMicrophoneId);
        if (!micExists) {
            state.selectedMicrophoneId = null;
        }
    }
    
    // Check if selected speaker still exists
    if (state.selectedSpeakerId) {
        const speakerExists = devices.speakers.some(d => d.deviceId === state.selectedSpeakerId);
        if (!speakerExists) {
            state.selectedSpeakerId = null;
        }
    }
}
