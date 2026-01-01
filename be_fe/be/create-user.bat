@echo off
echo Creating admin user...
curl -X POST http://localhost:5000/api/users -H "Content-Type: application/json" -d "{\"name\":\"Admin\",\"email\":\"admin@smarthome.com\",\"password\":\"admin123\"}"
echo.
echo.
echo Done!
pause
