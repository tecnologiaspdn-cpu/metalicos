import React from "react";
import Button from "devextreme-react/button";
import { TipoSolicitudFirma } from "../../types/FirmaDocumento";

type Opcion = {
    key: TipoSolicitudFirma;
    titulo: string;
    subtitulo: string;
    descripcion: string;
    disponible: boolean;
    /** Paleta tailwind por opción (para el círculo del ícono y el subtítulo). */
    acento: {
        circulo: string;
        badge: string;
        texto: string;
        boton: "default" | "success" | "normal";
    };
    icono: React.ReactNode;
};

const DocIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={1.6}>
        <path d="M7 3h7l5 5v13a0 0 0 0 1 0 0H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
        <path d="M14 3v5h5" />
        <path d="M8 13c1.5-1.5 2.5 1.5 4 0s2.5 1.5 4 0" />
    </svg>
);

const BadgeUnica: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
        <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-3.3 0-8 1.7-8 4v2h16v-2c0-2.3-4.7-4-8-4z" />
    </svg>
);
const BadgeVarios: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
        <path d="M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 2c-2.7 0-6 1.3-6 4v2h8v-2c0-1 .4-1.9 1-2.7A9 9 0 0 0 8 13zm8 0c-.5 0-1 0-1.5.1 1 .9 1.5 2 1.5 3.4V18h6v-2c0-2.7-3.3-4-6-4z" />
    </svg>
);
const BadgeAuditoria: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
        <path d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3zm-1 13-3-3 1.4-1.4L11 12.2l4.6-4.6L17 9l-6 6z" />
    </svg>
);

const OPCIONES: Opcion[] = [
    {
        key: "unica",
        titulo: "FIRMA DE DOCUMENTO",
        subtitulo: "(FIRMA ÚNICA)",
        descripcion:
            "Firma un documento únicamente con tu rúbrica. Ideal para documentos personales o de uso interno.",
        disponible: true,
        acento: {
            circulo: "bg-blue-50 text-blue-500",
            badge: "bg-blue-600 text-white",
            texto: "text-blue-600",
            boton: "default",
        },
        icono: <DocIcon className="h-10 w-10" />,
    },
    {
        key: "varios",
        titulo: "FIRMA DE DOCUMENTO",
        subtitulo: "(VARIOS)",
        descripcion:
            "Envía un documento a una o más personas para que lo firmen. Se gestionará el flujo de firmas automáticamente.",
        disponible: true,
        acento: {
            circulo: "bg-emerald-50 text-emerald-500",
            badge: "bg-emerald-600 text-white",
            texto: "text-emerald-600",
            boton: "success",
        },
        icono: <DocIcon className="h-10 w-10" />,
    },
    {
        key: "auditoria",
        titulo: "FIRMA DE DOCUMENTO",
        subtitulo: "(AUDITORÍA)",
        descripcion:
            "Firma un documento con trazabilidad completa. Se generará un registro de auditoría detallado de todo el proceso.",
        disponible: false,
        acento: {
            circulo: "bg-purple-50 text-purple-400",
            badge: "bg-purple-500 text-white",
            texto: "text-purple-500",
            boton: "normal",
        },
        icono: <DocIcon className="h-10 w-10" />,
    },
];

const BADGE_POR_TIPO: Record<TipoSolicitudFirma, React.ReactNode> = {
    unica: <BadgeUnica />,
    varios: <BadgeVarios />,
    auditoria: <BadgeAuditoria />,
};

type Props = {
    onSeleccionar: (tipo: TipoSolicitudFirma) => void;
};

/**
 * Pantalla de entrada de "Nuevo Documento": el usuario elige el tipo de firma
 * (Firma única / Varios / Auditoría). La opción de Auditoría queda bloqueada,
 * prevista para una versión futura.
 */
const SeleccionTipoFirma: React.FC<Props> = ({ onSeleccionar }) => {
    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold text-gray-800">Nuevo Documento</h2>
                    <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-red-500">
                        FIRMA
                    </span>
                </div>
                <p className="text-sm text-gray-500">
                    Selecciona el tipo de firma que deseas realizar. De acuerdo a tu elección, el flujo y las
                    opciones disponibles cambiarán.
                </p>
            </div>

            <h3 className="text-sm font-semibold text-gray-600">Selecciona una opción para continuar</h3>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                {OPCIONES.map((o) => (
                    <div
                        key={o.key}
                        className={`relative flex flex-col items-center gap-4 rounded-2xl border p-6 text-center shadow-sm transition ${
                            o.disponible
                                ? "border-gray-200 bg-white hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md"
                                : "border-gray-200 bg-gray-50"
                        }`}
                    >
                        {!o.disponible && (
                            <span className="absolute right-3 top-3 rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                                Próximamente
                            </span>
                        )}

                        <div
                            className={`relative flex h-24 w-24 items-center justify-center rounded-full ${o.acento.circulo} ${
                                !o.disponible ? "opacity-60" : ""
                            }`}
                        >
                            {o.icono}
                            <span
                                className={`absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-white ${o.acento.badge}`}
                            >
                                {BADGE_POR_TIPO[o.key]}
                            </span>
                        </div>

                        <div className="flex flex-col gap-0.5">
                            <span className={`text-sm font-bold ${o.disponible ? "text-gray-800" : "text-gray-500"}`}>
                                {o.titulo}
                            </span>
                            <span className={`text-sm font-bold ${o.disponible ? o.acento.texto : "text-gray-400"}`}>
                                {o.subtitulo}
                            </span>
                        </div>

                        <p className="min-h-[72px] text-xs leading-relaxed text-gray-500">{o.descripcion}</p>

                        <Button
                            text="Seleccionar opción"
                            icon={o.key === "unica" ? "edit" : o.key === "varios" ? "group" : "lock"}
                            type={o.acento.boton}
                            stylingMode={o.disponible ? "outlined" : "outlined"}
                            width="100%"
                            disabled={!o.disponible}
                            onClick={() => o.disponible && onSeleccionar(o.key)}
                        />
                    </div>
                ))}
            </div>

            <div className="flex items-start gap-2 rounded-xl bg-blue-50 p-3 text-xs text-blue-700">
                <i className="dx-icon-info mt-0.5" />
                <span>
                    Podrás revisar, dar seguimiento y gestionar todos tus documentos desde el módulo de Documentos.
                </span>
            </div>
        </div>
    );
};

export default SeleccionTipoFirma;
