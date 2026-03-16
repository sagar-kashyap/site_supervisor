FROM node:20-slim

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy application code
COPY . .

# Cloud Run defaults to port 8080
ENV PORT=8080
EXPOSE 8080

# Start the server using tsx
CMD ["npm", "run", "start"]
