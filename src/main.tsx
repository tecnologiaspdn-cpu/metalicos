import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client'

// Perfect Scrollbar
import 'react-perfect-scrollbar/dist/css/styles.css';

// Tailwind css
import './tailwind.css';

// i18n (needs to be bundled)
import './i18n';

// Router
import { RouterProvider } from 'react-router-dom';
import router from './router/index';

// Redux
import { Provider } from 'react-redux';
import store from './store/index';

// Mantine 
//import { MantineProvider } from '@mantine/core';
import config from 'devextreme/core/config';
import { licenseKey } from './devextreme-license';
config({ licenseKey });
import 'devextreme/dist/css/dx.light.css'
//import './index.css'
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <Suspense>
            <Provider store={store}>
                {/* <RouterProvider router={router} future={{ v7_startTransition: true }} /> */}
                <RouterProvider router={router} future={{ v7_startTransition: true, v7_relativeSplatPath: true }} />
            </Provider>
        </Suspense>
    </React.StrictMode>
); 
