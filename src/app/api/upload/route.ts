import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = 'itsnicko';
const GITHUB_REPO = 'North-Dakota-TSA-Website';
const IMAGES_FOLDER = 'images';

export async function POST(request: NextRequest) {
  try {
    if (!GITHUB_TOKEN) {
      return NextResponse.json({ error: 'GitHub token not configured' }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const oldFileName = formData.get('oldFileName') as string;
    const folderFromForm = formData.get('folder') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${timestamp}-${originalName}`;
    const folderName = folderFromForm && folderFromForm.trim() ? folderFromForm.trim() : IMAGES_FOLDER;
    const filepath = `${folderName}/${filename}`;

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const base64Content = Buffer.from(bytes).toString('base64');

    // Upload to GitHub
    const uploadResponse = await axios.put(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filepath}`,
      {
        message: `Add image: ${filename}`,
        content: base64Content,
        branch: 'main',
      },
      {
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    );

    // Delete old file if provided
    if (oldFileName) {
      try {
        const oldFilepath = `${folderName}/${oldFileName}`;

        // Get SHA of old file
        const getResponse = await axios.get(
          `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${oldFilepath}`,
          {
            headers: {
              Authorization: `token ${GITHUB_TOKEN}`,
              'X-GitHub-Api-Version': '2022-11-28',
            },
          }
        );

        // Delete old file
        await axios.delete(
          `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${oldFilepath}`,
          {
            data: {
              message: `Delete file: ${oldFileName}`,
              sha: getResponse.data.sha,
              branch: 'main',
            },
            headers: {
              Authorization: `token ${GITHUB_TOKEN}`,
              'X-GitHub-Api-Version': '2022-11-28',
            },
          }
        );
      } catch (err) {
        console.error('Error deleting old file:', err);
        // Continue even if delete fails
      }
    }

    // Return relative path for storage in JSON (frontend will normalize to GitHub Pages URL)
    const relativePath = `${filepath}`; // e.g. images/12345-filename.jpg (no leading slash)

    return NextResponse.json({ 
      success: true, 
      path: relativePath,
      filename 
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    const message = error.response?.data?.message || 'Upload failed';
    return NextResponse.json(
      { error: message },
      { status: error.response?.status || 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!GITHUB_TOKEN) {
      return NextResponse.json({ error: 'GitHub token not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { fileName } = body;

    if (!fileName) {
      return NextResponse.json({ error: 'No file name provided' }, { status: 400 });
    }

    const filepath = `${IMAGES_FOLDER}/${fileName}`;

    // Get SHA of file
    const getResponse = await axios.get(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filepath}`,
      {
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    );

    // Delete file
    await axios.delete(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filepath}`,
      {
        data: {
          message: `Delete image: ${fileName}`,
          sha: getResponse.data.sha,
          branch: 'main',
        },
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete error:', error);
    const message = error.response?.data?.message || 'Delete failed';
    return NextResponse.json(
      { error: message },
      { status: error.response?.status || 500 }
    );
  }
}
