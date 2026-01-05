// Constants & Config
export const COLORS = [
    '#FF3B30', '#FF9500', '#FFCC00', '#4CD964', '#5AC8FA', '#007AFF', '#5856D6', '#FFFFFF', '#000000'
];

export const TOOLS = [
    { id: 'pencil', icon: 'pencil', label: 'Pen' },
    { id: 'arrow', icon: 'arrow-right', label: 'Arrow' },
    { id: 'rect', icon: 'square', label: 'Box' },
    { id: 'text', icon: 'type', label: 'Text' },
    { id: 'eraser', icon: 'eraser', label: 'Eraser' },
];

// Discovery Service Configuration
// Random GUID for discovery peer ID (acts as central registry)
// This GUID was randomly generated and is used as a fixed identifier for the discovery service
export const DISCOVERY_PEER_ID = 'ANNONATE_DISCOVERY_de97662b-caa7-46a6-aca7-68410515c969';

// Platform identifier to ensure only Annonate sessions are discovered
export const ANNONATE_PLATFORM_ID = 'ANNONATE_V1';

// Session timeout (5 minutes)
export const SESSION_TIMEOUT = 5 * 60 * 1000;

