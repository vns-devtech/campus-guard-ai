"""
CampusGuard AI - YOLO Object Detection Module
Integrates YOLOv8 via Ultralytics framework for pedestrian & vehicle detection.
Classes tracked: person, bicycle, car, motorcycle, bus, truck.
"""

import cv2
import numpy as np
from typing import List, Dict, Any, Tuple
from backend.config import config

CLASS_COLORS = {
    "person": (37, 99, 235),      # Blue
    "car": (220, 38, 38),         # Red
    "motorcycle": (217, 119, 6),  # Amber
    "bicycle": (16, 185, 129),    # Emerald
    "bus": (147, 51, 234),        # Purple
    "truck": (234, 88, 12)        # Orange
}

class YOLODetector:
    def __init__(self, model_path: str = None, conf_threshold: float = None):
        self.conf_threshold = conf_threshold or config.confidence_threshold
        self.model_path = model_path or config.yolo_model_path
        self.model = None
        self.is_loaded = False
        self._load_model()
        
    def _load_model(self):
        try:
            from ultralytics import YOLO
            self.model = YOLO(self.model_path)
            self.is_loaded = True
            print(f"[CampusGuard] YOLO model loaded successfully from {self.model_path}")
        except Exception as e:
            print(f"[CampusGuard Notice] Ultralytics YOLO not initialized: {e}")
            print("[CampusGuard Notice] Operating in resilient demonstration / test mode.")
            self.is_loaded = False
            
    def detect_frame(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        """
        Processes a single frame and returns bounding boxes, confidences, and labels.
        Output format:
        [
            {
                "class_name": "person",
                "confidence": 0.88,
                "bbox": [x1, y1, x2, y2],
                "center": (cx, cy)
            },
            ...
        ]
        """
        detections = []
        if not self.is_loaded or self.model is None:
            return detections
            
        results = self.model.predict(
            source=frame,
            conf=self.conf_threshold,
            iou=config.iou_threshold,
            verbose=False
        )
        
        for r in results:
            boxes = r.boxes
            for box in boxes:
                cls_id = int(box.cls[0])
                cls_name = r.names[cls_id].lower()
                
                if cls_name in config.target_classes:
                    conf = float(box.conf[0])
                    xyxy = box.xyxy[0].cpu().numpy()
                    x1, y1, x2, y2 = map(int, xyxy)
                    cx = int((x1 + x2) / 2)
                    cy = int((y1 + y2) / 2)
                    
                    detections.append({
                        "class_name": cls_name,
                        "confidence": round(conf, 3),
                        "bbox": [x1, y1, x2, y2],
                        "center": (cx, cy)
                    })
                    
        return detections

    def draw_overlays(self, frame: np.ndarray, detections: List[Dict[str, Any]]) -> np.ndarray:
        """
        Draws bounding boxes and labels onto the image frame using OpenCV.
        """
        output = frame.copy()
        for det in detections:
            cls = det["class_name"]
            conf = det["confidence"]
            x1, y1, x2, y2 = det["bbox"]
            color = CLASS_COLORS.get(cls, (255, 255, 255))
            
            # Draw box
            cv2.rectangle(output, (x1, y1), (x2, y2), color, 2)
            
            # Label banner
            label = f"{cls.capitalize()} {conf:.2f}"
            (w, h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
            cv2.rectangle(output, (x1, y1 - 20), (x1 + w + 6, y1), color, -1)
            cv2.putText(output, label, (x1 + 3, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
            
        return output
