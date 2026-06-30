FROM node:20-slim

# Claude Code CLI (همان نسخه‌ی میزبان) — احراز هویت از طریق mount ~/.claude (اشتراک Max)
RUN npm install -g @anthropic-ai/claude-code@2.1.154 \
    && npm cache clean --force

WORKDIR /app
COPY server.js .

ENV LLM_PORT=8085 LLM_MODEL=sonnet
EXPOSE 8085

CMD ["node", "server.js"]
