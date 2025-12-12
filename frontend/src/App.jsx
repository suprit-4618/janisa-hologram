import { useState } from "react";
import ModelBrowser from "./components/ModelBrowser";
import HoloViewer from "./components/HoloViewer";
import CommandBox from "./components/CommandBox";
import VoiceCommand from "./components/VoiceCommand";
import "./index.css";

export default function App() {
    const [modelURL, setModelURL] = useState(null);
    const [command, setCommand] = useState(null);

    return (
        <div className="app-root">
            {/* Top HUD Bar */}
            <div className="hud-bar">
                <h1 className="hud-title">JANISA</h1>
                <p className="hud-subtitle">Holographic Visualization Engine</p>
            </div>

            {/* Control Panel */}
            <div className="control-panel">
                <ModelBrowser setModelURL={setModelURL} />
                {modelURL && (
                    <>
                        <CommandBox onCommand={(cmd) => setCommand({ text: cmd, id: Date.now() })} />
                        <VoiceCommand onCommand={(cmd) => setCommand({ text: cmd, id: Date.now() })} />
                    </>
                )}
            </div>

            {/* Hologram Stage */}
            <div className="holo-stage">
                {modelURL ? (
                    <HoloViewer modelURL={modelURL} command={command} />
                ) : (
                    <div className="idle-hint">
                        <p>Select a model to activate hologram</p>
                        <span className="pulse-dot"></span>
                    </div>
                )}
            </div>
        </div>
    );
}
