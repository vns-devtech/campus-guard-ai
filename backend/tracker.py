"""
CampusGuard AI - ByteTrack Object Tracking Module
Maintains temporary anonymous identities across frames (e.g., P-001, V-001).
No biometric or facial identification is performed.
Includes trajectory estimation and virtual line crossing for pedestrian/vehicle counting.
"""

import numpy as np
from typing import List, Dict, Any, Tuple
from collections import deque
from backend.config import config

class TrackedObject:
    def __init__(self, track_id: str, class_name: str, bbox: List[int], confidence: float):
        self.track_id = track_id
        self.class_name = class_name
        self.bbox = bbox
        self.confidence = confidence
        self.history = deque(maxlen=30) # Stores last 30 center coordinates (x, y)
        
        cx = int((bbox[0] + bbox[2]) / 2)
        cy = int((bbox[1] + bbox[3]) / 2)
        self.history.append((cx, cy))
        
        self.lost_frames = 0
        self.is_active = True
        self.crossed_line = False

    def update(self, bbox: List[int], confidence: float):
        self.bbox = bbox
        self.confidence = confidence
        cx = int((bbox[0] + bbox[2]) / 2)
        cy = int((bbox[1] + bbox[3]) / 2)
        self.history.append((cx, cy))
        self.lost_frames = 0
        self.is_active = True

    @property
    def current_center(self) -> Tuple[int, int]:
        return self.history[-1]

    @property
    def velocity_vector(self) -> Tuple[float, float]:
        """Calculates instantaneous velocity vector (dx, dy) over last 5 frames."""
        if len(self.history) < 2:
            return (0.0, 0.0)
        idx = max(0, len(self.history) - 5)
        old_pt = self.history[idx]
        cur_pt = self.history[-1]
        dt = len(self.history) - idx
        return ((cur_pt[0] - old_pt[0]) / dt, (cur_pt[1] - old_pt[1]) / dt)


def compute_iou(boxA: List[int], boxB: List[int]) -> float:
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2])
    yB = min(boxA[3], boxB[3])

    interArea = max(0, xB - xA) * max(0, yB - yA)
    boxAArea = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1])
    boxBArea = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1])

    iou = interArea / float(boxAArea + boxBArea - interArea + 1e-6)
    return iou


class ByteTrackerManager:
    def __init__(self, match_thresh: float = 0.45, max_lost_frames: int = 30):
        self.match_thresh = match_thresh
        self.max_lost_frames = max_lost_frames
        
        self.tracks: Dict[str, TrackedObject] = {}
        self.pedestrian_counter = 0
        self.vehicle_counter = 0
        
        # Virtual Line Counting counters
        self.total_pedestrians_in = 0
        self.total_pedestrians_out = 0
        self.total_vehicles_in = 0
        self.total_vehicles_out = 0

    def _generate_track_id(self, class_name: str) -> str:
        if class_name == "person":
            self.pedestrian_counter += 1
            return f"P-{self.pedestrian_counter:03d}"
        else:
            self.vehicle_counter += 1
            return f"V-{self.vehicle_counter:03d}"

    def update(self, detections: List[Dict[str, Any]], counting_line: Dict[str, int] = None) -> List[TrackedObject]:
        """
        Associates incoming detections with active tracks using IoU matching
        consistent with ByteTrack stage-wise matching logic.
        """
        matched_track_ids = set()
        matched_det_indices = set()

        # Step 1: Greedy IoU matching against active tracks of matching class
        for det_idx, det in enumerate(detections):
            best_iou = self.match_thresh
            best_tid = None

            for tid, track in self.tracks.items():
                if tid in matched_track_ids:
                    continue
                # Classes should be identical category (pedestrian vs vehicle)
                is_p_det = det["class_name"] == "person"
                is_p_trk = track.class_name == "person"
                if is_p_det != is_p_trk:
                    continue

                iou = compute_iou(det["bbox"], track.bbox)
                if iou > best_iou:
                    best_iou = iou
                    best_tid = tid

            if best_tid is not None:
                self.tracks[best_tid].update(det["bbox"], det["confidence"])
                matched_track_ids.add(best_tid)
                matched_det_indices.add(det_idx)

        # Step 2: Create new tracks for unmatched detections
        for det_idx, det in enumerate(detections):
            if det_idx not in matched_det_indices:
                new_id = self._generate_track_id(det["class_name"])
                new_track = TrackedObject(
                    track_id=new_id,
                    class_name=det["class_name"],
                    bbox=det["bbox"],
                    confidence=det["confidence"]
                )
                self.tracks[new_id] = new_track

        # Step 3: Handle lost tracks
        to_delete = []
        for tid, track in self.tracks.items():
            if tid not in matched_track_ids and tid not in [self.tracks[t].track_id for t in self.tracks if self.tracks[t].lost_frames == 0]:
                track.lost_frames += 1
                if track.lost_frames > self.max_lost_frames:
                    to_delete.append(tid)

        for tid in to_delete:
            del self.tracks[tid]

        # Step 4: Virtual Line Counting
        if counting_line:
            self._check_line_crossings(counting_line)

        return [t for t in self.tracks.values() if t.lost_frames == 0]

    def _check_line_crossings(self, line: Dict[str, int]):
        """
        Determines if an object crossed the virtual horizontal or diagonal tripwire line.
        line format: {'x1': int, 'y1': int, 'x2': int, 'y2': int}
        """
        y_line = line.get("y1", 250)
        for track in self.tracks.values():
            if track.crossed_line or len(track.history) < 2:
                continue

            prev_y = track.history[-2][1]
            curr_y = track.history[-1][1]

            # Downward crossing (In)
            if prev_y < y_line <= curr_y:
                track.crossed_line = True
                if track.class_name == "person":
                    self.total_pedestrians_in += 1
                else:
                    self.total_vehicles_in += 1
            # Upward crossing (Out)
            elif prev_y > y_line >= curr_y:
                track.crossed_line = True
                if track.class_name == "person":
                    self.total_pedestrians_out += 1
                else:
                    self.total_vehicles_out += 1
