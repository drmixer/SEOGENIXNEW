import React from 'react';
import CMSContentPicker from './CMSContentPicker';
import Modal from './ui/Modal';

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

  const header = (<h2 className="text-2xl font-bold">Select Content from {cmsType === 'wordpress' ? 'WordPress' : 'Shopify'}</h2>);
  return (
    <Modal isOpen={true} onClose={onClose} header={header} size="4xl">
      <CMSContentPicker cmsType={cmsType} onContentSelect={handleSelect} />
    </Modal>
  );
};

export default CMSContentModal;
