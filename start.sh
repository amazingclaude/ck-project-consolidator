# Add this to webapp -> stack settings -> startup command
gunicorn -k uvicorn.workers.UvicornWorker app:app --bind=0.0.0.0:$PORT
