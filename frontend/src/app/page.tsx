'use client';

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { jobTitles, sectors } from "../data/options";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { storePDF, getPDF, generatePDFId } from "./pdfStorage";




// In Docker: use NEXT_PUBLIC_API_URL
// In Electron / Local browser: fallback to localhost
const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";

// Dynamically import PDF components with SSR disabled
const PDFViewer = dynamic(
  () => import("./PDFViewer").then((mod) => mod.PDFViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    ),
  }
);





type Section = { title: string; content: string };
type HistoryEntry = {
  filename: string;
  date: string;
  provider: string;
  sections: Section[];
  pdfId?: string; // IndexedDB ID for the PDF file
  pdfData?: string; // Legacy: Base64 encoded PDF data (for old entries)
  fileType?: string; // MIME type (e.g., "application/pdf")
};

export default function Home() {
  const [jobTitle, setJobTitle] = useState("");
  const [sector, setSector] = useState("");
  const [level, setLevel] = useState("Junior");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const [provider, setProvider] = useState<"ollama" | "openai" | "gemini">("ollama");
  const [apiKey, setApiKey] = useState("");
  const [loadingMessage, setLoadingMessage] = useState(" AI engine is analyzing your resume...");

  const [connectionStatus, setConnectionStatus] =
    useState<"idle" | "testing" | "success" | "error">("idle");

  const [sections, setSections] = useState<Section[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [isClient, setIsClient] = useState(false);
  // Track which history entry is currently open (used for sessionStorage persistence)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("resumeHistory");
    if (saved) {
      const parsedHistory = JSON.parse(saved);
      setHistory(parsedHistory);
      
      // Restore current history entry from sessionStorage after page reload
      const savedHistoryId = sessionStorage.getItem("currentHistoryId");
      if (savedHistoryId && parsedHistory.length > 0) {
        const currentEntry = parsedHistory.find((entry: HistoryEntry) => entry.date === savedHistoryId);
        if (currentEntry && currentEntry.sections.length > 0) {
          // Restore the history entry state
          setSections(currentEntry.sections);
          setCurrentHistoryId(savedHistoryId);
          
          // Restore PDF if available
          if (currentEntry.pdfId && currentEntry.fileType === "application/pdf") {
            getPDF(currentEntry.pdfId).then((pdfFile) => {
              if (pdfFile) {
                const url = URL.createObjectURL(pdfFile);
                setPdfUrl(url);
              }
            }).catch((error) => {
              console.error("Failed to restore PDF after reload:", error);
            });
          }
        }
      }
    }
  }, []);

  useEffect(() => {
    if (!loading) return; 

    const messages = [
      " AI engine is analyzing your resume...",
      " Extracting key skills and experiences...",
      " Evaluating ATS compatibility...",
      " Reviewing your achievements and metrics...",
      " Almost ready — generating your personalized insights..."
    ];
    let i = 0;

    const interval = setInterval(() => {
      i = (i + 1) % messages.length;
      setLoadingMessage(messages[i]);
    }, 3000);

    return () => clearInterval(interval);
  }, [loading]);

  // ---------- BACKEND FETCH (Direct 127.0.0.1 connection) ----------
  const fetchBackend = async (
    endpoint: string,
    options?: RequestInit
  ): Promise<Response> => {
    try {
      const url = `${BACKEND_URL}${endpoint}`;
      console.log(`🔗 Connecting to backend: ${url}`);

      const res = await fetch(url, {
        ...options,
        cache: 'no-store'
      });

      if (res.ok) {
        console.log(` Backend responded successfully: ${url}`);
        return res;
      } else {
        console.error(` Backend error (${res.status}): ${url}`);
        throw new Error(`Backend returned error: ${res.status} ${res.statusText}`);
      }
    } catch (error) {
      console.error(` Failed to connect to backend: ${BACKEND_URL}${endpoint}`, error);
      throw new Error(`Failed to reach backend. Please ensure backend is running at ${BACKEND_URL}`);
    }
  };

  // ---------- CHECK OLLAMA (via backend proxy) ----------
  const isOllamaAvailable = async (): Promise<boolean> => {
    try {
      const res = await fetchBackend("/api/check-ollama");
      const data = await res.json();

      if (data.installed === true) {
        console.log(" Ollama is installed and running");
        return true;
      } else {
        console.log(" Ollama is not installed");
        return false;
      }
    } catch (error) {
      console.error(" Failed to check Ollama - backend unreachable:", error);
      return false;
    }
  };

  // ---------- TEST CONNECTION ----------
  const testConnection = async () => {
    if ((provider === "openai" || provider === "gemini") && !apiKey) {
      alert("Please enter your API key before testing.");
      return;
    }
    setConnectionStatus("testing");
    try {
      const formData = new FormData();
      formData.append("provider", provider);
      if (apiKey) formData.append("api_key", apiKey);

      const res = await fetchBackend("/ai/test", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setConnectionStatus(data.ok ? "success" : "error");
    } catch (error) {
      console.error("Connection test failed:", error);
      setConnectionStatus("error");
      alert(`Could not connect to backend at ${BACKEND_URL}`);
    }
  };

  // ---------- ANALYZE ----------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return alert("Please upload your resume first!");

    const formData = new FormData();
    formData.append("job_title", jobTitle);
    formData.append("sector", sector);
    formData.append("experience_level", level);
    formData.append("provider", provider);
    if (provider !== "ollama" && apiKey) formData.append("api_key", apiKey);
    formData.append("file", file);

    setLoading(true);
    setSections([]);
    setCurrentIndex(0);
    setCurrentHistoryId(null); // Clear history ID for new analysis
    sessionStorage.removeItem("currentHistoryId"); // Clear persisted history ID

    // Create PDF URL for preview
    if (file.type === "application/pdf") {
      // Clean up old PDF URL if exists
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
      const url = URL.createObjectURL(file);
      setPdfUrl(url);
    } else {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
      setPdfUrl(null);
    }

    try {
      const res = await fetchBackend("/analyze", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      const text = data.analysis || "No analysis result.";

      parseSections(text);
      await saveToHistory(file.name, provider, text, file);
    } catch (error) {
      console.error("Analysis failed:", error);
      alert(`Failed to reach backend or analyze file.\n\nBackend URL: ${BACKEND_URL}\nPlease ensure the backend server is running.`);
    } finally {
      setLoading(false);
    }
  };

  // ---------- RE-ANALYZE ----------
  const handleReAnalyze = () => {
    // Clear everything and return to upload form
    // When user reopens the history entry later, PDF will be restored via loadFromHistory
    setSections([]);
    setCurrentIndex(0);
    setNumPages(0);
    setCurrentHistoryId(null);
    sessionStorage.removeItem("currentHistoryId");
    
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
    }
    setPdfUrl(null);
  };

  // Cleanup PDF URL on unmount
  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  // PDF load success handler
  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  // ---------- PARSE ----------
  const parseSections = (text: string) => {
    const parts = text.split(/(?=### )/g);
    const parsed = parts
      .map((chunk) => {
        const lines = chunk.trim().split("\n");
        const title = lines[0]?.replace("###", "").trim() || "Section";
        let content = lines.slice(1).join("\n").replace(/\n{2,}/g, "\n").trim();
  
        // Automatic bold formatter and space formatter
        content = content
          .replace(/(^|\n)(Strengths?:)\s*\n+/gi, "\n**$2** ")  
          .replace(/(^|\n)(Weaknesses\/?Missing:?)\s*\n+/gi, "\n**$2** ")  
          .replace(/(^|\n)(Suggestions?:)\s*\n+/gi, "\n**$2** ")  
          .replace(/(^|\n)(Example:?)\s*\n+/gi, "\n**$2** ");  
  
        return { title, content };
      })
      .filter((s) => s.content.length > 0);
  
    setSections(parsed);
  };

  // ---------- HISTORY ----------
  const saveToHistory = async (filename: string, provider: string, text: string, file: File | null) => {
    const parts = text.split(/(?=### )/g).map((chunk) => {
      const lines = chunk.trim().split("\n");
      const title = lines[0]?.replace("###", "").trim() || "Section";
      const content = lines.slice(1).join("\n").trim();
      return { title, content };
    });

    // Store PDF file in IndexedDB if it's a PDF
    let pdfId: string | undefined;
    let fileType: string | undefined;
    
    if (file && file.type === "application/pdf") {
      try {
        pdfId = generatePDFId();
        console.log("Storing PDF in IndexedDB with ID:", pdfId, "for file:", filename);
        await storePDF(pdfId, file);
        fileType = file.type;
        console.log("PDF stored successfully, ID:", pdfId);
        
        // Verify storage by trying to retrieve it
        const verifyFile = await getPDF(pdfId);
        if (verifyFile) {
          console.log("PDF storage verified successfully");
        } else {
          console.warn("PDF storage verification failed - file not found after storing");
        }
      } catch (error) {
        console.error("Failed to store PDF in IndexedDB:", error);
        // Don't set pdfId if storage failed
        pdfId = undefined;
      }
    } else {
      console.log("File is not a PDF, skipping storage. File type:", file?.type);
    }

    const entry: HistoryEntry = {
      filename,
      date: new Date().toISOString(),
      provider,
      sections: parts,
      pdfId,
      fileType,
    };
    const updated = [entry, ...history].slice(0, 25);
    setHistory(updated);
    localStorage.setItem("resumeHistory", JSON.stringify(updated));
    
    // Set this as the current history entry
    setCurrentHistoryId(entry.date); // Use date as unique identifier
  };

  const loadFromHistory = async (entry: HistoryEntry) => {
    // Always clean up the current PDF URL first to prevent memory leaks
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
    }

    setSections(entry.sections);
    setCurrentIndex(0);
    setShowHistory(false);
    setNumPages(0); // Reset page count
    setCurrentHistoryId(entry.date); // Track which history entry is open
    sessionStorage.setItem("currentHistoryId", entry.date); // Persist across page reloads

    // Restore PDF preview - try IndexedDB first, then fallback to legacy base64
    // Check if entry has PDF data (pdfId or pdfData) - also check fileType or filename extension
    const hasPDF = (entry.pdfId || entry.pdfData) && 
                   (entry.fileType === "application/pdf" || entry.filename.toLowerCase().endsWith('.pdf'));
    
    if (hasPDF) {
      let pdfFile: File | null = null;

      // Try IndexedDB first (new format)
      if (entry.pdfId) {
        try {
          console.log("Loading PDF from IndexedDB with ID:", entry.pdfId, "for entry:", entry.filename);
          pdfFile = await getPDF(entry.pdfId);
          if (pdfFile) {
            console.log("PDF loaded successfully from IndexedDB");
          } else {
            console.warn("PDF not found in IndexedDB for entry:", entry.filename, "pdfId:", entry.pdfId);
          }
        } catch (error) {
          console.error("Failed to retrieve PDF from IndexedDB:", error);
        }
      }

      // Fallback to legacy base64 format (old entries)
      if (!pdfFile && entry.pdfData) {
        try {
          console.log("Loading PDF from legacy base64 format for entry:", entry.filename);
          const binaryString = atob(entry.pdfData);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          pdfFile = new File([bytes], entry.filename, { type: entry.fileType || "application/pdf" });
          
          // Migrate to IndexedDB for future use
          const pdfId = generatePDFId();
          await storePDF(pdfId, pdfFile);
          
          // Update the entry with the new pdfId
          const updatedHistory = history.map((h) =>
            h.date === entry.date ? { ...h, pdfId, pdfData: undefined, fileType: "application/pdf" } : h
          );
          setHistory(updatedHistory);
          localStorage.setItem("resumeHistory", JSON.stringify(updatedHistory));
          console.log("Migrated PDF to IndexedDB with ID:", pdfId);
        } catch (error) {
          console.error("Failed to restore PDF from base64:", error);
        }
      }

      if (pdfFile) {
        const url = URL.createObjectURL(pdfFile);
        console.log("PDF URL created successfully for entry:", entry.filename);
        console.log("Setting pdfUrl state...");
        setPdfUrl(url);
        console.log("pdfUrl state has been set");
      } else {
        console.warn("No PDF file could be loaded for entry:", entry.filename, "pdfId:", entry.pdfId);
        setPdfUrl(null);
      }
    } else {
      // This entry doesn't have a PDF (non-PDF file or missing PDF data)
      console.log("Entry has no PDF data:", entry.filename, "pdfId:", entry.pdfId, "fileType:", entry.fileType);
      setPdfUrl(null);
    }
  };

  // ---------- SAVE ----------
  const handleDownload = async (type: "pdf" | "txt") => {
    const content = sections
      .map((s) => `### ${s.title}\n\n${s.content}`)
      .join("\n\n--------------------------------\n\n");

    if (type === "txt") {
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "resume_feedback.txt";
      a.click();
      URL.revokeObjectURL(url);
    } else if (type === "pdf") {
      const { jsPDF } = await import("jspdf");
      
      // Create PDF document - A4 portrait
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      // Page dimensions in mm
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 20;
      const maxWidth = pageWidth - (margin * 2);
      let yPosition = margin;
      
      // Font sizes
      const titleFontSize = 14;
      const textFontSize = 11;
      
      // Dynamic line heights based on font size (1.2x font size for readability)
      const getLineHeight = (fontSize: number) => fontSize * 1.2;
      const titleLineHeight = getLineHeight(titleFontSize);
      const textLineHeight = getLineHeight(textFontSize);
      
      // Spacing constants
      const sectionSpacing = 12;
      const paragraphSpacing = 4;
      const titleBottomSpacing = 6;

      // Helper function to split text into lines that fit the page width
      const splitTextIntoLines = (text: string, maxWidth: number, fontSize: number): string[] => {
        pdf.setFontSize(fontSize);
        const words = text.split(' ');
        const lines: string[] = [];
        let currentLine = '';

        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const testWidth = pdf.getTextWidth(testLine);

          if (testWidth > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) {
          lines.push(currentLine);
        }
        return lines;
      };

      // Helper function to check and add new page if needed
      const ensureSpace = (requiredHeight: number): void => {
        if (yPosition + requiredHeight > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
        }
      };

      // Helper function to add spacing
      const addSpacing = (spacing: number): void => {
        ensureSpace(spacing);
        yPosition += spacing;
      };

      // Process each section
      sections.forEach((section, sectionIndex) => {
        // Add spacing before section (except first)
        if (sectionIndex > 0) {
          addSpacing(sectionSpacing);
        }

        // Add section title (bold)
        const titleLines = splitTextIntoLines(section.title, maxWidth, titleFontSize);
        pdf.setFontSize(titleFontSize);
        pdf.setFont('helvetica', 'bold');
        
        titleLines.forEach((line) => {
          ensureSpace(titleLineHeight);
          pdf.text(line, margin, yPosition);
          yPosition += titleLineHeight;
        });

        // Add spacing after title
        addSpacing(titleBottomSpacing);

        // Process section content
        pdf.setFontSize(textFontSize);
        pdf.setFont('helvetica', 'normal');

        // Remove markdown formatting and split into paragraphs
        let content = section.content;
        
        // Remove markdown bold markers but keep the text
        content = content.replace(/\*\*(.+?)\*\*/g, '$1');
        content = content.replace(/\*(.+?)\*/g, '$1');
        
        // Handle single newlines and double newlines
        // First, split by double newlines for paragraphs
        const paragraphs = content.split(/\n\n+/).filter(p => p.trim());

        paragraphs.forEach((paragraph, paraIndex) => {
          const trimmed = paragraph.trim();
          if (!trimmed) return;

          // Split paragraph into lines (handling single newlines within paragraph)
          const lines = trimmed.split('\n').flatMap(line => {
            const trimmedLine = line.trim();
            if (!trimmedLine) return [];
            return splitTextIntoLines(trimmedLine, maxWidth, textFontSize);
          });

          // Add each line with proper spacing
          lines.forEach((line) => {
            ensureSpace(textLineHeight);
            pdf.text(line, margin, yPosition);
            yPosition += textLineHeight;
          });

          // Add spacing between paragraphs (except after last paragraph)
          if (paraIndex < paragraphs.length - 1) {
            addSpacing(paragraphSpacing);
          }
        });

        // Add divider line between sections (except last)
        if (sectionIndex < sections.length - 1) {
          const dividerHeight = 8;
          ensureSpace(dividerHeight);
          addSpacing(4);
          pdf.setDrawColor(200, 200, 200);
          pdf.line(margin, yPosition, pageWidth - margin, yPosition);
          addSpacing(4);
        }
      });

      // Add copyright footer at the end of the document
      // Get the current page number and add footer to the last page
      const totalPages = pdf.getNumberOfPages();
      pdf.setPage(totalPages);
      
      // Set font for footer
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(128, 128, 128);
      
      // Add footer text at the bottom center of the last page
      // Convert mm to the coordinate system (pageHeight - margin - 5mm from bottom)
      const footerY = pageHeight - 10;
      pdf.text("© Resume Checker AI — Local Client Version", pageWidth / 2, footerY, { align: "center" });

      // Save the PDF
      pdf.save("resume_feedback.pdf");
    }
  };

  return (
    <main className="relative min-h-screen flex flex-col lg:flex-row items-start justify-center px-4 sm:px-8 lg:px-20 py-8 lg:py-16 overflow-hidden 
  bg-gradient-to-br from-[#ffffff]/80 via-[#ccd7ff]/80 to-[#ccd7ff]/60 
  backdrop-blur-3xl gap-6 lg:gap-0">

      {/*  Sol tab */}
      <div
        className="fixed top-10 left-0 transform -translate-y-1/2 z-40 bg-blue-600 text-white text-sm font-semibold px-3 py-2 rounded-r-lg shadow-md cursor-pointer hover:bg-blue-700 transition"
        onClick={() => setShowHistory(!showHistory)}
      >
        📜 History
      </div>

      {/*  Slide panel */}
      <div
  className={`fixed top-0 left-0 h-full w-[350px] bg-white shadow-2xl border-r border-gray-200 transform transition-transform duration-500 ease-in-out z-50 ${
    showHistory ? "translate-x-0" : "-translate-x-full"
  }`}
>
  <div className="p-5 h-full flex flex-col">
    {/* Header */}
    <div className="flex justify-between items-center mb-4">
      <h3 className="text-lg font-bold text-gray-800">📄 Saved Analyses</h3>
      <div className="flex items-center gap-2">
        {history.length > 0 && (
          <button
            onClick={() => {
              if (confirm("Are you sure you want to delete all saved analyses?")) {
                setHistory([]);
                localStorage.removeItem("resumeHistory");
              }
            }}
            className="text-xs text-red-500 hover:text-red-700"
          >
            🧹 Clear All
          </button>
        )}
        <button
          onClick={() => setShowHistory(false)}
          className="text-gray-500 hover:text-gray-800"
        >
          ✖
        </button>
      </div>
    </div>

    {/* List */}
    <div className="overflow-y-auto flex-1">
      {history.length === 0 ? (
        <p className="text-gray-500 text-sm">No analyses yet.</p>
      ) : (
        <ul className="space-y-3">
          {history.map((entry, i) => (
            <li
              key={i}
              className="border rounded-lg p-3 hover:bg-gray-50 cursor-pointer group relative"
            >
              {/* Delete icon */}
              <button
                className="absolute top-2 right-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete analysis: "${entry.filename}" ?`)) {
                    const updated = history.filter((_, idx) => idx !== i);
                    setHistory(updated);
                    localStorage.setItem("resumeHistory", JSON.stringify(updated));
                  }
                }}
              >
                🗑️
              </button>

              {/* When clicked, load */}
              <div onClick={() => loadFromHistory(entry)}>
                <div className="font-semibold text-gray-800 truncate pr-6">
                  {entry.filename}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(entry.date).toLocaleString()} • {entry.provider}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  </div>
</div>

      {/* Conditional Layout: Split view when analysis complete, otherwise show title + form */}
      {!loading && sections.length === 0 ? (
        <>
          {/* Left panel - Title and description */}
          <section className="w-full lg:w-1/2 flex flex-col justify-center items-start space-y-6 lg:pr-10 relative">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8 }}
              className="animate-fadeIn"
            >
              <motion.h1
                className="text-4xl sm:text-5xl font-serif font-normal text-gray-800 leading-tight mb-4 flex flex-wrap gap-2"
                initial="hidden"
                animate="show"
                variants={{
                  hidden: { opacity: 0 },
                  show: {
                    opacity: 1,
                    transition: {
                      staggerChildren: 0.15,
                    },
                  },
                }}
              >
                {["Elevate", "Your", "Career", "with"].map((word, i) => (
                  <motion.span
                    key={i}
                    variants={{
                      hidden: { opacity: 0, y: 30 },
                      show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
                    }}
                  >
                    {word}
                  </motion.span>
                ))}
                <br />
                {["AI", "Resume", "Intelligence"].map((word, i) => (
                  <motion.span
                    key={`hl-${i}`}
                    variants={{
                      hidden: { opacity: 0, y: 30 },
                      show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
                    }}
                    className="text-blue-600 font-bold"
                  >
                    {word}
                  </motion.span>
                ))}
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.5, duration: 0.8 }}
                className="text-gray-600 text-base sm:text-lg leading-relaxed mb-4 max-w-xl"
              >
                Upload your resume and let our AI engine (Local, OpenAI, or Gemini) evaluate your strengths,
                find improvement areas, and make your CV stand out.
              </motion.p>
            </motion.div>
          </section>
        </>
      ) : !loading && sections.length > 0 ? (
        <div className="w-full flex flex-col">
          {/* Top Row: PDF Preview (Left) + Analysis Results (Right) */}
          <div className="flex flex-col lg:flex-row w-full gap-6 lg:gap-0">
            {/* PDF Preview - Left side (or top on mobile) */}
            <section className="w-full lg:w-1/2 flex flex-col items-start space-y-4 lg:pr-6 relative">
            {pdfUrl && (
              <div className="bg-white shadow-xl rounded-2xl p-4 sm:p-6 w-full border border-gray-100 animate-fadeIn">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-gray-800">PDF Preview</h3>
                  {numPages > 0 && (
                    <span className="text-sm text-gray-500">{numPages} page{numPages > 1 ? 's' : ''}</span>
                  )}
                </div>
                {isClient && (
                  <PDFViewer
                    pdfUrl={pdfUrl}
                    numPages={numPages}
                    onDocumentLoadSuccess={onDocumentLoadSuccess}
                  />
                )}
                {!isClient && (
                  <div className="flex items-center justify-center p-8">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
            )}
            {!pdfUrl && file && file.type !== "application/pdf" && (
              <div className="bg-white shadow-xl rounded-2xl p-6 w-full border border-gray-100 animate-fadeIn">
                <div className="text-center text-gray-600">
                  <p className="text-lg font-semibold mb-2">📄 {file.name}</p>
                  <p className="text-sm">PDF preview is only available for PDF files.</p>
                </div>
              </div>
            )}
          </section>

          {/* Analysis Results - Right side (or bottom on mobile) */}
          {(() => {
            // Filter out ATS section from main card view (it has its own card below)
            const displaySections = sections.filter(s => {
              const title = s.title.toLowerCase();
              return !title.includes("ats") && !title.includes("applicant tracking");
            });
            const currentSection = displaySections[currentIndex] || sections[0];

            return (
          <section className="w-full lg:w-1/2 flex flex-col items-start space-y-4 lg:pl-6 relative">
            <div className="bg-white shadow-xl rounded-2xl p-6 w-full border border-gray-100 animate-fadeIn relative">
              {/* Re-analyze button */}
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold text-gray-900 font-serif leading-tight">{currentSection.title}</h2>
                <button
                  onClick={handleReAnalyze}
                  className="cursor-pointer transition-all bg-blue-500 text-white px-4 py-2 rounded-lg border-blue-600 border-b-[4px] hover:brightness-110 hover:-translate-y-[1px] hover:border-b-[6px] active:border-b-[2px] active:brightness-90 active:translate-y-[2px] font-semibold text-sm whitespace-nowrap ml-4"
                >
                  🔄 Re-analyze
                </button>
              </div>
              

              {/* Score display for Overall Evaluation */}
              {(() => {
                const isOverallEvaluation = currentSection.title.toLowerCase().includes("overall evaluation");
                
                if (!isOverallEvaluation) return null;

                // Extract score - PRIORITIZE CONTENT over title to avoid range formats like "0–100"
                let score: number | null = null;
                const title = currentSection.title;
                const content = currentSection.content;

                // Improved score extraction with flexible regex
                // Matches: "Score: 75/100", "Final Score: 75/100", "SCORE - 75 / 100", etc.
                const scoreMatch = content.match(/score[^0-9]*([0-9]{1,3})\s*\/\s*100/i);

                if (scoreMatch) {
                  const extractedScore = parseInt(scoreMatch[1], 10);
                  if (extractedScore >= 0 && extractedScore <= 100) {
                    score = extractedScore;
                  }
                }

                // Fallback: Try ANY number 0-100 in content (first 10 lines) - but skip if it's part of "0–100" range
                if (score === null) {
                  const contentLines = content.split('\n').slice(0, 10).join(' ');
                  const contentNumbers = contentLines.match(/\b([0-9]{1,3})\b/g);
                  if (contentNumbers) {
                    for (const numStr of contentNumbers) {
                      const num = parseInt(numStr, 10);
                      // Skip 0 and 100 if they appear together (range format)
                      const numIndex = contentLines.indexOf(numStr);
                      const context = contentLines.substring(Math.max(0, numIndex - 10), numIndex + numStr.length + 10);
                      const isRangeFormat = /0\s*[–-]\s*100|100\s*[–-]\s*0/i.test(context);
                      
                      if (!isRangeFormat && num >= 1 && num <= 99) { // Skip 0 and 100 to avoid range formats
                        score = num;
                        break;
                      }
                    }
                  }
                }

                // FOURTH: Try title numbers but skip range formats
                if (score === null) {
                  const titleNumbers = title.match(/\b([0-9]{1,3})\b/g);
                  if (titleNumbers) {
                    for (const numStr of titleNumbers) {
                      const num = parseInt(numStr, 10);
                      // Skip if it's part of "0–100" range format
                      const numIndex = title.indexOf(numStr);
                      const context = title.substring(Math.max(0, numIndex - 5), numIndex + numStr.length + 10);
                      const isRangeFormat = /0\s*[–-]\s*100|100\s*[–-]\s*0|Score\s*0\s*[–-]\s*100/i.test(context);
                      
                      if (!isRangeFormat && num >= 1 && num <= 99) { // Skip 0 and 100
                        score = num;
                        break;
                      }
                    }
                  }
                }

                // LAST RESORT: Search entire content for any 0-100 number (skip ranges)
                if (score === null) {
                  const allNumbers = content.match(/\b([0-9]{1,3})\b/g);
                  if (allNumbers) {
                    for (const numStr of allNumbers) {
                      const num = parseInt(numStr, 10);
                      if (num >= 1 && num <= 99) { // Skip 0 and 100
                        score = num;
                        break;
                      }
                    }
                  }
                }

                const displayScore = score !== null ? score : 'N/A';
                const scoreValue = score !== null ? score : 0;

                return (
                  <motion.div 
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ 
                      duration: 0.6, 
                      ease: [0.16, 1, 0.3, 1],
                      delay: 0.2
                    }}
                    className="rounded-3xl p-5 mb-5 relative overflow-hidden"
                    style={{
                      background: 'linear-gradient(135deg, rgb(179, 208, 253) 0%, rgb(164, 202, 248) 100%)',
                      boxShadow: 'rgba(79, 156, 232, 0.3) 3px 3px 5px 0px, rgba(79, 156, 232, 0.3) 5px 5px 20px 0px'
                    }}
                  >
                    {/* Animated background shimmer effect */}
                    <motion.div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background: 'linear-gradient(135deg, transparent 0%, rgba(255, 255, 255, 0.2) 50%, transparent 100%)',
                        backgroundSize: '200% 200%'
                      }}
                      animate={{
                        backgroundPosition: ['0% 0%', '200% 200%'],
                        opacity: [0.3, 0.6, 0.3]
                      }}
                      transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: 'easeInOut'
                      }}
                    />
                    
                    <div 
                      className="rounded-2xl p-4 relative backdrop-blur-sm transition-all duration-300 hover:shadow-lg"
                      style={{
                        background: 'linear-gradient(135deg, rgb(218, 232, 247) 0%, rgb(214, 229, 247) 100%)'
                      }}
                    >
                      <div className="flex items-center justify-between flex-wrap gap-4 relative z-10">
                        <motion.div 
                          className="flex items-center gap-4"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.5, delay: 0.4 }}
                        >
                          <div className="flex flex-col">
                            <motion.span 
                              className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.4, delay: 0.5 }}
                            >
                              Resume Score
                            </motion.span>
                            <motion.span 
                              className="text-4xl font-extrabold font-mono"
                              style={{ color: 'rgb(79, 156, 232)' }}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ 
                                duration: 0.6, 
                                delay: 0.6,
                                type: 'spring',
                                stiffness: 200,
                                damping: 15
                              }}
                            >
                              {displayScore}<motion.span 
                                className="text-2xl" 
                                style={{ color: 'rgb(158, 189, 217)' }}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.4, delay: 0.8 }}
                              >/100</motion.span>
                            </motion.span>
                          </div>
                        </motion.div>
                        {score !== null && (
                          <motion.span
                            initial={{ opacity: 0, x: 20, scale: 0.9 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            transition={{ 
                              duration: 0.5, 
                              delay: 0.7,
                              type: 'spring',
                              stiffness: 200
                            }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className={`inline-flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-full shadow-md transition-all duration-300 cursor-default ${
                              scoreValue >= 90
                                ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-400 hover:to-emerald-500"
                                : scoreValue >= 80
                                ? "bg-gradient-to-r from-lime-500 to-green-600 text-white hover:from-lime-400 hover:to-green-500"
                                : scoreValue >= 60
                                ? "bg-gradient-to-r from-yellow-400 to-amber-500 text-white hover:from-yellow-300 hover:to-amber-400"
                                : scoreValue >= 40
                                ? "bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-400 hover:to-red-400"
                                : "bg-gradient-to-r from-red-500 to-pink-600 text-white hover:from-red-400 hover:to-pink-500"
                            }`}
                          >
                            <motion.span 
                              className="text-lg"
                              animate={{ 
                                rotate: [0, 10, -10, 0],
                                scale: [1, 1.1, 1]
                              }}
                              transition={{ 
                                duration: 0.6,
                                delay: 0.9,
                                repeat: 0
                              }}
                            >
                              {scoreValue >= 90
                                ? "🎉"
                                : scoreValue >= 80
                                ? "✨"
                                : scoreValue >= 60
                                ? "💪"
                                : scoreValue >= 40
                                ? "📝"
                                : "⚠️"}
                            </motion.span>
                            <motion.span
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.4, delay: 1 }}
                            >
                              {scoreValue >= 90
                                ? "Outstanding!"
                                : scoreValue >= 80
                                ? "Great Work!"
                                : scoreValue >= 60
                                ? "Good Progress"
                                : scoreValue >= 40
                                ? "Needs Work"
                                : "Requires Attention"}
                            </motion.span>
                          </motion.span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })()}
              
              <div className="prose prose-p:my-0 prose-strong:font-semibold prose-h3:my-2 prose-li:my-0 max-h-[60vh] overflow-y-auto leading-relaxed [&>p]:mb-1">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    strong: ({ children }) => {
                      const text = String(children || '');
                      const isHeading = /^(Strengths?:?|Weaknesses?\/?Missing:?|Suggestions?:?|Example:?)$/i.test(text);
                      return (
                        <strong className={`font-bold text-gray-900 ${isHeading ? 'block mt-3 mb-0' : ''}`}>
                          {children}
                        </strong>
                      );
                    },
                    h3: ({ children }) => (
                      <h3 className="text-base font-bold text-gray-900 mt-4 mb-2 pb-1 border-b border-gray-200 font-serif">{children}</h3>
                    ),
                    p: ({ children }) => {
                      return (
                        <p className="leading-relaxed text-gray-700 font-sans text-[15px] my-0">
                          {children}
                        </p>
                      );
                    },
                    em: ({ children }) => (
                      <em className="italic text-gray-700 not-italic font-medium">{children}</em>
                    ),
                  }}
                >
                  {(() => {
                    const cleanContent = currentSection.content
                      // Remove duplicate Example headings (Example followed by Example:)
                      .replace(/\*\*Example:?\*\*\s*\n+\s*\*\*Example:?\*\*/gi, "**Example:**")
                      .replace(/\*\*Example:?\*\*\s*\n+Example:?\s*/gi, "**Example:**\n")

                      .replace(/\*\*(Strengths?:?)\*\*\s*\n+\s*\*\*\1\*\*/gi, "**$1**")
                      .replace(/\*\*(Weaknesses?\/?Missing:?)\*\*\s*\n+\s*\*\*\1\*\*/gi, "**$1**")
                      .replace(/\*\*(Suggestions?:?)\*\*\s*\n+\s*\*\*\1\*\*/gi, "**$1**")
                      // Remove extra newlines after bold headings (Strengths:, Weaknesses:, etc.)
                      .replace(/\*\*(Strengths?:|Weaknesses\/?Missing:?|Suggestions?:|Example:?)\*\*\s*\n+/gi, "**$1**\n")
                      // Remove multiple consecutive newlines (3 or more) with single newline
                      .replace(/\n{3,}/g, "\n")
                      // Remove double newlines (2 consecutive) with single newline for tighter spacing
                      .replace(/\n\n/g, "\n")
                      // Clean up any remaining excessive whitespace
                      .replace(/[ \t]+\n/g, "\n")
                      .trim();
                    return cleanContent;
                  })()}
                </ReactMarkdown>
              </div>

              <div className="mt-6 flex gap-3 justify-end">
                {currentIndex > 0 && (
                  <button
                    className="cursor-pointer transition-all bg-gray-200 text-gray-700 px-4 py-2 rounded-lg border-gray-300 border-b-[4px] hover:brightness-110 hover:-translate-y-[1px] hover:border-b-[6px] active:border-b-[2px] active:brightness-90 active:translate-y-[2px]"
                    onClick={() => setCurrentIndex(currentIndex - 1)}
                  >
                    ← Back
                  </button>
                )}
                {currentIndex < displaySections.length - 1 && (
                  <button
                    className="cursor-pointer transition-all bg-blue-500 text-white px-4 py-2 rounded-lg border-blue-600 border-b-[4px] hover:brightness-110 hover:-translate-y-[1px] hover:border-b-[6px] active:border-b-[2px] active:brightness-90 active:translate-y-[2px]"
                    onClick={() => setCurrentIndex(currentIndex + 1)}
                  >
                    Forward →
                  </button>
                )}
              </div>

              {currentIndex === displaySections.length - 1 && (
                <div className="mt-8 pt-4 border-t text-center">
                  <p className="text-gray-700 mb-4">Save your AI feedback report:</p>
                  <div className="flex justify-center gap-3 flex-wrap">
                    <button
                      className="cursor-pointer transition-all bg-blue-500 text-white px-4 py-2 rounded-lg border-blue-600 border-b-[4px] hover:brightness-110 hover:-translate-y-[1px] hover:border-b-[6px] active:border-b-[2px] active:brightness-90 active:translate-y-[2px]"
                      onClick={() => handleDownload("pdf")}
                    >
                      💾 Save as PDF
                    </button>
                    <button
                      className="cursor-pointer transition-all bg-gray-200 text-gray-800 px-4 py-2 rounded-lg border-gray-300 border-b-[4px] hover:brightness-110 hover:-translate-y-[1px] hover:border-b-[6px] active:border-b-[2px] active:brightness-90 active:translate-y-[2px]"
                      onClick={() => handleDownload("txt")}
                    >
                      💾 Save as TXT
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
            );
          })()}
          </div>

          {/* ATS Compatibility Card - Full width horizontal card below the main sections */}
          {(() => {
            const atsSection = sections.find(s => {
              const title = s.title.toLowerCase();
              return title.includes("ats") ||
                     title.includes("applicant tracking") ||
                     title.includes("applicant-tracking") ||
                     title.includes("compatibility check");
            });

            // If no ATS section exists yet (old analysis), show a placeholder
            if (!atsSection) {
              return (
                <motion.section
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="w-full mt-6"
                >
                  <div className="bg-white shadow-xl rounded-2xl p-6 border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center">
                          <span className="text-3xl">🤖</span>
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold text-gray-900">ATS Compatibility Check</h2>
                          <p className="text-sm text-gray-500">Applicant Tracking System Analysis</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-gray-400 text-sm">Run a new analysis to see ATS score</span>
                      </div>
                    </div>
                    <div className="mt-4 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                      <p className="text-sm text-yellow-700 flex items-center gap-2">
                        <span>⚠️</span>
                        <span>This analysis was run before ATS checking was added. Click <strong>Re-analyze</strong> to get your ATS compatibility score.</span>
                      </p>
                    </div>
                  </div>
                </motion.section>
              );
            }

            // Extract ATS score
            let atsScore: number | null = null;
            const content = atsSection.content;

            const atsScoreMatch = content.match(/ats\s*score[^0-9]*([0-9]{1,3})\s*\/\s*100/i);
            if (atsScoreMatch) {
              const extractedScore = parseInt(atsScoreMatch[1], 10);
              if (extractedScore >= 0 && extractedScore <= 100) {
                atsScore = extractedScore;
              }
            }

            if (atsScore === null) {
              const fallbackMatch = content.match(/([0-9]{1,3})\s*\/\s*100/);
              if (fallbackMatch) {
                const num = parseInt(fallbackMatch[1], 10);
                if (num >= 0 && num <= 100) atsScore = num;
              }
            }

            const atsScoreValue = atsScore !== null ? atsScore : 0;

            // Extract strengths and weaknesses for quick view
            const strengthsMatch = content.match(/\*\*Strengths?:?\*\*\s*([\s\S]*?)(?=\*\*Weaknesses?|$)/i);
            const weaknessesMatch = content.match(/\*\*Weaknesses?\/?Missing:?\*\*\s*([\s\S]*?)(?=\*\*Suggestions?|$)/i);
            const suggestionsMatch = content.match(/\*\*Suggestions?:?\*\*\s*([\s\S]*?)(?=\*\*Example|$)/i);

            const extractBullets = (text: string | undefined) => {
              if (!text) return [];
              return text
                .split('\n')
                .filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'))
                .slice(0, 3)
                .map(line => line.replace(/^[-•]\s*/, '').trim());
            };

            const strengths = extractBullets(strengthsMatch?.[1]);
            const weaknesses = extractBullets(weaknessesMatch?.[1]);
            const suggestions = extractBullets(suggestionsMatch?.[1]);

            const getScoreColor = (score: number) => {
              if (score >= 80) return { gradient: 'from-green-500 to-emerald-600', bar: 'bg-gradient-to-r from-green-400 to-emerald-500', text: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' };
              if (score >= 60) return { gradient: 'from-yellow-400 to-amber-500', bar: 'bg-gradient-to-r from-yellow-400 to-amber-500', text: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' };
              if (score >= 40) return { gradient: 'from-orange-500 to-red-500', bar: 'bg-gradient-to-r from-orange-400 to-red-500', text: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' };
              return { gradient: 'from-red-500 to-pink-600', bar: 'bg-gradient-to-r from-red-500 to-pink-600', text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' };
            };

            const colors = getScoreColor(atsScoreValue);

            return (
              <motion.section
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="w-full mt-8"
              >
                <div className="bg-white shadow-xl rounded-3xl overflow-hidden border border-gray-100">
                  {/* Top Header Section */}
                  <div className="relative bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50">
                    <div className="px-8 py-6">
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                        {/* Left: Title and Badge */}
                        <div className="flex items-center gap-5">
                          <div className="relative">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                              </svg>
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center">
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          </div>
                          <div>
                            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">ATS Compatibility</h2>
                            <p className="text-gray-500 text-sm mt-0.5">Applicant Tracking System Analysis</p>
                          </div>
                        </div>

                        {/* Right: Score Circle */}
                        <div className="flex items-center gap-6">
                          <div className="relative">
                            <svg className="w-28 h-28 transform -rotate-90">
                              <circle
                                cx="56"
                                cy="56"
                                r="48"
                                stroke="currentColor"
                                strokeWidth="8"
                                fill="transparent"
                                className="text-gray-200"
                              />
                              <motion.circle
                                cx="56"
                                cy="56"
                                r="48"
                                stroke="url(#scoreGradient)"
                                strokeWidth="8"
                                fill="transparent"
                                strokeLinecap="round"
                                strokeDasharray={`${2 * Math.PI * 48}`}
                                initial={{ strokeDashoffset: 2 * Math.PI * 48 }}
                                animate={{ strokeDashoffset: 2 * Math.PI * 48 * (1 - atsScoreValue / 100) }}
                                transition={{ duration: 1.5, delay: 0.3, ease: 'easeOut' }}
                              />
                              <defs>
                                <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                  <stop offset="0%" stopColor={atsScoreValue >= 70 ? '#22c55e' : atsScoreValue >= 50 ? '#eab308' : '#ef4444'} />
                                  <stop offset="100%" stopColor={atsScoreValue >= 70 ? '#10b981' : atsScoreValue >= 50 ? '#f59e0b' : '#dc2626'} />
                                </linearGradient>
                              </defs>
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <motion.span
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.5, type: 'spring' }}
                                className="text-3xl font-bold text-gray-900"
                              >
                                {atsScoreValue}
                              </motion.span>
                              <span className="text-xs text-gray-500 font-medium">out of 100</span>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div className={`px-4 py-2 rounded-xl ${
                            atsScoreValue >= 80 ? 'bg-emerald-100 border border-emerald-200' :
                            atsScoreValue >= 60 ? 'bg-amber-100 border border-amber-200' :
                            'bg-red-100 border border-red-200'
                          }`}>
                            <span className={`text-sm font-semibold ${
                              atsScoreValue >= 80 ? 'text-emerald-700' :
                              atsScoreValue >= 60 ? 'text-amber-700' :
                              'text-red-700'
                            }`}>
                              {atsScoreValue >= 80 ? 'Excellent' : atsScoreValue >= 60 ? 'Needs Work' : 'Low Score'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Info Banner */}
                  <div className="px-8 py-4 bg-blue-50 border-y border-blue-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-sm text-gray-600">
                        <span className="text-gray-900 font-medium">90%+ of companies</span> use ATS to filter resumes. A higher score means better chances of reaching human recruiters.
                      </p>
                    </div>
                  </div>

                  {/* Three Columns */}
                  <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                    {/* Strengths */}
                    <div className="p-6 bg-gradient-to-b from-white to-emerald-50/30">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                          <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <h4 className="font-semibold text-gray-900">Strengths</h4>
                      </div>
                      <ul className="space-y-3">
                        {strengths.length > 0 ? strengths.map((item, i) => (
                          <li key={i} className="flex items-start gap-3 group">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span>
                            <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">{item}</span>
                          </li>
                        )) : (
                          <li className="text-sm text-gray-400 italic">No specific strengths identified</li>
                        )}
                      </ul>
                    </div>

                    {/* Issues */}
                    <div className="p-6 bg-gradient-to-b from-white to-amber-50/30">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                          <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        </div>
                        <h4 className="font-semibold text-gray-900">Issues Found</h4>
                      </div>
                      <ul className="space-y-3">
                        {weaknesses.length > 0 ? weaknesses.map((item, i) => (
                          <li key={i} className="flex items-start gap-3 group">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span>
                            <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">{item}</span>
                          </li>
                        )) : (
                          <li className="text-sm text-gray-400 italic">No issues detected</li>
                        )}
                      </ul>
                    </div>

                    {/* Tips */}
                    <div className="p-6 bg-gradient-to-b from-white to-blue-50/30">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                          <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                        </div>
                        <h4 className="font-semibold text-gray-900">Quick Tips</h4>
                      </div>
                      <ul className="space-y-3">
                        {suggestions.length > 0 ? suggestions.map((item, i) => (
                          <li key={i} className="flex items-start gap-3 group">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
                            <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">{item}</span>
                          </li>
                        )) : (
                          <li className="text-sm text-gray-400 italic">No specific tips available</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              </motion.section>
            );
          })()}
        </div>
      ) : null}

      {/* Loading state */}
      {loading && (
        <div className="w-full flex flex-col items-center justify-center animate-fadeIn text-center py-16">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-700 font-medium mb-2 transition-all duration-500 ease-in-out">
            {loadingMessage}
          </p>
          <p className="text-sm text-gray-500 animate-pulse">
            Please wait a few seconds while our AI processes your resume...
          </p>
        </div>
      )}

      {/* Upload Form - Right side (or below on mobile when no analysis) */}
      {(!loading && sections.length === 0) && (
        <section className="w-full lg:w-1/2 flex justify-center items-start lg:sticky lg:top-16">
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-4 bg-white shadow-xl rounded-2xl p-6 sm:p-8 w-full max-w-[400px] border border-gray-100"
          >
          <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">Upload & Analyze</h2>

          {/* Provider */}
          <div className="flex flex-col">
            <label className="text-sm font-semibold text-gray-700 mb-1">AI Provider</label>
            <select
              className="border p-2 rounded focus:ring-2 focus:ring-blue-500"
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value as "ollama" | "openai" | "gemini");
                setConnectionStatus("idle");
              }}
            >
              <option value="ollama">Local (Ollama)</option>
              <option value="openai">OpenAI</option>
              <option value="gemini">Gemini</option>
            </select>
          </div>

          {/* API Key */}
          {(provider === "openai" || provider === "gemini") && (
            <div className="flex flex-col">
              <label className="text-sm font-semibold text-gray-700 mb-1">
                {provider === "openai" ? "OpenAI API Key" : "Gemini API Key"}
              </label>
              <input
                type="password"
                className="border p-2 rounded focus:ring-2 focus:ring-blue-500"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={provider === "openai" ? "sk-..." : "AIza..."}
              />
              <button
                type="button"
                onClick={testConnection}
                className="mt-2 text-sm cursor-pointer transition-all bg-gray-100 text-gray-700 px-2 py-1 rounded-lg border-gray-300 border-b-[4px] hover:brightness-110 hover:-translate-y-[1px] hover:border-b-[6px] active:border-b-[2px] active:brightness-90 active:translate-y-[2px]"
              >
                {connectionStatus === "testing"
                  ? "Testing..."
                  : connectionStatus === "success"
                  ? "✅ Connected"
                  : connectionStatus === "error"
                  ? "❌ Failed - Retry"
                  : "Test Connection"}
              </button>
            </div>
          )}

          {/* Job title */}
          <div className="flex flex-col">
            <label className="text-sm font-semibold text-gray-700 mb-1">Job Title</label>
            <select
              className="border p-2 rounded focus:ring-2 focus:ring-blue-500"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              required
            >
              <option value="">Select a job title...</option>
              {jobTitles.map((title) => (
                <option key={title}>{title}</option>
              ))}
            </select>
          </div>

          {/* Sector */}
          <div className="flex flex-col">
            <label className="text-sm font-semibold text-gray-700 mb-1">Sector</label>
            <select
              className="border p-2 rounded focus:ring-2 focus:ring-blue-500"
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              required
            >
              <option value="">Select a sector...</option>
              {sectors.map((sector) => (
                <option key={sector}>{sector}</option>
              ))}
            </select>
          </div>

          {/* Experience */}
          <div className="flex flex-col">
            <label className="text-sm font-semibold text-gray-700 mb-1">Experience Level</label>
            <select
              className="border p-2 rounded focus:ring-2 focus:ring-blue-500"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            >
              <option>Junior</option>
              <option>Mid-Level</option>
              <option>Senior</option>
            </select>
          </div>

          {/* File */}
          <div className="flex flex-col">
            <label className="text-sm font-semibold text-gray-700 mb-1">Upload Resume</label>
            <input
              type="file"
              accept=".pdf,.docx"
              onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
              className="border p-2 rounded bg-gray-50 hover:bg-gray-100 cursor-pointer"
              required
            />
          </div>

          <button
            type="submit"
            className="cursor-pointer transition-all bg-blue-500 text-white px-6 py-2 rounded-lg border-blue-600 border-b-[4px] hover:brightness-110 hover:-translate-y-[1px] hover:border-b-[6px] active:border-b-[2px] active:brightness-90 active:translate-y-[2px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:border-b-[4px]"
            disabled={loading}
          >
            {loading ? "Analyzing..." : "Upload & Analyze"}
          </button>
        </form>
      </section>
      )}
    </main>
  );
}
