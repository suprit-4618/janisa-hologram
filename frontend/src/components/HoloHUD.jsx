import React from "react";
import "./HoloHUD.css";

const HoloHUD = ({ modelName, activeGesture, coords, trackerActive }) => {
    return (
        <div className="holo-hud-container">
            {/* Top Corners: System Status */}
            <div className="hud-corner top-left">
                <div className="hud-stat">
                    <span className="stat-label">SYSTEM:</span>
                    <span className={`stat-value ${trackerActive ? "pulse-text" : ""}`} style={{ color: trackerActive ? "#00ff00" : "#ffcc00" }}>
                        {trackerActive ? "TRACKING" : "ACTIVE"}
                    </span>
                </div>
                <div className="hud-stat">
                    <span className="stat-label">SIGNAL:</span>
                    <span className="stat-value">98.4%</span>
                </div>
            </div>

            <div className="hud-corner top-right">
                <div className="hud-stat">
                    <span className="stat-label">MODEL:</span>
                    <span className="stat-value">{modelName || "NONE"}</span>
                </div>
                <div className="hud-stat">
                    <span className="stat-label">ENCODING:</span>
                    <span className="stat-value">GLTF/PBR</span>
                </div>
            </div>

            {/* Middle: Scanning Ring */}
            <div className="hud-center-decor">
                <div className="ring ring-1"></div>
                <div className="ring ring-2"></div>
                <div className="ring ring-3"></div>
            </div>

            {/* Bottom Corners: Gesture & Metadata */}
            <div className="hud-corner bottom-left">
                <div className="hud-stat">
                    <span className="stat-label">GESTURE:</span>
                    <span className="stat-value">{activeGesture || "IDLE"}</span>
                </div>
                <div className="hud-mini-graph">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="graph-bar" style={{ height: `${20 + Math.random() * 60}%` }}></div>
                    ))}
                </div>
            </div>

            <div className="hud-corner bottom-right">
                <div className="hud-stat">
                    <span className="stat-label">COORDS:</span>
                    <span className="stat-value">
                        X: {(coords?.x || 0).toFixed(2)} Y: {(coords?.y || 0).toFixed(2)}
                    </span>
                </div>
                <div className="hud-btn-decor">
                    <div className="btn-indicator active"></div>
                    <div className="btn-indicator"></div>
                    <div className="btn-indicator"></div>
                </div>
            </div>
        </div>
    );
};

export default HoloHUD;
