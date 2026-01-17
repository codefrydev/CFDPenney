// Device Selection for Camera, Microphone, and Speaker
// Web wrapper for shared device selection utilities
import { state } from './state.js';
import {
    loadDevicePreferences as sharedLoadDevicePreferences,
    saveDevicePreferences as sharedSaveDevicePreferences,
    enumerateDevices as sharedEnumerateDevices,
    getDeviceLabel as sharedGetDeviceLabel,
    populateDeviceSelect as sharedPopulateDeviceSelect,
    populateDeviceSelects as sharedPopulateDeviceSelects,
    getSelectedDeviceIds as sharedGetSelectedDeviceIds,
    validateSelectedDevices as sharedValidateSelectedDevices,
    getDevicesCache
} from '../shared/utils/deviceSelection.js';

// Re-export with state parameter
export function loadDevicePreferences() {
    return sharedLoadDevicePreferences(state);
}

export function saveDevicePreferences() {
    return sharedSaveDevicePreferences(state);
}

export function enumerateDevices() {
    return sharedEnumerateDevices();
}

export function getDeviceLabel(device) {
    return sharedGetDeviceLabel(device);
}

export function populateDeviceSelect(selectElement, devices, selectedDeviceId, defaultLabel = 'Default') {
    return sharedPopulateDeviceSelect(selectElement, devices, selectedDeviceId, defaultLabel);
}

export function populateDeviceSelects() {
    return sharedPopulateDeviceSelects(state);
}

export function getSelectedDeviceIds() {
    return sharedGetSelectedDeviceIds();
}

export function validateSelectedDevices() {
    return sharedValidateSelectedDevices(state);
}

// Initialize device selection (loads preferences and validates)
export async function initDeviceSelection() {
    loadDevicePreferences();
    await validateSelectedDevices();
}

// Export devices cache for backward compatibility
export const devicesCache = getDevicesCache();
