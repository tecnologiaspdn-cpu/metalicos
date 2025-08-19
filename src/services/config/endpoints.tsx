export const ENDPOINTS = {
    AUTH: {
        LOGIN: 'auth/login',
        REFRESH: 'auth/refresh',
        LOGOUT: 'auth/logout',
        PERMISOS: 'permisos/getPermisos'
    },
    USUARIOS: {
        LIST: '/users/getUsers',
        LISTBYTIPO: (id: any) => `/users/getUsersByTipo/${id}`,
        LISTBYTIPOANDSUCURSAL: (id: any) => `/users/getUsersByTipoAndSucursal/${id}`,
        COMPLETELIST: '/users/getUsersComplete',
        DETAIL: (id: any) => `/users/getUsuariosById/${id}`,
        CREATE: '/users/createUser',
        UPDATE: (id: any) => `/users/updateUser/${id}`,
        UPDATE2: `/users/updateUser/`,
        DELETE: (id: any) => `/users/deleteUser/${id}`,
    },
    PERSONAL: {
        LIST: 'personal/trabajadores',
        

        LISTBYCATEGORIA: (id_categoria: any) => `personal/getPersonalByIdCategoria/${id_categoria}`,
        DETAIL: (id: any) => `personal/getPersonalById/${id}`,
        CREATE: 'personal/trabajadores/insertar',
        UPDATE: (id: any) => `personal/updateFamilia/${id}`,
        UPDATE2: `personal/updateFamilia/`,
        DELETE: (id: any) => `personal/deleteFamilia/${id}`
    },


};