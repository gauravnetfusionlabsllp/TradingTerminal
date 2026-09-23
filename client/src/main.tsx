import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Web3Provider } from './components/providers/web3-provider';
import { ErrorBoundary } from './components/common/error-boundary';
import App from './App';
import './index.css';

function AppWithProviders() {
  return (
    <Web3Provider>
      <App />
    </Web3Provider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AppWithProviders />
    </ErrorBoundary>
  </StrictMode>,
);
