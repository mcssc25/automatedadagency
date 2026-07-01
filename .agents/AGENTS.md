# Workspace Rules and Learnings

## Video Downloading & Player Compatibility

### 1. Avoiding Browser Video Player Black Screens (Media Fragments)
* **Problem**: Passing hash fragments in `<video src="...">` URLs (e.g., `#avatar_sarah`) triggers browser **HTML5 Media Fragment** parsing. If the fragment is not a standard timeline/track setting, browser video engines crash, leaving the player blank/black at `0:00`.
* **Fix**: Use query parameters instead (e.g., `?avatar_sarah`). Browser players ignore unknown query parameters, and CDN/express servers stream the video correctly while client JS can still read the parameter.

### 2. yt-dlp Video Download Configuration (No-FFmpeg Environments)
* **Problem**: If `ffmpeg` is not installed on the system, `yt-dlp` cannot merge separate video and audio streams. By default, it downloads separate files like `.f401.mp4` (video-only) and `.f251.webm` (audio-only) and fails to merge them.
* **Fixes**:
  * **Strict Format Selectors**: Use pre-merged formats that natively use standard codecs (H.264/AAC): `"22/18/best[ext=mp4][vcodec^=avc1]/best[ext=mp4]"`. YouTube format `22` (720p H.264/AAC) and `18` (360p H.264/AAC) are guaranteed to be pre-merged and browser-playable.
  * **Exclude Split Files**: When scanning the download folder for the video file, explicitly filter out any files that contain the `.f\d+.` split format suffix (e.g., `.f251.webm` or `.f401.mp4`), and prioritize merged `.mp4` over `.webm` to prevent serving audio-only tracks to the browser.

### 3. Avoiding 403 Forbidden on External Stock Spokesperson Videos (Free Mode)
* **Problem**: Hotlinking stock videos directly from external websites like Mixkit CDN (`assets.mixkit.co`) eventually returns a `403 Forbidden` error because CDNs block unreferred hotlinking. This leaves the spokesperson video blank.
* **Fix**: Download the stock presenter templates once via `yt-dlp` using browser-safe formats, store them locally in `downloads/` (e.g. `downloads/avatar_sarah.mp4`), and serve them locally from the Node backend server (e.g. `/downloads/avatar_sarah.mp4?avatar_sarah`). This guarantees 100% availability, speed, and reliability.

## AI Image Generation & Imagen 4 Integration

### 1. Google AI Studio Imagen 4 REST API
* **Problem**: Public free APIs like Pollinations.ai are prone to sudden overloading and return `429 Too Many Requests` errors, leaving generated images blank/broken.
* **Fix**: Use the user's `GEMINI_API_KEY` to directly call Google's native **Imagen 4** model (`imagen-4.0-generate-001`).
* **Usage**:
  * **Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key={API_KEY}` (requires `:predict`, not `:generateContent`).
  * **Method**: `POST`
  * **Request Body**:
    ```json
    {
      "instances": [{ "prompt": "promptText" }],
      "parameters": { "sampleCount": 1 }
    }
    ```
  * **Response Format**: Reads base64-encoded image data from `predictions[0].bytesBase64Encoded` and saves it locally.
  * **Robustness**: Implement fallback to local stock real estate images in case of key/quota issues to guarantee zero broken images.


