# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps
COPY . .
# بیلدِ وبِ nginx بدونِ مبهم‌سازی (esbuild مینیفای می‌ماند) — مبهم‌سازِ رَندوم گاهی باگِ TDZ/صفحهٔ‌سفید می‌سازد.
# مبهم‌سازیِ APK جداست (workflow اندروید، بدونِ NO_OBF) و دست‌نخورده می‌ماند.
ENV NO_OBF=1
RUN npm run build

# Stage 2: Serve
FROM nginx:1.27-alpine AS production
RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
