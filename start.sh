pip install -r /home/site/wwwroot/requirements.txt
gunicorn -k uvicorn.workers.UvicornWorker app:app --bind=0.0.0.0:$PORT
