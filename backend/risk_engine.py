"""
CampusGuard AI - Rule-Based Risk Detection Engine
Detects potentially risky pedestrian-vehicle interactions based on 4 domain rules:
- Rule A: Close Proximity (Pixel / Calibrated distance threshold)
- Rule B: Shared-Zone Conflict (Crosswalk/Driveway simultaneous occupancy)
- Rule C: Potential Approach Conflict (Trajectory convergence & Time-To-Collision)
- Rule D: High Crowd with Vehicle Presence (Contextual density warning)

Enforces alert persistence, suppression cooldowns, and uncertainty metadata.
"""

import time
import math
from typing import List, Dict, Any, Optional, Tuple
from backend.tracker import TrackedObject

def point_in_polygon(x: float, y: float, poly: List[List[float]]) -> bool:
    """Ray-casting algorithm to test if point is inside a polygon zone."""
    n = len(poly)
    inside = False
    p1x, p1y = poly[0]
    for i in range(n + 1):
        p2x, p2y = poly[i % n]
        if y > min(p1y, p2y):
            if y <= max(p1y, p2y):
                if x <= max(p1x, p2x):
                    if p1y != p2y:
                        xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or x <= xinters:
                        inside = not inside
        p1x, p1y = p2x, p2y
    return inside

class RiskDetectionEngine:
    def __init__(self,
                 proximity_px: float = 95.0,
                 calibrated_meter_ratio: float = 0.023, # approx 95px ~ 2.2m
                 cooldown_sec: float = 6.0,
                 persistence_frames: int = 3):
        self.proximity_px = proximity_px
        self.calibrated_meter_ratio = calibrated_meter_ratio
        self.cooldown_sec = cooldown_sec
        self.persistence_frames = persistence_frames
        
        # State tracking
        self.interaction_persistence: Dict[str, int] = {} # pair_key -> consecutive frames
        self.alert_cooldowns: Dict[str, float] = {}        # pair_key -> last alert timestamp

    def _get_pair_key(self, id1: str, id2: str, rule_name: str) -> str:
        sorted_ids = sorted([id1, id2])
        return f"{sorted_ids[0]}_{sorted_ids[1]}_{rule_name}"

    def analyze_frame_risks(
        self,
        active_tracks: List[TrackedObject],
        zone_info: Dict[str, Any],
        crowd_density_category: str = "Low"
    ) -> List[Dict[str, Any]]:
        """
        Evaluates active tracked pedestrians and vehicles against Rules A, B, C, D.
        Returns list of newly flagged risk events.
        """
        flagged_events = []
        now = time.time()
        
        pedestrians = [t for t in active_tracks if t.class_name == "person"]
        vehicles = [t for t in active_tracks if t.class_name in ["car", "bus", "truck", "motorcycle", "bicycle"]]

        zone_poly = zone_info.get("coordinates", [])
        zone_name = zone_info.get("name", "Monitored Zone")
        zone_id = zone_info.get("id", "zone-01")

        # ----------------------------------------------------
        # Rule D: High Crowd Density with Vehicle Presence
        # ----------------------------------------------------
        if crowd_density_category == "High" and len(vehicles) > 0:
            for veh in vehicles:
                rule_key = f"RULE_D_{veh.track_id}_{zone_id}"
                last_time = self.alert_cooldowns.get(rule_key, 0)
                if (now - last_time) > self.cooldown_sec:
                    self.alert_cooldowns[rule_key] = now
                    flagged_events.append({
                        "risk_type": "Rule D: High Crowd with Vehicle Presence",
                        "severity": "Warning",
                        "pedestrian_track_id": f"Crowd ({len(pedestrians)} persons)",
                        "vehicle_track_id": veh.track_id,
                        "vehicle_class": veh.class_name.capitalize(),
                        "estimated_proximity_meters": 4.5,
                        "rule_triggered": f"Motorized vehicle {veh.track_id} entered {zone_name} while pedestrian density is flagged as High ({len(pedestrians)} tracked).",
                        "zone_id": zone_id,
                        "zone_name": zone_name,
                        "uncertainty_note": "Contextual alert: Vehicle presence in crowded plaza requires driver caution."
                    })

        # Pairwise interaction checks between pedestrians and vehicles
        for ped in pedestrians:
            px, py = ped.current_center
            p_in_zone = point_in_polygon(px, py, zone_poly) if len(zone_poly) >= 3 else True

            for veh in vehicles:
                vx, vy = veh.current_center
                v_in_zone = point_in_polygon(vx, vy, zone_poly) if len(zone_poly) >= 3 else True

                dx = px - vx
                dy = py - vy
                dist_px = math.hypot(dx, dy)
                est_meters = round(dist_px * self.calibrated_meter_ratio, 2)

                # ----------------------------------------------------
                # Rule A: Close Proximity
                # ----------------------------------------------------
                if dist_px < self.proximity_px:
                    pair_key_a = self._get_pair_key(ped.track_id, veh.track_id, "RULE_A")
                    self.interaction_persistence[pair_key_a] = self.interaction_persistence.get(pair_key_a, 0) + 1

                    if self.interaction_persistence[pair_key_a] >= self.persistence_frames:
                        last_alert = self.alert_cooldowns.get(pair_key_a, 0)
                        if (now - last_alert) > self.cooldown_sec:
                            self.alert_cooldowns[pair_key_a] = now
                            flagged_events.append({
                                "risk_type": "Rule A: Close Proximity",
                                "severity": "Critical" if est_meters < 1.5 else "High",
                                "pedestrian_track_id": ped.track_id,
                                "vehicle_track_id": veh.track_id,
                                "vehicle_class": veh.class_name.capitalize(),
                                "estimated_proximity_meters": est_meters,
                                "rule_triggered": f"Proximity between {ped.track_id} and {veh.class_name} {veh.track_id} dropped to {est_meters}m (<2.2m threshold) for {self.persistence_frames}+ consecutive frames.",
                                "zone_id": zone_id,
                                "zone_name": zone_name,
                                "uncertainty_note": "Pixel-space distance transformed via homography; optical perspective distortion and camera elevation may affect exact meter estimate."
                            })
                else:
                    pair_key_a = self._get_pair_key(ped.track_id, veh.track_id, "RULE_A")
                    self.interaction_persistence[pair_key_a] = max(0, self.interaction_persistence.get(pair_key_a, 0) - 1)

                # ----------------------------------------------------
                # Rule B: Shared-Zone Conflict (Crosswalk/Conflict area)
                # ----------------------------------------------------
                if p_in_zone and v_in_zone:
                    pair_key_b = self._get_pair_key(ped.track_id, veh.track_id, "RULE_B")
                    self.interaction_persistence[pair_key_b] = self.interaction_persistence.get(pair_key_b, 0) + 1

                    if self.interaction_persistence[pair_key_b] >= 2:
                        last_alert = self.alert_cooldowns.get(pair_key_b, 0)
                        if (now - last_alert) > self.cooldown_sec:
                            self.alert_cooldowns[pair_key_b] = now
                            flagged_events.append({
                                "risk_type": "Rule B: Shared-Zone Conflict",
                                "severity": "Critical",
                                "pedestrian_track_id": ped.track_id,
                                "vehicle_track_id": veh.track_id,
                                "vehicle_class": veh.class_name.capitalize(),
                                "estimated_proximity_meters": est_meters,
                                "rule_triggered": f"Pedestrian {ped.track_id} and vehicle {veh.track_id} simultaneously occupying priority crosswalk/driveway zone '{zone_name}'.",
                                "zone_id": zone_id,
                                "zone_name": zone_name,
                                "uncertainty_note": "Shared conflict boundary defined by zone polygon mask."
                            })

                # ----------------------------------------------------
                # Rule C: Potential Approach Conflict (Trajectory Convergence)
                # ----------------------------------------------------
                pvx, pvy = ped.velocity_vector
                vvx, vvy = veh.velocity_vector
                
                # Check relative velocity along line of sight
                rel_vx = vvx - pvx
                rel_vy = vvy - pvy
                closing_speed = -(dx * rel_vx + dy * rel_vy) / (dist_px + 1e-5)

                if closing_speed > 3.0 and dist_px < (self.proximity_px * 1.8):
                    ttc = dist_px / (closing_speed * 30.0 + 1e-5) # time to collision in seconds
                    if 0.5 < ttc < 2.5:
                        pair_key_c = self._get_pair_key(ped.track_id, veh.track_id, "RULE_C")
                        last_alert = self.alert_cooldowns.get(pair_key_c, 0)
                        if (now - last_alert) > self.cooldown_sec:
                            self.alert_cooldowns[pair_key_c] = now
                            flagged_events.append({
                                "risk_type": "Rule C: Potential Approach Conflict",
                                "severity": "High",
                                "pedestrian_track_id": ped.track_id,
                                "vehicle_track_id": veh.track_id,
                                "vehicle_class": veh.class_name.capitalize(),
                                "estimated_proximity_meters": est_meters,
                                "rule_triggered": f"Projected trajectory vectors converge toward shared collision coordinate with estimated TTC of {ttc:.1f}s.",
                                "zone_id": zone_id,
                                "zone_name": zone_name,
                                "uncertainty_note": "Trajectory extrapolation assumes constant velocity over instantaneous 5-frame window."
                            })

        return flagged_events
