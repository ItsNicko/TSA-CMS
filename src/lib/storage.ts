import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export async function uploadImageToFirebase(file: File, path: string = 'images'): Promise<string> {
  try {
    const filename = `${Date.now()}_${file.name}`;
    const storageRef = ref(storage, `${path}/${filename}`);
    
    const snapshot = await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(snapshot.ref);
    
    return downloadUrl;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw new Error('Failed to upload image');
  }
}

export function replaceImageUrlInContent(content: string, oldUrl: string, newUrl: string): string {
  // Handle both HTML and JSON content
  return content.replace(new RegExp(oldUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newUrl);
}
