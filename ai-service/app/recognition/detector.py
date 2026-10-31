"""Face detection engine using face_recognition (dlib) with OpenCV fallback."""
from typing import List, Tuple, Dict, Any
import cv2
import numpy as np
import face_recognition

from app.config import Config
from app.utils.exceptions import (
    NoFaceDetectedError,
    MultipleFacesDetectedError,
    FaceTooSmallError,
)

# Load Haar cascade as secondary validator / fallback
_HAAR_PATH = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
_haar_cascade = cv2.CascadeClassifier(_HAAR_PATH)

def detect_faces(image: np.ndarray) -> List[Tuple[int, int, int, int]]:
    """
    Detect faces in an in-memory BGR image.
    Returns list of bounding boxes in (top, right, bottom, left) format.
    """
    # Convert BGR to RGB for face_recognition
    rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

    # Primary detector: dlib HOG (fast and reliable on CPU)
    boxes = face_recognition.face_locations(rgb_image, number_of_times_to_upsample=1, model="hog")

    # If dlib finds nothing on extreme lighting, try OpenCV Haar as fallback
    if len(boxes) == 0 and not _haar_cascade.empty():
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        haar_faces = _haar_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))
        for (x, y, w, h) in haar_faces:
            boxes.append((y, x + w, y + h, x))

    return boxes

def validate_single_face(image: np.ndarray) -> Tuple[int, int, int, int]:
    """
    Ensures that EXACTLY ONE face is present and meets size requirements.
    Raises domain exceptions if 0, >1, or face is too small.
    """
    boxes = detect_faces(image)

    if len(boxes) == 0:
        raise NoFaceDetectedError("No face detected. Please ensure your face is clearly visible to the camera.")

    if len(boxes) > 1:
        raise MultipleFacesDetectedError(f"Multiple faces ({len(boxes)}) detected. Ensure only you are in front of the camera.")

    top, right, bottom, left = boxes[0]
    face_width = right - left
    face_height = bottom - top

    if face_width < Config.MIN_FACE_SIZE or face_height < Config.MIN_FACE_SIZE:
        raise FaceTooSmallError(
            f"Face is too small ({face_width}x{face_height}px). Minimum required is {Config.MIN_FACE_SIZE}x{Config.MIN_FACE_SIZE}px."
        )

    return (top, right, bottom, left)

def extract_face_chip(image: np.ndarray, bbox: Tuple[int, int, int, int], margin: float = 0.2) -> np.ndarray:
    """
    Extract face crop with optional margin around the bounding box.
    """
    h, w = image.shape[:2]
    top, right, bottom, left = bbox

    box_w = right - left
    box_h = bottom - top

    pad_w = int(box_w * margin)
    pad_h = int(box_h * margin)

    crop_top = max(0, top - pad_h)
    crop_bottom = min(h, bottom + pad_h)
    crop_left = max(0, left - pad_w)
    crop_right = min(w, right + pad_w)

    return image[crop_top:crop_bottom, crop_left:crop_right].copy()
