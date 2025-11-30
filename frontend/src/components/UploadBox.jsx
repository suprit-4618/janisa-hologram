import axios from "axios";
import { useState } from "react";

export default function UploadBox({ setModelURL }) {
    const [loading, setLoading] = useState(false);

    async function handleUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        setLoading(true);

        const formData = new FormData();
        formData.append("file", file);

        const res = await axios.post("http://127.0.0.1:8000/upload", formData);

        // ✅ INSTANTLY LOAD GITHUB MODEL
        setModelURL(res.data.model_url);

        setLoading(false);
    }

    return (
        <div style={{ marginTop: "30px", textAlign: "center" }}>
            <input type="file" onChange={handleUpload} />
            {loading && <p style={{ color: "#00eaff" }}>Loading model...</p>}
        </div>
    );
}
