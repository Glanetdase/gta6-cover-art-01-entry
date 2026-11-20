// Vice Press — screenshot scenes: ?shot=editor|cover plus layout, grade,
// title, subtitle, size and badge parameters. The editor reads these on boot
// (see main.js); this module only parses the query string.

export function shotParams() {
  const q = new URLSearchParams(window.location.search);
  const out = { mode: q.get('shot') || 'editor' };
  const layout = q.get('layout');
  if (layout) out.layout = layout;
  const grade = q.get('grade');
  if (grade) out.grade = grade;
  const title = q.get('title');
  if (title) out.title = title;
  const subtitle = q.get('subtitle');
  if (subtitle !== null) out.subtitle = subtitle;
  const size = q.get('size');
  if (size) out.size = size;
  const badge = q.get('badge');
  if (badge) out.badge = badge;
  return out;
}
