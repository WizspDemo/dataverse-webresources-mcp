/**
 * Dataverse Web API client for web resources and solution/publish actions.
 * @see https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/overview
 * @see https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/webresource
 */

import { getConfig } from './config.js';

const WEBRESOURCE_COMPONENT_TYPE = 61; // Web Resource solution component type

/**
 * @param {string} path
 * @param {string} [method]
 * @param {object} [body]
 * @param {Record<string, string>} [extraHeaders]
 */
async function api(path, method = 'GET', body = undefined, extraHeaders = {}) {
  const { webApiUrl, token } = await getConfig();
  const url = path.startsWith('http') ? path : `${webApiUrl}/${path}`;
  const headers = {
    'OData-MaxVersion': '4.0',
    'OData-Version': '4.0',
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...extraHeaders,
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    let errMsg = `Dataverse API ${res.status}: ${text}`;
    try {
      const json = JSON.parse(text);
      if (json.error?.message) errMsg = json.error.message;
    } catch (_) {}
    throw new Error(errMsg);
  }

  if (res.status === 204 || res.headers.get('Content-Length') === '0') {
    return null;
  }
  return res.json();
}

/**
 * Create a web resource. Optionally add to a solution via AddSolutionComponent.
 * @see https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/create-entity-web-api
 * @see https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/sample-import-files-web-resources
 */
export async function createWebResource({
  name,
  contentBase64,
  webResourceType,
  displayName = name,
  description = '',
  solutionUniqueName = null,
}) {
  const body = {
    name,
    content: contentBase64,
    webresourcetype: webResourceType,
    displayname: displayName,
    description: description || undefined,
  };

  const { webApiUrl, token } = await getConfig();
  const url = `${webApiUrl}/webresourceset`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Create web resource failed: ${res.status} ${text}`);
  }
  const created = res.status !== 204 ? await res.json() : null;
  let id = created?.webresourceid;
  if (!id) {
    const entityId = res.headers.get('OData-EntityId');
    if (entityId) {
      const m = entityId.match(/\(([a-fA-F0-9-]{36})\)$/);
      if (m) id = m[1];
    }
  }

  if (solutionUniqueName && id) {
    await addSolutionComponent(id, WEBRESOURCE_COMPONENT_TYPE, solutionUniqueName);
  }

  return { id, ...(created || {}) };
}

/**
 * Update an existing web resource (e.g. content). Publish required after update.
 * @see https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/update-delete-entities-using-web-api
 */
export async function updateWebResource(webResourceId, { contentBase64, displayName, description }) {
  const body = {};
  if (contentBase64 != null) body.content = contentBase64;
  if (displayName != null) body.displayname = displayName;
  if (description != null) body.description = description;
  if (Object.keys(body).length === 0) {
    throw new Error('Nothing to update. Provide at least one of: content, displayName, description.');
  }

  await api(`webresourceset(${webResourceId})`, 'PATCH', body, { 'If-Match': '*' });
  return { id: webResourceId };
}

/**
 * Delete a web resource.
 * @see https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/update-delete-entities-using-web-api#basic-delete
 */
export async function deleteWebResource(webResourceId) {
  await api(`webresourceset(${webResourceId})`, 'DELETE', undefined, { 'If-Match': '*' });
  return { id: webResourceId };
}

/**
 * Retrieve a single web resource by ID or by name (query).
 */
export async function getWebResource(idOrName) {
  const guidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (guidRegex.test(idOrName)) {
    const data = await api(
      `webresourceset(${idOrName})?$select=webresourceid,name,displayname,webresourcetype,description`
    );
    return data;
  }
  const filter = `name eq '${idOrName.replace(/'/g, "''")}'`;
  const list = await api(
    `webresourceset?$filter=${encodeURIComponent(filter)}&$select=webresourceid,name,displayname,webresourcetype,description`
  );
  const rows = list?.value ?? [];
  if (rows.length === 0) return null;
  return rows[0];
}

/**
 * List web resources, optionally filtered by solution.
 * When solution is set, uses solutioncomponent table (componenttype 61 = web resource) so we get only web resources that belong to that solution.
 * @see https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/query-data-web-api
 */
export async function listWebResources(solutionUniqueName = null) {
  if (solutionUniqueName) {
    const solutionId = await getSolutionId(solutionUniqueName);
    const componentIds = await getSolutionComponentIds(solutionId, WEBRESOURCE_COMPONENT_TYPE);
    if (componentIds.length === 0) return [];
    return getWebResourcesByIds(componentIds);
  }
  const path =
    'webresourceset?$select=webresourceid,name,displayname,webresourcetype,description&$orderby=name';
  const data = await api(path);
  return data?.value ?? [];
}

async function getSolutionId(uniqueName) {
  const data = await api(
    `solutions?$filter=uniquename eq '${uniqueName.replace(/'/g, "''")}'&$select=solutionid`
  );
  const rows = data?.value ?? [];
  if (rows.length === 0) throw new Error(`Solution not found: ${uniqueName}`);
  return rows[0].solutionid;
}

/** Get objectid (e.g. webresourceid) for all solution components of given type in a solution. */
async function getSolutionComponentIds(solutionId, componentType) {
  const path = `solutioncomponents?$filter=_solutionid_value eq ${solutionId} and componenttype eq ${componentType}&$select=objectid`;
  const data = await api(path);
  const rows = data?.value ?? [];
  return rows.map((r) => r.objectid).filter(Boolean);
}

/** Fetch web resource records by ids (batched filter to avoid URL length limits). */
async function getWebResourcesByIds(ids) {
  const BATCH = 50;
  const result = [];
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const filter = batch.map((id) => `webresourceid eq ${id}`).join(' or ');
    const path = `webresourceset?$filter=${encodeURIComponent(filter)}&$select=webresourceid,name,displayname,webresourcetype,description&$orderby=name`;
    const data = await api(path);
    const rows = data?.value ?? [];
    result.push(...rows);
  }
  result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  return result;
}

/**
 * Add solution component (e.g. web resource) to an unmanaged solution.
 * @see https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/reference/addsolutioncomponent
 */
async function addSolutionComponent(componentId, componentType, solutionUniqueName) {
  const { webApiUrl, token } = await getConfig();
  const url = `${webApiUrl}/AddSolutionComponent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ComponentId: componentId,
      ComponentType: componentType,
      SolutionUniqueName: solutionUniqueName,
      AddRequiredComponents: false,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AddSolutionComponent failed: ${res.status} ${text}`);
  }
  return res.json();
}

/**
 * Publish all customizations (required after updating web resources).
 * @see https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/publish-customizations
 * @see https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/reference/publishallxml
 */
export async function publishAll() {
  const { webApiUrl, token } = await getConfig();
  const url = `${webApiUrl}/PublishAllXml`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PublishAllXml failed: ${res.status} ${text}`);
  }
  return null;
}
