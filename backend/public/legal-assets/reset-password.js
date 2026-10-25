(function () {
  var form  = document.getElementById("form");
  var msg   = document.getElementById("msg");
  var btn   = document.getElementById("submit");
  var token = new URLSearchParams(window.location.search).get("token");
  // Empty on the API host itself; https://trackseam.onrender.com on trackseam.com.
  var API = (document.querySelector("meta[name=trackseam-api]") || {}).content || "";

  function show(kind, text) { msg.className = "msg " + kind; msg.textContent = text; }

  if (!token) {
    form.style.display = "none";
    show("error", "This reset link is incomplete. Request a new one from the Trackseam app.");
    return;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var pw = form.password.value, confirm = form.confirm.value;
    if (pw.length < 8) return show("error", "Password must be at least 8 characters.");
    if (pw !== confirm) return show("error", "Passwords do not match.");

    btn.disabled = true;
    fetch(API + "/api/auth/reset-password/" + encodeURIComponent(token), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (data) {
          if (!r.ok) throw new Error(data.error || "Request failed.");
        });
      })
      .then(function () {
        form.style.display = "none";
        show("ok", "Your password has been updated. Open the Trackseam app and sign in with your new password.");
      })
      .catch(function (err) { show("error", err.message); btn.disabled = false; });
  });
})();
