// Tiny canvas line chart. DeskChart.line(canvas, [[iso, value], ...], {color, fill, lines:[{y,color,dash,label}]})
window.DeskChart = (function () {
  function line(cv, pts, o) {
    o = o || {};
    const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext("2d"); g.scale(dpr, dpr); g.clearRect(0, 0, W, H);
    if (!pts || pts.length < 2) {
      g.fillStyle = "#636366"; g.font = "13px -apple-system,system-ui"; g.textAlign = "center";
      g.fillText(o.emptyText || "Pas encore assez de données", W / 2, H / 2); return;
    }
    const xs = pts.map(p => new Date(p[0]).getTime()), ys = pts.map(p => +p[1]);
    const extra = (o.lines || []).map(l => l.y).filter(v => v != null && isFinite(v));
    let lo = Math.min(...ys, ...extra), hi = Math.max(...ys, ...extra);
    if (hi === lo) { hi += Math.abs(hi) * 0.01 || 1; lo -= Math.abs(lo) * 0.01 || 1; }
    const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
    const x0 = Math.min(...xs), x1 = Math.max(...xs) || x0 + 1, R = 4, T = 6, B = 6;
    const X = t => R + (t - x0) / ((x1 - x0) || 1) * (W - 2 * R), Y = v => T + (hi - v) / (hi - lo) * (H - T - B);
    const up = ys[ys.length - 1] >= ys[0], col = o.color || (up ? "#30d158" : "#ff453a");
    (o.lines || []).forEach(l => {
      if (l.y == null || !isFinite(l.y)) return;
      g.save(); g.strokeStyle = l.color || "#8e8e93"; g.lineWidth = l.width || 1.5;
      if (l.glow) { g.shadowColor = l.color; g.shadowBlur = 8; }
      if (l.dash) g.setLineDash(l.dash);
      g.beginPath(); g.moveTo(0, Y(l.y)); g.lineTo(W, Y(l.y)); g.stroke(); g.restore();
      if (l.label) { g.fillStyle = l.color || "#8e8e93"; g.font = "600 11px -apple-system,system-ui"; g.textAlign = "left";
        g.fillText(l.label, 6, Y(l.y) - 5); }
    });
    g.beginPath(); pts.forEach((p, i) => { const x = X(xs[i]), y = Y(ys[i]); i ? g.lineTo(x, y) : g.moveTo(x, y); });
    if (o.glow) { g.save(); g.shadowColor = col; g.shadowBlur = 14; g.strokeStyle = col; g.lineWidth = 2.4; g.lineJoin = "round"; g.stroke(); g.restore(); }
    g.strokeStyle = col; g.lineWidth = o.glow ? 2.2 : 2; g.lineJoin = "round"; g.stroke();
    if (o.fill !== false) {
      g.lineTo(X(xs[xs.length - 1]), H); g.lineTo(X(xs[0]), H); g.closePath();
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, col + "55"); gr.addColorStop(1, col + "00");
      g.fillStyle = gr; g.fill();
    }
    const lx = X(xs[xs.length - 1]), ly = Y(ys[ys.length - 1]);
    if (o.glow) { g.save(); g.shadowColor = col; g.shadowBlur = 18; g.beginPath(); g.arc(lx, ly, 5, 0, 7); g.fillStyle = col; g.fill(); g.restore(); }
    g.beginPath(); g.arc(lx, ly, 3.5, 0, 7); g.fillStyle = col; g.fill();
    if (o.lastLabel) { g.fillStyle = col; g.font = "700 11px ui-monospace,Menlo,monospace"; g.textAlign = "right";
      g.fillText(o.lastLabel, Math.max(60, lx - 8), Math.max(14, ly - 8)); }
  }
  return { line };
})();
