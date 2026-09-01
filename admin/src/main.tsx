import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import App, { CreateOfferRoute, DashboardRoute, EditOfferRoute } from './App';
import './styles/global.css';

// A data router (rather than BrowserRouter) is required for useBlocker, which backs
// the unsaved-changes guard in the offer editor.
const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <App />,
      children: [
        { index: true, element: <DashboardRoute /> },
        { path: 'offers/new/:ruleType', element: <CreateOfferRoute /> },
        { path: 'offers/:id/edit', element: <EditOfferRoute /> },
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ],
  { basename: '/admin' },
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
