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

    async decodeImage(imageBytes, canvasId) {
        const blob = new Blob([new Uint8Array(imageBytes)]);
        const url = URL.createObjectURL(blob);
        const img = new Image();
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
        const canvas = document.getElementById(canvasId);
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        return { rgba: Array.from(imageData.data), width: canvas.width, height: canvas.height };
    }
};
