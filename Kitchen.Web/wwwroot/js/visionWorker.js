/**
 * visionWorker.js
 * Dedicated AI thread for Kitchen Copilot.
 * Handles YOLO26 inference using ONNX Runtime Web.
 */

import * as ort from 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/ort.bundle.min.mjs';

// Configuration for local WASM/WebGPU
ort.env.wasm.simd = true;
ort.env.wasm.proxy = false; 

let session = null;

/**
 * Initializes the ONNX Runtime session.
 * Loads the YOLO26 model with WebGPU priority.
 */
async function loadModel() {
    if (session) return;
    try {
        // Paths are relative to the wwwroot folder in Blazor
        session = await ort.InferenceSession.create('/models/yolo26n.onnx', {
            executionProviders: ['webgpu', 'wasm'],
            graphOptimizationLevel: 'all',
        });
        console.log('[Worker] YOLO26 Session Created Successfully');
    } catch (e) {
        console.error("[Worker] Failed to create inference session:", e);
    }
}

/**
 * Listens for messages from the main thread (scannerBridge.js).
 */
self.onmessage = async (e) => {
    const { rgba, width, height } = e.data;
    
    // Ensure model is loaded
    await loadModel();
    if (!session) return;

    try {
        const results = await runInference(rgba, width, height);
        // Post results back to the main thread
        self.postMessage({ labels: results });
    } catch (err) {
        console.error("[Worker] Inference execution error:", err);
    }
};

/**
 * Processes raw pixel data and runs the model.
 */
async function runInference(rgba, width, height) {
    // 1. Pre-processing (Normalization & Layout conversion)
    // YOLO models typically expect 640x640 input.
    // For this implementation, we assume the capture is already 640x640 
    // or we process the first 640x640 pixels for speed.
    const inputSize = 640;
    const pixels = new Float32Array(3 * inputSize * inputSize);
    
    // RGBA (HWC) -> RGB (CHW) conversion
    const stride = inputSize * inputSize;
    for (let i = 0; i < stride; i++) {
        pixels[i]              = rgba[i * 4]     / 255.0; // R Channel
        pixels[i + stride]     = rgba[i * 4 + 1] / 255.0; // G Channel
        pixels[i + stride * 2] = rgba[i * 4 + 2] / 255.0; // B Channel
    }

    // 2. Create Tensor
    const tensor = new ort.Tensor('float32', pixels, [1, 3, inputSize, inputSize]);
    
    // 3. Run Session
    const feeds = { [session.inputNames[0]]: tensor };
    const outputMap = await session.run(feeds);
    const output = outputMap[session.outputNames[0]].data;
    
    // 4. Parse YOLO26 NMS-free Output
    // Shape is typically [1, 84, 8400] or [1, num_classes + 4, num_anchors]
    const dims = outputMap[session.outputNames[0]].dims;
    const numAnchors = dims[2];
    const numClasses = dims[1] - 4;
    const confidenceThreshold = 0.45;
    
    const detected = [];

    for (let i = 0; i < numAnchors; i++) {
        let maxScore = 0;
        let maxClass = 0;
        
        // Check scores for each class
        for (let c = 0; c < numClasses; c++) {
            const score = output[(4 + c) * numAnchors + i];
            if (score > maxScore) {
                maxScore = score;
                maxClass = c;
            }
        }

        if (maxScore > confidenceThreshold) {
            detected.push({ 
                label: COCO_CLASSES[maxClass] || `item_${maxClass}`, 
                confidence: maxScore 
            });
        }
    }

    // 5. Deduplicate and Clean
    // Keep only the highest confidence detection for each label found in the frame
    const unique = Array.from(
        detected.reduce((map, item) => {
            if (!map.has(item.label) || map.get(item.label).confidence < item.confidence) {
                map.set(item.label, item);
            }
            return map;
        }, new Map()).values()
    );

    return unique.map(u => u.label).slice(0, 15);
}

// COCO Dataset Classes (Full list)
const COCO_CLASSES = [
    'person','bicycle','car','motorcycle','airplane','bus','train','truck','boat',
    'traffic light','fire hydrant','stop sign','parking meter','bench','bird','cat',
    'dog','horse','sheep','cow','elephant','bear','zebra','giraffe','backpack',
    'umbrella','handbag','tie','suitcase','frisbee','skis','snowboard','sports ball',
    'kite','baseball bat','baseball glove','skateboard','surfboard','tennis racket',
    'bottle','wine glass','cup','fork','knife','spoon','bowl','banana','apple',
    'sandwich','orange','broccoli','carrot','hot dog','pizza','donut','cake','chair',
    'couch','potted plant','bed','dining table','toilet','tv','laptop','mouse',
    'remote','keyboard','cell phone','microwave','oven','toaster','sink','refrigerator',
    'book','clock','vase','scissors','teddy bear','hair drier','toothbrush'
];