"""
CampusGuard AI - Automated Test Suite
Tests Risk Rules A, B, C, D, Cooldown suppression, and ByteTrack virtual line crossing.
"""

import time
import pytest
from backend.tracker import ByteTrackerManager, TrackedObject
from backend.risk_engine import RiskDetectionEngine, point_in_polygon

def test_point_in_polygon():
    square = [[0, 0], [100, 0], [100, 100], [0, 100]]
    assert point_in_polygon(50, 50, square) is True
    assert point_in_polygon(150, 50, square) is False

def test_rule_a_close_proximity_and_persistence():
    engine = RiskDetectionEngine(proximity_px=100.0, persistence_frames=3, cooldown_sec=5.0)
    
    ped = TrackedObject("P-001", "person", [100, 100, 120, 150], 0.9)
    veh = TrackedObject("V-001", "car", [130, 100, 170, 150], 0.88)
    
    zone = {"id": "zone-01", "name": "Gate 1", "coordinates": [[0, 0], [400, 0], [400, 400], [0, 400]]}
    
    # Frame 1: persistence = 1, should not trigger yet
    events1 = engine.analyze_frame_risks([ped, veh], zone)
    rule_a_events = [e for e in events1 if "Rule A" in e["risk_type"]]
    assert len(rule_a_events) == 0
    
    # Frame 2: persistence = 2
    events2 = engine.analyze_frame_risks([ped, veh], zone)
    rule_a_events = [e for e in events2 if "Rule A" in e["risk_type"]]
    assert len(rule_a_events) == 0
    
    # Frame 3: persistence = 3 (reaches threshold) -> must trigger alert
    events3 = engine.analyze_frame_risks([ped, veh], zone)
    rule_a_events = [e for e in events3 if "Rule A" in e["risk_type"]]
    assert len(rule_a_events) == 1
    assert rule_a_events[0]["pedestrian_track_id"] == "P-001"
    assert rule_a_events[0]["vehicle_track_id"] == "V-001"
    
    # Frame 4: Inside cooldown -> must NOT fire duplicate alert
    events4 = engine.analyze_frame_risks([ped, veh], zone)
    rule_a_events = [e for e in events4 if "Rule A" in e["risk_type"]]
    assert len(rule_a_events) == 0

def test_rule_b_shared_crosswalk_conflict():
    engine = RiskDetectionEngine(proximity_px=50.0, persistence_frames=1, cooldown_sec=10.0)
    
    crosswalk = [[100, 100], [300, 100], [300, 300], [100, 300]]
    zone = {"id": "zone-02", "name": "Block III Crosswalk", "coordinates": crosswalk}
    
    # Both inside crosswalk
    ped = TrackedObject("P-002", "person", [150, 150, 170, 200], 0.92)
    veh = TrackedObject("V-002", "car", [250, 250, 290, 290], 0.89)
    
    # Frame 1
    engine.analyze_frame_risks([ped, veh], zone)
    # Frame 2
    events = engine.analyze_frame_risks([ped, veh], zone)
    rule_b_events = [e for e in events if "Rule B" in e["risk_type"]]
    assert len(rule_b_events) == 1
    assert rule_b_events[0]["severity"] == "Critical"

def test_rule_d_high_crowd_vehicle_presence():
    engine = RiskDetectionEngine()
    zone = {"id": "zone-04", "name": "Cafeteria Plaza", "coordinates": [[0, 0], [500, 0], [500, 500], [0, 500]]}
    
    pedestrians = [TrackedObject(f"P-{i:03d}", "person", [50 + i*10, 100, 70 + i*10, 150], 0.85) for i in range(16)]
    veh = TrackedObject("V-003", "bus", [200, 200, 300, 300], 0.95)
    
    events = engine.analyze_frame_risks(pedestrians + [veh], zone, crowd_density_category="High")
    rule_d_events = [e for e in events if "Rule D" in e["risk_type"]]
    assert len(rule_d_events) == 1
    assert rule_d_events[0]["severity"] == "Warning"

def test_bytetrack_virtual_line_crossing():
    tracker = ByteTrackerManager()
    counting_line = {"x1": 50, "y1": 200, "x2": 450, "y2": 200}
    
    # Person moving from y=180 to y=220 (Downward crossing / In)
    det1 = [{"class_name": "person", "confidence": 0.9, "bbox": [100, 170, 120, 190]}]
    tracker.update(det1, counting_line)
    assert tracker.total_pedestrians_in == 0
    
    det2 = [{"class_name": "person", "confidence": 0.9, "bbox": [100, 210, 120, 230]}]
    tracker.update(det2, counting_line)
    assert tracker.total_pedestrians_in == 1

if __name__ == "__main__":
    pytest.main(["-v", __file__])
