# Инструкция по развертыванию

## ⚠️ ВАЖНО: Переустановка зависимостей на production

После git pull на production сервере **ОБЯЗАТЕЛЬНО** переустановите зависимости:

```bash
cd /home/admin-lc/time_tracker_fullsatck_stystem/frontend
pm2 stop time-tracker-frontend
rm -rf node_modules package-lock.json
npm install
pm2 restart time-tracker-frontend
```

**Причина:** Native модули (PostCSS, Tailwind, esbuild) должны быть скомпилированы на той же платформе (Linux), где они запускаются. Lock-файл с Windows содержит несовместимые бинарные файлы.

---

## Ошибка ERR_CONNECTION_REFUSED на /api/scan

Frontend обращается к бэкенду по URL из переменной окружения. На сервере нужно указать адрес бэкенда.

**Решение:**

1. В папке frontend создайте файл `.env`:
   ```bash
   cd /home/admin-lc/time_tracker_fullsatck_stystem/frontend
   echo 'VITE_API_BASE=http://10.171.12.36:3020/api' > .env
   ```
   Замените `10.171.12.36` на IP или hostname вашего сервера (тот же, по которому открываете приложение в браузере). Порт `3020` — порт бэкенда (проверьте в `backend/.env`: `PORT=3020`).

2. Перезапустите frontend:
   ```bash
   pm2 restart time-tracker-frontend
   ```

3. Убедитесь, что бэкенд запущен и слушает порт 3020:
   ```bash
   pm2 status
   curl -s http://localhost:3020/api/activities
   ```

Если бэкенд на другом порту — укажите его в `.env`, например: `VITE_API_BASE=http://10.171.12.36:3001/api`.

---

## Проблема с Node.js версией

Если вы видите ошибку:
```
You are using Node.js 18.20.5. Vite requires Node.js version 20.19+ or 22.12+
```

### Решение 1: Обновить Node.js (Рекомендуется)

На production сервере выполните:

```bash
# Обновить Node.js до версии 20 LTS или 22 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Проверить версию
node --version
```

### Решение 2: Переустановить зависимости на сервере

**ВАЖНО:** Native модули (PostCSS, Tailwind) должны быть скомпилированы на той же платформе, где они запускаются.

На production сервере выполните:

```bash
cd /home/admin-lc/time_tracker_fullsatck_stystem/frontend

# Остановить приложение
pm2 stop time-tracker-frontend

# Удалить node_modules и lock файл
rm -rf node_modules package-lock.json

# Установить зависимости заново (на Linux сервере)
npm install

# Перезапустить через PM2
pm2 restart time-tracker-frontend
```

**Если ошибка повторяется:**

```bash
# Очистить npm cache
npm cache clean --force

# Переустановить с rebuild native модулей
npm install --force

# Перезапустить
pm2 restart time-tracker-frontend
```

## Развертывание обновлений

### Frontend

```bash
cd /home/admin-lc/time_tracker_fullsatck_stystem/frontend
git pull
npm install
pm2 restart time-tracker-frontend
```

### Backend

```bash
cd /home/admin-lc/time_tracker_fullsatck_stystem/backend
git pull
npm install
pm2 restart time-tracker-backend
```

## Проверка статуса

```bash
pm2 status
pm2 logs time-tracker-frontend --lines 50
pm2 logs time-tracker-backend --lines 50
```

## Troubleshooting

### Ошибка: "Cannot find native binding"

**Проблема:** PostCSS/Tailwind native модули скомпилированы для другой платформы.

**Решение:**
```bash
cd /home/admin-lc/time_tracker_fullsatck_stystem/frontend
pm2 stop time-tracker-frontend
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
pm2 restart time-tracker-frontend
```

### Ошибка: "EADDRINUSE: address already in use"

**Решение:**
```bash
# Найти процесс на порту
lsof -i :3021

# Убить процесс
kill -9 <PID>

# Перезапустить
pm2 restart time-tracker-frontend
```

### Проверка логов

```bash
# Последние 100 строк
pm2 logs time-tracker-frontend --lines 100

# Следить за логами в реальном времени
pm2 logs time-tracker-frontend

# Очистить логи
pm2 flush
```

## Исправления в этом обновлении

### Backend
- ✅ Добавлена валидация всех barcode параметров
- ✅ Защита от пустых строк и undefined значений
- ✅ Добавлен .trim() для очистки пробелов

### Frontend
- ✅ Новый минималистичный дизайн
- ✅ Светлая тема
- ✅ Улучшенный UX
- ✅ Полноэкранный интерфейс
