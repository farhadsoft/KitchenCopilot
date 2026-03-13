// Kitchen Copilot — Camera & image decode helpers
window.kitchenCamera = {
    _stream: null,

    async start(videoId) {
        const video = document.getElementById(videoId);
        this._stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        video.srcObject = this._stream;
    },

    stop() {
        this._stream?.getTracks().forEach(t => t.stop());
        this._stream = null;
    },

    capture(videoId, canvasId) {
        const video = document.getElementById(videoId);
        const canvas = document.getElementById(canvasId);
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        this.stop();
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        return { rgba: Array.from(imageData.data), width: canvas.width, height: canvas.height };
    },

    // imageBytes arrives as Uint8Array from Blazor WASM (.NET 7+ byte[] interop).
    // Uses createImageBitmap — no img element, no blob URL, no DOM event loop needed.
    async decodeImage(imageBytes, canvasId, mimeType) {
        const bytes = imageBytes instanceof Uint8Array ? imageBytes : new Uint8Array(imageBytes);
        const blob = new Blob([bytes], { type: mimeType || 'image/jpeg' });
        const bitmap = await createImageBitmap(blob);
        const canvas = document.getElementById(canvasId);
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas.getContext('2d').drawImage(bitmap, 0, 0);
        bitmap.close();
        const imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
        return { rgba: Array.from(imageData.data), width: canvas.width, height: canvas.height };
    }
};
