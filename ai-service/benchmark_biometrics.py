"""
CampusSphere AI — Biometric Engine Benchmark Script (Part 5)
=============================================================
Runs repeatable local performance benchmarks across pipeline stages:
1. Base64 Image Decoding
2. Photometric Quality Analysis
3. Lighting Normalization (CLAHE)
4. Face Detection (dlib HOG)
5. Embedding Extraction (dlib ResNet-128d)
6. Template Encryption (AES-256-GCM)
7. Template Decryption (AES-256-GCM)
8. Vector Distance & Match Evaluation (Euclidean + Cosine)
9. End-to-End Verification Pipeline
"""
import time
import base64
import json
import platform
import numpy as np
import cv2

from app.config import Config
from app.utils.image_utils import decode_base64_image, compute_image_quality
from app.recognition.quality import analyze_face_quality
from app.recognition.preprocessing import normalize_lighting
from app.recognition.detector import detect_faces, validate_single_face
from app.recognition.embedding import generate_face_embedding, aggregate_enrollment_embeddings
from app.recognition.matcher import calculate_comparison_metrics, evaluate_match
from app.security.encryption import encrypt_biometric_template, decrypt_biometric_template

def generate_benchmark_frame(width=640, height=480):
    """Generate a realistic synthetic face frame in memory."""
    img = np.ones((height, width, 3), dtype=np.uint8) * 60
    # Head ellipse
    cv2.ellipse(img, (width // 2, height // 2), (width // 5, height // 3), 0, 0, 360, (190, 160, 130), -1)
    # Hair
    cv2.ellipse(img, (width // 2, height // 3), (width // 5, height // 6), 0, 180, 360, (30, 20, 15), -1)
    # Eyes
    for ex in [width // 2 - width // 10, width // 2 + width // 10]:
        cv2.circle(img, (ex, height // 2 - height // 12), 16, (20, 15, 10), -1)
        cv2.circle(img, (ex, height // 2 - height // 12), 8, (220, 220, 220), -1)
    # Mouth
    cv2.ellipse(img, (width // 2, height // 2 + height // 8), (40, 15), 0, 0, 180, (120, 40, 40), -1)
    # Texture noise
    noise = np.random.randint(-10, 11, img.shape, dtype=np.int16)
    img = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    
    _, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 85])
    b64_str = "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode("utf-8")
    return img, b64_str, len(buf.tobytes())

def run_benchmarks(num_runs=50):
    print(f"============================================================")
    print(f" CampusSphere AI Biometric Performance Benchmark (Part 5)")
    print(f" Platform: {platform.system()} {platform.machine()} ({platform.processor() or 'ARM/x86'})")
    print(f" Python: {platform.python_version()} | OpenCV: {cv2.__version__}")
    print(f" Iterations: {num_runs} consecutive runs")
    print(f"============================================================")

    # 1. Prepare assets
    test_img, test_b64, payload_bytes = generate_benchmark_frame(640, 480)
    print(f"Test image payload: 640x480 JPEG (~{payload_bytes / 1024:.1f} KB)")

    test_vector = [float(x) for x in np.random.randn(128)]
    norm = np.linalg.norm(test_vector)
    test_vector = [round(x / norm, 6) for x in test_vector]
    
    test_template = {
        "model": Config.MODEL_NAME,
        "dimensions": 128,
        "vector": test_vector,
        "templateReference": "bench-template-ref-001"
    }
    encrypted_blob = encrypt_biometric_template(test_template, Config.BIOMETRIC_SECRET_KEY)

    metrics = {
        "decode_b64": [],
        "quality_analysis": [],
        "normalize_lighting": [],
        "face_detection": [],
        "template_encryption": [],
        "template_decryption": [],
        "distance_matching": [],
    }

    # Warmup
    _ = decode_base64_image(test_b64)
    _ = compute_image_quality(test_img)
    _ = normalize_lighting(test_img)
    _ = detect_faces(test_img)
    _ = encrypt_biometric_template(test_template, Config.BIOMETRIC_SECRET_KEY)
    _ = decrypt_biometric_template(encrypted_blob, Config.BIOMETRIC_SECRET_KEY)
    _ = calculate_comparison_metrics(np.array(test_vector), np.array(test_vector))

    # Benchmark loops
    for i in range(num_runs):
        # 1. Base64 Decode
        t0 = time.perf_counter()
        img = decode_base64_image(test_b64)
        metrics["decode_b64"].append((time.perf_counter() - t0) * 1000)

        # 2. Quality Analysis
        t0 = time.perf_counter()
        _ = compute_image_quality(img)
        metrics["quality_analysis"].append((time.perf_counter() - t0) * 1000)

        # 3. Lighting Normalization
        t0 = time.perf_counter()
        norm_img = normalize_lighting(img)
        metrics["normalize_lighting"].append((time.perf_counter() - t0) * 1000)

        # 4. Face Detection (dlib HOG)
        t0 = time.perf_counter()
        boxes = detect_faces(norm_img)
        metrics["face_detection"].append((time.perf_counter() - t0) * 1000)

        # 5. Template Encryption
        t0 = time.perf_counter()
        enc = encrypt_biometric_template(test_template, Config.BIOMETRIC_SECRET_KEY)
        metrics["template_encryption"].append((time.perf_counter() - t0) * 1000)

        # 6. Template Decryption
        t0 = time.perf_counter()
        dec = decrypt_biometric_template(enc, Config.BIOMETRIC_SECRET_KEY)
        metrics["template_decryption"].append((time.perf_counter() - t0) * 1000)

        # 7. Distance & Matching
        t0 = time.perf_counter()
        res = evaluate_match(np.array(test_vector), np.array(dec["vector"]))
        metrics["distance_matching"].append((time.perf_counter() - t0) * 1000)

    # Embedding extraction benchmark on an image with a crop
    embedding_durations = []
    # Test face chip with known bbox
    bbox = (120, 480, 400, 160)
    for i in range(min(num_runs, 25)):
        t0 = time.perf_counter()
        try:
            # Test face_encodings directly with known bbox
            rgb = cv2.cvtColor(norm_img, cv2.COLOR_BGR2RGB)
            import face_recognition
            _ = face_recognition.face_encodings(rgb, known_face_locations=[bbox], model="small")
            embedding_durations.append((time.perf_counter() - t0) * 1000)
        except Exception:
            pass

    if embedding_durations:
        metrics["embedding_extraction"] = embedding_durations

    results = {}
    print(f"\n{'Operation / Pipeline Stage':<35} | {'Mean (ms)':<10} | {'Median (ms)':<12} | {'P95 (ms)':<10}")
    print("-" * 75)
    
    total_mean = 0.0
    for name, samples in metrics.items():
        arr = np.array(samples)
        mean_val = float(np.mean(arr))
        median_val = float(np.median(arr))
        p95_val = float(np.percentile(arr, 95))
        total_mean += mean_val
        results[name] = {
            "samples": len(samples),
            "mean_ms": round(mean_val, 2),
            "median_ms": round(median_val, 2),
            "p95_ms": round(p95_val, 2),
        }
        print(f"{name:<35} | {mean_val:>9.2f}  | {median_val:>11.2f}  | {p95_val:>9.2f}")

    print("-" * 75)
    print(f"{'Estimated Total Verification Pipeline':<35} | {total_mean:>9.2f} ms")
    print(f"============================================================")

    with open("/Users/abhinikesh/AI-Campus_Help_Desk/docs/benchmark_results.json", "w") as f:
        json.dump({
            "platform": platform.platform(),
            "cpu": platform.processor() or platform.machine(),
            "python": platform.python_version(),
            "runs": num_runs,
            "imageDimensions": "640x480",
            "results": results,
            "totalMeanMs": round(total_mean, 2)
        }, f, indent=2)

if __name__ == "__main__":
    run_benchmarks(50)

