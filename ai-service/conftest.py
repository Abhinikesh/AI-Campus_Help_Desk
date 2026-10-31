"""
Root conftest.py — ensures pytest adds the ai-service directory to sys.path
so that `from app import create_app` works correctly in all test modules.
"""
import sys
import os

# Add the ai-service root to sys.path so that 'app' package is importable.
sys.path.insert(0, os.path.dirname(__file__))

