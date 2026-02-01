/**
 * Obtain Dataverse access token via Azure AD Client Credentials flow.
 * @see https://learn.microsoft.com/en-us/power-apps/developer/data-platform/authenticate-web-api#client-credentials-flow
 */

/**
 * Get OAuth2 access token for the given Dataverse org URL using client credentials.
 * @param {string} orgUrl - e.g. https://org08dc9606.crm4.dynamics.com
 * @param {string} clientId - Application (client) ID
 * @param {string} tenantId - Directory (tenant) ID
 * @param {string} clientSecret - Client secret
 * @returns {Promise<string>} access_token
 */
export async function getTokenWithClientCredentials(orgUrl, clientId, tenantId, clientSecret) {
  const baseUrl = orgUrl.replace(/\/$/, '');
  const scope = `${baseUrl}/.default`;
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope,
  });

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token request failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error('Token response missing access_token');
  }
  return data.access_token;
}
