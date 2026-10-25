// Shared accessible validation for retained HTML fragments and React forms.
export function clearValidFieldError(
  field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
) {
  if (!field.validity.valid) return;
  field.removeAttribute("aria-invalid");
  const remaining = (field.getAttribute("aria-describedby") || "")
    .split(" ")
    .filter((id) => {
      if (!id.startsWith("p2-error-")) return Boolean(id);
      document.getElementById(id)?.remove();
      return false;
    });
  if (remaining.length)
    field.setAttribute("aria-describedby", remaining.join(" "));
  else field.removeAttribute("aria-describedby");
  const form = field.form;
  if (
    form &&
    Array.from(
      form.querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >("input,select,textarea"),
    ).every((control) => !control.willValidate || control.validity.valid)
  )
    form.querySelector(".p2-form-summary")?.remove();
}
export function validateFields(form: HTMLFormElement) {
  form
    .querySelectorAll<HTMLInputElement>("input[data-match-password]")
    .forEach((field) => {
      const password = form.elements.namedItem(
        field.dataset.matchPassword || "password",
      );
      field.setCustomValidity(
        password instanceof HTMLInputElement &&
          field.value &&
          field.value !== password.value
          ? "Passwords do not match. Enter the same password again."
          : "",
      );
    });
  const unique = (form.dataset.validationId ||= crypto.randomUUID());
  form
    .querySelectorAll(".p2-field-error,.p2-form-summary")
    .forEach((e) => e.remove());
  let first: HTMLElement | null = null;
  const fields = form.querySelectorAll<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  >("input,textarea,select");
  fields.forEach((field, index) => {
    field.removeAttribute("aria-invalid");
    const described = (field.getAttribute("aria-describedby") || "")
      .split(" ")
      .filter((id) => id && !id.startsWith("p2-error-"));
    if (described.length)
      field.setAttribute("aria-describedby", described.join(" "));
    else field.removeAttribute("aria-describedby");
    if (field.disabled || !field.willValidate || field.validity.valid) return;
    first ||= field;
    const error = document.createElement("span");
    error.className = "p2-field-error";
    error.id = `p2-error-${unique}-${index}`;
    error.textContent = field.validationMessage;
    field.setAttribute("aria-invalid", "true");
    field.setAttribute("aria-describedby", [...described, error.id].join(" "));
    field.insertAdjacentElement("afterend", error);
  });
  if (first) {
    const summary = document.createElement("p");
    summary.className = "p2-form-summary";
    summary.setAttribute("role", "alert");
    summary.textContent = "Check the highlighted fields and try again.";
    form.prepend(summary);
    let ancestor: HTMLElement | null = first as HTMLElement;
    while (ancestor) {
      if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
      ancestor = ancestor.parentElement;
    }
    (first as HTMLElement).focus();
    return false;
  }
  return true;
}
