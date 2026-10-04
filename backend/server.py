import asyncio
import os
import re
import json
import uuid
import base64
import shutil
import subprocess
import webbrowser
import urllib.parse
import sqlite3
from datetime import datetime

import pygame
import psutil
import tempfile
import mss
from PIL import Image
import speech_recognition as sr
import edge_tts
from google import genai as google_genai
from groq import Groq
import sys
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Locate base directory whether running as source or PyInstaller bundle
if getattr(sys, 'frozen', False):
    BASE_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

appdata = os.environ.get('APPDATA')
appdata_dir = os.path.join(appdata, "GOLD AI") if appdata else None
if appdata_dir:
    os.makedirs(appdata_dir, exist_ok=True)
    # Migrate .env from prior Wang AI or legacy directory if present
    for prior in ["Wang AI", "waaner-ai"]:
        prior_env = os.path.join(appdata, prior, ".env")
        dest_env = os.path.join(appdata_dir, ".env")
        if os.path.exists(prior_env) and not os.path.exists(dest_env):
            try:
                shutil.copy(prior_env, dest_env)
            except Exception:
                pass

env_candidates = [
    os.path.join(appdata_dir, ".env") if appdata_dir else "",
    os.path.join(BASE_DIR, ".env"),
