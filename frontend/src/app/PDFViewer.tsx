'use client';

import { useState, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

// Set up PDF.js worker
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
}

interface PDFViewerProps {
  pdfUrl: string;
  numPages: number;
  onDocumentLoadSuccess: ({ numPages }: { numPages: number }) => void;
}

export function PDFViewer({ pdfUrl, numPages, onDocumentLoadSuccess }: PDFViewerProps) {
  const [pageWidth, setPageWidth] = useState(600);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const calculateWidth = () => {
      if (typeof window !== 'undefined') {
        const width = window.innerWidth < 1024 
          ? window.innerWidth - 80 
          : window.innerWidth * 0.4;
        setPageWidth(Math.min(600, width));
      }
    };

    calculateWidth();
    window.addEventListener('resize', calculateWidth);
    return () => window.removeEventListener('resize', calculateWidth);
  }, []);

  if (!isClient) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto max-h-[70vh] border border-gray-200 rounded-lg bg-gray-50 p-4">
      <Document
        file={pdfUrl}
        onLoadSuccess={onDocumentLoadSuccess}
        loading={
          <div className="flex items-center justify-center p-8">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        }
        error={
          <div className="p-8 text-center text-gray-600">
            <p>Failed to load PDF preview.</p>
            <p className="text-sm mt-2">Only PDF files can be previewed.</p>
          </div>
        }
      >
        {numPages > 0 && Array.from(new Array(numPages), (el, index) => (
          <Page
            key={`page_${index + 1}`}
            pageNumber={index + 1}
            width={pageWidth}
            renderTextLayer={true}
            renderAnnotationLayer={true}
            className="mb-4 shadow-md mx-auto"
          />
        ))}
      </Document>
    </div>
  );
}

