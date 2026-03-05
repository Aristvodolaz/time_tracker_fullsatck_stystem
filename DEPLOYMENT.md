# Инструкция по развертыванию

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

### Решение 2: Использовать совместимую версию Vite

Если обновление Node.js невозможно, в папке `frontend`:

```bash
cd /home/admin-lc/time_tracker_fullsatck_stystem/frontend

# Удалить node_modules и lock файл
rm -rf node_modules package-lock.json

# Установить зависимости заново
npm install

# Перезапустить через PM2
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
