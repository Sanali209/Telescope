import uvicorn
import os
import sys

# Ensure the current directory is in the python path
sys.path.append(os.getcwd())

if __name__ == "__main__":
    # Run the application using uvicorn
    # allowing reload for development
    uvicorn.run("app.main:app", host="127.0.0.1", port=8080, reload=True)
