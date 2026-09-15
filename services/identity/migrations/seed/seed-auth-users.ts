import "dotenv/config";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  process.exit(1);
}

const SEED_USERS = [
  { id: "10000000-0000-0000-0000-000000000001", email: "organiser@connectsphere.test" },
  { id: "10000000-0000-0000-0000-000000000002", email: "coordinator@connectsphere.test" },
  { id: "10000000-0000-0000-0000-000000000003", email: "venuestaff@connectsphere.test" },
  { id: "10000000-0000-0000-0000-000000000004", email: "techsupport@connectsphere.test" },
  { id: "10000000-0000-0000-0000-000000000005", email: "attendee@connectsphere.test" },
  { id: "10000000-0000-0000-0000-000000000006", email: "deactivated@connectsphere.test" },
] as const;

const SEED_PASSWORD = "ConnectSphere-Test-1234!";

async function upsertAuthUser(user: { id: string; email: string }) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      id: user.id,
      email: user.email,
      password: SEED_PASSWORD,
      email_confirm: true,
    }),
  });

  if (res.status === 201 || res.status === 200) {
    console.log(`created ${user.email}`);
    return;
  }

  const body = await res.json().catch(() => ({}));
  const alreadyExists =
    res.status === 422 &&
    typeof body?.msg === "string" &&
    body.msg.toLowerCase().includes("already");

  if (alreadyExists) {
    console.log(`skip    ${user.email} (already exists)`);
    return;
  }

  throw new Error(`Failed to create ${user.email}: ${res.status} ${JSON.stringify(body)}`);
}

async function run() {
  for (const user of SEED_USERS) {
    await upsertAuthUser(user);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
