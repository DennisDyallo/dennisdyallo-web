const knownRoutes = new Map<string, string>([
  ['about', '/about'],
  ['now', '/now'],
  ['coaching', '/coaching'],
  ['engineering', '/dev'],
  ['dev', '/dev'],
  ['music', '/music'],
  ['projects', '/projects'],
  ['writing', '/blog'],
  ['blog', '/blog'],
  ['the convergence node', '/blog/hello-blog'],
]);

function routeFor(label: string) {
  return knownRoutes.get(label.trim().toLowerCase());
}

function splitWikilinks(value: string) {
  const parts = [];
  const pattern = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  let cursor = 0;
  let match;

  while ((match = pattern.exec(value))) {
    if (match.index > cursor) {
      parts.push({ type: 'text', value: value.slice(cursor, match.index) });
    }

    const target = match[1].trim();
    const label = (match[2] || target).trim();
    const href = routeFor(target);

    if (href) {
      parts.push({
        type: 'link',
        url: href,
        title: null,
        children: [{ type: 'text', value: label }],
      });
    } else {
      parts.push({ type: 'text', value: label });
    }

    cursor = match.index + match[0].length;
  }

  if (cursor < value.length) {
    parts.push({ type: 'text', value: value.slice(cursor) });
  }

  return parts;
}

function visit(node: any) {
  if (!node || typeof node !== 'object') return;

  if (Array.isArray(node.children)) {
    const nextChildren = [];
    for (const child of node.children) {
      if (child.type === 'text' && typeof child.value === 'string' && child.value.includes('[[')) {
        nextChildren.push(...splitWikilinks(child.value));
      } else {
        visit(child);
        nextChildren.push(child);
      }
    }
    node.children = nextChildren;
    return;
  }

  visit(node.children);
}

export default function remarkWikilinks() {
  return (tree: any) => visit(tree);
}
