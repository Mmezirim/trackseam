(function () {
  var form = document.getElementById("form");
  var msg  = document.getElementById("msg");
  var btn  = document.getElementById("submit");
  // Empty on the API host itself; https://trackseam.onrender.com on trackseam.com.
  var API = (document.querySelector("meta[name=trackseam-api]") || {}).content || "";

  function show(kind, text) { msg.className = "msg " + kind; msg.textContent = text; }

  function call(path, method, body, token) {
    var headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = "Bearer " + token;
    return fetch(API + "/api/auth" + path, { method: method, headers: headers, body: JSON.stringify(body) })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (data) {
          if (!r.ok) throw new Error(data.error || "Request failed.");
          return data;
        });
      });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = form.email.value.trim();
    var password = form.password.value;
    if (!email || !password) return show("error", "Enter your email and password.");
    if (!window.confirm("This permanently deletes your Trackseam account, all your clients and all their measurements. This cannot be undone. Continue?")) return;

    btn.disabled = true;
    call("/login", "POST", { email: email, password: password })
      .then(function (data) { return call("/me", "DELETE", { password: password }, data.token); })
      .then(function () {
        form.reset();
        show("ok", "Your account and all associated data have been deleted.");
      })
      .catch(function (err) { show("error", err.message); })
      .finally(function () { btn.disabled = false; });
  });
})();
