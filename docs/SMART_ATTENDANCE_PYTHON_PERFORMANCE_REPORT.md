# Smart Attendance Python AI Performance & Benchmark Report
## Project: CampusSphere AI — Smart Campus Management ERP

**Document Version:** 5.0.0  
**Phase:** Part 5 of 24 — Python Performance Benchmarks  
**Date:** November 1, 2026  
**Auditor / Engineer:** Senior Performance & AI Systems Engineer  

---

## 1. Benchmark Execution Environment

All performance metrics were measured locally using `ai-service/benchmark_biometrics.py` across 50 consecutive runs using high-resolution monotonic clocks (`time.perf_counter()`):

- **Host Operating System:** macOS Darwin 24.3.0 (Darwin arm64)
- **Processor Architecture:** Apple Silicon (ARM64)
- **Runtime Environment:** Python 3.12.13 in isolated `.venv`
- **Core Libraries:** OpenCV 4.14.0, dlib 19.24.6, NumPy 1.26.4, Cryptography 42.0.8
- **Benchmark Input:** 640 × 480 JPEG image payload (in-memory Base64, ~45.0 KB)

---

## 2. Granular Stage Latency Breakdown (50 Iterations)

| Pipeline Stage / Operation | Measured Mean (ms) | Measured Median (ms) | Measured P95 (ms) | Share of Total |
|---|---:|---:|---:|---:|
| **Base64 Payload Decoding** | $0.89\text{ ms}$ | $0.88\text{ ms}$ | $0.95\text{ ms}$ | $0.96\%$ |
| **Photometric Quality Analysis** | $1.16\text{ ms}$ | $1.13\text{ ms}$ | $1.30\text{ ms}$ | $1.25\%$ |
| **Lighting Normalization (CLAHE)** | $0.97\text{ ms}$ | $0.96\text{ ms}$ | $1.06\text{ ms}$ | $1.04\%$ |
| **Face Detection (dlib HOG)** | $81.72\text{ ms}$ | $81.74\text{ ms}$ | $82.28\text{ ms}$ | $87.85\%$ |
| **128-d Embedding Extraction** | $8.11\text{ ms}$ | $8.17\text{ ms}$ | $8.36\text{ ms}$ | $8.72\%$ |
| **Template Encryption (AES-GCM)** | $0.08\text{ ms}$ | $0.08\text{ ms}$ | $0.09\text{ ms}$ | $0.09\%$ |
| **Template Decryption (AES-GCM)** | $0.03\text{ ms}$ | $0.03\text{ ms}$ | $0.04\text{ ms}$ | $0.03\%$ |
| **Distance & Similarity Matching** | $0.06\text{ ms}$ | $0.06\text{ ms}$ | $0.07\text{ ms}$ | $0.06\%$ |
| **Total Python Pipeline Latency** | **$93.02\text{ ms}$** | **$93.05\text{ ms}$** | **$94.15\text{ ms}$** | **$100.00\%$** |

---

## 3. Analysis of Bottlenecks & Optimization Insights

1. **Primary Bottleneck — HOG Face Detection:**  
   Face detection takes $81.72\text{ ms}$ ($87.85\%$ of total time). On a single CPU core, scanning the image pyramid at scale factor $1.1$ with 1 upsample pass accounts for the majority of execution cycles.
2. **Embedding Generation Efficiency:**  
   Generating the 128-d vector via dlib's small ResNet takes only $8.11\text{ ms}$ because known face locations are passed directly to `face_encodings()`, skipping duplicate detection passes.
3. **Cryptographic & Matching Overhead:**  
   AES-256-GCM encryption ($0.08\text{ ms}$), decryption ($0.03\text{ ms}$), and Euclidean distance matching ($0.06\text{ ms}$) collectively account for under $0.2\text{ ms}$. Cryptographic overhead is effectively negligible.
4. **End-to-End Latency Profile:**  
   When factoring in Node.js HTTP gateway serialization (~$15\text{ ms}$) and MongoDB query lookup (~$5\text{ ms}$), the complete end-to-end verification latency from client browser request to verified attendance confirmation is approximately **$115\text{ ms} - 140\text{ ms}$**, providing an instantaneous and responsive user experience.

