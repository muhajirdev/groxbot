export function mcpCallbackPage(webOrigin: string): string {
  const origin = JSON.stringify(webOrigin);
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Groxbot MCP</title></head>
  <body>
    <p>You can close this window.</p>
    <script>
      const params = new URLSearchParams(location.search);
      const payload = {
        type: "groxbot:mcp",
        ok: params.get("error") ? false : true,
      };
      if (window.opener) {
        window.opener.postMessage(payload, ${origin});
      }
      window.close();
    </script>
  </body>
</html>`;
}
