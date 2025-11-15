export interface ConfigState {
  firebase: {
    apiKey: string;
    projectId: string;
    storageBucket: string;
    authDomain: string;
    messagingSenderId: string;
    appId: string;
    measurementId: string;
  };
  github: {
    repoUrl: string;
    branch: string;
    token: string;
  };
  initialized: boolean;
}

export interface FileMetadata {
  path: string;
  type: 'json' | 'html';
  name: string;
  isDirty: boolean;
  content?: string;
}

export interface EditorBlock {
  id: string;
  type: string;
  fields: Record<string, any>;
}

export interface EditorPage {
  path: string;
  type: 'json' | 'html';
  name: string;
  content: string;
  isDirty: boolean;
  lastModified?: Date;
}
