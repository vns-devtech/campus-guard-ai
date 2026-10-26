"""
CampusGuard AI Database Models & Setup
Supports SQLite for lightweight prototype and MySQL / PostgreSQL in production.
"""

from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from backend.config import config

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    role = Column(String(30), default="operator") # 'admin' or 'operator'
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class VideoSource(Base):
    __tablename__ = "video_sources"
    
    id = Column(String(50), primary_key=True)
    name = Column(String(100), nullable=False)
    source_type = Column(String(30), nullable=False) # 'cctv_ip', 'webcam', 'uploaded_video'
    zone_id = Column(String(50), nullable=True)
    location_name = Column(String(100), nullable=False)
    rtsp_url = Column(String(255), nullable=True)
    fps = Column(Integer, default=30)
    resolution = Column(String(30), default="1920x1080")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class MonitoringZone(Base):
    __tablename__ = "monitoring_zones"
    
    id = Column(String(50), primary_key=True)
    name = Column(String(100), nullable=False)
    location = Column(String(100), nullable=False)
    zone_type = Column(String(50), nullable=False) # 'pedestrian_priority_crosswalk', 'vehicle_pedestrian_mix'
    speed_limit_kmh = Column(Integer, default=15)
    pedestrian_capacity = Column(Integer, default=50)
    polygon_coords_json = Column(Text, nullable=False) # e.g. [[x1, y1], [x2, y2], ...]
    counting_line_json = Column(Text, nullable=True)   # virtual tripwire coordinates

class IncidentRecord(Base):
    __tablename__ = "incident_records"
    
    id = Column(String(50), primary_key=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    zone_id = Column(String(50), nullable=False)
    zone_name = Column(String(100), nullable=False)
    camera_source = Column(String(100), nullable=False)
    
    # Risk metadata
    risk_type = Column(String(100), nullable=False) # 'Rule A: Close Proximity', etc.
    severity = Column(String(30), nullable=False)   # 'Critical', 'High', 'Warning', 'Low'
    
    # Anonymous tracking identifiers - No facial recognition or biometric identity stored
    pedestrian_track_id = Column(String(50), nullable=False)
    vehicle_track_id = Column(String(50), nullable=False)
    vehicle_class = Column(String(50), default="Car")
    
    estimated_proximity_meters = Column(Float, nullable=True)
    detection_confidence = Column(Float, nullable=True)
    pedestrian_count_in_zone = Column(Integer, default=0)
    vehicle_count_in_zone = Column(Integer, default=0)
    rule_triggered = Column(Text, nullable=False)
    
    # Human-in-the-loop review workflow
    status = Column(String(30), default="New") # 'New', 'Under Review', 'Resolved', 'False Positive'
    reviewed_by = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    evidence_snapshot_path = Column(String(255), nullable=True)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    user_name = Column(String(100), nullable=False)
    action = Column(String(100), nullable=False)
    details = Column(Text, nullable=True)

engine = create_engine(config.database_url, connect_args={"check_same_thread": False} if "sqlite" in config.database_url else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)
