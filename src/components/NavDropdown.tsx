import React from "react";
import ContextMenu from "devextreme-react/context-menu";

/** Estructura de ítems (hasta 2–3 niveles) */
export type NavItem = {
    text: string;
    onClick?: () => void;
    items?: NavItem[];
};

type Props = {
    /** Texto que se muestra al lado del icono (ej. “Navegar”) */
    label?: string;
    /** Ítems del menú (módulos, reportes, etc.) */
    items: NavItem[];
    /** id único del botón para permitir múltiples menús en la misma pantalla */
    id?: string;
    /** Clases Tailwind opcionales para el botón contenedor */
    className?: string;
};

const MenuIcon: React.FC = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-5 h-5"
    >
        <path
            d="M4 6h16M4 12h16M4 18h16"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
        />
    </svg>
);

/** Navegador desplegable reusable basado en DevExtreme ContextMenu */
const NavDropdown: React.FC<Props> = ({
    label = "Navegar",
    items,
    id = "nav-trigger",
    className = "",
}) => {
    return (
        <div className={`rounded-2xl border bg-white shadow-sm ${className}`}>
            {/* Botón disparador */}
            <button id={id} className="flex items-center gap-2 px-3 py-2 text-gray-700">
                <MenuIcon />
                <span className="hidden sm:inline">{label}</span>
            </button>

            {/* Menú: abre con click y aparece DEBAJO del botón */}
            <ContextMenu
                target={`#${id}`}
                items={items as any}
                showEvent="click"
                onItemClick={(e: any) => e.itemData?.onClick?.()}
                position={{ at: "left bottom", my: "left top" }} // debajo del botón
            />
        </div>
    );
};

export default NavDropdown;
