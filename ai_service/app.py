from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import base64

app = Flask(__name__)
CORS(app)

face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

def decode_frame(b64_string):
    if ',' in b64_string:
        b64_string = b64_string.split(',')[1]
    img_bytes = base64.b64decode(b64_string)
    np_arr    = np.frombuffer(img_bytes, np.uint8)
    return cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

def detect_faces(frame):
    gray  = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.05, minNeighbors=4, minSize=(30, 30))
    return faces

def check_looking_away(frame, faces):
    if len(faces) == 0:
        return False
    h, w  = frame.shape[:2]
    x, y, fw, fh = faces[0]
    face_center_x = x + fw / 2
    face_center_y = y + fh / 2
    x_offset = abs(face_center_x - w / 2) / w
    y_offset = abs(face_center_y - h / 2) / h
    return x_offset > 0.35 or y_offset > 0.35

@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.get_json()
    if not data or 'frame' not in data:
        return jsonify({ 'error': 'No frame provided' }), 400

    frame = decode_frame(data['frame'])
    if frame is None:
        return jsonify({ 'error': 'Invalid frame' }), 400

    faces         = detect_faces(frame)
    face_count    = len(faces)
    face_detected = face_count >= 1
    multiple      = face_count > 1
    looking_away  = check_looking_away(frame, faces)

    return jsonify({
        'face_detected':  face_detected,
        'multiple_faces': multiple,
        'looking_away':   looking_away,
        'face_count':     face_count,
    })

@app.route('/health', methods=['GET'])
def health():
    return jsonify({ 'status': 'ok' })

if __name__ == '__main__':
    print('AI service running on port 5000')
    app.run(port=5000, debug=False)
