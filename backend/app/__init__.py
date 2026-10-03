from pathlib import Path

from dotenv import load_dotenv

# Load backend/.env (if present) before any module reads its settings.
# Variables already set in the environment take precedence over the file.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")
