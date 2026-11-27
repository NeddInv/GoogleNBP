import React, { useState } from 'react';
import type { HistoricalSessionReferenceSnapshot } from '../types';
import { CloseIcon, ArrowPathIcon, PhotoIcon, SparklesIcon, CheckIcon, ArchiveIcon } from './icons';

interface RestartHistoricalSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: HistoricalSessionReferenceSnapshot[];
  onRestartSession: (snapshot: HistoricalSessionReferenceSnapshot, options?: { referencesOnly?: boolean }) => void;
  onDeleteSession?: (id: string) => void;
  onClearAllSessions?: () => void;
}

export const RestartHistoricalSessionModal: React.FC<RestartHistoricalSessionModalProps> = ({
  isOpen,
  onClose,
  sessions,
  onRestartSession,
  onDeleteSession,
  onClearAllSessions,
}) => {
  const [selectedSessionId, setSelectedSessionId] = useState<string>(
    sessions[0]?.id || ''
  );
  const [restoreHistoryToggle, setRestoreHistoryToggle] = useState<boolean>(true);

  if (!isOpen) return null;

  // Active session being inspected
  const activeSession = sessions.find(s => s.id === selectedSessionId) || sessions[0];

  // Aggregate all reference photos in this historical snapshot
  const snapshotPhotos: { name: string; category: string; badge: string; preview: string }[] = [];
  if (activeSession) {
    activeSession.references.productImages.forEach((img, idx) => {
      snapshotPhotos.push({
        name: img.name || `product_${idx + 1}.png`,
        category: 'Product',
        badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        preview: `data:${img.mimeType};base64,${img.base64}`,
      });
    });
    activeSession.references.competitorImages.forEach((img, idx) => {
      snapshotPhotos.push({
        name: img.name || `competitor_${idx + 1}.png`,
        category: 'Competitor',
        badge: 'bg-red-500/20 text-red-300 border-red-500/30',
        preview: `data:${img.mimeType};base64,${img.base64}`,
      });
    });
    activeSession.references.modelImages.forEach((img, idx) => {
      snapshotPhotos.push({
        name: img.name || `model_${idx + 1}.png`,
        category: 'Model',
        badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
        preview: `data:${img.mimeType};base64,${img.base64}`,
      });
    });
    activeSession.references.poseImages.forEach((img, idx) => {
      snapshotPhotos.push({
        name: img.name || `pose_${idx + 1}.png`,
        category: 'Pose',
        badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        preview: `data:${img.mimeType};base64,${img.base64}`,
      });
    });
    activeSession.references.subjectImages.forEach((img, idx) => {
      snapshotPhotos.push({
        name: img.name || `scene_${idx + 1}.png`,
        category: 'Scene',
        badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
        preview: `data:${img.mimeType};base64,${img.base64}`,
      });
    });
    if (activeSession.references.companyLogo) {
      snapshotPhotos.push({
        name: activeSession.references.companyLogo.name || 'brand_logo.png',
        category: 'Logo',
        badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
        preview: `data:${activeSession.references.companyLogo.mimeType};base64,${activeSession.references.companyLogo.base64}`,
      });
    }
  }

  const handleExecuteFullRestart = () => {
    if (!activeSession) return;
    const sessionToRestore = {
      ...activeSession,
      history: restoreHistoryToggle ? activeSession.history : [],
    };
    onRestartSession(sessionToRestore, { referencesOnly: false });
  };

  const handleExecuteReferencesOnlyRestart = () => {
    if (!activeSession) return;
    onRestartSession(activeSession, { referencesOnly: true });
  };

  const formatTimestamp = (timestamp: number) => {
    const d = new Date(timestamp);
    const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${dateStr} at ${timeStr}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div 
        className="bg-brand-secondary/95 border border-indigo-500/30 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 rounded-xl text-emerald-400">
              <ArrowPathIcon className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Restart Program from Historical Session References
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {sessions.length} {sessions.length === 1 ? 'Checkpoint' : 'Checkpoints'} Available
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Reinitialize workspace and restore reference photo catalogs, prompt configurations, and settings from past sessions.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm custom-scrollbar">
          {sessions.length === 0 ? (
            <div className="text-center py-12 px-4 border border-dashed border-gray-700 rounded-xl space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                <PhotoIcon className="w-6 h-6" />
              </div>
              <h4 className="text-base font-semibold text-white">No Historical Session References Found Yet</h4>
              <p className="text-xs text-gray-400 max-w-md mx-auto">
                As you upload reference photos, configure prompts, and generate variations, the application automatically preserves historical session references here. You can restart from them at any time.
              </p>
              <button
                onClick={onClose}
                className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition"
              >
                Return to Workspace
              </button>
            </div>
          ) : (
            <>
              {/* Session Selector (if multiple checkpoints exist) */}
              {sessions.length > 1 && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                    <ArchiveIcon className="w-3.5 h-3.5 text-indigo-400" />
                    Select Historical Session Checkpoint:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {sessions.map((sess) => {
                      const isSelected = sess.id === (activeSession?.id || '');
                      return (
                        <div
                          key={sess.id}
                          onClick={() => setSelectedSessionId(sess.id)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer text-left relative ${
                            isSelected
                              ? 'bg-emerald-500/15 border-emerald-500/50 shadow-md ring-1 ring-emerald-500/30'
                              : 'bg-black/30 border-white/10 hover:border-white/20 hover:bg-white/[0.02]'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
                            <span className="font-mono text-gray-300">{formatTimestamp(sess.timestamp)}</span>
                            {isSelected && (
                              <span className="flex items-center gap-0.5 text-emerald-400 font-bold">
                                <CheckIcon className="w-3 h-3" />
                                Active
                              </span>
                            )}
                          </div>
                          <div className="font-semibold text-xs text-white truncate">
                            {sess.summary.productName ? sess.summary.productName : `${sess.summary.promptMode.toUpperCase()} Session`}
                          </div>
                          <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-400">
                            <span className="px-1.5 py-0.5 bg-white/5 rounded border border-white/10 text-emerald-300">
                              📷 {sess.summary.photoCount} refs
                            </span>
                            <span className="px-1.5 py-0.5 bg-white/5 rounded border border-white/10 text-indigo-300 uppercase">
                              {sess.summary.promptMode}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Active Session Overview Card */}
              {activeSession && (
                <div className="bg-black/40 border border-white/10 rounded-xl p-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-white">
                          {activeSession.summary.productName || 'Historical Session Reference'}
                        </span>
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
                          Recorded: {formatTimestamp(activeSession.timestamp)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {activeSession.label}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-medium">
                        Mode: <strong className="text-white uppercase">{activeSession.prompts.promptMode}</strong>
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300 font-medium">
                        Ratio: <strong className="text-white">{activeSession.settings.aspectRatio}</strong>
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 font-medium">
                        Res: <strong className="text-white">{activeSession.settings.imageSize}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Restored Reference Photos Preview */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 font-semibold text-gray-200">
                        <PhotoIcon className="w-4 h-4 text-emerald-400" />
                        <span>Reference Photos to Restore ({snapshotPhotos.length}):</span>
                      </div>
                      <span className="text-[11px] text-gray-400">
                        Will be repopulated in the reference catalog and active prompt tags.
                      </span>
                    </div>

                    {snapshotPhotos.length === 0 ? (
                      <p className="text-xs text-gray-500 italic py-2">
                        No reference photos were attached in this session snapshot.
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5 pt-1">
                        {snapshotPhotos.map((photo, i) => (
                          <div 
                            key={i} 
                            className="group relative bg-black/60 rounded-xl border border-white/10 p-1.5 flex flex-col items-center gap-1 overflow-hidden hover:border-emerald-500/40 transition-all"
                          >
                            <div className="w-full h-16 rounded-lg overflow-hidden bg-black/40 flex items-center justify-center">
                              <img 
                                src={photo.preview} 
                                alt={photo.name} 
                                className="w-full h-full object-contain group-hover:scale-105 transition-transform" 
                              />
                            </div>
                            <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold border ${photo.badge}`}>
                              {photo.category}
                            </span>
                            <span className="text-[10px] text-gray-300 truncate w-full text-center font-mono" title={photo.name}>
                              {photo.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Restored Prompts & Configuration Preview */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-white/5 text-xs">
                    <div className="space-y-1.5 bg-black/20 p-3 rounded-lg border border-white/5">
                      <span className="font-semibold text-gray-300 block">Prompt Configuration:</span>
                      {activeSession.prompts.promptMode === 'guided' && (
                        <div className="space-y-1 text-gray-400 text-[11px]">
                          {activeSession.prompts.slogan && <div><strong className="text-gray-300">Slogan:</strong> {activeSession.prompts.slogan}</div>}
                          {activeSession.prompts.placement && <div><strong className="text-gray-300">Placement:</strong> {activeSession.prompts.placement}</div>}
                          {activeSession.prompts.selectedBackground && <div><strong className="text-gray-300">Background:</strong> {activeSession.prompts.selectedBackground}</div>}
                        </div>
                      )}
                      {activeSession.prompts.promptMode === 'full' && (
                        <p className="text-[11px] text-gray-400 line-clamp-3">
                          {activeSession.prompts.fullPrompt || 'No prompt entered'}
                        </p>
                      )}
                      {activeSession.prompts.promptMode === 'multiple' && (
                        <p className="text-[11px] text-gray-400">
                          {activeSession.prompts.multiplePrompts.filter(p => p.trim()).length} multiple prompt variations configured.
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5 bg-black/20 p-3 rounded-lg border border-white/5">
                      <span className="font-semibold text-gray-300 block">Visual Style & Setup:</span>
                      <div className="space-y-1 text-gray-400 text-[11px]">
                        <div><strong className="text-gray-300">Style:</strong> {activeSession.prompts.selectedStyle || 'Default'}</div>
                        <div><strong className="text-gray-300">Mood:</strong> {activeSession.prompts.selectedMood || 'Default'}</div>
                        <div><strong className="text-gray-300">Variations:</strong> {activeSession.settings.numberOfVariations}</div>
                        {activeSession.settings.cameraSettings.cameraType && (
                          <div><strong className="text-gray-300">Camera:</strong> {activeSession.settings.cameraSettings.cameraType}</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Optional Toggle: Restore Past History Images */}
                  {activeSession.history && activeSession.history.length > 0 && (
                    <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs text-gray-300">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={restoreHistoryToggle}
                          onChange={(e) => setRestoreHistoryToggle(e.target.checked)}
                          className="rounded border-gray-700 text-emerald-500 focus:ring-emerald-500 w-4 h-4 bg-black/40"
                        />
                        <span>Also restore previously generated ad outputs ({activeSession.history.length} items in history)</span>
                      </label>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        {sessions.length > 0 && activeSession && (
          <div className="p-4 bg-white/[0.02] border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              {onClearAllSessions && (
                <button
                  type="button"
                  onClick={onClearAllSessions}
                  className="w-full sm:w-auto px-3.5 py-2 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Permanently erase all historical session checkpoints and references from storage"
                >
                  <CloseIcon className="w-3.5 h-3.5" />
                  <span>Wipe All Checkpoints</span>
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleExecuteReferencesOnlyRestart}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-gray-200 hover:text-white transition text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                title="Loads all reference photos into the catalog but clears previous prompt text for a clean start"
              >
                <PhotoIcon className="w-3.5 h-3.5 text-indigo-400" />
                <span>Restart (References Only)</span>
              </button>

              <button
                type="button"
                onClick={handleExecuteFullRestart}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white transition text-xs font-bold shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer group"
              >
                <ArrowPathIcon className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                <span>Restart Program Now</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
