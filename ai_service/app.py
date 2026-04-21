from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import base64
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# ── Haar Cascade detector (fallback) ──────────────────────────
face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)

# ── MediaPipe detector (primary, higher accuracy) ─────────────
mp_face_detection = None
try:
    import mediapipe as mp

    mp_face_detection = mp.solutions.face_detection.FaceDetection(
        model_selection=1, min_detection_confidence=0.5
    )
    logger.info("MediaPipe face detection loaded successfully")
except ImportError:
    logger.warning("MediaPipe not installed — falling back to Haar cascade only")
except Exception as e:
    logger.warning(f"MediaPipe init failed ({e}) — falling back to Haar cascade only")


def decode_frame(b64_string):
    """Decode base64 frame to image"""
    try:
        if "," in b64_string:
            b64_string = b64_string.split(",")[1]
        img_bytes = base64.b64decode(b64_string)
        np_arr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if frame is None:
            raise ValueError("Failed to decode frame")
        return frame
    except Exception as e:
        logger.error(f"Frame decode error: {e}")
        raise


def detect_faces_mediapipe(frame):
    """Detect faces using MediaPipe (higher accuracy)."""
    if mp_face_detection is None:
        return None  # signal to fall back
    try:
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = mp_face_detection.process(rgb)
        if results.detections:
            return results.detections
        return []
    except Exception as e:
        logger.error(f"MediaPipe detection error: {e}")
        return None  # fall back


def detect_faces_haar(frame):
    """Detect faces in frame using Haar Cascade (fallback)."""
    try:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)
        faces = face_cascade.detectMultiScale(
            gray, scaleFactor=1.05, minNeighbors=4, minSize=(30, 30)
        )
        return faces
    except Exception as e:
        logger.error(f"Haar detection error: {e}")
        return []


def detect_faces(frame):
    """Detect faces using MediaPipe first, Haar cascade as fallback.
    Returns (face_count, detector_used, detections_for_looking_away).
    """
    # Try MediaPipe first
    mp_result = detect_faces_mediapipe(frame)
    if mp_result is not None:
        return len(mp_result), "mediapipe", mp_result

    # Fallback to Haar
    haar_faces = detect_faces_haar(frame)
    return len(haar_faces), "haar", haar_faces


def check_looking_away(frame, detections, detector):
    """Check if detected face is looking away based on position offset."""
    try:
        h, w = frame.shape[:2]

        if detector == "mediapipe" and detections:
            det = detections[0]
            bbox = det.location_data.relative_bounding_box
            face_center_x = (bbox.xmin + bbox.width / 2) * w
            face_center_y = (bbox.ymin + bbox.height / 2) * h
        elif detector == "haar" and len(detections) > 0:
            x, y, fw, fh = detections[0]
            face_center_x = x + fw / 2
            face_center_y = y + fh / 2
        else:
            return False

        x_offset = abs(face_center_x - w / 2) / w
        y_offset = abs(face_center_y - h / 2) / h
        return x_offset > 0.35 or y_offset > 0.35
    except Exception as e:
        logger.error(f"Looking away check error: {e}")
        return False


@app.route("/analyze", methods=["POST"])
def analyze():
    """Analyze frame for face detection and proctoring violations"""
    try:
        data = request.get_json()
        if not data or "frame" not in data:
            return jsonify({"error": "No frame provided"}), 400

        frame = decode_frame(data["frame"])
        if frame is None:
            return jsonify({"error": "Invalid frame"}), 400

        face_count, detector, detections = detect_faces(frame)
        face_detected = face_count >= 1
        multiple = face_count > 1
        looking_away = check_looking_away(frame, detections, detector) if face_detected else False

        # Higher confidence when using MediaPipe
        if detector == "mediapipe":
            confidence = 92 if face_detected else 75
        else:
            confidence = 85 if face_detected else 70

        return jsonify(
            {
                "face_detected": bool(face_detected),
                "multiple_faces": bool(multiple),
                "looking_away": bool(looking_away),
                "face_count": int(face_count),
                "confidence": confidence,
                "detector": detector,
            }
        )
    except Exception as e:
        logger.error(f"Analyze error: {e}")
        return jsonify({"error": "Analysis failed"}), 500


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint"""
    return jsonify({
        "status": "ok",
        "mediapipe_available": mp_face_detection is not None,
    })


if __name__ == "__main__":
    port = int(os.getenv("AI_PORT", 5000))
    debug = os.getenv("AI_DEBUG", "false").lower() == "true"
    logger.info(f"AI service running on port {port}")
    logger.info(f"MediaPipe: {'enabled' if mp_face_detection else 'disabled (Haar cascade only)'}")
    app.run(port=port, debug=debug, host="0.0.0.0")
