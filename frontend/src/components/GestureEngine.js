// GestureEngine.js
// Converts HandTracker frames into high-level controls for HoloViewer.

const GESTURE_CONFIG = {
    ROTATION_SENSITIVITY_X: 2.0,
    ROTATION_SENSITIVITY_Y: 2.8,
    ROTATION_SENSITIVITY_MULTI_X: 1.6,
    ROTATION_SENSITIVITY_MULTI_Y: 2.4,
    ROTATION_MIN_X: -1.2,
    ROTATION_MAX_X: 1.2,
    ROTATION_MIN_Y: -1.8,
    ROTATION_MAX_Y: 1.8,
    
    ZOOM_SENSITIVITY: 1.8,
    ZOOM_MIN: 0.45,
    ZOOM_MAX: 3.0,
    
    MOVE_SENSITIVITY_X: -0.28,
    MOVE_SENSITIVITY_Y: 0.28,
    MOVE_SENSITIVITY_MULTI_X: 1.8,
    MOVE_SENSITIVITY_MULTI_Y: 1.3,
    MOVE_MIN_X: -1.2,
    MOVE_MAX_X: 1.2,
    MOVE_MIN_Y: -1.2,
    MOVE_MAX_Y: 1.2,
    
    L_SHAPE_THRESHOLD: 0.11,
    L_SHAPE_WRIST_THRESHOLD: 0.06,
    
    PALM_OPEN_PINCH_THRESHOLD: 0.08,
    PALM_OPEN_AREA_THRESHOLD: 0.05,
    
    GLOW_AREA_MIN: 0.02,
    GLOW_AREA_MAX: 0.22,
};

