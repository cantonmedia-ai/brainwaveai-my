const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "deric@cantonkitchen.com.my";
const ADMIN_URL = process.env.ADMIN_URL || "https://brainwaveai.my/admin";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function sanitize(value) {
  return String(value || "").trim();
}

async function supabaseInsert(table, payload) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase environment variables");
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase ${table} insert failed: ${text}`);
  }

  const rows = await response.json();
  return rows[0];
}

async function sendEmail(lead) {
  if (!RESEND_API_KEY) return { skipped: true };

  const subject = `[Brainwave Partner Application] ${lead.project_interest} - ${lead.partner_type}`;
  const submittedAt = lead.created_at || new Date().toISOString();
  const adminLink = `${ADMIN_URL}?lead=${encodeURIComponent(lead.id)}`;
  const text = `A new Brainwave Partner Application has been submitted.

Submission Details:

Name:
${lead.full_name}

Company:
${lead.company_name}

Email:
${lead.email}

Phone:
${lead.phone}

Country:
${lead.country}

Website:
${lead.website}

Project Interest:
${lead.project_interest}

Partner Type:
${lead.partner_type}

Business Type:
${lead.business_type}

Resources:
${lead.resources}

Budget:
${lead.budget}

Message:
${lead.message}

Submitted At:
${submittedAt}

Lead ID:
${lead.id}

View Submission:
${adminLink}`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "Brainwave AI <notifications@brainwaveai.my>",
      to: ADMIN_EMAIL,
      subject,
      text
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Email send failed: ${errorText}`);
  }

  return response.json();
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const input = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const required = ["full_name", "email", "project_interest", "partner_type"];
    const missing = required.filter((field) => !sanitize(input[field]));

    if (missing.length) {
      return json(res, 400, { ok: false, error: `Missing required fields: ${missing.join(", ")}` });
    }

    const leadPayload = {
      full_name: sanitize(input.full_name),
      company_name: sanitize(input.company_name),
      email: sanitize(input.email),
      phone: sanitize(input.phone),
      country: sanitize(input.country),
      website: sanitize(input.website),
      project_interest: sanitize(input.project_interest),
      partner_type: sanitize(input.partner_type),
      business_type: sanitize(input.business_type),
      resources: sanitize(input.resources),
      budget: sanitize(input.budget),
      message: sanitize(input.message),
      status: "NEW"
    };

    const lead = await supabaseInsert("partner_leads", leadPayload);

    try {
      await supabaseInsert("admin_notifications", {
        title: "New Partner Application",
        message: `${lead.full_name} submitted an application for ${lead.project_interest}`,
        type: "PARTNER_LEAD",
        status: "UNREAD",
        lead_id: lead.id
      });
    } catch (error) {
      console.error(error);
    }

    try {
      await sendEmail(lead);
    } catch (error) {
      console.error(error);
    }

    return json(res, 200, { ok: true, lead_id: lead.id });
  } catch (error) {
    console.error(error);
    return json(res, 500, { ok: false, error: "Unable to submit partner application" });
  }
};
