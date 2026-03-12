// ONNX Runtime Web interop — runs inside a Web Worker to keep UI at 60 FPS
// WebGPU priority with WASM SIMD fallback

import * as ort from 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/esm/ort.bundle.min.mjs';

ort.env.wasm.simd = true;
ort.env.wasm.proxy = false; // already inside a worker

let session = null;

async function loadModel() {
    if (session) return;
    session = await ort.InferenceSession.create('/models/yolo26n.onnx', {
        executionProviders: ['webgpu', 'wasm'],
        graphOptimizationLevel: 'all',
    });
    console.log('[ORT] YOLO26 model loaded. Inputs:', session.inputNames);
}

/**
 * Runs YOLO26 inference on raw RGBA pixel data.
 * @param {number[]} rgbaPixels - Flat RGBA array from canvas.getImageData()
 * @param {number} width
 * @param {number} height
 * @returns {Promise<{label: string, confidence: number}[]>}
 */
export async function runInference(rgbaPixels, width, height) {
    await loadModel();

    // Convert RGBA → RGB float32 tensor, normalized [0,1], CHW layout
    const pixels = new Float32Array(3 * width * height);
    for (let i = 0; i < width * height; i++) {
        pixels[i]                   = rgbaPixels[i * 4]     / 255; // R
        pixels[i + width * height]  = rgbaPixels[i * 4 + 1] / 255; // G
        pixels[i + width * height * 2] = rgbaPixels[i * 4 + 2] / 255; // B
    }

    const tensor = new ort.Tensor('float32', pixels, [1, 3, height, width]);
    const feeds = { [session.inputNames[0]]: tensor };
    const results = await session.run(feeds);

    // Parse YOLO26 NMS-free output (cx, cy, w, h, class_scores...)
    const output = results[session.outputNames[0]].data;
    const numAnchors = results[session.outputNames[0]].dims[2];
    const numClasses = results[session.outputNames[0]].dims[1] - 4;

    const detections = [];
    const confidenceThreshold = 0.35;

    for (let i = 0; i < numAnchors; i++) {
        let maxScore = 0;
        let maxClass = 0;
        for (let c = 0; c < numClasses; c++) {
            const score = output[(4 + c) * numAnchors + i];
            if (score > maxScore) { maxScore = score; maxClass = c; }
        }
        if (maxScore >= confidenceThreshold) {
            detections.push({ label: COCO_CLASSES[maxClass] ?? `class_${maxClass}`, confidence: maxScore });
        }
    }

    // Deduplicate by label, keep highest confidence
    const byLabel = new Map();
    for (const d of detections) {
        if (!byLabel.has(d.label) || byLabel.get(d.label).confidence < d.confidence)
            byLabel.set(d.label, d);
    }

    return [...byLabel.values()].sort((a, b) => b.confidence - a.confidence).slice(0, 20);
}

// COCO class names (food-relevant subset shown first for clarity)
const COCO_CLASSES = [
    'person','bicycle','car','motorcycle','airplane','bus','train','truck','boat',
    'traffic light','fire hydrant','stop sign','parking meter','bench',
    'bird','cat','dog','horse','sheep','cow','elephant','bear','zebra','giraffe',
    'backpack','umbrella','handbag','tie','suitcase','frisbee','skis','snowboard',
    'sports ball','kite','baseball bat','baseball glove','skateboard','surfboard',
    'tennis racket','bottle','wine glass','cup','fork','knife','spoon','bowl',
    'banana','apple','sandwich','orange','broccoli','carrot','hot dog','pizza',
    'donut','cake','chair','couch','potted plant','bed','dining table','toilet',
    'tv','laptop','mouse','remote','keyboard','cell phone','microwave','oven',
    'toaster','sink','refrigerator','book','clock','vase','scissors','teddy bear',
    'hair drier','toothbrush'
];
