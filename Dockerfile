FROM python:3.12.5 AS builder

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1
WORKDIR /app


RUN python -m venv .venv
COPY requirements.txt ./
RUN .venv/bin/pip install -r requirements.txt
FROM python:3.12.5-slim
WORKDIR /app
COPY --from=builder /app/.venv .venv/
COPY . .
EXPOSE 5000
# Run via app.py, which serves with Waitress (a production WSGI server) and
# validates required env vars on startup. The Flask dev server (`flask run`) is
# not suitable for production.
CMD ["/app/.venv/bin/python", "app.py"]
