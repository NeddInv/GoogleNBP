import React, { useState } from 'react';
import { BASIC_ACCOUNT_PDF_DOCUMENT } from '../utils/pdfDocumentContent';
import { downloadBasicAccountPdfDocument, printBasicAccountDocument } from '../utils/pdfGenerator';
import { CloseIcon, CopyIcon, SparklesIcon } from './icons';

interface PdfApplicationGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PdfApplicationGuideModal: React.FC<PdfApplicationGuideModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const doc = BASIC_ACCOUNT_PDF_DOCUMENT;

  if (!isOpen) return null;

  const handleCopyText = () => {
    let fullText = `${doc.title}\n${doc.subtitle}\nDate: ${doc.date} | Version: ${doc.version}\n\nEXECUTIVE SUMMARY:\n${doc.executiveSummary}\n\n`;

    for (const section of doc.sections) {
      fullText += `${section.title.toUpperCase()}\n`;
      if (section.subsections) {
        for (const sub of section.subsections) {
          if (sub.subtitle) fullText += `\n${sub.subtitle}\n`;
          for (const p of sub.paragraphs) fullText += `${p}\n`;
          if (sub.bulletPoints) {
            for (const b of sub.bulletPoints) fullText += ` • ${b}\n`;
          }
        }
      }
      fullText += `\n`;
    }

    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div 
        className="bg-[#0e0c22] border border-indigo-500/30 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-gradient-to-r from-indigo-950/60 via-[#131033] to-purple-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 border border-indigo-500/40 rounded-xl text-indigo-400">
              <SparklesIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Basic Account Application PDF Document
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full">
                  PDF Ready
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Official program specification & user guide for Basic Account Tier submission
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
            aria-label="Close modal"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white/[0.02] border-b border-white/5 px-6">
          <div className="text-xs text-gray-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
            <span>Format: Standard PDF / Letter Print</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleCopyText}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-semibold rounded-xl border border-white/10 transition-colors"
            >
              <CopyIcon className="w-3.5 h-3.5" />
              {copied ? "Copied to Clipboard!" : "Copy Full Text"}
            </button>

            <button
              onClick={printBasicAccountDocument}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 text-xs font-semibold rounded-xl border border-purple-500/40 transition-all shadow-md"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print / Save PDF
            </button>

            <button
              onClick={downloadBasicAccountPdfDocument}
              className="flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all active:scale-95 border border-indigo-400/30"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download PDF Document
            </button>
          </div>
        </div>

        {/* Scrollable Document Content Area */}
        <div className="p-6 md:p-8 overflow-y-auto space-y-6 text-gray-300 text-xs md:text-sm leading-relaxed bg-[#0a081a]">
          {/* Cover Header */}
          <div className="p-6 rounded-xl bg-gradient-to-br from-indigo-950/80 via-slate-900 to-purple-950/60 border border-indigo-500/30 shadow-inner">
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight mb-2">
              {doc.title}
            </h1>
            <p className="text-indigo-300 font-medium text-xs md:text-sm mb-4">
              {doc.subtitle}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-indigo-500/20 text-[11px] text-gray-400">
              <div>
                <span className="block text-gray-500 font-semibold uppercase text-[9px]">Date</span>
                <span className="text-white font-medium">{doc.date}</span>
              </div>
              <div>
                <span className="block text-gray-500 font-semibold uppercase text-[9px]">Version</span>
                <span className="text-white font-medium">{doc.version}</span>
              </div>
              <div>
                <span className="block text-gray-500 font-semibold uppercase text-[9px]">Author</span>
                <span className="text-white font-medium">{doc.author}</span>
              </div>
              <div>
                <span className="block text-gray-500 font-semibold uppercase text-[9px]">Account Tier</span>
                <span className="text-emerald-400 font-bold">Basic Level</span>
              </div>
            </div>
          </div>

          {/* Executive Summary */}
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider text-indigo-400 border-b border-indigo-500/30 pb-1">
              Executive Summary
            </h4>
            <p className="text-gray-300">
              {doc.executiveSummary}
            </p>
          </div>

          {/* Sections */}
          {doc.sections.map((section, idx) => (
            <div key={idx} className="space-y-3 bg-white/[0.01] p-4 rounded-xl border border-white/5">
              <h4 className="text-sm font-bold text-indigo-300 border-b border-white/10 pb-1.5">
                {section.title}
              </h4>

              {section.subsections?.map((sub, sIdx) => (
                <div key={sIdx} className="space-y-2 pl-1">
                  {sub.subtitle && (
                    <h5 className="text-xs font-bold text-white/90">{sub.subtitle}</h5>
                  )}

                  {sub.paragraphs.map((p, pIdx) => (
                    <p key={pIdx} className="text-gray-300 text-xs">{p}</p>
                  ))}

                  {sub.bulletPoints && (
                    <ul className="list-disc pl-5 space-y-1 text-xs text-gray-300">
                      {sub.bulletPoints.map((bullet, bIdx) => (
                        <li key={bIdx}>{bullet}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          ))}

          {/* Footer Note */}
          <div className="pt-4 border-t border-white/10 text-center text-[11px] text-gray-500">
            Official Documentation • AdCraft Studio AI Product Ad & Video Engine • Basic Account Level Specification
          </div>
        </div>
      </div>
    </div>
  );
};
