FROM node:20-bookworm-slim

# Install Python 3 + pip and the system libraries OpenCV needs at runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Make "python3" available as "python" since the app spawns "python" on
# non-Windows platforms
RUN ln -sf /usr/bin/python3 /usr/bin/python

WORKDIR /app

# Install Python dependencies in an isolated virtualenv to avoid the
# "externally-managed-environment" restriction on recent Debian/pip
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Install Node dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy the rest of the app and build it
COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 5000

CMD ["npm", "run", "start"]
