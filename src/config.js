/**
 * Configuration from environment.
 * Either:
 *   - DATAVERSE_URL + DATAVERSE_ACCESS_TOKEN, or
 *   - DATAVERSE_URL + AZURE_CLIENT_ID + AZURE_TENANT_ID + AZURE_CLIENT_SECRET (client credentials flow).
 */
const DEFAULT_API_VERSION = 'v9.2';

export async function getConfig() {
  const url = process.env.DATAVERSE_URL;

  if (!url) {
    throw new Error(
      'Missing DATAVERSE_URL. Set it to your org URL (e.g. https://yourorg.crm4.dynamics.com)'
    );
  }

  let token = process.env.DATAVERSE_ACCESS_TOKEN;
  if (!token) {
    const clientId = process.env.AZURE_CLIENT_ID;
    const tenantId = process.env.AZURE_TENANT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;
    if (clientId && tenantId && clientSecret) {
      const { getTokenWithClientCredentials } = await import('./auth.js');
      token = await getTokenWithClientCredentials(url, clientId, tenantId, clientSecret);
    } else {
      throw new Error(
        'Missing auth. Set either DATAVERSE_ACCESS_TOKEN or (AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_CLIENT_SECRET).'
      );
    }
  }

  const baseUrl = url.replace(/\/$/, '');
  const apiVersion = process.env.DATAVERSE_API_VERSION || DEFAULT_API_VERSION;
  const webApiUrl = `${baseUrl}/api/data/${apiVersion}`;

  return { baseUrl, webApiUrl, token, apiVersion };
}
