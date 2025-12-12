import { useState, useEffect, useCallback } from "react";

const API_URL = "http://127.0.0.1:8000";

export default function ModelBrowser({ setModelURL }) {
    const [models, setModels] = useState([]);
    const [selectedModel, setSelectedModel] = useState(null);

    const fetchModels = useCallback(() => {
        fetch(`${API_URL}/models`)
            .then((res) => res.json())
            .then((data) => {
                setModels(data.models);
                if (data.models.length > 0 && !selectedModel) {
                    const firstModel = data.models[0];
                    setSelectedModel(firstModel);
                    setModelURL(`${API_URL}/models/${firstModel}`);
                }
            })
            .catch(err => console.error("Failed to fetch models:", err));
    }, [setModelURL, selectedModel]);

    useEffect(() => {
        fetchModels();
    }, [fetchModels]);

    function handleModelSelect(modelName) {
        setSelectedModel(modelName);
        setModelURL(`${API_URL}/models/${modelName}`);
    }

    function handleUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (file.name.toLowerCase().endsWith(".blend")) {
            alert("'.blend' files are not supported. Please export your model to a web-friendly format like .gltf or .glb from Blender.");
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        fetch(`${API_URL}/upload`, {
            method: "POST",
            body: formData,
        })
        .then(res => res.json())
        .then(data => {
            if (data.model_name) {
                fetchModels();
                setSelectedModel(data.model_name);
                setModelURL(`${API_URL}/models/${data.model_name}`);
            } else if (data.error) {
                console.error("Upload error:", data.error);
                alert("Upload failed: " + data.error);
            }
        })
        .catch(err => console.error("Upload failed:", err));
    }

    return (
        <div style={{ marginTop: "30px", textAlign: "center", color: "#00eaff" }}>
            <div>
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
                        marginBottom: "15px"
                    }}
                >
                    Upload Model
                </label>
                <input
                    id="file-upload"
                    type="file"
                    onChange={handleUpload}
                    style={{ display: "none" }}
                    accept=".glb, .gltf, .obj, .fbx, .stl, .ply, .3ds"
                />
            </div>
            <div style={{ fontSize: "0.8em", color: "#aaa", marginTop: "-10px", marginBottom: "15px" }}>
                Note: .blend files are not supported. Please export to .gltf, .glb, .obj, etc. from Blender.
            </div>
            
            <h3>Available Models</h3>
            {models.length === 0 ? (
                <p>No models found. Try uploading one.</p>
            ) : (
                <ul style={{
                    listStyle: "none",
                    padding: 0,
                    margin: "15px 0",
                    maxHeight: "150px",
                    overflowY: "auto",
                    background: "rgba(0, 0, 0, 0.2)",
                    borderRadius: "4px",
                }}>
                    {models.map((model) => (
                        <li
                            key={model}
                            onClick={() => handleModelSelect(model)}
                            style={{
                                cursor: "pointer",
                                padding: "8px 12px",
                                borderBottom: "1px solid #0e3a4a",
                                transition: "background 0.2s ease",
                                background: selectedModel === model ? "#00eaff" : "transparent",
                                color: selectedModel === model ? "#000" : "#00eaff",
                            }}
                            onMouseEnter={e => { if (selectedModel !== model) e.currentTarget.style.background = 'rgba(0, 234, 255, 0.1)'; }}
                            onMouseLeave={e => { if (selectedModel !== model) e.currentTarget.style.background = 'transparent'; }}
                        >
                            {model}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
