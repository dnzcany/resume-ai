
# NEXT.JS FRONTEND DOCKERFILE

# 1) Build level
FROM node:18-alpine AS builder

WORKDIR /app

# add packed files
COPY package.json package-lock.json* ./

# install dependecies
RUN npm install

# copy all project
COPY . .

# Next.js build
RUN npm run build

# 2) Production level 
FROM node:18-alpine

WORKDIR /app

COPY --from=builder /app ./

# Export port
EXPOSE 3000

# start Prod server 
CMD ["npm", "start"]
