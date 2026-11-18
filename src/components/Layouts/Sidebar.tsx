import PerfectScrollbar from 'react-perfect-scrollbar';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { toggleSidebar } from '../../store/themeConfigSlice';
import AnimateHeight from 'react-animate-height';
import { IRootState } from '../../store';
import { useState, useEffect } from 'react';
import IconCaretsDown from '../Icon/IconCaretsDown';
import IconCaretDown from '../Icon/IconCaretDown';
import IconMenuDashboard from '../Icon/Menu/IconMenuDashboard';
import IconMinus from '../Icon/IconMinus';
import IconMenuChat from '../Icon/Menu/IconMenuChat';
import IconMenuMailbox from '../Icon/Menu/IconMenuMailbox';
import IconMenuTodo from '../Icon/Menu/IconMenuTodo';
import IconMenuNotes from '../Icon/Menu/IconMenuNotes';
import IconMenuScrumboard from '../Icon/Menu/IconMenuScrumboard';
import IconMenuContacts from '../Icon/Menu/IconMenuContacts';
import IconMenuInvoice from '../Icon/Menu/IconMenuInvoice';
import IconMenuCalendar from '../Icon/Menu/IconMenuCalendar';
import IconMenuComponents from '../Icon/Menu/IconMenuComponents';
import IconMenuElements from '../Icon/Menu/IconMenuElements';
import IconMenuCharts from '../Icon/Menu/IconMenuCharts';
import IconMenuWidgets from '../Icon/Menu/IconMenuWidgets';
import IconMenuFontIcons from '../Icon/Menu/IconMenuFontIcons';
import IconMenuDragAndDrop from '../Icon/Menu/IconMenuDragAndDrop';
import IconMenuTables from '../Icon/Menu/IconMenuTables';
import IconMenuDatatables from '../Icon/Menu/IconMenuDatatables';
import IconMenuForms from '../Icon/Menu/IconMenuForms';
import IconMenuUsers from '../Icon/Menu/IconMenuUsers';
import IconMenuPages from '../Icon/Menu/IconMenuPages';
import IconMenuAuthentication from '../Icon/Menu/IconMenuAuthentication';
import IconMenuDocumentation from '../Icon/Menu/IconMenuDocumentation';
import IconSettings from '../Icon/IconSettings';
import IconPlayCircle from '../Icon/IconPlayCircle';
import { useApi } from '../../hooks/useApi';
import { showMessage } from '../../hooks/useMessage';
import { apiManager } from '../../services/api/ApiManager';

