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
                    setModelURL(`${API_URL}/model-files/${firstModel}`);
                }
            })
            .catch(err => console.error("Failed to fetch models:", err));
    }, [setModelURL, selectedModel]);

    useEffect(() => {
        fetchModels();
    }, [fetchModels]);

    function handleModelSelect(modelName) {
        setSelectedModel(modelName);
        setModelURL(`${API_URL}/model-files/${modelName}`);
    }

    function handleDelete(e, modelName) {
        e.stopPropagation();
        if (!window.confirm(`Delete ${modelName}?`)) return;
        
        fetch(`${API_URL}/delete/${modelName}`, { method: "DELETE" })
            .then(() => {
                fetchModels();
                if (selectedModel === modelName) {
                    setSelectedModel(null);
                    setModelURL(null);
                }
            })
            .catch(err => console.error("Failed to delete model:", err));
    }

    const [uploading, setUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);

    function triggerUpload(file) {
        if (!file) return;
        if (file.name.toLowerCase().endsWith(".blend")) {
            alert("'.blend' files are not supported. Please export to .glb/.gltf.");
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        fetch(`${API_URL}/upload`, {
            method: "POST",
            body: formData,
        })
        .then(res => res.json())
        .then(data => {
            setUploading(false);
            if (data.model_name) {
                fetchModels();
                handleModelSelect(data.model_name);
            } else {
                alert("Upload failed: " + (data.error || "Unknown error"));
            }
        })
        .catch(err => {
            setUploading(false);
            console.error(err);
        });
    }

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
        else if (e.type === "dragleave") setDragActive(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            triggerUpload(e.dataTransfer.files[0]);
        }
    };

    return (
        <div style={{ marginTop: "20px", textAlign: "center", color: "#ffcc00", fontFamily: "'Inter', sans-serif" }}>
            <div 
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                style={{
                    border: dragActive ? "2px dashed #ffcc00" : "1px solid rgba(255, 204, 0, 0.3)",
                    background: dragActive ? "rgba(255, 136, 0, 0.1)" : "rgba(0, 0, 0, 0.2)",
                    padding: "30px",
                    borderRadius: "12px",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                    position: "relative",
                    marginBottom: "20px"
                }}
            >
                <input
                    id="file-upload"
                    type="file"
                    onChange={(e) => triggerUpload(e.target.files[0])}
                    style={{ display: "none" }}
                    accept=".glb, .gltf, .obj, .fbx, .stl, .ply, .3ds"
                />
                <label htmlFor="file-upload" style={{ cursor: "pointer" }}>
                    <div style={{ fontSize: "1.5em", marginBottom: "10px" }}>{uploading ? "⌛" : "📤"}</div>
                    <div style={{ fontWeight: "600", letterSpacing: "1px" }}>
                        {uploading ? "UPLOADING SIGNAL..." : "UPLOAD CUSTOM MODEL"}
                    </div>
                    <div style={{ fontSize: "0.8em", opacity: 0.6, marginTop: "5px" }}>
                        Drag & Drop or click to browse
                    </div>
                </label>
            </div>

            <div style={{ fontSize: "0.7em", color: "#aaa", marginBottom: "20px", textTransform: "uppercase", letterSpacing: "1px" }}>
                Accepted: GLB, GLTF, OBJ, FBX, STL, PLY, 3DS
            </div>
            
            <h3 style={{ fontSize: "0.9em", letterSpacing: "2px", borderBottom: "1px solid #3a1f0e", paddingBottom: "10px" }}>
                AVAILABLE MATRICES
            </h3>
            {models.length === 0 ? (
                <p style={{ opacity: 0.5 }}>Awaiting new data streams...</p>
            ) : (
                <ul style={{
                    listStyle: "none",
                    padding: 0,
                    margin: "15px 0",
                    maxHeight: "180px",
                    overflowY: "auto",
                    background: "rgba(0, 0, 0, 0.3)",
                    borderRadius: "8px",
                    scrollbarWidth: "none"
                }}>
                    {models.map((model) => (
                        <li
                            key={model}
                            onClick={() => handleModelSelect(model)}
                            style={{
                                cursor: "pointer",
                                padding: "10px 15px",
                                borderBottom: "1px solid rgba(58, 31, 14, 0.5)",
                                transition: "all 0.2s ease",
                                background: selectedModel === model ? "rgba(255, 136, 0, 0.2)" : "transparent",
                                color: selectedModel === model ? "#fff" : "rgba(255, 204, 0, 0.7)",
                                fontWeight: selectedModel === model ? "700" : "400",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center"
                            }}
                        >
                            <span>{model}</span>
                                <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                    {selectedModel === model && <span style={{ fontSize: "0.7em", color: "#fff", border: "1px solid #fff", padding: "2px 5px", borderRadius: "4px" }}>ACTIVE</span>}
                                    <button 
                                        onClick={(e) => handleDelete(e, model)}
                                        style={{
                                            background: "rgba(255, 0, 0, 0.2)",
                                            border: "1px solid rgba(255, 0, 0, 0.4)",
                                            color: "#ff4444",
                                            borderRadius: "4px",
                                            padding: "2px 8px",
                                            fontSize: "0.8em",
                                            cursor: "pointer",
                                            transition: "all 0.2s"
                                        }}
                                        onMouseOver={(e) => e.target.style.background = "rgba(255, 0, 0, 0.4)"}
                                        onMouseOut={(e) => e.target.style.background = "rgba(255, 0, 0, 0.2)"}
                                    >
                                        DELETE
                                    </button>
                                </span>
                            </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
