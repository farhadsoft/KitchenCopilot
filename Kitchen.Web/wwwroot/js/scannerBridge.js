// scannerBridge.js — Coordinates Blazor <-> Camera <-> Worker
window.kitchenScanner = {
    _dotNetRef: null,
    _worker: null,
    _active: false,
    _videoId: null,
    _canvasId: null,

    init(dotNetRef) {
        this._dotNetRef = dotNetRef;
        this._worker = new Worker('js/visionWorker.js', { type: 'module' });
        this._worker.onmessage = (e) => {
            if (this._active) {
                this._dotNetRef.invokeMethodAsync('ProcessDetections', e.data.labels);
                // Trigger next frame immediately for real-time feel
                this._loop();
            }
        };
    },

    async start(videoId, canvasId) {
        this._videoId = videoId;
        this._canvasId = canvasId;
        await window.kitchenCamera.start(videoId);
        this._active = true;
        this._loop();
    },

    stop() {
        this._active = false;
        window.kitchenCamera.stop();
    },

    _loop() {
        if (!this._active) return;
        const frame = window.kitchenCamera.capture(this._videoId, this._canvasId);
        if (frame) {
            // Transfer ownership of the buffer to the worker (zero-copy)
            const rgba = new Uint8ClampedArray(frame.rgba);
            this._worker.postMessage({
                rgba,
                width: frame.width,
                height: frame.height
            }, [rgba.buffer]);
        } else {
            requestAnimationFrame(() => this._loop());
        }
    }
};