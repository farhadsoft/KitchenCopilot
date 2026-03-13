// Kitchen Copilot — Optimized Camera Helpers
window.kitchenCamera = {
    _stream: null,

    async start(videoId) {
        try {
            const video = document.getElementById(videoId);
            if (!video) return;

            this._stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: 'environment',
                    width: { ideal: 640 },
                    height: { ideal: 640 }
                } 
            });
            video.srcObject = this._stream;
            await video.play();
        } catch (err) {
            console.error("Camera start failed:", err);
        }
    },

    stop() {
        if (this._stream) {
            this._stream.getTracks().forEach(t => t.stop());
            this._stream = null;
        }
    },

    // Captures a frame without stopping the camera stream
    capture(videoId, canvasId) {
        const video = document.getElementById(videoId);
        const canvas = document.getElementById(canvasId);
        if (!video || !canvas || video.paused || video.ended) return null;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d', { alpha: false });
        ctx.drawImage(video, 0, 0);

        // Use getImageData for raw pixel access
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Return raw data. Blazor/JS Bridge will handle the transfer to Worker.
        return {
            rgba: Array.from(imageData.data),
            width: canvas.width,
            height: canvas.height
        };
    },

    // Decodes an uploaded image file into raw RGBA pixels via an offscreen canvas.
    // Always scales to 640x640 to match YOLO input and avoid transferring full-res
    // pixel data (e.g. a 12MP phone photo = ~200 MB of JSON — freezes the browser).
    async decodeImage(imageBytes, canvasId, contentType) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;

        const blob = new Blob([new Uint8Array(imageBytes)], { type: contentType });
        const url = URL.createObjectURL(blob);
        try {
            const img = await new Promise((resolve, reject) => {
                const i = new Image();
                i.onload = () => resolve(i);
                i.onerror = reject;
                i.src = url;
            });
            // Resize to 640x640 — YOLO input size, and keeps interop data at ~1.6 MB
            canvas.width = 640;
            canvas.height = 640;
            const ctx = canvas.getContext('2d', { alpha: false });
            ctx.drawImage(img, 0, 0, 640, 640);
            const imageData = ctx.getImageData(0, 0, 640, 640);
            return {
                rgba: Array.from(imageData.data),
                width: 640,
                height: 640
            };
        } finally {
            URL.revokeObjectURL(url);
        }
    }
};