@echo off
REM Set up environment variables for Vulkan SDK
set VULKAN_SDK=%CD%\vulkan-sdk
set VK_SDK_PATH=%CD%\vulkan-sdk
set CMAKE_ROOT=%CD%\cmake
set PATH=%CMAKE_ROOT%\bin;%PATH%

echo Vulkan SDK setup complete!
echo VULKAN_SDK: %VULKAN_SDK%
echo VK_SDK_PATH: %VK_SDK_PATH%
echo.
echo You can now run: bun tauri dev