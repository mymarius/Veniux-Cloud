//#region api.veniux.com/src/panel.js
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
		e.hidden = !e.textContent.toLocaleLowerCase("tr").includes(t);
	});
}), document.querySelector("[data-copy-key]")?.addEventListener("click", async (e) => {
	try {
		await navigator.clipboard.writeText(e.currentTarget.dataset.copyKey), e.currentTarget.textContent = "Kopyalandı";
	} catch {
		e.currentTarget.textContent = "Anahtarı seçerek kopyalayın";
	}
});
//#endregion