export default function computeGesture(frame, prev = {}) {
    const state = prev || {};
    const out = {
        rotTarget: { x: state.rotX || 0, y: state.rotY || 0 },
        scaleTarget: state.scale || 1,
        posTarget: state.pos || { x: 0, y: 0, z: 0 },
        reset: false,
        glow: 0,
        meta: {},
    };

    const hands = frame.hands || [];
    const h0 = hands[0] || null;
    const h1 = hands[1] || null;

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v || 0));
    const map = (v, inA, inB, outA, outB) =>
        outA + ((v - inA) / (inB - inA)) * (outB - outA);

    // ================================
    // ✅ 1) ROTATION (FIXED MIRROR)
    // ================================
    if (h0 && !h1) {
        const dx = h0.wrist.x - 0.5;
        const dy = h0.wrist.y - 0.5;

        out.rotTarget.y = clamp(-dx * GESTURE_CONFIG.ROTATION_SENSITIVITY_Y, GESTURE_CONFIG.ROTATION_MIN_Y, GESTURE_CONFIG.ROTATION_MAX_Y); // ✅ FIXED: mirror corrected
        out.rotTarget.x = clamp(dy * GESTURE_CONFIG.ROTATION_SENSITIVITY_X, GESTURE_CONFIG.ROTATION_MIN_X, GESTURE_CONFIG.ROTATION_MAX_X);  // ✅ FIXED: up = up
    }
    else if (h1 && !h0) {
        const dx = h1.wrist.x - 0.5;
        const dy = h1.wrist.y - 0.5;

        out.rotTarget.y = clamp(-dx * GESTURE_CONFIG.ROTATION_SENSITIVITY_Y, GESTURE_CONFIG.ROTATION_MIN_Y, GESTURE_CONFIG.ROTATION_MAX_Y);
        out.rotTarget.x = clamp(dy * GESTURE_CONFIG.ROTATION_SENSITIVITY_X, GESTURE_CONFIG.ROTATION_MIN_X, GESTURE_CONFIG.ROTATION_MAX_X);
    }
    else if (h0 && h1) {
        const mx = (h0.wrist.x + h1.wrist.x) / 2 - 0.5;
        const my = (h0.wrist.y + h1.wrist.y) / 2 - 0.5;

        out.rotTarget.y = clamp(-mx * GESTURE_CONFIG.ROTATION_SENSITIVITY_MULTI_Y, -1.6, 1.6);
        out.rotTarget.x = clamp(my * GESTURE_CONFIG.ROTATION_SENSITIVITY_MULTI_X, -1.0, 1.0);
    }

    // ================================
    // ✅ 2) ZOOM (NATURAL PINCH)
    // ================================
    const pinch0 = h0 ? h0.pinch : Infinity;
    const pinch1 = h1 ? h1.pinch : Infinity;
    const pinch = Math.min(pinch0, pinch1);

    if (pinch !== Infinity) {
        // ✅ Natural zoom: smaller pinch = zoom in
        const norm = clamp(map(pinch, 0.02, 0.18, 1.0, 0.0), 0, 1);
        const scaleTarget = clamp(0.6 + norm * GESTURE_CONFIG.ZOOM_SENSITIVITY, GESTURE_CONFIG.ZOOM_MIN, GESTURE_CONFIG.ZOOM_MAX);
        out.scaleTarget = scaleTarget;
    }

    // ================================
    // ✅ 3) MOVE (PALM DRAG)
    // ================================
    function isPalmOpen(h) {
        if (!h) return false;
        return h.pinch > GESTURE_CONFIG.PALM_OPEN_PINCH_THRESHOLD && h.area > GESTURE_CONFIG.PALM_OPEN_AREA_THRESHOLD;
    }

    if (isPalmOpen(h0) && !h1) {
        const mv = frame.hist.h0vel || { vx: 0, vy: 0 };
        out.posTarget.x = clamp(mv.vx * GESTURE_CONFIG.MOVE_SENSITIVITY_X, GESTURE_CONFIG.MOVE_MIN_X, GESTURE_CONFIG.MOVE_MAX_X);
        out.posTarget.y = clamp(mv.vy * GESTURE_CONFIG.MOVE_SENSITIVITY_Y, GESTURE_CONFIG.MOVE_MIN_Y, GESTURE_CONFIG.MOVE_MAX_Y);
    }
    else if (isPalmOpen(h1) && !h0) {
        const mv = frame.hist.h1vel || { vx: 0, vy: 0 };
        out.posTarget.x = clamp(mv.vx * GESTURE_CONFIG.MOVE_SENSITIVITY_X, GESTURE_CONFIG.MOVE_MIN_X, GESTURE_CONFIG.MOVE_MAX_X);
        out.posTarget.y = clamp(mv.vy * GESTURE_CONFIG.MOVE_SENSITIVITY_Y, GESTURE_CONFIG.MOVE_MIN_Y, GESTURE_CONFIG.MOVE_MAX_Y);
    }
    else if (h0 && h1 && isPalmOpen(h0) && isPalmOpen(h1)) {
        const m0 = frame.hist.h0mean;
        const m1 = frame.hist.h1mean;
        if (m0 && m1) {
            const mid = {
                x: (m0.x + m1.x) / 2 - 0.5,
                y: (m0.y + m1.y) / 2 - 0.5,
            };
            out.posTarget.x = clamp(mid.x * GESTURE_CONFIG.MOVE_SENSITIVITY_MULTI_X, -1.6, 1.6);
            out.posTarget.y = clamp(mid.y * GESTURE_CONFIG.MOVE_SENSITIVITY_MULTI_Y, -1.2, 1.2);
        }
    }

    // ================================
    // ✅ 4) RESET (L SHAPE)
    // ================================
    function isLShape(h) {
        if (!h) return false;
        const idxThumb = Math.hypot(
            h.indexTip.x - h.thumbTip.x,
            h.indexTip.y - h.thumbTip.y
        );
        const midWrist = Math.hypot(
            h.middleTip.x - h.wrist.x,
            h.middleTip.y - h.wrist.y
        );
        return idxThumb > GESTURE_CONFIG.L_SHAPE_THRESHOLD && midWrist < GESTURE_CONFIG.L_SHAPE_WRIST_THRESHOLD;
    }

    if (isLShape(h0) || isLShape(h1)) {
        out.reset = true;
    }

    // ================================
    // ✅ 5) GLOW (PROXIMITY)
    // ================================
    const areas = hands.map((h) => h.area || 0);
    const maxArea = areas.length ? Math.max(...areas) : 0;
    out.glow = clamp(map(maxArea, GESTURE_CONFIG.GLOW_AREA_MIN, GESTURE_CONFIG.GLOW_AREA_MAX, 0.0, 1.0), 0.0, 1.0);

    out.meta = {
        handsCount: hands.length,
        pinch0,
        pinch1,
        maxArea,
    };

    return out;
}
