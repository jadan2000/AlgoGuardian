@echo off
REM ================================================================================
REM JIBU FX - Frontend Configuration Switcher
REM Quick way to switch between Bot A and Bot B frontend configurations
REM ================================================================================

cd algo-guardian-main || (
    echo Error: algo-guardian-main folder not found
    exit /b 1
)

echo.
echo ╔══════════════════════════════════════════════════════════════════════════╗
echo ║       JIBU FX - Frontend Bot Configuration Switcher                      ║
echo ╚══════════════════════════════════════════════════════════════════════════╝
echo.

if "%1"=="" (
    echo Usage: switch-frontend-bot.bat [a^|b]
    echo.
    echo Examples:
    echo   switch-frontend-bot.bat a    : Switch to Bot A frontend (port 3000)
    echo   switch-frontend-bot.bat b    : Switch to Bot B frontend (port 3000)
    echo.
    goto end
)

if /i "%1"=="a" (
    echo Switching frontend to BOT A...
    (
        echo # Bot A Frontend Configuration
        echo # Calls backend on port 8001
        echo VITE_API_URL=http://${API_BASE}
    ) > .env
    echo ✓ Frontend configured for BOT A
    echo.
    echo Next: Run: npm run dev
    echo Frontend port: 3000
    echo Backend port: 8001
    goto end
)

if /i "%1"=="b" (
    echo Switching frontend to BOT B...
    (
        echo # Bot B Frontend Configuration
        echo # Calls backend on port 8001
        echo VITE_API_URL=http://${API_BASE}
    ) > .env
    echo ✓ Frontend configured for BOT B
    echo.
    echo Next: Run: npm run dev
    echo Frontend port: 3000
    echo Backend port: 8001
    goto end
)

echo Unknown option: %1
echo Use: switch-frontend-bot.bat [a^|b]

:end
echo.
cd ..
