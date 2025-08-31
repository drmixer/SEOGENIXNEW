import React from 'react';
import CMSContentPicker from './CMSContentPicker';

interface CMSContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  cmsType: 'wordpress' | 'shopify';
  onContentSelect: (content: any) => void;
}

const CMSContentModal: React.FC<CMSContentModalProps> = ({ isOpen, onClose, cmsType, onContentSelect }) => {
  if (!isOpen) return null;

  const handleSelect = (content: any) => {
    onContentSelect(content);
    onClose(); // Close modal after selection
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-0 sm:p-4">
      <div className="bg-white w-full h-full sm:h-[75vh] sm:max-w-4xl sm:rounded-xl shadow-2xl flex flex-col">
        <div className="flex justify-between items-center p-4 sm:p-6 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-2xl font-bold">Select Content from {cmsType === 'wordpress' ? 'WordPress' : 'Shopify'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-3xl" aria-label="Close">&times;</button>
        </div>
        <div className="flex-grow overflow-y-auto p-4 sm:p-6">
          <CMSContentPicker cmsType={cmsType} onContentSelect={handleSelect} />
        </div>
      </div>
    </div>
  );
};

export default CMSContentModal;
