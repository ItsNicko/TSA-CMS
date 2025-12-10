// firebase config
export interface FirebaseConfig {
  apiKey: string;
  projectId: string;
  storageBucket: string;
  authDomain: string;
  messagingSenderId: string;
  appId: string;
  measurementId: string;
}

// github config
export interface GithubConfig {
  repoUrl: string;
  branch: string;
  token: string;
}

// app configuration
export interface AppConfig {
  firebase: FirebaseConfig;
  github: GithubConfig;
  initialized: boolean;
}

// file types
export type FileType = 'json' | 'html';

// page metadata
export interface PageMeta {
  path: string;
  type: FileType;
  name: string;
}

// page with content
export interface PageWithContent extends PageMeta {
  content: string;
  isDirty: boolean;
  lastModified?: Date;
}

// editor block for json pages
export interface Block {
  id: string;
  [key: string]: any;
}
