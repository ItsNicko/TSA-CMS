const fs = require("fs");
const path = require("path");
const axios = require("axios");

// Read .env.local for GITHUB_TOKEN
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
  const branch = "main";
  const api = axios.create({
    baseURL: `https://api.github.com/repos/${owner}/${repo}`,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
    responseType: "arraybuffer",
  });

  // 1) Fetch remote about.json raw
  console.log("Fetching remote about.json...");
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/refs/heads/${branch}/about.json`;
  const remoteRes = await axios.get(rawUrl, { responseType: "text" });
  const remoteJson = JSON.parse(remoteRes.data);

  // Normalize documents and images paths
  if (Array.isArray(remoteJson.documents)) {
    remoteJson.documents = remoteJson.documents.map((d) => {
      if (!d || !d.url) return d;
      // Normalize PDFs/ -> pdfs/
      d.url = d.url.replace(/^PDFs\//i, "pdfs/").replace(/^PDFs\\/i, "pdfs/");
      return d;
    });
  }

  if (Array.isArray(remoteJson.stateOfficers)) {
    remoteJson.stateOfficers = remoteJson.stateOfficers.map((o) => {
      if (!o) return o;
      if (o.image) o.image = o.image.replace(/^\/images\//i, "images/");
      return o;
    });
  }

  const updatedContent = JSON.stringify(remoteJson, null, 2) + "\n";

  // Commit updated about.json
  console.log("Committing updated about.json...");
  const aboutPath = "about.json";

  // Try to get SHA if exists
  let sha = null;
  try {
    const getRes = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/contents/${aboutPath}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );
    sha = getRes.data.sha;
  } catch (err) {
    // file may not exist
  }

  const putPayload = {
    message: "Update about.json via CMS migration script",
    content: Buffer.from(updatedContent).toString("base64"),
    branch,
  };
  if (sha) putPayload.sha = sha;

  await axios.put(
    `https://api.github.com/repos/${owner}/${repo}/contents/${aboutPath}`,
    putPayload,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    }
  );
  console.log("about.json committed.");

  // 3) For each document that originally referenced PDFs/ (case-insensitive), copy file to pdfs/ and delete original
  const docs = remoteJson.documents || [];
  for (const doc of docs) {
    if (!doc || !doc.url) continue;
    const original = doc.url; // after normalization; need original source path variant
    // We assume original in repo may have been under PDF(s)/ with various casing. Try possible original paths
    const filename = original.split("/").pop();
    if (!filename) continue;

    const targetPath = `pdfs/${filename}`;
    const possibleSources = [
      `PDFs/${filename}`,
      `PDFs/${filename}`,
      `pdfs/${filename}`,
      `Pdfs/${filename}`,
    ];

    // Fetch the first source that exists
    let sourceFound = null;
    for (const src of possibleSources) {
      try {
        const raw = await axios.get(
          `https://raw.githubusercontent.com/${owner}/${repo}/refs/heads/${branch}/${src}`,
          { responseType: "arraybuffer" }
        );
        const buffer = Buffer.from(raw.data);

        // Commit to targetPath
        console.log(`Uploading ${targetPath}...`);
        // check existing sha
        let existingSha = null;
        try {
          const getRes = await axios.get(
            `https://api.github.com/repos/${owner}/${repo}/contents/${targetPath}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github.v3+json",
              },
            }
          );
          existingSha = getRes.data.sha;
        } catch (e) {}

        const payload = {
          message: `Add ${targetPath} via migration script`,
          content: buffer.toString("base64"),
          branch,
        };
        if (existingSha) payload.sha = existingSha;
        await axios.put(
          `https://api.github.com/repos/${owner}/${repo}/contents/${targetPath}`,
          payload,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/vnd.github.v3+json",
            },
          }
        );
        console.log(`${targetPath} uploaded.`);

        // Delete original if original path differs from targetPath
        if (src !== targetPath) {
          try {
            const getRes = await axios.get(
              `https://api.github.com/repos/${owner}/${repo}/contents/${src}`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                  Accept: "application/vnd.github.v3+json",
                },
              }
            );
            const deletePayload = {
              message: `Remove ${src} via migration script`,
              sha: getRes.data.sha,
              branch,
            };
            await axios.delete(
              `https://api.github.com/repos/${owner}/${repo}/contents/${src}`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                  Accept: "application/vnd.github.v3+json",
                },
                data: deletePayload,
              }
            );
            console.log(`${src} deleted.`);
          } catch (delErr) {
            console.warn(`Could not delete ${src}:`, delErr.message || delErr);
          }
        }

        sourceFound = src;
        break;
      } catch (err) {
        // not found, continue
      }
    }

    if (!sourceFound) {
      console.log(`No source found for ${filename}, skipping.`);
    }
  }

  console.log("Migration complete.");
}

run().catch((err) => {
  console.error("Migration failed:", err?.message || err);
  process.exit(1);
});
