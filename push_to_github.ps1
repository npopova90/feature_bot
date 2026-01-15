# PowerShell скрипт для push в GitHub
# Запустите: .\push_to_github.ps1

Write-Host "Проверка Git..." -ForegroundColor Yellow

# Проверка наличия Git
try {
    $gitVersion = git --version
    Write-Host "Git найден: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "ОШИБКА: Git не установлен!" -ForegroundColor Red
    Write-Host "Установите Git с https://git-scm.com/download/win" -ForegroundColor Yellow
    exit 1
}

# Проверка инициализации репозитория
if (-not (Test-Path .git)) {
    Write-Host "Инициализация Git репозитория..." -ForegroundColor Yellow
    git init
}

# Проверка remote
$remoteExists = git remote get-url origin 2>$null
if (-not $remoteExists) {
    Write-Host "Добавление remote репозитория..." -ForegroundColor Yellow
    git remote add origin https://github.com/npopova90/feature_bot.git
} else {
    Write-Host "Remote уже настроен: $remoteExists" -ForegroundColor Green
}

# Добавление файлов
Write-Host "Добавление файлов..." -ForegroundColor Yellow
git add .

# Проверка статуса
$status = git status --short
if ($status) {
    Write-Host "Изменения для коммита:" -ForegroundColor Cyan
    Write-Host $status
    
    # Коммит
    Write-Host "`nСоздание коммита..." -ForegroundColor Yellow
    git commit -m "Initial commit: Telegram bot for feature test summaries with GPT-5.2"
    
    # Переименование ветки в main
    Write-Host "Настройка ветки main..." -ForegroundColor Yellow
    git branch -M main
    
    # Push
    Write-Host "`nPush в GitHub..." -ForegroundColor Yellow
    Write-Host "ВНИМАНИЕ: Вам может потребоваться ввести учетные данные GitHub" -ForegroundColor Cyan
    git push -u origin main
    
    Write-Host "`nГотово! Код успешно запушен в GitHub." -ForegroundColor Green
} else {
    Write-Host "Нет изменений для коммита." -ForegroundColor Yellow
}
