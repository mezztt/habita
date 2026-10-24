import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { THEME_KEY } from "./config";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";

// Panel general (Mezztt)
import AdminLayout from "./pages/admin/AdminLayout";
import AdminHome from "./pages/admin/AdminHome";
import Sistemas from "./pages/admin/Sistemas";
import Pagos from "./pages/admin/Pagos";
import AdminBilling from "./pages/admin/AdminBilling";
import AdminSettings from "./pages/admin/AdminSettings";
import MailCenter from "./pages/admin/MailCenter";
import Indices from "./pages/admin/Indices";

// Sistema de la inmobiliaria
import ClientLayout from "./pages/app/ClientLayout";
import Inicio from "./pages/app/Inicio";
import Usuarios from "./pages/app/Usuarios";
import Configuracion from "./pages/app/Configuracion";
// un archivo por módulo (cada agente completa el suyo)
import PropiedadesPage from "./pages/app/propiedades/Index";
import ContratosPage from "./pages/app/contratos/Index";
import CobranzasPage from "./pages/app/cobranzas/Index";
import LiquidacionesPage from "./pages/app/liquidaciones/Index";
import GarantiasPage from "./pages/app/garantias/Index";
import ExpensasPage from "./pages/app/expensas/Index";
import MantenimientoPage from "./pages/app/mantenimiento/Index";
import InspeccionesPage from "./pages/app/inspecciones/Index";
import DocumentosPage from "./pages/app/documentos/Index";
import CrmPage from "./pages/app/crm/Index";
import VisitasPage from "./pages/app/visitas/Index";
import UifPage from "./pages/app/uif/Index";
import ReportesPage from "./pages/app/reportes/Index";

// Webs públicas de la inmobiliaria
import Catalogo from "./pages/public/Catalogo";
import Portal from "./pages/public/Portal";
import Legal from "./pages/public/Legal";

function App() {
  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY) || "light";
    // las páginas públicas se ven siempre en claro (lo fuerza useLightPage)
    if (/^\/(p|portal|legal)\//.test(window.location.pathname)) return;
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />

        {/* PANEL GENERAL (Mezztt) */}
        <Route element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route path="/admin" element={<AdminHome />} />
          <Route path="/admin/sistemas" element={<Sistemas />} />
          <Route path="/admin/pagos" element={<Pagos />} />
          <Route path="/admin/facturacion" element={<AdminBilling />} />
          <Route path="/admin/indices" element={<Indices />} />
          <Route path="/admin/correos" element={<MailCenter />} />
          <Route path="/admin/configuracion" element={<AdminSettings />} />
        </Route>

        {/* SISTEMA DE LA INMOBILIARIA */}
        <Route element={<ProtectedRoute><ClientLayout /></ProtectedRoute>}>
          <Route path="/app" element={<Inicio />} />
          <Route path="/app/propiedades" element={<PropiedadesPage />} />
          <Route path="/app/contratos" element={<ContratosPage />} />
          <Route path="/app/cobranzas" element={<CobranzasPage />} />
          <Route path="/app/liquidaciones" element={<LiquidacionesPage />} />
          <Route path="/app/garantias" element={<GarantiasPage />} />
          <Route path="/app/expensas" element={<ExpensasPage />} />
          <Route path="/app/mantenimiento" element={<MantenimientoPage />} />
          <Route path="/app/inspecciones" element={<InspeccionesPage />} />
          <Route path="/app/documentos" element={<DocumentosPage />} />
          <Route path="/app/crm" element={<CrmPage />} />
          <Route path="/app/visitas" element={<VisitasPage />} />
          <Route path="/app/uif" element={<UifPage />} />
          <Route path="/app/reportes" element={<ReportesPage />} />
          <Route path="/app/usuarios" element={<Usuarios />} />
          <Route path="/app/configuracion" element={<Configuracion />} />
        </Route>

        {/* WEBS PÚBLICAS (sin login) */}
        <Route path="/p/:slug" element={<Catalogo />} />
        <Route path="/p/:slug/:code" element={<Catalogo />} />
        <Route path="/portal/:token" element={<Portal />} />

        {/* LEGALES (sin login) */}
        <Route path="/legal/terminos" element={<Legal doc="terminos" />} />
        <Route path="/legal/privacidad" element={<Legal doc="privacidad" />} />
        <Route path="/legal/baja" element={<Legal doc="baja" />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
