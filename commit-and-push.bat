@echo off
echo Committing encryption fixes...
git add dashboard.js dashboard.html fresh-start.html debug-encryption-keys.html
git commit -m "Fix encryption consistency: implement deterministic key generation v2

- Replace random key generation with deterministic keys based on chatId + salt
- Add version control (v2) to force regeneration of old random keys  
- Implement automatic cleanup of old inconsistent keys
- Add enhanced logging and error recovery
- Update cache-busting version to v=8
- Create debug tools for key management

This ensures all users in same chat generate identical encryption keys,
resolving the issue where messages appeared encrypted for some users."

echo Pushing to flowsec-chat-file-encrypted branch...
git push origin flowsec-chat-file-encrypted

echo Done! Check GitHub to verify the push was successful.
pause