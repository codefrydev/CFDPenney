# Screen Annotation Coordinate Alignment Fix

## Problem Statement

When multiple users collaborated on screen sharing annotations, drawings from different screens appeared **misaligned**. A user drawing on their screen would see their annotation in one position, while other viewers would see it in a different position on their screens. This made collaborative annotation unreliable and unusable.

### Root Causes

1. **Different Screen Resolutions**: Viewers and hosts had different screen sizes, resolutions, devicePixelRatio, and CSS scaling
2. **Video Element Scaling**: The shared screen video was displayed using `object-fit: contain`, which added letterboxing/pillarboxing
3. **Incorrect Coordinate Normalization**: Coordinates were being normalized based on canvas dimensions instead of the actual shared screen dimensions
4. **Missing Video Bounds Calculation**: The system didn't account for the actual visible video content area when restricting drawing

## Solution Overview

The fix involved three main components:

1. **Restrict Drawing to Video Content Area**: Only allow drawing within the actual visible video content (excluding letterboxing)
2. **Video-Based Coordinate Normalization**: Normalize coordinates based on video intrinsic dimensions (videoWidth/videoHeight) instead of canvas dimensions
3. **Coordinate Space Conversion**: Convert between canvas coordinate space and video coordinate space, accounting for `object-fit: contain`

## Implementation Details

### 1. Drawing Restriction to Video Bounds

**File**: `js/drawing.js`

Added `isWithinVideoBounds()` function that:
- Checks if we're in screen mode
- Verifies video element exists and is visible
- Calculates the actual video content area (excluding letterboxing/pillarboxing)
- Returns true only if coordinates are within the visible video content

```javascript
function isWithinVideoBounds(clientX, clientY) {
    if (state.mode !== 'screen') return true;
    
    const videoElem = document.getElementById('screen-video');
    if (!videoElem || !videoElem.srcObject) return true;
    
    // Calculate actual video content bounds accounting for object-fit: contain
    const videoRect = videoElem.getBoundingClientRect();
    const videoWidth = videoElem.videoWidth;
    const videoHeight = videoElem.videoHeight;
    
    // Calculate aspect ratios and content area
    const videoAspect = videoWidth / videoHeight;
    const containerAspect = videoRect.width / videoRect.height;
    
    // Determine letterboxing vs pillarboxing and calculate content bounds
    // ... (handles both cases)
    
    return coordinatesWithinContentArea;
}
```

**Impact**: Users can now only draw on the actual shared screen content, not on letterboxed areas.

### 2. Video-Based Coordinate Normalization

**File**: `js/canvas.js`

#### Added Coordinate Conversion Functions

**`canvasToVideoCoords(canvasX, canvasY)`**
- Converts canvas pixel coordinates to video content area coordinates
- Accounts for `object-fit: contain` letterboxing/pillarboxing
- Maps canvas space to video intrinsic dimensions

**`videoToCanvasCoords(videoX, videoY)`**
- Converts video content area coordinates back to canvas coordinates
- Reverse mapping of `canvasToVideoCoords`
- Ensures annotations render in correct canvas position

#### Updated Normalization Functions

**`normalizeCoordinates(x, y)`**
- **In screen mode**: Converts canvas coords → video coords → normalizes by video dimensions
- **In other modes**: Normalizes by canvas dimensions (existing behavior)
- Ensures all collaborators use the same reference (video dimensions)

**`denormalizeCoordinates(normX, normY)`**
- **In screen mode**: Denormalizes by video dimensions → converts to canvas coords
- **In other modes**: Denormalizes by canvas dimensions (existing behavior)
- Ensures received coordinates map correctly to local canvas

### 3. Coordinate Flow

#### When Drawing (Sender Side)

```
User clicks on canvas
    ↓
Canvas coordinates (x, y)
    ↓
[Screen mode] Convert to video coordinates
    ↓
Normalize by video dimensions (videoWidth, videoHeight)
    ↓
Send normalized (0-1) coordinates to peers
```

