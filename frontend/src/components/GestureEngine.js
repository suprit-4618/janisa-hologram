// GestureEngine.js
// Converts HandTracker frames into high-level controls for HoloViewer.
// - Designed for your selections:
//    Rotate -> wrist movement (B)
//    Zoom   -> pinch (A)
//    Move   -> open palm drag (A)
//    Reset  -> "L shape" (A)
//    Glow   -> emissive feedback (on when hand near)
//
// API:
//   import compute from "./GestureEngine";
//   const control = compute(frame, prevState, dt); // returns an object: { rotTarget, scaleTarget, posTarget, resetRequested, glowStrength }
// prevState is a small state object you persist between frames.

export default function computeGesture(frame, prev = {}) {
    // prev defaults
    const state = prev || {};
    const out = {
        rotTarget: { x: state.rotX || 0, y: state.rotY || 0 }, // radians
        scaleTarget: state.scale || 1,
        posTarget: state.pos || { x: 0, y: 0, z: 0 },
        reset: false,
        glow: 0,
        meta: {},
    };

    const hands = frame.hands || [];
    const h0 = hands[0] || null;
    const h1 = hands[1] || null;

    // helpers
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v || 0));
    const map = (v, inA, inB, outA, outB) => outA + ((v - inA) / (inB - inA)) * (outB - outA);

    // 1) ROTATION -> Wrist movement mapping (B)
    // Use wrist-relative to center: small normalized offset -> rotation target
    if (h0 && !h1) {
        const dx = (h0.wrist.x - 0.5); // centered dx
        const dy = (h0.wrist.y - 0.5); // centered dy
        // sensitivity tuned for comfortable movement
        out.rotTarget.y = clamp(dx * 3.5, -1.8, 1.8); // yaw
        out.rotTarget.x = clamp(-dy * 2.5, -1.2, 1.2); // pitch
    } else if (h1 && !h0) {
        // single-hand on other side
        const dx = (h1.wrist.x - 0.5);
        const dy = (h1.wrist.y - 0.5);
        out.rotTarget.y = clamp(dx * 3.5, -1.8, 1.8);
        out.rotTarget.x = clamp(-dy * 2.5, -1.2, 1.2);
    } else if (h0 && h1) {
        // two-hand midpoint controls rotation gently (center of two wrists)
        const mx = (h0.wrist.x + h1.wrist.x) / 2 - 0.5;
        const my = (h0.wrist.y + h1.wrist.y) / 2 - 0.5;
        out.rotTarget.y = clamp(mx * 3.0, -1.6, 1.6);
        out.rotTarget.x = clamp(-my * 2.0, -1.0, 1.0);
    }

    // 2) ZOOM -> Pinch (A)
    // Evaluate strongest pinch among hands (small pinch => closed)
    const pinch0 = h0 ? h0.pinch : Infinity;
    const pinch1 = h1 ? h1.pinch : Infinity;
    const pinch = Math.min(pinch0, pinch1);
    // Map pinch distance to scale factor. Typical pinch ~ 0.02..0.12
    // We invert: smaller pinch -> larger scale (closer/zoom)
    if (pinch !== Infinity) {
        // invert and map to scale target
        const inv = clamp(map(pinch, 0.02, 0.18, 1.2, 0.0), 0.0, 1.2);
        // desired scale around 0.7..2.0
        const scaleTarget = clamp(1 + inv * 1.4, 0.45, 2.8);
        out.scaleTarget = scaleTarget;
    }

    // 3) MOVE -> Open palm drag (A)
    // Detect open palm: pinch larger than threshold and area reasonably large
    function isPalmOpen(h) {
        if (!h) return false;
        return h.pinch > 0.08 && h.area > 0.05; // tuned thresholds
    }
    // If palm open, use index tip mean velocity (hist) to drive translation in X/Y
    if (isPalmOpen(h0) && !h1) {
        const mv = frame.hist.h0vel || { vx: 0, vy: 0 };
        // map velocities to small position offsets
        out.posTarget.x = clamp((mv.vx || 0) * -0.35, -1.2, 1.2);
        out.posTarget.y = clamp((mv.vy || 0) * 0.35, -1.2, 1.2);
    } else if (isPalmOpen(h1) && !h0) {
        const mv = frame.hist.h1vel || { vx: 0, vy: 0 };
        out.posTarget.x = clamp((mv.vx || 0) * -0.35, -1.2, 1.2);
        out.posTarget.y = clamp((mv.vy || 0) * 0.35, -1.2, 1.2);
    } else if (h0 && h1 && isPalmOpen(h0) && isPalmOpen(h1)) {
        // two palms open -> move object by midpoint motion
        const m0 = frame.hist.h0mean, m1 = frame.hist.h1mean;
        if (m0 && m1) {
            const mid = { x: (m0.x + m1.x) / 2 - 0.5, y: (m0.y + m1.y) / 2 - 0.5 };
            out.posTarget.x = clamp(mid.x * 2.2, -1.6, 1.6);
            out.posTarget.y = clamp(-mid.y * 1.6, -1.2, 1.2);
        }
    }

    // 4) RESET -> "L shape" gesture (A)
    // Simple L-shape heuristic: index extended far from thumb, and middle folded (index->thumb large & middle close to wrist)
    function isLShape(h) {
        if (!h) return false;
        const idxThumb = Math.hypot(h.indexTip.x - h.thumbTip.x, h.indexTip.y - h.thumbTip.y);
        const midWrist = Math.hypot(h.middleTip.x - h.wrist.x, h.middleTip.y - h.wrist.y);
        // L: index extended (large idxThumb), middle near wrist (small midWrist)
        return idxThumb > 0.11 && midWrist < 0.06;
    }
    if (isLShape(h0) || isLShape(h1)) {
        out.reset = true;
    }

    // 5) GLOW -> hand proximity (emit stronger glow when hand is close / near model center)
    // Use smallest area (larger area indicates closer to camera)
    const areas = hands.map((h) => h.area || 0);
    const maxArea = areas.length ? Math.max(...areas) : 0;
    out.glow = clamp(map(maxArea, 0.02, 0.22, 0.0, 1.0), 0.0, 1.0);

    // Put meta for debugging
    out.meta = {
        handsCount: hands.length,
        pinch0,
        pinch1,
        maxArea,
    };

    return out;
}
