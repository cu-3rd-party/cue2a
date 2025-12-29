FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5173
# Запускаем с флагом --host, чтобы Vite был доступен извне
CMD ["npm", "run", "dev", "--", "--host"]