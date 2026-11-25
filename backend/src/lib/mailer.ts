export interface MailerEnv {
  BYZO_MAIL_API_URL?: string;
  BYZO_MAIL_API_KEY?: string;
}

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendMail(
  env: MailerEnv,
  options: SendMailOptions
): Promise<{ success: boolean; error?: string }> {
  const apiUrl = (env.BYZO_MAIL_API_URL || "").replace(/\/+$/, "");
  const apiKey = env.BYZO_MAIL_API_KEY || "";

  if (!apiUrl || !apiKey) {
    console.warn(
      `[devnote-mail] BYZO_MAIL_API_URL or BYZO_MAIL_API_KEY not configured. Email to ${options.to} (${options.subject}) skipped.`
    );
    return {
      success: false,
      error: "Email service is not configured on the server.",
    };
  }

  try {
    const res = await fetch(`${apiUrl}/v1/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app: "devnote",
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        fromName: "DevNote",
        fromEmail: "devnote@byzo.cc",
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      error?: string;
    };

    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || `Mail service error (${res.status})`,
      };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send email";
    console.error("[devnote-mail] Dispatch error:", message);
    return { success: false, error: message };
  }
}

export function generateSixDigitCode(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(100000 + (arr[0] % 900000));
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  if (local.length <= 2) {
    return `${local[0]}*@${domain}`;
  }
  if (local.length <= 4) {
    return `${local[0]}**${local.slice(-1)}@${domain}`;
  }
  const start = local.slice(0, 2);
  const end = local.slice(-2);
  return `${start}${"*".repeat(Math.max(2, local.length - 4))}${end}@${domain}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderEmailShell(params: {
  title: string;
  heading: string;
  intro: string;
  code: string;
  expiryText: string;
  metaLine?: string;
  footerNote: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(params.title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f6f7f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:520px;background-color:#ffffff;border:1px solid #dfe3ea;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:18px 24px;border-bottom:1px solid #dfe3ea;background-color:#ffffff;">
              <span style="font-size:15px;font-weight:700;color:#111827;letter-spacing:-0.2px;">devnote</span>
              <span style="font-size:12px;color:#5f6672;margin-left:8px;">by Byzo</span>
            </td>
          </tr>
          <tr>
            <td style="padding:26px 24px;">
              <h1 style="margin:0 0 8px 0;font-size:19px;font-weight:700;color:#111827;">${escapeHtml(params.heading)}</h1>
              <p style="margin:0 0 20px 0;font-size:14px;line-height:22px;color:#4b5563;">${escapeHtml(params.intro)}</p>
              <div style="margin:20px 0;padding:18px;background-color:#f6f7f9;border:1px solid #dfe3ea;border-radius:10px;text-align:center;">
                <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:#4c3d8f;">${escapeHtml(params.code)}</div>
                <div style="font-size:12px;color:#5f6672;margin-top:6px;">${escapeHtml(params.expiryText)}</div>
              </div>
              ${
                params.metaLine
                  ? `<p style="margin:0 0 14px 0;font-size:12px;line-height:18px;color:#5f6672;background-color:#f6f7f9;padding:10px 12px;border-radius:8px;border:1px solid #e5e7eb;">${escapeHtml(params.metaLine)}</p>`
                  : ""
              }
              <p style="margin:0;font-size:13px;line-height:20px;color:#6b7280;">${escapeHtml(params.footerNote)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 24px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;background-color:#fafafa;">
              devnote &middot; Built by Byzo (byzo.cc)
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildSignupVerificationEmail(code: string): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Your devnote verification code: ${code}`;
  return {
    subject,
    html: renderEmailShell({
      title: subject,
      heading: "Verify your email address",
      intro:
        "Enter the 6-digit verification code below to activate your devnote account.",
      code,
      expiryText: "Expires in 15 minutes",
      footerNote:
        "If you did not create a devnote account, you can safely ignore this email.",
    }),
    text: `Your devnote verification code is: ${code}\n\nThis code expires in 15 minutes.`,
  };
}

export function buildNewDeviceLoginEmail(
  code: string,
  meta: { ip: string; userAgent: string }
): { subject: string; html: string; text: string } {
  const subject = `Your devnote sign-in code: ${code}`;
  const deviceSummary = `IP: ${meta.ip} | Device: ${meta.userAgent.slice(0, 90) || "Unknown browser"}`;
  return {
    subject,
    html: renderEmailShell({
      title: subject,
      heading: "Sign-in from a new device",
      intro:
        "We noticed a sign-in attempt to your devnote account from an unrecognized device. Enter the 6-digit code below to continue.",
      code,
      expiryText: "Expires in 10 minutes",
      metaLine: deviceSummary,
      footerNote:
        "If this wasn't you, ignore this email and change your password immediately.",
    }),
    text: `Your devnote new-device sign-in code is: ${code}\n\n${deviceSummary}\nExpires in 10 minutes.`,
  };
}

export function buildPasswordResetEmail(code: string): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Reset your devnote password: ${code}`;
  return {
    subject,
    html: renderEmailShell({
      title: subject,
      heading: "Reset your password",
      intro:
        "We received a request to reset the password for your devnote account. Enter the 6-digit code below to choose a new password.",
      code,
      expiryText: "Expires in 15 minutes",
      footerNote:
        "If you did not request a password reset, your account remains secure and you can ignore this email.",
    }),
    text: `Your devnote password reset code is: ${code}\n\nThis code expires in 15 minutes.`,
  };
}

export interface RenewalAlertItem {
  clientName: string;
  projectName: string;
  serviceName: string;
  ownerEmail: string;
  tier: string;
  renewalDate: string;
  daysUntil: number;
  dashboardUrl: string;
}

export function buildRenewalReminderEmail(items: RenewalAlertItem[]): {
  subject: string;
  html: string;
  text: string;
} {
  const count = items.length;
  const subject =
    count === 1
      ? `Renewal reminder: ${items[0].serviceName} (${items[0].projectName})`
      : `Renewal reminder: ${count} services renewing soon`;

  const rowsHtml = items
    .map((item) => {
      const timing =
        item.daysUntil < 0
          ? `${Math.abs(item.daysUntil)}d overdue`
          : item.daysUntil === 0
            ? "Today"
            : `In ${item.daysUntil}d`;
      const safeLink =
        item.dashboardUrl && /^https?:\/\//i.test(item.dashboardUrl)
          ? `<div style="margin-top:4px;"><a href="${escapeHtml(item.dashboardUrl)}" style="font-size:12px;color:#4c3d8f;text-decoration:underline;">Open dashboard</a></div>`
          : "";
      return `<tr>
        <td style="padding:12px;border-bottom:1px solid #e5e7eb;vertical-align:top;">
          <div style="font-size:14px;font-weight:600;color:#111827;">${escapeHtml(item.serviceName)}</div>
          <div style="font-size:12px;color:#5f6672;margin-top:2px;">${escapeHtml(item.clientName)} / ${escapeHtml(item.projectName)}</div>
          ${item.ownerEmail ? `<div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:#374151;margin-top:4px;">${escapeHtml(item.ownerEmail)}</div>` : ""}
          ${safeLink}
        </td>
        <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:right;vertical-align:top;white-space:nowrap;">
          <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;font-weight:600;color:#111827;">${escapeHtml(item.renewalDate)}</div>
          <div style="font-size:12px;color:${item.daysUntil <= 2 ? "#b91c1c" : "#b45309"};margin-top:2px;">${escapeHtml(timing)}</div>
        </td>
      </tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f6f7f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;border:1px solid #dfe3ea;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:18px 24px;border-bottom:1px solid #dfe3ea;">
              <span style="font-size:15px;font-weight:700;color:#111827;">devnote</span>
              <span style="font-size:12px;color:#5f6672;margin-left:8px;">Renewal Alert</span>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              <h1 style="margin:0 0 8px 0;font-size:18px;font-weight:700;color:#111827;">Upcoming service renewals</h1>
              <p style="margin:0 0 18px 0;font-size:14px;line-height:22px;color:#4b5563;">The following services in your devnote workspace have renewal or free-tier expiry dates within the next 7 days:</p>
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border:1px solid #e5e7eb;border-radius:8px;border-collapse:collapse;overflow:hidden;">
                ${rowsHtml}
              </table>
              <div style="margin-top:20px;">
                <a href="https://devnote.byzo.cc/app/?v=renewals" style="display:inline-block;padding:10px 18px;background-color:#4c3d8f;color:#ffffff;text-decoration:none;font-weight:600;font-size:13px;border-radius:8px;">Review in devnote</a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 24px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;background-color:#fafafa;">
              devnote &middot; Built by Byzo (byzo.cc)
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const textLines = items.map(
    (item) =>
      `- ${item.serviceName} (${item.clientName} / ${item.projectName}): ${item.renewalDate}${item.ownerEmail ? ` | ${item.ownerEmail}` : ""}`
  );

  return {
    subject,
    html,
    text: `Upcoming service renewals in devnote:\n\n${textLines.join("\n")}\n\nOpen https://devnote.byzo.cc/app/?v=renewals`,
  };
}
