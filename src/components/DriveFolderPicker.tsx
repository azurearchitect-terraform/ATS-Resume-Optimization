import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Folder, X, Search, Check, Loader2, AlertCircle, ChevronRight, HardDrive } from 'lucide-react';

interface DriveFolderPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (folder: { id: string, name: string }) => void;
  accessToken: string | null;
  isDarkMode: boolean;
}

export function DriveFolderPicker({ isOpen, onClose, onSelect, accessToken, isDarkMode }: DriveFolderPickerProps) {
  const [folders, setFolders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchFolders = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const url = accessToken 
        ? `/api/list-drive-folders?accessToken=${accessToken}` 
        : '/api/list-drive-folders';
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        setFolders(data.folders || []);
      } else {
        setError(data.error || 'Failed to fetch folders');
      }
    } catch (err: any) {
      console.error('Error fetching folders:', err);
      setError('Connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchFolders();
    }
  }, [isOpen, accessToken]);

  const filteredFolders = folders.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className={`w-full max-w-lg rounded-3xl shadow-2xl border overflow-hidden flex flex-col max-h-[80vh] ${
          isDarkMode ? 'bg-[#141414] border-white/10 text-white' : 'bg-white border-black/5 text-black'
        }`}
      >
        <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <HardDrive className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h3 className="font-bold">Select Drive Folder</h3>
              <p className="text-xs opacity-60">Choose where to save your resume versions</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 bg-black/5 dark:bg-white/5 border-b border-black/5 dark:border-white/5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
            <input
              type="text"
              placeholder="Search folders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-neutral-800 border border-black/5 dark:border-white/5 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3 opacity-60">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              <p className="text-sm">Fetching folders from Drive...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3 text-center px-6">
              <AlertCircle className="w-12 h-12 text-red-500 opacity-20" />
              <p className="text-sm font-medium text-red-500">{error}</p>
              <button 
                onClick={fetchFolders}
                className="text-xs font-bold text-emerald-500 hover:underline"
              >
                Try Again
              </button>
            </div>
          ) : filteredFolders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3 opacity-40">
              <Folder className="w-12 h-12" />
              <p className="text-sm">No folders found</p>
            </div>
          ) : (
            filteredFolders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => onSelect({ id: folder.id, name: folder.name })}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-all text-left border border-transparent hover:border-black/5 dark:hover:border-white/10 group"
              >
                <div className="flex items-center gap-3">
                  <Folder className="w-5 h-5 text-amber-500 fill-amber-500/20" />
                  <div>
                    <div className="text-sm font-semibold">{folder.name}</div>
                    <div className="text-[10px] opacity-40 uppercase tracking-tighter">Folder ID: {folder.id.substring(0, 8)}...</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all text-emerald-500" />
              </button>
            ))
          )}
        </div>

        <div className="p-4 border-t border-black/5 dark:border-white/5 flex items-center justify-between bg-black/5 dark:bg-white/5">
          <p className="text-[10px] opacity-40 max-w-[70%]">
            Only folders you have access to are shown. To use a Team Drive folder, ensure the service account or your account has editor permissions.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-neutral-200 dark:bg-neutral-800 hover:bg-opacity-80 transition-all"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
}
