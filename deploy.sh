#!/bin/bash
# 一键部署到 summertimes.app
# 用法：bash deploy.sh

set -e

echo "▶ pushing to GitHub..."
git add -A
git diff --cached --quiet && echo "  nothing to commit, skipping push" || git commit -m "deploy: $(date '+%Y-%m-%d %H:%M')" && git push

echo "▶ deploying to VPS..."
ssh root@45.77.8.147 '
  cd /opt/summertimes-web &&
  git pull &&
  npm run build &&
  cp -r dist/. /var/www/summertimes/ &&
  echo "✅ deployed to https://summertimes.app"
'
