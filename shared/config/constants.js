// Shared Constants
// Common configuration values used across web and desktop applications

// Discovery Service
export const DISCOVERY_PEER_ID = 'ANNONATE_DISCOVERY_de97662b-caa7-46a6-aca7-68410515c969';
export const DISCOVERY_SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// Connection Configuration
export const CONNECTION_TIMEOUT = 15000; // 15 seconds
export const MAX_RETRIES = 3;
export const RETRY_DELAY = 2000; // 2 seconds
export const CONNECTION_GRACE_PERIOD = 8000; // 8 seconds
export const MAX_REPLACEMENTS = 3; // Max replacements per peer

// Share Code Configuration
export const SHARE_CODE_LENGTH = 5;
export const SHARE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// Chat Configuration
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Camera Configuration
export const DEFAULT_CAMERA_SIZE = { width: 240, height: 180 };
