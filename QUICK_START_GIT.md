# Быстрый старт: Push в GitHub

## Шаг 1: Установите Git (если еще не установлен)

**Вариант A: Git для Windows**
- Скачайте: https://git-scm.com/download/win
- Установите с настройками по умолчанию
- Перезапустите терминал

**Вариант B: GitHub Desktop (проще)**
- Скачайте: https://desktop.github.com/
- Установите и войдите в аккаунт GitHub

## Шаг 2: Запустите push

### Если установили Git для Windows:

1. Откройте PowerShell или Git Bash в папке проекта
2. Запустите файл `push_to_github.bat` (двойной клик)
3. Или выполните команды вручную:

```bash
git init
git remote add origin https://github.com/npopova90/feature_bot.git
git add .
git commit -m "Initial commit: Telegram bot for feature test summaries with GPT-5.2"
git branch -M main
git push -u origin main
```

### Если используете GitHub Desktop:

1. Откройте GitHub Desktop
2. File → Add Local Repository
3. Выберите папку: `C:\Users\arehis\Desktop\Рабочие доки\Фичебот`
4. Нажмите "Publish repository"
5. Выберите `npopova90/feature_bot` и нажмите "Publish"

## Важно!

- Убедитесь, что файл `.env` НЕ попадет в репозиторий (он уже в `.gitignore`)
- При первом push может потребоваться авторизация GitHub
- Если репозиторий уже существует с файлами, может потребоваться `git pull` перед push

## Проверка после push

Откройте https://github.com/npopova90/feature_bot и убедитесь, что все файлы загружены.
