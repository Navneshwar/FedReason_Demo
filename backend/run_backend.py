from pathlib import Path
import sys

import uvicorn

if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(root))
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8000, reload=True)
