import React from 'react';
import { HelpCircle, Utensils, X } from 'lucide-react';

interface ComedorHeaderProps {
    subtitulo: string;
    descripcion: string;
    /** Botones de la derecha (ej. "Nueva Variable"); "Ayuda" siempre se muestra. */
    acciones?: React.ReactNode;
    onAyuda?: () => void;
    /** Ícono del círculo azul (por defecto, cubiertos). */
    icono?: React.ReactNode;
}

export const ComedorHeader: React.FC<ComedorHeaderProps> = ({ subtitulo, descripcion, acciones, onAyuda, icono }) => (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                {icono ?? <Utensils size={28} />}
            </div>
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Comedor</h1>
                <h2 className="text-xl text-gray-600">{subtitulo}</h2>
                <p className="mt-0.5 text-sm text-gray-500">{descripcion}</p>
            </div>
        </div>
        <div className="flex items-center gap-2">
            {acciones}
            <button
                type="button"
                onClick={onAyuda}
                className="flex items-center gap-2 rounded border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
                <HelpCircle size={16} /> Ayuda
            </button>
        </div>
    </div>
);

interface ModalProps {
    titulo: string;
    subtitulo?: string;
    onClose: () => void;
    children: React.ReactNode;
    footer?: React.ReactNode;
    /** Clase de ancho máximo (por defecto `max-w-lg`). */
    ancho?: string;
}

export const Modal: React.FC<ModalProps> = ({ titulo, subtitulo, onClose, children, footer, ancho = 'max-w-lg' }) => (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
        <div
            className={`w-full ${ancho} rounded-xl bg-white shadow-2xl`}
            onMouseDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
        >
            <div className="flex items-start justify-between border-b border-gray-100 p-5">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">{titulo}</h3>
                    {subtitulo && <p className="text-sm text-gray-500">{subtitulo}</p>}
                </div>
                <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700" aria-label="Cerrar">
                    <X size={20} />
                </button>
            </div>
            <div className="max-h-[65vh] overflow-y-auto p-5">{children}</div>
            {footer && <div className="flex justify-end gap-3 border-t border-gray-100 p-4">{footer}</div>}
        </div>
    </div>
);

export const EstadoBadge: React.FC<{ activo: boolean }> = ({ activo }) => (
    <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}
    >
        <span className={`h-2 w-2 rounded-full ${activo ? 'bg-green-500' : 'bg-red-500'}`} />
        {activo ? 'Activo' : 'Inactivo'}
    </span>
);

export const inputCls =
    'w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';
