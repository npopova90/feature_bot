@echo off
echo ========================================
echo Push в GitHub репозиторий
echo ========================================
echo.

REM Проверка наличия Git
where git >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ОШИБКА] Git не установлен!
    echo.
    echo Установите Git с https://git-scm.com/download/win
    echo Или используйте GitHub Desktop: https://desktop.github.com/
    pause
    exit /b 1
)

echo [OK] Git найден
git --version
echo.

REM Проверка инициализации репозитория
if not exist .git (
    echo [ИНИЦИАЛИЗАЦИЯ] Создание Git репозитория...
    git init
    echo.
)

REM Проверка remote
git remote get-url origin >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [НАСТРОЙКА] Добавление remote репозитория...
    git remote add origin https://github.com/npopova90/feature_bot.git
    echo.
) else (
    echo [OK] Remote уже настроен
    git remote get-url origin
    echo.
)

REM Добавление файлов
echo [ДОБАВЛЕНИЕ] Добавление файлов в staging...
git add .
echo.

REM Проверка статуса
echo [СТАТУС] Текущий статус:
git status --short
echo.

REM Коммит
echo [КОММИТ] Создание коммита...
git commit -m "Initial commit: Telegram bot for feature test summaries with GPT-5.2"
if %ERRORLEVEL% NEQ 0 (
    echo [ПРЕДУПРЕЖДЕНИЕ] Коммит не создан (возможно, нет изменений)
) else (
    echo [OK] Коммит создан
)
echo.

REM Переименование ветки
echo [ВЕТКА] Настройка ветки main...
git branch -M main
echo.

REM Push
echo [PUSH] Отправка в GitHub...
echo ВНИМАНИЕ: Вам может потребоваться ввести учетные данные GitHub
echo.
git push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo [УСПЕХ] Код успешно запушен в GitHub!
    echo ========================================
) else (
    echo.
    echo ========================================
    echo [ОШИБКА] Push не удался
    echo ========================================
    echo.
    echo Возможные причины:
    echo 1. Неверные учетные данные GitHub
    echo 2. Репозиторий не существует или нет доступа
    echo 3. Нужно сначала сделать git pull
    echo.
)

pause
