#!/usr/bin/env bash
# Создать zip из файлов (локально)
ZIPNAME="keis-replit-generator.zip"
FILES="index.html server.js package.json .replit README.md"
if command -v zip >/dev/null 2>&1; then
  zip -r "$ZIPNAME" $FILES
  echo "Создан $ZIPNAME"
else
  echo "Утилита zip не найдена. Выполните вручную: zip -r $ZIPNAME $FILES"
fi