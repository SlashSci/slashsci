// Stands in for the SlashSci kernel on the website: the real app (same build as the desktop one) runs in an
// iframe and every /api request is answered from recorded files (demo-<lang>.json for the library and the
// showcase paper, p/<id>.json for the other papers). Everything is preset: nothing is fetched, translated or
// imported for real, and nothing leaves the page. Notes written in the demo live in memory until it is closed.
(function () {
  var q = new URLSearchParams(location.search), lang = q.get("lang") || "zh";
  var ui = { zh: "zh-Hans", "zh-hant": "zh-Hant", en: "en" };
  try { localStorage.setItem("uiLang", ui[lang] || "zh-Hans"); localStorage.setItem("readMode", "learn"); localStorage.setItem("sort", JSON.stringify({ key: "added", dir: -1 }));
    var pr = JSON.parse(localStorage.getItem("prefs") || "{}"); pr.fontSize = 15; pr.measure = 56; pr.sideWidth = 22; pr.notesWidth = 14; pr.learnWidth = 18; localStorage.setItem("themePref", JSON.stringify({ mode: q.get("mode") === "dark" ? "dark" : "light", light: "geist", dark: "geist-dark" })); localStorage.setItem("tocPinned", "0"); localStorage.setItem("prefs", JSON.stringify(pr)); localStorage.setItem("prefsV", "3"); } catch (e) {}
  var base = document.currentScript.src.replace(/[^/]*$/, "");
  var realFetch = window.fetch.bind(window);
  var ready = realFetch(base + "demo-" + (ui[lang] ? lang : "zh") + ".json").then(function (r) { return r.json(); });
  var papers = {}, seq = 0;
  var json = function (b, s) { return new Response(typeof b === "string" ? b : JSON.stringify(b), { status: s || 200, headers: { "Content-Type": "application/json" } }); };
  var parse = function (b) { try { return typeof b === "string" ? JSON.parse(b) : {}; } catch (e) { return {}; } };

  // a paper's bundle (parsed once, so notes written in the demo stay) and its key vocabulary
  function paper(D, id) {
    if (!papers[id]) { var r = D.fx["GET /api/papers/" + id]; papers[id] = r ? { bundle: JSON.parse(r.b), vocab: D.vocab[id] || {} } : null; }
    return Promise.resolve(papers[id]);
  }

  function answer(D, method, url, init) {
    var p = url.pathname, body = parse(init && init.body), key = method + " " + p;
    var m = p.match(/^\/api\/papers\/([^/]+)(\/.*)?$/), id = m && m[1], rest = m && (m[2] || "");
    if (method === "GET") {
      if (p === "/api/update") return json({ current: "0.1.0", hasUpdate: false, checkedAt: new Date().toISOString() });
      if (id && !rest) return paper(D, id).then(function (x) { return x ? json(x.bundle) : json({ error: "paper not found" }, 404); });
      if (id && rest === "/refs") return json({});
      var r = D.fx[key + url.search] || D.fx[key];
      if (p === "/api/papers" && url.searchParams.get("q") && r) { var qq = url.searchParams.get("q").toLowerCase(); return json(JSON.parse(r.b).filter(function (x) { return (x.title + " " + x.authors + " " + x.venue).toLowerCase().indexOf(qq) >= 0; })); }
      return r ? json(r.b, r.s) : json({ error: "演示版没有这项数据" }, 404);
    }
    // importing is preset: whatever is typed, the showcase paper is what comes back
    if (p === "/api/import/identifier" || p === "/api/import/file" || p === "/api/capture") return json({ id: D.papers[0], duplicate: true, warnings: [] });
    if (!id) { var rec0 = D.fx[key]; return rec0 ? json(rec0.b, rec0.s) : json({ ok: true }); }
    return paper(D, id).then(function (x) {
      if (rest === "/vocab") return json((x && x.vocab[body.unit + ":" + body.start + ":" + body.end]) || []);
      if (rest === "/chat") return new Response(JSON.stringify({ type: "error", message: D.chat }) + "\n", { headers: { "Content-Type": "application/x-ndjson" } });
      if (rest === "/figure-full") return json({ state: "none", tried: new Date().toISOString() });
      if (rest === "/translate") return json({ job: x ? x.bundle.job : {} });
      var a = rest.match(/^\/annotations(?:\/([^/]+))?$/);
      if (a && x) {
        var list = x.bundle.annotations, now = new Date().toISOString();
        if (method === "POST" && !a[1]) { var n = Object.assign({ id: "demo-u" + (++seq), createdAt: now, updatedAt: now }, body); list.push(n); return json(n); }
        var i = list.findIndex(function (z) { return z.id === a[1]; });
        if (method === "PATCH" && i >= 0) { list[i] = Object.assign({}, list[i], body, { updatedAt: now }); return json(list[i]); }
        if (method === "DELETE" && i >= 0) { list.splice(i, 1); return json({ ok: true }); }
      }
      var rec = D.fx["PATCH /api/papers/" + D.papers[0] + rest] || D.fx[key];
      return rec ? json(rec.b, rec.s) : json({ ok: true });
    });
  }

  window.fetch = function (input, init) {
    var url = new URL(typeof input === "string" ? input : input.url, location.href);
    if (url.pathname.indexOf("/api/") !== 0) return realFetch(input, init);
    var method = ((init && init.method) || (typeof input !== "string" && input.method) || "GET").toUpperCase();
    return ready.then(function (D) { return answer(D, method, url, init); });
  };

  // The demo is the real interface with everything in place, but only the showcase is live: two papers open,
  // the library tree has "all papers", reading works. Every other control is present and simply does nothing.
  var OPEN = ["How to Build the Virtual Cell with Artificial Intelligence", "Attention Is All You Need"];
  function inert(t) {
    if (!t || !t.closest) return false;
    var rb = t.closest(".rail-btn");
    if (rb) { var all = [].slice.call(document.querySelectorAll(".rail .rail-btn")); var k = all.indexOf(rb); return k !== 0 && k !== all.length - 2; }
    var tree = t.closest("aside.tree");
    if (tree) { var row = t.closest(".tree-row"); return !(row && row === tree.querySelector(".tree-row")); }
    var tr = t.closest("table tbody tr");
    if (tr) { var title = (tr.children[1] && tr.children[1].textContent || "").replace(/\s+/g, " ").trim(); return !OPEN.some(function (o) { return title.indexOf(o.slice(0, 30)) === 0; }); }
    if (t.closest('a[href^="/api/"]') || (t.matches && t.matches('input[type="file"]'))) return true;
    var b = t.closest("button");
    if (b && /^(翻译|翻譯|Translate|文件|檔案|File)$/.test(b.textContent.trim())) return true;
    return false;
  }
  ["click", "dblclick", "mousedown", "pointerdown", "contextmenu", "dragstart", "keydown"].forEach(function (type) {
    document.addEventListener(type, function (e) {
      if (type === "keydown" && e.key !== "Enter" && e.key !== " ") return;
      if (inert(e.target)) { e.preventDefault(); e.stopPropagation(); }
    }, true);
  });
  ["dragover", "drop"].forEach(function (type) { document.addEventListener(type, function (e) { e.preventDefault(); e.stopPropagation(); }, true); });

  // ---- the homepage tour (?tour=1): a cursor reads the paper by itself, hovering sentences so the translation and
  // key words appear, and scrolling so the notes pile up in the margin. It uses the app's own hover handling and
  // stops the moment a visitor wheels, clicks or types in the window.
  if (q.get("tour") === "1") {
    var STEPS = [["a0001", "most fundamental unit of life", "tr"], ["b0006", "dynamic and adaptive system", "note"], ["b0016", "integrate broad knowledge", "tr"],
      ["b0023", "ability to model cellular responses", "note"], ["b0025", "simulating the effects of different interventions", "tr"], ["b0028", "queryable with computational twins", "note"]];

    var TIPS = { zh: { tr: ["悬停任意一句，译文与重点词汇随即浮现", "译文不打断阅读：就在句子旁边"], note: ["划词即批注，批注沿页边实时堆叠", "四种颜色对应观点、方法、数据、疑问"] },
      "zh-hant": { tr: ["懸停任意一句，譯文與重點詞彙隨即浮現", "譯文不打斷閱讀：就在句子旁邊"], note: ["劃詞即批註，批註沿頁邊即時堆疊", "四種顏色對應觀點、方法、數據、疑問"] },
      en: { tr: ["Rest on any sentence: translation and key words appear", "Translation never interrupts reading: it sits beside the sentence"], note: ["Select to annotate; notes stack along the margin live", "Four colours: claim, method, data, question"] } }[lang] || null;
    var bubble = document.createElement("div");
    bubble.style.cssText = "position:fixed;z-index:2100;max-width:300px;padding:10px 14px;background:#111;color:#fff;font:500 14px/1.5 system-ui,'PingFang SC',sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.25);pointer-events:none;opacity:0;transition:opacity .45s";
    var say = function (kind, k, x, y) { if (!TIPS) return; bubble.textContent = TIPS[kind][k % 2]; bubble.style.left = Math.min(x + 28, innerWidth - 330) + "px"; bubble.style.top = Math.max(y - 64, 8) + "px"; bubble.style.opacity = "1"; };
    var live = true, cur, sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    var stopTour = function (e) { if (e.isTrusted && live) { live = false; if (cur) cur.remove(); bubble.style.opacity = "0"; parent.postMessage({ slash: "tour", kind: "" }, "*"); } };
    ["wheel", "pointerdown", "keydown"].forEach(function (t) { window.addEventListener(t, stopTour, { capture: true, passive: true }); });
    var where = function (block, phrase) {
      var el = document.querySelector('.doc [data-block="' + block + '"]'); if (!el) return null;
      var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), n, text = "";
      while ((n = w.nextNode())) { var at = n.nodeValue.indexOf(phrase); if (at >= 0) { var r = document.createRange(); r.setStart(n, at); r.setEnd(n, at + phrase.length); return r.getClientRects()[0] || r.getBoundingClientRect(); } }
      return null;
    };
    var run = async function () {
      for (var i = 0; i < 80 && !document.querySelector(".doc-scroll .block, .doc .block"); i++) await sleep(250);
      await sleep(1800);
      var sc = [].slice.call(document.querySelectorAll(".doc-scroll")).find(function (e) { return e.offsetParent; });
      if (!sc) return;
      cur = document.createElement("div");
      cur.style.cssText = "position:fixed;left:0;top:0;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:rgba(37,99,235,.18);border:2px solid #2563eb;z-index:2000;pointer-events:none;transition:transform .9s cubic-bezier(.4,0,.2,1);transform:translate(40%,40%)";
      document.body.appendChild(cur); document.body.appendChild(bubble);
      while (live) {
        for (var k = 0; k < STEPS.length && live; k++) {
          var st = STEPS[k], rc = where(st[0], st[1]); if (!rc) continue;
          var sr = sc.getBoundingClientRect();
          sc.scrollTo({ top: sc.scrollTop + rc.top - sr.top - sr.height * 0.38, behavior: "smooth" });
          await sleep(2000); if (!live) break;
          rc = where(st[0], st[1]); if (!rc) continue;
          var x = rc.left + Math.min(rc.width, 160) / 2, y = rc.top + rc.height / 2;
          cur.style.transform = "translate(" + x + "px," + y + "px)";
          await sleep(900); if (!live) break;
          rc = where(st[0], st[1]) || rc; x = rc.left + Math.min(rc.width, 160) / 2; y = rc.top + rc.height / 2;
          var tgt = document.elementFromPoint(x, y) || sc;
          tgt.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: x, clientY: y }));
          parent.postMessage({ slash: "tour", kind: st[2] }, "*");
          say(st[2], k, x, y);
          await sleep(3200); bubble.style.opacity = "0";
        }
        if (!live) break;
        sc.scrollTo({ top: 0, behavior: "smooth" }); await sleep(2200);
      }
    };
    window.addEventListener("load", function () { setTimeout(run, 500); });
  }
})();
