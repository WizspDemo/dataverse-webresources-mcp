/**
 * MCP server for Dataverse web resources - HTTP/Streamable transport (online).
 * Config from env: DATAVERSE_URL, DATAVERSE_ACCESS_TOKEN or AZURE_CLIENT_ID/AZURE_TENANT_ID/AZURE_CLIENT_SECRET.
 * Binds to PORT (default 3000), suitable for Coolify/Docker deployment.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { z } from 'zod';
import { readFile } from 'fs/promises';
import { pathToFileURL } from 'url';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const {
  listWebResources,
  createWebResource,
  updateWebResource,
  deleteWebResource,
  getWebResource,
  publishAll,
} = await import(pathToFileURL(resolve(__dirname, 'src/dataverse-client.js')).href);

const { getWebResourceTypeFromPath, pathToWebResourceName } = await import(
  pathToFileURL(resolve(__dirname, 'src/webresource-types.js')).href
);

function getServer() {
  const server = new McpServer({
    name: 'dataverse-webresources',
    version: '1.0.0',
  });

  function textContent(text) {
    return { content: [{ type: 'text', text }] };
  }

  server.tool(
    'list_web_resources',
    'List Dataverse web resources, optionally filtered by solution unique name.',
    { solution: z.string().optional().describe('Solution unique name to filter by') },
    async ({ solution }) => {
      try {
        const list = await listWebResources(solution || null);
        return textContent(JSON.stringify(list, null, 2));
      } catch (err) {
        console.error(err);
        return { ...textContent(err.message), isError: true };
      }
    }
  );

  server.tool(
    'upload_web_resource',
    'Upload a new web resource. Provide file_path, content (UTF-8 text, recommended for Greek/Unicode), or content_base64 with name.',
    {
      file_path: z.string().optional().describe('Path to file on disk (server-side)'),
      content: z.string().optional().describe('Raw text content (UTF-8). Use for Greek/Unicode to avoid encoding issues.'),
      content_base64: z.string().optional().describe('Base64-encoded content'),
      name: z.string().optional().describe('Web resource name (required if using content or content_base64)'),
      solution: z.string().optional().describe('Solution unique name to add the resource to'),
      display_name: z.string().optional().describe('Display name'),
      web_resource_type: z.number().min(1).max(12).optional().describe('WebResourceType 1–12'),
    },
    async (raw) => {
      try {
        let contentBase64 = raw.content_base64;
        let resourceName = raw.name;
        let webResourceType = raw.web_resource_type;
        const solution = raw.solution || null;
        const displayName = raw.display_name;

        if (raw.file_path) {
          const buf = await readFile(resolve(raw.file_path));
          contentBase64 = buf.toString('base64');
          if (!resourceName) resourceName = pathToWebResourceName(raw.file_path);
          if (webResourceType == null) webResourceType = getWebResourceTypeFromPath(raw.file_path);
        } else if (raw.content != null) {
          contentBase64 = Buffer.from(raw.content, 'utf8').toString('base64');
        }
        if (!contentBase64 || !resourceName) {
          return { ...textContent('Error: provide file_path, or both content/content_base64 and name.'), isError: true };
        }
        if (webResourceType == null) webResourceType = 3;

        const result = await createWebResource({
          name: resourceName,
          contentBase64,
          webResourceType,
          displayName: displayName || resourceName,
          description: '',
          solutionUniqueName: solution,
        });
        return textContent(JSON.stringify(result, null, 2));
      } catch (err) {
        console.error(err);
        return { ...textContent(err.message), isError: true };
      }
    }
  );

  server.tool(
    'update_web_resource',
    'Update an existing web resource by ID or name. Provide new content via file_path, content (UTF-8 text), or content_base64.',
    {
      name_or_id: z.string().describe('Web resource logical name or GUID'),
      file_path: z.string().optional().describe('Path to new file content'),
      content: z.string().optional().describe('Raw text content (UTF-8). Use for Greek/Unicode to avoid encoding issues.'),
      content_base64: z.string().optional().describe('New content as base64'),
    },
    async (raw) => {
      try {
        const nameOrId = raw.name_or_id;
        if (!nameOrId) return { ...textContent('Error: name_or_id is required.'), isError: true };
        const rec = await getWebResource(nameOrId);
        if (!rec) return { ...textContent(`Error: web resource not found: ${nameOrId}`), isError: true };
        const id = rec.webresourceid;

        let contentBase64 = raw.content_base64;
        if (raw.file_path) {
          const buf = await readFile(resolve(raw.file_path));
          contentBase64 = buf.toString('base64');
        } else if (raw.content != null) {
          contentBase64 = Buffer.from(raw.content, 'utf8').toString('base64');
        }
        if (!contentBase64) return { ...textContent('Error: provide file_path, content, or content_base64.'), isError: true };
        await updateWebResource(id, { contentBase64 });
        return textContent(JSON.stringify({ id, updated: true }));
      } catch (err) {
        console.error(err);
        return { ...textContent(err.message), isError: true };
      }
    }
  );

  server.tool(
    'delete_web_resource',
    'Delete a web resource by ID or logical name.',
    { name_or_id: z.string().describe('Web resource logical name or GUID') },
    async (raw) => {
      try {
        const nameOrId = raw.name_or_id;
        if (!nameOrId) return { ...textContent('Error: name_or_id is required.'), isError: true };
        const rec = await getWebResource(nameOrId);
        if (!rec) return { ...textContent(`Error: web resource not found: ${nameOrId}`), isError: true };
        await deleteWebResource(rec.webresourceid);
        return textContent(JSON.stringify({ id: rec.webresourceid, deleted: true }));
      } catch (err) {
        console.error(err);
        return { ...textContent(err.message), isError: true };
      }
    }
  );

  server.tool('publish_all', 'Publish all customizations (required after updating web resources).', {}, async () => {
    try {
      await publishAll();
      return textContent('Publish all completed.');
    } catch (err) {
      console.error(err);
      return { ...textContent(err.message), isError: true };
    }
  });

  return server;
}

// ALLOWED_HOSTS: comma-separated (e.g. "mcp.example.com,localhost") – suppresses DNS rebinding warning
const allowedHosts = process.env.ALLOWED_HOSTS
  ? process.env.ALLOWED_HOSTS.split(',').map((h) => h.trim()).filter(Boolean)
  : undefined;
const app = createMcpExpressApp({ host: '0.0.0.0', allowedHosts });

app.post('/mcp', async (req, res) => {
  const server = getServer();
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless – one transport per request
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on('close', () => {
      transport.close();
      server.close();
    });
  } catch (error) {
    console.error('Error handling MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
});

app.get('/mcp', (req, res) => {
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed. Stateless mode does not support GET.' },
    id: null,
  });
});

app.delete('/mcp', (req, res) => {
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed.' },
    id: null,
  });
});

// Health check for Coolify/load balancers
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'dataverse-webresources-mcp' });
});

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, (err) => {
  if (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
  console.error(`Dataverse web resources MCP (HTTP) listening on http://${HOST}:${PORT}/mcp`);
});

process.on('SIGINT', () => {
  console.error('Shutting down...');
  process.exit(0);
});
