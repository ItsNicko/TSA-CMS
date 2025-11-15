import { listFilesInRepo } from './github';

export async function discoverPages(): Promise<Array<{ name: string; path: string; type: 'json' | 'html' }>> {
  try {
    const contents = await listFilesInRepo();
    const pages: Array<{ name: string; path: string; type: 'json' | 'html' }> = [];

    for (const item of contents) {
      if (item.type === 'file') {
        if (item.name.endsWith('.json')) {
          pages.push({
            name: item.name,
            path: item.path,
            type: 'json',
          });
        } else if (item.name.endsWith('.html')) {
          pages.push({
            name: item.name,
            path: item.path,
            type: 'html',
          });
        }
      }
    }

    return pages.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error discovering pages:', error);
    return [];
  }
}

export function isValidJSON(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

export function getFileName(path: string): string {
  return path.split('/').pop() || '';
}
