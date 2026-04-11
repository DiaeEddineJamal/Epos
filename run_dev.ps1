$env:PATH="$env:USERPROFILE\.cargo\bin;$PSScriptRoot\cmake\bin;$env:PATH"
$env:VULKAN_SDK="$PSScriptRoot\vulkan-sdk"
$env:VK_SDK_PATH="$PSScriptRoot\vulkan-sdk"
Remove-Item Env:\CMAKE_ROOT -ErrorAction SilentlyContinue
npm run tauri:dev
