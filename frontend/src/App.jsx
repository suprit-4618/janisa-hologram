import { useState } from "react";
import UploadBox from "./components/UploadBox";
import HoloViewer from "./components/HoloViewer";
import "./index.css";

export default function App() {
    const [modelURL, setModelURL] = useState(null);

    return (
        <div className="app-root">
            {/* Top HUD Bar */}
            <div className="hud-bar">
                <h1 className="hud-title">JANISA</h1>
                <p className="hud-subtitle">Holographic Visualization Engine</p>
            </div>

            {/* Control Panel */}
            <div className="control-panel">
                <UploadBox setModelURL={setModelURL} />
            </div>

            {/* Hologram Stage */}
            <div className="holo-stage">
                {modelURL ? (
                    <HoloViewer modelURL={modelURL} />
                ) : (
                    <div className="idle-hint">
                        <p>Upload an image to activate hologram</p>
                        <span className="pulse-dot"></span>
                    </div>
                )}
            </div>
        </div>
    );
}
