// Sticker Library
// Provides emoji and icon libraries for stickers

// Common emoji library
export const EMOJI_LIBRARY = [
    // Reactions
    '👍', '👎', '❤️', '🔥', '⭐', '✅', '❌', '💯', '🎉', '👏',
    // Faces
    '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
    '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',
    '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔',
    '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
    '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮',
    // Objects
    '🎯', '🎨', '📝', '📌', '📍', '🔖', '💡', '🔔', '🔔', '📢',
    '📣', '📯', '🔊', '🔉', '🔈', '🔇', '📻', '📡', '📱', '📞',
    // Symbols
    '⚠️', '🚨', '💬', '💭', '🗯️', '🗨️', '👁️', '👁️‍🗨️', '🧠', '👤',
    // Arrows & Directions
    '⬆️', '⬇️', '⬅️', '➡️', '↗️', '↖️', '↘️', '↙️', '↔️', '↕️',
    // Shapes
    '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🔶',
    '🔷', '🔸', '🔹', '🔺', '🔻', '💠', '🔘', '🔳', '🔲', '▪️',
    '▫️', '◾', '◽', '◼️', '◻️', '🟥', '🟧', '🟨', '🟩', '🟦',
    '🟪', '⬛', '⬜', '🟫'
];

// Icon library using Lucide icon names
export const ICON_LIBRARY = [
    // Common icons
    'heart', 'star', 'check', 'x', 'alert-circle', 'info', 'help-circle',
    'thumbs-up', 'thumbs-down', 'flag', 'bookmark', 'tag', 'pin',
    'lightbulb', 'bell', 'bell-off', 'volume-2', 'volume-x',
    // Arrows
    'arrow-up', 'arrow-down', 'arrow-left', 'arrow-right',
    'arrow-up-right', 'arrow-down-right', 'arrow-down-left', 'arrow-up-left',
    // Shapes
    'circle', 'square', 'triangle', 'diamond', 'hexagon', 'pentagon',
    // Objects
    'image', 'file', 'folder', 'link', 'mail', 'phone', 'message-square',
    // Actions
    'plus', 'minus', 'edit', 'trash', 'copy', 'download', 'upload',
    'save', 'refresh', 'rotate-cw', 'rotate-ccw', 'zoom-in', 'zoom-out'
];

// Categorized emojis for better organization
export const EMOJI_CATEGORIES = {
    reactions: ['👍', '👎', '❤️', '🔥', '⭐', '✅', '❌', '💯', '🎉', '👏'],
    faces: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍'],
    objects: ['🎯', '🎨', '📝', '📌', '📍', '🔖', '💡', '🔔', '📢', '📱'],
    symbols: ['⚠️', '🚨', '💬', '💭', '🗯️', '🗨️', '👁️', '🧠', '👤'],
    arrows: ['⬆️', '⬇️', '⬅️', '➡️', '↗️', '↖️', '↘️', '↙️', '↔️', '↕️'],
    shapes: ['🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🔶', '🔷', '🔸', '🔹']
};

// Categorized icons
export const ICON_CATEGORIES = {
    common: ['heart', 'star', 'check', 'x', 'alert-circle', 'info', 'help-circle'],
    arrows: ['arrow-up', 'arrow-down', 'arrow-left', 'arrow-right', 'arrow-up-right', 'arrow-down-right'],
    shapes: ['circle', 'square', 'triangle', 'diamond', 'hexagon', 'pentagon'],
    objects: ['image', 'file', 'folder', 'link', 'mail', 'phone', 'message-square'],
    actions: ['plus', 'minus', 'edit', 'trash', 'copy', 'download', 'upload', 'save', 'refresh']
};

/**
 * Get all emojis
 */
export function getAllEmojis() {
    return EMOJI_LIBRARY;
}

/**
 * Get all icons
 */
export function getAllIcons() {
    return ICON_LIBRARY;
}

/**
 * Get emojis by category
 */
export function getEmojisByCategory(category) {
    return EMOJI_CATEGORIES[category] || [];
}

/**
 * Get icons by category
 */
export function getIconsByCategory(category) {
    return ICON_CATEGORIES[category] || [];
}

