import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Portal, Snackbar } from 'react-native-paper';

// Host global: un snackbar mostrado justo antes de un router.back()
// sobrevive al cambio de pantalla porque vive en el layout raíz.
const SnackbarContext = createContext<(message: string) => void>(() => {});

export const useSnackbar = () => useContext(SnackbarContext);

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  const [visible, setVisible] = useState(false);

  const show = useCallback((msg: string) => {
    setMessage(msg);
    setVisible(true);
  }, []);

  return (
    <SnackbarContext.Provider value={show}>
      {children}
      <Portal>
        <Snackbar
          visible={visible}
          onDismiss={() => setVisible(false)}
          duration={3000}
          // Por encima de la tab bar M3 (80dp) Y del FAB extendido de los
          // tabs (16 margen + 56 alto), como exige la spec: el snackbar no
          // debe cubrir ni la navegación ni el FAB. El wrapper ya añade el
          // inset inferior por su cuenta.
          wrapperStyle={{ bottom: 80 + 16 + 56 }}
        >
          {message}
        </Snackbar>
      </Portal>
    </SnackbarContext.Provider>
  );
}
