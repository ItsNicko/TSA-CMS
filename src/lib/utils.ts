import { listFilesInRepo } from './github';

const fileExt = (name: string) => name.split('.').pop()?.toLowerCase() || '';

export async function discoverPages(): Promise<Array<{ name: string; path: string; type: 'json' | 'html' }>> {
  try {
    const files = await listFilesInRepo();
    return files
      .filter(f => f.type === 'file')
      .filter(f => f.name.endsWith('.json') || f.name.endsWith('.html'))
      .map(f => ({
        name: f.name,
        path: f.path,
        type: (f.name.endsWith('.json') ? 'json' : 'html') as 'json' | 'html',
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    console.error('failed to discover pages:', err);
    return [];
  }
}

export const isValidJSON = (str: string): boolean => {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
};

export const getFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const units = ['Bytes', 'KB', 'MB'];
  const idx = Math.floor(Math.log(bytes) / Math.log(1024));
  return (Math.round((bytes / Math.pow(1024, idx)) * 100) / 100) + ' ' + units[idx];
};

export const getFileExtension = (name: string): string => fileExt(name);

export const getFileName = (path: string): string => path.split('/').pop() || '';

export const getBaseName = (path: string): string => path.split('/').slice(0, -1).join('/');

