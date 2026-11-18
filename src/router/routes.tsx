import { lazy } from 'react';
import CredencialesPage from '../pages/Personal/Credenciales';

const Index = lazy(() => import('../pages/Index'));
const LoginBoxed = lazy(() => import('../pages/Authentication/LoginBoxed'));
const ERROR404 = lazy(() => import('../pages/Pages/Error404'));
const Personal = lazy(() => import('../pages/Personal/Personal'));
const Comuneros = lazy(() => import('../pages/Comunidad/Comuneros'));
const Movimientos = lazy(() => import('../pages/Personal/Movimientos'));
const ControlAcceso = lazy(() => import('../pages/SeguridadPatrimonial/ControlAcceso'));
const Bienvenida = lazy(() => import('../pages/Authentication/Bienvenida'));
const OperacionesPlanta = lazy(() => import('../pages/OperacionesPlanta/OperacionesPlanta'));
const MiFirma = lazy(() => import('../pages/Authentication/MiFirma'));
const FirmaDocumentos = lazy(() => import('../pages/Authentication/FirmaDocumentos'));
const ValidadorFirmas = lazy(() => import('../pages/Public/ValidadorFirmas'));
const RegistroComensales = lazy(() => import('../pages/Comedor/RegistroComensales'));
const VariablesSistema = lazy(() => import('../pages/Comedor/VariablesSistema'));
const ReportesComedor = lazy(() => import('../pages/Comedor/ReportesComedor'));
const Invitados = lazy(() => import('../pages/Comedor/Invitados'));
const Extras = lazy(() => import('../pages/Comedor/Extras'));
const Valorizacion = lazy(() => import('../pages/Comedor/Valorizacion'));
const SolicitudMuestra = lazy(() => import('../pages/LaboratorioQuimico/SolicitudMuestra'));
const RecepcionMuestras = lazy(() => import('../pages/LaboratorioQuimico/RecepcionMuestras'));
const TiActivos = lazy(() => import('../pages/Ti/Activos'));
const TiTransferencias = lazy(() => import('../pages/Ti/Transferencias'));
const TiRecepcion = lazy(() => import('../pages/Ti/Recepcion'));
const TiPersonalEquipos = lazy(() => import('../pages/Ti/PersonalEquipos'));
const Balanza = lazy(() => import('../pages/Comercializacion/Balanza'));
const ConfigBalanza = lazy(() => import('../pages/Comercializacion/ConfigBalanza'));
const Maestros = lazy(() => import('../pages/Comercializacion/Maestros'));
const routes = [
    { path: '/comercializacion/balanza', element: <Balanza /> },
    { path: '/comercializacion/maestros', element: <Maestros /> },
    { path: '/comercializacion/config-balanza', element: <ConfigBalanza /> },
    { path: '/ti/activos', element: <TiActivos /> },
    { path: '/ti/transferencias', element: <TiTransferencias /> },
    { path: '/ti/recepcion', element: <TiRecepcion /> },
    { path: '/ti/personal-equipos', element: <TiPersonalEquipos /> },
    {
        path: '/comedor/invitados',
        element: <Invitados />,
    },
    {
        path: '/comedor/registro-comensales',
        element: <RegistroComensales />,
    },
    {
        path: '/comedor/variables-sistema',
        element: <VariablesSistema />,
    },
    {
        path: '/comedor/extras',
        element: <Extras />,
    },
    {
        path: '/comedor/valorizacion',
        element: <Valorizacion />,
    },
    {
        path: '/laboratorio-quimico/solicitud-muestra',
        element: <SolicitudMuestra />,
    },
    {
        path: '/laboratorio-quimico/recepcion-muestras',
        element: <RecepcionMuestras />,
    },
    {
        path: '/comedor/reportes',
        element: <ReportesComedor />,
    },


    {
        path: "/gestion/personas",
        element: <Personal />
    },
    {
        path: "/credenciales",
        element: <Personal />
    },
    {
        path: "/gestion-personas/personal",
        element: <Personal />
    },
    {
        path: "/movimientos",
        element: <Movimientos />
    },
    {
        path: "/gestion-personas/movimientos",
        element: <Movimientos />
    },
    {
        path: "/gestion-personas/reclutamiento",
        element: <Movimientos />
    },
    {
        path: "/credenciales/:idPersonal",
        element: <CredencialesPage />
    },
    {
        path: "/seguridapatrimonial/control",
        element: <ControlAcceso />
    },
    {
        path: "/seguridad-patrimonial/control-acceso",
        element: <ControlAcceso />
    },
    {
        path: "/comunidad/afiliacion",
        element: <Comuneros />
    },
    {
        path: "/operaciones-planta",
        element: <OperacionesPlanta />
    },
    {
        path: '/miFirma',
        element: <MiFirma />,
    },
    {
        path: '/bienvenida',
        element: <Bienvenida />,
    },
    {
        path: '/firmaDocumentos',
        element: <FirmaDocumentos />,
    },
    {
        path: 'firmas/gestion-firma',
        element: <FirmaDocumentos />,
    },
    {
        // Landing page pública (sin autenticación): enlazada desde el QR de
        // la última hoja de cada PDF firmado.
        path: '/validador-firmas/:codigo',
        element: <ValidadorFirmas />,
        layout: 'blank',
    },
    {
        path: '/',
        element: <LoginBoxed />,
        layout: 'blank',
    },
    {
        path: '/login',
        element: <LoginBoxed />,
        layout: 'blank',
    },

    {
        path: '*',
        element: <ERROR404 />,
        layout: 'blank',
    },
];

export { routes };
