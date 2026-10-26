"""
CampusGuard AI - FastAPI Application
AI-Based Pedestrian Safety and Monitoring System for Campus
PBL-3 College Project | Sharda University, Semester 5
Team: Vansh Bhardwaj & Vishal Dixit | Faculty Guide: Mr. Abhishek Singh Verma
"""

import os
import cv2
import time
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.config import config
from backend.detector import YOLODetector
from backend.tracker import ByteTrackerManager
from backend.risk_engine import RiskDetectionEngine
from backend.database import init_db, SessionLocal, IncidentRecord, VideoSource, MonitoringZone, AuditLog

app = FastAPI(
    title="CampusGuard AI API",
    description="Intelligent Pedestrian Safety and Monitoring System for Sharda University Campus",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize modules
init_db()
detector = YOLODetector(config.yolo_model_path, config.confidence_threshold)
tracker = ByteTrackerManager(config.match_thresh, config.track_buffer)
risk_engine = RiskDetectionEngine(
    proximity_px=config.rule_a_proximity_px,
    cooldown_sec=config.alert_cooldown_seconds,
    persistence_frames=config.rule_a_min_persistence_frames
)

class IncidentUpdateModel(BaseModel):
    status: str
    reviewed_by: Optional[str] = None
    notes: Optional[str] = None

class SettingsModel(BaseModel):
    yolo_confidence: float
    selected_model: str
    proximity_threshold_px: float
    alert_cooldown_sec: float
    demo_mode: bool

@app.get("/health")
def health_check():
    return {
        "status": "online",
        "system": config.app_name,
        "institution": config.institution,
        "team": ["Vansh Bhardwaj", "Vishal Dixit"],
        "guide": "Mr. Abhishek Singh Verma",
        "yolo_loaded": detector.is_loaded,
        "demo_mode": config.demo_mode
    }

@app.get("/api/incidents")
def get_incidents(status: Optional[str] = None, severity: Optional[str] = None):
    db = SessionLocal()
    try:
        q = db.query(IncidentRecord)
        if status and status != "all":
            q = q.filter(IncidentRecord.status == status)
        if severity and severity != "all":
            q = q.filter(IncidentRecord.severity == severity)
        records = q.order_by(IncidentRecord.timestamp.desc()).limit(100).all()
        return records
    finally:
        db.close()

@app.patch("/api/incidents/{incident_id}/status")
def update_incident_status(incident_id: str, payload: IncidentUpdateModel):
    db = SessionLocal()
    try:
        record = db.query(IncidentRecord).filter(IncidentRecord.id == incident_id).first()
        if not record:
            raise HTTPException(status_code=404, detail="Incident record not found")
        
        record.status = payload.status
        if payload.reviewed_by:
            record.reviewed_by = payload.reviewed_by
        if payload.notes:
            record.notes = payload.notes
            
        log = AuditLog(
            user_name=payload.reviewed_by or "Security Operator",
            action=f"Incident {incident_id} marked as {payload.status}",
            details=payload.notes
        )
        db.add(log)
        db.commit()
        db.refresh(record)
        return record
    finally:
        db.close()

@app.post("/api/process-frame")
def process_single_frame(
    zone_id: str = Form("zone-01"),
    file: UploadFile = File(...)
):
    """
    Direct API endpoint for processing an image frame with YOLO + ByteTrack + Risk Engine.
    """
    import numpy as np
    contents = file.file.read()
    nparr = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if frame is None:
        raise HTTPException(status_code=400, detail="Invalid image payload")
        
    start_time = time.time()
    detections = detector.detect_frame(frame)
    tracks = tracker.update(detections)
    
    zone_info = {"id": zone_id, "name": "Monitored Zone", "coordinates": [[50, 150], [450, 150], [450, 350], [50, 350]]}
    crowd_level = "Low"
    p_count = len([t for t in tracks if t.class_name == "person"])
    if p_count > config.density_medium_max:
        crowd_level = "High"
    elif p_count > config.density_low_max:
        crowd_level = "Medium"
        
    risks = risk_engine.analyze_frame_risks(tracks, zone_info, crowd_level)
    inference_ms = round((time.time() - start_time) * 1000, 1)
    
    return {
        "inference_latency_ms": inference_ms,
        "detection_count": len(detections),
        "tracked_pedestrians": p_count,
        "tracked_vehicles": len([t for t in tracks if t.class_name != "person"]),
        "crowd_density": crowd_level,
        "flagged_risks": risks,
        "tracks": [
            {
                "id": t.track_id,
                "class": t.class_name,
                "confidence": t.confidence,
                "bbox": t.bbox,
                "center": t.current_center
            }
            for t in tracks
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app:app", host="0.0.0.0", port=8000, reload=True)
