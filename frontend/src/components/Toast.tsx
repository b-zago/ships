import { useEffect } from "react";
import { X } from "lucide-react";

interface ToastProps {
  id: string;
  message: string;
  time: number;
  onClose: (id: string) => void;
}

export const Toast = ({ id, message, time, onClose }: ToastProps) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, time);

    return () => clearTimeout(timer);
  }, [id, time, onClose]);

  return (
    <div className="bg-slate-800 border-2 border-slate-700 rounded-lg shadow-xl p-4 mb-3 flex items-center justify-between min-w-[300px] max-w-[400px] animate-slide-in">
      <p className="text-white font-semibold">{message}</p>
      <button
        onClick={() => onClose(id)}
        className="ml-4 text-slate-400 hover:text-white transition-colors"
      >
        <X size={20} />
      </button>
    </div>
  );
};

interface ToastContainerProps {
  toasts: Array<{ id: string; message: string; time: number }>;
  onRemoveToast: (id: string) => void;
}

export const ToastContainer = ({
  toasts,
  onRemoveToast,
}: ToastContainerProps) => {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col items-end">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          message={toast.message}
          time={toast.time}
          onClose={onRemoveToast}
        />
      ))}
    </div>
  );
};
