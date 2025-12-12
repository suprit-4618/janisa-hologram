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
    file_extension = os.path.splitext(file.filename)[1]
    
    if file_extension in [".glb", ".gltf", ".obj", ".fbx", ".stl", ".ply", ".3ds"]:
        file_path = os.path.join(MODELS_DIR, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return {"model_name": file.filename}
    else:
        return {"error": "File type not supported. Please upload .glb, .gltf, .obj, .fbx, .stl, .ply, or .3ds files."}


@app.get("/models")
async def list_models():
    models = []
    for filename in os.listdir(MODELS_DIR):
        if filename.endswith((".glb", ".gltf", ".obj", ".fbx", ".stl", ".ply", ".3ds")):
            models.append(filename)
    return {"models": models}

# Serve the models statically
app.mount("/models", StaticFiles(directory=MODELS_DIR), name="models")