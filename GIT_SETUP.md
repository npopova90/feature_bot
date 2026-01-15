# Инструкции по настройке Git и push в GitHub

## Если Git не установлен:

1. Установите Git: https://git-scm.com/download/win
2. Или используйте GitHub Desktop: https://desktop.github.com/

## Команды для push в репозиторий:

```bash
# 1. Инициализировать git репозиторий (если еще не инициализирован)
git init

# 2. Добавить remote репозиторий
git remote add origin https://github.com/npopova90/feature_bot.git

# 3. Добавить все файлы (кроме тех, что в .gitignore)
git add .

# 4. Сделать первый коммит
git commit -m "Initial commit: Telegram bot for feature test summaries with GPT-5.2"

# 5. Переименовать ветку в main (если нужно)
git branch -M main

# 6. Запушить в GitHub
git push -u origin main
```

## Если репозиторий уже существует на GitHub:

Если в репозитории уже есть файлы (например, README), используйте:

```bash
git pull origin main --allow-unrelated-histories
# Разрешите конфликты, если они есть
git push -u origin main
```

## Альтернатива через GitHub Desktop:

1. Откройте GitHub Desktop
2. File → Add Local Repository
3. Выберите папку проекта
4. Нажмите "Publish repository"
5. Выберите репозиторий `npopova90/feature_bot`
