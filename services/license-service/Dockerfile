FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/
COPY public/ ./public/
COPY generate_license.py .

# Railway sets PORT at runtime; default to 8001 for local dev
ENV PORT=8001
EXPOSE ${PORT}

CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
