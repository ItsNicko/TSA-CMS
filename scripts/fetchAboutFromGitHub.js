const fs = require("fs");
const path = require("path");
const axios = require("axios");

function readEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) throw new Error(".env.local not found");
  const content = fs.readFileSync(envPath, "utf8");
  const lines = content.split(/\r?\n/);
  const out = {};
  for (const line of lines) {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

async function run() {
  const env = readEnvLocal();
  const token = env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN not found in .env.local");

  const owner = "ItsNicko";
  const repo = "North-Dakota-TSA-Website";
  const pathInRepo = "about.json";

  const res = await axios.get(
    `https://api.github.com/repos/${owner}/${repo}/contents/${pathInRepo}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    }
  );
  const content = Buffer.from(res.data.content, "base64").toString("utf8");

  fs.writeFileSync(path.resolve(process.cwd(), "about.json"), content, "utf8");
  console.log("Wrote local about.json");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
