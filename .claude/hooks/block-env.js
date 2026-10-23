// PreToolUse hook: bloquea cualquier herramienta o comando que mencione el archivo .env
// (se permite .env.example). Sale con código 2 para que Claude Code rechace la llamada.
let input = '';
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  let toolInput = {};
  try {
    toolInput = JSON.parse(input).tool_input || {};
  } catch {
    process.exit(0);
  }
  const text = JSON.stringify(toolInput);
  // ".env" como nombre de archivo suelto, no ".env.example" ni ".envrc"
  if (/(^|[^\w.-])\.env(?![\w.-])/i.test(text)) {
    process.stderr.write('Bloqueado: el archivo .env contiene secretos y Claude no puede leerlo ni tocarlo.');
    process.exit(2);
  }
  process.exit(0);
});
