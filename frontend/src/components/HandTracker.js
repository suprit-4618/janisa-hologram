// HandTracker.js
// MediaPipe Tasks Vision based tracker. Returns a normalized, smoothed frame object.
// - detects up to 2 hands (numHands = 2)
// - computes indexTip, thumbTip, wrist, middleTip, pinch, area
// - supplies a small history (for velocities) and a timestamp
//
// Usage:
//   import startHandTracking from "./HandTracker";
//   startHandTracking((frame) => { /* frame.hands -> array of hand states */ });

import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

let handLandmarker = null;
let videoEl = null;

export default async function startHandTracking(onFrame) {
    // Ensure version installed: npm install @mediapipe/tasks-vision@0.10.0
    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
    );

    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath:
                "https://storage.googleapis.com/mediapipe-assets/hand_landmarker.task",
        },
        runningMode: "video",
        numHands: 2,
    });

    // create small webcam preview (optional but useful)
    videoEl = document.createElement("video");
    Object.assign(videoEl.style, {
        position: "absolute",
        right: "12px",
        bottom: "12px",
        width: "200px",
        height: "150px",
        border: "2px solid #00eaff",
        borderRadius: "8px",
        zIndex: 9999,
        transform: "translateZ(0)",
    });
    document.body.appendChild(videoEl);

    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoEl.srcObject = stream;
    await videoEl.play();
    await new Promise((r) => {
        if (videoEl.readyState >= 2) return r();
        videoEl.onloadeddata = () => r();
    });

    // History buffers (for velocity & smoothing)
    const history = { h0: [], h1: [], maxLen: 8 };

    function pushHist(buf, v) {
        buf.push(v);
        if (buf.length > history.maxLen) buf.shift();
    }

    function mean(buf) {
        if (!buf.length) return null;
        const s = buf.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });
        return { x: s.x / buf.length, y: s.y / buf.length };
    }

    function calcVel(buf) {
        if (buf.length < 2) return { vx: 0, vy: 0 };
        const a = buf[buf.length - 2], b = buf[buf.length - 1];
        const dt = Math.max((b.t - a.t) / 1000, 1 / 60);
        return { vx: (b.x - a.x) / dt, vy: (b.y - a.y) / dt };
    }

    function computeHandState(lm) {
        // lm: 21 landmarks normalized (x,y,z)
        const wrist = lm[0];
        const index = lm[8];
        const thumb = lm[4];
        const middle = lm[12];

        const pinch = Math.hypot(index.x - thumb.x, index.y - thumb.y); // small -> pinched
        const area = Math.hypot(index.x - wrist.x, index.y - wrist.y); // rough size

        return { wrist, indexTip: index, thumbTip: thumb, middleTip: middle, pinch, area, raw: lm };
    }

    async function loop() {
        try {
            const results = await handLandmarker.detectForVideo(videoEl, performance.now());
            const raw = results.landmarks || [];
            const hands = [];

            for (let i = 0; i < raw.length; ++i) {
                hands.push(computeHandState(raw[i]));
            }

            // update history for smoothing
            if (hands[0]) {
                pushHist(history.h0, { x: hands[0].indexTip.x, y: hands[0].indexTip.y, t: performance.now() });
            } else {
                history.h0 = [];
            }
            if (hands[1]) {
                pushHist(history.h1, { x: hands[1].indexTip.x, y: hands[1].indexTip.y, t: performance.now() });
            } else {
                history.h1 = [];
            }

            const frame = {
                time: performance.now(),
                hands, // array of 0..2 hand states
                hist: {
                    h0mean: mean(history.h0),
                    h1mean: mean(history.h1),
                    h0vel: calcVel(history.h0),
                    h1vel: calcVel(history.h1),
                },
            };

            // callback
            onFrame(frame);
        } catch (e) {
            // don't crash loop on occasional errors
            console.warn("HandTracker loop error:", e);
        } finally {
            requestAnimationFrame(loop);
        }
    }

    loop();
}
