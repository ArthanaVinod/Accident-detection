import sys
sys.stdout.reconfigure(encoding='utf-8')
import os
import cv2
import uuid
import time
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from ultralytics import YOLO
from werkzeug.utils import secure_filename
import pandas as pd
import numpy as np
from scipy.spatial import KDTree

app = Flask(__name__)
CORS(app)

# Load Accident Data using relative paths to ensure portability (GitHub/Deployments)
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
DATA_FILES = [
    "processed_real_data.csv",  # UK
    "indian_roads_dataset.csv"  # India
]

accident_df = None
spatial_tree = None

try:
    dfs = []
    for filename in DATA_FILES:
        filepath = os.path.join(DATA_DIR, filename)
        if os.path.exists(filepath):
            df = pd.read_csv(filepath, on_bad_lines='skip')
            if 'latitude' in df.columns and 'longitude' in df.columns:
                df = df.dropna(subset=['latitude', 'longitude'])
                # keep only lat/lng to save memory
                dfs.append(df[['latitude', 'longitude']])
            
    if dfs:
        accident_df = pd.concat(dfs, ignore_index=True)
        # Build KDTree for fast lookup
        points = accident_df[['latitude', 'longitude']].values
        spatial_tree = KDTree(points)
        print(f"[*] Loaded {len(accident_df)} accident records from {len(dfs)} datasets into spatial index.")
    else:
        print("[!] No valid geo datasets found in data/ folder.")
except Exception as e:
    print(f"[!] Error loading datasets: {e}")

# Configuration
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "temp")
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "bmp", "mp4", "avi", "mov", "mkv", "webm"}
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Load YOLO model once at startup
MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "best.pt")
model = YOLO(MODEL_PATH)

CLASS_NAMES = {0: "Moderate", 1: "Severe"}
SEVERITY_COLORS = {0: (0, 200, 255), 1: (0, 0, 255)}  # BGR: amber, red


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def is_video(filename):
    ext = filename.rsplit(".", 1)[1].lower()
    return ext in {"mp4", "avi", "mov", "mkv", "webm"}


def run_detection_on_image(image_path):
    """Run YOLO detection on a single image. Returns detections list and annotated image path."""
    results = model.predict(source=image_path, show=False, verbose=False)
    img = cv2.imread(image_path)
    detections = []

    for result in results:
        for box in result.boxes:  # type: ignore
            class_id = int(box.cls[0].item())
            conf = round(box.conf[0].item(), 4)
            cords = [round(x) for x in box.xyxy[0].tolist()]

            if conf >= 0.5:
                class_name = CLASS_NAMES.get(class_id, "Unknown")
                color = SEVERITY_COLORS.get(class_id, (255, 255, 255))

                # Draw bounding box
                cv2.rectangle(img, (cords[0], cords[1]), (cords[2], cords[3]), color, 3)

                # Draw label
                label = f"{class_name} {round(conf * 100, 1)}%"
                (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.8, 2)
                cv2.rectangle(img, (cords[0], cords[1] - th - 10), (cords[0] + tw, cords[1]), color, -1)
                cv2.putText(img, label, (cords[0], cords[1] - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)

                detections.append({
                    "class_id": class_id,
                    "class_name": class_name,
                    "confidence": round(conf * 100, 2),
                    "severity": class_name,
                    "bbox": cords,
                })

    # Save annotated image
    annotated_filename = f"annotated_{uuid.uuid4().hex[:8]}.jpg"  # type: ignore
    annotated_path = os.path.join(UPLOAD_FOLDER, annotated_filename)
    cv2.imwrite(annotated_path, img)

    return detections, annotated_filename


def run_detection_on_video(video_path):
    """Run YOLO detection on a video file. Processes frames and returns the best detection + annotated frame."""
    cap = cv2.VideoCapture(video_path)
    best_detections = []
    best_confidence = 0
    best_annotated_filename = None
    frame_count = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        frame_count += 1
        # Process every 10th frame for performance
        if frame_count % 10 != 0:
            continue

        # Save frame temporarily
        temp_frame_path = os.path.join(UPLOAD_FOLDER, f"frame_{uuid.uuid4().hex[:8]}.jpg")  # type: ignore
        cv2.imwrite(temp_frame_path, frame)

        detections, annotated_filename = run_detection_on_image(temp_frame_path)

        # Keep the frame with highest confidence detection
        for det in detections:
            if det["confidence"] > best_confidence:  # type: ignore
                best_confidence = det["confidence"]
                best_detections = detections
                best_annotated_filename = annotated_filename

        # Clean up temp frame
        if os.path.exists(temp_frame_path):
            os.remove(temp_frame_path)

    cap.release()

    if not best_annotated_filename:
        # No detection found - save the first frame as annotated
        cap2 = cv2.VideoCapture(video_path)
        ret, frame = cap2.read()
        if ret:
            best_annotated_filename = f"annotated_{uuid.uuid4().hex[:8]}.jpg"  # type: ignore
            cv2.imwrite(os.path.join(UPLOAD_FOLDER, best_annotated_filename), frame)
        cap2.release()

    return best_detections, best_annotated_filename


@app.route("/api/detect", methods=["POST"])
def detect():
    """Handle file upload and run accident detection."""
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "" or not allowed_file(file.filename):
        return jsonify({"error": "Invalid file type. Allowed: images (jpg, png, bmp) and videos (mp4, avi, mov, mkv, webm)"}), 400

    # Save uploaded file
    filename = f"{uuid.uuid4().hex[:8]}_{secure_filename(file.filename)}"  # type: ignore
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)

    try:
        start_time = time.time()

        if is_video(filename):
            detections, annotated_filename = run_detection_on_video(filepath)
        else:
            detections, annotated_filename = run_detection_on_image(filepath)

        processing_time = round(time.time() - start_time, 2)  # type: ignore

        accident_detected = len(detections) > 0
        max_severity = "None"
        max_confidence = 0

        if accident_detected:
            # Find the most severe detection
            for det in detections:
                if det["confidence"] > max_confidence:  # type: ignore
                    max_confidence = det["confidence"]
                    max_severity = det["severity"]

        response = {
            "accident_detected": accident_detected,
            "severity": max_severity,
            "confidence": max_confidence,
            "detections": detections,
            "annotated_image": f"/api/temp/{annotated_filename}" if annotated_filename else None,
            "processing_time": processing_time,
            "filename": file.filename,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        }

        return jsonify(response)

    except Exception as e:
        return jsonify({"error": f"Detection failed: {str(e)}"}), 500

    finally:
        # Clean up uploaded file
        if os.path.exists(filepath):
            os.remove(filepath)


