// Peer Color Generation Utility
// Generates consistent colors for peer IDs

/**
 * Generate a consistent color from a peer ID
 * @param {string} peerId - The peer ID
 * @returns {string} HSL color string
 */
export function getPeerColor(peerId) {
    if (!peerId) return '#FF3B30';
    
    // Hash the peerId to get consistent color
    let hash = 0;
    for (let i = 0; i < peerId.length; i++) {
        hash = peerId.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Convert to HSL for better color distribution
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 70%, 50%)`;
}
