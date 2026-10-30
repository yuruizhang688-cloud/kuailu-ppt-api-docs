const container = document.querySelector('#connection');
const status = document.querySelector('#connection-status');
const button = document.querySelector('#refresh-connection');
const replacements = [];
const walker = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT);
while (walker.nextNode()) {
  if (walker.currentNode.textContent.includes('{API_BASE}')) replacements.push([walker.currentNode, walker.currentNode.textContent]);
}
async function refresh() {
  button.disabled = true;
  status.textContent = '正在读取最近登记的接口地址…';
  try {
    const address = new URL(container.dataset.discovery); address.searchParams.set('_', Date.now());
    const response = await fetch(address, { headers: { Accept: 'application/vnd.github.raw+json' }, cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Connection record unavailable');
    const record = await response.json();
    if (!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(record.base_url)) throw new Error('Invalid origin');
    for (const [node, original] of replacements) node.textContent = original.replaceAll('{API_BASE}', record.base_url);
    status.textContent = `最近登记的接口：${record.base_url}。地址更新于 ${new Date(record.updated_at).toLocaleString('zh-CN')}；此记录不代表实时在线状态。`;
  } catch {
    status.textContent = '暂时无法读取接口地址。文档仍可正常阅读；请稍后刷新，或打开连接信息 JSON。';
  } finally { button.disabled = false; }
}
button.addEventListener('click', refresh);
refresh();
