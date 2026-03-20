from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uuid
import shutil
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "storage/uploads"
MODELS_DIR = "storage/models"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(MODELS_DIR, exist_ok=True)

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    name, ext = os.path.splitext(file.filename)
    # Clean filename and add unique ID
    safe_name = "".join([c for c in name if c.isalnum() or c in (" ", "-", "_")]).strip()
    unique_filename = f"{safe_name}_{uuid.uuid4().hex[:6]}{ext}"
    
    if ext.lower() in [".glb", ".gltf", ".obj", ".fbx", ".stl", ".ply", ".3ds"]:
        file_path = os.path.join(MODELS_DIR, unique_filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return {"model_name": unique_filename}
    else:
        return {"error": f"File type {ext} not supported. Please upload .glb, .gltf, .obj, .fbx, .stl, .ply, or .3ds files."}


@app.get("/models")
async def list_models():
    models = []
    for filename in os.listdir(MODELS_DIR):
        if filename.endswith((".glb", ".gltf", ".obj", ".fbx", ".stl", ".ply", ".3ds")):
            models.append(filename)
    return {"models": models}

@app.delete("/delete/{filename}")
async def delete_model(filename: str):
    file_path = os.path.join(MODELS_DIR, filename)
    if os.path.exists(file_path):
        os.remove(file_path)
        return {"message": f"Model {filename} deleted successfully"}
    else:
        return {"error": "Model not found"}

# Serve the models statically
app.mount("/model-files", StaticFiles(directory=MODELS_DIR), name="models")