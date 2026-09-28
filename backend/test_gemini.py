"""
TripZ Gemini API Test

This module is used to test the connection between the TripZ backend
and the Gemini model.

It is intended for development and debugging purposes and is not part
of the main TripZ agent orchestration workflow.
"""

import os
from dotenv import load_dotenv
from google import genai

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise ValueError("GEMINI_API_KEY is not found in .env")

client = genai.Client(api_key=api_key)

response = client.models.generate_content(
    model="gemini-3.5-flash-lite",
    contents="Hello! Introduce yourself as TripZ, an AI travel planner."
)

print(response.text)