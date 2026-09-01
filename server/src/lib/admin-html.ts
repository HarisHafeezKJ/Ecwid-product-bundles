import fs from 'node:fs';
import path from 'node:path';
import { getEcwidClientId } from './config.js';

const ECWID_SDK_URL = 'https://djqizrxa6f10j.cloudfront.net/ecwid-sdk/js/1.3.0/ecwid-app.js';

let cachedAdminIndexHtml: string | undefined;

function readAdminIndexHtml(adminDistPath: string): string {
  if (!cachedAdminIndexHtml) {
    cachedAdminIndexHtml = fs.readFileSync(path.join(adminDistPath, 'index.html'), 'utf8');
  }
  return cachedAdminIndexHtml;
}

/** Inject Ecwid native-app shell scripts required for Control Panel iframe embedding. */
export function buildEcwidAdminHtml(
  adminDistPath: string,
  options: { bootstrapToken?: string } = {},
): string {
  const clientId = getEcwidClientId();
  const html = readAdminIndexHtml(adminDistPath);
  const bootstrapJs = options.bootstrapToken
    ? `sessionStorage.setItem('pb_session_bootstrap',${JSON.stringify(options.bootstrapToken)});`
    : '';
  const injection = `
<script>
(function(){${bootstrapJs}
var u=new URL(location.href);u.searchParams.delete('payload');u.searchParams.delete('bootstrap');
history.replaceState({},'',u.pathname+(u.search||''));})();
</script>
<script src="${ECWID_SDK_URL}"></script>
<script>
EcwidApp.init({app_id:${JSON.stringify(clientId)},autoloadedflag:true,autoheight:true});
</script>`;
  return html.replace('<head>', `<head>${injection}`);
}
