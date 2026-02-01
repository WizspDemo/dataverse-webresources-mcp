/**
 * Dataverse Web Resource types (WebResourceType option set).
 * @see https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/webresource#webresourcetype-choicesoptions
 */
export const WEB_RESOURCE_TYPES = {
  1: 'Webpage (HTML)',
  2: 'Style Sheet (CSS)',
  3: 'Script (JScript)',
  4: 'Data (XML)',
  5: 'PNG format',
  6: 'JPG format',
  7: 'GIF format',
  8: 'Silverlight (XAP)',
  9: 'Style Sheet (XSL)',
  10: 'ICO format',
  11: 'Vector format (SVG)',
  12: 'String (RESX)',
};

const EXTENSION_TO_TYPE = {
  '.html': 1,
  '.htm': 1,
  '.css': 2,
  '.js': 3,
  '.xml': 4,
  '.png': 5,
  '.jpg': 6,
  '.jpeg': 6,
  '.gif': 7,
  '.xap': 8,
  '.xsl': 9,
  '.xslt': 9,
  '.ico': 10,
  '.svg': 11,
  '.resx': 12,
};

/**
 * Get WebResourceType (1-12) from file extension.
 */
export function getWebResourceTypeFromPath(filePath) {
  const ext = filePath.replace(/^.*\./, '').toLowerCase();
  const key = ext ? `.${ext}` : '';
  const type = EXTENSION_TO_TYPE[key];
  if (type == null) {
    throw new Error(
      `Unsupported extension for web resource: ${ext || '(none)'}. Supported: ${Object.keys(EXTENSION_TO_TYPE).join(', ')}`
    );
  }
  return type;
}

/**
 * Derive web resource name from file path (e.g. folder/sub/file.js).
 * Name must use only letters, numbers, periods, and nonconsecutive forward slashes (per Microsoft Docs).
 */
export function pathToWebResourceName(filePath, prefix = '') {
  let normalized = filePath.replace(/\\/g, '/').replace(/^\//, '').replace(/\/+/g, '/');
  const name = prefix ? `${prefix}_${normalized}` : normalized;
  if (!/^[a-zA-Z0-9._/]+$/.test(name) || /\/\//.test(name)) {
    throw new Error(
      `Invalid web resource name: ${name}. Use only letters, numbers, periods, and nonconsecutive slashes.`
    );
  }
  return name;
}
