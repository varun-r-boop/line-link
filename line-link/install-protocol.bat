@echo off
echo Registering line-link protocol handler...

reg add "HKEY_CLASSES_ROOT\line-link" /ve /d "URL:Line Link Protocol" /f
reg add "HKEY_CLASSES_ROOT\line-link" /v "URL Protocol" /t REG_SZ /d "" /f
reg add "HKEY_CLASSES_ROOT\line-link\shell\open\command" /ve /d "\"code\" --open-url \"%1\"" /f

echo.
echo Protocol handler registered successfully!
echo.
pause
