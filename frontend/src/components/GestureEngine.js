// GestureEngine.js
// Converts HandTracker frames into high-level controls for HoloViewer.

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

        out.rotTarget.y = clamp(-dx * 3.5, -1.8, 1.8); // ✅ FIXED: mirror corrected
        out.rotTarget.x = clamp(dy * 2.5, -1.2, 1.2);  // ✅ FIXED: up = up
    }
    else if (h1 && !h0) {
        const dx = h1.wrist.x - 0.5;
        const dy = h1.wrist.y - 0.5;

        out.rotTarget.y = clamp(-dx * 3.5, -1.8, 1.8);
        out.rotTarget.x = clamp(dy * 2.5, -1.2, 1.2);
    }
    else if (h0 && h1) {
        const mx = (h0.wrist.x + h1.wrist.x) / 2 - 0.5;
        const my = (h0.wrist.y + h1.wrist.y) / 2 - 0.5;

        out.rotTarget.y = clamp(-mx * 3.0, -1.6, 1.6);
        out.rotTarget.x = clamp(my * 2.0, -1.0, 1.0);
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
        const scaleTarget = clamp(0.6 + norm * 2.2, 0.45, 3.0);
        out.scaleTarget = scaleTarget;
    }

    // ================================
    // ✅ 3) MOVE (PALM DRAG)
    // ================================
    function isPalmOpen(h) {
        if (!h) return false;
        return h.pinch > 0.08 && h.area > 0.05;
    }

    if (isPalmOpen(h0) && !h1) {
        const mv = frame.hist.h0vel || { vx: 0, vy: 0 };
        out.posTarget.x = clamp(mv.vx * -0.35, -1.2, 1.2);
        out.posTarget.y = clamp(mv.vy * 0.35, -1.2, 1.2);
    }
    else if (isPalmOpen(h1) && !h0) {
        const mv = frame.hist.h1vel || { vx: 0, vy: 0 };
        out.posTarget.x = clamp(mv.vx * -0.35, -1.2, 1.2);
        out.posTarget.y = clamp(mv.vy * 0.35, -1.2, 1.2);
    }
    else if (h0 && h1 && isPalmOpen(h0) && isPalmOpen(h1)) {
        const m0 = frame.hist.h0mean;
        const m1 = frame.hist.h1mean;
        if (m0 && m1) {
            const mid = {
                x: (m0.x + m1.x) / 2 - 0.5,
                y: (m0.y + m1.y) / 2 - 0.5,
            };
            out.posTarget.x = clamp(mid.x * 2.2, -1.6, 1.6);
            out.posTarget.y = clamp(mid.y * 1.6, -1.2, 1.2);
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
        return idxThumb > 0.11 && midWrist < 0.06;
    }

    if (isLShape(h0) || isLShape(h1)) {
        out.reset = true;
    }

    // ================================
    // ✅ 5) GLOW (PROXIMITY)
    // ================================
    const areas = hands.map((h) => h.area || 0);
    const maxArea = areas.length ? Math.max(...areas) : 0;
    out.glow = clamp(map(maxArea, 0.02, 0.22, 0.0, 1.0), 0.0, 1.0);

    out.meta = {
        handsCount: hands.length,
        pinch0,
        pinch1,
        maxArea,
    };

    return out;
}
