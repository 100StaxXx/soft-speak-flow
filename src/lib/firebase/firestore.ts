import {
  collection,
  doc,
  getDoc,
  getDocs,
  getDocsFromCache,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
  Timestamp,
  serverTimestamp,
  writeBatch,
  increment,
  arrayUnion,
  arrayRemove,
  onSnapshot as firestoreOnSnapshot,
  Unsubscribe,
} from "firebase/firestore";
import { firebaseDb } from "../firebase";

// Helper to convert Firestore Timestamp to ISO string
export const timestampToISO = (timestamp: Timestamp | string | null | undefined): string | null => {
  if (!timestamp) return null;
  if (typeof timestamp === 'string') return timestamp;
  if (timestamp instanceof Timestamp) return timestamp.toDate().toISOString();
  // Handle Firestore Timestamp-like objects
  if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp) {
    return (timestamp as Timestamp).toDate().toISOString();
  }
  return null;
};

// Helper to convert ISO string to Firestore Timestamp
export const isoToTimestamp = (iso: string | null | undefined): Timestamp | null => {
  if (!iso) return null;
  return Timestamp.fromDate(new Date(iso));
};

// Generic get document
export const getDocument = async <T = DocumentData>(
  collectionName: string,
  docId: string
): Promise<T | null> => {
  const docRef = doc(firebaseDb, collectionName, docId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    return null;
  }
  
  return { id: docSnap.id, ...docSnap.data() } as T;
};

// Batch get multiple documents by IDs (much faster than individual fetches)
export const getDocumentsByIds = async <T = DocumentData>(
  collectionName: string,
  docIds: string[]
): Promise<Map<string, T>> => {
  if (docIds.length === 0) {
    return new Map();
  }

  // Firestore getAll can fetch up to 10 documents at once
  // Split into chunks of 10 to handle larger batches
  const chunkSize = 10;
  const chunks: string[][] = [];
  for (let i = 0; i < docIds.length; i += chunkSize) {
    chunks.push(docIds.slice(i, i + chunkSize));
  }

  const results = new Map<string, T>();

  // Fetch all chunks in parallel
  await Promise.all(
    chunks.map(async (chunk) => {
      const docRefs = chunk.map((id) => doc(firebaseDb, collectionName, id));
      try {
        // Use Promise.all with getDoc instead of getAll (getAll was removed in Firebase v10+)
        const snapshots = await Promise.all(docRefs.map(ref => getDoc(ref)));
        snapshots.forEach((docSnap) => {
          if (docSnap.exists()) {
            results.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as T);
          }
        });
      } catch (error) {
        console.error(`[getDocumentsByIds] Error fetching chunk:`, error);
        // Continue with other chunks even if one fails
      }
    })
  );

  return results;
};

// Generic get documents with filters
export const getDocuments = async <T = DocumentData>(
  collectionName: string,
  filters?: Array<[string, any, any]>,
  orderByField?: string,
  orderDirection?: "asc" | "desc",
  limitCount?: number
): Promise<T[]> => {
  let q = query(collection(firebaseDb, collectionName));
  
  if (filters) {
    filters.forEach(([field, operator, value]) => {
      q = query(q, where(field, operator, value));
    });
  }
  
  if (orderByField) {
    q = query(q, orderBy(orderByField, orderDirection || "desc"));
  }
  
  if (limitCount) {
    q = query(q, limit(limitCount));
  }
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as T[];
};

// Generic create/update document
export const setDocument = async <T = DocumentData>(
  collectionName: string,
  docId: string,
  data: Partial<T>,
  merge = true
): Promise<void> => {
  const docRef = doc(firebaseDb, collectionName, docId);
  const dataWithTimestamps = {
    ...data,
    updated_at: serverTimestamp(),
    ...(merge ? {} : { created_at: serverTimestamp() }),
  };
  
  await setDoc(docRef, dataWithTimestamps, { merge });
};

// Generic update document
export const updateDocument = async <T = DocumentData>(
  collectionName: string,
  docId: string,
  data: Partial<T>
): Promise<void> => {
  const docRef = doc(firebaseDb, collectionName, docId);
  await updateDoc(docRef, {
    ...data,
    updated_at: serverTimestamp(),
  });
};

// Generic delete document
export const deleteDocument = async (
  collectionName: string,
  docId: string
): Promise<void> => {
  const docRef = doc(firebaseDb, collectionName, docId);
  await deleteDoc(docRef);
};

// Batch operations
export const batchWrite = async (
  operations: Array<{
    type: "set" | "update" | "delete";
    collection: string;
    docId: string;
    data?: any;
  }>
): Promise<void> => {
  const batch = writeBatch(firebaseDb);
  
  operations.forEach((op) => {
    const docRef = doc(firebaseDb, op.collection, op.docId);
    
    switch (op.type) {
      case "set":
        batch.set(docRef, {
          ...op.data,
          updated_at: serverTimestamp(),
        });
        break;
      case "update":
        batch.update(docRef, {
          ...op.data,
          updated_at: serverTimestamp(),
        });
        break;
      case "delete":
        batch.delete(docRef);
        break;
    }
  });
  
  await batch.commit();
};

// Increment field
export const incrementField = async (
  collectionName: string,
  docId: string,
  field: string,
  amount: number
): Promise<void> => {
  const docRef = doc(firebaseDb, collectionName, docId);
  await updateDoc(docRef, {
    [field]: increment(amount),
    updated_at: serverTimestamp(),
  });
};

// Array operations
export const addToArray = async (
  collectionName: string,
  docId: string,
  field: string,
  value: any
): Promise<void> => {
  const docRef = doc(firebaseDb, collectionName, docId);
  await updateDoc(docRef, {
    [field]: arrayUnion(value),
    updated_at: serverTimestamp(),
  });
};

export const removeFromArray = async (
  collectionName: string,
  docId: string,
  field: string,
  value: any
): Promise<void> => {
  const docRef = doc(firebaseDb, collectionName, docId);
  await updateDoc(docRef, {
    [field]: arrayRemove(value),
    updated_at: serverTimestamp(),
  });
};

// Real-time listener for a single document
export const onSnapshot = (
  params: { collection: string; docId: string },
  callback: (data: DocumentData | null) => void | Promise<void>,
  onError?: (error: Error) => void
): Unsubscribe => {
  const docRef = doc(firebaseDb, params.collection, params.docId);
  
  return firestoreOnSnapshot(
    docRef,
    (snapshot) => {
      const data = snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
      callback(data);
    },
    (error) => {
      if (onError) {
        onError(error);
      } else {
        console.error("Firestore snapshot error:", error);
      }
    }
  );
};

