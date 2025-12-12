import { useState } from "react";

export default function UploadBox({ setModelURL }) {
    function handleUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Create a URL for the local file
        const fileURL = URL.createObjectURL(file);
        setModelURL(fileURL);
    }

    return (
        <div style={{ marginTop: "30px", textAlign: "center" }}>
            <label
                htmlFor="file-upload"
                className="custom-file-upload"
                style={{
                    border: "1px solid #00eaff",
                    color: "#00eaff",
                    display: "inline-block",
                    padding: "6px 12px",
                    cursor: "pointer",
                    borderRadius: "4px",
                }}
            >
                Upload 3D Model
            </label>
            <input
                id="file-upload"
                type="file"
                onChange={handleUpload}
                style={{ display: "none" }}
                accept=".glb, .gltf"
            />
        </div>
    );
}
