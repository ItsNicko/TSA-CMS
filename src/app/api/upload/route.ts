import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const token = process.env.GITHUB_TOKEN;
const owner = 'itsnicko';
const repo = 'North-Dakota-TSA-Website';
const imagesDir = 'images';

const gh = {
  headers: {
    Authorization: `token ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  },
  baseUrl: `https://api.github.com/repos/${owner}/${repo}/contents`,
};

const sanitizeFileName = (name: string) => name.replace(/[^a-zA-Z0-9.-]/g, '_');

const buildPath = (folder: string, file: string) => `${folder}/${file}`;

export async function POST(request: NextRequest) {
  try {
    if (!token) {
      return NextResponse.json({ error: 'GitHub token not configured' }, { status: 500 });
    }

    const form = await request.formData();
    const file = form.get('file') as File;
    const oldFile = form.get('oldFileName') as string;
    const folder = form.get('folder') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // setup file path
    const safe = sanitizeFileName(file.name);
    const newName = `${Date.now()}-${safe}`;
    const dir = folder?.trim() || imagesDir;
    const path = buildPath(dir, newName);

    // convert to base64
    const buf = await file.arrayBuffer();
    const b64 = Buffer.from(buf).toString('base64');

    // upload to github
    await axios.put(`${gh.baseUrl}/${path}`, {
      message: `Add image: ${newName}`,
      content: b64,
      branch: 'main',
    }, { headers: gh.headers });

    // delete old file if exists
    if (oldFile) {
      try {
        const oldPath = buildPath(dir, oldFile);
        const res = await axios.get(`${gh.baseUrl}/${oldPath}`, { headers: gh.headers });
        await axios.delete(`${gh.baseUrl}/${oldPath}`, {
          data: { message: `Delete: ${oldFile}`, sha: res.data.sha, branch: 'main' },
          headers: gh.headers,
        });
      } catch (err) {
        console.error('delete old file failed:', err);
      }
    }

    return NextResponse.json({ success: true, path, filename: newName });
  } catch (err: any) {
    console.error('upload error:', err);
    const msg = err.response?.data?.message || 'upload failed';
    return NextResponse.json({ error: msg }, { status: err.response?.status || 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!token) {
      return NextResponse.json({ error: 'GitHub token not configured' }, { status: 500 });
    }

    const { fileName } = await request.json();
    if (!fileName) {
      return NextResponse.json({ error: 'No file name provided' }, { status: 400 });
    }

    const path = buildPath(imagesDir, fileName);

    // get file sha
    const res = await axios.get(`${gh.baseUrl}/${path}`, { headers: gh.headers });

    // delete
    await axios.delete(`${gh.baseUrl}/${path}`, {
      data: { message: `Delete: ${fileName}`, sha: res.data.sha, branch: 'main' },
      headers: gh.headers,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('delete error:', err);
    const msg = err.response?.data?.message || 'delete failed';
    return NextResponse.json({ error: msg }, { status: err.response?.status || 500 });
  }
}
