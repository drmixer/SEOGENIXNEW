import React from 'react';
import Toast, { ToastProps } from './Toast';

interface ToastContainerProps {
  toasts: ToastProps[];
  onRemoveToast: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemoveToast }) => {
  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <div className="flex flex-col items-end space-y-2 max-h-[calc(100vh-32px)] overflow-visible pointer-events-none">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto w-full">
            <Toast
              {...toast}
              onClose={onRemoveToast}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default ToastContainer;