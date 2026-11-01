# Smart Attendance Image Quality Validation Engine
## Project: CampusSphere AI — Smart Campus Management ERP

**Document Version:** 5.0.0  
**Phase:** Part 5 of 24 — Quality Validation Engine  
**Date:** November 1, 2026  
**Auditor / Architect:** Senior Computer-Vision Engineer  

---

## 1. Engine Objectives & Classroom Environment Reality

Biometric verification in university settings occurs under realistic environmental conditions: fluctuating indoor ambient light, fluorescent fixtures, backlighting near windows, and diverse laptop/mobile webcams. 

The image quality validation engine in `app/recognition/quality.py` and `app/utils/image_utils.py` enforces necessary biometric standards without demanding ideal laboratory lighting. It provides structured, actionable guidance so students can immediately correct their posture or environment.

---

## 2. Photometric & Structural Quality Metrics

| Metric | Target Range | Measurement Technique | Failure Code | Actionable User Guidance |
|---|---|---|---|---|
| **Luminance (Brightness)** | `40.0` – `225.0` | Mean 8-bit grayscale pixel intensity across the frame ($0$ to $255$). | `IMAGE_TOO_DARK` / `IMAGE_TOO_BRIGHT` | "The image is too dark. Increase ambient lighting." / "The image is overexposed. Avoid direct glare or strong backlighting." |
| **Sharpness (Blur)** | Variance $\ge 35.0$ | Variance of the Laplacian ($\nabla^2 I$) using 64-bit float convolution. | `IMAGE_TOO_BLURRY` | "The image is blurry. Hold the camera steady and try again." |
| **Contrast** | Standard deviation $\ge 20.0$ | Intensity standard deviation across the grayscale frame. | `IMAGE_LOW_CONTRAST` | "Low contrast detected between face and background." |
| **Face Dimensions** | Minimum $70 \times 70$ px | Bounding box dimensions $(w, h)$ from detector. | `FACE_TOO_SMALL` | "Face is too small. Please move closer to the camera." |
| **Face Centering** | Center within inner $80\%$ of frame | Bounding box center $(\frac{left+right}{2}, \frac{top+bottom}{2})$ vs. margins ($10\%$ from frame borders). | `FACE_POSITION_INVALID` | "Face is positioned too close to the frame boundary. Please center your face." |
| **Frame Dimensions** | Min $160 \times 160$ px | OpenCV `image.shape[:2]` resolution check. | `INVALID_IMAGE_PAYLOAD` | "Image resolution too low. Minimum required: 160x160 px." |
| **Payload Size** | $4\text{ KB}$ – $5\text{ MB}$ | Decoded byte array length from Base64 string. | `INVALID_IMAGE_PAYLOAD` | "Image payload size exceeds maximum limit of 5MB." |

---

## 3. Blur Classification Spectrum

The Laplacian variance metric is evaluated according to a three-tier spectrum:

1. **Sharp ($\text{Variance} \ge 60.0$):** High feature clarity; eye, nose, and mouth contours are sharply resolved.
2. **Mild Blur ($35.0 \le \text{Variance} < 60.0$):** Common in handheld mobile or laptop cameras with minor hand tremor. Facial feature points remain detectable and suitable for dlib embedding extraction without false rejections.
3. **Severe Blur ($\text{Variance} < 35.0$):** Motion smear or defocus obscures essential landmark structures. Image is rejected with code `IMAGE_TOO_BLURRY` to prevent erroneous verification decisions.

---

## 4. Structured Quality Response Contract

```json
{
  "isValid": false,
  "status": "IMAGE_TOO_BLURRY",
  "message": "The image is blurry. Hold the camera steady and try again.",
  "metrics": {
    "brightness": 114.2,
    "sharpness": 22.8,
    "contrast": 38.6,
    "blurLevel": "severe_blur",
    "isTooDark": false,
    "isTooBright": false,
    "isBlurry": true,
    "isLowContrast": false,
    "qualityScore": 0.442,
    "dimensions": { "width": 640, "height": 480 }
  },
  "quality": {
    "brightness": "acceptable",
    "blur": "severe_blur",
    "contrast": "acceptable",
    "face_position": "acceptable"
  },
  "error": {
    "code": "IMAGE_TOO_BLURRY",
    "message": "The image is blurry. Hold the camera steady and try again."
  },
  "faceCount": 1
}
```

---

## 5. Lighting Normalization (CLAHE)

Before single-face validation and embedding extraction, images undergo illumination normalization in `app/recognition/preprocessing.py`:
- Conversion from BGR to CIE LAB color space.
- Application of CLAHE (Contrast Limited Adaptive Histogram Equalization) with `clipLimit=2.0` and `tileGridSize=(8, 8)` strictly on the Luminance (L) channel.
- Chromaticity channels (A and B) are left unmodified, eliminating color cast artifacts while recovering shadow detail on underexposed sides of the face.

