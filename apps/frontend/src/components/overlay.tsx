import React from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Spinner } from './ui';

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;
  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/40 animate-fade-in" onClick={onClose} />
      <div className={`relative w-full ${sizes[size]} rounded-xl bg-white shadow-pop animate-slide-up max-h-[90vh] flex flex-col`}>
        {title !== undefined && (
          <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
            <h3 className="text-[15px] font-semibold text-ink-900">{title}</h3>
            <button onClick={onClose} className="rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="overflow-y-auto px-5 py-4 flex-1">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-ink-100 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({
  open,
  onClose,
  title,
  children,
  side = 'right',
  width = 'w-[420px]',
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  side?: 'right' | 'left';
  width?: string;
}) {
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 bg-ink-950/30 animate-fade-in" onClick={onClose} />
      <div className={`absolute top-0 bottom-0 ${side === 'right' ? 'right-0' : 'left-0'} ${width} bg-white shadow-pop animate-slide-in-right flex flex-col`}>
        {title !== undefined && (
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
            <button onClick={onClose} className="rounded-md p-1 text-ink-400 hover:bg-ink-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = true,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button onClick={onClose} className="inline-flex h-9 items-center rounded-lg px-4 text-sm font-medium text-ink-700 hover:bg-ink-100">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`inline-flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium text-white ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-whatsapp-500 hover:bg-whatsapp-600'}`}
          >
            {loading && <Spinner className="h-4 w-4" />}
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-ink-600">{message}</p>
    </Modal>
  );
}