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

face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)


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


def detect_faces(frame):
    """Detect faces in frame using Haar Cascade"""
    try:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)
        faces = face_cascade.detectMultiScale(
            gray, scaleFactor=1.05, minNeighbors=4, minSize=(30, 30)
        )
        return faces
    except Exception as e:
        logger.error(f"Face detection error: {e}")
        return []


def check_looking_away(frame, faces):
    """Check if detected face is looking away"""
    try:
        if len(faces) == 0:
            return False
        h, w = frame.shape[:2]
        x, y, fw, fh = faces[0]
        face_center_x = x + fw / 2
        face_center_y = y + fh / 2
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

        faces = detect_faces(frame)
        face_count = len(faces)
        face_detected = face_count >= 1
        multiple = face_count > 1
        looking_away = check_looking_away(frame, faces)

        # Calculate confidence score
        confidence = 85 if face_detected else 70

        return jsonify(
            {
                "face_detected": bool(face_detected),
                "multiple_faces": bool(multiple),
                "looking_away": bool(looking_away),
                "face_count": int(face_count),  # FIXED: was bool(face_count)
                "confidence": confidence,
            }
        )
    except Exception as e:
        logger.error(f"Analyze error: {e}")
        return jsonify({"error": "Analysis failed"}), 500


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint"""
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    port = int(os.getenv("AI_PORT", 5000))
    debug = os.getenv("AI_DEBUG", "false").lower() == "true"
    logger.info(f"AI service running on port {port}")
    app.run(port=port, debug=debug, host="0.0.0.0")
