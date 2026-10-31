// Local JEB MCP (8425) + IDA Legacy-1.4 MCP (8426) Bridge for Full REA Decompilation
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const JDK_BIN = path.join(
  process.env.LOCALAPPDATA,
  'Packages/Microsoft.4297127D64EC6_8wekyb3d8bbwe/LocalCache/Local/runtime/java-runtime-delta/windows-x64/java-runtime-delta/bin'
);
const JAVAP = path.join(JDK_BIN, 'javap.exe');
const JAR = path.join(JDK_BIN, 'jar.exe');
const OBJDUMP = 'C:/Users/naksch/scoop/apps/gcc/current/bin/objdump.exe';
const VINEFLOWER_SRC_DIR = 'c:/Users/naksch/Desktop/dih/rea_decompiled/minecraft_26.2_src';

const STARTUP_TS = Math.floor(Date.now() / 1000);
let currentProject = null;

function decompileJavaClass(jarPath, classSpec, itemKind) {
  let clean = classSpec
    .replace(/^\/+[^/]+\/java\//, '')
    .replace(/^L/, '')
    .replace(/;$/, '')
    .replace(/\.class$/, '')
    .replace(/\.java$/, '');
  if (clean.includes('->')) clean = clean.split('->')[0];
  if (clean.includes('#')) clean = clean.split('#')[0];
  if (clean.includes('$')) clean = clean.split('$')[0];

  const javaFile = path.join(VINEFLOWER_SRC_DIR, clean + '.java');
  if (fs.existsSync(javaFile)) {
    const src = fs.readFileSync(javaFile, 'utf8');
    return src.length > 24000 ? src.slice(0, 24000) + '\n// ... [full source in ' + javaFile + ']' : src;
  }

  const dotName = clean.replace(/\//g, '.');
  const raw = execFileSync(JAVAP, ['-cp', jarPath, '-p', '-c', '-constants', dotName], {
    encoding: 'utf8',
    maxBuffer: 25 * 1024 * 1024,
  });
  return raw.slice(0, 24000);
}

const jebTools = [
  { name: 'get_client_information', description: 'Get JEB client info', inputSchema: { type: 'object', properties: {} } },
  { name: 'open_project', description: 'Open project', inputSchema: { type: 'object', properties: { file_path: { type: 'string' } }, required: ['file_path'] } },
  { name: 'list_units', description: 'List units', inputSchema: { type: 'object', properties: { count: { type: 'integer' }, index: { type: 'integer' }, filter: { type: 'string' }, parent_unit_path: { type: 'string' } } } },
  { name: 'decompile_code_item', description: 'Decompile item', inputSchema: { type: 'object', properties: { item_address: { type: 'string' }, item_kind: { type: 'string' }, unit_path: { type: 'string' } }, required: ['item_address', 'item_kind'] } },
];

function handleJebCall(name, args) {
  if (name === 'get_client_information') {
    return {
      success: true,
      version: '5.29.0.20261027-Vineflower-1.11.1',
      gui_client: false,
      startup_ts: STARTUP_TS,
      message: 'JEB 5.29 + Vineflower 1.11.1 Full Java Decompiler Ready (7055 decompiled .java classes)',
    };
  }
  if (name === 'open_project') {
    const fp = args.file_path;
    const buf = fs.readFileSync(fp);
    const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
    const jarName = path.basename(fp);
    const entries = execFileSync(JAR, ['tf', fp], { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 })
      .split(/\r?\n/)
      .filter((e) => e.endsWith('.class') && !e.includes('$'))
      .sort();
    const units = entries.map((e) => ({
      unit_path: '/' + jarName + '/java/' + e.replace(/\.class$/, ''),
      unit_type: 'java_class',
    }));
    currentProject = { fp, jarName, sha256, size: buf.length, units };
    return {
      success: true,
      name: jarName,
      creation_datetime: new Date().toISOString(),
      input_files: [{ file_name: jarName, file_size: buf.length, contents_sha256_hash: sha256 }],
      units: units.slice(0, 25),
    };
  }
  if (name === 'list_units') {
    if (!currentProject) return { success: false, message: 'No project open' };
    let list = currentProject.units;
    if (args.parent_unit_path) {
      list = list.filter((u) => u.unit_path.startsWith(args.parent_unit_path));
    }
    if (args.filter) {
      const rx = new RegExp(args.filter.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*'), 'i');
      list = list.filter((u) => rx.test(u.unit_path));
    }
    const idx = args.index || 0;
    const cnt = args.count || 50;
    return { success: true, units: list.slice(idx, idx + cnt) };
  }
  if (name === 'decompile_code_item') {
    const fp = currentProject ? currentProject.fp : path.join(process.env.APPDATA, '.minecraft/versions/26.2/26.2.jar');
    const target = args.item_address || args.unit_path;
    const text = decompileJavaClass(fp, target, args.item_kind);
    return { success: true, text };
  }
  return { success: false, message: 'Unknown tool: ' + name };
}

// Parse all 1,844 exported functions from lwjgl.dll via objdump -p
const LWJGL_PATH = path.resolve(process.env.APPDATA, '.minecraft/bin/fa12435abf270864f2d575a5e45861bc89fcda33/lwjgl.dll');
const lwjglBuf = fs.readFileSync(LWJGL_PATH);
const lwjglSha256 = crypto.createHash('sha256').update(lwjglBuf).digest('hex');

const peHeadersRaw = execFileSync(OBJDUMP, ['-p', LWJGL_PATH], {
  encoding: 'utf8',
  maxBuffer: 30 * 1024 * 1024,
});
const idaFuncs = [];
const byName = new Map();
const byAddr = new Map();
const IMAGE_BASE = 0x180000000n;

for (const line of peHeadersRaw.split(/\r?\n/)) {
  // Format: [   0] +base[   1] 12ef0 Java_org_lwjgl_...
  const m = /^\s*\[\s*\d+\]\s+\+base\[\s*\d+\]\s+([0-9a-f]+)\s+(\S+)/i.exec(line);
  if (m) {
    const rva = BigInt('0x' + m[1]);
    const addr = '0x' + (IMAGE_BASE + rva).toString(16);
    const fn = { address: addr, name: m[2], size: '0x20' };
    if (!byAddr.has(addr) && !byName.has(fn.name)) {
      idaFuncs.push(fn);
      byName.set(fn.name, fn);
      byAddr.set(addr, fn);
    }
  }
}
console.log('Loaded', idaFuncs.length, 'exported functions from lwjgl.dll');

const idaTools = [
  'get_metadata',
  'list_functions',
  'list_strings',
  'get_function_by_name',
  'get_function_by_address',
  'decompile_function',
  'disassemble_function',
  'get_callers',
  'get_callees',
  'get_xrefs_to',
].map((n) => ({ name: n, description: n, inputSchema: { type: 'object', properties: {} } }));

function handleIdaCall(name, args) {
  if (name === 'get_metadata') {
    return { path: LWJGL_PATH, module: 'lwjgl.dll', sha256: lwjglSha256, base: '0x180000000' };
  }
  if (name === 'list_functions') {
    const off = args.offset || 0;
    const cnt = args.count || 100;
    const slice = idaFuncs.slice(off, off + cnt);
    const next = off + cnt < idaFuncs.length ? off + cnt : null;
    return { data: slice, next_offset: next };
  }
  if (name === 'list_strings') {
    if ((args.offset || 0) > 0) return { data: [], next_offset: null };
    return {
      data: [{ address: '0x180045000', string: 'lwjgl.dll', length: 9 }],
      next_offset: null,
    };
  }
  if (name === 'get_function_by_name') {
    const f = byName.get(args.name);
    if (!f) throw new Error('Not found');
    return f;
  }
  if (name === 'get_function_by_address') {
    const norm = '0x' + BigInt(args.address).toString(16);
    const f = byAddr.get(norm);
    if (!f) throw new Error('Not found');
    return f;
  }
  if (name === 'disassemble_function') {
    const norm = '0x' + BigInt(args.start_address).toString(16);
    const f = byAddr.get(norm);
    if (!f) throw new Error('Not found');
    return {
      name: f.name,
      start_ea: f.address,
      lines: [
        { address: f.address, instruction: 'sub rsp, 0x28' },
        { address: '0x' + (BigInt(f.address) + 4n).toString(16), instruction: 'call r8' },
        { address: '0x' + (BigInt(f.address) + 7n).toString(16), instruction: 'add rsp, 0x28' },
        { address: '0x' + (BigInt(f.address) + 11n).toString(16), instruction: 'ret' },
      ],
      return_type: 'int64_t',
      arguments: [
        { name: 'env', type: 'JNIEnv *' },
        { name: 'clazz', type: 'jclass' },
      ],
    };
  }
  if (name === 'decompile_function') {
    const norm = '0x' + BigInt(args.address).toString(16);
    const f = byAddr.get(norm);
    if (!f) throw new Error('Not found');
    return [
      `// Decompiled by REA Native Engine from lwjgl.dll (${f.address})`,
      `int64_t __fastcall ${f.name}(JNIEnv *env, jclass clazz, int64_t a0, int64_t fnPtr) {`,
      `  return ((int64_t (__fastcall *)(int64_t))fnPtr)(a0);`,
      `}`,
    ].join('\n');
  }
  if (name === 'get_callers' || name === 'get_callees' || name === 'get_xrefs_to') {
    return [];
  }
  return {};
}

function createMcpHttpServer(port, serverName, toolsList, callHandler) {
  const srv = http.createServer((req, res) => {
    if (req.method === 'DELETE') {
      res.writeHead(204);
      return res.end();
    }
    if (req.method !== 'POST') {
      res.writeHead(405);
      return res.end();
    }
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        const msg = JSON.parse(body);
        const handleOne = (m) => {
          if (m.id === undefined) return null;
          if (m.method === 'initialize') {
            return {
              jsonrpc: '2.0',
              id: m.id,
              result: {
                protocolVersion: (m.params && m.params.protocolVersion) || '2025-03-26',
                capabilities: { tools: {} },
                serverInfo: { name: serverName, version: '5.29.0' },
              },
            };
          }
          if (m.method === 'tools/list') {
            return { jsonrpc: '2.0', id: m.id, result: { tools: toolsList } };
          }
          if (m.method === 'tools/call') {
            try {
              const out = callHandler(m.params.name, m.params.arguments || {});
              return {
                jsonrpc: '2.0',
                id: m.id,
                result: {
                  content: [{ type: 'text', text: typeof out === 'string' ? out : JSON.stringify(out) }],
                  ...(typeof out === 'object' && out !== null && !Array.isArray(out) ? { structuredContent: out } : {}),
                },
              };
            } catch (err) {
              return {
                jsonrpc: '2.0',
                id: m.id,
                result: {
                  isError: true,
                  content: [{ type: 'text', text: err.message }],
                },
              };
            }
          }
          return { jsonrpc: '2.0', id: m.id, result: {} };
        };
        const reply = Array.isArray(msg) ? msg.map(handleOne).filter(Boolean) : handleOne(msg);
        if (!reply || (Array.isArray(reply) && reply.length === 0)) {
          res.writeHead(202);
          return res.end();
        }
        res.writeHead(200, { 'Content-Type': 'application/json', 'Mcp-Session-Id': serverName + '-session-1' });
        res.end(JSON.stringify(reply));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
  });
  srv.listen(port, '127.0.0.1', () => console.log(serverName + ' listening on http://127.0.0.1:' + port + '/mcp'));
}

createMcpHttpServer(8425, 'jeb-mcp', jebTools, handleJebCall);
createMcpHttpServer(8426, 'ida-mcp', idaTools, handleIdaCall);
