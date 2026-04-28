cd /home/site/wwwroot
python -m venv antenv
source antenv/bin/activate
pip install -r requirements.txt
gunicorn -k uvicorn.workers.UvicornWorker app:app --bind=0.0.0.0:$PORT
