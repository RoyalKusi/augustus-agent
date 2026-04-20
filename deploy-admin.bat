@echo off
REM Deploy Admin Dashboard UI Updates
REM This script builds the admin dashboard and prepares it for deployment

echo.
echo 🚀 Augustus Admin Dashboard Deployment
echo ======================================
echo.

REM Check if we're in the right directory
if not exist "package.json" (
    echo ❌ Error: Must run from augustus root directory
    exit /b 1
)

echo 📦 Step 1: Installing dependencies...
cd packages\admin-dashboard
call npm install

echo.
echo 🔨 Step 2: Building admin dashboard...
call npm run build

echo.
echo ✅ Build complete!
echo.
echo 📁 Built files location:
echo    packages\admin-dashboard\dist\
echo.
echo 📤 Next steps:
echo    1. Upload packages\admin-dashboard\dist\ to Hostinger
echo    2. Overwrite existing files at packages\admin-dashboard\dist\
echo    3. Restart Node.js app on Hostinger
echo    4. Clear browser cache and test
echo.
echo 🌐 Test URLs:
echo    - https://augustus.silverconne.com/admin-app/admin/referral-commission
echo    - https://augustus.silverconne.com/admin-app/admin/notifications
echo.
echo 📖 For detailed instructions, see: DEPLOY_ADMIN_UI.md
echo.
pause
