export const consentKey = "upd-analytics-consent";
let temporaryChoice: "off" | undefined;
export function readConsentChoice() {
  if (temporaryChoice) return temporaryChoice;
  try {
    const saved = localStorage.getItem(consentKey);
    return saved === "allowed" || saved === "off" ? saved : "unanswered";
  } catch {
    return "unanswered";
  }
}
export function saveConsentChoice(allowed: boolean) {
  try {
    localStorage.setItem(consentKey, allowed ? "allowed" : "off");
    if (!allowed) sessionStorage.removeItem("upd-analytics-session");
    temporaryChoice = undefined;
    return true;
  } catch {
    // A failed save must never leave analytics enabled in this page session.
    temporaryChoice = "off";
    return false;
  }
}
