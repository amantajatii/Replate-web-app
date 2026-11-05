FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 OMP_NUM_THREADS=1
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY recommend.py .
RUN useradd --uid 10001 --create-home batch && mkdir /reports && chown batch /reports
USER batch
ENTRYPOINT ["python", "recommend.py"]
CMD ["--report", "/reports/evaluation.json"]
