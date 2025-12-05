// IndexedDB utility for storing PDF files
const DB_NAME = 'ResumeCheckerDB';
const DB_VERSION = 1;
const STORE_NAME = 'pdfs';

// Initialize IndexedDB
async function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

// Store PDF blob in IndexedDB
export async function storePDF(pdfId: string, file: File): Promise<void> {
  try {
    // Convert File to ArrayBuffer for proper storage
    const arrayBuffer = await file.arrayBuffer();
    const data = {
      name: file.name,
      type: file.type,
      lastModified: file.lastModified,
      data: arrayBuffer
    };
    
    const db = await getDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.put(data, pdfId);
      request.onsuccess = () => {
        console.log('PDF stored successfully in IndexedDB with ID:', pdfId);
        resolve();
      };
      request.onerror = () => {
        console.error('Error storing PDF in IndexedDB:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Failed to store PDF in IndexedDB:', error);
    throw error;
  }
}

// Retrieve PDF blob from IndexedDB
export async function getPDF(pdfId: string): Promise<File | null> {
  try {
    const db = await getDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.get(pdfId);
      request.onsuccess = () => {
        const result = request.result;
        if (!result) {
          console.warn('No data found in IndexedDB for PDF ID:', pdfId);
          resolve(null);
          return;
        }
        
        // Reconstruct File object from stored data
        if (result.data && result.data instanceof ArrayBuffer) {
          const file = new File(
            [result.data],
            result.name || 'resume.pdf',
            {
              type: result.type || 'application/pdf',
              lastModified: result.lastModified || Date.now()
            }
          );
          console.log('PDF retrieved successfully from IndexedDB:', pdfId);
          resolve(file);
        } else if (result instanceof File) {
          // Legacy: if it's already a File object (from old storage)
          console.log('PDF retrieved as File object from IndexedDB:', pdfId);
          resolve(result);
        } else {
          console.warn('Unexpected data format in IndexedDB for PDF ID:', pdfId, result);
          resolve(null);
        }
      };
      request.onerror = () => {
        console.error('Error retrieving PDF from IndexedDB:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Failed to retrieve PDF from IndexedDB:', error);
    return null;
  }
}

// Delete PDF from IndexedDB
export async function deletePDF(pdfId: string): Promise<void> {
  try {
    const db = await getDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.delete(pdfId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to delete PDF from IndexedDB:', error);
    throw error;
  }
}

// Generate unique ID for PDF
export function generatePDFId(): string {
  return `pdf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

