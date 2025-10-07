Write-Host "Checking git status..." -ForegroundColor Green
git status

Write-Host "`nAdding files..." -ForegroundColor Green
git add dashboard.js dashboard.html fresh-start.html debug-encryption-keys.html commit-and-push.bat

Write-Host "`nCommitting changes..." -ForegroundColor Green
git commit -m "Fix encryption consistency: implement deterministic key generation v2

- Replace random key generation with deterministic keys based on chatId + salt
- Add version control (v2) to force regeneration of old random keys  
- Implement automatic cleanup of old inconsistent keys
- Add enhanced logging and error recovery
- Update cache-busting version to v=8
- Create debug tools for key management

This ensures all users in same chat generate identical encryption keys,
resolving the issue where messages appeared encrypted for some users."

Write-Host "`nChecking current branch..." -ForegroundColor Green
git branch --show-current

Write-Host "`nPushing to GitHub..." -ForegroundColor Green
git push origin HEAD

Write-Host "`nDone! Check the output above for any errors." -ForegroundColor Yellow
Read-Host "Press Enter to continue"