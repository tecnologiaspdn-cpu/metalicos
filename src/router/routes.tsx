import { lazy } from 'react';

const Index = lazy(() => import('../pages/Index'));
const LoginBoxed = lazy(() => import('../pages/Authentication/LoginBoxed'));
const ERROR404 = lazy(() => import('../pages/Pages/Error404'));
const Personal = lazy(() => import('../pages/Personal/Personal'));
const ControlAcceso = lazy(() => import('../pages/SeguridadPatrimonial/ControlAcceso'));
const routes = [


    {
        path: "/gestion/personas",
        element: <Personal />
    },
    {
        path: "/seguridapatrimonial/control",
        element: <ControlAcceso />
    },
    {
        path: '/',
        element: <Index />,
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
