import React from 'react';
import Toast, { ToastProps } from './Toast';

interface ToastContainerProps {
  toasts: ToastProps[];
  onRemoveToast: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemoveToast }) => {
  return (
    <div className="fixed top-4 right-4 z-50 w-96 max-w-[calc(100vw-2rem)]">
      <div className="flex flex-col items-end space-y-2 max-h-[calc(100vh-32px)] overflow-y-auto pointer-events-none pr-1">
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