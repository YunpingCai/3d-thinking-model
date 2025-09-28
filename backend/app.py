from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, PlainTextResponse
from pydantic import BaseModel
import joblib
import uvicorn
import os
import pandas as pd

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "../frontend")
MODEL_PATH = os.path.join(BASE_DIR, "model.pkl")
CSV_PATH = os.path.join(BASE_DIR, "yunping_brain.csv")

# Load trained ML model
model = joblib.load(MODEL_PATH)

app = FastAPI(title="Yunping Thinking Model API", version="1.0")

# Allow CORS (so frontend JS can call backend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Serve your index.html manually so it doesn't shadow API routes
@app.get("/")
def serve_index():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

# Serve frontend static files
app.mount("/static", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")

# Define input schema
class InputParams(BaseModel):
    x: float
    y: float
    z: float

@app.post("/predict")
@app.post("/predict/") # accept trailing slash too
def predict(params: InputParams):
    data = [[params.x, params.y, params.z]]
    prediction = model.predict(data).tolist()
    return {"consideration": prediction}


@app.get("/api/brain-data", response_class=PlainTextResponse)
def brain_data():
    """Serve brain data CSV"""
    if not os.path.exists(CSV_PATH):
        return "CSV file not found"
    df = pd.read_csv(CSV_PATH)
    return df.to_csv(index=False)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