@app.route('/api/predict_risk', methods=['POST'])
def predict_risk():
    if spatial_tree is None or accident_df is None:
        return jsonify({"error": "Dataset not loaded"}), 500
    
    data = request.json
    lat = data.get('lat')
    lng = data.get('lng')
    
    if lat is None or lng is None:
        return jsonify({"error": "Missing coordinates"}), 400

    # Dataset coverage bounds (auto-computed on load)
    lat_min, lat_max = float(accident_df['latitude'].min()), float(accident_df['latitude'].max())  # type: ignore
    lng_min, lng_max = float(accident_df['longitude'].min()), float(accident_df['longitude'].max())  # type: ignore
    
    # Check if point is within dataset coverage (with small buffer)
    buffer = 0.5  # ~50km buffer
    in_coverage = (lat_min - buffer <= lat <= lat_max + buffer and
                   lng_min - buffer <= lng <= lng_max + buffer)

    # Find nearest point distance
    dist, nearest_idx = spatial_tree.query([lat, lng])  # type: ignore
    
    # Search with multiple radii for better results
    radius_small = 0.02   # ~2km
    radius_medium = 0.05  # ~5km
    radius_large = 0.15   # ~15km
    
    idx_small = spatial_tree.query_ball_point([lat, lng], radius_small)  # type: ignore
    idx_medium = spatial_tree.query_ball_point([lat, lng], radius_medium)  # type: ignore
    idx_large = spatial_tree.query_ball_point([lat, lng], radius_large)  # type: ignore
    
    count_immediate = len(idx_small)
    count_nearby = len(idx_medium)
    count_area = len(idx_large)
    
    # Risk score based on multi-radius density with calibrated multipliers
    # Previously, 9 clusters would trigger 100%. Now tuned for real-world density.
    score_immediate = count_immediate * 2.0  # 2km radius
    score_nearby = count_nearby * 0.5        # 5km radius
    score_area = count_area * 0.05           # 15km radius
    
    raw_risk = score_immediate + score_nearby + score_area
    # Use a non-linear scaling (log-like or sqrt) so it grows slower at the top end
    risk_score = min(100.0, np.sqrt(raw_risk) * 15)  # E.g. raw=44 -> 100%, raw=10 -> 47%, raw=4 -> 30%
    
    severity_label = "NOMINAL"
    if risk_score > 75:
        severity_label = "CRITICAL"
    elif risk_score > 45:
        severity_label = "ELEVATED"
    elif risk_score > 15:
        severity_label = "CAUTION"

    recommendation = "Drive Safely"
    if risk_score > 75:
        recommendation = "Extreme Caution - High accident density zone"
    elif risk_score > 45:
        recommendation = "High Caution - Elevated accident history"
    elif risk_score > 15:
        recommendation = "Moderate Caution - Some historical incidents"

    return jsonify({
        "lat": lat,
        "lng": lng,
        "risk_score": round(float(risk_score), 1),  # type: ignore
        "severity": severity_label,
        "historical_count": int(count_nearby),
        "count_2km": int(count_immediate),
        "count_5km": int(count_nearby),
        "count_15km": int(count_area),
        "radius_km": 5.0,
        "recommendation": recommendation,
        "in_coverage": in_coverage,
        "nearest_record_km": round(float(dist) * 111, 1),  # rough deg->km # type: ignore
        "coverage_region": "United Kingdom",
        "coverage_bounds": {
            "lat_min": round(lat_min, 2),  # type: ignore
            "lat_max": round(lat_max, 2),  # type: ignore
            "lng_min": round(lng_min, 2),  # type: ignore
            "lng_max": round(lng_max, 2)  # type: ignore
        }
    })


@app.route("/api/temp/<filename>")
def serve_temp(filename):
    """Serve annotated images from temp folder."""
    return send_from_directory(UPLOAD_FOLDER, filename)


if __name__ == "__main__":
    print("🚗 Accident Detection API starting...")
    print(f"📂 Model loaded from: {MODEL_PATH}")
    print(f"🌐 Server running at: http://localhost:5000")
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=False, host="0.0.0.0", port=port)
