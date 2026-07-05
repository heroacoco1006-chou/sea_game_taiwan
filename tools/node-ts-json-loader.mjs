// Node 24 測試 loader：讓工具直接載入 Vite 專案的 TS、JSON 與 ?raw Markdown。
import { readFile } from 'node:fs/promises';
import { access } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

export async function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith('?raw')) {
    return { url: new URL(specifier, context.parentURL).href, shortCircuit: true };
  }
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (specifier.startsWith('.') && !specifier.match(/\.[a-z0-9]+$/i)) {
      const candidate = new URL(specifier + '.ts', context.parentURL);
      try {
        await access(candidate);
        return { url: candidate.href, shortCircuit: true };
      } catch {}
    }
    throw error;
  }
}

export async function load(url, context, nextLoad) {
  const parsed = new URL(url);
  if (parsed.search === '?raw') {
    parsed.search = '';
    const source = await readFile(parsed, 'utf8');
    return { format: 'module', source: 'export default ' + JSON.stringify(source) + ';', shortCircuit: true };
  }
  if (parsed.pathname.endsWith('.json')) {
    const source = await readFile(parsed, 'utf8');
    return { format: 'module', source: 'export default ' + source.trim() + ';', shortCircuit: true };
  }
  if (parsed.pathname.endsWith('.ts')) {
    const source = await readFile(parsed, 'utf8');
    return { format: 'module', source: stripTypeScriptTypes(source, { mode: 'transform' }), shortCircuit: true };
  }
  return nextLoad(url, context);
}