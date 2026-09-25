FROM node:22-alpine

WORKDIR /app

# Copy application files
COPY package.json ./
COPY . .

# Expose port
EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

CMD ["npm", "start"]
