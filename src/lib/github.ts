import axios, { AxiosInstance } from 'axios';

interface GitHubConfig {
  repoUrl: string;
  branch: string;
  token: string;
}

let config: GitHubConfig | null = null;
let api: AxiosInstance | null = null;

export function initializeGitHub(githubConfig: GitHubConfig) {
  config = githubConfig;
  
  // Extract owner and repo from URL
  const urlParts = githubConfig.repoUrl.replace('https://github.com/', '').split('/');
  const owner = urlParts[0];
  const repo = urlParts[1];
  
  api = axios.create({
    baseURL: `https://api.github.com/repos/${owner}/${repo}`,
    headers: {
      'Authorization': `Bearer ${githubConfig.token}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });
}

export function getGitHubConfig(): GitHubConfig | null {
  return config;
}

export function getGitHubAPI(): AxiosInstance {
  if (!api) {
    throw new Error('GitHub API not initialized');
  }
  return api;
}

export async function listFilesInRepo(path: string = '') {
  const api = getGitHubAPI();
  const response = await api.get(`/contents/${path}`);
  return response.data;
}

export async function getFileContent(path: string): Promise<string> {
  const api = getGitHubAPI();
  const response = await api.get(`/contents/${path}`);
  
  if (response.data.type === 'file') {
    return Buffer.from(response.data.content, 'base64').toString('utf-8');
  }
  
  throw new Error('Path is not a file');
}

export async function commitFile(path: string, content: string, message: string) {
  const api = getGitHubAPI();
  const config = getGitHubConfig();
  
  if (!config) {
    throw new Error('GitHub config not initialized');
  }
  
  // Get current file to get SHA
  let sha = '';
  try {
    const response = await api.get(`/contents/${path}`);
    sha = response.data.sha;
  } catch (error) {
    // File doesn't exist yet
  }
  
  const payload: any = {
    message,
    content: Buffer.from(content).toString('base64'),
    branch: config.branch,
  };
  
  if (sha) {
    payload.sha = sha;
  }
  
  const response = await api.put(`/contents/${path}`, payload);
  return response.data;
}

export async function deleteFile(path: string, message: string) {
  const api = getGitHubAPI();
  const config = getGitHubConfig();
  
  if (!config) {
    throw new Error('GitHub config not initialized');
  }
  
  // Get current file to get SHA
  const response = await api.get(`/contents/${path}`);
  const sha = response.data.sha;
  
  const payload = {
    message,
    sha,
    branch: config.branch,
  };
  
  return await api.delete(`/contents/${path}`, { data: payload });
}
