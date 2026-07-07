import sys
import json
import base64
import cv2
import numpy as np
import os

face_cascade_path = os.path.join(cv2.data.haarcascades, 'haarcascade_frontalface_default.xml')
eye_cascade_path  = os.path.join(cv2.data.haarcascades, 'haarcascade_eye.xml')
face_alt_path     = os.path.join(cv2.data.haarcascades, 'haarcascade_frontalface_alt.xml')

face_cascade     = cv2.CascadeClassifier(face_cascade_path)
face_cascade_alt = cv2.CascadeClassifier(face_alt_path)
eye_cascade      = cv2.CascadeClassifier(eye_cascade_path)


def clamp(value, lo=0.0, hi=1.0):
    return max(lo, min(hi, value))


def process_image():
    try:
        input_data = sys.stdin.read().strip()
        if not input_data:
            return {"error": "No input data"}

        if "," in input_data:
            input_data = input_data.split(",")[1]

        img_bytes = base64.b64decode(input_data)
        nparr     = np.frombuffer(img_bytes, np.uint8)
        img       = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return {"error": "Failed to decode image"}

        # ── Dark / black frame check (person not present or camera covered) ──
        raw_gray      = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        mean_bright   = float(np.mean(raw_gray))
        bright_pixels = float(np.sum(raw_gray > 30)) / raw_gray.size  # fraction > threshold

        if mean_bright < 15 or bright_pixels < 0.05:
            return {
                "distracted": True,
                "label": "Driver Not Present",
                "confidence": round(clamp(0.90 + (15 - mean_bright) / 150), 2)
            }

        # Upscale small frames so the detector has enough pixels to work with
        h, w = img.shape[:2]
        if w < 480:
            scale = 480.0 / w
            img   = cv2.resize(img, (int(w * scale), int(h * scale)),
                               interpolation=cv2.INTER_LINEAR)

        frame_area = img.shape[0] * img.shape[1]
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)

        # --- Face detection (with reject-level weights for real confidence) ---
        faces, reject_levels, level_weights = face_cascade.detectMultiScale3(
            gray,
            scaleFactor=1.05,
            minNeighbors=3,
            minSize=(60, 60),
            outputRejectLevels=True
        )

        if len(faces) == 0:
            faces, reject_levels, level_weights = face_cascade_alt.detectMultiScale3(
                gray,
                scaleFactor=1.05,
                minNeighbors=3,
                minSize=(60, 60),
                outputRejectLevels=True
            )

        # ── No face at all ─────────────────────────────────────────────────
        if len(faces) == 0:
            # Blur variance gives a hint about whether the frame is usable
            blur  = cv2.Laplacian(gray, cv2.CV_64F).var()
            # Higher blur → lower confidence in the "distracted" call
            conf  = clamp(0.70 + min(blur, 800) / 8000)
            return {
                "distracted": True,
                "label": "No Face Detected",
                "confidence": round(conf, 2)
            }

        # Pick the face with the highest detector weight
        best_idx = int(np.argmax(level_weights))
        (x, y, fw, fh) = faces[best_idx]
        weight          = float(level_weights[best_idx])

        # Face confidence: blend detector weight + relative face size
        face_area_ratio = (fw * fh) / frame_area          # 0 – 1
        # weight from detectMultiScale3 is typically 1-8+; normalise loosely
        weight_norm     = clamp(weight / 6.0)
        face_conf       = clamp(0.5 * weight_norm + 0.5 * min(face_area_ratio * 12, 1.0))

        # --- Eye detection in upper 60 % of the face ROI ---
        roi_gray = gray[y: y + int(fh * 0.6), x: x + fw]

        eyes, eye_rejects, eye_weights = eye_cascade.detectMultiScale3(
            roi_gray,
            scaleFactor=1.05,
            minNeighbors=3,
            minSize=(15, 15),
            outputRejectLevels=True
        )

        # ── Eyes not visible ───────────────────────────────────────────────
        if len(eyes) == 0:
            # Confidence that driver is distracted: high when face is clear
            dist_conf = clamp(0.60 + 0.35 * face_conf)
            return {
                "distracted": True,
                "label": "Eyes Not Visible",
                "confidence": round(dist_conf, 2)
            }

        # Eye quality: best eye weight normalised
        best_eye_w  = float(np.max(eye_weights))
        eye_conf    = clamp(best_eye_w / 5.0)

        # ── Safe: face + at least one eye detected ─────────────────────────
        # Overall safe-confidence blends face quality and eye quality
        safe_conf = clamp(0.50 * face_conf + 0.50 * eye_conf + 0.10)
        # Never let it drop below 0.60 or exceed 0.99
        safe_conf = clamp(safe_conf, 0.60, 0.99)

        return {
            "distracted": False,
            "label": "Safe / Attentive",
            "confidence": round(safe_conf, 2)
        }

    except Exception as e:
        return {"error": str(e)}


if __name__ == "__main__":
    result = process_image()
    print(json.dumps(result))
