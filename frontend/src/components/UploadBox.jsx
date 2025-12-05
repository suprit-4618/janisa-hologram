import { useState } from "react";

export default function UploadBox({ setModelURL }) {
    const [loading, setLoading] = useState(false);

    function handleUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        setLoading(true);

        // ✅ Load GitHub model directly — NO BACKEND
        setTimeout(() => {
            setModelURL(
                "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb"
            );
            setLoading(false);
        }, 800);
    }

    return (
        <div style={{ marginTop: "30px", textAlign: "center" }}>
            <input type="file" onChange={handleUpload} />
            {loading && <p style={{ color: "#00eaff" }}>Loading Model...</p>}
        </div>
    );
}
