"""Face preprocessing, illumination normalization, and alignment."""
from typing import Tuple
import cv2
import numpy as np

def normalize_lighting(bgr_image: np.ndarray) -> np.ndarray:
    """
    Apply CLAHE (Contrast Limited Adaptive Histogram Equalization) on LAB color space
    to correct uneven lighting without altering chromaticity.
    """
    lab = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab)

    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    cl = clahe.apply(l_channel)

    limg = cv2.merge((cl, a_channel, b_channel))
    return cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)

def resize_for_inference(bgr_image: np.ndarray, max_dim: int = 640) -> Tuple[np.ndarray, float]:
    """
    Downscale high-resolution images to canonical inference resolution while keeping aspect ratio.
    """
    h, w = bgr_image.shape[:2]
    if max(h, w) <= max_dim:
        return bgr_image, 1.0

    scale = max_dim / float(max(h, w))
    new_w = int(w * scale)
    new_h = int(h * scale)

    resized = cv2.resize(bgr_image, (new_w, new_h), interpolation=cv2.INTER_AREA)
    return resized, scale
