import { useState } from "react";
import UploadBox from "./components/UploadBox";
import HoloViewer from "./components/HoloViewer";

export default function App() {
    const [modelURL, setModelURL] = useState(null);

    return (
        <div style={{
            background: "#000",
            color: "white",
            height: "100vh",
            padding: "20px",
            textAlign: "center"
        }}>
            <h1 style={{ letterSpacing: "5px" }}>JANISA HOLOGRAM ENGINE</h1>

            {!modelURL ? (
                <UploadBox setModelURL={setModelURL} />
            ) : (
                <HoloViewer modelURL={modelURL} />
            )}
        </div>
    );
}
