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
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-4xl h-3/4 flex flex-col">
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <h2 className="text-2xl font-bold">Select Content from {cmsType === 'wordpress' ? 'WordPress' : 'Shopify'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-3xl">&times;</button>
        </div>
        <div className="flex-grow overflow-y-auto">
          <CMSContentPicker cmsType={cmsType} onContentSelect={handleSelect} />
        </div>
      </div>
    </div>
  );
};

export default CMSContentModal;
