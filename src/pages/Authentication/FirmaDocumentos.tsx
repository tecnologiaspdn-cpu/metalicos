import { useState } from "react";
import NavDropdown, { NavItem } from "../../components/NavDropdown";
import Button from "devextreme-react/cjs/button";
import { useFirmaDocumentos } from "../../hooks/useFirmaDocumentos";
import { useSeguimientoFirma } from "../../hooks/useSeguimientoFirma";
import NuevoDocumentoFirma from "../../components/FirmaDocumentos/NuevoDocumentoFirma";
import SeleccionTipoFirma from "../../components/FirmaDocumentos/SeleccionTipoFirma";
import DocumentosGenerados from "../../components/FirmaDocumentos/DocumentosGenerados";
import DocumentosRecibidos from "../../components/FirmaDocumentos/DocumentosRecibidos";
import FirmarDocumento from "../../components/FirmaDocumentos/FirmarDocumento";
import SeguimientoFirma from "../../components/FirmaDocumentos/SeguimientoFirma";
import { DocumentoFirma, TipoSolicitudFirma } from "../../types/FirmaDocumento";

type Vista =
    | "empty"
    | "nuevoDocumento"
    | "documentosCreados"
    | "documentosRecibidos"
    | "solicitudFirma"
    | "firmarDocumento"
    | "seguimientoFirma";

const FirmaDocumentos = () => {
    const [activeView, setActiveView] = useState<Vista>("empty");
    // Tipo elegido en "Solicitud Firma" (Firma única / Varios / Auditoría).
    const [tipoSolicitud, setTipoSolicitud] = useState<TipoSolicitudFirma | null>(null);
    // Documento abierto en la pantalla "Firmar documento" y vista desde donde se abrió.
    const [docParaFirmar, setDocParaFirmar] = useState<DocumentoFirma | null>(null);
    const [origenFirma, setOrigenFirma] = useState<Vista>("documentosRecibidos");
    const {
        opcionesFirmante,
        loadingPersonal,
        documentosCreados,
        documentosRecibidos,
        loadingCreados,
        loadingRecibidos,
        tiposDocumento,
        loadingTiposDocumento,
        fetchCreados,
        fetchRecibidos,
        crearDocumento,
        enviarBorrador,
        firmarDocumento,
        rechazarDocumento,
        anularDocumento,
    } = useFirmaDocumentos();
    const { documentos: documentosSeguimiento, loading: loadingSeguimiento, error: errorSeguimiento, fetchDocumentos: fetchSeguimiento } =
        useSeguimientoFirma();

    const irASolicitudFirma = () => {
        setTipoSolicitud(null);
        setActiveView("solicitudFirma");
    };

    const abrirFirma = (doc: DocumentoFirma, origen: Vista) => {
        setDocParaFirmar(doc);
        setOrigenFirma(origen);
        setActiveView("firmarDocumento");
    };

    const menuItems: NavItem[] = [
        { text: "Solicitud Firma", onClick: irASolicitudFirma },
        { text: "Documentos Creados", onClick: () => setActiveView("documentosCreados") },
        { text: "Documentos Recibidos", onClick: () => setActiveView("documentosRecibidos") },
        { text: "Seguimiento Firma", onClick: () => setActiveView("seguimientoFirma") },
    ];

    const titulos: Record<Vista, string> = {
        empty: "",
        nuevoDocumento: "Documentos > Subir Documento",
        documentosCreados: "Documentos Creados",
        documentosRecibidos: "Documentos Recibidos",
        solicitudFirma: "Solicitud Firma",
        firmarDocumento: "Firmar documento",
        seguimientoFirma: "Seguimiento Firma",
    };

    // Vistas con su propio encabezado / que ocultan el botón superior.
    const vistaPlena =
        activeView === "solicitudFirma" ||
        activeView === "nuevoDocumento" ||
        activeView === "firmarDocumento";
    const sinTituloPagina =
        activeView === "empty" ||
        activeView === "documentosRecibidos" ||
        activeView === "documentosCreados" ||
        activeView === "firmarDocumento" ||
        activeView === "seguimientoFirma";

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
                {/* Encabezado y botón */}
                <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <NavDropdown id="nav-firma-documentos" items={menuItems} label="Documentos" />
                        {!sinTituloPagina && (
                            <h1 className="text-lg sm:text-xl font-semibold text-gray-800">{titulos[activeView]}</h1>
                        )}
                    </div>
                    {!vistaPlena && (
                        <Button
                            text="Solicitud Firma"
                            icon="plus"
                            type="default"
                            stylingMode="contained"
                            onClick={irASolicitudFirma}
                        />
                    )}
                </div>

                {activeView === "empty" && (
                    <div className="flex items-center justify-center py-20">
                        <div className="max-w-xl text-center">
                            <h2 className="text-xl font-semibold text-gray-800">Firma de Documentos</h2>
                            <p className="mt-2 text-gray-500">
                                Use el menú "Documentos" para crear una nueva solicitud de firma, o revisar los documentos
                                creados y recibidos.
                            </p>
                        </div>
                    </div>
                )}

                {activeView === "solicitudFirma" && (
                    <SeleccionTipoFirma
                        onSeleccionar={(tipo) => {
                            setTipoSolicitud(tipo);
                            setActiveView("nuevoDocumento");
                        }}
                    />
                )}

                {activeView === "nuevoDocumento" && (
                    <NuevoDocumentoFirma
                        opcionesFirmante={opcionesFirmante}
                        loadingPersonal={loadingPersonal}
                        tiposDocumento={tiposDocumento}
                        loadingTiposDocumento={loadingTiposDocumento}
                        solicitudTipo={tipoSolicitud}
                        onVolver={() => setActiveView("solicitudFirma")}
                        onGuardar={crearDocumento}
                        onGuardado={() => setActiveView("documentosCreados")}
                    />
                )}

                {activeView === "firmarDocumento" && docParaFirmar && (
                    <FirmarDocumento
                        doc={docParaFirmar}
                        onVolver={() => setActiveView(origenFirma)}
                        onFirmar={firmarDocumento}
                        onRechazar={origenFirma === "documentosRecibidos" ? rechazarDocumento : undefined}
                    />
                )}

                {activeView === "documentosCreados" && (
                    <DocumentosGenerados
                        documentos={documentosCreados}
                        loading={loadingCreados}
                        onRefrescar={fetchCreados}
                        onEnviarBorrador={enviarBorrador}
                        onAnular={anularDocumento}
                    />
                )}

                {activeView === "documentosRecibidos" && (
                    <DocumentosRecibidos
                        documentos={documentosRecibidos}
                        loading={loadingRecibidos}
                        onRefrescar={fetchRecibidos}
                        onAbrirFirma={(doc) => abrirFirma(doc, "documentosRecibidos")}
                        onRechazar={rechazarDocumento}
                    />
                )}

                {activeView === "seguimientoFirma" && (
                    <SeguimientoFirma
                        documentos={documentosSeguimiento}
                        loading={loadingSeguimiento}
                        error={errorSeguimiento}
                        onRefrescar={fetchSeguimiento}
                    />
                )}
            </div>
        </div>
    );
};
export default FirmaDocumentos;
