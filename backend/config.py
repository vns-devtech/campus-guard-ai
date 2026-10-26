"""
CampusGuard AI Configuration
Sharda University, Sem 5 PBL-3 Project
Team Members: Vansh Bhardwaj & Vishal Dixit | Faculty Guide: Mr. Abhishek Singh Verma
"""

import os
from pydantic import BaseModel

class SystemConfig(BaseModel):
    app_name: str = "CampusGuard AI"
    institution: str = "Sharda University"
    project_title: str = "AI-Based Pedestrian Safety and Monitoring System for Campus"
    
    # YOLO Settings
    yolo_model_path: str = os.getenv("YOLO_MODEL_PATH", "yolov8n.pt")
    confidence_threshold: float = float(os.getenv("CONF_THRESHOLD", "0.45"))
    iou_threshold: float = float(os.getenv("IOU_THRESHOLD", "0.45"))
    
    # Supported detection classes
    target_classes: list[str] = [
        "person",
        "bicycle",
        "car",
        "motorcycle",
        "bus",
        "truck"
    ]
    
    # ByteTrack Tracker Settings
    track_thresh: float = 0.5
    track_buffer: int = 30
    match_thresh: float = 0.7
    frame_rate: int = 30
    
    # Crowd Density Thresholds (Zone count based)
    density_low_max: int = 8
    density_medium_max: int = 20
    
    # Risk Engine Rules
    rule_a_proximity_px: float = 95.0        # Pixel distance threshold
    rule_a_calibrated_meters: float = 2.2     # Homography calibrated physical distance
    rule_a_min_persistence_frames: int = 3    # Frames before trigger
    
    rule_b_shared_crosswalk: bool = True
    rule_c_approach_time_to_collision_sec: float = 2.5
    rule_d_high_crowd_vehicle_threshold: int = 15
    
    alert_cooldown_seconds: float = 6.0       # Suppression period to prevent alert flooding
    
    # Database
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./campusguard.db")
    demo_mode: bool = os.getenv("DEMO_MODE", "True").lower() == "true"

config = SystemConfig()
