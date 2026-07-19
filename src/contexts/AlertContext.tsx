"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import AlertModal from '@/components/AlertModal';

type AlertType = 'confirm' | 'success';

interface AlertContextProps {
  showAlert: (type: AlertType, title: string, message: string) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

const AlertContext = createContext<AlertContextProps | undefined>(undefined);

export function AlertProvider({ children }: { children: ReactNode }) {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: AlertType;
    title: string;
    message: string;
    onConfirmCallback?: () => void;
  }>({
    isOpen: false,
    type: 'confirm',
    title: '',
    message: ''
  });

  const showAlert = useCallback((type: AlertType, title: string, message: string) => {
    setModalState({
      isOpen: true,
      type,
      title,
      message,
      onConfirmCallback: undefined
    });

    if (type === 'success') {
      setTimeout(() => {
        setModalState(prev => ({ ...prev, isOpen: false }));
      }, 1250);
    }
  }, []);

  const showConfirm = useCallback((title: string, message: string, onConfirm: () => void) => {
    setModalState({
      isOpen: true,
      type: 'confirm',
      title,
      message,
      onConfirmCallback: onConfirm
    });
  }, []);

  const handleConfirm = () => {
    setModalState(prev => ({ ...prev, isOpen: false }));
    if (modalState.onConfirmCallback) {
      modalState.onConfirmCallback();
    }
  };

  const handleCancel = () => {
    setModalState(prev => ({ ...prev, isOpen: false }));
  };

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      <AlertModal
        isOpen={modalState.isOpen}
        type={modalState.type}
        title={modalState.title}
        message={modalState.message}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const context = useContext(AlertContext);
  if (context === undefined) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
}
