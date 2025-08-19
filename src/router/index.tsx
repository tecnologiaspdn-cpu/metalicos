import { createBrowserRouter } from 'react-router-dom';
import BlankLayout from '../components/Layouts/BlankLayout';
import DefaultLayout from '../components/Layouts/DefaultLayout';
import { routes } from './routes';

const finalRoutes = routes.map((route) => {
    return {
        ...route,
        element: route.layout === 'blank' ? <BlankLayout>{route.element}</BlankLayout> : <DefaultLayout>{route.element}</DefaultLayout>,
    };
});

//const router = createBrowserRouter(finalRoutes);
const router = createBrowserRouter(finalRoutes, {
    //basename: '/erp' // Especifica la subcarpeta aquí
    basename: process.env.VITE_BASENAME || '/', // Usa la variable de entorno
});

export default router;

