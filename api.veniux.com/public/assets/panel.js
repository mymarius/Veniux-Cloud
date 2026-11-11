// api.veniux.com/src/panel.js
var e = null;
document.querySelectorAll("[data-open-dialog]").forEach((t) => t.addEventListener("click", () => {
	e = t, document.getElementById(t.dataset.openDialog).showModal();
})), document.querySelectorAll("dialog").forEach((t) => {
	t.addEventListener("close", () => e?.focus()), t.querySelectorAll("[data-close-dialog]").forEach((e) => e.addEventListener("click", () => t.close()));
}), document.querySelectorAll("[data-confirm]").forEach((e) => e.addEventListener("submit", (t) => {
	window.confirm(e.dataset.confirm) || t.preventDefault();
})), document.querySelector("[data-search]")?.addEventListener("input", (e) => {
	let t = e.target.value.toLocaleLowerCase("tr");
	document.querySelectorAll("[data-search-row]").forEach((e) => {
		e.hidden = e.dataset.filtered === "1" || !e.textContent.toLocaleLowerCase("tr").includes(t);
	});
}), document.querySelector("[data-copy-key]")?.addEventListener("click", async (e) => {
	try {
		await navigator.clipboard.writeText(e.currentTarget.dataset.copyKey), e.currentTarget.textContent = "Kopyalandı";
	} catch {
		e.currentTarget.textContent = "Anahtarı seçerek kopyalayın";
	}
}), document.querySelectorAll("[data-open-dialog=\"edit-license\"]").forEach((e) => e.addEventListener("click", () => {
	let t = document.getElementById("edit-license");
	if (!t) return;
	let n = JSON.parse(e.dataset.license || "{}"), r = (e, n) => {
		let r = t.querySelector(`[data-field="${e}"]`);
		r && (r.value = n ?? "");
	};
	[
		"id",
		"company",
		"plan",
		"seats",
		"expires",
		"email",
		"notes"
	].forEach((e) => r(e, n[e])), t.querySelectorAll("[data-addon]").forEach((e) => {
		e.checked = (n.addons || []).includes(e.dataset.addon);
	});
	let i = t.querySelector("[data-field-hint=\"seats\"]");
	i && (i.textContent = `Şu an ${n.used || 0} etkin terminal var.`);
	let a = t.querySelector("[data-field=\"seats\"]");
	a && (a.min = String(Math.max(1, n.used || 1)));
})), document.querySelectorAll("[data-extend]").forEach((e) => e.addEventListener("click", () => {
	let t = e.closest("dialog").querySelector("[data-field=\"expires\"]"), n = /* @__PURE__ */ new Date((t.value || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)) + "T00:00:00Z"), r = /* @__PURE__ */ new Date((/* @__PURE__ */ new Date()).toISOString().slice(0, 10) + "T00:00:00Z"), i = n < r ? r : n;
	i.setUTCMonth(i.getUTCMonth() + Number(e.dataset.extend)), t.value = i.toISOString().slice(0, 10);
})), document.querySelectorAll("[data-filter]").forEach((e) => e.addEventListener("click", () => {
	document.querySelectorAll("[data-filter]").forEach((t) => t.setAttribute("aria-pressed", String(t === e)));
	let t = e.dataset.filter;
	document.querySelectorAll("[data-search-row]").forEach((e) => {
		e.dataset.filtered = t === "all" || e.dataset.state === t ? "" : "1";
	}), document.querySelector("[data-search]")?.dispatchEvent(new Event("input"));
}));