#### When Receiving (Receiver Side)

```
Receive normalized (0-1) coordinates
    ↓
Denormalize by video dimensions (videoWidth, videoHeight)
    ↓
[Screen mode] Convert video coordinates to canvas coordinates
    ↓
Render on canvas at correct position
```

### 4. Key Technical Details

#### Object-Fit: Contain Handling

When a video uses `object-fit: contain`, the actual video content may be smaller than the container:

- **Letterboxing**: Video is wider than container → black bars top/bottom
- **Pillarboxing**: Video is taller than container → black bars left/right

The solution calculates the actual content area:

```javascript
if (videoAspect > containerAspect) {
    // Letterboxing: content fills width, centered vertically
    contentWidth = videoRect.width;
    contentHeight = videoRect.width / videoAspect;
    contentTop = videoRect.top + (videoRect.height - contentHeight) / 2;
} else {
    // Pillarboxing: content fills height, centered horizontally
    contentHeight = videoRect.height;
    contentWidth = videoRect.height * videoAspect;
    contentLeft = videoRect.left + (videoRect.width - contentWidth) / 2;
}
```

#### Coordinate Space Mapping

The conversion between canvas and video coordinates accounts for:
1. Canvas position and size on screen
2. Video element position and size
3. Video content area (excluding letterboxing)
4. Video intrinsic dimensions (videoWidth/videoHeight)

## Files Modified

1. **`js/drawing.js`**
   - Added `isWithinVideoBounds()` function
   - Updated `handleStart()` to check video bounds
   - Updated `handleMove()` to stop drawing outside video bounds

2. **`js/canvas.js`**
   - Added `canvasToVideoCoords()` function
   - Added `videoToCanvasCoords()` function
   - Updated `normalizeCoordinates()` for screen mode
   - Updated `denormalizeCoordinates()` for screen mode

3. **`canvas.html`**
   - Changed video element from `max-w-full max-h-full` to `w-full h-full`
   - Removed centering classes to allow video to fill container

## Benefits

1. **Accurate Alignment**: Annotations from different screens now align perfectly
2. **Consistent Reference**: All users normalize/denormalize using the same video dimensions
3. **Proper Bounds**: Drawing is restricted to actual video content, not letterboxed areas
4. **Cross-Resolution Support**: Works correctly across different screen sizes and resolutions
5. **Aspect Ratio Handling**: Correctly handles videos with different aspect ratios than containers

## Testing Scenarios

The fix handles these scenarios correctly:

- ✅ Different screen resolutions (e.g., 1920x1080 vs 2560x1440)
- ✅ Different aspect ratios (e.g., 16:9 vs 21:9)
- ✅ Letterboxed videos (wider video in narrower container)
- ✅ Pillarboxed videos (taller video in wider container)
- ✅ Multiple simultaneous annotators
- ✅ Host drawing on their screen
- ✅ Viewers drawing on shared screen

## Example

**Before Fix:**
- Host (1920x1080 screen) draws at center → appears at center
- Viewer (2560x1440 screen) receives annotation → appears offset/incorrect position

**After Fix:**
- Host (1920x1080 screen) draws at center
- Coordinates normalized by video dimensions (e.g., 1920x1080)
- Viewer (2560x1440 screen) receives normalized coordinates
- Denormalizes by same video dimensions (1920x1080)
- Converts to their canvas coordinates
- Annotation appears at correct position matching host's view

## Conclusion

This fix ensures pixel-perfect alignment of annotations across all devices and screen resolutions by:
1. Using video intrinsic dimensions as the universal reference
2. Properly converting between coordinate spaces
3. Accounting for CSS scaling and letterboxing
4. Restricting drawing to actual video content area

The solution maintains backward compatibility with non-screen modes (whiteboard, image) while providing accurate coordinate mapping for screen sharing annotations.