const Sidebar = () => {
    const basename = import.meta.env.VITE_BASENAME || '';
    const navigate = useNavigate();
    const [currentMenu, setCurrentMenu] = useState<string>('');
    const [errorSubMenu, setErrorSubMenu] = useState(false);
    const themeConfig = useSelector((state: IRootState) => state.themeConfig);
    const semidark = useSelector((state: IRootState) => state.themeConfig.semidark);
    const location = useLocation();
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const toggleMenu = (value: string) => {
        setCurrentMenu((oldValue) => {
            return oldValue === value ? '' : value;
        });
    };

    const [menu, setMenu] = useState<any>(null);
    useEffect(() => {
        try {
            const rawMenu = localStorage.getItem('menuSideBar');
            //console.log("rawMenu", rawMenu);
            const parsedMenu = rawMenu ? JSON.parse(rawMenu) : null;

            if (Array.isArray(parsedMenu)) {
                setMenu(parsedMenu);
            } else {
                setMenu("-1"); // o un estado vacío como []
                //capturo la ruta
                let ruta = window.location.pathname;
                let ruta_corregida = limpiarRuta(ruta);
                console.log("ruta", ruta, ruta_corregida);
                if (ruta_corregida && ruta_corregida != '/login')
                    localStorage.setItem('rutaRedirect', (ruta_corregida));
                //return
                navigate("/login");
                //window.location.href = "./";
            }
        } catch (error) {
            console.error("Error al parsear el menú:", error);
            setMenu("-1"); // fallback si el JSON está corrupto
            //redirigir al login
            navigate("/login");
        }
    }, [])
    function limpiarRuta(ruta: string) {
        const segmentos = ruta.split('/').filter(Boolean); // elimina vacíos
        if (segmentos[0] === 'metalicos') {
            segmentos.shift(); // elimina el primer segmento
        }
        return '/' + segmentos.join('/');
    }


    useEffect(() => {
        const selector = document.querySelector('.sidebar ul a[href="' + window.location.pathname + '"]');
        if (selector) {
            selector.classList.add('active');
            const ul: any = selector.closest('ul.sub-menu');
            if (ul) {
                let ele: any = ul.closest('li.menu').querySelectorAll('.nav-link') || [];
                if (ele.length) {
                    ele = ele[0];
                    setTimeout(() => {
                        ele.click();
                    });
                }
            }
        }
    }, []);

    useEffect(() => {
        if (window.innerWidth < 1024 && themeConfig.sidebar) {
            dispatch(toggleSidebar());
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location]);
    return (
        <div className={semidark ? 'dark' : ''}>
            <nav
                className={`sidebar fixed min-h-screen h-full top-0 bottom-0 w-[260px] shadow-[5px_0_25px_0_rgba(94,92,154,0.1)] z-50 transition-all duration-300 ${semidark ? 'text-white-dark' : ''}`}
            >
                <div className="bg-white dark:bg-black h-full">
                    <div className="relative h-20 px-4 bg-white shadow-sm dark:bg-dark flex items-center">
                        {/* Logo centrado */}

                        <NavLink
                            to="/bienvenida"
                            className="absolute left-1/2 transform -translate-x-1/2 "
                        >
                            <img
                                src="/assets/images/logo.png"
                                alt="Logo"
                                className="h-16 w-auto object-contain"
                            />
                        </NavLink>


                        {/* Botón alineado a la derecha */}
                        <button
                            type="button"
                            className="ml-auto w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-200 dark:hover:bg-dark-light/20 transition duration-300 rtl:rotate-180"
                            onClick={() => dispatch(toggleSidebar())}
                        >
                            <IconCaretsDown className="rotate-90 text-gray-600 dark:text-white" />
                        </button>
                    </div>


                    <PerfectScrollbar className="h-[calc(100vh-80px)] relative">
                        <ul className="relative font-semibold space-y-0.5 p-4 py-0">

                            <h2 className="py-3 px-7 flex items-center uppercase font-extrabold bg-white-light/30 dark:bg-dark dark:bg-opacity-[0.08] -mx-4 mb-1">
                                <IconMinus className="w-4 h-5 flex-none hidden" />
                                <span>OPERACIONES</span>
                            </h2>

                            <li className="nav-item">
                                <ul>
                                    {/* <li className="menu nav-item">
                                        <button type="button" className={`${currentMenu === 'gestion' ? 'active' : ''} nav-link group w-full`} onClick={() => toggleMenu('gestion')}>
                                            <div className="flex items-center">
                                                <IconPlayCircle className="group-hover:!text-primary shrink-0" />
                                                <span className="ltr:pl-3 rtl:pr-3 text-black dark:text-[#506690] dark:group-hover:text-white-dark">Gestión de Personas</span>
                                            </div>

                                            <div className={currentMenu !== 'gestion' ? 'rtl:rotate-90 -rotate-90' : ''}>
                                                <IconCaretDown />
                                            </div>
                                        </button>

                                        <AnimateHeight duration={300} height={currentMenu === 'gestion' ? 'auto' : 0}>
                                            <ul className="sub-menu text-gray-500">
                                                <li>
                                                    <NavLink to="/gestion/personas">Personal</NavLink>
                                                </li>
                                                <li>
                                                    <NavLink to="/gestion/reclutamiento">Reclutamiento y Seleccion</NavLink>
                                                </li>
                                                <li>
                                                    <NavLink to="/gestion/visitas">Visitas e Ingresos</NavLink>
                                                </li>
                                            </ul>
                                        </AnimateHeight>
                                    </li>
                                    <li className="menu nav-item">
                                        <button type="button" className={`${currentMenu === 'soma' ? 'active' : ''} nav-link group w-full`} onClick={() => toggleMenu('soma')}>
                                            <div className="flex items-center">
                                                <IconPlayCircle className="group-hover:!text-primary shrink-0" />
                                                <span className="ltr:pl-3 rtl:pr-3 text-black dark:text-[#506690] dark:group-hover:text-white-dark">SOMA</span>
                                            </div>

                                            <div className={currentMenu !== 'soma' ? 'rtl:rotate-90 -rotate-90' : ''}>
                                                <IconCaretDown />
                                            </div>
                                        </button>

                                        <AnimateHeight duration={300} height={currentMenu === 'soma' ? 'auto' : 0}>
                                            <ul className="sub-menu text-gray-500">
                                                <li>
                                                    <NavLink to="/soma/epps">Gestión Epps</NavLink>
                                                </li>
                                                <li>
                                                    <NavLink to="/soma/incidentes">Gestión Incidentes</NavLink>
                                                </li>
                                            </ul>
                                        </AnimateHeight>
                                    </li>
                                    <li className="menu nav-item">
                                        <button type="button" className={`${currentMenu === 'laboratorio' ? 'active' : ''} nav-link group w-full`} onClick={() => toggleMenu('laboratorio')}>
                                            <div className="flex items-center">
                                                <IconSettings className="group-hover:!text-primary shrink-0" />
                                                <span className="ltr:pl-3 rtl:pr-3 text-black dark:text-[#506690] dark:group-hover:text-white-dark">Laboratorio Químico</span>
                                            </div>

                                            <div className={currentMenu !== 'laboratorio' ? 'rtl:rotate-90 -rotate-90' : ''}>
                                                <IconCaretDown />
                                            </div>
                                        </button>

                                        <AnimateHeight duration={300} height={currentMenu === 'laboratorio' ? 'auto' : 0}>
                                            <ul className="sub-menu text-gray-500"> 
                                                <li>
                                                    <NavLink to="/laboratorio/leyes">Gestión de Leyes</NavLink>
                                                </li>

                                            </ul>
                                        </AnimateHeight>
                                    </li>
                                    <li className="menu nav-item">
                                        <button type="button" className={`${currentMenu === 'seguridapatrimonial' ? 'active' : ''} nav-link group w-full`} onClick={() => toggleMenu('seguridapatrimonial')}>
                                            <div className="flex items-center">
                                                <IconSettings className="group-hover:!text-primary shrink-0" />
                                                <span className="ltr:pl-3 rtl:pr-3 text-black dark:text-[#506690] dark:group-hover:text-white-dark">Seguridad Patrimonial</span>
                                            </div> 
                                            <div className={currentMenu !== 'seguridapatrimonial' ? 'rtl:rotate-90 -rotate-90' : ''}>
                                                <IconCaretDown />
                                            </div>
                                        </button>

                                        <AnimateHeight duration={300} height={currentMenu === 'seguridapatrimonial' ? 'auto' : 0}>
                                            <ul className="sub-menu text-gray-500"> 
                                                <li>
                                                    <NavLink to="/seguridapatrimonial/control">Control de Acceso</NavLink>
                                                </li> 
                                            </ul>
                                        </AnimateHeight>
                                    </li> */}
                                    {menu && menu != "-1" && menu.map((item: any) => (
                                        <li className="menu nav-item" key={item.id}>
                                            {item.submenu ? <>
                                                <button type="button" className={`${currentMenu === item.nombre ? 'active' : ''} nav-link group w-full`} onClick={() => toggleMenu(item.nombre)}>
                                                    <div className="flex items-center">
                                                        <IconMenuDashboard
                                                            className="group-hover:!text-primary shrink-0" />
                                                        <span className="ltr:pl-3 rtl:pr-3 text-black dark:text-[#506690] dark:group-hover:text-white-dark">{item.nombre}</span>
                                                    </div>

                                                    <div className={currentMenu !== item.nombre ? 'rtl:rotate-90 -rotate-90' : ''}>
                                                        <IconCaretDown />
                                                    </div>
                                                </button>
                                                <AnimateHeight duration={300} height={currentMenu === item.nombre ? 'auto' : 0}>
                                                    <ul className="sub-menu text-gray-500">
                                                        {item.submenu.map((subitem: any) => (
                                                            <li key={subitem.id}>
                                                                <NavLink to={"/" + subitem.link}>{subitem.nombre}</NavLink>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </AnimateHeight>
                                            </>
                                                : <NavLink to={"/" + item.link} className="group">
                                                    <div className="flex items-center">
                                                        <IconMenuScrumboard className="group-hover:!text-primary shrink-0" />
                                                        <span className="ltr:pl-3 rtl:pr-3 text-black dark:text-[#506690] dark:group-hover:text-white-dark">{item.nombre}</span>
                                                    </div>
                                                </NavLink>
                                            }
                                        </li>
                                    ))}
                                    {menu == "-1" &&
                                        <li className="menu nav-item">
                                            <NavLink to="/login" className="group">
                                                <div className="flex items-center">
                                                    <IconMenuDashboard className="group-hover:!text-primary shrink-0" />
                                                    <span className="ltr:pl-3 rtl:pr-3 text-black dark:text-[#506690] dark:group-hover:text-white-dark">Login</span>
                                                </div>
                                            </NavLink>
                                        </li>
                                    }
                                </ul>
                            </li>

                        </ul>
                    </PerfectScrollbar>
                </div>
            </nav>
        </div>
    );
};

export default Sidebar;
