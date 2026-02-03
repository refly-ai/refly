import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export interface UploadProgress {
  id: string;
  fileName: string;
  progress: number; // 0-100
  status: 'uploading' | 'success' | 'error';
  error?: string;
}

interface ImageUploadState {
  uploads: UploadProgress[];
  isUploading: boolean;
  totalFiles: number;
  completedFiles: number;

  // Actions
  startUpload: (files: UploadProgress[]) => void;
  updateProgress: (id: string, progress: number) => void;
  setUploadSuccess: (id: string) => void;
  setUploadError: (id: string, error: string) => void;
  clearUploads: () => void;
  removeUpload: (id: string) => void;
}

export const useImageUploadStore = create<ImageUploadState>()(
  subscribeWithSelector((set) => ({
    uploads: [],
    isUploading: false,
    totalFiles: 0,
    completedFiles: 0,

    startUpload: (files: UploadProgress[]) => {
      const newUploads: UploadProgress[] = files;

      set((state) => {
        // Keep existing uploads and add new ones
        const allUploads = [...state.uploads, ...newUploads];
        const completedFiles = allUploads.filter((upload) => upload.status === 'success').length;
        const isUploading = completedFiles < allUploads.length;

        return {
          uploads: allUploads,
          isUploading,
          totalFiles: allUploads.length,
          completedFiles,
        };
      });
    },

    updateProgress: (id: string, progress: number) => {
      set((state) => ({
        uploads: state.uploads.map((upload) =>
          upload.id === id ? { ...upload, progress } : upload,
        ),
      }));
    },

    setUploadSuccess: (id: string) => {
      set((state) => {
        const updatedUploads = state.uploads.map((upload) =>
          upload.id === id ? { ...upload, status: 'success' as const, progress: 100 } : upload,
        );

        const completedFiles = updatedUploads.filter(
          (upload) => upload.status === 'success',
        ).length;
        const isUploading = completedFiles < updatedUploads.length;

        return {
          uploads: updatedUploads,
          completedFiles,
          isUploading,
          totalFiles: updatedUploads.length,
        };
      });
    },

    setUploadError: (id: string, error: string) => {
      set((state) => {
        const updatedUploads = state.uploads.map((upload) =>
          upload.id === id ? { ...upload, status: 'error' as const, error } : upload,
        );

        const completedFiles = updatedUploads.filter(
          (upload) => upload.status === 'success',
        ).length;
        const isUploading = completedFiles < updatedUploads.length;

        return {
          uploads: updatedUploads,
          completedFiles,
          isUploading,
          totalFiles: updatedUploads.length,
        };
      });
    },

    clearUploads: () => {
      set({
        uploads: [],
        isUploading: false,
        totalFiles: 0,
        completedFiles: 0,
      });
    },

    removeUpload: (id: string) => {
      set((state) => {
        const updatedUploads = state.uploads.filter((upload) => upload.id !== id);
        const completedFiles = updatedUploads.filter(
          (upload) => upload.status === 'success',
        ).length;
        const isUploading = completedFiles < updatedUploads.length;

        return {
          uploads: updatedUploads,
          completedFiles,
          isUploading,
          totalFiles: updatedUploads.length,
        };
      });
    },
  })),
);

export const useImageUploadStoreShallow = <T>(selector: (state: ImageUploadState) => T): T =>
  useImageUploadStore(selector);
