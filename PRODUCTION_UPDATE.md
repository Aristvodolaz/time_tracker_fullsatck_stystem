# 🚀 Инструкция по обновлению на Production сервере

## Шаг 1: Подключитесь к серверу

```bash
ssh admin-lc@<server-ip>
```

## Шаг 2: Перейдите в директорию проекта

```bash
cd /home/admin-lc/time_tracker_fullsatck_stystem
```

## Шаг 3: Получите последние изменения

```bash
git pull origin main
```

## Шаг 4: Обновите Frontend

```bash
cd frontend

# Остановите приложение
pm2 stop time-tracker-frontend

# ВАЖНО: Удалите старые зависимости
rm -rf node_modules package-lock.json

# Очистите npm cache
npm cache clean --force

# Установите зависимости заново (на Linux)
npm install

# Перезапустите приложение
pm2 restart time-tracker-frontend

# Проверьте статус
pm2 logs time-tracker-frontend --lines 50
```

## Шаг 5: Обновите Backend

```bash
cd ../backend

# Остановите приложение
pm2 stop time-tracker-backend

# Установите зависимости (если были изменения)
npm install

# ВАЖНО: Проверьте .env файл
# Убедитесь что PORT=3001
cat .env

# Если PORT=3020, измените на 3001:
nano .env
# Измените PORT=3020 на PORT=3001
# Сохраните: Ctrl+O, Enter, Ctrl+X

# Перезапустите приложение
pm2 restart time-tracker-backend

# Проверьте статус
pm2 logs time-tracker-backend --lines 50
```

## Шаг 6: Проверьте работу приложения

```bash
# Проверьте статус всех процессов
pm2 status

# Проверьте логи
pm2 logs --lines 100

# Проверьте доступность
curl http://localhost:3001/api/activities
curl http://localhost:3021
```

## Шаг 7: Сохраните конфигурацию PM2

```bash
pm2 save
```

---

## ⚠️ Если возникли проблемы

### Ошибка: "Cannot find native binding"

```bash
cd /home/admin-lc/time_tracker_fullsatck_stystem/frontend
pm2 stop time-tracker-frontend
rm -rf node_modules package-lock.json
npm cache clean --force
npm install --force
pm2 restart time-tracker-frontend
```

### Ошибка: "EADDRINUSE: address already in use"

```bash
# Найдите процесс
lsof -i :3021  # для frontend
lsof -i :3001  # для backend

# Убейте процесс
kill -9 <PID>

# Перезапустите
pm2 restart all
```

### Приложение не запускается

```bash
# Очистите логи
pm2 flush

# Перезапустите с нуля
pm2 delete all
cd /home/admin-lc/time_tracker_fullsatck_stystem/backend
pm2 start npm --name "time-tracker-backend" -- run dev
cd ../frontend
pm2 start npm --name "time-tracker-frontend" -- run dev

# Сохраните
pm2 save
```

---

## ✅ Что изменилось в этом обновлении

### Frontend
- ✅ Новый минималистичный дизайн в светлой теме
- ✅ Улучшенный UX и полноэкранный интерфейс
- ✅ Рабочий выпадающий список с поддержкой мыши

### Backend
- ✅ Добавлена валидация всех barcode параметров
- ✅ Защита от пустых строк и undefined значений
- ✅ Исправлена ошибка "Validation failed for parameter 'barcode'"

### Документация
- ✅ Создан DEPLOYMENT.md с инструкциями
- ✅ Добавлен troubleshooting для типичных проблем

---

## 📞 Поддержка

Если возникли проблемы, проверьте:
1. Логи: `pm2 logs`
2. Статус: `pm2 status`
3. Версию Node.js: `node --version` (должна быть 20.19+ или 22.12+)
