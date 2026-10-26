# CampusGuard AI — Pedestrian Safety and Monitoring System for Campus

**College PBL-3 Project — Sharda University (Semester 5)**  
**Team Members:** Vansh Bhardwaj & Vishal Dixit  
**Faculty Guide:** Mr. Abhishek Singh Verma  
**Application Tagline:** *Intelligent Monitoring for a Safer Campus.*

---

## 1. Project Overview

CampusGuard AI is an intelligent Computer Vision and Deep Learning system designed to analyze campus CCTV camera feeds, protect pedestrians, estimate crowd density, and alert campus security operators to potentially hazardous vehicle-pedestrian interactions in real time.

### Core Capabilities
1. **YOLOv8 Multi-Class Object Detection:** Detects `person`, `bicycle`, `motorcycle`, `car`, `bus`, and `truck` with configurable confidence scores.
2. **ByteTrack Anonymous Tracking:** Assigns anonymous identifiers (`P-001`, `V-001`) across consecutive frames without biometric or facial recognition.
3. **Region of Interest (ROI) & Tripwire Counting:** Bi-directional virtual counting lines calculate entry and exit flows.
4. **Crowd-Density Classification:** Evaluates zone density into configurable `Low`, `Medium`, and `High` thresholds.
5. **Rule-Based Risk Detection Engine:**
   - **Rule A: Close Proximity:** Flags interactions when pedestrian and vehicle distance falls below physical/pixel threshold for consecutive frames.
   - **Rule B: Shared-Zone Conflict:** Flags simultaneous presence inside designated crosswalks or shared conflict areas.
   - **Rule C: Potential Approach Conflict:** Trajectory vector convergence evaluation and Time-to-Collision (TTC) estimation.
   - **Rule D: High Crowd with Vehicle Presence:** Contextual warning when vehicles enter high-density pedestrian corridors.
   - **Persistence & Cooldown Protection:** Suppresses duplicate spam alerts during ongoing interactions.
6. **Human-in-the-Loop Incident Management:** Interactive review workflow (`New` -> `Under Review` -> `Resolved` / `False Positive`) with audit trail logging.
7. **Dual-Mode Operation:** Distinct **Demo Mode** (with labeled simulated campus streams) and **Real AI Mode** (using live camera / uploaded footage).

---

## 2. Architecture Pipeline

```
Campus CCTV / Video Stream
       │
       ▼
OpenCV Frame Acquisition
       │
       ▼
YOLOv8 Multi-Class Detection (Ultralytics)
       │
       ▼
ByteTrack Multi-Object Tracking (Anonymous IDs)
       │
       ▼
Counting & Crowd-Density Categorization
       │
       ▼
4-Tier Rule-Based Risk Engine (Rules A, B, C, D)
       │
       ▼
Alert Cooldown & Persistence Suppression
       │
       ▼
SQLite / Database & Human-in-the-Loop Security Dashboard
```

---

## 3. Getting Started & Installation

### Prerequisites
- Node.js (v18+) & npm
- Python 3.10+ (for Python FastAPI / YOLO pipeline)
- Optional: NVIDIA GPU with CUDA for hardware-accelerated YOLO inference

### Running the Web Application (React + Express Full-Stack)
```bash
# 1. Install Node dependencies
npm install

# 2. Start the integrated dev server (Port 3000)
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your web browser.

### Running the Python Computer Vision Backend (Optional standalone)
```bash
# 1. Create and activate a Python virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# 2. Install dependencies
pip install -r backend/requirements.txt

# 3. Download YOLOv8 weights (if not already downloaded)
# Ultralytics will automatically fetch 'yolov8n.pt' on first run, or you can run:
python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"

# 4. Start the FastAPI server
uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload
```
Interactive Swagger API documentation will be available at [http://localhost:8000/docs](http://localhost:8000/docs).

### Running Automated Tests
```bash
pytest backend/tests/test_risk_engine.py -v
```

---

## 4. Privacy, Safety & Ethical Guidelines
- **Zero Facial Recognition:** The system strictly assigns temporary numerical IDs (`P-001`, `V-001`) and does not perform identity matching or biometric extraction.
- **Decision-Support Only:** Generated alerts are indicators of potential risk; they do not replace authorized campus security personnel.
- **Calibration Notice:** Pixel distance is transformed using camera homography; variations in camera mounting angle, focal length, and weather may affect exact metric readings.

---

## 5. Academic Acknowledgments
- **Institution:** School of Engineering and Technology (SET), Sharda University, Greater Noida, UP, India.
- **Subject:** Project Based Learning - III (PBL-3), 5th Semester.
- **Developers:** Vansh Bhardwaj & Vishal Dixit.
- **Project Supervisor:** Mr. Abhishek Singh Verma.
