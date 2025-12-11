import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject, UploadResult } from "firebase/storage";
import { firebaseApp } from "../firebase";

// Re-export for convenience
export { firebaseApp };

const storage = getStorage(firebaseApp);

/**
 * Upload a file to Firebase Storage
 * @param bucketName - The storage bucket name (e.g., 'companion-images')
 * @param filePath - The path where the file should be stored
 * @param file - The file to upload (File or Blob)
 * @returns The download URL of the uploaded file
 */
export const uploadFile = async (
  bucketName: string,
  filePath: string,
  file: File | Blob
): Promise<string> => {
  const storageRef = ref(storage, `${bucketName}/${filePath}`);
  const snapshot = await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(snapshot.ref);
  return downloadURL;
};

/**
 * Get a download URL for a file in Firebase Storage
 * @param bucketName - The storage bucket name
 * @param filePath - The path to the file
 * @returns The download URL
 */
export const getFileDownloadURL = async (
  bucketName: string,
  filePath: string
): Promise<string> => {
  const storageRef = ref(storage, `${bucketName}/${filePath}`);
  return await getDownloadURL(storageRef);
};

/**
 * Delete a file from Firebase Storage
 * @param bucketName - The storage bucket name
 * @param filePath - The path to the file to delete
 */
export const deleteFile = async (
  bucketName: string,
  filePath: string
): Promise<void> => {
  const storageRef = ref(storage, `${bucketName}/${filePath}`);
  await deleteObject(storageRef);
};

/**
 * Upload a file with metadata
 * @param bucketName - The storage bucket name
 * @param filePath - The path where the file should be stored
 * @param file - The file to upload
 * @param metadata - Optional metadata to attach to the file
 * @returns The download URL and upload result
 */
export const uploadFileWithMetadata = async (
  bucketName: string,
  filePath: string,
  file: File | Blob,
  metadata?: Record<string, string>
): Promise<{ url: string; result: UploadResult }> => {
  const storageRef = ref(storage, `${bucketName}/${filePath}`);
  const uploadMetadata = metadata
    ? {
        customMetadata: metadata,
      }
    : undefined;
  
  const snapshot = await uploadBytes(storageRef, file, uploadMetadata);
  const downloadURL = await getDownloadURL(snapshot.ref);
  
  return {
    url: downloadURL,
    result: snapshot,
  };
};
