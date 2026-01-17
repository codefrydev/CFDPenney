// Constants & Config
export const COLORS = [
    '#FF3B30', '#FF9500', '#FFCC00', '#4CD964', '#5AC8FA', '#007AFF', '#5856D6', '#FFFFFF', '#000000'
];

export const TOOLS = [
    // Drawing tools
    { id: 'pencil', icon: 'pencil', label: 'Pen', category: 'drawing' },
    { id: 'trail', icon: 'zap', label: 'Trail Pen', category: 'drawing' },
    { id: 'eraser', icon: 'eraser', label: 'Eraser', category: 'drawing' },
    { id: 'text', icon: 'type', label: 'Text', category: 'drawing' },
    
    // Shape tools
    { id: 'line', icon: 'minus', label: 'Line', category: 'shapes', fillable: false },
    { id: 'arrow', icon: 'arrow-right', label: 'Arrow', category: 'shapes', fillable: false },
    { id: 'rect', icon: 'square', label: 'Rectangle', category: 'shapes', fillable: true },
    { id: 'circle', icon: 'circle', label: 'Circle', category: 'shapes', fillable: true },
    { id: 'ellipse', icon: 'circle', label: 'Ellipse', category: 'shapes', fillable: true },
    { id: 'triangle', icon: 'triangle', label: 'Triangle', category: 'shapes', fillable: true },
    { id: 'diamond', icon: 'gem', label: 'Diamond', category: 'shapes', fillable: true },
    { id: 'star', icon: 'star', label: 'Star', category: 'shapes', fillable: true },
    { id: 'pentagon', icon: 'hexagon', label: 'Pentagon', category: 'shapes', fillable: true },
    { id: 'hexagon', icon: 'hexagon', label: 'Hexagon', category: 'shapes', fillable: true },
    { id: 'octagon', icon: 'hexagon', label: 'Octagon', category: 'shapes', fillable: true },
    
    // Stickers
    { id: 'sticker', icon: 'smile', label: 'Sticker', category: 'stickers' },
    
    // Utilities
    { id: 'select', icon: 'mouse-pointer-2', label: 'Select', category: 'utilities' },
];

// Tool categories for UI organization
export const TOOL_CATEGORIES = {
    drawing: 'Drawing',
    shapes: 'Shapes',
    stickers: 'Stickers',
    utilities: 'Utilities'
};

// Discovery Service Configuration
// Random GUID for discovery peer ID (acts as central registry)
// This GUID was randomly generated and is used as a fixed identifier for the discovery service
export const DISCOVERY_PEER_ID = 'ANNONATE_DISCOVERY_de97662b-caa7-46a6-aca7-68410515c969';

// Platform identifier to ensure only Annonate sessions are discovered
export const ANNONATE_PLATFORM_ID = 'ANNONATE_V1';

// Session timeout (5 minutes)
export const SESSION_TIMEOUT = 5 * 60 * 1000;

// Trail tool configuration
export const TRAIL_FADE_DURATION = 3000; // Default: 3 seconds
export const TRAIL_FADE_MIN = 1000; // Min: 1 second
export const TRAIL_FADE_MAX = 10000; // Max: 10 seconds

// Trail effect types
export const TRAIL_TYPES = [
    { id: "fade", label: "Fade Out", icon: "circle-dot", description: "Entire stroke fades together" },
    { id: "sequential", label: "Snake Trail", icon: "move", description: "Beginning disappears first" },
    { id: "laser", label: "Laser", icon: "zap", description: "Bright glowing effect" }
];

export const DEFAULT_TRAIL_TYPE = "fade";
