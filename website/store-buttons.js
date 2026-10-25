// Until the apps are live in the stores, the "App Store" / "Google Play"
// buttons on trackseam.com show a coming-soon notice and send people to the
// web version instead. Loaded by index.html; independent of the React build,
// so it survives as long as the <script> tag stays in index.html.
//
// When the apps are published: set the store URLs below and the buttons go
// straight to the stores. Leave a URL empty to keep the notice for that store.
(function () {
  var STORE_URLS = {
    ios: "",     // e.g. https://apps.apple.com/app/id0000000000
    android: "", // e.g. https://play.google.com/store/apps/details?id=com.trackseam.app
  };
  var WEB_APP = "https://app.trackseam.com";
  var REDIRECT_SECONDS = 5;

  function storeOf(el) {
    var text = (el.textContent || "").toLowerCase();
    if (text.indexOf("app store") !== -1) return "ios";
    if (text.indexOf("google play") !== -1) return "android";
    return null;
  }

  var css =
    ".tsn-overlay{position:fixed;inset:0;z-index:2147483000;background:rgba(26,25,22,.6);display:flex;align-items:center;justify-content:center;padding:20px;animation:tsn-fade .15s ease}" +
    ".tsn-card{background:#FAFAF8;color:#1A1916;max-width:400px;width:100%;border-radius:4px;padding:30px 26px 24px;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,.25);font-family:Georgia,'Times New Roman',serif}" +
    ".tsn-eyebrow{font:11px/1.4 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.12em;text-transform:uppercase;color:#706C64;margin:0 0 10px}" +
    ".tsn-title{font-size:26px;font-weight:600;margin:0 0 10px;line-height:1.2}" +
    ".tsn-text{font-size:15px;line-height:1.6;color:#4A4740;margin:0 0 22px}" +
    ".tsn-btn{display:block;width:100%;padding:12px;border-radius:2px;font:600 15px Georgia,serif;cursor:pointer;text-decoration:none;box-sizing:border-box}" +
    ".tsn-primary{background:#1A1916;color:#FAFAF8;border:1px solid #1A1916;margin-bottom:10px}" +
    ".tsn-ghost{background:transparent;color:#706C64;border:1px solid #E2E0DC}" +
    ".tsn-count{font:12px ui-monospace,Menlo,Consolas,monospace;color:#A09C94;margin:14px 0 0}" +
    "@keyframes tsn-fade{from{opacity:0}to{opacity:1}}";

  var timer = null;

  function close() {
    clearInterval(timer);
    var el = document.querySelector(".tsn-overlay");
    if (el) el.remove();
    document.removeEventListener("keydown", onKey);
  }

  function onKey(e) { if (e.key === "Escape") close(); }

  function show(store) {
    close();
    if (!document.getElementById("tsn-style")) {
      var style = document.createElement("style");
      style.id = "tsn-style";
      style.textContent = css;
      document.head.appendChild(style);
    }
    var name = store === "ios" ? "the App Store" : "Google Play";
    var overlay = document.createElement("div");
    overlay.className = "tsn-overlay";
    overlay.innerHTML =
      '<div class="tsn-card" role="dialog" aria-modal="true" aria-labelledby="tsn-title">' +
      '<p class="tsn-eyebrow">Coming soon</p>' +
      '<h2 class="tsn-title" id="tsn-title">Trackseam is coming to ' + name + "</h2>" +
      '<p class="tsn-text">We’re putting the finishing touches on the mobile app. Meanwhile, you can use every feature of Trackseam in your browser, on any phone or computer, with the same account.</p>' +
      '<a class="tsn-btn tsn-primary" href="' + WEB_APP + '">Open the web version</a>' +
      '<button type="button" class="tsn-btn tsn-ghost">Stay on this page</button>' +
      '<p class="tsn-count" aria-live="polite"></p>' +
      "</div>";
    document.body.appendChild(overlay);

    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
    overlay.querySelector(".tsn-ghost").addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    overlay.querySelector(".tsn-primary").focus();

    var left = REDIRECT_SECONDS;
    var count = overlay.querySelector(".tsn-count");
    var tick = function () {
      if (left <= 0) { clearInterval(timer); window.location.href = WEB_APP; return; }
      count.textContent = "Taking you to the web version in " + left + "s…";
      left -= 1;
    };
    tick();
    timer = setInterval(tick, 1000);
  }

  // Capture phase on document runs before React's own handlers on the root.
  document.addEventListener("click", function (e) {
    var el = e.target.closest && e.target.closest("a, button");
    if (!el) return;
    var store = storeOf(el);
    if (!store) return;
    e.preventDefault();
    e.stopPropagation();
    if (STORE_URLS[store]) window.location.href = STORE_URLS[store];
    else show(store);
  }, true);
})();
