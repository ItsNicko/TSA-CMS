import { create } from 'zustand';
import { ConfigState, FileMetadata, EditorPage } from './types';

interface AppStore {
  config: ConfigState | null;
  setConfig: (config: ConfigState) => void;
  
  files: FileMetadata[];
  setFiles: (files: FileMetadata[]) => void;
  
  currentPage: EditorPage | null;
  setCurrentPage: (page: EditorPage | null) => void;
  updateCurrentPageContent: (content: string) => void;
  
  user: any;
  setUser: (user: any) => void;
  
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  config: null,
  setConfig: (config) => set({ config }),
  
  files: [],
  setFiles: (files) => set({ files }),
  
  currentPage: null,
  setCurrentPage: (page) => set({ currentPage: page }),
  updateCurrentPageContent: (content) => set((state) => 
    state.currentPage ? { 
      currentPage: { 
        ...state.currentPage, 
        content,
        isDirty: true 
      } 
    } : {}
  ),
  
  user: null,
  setUser: (user) => set({ user }),
  
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),
}));
