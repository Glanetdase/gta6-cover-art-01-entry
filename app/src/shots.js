// Fixed scenes for screenshots: ?shot=editor shows the app with photos loaded;
// ?shot=cover shows the cover alone, full-viewport. window.__shotReady is set
// once the scene is painted. Query params pick the scene: layout, grade, title,
// subtitle, size.
export async function runShot(shot, query, api) {
  const { loadSamples, state, redraw, setStatus, syncControls } = api;
  if (shot === 'cover') document.body.classList.add('shot-cover');
  if (query.get('layout')) state.layout = query.get('layout');
  if (query.get('grade')) state.grade = query.get('grade');
  if (query.get('title')) state.title = query.get('title');
  if (query.get('subtitle')) state.subtitle = query.get('subtitle');
  if (query.get('size')) state.size = query.get('size');
  if (syncControls) syncControls();
  try {
    await Promise.race([
      Promise.all([document.fonts.load('80px Anton'), document.fonts.load('32px Pacifico')]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch { /* fall back to system fonts */ }
  await loadSamples();
  redraw();
  setStatus('Shot scene ready.');
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
