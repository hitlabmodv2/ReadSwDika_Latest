#!/usr/bin/env bash
# Wrapper buat pm2-runtime — replace timestamp ISO jadi [WILY-KUN]
exec npx pm2-runtime start ecosystem.config.cjs 2>&1 | \
  sed -u 's/^[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}T[0-9]\{2\}:[0-9]\{2\}:[0-9]\{2\}:/[WILY-KUN]:/'
