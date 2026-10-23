type Template = "welcome" | "extended" | "reminder" | "ended";
export function membershipEmail(
  template: Template,
  expiresAt: string,
  origin: string,
) {
  const date = new Date(expiresAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Manila",
  });
  const messages = {
    welcome: {
      subject: "Welcome to Explorer+",
      text: `You're now an Explorer+ member of Unlock Paradise. Every destination is unlocked, including the hidden gems, your Bucketlist and your Portfolio.\n\nYou paid once, so there are no automatic charges. Your membership is active until ${date}.`,
    },
    extended: {
      subject: "Explorer+ extended",
      text: `Thanks for renewing. Your Explorer+ membership is now active until ${date}.`,
    },
    reminder: {
      subject: `Your Explorer+ ends on ${date}`,
      text: `Your Explorer+ membership ends on ${date}. To keep every destination unlocked, renew here:\n${origin}/checkout/\n\nPay once again and your new time is added to the end of your current membership.`,
    },
    ended: {
      subject: "Your Explorer+ has ended",
      text: `Your Explorer+ membership ended on ${date}. Your account is still here, and you can renew anytime:\n${origin}/checkout/`,
    },
  };
  return {
    ...messages[template],
    text: messages[template].text + `\n\nYour account: ${origin}/account/`,
  };
}
