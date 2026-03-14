 # 1. Remova a extensão instalada para limpar o cache
EXT_ID=$(code --list-extensions | grep -E '(^|\.)context-bridge$' | head -n 1)
if [ -n "$EXT_ID" ]; then
	code --uninstall-extension "$EXT_ID"
fi

# 2. Delete o VSIX antigo e a pasta out
rm -f ./*.vsix && rm -rf out

# 3. Recompile e empacote (garanta que o package.json está salvo com o 'contributes')
npm run compile && vsce package --allow-missing-repository

# 4. Instale novamente
VSIX_FILE=$(ls -t context-bridge-*.vsix 2>/dev/null | head -n 1)
if [ -n "$VSIX_FILE" ]; then
	code --install-extension "$VSIX_FILE"
else
	echo "Nenhum VSIX encontrado para instalar."
	exit 1
fi